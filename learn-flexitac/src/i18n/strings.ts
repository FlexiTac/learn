// Strings for the current language.
//   t(key, vars)        the site's own strings (UI chrome ./en/ui.ts + ./zh/ui.ts, page texts ./en/pages.ts +
//                       ./zh/pages.ts): Chinese when the site is in Chinese and the key has a Chinese line, else English.
//   tx(en, zh)          one string inline, for widgets and anything else that keeps its words next to its code.
//   strings(en, zh)     a widget's own table: strings(...)() gives the current language's table, each missing Chinese
//                       key filled from the English one.
//   fill(s, vars)       {name} -> vars.name (numbers and strings, inserted as they are: escape user text first).
// Every value is trusted, authored text (it may hold HTML); vars are not escaped.
import { PAGES_EN } from "./en/pages";
import { UI_EN } from "./en/ui";
import { lang, type Lang } from "./lang";
import { PAGES_ZH } from "./zh/pages";
import { UI_ZH } from "./zh/ui";

export const EN = { ...UI_EN, ...PAGES_EN };
export type StrKey = keyof typeof EN;
export const ZH: Partial<Record<StrKey, string>> = { ...UI_ZH, ...PAGES_ZH };

export type Vars = Record<string, string | number>;

export function fill(s: string, vars?: Vars): string {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** The site string `key` in the current language (or `l`), with {name} placeholders filled from `vars`. */
export function t(key: StrKey, vars?: Vars, l: Lang = lang()): string {
  const s = (l === "zh" ? ZH[key] : undefined) ?? EN[key];
  return fill(s, vars);
}

/** One string in the current language: `zh` when the site is in Chinese and it is given, else `en`. */
export function tx(en: string, zh?: string, vars?: Vars): string {
  return fill(lang() === "zh" && zh !== undefined ? zh : en, vars);
}

/** A widget's own string table: call the result to get the current language's table (cheap; build your text from it
 *  on every paint and again on ctx.onLang). Missing Chinese keys fall back to English. */
export function strings<T extends Record<string, string>>(en: T, zh: Partial<Record<keyof T, string>>): () => T {
  const merged = { ...en } as T;
  for (const k of Object.keys(zh) as (keyof T)[]) if (zh[k] !== undefined) merged[k] = zh[k] as T[keyof T];
  return () => (lang() === "zh" ? merged : en);
}
