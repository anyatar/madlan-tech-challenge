// Canonical values and known spelling variants. Shared by data cleaning and the rule-based question parser.
import LOCALITIES from "../data/localities.json" with { type: "json" };

const TLV = "תל אביב-יפו";
const MODIIN = "מודיעין-מכבים-רעות";

// CBS writes "קרית"; people also write "קריית".
export const cityKey = (s: string) =>
  s.trim().toLowerCase().replace(/״/g, '"').replace(/קריית/g, "קרית").replace(/[-–]/g, " ").replace(/\s+/g, " ");

// Nicknames and short forms the official list doesn't have.
export const NICKNAMES: [string, string][] = [
  ["תל אביב", TLV], ['ת"א', TLV], ["tel aviv", TLV],
  ['ב"ש', "באר שבע"],
  ['כ"ס', "כפר סבא"], ['ר"ג', "רמת גן"], ['פ"ת', "פתח תקווה"], ['ראשל"צ', "ראשון לציון"], ["פתח תקוה", "פתח תקווה"],
  ["מודיעין", MODIIN], ["יהוד", "יהוד-מונוסון"], ["פרדס חנה", "פרדס חנה-כרכור"], ["יקנעם", "יקנעם עילית"],
  ["בנימינה", "בנימינה-גבעת עדה"],
];

const english = Map.groupBy(LOCALITIES.filter((l) => l.en), (l) => cityKey(l.en));

// Every spelling we accept → the official name. Built from data/localities.json (refresh: npm run fetch-localities).
export const CITY_ALIASES = new Map<string, string>([
  ...[...english].filter(([, ls]) => ls.length === 1).map(([k, [l]]): [string, string] => [k, l.name]), // shared English names left out
  ...LOCALITIES.map((l): [string, string] => [cityKey(l.name), l.name]),
  ...NICKNAMES.map(([k, c]): [string, string] => [cityKey(k), c]),
]);

export const canonicalCity = (raw: string) => CITY_ALIASES.get(cityKey(raw));

// Places the keyword parser may spot in free text. One-word villages are left out: their names are often plain words
// (רחוב, רמות, שחר), so "ברחוב הרצל" must not read as a place. So are two towns named like everyday words.
export const SPOTTABLE_PLACES = new Set(
  LOCALITIES.filter((l) => /[\s-]/.test(l.name) || (!l.regional && !["אזור", "מגדל"].includes(l.name))).map((l) => l.name),
);

// Neighborhood spellings found in the data, keyed by the variant.
export const NEIGHBORHOOD_ALIASES = new Map([["florentin", "פלורנטין"]]);

export const PROPERTY_TYPES = ["דירה", "דופלקס", "פנטהאוז", "דירת גן", "דירת גג", "בית פרטי"];
export const CONDITIONS = ["חדש מקבלן", "משופץ", "במצב טוב", "שמור", "דורש שיפוץ"];
// Precedence order for conflicting reports of the same deal: the tax authority records the actual transaction.
export const SOURCES = ["רשות המסים", "מתווך", "בעל נכס"];

export const TRUE_WORDS = ["כן", "yes", "true", "1"];
export const FALSE_WORDS = ["לא", "no", "false", "0"];
