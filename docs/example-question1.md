# Example question 1: "How much does a 4-room apartment in Kfar Saba cost?"

**Question:** כמה עולה דירת 4 חדרים בכפר סבא?

**Answer shown:**

> מחיר חציוני: ₪7,219,000
>
> מחצית העסקאות נעו בין ₪5,585,500 ל-₪8,145,500. על סמך 7 עסקאות, 25/10/2022–26/11/2025.

## How the question is parsed

This is one of the six start-page example questions ([lib/examples.ts](lib/examples.ts)), so its query is ready in advance and no model is called:

```json
{ "type": "stat", "metric": "price", "filters": { "cities": ["כפר סבא"], "rooms": { "min": 4, "max": 4 } } }
```

`stat` means "a typical price for a segment" ([lib/schema.ts](lib/schema.ts)). `metric: "price"` because the question asks about the whole price, not the price per m².

There is no property-type filter: "דירה" alone means any property type ([lib/parse-llm.ts](lib/parse-llm.ts), filter rules). So penthouses, roof apartments and private houses are included.

## Why a median and not an average

This is by design ([DECISIONS.md](DECISIONS.md), "Medians, not averages"): the system never shows an average. One unusual deal, such as a ₪40M penthouse, moves the average of 10 deals by millions, but barely moves the median.

## Which deals were used

All 7 deals for 4-room properties in Kfar Saba. None is flagged or excluded, and 7 is at least `MIN_N` = 4, so nothing was widened:

| Date       | Price       | Property type  |
| ---------- | ----------- | -------------- |
| 2024-11-27 | ₪2,618,000  | Roof apartment |
| 2022-10-25 | ₪4,440,000  | Apartment      |
| 2024-05-18 | ₪6,731,000  | Private house  |
| 2024-09-18 | ₪7,219,000  | Private house  |
| 2025-11-26 | ₪7,228,000  | Roof apartment |
| 2024-12-12 | ₪9,063,000  | Penthouse      |
| 2024-03-04 | ₪12,021,000 | Penthouse      |

The date range in the answer, 25/10/2022–26/11/2025, is the earliest and latest of these 7 deals.

## How it is computed

`quantile` in [lib/engine.ts](lib/engine.ts) sorts the prices and finds the position (n−1)×q. If the position falls between two values, it interpolates between them. Here n = 7:

- **Median** (q = 0.5): position 6 × 0.5 = 3, the 4th value → **₪7,219,000**
- **25th percentile** (q = 0.25): position 1.5, halfway between the 2nd and 3rd values: 4,440,000 + 0.5 × (6,731,000 − 4,440,000) → **₪5,585,500**
- **75th percentile** (q = 0.75): position 4.5, halfway between the 5th and 6th values: 7,228,000 + 0.5 × (9,063,000 − 7,228,000) → **₪8,145,500**

"Half of the deals ranged between…" is the range from the 25th to the 75th percentile: the middle half of the deals.

For comparison, the average of the same 7 deals is ₪7,045,714.

## Link to the next demo question

The second demo question, "3.2 מיליון ל-4 חדרים בכפר סבא, זה סביר?", uses the same 7 deals. Only one of them (₪2,618,000) is below ₪3.2M, so the answer is 14% (1 of 7): a low price for this segment.

## Open points

- The median is high because penthouses and private houses are mixed in with ordinary apartments. Someone asking about "an apartment" may expect only regular apartments. Filtering by "דירה" would leave 1 deal, below `MIN_N`, so no median would be shown.
