// divider-calc (lesson 5): a log-scale slider for the taxel's resistance -> the 5 V split between taxel and R1,
// V_A0, ADC code and byte, all from @shared/models (taxel: ILLUSTRATIVE, divider: first-order, adc).
// Moving the slider presses the Fig 2 plunger (act "press", or "release" at the untouched end); when the figure
// moves on its own (guided steps, the reader holding the plunger, the idle tour) the widget follows it.
import { R1, VCC } from "@shared/data/constants.mjs";
import { MAX_CODE, adcCode, toByte } from "@shared/models/adc.mjs";
import { divider } from "@shared/models/divider.mjs";
import { ILLUSTRATIVE, R_HARD, R_REST, pressFromR } from "@shared/models/taxel.mjs";
import { kOhm, milliamps, volts } from "../lessons/_crossing";
import type { WidgetCtx, WidgetInstance } from "../types";
import { h } from "../ui/dom";
import "./divider-calc.css";

const SPAN = 1000; // slider resolution
const LN = Math.log(R_HARD / R_REST); // negative
const MAX_BYTE = toByte(MAX_CODE);
const toR = (x: number) => R_REST * Math.exp((LN * x) / SPAN);
const toX = (r: number) => Math.min(SPAN, Math.max(0, (Math.log(r / R_REST) / LN) * SPAN));
const SEND_MS = 110; // throttle for figure acts while dragging
const PENDING_MS = 2600; // after our own act, ignore figure states until it settles there (or this long)

