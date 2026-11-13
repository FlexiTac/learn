// The circuit diagram in the side panel of Lesson 2.2's workbench (src/widgets/build-bench.ts): lesson 2.1's circuit as
// a small schematic, the Nano as a block with its 5V, A0 (or the pin the sketch reads) and GND pins, the FSR from 5V to
// A0, R1 (the 10 kΩ pull-down) from A0 to GND, and a ground symbol. It is cut into four links: 5V–FSR, FSR–A0, A0–R1
// and R1–GND. A link the learner's build makes is drawn solid in its jumper wire's colour (5V red, A0 yellow, GND ink);
// one it does not make is grey and dashed. Each link is judged on the engine's nets (../build/netlist.ts), and a part
// turned either way counts, but each leg makes one link at most, so a bypassed part never makes both. Pointing at a
// made link reports the holes of its net, for the bench to light up. Words in English and Chinese
// (docs/i18n-terms-zh.md: 下拉电阻, 力传感器, 原理图).
import { strings } from "../../i18n";
import { netlist, type Build, type HoleId, type Net } from "../build/engine";
import "./schematic.css";

export interface Schematic {
  /** what to append */
  el: HTMLElement;
  /** draw the build's links; `pin` is the analog pin the learner's sketch reads ("A0" when not given) */
  paint(build: Build, pin?: string): void;
  /** paint the words again after a language switch */
  relabel(): void;
  destroy(): void;
}

export type LinkId = "v5" | "fsr" | "res" | "gnd";
const LINKS: readonly LinkId[] = ["v5", "fsr", "res", "gnd"];
/** Each link's net when the build makes it, else null. */
export type Links = Record<LinkId, Net | null>;

const S = strings(
  {
    nano: "Arduino Nano",
    fsr: "force sensor",
    res: "pull-down",
    aria: "Circuit diagram: 5V runs through the force sensor (FSR) to {pin}, and {pin} runs through R1, the 10 kΩ pull-down resistor, to GND. {status}",
    all: "All four connections are made.",
    none: "None of the four connections is made yet.",
    one: "1 of the four connections is made.",
    some: "{n} of the four connections are made.",
  },
  {
    nano: "Arduino Nano",
    fsr: "力传感器",
    res: "下拉电阻",
    aria: "原理图：5V 经过力传感器（FSR）接到 {pin}，{pin} 再经过 R1（10 kΩ 下拉电阻）接到 GND。{status}",
    all: "4 处连接都接好了。",
    none: "4 处连接还都没有接好。",
    one: "4 处连接接好了 1 处。",
    some: "4 处连接接好了 {n} 处。",
  },
);

/** A two-legged part (either way round) between two nets: which ends its legs reach, each leg used once, so a part
 *  with both legs on one net reaches one end at most. */
function across(a: Net | null, b: Net | null, top: Net | null, bottom: Net | null): [boolean, boolean] {
  if (!a || !b) return [false, false];
  const on = (x: Net, n: Net | null) => n !== null && x === n;
  if (a === b) return on(a, top) ? [true, false] : [false, on(a, bottom)];
  const straight: [boolean, boolean] = [on(a, top), on(b, bottom)];
  const turned: [boolean, boolean] = [on(b, top), on(a, bottom)];
  const count = (m: [boolean, boolean]) => Number(m[0]) + Number(m[1]);
  return count(turned) > count(straight) ? turned : straight;
}

/** Which of the four links a build makes, each with its net (5V–FSR: the 5V net; FSR–A0 and A0–R1: the pin's net;
 *  R1–GND: the GND net). Nothing counts without the Nano. */
export function linksOf(b: Build, pin = "A0"): Links {
  const none: Links = { v5: null, fsr: null, res: null, gnd: null };
  if (!b.nano) return none;
  const nl = netlist(b);
  const v5 = nl.netOf("5V");
  const sig = nl.netOf(pin);
  const gnd = nl.netOf("GND");
  const [f5, fSig] = b.fsr ? across(nl.netOf("fsr:1"), nl.netOf("fsr:2"), v5, sig) : [false, false];
  const [rSig, rGnd] = b.resistor ? across(nl.netOf("resistor:1"), nl.netOf("resistor:2"), sig, gnd) : [false, false];
  return { v5: f5 ? v5 : null, fsr: fSig ? sig : null, res: rSig ? sig : null, gnd: rGnd ? gnd : null };
}

