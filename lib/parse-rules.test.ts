import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRules } from "./parse-rules.ts";
import { CASES } from "./questions.ts";

const vocab = {
  cities: new Set([
    "אשדוד", "באר שבע", "בית שמש", "בת ים", "גבעתיים", "הרצליה", "חולון", "חיפה", "ירושלים",
  "כפר סבא", "מודיעין-מכבים-רעות", "נתניה", "פתח תקווה", "ראשון לציון", "רחובות", "רמת גן", "רעננה", "תל אביב-יפו",
  ]),
  neighborhoods: new Map([
    ["נאות רחל", ["חולון"]],
    ["קריית שרת", ["חולון"]],
    ["פלורנטין", ["תל אביב-יפו"]],
    ["מרכז", ["רמת גן", "בת ים"]],
  ]),
};


for (const [question, expected] of CASES)
  test(question, () => {
    const q = parseRules(question, vocab);
    if (expected === null) assert.equal(q, null);
    else assert.partialDeepStrictEqual(q, expected);
  });

test("places with no deals get 'no data', in any spelling; everyday words that are village names don't", () => {
  for (const [q, detail] of [
    ["דירות בקריית שמונה", "קרית שמונה"], ["דירות בקרית שמונה", "קרית שמונה"], ["כמה עולה דירה בנצרת?", "נצרת"],
    ["דירות 4 חדרים ביהוד", "יהוד-מונוסון"], ["דירות בתל מונד", "תל מונד"],
  ])
    assert.deepEqual(parseRules(q, vocab), { type: "unsupported", reason: "notInData", detail }, q);
  for (const q of ["דירות ברחוב הרצל בחולון", "כמה עולה דירה באזור המרכז?", "דירה במגדל עם מעלית", "דירות ברמות"])
    assert.notEqual(parseRules(q, vocab)?.type, "unsupported", q);
  assert.partialDeepStrictEqual(parseRules("דירות ברחוב הרצל בחולון", vocab), { type: "search", filters: { cities: ["חולון"] } });
});

test("a covered city named next to an uncovered one is answered", () => {
  assert.partialDeepStrictEqual(parseRules("כמה עולה דירה בחיפה או בנצרת?", vocab), { type: "stat", filters: { cities: ["חיפה"] } });
});
