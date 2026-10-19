// Refreshes data/localities.json, the official list of Israeli localities (CBS, via data.gov.il).
// Run by hand about once a year: npm run fetch-localities. Not part of the build, so builds stay offline and reproducible.
import { writeFileSync } from "node:fs";

const URL_ = "https://data.gov.il/api/3/action/datastore_search?resource_id=5c78e9fa-c2e2-4771-93ff-7f400a12f7ba&limit=5000";

const res = await fetch(URL_);
if (!res.ok) throw new Error(`data.gov.il: HTTP ${res.status}`);
const { result } = (await res.json()) as { result: { total: number; records: Record<string, string | number>[] } };
if (result.records.length !== result.total || result.total < 1000) throw new Error(`expected the full list, got ${result.records.length}/${result.total}`);

const rows = result.records
  .map((r) => ({
    name: String(r["שם_ישוב"]).trim().replace(/\s*-\s*/g, "-"), // "תל אביב - יפו" → "תל אביב-יפו"
    en: String(r["שם_ישוב_לועזי"]).trim(),
    regional: Number(r["סמל_מועצה_איזורית"]) !== 0, // in a regional council: a village, not a city or local council
  }))
  .sort((a, b) => a.name.localeCompare(b.name, "he"));

writeFileSync(new URL("../data/localities.json", import.meta.url), `[\n${rows.map((r) => JSON.stringify(r)).join(",\n")}\n]\n`);
console.log(`${rows.length} localities`);
