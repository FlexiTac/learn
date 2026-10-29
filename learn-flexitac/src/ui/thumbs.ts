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

/** Each lesson's picture, by its id: the files are named for the lesson's place in the course when they were made
 *  (public/thumbs/L<nn>, scripts/thumbs.mjs and scripts/covers.mjs), and the course has been re-ordered since (2026-10-29),
 *  so the id picks the file. A path starting with "media/" is a two-theme still from public (<path>-{light,dark}.webp). */
const THUMB: Record<string, string> = {
  "meet-flexitac": "L01",
  "the-sandwich": "L02",
  "meet-the-board": "L03",
  "one-frame": "L04",
  "bytes-to-touch": "L05",
  "build-your-own": "L06",
  "put-on-a-robot": "L07",
  // the 1.6 placeholder (real robot footage to come): the "what comes next" sketch, until the video gives it a frame
  "real-robot": "media/covers/next",
  "why-simulate-touch": "L09",
  "pad-made-of-points": "L10",
  "how-deep-how-hard": "L11",
  "sim-playground": "L12",
};

/** Lesson pictures that are the same in both themes (the heatmap, the build footage). */
const ONE_THEME = new Set(["L05", "L06"]);

export function thumbFor(l: Lesson, alt = ""): string {
  const name = THUMB[l.id] ?? `L${String(l.n).padStart(2, "0")}`;
  if (name.startsWith("media/"))
    return `<img class="thumb thumb-light" src="${base}${name}-light.webp" alt="${alt}" loading="lazy" decoding="async">` +
      `<img class="thumb thumb-dark" src="${base}${name}-dark.webp" alt="" aria-hidden="true" loading="lazy" decoding="async">`;
  if (ONE_THEME.has(name)) return `<img class="thumb thumb-any" src="${base}thumbs/${name}.webp" alt="${alt}" loading="lazy" decoding="async">`;
  return pair(lang() === "zh" && ZH_THUMBS.has(name) ? `${name}-zh` : name, alt);
}
