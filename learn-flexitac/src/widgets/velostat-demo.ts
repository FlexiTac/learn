// Velostat demo: the content of Lesson 2 step 1's demo card (src/ui/demo.ts mounts it; GuidedStep.demo "velostat").
//   (a) a cross-section: a rubber press tip comes down on top copper (gold), Velostat (dark, carbon grains) and bottom
//       copper. As the press deepens the Velostat thins a little under the tip, the grains crowd together and up to six
//       conductive paths light up between the copper strips.
//   (b) the press -> resistance curve from @shared/models/taxel.mjs on a log axis (1 kΩ to 1 MΩ), with a dot that rides
//       it in step with (a) and a live readout.
//   (c) one line: press harder -> resistance drops -> more current.
// ILLUSTRATIVE: there is no force data. Press is a unitless 0..1 knob and is never shown in newtons.
// Motion: press 0 -> 1 (2.2 s, ease-in-out), hold 0.6 s, release 1.4 s, rest 0.6 s, looping. Hovering or dragging on
// the chart (sideways) or the drawing (up/down) scrubs the press and pauses the loop; it resumes 3 s after the pointer
// leaves. The chart is a focusable slider: arrow keys, Page Up/Down, Home/End. Reduced motion: no loop, starts at 0.5.
// The loop also stops while the tab is hidden or the card is off screen.
// Layout from the card's width (velostat-demo.css container queries) and the host's forms (src/ui/demo.ts): in the band
// Fig 1 keeps beside the pad the card is compact (no text line); a narrow card (under ~230 px) puts its kicker on two
// lines and its readout without the chart's title; a phone's (under ~170 px) drops the layer names and shortens the
// chart's labels and margins; a short stage ("short") makes both drawings shorter.
import { rTaxel, squash } from "@shared/models/taxel.mjs";
import { fill, strings } from "../i18n";
import { paintText, setTextBeside } from "../i18n/paint";
import type { WidgetCtx, WidgetInstance } from "../types";
import { h } from "../ui/dom";
import { fmtR } from "../ui/ohms";
import "./velostat-demo.css";

const T_PRESS = 2.2;
const T_HOLD = 0.6;
const T_REL = 1.4;
const T_REST = 0.6;
const LOOP = T_PRESS + T_HOLD + T_REL + T_REST;
const RESUME_MS = 3000;
/** Press at which each conductive path starts to light (centre first, then outwards). */
const PATH_ON = [0.1, 0.18, 0.32, 0.46, 0.6, 0.74];
/** Where each path crosses the film, as a fraction of the press tip's width from its centre. */
const PATH_X = [-0.05, 0.11, -0.2, 0.25, -0.33, 0.38];
/** Grain heights along a path (0 = bottom copper, 1 = top copper) and their sideways zig-zag (px). */
const PATH_V = [0.8, 0.56, 0.33, 0.12];
const PATH_JIT = [3, -3, 2.5, -2.5];
/** Log axis: 1 kΩ (10^3) to 1 MΩ (10^6). */
const DECADES: [number, string][] = [
  [1e6, "1M"],
  [1e5, "100k"],
  [1e4, "10k"],
  [1e3, "1k"],
];
// the card's words (docs/i18n.md): painted from S() and again on a language switch
const S = strings(
  {
    illTip: "Shape only: there is no force data. Press is unitless (0 = untouched, 1 = hard press).",
    ill: "Illustrative",
    ytitle: "Resistance",
    log: "· log scale",
    aria: "Press, illustrative, no units. Arrow keys change it.",
    line: 'Press harder&nbsp;<span class="vd-arrow" aria-hidden="true">→</span> resistance drops&nbsp;<span class="vd-arrow" aria-hidden="true">→</span> more current',
    copper: "copper",
    pressLong: "press (no units) →",
    pressShort: "press →",
    valuetext: "press {p} of 1: resistance {r}",
  },
  {
    illTip: "只示意形状，没有实测数据。按压没有单位（0 = 没碰，1 = 用力按）。",
    ill: "示意",
    ytitle: "电阻",
    log: "· 对数坐标",
    aria: "按压（示意，无单位）。用方向键调节。",
    line: '按得越重&nbsp;<span class="vd-arrow" aria-hidden="true">→</span> 电阻越小&nbsp;<span class="vd-arrow" aria-hidden="true">→</span> 电流越大',
    copper: "铜",
    pressLong: "按压（无单位）→",
    pressShort: "按压 →",
    valuetext: "按压 {p}（满值 1）：电阻 {r}",
  },
);

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const wave = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * clamp01(t));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const loopPress = (ph: number) =>
  ph < T_PRESS ? wave(ph / T_PRESS) : ph < T_PRESS + T_HOLD ? 1 : ph < T_PRESS + T_HOLD + T_REL ? 1 - wave((ph - T_PRESS - T_HOLD) / T_REL) : 0;
