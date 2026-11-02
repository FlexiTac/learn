// ENIG's photo look for the site's own drawings of the electrodes (the unit, grid and Velostat demo cards): the figures'
// look (flexitac-anatomy/figures/enig.mjs), after the user's FPC customizer (pcb_design/fpc_agentic_customization), where
// each bare gold strip is a pale cream gold with a gentle diagonal sheen and a fine grain.
// - The sheen is a gradient in each face's own box, corner to corner, from --ft-gold-left through --ft-gold-shine (at
//   55 %) to --ft-gold-shade (tokens.css, so both themes follow). A card sets it as the face's fill (enigFill: inline, over
//   its flat --ft-gold-top rule, which stays the fallback).
// - The grain is the figures' too: fractal noise, black at 10 %, about one and a half CSS px a grain, drawn once as a
//   small pattern tile stitched so it repeats without seams. The browser rasterizes the tile once per scale and repeats
//   it, so no filter runs over the drawing while it animates. A card lays a grain path over each gold face (enigGrain),
//   with the face's outline.
const NS = "http://www.w3.org/2000/svg";
const GRAIN_FREQ = 0.75;
const TILE = 16; // 12 periods of the grain, so the stitched tile keeps its frequency

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, parent: Element): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  parent.append(e);
  return e;
}

/** Adds the sheen (`#{id}-enig`) and the grain (`#{id}-enig-grain`) to a card's `<defs>`. */
export function enigDefs(defs: SVGDefsElement, id: string): void {
  const grad = el("linearGradient", { id: `${id}-enig`, x1: 0, y1: 0, x2: 1, y2: 1 }, defs);
  for (const [offset, token] of [[0, "--ft-gold-left"], [0.55, "--ft-gold-shine"], [1, "--ft-gold-shade"]] as const)
    el("stop", { offset }, grad).style.setProperty("stop-color", `var(${token})`);
  const noise = el("filter", { id: `${id}-enig-noise`, x: 0, y: 0, width: 1, height: 1 }, defs);
  el("feTurbulence", { type: "fractalNoise", baseFrequency: GRAIN_FREQ, numOctaves: 2, seed: 7, stitchTiles: "stitch" }, noise);
  el("feColorMatrix", { values: "0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.1 0" }, noise);
  const tile = el("pattern", { id: `${id}-enig-grain`, width: TILE, height: TILE, patternUnits: "userSpaceOnUse" }, defs);
  el("rect", { width: TILE, height: TILE, filter: `url(#${id}-enig-noise)` }, tile);
}

/** Makes a gold face bare ENIG: the sheen as its fill. */
export function enigFill<E extends SVGElement>(face: E, id: string): E {
  face.style.setProperty("fill", `url(#${id}-enig) var(--ft-gold-top)`);
  return face;
}

/** The grain over a gold face: a path with the face's outline (`d`, or set it with the face's), no stroke, no pointer events. */
export function enigGrain(parent: Element, id: string, d = ""): SVGPathElement {
  const attrs: Record<string, string> = { fill: `url(#${id}-enig-grain)`, stroke: "none", "pointer-events": "none" };
  if (d) attrs.d = d;
  return el("path", attrs, parent);
}
