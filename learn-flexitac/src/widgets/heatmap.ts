// Heatmap widget (lesson 5, Bytes to touch). The same pipeline as the real system, end to end, using the shared models:
//   press map -> scan.frameBytes (taxel curve -> divider -> ADC -> >>2, firmware scan order) -> 386-byte frame
//   -> host.createHost (header sync, 30-frame median baseline, threshold, normalise, EMA) -> viridis colours.
// Drag (or use the arrow keys + Space) to press. run({threshold, alpha}) re-tunes the host like editing the viewer.
import { COLS, FRAME_HZ, INIT_FRAMES, ROWS } from "@shared/data/constants.mjs";
import { createHost } from "@shared/models/host.mjs";
import { frameBytes as frameBytesJs } from "@shared/models/scan.mjs";
import { ILLUSTRATIVE } from "@shared/models/taxel.mjs";
import type { WidgetCtx, WidgetInstance } from "../types";
import { h } from "../ui/dom";

// scan.mjs is plain JS; TS infers `input = null` too narrowly, so give it its documented type.
const frameBytes = frameBytesJs as (input?: null | number[][] | ((row: number, col: number) => number)) => Uint8Array;

const CELL = 18;
const W = COLS * CELL;
const HGT = ROWS * CELL;

export function mount(el: HTMLElement, ctx: WidgetCtx): WidgetInstance {
  const root = h("div", { class: "w-heat" });
  root.innerHTML = `
    <div class="w-heat-head">
      <span class="w-kicker">Live heatmap · simulated</span>
      ${ILLUSTRATIVE ? '<span class="badge badge-illustrative" title="No force data exists: press strength is unitless">illustrative</span>' : ""}
    </div>
    <canvas class="w-heat-canvas" width="${W}" height="${HGT}" tabindex="0" role="img"
      aria-label="Heatmap of ${ROWS} by ${COLS} taxels. Drag, or use the arrow keys and hold Space, to press."></canvas>
    <p class="w-heat-read mono" aria-live="polite"></p>`;
  el.append(root);
  const canvas = root.querySelector("canvas")!;
  const read = root.querySelector<HTMLElement>(".w-heat-read")!;
  const g = canvas.getContext("2d")!;
  const img = g.createImageData(COLS, ROWS);
  const off = document.createElement("canvas");
  off.width = COLS;
  off.height = ROWS;
  const og = off.getContext("2d")!;

  let opts = { threshold: 15, alpha: 0.2 };
  let host = createHost(opts);
  const rest = frameBytes(null);
  const calibrate = () => {
    host = createHost(opts);
    for (let i = 0; i < INIT_FRAMES; i++) host.feed(rest);
  };
  calibrate();

  const finger = { r: 5.5, c: 16, on: false, press: 0 };
  const pressAt = (r: number, c: number) => {
    if (finger.press <= 0) return 0;
    const d2 = ((r - finger.r) ** 2 + ((c - finger.c) / 1.15) ** 2) / 2.2;
    return finger.press * Math.exp(-d2);
  };

  let raf = 0;
  let last = 0;
  let acc = 0;
  let lastRaw: Uint8Array | null = null;
  const period = 1 / Math.min(FRAME_HZ, 30); // simulate at <= 30 frames/s; the real sensor runs at FRAME_HZ

  function frame(now: number) {
    raf = 0;
    const dt = last ? Math.min(0.1, (now - last) / 1000) : period;
    last = now;
    const goal = finger.on ? 0.85 : 0;
    finger.press += (goal - finger.press) * Math.min(1, dt * (ctx.reducedMotion() ? 60 : 9));
    if (Math.abs(goal - finger.press) < 0.002) finger.press = goal;
    acc += dt;
    if (acc >= period) {
      acc = 0;
      const res = host.feed(frameBytes((r: number, c: number) => pressAt(r, c)));
      lastRaw = res.at(-1)?.raw ?? lastRaw;
      host.tick();
      draw();
    }
    const settling = finger.on || finger.press > 0 || host.filtered.some((v: number) => v > 0.002);
    if (settling) raf = requestAnimationFrame(frame);
    else last = 0;
  }
  const kick = () => {
    if (!raf) raf = requestAnimationFrame(frame);
  };

  function draw() {
    const rgb = host.image();
    for (let k = 0; k < ROWS * COLS; k++) {
      img.data[4 * k] = rgb[3 * k];
      img.data[4 * k + 1] = rgb[3 * k + 1];
      img.data[4 * k + 2] = rgb[3 * k + 2];
      img.data[4 * k + 3] = 255;
    }
    og.putImageData(img, 0, 0);
    g.imageSmoothingEnabled = false;
    g.drawImage(off, 0, 0, W, HGT);
    // taxel grid
    g.strokeStyle = "rgba(0,0,0,.25)";
    g.lineWidth = 1;
    g.beginPath();
    for (let c = 1; c < COLS; c++) (g.moveTo(c * CELL + 0.5, 0), g.lineTo(c * CELL + 0.5, HGT));
    for (let r = 1; r < ROWS; r++) (g.moveTo(0, r * CELL + 0.5), g.lineTo(W, r * CELL + 0.5));
    g.stroke();
    const r = Math.round(finger.r);
    const c = Math.round(finger.c);
    g.strokeStyle = "#fff";
    g.lineWidth = 2;
    g.strokeRect(c * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2);
    const raw = lastRaw ? lastRaw[r * COLS + c] : rest[2 + r * COLS + c];
    read.textContent = `sense line ${r} · drive line ${c} · byte ${raw} · shown ${host.filtered[r * COLS + c].toFixed(2)}`;
  }

  const toCell = (e: PointerEvent) => {
    const b = canvas.getBoundingClientRect();
    finger.c = Math.max(0, Math.min(COLS - 1, ((e.clientX - b.left) / b.width) * COLS - 0.5));
    finger.r = Math.max(0, Math.min(ROWS - 1, ((e.clientY - b.top) / b.height) * ROWS - 0.5));
  };
  const down = (e: PointerEvent) => {
    canvas.setPointerCapture(e.pointerId);
    toCell(e);
    finger.on = true;
    kick();
  };
  const move = (e: PointerEvent) => {
    if (!finger.on) return;
    toCell(e);
    kick();
  };
  const up = () => {
    finger.on = false;
    kick();
  };
  const key = (e: KeyboardEvent) => {
    const step: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (step[e.key]) {
      finger.r = Math.max(0, Math.min(ROWS - 1, Math.round(finger.r) + step[e.key][0]));
      finger.c = Math.max(0, Math.min(COLS - 1, Math.round(finger.c) + step[e.key][1]));
    } else if (e.key === " " && !e.repeat) finger.on = true;
    else return;
    e.preventDefault();
    draw();
    kick();
  };
  const keyUp = (e: KeyboardEvent) => {
    if (e.key === " ") (finger.on = false), kick();
  };
  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("keydown", key);
  canvas.addEventListener("keyup", keyUp);
  draw();

  return {
    destroy() {
      cancelAnimationFrame(raf);
      root.remove();
    },
    run(p) {
      opts = { threshold: p.threshold ?? opts.threshold, alpha: p.alpha ?? opts.alpha };
      calibrate();
      draw();
      return [`host: threshold ${opts.threshold}, alpha ${opts.alpha}`, `baseline rebuilt from ${INIT_FRAMES} resting frames — drag on the heatmap`];
    },
  };
}