/** The time in the press stroke at which the loop reaches `p`, so it resumes from where a scrub left it. */
const phaseFor = (p: number) => (T_PRESS * Math.acos(1 - 2 * clamp01(p))) / Math.PI;

/** "200 kΩ", "48 kΩ", "4.8 kΩ": 2-3 significant digits (shared with the unit card: src/ui/ohms.ts). */
export { fmtR };

const NS = "http://www.w3.org/2000/svg";
function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, parent: Element): SVGElementTagNameMap[K] {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  parent.append(el);
  return el;
}
const f1 = (n: number) => (Math.round(n * 10) / 10).toString();

/** Deterministic scatter, so the grains sit in the same places every time. */
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function mount(el: HTMLElement, ctx: WidgetCtx): WidgetInstance {
  const reduced = ctx.reducedMotion();
  const root = h("div", { class: "vd" });
  root.innerHTML = `
    <p class="vd-kicker mono"><span class="vd-name">Velostat</span><span class="vd-sep" aria-hidden="true">·</span><span class="vd-ill" title="${S().illTip}" data-t-title="illTip" data-t="ill">${S().ill}</span></p>
    <div class="vd-anim" aria-hidden="true"><svg class="vd-svg"></svg></div>
    <div class="vd-head">
      <span class="vd-ytitle">${S().ytitle} <span class="vd-faint" data-t="log">${S().log}</span></span>
      <span class="vd-read mono"><i class="vd-key" aria-hidden="true"></i><span class="vd-read-v"></span></span>
    </div>
    <div class="vd-chart" tabindex="0" role="slider" aria-label="${S().aria}" data-t-aria="aria" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
      <svg class="vd-svg"></svg>
    </div>
    <p class="vd-line demo-extra" data-t="line">${S().line}</p>`;
  el.append(root);
  const anim = root.querySelector<HTMLElement>(".vd-anim")!;
  const chart = root.querySelector<HTMLElement>(".vd-chart")!;
  const animSvg = anim.querySelector("svg")!;
  const chartSvg = chart.querySelector("svg")!;
  const readV = root.querySelector<HTMLElement>(".vd-read-v")!;

  let press = reduced ? 0.5 : 0;

  // ------------------------------------------------------------------ (a) the cross-section
  type Grain = { u: number; v: number; el: SVGCircleElement };
  /** One path: a glow and a core line, and its grains twice (plain underneath, lit on top, faded in together). */
  type Chain = { glow: SVGPathElement; core: SVGPathElement; nodes: [SVGCircleElement, SVGCircleElement][]; x: number; flip: number };
  let A: {
    W: number;
    H: number;
    sx0: number;
    sx1: number;
    cu: number;
    T0: number;
    yb0: number;
    yv0: number;
    cx: number;
    fw: number;
    prof: (x: number) => number;
    xs: number[];
    topCu: SVGPathElement;
    film: SVGPathElement;
    tip: SVGPathElement;
    tipHi: SVGPathElement;
    grains: Grain[];
    chains: Chain[];
  } | null = null;

  const buildAnim = (W: number, H: number) => {
    animSvg.replaceChildren();
    animSvg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    if (W < 60 || H < 40) {
      A = null;
      return;
    }
    // the layer names on the right; a phone-narrow card has no room for them (its kicker names the film)
    const labelW = W >= 280 ? 60 : W >= 140 ? 54 : 0;
    const sx0 = 0.5;
    const sx1 = labelW ? W - labelW - 6 : W - 0.5;
    const cu = 7;
    // (the film's thickness: a short phone band's cross-section is only ~44 px tall)
    const T0 = H >= 90 ? 26 : H >= 48 ? 22 : 18;
    const yb1 = H - 5;
    const yb0 = yb1 - cu;
    const yv0 = yb0 - T0;
    const cx = (sx0 + sx1) / 2;
    const fw = Math.min(84, Math.max(50, (sx1 - sx0) * 0.3));
    const flat = fw * 0.2;
    const fall = fw * 0.6;
    const prof = (x: number) => {
      const d = Math.abs(x - cx);
      return d <= flat ? 1 : d >= flat + fall ? 0 : 0.5 + 0.5 * Math.cos((Math.PI * (d - flat)) / fall);
    };
    const xs: number[] = [];
    for (let x = sx0; x < sx1; x += 3) xs.push(x);
    xs.push(sx1);

    svgEl("rect", { class: "vd-cu", x: sx0, y: yb0, width: f1(sx1 - sx0), height: cu }, animSvg);
    const film = svgEl("path", { class: "vd-film" }, animSvg);
    const gGrains = svgEl("g", { class: "vd-grains" }, animSvg);
    const rand = rng(1361);
    const n = Math.round(((sx1 - sx0) * T0) / 92);
    const grains: Grain[] = [];
    for (let i = 0; i < n; i++) {
      const u = rand();
      const v = rand();
      grains.push({ u, v, el: svgEl("circle", { r: f1(1.4 + rand() * 0.7) }, gGrains) });
    }
    const gPaths = svgEl("g", { class: "vd-paths" }, animSvg);
    const chains: Chain[] = PATH_X.map((fx, k) => {
      const g = svgEl("g", {}, gPaths);
      return {
        glow: svgEl("path", { class: "vd-path-glow" }, g),
        core: svgEl("path", { class: "vd-path" }, g),
        nodes: PATH_V.map(() => [svgEl("circle", { class: "vd-node-base", r: 2.1 }, g), svgEl("circle", { class: "vd-node", r: 2.1 }, g)] as [SVGCircleElement, SVGCircleElement]),
        x: cx + fx * fw,
        flip: k % 2 ? -1 : 1,
      };
    });
    const topCu = svgEl("path", { class: "vd-cu" }, animSvg);
    const tip = svgEl("path", { class: "vd-tip" }, animSvg);
    const tipHi = svgEl("path", { class: "vd-tip-hi" }, animSvg);
    const lab = (y: number, t: string) => {
      const e = svgEl("text", { class: "vd-lab", x: f1(sx1 + 7), y: f1(y), "dominant-baseline": "central" }, animSvg);
      e.textContent = t;
    };
    if (labelW) {
      lab(yv0 - cu / 2, S().copper);
      lab(yv0 + T0 / 2, "Velostat");
      lab(yb0 + cu / 2, S().copper);
    }
    A = { W, H, sx0, sx1, cu, T0, yb0, yv0, cx, fw, prof, xs, topCu, film, tip, tipHi, grains, chains };
  };

  const drawAnim = () => {
    if (!A) return;
    const { sx0, sx1, cu, T0, yb0, yv0, cx, fw, prof, xs } = A;
    const maxDip = 0.35 * T0;
    const dip = squash(press) * T0;
    const k = maxDip ? dip / maxDip : 0;
    const filmTop = (x: number) => yv0 + dip * prof(x);
    const thick = (x: number) => T0 - dip * prof(x);
    // top copper: follows the dent the tip makes
    let d = `M${f1(xs[0])},${f1(filmTop(xs[0]) - cu)}`;
    for (const x of xs.slice(1)) d += `L${f1(x)},${f1(filmTop(x) - cu)}`;
    for (let i = xs.length - 1; i >= 0; i--) d += `L${f1(xs[i])},${f1(filmTop(xs[i]))}`;
    A.topCu.setAttribute("d", `${d}Z`);
    let fd = `M${f1(xs[0])},${f1(filmTop(xs[0]))}`;
    for (const x of xs.slice(1)) fd += `L${f1(x)},${f1(filmTop(x))}`;
    A.film.setAttribute("d", `${fd}L${f1(sx1)},${yb0}L${f1(sx0)},${yb0}Z`);
    // grains: squeezed into the thinner film under the tip (and drawn a touch closer together)
    const span = sx1 - sx0 - 6;
    for (const g of A.grains) {
      let x = sx0 + 3 + g.u * span;
      x += (cx - x) * 0.1 * k * prof(x);
      const y = yb0 - 2.4 - g.v * (thick(x) - 4.8);
      g.el.setAttribute("cx", f1(x));
      g.el.setAttribute("cy", f1(y));
    }
    // conductive paths: top copper -> a chain of touching grains -> bottom copper
    A.chains.forEach((c, i) => {
      const on = smooth(PATH_ON[i], PATH_ON[i] + 0.1, press);
      const pts: [number, number][] = [[c.x, filmTop(c.x)]];
      PATH_V.forEach((v, j) => {
        const x = c.x + PATH_JIT[j] * c.flip * (1 - 0.35 * k);
        pts.push([x, yb0 - 2.4 - v * (thick(x) - 4.8)]);
      });
      pts.push([c.x, yb0]);
      const pd = pts.map(([x, y], j) => `${j ? "L" : "M"}${f1(x)},${f1(y)}`).join("");
      c.glow.setAttribute("d", pd);
      c.core.setAttribute("d", pd);
      const o = on.toFixed(3);
      c.glow.style.opacity = c.core.style.opacity = o;
      c.nodes.forEach(([base, lit], j) => {
        const nx = f1(pts[j + 1][0]);
        const ny = f1(pts[j + 1][1]);
        for (const n of [base, lit]) {
          n.setAttribute("cx", nx);
          n.setAttribute("cy", ny);
        }
        lit.style.opacity = o;
      });
    });
    // the rubber press tip (a fingertip): hovers a few px above at rest, lands, then pushes the dent; its round end
    // flattens as it pushes
    const lift = 8 * (1 - smooth(0, 0.06, press));
    const yb = filmTop(cx) - cu - lift;
    const ry = fw * (0.34 - 0.13 * k);
    const L = cx - fw / 2;
    const R = cx + fw / 2;
    A.tip.setAttribute("d", `M${f1(L)},-4V${f1(yb - ry)}A${f1(fw / 2)},${f1(ry)} 0 0 0 ${f1(R)},${f1(yb - ry)}V-4Z`);
    // a soft highlight down its left side, for a little roundness
    const hx = L + fw * 0.2;
    A.tipHi.setAttribute("d", `M${f1(hx)},-4V${f1(yb - ry * 1.05)}`);
  };

  // ------------------------------------------------------------------ (b) the chart
  // (a phone-narrow chart: smaller ticks, so a narrower left margin; velostat-demo.css)
  let M = { l: 34, r: 10, t: 8, b: 20 };
  let C: { W: number; H: number; pw: number; ph: number; X: (p: number) => number; Y: (r: number) => number; dot: SVGCircleElement; vx: SVGLineElement; hy: SVGLineElement } | null = null;

  const buildChart = (W: number, H: number) => {
    chartSvg.replaceChildren();
    chartSvg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    M = W < 150 ? { l: 28, r: 8, t: 7, b: 18 } : { l: 34, r: 10, t: 8, b: 20 };
    const pw = W - M.l - M.r;
    const ph = H - M.t - M.b;
    if (pw < 40 || ph < 30) {
      C = null;
      return;
    }
    const X = (p: number) => M.l + p * pw;
    const Y = (r: number) => M.t + ((6 - Math.log10(r)) / 3) * ph;
    for (const [r, t] of DECADES) {
      const y = f1(Y(r));
      svgEl("line", { class: r === 1e3 ? "vd-base" : "vd-grid", x1: M.l, x2: f1(W - M.r), y1: y, y2: y }, chartSvg);
      const tx = svgEl("text", { class: "vd-tick", x: M.l - 6, y, "text-anchor": "end", "dominant-baseline": "central" }, chartSvg);
      tx.textContent = t;
    }
    const xl = (x: number, anchor: string, t: string) => {
      const e = svgEl("text", { class: "vd-tick", x: f1(x), y: H - 5, "text-anchor": anchor }, chartSvg);
      e.textContent = t;
    };
    xl(X(0), "start", "0");
    // (a narrow chart: just "press →"; the card's kicker says illustrative)
    xl(X(0.5), "middle", W >= 190 ? S().pressLong : S().pressShort);
    xl(X(1), "end", "1");
    let d = "";
    for (let i = 0; i <= 80; i++) {
      const p = i / 80;
      d += `${i ? "L" : "M"}${f1(X(p))},${f1(Y(rTaxel(p)))}`;
    }
    const vx = svgEl("line", { class: "vd-guide" }, chartSvg);
    const hy = svgEl("line", { class: "vd-guide" }, chartSvg);
    svgEl("path", { class: "vd-curve", d }, chartSvg);
    const dot = svgEl("circle", { class: "vd-dot", r: 5 }, chartSvg);
    C = { W, H, pw, ph, X, Y, dot, vx, hy };
  };

  let lastRead = "";
  let lastAria = -1;
  const drawChart = () => {
    const r = rTaxel(press);
    const txt = `R = ${fmtR(r)}`;
    if (txt !== lastRead) readV.textContent = lastRead = txt;
    const v = Math.round(press * 100);
    if (v !== lastAria) {
      lastAria = v;
      chart.setAttribute("aria-valuenow", String(v));
      chart.setAttribute("aria-valuetext", fill(S().valuetext, { p: press.toFixed(2), r: fmtR(r) }));
    }
    if (!C) return;
    const x = f1(C.X(press));
    const y = f1(C.Y(r));
    C.dot.setAttribute("cx", x);
    C.dot.setAttribute("cy", y);
    for (const [a, b] of [
      ["x1", x],
      ["x2", x],
      ["y1", y],
      ["y2", f1(C.Y(1e3))],
    ])
      C.vx.setAttribute(a, b);
    for (const [a, b] of [
      ["x1", String(M.l)],
      ["x2", x],
      ["y1", y],
      ["y2", y],
    ])
      C.hy.setAttribute(a, b);
  };

  const draw = () => {
    drawAnim();
    drawChart();
  };
  const setPress = (p: number) => {
    press = clamp01(p);
    draw();
  };

  // sizes come from CSS (container units), so the drawings are rebuilt at the size they are shown
  const sizes = new Map<Element, string>();
  const ro = new ResizeObserver((entries) => {
    for (const e of entries) {
      const W = Math.round(e.contentRect.width);
      const H = Math.round(e.contentRect.height);
      const key = `${W}x${H}`;
      if (sizes.get(e.target) === key) continue;
      sizes.set(e.target, key);
      if (e.target === anim) buildAnim(W, H);
      else buildChart(W, H);
    }
    draw();
  });
  ro.observe(anim);
  ro.observe(chart);

  // ------------------------------------------------------------------ motion
  let phase = reduced ? phaseFor(press) : 0;
  let paused = reduced;
  let visible = !document.hidden;
  let onscreen = true;
  let raf = 0;
  let last = 0;
  let resumeT = 0;
  const holds = new Set<string>();

  const tick = (now: number) => {
    raf = 0;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    phase = (phase + dt) % LOOP;
    setPress(loopPress(phase));
    run();
  };
  function run() {
    const want = !paused && visible && onscreen;
    if (want && !raf) {
      if (!last || performance.now() - last > 100) last = performance.now();
      raf = requestAnimationFrame(tick);
    } else if (!want && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
    }
  }
  const hold = (why: string) => {
    holds.add(why);
    paused = true;
    clearTimeout(resumeT);
    run();
  };
  const unhold = (why: string) => {
    if (!holds.delete(why) || holds.size || reduced) return;
    clearTimeout(resumeT);
    resumeT = window.setTimeout(() => {
      // carry on from the current press (on the way down), so nothing jumps
      phase = phaseFor(press);
      paused = false;
      run();
    }, RESUME_MS);
  };

  // scrubbing: sideways on the chart, up/down on the drawing (push down = press harder)
  const fromChart = (e: PointerEvent) => {
    const b = chart.getBoundingClientRect();
    const pw = C ? C.pw : b.width - M.l - M.r;
    return (e.clientX - b.left - M.l) / pw;
  };
  const fromAnim = (e: PointerEvent) => {
    const b = anim.getBoundingClientRect();
    return (e.clientY - b.top - b.height * 0.12) / (b.height * 0.62);
  };
  const scrub = (target: HTMLElement, why: string, at: (e: PointerEvent) => number) => {
    target.addEventListener("pointerenter", () => hold(why));
    target.addEventListener("pointerleave", () => unhold(why));
    target.addEventListener("pointerdown", (e) => {
      hold(why);
      try {
        target.setPointerCapture(e.pointerId);
      } catch {
        /* capture is optional */
      }
      setPress(at(e));
    });
    target.addEventListener("pointermove", (e) => {
      if (e.pointerType === "touch" && !e.buttons) return;
      if (!holds.has(why)) hold(why);
      setPress(at(e));
    });
    target.addEventListener("pointercancel", () => unhold(why));
  };
  scrub(chart, "chart", fromChart);
  scrub(anim, "anim", fromAnim);

  chart.addEventListener("keydown", (e) => {
    const step = e.shiftKey ? 0.2 : 0.05;
    const to =
      e.key === "ArrowRight" || e.key === "ArrowUp" ? press + step
      : e.key === "ArrowLeft" || e.key === "ArrowDown" ? press - step
      : e.key === "PageUp" ? press + 0.2
      : e.key === "PageDown" ? press - 0.2
      : e.key === "Home" ? 0
      : e.key === "End" ? 1
      : null;
    if (to === null) return;
    e.preventDefault();
    hold("key");
    // keys move in clean steps from wherever the loop was
    setPress(Math.round(to * 100) / 100);
  });
  // keyboard focus pauses the loop too (a screen reader would otherwise hear the value change all the time)
  chart.addEventListener("focus", () => {
    if (chart.matches(":focus-visible")) hold("key");
  });
  chart.addEventListener("blur", () => unhold("key"));

  const onVis = () => {
    visible = !document.hidden;
    run();
  };
  document.addEventListener("visibilitychange", onVis);
  const io = new IntersectionObserver((es) => {
    onscreen = es[es.length - 1].isIntersecting;
    run();
  });
  io.observe(root);

  // a language switch: the words, and both drawings again at their size (the press and the loop carry on)
  const offLang = ctx.onLang(() => {
    paintText(root, S());
    setTextBeside(root.querySelector(".vd-faint"), `${S().ytitle} `);
    for (const [e, key] of sizes) {
      const [W, H] = key.split("x").map(Number);
      if (e === anim) buildAnim(W, H);
      else buildChart(W, H);
    }
    lastAria = -1;
    draw();
  });

  draw();
  run();

  return {
    destroy() {
      offLang();
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      clearTimeout(resumeT);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      root.remove();
    },
  };
}
