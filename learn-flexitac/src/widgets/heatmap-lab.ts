// Heatmap lab (lesson 5, Bytes to touch). Press a simulated pad and watch every stage of the host viewer side by side.
//
//   finger blob (unitless press, ILLUSTRATIVE)
//     -> taxel.rTaxel -> divider.vA0 -> adc.adcCode (+ optional noise) -> adc.toByte     (one byte per taxel)
//     -> a real 386-byte frame (AA 55 + bytes at scan.byteIndex)
//     -> host.createHost: header search, 30-frame median baseline, clip(raw - baseline - threshold, 0, 100),
//        normalise (÷ peak, or ÷ noiseScale when the peak is below the threshold), EMA, viridis.
//
// The contact stage is recomputed here with the same float32 steps as host.processFrame (which only returns the
// normalised result), so the "Contact" panel shows exactly what the viewer divides.
import { ALPHA, COLS, FRAME_HZ, HEADER, INIT_FRAMES, NOISE_SCALE, ROWS, THRESHOLD } from "@shared/data/constants.mjs";
import { adcCode, MAX_CODE, toByte } from "@shared/models/adc.mjs";
import { vA0 } from "@shared/models/divider.mjs";
import { colorize, createHost as createHostJs, toU8 } from "@shared/models/host.mjs";
import { byteIndex, frameSize } from "@shared/models/scan.mjs";
import { R_REST, rTaxel } from "@shared/models/taxel.mjs";
import { fill, strings } from "../i18n";
import { paintText } from "../i18n/paint";
import type { Theme, WidgetCtx, WidgetInstance } from "../types";
import { h } from "../ui/dom";
import "./heatmap-lab.css";

interface HostOpts {
  rows: number;
  cols: number;
  initFrames: number;
  threshold: number;
  noiseScale: number;
  alpha: number;
  clipMax: number;
}
interface Host {
  opts: HostOpts;
  baseline: Float32Array | null;
  ready: boolean;
  init: Uint8Array[];
  norm: Float32Array;
  filtered: Float32Array;
  feed(chunk: Uint8Array): { raw: Uint8Array; norm: Float32Array | null; init: boolean }[];
  tick(): Float32Array;
  recalibrate(): void;
}
const createHost = createHostJs as unknown as (o?: Partial<HostOpts>) => Host;

const N = ROWS * COLS;
const f32 = Math.fround;
const SIGMA = 1.15; // finger blob radius in taxels (2 mm pitch -> a soft fingertip a few mm wide). Illustrative.

type StageId = "raw" | "base" | "contact" | "norm" | "shown";
interface Stage {
  id: StageId;
  n: number;
  max: number;
  fmt: (v: number) => string;
}
// (each stage's name and what it does: name_<id> / how_<id> in the lab's words, S below)
const STAGES: Stage[] = [
  { id: "raw", n: 1, max: 255, fmt: (v) => String(Math.round(v)) },
  { id: "base", n: 2, max: 40, fmt: (v) => String(Math.round(v * 10) / 10) },
  { id: "contact", n: 3, max: 100, fmt: (v) => String(Math.round(v)) },
  { id: "norm", n: 4, max: 1, fmt: (v) => v.toFixed(2) },
  { id: "shown", n: 5, max: 1, fmt: (v) => v.toFixed(2) },
];

