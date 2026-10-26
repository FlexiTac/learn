// adc-ladder (lesson 6): a voltage landing on the ADC's 1024-rung ladder, and the >> 2 that turns the rung
// number into a byte. Left: the whole 0-5 V ruler and a magnifier of the rungs around the voltage (four rungs = one
// byte). Right: the arithmetic and the bits. Follows Fig 2's readout by default; the slider tries any voltage.
import { VCC } from "@shared/data/constants.mjs";
import { BITS, MAX_CODE, STEPS, adcCode, toByte } from "@shared/models/adc.mjs";
import { vA0 } from "@shared/models/divider.mjs";
import { R_REST } from "@shared/models/taxel.mjs";
import { volts } from "../lessons/_crossing";
import type { WidgetCtx, WidgetInstance } from "../types";
import { h } from "../ui/dom";
import "./adc-ladder.css";

const MAX_BYTE = toByte(MAX_CODE);
const STEP_MV = (VCC / STEPS) * 1000;
const MV = Math.round(VCC * 1000);

export function mount(el: HTMLElement, ctx: WidgetCtx): WidgetInstance {
  const root = h("div", { class: "w-adc" });
  root.innerHTML = `<div class="w-adc-in">
    <span class="w-kicker w-adc-kick">ADC · ${STEPS}-rung ladder</span>
    ${ctx.figure ? '<button type="button" class="w-adc-follow mono" aria-pressed="true">following the figure</button>' : ""}
    <div class="w-adc-main">
      <div class="w-adc-plot"><svg class="w-adc-svg" role="img"></svg></div>
      <div class="w-adc-read mono">
        <p class="w-adc-calc"></p>
        <div class="w-adc-bits" data-row="raw" aria-hidden="true"></div>
        <p class="w-adc-shift"><span>&gt;&gt; 2</span> drop the last two bits (÷ 4)</p>
        <div class="w-adc-bits" data-row="byte" aria-hidden="true"></div>
      </div>
    </div>
    <div class="w-adc-slider">
      <label for="w-adc-range">Try any voltage</label>
      <button type="button" class="btn-ghost w-adc-nudge mono" data-d="-1" aria-label="One rung down">−1</button>
      <input id="w-adc-range" type="range" min="0" max="${MV}" step="1">
      <button type="button" class="btn-ghost w-adc-nudge mono" data-d="1" aria-label="One rung up">+1</button>
    </div>
  </div>`;
  el.append(root);

  const $ = <T extends Element>(s: string) => root.querySelector<T>(s)!;
  const svg = $<SVGSVGElement>("svg");
  const plot = $<HTMLElement>(".w-adc-plot");
  const range = $<HTMLInputElement>("input");
  const follow = root.querySelector<HTMLButtonElement>(".w-adc-follow");
  const calc = $<HTMLElement>(".w-adc-calc");
  const rawRow = $<HTMLElement>('[data-row="raw"]');
  const byteRow = $<HTMLElement>('[data-row="byte"]');

  let v = vA0(R_REST);
  let code = adcCode(v);
  let following = Boolean(ctx.figure);

  const cells = (n: number, width: number, drop: number) =>
    n
      .toString(2)
      .padStart(width, "0")
      .split("")
      .map((b, i) => `<span class="${i >= width - drop ? "is-drop" : ""}">${b}</span>`)
      .join("");

  function paintText() {
    const exact = (v * STEPS) / VCC;
    const byte = toByte(code);
    calc.innerHTML = `V<sub>A0</sub> <b>${volts(v, 3)}</b> × ${STEPS} ÷ ${VCC} = ${exact.toFixed(1)} → rung <b>${code}</b>`;
    rawRow.innerHTML = `${cells(code, BITS, 2)}<em>rung ${code}</em>`;
    byteRow.innerHTML = `${cells(byte, 8, 0)}<span class="is-gone"></span><span class="is-gone"></span><em>byte <b>${byte}</b> <small>of 0–${MAX_BYTE}</small></em>`;
    const mv = Math.round(v * 1000);
    if (Number(range.value) !== mv) range.value = String(mv);
    range.setAttribute("aria-valuetext", `${volts(v, 3)}, ADC ${code}, byte ${byte}`);
    svg.setAttribute("aria-label", `${volts(v, 3)} lands on rung ${code} of ${MAX_CODE}; rungs ${code & ~3} to ${(code & ~3) + 3} all become byte ${byte}.`);
  }

  // ---- the ladder, drawn at the plot's real pixel size so text stays crisp at any width
  function paintSvg() {
    const W = Math.max(160, plot.clientWidth);
    const H = Math.max(120, plot.clientHeight);
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("width", String(W));
    svg.setAttribute("height", String(H));
    const top = 16;
    const bot = H - 8;
    const n = H - top - 8 >= 190 ? 12 : 8; // rungs shown in the magnifier (a multiple of 4)
    const byte = toByte(code);
    // first rung shown: whole byte groups, with the current byte in the middle (12 rungs) or in its pair (8)
    const s0 = Math.min(STEPS - n, Math.max(0, byte * 4 - (n === 12 ? 4 : (byte % 2) * 4)));
    const rung = (bot - top) / n;
    // ruler (whole range)
    const rx = 34;
    const rw = 10;
    const yV = (volt: number) => bot - (volt / VCC) * (bot - top);
    const mx = Math.round(W * 0.34) + 18; // magnifier left
    const mw = Math.max(54, W - mx - 64);
    const parts: string[] = [];
    parts.push(`<text x="${mx}" y="${top - 5}" class="lab">rungs · ${STEP_MV.toFixed(2)} mV each</text><text x="${mx + mw + 35}" y="${top - 5}" class="lab">byte</text>`);
    parts.push(`<rect x="${rx}" y="${top}" width="${rw}" height="${bot - top}" rx="3" class="ruler"/>`);
    for (let k = 0; k <= VCC; k++) {
      const y = yV(k);
      parts.push(`<line x1="${rx - 4}" x2="${rx}" y1="${y}" y2="${y}" class="tick"/><text x="${rx - 7}" y="${y + 3.5}" text-anchor="end" class="lab">${k} V</text>`);
    }
    const yv = yV(v);
    parts.push(`<line x1="${rx - 2}" x2="${rx + rw + 2}" y1="${yv}" y2="${yv}" class="vline"/>`);
    // zoom wedge from the ruler mark to the magnifier
    parts.push(`<path d="M${rx + rw + 2} ${yv - 2} L${mx} ${top} M${rx + rw + 2} ${yv + 2} L${mx} ${bot}" class="wedge"/>`);
    // rungs
    for (let i = 0; i < n; i++) {
      const c = s0 + i;
      const y = bot - (i + 1) * rung;
      const odd = (c >> 2) % 2 === 1;
      const on = c === code;
      parts.push(`<rect x="${mx}" y="${y + 1}" width="${mw}" height="${rung - 2}" rx="2" class="rung${odd ? " odd" : ""}${on ? " on" : ""}"/>`);
      parts.push(`<text x="${mx + mw + 6}" y="${y + rung / 2 + 3.5}" class="num${on ? " on" : ""}">${c}</text>`);
    }
    // byte brackets: one per group of four rungs
    for (let g = 0; g < n / 4; g++) {
      const b = (s0 >> 2) + g;
      const y1 = bot - g * 4 * rung - 3;
      const y0 = bot - (g + 1) * 4 * rung + 3;
      const bx = mx + mw + 38;
      const on = b === byte;
      parts.push(`<path d="M${bx - 3} ${y0} H${bx} V${y1} H${bx - 3}" class="brk${on ? " on" : ""}"/>`);
      parts.push(`<text x="${bx + 4}" y="${(y0 + y1) / 2 + 3.5}" class="num${on ? " on" : ""}">${b}</text>`);
    }
    // where the voltage lands inside the magnifier
    const pos = (v * STEPS) / VCC - s0;
    const yl = Math.min(bot, Math.max(top, bot - pos * rung));
    parts.push(`<line x1="${mx - 4}" x2="${mx + mw + 2}" y1="${yl}" y2="${yl}" class="vline"/>`);
    parts.push(`<text x="${mx + 4}" y="${yl - 4 < top + 8 ? yl + 11 : yl - 4}" class="vlab">${volts(v, 3)}</text>`);
    svg.innerHTML = parts.join("");
  }

  const paint = () => {
    paintText();
    paintSvg();
  };

  const setFollowing = (on: boolean) => {
    following = on && Boolean(ctx.figure);
    if (follow) {
      follow.setAttribute("aria-pressed", String(following));
      follow.textContent = following ? "following the figure" : "follow the figure";
    }
    if (following) {
      const s = ctx.figure?.lastState;
      if (s) fromState(s);
      ctx.figure?.refresh();
    }
  };
  const fromState = (s: Record<string, unknown>) => {
    const sv = Number(s.vA0);
    if (!Number.isFinite(sv)) return;
    v = sv;
    code = typeof s.adc === "number" ? s.adc : adcCode(v);
    paint();
  };
  const setV = (volt: number) => {
    v = Math.min(VCC, Math.max(0, volt));
    code = adcCode(v);
    paint();
  };

  range.addEventListener("input", () => {
    setFollowing(false);
    setV(Number(range.value) / 1000);
  });
  for (const b of root.querySelectorAll<HTMLButtonElement>(".w-adc-nudge"))
    b.addEventListener("click", () => {
      setFollowing(false);
      // one rung = the middle of the next code's voltage bin
      const c = Math.min(MAX_CODE, Math.max(0, code + Number(b.dataset.d)));
      setV(((c + 0.5) * VCC) / STEPS);
    });
  follow?.addEventListener("click", () => setFollowing(!following));

  const offState = ctx.figure?.onState((s) => following && fromState(s)) ?? (() => {});
  const ro = new ResizeObserver(() => paintSvg());
  ro.observe(plot);
  paint();
  if (following && ctx.figure?.lastState) fromState(ctx.figure.lastState);

  return {
    destroy() {
      ro.disconnect();
      offState();
      root.remove();
    },
    run() {
      setFollowing(true);
    },
  };
}
