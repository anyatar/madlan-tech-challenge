// The /api/ask logic, kept out of the route so it can be tested with a fake model.
import type { Deal } from "./clean.ts";
import { answer } from "./engine.ts";
import { PRESET_QUERIES } from "./examples.ts";
import type { LlmResult } from "./parse-llm.ts";
import { parseRules, type Vocabulary } from "./parse-rules.ts";
import type { Query } from "./schema.ts";

export const MAX_QUESTION = 300;
export const CACHE_MAX = 1000;

// cache: question → the model's query, least recently used first (a Map keeps insertion order).
export type AskDeps = { deals: Deal[]; vocab: Vocabulary; llm: (question: string) => Promise<LlmResult>; cache?: Map<string, Query> };

// A price check judges one price against comparable deals, so it needs a place: without one, prices from every
// city would be mixed into one verdict. Answer it as "what does this money buy" instead, keeping the details given.
function withPlace(q: Query): Query {
  if (q.type !== "priceCheck" || q.filters.cities?.length || q.filters.neighborhoods?.length || q.filters.streets?.length) return q;
  const sizeSqm = q.sizeSqm && { min: Math.round(q.sizeSqm * 0.9), max: Math.round(q.sizeSqm * 1.1) };
  return { type: "budget", filters: { ...q.filters, ...(sizeSqm && { sizeSqm }) }, budget: q.price };
}

// Cities the query names, including both sides of a comparison.
const cities = (q: Query) =>
  q.type === "unsupported" ? [] : [...new Set([q.filters, ...(q.type === "compare" ? q.groups : [])].flatMap((f) => f.cities ?? []))].sort();

export async function ask(body: unknown, { deals, vocab, llm: parseLlm, cache }: AskDeps) {
  const raw = (body as { question?: unknown } | null)?.question;
  const question = typeof raw === "string" ? raw.trim() : "";
  if (!question || question.length > MAX_QUESTION)
    return { status: 400, body: { error: `question must be 1–${MAX_QUESTION} characters` } };

  // An example question from the start page: its query is known in advance, so no model call.
  const preset = PRESET_QUERIES.get(question);
  if (preset) return { status: 200, body: { question, parsedBy: "preset", query: preset, answer: answer(preset, deals) } };

  const rules = parseRules(question, vocab);
  const key = question.replace(/\s+/g, " ").replace(/[?!.]+$/, "");
  const hit = cache?.get(key);
  if (hit) cache!.delete(key); // re-inserted below as the most recently used
  const llm = hit ? { ok: true as const, query: hit, ms: 0 } : await parseLlm(question);

  const parsed = llm.ok ? llm.query : rules;
  if (!parsed) return { status: 200, body: { question, parsedBy: null, llm: { ok: false, error: llm.ok ? undefined : llm.error } } };
  const query = withPlace(parsed);

  // The two parsers disagree on a city the rules saw explicitly: answer with the LLM's reading, offer the other.
  const ruleCities = rules ? cities(rules) : [];
  const alternative = llm.ok && rules && ruleCities.length && ruleCities.join() !== cities(llm.query).join() ? rules : undefined;

  // Only an undisputed model reading is kept: a wrong one would be served to everyone asking the same words.
  if (cache && llm.ok && !alternative) {
    cache.set(key, llm.query);
    if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!);
  }

  return {
    status: 200,
    body: {
      question,
      parsedBy: llm.ok ? "llm" : "rules",
      query,
      priceCheckWithoutPlace: query !== parsed || undefined,
      alternative,
      answer: answer(query, deals),
      llm: llm.ok ? { ok: true, ms: llm.ms, ...(hit && { cached: true }) } : { ok: false, error: llm.error, ms: llm.ms },
    },
  };
}
