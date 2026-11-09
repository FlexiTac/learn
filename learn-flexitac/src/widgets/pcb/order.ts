// The order view of the PCB design picture (src/widgets/pcb-design.ts, lesson 2.3 step 4): from the design files to a
// working board, in four stages, one shown at a time (the first at the start; the line under them says a stage can be
// clicked, and sums the order up):
//   Export   the three kinds of file EasyEDA exports, each as a small picture from the real board data
//            (shared/data/board.json): the Gerber files as the board's layers drawn apart (silkscreen, solder mask, top
//            copper, the board with its holes, bottom copper), the BOM as its five lines in plain words, the
//            pick-and-place file as the board seen from above with each part's centre marked (pointing at one reads its
//            position, measured from the board's corner as the file measures it from its own origin)
//   Factory  what the factory does and what it cost (the hardware guide's JLCPCB quote, ./cost.ts), with two crops of
//            the guide's screenshots (the factory's preview of the bare board, its 3D check of the parts; public/media/
//            pcb/factory-*.webp), larger on a click; and where the files are to order the same board
//   By hand  the Nano on its sockets: Fig 3's realistic board and Nano, the Nano held above its sockets
//   Flash    loading the firmware (Lesson 1.4 has the steps)
// Each panel sits in the middle of the free height. The text names things in sentences, with no heading over each panel
// (the pressed stage card names it).
import { R1 } from "@shared/data/constants.mjs";
import { fill } from "../../i18n";
import { badge } from "../../ui/bits";
import { esc } from "../../ui/dom";
import { icon } from "../../ui/icons";
import type { IconId, Theme } from "../../types";
import { BOM_LINES, GEO, HEADER_HOLES, PNP_ROWS } from "./board";
import { GUIDE_URL, ORDER, ORDER_TOTAL, usd } from "./cost";
import { S } from "./words";

const BASE = import.meta.env.BASE_URL;
const KOHM = `${R1 / 1000} kΩ`;
const GERBER_FILES = 11;

/** The two screenshots (crops of the hardware guide's image13 and image15). */
const SHOTS: { n: string; key: "shot13" | "shot15"; file: string; ar: string }[] = [
  { n: "previews", key: "shot13", file: "factory-previews", ar: "340 / 484" },
  { n: "3d", key: "shot15", file: "factory-3d", ar: "660 / 548" },
];
const shotSrc = (file: string) => `${BASE}media/pcb/${file}.webp`;

const STAGES: { st: 1 | 2 | 3 | 4; ico: IconId; t: "st1t" | "st2t" | "st3t" | "st4t"; s: "st1" | "st2" | "st3" | "st4" }[] = [
  { st: 1, ico: "copy", t: "st1t", s: "st1" },
  { st: 2, ico: "board", t: "st2t", s: "st2" },
  { st: 3, ico: "tools", t: "st3t", s: "st3" },
  { st: 4, ico: "flash", t: "st4t", s: "st4" },
];

/** A BOM line's part, in plain words, and its icon (by its first designator). */
const BOM_WORD: Record<string, { key: "bomF1" | "bomF2" | "bomR1" | "bomU2" | "bomU6"; ico: IconId }> = {
  FPC1: { key: "bomF1", ico: "plug" },
  FPC2: { key: "bomF2", ico: "plug" },
  R1: { key: "bomR1", ico: "resistor" },
  U2: { key: "bomU2", ico: "shift" },
  U6: { key: "bomU6", ico: "mux" },
};
/** The refs of one BOM line, as a range where they run on ("U2–U5"). */
const refs = (r: string[]) => (r.length > 2 ? `${r[0]}–${r[r.length - 1]}` : r.join(", "));

// ------------------------------------------------------------------ the Gerber layers, drawn apart
/** The board's layers one above the other, each a sheet seen from the front and above: bottom copper, the board with
 *  its holes, top copper, solder mask, silkscreen (drawn bottom first). Board millimetres, x right and y up from the
 *  board's bottom-left corner, through one affine map per sheet. */