// ---- the drawing, in viewBox units (W x H): the Nano's block from x = NX, NW wide, its pins' ends at x = XP, the
// divider's column at x = XC
const W = 204;
const H = 146;
const NX = 4;
const NW = 54;
const XP = NX + NW + 6;
const XC = 118;
const Y5 = 36;
const YS = 80;
const YG = 124;
/** a zigzag resistor from (XC, y) down 32 units, six peaks (lesson 2.1's symbol) */
const zig = (y: number) => `M${XC} ${y}l-7 2.67 14 5.33-14 5.33 14 5.34-14 5.33 14 5.33L${XC} ${y + 32}`;
const FSR_Y = Y5 + 6;
const RES_Y = YS + 6;
// each link runs from its Nano pin to its part's lead, so the two A0 links share the pin's line
const LINK_D: Record<LinkId, string> = {
  v5: `M${XP} ${Y5}H${XC}V${FSR_Y}`,
  fsr: `M${XP} ${YS}H${XC}V${FSR_Y + 32}`,
  res: `M${XP} ${YS}H${XC}V${RES_Y}`,
  gnd: `M${XP} ${YG}H${XC}V${RES_Y + 32}`,
};
const GROUND = `M${XC} ${YG}V${YG + 6}M${XC - 12} ${YG + 6}H${XC + 12}M${XC - 7.5} ${YG + 11.5}H${XC + 7.5}M${XC - 3} ${YG + 17}H${XC + 3}`;
const FSR_ARROW = `M${XC - 16} ${FSR_Y + 26}L${XC + 16} ${FSR_Y + 6}M${XC + 10.6} ${FSR_Y + 5.6}L${XC + 16} ${FSR_Y + 6}l-2.2 4.8`;
const XL = XC + 20; // the parts' labels

const link = (id: LinkId) => `<g class="bb-sc-link" data-link="${id}">
      <path class="bb-sc-halo" d="${LINK_D[id]}"/>
      <path class="bb-sc-line" d="${LINK_D[id]}"/>${id === "gnd" ? `<path class="bb-sc-ground" d="${GROUND}"/>` : ""}
      <path class="bb-sc-hit" d="${LINK_D[id]}"/>
    </g>`;

const NR = NX + NW; // the block's right edge
const SVG = `<svg class="bb-sc-svg" viewBox="0 0 ${W} ${H}" role="img">
    <g class="bb-sc-nano">
      <text class="bb-sc-title" x="${NX}" y="11" data-w="nano"></text>
      <rect class="bb-sc-block" x="${NX}" y="18" width="${NW}" height="124" rx="4"/>
      <path class="bb-sc-stub" d="M${NR} ${Y5}H${XP}M${NR} ${YS}H${XP}M${NR} ${YG}H${XP}"/>
      <text class="bb-sc-pin" x="${NR - 6}" y="${Y5 + 3.5}">5V</text>
      <text class="bb-sc-pin" x="${NR - 6}" y="${YS + 3.5}" data-pin></text>
      <text class="bb-sc-pin" x="${NR - 6}" y="${YG + 3.5}">GND</text>
    </g>
    <g class="bb-sc-links">${LINKS.map(link).join("")}</g>
    <g class="bb-sc-part" data-part="fsr"><path d="${zig(FSR_Y)}"/><path d="${FSR_ARROW}"/></g>
    <g class="bb-sc-part" data-part="resistor"><path d="${zig(RES_Y)}"/></g>
    <circle class="bb-sc-dot" data-dot="sig" cx="${XC}" cy="${YS}" r="2.6"/>
    <circle class="bb-sc-dot" data-dot="gnd" cx="${XC}" cy="${YG}" r="2.6"/>
    <text class="bb-sc-mono" x="${XC + 7}" y="${YS + 3.5}" data-pin></text>
    <text class="bb-sc-mono" x="${XL}" y="${FSR_Y + 15}">FSR</text>
    <text class="bb-sc-sub" x="${XL}" y="${FSR_Y + 26}" data-w="fsr"></text>
    <text class="bb-sc-mono" x="${XL}" y="${RES_Y + 13}">R1 10 kΩ</text>
    <text class="bb-sc-sub" x="${XL}" y="${RES_Y + 24}" data-w="res"></text>
  </svg>`;

