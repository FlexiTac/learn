// The layout view of the PCB design picture (src/widgets/pcb-design.ts, lesson 2.5 step 3): the reading board's real
// copper, drawn from flexitac-anatomy/shared/data/board.json (itself read from the Gerbers, the pick-and-place file and
// the schematic, every net checked against the copper): the 56.75 x 39.86 mm outline, the traces of both copper
// layers (all 0.254 mm wide; the top red, the bottom blue, seen from above), the 39 vias, the pads of the 8 soldered
// parts and the Nano's 30 holes, the parts' outlines and names (silkscreen), and the Nano itself as a dashed outline
// over U4 and U5, its name inside it. Layer buttons show both, the top or the bottom. "Before the copper" shows the
// same board before it was routed: the parts on their footprints and a thin straight line for every connection still
// to draw (each net's pads joined by the shortest set of lines, as an EDA program's ratlines; no traces, no vias).
// Pointing at a trace (or a line, a pad, a via) lights its whole net and steps everything else back; the line under the
// board says what it carries, in a sentence that names it. A click keeps it lit (a tap on a touch screen), ← → walk
// through the nets when the board has focus. A step can open the view with one net lit (view({net}): lesson 2.5 lights
// the clock, D3_CLK, whose vias then show): it shows while nothing else is lit, and goes with the first click or Escape.
// (The ground pour that fills the rest of both copper layers is not drawn: the line under the board says so.)
import { MUX_OFFSET, ROWS } from "@shared/data/constants.mjs";
import { board } from "@shared/data/index.mjs";
import { driveLineInfo, muxChannelInfo } from "@shared/models/scan.mjs";
import { fill } from "../../i18n";
import { esc } from "../../ui/dom";
import { panZoom, type PanZoom } from "./panzoom";
import { zoomPill } from "./sch";
import { S } from "./words";

type Pt = [number, number];
interface Pin {
  pin: number;
  x: number;
  y: number;
  padW: number;
  padH: number;
}
interface Part {
  designator: string;
  footprint: string;
  x: number;
  y: number;
  rotation: number;
  pin1: { x: number; y: number };
  package: { body: [number, number] };
  pins: Pin[];
  tabs: { x: number; y: number; w: number; h: number }[];
}
interface Net {
  name: string;
  nodes: string[];
  tracks?: { top?: Pt[][]; bottom?: Pt[][] };
  trackWidth?: number;
  vias?: Pt[];
}
interface BoardData {
  outline: { bbox: [number, number, number, number]; size: [number, number] };
  components: Part[];
  vias: { count: number; drill: number; pad: number; positions: Pt[] };
  header: { pad: number; drill: number; pins: { pin: number; name: string; x: number; y: number; square: boolean }[]; nanoOutline: [number, number, number, number]; usbOutline: [number, number, number, number] };
  nets: Net[];
}
const B = board as unknown as BoardData;

export type Job = "drive" | "sense" | "power";
const [OX, , , OY] = B.outline.bbox;
const X = (x: number) => +(x - OX).toFixed(3);
const Y = (y: number) => +(OY - y).toFixed(3);
const pts = (l: Pt[]) => l.map(([x, y]) => `${X(x)},${Y(y)}`).join(" ");

/** Trace widths on the board (all one: 0.254 mm). */
export const TRACE_W = [...new Set(B.nets.map((n) => n.trackWidth).filter((w): w is number => typeof w === "number"))];
export const BOARD_MM = B.outline.size.map((v) => v.toFixed(1));
export const VIA_COUNT = B.vias.count;

const jobOf = (name: string): Job =>
  /^(D2_|D3_|CHAIN_|SC)/.test(name) ? "drive" : /^(GND|VCC)$/.test(name) ? "power" : "sense";