function gerberStack(): string {
  const a = (28 * Math.PI) / 180;
  const q = 0.34; // how flat the sheets look
  const GAP = 13.5;
  const [c, s] = [Math.cos(a), Math.sin(a)];
  const { w: W, h: H } = GEO;
  const m = (k: number) => `matrix(${c.toFixed(4)} ${(-q * s).toFixed(4)} ${(-s).toFixed(4)} ${(-q * c).toFixed(4)} 0 ${(-k * GAP).toFixed(2)})`;
  const at = (x: number, y: number) => GEO.at(x, y);
  const poly = (l: [number, number][]) => l.map(([x, y]) => at(x, y).map((v) => v.toFixed(2)).join(",")).join(" ");
  const sheet = (cls: string) => `<rect class="gs-sheet ${cls}" x="0" y="0" width="${W.toFixed(2)}" height="${H.toFixed(2)}" rx="0.6"/>`;
  const pads = () =>
    GEO.parts
      .flatMap((p) => p.pins.map((pin) => [pin.x, pin.y, pin.padW, pin.padH] as const))
      .map(([x, y, w, h]) => {
        const [u, v] = at(x, y);
        return `<rect x="${(u - w / 2).toFixed(2)}" y="${(v - h / 2).toFixed(2)}" width="${w}" height="${h}"/>`;
      })
      .join("");
  const holes = (r: (h: { r: number; pad: number }) => number) =>
    [...GEO.holes, ...GEO.vias]
      .map((h) => {
        const [u, v] = at(h.x, h.y);
        return `<circle cx="${u.toFixed(2)}" cy="${v.toFixed(2)}" r="${r(h).toFixed(2)}"/>`;
      })
      .join("");
  const o: string[] = [];
  // 0 bottom copper
  o.push(`<g transform="${m(0)}">${sheet("gs-cu")}<g class="gs-tb">${GEO.tracks("bottom").map((l) => `<polyline points="${poly(l)}"/>`).join("")}</g></g>`);
  // 1 the board, its outline and its holes
  o.push(`<g transform="${m(1)}">${sheet("gs-core")}<g class="gs-holes">${holes((h) => Math.max(h.r, 0.35))}</g></g>`);
  // 2 top copper
  o.push(`<g transform="${m(2)}">${sheet("gs-cu")}<g class="gs-tt">${GEO.tracks("top").map((l) => `<polyline points="${poly(l)}"/>`).join("")}</g><g class="gs-pads">${pads()}</g></g>`);
  // 3 solder mask: green, open over the pads and the holes
  o.push(`<g transform="${m(3)}">${sheet("gs-mask")}<g class="gs-open">${pads()}${GEO.holes.map((h) => { const [u, v] = at(h.x, h.y); return `<circle cx="${u.toFixed(2)}" cy="${v.toFixed(2)}" r="${h.pad.toFixed(2)}"/>`; }).join("")}</g></g>`);
  // 4 silkscreen: the parts' outlines and pin-1 dots
  const silk = GEO.parts
    .filter((p) => /^U|^R/.test(p.ref))
    .map((p) => {
      const [u, v] = at(p.x, p.y);
      return `<rect x="${(u - p.w / 2).toFixed(2)}" y="${(v - p.h / 2).toFixed(2)}" width="${p.w.toFixed(2)}" height="${p.h.toFixed(2)}" rx="0.3"/>`;
    })
    .join("");
  const rows = GEO.holes.map((h) => at(h.x, h.y));
  const xs = [...new Set(rows.map(([u]) => u.toFixed(1)))].map(Number);
  const ys = rows.map(([, v]) => v);
  const nanoRows = xs.map((u) => `<rect x="${(u - 1.3).toFixed(2)}" y="${(Math.min(...ys) - 1.3).toFixed(2)}" width="2.6" height="${(Math.max(...ys) - Math.min(...ys) + 2.6).toFixed(2)}" rx="0.3"/>`).join("");
  o.push(`<g transform="${m(4)}">${sheet("gs-silkbg")}<g class="gs-silk">${silk}${nanoRows}</g></g>`);
  // the view box: the five sheets' corners
  const corner = (x: number, y: number, k: number): [number, number] => [c * x - s * y, -q * (s * x + c * y) - k * GAP];
  const cs = [0, 4].flatMap((k) => [corner(0, 0, k), corner(W, 0, k), corner(0, H, k), corner(W, H, k)]);
  const x0 = Math.min(...cs.map((p) => p[0])) - 1.5;
  const x1 = Math.max(...cs.map((p) => p[0])) + 1.5;
  const y0 = Math.min(...cs.map((p) => p[1])) - 1.5;
  const y1 = Math.max(...cs.map((p) => p[1])) + 1.5;
  return `<svg class="pcb-gs" viewBox="${x0.toFixed(1)} ${y0.toFixed(1)} ${(x1 - x0).toFixed(1)} ${(y1 - y0).toFixed(1)}" role="img" data-t-aria="gerAria" aria-label="${esc(S().gerAria)}" preserveAspectRatio="xMidYMid meet">${o.join("")}</svg>`;
}

