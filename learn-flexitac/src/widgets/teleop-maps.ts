// Teleop maps (Lesson 2.2 "Grasp with your mouse"): what the gripper's two FlexiTac pads feel while the learner drives
// Fig 5's teleop mode (figures/EMBED.md "Fig 5 gripper: teleop mode"). Fig 5 computes every frame with the shared touch
// engine (shared/models/touchsim.mjs: each pad's 12 x 32 taxel points against the objects' shapes, spring + damper per
// taxel, the viewer's normalisation) and posts it as ft:touch {mode: 'teleop', left, right, total, ...}; this widget
// draws it: the LEFT and RIGHT finger maps in Lesson 1's look (Fig 1 feel mode / the robot grasp: square cells with a
// hairline gap, viridis, an untouched spot a quiet neutral, values under 0.1 blending in from it), each finger's lit
// count and force, and a total-force bar with a mark at the squeeze the touched object needs to lift (its weight over
// the pads' friction, illustrative). Nothing here simulates: it only shows the figure's frames.
//
// Map orientation (as Lesson 1's robot grasp): each map is its pad seen face-on from the object it holds, so the two
// mirror each other like the pads facing each other; value index k = i * 32 + j (i = sense line 0-11 across the
// finger, j = drive line 0-31 along it, j = 0 at the fingertip). Two forms, chosen from the box:
//   "row"    (a wide, short box: the split stage's widget row) the maps lie down, fingertip at the LEFT, sense line
//            11 at the top; the force block on the right.
//   "column" (a taller box) the maps stand up, fingertip at the BOTTOM, sense line 11 at the left; the force block under
//            them.
// The widget asks the split stage for its short row (the slot's data-row="short", src/styles/lesson.css), so the
// teleop figure keeps most of the stage; opts.row = null leaves the row alone.
//
// Source of frames: messages from the lesson figure's iframe (ctx.figure.iframe), or opts.source (a window or an
// iframe), or, with neither, any iframe's Fig 5 frames. A figure that reloads (theme or layout switch) clears the maps
// until its next frame. feed(msg) draws a frame directly (tests, a host that relays frames itself).
import { VIRIDIS_RGB } from "@shared/models/viridis.mjs";
import { fill as fillVars, lang, strings } from "../i18n";
import { paintText, setTextBeside } from "../i18n/paint";
import type { WidgetCtx, WidgetInstance } from "../types";
import "./teleop-maps.css";

/** One pad's frame in Fig 5's teleop ft:touch (values 0..1 after the viewer's normalisation). */
export interface TeleopPadFrame {
  senses: number;
  drives: number;
  /** senses x drives values 0..1, values[i * drives + j]. */
  values: number[];
  /** The pad's force over the motor's stall force, 0..1. */
  press: number;
  /** The force-weighted centre in fractional line indices, or null when nothing touches. */
  at: { sense: number; drive: number } | null;
  /** The pad's total force (N, illustrative). */
  force: number;
  /** Taxels above zero after the normalisation. */
  lit: number;
}

/** Fig 5's teleop ft:touch message (figures/EMBED.md). */
export interface TeleopTouch {
  type: "ft:touch";
  fig: "gripper";
  mode: "teleop";
  left: TeleopPadFrame;
  right: TeleopPadFrame;
  /** Both pads' force (N). */
  total: number;
  /** The object held, or else the one either pad touches ("strawberry" | "cube"), or null. */
  object: string | null;
  /** That object's name in words ("strawberry", "cube"). */
  name?: string | null;
  held: boolean;
  /** How far the held object is off the mat (mm). */
  lift: number;
  /** The total squeeze (N) the touched object needs to lift (its weight over the friction), or null. */
  need?: number | null;
  grip: boolean;
  /** The motor's stall force per pad (N). */
  stall: number;
  illustrative: boolean;
}

export interface TeleopMapsOpts {
  /** Where the frames come from (default: the lesson figure's iframe; with none, any iframe's Fig 5 frames). */
  source?: Window | HTMLIFrameElement | null;
  /** "auto" (default) picks "row" for a wide, short box and "column" otherwise. */
  form?: "auto" | "row" | "column";
  /** The split stage's row this widget asks for on its slot (data-row), or null to leave it. Default "short". */
  row?: "short" | null;
}

export interface TeleopMapsInstance extends WidgetInstance {
  /** Draw one frame (a TeleopTouch), or clear the maps with null. */
  feed(msg: TeleopTouch | null): void;
  /** The form in use. */
  readonly form: "row" | "column";
}

