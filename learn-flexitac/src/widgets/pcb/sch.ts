// The schematic view of the PCB design picture (src/widgets/pcb-design.ts, lesson 2.3 step 2).
//  - Simplified: the reading board's circuit drawn by hand from shared/data/board.json's nets: the Nano (U1), the four
//    chained 74HC595s (U2-U5), the CD74HC4067 (U6), R1 and the two sockets. Wires are coloured by their job: the drive
//    path pink (D2 data, D3 clock, the chain, the 32 outputs), the sense path teal (D4-D7 select, D8 enable, the 12
//    sense lines, COM to A0 and R1), power grey (5 V and ground symbols at every part: one symbol, one net, as in a real
//    schematic). A bus is one thick line with a slash and its count. Choosing a part keeps its wires and the parts at
//    their other ends in full colour and steps the rest back; a line under the drawing says what it does.
//  - Real: the page EasyEDA exported (material/tactile_reading_board_32x16.pdf through pdftocairo -svg, then slimmed:
//    the page transform applied, numbers rounded, paths of one colour merged, and each colour a class, so both themes
//    can paint it: public/media/pcb/schematic.svg, 160 KB, 35 KB gzipped), inline, moved and zoomed through its viewBox
//    (./panzoom.ts). It opens on the whole page, then eases in on U5 and FPC2, where the name tags (SC25 … SC32 at
//    U5's outputs and at FPC2's pins) can be read: the line under the page says that pins with the same tag are joined.
//    A ring marks R1 and its "20k" label, a documentation mistake (the part is 10 kOhm: shared/data board.R1); the same
//    line says so.
import { COLS, MUX_OFFSET, R1, ROWS } from "@shared/data/constants.mjs";
import { driveLineInfo } from "@shared/models/scan.mjs";
import { fill } from "../../i18n";
import { icon } from "../../ui/icons";
import { esc } from "../../ui/dom";
import type { IconId } from "../../types";
import { panZoom, type PanZoom } from "./panzoom";
import { S } from "./words";

const NS = "http://www.w3.org/2000/svg";
const KOHM = `${R1 / 1000} kΩ`;
const BASE = import.meta.env.BASE_URL;
/** The real page (public/media/pcb/schematic.svg), parsed as SVG. */
const PAGE = { src: "media/pcb/schematic.svg", mime: "image/svg+xml" } as const;

type Job = "drive" | "sense" | "power";
type PartId = "U1" | "U2" | "U3" | "U4" | "U5" | "U6" | "R1" | "FPC1" | "FPC2";
const PARTS: PartId[] = ["U1", "U2", "U3", "U4", "U5", "U6", "R1", "FPC1", "FPC2"];
const ICON: Record<PartId, IconId> = { U1: "chip", U2: "shift", U3: "shift", U4: "shift", U5: "shift", U6: "mux", R1: "resistor", FPC1: "plug", FPC2: "plug" };

/** Drive lines a-b of a shift register (1-based, from the shared scan model). */
const linesOf = (chip: string) => {
  const js = Array.from({ length: COLS }, (_, j) => j).filter((j) => driveLineInfo(j).chip === chip);
  return { a: js[0] + 1, b: js[js.length - 1] + 1 };
};

/** The words for a part: title and one plain sentence (words.ts). */
export function partWords(p: PartId): { title: string; text: string } {
  const s = S();
  const v = { cols: COLS, rows: ROWS, kohm: KOHM, p1: MUX_OFFSET + 1, p2: MUX_OFFSET + ROWS, c1: MUX_OFFSET, c2: MUX_OFFSET + ROWS - 1, p0: MUX_OFFSET };
  switch (p) {
    case "U1":
      return { title: s.pickU1t, text: s.pickU1 };
    case "U2":
    case "U3":
    case "U4":
    case "U5":
      return { title: fill(s.pickSrT, { id: p }), text: fill(s[`pick${p}` as "pickU2" | "pickU3" | "pickU4" | "pickU5"], linesOf(p)) };
    case "U6":
      return { title: s.pickU6t, text: s.pickU6 };
    case "R1":
      return { title: fill(s.pickR1t, v), text: fill(s.pickR1, v) };
    case "FPC2":
      return { title: s.pickF2t, text: fill(s.pickF2, v) };
    case "FPC1":
      return { title: s.pickF1t, text: fill(s.pickF1, v) };
  }
}