// ------------------------------------------------------------------ the pick-and-place file, as a picture
/** The board from above, each part's outline and its centre marked, with the corner the numbers are measured from. */
function pnpPicture(): string {
  const { w: W, h: H } = GEO;
  const Yv = (y: number) => H - y; // board mm (y up) -> picture (y down)
  const o: string[] = [];
  o.push(`<rect class="pp-board" x="0" y="0" width="${W.toFixed(2)}" height="${H.toFixed(2)}" rx="0.6"/>`);
  o.push(`<g class="pp-holes">${GEO.holes.map((h) => { const [u, v] = GEO.at(h.x, h.y); return `<circle cx="${u.toFixed(2)}" cy="${Yv(v).toFixed(2)}" r="0.55"/>`; }).join("")}</g>`);
  for (const p of GEO.parts) {
    const [u, v] = GEO.at(p.x, p.y);
    const y = Yv(v);
    const right = u > W - 12; // the name on the left of the mark, near the right edge
    const lx = right ? u - 1.6 : u + 1.6;
    const ly = y - 1.5;
    o.push(`<g class="pp-part" data-ref="${p.ref}" tabindex="0" role="button">
      <rect class="pp-hit" x="${(u - p.w / 2 - 0.6).toFixed(2)}" y="${(y - p.h / 2 - 0.6).toFixed(2)}" width="${(p.w + 1.2).toFixed(2)}" height="${(p.h + 1.2).toFixed(2)}" rx="0.8"/>
      <rect class="pp-out" x="${(u - p.w / 2).toFixed(2)}" y="${(y - p.h / 2).toFixed(2)}" width="${p.w.toFixed(2)}" height="${p.h.toFixed(2)}" rx="0.4"/>
      <path class="pp-x" d="M${(u - 1.5).toFixed(2)} ${y.toFixed(2)}H${(u + 1.5).toFixed(2)}M${u.toFixed(2)} ${(y - 1.5).toFixed(2)}V${(y + 1.5).toFixed(2)}"/>
      <circle class="pp-c" cx="${u.toFixed(2)}" cy="${y.toFixed(2)}" r="0.45"/>
      <text class="pp-t" x="${lx.toFixed(2)}" y="${ly.toFixed(2)}" text-anchor="${right ? "end" : "start"}">${p.ref}</text>
    </g>`);
  }
  // the corner the positions count from, with its two axes
  o.push(`<g class="pp-axes"><path d="M0 ${H}H6.5M0 ${H}V${H - 6.5}"/><path class="pp-ah" d="M7.6 ${H}l-1.6 -0.9v1.8zM0 ${H - 7.6}l-0.9 1.6h1.8z"/>
    <text x="8.3" y="${(H + 0.9).toFixed(2)}">x</text><text x="-0.6" y="${(H - 8.4).toFixed(2)}" text-anchor="middle">y</text><circle cx="0" cy="${H}" r="0.75"/></g>`);
  return `<svg class="pcb-pp" viewBox="-3 -3 ${(W + 6).toFixed(2)} ${(H + 6).toFixed(2)}" role="group" data-t-aria="pnpAria" aria-label="${esc(fill(S().pnpAria, { n: PNP_ROWS.length }))}" preserveAspectRatio="xMidYMid meet">${o.join("")}</svg>`;
}
const pnpWords = (ref: string): string => {
  const r = PNP_ROWS.find((q) => q.ref === ref);
  if (!r) return "";
  const [x, y] = GEO.at(r.x, r.y);
  return fill(S().pnpAt, { ref, x: x.toFixed(2), y: y.toFixed(2), rot: Math.round(r.rot) });
};

/** Fig 3's realistic layers (public/figures/board-layers/layers.json, figure units of its 880 x 580 view, [x0, y0, x1,
 *  y1]): the board with its sockets, and the Nano free of them; the Nano is drawn LIFT units higher, its 28 mm lift
 *  as Fig 3 shows it (6.85 units per mm, seen from 40° up: 28 x 6.85 x cos 40°). */