type RGB = [number, number, number];
const VIR = VIRIDIS_RGB as unknown as number[][];
const ROWS = 12;
const COLS = 32;
const FORCE_MAX = 12; // N: the bar's full scale (two pads at the stall force, 10 N, with room above)
// the widget's words (docs/i18n.md): painted from S() and again on a language switch
const S = strings(
  {
    name: "What the pads feel",
    ill: "Illustrative",
    mapsAria: "The left and right fingers' touch maps: 12 by 32 touch spots each, coloured by how hard each spot is pressed.",
    left: "Left finger",
    right: "Right finger",
    tip: "tip",
    total: "Total force",
    toLift: "to lift",
    light: "light",
    firm: "firm",
    count: "{lit} lit · {force} N",
    strawberry: "strawberry",
    cube: "cube",
    waiting: "Waiting for the gripper…",
    holdingUp: "Holding the {name} {mm} mm up.",
    holding: "Holding the {name}. Lift it.",
    bothWeak: "Both pads on the {name}: not yet enough squeeze to lift it.",
    both: "Both pads on the {name}.",
    onlyLeft: "Only the left pad touches the {name}.",
    onlyRight: "Only the right pad touches the {name}.",
    closing: "Closing on nothing.",
    nothing: "Nothing touches the pads.",
  },
  {
    name: "传感垫感受到的",
    ill: "示意",
    mapsAria: "左右两个手指的触觉图：每张 12 × 32 个触摸点，颜色表示每个点被按得多重。",
    left: "左手指",
    right: "右手指",
    tip: "指尖",
    total: "总力",
    toLift: "抬起所需",
    light: "轻",
    firm: "重",
    count: "{lit} 个亮起 · {force} N",
    strawberry: "草莓",
    cube: "立方体",
    waiting: "等待夹爪……",
    holdingUp: "夹着{name}，已抬起 {mm} mm。",
    holding: "夹住了{name}。把它抬起来。",
    bothWeak: "两块传感垫都碰到了{name}：夹得还不够紧，拿不起来。",
    both: "两块传感垫都碰到了{name}。",
    onlyLeft: "只有左边的传感垫碰到了{name}。",
    onlyRight: "只有右边的传感垫碰到了{name}。",
    closing: "夹爪合上了，但没夹到东西。",
    nothing: "没有东西碰到传感垫。",
  },
);
/** An object's name in the current language: the figure's own name in English (as before), ours in Chinese. */
const objName = (m: { object: string | null; name?: string | null }): string | null => {
  if (!m.object) return null;
  const known = m.object === "strawberry" || m.object === "cube" ? S()[m.object] : null;
  return lang() === "zh" ? (known ?? m.name ?? m.object) : (m.name ?? known ?? m.object);
};

function parseColor(s: string, fb: RGB): RGB {
  const m = s.trim().match(/^#([0-9a-f]{6})$/i);
  if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) as RGB;
  const r = s.match(/rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/);
  return r ? [+r[1], +r[2], +r[3]] : fb;
}
// as Lesson 1's maps: 0 the neutral; under 0.1 a value blends in from it
function lutFor(zero: RGB): string[] {
  return Array.from({ length: 256 }, (_, q) => {
    if (q === 0) return `rgb(${zero.join(",")})`;
    const c = VIR[q];
    const t = Math.min(1, q / 255 / 0.1);
    return `rgb(${c.map((x, i) => Math.round(zero[i] + (x - zero[i]) * t)).join(",")})`;
  });
}
const isFrame = (f: unknown): f is TeleopPadFrame => {
  const p = f as TeleopPadFrame | null;
  return !!p && typeof p === "object" && Array.isArray(p.values) && p.values.length === ROWS * COLS;
};
const isTeleop = (m: unknown): m is TeleopTouch => {
  const t = m as TeleopTouch | null;
  return !!t && typeof t === "object" && t.type === "ft:touch" && t.fig === "gripper" && t.mode === "teleop" && isFrame(t.left) && isFrame(t.right);
};

