// Jumper wires on Lesson 2.2's workbench, drawn live in SVG over the top-down render (src/widgets/build-bench.ts). Each
// end is the rendered Dupont housing (build.json wire.endSrc, 14 mm tall, its own long soft shadow); the wire leaves the
// housing's top and arcs to the other end, bowed a little toward the light (top left) so two wires along one line stay
// apart. Its body is shaded like the render (build.json wire.shade[theme][colour]: the shaded bottom edge, the body, a
// highlight shifted toward the light, so a wire in any direction is lit from the same side), and its shadow falls on
// the board where the light puts it: a point h mm up lands h x shadowPxPerMm px to the right and down, softened.
import type { Theme } from "../../types";
import type { WireColor } from "../build/engine";
import type { BuildData, Pt } from "./data";

export interface WireLook {
  id: string;
  a: Pt;
  /** the far end; with `open`, it follows the pointer and has no housing yet */
  b: Pt;
  color: WireColor;
  /** its place in the build (spreads the bows of wires that run side by side) */
  index: number;
  open?: boolean;
  selected?: boolean;
  /** a wire being laid or moved (drawn lighter) */
  ghost?: boolean;
}

const f = (n: number) => n.toFixed(1);

/** The wire's centre line (a cubic from end to end) and its shadow's, in scene px. */
export function wirePaths(d: BuildData, w: Pick<WireLook, "a" | "b" | "index">): { body: string; shadow: string; mid: Pt } {
  const [ax, ay] = w.a;
  const [bx, by] = w.b;
  const dx = bx - ax;
  const dy = by - ay;
  const L = Math.hypot(dx, dy) || 1;
  let nx = -dy / L;
  let ny = dx / L;
  // the bow leans toward the light, up and to the left
  if (-nx - ny < 0) {
    nx = -nx;
    ny = -ny;
  }
  const spread = 0.7 + 0.15 * (w.index % 3);
  const bow = Math.min(L * 0.04, d.pitchPx * 0.3) * spread;
  const h = bow / 0.75;
  const c1: Pt = [ax + dx * 0.22 + nx * h, ay + dy * 0.22 + ny * h];
  const c2: Pt = [ax + dx * 0.78 + nx * h, ay + dy * 0.78 + ny * h];
  const body = `M${f(ax)},${f(ay)}C${f(c1[0])},${f(c1[1])} ${f(c2[0])},${f(c2[1])} ${f(bx)},${f(by)}`;
  // heights: the housing's top at both ends, a little higher in the middle (a longer wire arcs higher)
  const [sx, sy] = d.light.shadowPxPerMm;
  const h0 = d.wire.housingHeightMm;
  const hm = h0 + Math.min(6, Math.max(1, (L / d.pxPerMm) * 0.06));
  const hc = (8 * hm - 2 * h0) / 6;
  const s = (p: Pt, hh: number): string => `${f(p[0] + sx * hh)},${f(p[1] + sy * hh)}`;
  const shadow = `M${s(w.a, h0)}C${s(c1, hc)} ${s(c2, hc)} ${s(w.b, h0)}`;
  const mid: Pt = [(ax + 3 * c1[0] + 3 * c2[0] + bx) / 8, (ay + 3 * c1[1] + 3 * c2[1] + by) / 8];
  return { body, shadow, mid };
}

/** The three layers of every wire: shadows (under everything), housings, bodies (on top, so a wire runs over parts). */
export function wireLayers(d: BuildData, theme: Theme, src: (p: string) => string, wires: WireLook[]): { shadows: string; ends: string; bodies: string } {
  const r = d.wire.radiusPx;
  const [ex, ey] = d.wire.endPin;
  const [ew, eh] = d.wire.endSize;
  const end = (p: Pt, cls = "") => `<image class="bb-end${cls}" href="${src(d.wire.endSrc[theme])}" x="${f(p[0] - ex)}" y="${f(p[1] - ey)}" width="${ew}" height="${eh}"/>`;
  let shadows = "";
  let ends = "";
  let bodies = "";
  for (const w of wires) {
    const sh = d.wire.shade[theme][w.color];
    const { body, shadow } = wirePaths(d, w);
    const ghost = w.ghost ? " is-ghost" : "";
    shadows += `<path class="bb-wire-shadow${ghost}" d="${shadow}" stroke-width="${f(2 * r)}"/>`;
    ends += end(w.a, ghost) + (w.open ? "" : end(w.b, ghost));
    const k = r * 0.27;
    bodies += `<g class="bb-wire${w.selected ? " is-selected" : ""}${ghost}" data-wire="${w.id}">
      <path class="bb-wire-hit" d="${body}" stroke-width="${f(2 * r + 8)}"/>
      <path class="bb-wire-sel" d="${body}" stroke-width="${f(2 * r + 16)}"/>
      <path d="${body}" stroke="${sh.edge}" stroke-width="${f(2 * r)}"/>
      <path d="${body}" stroke="${sh.body}" stroke-width="${f(1.56 * r)}"/>
      <path d="${body}" stroke="${sh.hi}" stroke-width="${f(0.66 * r)}" transform="translate(${f(-k)},${f(-k)})"/>
      <path class="bb-wire-glint" d="${body}" stroke-width="${f(0.2 * r)}" transform="translate(${f(-1.5 * k)},${f(-1.5 * k)})"/>
    </g>`;
  }
  return { shadows, ends, bodies };
}
