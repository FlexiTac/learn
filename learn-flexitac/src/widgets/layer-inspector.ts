// Layer inspector (lesson 2; it served the retired lesson 3 "Electrodes, slots and the supporting beam" too): a clickable cross-section of the pad's 5 drawn layers (the polyimide edge
// tape is in stack.json but left out of the drawings to keep them simple, as in Fig 1).
//   - Horizontal is always true to scale: the cut runs across all 12 sense lines (x, mm from the active-area centre).
//   - Vertical is "to scale" (same mm as horizontal) or "thickness ×N" (exaggerated so the layers can be seen).
//   - Every thickness comes from shared/data/stack.json. The two laminating sheets (thickness not given) are drawn hatched
//     at a token height (or at the learner's guess after Run in lesson 2), never at an invented number.
//   - The FPC shapes come from the Gerber data (outline, slots, electrodes) cut at height y, so the slots and the
//     supporting beam appear exactly where the files put them (lesson 3 moves the cut).
//   - Selection syncs both ways with Fig 1 (act "select" / state.selected).
import { fpcBot, fpcTop, stack } from "@shared/data/index.mjs";
import { chips } from "../content/sources";
import type { WidgetCtx, WidgetInstance } from "../types";
import { esc, h } from "../ui/dom";
import "./layer-inspector.css";

type Rect = { x0: number; y0: number; x1: number; y1: number };
type Span = [number, number];
type StackLayer = { id: string; name: string; material: string; thickness: number | null; src: string; note?: string; coverage?: string; orientation?: string; inferredOrientation?: boolean };

const LAYERS = (stack.layers as unknown as StackLayer[]).filter((l) => !l.id.startsWith("pi_")); // top -> bottom, tape left out
/** stack.json id -> Fig 1 piece id */
const FIG_ID: Record<string, string> = { lam_top: "lam_t", fpc_top: "fpc_t", velostat: "velostat", fpc_bot: "fpc_b", lam_bot: "lam_b" };
const FROM_FIG: Record<string, string> = Object.fromEntries(Object.entries(FIG_ID).map(([k, v]) => [v, k]));

/** Short labels and one-line jobs (plain words; the numbers come from the data). */
const SHORT: Record<string, string> = {
  lam_top: "Laminating sheet",
  fpc_top: "Top FPC",
  velostat: "Velostat",
  fpc_bot: "Bottom FPC",
  lam_bot: "Laminating sheet",
};
const JOB: Record<string, string> = {
  lam_top: "Holds the Top FPC flat and lined up; the sheets enclose the whole stack.",
  fpc_top: "Carries the sense lines. Copper on one side only, flipped to face the Velostat.",
  velostat: "The filling: squeeze it and its resistance drops.",
  fpc_bot: "Carries the drive lines, copper facing up into the Velostat.",
  lam_bot: "Holds the Bottom FPC flat and lined up.",
};
const KIND: Record<string, string> = { lam_top: "lam", fpc_top: "fpc", velostat: "velo", fpc_bot: "fpc", lam_bot: "lam" };

// ---------------------------------------------------------------- geometry (Gerber data, mm)
const WIN: Span = [-13.5, 13.5]; // cross-section window across the sense lines
const VELO_SPAN: Span = [-12, 12]; // display only: the Velostat sheet's size is not in the files
const TAPE_W = 2; // display only: border strip width is not in the files

type Outline = { pts: number[][] };
type FpcData = { outline: Outline; slots: { rects: Rect[]; width: number }; electrodes: { rects: Rect[]; width: number; pitch: number }; bridge: (Rect & { width: number }) | null; assembly: { padFrameTransform: { mirrorX: boolean } } };
const TOP = fpcTop as unknown as FpcData;
const BOT = fpcBot as unknown as FpcData;