// the lab's words (docs/i18n.md): painted from S() and again on a language switch
const S = strings(
  {
    name_raw: "Raw byte",
    how_raw: "what arrives over USB",
    name_base: "Baseline",
    how_base: `median of the first ${INIT_FRAMES} frames`,
    name_contact: "Contact",
    how_contact: "raw − baseline − threshold, kept in 0…100",
    name_norm: "Normalised",
    how_norm: `÷ peak (÷ ${NOISE_SCALE} if the peak is below the threshold)`,
    name_shown: "Smoothed + colour",
    how_shown: "EMA, then the viridis colour map",
    kicker: "Heatmap lab · simulated",
    illTip: "No force data exists: the press strength and the noise are unitless knobs",
    ill: "illustrative",
    stripAria: "Pipeline stages: pick one to show it large",
    stageTip: "{n}. {name}: {how}",
    press: "Press <i>(unitless)</i>",
    noise: "Noise <i>(± bytes)</i>",
    threshold: "Threshold",
    alpha: "Smoothing α",
    recal: "Recalibrate",
    recalTip: "Record a new baseline from the next {n} frames",
    cap: "{n} · {name}: {how} · scale 0–{max} · taxel sense {r} / drive {c}",
    calibrating: "calibrating {k}/{n}: hands off!",
    peakHi: "peak {p} ≥ {thr} → ÷ {p}",
    peakLo: "peak {p} < {thr} → ÷ {ns}",
    bigAria: "Simulated FlexiTac pad, {rows} sense lines by {cols} drive lines. Press and drag to touch it, or use the arrow keys and hold Space.",
    outViewer: "viewer: THRESHOLD = {t}, ALPHA = {a}",
    outT0: "threshold 0: every flicker counts as touch, and ÷ peak blows it up to full brightness",
    outT: "changes smaller than {t} counts above the baseline are ignored",
    outA1: "alpha 1: no smoothing, each frame shown as is",
    outA: "each new frame counts {a} %, the past {b} %",
    outDrag: "drag on the heatmap to press",
  },
  {
    name_raw: "原始字节",
    how_raw: "经 USB 收到的数据",
    name_base: "基线",
    how_base: `前 ${INIT_FRAMES} 帧的中位数`,
    name_contact: "接触值",
    how_contact: "原始值 − 基线 − 阈值，限制在 0…100",
    name_norm: "归一化",
    how_norm: `÷ 峰值（峰值低于阈值时 ÷ ${NOISE_SCALE}）`,
    name_shown: "平滑 + 上色",
    how_shown: "指数移动平均，再用 viridis 色图上色",
    kicker: "热力图实验室 · 仿真",
    illTip: "没有力的测量数据：按压力度和噪声都是没有单位的旋钮",
    ill: "示意",
    stripAria: "处理流程的各个阶段：选一个放大显示",
    stageTip: "{n}. {name}：{how}",
    press: "按压<i>（无单位）</i>",
    noise: "噪声<i>（± 字节）</i>",
    threshold: "阈值",
    alpha: "平滑 α",
    recal: "重新校准",
    recalTip: "用接下来的 {n} 帧重新记录基线",
    cap: "{n} · {name}：{how} · 范围 0–{max} · 触觉像素：感应 {r} / 驱动 {c}",
    calibrating: "正在校准 {k}/{n}：别碰！",
    peakHi: "峰值 {p} ≥ {thr} → ÷ {p}",
    peakLo: "峰值 {p} < {thr} → ÷ {ns}",
    bigAria: "仿真的 FlexiTac 传感垫，{rows} 条感应线 × {cols} 条驱动线。按住并拖动来触摸它，或用方向键移动、按住空格键按压。",
    outViewer: "查看器：THRESHOLD = {t}，ALPHA = {a}",
    outT0: "阈值为 0：每一点抖动都算作触摸，÷ 峰值又把它放大到最亮",
    outT: "比基线高出不到 {t} 的变化会被忽略",
    outA1: "alpha 为 1：不平滑，每一帧原样显示",
    outA: "每个新帧占 {a} %，过去的占 {b} %",
    outDrag: "在热力图上拖动来按压",
  },
);
const V = { n: INIT_FRAMES, rows: ROWS, cols: COLS };
/** A stage's name and what it does, in the current language. */
const stageText = (s: Stage): { name: string; how: string } => ({ name: S()[`name_${s.id}`], how: S()[`how_${s.id}`] });
const stageTip = (s: Stage) => fill(S().stageTip, { n: s.n, ...stageText(s) });

interface Finger {
  r: number;
  c: number;
  on: boolean;
  press: number;
}

/** Small deterministic PRNG so every visit shows the same pad. */
function rng(seed: number) {
  let s = seed >>> 0;
  const u = () => ((s = (s * 1664525 + 1013904223) >>> 0), s / 4294967296);
  const g = () => Math.sqrt(-2 * Math.log(u() + 1e-12)) * Math.cos(2 * Math.PI * u());
  return { u, g };
}

