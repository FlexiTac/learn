// Robot grasp: FlexiTac on a robot hand, live. The reBot B601-DM arm (in its real colours: silver, black, Seeed
// lime; fin-shaped soft fingers, one FlexiTac pad on each finger) picks up a strawberry, lifts it, holds it and puts
// it back, as a 9 s seamless loop. The video frame holds the whole arm on the left and a round close-up of the
// gripper on the right (the same view, magnified, following the strawberry), where the amber pad on the right
// finger's face is plain to see; a "FlexiTac pad" tag points at it while the fingers hold still. Beside the video,
// the two pads' 12 x 32 touch maps light up in step with it. Made for Lesson 1 step 1 (mount it as the step's
// widget, filling the stage) and meant to be reused in Section 2.
//
// Media (built by flexitac-anatomy/figures/robot, see its README.md; ILLUSTRATIVE: rendered from CAD, the readings
// simulated with the VT-Refine taxel model, not measured):
//   public/media/robot/grasp-{light,dark}.{webm,mp4}   the loop, 30 fps, one per theme
//   public/media/robot/grasp-{light,dark}.webp         its poster: the strawberry held up (the "hold" moment)
//   public/media/robot/grasp-tactile.{json,bin}        one 2 x 32 x 12 uint8 map per video frame (json: the format,
//                                                       the close-up's circle and the pad tag's anchor, frame px)
//
// Layout: the video on the left, the two maps on the right, sized so the video and the maps' block (labels, 32
// rows, legend, caption) are the same height (they share the box as equals), both centred as one group. A box under
// 560 px wide (a phone, a 1024 px window's stage) stacks: the video on top, the two maps on their side (32 cells
// across, the fingertip row on the left) side by side under it, the video smaller where the box has a height of its
// own, so the arm and both maps are seen together. The maps
// ("Left finger", "Right finger" = as seen in the video) are each drawn like the pad on its finger: 32 rows along the finger
// with the fingertip row at the BOTTOM, 12 columns across, seen face-on from the strawberry (so the two maps mirror
// each other, like the two pads facing each other). Colours as Lesson 1's touch map (Fig 1 feel mode): viridis from
// @shared/models/viridis.mjs, 0 a quiet neutral, values under 0.1 blending in from it. The box is the element this
// is mounted in (any size; it fills it). With no height given (a stacked layout) it takes a height from its width.
//
// Sync: the maps show the frame the video is presenting (requestVideoFrameCallback's mediaTime; where that API is
// missing, a frame loop reading currentTime while playing, and timeupdate / seeked while paused).
// Motion: autoplay, muted, looping, only while the widget is on screen and the tab is visible; a play / pause button
// sits on the video (an auto-playing loop longer than 5 s needs one). Reduced motion: no video, the poster and the
// hold moment's maps. A theme switch swaps the video and keeps its place in the loop.
//
// Two forms (mount's third argument): "stage" (the default: Lesson 1 step 1, filling the lesson stage) and "cover"
// (the home page's hero picture, src/views/home.ts, inside a link to Lesson 1): the same video and maps, side by side
// at the same height, with only the heading and the two finger names around the maps (no pad tag, counts, fingertip
// marks, legend, caption or play button: the hero's own caption says "illustrative", and a button can't sit inside a
// link).
// The cover is decorative (aria-hidden): the link names it. Its maps are named just "Left" / "Right" (centred over
// each map: at hero size "Left finger Right finger" read as one phrase). The video draws the close-up's circle, the
// ring on the main view and the line joining them ~1 px wide in the 1400 px frame, so at hero size (~0.23x) they
// break into dots; the cover draws them again on top as an SVG with CSS-px strokes (.rg-zoom), placed from the json's
// closeup (c, r) and the ring's centre (the close-up's follow point projected per frame, see markAt), scaled like
// the pad tag.
import { VIRIDIS_RGB } from "@shared/models/viridis.mjs";
import { strings } from "../i18n";
import { paintText } from "../i18n/paint";
import type { Theme, WidgetCtx, WidgetInstance } from "../types";
import "./robot-grasp.css";

const BASE = `${import.meta.env.BASE_URL}media/robot` + "/";
const src = (t: Theme) => `${BASE}grasp-${t}`;