/** The net a pad belongs to, by "U2.15(QA)" / "FPC2.1(SC1)" / "U1.5(D2)" (U1 = the Nano's header). */
const padNet = new Map<string, string>();
for (const n of B.nets) for (const node of n.nodes) padNet.set(node.replace(/\(.*$/, ""), n.name);

/** Where a net's node is on the board (mm): a soldered part's pad, or one of the Nano's holes (U1). */
const padAt = (node: string): Pt | null => {
  const m = node.match(/^([A-Z]+\d+)\.(\d+)/);
  if (!m) return null;
  const pin = Number(m[2]);
  if (m[1] === "U1") {
    const h = B.header.pins.find((p) => p.pin === pin);
    return h ? [h.x, h.y] : null;
  }
  const p = B.components.find((c) => c.designator === m[1])?.pins.find((q) => q.pin === pin);
  return p ? [p.x, p.y] : null;
};

/** The ratlines: per net, the shortest set of straight lines that joins all its pads (Prim's tree). */
const RATS: { net: string; a: Pt; b: Pt }[] = [];
const PADS_OF = new Map<string, number>();
for (const n of B.nets) {
  const seen = new Set<string>();
  const ps: Pt[] = [];
  for (const node of n.nodes) {
    const p = padAt(node);
    if (!p || seen.has(`${p[0]},${p[1]}`)) continue;
    seen.add(`${p[0]},${p[1]}`);
    ps.push(p);
  }
  PADS_OF.set(n.name, ps.length);
  if (ps.length < 2) continue;
  const inTree = [0];
  const rest = new Set(ps.map((_, i) => i).slice(1));
  while (rest.size) {
    let best: [number, number, number] = [Infinity, -1, -1];
    for (const i of inTree)
      for (const j of rest) {
        const d = Math.hypot(ps[i][0] - ps[j][0], ps[i][1] - ps[j][1]);
        if (d < best[0]) best = [d, i, j];
      }
    RATS.push({ net: n.name, a: ps[best[1]], b: ps[best[2]] });
    inTree.push(best[2]);
    rest.delete(best[2]);
  }
}
export const RAT_COUNT = RATS.length;

/** What a net carries, in a sentence that names it (words.ts), where it runs (copper) or how many pads it joins
 *  (before the copper), and its job. */
export function netWords(name: string, rats = false): { text: string; where: string; job: Job } {
  const s = S();
  const n = B.nets.find((q) => q.name === name);
  const top = n?.tracks?.top?.length ?? 0;
  const bot = n?.tracks?.bottom?.length ?? 0;
  const v = n?.vias?.length ?? 0;
  const where = rats
    ? fill(s.netPads, { n: PADS_OF.get(name) ?? 0 })
    : bot || v
      ? v === 1
        ? s.netBoth1
        : fill(s.netBoth, { v })
      : top
        ? s.netTop
        : "";
  let text = "";
  let m: RegExpMatchArray | null;
  if (name === "D2_SER") text = s.netD2;
  else if (name === "D3_CLK") text = s.netD3;
  else if ((m = name.match(/^D([4-7])_S(\d)$/))) text = fill(s.netSel, { bit: m[2], w: 1 << Number(m[2]) });
  else if (name === "D8_E") text = s.netD8;
  else if (name === "A0_COM") text = s.netA0;
  else if (name === "GND") text = s.netGnd;
  else if (name === "VCC") text = s.netVcc;
  else if ((m = name.match(/^CHAIN_(U\d)_(U\d)$/))) text = fill(s.netChain, { a: m[1], b: m[2] });
  else if ((m = name.match(/^SC(\d+)$/))) {
    const d = driveLineInfo(Number(m[1]) - 1);
    text = fill(s.netSC, { n: m[1], chip: d.chip, q: d.q });
  } else if ((m = name.match(/^SR(\d+)$/))) {
    const c = muxChannelInfo(Number(m[1]) - 1);
    text = c.used && c.row !== null ? fill(s.netSR, { n: c.row + 1, pin: c.fpc1Pin, ch: c.ch }) : fill(s.netSRx, { pin: c.fpc1Pin, ch: c.ch });
  }
  return { text, where, job: jobOf(name) };
}

/** The nets in walking order (← →): the Nano's control lines, the chain, A0, the drive lines, the sense lines, power. */
const ORDER = (() => {
  const named = B.nets.filter((n) => (n.tracks?.top?.length ?? 0) + (n.tracks?.bottom?.length ?? 0) > 0).map((n) => n.name);
  const rank = (s: string) => {
    if (s === "D2_SER") return 0;
    if (s === "D3_CLK") return 1;
    if (s.startsWith("CHAIN")) return 2;
    if (/^D[4-8]_/.test(s)) return 3;
    if (s === "A0_COM") return 4;
    if (s.startsWith("SC")) return 5 + Number(s.slice(2)) / 100;
    if (s.startsWith("SR")) return 6 + ((Number(s.slice(2)) - 1 - MUX_OFFSET + 16) % 16) / 100;
    return s === "VCC" ? 7 : 8;
  };
  return named.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
})();

/** The margin around the board and the Nano's overhang, in mm (the Nano's name sits inside its outline). */
const MARGIN = 0.8;

function drawing(): { svg: string; box: { x: number; y: number; w: number; h: number } } {
  const [x0, y0, x1, y1] = B.outline.bbox;
  const W = x1 - x0;
  const H = y1 - y0;
  const [nx0, ny0, nx1, ny1] = B.header.nanoOutline;
  const [ux0, uy0, ux1, uy1] = B.header.usbOutline;
  const minX = Math.min(0, X(nx0), X(ux0)) - MARGIN;
  const maxX = Math.max(W, X(nx1), X(ux1)) + MARGIN;
  const minY = Math.min(0, Y(ny1)) - MARGIN;
  const maxY = Math.max(H, Y(ny0), Y(uy0)) + MARGIN;
  const o: string[] = [];
  // the board (FR-4 under its mask)
  o.push(`<rect class="bd-sub" x="0" y="0" width="${W.toFixed(3)}" height="${H.toFixed(3)}" rx="0.3"/>`);
  // traces: every bottom one under every top one
  for (const layer of ["bottom", "top"] as const) {
    o.push(`<g class="bd-${layer}">`);
    for (const n of B.nets)
      for (const l of n.tracks?.[layer] ?? []) o.push(`<polyline class="t ${layer === "top" ? "tt" : "tb"}" data-net="${n.name}" points="${pts(l)}"/>`);
    o.push(`</g>`);
  }
  // pads of the soldered parts (top copper) and their hold-down tabs
  o.push(`<g class="bd-pads">`);
  for (const c of B.components) {
    for (const p of c.pins) {
      const net = padNet.get(`${c.designator}.${p.pin}`);
      const oval = /^SOP|^SOIC/.test(c.footprint);
      const r = oval ? Math.min(p.padW, p.padH) / 2 : 0.06;
      o.push(`<rect class="pad"${net ? ` data-net="${net}"` : ""} x="${X(p.x - p.padW / 2)}" y="${Y(p.y + p.padH / 2)}" width="${p.padW}" height="${p.padH}" rx="${r.toFixed(3)}"/>`);
    }
    for (const t of c.tabs) o.push(`<rect class="pad tab" x="${X(t.x - t.w / 2)}" y="${Y(t.y + t.h / 2)}" width="${t.w}" height="${t.h}" rx="0.08"/>`);
  }
  o.push(`</g>`);
  // the Nano's 30 plated holes and the 39 vias (both layers)
  o.push(`<g class="bd-holes">`);
  const hr = B.header.pad / 2;
  for (const p of B.header.pins) {
    const net = padNet.get(`U1.${p.pin}`);
    const a = net ? ` data-net="${net}"` : "";
    o.push(
      p.square
        ? `<rect class="th"${a} x="${X(p.x - hr)}" y="${Y(p.y + hr)}" width="${B.header.pad}" height="${B.header.pad}" rx="0.1"/>`
        : `<circle class="th"${a} cx="${X(p.x)}" cy="${Y(p.y)}" r="${hr}"/>`,
    );
    o.push(`<circle class="hole" cx="${X(p.x)}" cy="${Y(p.y)}" r="${(B.header.drill / 2).toFixed(3)}"/>`);
  }
  const viaNet = new Map<string, string>();
  for (const n of B.nets) for (const [vx, vy] of n.vias ?? []) viaNet.set(`${vx.toFixed(2)},${vy.toFixed(2)}`, n.name);
  for (const [vx, vy] of B.vias.positions) {
    const net = viaNet.get(`${vx.toFixed(2)},${vy.toFixed(2)}`);
    o.push(`<g class="via"${net ? ` data-net="${net}"` : ""}><circle cx="${X(vx)}" cy="${Y(vy)}" r="${(B.vias.pad / 2).toFixed(4)}"/><circle class="hole" cx="${X(vx)}" cy="${Y(vy)}" r="${(B.vias.drill / 2).toFixed(4)}"/></g>`);
  }
  o.push(`</g>`);
  // before the copper: a thin straight line for every connection still to draw
  o.push(`<g class="bd-rats">`);
  for (const r of RATS) o.push(`<line class="rat" data-net="${r.net}" x1="${X(r.a[0])}" y1="${Y(r.a[1])}" x2="${X(r.b[0])}" y2="${Y(r.b[1])}"/>`);
  o.push(`</g>`);
  // silkscreen: the parts' outlines, pin 1 and their names
  o.push(`<g class="bd-silk">`);
  for (const c of B.components) {
    const [bw, bh] = c.package.body;
    const turned = Math.round(c.rotation) % 180 !== 0;
    const w = turned ? bh : bw;
    const h = turned ? bw : bh;
    const isChip = /^U/.test(c.designator);
    const isR = c.designator === "R1";
    if (isChip || isR) o.push(`<rect class="sk" x="${X(c.x - w / 2)}" y="${Y(c.y + h / 2)}" width="${w}" height="${h}" rx="${isChip ? 0.35 : 0.15}"/>`);
    if (isChip) {
      // pin 1: a dot inside the body, nearest pin 1
      const dx = Math.sign(c.pin1.x - c.x) * (w / 2 - 0.9);
      const dy = Math.sign(c.pin1.y - c.y) * (h / 2 - 0.9);
      o.push(`<circle class="sk-dot" cx="${X(c.x + dx)}" cy="${Y(c.y + dy)}" r="0.35"/>`);
      o.push(`<text class="sk-t" x="${X(c.x)}" y="${Y(c.y) + 0.55}">${c.designator}</text>`);
    } else if (isR) o.push(`<text class="sk-t sm" x="${X(c.x)}" y="${Y(c.y + h / 2) - 0.7}">${c.designator}</text>`);
    else o.push(`<text class="sk-t" x="${X(c.x)}" y="${Y(c.y - h / 2) + 1.9}">${c.designator}</text>`);
  }
  o.push(`</g>`);
  // the Nano, on its sockets above the board: its outline and its USB end, dashed; its name inside the outline, at
  // the end away from the USB (over the board's top edge, clear of the first pair of holes)
  o.push(`<g class="bd-nano" data-nano="">
    <rect class="nano-hit" x="${X(nx0)}" y="${Y(ny1)}" width="${(nx1 - nx0).toFixed(3)}" height="${(ny1 - ny0).toFixed(3)}" rx="0.6"/>
    <rect class="nano" x="${X(nx0)}" y="${Y(ny1)}" width="${(nx1 - nx0).toFixed(3)}" height="${(ny1 - ny0).toFixed(3)}" rx="0.6"/>
    <rect class="nano usb" x="${X(ux0)}" y="${Y(uy1)}" width="${(ux1 - ux0).toFixed(3)}" height="${(uy1 - uy0).toFixed(3)}" rx="0.3"/>
    <text class="nano-t" x="${X((nx0 + nx1) / 2)}" y="${(Y(ny1) + 1.45).toFixed(2)}" data-t="nanoGhost">${S().nanoGhost}</text>
  </g>`);
  // what the pointer finds: every trace (wide), pad and via of a net, over everything; and every ratline
  o.push(`<g class="bd-hit">`);
  for (const layer of ["bottom", "top"] as const)
    for (const n of B.nets) for (const l of n.tracks?.[layer] ?? []) o.push(`<polyline class="hit h-${layer === "top" ? "tt" : "tb"}" data-net="${n.name}" points="${pts(l)}"/>`);
  o.push(`</g><g class="bd-rat-hit">`);
  for (const r of RATS) o.push(`<line class="hit" data-net="${r.net}" x1="${X(r.a[0])}" y1="${Y(r.a[1])}" x2="${X(r.b[0])}" y2="${Y(r.b[1])}"/>`);
  o.push(`</g>`);
  return { svg: o.join(""), box: { x: minX, y: minY, w: maxX - minX, h: maxY - minY } };
}

export interface BoardView {
  el: HTMLElement;
  /** The default form: the copper, both layers, the whole board; `net` lit until the first click (or nothing). */
  reset(net?: string | null): void;
  relabel(): void;
  layout(): void;
  escape(): boolean;
  destroy(): void;
}

export function boardView(ctx: { reducedMotion(): boolean; touch(): boolean }): BoardView {
  const s = S();
  const { svg: inner, box } = drawing();
  const el = document.createElement("section");
  el.className = "pcb-view pcb-lay";
  el.dataset.v = "layout";
  el.dataset.layer = "both";
  el.dataset.stage = "copper";
  el.innerHTML = `
    <header class="pcb-bar">
      <p class="pcb-k" data-t="kLay">${s.kLay}</p>
      <div class="pcb-tools">
        <button type="button" class="pcb-tog" aria-pressed="false" data-t-aria="beforeAria" aria-label="${esc(s.beforeAria)}"><span data-t="before">${s.before}</span></button>
        <div class="pcb-seg" role="group" data-t-aria="layAria" aria-label="${esc(s.layAria)}">
          <button type="button" data-layer="both" aria-pressed="true" data-t-aria="bothAria" aria-label="${esc(s.bothAria)}"><span data-t="both">${s.both}</span></button>
          <button type="button" data-layer="top" aria-pressed="false" data-t-aria="topAria" aria-label="${esc(s.topAria)}"><i class="sw tt"></i><span data-t="top">${s.top}</span></button>
          <button type="button" data-layer="bottom" aria-pressed="false" data-t-aria="bottomAria" aria-label="${esc(s.bottomAria)}"><i class="sw tb"></i><span data-t="bottom">${s.bottom}</span></button>
        </div>
      </div>
    </header>
    <div class="pcb-area">
      <svg class="pcb-board" role="img" tabindex="0" preserveAspectRatio="xMidYMid meet" focusable="true">${inner}</svg>
    </div>
    <p class="pcb-info" aria-live="polite"></p>
    <footer class="pcb-foot">
      ${zoomPill()}
      <p class="pcb-hint"></p>
      <p class="pcb-read"></p>
    </footer>`;
  const svg = el.querySelector<SVGSVGElement>(".pcb-board")!;
  const info = el.querySelector<HTMLElement>(".pcb-info")!;
  const hint = el.querySelector<HTMLElement>(".pcb-hint")!;
  const read = el.querySelector<HTMLElement>(".pcb-read")!;
  const tog = el.querySelector<HTMLButtonElement>(".pcb-tog")!;
  const all = [...svg.querySelectorAll<SVGElement>("[data-net]")];
  const byNet = new Map<string, SVGElement[]>();
  for (const e of all) {
    const k = e.dataset.net!;
    if (!byNet.has(k)) byNet.set(k, []);
    byNet.get(k)!.push(e);
  }
  const pz: PanZoom = panZoom(svg, box, { pad: 2, max: 8, arrows: false, reduced: ctx.reducedMotion });

  let layer: "both" | "top" | "bottom" = "both";
  let rats = false;
  let pinned: string | null = null;
  let hover: string | null = null;
  /** The net a step lit as the view opened: shown while nothing else is, gone with the first click or Escape. */
  let intro: string | null = null;
  let nano = false;
  let lit: string | null = null;

  const paint = () => {
    const net = pinned ?? hover ?? intro;
    if (net !== lit) {
      if (lit) for (const e of byNet.get(lit) ?? []) e.classList.remove("is-on");
      if (net) for (const e of byNet.get(net) ?? []) e.classList.add("is-on");
      lit = net;
    }
    svg.toggleAttribute("data-lit", Boolean(net));
    svg.toggleAttribute("data-intro", Boolean(net) && net === intro && !pinned && !hover);
    svg.toggleAttribute("data-nano", !net && nano);
    svg.dataset.job = net ? netWords(net).job : "";
    const w = S();
    if (net) {
      const n = netWords(net, rats);
      // (no space after a Chinese full stop)
      const gap = /[。！？：]$/.test(n.text) ? "" : " ";
      info.innerHTML = `<i class="pcb-dot ${n.job}"></i><span class="pcb-info-s">${n.text}${n.where ? `${gap}${n.where}` : ""} <code class="pcb-info-n">${esc(net)}</code></span>`;
    } else if (nano) info.innerHTML = `<span class="pcb-info-s">${w.nanoInfo}</span>`;
    else info.innerHTML = `<span class="pcb-info-s is-muted">${rats ? w.ratNone : w.netNone}</span>`;
  };
  const netAt = (t: EventTarget | null): string | null => {
    const e = (t as Element | null)?.closest?.<SVGElement>("[data-net]");
    return e?.dataset.net ?? null;
  };
  svg.addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch" || svg.classList.contains("is-dragging")) return;
    const n = netAt(e.target);
    const onNano = !n && Boolean((e.target as Element).closest(".bd-nano"));
    if (n !== hover || onNano !== nano) {
      hover = n;
      nano = onNano;
      paint();
    }
  });
  svg.addEventListener("pointerleave", () => {
    if (hover || nano) {
      hover = null;
      nano = false;
      paint();
    }
  });
  svg.addEventListener("click", (e) => {
    if (pz.wasDrag()) return;
    const n = netAt(e.target);
    intro = null;
    pinned = n && n !== pinned ? n : null;
    if (!n && (e.target as Element).closest(".bd-nano")) nano = !nano;
    paint();
  });
  svg.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const from = pinned ?? intro;
    const i = from ? ORDER.indexOf(from) : -1;
    const k = e.key === "ArrowRight" ? (i + 1) % ORDER.length : (i - 1 + ORDER.length) % ORDER.length;
    pinned = ORDER[i < 0 && e.key === "ArrowLeft" ? ORDER.length - 1 : k];
    intro = null;
    paint();
  });
  const setLayer = (l: typeof layer) => {
    layer = l;
    el.dataset.layer = layer;
    for (const q of el.querySelectorAll<HTMLButtonElement>("[data-layer]")) q.setAttribute("aria-pressed", String(q.dataset.layer === l));
  };
  el.querySelector(".pcb-seg")!.addEventListener("click", (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>("[data-layer]");
    if (b && !b.disabled) setLayer(b.dataset.layer as typeof layer);
  });
  const setRats = (on: boolean) => {
    rats = on;
    el.dataset.stage = on ? "rats" : "copper";
    tog.setAttribute("aria-pressed", String(on));
    // (the layers mean nothing before the copper: the buttons rest)
    for (const q of el.querySelectorAll<HTMLButtonElement>("[data-layer]")) q.disabled = on;
    paintCorners();
    paint();
  };
  tog.addEventListener("click", () => setRats(!rats));
  el.querySelector(".pcb-zoom")!.addEventListener("click", (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>("[data-zoom]");
    if (!b) return;
    if (b.dataset.zoom === "in") pz.zoomBy(1.5);
    else if (b.dataset.zoom === "out") pz.zoomBy(1 / 1.5);
    else pz.fit();
  });

  const paintCorners = () => {
    const w = S();
    const touch = ctx.touch();
    hint.textContent = rats ? (touch ? w.hintRatTouch : w.hintRat) : touch ? w.hintLayTouch : w.hintLay;
    read.textContent = rats ? fill(w.ratRead, { lines: RAT_COUNT }) : fill(w.layRead, { vias: VIA_COUNT });
  };
  const relabel = () => {
    const w = S();
    svg.setAttribute("aria-label", fill(w.boardAria, { w: BOARD_MM[0], h: BOARD_MM[1] }));
    paintCorners();
    paint();
  };
  relabel();
  return {
    el,
    reset(net) {
      pinned = null;
      hover = null;
      nano = false;
      intro = net && byNet.has(net) ? net : null;
      setLayer("both");
      setRats(false);
      pz.fit(true);
    },
    relabel,
    layout() {
      pz.resize();
    },
    escape() {
      if (!pinned && !nano && !intro) return false;
      pinned = null;
      nano = false;
      intro = null;
      paint();
      return true;
    },
    destroy() {
      pz.destroy();
    },
  };
}

