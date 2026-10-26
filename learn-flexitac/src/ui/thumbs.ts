// Thumbnails (public/thumbs/*.webp, made by `npm run thumbs`): the three figures for the home cards, and one picture
// per lesson (a figure pose that shows the lesson's idea, a frame of the build footage, or a heatmap from the shared
// models). Figure pictures exist in both themes; both are in the DOM and CSS shows one.
import { lang } from "../i18n";
import type { Lesson } from "../types";

const base = import.meta.env.BASE_URL;

/** The lesson pictures with words in them (a touch map's title and legend, a card's labels): in Chinese their Chinese
 *  picture, L<nn>-zh-<theme>.webp (scripts/thumbs.mjs and scripts/covers.mjs with --lang zh). The others are the same in
 *  both languages. (The views that show thumbnails draw again on a language switch.) */
const ZH_THUMBS = new Set(["L01", "L04", "L09", "L10", "L11"]);

function pair(name: string, alt: string): string {
  return `<img class="thumb thumb-light" src="${base}thumbs/${name}-light.webp" alt="${alt}" loading="lazy" decoding="async">` +
    `<img class="thumb thumb-dark" src="${base}thumbs/${name}-dark.webp" alt="" aria-hidden="true" loading="lazy" decoding="async">`;
}

export function figThumb(fig: string, alt = ""): string {
  return pair(fig, alt);
}

/** Lessons whose picture is the same in both themes (5 the heatmap, 6 the build footage). */
const ONE_THEME = new Set([5, 6]);

export function thumbFor(l: Lesson, alt = ""): string {
  const name = `L${String(l.n).padStart(2, "0")}`;
  if (ONE_THEME.has(l.n)) return `<img class="thumb thumb-any" src="${base}thumbs/${name}.webp" alt="${alt}" loading="lazy" decoding="async">`;
  return pair(lang() === "zh" && ZH_THUMBS.has(name) ? `${name}-zh` : name, alt);
}
