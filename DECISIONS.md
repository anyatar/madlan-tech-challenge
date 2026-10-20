# Decisions

Short record of what we chose and why. Update when a decision changes.

## Product
- **Persona: a buyer** asking "is this price reasonable / what can I get". Highest-stakes use of the data, so "don't overclaim" matters most here.
- **Supported question types (closed list):**
  1. Search: list matching deals, each expandable
  2. Statistic: median, range, n, date span for a segment
  3. Price check: percentile of a given price among comparable deals
  4. Budget: what a budget buys (by city / rooms / size)
  5. Ranking: cities or neighborhoods by median price per m² (only groups with enough deals)
  6. Comparison: two segments side by side, each with its own n
  7. Trend: median per year, city level or wider only; 2026 marked partial, thin years marked
- **Not supported:**
  - Coverage questions ("which cities / how many deals do you have"). Removed: they would expose the dataset's size and coverage, which may be proprietary.
  - Feature premiums ("how much does parking add"). Confounded at this sample size; a naive difference would overclaim.
- **Declined, with a Hebrew explanation and a suggested supported question:** forecasts, investment advice, anything not in the data (rent, asking prices, schools, transport, exact addresses), causal "why" questions.
- **"No data" is said explicitly**, never shown as an empty list.

## LLM boundary
- **The LLM turns a Hebrew question into `{type, filters, params}` JSON, and that is its only job.** It gets the question plus the valid values (cities, neighborhoods, enums). It never sees deal rows and never writes the answer.
- **The engine (plain code) computes every number. The answer is rendered from a Hebrew template.** Nothing the user sees as a fact comes from the model.
- **Grounding the user can see:** the interpretation shown as chips ("הבנתי: ..."), n and the date span, any widening, excluded or flagged deals, the deals behind every number, and which parser handled the question.
- **Medians, not averages.** Below 4 deals (`MIN_N`), show the deals but no statistic.
- **`MIN_N` is 4, lowered from 5.** More small groups (a neighborhood, a city in a budget band) get a median instead of "too few deals". The cost: a median of 4 is the average of the two middle deals, so one unusual deal moves it more, and the middle-half range (25th–75th percentile) is interpolated between neighbouring deals. The answer always shows n and the deals behind it, so the reader can judge.

## Query engine (`lib/engine.ts`)
- **One `Query` schema** (`lib/schema.ts`, zod) is the contract for both parsers. Cities must be official locality names and the other enums are closed lists, so a parser can't invent a city. Cities are checked with a refinement, not an enum: an enum of 1,300 names would bloat the schema in the LLM prompt.
- **Unknown never matches:** a deal with unknown parking or condition doesn't match a parking or condition filter.
- **Widening** when fewer than 4 usable deals: only the room count, by ±0.5, and it is reported. **A place the user named (street or neighborhood) is never dropped:** "כמה עולה דירה בנווה צדק" with 2 deals there shows those 2 deals and no statistic, not a Tel Aviv median under a widening note. Someone who names a neighborhood is asking about that neighborhood; a city-wide number would answer a different question. (Earlier the street, then the neighborhood, were dropped first.). **Comparison never widens**, because widening one side would make the sides incomparable.
- **Budget** ("what can I buy for X") looks at deals priced 80–100% of X, grouped by city. Sizes get a median only when a city has 4 or more deals; otherwise only actual min–max ranges are shown.
- **Price check** compares price per m² when the user gives a size, otherwise the total price, and reports the percentile among comparable deals.
- **A price check needs a place.** With no city, neighborhood or street, a verdict would mix every city's prices into one judgment about an apartment we can't place ("3 מיליון לדירת 4 חדרים, זה סביר?" landed at the 17th percentile of 4-room deals across all 18 cities, which says nothing about any particular apartment). Such a question is answered as a budget question instead, keeping the details given: where apartments like that sold for that price, by city, with a note asking for a city to check a specific apartment. Done in `lib/ask.ts` after the parser runs, so it works the same for the model and the keyword parser, and the chips show "מה אפשר לקנות".
- **Ranking** shows only groups with 4 or more deals and reports how many groups were left out.
- **Places outside the dataset** are answered "no data for X", never with a country-wide answer. "Outside" is worked out, not listed: any official locality (below) that has no deals in the current CSV.