export function mount(el: HTMLElement, ctx: WidgetCtx, opts: TeleopMapsOpts = {}): TeleopMapsInstance {
  const root = document.createElement("div");
  root.className = "tm";
  root.innerHTML = `
    <p class="tm-kicker mono"><span class="tm-name" data-t="name">${S().name}</span><span class="tm-sep" aria-hidden="true">·</span><span class="tm-ill" data-t="ill">${S().ill}</span></p>
    <div class="tm-body">
      <div class="tm-maps" role="img" aria-label="${S().mapsAria}" data-t-aria="mapsAria">
        ${["left", "right"]
          .map(
            (f) => `<figure class="tm-map" data-finger="${f}">
          <figcaption class="mono"><span class="tm-fname"><i class="tm-key" aria-hidden="true"></i>${f === "left" ? S().left : S().right}</span><span class="tm-count"></span></figcaption>
          <div class="tm-grid"><canvas></canvas><span class="tm-tip mono" aria-hidden="true" data-t="tip">${S().tip}</span></div>
        </figure>`,
          )
          .join("")}
      </div>
      <div class="tm-side">
        <div class="tm-force">
          <p class="tm-flabel mono">${S().total} <b class="tm-fval">0.0 N</b></p>
          <div class="tm-bar" aria-hidden="true"><i class="tm-fill"></i><i class="tm-need"><span class="mono" data-t="toLift">${S().toLift}</span></i><span class="tm-ticks"><b style="left:0%">0</b><b style="left:${(5 / FORCE_MAX) * 100}%">5</b><b style="left:${(10 / FORCE_MAX) * 100}%">10 N</b></span></div>
        </div>
        <p class="tm-status" aria-live="polite"></p>
        <div class="tm-legend mono" aria-hidden="true"><span data-t="light">${S().light}</span><i class="tm-ramp"></i><span data-t="firm">${S().firm}</span></div>
      </div>
    </div>`;
  el.append(root);
  const maps = [...root.querySelectorAll<HTMLElement>(".tm-map")];
  const canvases = maps.map((m) => m.querySelector("canvas")!);
  const counts = maps.map((m) => m.querySelector<HTMLElement>(".tm-count")!);
  const fval = root.querySelector<HTMLElement>(".tm-fval")!;
  const fill = root.querySelector<HTMLElement>(".tm-fill")!;
  const need = root.querySelector<HTMLElement>(".tm-need")!;
  const status = root.querySelector<HTMLElement>(".tm-status")!;
  const mapsBox = root.querySelector<HTMLElement>(".tm-maps")!;

  const rowWanted = opts.row === undefined ? "short" : opts.row;
  if (rowWanted && el.classList.contains("widget-slot")) el.dataset.row = rowWanted;

  let form: "row" | "column" = "row";
  let cell = 8;
  let lut = lutFor([226, 226, 221]);
  let last: TeleopTouch | null = null;
  let said = "";

  // ---------------------------------------------------------------- drawing
  function readColors() {
    lut = lutFor(parseColor(getComputedStyle(root).getPropertyValue("--tm-map-zero") || "#e3e3de", [226, 226, 221]));
  }
  function drawMap(k: number, f: TeleopPadFrame | null) {
    const cv = canvases[k];
    const g = cv.getContext("2d");
    if (!g) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const p = cell * dpr;
    const gap = Math.max(1, Math.round(p * 0.09));
    g.clearRect(0, 0, cv.width, cv.height);
    for (let i = 0; i < ROWS; i++) {
      for (let j = 0; j < COLS; j++) {
        const v = f ? f.values[i * COLS + j] : 0;
        g.fillStyle = lut[Math.max(0, Math.min(255, Math.round((v > 0 ? v : 0) * 255)))];
        // seen from the object: sense line 11 at the left (column form) / the top (row form); the fingertip (j = 0)
        // at the bottom (column) / the left (row)
        const c = ROWS - 1 - i;
        const [x0, y0, x1, y1] =
          form === "column"
            ? [Math.round(c * p), Math.round((COLS - 1 - j) * p), Math.round((c + 1) * p), Math.round((COLS - j) * p)]
            : [Math.round(j * p), Math.round(c * p), Math.round((j + 1) * p), Math.round((c + 1) * p)];
        g.fillRect(x0, y0, x1 - x0 - gap, y1 - y0 - gap);
      }
    }
  }
  function draw() {
    const m = last;
    drawMap(0, m ? m.left : null);
    drawMap(1, m ? m.right : null);
    [m?.left, m?.right].forEach((f, k) => {
      counts[k].textContent = f && f.lit ? fillVars(S().count, { lit: f.lit, force: f.force.toFixed(1) }) : " ";
    });
    const total = m ? m.total : 0;
    fval.textContent = `${total.toFixed(1)} N`;
    fill.style.width = `${Math.min(100, (total / FORCE_MAX) * 100).toFixed(2)}%`;
    const nd = m && m.need != null && m.object ? m.need : null;
    need.hidden = nd === null;
    if (nd !== null) need.style.left = `${Math.min(100, (nd / FORCE_MAX) * 100).toFixed(2)}%`;
    root.toggleAttribute("data-enough", !!m && nd !== null && total >= nd);
    root.toggleAttribute("data-held", !!m?.held);
    const name = m ? objName(m) : null;
    const T = S();
    const v = { name: name ?? "", mm: m ? Math.round(m.lift) : 0 };
    let s: string;
    if (!m) s = T.waiting;
    else if (m.held && m.lift > 0.5) s = fillVars(T.holdingUp, v);
    else if (m.held) s = fillVars(T.holding, v);
    else if (name && m.left.lit && m.right.lit) s = fillVars(nd !== null && total < nd ? T.bothWeak : T.both, v);
    else if (name && (m.left.lit || m.right.lit)) s = fillVars(m.left.lit ? T.onlyLeft : T.onlyRight, v);
    else s = m.grip ? T.closing : T.nothing;
    if (s !== said) {
      said = s;
      status.textContent = s;
    }
  }

  // ---------------------------------------------------------------- layout: the form, then the cell size that fits
  function layout() {
    const cs = getComputedStyle(root);
    const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const W = Math.max(160, root.clientWidth - padX);
    const H = el.clientHeight > 40 ? el.clientHeight - padY : 0;
    const want = opts.form && opts.form !== "auto" ? opts.form : H && (H < 330 || W / H > 2.2) ? "row" : "column";
    form = want;
    root.dataset.form = form;
    const kick = 22; // the kicker line
    const cap = 22; // a map's caption
    const mapGap = 18;
    if (form === "row") {
      // two maps side by side (32 x 12 cells each) and the force block (about 230 px) on the right
      const side = Math.min(260, Math.max(180, W * 0.24));
      const byW = (W - side - 2 * mapGap - 8) / (2 * COLS);
      const byH = H ? (H - kick - cap - 22) / ROWS : byW;
      cell = Math.max(3, Math.min(11, Math.floor(Math.min(byW, byH) * 4) / 4));
      root.style.setProperty("--tm-side-w", `${Math.round(side)}px`);
    } else {
      const byW = (W - mapGap - 8) / (2 * ROWS);
      const byH = H ? (H - kick - cap - 22 - 120) / COLS : byW;
      cell = Math.max(3, Math.min(10, Math.floor(Math.min(byW, byH) * 4) / 4));
      root.style.removeProperty("--tm-side-w");
    }
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const [cw, ch] = form === "column" ? [ROWS * cell, COLS * cell] : [COLS * cell, ROWS * cell];
    for (const cv of canvases) {
      cv.width = Math.round(cw * dpr);
      cv.height = Math.round(ch * dpr);
      cv.style.width = `${cw}px`;
      cv.style.height = `${ch}px`;
    }
    mapsBox.style.setProperty("--tm-map-w", `${cw}px`);
    root.toggleAttribute("data-tight", cw < 150);
    readColors();
    draw();
  }

  // ---------------------------------------------------------------- frames
  const sourceWin = (): Window | null => {
    const s = opts.source ?? ctx.figure?.iframe ?? null;
    if (!s) return null;
    return s instanceof HTMLIFrameElement ? s.contentWindow : s;
  };
  const onMessage = (e: MessageEvent) => {
    const want = sourceWin();
    if (want ? e.source !== want : e.source === window) return;
    if (!isTeleop(e.data)) return;
    last = e.data;
    draw();
  };
  window.addEventListener("message", onMessage);
  // a reloaded figure (theme or layout switch) starts over: clear the maps until its next frame
  const offStatus = ctx.figure?.onStatus((s) => {
    if (s === "loading") {
      last = null;
      draw();
    }
  });
  const ro = new ResizeObserver(() => layout());
  ro.observe(el);
  const offTheme = ctx.onTheme(() =>
    requestAnimationFrame(() => {
      readColors();
      draw();
    }),
  );
  // a language switch: the words again, then the status and counts (the maps and the last frame stay)
  const offLang = ctx.onLang(() => {
    paintText(root, S());
    setTextBeside(fval, `${S().total} `);
    maps.forEach((m) => setTextBeside(m.querySelector(".tm-key"), m.dataset.finger === "left" ? S().left : S().right, true));
    draw();
  });
  layout();

  return {
    get form() {
      return form;
    },
    feed(msg: TeleopTouch | null) {
      if (msg !== null && !isTeleop(msg)) throw new Error("teleop-maps: not a Fig 5 teleop ft:touch frame");
      last = msg;
      draw();
    },
    layout,
    destroy() {
      window.removeEventListener("message", onMessage);
      offStatus?.();
      offTheme();
      offLang();
      ro.disconnect();
      if (rowWanted && el.dataset.row === rowWanted) delete el.dataset.row;
      root.remove();
    },
  };
}