export function schematic(opts: { onHover?: (holes: HoleId[] | null) => void } = {}): Schematic {
  const el = document.createElement("div");
  el.className = "bb-schem";
  el.innerHTML = `${SVG}<p class="bb-sc-note"></p>`;
  const svg = el.querySelector("svg") as SVGSVGElement;
  const note = el.querySelector(".bb-sc-note") as HTMLElement;
  const layer = svg.querySelector(".bb-sc-links") as SVGGElement;
  const groups = Object.fromEntries(LINKS.map((id) => [id, svg.querySelector(`[data-link="${id}"]`) as SVGGElement])) as Record<LinkId, SVGGElement>;
  const q = (sel: string) => svg.querySelector(sel) as SVGElement;

  let pin = "A0";
  let links: Links = { v5: null, fsr: null, res: null, gnd: null };
  let hovered: LinkId | null = null;
  let lit = ""; // the holes last reported, joined

  const report = (holes: HoleId[] | null) => {
    const key = holes ? holes.join(" ") : "";
    if (key === lit) return;
    lit = key;
    opts.onHover?.(holes);
  };
  const hover = (id: LinkId | null) => {
    if (hovered) groups[hovered].classList.remove("is-hover");
    hovered = id && links[id] ? id : null;
    if (hovered) groups[hovered].classList.add("is-hover");
    report(hovered ? (links[hovered] as Net).holes : null);
  };
  const onOver = (e: PointerEvent) => {
    const g = (e.target as Element).closest?.("[data-link]") as SVGGElement | null;
    const id = (g?.dataset.link as LinkId | undefined) ?? null;
    if (id !== hovered) hover(id);
  };
  const onLeave = () => hover(null);
  svg.addEventListener("pointerover", onOver);
  svg.addEventListener("pointerleave", onLeave);

  const made = () => LINKS.filter((id) => links[id]).length;
  const status = () => {
    const n = made();
    const s = S();
    return n === 4 ? s.all : n === 0 ? s.none : n === 1 ? s.one : s.some.replace("{n}", String(n));
  };
  const relabel = () => {
    const s = S();
    for (const t of svg.querySelectorAll<SVGTextElement>("[data-w]")) t.textContent = s[t.dataset.w as "nano" | "fsr" | "res"];
    for (const t of svg.querySelectorAll<SVGTextElement>("[data-pin]")) t.textContent = pin;
    const st = status();
    note.textContent = st;
    svg.setAttribute("aria-label", s.aria.replace(/\{pin\}/g, pin).replace("{status}", st));
  };

  const paint = (b: Build, p = "A0") => {
    pin = p;
    links = linksOf(b, pin);
    for (const id of LINKS) groups[id].classList.toggle("is-on", links[id] !== null);
    // the made links over the dashed ones (the two A0 links share the pin's line)
    for (const id of [...LINKS.filter((i) => !links[i]), ...LINKS.filter((i) => links[i])]) layer.append(groups[id]);
    q(".bb-sc-nano").classList.toggle("is-off", !b.nano);
    q('[data-part="fsr"]').classList.toggle("is-off", !b.fsr);
    q('[data-part="resistor"]').classList.toggle("is-off", !b.resistor);
    q('[data-dot="sig"]').classList.toggle("is-on", Boolean(links.fsr || links.res));
    q('[data-dot="gnd"]').classList.toggle("is-on", Boolean(links.gnd));
    el.classList.toggle("is-done", made() === 4);
    relabel();
    // a link under the pointer: its net may have grown, or the link may be gone
    if (hovered) hover(hovered);
  };

  paint({ nano: null, fsr: null, resistor: null, wires: [], usb: false });

  return {
    el,
    paint,
    relabel,
    destroy() {
      svg.removeEventListener("pointerover", onOver);
      svg.removeEventListener("pointerleave", onLeave);
      if (lit) opts.onHover?.(null);
      el.remove();
    },
  };
}