// ------------------------------------------------------------------ the simplified drawing (viewBox 0 0 1000 560)
interface Wire {
  job: Job;
  parts: PartId[];
  d: string;
  bus?: boolean;
  arrow?: boolean;
}
const SR_X: Record<string, number> = { U2: 290, U3: 430, U4: 570, U5: 710 };
const SR_Y = 120;
const SR_W = 100;
const SR_H = 80;

function wires(): Wire[] {
  const w: Wire[] = [];
  // drive path: D2 data into U2, D3's clock under the chips with a tap to each, the chain, the outputs
  w.push({ job: "drive", parts: ["U1", "U2"], d: "M210 215H250V150H290", arrow: true });
  w.push({ job: "drive", parts: ["U1", "U2", "U3", "U4", "U5"], d: `M210 245H240V232H${SR_X.U5 + 28}V212` });
  for (const id of ["U2", "U3", "U4"]) w.push({ job: "drive", parts: ["U1", "U2", "U3", "U4", "U5"], d: `M${SR_X[id] + 28} 232V212` });
  const chain: [PartId, PartId][] = [["U2", "U3"], ["U3", "U4"], ["U4", "U5"]];
  for (const [a, b] of chain) w.push({ job: "drive", parts: [a, b], d: `M${SR_X[a] + SR_W} 150H${SR_X[b]}`, arrow: true });
  for (const id of ["U2", "U3", "U4", "U5"] as PartId[]) w.push({ job: "drive", parts: [id, "FPC2"], d: `M${SR_X[id] + 50} ${SR_Y}V78`, bus: true });
  w.push({ job: "drive", parts: ["U2", "U3", "U4", "U5", "FPC2"], d: `M${SR_X.U2 + 50} 78H860`, bus: true });
  w.push({ job: "drive", parts: ["FPC2"], d: "M920 130H962", bus: true, arrow: true });
  // sense path: the select bus, enable, COM to A0 with R1, the 12 sense lines in
  w.push({ job: "sense", parts: ["U1", "U6"], d: "M210 295H430V405H470", bus: true });
  w.push({ job: "sense", parts: ["U1", "U6"], d: "M210 340H410V432H470", arrow: true });
  w.push({ job: "sense", parts: ["U1", "U6", "R1"], d: "M210 400H380V460H470" });
  w.push({ job: "sense", parts: ["R1", "U1", "U6"], d: "M300 400V418" });
  w.push({ job: "sense", parts: ["U6", "FPC1"], d: "M860 432H640", bus: true, arrow: true });
  w.push({ job: "sense", parts: ["FPC1"], d: "M962 432H920", bus: true, arrow: true });
  return w;
}

/** A power symbol: "5V" (a bar on a stub) or ground (three bars), grey, belonging to one part. */
function power(kind: "5V" | "GND", x: number, y: number, dir: 1 | -1, part: PartId): string {
  const end = y + dir * 12;
  if (kind === "5V")
    return `<g class="pw" data-parts="${part}"><path d="M${x} ${y}V${end}M${x - 9} ${end}H${x + 9}"/><text x="${x}" y="${end - 6}" class="pw-t">5V</text></g>`;
  return `<g class="pw" data-parts="${part}"><path d="M${x} ${y}V${end}M${x - 10} ${end}H${x + 10}M${x - 6.5} ${end + 4.5}H${x + 6.5}M${x - 3} ${end + 9}H${x + 3}"/></g>`;
}

/** The slash and count on a bus. */
function slash(x: number, y: number, n: string, vertical = false, dx = 8): string {
  const p = vertical ? `M${x - 6} ${y + 6}L${x + 6} ${y - 6}` : `M${x - 6} ${y + 6}L${x + 6} ${y - 6}`;
  return `<path class="sl" d="${p}"/><text class="sl-t" x="${x + dx}" y="${y - (vertical ? 4 : 9)}">${n}</text>`;
}

function partBox(id: PartId, x: number, y: number, w: number, h: number, name: string, sub: string, nameY: number): string {
  return `<g class="part" data-part="${id}" tabindex="0" role="button">
    <rect class="hit" x="${x - 8}" y="${y - 8}" width="${w + 16}" height="${h + 16}" rx="10"/>
    <rect class="body" x="${x}" y="${y}" width="${w}" height="${h}" rx="6"/>
    <text class="nm" x="${x + w / 2}" y="${nameY}">${name}</text>
    <text class="sb" x="${x + w / 2}" y="${nameY + 18}">${sub}</text>
  </g>`;
}