## Cities: the official list, not the sample's
- **Every official Israeli locality is known** (`data/localities.json`: the CBS list from data.gov.il, ~1,300 names with English names and whether each is in a regional council). A new CSV with קרית שמונה is kept and answerable with no code change. Only names that aren't real places (typos) are quarantined.
- **Committed snapshot, refreshed by hand** (`npm run fetch-localities`, about once a year), not fetched during the build: builds stay offline and reproducible, and a data.gov.il outage can't break a deploy. The list is also needed before cleaning runs, which rules out generating it.
- **Two lists, two jobs.** All localities: recognizing a place (cleaning, both parsers). Covered cities (`vocab.cities`, the cities that have deals, built from `deals.json` like neighborhoods): the LLM prompt, and "do we have data here". The prompt lists only covered cities; the model already knows place names, and code checks them.
- **Aliases:** official Hebrew names, unambiguous English names (four English names shared by two localities are left out), and a short hand-written `NICKNAMES` list (ת"א, ב"ש, יהוד...). `cityKey` treats קריית/קרית, dashes and spaces as equal. A new spelling in a CSV shows in `/admin` as unknown city; add a nickname.
- **The keyword parser looks places up instead of scanning for them:** every 1–4 word run of the question, with prefix letters removed, is looked up in the alias map. A few dozen lookups whatever the list size.
- **It only spots places whose names aren't everyday words:** multi-word names, and one-word cities and local councils except אזור and מגדל. One-word villages (רחוב, רמות, שחר...) are left to the LLM, so "דירות ברחוב הרצל" isn't read as a place. A covered city is always spotted. The LLM parser maps any real place with no deals to "no data".
- **Not in the CBS list:** places CBS doesn't count as localities (e.g. בית ליד) stay "unknown city" until someone maps them to a locality as a nickname.

## Model choice
- **Claude Haiku 5.5** (`claude-haiku-5-5`, overridable with the `LLM_MODEL` env var) for question parsing: the cheapest current Claude model, and parsing needs no reasoning (thinking off, effort low). The system prompt (valid cities, neighborhoods, enums) is prompt-cached.
- **Considered and rejected: a free tier (Groq, open models).** Free-tier rate limits are designed not to cover 10k requests/day, so at peak most answers would come from the rule fallback; Hebrew quality of open models is unmeasured; and the paid cost is small. A hard monthly spend limit in the Anthropic Console caps the risk.
- A Pro (claude.ai) subscription can't be used: it covers one person's use of Claude, not an app serving the public.
- **The model's reply is plain JSON validated by our zod schema, not the API's structured outputs.** Structured outputs compile the schema into a grammar; ours (8 query types × ~15 optional filters) was rejected as "Schema is too complex" after ~40s. The schema now sits in the cached system prompt, written with shared references (4× smaller). Invalid JSON, an off-schema reply, a refusal or an unknown neighborhood all count as failures and go to the rule parser.
- **Measured (31 Hebrew questions, `npm run eval-llm`):** 31/31 correct, median 1.0s, max 2.3s, **$0.81 per 10k questions** (~$24/month at 10k/day) before caching answers.
- **One question was removed from the evaluation set:** "כמה עלו דירות בפלורנטין" is genuinely ambiguous Hebrew (cost, or went up?), so it tested the wording rather than the parser.
- **The model's "no data" detail is never shown as written:** it is reduced to a place name from the official list ("אילת אינה ברשימת הערים" → "אילת", "קריית שמונה" → "קרית שמונה"), or dropped, so free text from the model never reaches the screen. Found by the evaluation, which caught the model writing a sentence where a place name belongs.
- **After any change to the prompt or the schema, run `npm run eval-llm`.** Unit tests use a fake model and can't see changes in what the real model writes.
- **Cost model (verified against the live pricing page: input $0.10, 5-min cache write $0.125, cache read $0.01, output $0.50 per million tokens).** Per question: the system prompt is 4,167 tokens (mostly Hebrew neighborhood names; Hebrew is ~1 token per character), plus ~26 tokens of question and ~53 tokens of JSON output.
  - Cache warm: ~$0.00007 → **~$21/month** at 10k/day. At ~7 requests/minute every hit refreshes the 5-minute cache, so only quiet periods (nights) pay a cache write: a few cents a day.
  - No cache at all: ~$0.00045 → **~$135/month**. Cache writes on every call (worst case): ~$0.00055 → ~$165/month.
  - Not included: free tiers for hosting and Redis; abuse, which the rate limit and the console spend cap bound.

