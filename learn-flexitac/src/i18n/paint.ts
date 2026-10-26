// Painting a widget's fixed words again after a language switch (docs/i18n.md, "Widgets"). A widget writes its markup
// once, from its strings() table, and marks each fixed text with the table key it came from:
//   data-t="key"         the element's content (trusted HTML from the table; an SVG <text>/<tspan> gets textContent)
//   data-t-aria="key"    its aria-label
//   data-t-title="key"   its title
//   data-t-desc="key"    its aria-description
// On ctx.onLang it calls paintText(root, S(), vars) and then repaints its live readouts as it always does. The marks
// are plain data attributes: they change nothing on screen.
import { fill, type Vars } from "./strings";

const ATTRS: [string, string][] = [
  ["data-t-aria", "aria-label"],
  ["data-t-title", "title"],
  ["data-t-desc", "aria-description"],
];

/** Set the text node that sits right before `el` (or, with `after`, right after it) to `text`: for a word the English
 *  markup keeps as bare text beside an element ("Total force <b>…</b>"), so the English is drawn exactly as before. */
export function setTextBeside(el: Element | null, text: string, after = false): void {
  const n = el && (after ? el.nextSibling : el.previousSibling);
  if (n && n.nodeType === Node.TEXT_NODE) n.nodeValue = text;
}

/** Fill every marked text under `root` (and `root` itself) from `table`, {name} placeholders from `vars`. */
export function paintText(root: Element | DocumentFragment, table: Record<string, string>, vars?: Vars): void {
  const all = (sel: string): Element[] => {
    const list = [...root.querySelectorAll(sel)];
    if (root instanceof Element && root.matches(sel)) list.unshift(root);
    return list;
  };
  for (const el of all("[data-t]")) {
    const s = table[el.getAttribute("data-t")!];
    if (s === undefined) continue;
    const v = fill(s, vars);
    if (el instanceof SVGElement) el.textContent = v;
    else el.innerHTML = v;
  }
  for (const [mark, attr] of ATTRS)
    for (const el of all(`[${mark}]`)) {
      const s = table[el.getAttribute(mark)!];
      if (s !== undefined) el.setAttribute(attr, fill(s, vars));
    }
}