function drawing(): string {
  const s = S();
  const out: string[] = [];
  // wires first (under the parts' edges)
  for (const wr of wires())
    out.push(`<path class="w ${wr.job}${wr.bus ? " bus" : ""}" data-parts="${wr.parts.join(" ")}" d="${wr.d}"${wr.arrow ? ` marker-end="url(#pcbArrow-${wr.job})"` : ""}/>`);
  // junction dots: the clock's taps, R1 on the A0 wire
  for (const id of ["U2", "U3", "U4"]) out.push(`<circle class="jn drive" data-parts="U1 U2 U3 U4 U5" cx="${SR_X[id] + 28}" cy="232" r="3.6"/>`);
  out.push(`<circle class="jn sense" data-parts="U1 U6 R1" cx="300" cy="400" r="3.6"/>`);
  // bus counts and the wires' names
  out.push(`<g class="lbls">`);
  for (const id of ["U2", "U3", "U4", "U5"]) out.push(`<g class="w-l drive" data-parts="${id} FPC2">${slash(SR_X[id] + 50, 98, "8", true)}</g>`);
  // (the two long buses: a slash and their count in words, "32 drive lines", "12 sense lines")
  out.push(`<g class="w-l drive" data-parts="U2 U3 U4 U5 FPC2">${slash(828, 78, "")}<text class="wl" x="812" y="66" text-anchor="end" data-t="wDrives">${fill(s.wDrives, { cols: COLS })}</text></g>`);
  out.push(`<g class="w-l sense" data-parts="U1 U6">${slash(262, 295, "4")}<text class="wl" x="345" y="287" data-t="wSelect">${s.wSelect}</text></g>`);
  out.push(`<g class="w-l sense" data-parts="U6 FPC1">${slash(828, 432, "")}<text class="wl" x="812" y="420" text-anchor="end" data-t="wSenses">${fill(s.wSenses, { rows: ROWS })}</text></g>`);
  out.push(`<text class="wl w-l drive" data-parts="U1 U2" x="270" y="142" data-t="wData">${s.wData}</text>`);
  out.push(`<text class="wl w-l drive" data-parts="U1 U2 U3 U4 U5" x="530" y="249" data-t="wClock">${s.wClock}</text>`);
  out.push(`<text class="wl w-l sense" data-parts="U1 U6" x="320" y="332" data-t="wEnable">${s.wEnable}</text>`);
  out.push(`<text class="wl w-l drive" data-parts="FPC2" x="947" y="118" data-t="wPad">${s.wPad}</text>`);
  out.push(`<text class="wl w-l sense" data-parts="FPC1" x="947" y="420" data-t="wPad">${s.wPad}</text>`);
  out.push(`</g>`);
  // parts
  out.push(`<g class="parts">`);
  out.push(partBox("U1", 60, 130, 130, 340, s.nano, "U1", 160).replace('class="nm"', 'class="nm" data-t="nano"'));
  // a pin's name (and its stub on the Nano) stays lit with the parts its wire joins
  const pin = (x: number, y: number, t: string, side: "r" | "l", parts: string, stub = "") =>
    `<g class="pins" data-parts="${parts}">${stub ? `<path class="stub" d="${stub}"/>` : ""}<text class="pn" x="${side === "r" ? x - 8 : x + 8}" y="${y + 4}" text-anchor="${side === "r" ? "end" : "start"}">${t}</text></g>`;
  const ALL_SR = "U1 U2 U3 U4 U5";
  for (const [t, y, parts] of [["D2", 215, "U1 U2"], ["D3", 245, ALL_SR], ["D4–D7", 295, "U1 U6"], ["D8", 340, "U1 U6"], ["A0", 400, "U1 U6 R1"]] as const)
    out.push(pin(190, y, t, "r", parts, `M190 ${y}H210`));
  for (const [t, y] of [["5V", 225], ["GND", 440]] as const) out.push(pin(60, y, t, "l", "U1", `M60 ${y}H40`));
  for (const id of ["U2", "U3", "U4", "U5"] as PartId[]) out.push(partBox(id, SR_X[id], SR_Y, SR_W, SR_H, id, "74HC595", SR_Y + 38));
  out.push(partBox("U6", 470, 330, 170, 150, "U6", "CD74HC4067", 360));
  out.push(pin(470, 405, "S0–S3", "l", "U6 U1") + pin(470, 432, "E#", "l", "U6 U1") + pin(470, 460, "COM", "l", "U6 U1 R1") + pin(640, 432, "I0–I15", "r", "U6 FPC1"));
  out.push(partBox("FPC2", 860, 50, 60, 160, "FPC2", "32", 125));
  out.push(partBox("FPC1", 860, 350, 60, 150, "FPC1", "16", 420));
  // R1: a zigzag on the A0 wire's drop to ground
  out.push(`<g class="part r1" data-part="R1" tabindex="0" role="button">
    <rect class="hit" x="282" y="410" width="80" height="72" rx="10"/>
    <path class="body zz" d="M300 418V424L291 429L309 437L291 445L309 453L291 461L309 469L300 474V480"/>
    <text class="nm sm" x="318" y="444" text-anchor="start">R1</text>
    <text class="sb" x="318" y="461" text-anchor="start">${KOHM}</text>
  </g>`);
  out.push(`</g>`);
  // power: the Nano's 5 V and ground pins, and every chip's (grey)
  out.push(power("5V", 40, 225, -1, "U1"));
  out.push(`<path class="pw-w" data-parts="U1" d="M40 225V213"/>`);
  out.push(power("GND", 40, 440, 1, "U1"));
  for (const id of ["U2", "U3", "U4", "U5"] as PartId[]) {
    out.push(power("5V", SR_X[id] + 82, SR_Y, -1, id));
    out.push(power("GND", SR_X[id] + 80, SR_Y + SR_H, 1, id));
  }
  out.push(power("5V", 615, 330, -1, "U6"));
  out.push(power("GND", 615, 480, 1, "U6"));
  out.push(power("GND", 300, 480, 1, "R1"));
  return out.join("");
}

