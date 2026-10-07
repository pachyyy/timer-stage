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

export const makeT =
  (locale: Locale) =>
  <N extends keyof Dict>(ns: N, key: keyof Dict[N] & string): string => {
    const value = (DICTIONARIES[locale] as Dict)[ns][key];
    return typeof value === "string" ? value : String(key);
  };

export type T = ReturnType<typeof makeT>;
