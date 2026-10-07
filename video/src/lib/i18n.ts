import en from "../../../messages/en.json";
import id from "../../../messages/id.json";

/**
 * Copy comes from the app's own dictionaries rather than being retyped here, so the GIFs can't
 * drift from the UI's wording (or the terminology glossary in CLAUDE.md) — and an Indonesian
 * render is just `locale: "id"`.
 */
const DICTIONARIES = { en, id } as const;
export type Locale = keyof typeof DICTIONARIES;

type Dict = typeof en;
type Values = Record<string, string | number>;

const PLURAL = /\{(\w+), plural, ((?:[^{}]|\{[^{}]*\})*)\}/g;
const PLURAL_CASE = /(=\d+|\w+) \{([^{}]*)\}/g;

/**
 * Just enough ICU MessageFormat for the strings the scenes use — `{name}` placeholders and
 * `{count, plural, one {…} other {…}}` with `#` — so messages don't need hand-substitution at
 * every call site. Not a general implementation; next-intl stays the real one in the app.
 */
const format = (message: string, values: Values, locale: Locale) =>
  message
    .replace(PLURAL, (_, key: string, body: string) => {
      const n = Number(values[key]);
      const cases = Object.fromEntries([...body.matchAll(PLURAL_CASE)].map((m) => [m[1], m[2]]));
      const rule = new Intl.PluralRules(locale).select(n);
      return (cases[`=${n}`] ?? cases[rule] ?? cases.other ?? "").replace(/#/g, String(n));
    })
    .replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));

export const makeT =
  (locale: Locale) =>
  <N extends keyof Dict>(ns: N, key: keyof Dict[N] & string, values?: Values): string => {
    const value = (DICTIONARIES[locale] as Dict)[ns][key];
    if (typeof value !== "string") return String(key);
    return values ? format(value, values, locale) : value;
  };

export type T = ReturnType<typeof makeT>;
