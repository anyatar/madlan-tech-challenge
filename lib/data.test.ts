// Regression test on the real CSV: pins what cleaning produces today, and checks real answers against an independent calculation.
// If you change a cleaning rule on purpose, update these numbers and say why in DECISIONS.md.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { clean, type Deal } from "./clean.ts";
import { MIN_N, answer } from "./engine.ts";
import type { Filters } from "./schema.ts";

const { deals, report } = clean(readFileSync(new URL("../data/deals.csv", import.meta.url), "utf8"), "2026-10-19");

test("row counts: 530 in, 518 deals, 2 quarantined", () => {
  assert.equal(report.counts.rowsIn, 530);
  assert.equal(report.counts.dealsOut, 518);
  assert.deepEqual(report.quarantine.map((q) => [q.id, q.reason]).sort(), [
    ["D100251", "price-below-floor"], // ₪0
    ["D100317", "price-below-floor"], // ₪18,000
  ]);
});

test("duplicates: 6 exact copies merged, 4 resolved by source precedence, ids unique", () => {
  assert.equal(report.counts.changesByRule["duplicate-merged"], 6);
  assert.equal(report.counts.changesByRule["source-precedence"], 4);
  assert.equal(new Set(deals.map((d) => d.id)).size, deals.length);
});

test("only the two implausible penthouses are excluded from statistics", () => {
  assert.deepEqual(deals.filter((d) => d.excludeFromStats).map((d) => d.id).sort(), ["D100001", "D100193"]);
});

test("every city is canonical, and no neighborhood is left in Latin script", () => {
  assert.deepEqual([...new Set(deals.map((d) => d.city))].sort(), [
  "אשדוד", "באר שבע", "בית שמש", "בת ים", "גבעתיים", "הרצליה", "חולון", "חיפה", "ירושלים",
  "כפר סבא", "מודיעין-מכבים-רעות", "נתניה", "פתח תקווה", "ראשון לציון", "רחובות", "רמת גן", "רעננה", "תל אביב-יפו",
  ].sort());
  assert.deepEqual(deals.filter((d) => /[A-Za-z]/.test(d.neighborhood ?? "")).map((d) => d.neighborhood), []);
});

test("every deal has a price, a known date and a valid room count", () => {
  for (const d of deals) {
    assert.ok(d.price >= 100_000, d.id);
    assert.match(d.date, /^\d{4}-\d{2}(-\d{2})?$/, d.id);
    assert.ok(d.rooms >= 1 && d.rooms <= 12, d.id);
    if (d.sizeSqm !== null) assert.equal(d.pricePerSqm, Math.round(d.price / d.sizeSqm), d.id);
  }
});

// Real-data answers checked against a calculation written separately here, so a bug in matches() or quantile() can't hide.
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return Math.round(s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2);
};
const ppsqm = (keep: (d: Deal) => boolean) =>
  deals.filter((d) => keep(d) && !d.excludeFromStats && d.pricePerSqm !== null).map((d) => d.pricePerSqm!);

const statCases: [string, Filters, "price" | "pricePerSqm", number[]][] = [
  ["Holon, 4 rooms, ₪/m²", { cities: ["חולון"], rooms: { min: 4, max: 4 } }, "pricePerSqm", ppsqm((d) => d.city === "חולון" && d.rooms === 4)],
  ["Tel Aviv, price", { cities: ["תל אביב-יפו"] }, "price", deals.filter((d) => d.city === "תל אביב-יפו" && !d.excludeFromStats).map((d) => d.price)],
  ["Jerusalem ₪/m², skips the flagged penthouse", { cities: ["ירושלים"] }, "pricePerSqm", ppsqm((d) => d.city === "ירושלים")],
  ["Haifa ₪/m² since 2025", { cities: ["חיפה"], dateFrom: "2025" }, "pricePerSqm", ppsqm((d) => d.city === "חיפה" && d.date >= "2025")],
];

for (const [name, filters, metric, expected] of statCases) {
  test(`real data: ${name}`, () => {
    const a = answer({ type: "stat", filters, metric }, deals);
    assert.ok(a.type === "stat" && expected.length >= MIN_N);
    assert.deepEqual(a.widened, []);
    assert.equal(a.n, expected.length);
    assert.equal(a.summary?.median, median(expected));
  });
}

test("real data: cheapest-city ranking matches per-city medians", () => {
  const a = answer({ type: "ranking", filters: {}, groupBy: "city", order: "cheapest" }, deals);
  const expected = [...new Set(deals.map((d) => d.city))]
    .map((city) => ({ key: city, values: ppsqm((d) => d.city === city) }))
    .filter((g) => g.values.length >= MIN_N)
    .map((g) => ({ key: g.key, median: median(g.values) }))
    .sort((x, y) => x.median - y.median);
  assert.ok(a.type === "ranking");
  assert.deepEqual(a.groups.map((g) => ({ key: g.key, median: g.summary!.median })), expected);
});