const LAYERS: Record<Theme, { board: number[]; nano: number[] }> = {
  light: { board: [191, 125.75, 670.25, 434], nano: [189, 97.5, 432.25, 356.75] },
  dark: { board: [190.5, 121, 672.5, 434.75], nano: [189, 97.5, 432.25, 356.75] },
};
const LIFT = 147;
/** The realistic board with its Nano held above the sockets ("lifted": By hand), or plugged in ("seated": Flash, the
 *  board as it is then; Fig 3's nano-seat layer, drawn where the Nano rests). */
function realPic(theme: Theme, pose: "lifted" | "seated"): string {
  const { board: b, nano: n } = LAYERS[theme];
  const lift = pose === "lifted" ? LIFT : 0;
  const x0 = Math.min(b[0], n[0]);
  const x1 = Math.max(b[2], n[2]);
  const y0 = Math.min(b[1], n[1] - lift);
  const y1 = Math.max(b[3], n[3] - lift);
  const W = x1 - x0;
  const H = y1 - y0;
  const at = (r: number[], dy = 0) =>
    `left:${(((r[0] - x0) / W) * 100).toFixed(2)}%;top:${(((r[1] - dy - y0) / H) * 100).toFixed(2)}%;width:${(((r[2] - r[0]) / W) * 100).toFixed(2)}%;height:${(((r[3] - r[1]) / H) * 100).toFixed(2)}%`;
  const src = (f: string) => `${BASE}figures/board-layers/${theme}/${f}.webp`;
  // (--ar: the picture's own width / height, so the frame can size itself by the free height too: pcb-design.css)
  return `<div class="pcb-real-pic" data-pose="${pose}" aria-hidden="true" style="--ar:${(W / H).toFixed(4)}"><div class="pcb-real-in" style="aspect-ratio:${W.toFixed(2)} / ${H.toFixed(2)}">
    <img class="pic-board" alt="" decoding="async" src="${src("board")}" style="${at(b)}">
    <img class="pic-nano" alt="" decoding="async" src="${src(pose === "lifted" ? "nano-free" : "nano-seat")}" style="${at(n, lift)}">
  </div></div>`;
}

export interface OrderView {
  el: HTMLElement;
  reset(): void;
  relabel(): void;
  setTheme(t: Theme): void;
  escape(): boolean;
  destroy(): void;
}

