# AI log

How we worked with the AI (Claude Code) on this project. Only the turning points: where the AI's answer was wrong, incomplete, or redirected by the user, and what we decided instead. Routine work isn't logged.

The first two entries were rebuilt from `DECISIONS.md` and `PLAN.md` after the original log was lost with the early git history; their details are as recorded there.

| # | Topic | What the AI proposed or said | What was wrong or missing | What we decided, and why |
| --- | --- | --- | --- | --- |
| 1 | Model output format | Force the model's JSON with the API's structured outputs | Our `Query` schema (8 query types × ~15 optional filters) was rejected as "Schema is too complex" after ~40 s | Plain JSON reply, with the schema in the cached prompt and validated by zod. Any invalid reply goes to the rule parser |
| 2 | Cost estimate | "A few dollars a month" | Not measured | Measured with `npm run eval-llm`: ~$21/month at 10k questions a day with the prompt cache warm, $135–165 if caching never worked |
| 3 | City list | Keep a hand-written list of 18 covered cities and ~50 "other places" for "no data" answers | The user pointed out that both lists depended on the sample CSV: a new CSV with קרית שמונה would be quarantined | All ~1,300 official localities (CBS) as a committed file; covered cities and "no data" are worked out from the deals |
| 4 | Lists at runtime | — | The user proposed using only the short (covered) list at runtime | The AI showed the full list is still needed at runtime: without it, "דירות באילת" gets an Israel-wide answer instead of "no data". Both lists are used, for different jobs |
| 5 | Places not in the CBS list | Assumed every real place is in the CBS list, and used בית ליד as an example | בית ליד is not a CBS locality | Such places stay "unknown city" in `/admin` until someone maps them to a locality as a nickname |
| 6 | Measuring cache value | "Check `parsedBy` in your logs" | Nothing was logged: `parsedBy` only went back to the browser, and Vercel Hobby keeps runtime logs for 1 hour | Corrected in the same answer. A hit now shows in the response as `llm.cached` |
| 7 | Query cache | Upstash Redis, shared by all instances, with a written proposal | A new service and paid commands on every request, for a hit rate nobody had measured | The user chose an in-memory LRU (1,000 entries per instance): no new service, no cost, documented as a shortcut |
| 8 | Grounding review | — | The user asked to check the rule "it must not state things the data doesn't support" | The review found a real violation: a price check with no city compares against all cities and calls them "similar deals". Still open |
| 9 | Detail field order | Read "the מקור put before the date" as a request to swap them | That wasn't what the user meant | Reverted at the user's request |
| 10 | Cache proposal text | Wrote that popular questions could be found by mapping the stored hashes back to text | A hash can't be turned back into text | The AI caught it and corrected the proposal |
| 11 | ESLint | Install it, as the standard Next.js setup | The user asked what it actually gives | It found no real bugs on the current code; its value is catching hook and Next.js mistakes in future changes, mostly through the editor extension |