interface Meta {
  fps: number;
  frames: number;
  rows: number;
  cols: number;
  first: number;
  count: number;
  poster_frame: number;
  phases?: { name: string; start_s: number; duration_s: number }[];
  camera?: {
    width: number;
    height: number;
    azimuth?: number;
    elevation?: number;
    px_per_mm?: number;
    origin?: [number, number];
  };
  // the round close-up in the video frame (px) and where the visible pad is in it, for the frames it holds still
  closeup?: {
    c: [number, number];
    r: number;
    px_per_mm?: number;
    above_mat_mm?: number;
    pad_tag?: { x: number; y: number; frames: [number, number] };
  };
}

// The ring on the main view: the close-up's field drawn around the point the close-up follows (the json does not
// list it per frame; flexitac-anatomy/figures/robot rb_scene.inset_point + rb_compose.inset_geometry): x = berry_x
// 290 mm out from the base axis, y 0, z = the mat's top (1.5 mm) + closeup.above_mat_mm + (lift 70 - sag 0.5) mm x the
// lift (0 on the mat .. 1 held up, smootherstep over the lift / hold / lower phases), projected with the json's
// camera; its radius is the close-up's r in mm (r / closeup.px_per_mm) on the main view. Matches the video to 0.25 px.
const FOLLOW = { x: 290, z: 1.5, rise: 69.5 };
const smoother = (t: number) => {
  t = Math.min(1, Math.max(0, t));
  return t * t * t * (t * (6 * t - 15) + 10);
};
function liftAt(meta: Meta, f: number): number {
  const t = f / meta.fps;
  const ph = meta.phases ?? [];
  const p = ph.find((q) => t < q.start_s + q.duration_s - 1e-9) ?? ph[ph.length - 1];
  if (!p) return 0;
  const e = smoother((t - p.start_s) / p.duration_s);
  return p.name === "lift" ? e : p.name === "hold" ? 1 : p.name === "lower" ? 1 - e : 0;
}
/** The ring's centre and radius in frame px at frame f, or null if the json lacks the camera or the close-up. */
function markAt(meta: Meta, f: number): { x: number; y: number; r: number } | null {
  const cam = meta.camera;
  const cu = meta.closeup;
  if (!cam?.origin || cam.azimuth == null || cam.elevation == null || !cam.px_per_mm || !cu?.px_per_mm) return null;
  const A = (cam.azimuth * Math.PI) / 180;
  const E = (cam.elevation * Math.PI) / 180;
  const z = FOLLOW.z + (cu.above_mat_mm ?? 30) + FOLLOW.rise * liftAt(meta, f);
  return {
    x: cam.origin[0] + FOLLOW.x * Math.sin(A) * cam.px_per_mm,
    y: cam.origin[1] + (FOLLOW.x * Math.cos(A) * Math.sin(E) - z * Math.cos(E)) * cam.px_per_mm,
    r: (cu.r / cu.px_per_mm) * cam.px_per_mm,
  };
}
interface Data {
  meta: Meta;
  bytes: Uint8Array;
}

let dataPromise: Promise<Data> | null = null;
function loadData(): Promise<Data> {
  if (!dataPromise) {
    dataPromise = Promise.all([
      fetch(`${BASE}grasp-tactile.json`).then((r) => {
        if (!r.ok) throw new Error(`grasp-tactile.json: ${r.status}`);
        return r.json() as Promise<Meta>;
      }),
      fetch(`${BASE}grasp-tactile.bin`).then((r) => {
        if (!r.ok) throw new Error(`grasp-tactile.bin: ${r.status}`);
        return r.arrayBuffer();
      }),
    ]).then(([meta, buf]) => ({ meta, bytes: new Uint8Array(buf) }));
    dataPromise.catch(() => (dataPromise = null));
  }
  return dataPromise;
}

// ------------------------------------------------------------------ colours (as Fig 1's touch map)
type RGB = [number, number, number];
const VIR = VIRIDIS_RGB as unknown as number[][];
function parseColor(s: string, fb: RGB): RGB {
  const m = s.trim().match(/^#([0-9a-f]{6})$/i);
  if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) as RGB;
  const r = s.match(/rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/);
  return r ? [+r[1], +r[2], +r[3]] : fb;
}
function lutFor(zero: RGB): string[] {
  return Array.from({ length: 256 }, (_, q) => {
    if (q === 0) return `rgb(${zero.join(",")})`;
    const c = VIR[q];
    const t = Math.min(1, q / 255 / 0.1);
    return `rgb(${c.map((x, i) => Math.round(zero[i] + (x - zero[i]) * t)).join(",")})`;
  });
}

const PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z"/></svg>';
const PAUSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5.5h3.6v13H7zM13.4 5.5H17v13h-3.6z"/></svg>';
// the widget's words (docs/i18n.md): painted from S() and again on a language switch
const S = strings(
  {
    label:
      "Animation: a robot arm with soft, fin-shaped fingers. A thin FlexiTac touch pad is stuck on the inner face of each finger; a round close-up beside the arm shows the gripper bigger, with the amber pad on the right finger. The arm reaches down, closes its fingers on a strawberry, lifts it, holds it, puts it back and lets go. Beside it, two touch maps show what each pad feels: a patch of touch spots lights up while the fingers hold the strawberry, a little brighter while it hangs in the air, and goes dark when the fingers open.",
    tag: "FlexiTac pad",
    pause: "Pause the animation",
    play: "Play the animation",
    name: "What the pads feel",
    ill: "Illustrative",
    left: "Left finger",
    right: "Right finger",
    leftShort: "Left",
    rightShort: "Right",
    tip: "fingertip",
    lit: "{n} lit",
    light: "light",
    firm: "firm",
    cap1: "FlexiTac on each finger",
    cap3: "100 frames a second",
    cap4: "illustrative",
  },
  {
    label:
      "动画：一只带鳍形软指的机械臂。每个手指的内侧都贴着一块薄薄的 FlexiTac 触觉传感垫；机械臂旁边的圆形放大图把夹爪放大显示，右手指上的琥珀色传感垫清晰可见。机械臂向下伸，用手指夹住一颗草莓，把它拿起、停住、放回，再松开。旁边的两张触觉图显示每块传感垫感受到的东西：手指夹住草莓时，一片触摸点亮起；草莓悬在空中时更亮一些；手指张开后又变暗。",
    tag: "FlexiTac 传感垫",
    pause: "暂停动画",
    play: "播放动画",
    name: "传感垫感受到的",
    ill: "示意",
    left: "左手指",
    right: "右手指",
    leftShort: "左指",
    rightShort: "右指",
    tip: "指尖",
    lit: "{n} 个亮起",
    light: "轻",
    firm: "重",
    cap1: "每个手指上一块 FlexiTac",
    cap3: "每秒 100 帧",
    cap4: "示意",
  },
);

let seq = 0;

export interface RobotGraspOpts {
  /** "stage" (default): the lesson's stage picture. "cover": the home page hero (see the header). */
  form?: "stage" | "cover";
}