## Example questions
- **The six start-page examples have their query worked out in advance** (`lib/examples.ts`). A click skips the model: ~40 ms instead of ~1 s, and no cost. They are the most-clicked questions, especially in a demo.
- **Only the query is precomputed, not the answer:** the engine still computes it from the data on each click (0.02 ms), so the examples stay correct after the data file changes.
- A test checks each preset is a valid query and equal to what the rule parser produces for the same text, so the two can't drift apart. A typed question matches a preset only if it is exactly the same text (after trimming spaces); anything else goes to the model as usual.
- Not precomputed on purpose: answers for typed questions. Measured engine time is 0.02 ms per question on today's data (1.7 ms at 100× the deals, 19 ms at 1000×), against ~800 ms for the model, so precomputing statistics would save nothing noticeable. Repeated typed questions are the job of the query cache below.
- **Query cache: question → the model's `Query`, in memory, LRU, 1,000 entries** (`lib/ask.ts`). A repeat skips the model (~0.8s, ~$0.00007). Kept only when the model succeeded and the rule parser didn't dispute the city, so a wrong reading isn't served to everyone. The key is the question with spaces collapsed and trailing `?!.` dropped; no prompt hash is needed, because a deploy (new CSV, prompt or code) empties memory. Answers are not cached. Shortcut: each Vercel instance has its own copy, emptied on restart, so repeats hit only on a warm instance; move it to Redis only if hits (`llm.cached` in the response) turn out common. Redis was rejected for now: a new service and per-request commands for a hit rate nobody has measured.

## Failure handling
- **A keyword rule parser produces the same `Query` schema** and runs on every question, before the LLM call.
- **One total deadline (~4s) for the LLM call, including retries.** The SDK's built-in retries cover transient errors only (connection, 408/409/429/5xx). No retry on 400/401 or on output our schema check rejects.
- **Fallback order:** LLM, then the rule parser, then a Hebrew "not understood" message with guidance. (A pre-filled filter form was planned and not built.)
- **If the LLM and the rule parser disagree on a city** the rules found explicitly, the answer uses the LLM's reading and the UI shows a note with the rules' reading.
- **Planned, not built yet:** a circuit breaker (after ~5 LLM failures in a minute, skip the LLM for 60s via a Redis key with an expiry), a per-IP rate limit and a daily request cap (then rules only).
- **Built:** the monthly spend limit, set in the Anthropic Console (outside the code).