/** For the order view: the parts as the BOM groups them (one line per part number) and the pick-and-place rows. */
export const BOM_LINES = (() => {
  const g = new Map<string, string[]>();
  for (const c of B.components as (Part & { mpn: string })[]) {
    if (!g.has(c.mpn)) g.set(c.mpn, []);
    g.get(c.mpn)!.push(c.designator);
  }
  return [...g].map(([mpn, refs]) => ({ mpn, refs }));
})();
export const PNP_ROWS = B.components.map((c) => ({ ref: c.designator, x: c.x, y: c.y, rot: c.rotation }));
export const HEADER_HOLES = B.header.pins.length;
export const SENSE_LINES = ROWS;

/** For the order view's pictures: the board's geometry in board millimetres from its bottom-left corner (x right,
 *  y up, as the pick-and-place file counts them), and the drawings each Gerber layer holds. */
export const GEO = {
  w: B.outline.size[0],
  h: B.outline.size[1],
  /** A point of the board files -> mm from the board's bottom-left corner. */
  at: (x: number, y: number): Pt => [x - OX, y - B.outline.bbox[1]],
  parts: B.components.map((c) => {
    const [bw, bh] = c.package.body;
    const turned = Math.round(c.rotation) % 180 !== 0;
    return { ref: c.designator, x: c.x, y: c.y, rot: c.rotation, w: turned ? bh : bw, h: turned ? bw : bh, pins: c.pins, tabs: c.tabs };
  }),
  tracks: (layer: "top" | "bottom") => B.nets.flatMap((n) => n.tracks?.[layer] ?? []),
  holes: B.header.pins.map((p) => ({ x: p.x, y: p.y, r: B.header.drill / 2, pad: B.header.pad / 2 })),
  vias: B.vias.positions.map(([x, y]) => ({ x, y, r: B.vias.drill / 2, pad: B.vias.pad / 2 })),
};
