// Small SVG helpers for the chips-lab widget (src/widgets/chips-lab.ts) and its four drawings (./mux.ts, ./shift.ts,
// ./fingers.ts, ./ffc.ts). Every drawing is laid out in its own design units and shown through one scaled group (Frame):
// geometry scales with the stage, while text keeps a steady size on screen (its font size is divided by the scale in
// chips-lab.css: calc(<px> * var(--cl-fk) / var(--cl-k))) and strokes stay crisp (vector-effect: non-scaling-stroke on
// the wires, chips-lab.css). No words live here: the drawings get theirs from chips-lab.ts.
export const NS = "http://www.w3.org/2000/svg";

type Attrs = Record<string, string | number | undefined>;

/** An SVG element with attributes, appended to `parent`. */
export function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Attrs, parent: Element): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined) e.setAttribute(k, String(v));
  parent.append(e);
  return e;
}

/** A text label. `anchor`: start | middle | end. */
export function label(parent: Element, x: number, y: number, text: string, cls: string, anchor: "start" | "middle" | "end" = "start"): SVGTextElement {
  const t = el("text", { x: r2(x), y: r2(y), class: cls, "text-anchor": anchor }, parent);
  t.textContent = text;
  return t;
}

export const r2 = (n: number) => Math.round(n * 100) / 100;

/** Path data from points. */
export function poly(pts: [number, number][], close = false): string {
  return pts.map((p, i) => `${i ? "L" : "M"}${r2(p[0])} ${r2(p[1])}`).join(" ") + (close ? " Z" : "");
}

/** A rounded rectangle's path (for faces that also take the ENIG grain, which needs a path). */
export function rrect(x: number, y: number, w: number, h: number, r: number): string {
  const q = Math.min(r, w / 2, h / 2);
  return `M${r2(x + q)} ${r2(y)} H${r2(x + w - q)} Q${r2(x + w)} ${r2(y)} ${r2(x + w)} ${r2(y + q)} V${r2(y + h - q)} Q${r2(x + w)} ${r2(y + h)} ${r2(x + w - q)} ${r2(y + h)} H${r2(x + q)} Q${r2(x)} ${r2(y + h)} ${r2(x)} ${r2(y + h - q)} V${r2(y + q)} Q${r2(x)} ${r2(y)} ${r2(x + q)} ${r2(y)} Z`;
}

/** A resistor's zig-zag from (x, y0) down to (x, y1): straight leads, six teeth in the middle. */
export function zigzag(x: number, y0: number, y1: number, w = 6): string {
  const lead = (y1 - y0) * 0.22;
  const a = y0 + lead;
  const b = y1 - lead;
  const n = 6;
  const pts: [number, number][] = [[x, y0], [x, a]];
  for (let i = 0; i < n; i++) pts.push([x + (i % 2 ? -w : w), a + ((b - a) * (i + 0.5)) / n]);
  pts.push([x, b], [x, y1]);
  return poly(pts);
}

/** The ground symbol, three bars under (x, y). */
export function ground(parent: Element, x: number, y: number, cls: string): void {
  el("path", { d: `M${x} ${y - 6} V${y} M${x - 8} ${y} H${x + 8} M${x - 5} ${y + 3.5} H${x + 5} M${x - 2} ${y + 7} H${x + 2}`, class: cls }, parent);
}

/** The drawing's frame: an svg filling its box and one group that maps design units (dw × dh) onto it, centred, at the
 *  largest scale that fits (capped at `max`). Sets --cl-k (the scale) and --cl-fk (the type's own growth: a little with a
 *  big stage, never under 0.94) for chips-lab.css. */
export interface Frame {
  svg: SVGSVGElement;
  g: SVGGElement;
  defs: SVGDefsElement;
  k: number;
  /** Design units -> the svg's px (for HTML placed over the drawing). */
  toPx(x: number, y: number): [number, number];
}
export function frame(svg: SVGSVGElement, w: number, h: number, dw: number, dh: number, max = 1.6, x0 = 0, y0 = 0): Frame {
  svg.replaceChildren();
  svg.setAttribute("width", String(Math.max(1, Math.round(w))));
  svg.setAttribute("height", String(Math.max(1, Math.round(h))));
  svg.setAttribute("viewBox", `0 0 ${Math.max(1, Math.round(w))} ${Math.max(1, Math.round(h))}`);
  const k = Math.max(0.2, Math.min(max, w / dw, h / dh));
  // (x0, y0): the design units at the frame's top-left corner, so a drawing can leave out a margin it never uses
  const ox = (w - dw * k) / 2 - x0 * k;
  const oy = (h - dh * k) / 2 - y0 * k;
  const fk = Math.min(1.16, Math.max(0.94, 0.9 + (k - 1) * 0.35));
  svg.style.setProperty("--cl-k", String(r2(k)));
  svg.style.setProperty("--cl-fk", String(r2(fk)));
  const defs = el("defs", {}, svg);
  const g = el("g", { transform: `translate(${r2(ox)} ${r2(oy)}) scale(${r2(k * 1000) / 1000})` }, svg);
  return { svg, g, defs, k, toPx: (x, y) => [ox + x * k, oy + y * k] };
}

/** Fill a cell with viridis for a value 0..1. */
export function viridisCss(rgb: number[][], v: number): string {
  const c = rgb[Math.max(0, Math.min(255, Math.round(255 * v)))];
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

/** Eased 0..1. */
export const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