/** x-intervals where a horizontal line at y is inside the polygon. */
function scan(pts: number[][], y: number): Span[] {
  const xs: number[] = [];
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[(i + 1) % pts.length];
    if (ay <= y !== by <= y) xs.push(ax + ((y - ay) / (by - ay)) * (bx - ax));
  }
  xs.sort((a, b) => a - b);
  const out: Span[] = [];
  for (let i = 0; i + 1 < xs.length; i += 2) out.push([xs[i], xs[i + 1]]);
  return out;
}
function subtract(spans: Span[], cuts: Span[]): Span[] {
  let out = spans;
  for (const [c0, c1] of cuts) {
    const next: Span[] = [];
    for (const [a, b] of out) {
      if (c1 <= a || c0 >= b) next.push([a, b]);
      else {
        if (c0 > a) next.push([a, c0]);
        if (c1 < b) next.push([c1, b]);
      }
    }
    out = next;
  }
  return out;
}
const clip = (spans: Span[], [w0, w1]: Span = WIN): Span[] => spans.map(([a, b]) => [Math.max(a, w0), Math.min(b, w1)] as Span).filter(([a, b]) => b - a > 1e-6);
const inY = (r: Rect, y: number) => y >= r.y0 && y <= r.y1;

interface Cut {
  film: Span[];
  copper: Span[];
  slots: Span[];
}
function cutFpc(d: FpcData, y: number): Cut {
  const m = d.assembly.padFrameTransform.mirrorX ? -1 : 1;
  const xs = (r: Rect): Span => (m > 0 ? [r.x0, r.x1] : [-r.x1, -r.x0]);
  const outline = scan(d.outline.pts.map(([x, yy]) => [m * x, yy]), y);
  const slots = d.slots.rects.filter((r) => inY(r, y)).map(xs);
  return { film: clip(subtract(outline, slots)), copper: clip(d.electrodes.rects.filter((r) => inY(r, y)).map(xs)), slots: clip(slots) };
}

// ---------------------------------------------------------------- widget
interface Cfg {
  cut: boolean;
  mode: "scale" | "exag";
}
const CFG: Record<string, Cfg> = {
  "electrodes-slots-beam": { cut: true, mode: "exag" },
};
const DEFAULT_CFG: Cfg = { cut: false, mode: "exag" };

const BEAM = TOP.bridge!;
const ON_LINE_Y = 1; // a drive line's centre (COL_Y has 1.0 mm): the default cut in lesson 3
const BEAM_Y = (BEAM.y0 + BEAM.y1) / 2;
const NICE = [2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50];
const TOKEN_MM = 0.08; // display height for a layer whose thickness is not given (exaggerated view only)
let uid = 0;