## Data cleaning (deterministic, at build time)
- **`scripts/clean.ts`: `data/deals.csv` → `deals.json` + `quality.json`.** Same input, same output. No LLM.
- **Every change is logged per row.** Each issue ends as **fixed**, **flagged** (the row stays, the field isn't trusted), or **quarantined** (kept in the report, left out of statistics). No row is dropped silently.
- **Normalization:**
  - trim whitespace; resolve city aliases
  - booleans `כן/yes/TRUE/1`; blank → unknown, not false
  - `"4 חדרים"` → 4; strip `₪` and commas
  - dates: ISO, `dd/mm/yyyy`, `dd.mm.yyyy` (**day-first, Israeli convention**), `Aug 2025` → month only, marked approximate
  - price_per_sqm recomputed from price ÷ size
- **Duplicate IDs:**
  - Identical copies are merged.
  - Price conflicts across sources: precedence **tax authority > broker > owner** (tax authority = the reported transaction; the others are second-hand). The losing value is logged.
  - **Price conflicts within the same source:** keep the deal, show both prices with a badge, **leave it out of price statistics.** Never average and never pick one: either would create a price nobody reported.
- **Implausible values (guardrails):**
  - Impossible (price ≤ 0 or below a floor, size outside ~15–1000 m², future dates) → quarantine.
  - Price per m² ≥2.5× off the city median (national median if the city is thin) → flag as **suspected, pending human review**. The deal stays in the dataset and in search (with a badge) but is excluded from statistics until reviewed. 2.5× was chosen after inspecting the data: it catches exactly the two penthouses (₪44M Pisgat Ze'ev, ₪38.5M Ramat Gan) that look wrong against every peer group; 2× would also catch two deals that are explainable against similar deals; 3× catches nothing.
  - ~10× off → quarantine (likely a typo).
  - Contradictions (e.g. "new from contractor" built in 1950) → flag the field, not the row.
  - **Never auto-correct** (e.g. ×10 for a "missing zero"); that would be inventing data.
  - Missing size: the row stays; price per m² is unknown, so it only counts toward total-price statistics.
  - Garden apartment above floor 1 is flagged in the report only (it can't change any answer).
  - Not checked: elevator in a low building (plausible in private houses).
  - Thresholds live in `THRESHOLDS` in `lib/clean.ts` and are copied into `quality.json`.

## Build tooling
- **`dev` and `build` use Webpack (`--webpack`), not Next 16's default Turbopack.** On the development machine, Windows Application Control blocks Next's native compiler (`next-swc.win32-x64-msvc.node`); Next falls back to a WebAssembly compiler, which doesn't support Turbopack. Webpack works everywhere, including Vercel, at the cost of slower builds, which don't matter at this size. The "Attempted to load @next/swc-win32-x64-msvc" warning still prints locally and is harmless.
- **Tests run on every build** (`prebuild`: cleaning, then `npm test`). A failing test fails the Vercel build, and Vercel keeps the previous version live, so broken logic can't reach production. Tests need no secrets and take about a second. Side effect, intended: `lib/data.test.ts` pins the real CSV's results, so a new CSV can't deploy until those numbers are reviewed and updated.
- **ESLint with the standard Next.js config** (`eslint-config-next`: core-web-vitals + TypeScript), run by hand with `npm run lint`, not in the build, so a style warning can't block a deploy. Two rules changed for this codebase: Hebrew abbreviations (מ"ר, ממ"ד) may use a plain `"` in JSX text, and `_`-named variables that drop a key on purpose aren't flagged. On the code as it stood, lint found no real bugs.
- **`node:test`, not Vitest.** Node 24 runs the TypeScript tests directly, with no dependency or config. Vitest would earn its place only for React component tests (jsdom), which don't exist yet.

## Admin page
- **`/admin` shows every data-quality issue, read-only:** quarantined rows, deals pending review, all flags by reason, possible duplicates, every automatic fix (before → after), and the thresholds. No editing: decisions about the data stay in code and config, where they are reviewed and reproducible.
- **Access: one shared password**, no user accounts. A successful login sets an `HttpOnly`, `SameSite=Strict` cookie holding an expiry signed with HMAC (8 hours). Changing the password logs everyone out. Without `ADMIN_PASSWORD_HASH` set, nobody can log in.
- **The password is stored only as a salted scrypt hash** (`ADMIN_PASSWORD_HASH`, made by `npm run hash-password`), never in plaintext. Someone who can read the env variables, logs or a leaked `.env.local` doesn't learn a password that may be reused elsewhere. scrypt comes with `node:crypto`, so no dependency. The cookie is signed with the hash string, not a second secret, so there is one value to rotate. Anyone who can read the hash can still forge a cookie, so keep it Sensitive. The variable was renamed from `ADMIN_PASSWORD` so a leftover plaintext value fails closed instead of being misread.
- **The report renders only after the cookie check**, inside a Suspense boundary (required by Next 16 with Cache Components); the prerendered shell contains no data. The page is marked `noindex`.
- Shortcut: no limit on login attempts yet; per-IP rate limiting comes with the deploy step.

## Later / cut
- **Next step for production storage: Postgres for data, Redis for shared state.**
  - **Postgres replaces the CSV and the in-memory data as the place where deals live and are managed.** Raw deals arrive from Madlan's feed into a raw table; the same cleaning rules (fix / flag / quarantine) write cleaned deals, the cleaning log and the quarantine into their own tables. Managing data then happens in the database, not by editing a file and redeploying: approving or rejecting a flagged deal, correcting a value, adding a city nickname, each kept with who did it and when. The engine stops loading everything into memory: it turns the validated `Query` into a parameterized SQL query (filters on indexed columns such as city, rooms, date, price; medians and percentiles with `percentile_cont`). The `Query` contract stays, so the parsers, the LLM boundary and the UI don't change, and the model still never sees the data. `/admin` reads the same tables instead of `quality.json`. Not now: 518 deals answer in 0.02 ms from memory, data changes are rare, and a database would add a service, a connection per request and migrations for no gain at this size.
  - **Redis:** the per-IP rate limit, the daily model-call cap and the circuit breaker, shared by all instances (small keys with an expiry, read on every request). The guards come first, with step 5c. The question → query cache moves to Redis only at a major scale-up, well beyond 10×: at 100,000 requests a day the LLM costs ~$210/month, so even a 10% hit rate saves about what the Redis commands would cost.
- **Unparseable values:** the LLM suggests alias mappings offline, they pass the same validators, a human approves, and they become deterministic rules. Approval through a token-protected one-page admin UI. **First to cut** if time runs short.
- Source-precedence admin UI: dropped; precedence stays in config.
- **Human review of suspected deals:** the queue is already in `quality.json` (`flagged`). A review UI (confirm → back into stats, reject → quarantine) is future work.