/** The zoom buttons (− + fit), as Fig 3's view bar; in a view's footer, before its hint. */
export function zoomPill(): string {
  const s = S();
  const b = (k: "out" | "in" | "fit", key: "zoomOut" | "zoomIn" | "zoomFit", d: string) =>
    `<button type="button" data-zoom="${k}" data-t-aria="${key}" data-t-title="${key}" aria-label="${esc(s[key])}" title="${esc(s[key])}"><svg viewBox="0 0 24 24"><path d="${d}"/></svg></button>`;
  return `<div class="pcb-zoom" role="group">${b("out", "zoomOut", "M6 12h12")}${b("in", "zoomIn", "M6 12h12M12 6v12")}${b("fit", "zoomFit", "M4.5 9V4.5H9M15 4.5h4.5V9M19.5 15v4.5H15M9 19.5H4.5V15")}</div>`;
}

export interface SchView {
  el: HTMLElement;
  /** The default form: the simplified drawing, nothing chosen. */
  reset(): void;
  relabel(): void;
  layout(): void;
  /** Escape: clear the choice (true when there was one). */
  escape(): boolean;
  destroy(): void;
}

export function schView(ctx: { reducedMotion(): boolean; touch(): boolean }): SchView {
  const s = S();
  const el = document.createElement("section");
  el.className = "pcb-view pcb-sch";
  el.dataset.v = "schematic";
  el.dataset.mode = "simple";
  el.innerHTML = `
    <header class="pcb-bar">
      <p class="pcb-k" data-t="kSch">${s.kSch}</p>
      <div class="pcb-seg" role="group">
        <button type="button" data-mode="simple" aria-pressed="true" data-t="simple" data-t-aria="simpleAria" aria-label="${esc(s.simpleAria)}">${s.simple}</button>
        <button type="button" data-mode="real" aria-pressed="false" data-t="real" data-t-aria="realAria" aria-label="${esc(s.realAria)}">${s.real}</button>
      </div>
    </header>
    <div class="pcb-area">
      <div class="pcb-simple">
        <svg class="pcb-sch-svg" viewBox="18 34 964 484" preserveAspectRatio="xMidYMid meet" role="group" focusable="false">
          <defs>${(["drive", "sense"] as const)
            .map((j) => `<marker id="pcbArrow-${j}" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="11" markerHeight="11" orient="auto" markerUnits="userSpaceOnUse"><path class="ah ${j}" d="M0 1.2 9 5 0 8.8z"/></marker>`)
            .join("")}</defs>
          ${drawing()}
        </svg>
      </div>
      <div class="pcb-real" hidden>
        <div class="pcb-sheet"><p class="pcb-load mono" data-t="loading">${s.loading}</p></div>
      </div>
    </div>
    <p class="pcb-info" aria-live="polite"></p>
    <footer class="pcb-foot">
      ${zoomPill()}
      <p class="pcb-hint"></p>
      <p class="pcb-read"></p>
    </footer>`;
  const simple = el.querySelector<HTMLElement>(".pcb-simple")!;
  const svg = el.querySelector<SVGSVGElement>(".pcb-sch-svg")!;
  const real = el.querySelector<HTMLElement>(".pcb-real")!;
  const sheet = el.querySelector<HTMLElement>(".pcb-sheet")!;
  const info = el.querySelector<HTMLElement>(".pcb-info")!;
  const hint = el.querySelector<HTMLElement>(".pcb-hint")!;
  const read = el.querySelector<HTMLElement>(".pcb-read")!;
  const partEls = [...svg.querySelectorAll<SVGGElement>(".part")];
  const linked = [...svg.querySelectorAll<SVGElement>("[data-parts]")];

  let mode: "simple" | "real" = "simple";
  let picked: PartId | null = null;
  let hover: PartId | null = null;

  // ---- choosing a part
  const paintPick = () => {
    const p = picked ?? hover;
    svg.toggleAttribute("data-pick", Boolean(picked));
    svg.toggleAttribute("data-hover", Boolean(!picked && hover));
    // the parts at the other ends of its wires stay in full colour too
    const near = new Set<string>();
    for (const n of linked) {
      const parts = (n.dataset.parts ?? "").split(" ");
      const on = Boolean(p && parts.includes(p));
      n.classList.toggle("is-on", on);
      if (on && n.classList.contains("w")) for (const q of parts) near.add(q);
    }
    for (const g of partEls) {
      const id = g.dataset.part!;
      g.classList.toggle("is-picked", id === picked);
      g.classList.toggle("is-hover", id === hover && id !== picked);
      g.classList.toggle("is-near", Boolean(p) && id !== p && near.has(id));
      g.setAttribute("aria-pressed", String(id === picked));
    }
    paintInfo();
  };
  /** The line under the drawing: the chosen part, in a sentence that names it (simplified), or how to read the real
   *  page (name tags, and R1's mistaken label, which a ring marks). */
  const paintInfo = () => {
    const s = S();
    if (mode === "real") {
      info.innerHTML = `<span class="pcb-info-s">${fill(s.realNote, { kohm: KOHM })}</span>`;
      return;
    }
    const w = picked ? partWords(picked) : null;
    info.innerHTML = w
      ? `<span class="pcb-info-ico">${icon(ICON[picked!])}</span><span class="pcb-info-s">${w.text}</span>`
      : `<span class="pcb-info-s is-muted">${s.pickNone}</span>`;
  };
  const pick = (id: PartId | null) => {
    picked = picked === id ? null : id;
    paintPick();
  };
  svg.addEventListener("click", (e) => {
    const g = (e.target as Element).closest<SVGGElement>(".part");
    pick(g ? (g.dataset.part as PartId) : null);
  });
  svg.addEventListener("keydown", (e) => {
    const g = (e.target as Element).closest<SVGGElement>(".part");
    if (g && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      pick(g.dataset.part as PartId);
    }
  });
  svg.addEventListener("pointerover", (e) => {
    if ((e as PointerEvent).pointerType === "touch") return;
    const g = (e.target as Element).closest<SVGGElement>(".part");
    const id = g ? (g.dataset.part as PartId) : null;
    if (id !== hover) {
      hover = id;
      paintPick();
    }
  });
  svg.addEventListener("pointerleave", () => {
    if (hover) {
      hover = null;
      paintPick();
    }
  });

  // ---- the real page: loaded the first time it is asked for
  let pz: PanZoom | null = null;
  let page: SVGSVGElement | null = null;
  let loading: Promise<void> | null = null;
  // R1 and its "20k" on the page (sheet units: the resistor at x 95-105, its label's glyphs at x 107-122, baselines
  // 164.8 and 173.8, 9 pt type)
  const RING = { x: 90.5, y: 148.5, w: 36, h: 31 };
  // where the page eases in after it opens (sheet units): U5 with its SC25-SC32 tags (x 690-835) and FPC2's tags and
  // pin numbers for those lines (x 963-1020), down to the chips' ground symbols
  const TAGS = { x: 684, y: 506, w: 392, h: 200 };
  /** The page has not been shown since the step opened: the next time it is, it opens whole, then eases in on TAGS. */
  let fresh = true;
  let freshTimer = 0;
  const loadReal = () => {
    loading ??= fetch(`${BASE}${PAGE.src}`)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.text();
      })
      .then((txt) => {
        const doc = new DOMParser().parseFromString(txt, PAGE.mime);
        const root = doc.documentElement;
        if (root.nodeName !== "svg") throw new Error("not an svg");
        page = document.importNode(root, true) as unknown as SVGSVGElement;
        page.classList.add("pcb-page");
        page.setAttribute("role", "img");
        page.setAttribute("tabindex", "0");
        page.setAttribute("preserveAspectRatio", "xMidYMid meet");
        // the sheet, under the drawing (the page itself has no background: each theme paints it)
        const bg = document.createElementNS(NS, "rect");
        bg.setAttribute("class", "pcb-paper");
        bg.setAttribute("width", "1169");
        bg.setAttribute("height", "826.8");
        page.insertBefore(bg, page.firstChild?.nextSibling ?? null);
        const ring = document.createElementNS(NS, "rect");
        ring.setAttribute("class", "pcb-ring");
        for (const [k, v] of Object.entries({ x: RING.x, y: RING.y, width: RING.w, height: RING.h, rx: 6 })) ring.setAttribute(k, String(v));
        page.append(ring);
        sheet.replaceChildren(page);
        pz = panZoom(page, { x: 0, y: 0, w: 1169, h: 826.8 }, { pad: 10, max: 10, reduced: ctx.reducedMotion });
        relabel();
      })
      .catch(() => {
        sheet.innerHTML = `<p class="pcb-load mono">${S().failed}</p>`;
      });
    return loading;
  };
  el.querySelector(".pcb-zoom")!.addEventListener("click", (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>("[data-zoom]");
    if (!b || !pz) return;
    if (b.dataset.zoom === "in") pz.zoomBy(1.5);
    else if (b.dataset.zoom === "out") pz.zoomBy(1 / 1.5);
    else pz.fit();
  });

  const setMode = (m: "simple" | "real") => {
    mode = m;
    el.dataset.mode = m;
    simple.hidden = m !== "simple";
    real.hidden = m !== "real";
    for (const b of el.querySelectorAll<HTMLButtonElement>("[data-mode]")) b.setAttribute("aria-pressed", String(b.dataset.mode === m));
    clearTimeout(freshTimer);
    if (m === "real")
      void loadReal().then(() => {
        if (!pz || mode !== "real") return;
        pz.resize();
        if (!fresh) return;
        fresh = false;
        // the whole page first, then in on the name tags (at once under reduced motion)
        pz.fit(true);
        if (ctx.reducedMotion()) pz.show(TAGS, true);
        else freshTimer = window.setTimeout(() => mode === "real" && pz?.show(TAGS), 450);
      });
    paintCorners();
    paintInfo();
  };
  el.querySelector(".pcb-seg")!.addEventListener("click", (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>("[data-mode]");
    if (b) setMode(b.dataset.mode as "simple" | "real");
  });

  const paintCorners = () => {
    const w = S();
    const touch = ctx.touch();
    hint.textContent = mode === "simple" ? (touch ? w.hintSchTouch : w.hintSch) : touch ? w.realHintTouch : w.realHint;
    read.innerHTML =
      mode === "simple"
        ? `<span class="lg drive"><i></i>${w.legDrive}</span><span class="lg sense"><i></i>${w.legSense}</span><span class="lg power"><i></i>${w.legPower}</span>`
        : esc(w.realRead);
  };
  const relabel = () => {
    const w = S();
    const names = PARTS.map((p) => partWords(p).title).join(", ");
    svg.setAttribute("aria-label", fill(w.schAria, { parts: names }));
    for (const g of partEls) g.setAttribute("aria-label", fill(w.partAria, { title: partWords(g.dataset.part as PartId).title }));
    if (page) page.setAttribute("aria-label", w.pageAria);
    paintCorners();
    paintPick();
  };

  relabel();
  return {
    el,
    reset() {
      picked = null;
      hover = null;
      fresh = true;
      setMode("simple");
      pz?.fit(true);
      paintPick();
    },
    relabel,
    layout() {
      pz?.resize();
    },
    escape() {
      if (!picked) return false;
      picked = null;
      paintPick();
      return true;
    },
    destroy() {
      clearTimeout(freshTimer);
      pz?.destroy();
    },
  };
}