const hex = (s: string): [number, number, number] => {
  const m = s.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!m) return [128, 128, 128];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export function mount(el: HTMLElement, ctx: WidgetCtx): WidgetInstance {
  const root = h("div", { class: "w-hlab" });
  root.innerHTML = `
    <div class="w-hlab-head">
      <span class="w-kicker" data-t="kicker">${S().kicker}</span>
      <span class="badge badge-illustrative" title="${S().illTip}" data-t-title="illTip" data-t="ill">${S().ill}</span>
      <span class="w-hlab-status mono" aria-live="polite"></span>
    </div>
    <div class="w-hlab-main">
      <div class="w-hlab-mainbox">
        <canvas class="w-hlab-big" tabindex="0" role="img"></canvas>
        <p class="w-hlab-cap mono"></p>
      </div>
    </div>
    <div class="w-hlab-strip" role="group" aria-label="${S().stripAria}" data-t-aria="stripAria">
      ${STAGES.map(
        (s) => `<button type="button" class="w-hlab-stage" data-stage="${s.id}" aria-pressed="false" title="${stageTip(s)}">
          <span class="w-hlab-sname mono"><b>${s.n}</b> ${stageText(s).name}</span>
          <canvas class="w-hlab-mini" aria-hidden="true"></canvas>
          <span class="w-hlab-sval mono" data-val="${s.id}">–</span>
        </button>`,
      ).join("")}
    </div>
    <div class="w-hlab-controls">
      <label class="w-hlab-ctl"><span data-t="press">${S().press}</span><input type="range" data-k="press" min="0.1" max="1" step="0.05"><output class="mono"></output></label>
      <label class="w-hlab-ctl"><span data-t="noise">${S().noise}</span><input type="range" data-k="noise" min="0" max="8" step="0.5"><output class="mono"></output></label>
      <label class="w-hlab-ctl"><span data-t="threshold">${S().threshold}</span><input type="range" data-k="threshold" min="0" max="60" step="1"><output class="mono"></output></label>
      <label class="w-hlab-ctl"><span data-t="alpha">${S().alpha}</span><input type="range" data-k="alpha" min="0.05" max="1" step="0.05"><output class="mono"></output></label>
      <button type="button" class="btn-ghost w-hlab-recal" title="${fill(S().recalTip, V)}" data-t-title="recalTip" data-t="recal">${S().recal}</button>
    </div>`;
  el.append(root);

  const big = root.querySelector<HTMLCanvasElement>(".w-hlab-big")!;
  const bigBox = root.querySelector<HTMLElement>(".w-hlab-main")!;
  const cap = root.querySelector<HTMLElement>(".w-hlab-cap")!;
  const status = root.querySelector<HTMLElement>(".w-hlab-status")!;
  const stageBtns = [...root.querySelectorAll<HTMLButtonElement>(".w-hlab-stage")];
  const minis = new Map<StageId, HTMLCanvasElement>(stageBtns.map((b) => [b.dataset.stage as StageId, b.querySelector("canvas")!]));
  const vals = new Map<StageId, HTMLElement>(STAGES.map((s) => [s.id, root.querySelector<HTMLElement>(`[data-val="${s.id}"]`)!]));
  const inputs = new Map<string, HTMLInputElement>([...root.querySelectorAll<HTMLInputElement>("input[data-k]")].map((i) => [i.dataset.k!, i]));

  // ------------------------------------------------------------------ the simulated pad
  const R = rng(1361);
  // Each crossing rests at a slightly different resistance (illustrative ±25 % spread), so the baseline has texture.
  const rRest = Float64Array.from({ length: N }, () => R_REST * Math.exp(0.25 * R.g()));
  const restCode = Float64Array.from(rRest, (r) => adcCode(vA0(rTaxel(0, { rRest: r }))));
  const knobs = { press: 0.3, noise: 2, threshold: THRESHOLD, alpha: ALPHA };
  const host = createHost({ threshold: knobs.threshold, alpha: knobs.alpha });
  const fingers = new Map<number | string, Finger>();
  const kb: Finger = { r: 5, c: 15, on: false, press: 0 };
  fingers.set("kb", kb);
  const inspect = { r: 5, c: 15 };

  const pressMap = new Float64Array(N);
  const frame = new Uint8Array(frameSize());
  frame[0] = HEADER[0];
  frame[1] = HEADER[1];
  function synthFrame(): Uint8Array {
    pressMap.fill(0);
    for (const f of fingers.values()) {
      if (f.press <= 0.001) continue;
      const r0 = Math.max(0, Math.floor(f.r - 4)), r1 = Math.min(ROWS - 1, Math.ceil(f.r + 4));
      const c0 = Math.max(0, Math.floor(f.c - 4)), c1 = Math.min(COLS - 1, Math.ceil(f.c + 4));
      for (let r = r0; r <= r1; r++)
        for (let c = c0; c <= c1; c++) {
          const d2 = (r - f.r) ** 2 + (c - f.c) ** 2;
          pressMap[r * COLS + c] += f.press * Math.exp(-d2 / (2 * SIGMA * SIGMA));
        }
    }
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const k = r * COLS + c;
        const p = Math.min(1, pressMap[k]);
        let code = p > 0.0005 ? adcCode(vA0(rTaxel(p, { rRest: rRest[k] }))) : restCode[k];
        if (knobs.noise > 0) code = Math.round(code + 4 * knobs.noise * R.g()); // noise in byte units = 4 ADC codes each
        frame[byteIndex(r, c)] = toByte(Math.max(0, Math.min(MAX_CODE, code)));
      }
    return frame;
  }

  // ------------------------------------------------------------------ pipeline state for display
  let lastRaw: Uint8Array = new Uint8Array(N);
  const contact = new Float32Array(N);
  let peak = 0;
  function afterFrame(raw: Uint8Array) {
    lastRaw = raw;
    peak = 0;
    if (!host.baseline) return contact.fill(0);
    const thr = host.opts.threshold;
    for (let k = 0; k < N; k++) {
      let v = f32(f32(raw[k] - host.baseline[k]) - thr);
      v = v < 0 ? 0 : v > 100 ? 100 : v;
      contact[k] = v;
      if (v > peak) peak = v;
    }
  }
  function calibrateNow() {
    host.recalibrate();
  }
  // start calibrated, as the viewer would be after its first second
  for (let i = 0; i < INIT_FRAMES; i++) afterFrame(host.feed(synthFrame()).at(-1)!.raw);

  // ------------------------------------------------------------------ drawing
  let ramp: [number, number, number][] = [];
  const makeRamp = () => {
    const cs = getComputedStyle(root);
    const a = hex(cs.getPropertyValue("--card-2") || "#f4f4f1");
    const b = hex(cs.getPropertyValue("--ink") || "#18181a");
    ramp = Array.from({ length: 256 }, (_, i) => {
      const t = i / 255;
      return [0, 1, 2].map((j) => Math.round(a[j] + (b[j] - a[j]) * t)) as [number, number, number];
    });
  };
  makeRamp();

  const off = document.createElement("canvas");
  off.width = COLS;
  off.height = ROWS;
  const og = off.getContext("2d")!;
  const img = og.createImageData(COLS, ROWS);

  function stageValue(id: StageId, k: number): number {
    switch (id) {
      case "raw":
        return lastRaw[k];
      case "base":
        return host.baseline ? host.baseline[k] : NaN;
      case "contact":
        return contact[k];
      case "norm":
        return host.norm[k];
      case "shown":
        return host.filtered[k];
    }
  }
  function paintStage(s: Stage) {
    if (s.id === "shown") {
      const rgb = colorize(toU8(host.filtered));
      for (let k = 0; k < N; k++) {
        img.data[4 * k] = rgb[3 * k];
        img.data[4 * k + 1] = rgb[3 * k + 1];
        img.data[4 * k + 2] = rgb[3 * k + 2];
        img.data[4 * k + 3] = 255;
      }
    } else {
      for (let k = 0; k < N; k++) {
        const v = stageValue(s.id, k);
        const c = Number.isNaN(v) ? ramp[0] : ramp[Math.max(0, Math.min(255, Math.round((v / s.max) * 255)))];
        img.data[4 * k] = c[0];
        img.data[4 * k + 1] = c[1];
        img.data[4 * k + 2] = c[2];
        img.data[4 * k + 3] = 255;
      }
    }
    og.putImageData(img, 0, 0);
  }
  function blit(cv: HTMLCanvasElement, s: Stage, grid: boolean) {
    const g = cv.getContext("2d")!;
    const W = cv.width, H = cv.height;
    if (!W || !H) return;
    paintStage(s);
    g.imageSmoothingEnabled = false;
    g.drawImage(off, 0, 0, W, H);
    const cw = W / COLS, ch = H / ROWS;
    if (grid) {
      g.strokeStyle = s.id === "shown" ? "rgba(0,0,0,.22)" : "rgba(128,128,128,.22)";
      g.lineWidth = 1;
      g.beginPath();
      for (let c = 1; c < COLS; c++) (g.moveTo(Math.round(c * cw) + 0.5, 0), g.lineTo(Math.round(c * cw) + 0.5, H));
      for (let r = 1; r < ROWS; r++) (g.moveTo(0, Math.round(r * ch) + 0.5), g.lineTo(W, Math.round(r * ch) + 0.5));
      g.stroke();
    }
    // the inspected taxel
    g.strokeStyle = s.id === "shown" ? "#ffffff" : "#a24e0e";
    g.lineWidth = Math.max(1.5, cw / 9);
    g.strokeRect(inspect.c * cw + g.lineWidth / 2, inspect.r * ch + g.lineWidth / 2, cw - g.lineWidth, ch - g.lineWidth);
    if (grid)
      for (const f of fingers.values()) {
        if (!f.on) continue;
        g.beginPath();
        g.arc((f.c + 0.5) * cw, (f.r + 0.5) * ch, SIGMA * 2 * cw, 0, Math.PI * 2);
        g.setLineDash([4, 4]);
        g.strokeStyle = s.id === "shown" ? "rgba(255,255,255,.75)" : "rgba(162,78,14,.8)";
        g.lineWidth = 1.5;
        g.stroke();
        g.setLineDash([]);
      }
  }

  let selected: StageId = "shown";
  const stageOf = (id: StageId) => STAGES.find((s) => s.id === id)!;
  function draw() {
    blit(big, stageOf(selected), true);
    for (const s of STAGES) blit(minis.get(s.id)!, s, false);
    const k = inspect.r * COLS + inspect.c;
    for (const s of STAGES) {
      const v = stageValue(s.id, k);
      vals.get(s.id)!.textContent = Number.isNaN(v) ? "–" : s.fmt(v);
    }
    const s = stageOf(selected);
    const T = S();
    cap.textContent = fill(T.cap, { n: s.n, ...stageText(s), max: s.max, r: inspect.r, c: inspect.c });
    const thr = host.opts.threshold;
    status.textContent = !host.ready
      ? fill(T.calibrating, { k: host.init.length, n: INIT_FRAMES })
      : peak >= thr
        ? fill(T.peakHi, { p: Math.round(peak), thr })
        : fill(T.peakLo, { p: Math.round(peak), thr, ns: NOISE_SCALE });
  }

  // canvas sizes follow their boxes (device pixels for crisp grid lines)
  const dpr = () => Math.min(2, window.devicePixelRatio || 1);
  function fit() {
    const boxW = bigBox.clientWidth;
    const boxH = bigBox.clientHeight - cap.offsetHeight - 6;
    const w = Math.max(64, Math.floor(Math.min(boxW, (boxH * COLS) / ROWS)));
    const hgt = Math.round((w * ROWS) / COLS);
    big.style.width = `${w}px`;
    big.style.height = `${hgt}px`;
    big.width = Math.round(w * dpr());
    big.height = Math.round(hgt * dpr());
    for (const cv of minis.values()) {
      const mw = cv.clientWidth || 100;
      cv.width = Math.round(mw * dpr());
      cv.height = Math.round(((mw * ROWS) / COLS) * dpr());
    }
    draw();
  }
  const ro = new ResizeObserver(() => fit());
  ro.observe(bigBox);
  ro.observe(root.querySelector(".w-hlab-strip")!);

  // ------------------------------------------------------------------ the loop (FRAME_HZ simulated frames per second)
  /** Reduced motion: how long the stream runs after a change (ms). */
  const SETTLE_MS = 700;
  let raf = 0;
  let last = 0;
  let acc = 0;
  let visible = true;
  function loop(now: number) {
    raf = 0;
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 1 / 60;
    last = now;
    for (const [id, f] of fingers) {
      const goal = f.on ? knobs.press : 0;
      f.press += (goal - f.press) * Math.min(1, dt * 14);
      if (Math.abs(goal - f.press) < 0.002) f.press = goal;
      if (!f.on && f.press === 0 && id !== "kb") fingers.delete(id);
    }
    acc += dt * FRAME_HZ;
    let n = Math.min(10, Math.floor(acc));
    acc -= Math.floor(acc);
    while (n-- > 0) {
      const res = host.feed(synthFrame());
      if (res.length) afterFrame(res[res.length - 1].raw);
      host.tick(); // the Python viewer applies the EMA once per display-loop pass; here once per frame
    }
    draw();
    schedule();
  }
  // reduced motion: the stream runs only for a moment after something changes (a finger, a knob, a recalibration:
  // long enough for the press to ease in and the EMA to settle), then holds its last picture, noise and all, still;
  // otherwise it runs while the lab is on screen
  const reduced = ctx.reducedMotion();
  let activeUntil = 0;
  const poke = (ms = SETTLE_MS) => {
    if (!reduced) return;
    activeUntil = Math.max(activeUntil, performance.now() + ms);
    schedule();
  };
  function schedule() {
    if (raf || !visible || document.hidden) return;
    if (reduced && performance.now() > activeUntil) {
      last = 0;
      return;
    }
    raf = requestAnimationFrame(loop);
  }
  const io = new IntersectionObserver((es) => {
    visible = es.some((e) => e.isIntersecting);
    last = 0;
    schedule();
  });
  io.observe(root);
  const onVis = () => {
    last = 0;
    schedule();
  };
  document.addEventListener("visibilitychange", onVis);

  // ------------------------------------------------------------------ input
  const cellOf = (e: PointerEvent) => {
    const b = big.getBoundingClientRect();
    return {
      c: Math.max(0, Math.min(COLS - 1, ((e.clientX - b.left) / b.width) * COLS - 0.5)),
      r: Math.max(0, Math.min(ROWS - 1, ((e.clientY - b.top) / b.height) * ROWS - 0.5)),
    };
  };
  const setInspect = (r: number, c: number) => {
    inspect.r = Math.round(r);
    inspect.c = Math.round(c);
  };
  big.addEventListener("pointerdown", (e) => {
    big.setPointerCapture(e.pointerId);
    const p = cellOf(e);
    fingers.set(e.pointerId, { ...p, on: true, press: fingers.get(e.pointerId)?.press ?? 0 });
    setInspect(p.r, p.c);
    poke();
    e.preventDefault();
  });
  big.addEventListener("pointermove", (e) => {
    const p = cellOf(e);
    const f = fingers.get(e.pointerId);
    if (f?.on) {
      Object.assign(f, p);
      poke();
    }
    if (f?.on || e.pointerType === "mouse") setInspect(p.r, p.c);
    if (!raf) draw();
  });
  const lift = (e: PointerEvent) => {
    const f = fingers.get(e.pointerId);
    if (f) f.on = false;
    poke();
  };
  big.addEventListener("pointerup", lift);
  big.addEventListener("pointercancel", lift);
  big.addEventListener("keydown", (e) => {
    const step: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (step[e.key]) {
      kb.r = Math.max(0, Math.min(ROWS - 1, Math.round(kb.r) + step[e.key][0]));
      kb.c = Math.max(0, Math.min(COLS - 1, Math.round(kb.c) + step[e.key][1]));
      setInspect(kb.r, kb.c);
    } else if (e.key === " ") {
      if (!e.repeat) kb.on = true;
    } else return;
    e.preventDefault();
    poke();
    if (!raf) draw();
  });
  big.addEventListener("keyup", (e) => {
    if (e.key === " ") {
      kb.on = false;
      poke();
    }
  });
  big.setAttribute("aria-label", fill(S().bigAria, V));

  root.querySelector(".w-hlab-strip")!.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-stage]");
    if (!b) return;
    selected = b.dataset.stage as StageId;
    for (const x of stageBtns) x.setAttribute("aria-pressed", String(x === b));
    draw();
  });
  stageBtns.find((b) => b.dataset.stage === selected)!.setAttribute("aria-pressed", "true");

  const fmtKnob = (k: string, v: number) => (k === "alpha" || k === "press" ? v.toFixed(2) : String(v));
  const syncInputs = () => {
    for (const [k, inp] of inputs) {
      const v = knobs[k as keyof typeof knobs];
      inp.value = String(v);
      inp.nextElementSibling!.textContent = fmtKnob(k, v);
    }
  };
  const apply = () => {
    host.opts.threshold = knobs.threshold; // the host reads its opts on every frame
    host.opts.alpha = knobs.alpha;
  };
  for (const [k, inp] of inputs)
    inp.addEventListener("input", () => {
      knobs[k as keyof typeof knobs] = Number(inp.value);
      inp.nextElementSibling!.textContent = fmtKnob(k, Number(inp.value));
      apply();
      poke();
      if (!raf) draw();
    });
  syncInputs();
  root.querySelector(".w-hlab-recal")!.addEventListener("click", () => {
    calibrateNow();
    poke();
    if (!raf) draw();
  });

  const offTheme = ctx.onTheme((_t: Theme) => {
    // tokens change with the theme attribute; read them on the next frame
    requestAnimationFrame(() => {
      makeRamp();
      draw();
    });
  });

  // a language switch: the words (the pad, its baseline, the fingers and the knobs carry on)
  const offLang = ctx.onLang(() => {
    paintText(root, S(), V);
    big.setAttribute("aria-label", fill(S().bigAria, V));
    for (const b of stageBtns) {
      const st = stageOf(b.dataset.stage as StageId);
      b.title = stageTip(st);
      // (the name is the text after the stage's number: a text node of its own, so English is drawn as it always was)
      const nm = b.querySelector(".w-hlab-sname b")?.nextSibling;
      if (nm?.nodeType === Node.TEXT_NODE) nm.nodeValue = ` ${stageText(st).name}`;
    }
    fit();
  });

  fit();
  // (reduced motion: the first second, so the baseline is taken and the first picture settles)
  poke(1200);
  schedule();


  /** The lines run(p) returns, in the language on show, without touching the lab (a language switch repaints the
   *  code card's console with them). */
  const say = (p: Record<string, number>): string[] => {
    const thr = Number.isFinite(p.threshold) ? p.threshold : knobs.threshold;
    const alpha = Number.isFinite(p.alpha) ? p.alpha : knobs.alpha;
    const T = S();
    return [
      fill(T.outViewer, { t: thr, a: alpha }),
      thr === 0 ? T.outT0 : fill(T.outT, { t: thr }),
      alpha >= 1 ? T.outA1 : fill(T.outA, { a: Math.round(alpha * 100), b: Math.round((1 - alpha) * 100) }),
      T.outDrag,
    ];
  };
  return {
    destroy() {
      offLang();
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      offTheme();
      root.remove();
    },
    run(p) {
      if (Number.isFinite(p.threshold)) knobs.threshold = p.threshold;
      if (Number.isFinite(p.alpha)) knobs.alpha = p.alpha;
      apply();
      syncInputs();
      poke();
      draw();
      return say(p);
    },
    say,
  };
}
