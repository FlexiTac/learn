// The site's language: English (the default) or Simplified Chinese. docs/i18n.md has the whole contract.
//   - chosen with the globe button in the sidebar (src/ui/shell.ts) and saved with the rest of the site's state
//     (src/state/store.ts, one localStorage key; every access there is wrapped, so a blocked storage only forgets it);
//   - ?lang=zh / ?lang=en in the address (before the #) picks it too, and is saved like a click;
//   - <html lang> follows it ("en" / "zh-CN"), so the :lang(zh) rules in src/styles/i18n.css apply;
//   - switching never reloads the page: everything that shows text subscribes with onLang() and paints itself again.
import { load, update } from "../state/store";

export type Lang = "en" | "zh";
export const LANGS: readonly Lang[] = ["en", "zh"];
/** The value of <html lang> for each language. */
export const HTML_LANG: Record<Lang, string> = { en: "en", zh: "zh-CN" };

const listeners = new Set<(l: Lang) => void>();
let current: Lang = "en";

const isLang = (v: unknown): v is Lang => v === "en" || v === "zh";

/** "zh", "zh-CN", "zh-Hans", "cn" -> "zh"; "en", "en-US" -> "en"; anything else -> null. */
function parse(v: string | null | undefined): Lang | null {
  const s = (v ?? "").trim().toLowerCase();
  if (!s) return null;
  if (s === "cn" || s.startsWith("zh")) return "zh";
  if (s.startsWith("en")) return "en";
  return null;
}

function fromUrl(): Lang | null {
  try {
    return parse(new URLSearchParams(location.search).get("lang"));
  } catch {
    return null;
  }
}

function stamp(l: Lang): void {
  const root = document.documentElement;
  root.lang = HTML_LANG[l];
  root.dataset.lang = l;
}

/** Call once before anything renders (src/main.ts): the address wins, then the saved choice, then English. */
export function initLang(): Lang {
  const url = fromUrl();
  const saved = load().lang;
  current = url ?? (isLang(saved) ? saved : "en");
  if (url && url !== saved) save(url);
  stamp(current);
  return current;
}

function save(l: Lang): void {
  update((s) => {
    s.lang = l;
  });
}

/** The language on show now. */
export const lang = (): Lang => current;
export const isZh = (): boolean => current === "zh";

/** Switch the site to `l` (saved; an address with ?lang= is kept in step), then tell every subscriber. */
export function setLang(l: Lang): void {
  if (!isLang(l) || l === current) return;
  current = l;
  save(l);
  try {
    const u = new URL(location.href);
    if (u.searchParams.has("lang")) {
      u.searchParams.set("lang", l);
      history.replaceState(history.state, "", u.href);
    }
  } catch {
    /* an address we cannot rewrite: the saved choice still holds */
  }
  stamp(l);
  for (const fn of [...listeners]) {
    try {
      fn(l);
    } catch (err) {
      console.error(err);
    }
  }
}

export function toggleLang(): Lang {
  setLang(current === "zh" ? "en" : "zh");
  return current;
}

/** Called with the new language after every switch. Returns an unsubscribe function. */
export function onLang(fn: (l: Lang) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
