# Demo: talk track (part 1)

## The exercise

- Build a system that receives a CSV of real-estate deals. The data is messy, probably on purpose, and not normalized, and the system has to deal with that.
- The requirements were very open-ended: use an LLM on one hand, but on other hand the answers should stay predictable and deterministic, and **never invent data that doesn't exist**.

## Who it's for

- I decided to create a system mainly for **buyers**, though sellers and real-estate agents can use it too.
- Buyers ask questions in free-form Hebrew about the deal data the system holds.

## Question 1: typical price

> "כמה עולה דירת 4 חדרים בכפר סבא?"

- Shows the matching deals from the CSV, and the **median**.
- The median gives the user a direction on cost, and unlike an average, outliers don't move it.

## Question 2: price check

> "3.2 מיליון ל-4 חדרים בכפר סבא, זה סביר?"

- Shows where 3.2 million falls among the 4-room deals in Kfar Saba.
- Here only 14% of the 4-room apartments in Kfar Saba sold below that price.
- So 3.2 million is probably optimistic: below the market price.

## Free-form Hebrew

- Handles everyday variations: a city spelled differently or shortened, or with a dash or underscore. תל אביב יפו (ת"א): supports all options.

## The model never invents data

- As the exercise requires, the analysis and the answer are **not** produced by the model. They are computed deterministically.
- The model only maps the question to a structured query; the code produces the answer.

> "כמה יעלו המחירים בשנה הבאה?"

- Predictions, such as how much prices will rise next year: it can't know that, so it doesn't try.

## Admin interface

- Basic for now, but it shows what is going on: which rows of the input CSV were rejected or marked because they didn't make sense.
- Example: an apartment listed as new from a contractor (חדש מקבלן) in a building from 1950 is probably bad data, so it is shown there.
- In the future it will be possible to fix those rows or add them back to the database.

### What the admin page shows

`/admin` is password-protected and read-only. It is the data-quality report written by the cleaning step at build time (`data/quality.json`). With the current CSV: 530 rows in, 518 deals out.

| Section                                | What it holds                                                                                                                                                                    | Now                                                       |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Quarantined (בהסגר)                    | Rows left out of search and statistics, each with its reason                                                                                                                     | 2 (price below ₪100,000)                                  |
| Pending review (ממתינות לבדיקה)        | Deals whose price is suspicious: price per m² 2.5× or more away from the city median. Still in search with a badge, but left out of every statistic until a person reviews them  | 2                                                         |
| All flags (כל הסימונים)                | Deals kept, with one field marked untrusted and treated as unknown. E.g. "new from contractor" in a building more than 5 years old, or a garden apartment above the ground floor | 86 new-but-old building, 50 garden apartment above ground |
| Possible duplicates (כפילויות אפשריות) | The same deal reported under different IDs                                                                                                                                       | 0                                                         |
| Automatic fixes (תיקונים אוטומטיים)    | Every normalization, before → after, grouped by rule: whitespace, date and number formats, city aliases, room suffixes, recomputed price per m², merged duplicates               | 512 changes                                               |
| Thresholds (ספים בשימוש)               | The limits the cleaning used: minimum price, size range, outlier ratios, new-build age                                                                                           | —                                                         |

### Why it exists

- **Every number must be traceable.** The answers are only as good as the data. The admin page shows exactly what was fixed, marked or left out, so nothing in the data changes silently.
- **Cleaning is deterministic, not AI.** The same CSV always gives the same report, and every issue ends one of three ways: fixed, flagged or quarantined, and always logged.
- **A person decides on the doubtful cases.** The system doesn't guess whether a suspicious price is real. It leaves the deal out of the statistics and puts it in front of a human.
- **The thresholds can be tuned.** Seeing what each threshold catches is how they were chosen. For example, 2.5× catches exactly the two penthouses that look wrong against every peer group.