export function mount(el: HTMLElement, ctx: WidgetCtx): WidgetInstance {
  const root = h("div", { class: "w-div" });
  root.innerHTML = `<div class="w-div-in">
    <div class="w-div-head">
      <span class="w-kicker">Voltage divider · live</span>
      ${ILLUSTRATIVE ? '<span class="badge badge-illustrative" title="No force data exists: taxel resistances are illustrative">illustrative</span>' : ""}
      <span class="w-div-sync mono" aria-live="off"></span>
    </div>
    <div class="w-div-main">
      <div class="w-div-split" aria-hidden="true">
        <span class="w-div-rail mono">${VCC} V</span>
        <div class="w-div-bar">
          <div class="w-div-seg is-taxel"></div>
          <div class="w-div-seg is-r1"></div>
          <span class="w-div-a0 mono">A0</span>
        </div>
        <span class="w-div-rail mono">0 V</span>
      </div>
      <dl class="w-div-read mono">
        <div><dt>R<sub>taxel</sub></dt><dd data-k="r"></dd></div>
        <div><dt>Current</dt><dd data-k="i"></dd></div>
        <div><dt><i class="sw is-taxel"></i>Across taxel + mux</dt><dd data-k="vt"></dd></div>
        <div class="is-key"><dt><i class="sw is-r1"></i>Across R1 = V<sub>A0</sub></dt><dd data-k="va"></dd></div>
        <div><dt>ADC · byte</dt><dd data-k="code"></dd></div>
        <div class="w-div-meter" role="img"><span class="w-div-meter-fill"></span></div>
      </dl>
    </div>
    <div class="w-div-slider">
      <label class="w-div-lab" for="w-div-range">Taxel resistance <span>(log scale)</span></label>
      <input id="w-div-range" type="range" min="0" max="${SPAN}" step="1" value="0">
      <div class="w-div-ends mono" aria-hidden="true"><span><span class="w-div-word">untouched · </span>${kOhm(R_REST)}</span><span>R1 = ${kOhm(R1)}</span><span><span class="w-div-word">hard · </span>${kOhm(R_HARD)}</span></div>
    </div>
  </div>`;
  el.append(root);

  const $ = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const range = $<HTMLInputElement>("input");
  const segT = $(".w-div-seg.is-taxel");
  const segR = $(".w-div-seg.is-r1");
  const a0 = $(".w-div-a0");
  const meter = $(".w-div-meter");
  const meterFill = $(".w-div-meter-fill");
  const sync = $(".w-div-sync");
  const dd = (k: string) => $(`[data-k="${k}"]`);
  // where R1 sits on the slider (a tick under the track)
  root.style.setProperty("--r1-at", `${(toX(R1) / SPAN) * 100}%`);

  let r = R_REST;
  let dragging = false;
  let pendingUntil = 0;
  let sendTimer = 0;
  let lastSent = 0;

  function paint() {
    const d = divider(r);
    const code = adcCode(d.vA0);
    const byte = toByte(code);
    const vT = d.vTaxel + d.vOn;
    segT.style.flexGrow = String(vT);
    segR.style.flexGrow = String(d.vA0);
    a0.style.bottom = `${Math.min(92, Math.max(8, (d.vA0 / VCC) * 100))}%`;
    dd("r").innerHTML = `${kOhm(r)} <small>press ≈ ${pressFromR(r).toFixed(2)}</small>`;
    dd("i").textContent = milliamps(d.current);
    dd("vt").textContent = volts(vT);
    dd("va").textContent = volts(d.vA0);
    dd("code").innerHTML = `${code}<small>/${MAX_CODE}</small> · ${byte}<small>/${MAX_BYTE}</small>`;
    meterFill.style.width = `${(byte / MAX_BYTE) * 100}%`;
    meter.setAttribute("aria-label", `Byte ${byte} of ${MAX_BYTE}`);
    const x = Math.round(toX(r));
    if (Number(range.value) !== x) range.value = String(x);
    range.setAttribute("aria-valuetext", `${kOhm(r)}, V at A0 ${volts(d.vA0)}, byte ${byte}`);
  }

  // ---- widget -> figure
  const sendFigure = () => {
    lastSent = performance.now();
    pendingUntil = lastSent + PENDING_MS;
    const fig = ctx.figure;
    if (!fig) return;
    if (r >= R_REST * 0.999) fig.act("release");
    else fig.act("press", +pressFromR(r).toFixed(4));
  };
  const queueSend = () => {
    pendingUntil = performance.now() + PENDING_MS;
    clearTimeout(sendTimer);
    const wait = SEND_MS - (performance.now() - lastSent);
    if (wait <= 0) sendFigure();
    else sendTimer = window.setTimeout(sendFigure, wait);
  };
  const setFromUser = (x: number) => {
    r = toR(x);
    sync.textContent = ctx.figure ? "figure follows" : "";
    paint();
    queueSend();
  };
  range.addEventListener("input", () => setFromUser(Number(range.value)));
  range.addEventListener("pointerdown", () => (dragging = true));
  const up = () => (dragging = false);
  range.addEventListener("pointerup", up);
  range.addEventListener("pointercancel", up);
  range.addEventListener("blur", up);

  // ---- figure -> widget
  const offState =
    ctx.figure?.onState((s) => {
      const rt = Number(s.rTaxel);
      if (!(rt > 0) || dragging) return;
      const settled = s.depth === s.goal;
      if (pendingUntil > performance.now()) {
        // our own act is still travelling: skip states until the figure has settled where we asked
        if (settled && Math.abs(Math.log(rt / r)) < 0.03) pendingUntil = 0;
        return;
      }
      if (Math.abs(Math.log(rt / r)) < 1e-4) return;
      r = rt;
      sync.textContent = "following the figure";
      paint();
    }) ?? (() => {});

  paint();
  sync.textContent = ctx.figure ? "following the figure" : "";

  return {
    destroy() {
      clearTimeout(sendTimer);
      offState();
      root.remove();
    },
    run(p) {
      if (typeof p.rk !== "number" || !Number.isFinite(p.rk)) return;
      const want = p.rk * 1000;
      r = Math.min(R_REST, Math.max(R_HARD, want));
      paint();
      clearTimeout(sendTimer);
      sendFigure();
      const clamped = Math.abs(Math.log(r / want)) > 1e-6;
      return clamped
        ? `slider + figure: the illustrative curve stops at ${kOhm(r)}, so they go there`
        : `slider + figure → R_taxel ${kOhm(r)}`;
    },
  };
}