export function orderView(ctx: { theme(): Theme; touch(): boolean }): OrderView {
  const el = document.createElement("section");
  el.className = "pcb-view pcb-ord";
  el.dataset.v = "order";
  el.innerHTML = `
    <header class="pcb-bar"><p class="pcb-k" data-t="kOrd"></p></header>
    <div class="pcb-area pcb-ord-area">
      <ol class="pcb-flow" role="list"></ol>
      <div class="pcb-detail"></div>
    </div>
    <footer class="pcb-foot"><p class="pcb-hint"></p><p class="pcb-read"></p></footer>
    <div class="pcb-shot" hidden role="dialog" aria-modal="false">
      <figure><img alt=""><figcaption></figcaption></figure>
      <button type="button" class="pcb-shot-x">${icon("close")}</button>
    </div>`;
  const flow = el.querySelector<HTMLElement>(".pcb-flow")!;
  const detail = el.querySelector<HTMLElement>(".pcb-detail")!;
  const big = el.querySelector<HTMLElement>(".pcb-shot")!;
  const hint = el.querySelector<HTMLElement>(".pcb-hint")!;
  const read = el.querySelector<HTMLElement>(".pcb-read")!;
  let st: 1 | 2 | 3 | 4 = 1;
  let theme = ctx.theme();
  let open: string | null = null;
  /** The part whose position the pick-and-place line reads (pointed at or chosen), if any. */
  let ppRef: string | null = null;

  const paintFlow = () => {
    const s = S();
    flow.innerHTML = STAGES.map(
      (x) => `<li><button type="button" class="pcb-stage" data-st="${x.st}" aria-pressed="${x.st === st}">
        <span class="pcb-stage-ico">${icon(x.ico)}</span>
        <b class="pcb-stage-t">${s[x.t]}</b>
        <span class="pcb-stage-s">${s[x.s]}</span>
      </button></li>`,
    ).join("");
  };

  const panel = (): string => {
    const s = S();
    if (st === 1) {
      const parts = BOM_LINES.reduce((n, b) => n + b.refs.length, 0);
      const bom = BOM_LINES.map((b) => {
        const w = BOM_WORD[b.refs[0]];
        return `<li><span class="pcb-bom-ico">${icon(w?.ico ?? "chip")}</span><span class="pcb-bom-n">${w ? fill(s[w.key], { kohm: KOHM }) : esc(b.mpn)}</span><span class="pcb-bom-r mono">${refs(b.refs)}</span><span class="pcb-bom-q mono">${fill(s.bomQty, { n: b.refs.length })}</span></li>`;
      }).join("");
      return `<div class="pcb-files">
        <figure class="pcb-file">
          <div class="pcb-pic">${gerberStack()}</div>
          <figcaption><b class="pcb-file-t">${s.gerT}</b><span>${fill(s.ger, { n: GERBER_FILES })}</span></figcaption>
        </figure>
        <figure class="pcb-file">
          <div class="pcb-pic"><ul class="pcb-bom">${bom}</ul></div>
          <figcaption><b class="pcb-file-t">${s.bomT}</b><span>${fill(s.bom, { n: BOM_LINES.length, parts })}</span></figcaption>
        </figure>
        <figure class="pcb-file">
          <div class="pcb-pic">${pnpPicture()}</div>
          <figcaption><b class="pcb-file-t">${s.pnpT}</b><span class="pcb-pp-line" aria-live="polite">${ppRef ? pnpWords(ppRef) : s.pnp}</span></figcaption>
        </figure>
      </div>`;
    }
    if (st === 2) {
      const total = ORDER_TOTAL;
      const link = `<a href="${GUIDE_URL}" target="_blank" rel="noopener noreferrer">${s.ownLink}&nbsp;↗</a>`;
      return `<div class="pcb-fac">
        <div class="pcb-fac-text">
          <p class="pcb-big">${fill(s.facCost, { cost: `<b>${usd(total)}</b>`, n: ORDER.boards })}</p>
          <p class="pcb-split">${fill(s.facSplit, { pcb: usd(ORDER.pcb), pcba: usd(ORDER.pcba), each: usd(total / ORDER.boards) })}</p>
          <p>${fill(s.facOnce, { setup: usd(ORDER.setup), ext: usd(ORDER.extended) })}</p>
          <p>${s.facTime}</p>
          <p>${fill(s.facDo, { n: PNP_ROWS.length })}</p>
          <p class="pcb-own">${fill(s.own, { link })}</p>
          <p class="pcb-src">${s.srcGuide}</p>
        </div>
        <div class="pcb-shots">${SHOTS.map(
          (x) => `<button type="button" class="pcb-thumb" data-shot="${x.n}" style="--ar:${x.ar}" aria-label="${esc(fill(s.shotOpen, { cap: s[x.key] }))}">
            <img src="${shotSrc(x.file)}" alt="" loading="lazy" decoding="async"><span>${s[x.key]}</span></button>`,
        ).join("")}</div>
      </div>`;
    }
    if (st === 3) {
      return `<div class="pcb-hand">
        ${realPic(theme, "lifted")}
        <p class="pcb-hand-text">${fill(s.hand, { holes: HEADER_HOLES, badge: `&nbsp;${badge("inferred")}` })}</p>
      </div>`;
    }
    return `<div class="pcb-hand pcb-flash">
      ${realPic(theme, "seated")}
      <div class="pcb-flash-text">
        <p>${s.flash}</p>
        <pre class="pcb-term" aria-hidden="true"><code><span class="pr">$</span> pip install "flexitac[examples]"
<span class="pr">$</span> flexitac-flash</code></pre>
      </div>
    </div>`;
  };

  const paint = () => {
    const s = S();
    el.querySelector(".pcb-k")!.textContent = s.kOrd;
    flow.setAttribute("aria-label", s.ordAria);
    paintFlow();
    detail.dataset.st = String(st);
    detail.innerHTML = panel();
    hint.textContent = ctx.touch() ? s.ordHintTouch : s.ordHint;
    read.textContent = fill(s.ordRead, { n: ORDER.boards, cost: usd(ORDER_TOTAL) });
    big.querySelector<HTMLButtonElement>(".pcb-shot-x")!.setAttribute("aria-label", s.shotClose);
    for (const g of detail.querySelectorAll<SVGGElement>(".pp-part")) g.setAttribute("aria-label", pnpWords(g.dataset.ref!));
    if (open) showShot(open);
  };
  /** The pick-and-place line: the part pointed at or focused, else what the file holds. */
  const paintPp = () => {
    const line = detail.querySelector<HTMLElement>(".pcb-pp-line");
    if (line) line.textContent = ppRef ? pnpWords(ppRef) : S().pnp;
    for (const g of detail.querySelectorAll<SVGGElement>(".pp-part")) g.classList.toggle("is-on", g.dataset.ref === ppRef);
    detail.querySelector(".pcb-pp")?.toggleAttribute("data-on", Boolean(ppRef));
  };
  const showShot = (n: string | null) => {
    open = n;
    big.hidden = !n;
    if (!n) return;
    const s = S();
    const x = SHOTS.find((q) => q.n === n)!;
    const img = big.querySelector("img")!;
    img.src = shotSrc(x.file);
    img.alt = s[x.key];
    big.querySelector("figcaption")!.innerHTML = `${s[x.key]} <span class="pcb-src">· ${s.shotSrc}</span>`;
    big.setAttribute("aria-label", s[x.key]);
  };
  el.addEventListener("click", (e) => {
    const tgt = e.target as Element;
    const b = tgt.closest<HTMLButtonElement>(".pcb-stage");
    if (b) {
      st = Number(b.dataset.st) as typeof st;
      open = null;
      ppRef = null;
      big.hidden = true;
      paint();
      el.querySelector<HTMLButtonElement>(`.pcb-stage[data-st="${st}"]`)?.focus();
      return;
    }
    const pp = tgt.closest<SVGGElement>(".pp-part");
    if (pp) {
      ppRef = pp.dataset.ref ?? null;
      paintPp();
      return;
    }
    const th = tgt.closest<HTMLButtonElement>(".pcb-thumb");
    if (th) {
      showShot(th.dataset.shot!);
      big.querySelector<HTMLButtonElement>(".pcb-shot-x")!.focus();
      return;
    }
    if (tgt.closest(".pcb-shot-x") || (open && tgt === big)) {
      const was = open;
      showShot(null);
      el.querySelector<HTMLButtonElement>(`.pcb-thumb[data-shot="${was}"]`)?.focus();
    }
  });
  // the pick-and-place picture: pointing at a part (or focusing it) reads its position
  detail.addEventListener("pointerover", (e) => {
    if ((e as PointerEvent).pointerType === "touch") return;
    const g = (e.target as Element).closest<SVGGElement>(".pp-part");
    if (g && g.dataset.ref !== ppRef) {
      ppRef = g.dataset.ref ?? null;
      paintPp();
    }
  });
  detail.addEventListener("pointerout", (e) => {
    const to = (e as PointerEvent).relatedTarget as Element | null;
    if (ppRef && !to?.closest?.(".pcb-pp") && (e.target as Element).closest(".pcb-pp")) {
      ppRef = null;
      paintPp();
    }
  });
  detail.addEventListener("focusin", (e) => {
    const g = (e.target as Element).closest<SVGGElement>(".pp-part");
    if (g) {
      ppRef = g.dataset.ref ?? null;
      paintPp();
    }
  });
  detail.addEventListener("keydown", (e) => {
    const g = (e.target as Element).closest<SVGGElement>(".pp-part");
    if (g && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      ppRef = g.dataset.ref ?? null;
      paintPp();
    }
  });

  paint();
  return {
    el,
    reset() {
      st = 1;
      open = null;
      ppRef = null;
      big.hidden = true;
      paint();
    },
    relabel: paint,
    setTheme(tm) {
      theme = tm;
      const pic = el.querySelector<HTMLElement>(".pcb-real-pic");
      if (pic) pic.outerHTML = realPic(tm, pic.dataset.pose === "seated" ? "seated" : "lifted");
    },
    escape() {
      if (open) {
        const was = open;
        showShot(null);
        el.querySelector<HTMLButtonElement>(`.pcb-thumb[data-shot="${was}"]`)?.focus();
        return true;
      }
      if (ppRef) {
        ppRef = null;
        paintPp();
        return true;
      }
      return false;
    },
    destroy() {},
  };
}