export function mount(el: HTMLElement, ctx: WidgetCtx): WidgetInstance {
  const cfg = CFG[ctx.lesson.id] ?? DEFAULT_CFG;
  const id = `li${++uid}`;
  let mode = cfg.mode;
  let selected: string | null = null;
  let cutY = ON_LINE_Y;
  let guess: { lam: number; tape: number } | null = null; // mm, from Run in lesson 2
  let hover: string | null = null;

  const root = h("div", { class: "w-li", "data-mode": mode });
  root.innerHTML = `
    <div class="w-li-head">
      <span class="w-kicker">Layer inspector · cross-section</span>
      <div class="w-li-ctl">
        ${
          cfg.cut
            ? `<div class="w-li-seg" role="group" aria-label="Where to cut">
                 <button type="button" data-cut="line">Along a drive line</button>
                 <button type="button" data-cut="beam">Through the beam</button>
               </div>`
            : ""
        }
        <div class="w-li-seg" role="group" aria-label="Thickness scale">
          <button type="button" data-mode="scale">True scale</button>
          <button type="button" data-mode="exag">Thicker</button>
        </div>
      </div>
    </div>
    <div class="w-li-body">
      <div class="w-li-list" role="group" aria-label="Layers, top to bottom"></div>
      <div class="w-li-svg"><svg role="img" aria-label="Cross-section of the pad"></svg></div>
    </div>
    <div class="w-li-info" aria-live="polite"></div>`;
  el.append(root);
  const list = root.querySelector<HTMLElement>(".w-li-list")!;
  const svgBox = root.querySelector<HTMLElement>(".w-li-svg")!;
  const svg = root.querySelector<SVGSVGElement>("svg")!;
  const info = root.querySelector<HTMLElement>(".w-li-info")!;

  // ---- layer list (the accessible way in: buttons, arrow keys)
  list.innerHTML = LAYERS.map(
    (l) => `<button type="button" class="w-li-row" data-id="${l.id}" aria-pressed="false">
      <span class="w-li-sw k-${KIND[l.id]}"></span><span class="w-li-name">${esc(SHORT[l.id])}</span><span class="w-li-t mono"></span></button>`,
  ).join("");
  const rows = [...list.querySelectorAll<HTMLButtonElement>(".w-li-row")];

  const thick = (l: StackLayer): { mm: number | null; guess: boolean } => {
    if (l.thickness != null) return { mm: l.thickness, guess: false };
    if (guess) return { mm: KIND[l.id] === "lam" ? guess.lam : guess.tape, guess: true };
    return { mm: null, guess: false };
  };
  const fmtMm = (mm: number) => `${+mm.toFixed(3)} mm`;

  function choose(layerId: string | null, fromFigure = false) {
    selected = layerId;
    if (!fromFigure && ctx.figure) {
      if (layerId) ctx.figure.act("select", FIG_ID[layerId]);
      else ctx.figure.act("deselect");
    }
    draw();
  }

  const onList = (e: Event) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>(".w-li-row");
    if (!b) return;
    choose(selected === b.dataset.id ? null : b.dataset.id!);
  };
  const onListKey = (e: KeyboardEvent) => {
    const i = rows.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    const d = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = rows[(i + d + rows.length) % rows.length];
    next.focus();
    choose(next.dataset.id!);
  };
  const onHead = (e: Event) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (!b) return;
    if (b.dataset.mode) mode = b.dataset.mode as Cfg["mode"];
    if (b.dataset.cut) cutY = b.dataset.cut === "beam" ? BEAM_Y : ON_LINE_Y;
    draw();
  };
  const onSvg = (e: Event) => {
    const t = (e.target as Element).closest("[data-hit]");
    if (t) choose(selected === t.getAttribute("data-hit") ? null : t.getAttribute("data-hit"));
    else if (selected) choose(null);
  };
  const onSvgMove = (e: Event) => {
    const t = (e.target as Element).closest("[data-hit]");
    const next = t ? t.getAttribute("data-hit") : null;
    if (next !== hover) {
      hover = next;
      svg.querySelectorAll(".is-hover").forEach((n) => n.classList.remove("is-hover"));
      if (hover) svg.querySelectorAll(`[data-layer="${hover}"]`).forEach((n) => n.classList.add("is-hover"));
    }
  };
  list.addEventListener("click", onList);
  list.addEventListener("keydown", onListKey);
  root.querySelector(".w-li-head")!.addEventListener("click", onHead);
  svg.addEventListener("click", onSvg);
  svg.addEventListener("pointermove", onSvgMove);
  svg.addEventListener("pointerleave", onSvgMove);

  // ---- drawing
  function draw() {
    root.dataset.mode = mode;
    root.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
    root.querySelectorAll<HTMLButtonElement>("[data-cut]").forEach((b) => b.setAttribute("aria-pressed", String((b.dataset.cut === "beam") === (cutY === BEAM_Y))));
    for (const r of rows) {
      const l = LAYERS.find((x) => x.id === r.dataset.id)!;
      const t = thick(l);
      r.setAttribute("aria-pressed", String(r.dataset.id === selected));
      r.classList.toggle("is-guess", t.guess);
      r.querySelector(".w-li-t")!.innerHTML =
        t.mm == null ? `<span class="t-long">not given</span><span class="t-short" title="not given">?</span>` : t.guess ? `${fmtMm(t.mm)}?` : fmtMm(t.mm);
    }
    drawSvg();
    drawInfo();
  }

  function drawSvg() {
    const W = Math.max(240, svgBox.clientWidth);
    const H = Math.max(70, svgBox.clientHeight);
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("width", String(W));
    svg.setAttribute("height", String(H));
    // list beside the drawing (wide) -> leader lines from each row to its band; list below (narrow) -> none
    const sb = svgBox.getBoundingClientRect();
    const side = rows[0].getBoundingClientRect().right <= sb.left + 1;
    const padL = side ? 34 : 6;
    const padR = 6;
    const sx = (W - padL - padR) / (WIN[1] - WIN[0]);
    const X = (mm: number) => padL + (mm - WIN[0]) * sx;
    const topRoom = cfg.cut ? 30 : 8; // annotations above
    const botRoom = 20; // scale bar below
    const avail = H - topRoom - botRoom;

    // vertical scale
    const known = LAYERS.reduce((s, l) => s + (thick(l).mm ?? 0), 0);
    const unknown = LAYERS.filter((l) => thick(l).mm == null).length;
    let E = 1;
    if (mode === "exag") {
      const raw = avail / ((known + unknown * TOKEN_MM) * sx);
      E = NICE.filter((n) => n <= raw).pop() ?? 2;
    }
    const sy = sx * E;
    const bandPx = (l: StackLayer) => {
      const t = thick(l).mm;
      if (t != null) return t * sy;
      return mode === "exag" ? TOKEN_MM * sy : 0; // not given: hairline at true scale
    };
    const total = LAYERS.reduce((s, l) => s + bandPx(l), 0);
    let y = topRoom + Math.max(0, (avail - total) / 2);

    const parts: string[] = [];
    const pat = (k: string) =>
      `<pattern id="${id}-hatch-${k}" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" class="li-hatch-bg-${k}"/><line x1="0" y1="0" x2="0" y2="5" class="li-hatch"/></pattern>`;
    parts.push(`<defs>${pat("lam")}${pat("tape")}</defs>`);

    const topCut = cutFpc(TOP, cutY);
    const botCut = cutFpc(BOT, cutY);
    const geo: Record<string, { y: number; h: number }> = {};
    for (const l of LAYERS) {
      const hgt = bandPx(l);
      geo[l.id] = { y, h: hgt };
      y += hgt;
    }

    const cls = (l: StackLayer, extra = "") => {
      const c = [`li-${KIND[l.id]}`, extra];
      if (selected && selected !== l.id) c.push("is-dim");
      if (selected === l.id) c.push("is-sel");
      if (hover === l.id) c.push("is-hover");
      return c.join(" ");
    };
    const rect = (x0: number, x1: number, y0: number, hh: number, c: string, l: StackLayer, fill = "") =>
      `<rect data-layer="${l.id}" class="${c}" x="${X(x0).toFixed(2)}" y="${y0.toFixed(2)}" width="${((x1 - x0) * sx).toFixed(2)}" height="${Math.max(hh, 0.6).toFixed(2)}"${fill ? ` style="fill:${fill}"` : ""}/>`;

    for (const l of LAYERS) {
      const { y: y0, h: hh } = geo[l.id];
      const t = thick(l);
      const unknownBand = t.mm == null;
      const hatch = unknownBand ? `url(#${id}-hatch-${KIND[l.id]})` : "";
      const k = KIND[l.id];
      const extra = (unknownBand ? "is-unknown" : "") + (t.guess ? " is-guess" : "");
      let spans: Span[];
      if (k === "tape") spans = [[WIN[0], WIN[0] + TAPE_W], [WIN[1] - TAPE_W, WIN[1]]];
      else if (k === "lam") spans = [WIN];
      else if (k === "velo") spans = [VELO_SPAN];
      else spans = (l.id === "fpc_top" ? topCut : botCut).film;
      if (unknownBand && mode === "scale") {
        // true scale and no number: a dashed hairline, not a made-up band
        for (const [a, b] of spans) parts.push(`<line data-layer="${l.id}" class="${cls(l, "li-hair")}" x1="${X(a)}" x2="${X(b)}" y1="${y0}" y2="${y0}"/>`);
      } else for (const [a, b] of spans) parts.push(rect(a, b, y0, hh, cls(l, extra), l, hatch));
      // copper strips on the Velostat-facing face of each FPC
      if (k === "fpc") {
        const cu = (l.id === "fpc_top" ? topCut : botCut).copper;
        const ch = Math.max(1.4, hh * 0.22);
        const cy = l.id === "fpc_top" ? y0 + hh - ch : y0;
        for (const [a, b] of cu) parts.push(rect(a, b, cy, ch, cls(l, "li-cu"), l));
      }
      // hit area: the whole band, at least 12 px tall, so thin layers stay clickable
      const hitH = Math.max(12, hh);
      parts.push(`<rect data-hit="${l.id}" class="li-hit" x="${X(WIN[0])}" y="${(y0 + hh / 2 - hitH / 2).toFixed(2)}" width="${((WIN[1] - WIN[0]) * sx).toFixed(2)}" height="${hitH.toFixed(2)}"><title>${esc(SHORT[l.id])}</title></rect>`);
    }
    // hit areas overlap on thin layers: draw the selected one last so it wins
    if (selected) {
      const i = parts.findIndex((p) => p.startsWith(`<rect data-hit="${selected}"`));
      if (i >= 0) parts.push(parts.splice(i, 1)[0]);
    }

    // annotations (lesson 3): slot, copper, pitch on the Top FPC, measured from the data
    if (cfg.cut) {
      const ft = geo.fpc_top;
      const yA = 11;
      const dim = (a: number, b: number, label: string, row = 0) => {
        const yy = yA + row * 16;
        const xa = X(a);
        const xb = X(b);
        return `<g class="li-dim"><line x1="${xa}" x2="${xb}" y1="${yy + 6}" y2="${yy + 6}"/><line x1="${xa}" x2="${xa}" y1="${yy + 2}" y2="${ft.y}"/><line x1="${xb}" x2="${xb}" y1="${yy + 2}" y2="${ft.y}"/><text x="${(xa + xb) / 2}" y="${yy}" text-anchor="middle">${label}</text></g>`;
      };
      const slot = topCut.slots.find(([a, b]) => Math.abs((a + b) / 2 + 8) < 0.6);
      const cu = topCut.copper.find(([a, b]) => (a + b) / 2 > -2 && (a + b) / 2 < 0);
      const pit = topCut.copper.filter(([a, b]) => (a + b) / 2 > 4 && (a + b) / 2 < 8);
      if (slot) parts.push(dim(slot[0], slot[1], `slot ${(slot[1] - slot[0]).toFixed(1)}`));
      else parts.push(`<g class="li-dim"><text x="${X(-8.5)}" y="${yA}" text-anchor="middle">no slots: beam</text></g>`);
      if (cu) parts.push(dim(cu[0], cu[1], `Cu ${(cu[1] - cu[0]).toFixed(1)}`));
      if (pit.length >= 2) {
        const c0 = (pit[0][0] + pit[0][1]) / 2;
        const c1 = (pit[1][0] + pit[1][1]) / 2;
        parts.push(dim(c0, c1, `pitch ${(c1 - c0).toFixed(1)}`));
      }
    }

    // scale: 1 mm bar + the vertical factor
    // leader lines: list row -> middle of its band
    if (side) {
      for (const r of rows) {
        const lid = r.dataset.id!;
        const rb = r.getBoundingClientRect();
        const ry = rb.top + rb.height / 2 - sb.top;
        const g = geo[lid];
        const by = g.y + g.h / 2;
        const c = ["li-lead", selected === lid ? "is-sel" : selected ? "is-dim" : ""].join(" ");
        parts.push(`<polyline class="${c}" points="0,${ry.toFixed(1)} 12,${ry.toFixed(1)} ${padL - 4},${by.toFixed(1)} ${padL + 2},${by.toFixed(1)}"/>`);
      }
    }
    const yS = H - 7;
    parts.push(
      `<g class="li-scale"><line x1="${X(WIN[0])}" x2="${X(WIN[0] + 1)}" y1="${yS}" y2="${yS}"/><line x1="${X(WIN[0])}" x2="${X(WIN[0])}" y1="${yS - 3}" y2="${yS + 3}"/><line x1="${X(WIN[0] + 1)}" x2="${X(WIN[0] + 1)}" y1="${yS - 3}" y2="${yS + 3}"/>` +
        `<text x="${X(WIN[0] + 1) + 6}" y="${yS + 3.5}">1 mm · ${mode === "exag" ? `thickness ×${E}` : W < 480 ? "true scale" : "true scale, both ways"}${cfg.cut || W < 480 ? "" : " · sliced along one drive line"}</text></g>`,
    );
    svg.innerHTML = parts.join("");
    svg.setAttribute(
      "aria-label",
      `Cross-section of the pad, ${mode === "exag" ? `thickness exaggerated ${E} times` : "drawn to true scale"}. ${selected ? SHORT[selected] + " selected." : ""}`,
    );
  }

  function drawInfo() {
    const parts: string[] = [];
    if (selected) {
      const l = LAYERS.find((x) => x.id === selected)!;
      const t = thick(l);
      const th =
        t.mm == null
          ? `<span class="w-li-ng">thickness not given in the sources</span>`
          : t.guess
            ? `<span class="w-li-ng">your guess: ${fmtMm(t.mm)}</span> <span class="badge badge-illustrative" title="Not from the sources">guess</span>`
            : `<b>${fmtMm(t.mm)}</b>`;
      const src = chips(l.src)
        .slice(0, 2)
        .map((c) => `<span class="w-li-chip mono" title="${esc(c.title)}">${esc(c.label)}</span>`)
        .join("");
      const inf = l.inferredOrientation ? ` <span class="badge badge-inferred" title="${esc(l.orientation ?? "")}">inferred</span>` : "";
      parts.push(`<p><b>${esc(SHORT[l.id])}</b> · ${esc(l.material)} · ${th} ${src} <span class="w-li-job">${JOB[l.id]}</span>${inf}</p>`);
    } else {
      const unknownNote = guess
        ? "Dashed outline = your guess (not from the sources)."
        : mode === "exag"
          ? "Hatched = no thickness in the sources (token height)."
          : "Dashed hairline = no thickness in the sources.";
      parts.push(`<p class="w-li-job">Click a layer, here or in the figure. ${unknownNote}</p>`);
    }
    if (cfg.cut) parts.push(`<p class="w-li-cut mono">${cutText()}</p>`);
    info.innerHTML = parts.join("");
  }

  function cutText(): string {
    const top = cutFpc(TOP, cutY);
    const bot = cutFpc(BOT, cutY);
    const t = top.slots.length ? `Top FPC ${top.slots.length} slots` : "Top FPC uncut (the beam)";
    const b = bot.copper.length ? "Bottom FPC along a drive line" : bot.slots.length ? "Bottom FPC in a slot" : "Bottom FPC bare film";
    return `slice y = ${+cutY.toFixed(2)} mm · ${t} · ${b}`;
  }

  // ---- figure sync
  const offState = ctx.figure?.onState((s) => {
    const fig = (s as { selected?: string | null }).selected ?? null;
    const mine = fig ? FROM_FIG[fig] ?? null : null;
    if (mine !== selected) {
      selected = mine;
      draw();
    }
  });

  const ro = new ResizeObserver(() => drawSvg());
  ro.observe(svgBox);
  draw();

  return {
    destroy() {
      ro.disconnect();
      offState?.();
      root.remove();
    },
    run(p) {
      const out: string[] = [];
      if (p.lam != null || p.tape != null) {
        guess = { lam: Math.max(0, (p.lam ?? 0) / 1000), tape: Math.max(0, (p.tape ?? 0) / 1000) };
        mode = "scale";
        out.push("inspector: your guesses are drawn dashed, at true scale");
      }
      if (p.y != null) {
        cutY = Math.max(-32.5, Math.min(32.5, p.y));
        out.push(`inspector: ${cutText()}`);
      }
      draw();
      return out;
    },
  };
}