export function mount(el: HTMLElement, ctx: WidgetCtx, opts: RobotGraspOpts = {}): WidgetInstance {
  const reduced = ctx.reducedMotion();
  const cover = opts.form === "cover";
  const id = `rg${++seq}`;
  const root = document.createElement("div");
  root.className = "rg";
  if (cover) {
    root.dataset.form = "cover";
    root.setAttribute("aria-hidden", "true");
  }
  root.innerHTML = `
    <div class="rg-row">
    <div class="rg-media">
      <img class="rg-poster" alt="" decoding="async">${cover ? "" : `
      <div class="rg-alt" role="img" aria-label="${S().label}" data-t-aria="label"></div>`}
      <div class="rg-tag" aria-hidden="true" hidden><span class="rg-tag-card mono" data-t="tag">${S().tag}</span></div>${
        cover
          ? `
      <svg class="rg-zoom" aria-hidden="true" focusable="false" hidden><g><circle class="rg-zoom-frame"/><circle class="rg-zoom-mark"/><line class="rg-zoom-link"/></g></svg>`
          : ""
      }
      <button type="button" class="rg-play" aria-pressed="false" aria-label="${S().pause}" hidden>${PAUSE}</button>
    </div>
    <div class="rg-side">
      <p class="rg-kicker mono" id="${id}-k"><span class="rg-name" data-t="name">${S().name}</span><span class="rg-sep" aria-hidden="true">·</span><span class="rg-ill" data-t="ill">${S().ill}</span></p>
      <div class="rg-maps" aria-hidden="true">
        <figure class="rg-map"><figcaption class="mono"><span class="rg-fname" data-t="${cover ? "leftShort" : "left"}">${cover ? S().leftShort : S().left}</span><span class="rg-count"></span></figcaption><canvas></canvas><span class="rg-tip mono" data-t="tip">${S().tip}</span></figure>
        <figure class="rg-map"><figcaption class="mono"><span class="rg-fname" data-t="${cover ? "rightShort" : "right"}">${cover ? S().rightShort : S().right}</span><span class="rg-count"></span></figcaption><canvas></canvas><span class="rg-tip mono" data-t="tip">${S().tip}</span></figure>
      </div>
      <div class="rg-legend mono" aria-hidden="true"><span data-t="light">${S().light}</span><i class="rg-ramp"></i><span data-t="firm">${S().firm}</span></div>
    </div>
    </div>
    <p class="rg-cap mono"><span data-t="cap1">${S().cap1}</span> · <span>12 × 32</span> · <span data-t="cap3">${S().cap3}</span> · <span data-t="cap4">${S().cap4}</span></p>`;
  el.append(root);
  const media = root.querySelector<HTMLElement>(".rg-media")!;
  const poster = root.querySelector<HTMLImageElement>(".rg-poster")!;
  const playBtn = root.querySelector<HTMLButtonElement>(".rg-play")!;
  const tag = root.querySelector<HTMLElement>(".rg-tag")!;
  const zoom = root.querySelector<SVGSVGElement>(".rg-zoom");
  const side = root.querySelector<HTMLElement>(".rg-side")!;
  const cap = root.querySelector<HTMLElement>(".rg-cap")!;
  const maps = [...root.querySelectorAll<HTMLElement>(".rg-map")];
  const canvases = maps.map((m) => m.querySelector("canvas")!);
  const counts = maps.map((m) => m.querySelector<HTMLElement>(".rg-count")!);

  let theme: Theme = ctx.theme();
  let data: Data | null = null;
  let aspect = 1400 / 1080;
  let lut = lutFor([226, 226, 221]);
  let shown = -1;
  let cellPx = 10;
  /** The stacked form draws the maps on their side (32 cells across, 12 down), side by side under the video. */
  let sideways = false;
  let video: HTMLVideoElement | null = null;
  let userPaused = false;
  let onscreen = true;
  let visible = !document.hidden;
  let raf = 0;
  let vfc = 0;
  let destroyed = false;

  const fps = () => data?.meta.fps ?? 30;
  const frames = () => data?.meta.frames ?? 270;
  const wrap = (f: number) => ((f % frames()) + frames()) % frames();
  // a presented frame's timestamp (rVFC mediaTime; containers round it, e.g. WebM to 1 ms) -> nearest frame;
  // a playback position (currentTime, between two frames) -> the frame on screen
  const frameOfPts = (t: number) => wrap(Math.round(t * fps()));
  const frameAt = (t: number) => wrap(Math.floor(t * fps() + 0.02));

  // ---------------------------------------------------------------- maps
  function readColors() {
    lut = lutFor(parseColor(getComputedStyle(root).getPropertyValue("--rg-map-zero") || "#e3e3de", [226, 226, 221]));
  }
  function valuesAt(f: number, finger: number): Uint8Array | null {
    if (!data) return null;
    const { first, count, rows, cols } = data.meta;
    if (f < first || f >= first + count) return null;
    const n = rows * cols;
    const off = ((f - first) * 2 + finger) * n;
    return data.bytes.subarray(off, off + n);
  }
  function draw(f: number) {
    shown = f;
    root.dataset.frame = String(f); // (read by review/harness/robot-grasp-shot.mjs)
    const pt = data?.meta.closeup?.pad_tag;
    tag.toggleAttribute("data-on", !!pt && f >= pt.frames[0] && f <= pt.frames[1]);
    if (zoom) placeZoom(f);
    const rows = data?.meta.rows ?? 32;
    const cols = data?.meta.cols ?? 12;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    for (let k = 0; k < 2; k++) {
      const cv = canvases[k];
      const g = cv.getContext("2d");
      if (!g) continue;
      const v = valuesAt(f, k);
      const p = cellPx * dpr;
      const gap = Math.max(1, Math.round(p * 0.09));
      g.clearRect(0, 0, cv.width, cv.height);
      let lit = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const q = v ? v[r * cols + c] : 0;
          if (q) lit++;
          g.fillStyle = lut[q];
          if (sideways) {
            // on its side (the stacked form): a quarter turn clockwise, the fingertip row on the LEFT
            const x = Math.round(r * p);
            const y = Math.round(c * p);
            g.fillRect(x, y, Math.round((r + 1) * p) - x - gap, Math.round((c + 1) * p) - y - gap);
          } else {
            // upright: row 0 (the fingertip row) at the bottom
            const y = Math.round((rows - 1 - r) * p);
            const x = Math.round(c * p);
            g.fillRect(x, y, Math.round((c + 1) * p) - x - gap, Math.round((rows - r) * p) - y - gap);
          }
        }
      }
      counts[k].textContent = lit ? S().lit.replace("{n}", String(lit)) : "\u00a0"; // (keeps its line: nothing jumps when touch starts)
    }
  }
  const show = (f: number) => {
    if (f !== shown) draw(f);
  };

  // ---------------------------------------------------------------- layout: the video and the maps' block (each map
  // 12 x 32 cells) side by side at the same height, centred as one group; the caption under both. A box under 560 px
  // wide (a phone, a 1024 px window's stage, a narrow column): the video on top and the two maps on their side, side
  // by side under it (a phone sees the arm and both maps on one screen, the steps bar under them); a box with a height
  // of its own shrinks the video so the whole picture fits it.
  /** The box's own height (px), or 0 when it takes the picture's (a phone's stacked stage: its height is auto). */
  function boxHeight(): number {
    if (cover) return el.clientHeight;
    const d = root.style.display;
    root.style.display = "none";
    const h = el.clientHeight;
    root.style.display = d;
    return h > 40 ? h : 0;
  }
  function layout(textH = 132, refit = true, again = true) {
    const cs = getComputedStyle(root);
    const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    const W = Math.max(200, root.clientWidth - padX);
    // (the cover keeps its side-by-side form at any size: the home page shows it only on wide windows. Tested on the
    // width less the side-by-side form's 20 px side padding: data-narrow's smaller padding would flip its own test)
    const narrow = !cover && root.clientWidth - 40 < 560;
    const was = root.hasAttribute("data-narrow");
    root.toggleAttribute("data-narrow", narrow);
    // (data-narrow changes the padding read above: once more with the padding it has now, e.g. a phone turned upright,
    // whose box's new size is the only resize the observer sees)
    if (narrow !== was && again) return layout(textH, refit, false);
    sideways = narrow;
    // (a side-by-side box under 632 px: its maps are narrower than "Right finger", which would run past the box's edge;
    // the finger names wrap to their maps' width instead, robot-grasp.css)
    const wrap = !cover && !narrow && root.clientWidth - 40 < 592;
    root.toggleAttribute("data-wrap", wrap);
    const csN = getComputedStyle(root);
    const padY = parseFloat(csN.paddingTop) + parseFloat(csN.paddingBottom);
    const boxH = boxHeight();
    const givenH = boxH > 40 ? boxH - padY : 0;
    const gap = cover ? Math.round(Math.min(22, Math.max(10, W * 0.03))) : Math.round(Math.min(40, Math.max(14, W * 0.028)));
    let mapGap = cover ? Math.round(Math.min(14, Math.max(6, W * 0.016))) : Math.round(Math.min(26, Math.max(10, W * 0.016)));
    const rows = data?.meta.rows ?? 32;
    const cols = data?.meta.cols ?? 12;
    let H = 0;
    // (the finger names over the maps: two maps side by side keep at least 12 px between their names)
    const nameW = cover ? 0 : Math.max(...maps.map((m) => m.querySelector<HTMLElement>(".rg-fname")!.getBoundingClientRect().width));
    const sizeCanvases = () => {
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      const [w, h] = sideways ? [rows, cols] : [cols, rows];
      for (const cv of canvases) {
        cv.width = Math.round(w * cellPx * dpr);
        cv.height = Math.round(h * cellPx * dpr);
        cv.style.width = `${w * cellPx}px`;
        cv.style.height = `${h * cellPx}px`;
      }
      side.style.setProperty("--rg-map-w", `${w * cellPx}px`);
    };
    root.style.setProperty("--rg-cap-w", `${Math.round(W)}px`);
    if (narrow) {
      // the maps on their side, side by side, as wide as the box allows (cells up to 9 px); the video above them at
      // the box's width, or smaller where the box's own height would cut the picture
      // (18 px or more between the two maps: one map's count never reads as the other's name, "48 lit Right finger";
      // in a box with its own height, cells up to 7 px, so the video keeps more of it)
      mapGap = Math.max(18, mapGap);
      cellPx = Math.max(3, Math.min(givenH ? 7 : 9, Math.floor(((W - mapGap) / 2 / rows) * 4) / 4));
      root.style.setProperty("--rg-map-gap", `${mapGap}px`);
      root.toggleAttribute("data-tight", rows * cellPx < 150);
      sizeCanvases();
      let vw = W;
      media.style.width = `${vw}px`;
      media.style.height = `${vw / aspect}px`;
      root.style.height = "";
      if (givenH) {
        const rest = root.getBoundingClientRect().height - padY - vw / aspect;
        vw = Math.max(160, Math.min(W, (givenH - rest) * aspect));
        media.style.width = `${Math.round(vw)}px`;
        media.style.height = `${Math.round(vw / aspect)}px`;
        root.style.height = `${boxH}px`;
      }
    } else {
      // the caption runs under the whole widget, in one line where it fits
      const capH = cover ? 0 : cap.getBoundingClientRect().height + parseFloat(cs.rowGap || "0");
      // textH: the side panel's height besides the maps (kicker, labels, fingertip, legend, caption). The video and
      // the maps' block get the same height: vw = W - gaps - 2 cols c, and vw / aspect = rows c + textH, so
      // c = (W - gaps - aspect textH) / (2 cols + aspect rows); then both are capped by the box's height
      H = Math.max(240, givenH ? givenH - capH : Math.min(760, W * 0.62));
      const cellFor = (mg: number) => {
        let cell = (W - gap - mg - aspect * textH) / (2 * cols + aspect * rows);
        cell = Math.max(4, Math.min(cell, (H - textH) / rows));
        return Math.max(4, Math.floor(cell * 4) / 4);
      };
      cellPx = cellFor(mapGap);
      // (names wider than their maps: more room between the maps, so "Left finger" and "Right finger" never touch)
      if (!wrap && nameW > cols * cellPx - 4) {
        mapGap = Math.ceil(Math.max(mapGap, nameW - cols * cellPx + 14));
        cellPx = cellFor(mapGap);
      }
      const vw = Math.min(W - gap - mapGap - 2 * cols * cellPx, H * aspect);
      media.style.width = `${Math.round(vw)}px`;
      media.style.height = `${Math.round(vw / aspect)}px`;
      root.style.setProperty("--rg-gap", `${gap}px`);
      root.style.height = givenH ? "" : `${Math.round(H + capH + padY)}px`;
      root.style.setProperty("--rg-map-gap", `${mapGap}px`);
      // a narrow map: its count goes under its name (the cover has no counts)
      root.toggleAttribute("data-tight", !cover && cols * cellPx < 176);
      sizeCanvases();
    }
    // measure the text around the maps once laid out: if it differs from what was assumed, fit once more with it
    if (!narrow && refit) {
      const real = side.getBoundingClientRect().height - rows * cellPx;
      if (Math.abs(real - textH) > 3) {
        layout(Math.ceil(real) + 2, false);
        return;
      }
    }
    placeTag();
    readColors();
    draw(shown < 0 ? (data?.meta.poster_frame ?? 0) : shown);
  }

  // the "FlexiTac pad" tag: a card above the close-up, its leader straight down to the pad (frame px -> box px)
  function placeTag() {
    const cu = data?.meta.closeup;
    const pt = cu?.pad_tag;
    const fw = data?.meta.camera?.width;
    if (!cu || !pt || !fw) {
      tag.hidden = true;
      return;
    }
    const k = parseFloat(media.style.width) / fw;
    tag.hidden = false;
    tag.style.left = `${(pt.x * k).toFixed(1)}px`;
    tag.style.setProperty("--rg-tag-top", `${((cu.c[1] - cu.r) * k).toFixed(1)}px`);
    tag.style.setProperty("--rg-tag-y", `${(pt.y * k).toFixed(1)}px`);
  }

  // the cover's crisp close-up lines (see the header): the close-up's circle, the ring on the main view (it moves with
  // the lift, so it is placed every frame) and the line between their centres, under the circles' strokes as one
  // group (one opacity: no darker spots where they meet). Frame px -> box px as the pad tag (k = box width / frame
  // width; object-fit: contain also centres the frame in the box's rounded height, a fraction of a px)
  const ZOOM_W = 1.25; // the ring and the line (CSS px)
  const ZOOM_FRAME_W = 1.5; // the close-up's circle (the video's is heavier too: 1.4 vs 1.1 frame px)
  function placeZoom(f: number) {
    if (!zoom) return;
    const meta = data?.meta;
    const cu = meta?.closeup;
    const fw = meta?.camera?.width;
    const fh = meta?.camera?.height;
    const m = meta ? markAt(meta, f) : null;
    const w = parseFloat(media.style.width);
    const h = parseFloat(media.style.height);
    if (!cu || !fw || !fh || !m || !(w > 0) || !(h > 0)) {
      zoom.setAttribute("hidden", "");
      return;
    }
    const k = Math.min(w / fw, h / fh);
    const x0 = (w - fw * k) / 2;
    const y0 = (h - fh * k) / 2;
    const [frame, mark, link] = zoom.querySelectorAll<SVGElement>("circle, line");
    const set = (e: SVGElement, a: Record<string, number>) => {
      for (const n in a) e.setAttribute(n, a[n].toFixed(2));
    };
    const cx = x0 + cu.c[0] * k;
    const cy = y0 + cu.c[1] * k;
    const R = cu.r * k;
    const mx = x0 + m.x * k;
    const my = y0 + m.y * k;
    const mr = m.r * k;
    set(frame, { cx, cy, r: R, "stroke-width": ZOOM_FRAME_W });
    set(mark, { cx: mx, cy: my, r: mr, "stroke-width": ZOOM_W });
    const d = Math.hypot(cx - mx, cy - my);
    const ux = (cx - mx) / d;
    const uy = (cy - my) / d;
    if (d > mr + R + 2) {
      set(link, { x1: mx + ux * mr, y1: my + uy * mr, x2: cx - ux * R, y2: cy - uy * R, "stroke-width": ZOOM_W });
      link.removeAttribute("visibility");
    } else link.setAttribute("visibility", "hidden");
    zoom.removeAttribute("hidden");
  }

  // ---------------------------------------------------------------- video
  function setPoster() {
    poster.src = `${src(theme)}.webp`;
  }
  function wantPlay() {
    return !!video && !reduced && !userPaused && onscreen && visible && !destroyed;
  }
  function sync() {
    if (!video) return;
    if (wantPlay()) {
      if (video.paused) video.play().catch(() => {});
    } else if (!video.paused) video.pause();
    loopFallback();
  }
  function onVideoFrame(_now: number, meta: VideoFrameCallbackMetadata) {
    if (!video) return;
    show(frameOfPts(meta.mediaTime));
    vfc = video.requestVideoFrameCallback(onVideoFrame);
  }
  // no requestVideoFrameCallback: follow currentTime every animation frame while playing
  function loopFallback() {
    if (!video || "requestVideoFrameCallback" in HTMLVideoElement.prototype) return;
    const run = !video.paused;
    if (run && !raf) {
      const tick = () => {
        raf = 0;
        if (!video || video.paused) return;
        show(frameAt(video.currentTime));
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    } else if (!run && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }
  function makeVideo() {
    const at = video ? video.currentTime : data ? data.meta.poster_frame / fps() : 0;
    if (video) {
      if (vfc && "cancelVideoFrameCallback" in video) video.cancelVideoFrameCallback(vfc);
      video.pause();
      video.remove();
    }
    const v = document.createElement("video");
    v.className = "rg-video";
    v.muted = true;
    v.loop = true;
    v.playsInline = true;
    v.preload = "auto";
    v.setAttribute("muted", "");
    v.setAttribute("playsinline", "");
    v.setAttribute("disablepictureinpicture", "");
    v.setAttribute("aria-hidden", "true");
    v.tabIndex = -1;
    v.poster = `${src(theme)}.webp`;
    v.innerHTML = `<source src="${src(theme)}.webm" type='video/webm; codecs="vp9"'><source src="${src(theme)}.mp4" type="video/mp4">`;
    v.addEventListener(
      "loadedmetadata",
      () => {
        v.currentTime = at % (v.duration || 9);
        show(frameAt(v.currentTime));
        sync();
      },
      { once: true },
    );
    v.addEventListener("seeked", () => show(frameAt(v.currentTime)));
    v.addEventListener("timeupdate", () => {
      if (v.paused) show(frameAt(v.currentTime));
    });
    v.addEventListener("play", () => {
      playBtn.innerHTML = PAUSE;
      playBtn.setAttribute("aria-pressed", "false");
      playBtn.setAttribute("aria-label", S().pause);
      loopFallback();
    });
    v.addEventListener("pause", () => {
      playBtn.innerHTML = PLAY;
      playBtn.setAttribute("aria-pressed", "true");
      playBtn.setAttribute("aria-label", S().play);
      loopFallback();
    });
    // a video that cannot play leaves the poster and the hold moment's maps
    v.lastElementChild!.addEventListener("error", () => {
      v.remove();
      if (video === v) video = null;
      playBtn.hidden = true;
      show(data?.meta.poster_frame ?? 0);
    });
    media.insertBefore(v, playBtn);
    video = v;
    if ("requestVideoFrameCallback" in v) vfc = v.requestVideoFrameCallback(onVideoFrame);
    v.load();
    playBtn.hidden = cover;
  }
  playBtn.addEventListener("click", () => {
    userPaused = !userPaused;
    sync();
  });

  // ---------------------------------------------------------------- lifecycle
  // (on the next frame: a stacked picture sets its own box's height, which would notify this observer again within
  // the same frame, "ResizeObserver loop completed with undelivered notifications"; and only when the box really
  // changed size)
  let roKey = "";
  let roRaf = 0;
  const ro = new ResizeObserver(() => {
    const key = `${el.clientWidth}x${el.clientHeight}`;
    if (key === roKey || roRaf) return;
    roRaf = requestAnimationFrame(() => {
      roRaf = 0;
      if (destroyed) return;
      layout();
      roKey = `${el.clientWidth}x${el.clientHeight}`;
    });
  });
  ro.observe(el);
  const io = new IntersectionObserver((es) => {
    onscreen = es[es.length - 1].isIntersecting;
    sync();
  });
  io.observe(root);
  const onVis = () => {
    visible = !document.hidden;
    sync();
  };
  document.addEventListener("visibilitychange", onVis);
  const offTheme = ctx.onTheme((t) => {
    theme = t;
    setPoster();
    // let the theme's tokens land before reading the map's neutral
    requestAnimationFrame(() => {
      readColors();
      draw(shown < 0 ? 0 : shown);
    });
    if (video) makeVideo();
  });

  // a language switch: the words again (the video, its place in the loop and the maps stay), then the fit, which
  // measures the text round the maps
  const offLang = ctx.onLang(() => {
    paintText(root, S());
    playBtn.setAttribute("aria-label", playBtn.getAttribute("aria-pressed") === "true" ? S().play : S().pause);
    layout();
  });

  setPoster();
  layout();
  loadData()
    .then((d) => {
      if (destroyed) return;
      data = d;
      if (d.meta.camera) aspect = d.meta.camera.width / d.meta.camera.height;
      layout();
      show(d.meta.poster_frame);
      if (!reduced) makeVideo();
    })
    .catch(() => {
      root.setAttribute("data-error", "");
      counts[0].textContent = "";
    });

  return {
    layout: () => layout(),
    destroy() {
      destroyed = true;
      if (raf) cancelAnimationFrame(raf);
      if (roRaf) cancelAnimationFrame(roRaf);
      if (video) {
        if (vfc && "cancelVideoFrameCallback" in video) video.cancelVideoFrameCallback(vfc);
        video.pause();
        video.innerHTML = "";
        video.load();
      }
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      offTheme();
      offLang();
      root.remove();
    },
  };
}
