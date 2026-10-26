// Demo card: a small card a guided step can show beside the figure (GuidedStep.demo). The card is a frame (× and the
// lesson-colour band); its content is the module src/widgets/<id>-demo.ts, mounted like a widget when the card opens
// and destroyed when it closes. The card always sits BESIDE the figure, never below it, at every window size (down to
// a 320 px phone, the WCAG reflow width): where the stage has no free side for it, the figure keeps a band free on its
// right (Fig 1's reserve act, or the focus ring's room) and the card goes into that band, compact. The figure moves for
// that band only on step entry (and on a resize).
//
// Each demo has a SPEC: the edge of the stage it sits on, the places it may take there and when the figure is ready
// for it. Places (picked again whenever the stage or the window changes size; the first that fits wins):
//   side    a wide stage: over the stage beside the pad, vertically centred.
//   corner  a stage with less room: a smaller card low in the corner, above the figure's bottom corner text (64 px from
//           the bottom).
//   beside  any stage, desktop or stacked: in the band the figure keeps free right of the pad (ft:focus room, or
//           ft:band for a band this host reserved), the band's own width less the gaps, vertically centred on the
//           focus ring (unit) or in the free height (velostat). The figure keeps its labels (while the card is in the
//           band: FigureHost.bandCard, see views/lesson.ts), its "Click to collapse" pill and its viewbar out of the
//           band, so the card never covers the pad, the mat or the pad's label.
// There is no place under the figure or over the panel: a card too tall for every form at its last place still takes
// that place in its smallest form (kept clear of the figure's top corner text), and a card with no place at all (no band
// reported yet) waits, hidden, for the figure's next report.
// A spec's forms(place) lists the forms the card tries there, in order: "full", "compact" (it drops .demo-extra; the
// step text says the same) and "short" (compact, and the widget's drawings shorter: a short stage, or a phone's band;
// velostat-demo.css, unit-demo.ts).
//
// Reserve (velostat): when the step is reached (want(), called with the step's acts) the host decides from the stage's
// size whether a wide place (side, corner) takes the card; if not, it asks Fig 1 for a band (FigureHost.reserve: the
// card's width plus its gaps, or half the drawing where that is narrower: a 320 px phone), in the same message batch as
// the step's acts, so the pad comes apart (or goes to its pose) and makes room in ONE movement. The band stays while
// the step is current (also while the card steps aside for another picked part, or after the learner closes it: the
// figure's labels may then use it, the camera stays) and is given back on step exit (want(null)), so the figure moves
// only on a step change. A resize decides again (the figure refits to a new band at once, eases in or out of none).
//
// velostat (Lesson 2 step 1, RIGHT edge; the pad is exploded with its label on the left):
//   side    stage >= 960 px wide, clamp(260px, 22vw, 340px) wide. Fig 1's exploded pad ends at ~0.61 of the stage
//           width (Bottom FPC tail, measured at 1440-1920 px windows), so from 960 px on the card keeps >= 20 px clear
//           of it (it may cover the mat's right corner).
//   corner  stage 740-960 px: 240 px wide in the bottom-right corner. The pad ends at 0.61-0.64 of the width there
//           (1280-1440 px windows, and a 960 px window's 840 px stacked stage), so the card clears it and only covers
//           the mat's right corner.
//   beside  narrower or shorter stages (1024 x 768, half-screen windows, tablets, phones): Fig 1 reserves a band of
//           clamp(120, 36 % of the stage, 240) px plus the gaps (or half the drawing, a 320 px phone); the card is
//           compact there (the cross-section, the curve and the R readout, no text line; a phone-narrow card also drops
//           the layer names and shortens the chart's labels), "short" on a short stage (1024 x 640) or a short phone
//           band (320-340 px phones): shorter drawings (velostat-demo.css). It is vertically centred in the band's free
//           height, with no leader: the figure's own label names the Velostat. Where that label has no room left of the
//           band (a phone), the figure leaves it out and reports the Velostat's right point (ft:band anchor): the card
//           is centred on it and ONE horizontal leader runs from it to the card.
//
// Lesson 2 steps 2-4 (unit, grid, pad: RIGHT edge, "beside" only). On a desktop the two pictures share the stage: the
// figure keeps HALF its drawing free on the right (the focus act's room in steps 2-3, a reserve band in step 4, both BESIDE_ROOM:
// clamp(360, 50 %) of the drawing, else 46 % of a phone's drawing but at least 137 px, else half of it), fits the pad
// (both poses) into the left half as large as that half allows, and the card fills the right half: the band's whole
// width less the gaps, and from 360 px wide on its LARGE form, as tall as TALL (85 %) of the stage allows within the free
// height (the figure's top corner text, its bottom corner text and its viewbar stay clear). Each card takes that height
// its own way (budget()): the unit card fills it exactly (style.height, at most ~its width), the grid card shrinks its
// drawing to it (data-max-h), the pad card lays out within it (a px max-height). A phone's band (under 360 px) keeps
// the cards' own forms down to their mini forms, with no height given.
//   unit    step 2: vertically centred on Fig 1's focus ring (one crossing; clamped inside the stage's free bands), with
//           ONE straight horizontal leader drawn here, over the iframe, from the ring's right edge to the card's left
//           edge, a terminal dot on the ring. The figure reports where the ring and the band are (ft:focus,
//           FigureHost.lastFocus). Its left edge and width come from the band alone (measured at the home view, both
//           poses), so pans, zooms and taking the pad apart never move it sideways; it follows the ring up and down.
//           While the ring is not drawn (the pad taken apart by Space or the toolbar, feel mode) the card stays exactly
//           where it was and only the leader hides; the leader also hides while the ring is not left of the card and
//           level with it. A card too tall for the free height drops its extra line (compact; on a phone the mini form
//           is shorter then). While the learner has a part picked the card steps aside (views/lesson.ts) and the label
//           uses the band. It presses the ringed crossing in step with its loop (unit-demo.ts).
//   grid    step 3: the same place and leader, from the ring around the 2 × 2 block (focus span). The card's reading
//           ("gd:reading": the crossing being read, the pressed ones) is mirrored on the figure with the act scan
//           (momentary, <= 30 a second; the card's S1 / S2 and D1 / D2 mapped onto the block so the marks sit where the
//           card draws its crossings), and given back (scan null) when the card goes.
//   pad     step 4: the pad taken apart, no ring: in the reserved band, vertically centred in its free height, no
//           leader. The card's scan (onScan: the sense line listened to, the drive line powered) is mirrored with the
//           act scan, so the figure lights the same two lines on the Top and Bottom FPC.
//
// Lesson 1 step 2's touch map ("What the sensor feels") is not a demo card: Fig 1 draws it itself in FEEL mode, left
// of the pad and exactly the size of the sensing area (figures/EMBED.md, "Fig 1 pad: feel mode").
import type { FigureHost, ReserveRoom } from "../figure/FigureHost";
import type { DemoId, FocusInfo, LessonCtx, WidgetInstance } from "../types";
import type { GridDemoInstance, GridReading } from "../widgets/grid-demo";
import type { PadDemoInstance, PadScanState } from "../widgets/pad-demo";
import { onLang, strings, t } from "../i18n";
import { loadWidget } from "../widgets";
import { h } from "./dom";
import { icon } from "./icons";

type Place = "side" | "corner" | "beside";
type Form = "full" | "compact" | "short";

/** Free bands the card keeps from the stage's top (the figure's "Fig 1" / title corner) and bottom (its readout corner). */
const TOP_BAND = 40;
const BOTTOM_BAND = 64;
const FADE_MS = 200;
/** A figure that never reports the pose a demo waits for still gets its card this long after it is ready. */
const READY_FALLBACK_MS = 1800;
/** A card waits (hidden where it is) this long at most for a band the host reserved on a resize (the figure easing into
 *  it, or reloading for a layout switch) before it takes another place. */
const BAND_WAIT_MS = 2500;
/** "beside": the card's right margin in the stage and its gap to the free band's left edge (the pad's, or the mat's,
 *  right edge); a phone's stage (narrower than NARROW px) takes smaller ones. And the gap it keeps above the viewbar. */
const NARROW = 480;
const gapsAt = (W: number) => (W < NARROW ? { edge: 10, band: 10 } : { edge: 16, band: 16 });
const BAR_GAP = 8;
/** Lesson 2: the band the figure keeps free right of the pad for its cards (the focus act's room, steps 1-2; the reserve
 *  band, step 3): half the drawing on a desktop (at least 360 px), else 46 % of a phone's drawing (at least 137 px: a
 *  card's mini form), else half of it. Fig 1 drops an entry wider than half its drawing. */
export const BESIDE_ROOM: ReserveRoom[] = [{ f: 0.5, min: 360 }, { f: 0.46, min: 137 }, { f: 0.5 }];
/** A card that fills its band: the band's whole width less the gaps (a phone's band down to the 100 px mini form). */
const FILL_W = { min: 100, pref: 0, max: Infinity, share: 1 };
/** From this card width on, a card with a `tall` spec takes its large form: a height budget from the stage. */
const LARGE_MIN = 360;
/** The share of the stage body's height a large card may take (within the free height). */
const TALL = 0.85;
/** The figure hears a card's scan at most this often (ms). */
const SCAN_MS = 33;

interface BandSpec {
  /** Where the band comes from: the focus ring's room (ft:focus; the card is led from the ring) or a band this host
   *  reserves (ft:band; no ring, no leader). */
  from: "focus" | "reserve";
  /** The card's width in the band: clamp(pref, share × the stage width, max), narrowed to the band less the gaps; it
   *  gives the place up below min. A reserved band is clamp(pref, share × W, max) plus the gaps, or half the drawing
   *  where that is narrower (a 320 px phone: the card is then a little under pref), unless `rooms` gives it. */
  w: { min: number; pref: number; max: number; share: number };
  /** A reserved band given as Fig 1 rooms (CSS px or shares of the drawing, the first that fits), not from `w`. */
  rooms?: ReserveRoom[];
}

interface DemoSpec {
  edge: "left" | "right";
  /** Places, tried in order (desktop and stacked layouts alike); the last one that has room is the fallback. */
  order: Place[];
  /** The forms the card tries at place p, in order (see the header). */
  forms(p: Place): Form[];
  /** Whether the card may take `p` in a W-px-wide stage body, and the width it gets there (null = its CSS width). */
  room(p: Place, W: number): { ok: boolean; width: number | null };
  /** A spec that sits in a band right of the pad ("beside"). */
  band?: BandSpec;
  /** A "reserve" spec: whether a wide place (side, corner) takes the card in a W × H stage body, so the figure needs
   *  to keep no band for it. */
  wide?(W: number, H: number): boolean;
  /** True once the figure shows the pose the card belongs with. */
  ready(figure: FigureHost): boolean;
  /** A card that may fill its band (Lesson 2): from LARGE_MIN px wide it gets a height budget of this share of the stage
   *  body's height (within the free height), through budget(). */
  tall?: number;
  /** Give the card its height budget `h` (px, the card's border box; null = none: the card takes its own height) for a
   *  card `w` px wide, before it lays out. */
  budget?(card: HTMLElement, h: number | null, w: number): void;
  /** Mirror the card's state on the figure once its content is mounted; returns the undo (called when the card goes). */
  mirror?(card: HTMLElement, inst: WidgetInstance, figure: FigureHost | null): () => void;
}

/** A focus card's ready(): the ring must be up (the kind `want` asks for: one crossing, or a block) and at rest (two polls
 *  in a row at the same place), so the card does not chase it while the figure camera eases into its room. */
function steadyRing(want: (f: FocusInfo) => boolean): (figure: FigureHost) => boolean {
  let seen = "";
  return (figure) => {
    const f = figure.lastFocus;
    const key = f?.ring && f.room && want(f) ? `${f.ring.x},${f.ring.y},${f.room.x}` : "";
    const steady = Boolean(key) && key === seen;
    seen = key;
    return steady;
  };
}

/** Send the figure a card's scan (act scan, momentary): at most every SCAN_MS (the last one always lands), again after the
 *  figure reloads (a theme switch), and scan null when the card goes. Returns {send, off}. */
function scanSender(figure: FigureHost | null) {
  let last: unknown = null;
  let key = "";
  let at = 0;
  let timer = 0;
  let live = true;
  const can = () => Boolean(figure && figure.supports("scan"));
  const flush = () => {
    timer = 0;
    at = performance.now();
    if (live && can()) figure!.act("scan", last, { once: true });
  };
  const offStatus = figure
    ? figure.onStatus((st) => {
        if (st === "ready" && last) window.setTimeout(() => live && can() && figure.act("scan", last, { once: true }), 300);
      })
    : () => {};
  return {
    send(arg: unknown) {
      const k = JSON.stringify(arg);
      if (k === key) return;
      key = k;
      last = arg;
      const wait = SCAN_MS - (performance.now() - at);
      if (wait <= 0) flush();
      else if (!timer) timer = window.setTimeout(flush, wait);
    },
    off() {
      live = false;
      clearTimeout(timer);
      offStatus();
      if (last && can()) figure!.act("scan", null, { once: true });
    },
  };
}

/** The grid card's 2 × 2 on the figure's block (focus {sense, drive, span: 2}): its top strips S1 / S2 onto the block's
 *  two sense lines, its bottom strips D1 / D2 onto its two drive lines, in order. (Fig 1 draws the sense lines along the
 *  pad's long side, the card draws its top strips across: the four marks in the ring sit as the card's four crossings,
 *  turned a quarter turn, never mirrored.) */
const GRID_ON_FIG = { sense: [0, 1], drive: [0, 1] };

/** Each card's accessible name (its region label), in the site's language. */
const TITLES = strings<Record<DemoId, string>>(
  {
    unit: "One touch spot in 3D, wired with a 10 kΩ resistor to 5 V: press and voltage (illustrative)",
    grid: "Four touch spots: a 2 × 2 read one crossing at a time (illustrative)",
    pad: "The whole pad: 12 × 32 touch spots read line by line, and a cross-section of the layers",
    velostat: "Velostat demo: press and resistance (illustrative)",
  },
  {
    unit: "一个触摸点的立体图，经 10 kΩ 电阻接到 5 V：按压与电压（示意）",
    grid: "四个触摸点：2 × 2，一次读一个交叉点（示意）",
    pad: "整个传感垫：12 × 32 个触摸点逐行读取，以及各层的剖面",
    velostat: "Velostat 演示：按压与电阻（示意）",
  },
);
const titleOf = (id: DemoId): string => TITLES()[id];

const SPECS: Record<DemoId, DemoSpec> = {
  unit: {
    edge: "right",
    order: ["beside"],
    forms: () => ["full", "compact", "short"],
    room: () => ({ ok: true, width: null }),
    band: { from: "focus", w: FILL_W },
    tall: TALL,
    // the large form fills the height it is given: about as tall as it is wide, at most the budget
    budget: (card, h, w) => {
      if (h) card.style.height = `${Math.round(Math.min(h, w))}px`;
      else card.style.removeProperty("height");
    },
    ready: steadyRing((f) => !f.span),
  },
  grid: {
    edge: "right",
    order: ["beside"],
    forms: () => ["full", "compact", "short"],
    room: () => ({ ok: true, width: null }),
    band: { from: "focus", w: FILL_W },
    tall: TALL,
    // the drawing shrinks to the budget (the card's own height comes from its content)
    budget: (card, h) => {
      if (h) card.dataset.maxH = String(Math.round(h));
      else delete card.dataset.maxH;
    },
    ready: steadyRing((f) => Boolean(f.span)),
    mirror: (card, inst, figure) => {
      const out = scanSender(figure);
      const map = (sense: number, drive: number) => {
        const f = figure?.lastFocus;
        if (!f || f.sense === null || f.drive === null) return null;
        return { sense: f.sense + GRID_ON_FIG.sense[sense], drive: f.drive + GRID_ON_FIG.drive[drive] };
      };
      const onReading = (r: GridReading) => {
        const at = r.sense !== null && r.drive !== null ? map(r.sense, r.drive) : null;
        const pressed = r.pressed.flatMap((q) => {
          const m = map(q.sense, q.drive);
          return m ? [{ ...m, amount: Math.round(q.amount * 50) / 50 }] : [];
        });
        out.send({ sense: at?.sense ?? null, drive: at?.drive ?? null, pressed });
      };
      const g = inst as Partial<GridDemoInstance>;
      if (g.subscribe) {
        const off = g.subscribe(onReading);
        return () => {
          off();
          out.off();
        };
      }
      const onEvent = (e: Event) => onReading((e as CustomEvent<GridReading>).detail);
      card.addEventListener("gd:reading", onEvent);
      return () => {
        card.removeEventListener("gd:reading", onEvent);
        out.off();
      };
    },
  },
  pad: {
    edge: "right",
    order: ["beside"],
    forms: () => ["full", "compact", "short"],
    room: () => ({ ok: true, width: null }),
    band: { from: "reserve", w: FILL_W, rooms: BESIDE_ROOM },
    tall: TALL,
    // the card lays out within its max-height (pad-demo.ts reads it as its height budget)
    budget: (card, h) => {
      if (h) card.style.maxHeight = `${Math.round(h)}px`;
      else card.style.removeProperty("max-height");
    },
    // the band is in (the camera has eased into it); the card does not wait for the layers to finish lifting
    ready: (figure) => {
      const b = figure.lastBand;
      return Boolean(b && b.settled && b.right > 0 && b.room);
    },
    mirror: (_card, inst, figure) => {
      const out = scanSender(figure);
      const p = inst as Partial<PadDemoInstance>;
      // (a line index the card reports outside the grid, e.g. before its first reading, counts as none)
      const line = (v: number | null, n: number) => (typeof v === "number" && Number.isInteger(v) && v >= 0 && v < n ? v : null);
      const off = p.onScan ? p.onScan((st: PadScanState) => out.send({ sense: line(st.sense, 12), drive: line(st.drive, 32) })) : () => {};
      return () => {
        off();
        out.off();
      };
    },
  },
  velostat: {
    edge: "right",
    order: ["side", "corner", "beside"],
    forms: (p) => (p === "beside" ? ["compact", "short"] : ["full"]),
    room: (p, W) => ({ ok: p === "side" ? W >= 960 : p === "corner" ? W >= 740 : true, width: null }),
    band: { from: "reserve", w: { min: 100, pref: 120, max: 240, share: 0.36 } },
    // the corner card is ~316 px tall: it needs a stage at least 740 px wide and ~440 px tall
    wide: (W, H) => W >= 740 && H >= 440,
    // the step's label is up (or, in a band with no room for it, its anchor is known: the card leads to it) and the pad
    // is (nearly) fully apart; with a band, the camera has eased into it
    ready: (figure) => {
      const st = figure.lastState;
      const shares = (st?.shares ?? null) as Record<string, number> | null;
      const apart = !shares || Object.values(shares).every((v) => v >= 0.85);
      const b = figure.lastBand;
      const band = !figure.reserved || Boolean(b && b.settled && b.right > 0);
      return Boolean((st?.label || (figure.reserved && b?.anchor)) && apart && band);
    },
  },
};

export interface DemoHost {
  /** The demo on show (or opening), else null. */
  readonly showing: DemoId | null;
  /** The step's demo, when the step is reached (null when it is left): reserves the figure's band for it at once, or
   *  gives it back. The card itself opens with show() once the figure is ready. */
  want(id: DemoId | null): void;
  show(id: DemoId): void;
  hide(): void;
  destroy(): void;
}

export interface DemoSlots {
  stage: HTMLElement;
  stageBody: HTMLElement;
}

/** `onClose` runs when the learner closes the card (× or Escape), not when the host hides it. */
export function demoHost(slots: DemoSlots, ctx: LessonCtx, onClose?: () => void): DemoHost {
  const { stage, stageBody } = slots;
  const wide = matchMedia("(min-width: 1024px) and (min-height: 640px)");
  let card: HTMLElement | null = null;
  let inst: WidgetInstance | null = null;
  let showing: DemoId | null = null;
  let wanted: DemoId | null = null;
  let spec: DemoSpec | null = null;
  let token = 0;
  let hideTimer = 0;
  let placed: Place | null = null;
  // "beside": the leader over the iframe (unit: from the ring), and the figure's reports it follows
  let leader: SVGSVGElement | null = null;
  let offFocus: (() => void) | null = null;
  // the card's mirror on the figure (spec.mirror), undone as soon as the card goes
  let offMirror: (() => void) | null = null;
  type Ring = { x: number; y: number; rx: number; ry: number };
  /** "beside": the card's width, left edge and the height it is centred on (`cy`), the ring (null while it is not
   *  drawn, or for a band with no ring), the iframe's box, the figure's viewbar and the lowest the card may reach (the
   *  drawing's bottom), all in stage-body px. */
  type Box = { x: number; y: number; w: number; h: number };
  type Beside = { width: number; left: number; cy: number; ring: Ring | null; frame: Box; bar: Box | null; bottom: number };
  let lastBeside: Beside | null = null;

  const body = () => card?.querySelector<HTMLElement>(".demo-body") ?? null;

  /** The band a "reserve" spec needs at this stage size (CSS px; then half the drawing, the most Fig 1 keeps, where that
   *  is narrower: a 320 px phone), or null when a wide place takes the card. */
  const bandFor = (sp: DemoSpec): ReserveRoom[] | null => {
    if (!sp.band || sp.band.from !== "reserve") return null;
    const W = stageBody.clientWidth;
    const H = stageBody.clientHeight;
    if (!(W > 0 && H > 0)) return null;
    if (sp.wide?.(W, H)) return null;
    if (sp.band.rooms) return sp.band.rooms;
    const g = gapsAt(W);
    const { pref, max, share } = sp.band.w;
    return [Math.round(Math.max(pref, Math.min(max, share * W)) + g.edge + g.band), { f: 0.5 }];
  };
  const reserveNow = () => {
    const fig = ctx.figure;
    if (!fig) return;
    fig.reserve(wanted ? bandFor(SPECS[wanted]) : null);
  };

  /** "beside": where the card goes right of the pad, from the free band the figure reports (ft:focus room for a ring,
   *  ft:band for a reserved band), or null when the band is too narrow (or gone). The left edge and width come from the
   *  band alone, so a pan, a zoom or the pad taken apart never moves the card sideways. While the ring is not drawn
   *  (the pad apart, feel mode) the card keeps the height it had; while the figure reloads (a theme switch) or has not
   *  reported yet, the last place holds, so the card never drops elsewhere and comes back. */
  const besideAt = (): Beside | null => {
    const figure = ctx.figure;
    if (!figure || !spec?.band) return null;
    const fromFocus = spec.band.from === "focus";
    const f = fromFocus ? figure.lastFocus : figure.lastBand;
    if (!f || figure.status === "loading") return lastBeside;
    if (fromFocus ? figure.lastFocus!.sense === null : !(figure.lastBand!.right > 0)) return null;
    if (!f.room) return null;
    const frame = figure.iframe;
    const sb = stageBody.getBoundingClientRect();
    const fr = frame.getBoundingClientRect();
    const ox = fr.left - sb.left + frame.clientLeft;
    const oy = fr.top - sb.top + frame.clientTop;
    const W = stageBody.clientWidth;
    const g = gapsAt(W);
    const right = W - g.edge;
    const minLeft = ox + f.room.x + g.band;
    const { min, pref, max, share } = spec.band.w;
    const want = Math.max(pref, Math.min(max, share * W));
    const width = Math.floor(Math.min(want, right - minLeft));
    if (width < min) return null;
    // the leader's start: the focus ring, or (a reserved band with no room left of it for the figure's label: a phone)
    // the labelled part's right point, so the card itself names the part
    const anchor = !fromFocus ? figure.lastBand!.anchor : null;
    const ringIn = fromFocus ? figure.lastFocus!.ring : anchor ? { x: anchor.x, y: anchor.y, rx: 0, ry: 0 } : null;
    const ring = ringIn ? { x: ox + ringIn.x, y: oy + ringIn.y, rx: ringIn.rx, ry: ringIn.ry } : null;
    // the lowest the card may reach: the drawing's bottom, or (lower) just above the figure's bottom corner texts (a
    // phone: the readout starts a little under the drawing)
    const bottom = Math.max(oy + f.room.y + f.room.h, f.text !== null ? oy + f.text - 6 : -Infinity);
    const cy = ring ? ring.y : lastBeside && fromFocus ? lastBeside.cy : (Math.max(TOP_BAND, oy + f.room.y) + Math.min(stageBody.clientHeight - BOTTOM_BAND, bottom)) / 2;
    const bar = f.bar ? { x: ox + f.bar.x, y: oy + f.bar.y, w: f.bar.w, h: f.bar.h } : null;
    lastBeside = { width, left: right - width, cy, ring, frame: { x: ox, y: oy, w: frame.clientWidth, h: frame.clientHeight }, bar, bottom };
    return lastBeside;
  };
  /** "beside": the lowest the card's bottom may go: above the figure's bottom corner text (BOTTOM_BAND, or where the
   *  figure says that text starts when that is higher: a phone's readout sits right under the band), and above its
   *  viewbar when the card is over the viewbar's columns. */
  const besideFloor = (b: Beside) => {
    let floor = Math.min(stageBody.clientHeight - BOTTOM_BAND, b.bottom);
    if (b.bar && b.bar.x < b.left + b.width + BAR_GAP && b.bar.x + b.bar.w > b.left - BAR_GAP) floor = Math.min(floor, b.bar.y - BAR_GAP);
    return floor;
  };

  const setForm = (f: Form) => {
    if (!card) return;
    card.toggleAttribute("data-compact", f !== "full");
    card.toggleAttribute("data-short", f === "short");
  };

  /** The room at place p: whether it is allowed, the card's width, the tallest it may be and, for a card that fills
   *  its band (spec.tall, at least LARGE_MIN px wide), the height budget it is given (else null). */
  const roomAt = (p: Place) => {
    const W = stageBody.clientWidth;
    const H = stageBody.clientHeight;
    if (p === "beside") {
      const b = besideAt();
      const free = b ? besideFloor(b) - TOP_BAND : 0;
      const large = Boolean(b && spec?.tall && b.width >= LARGE_MIN);
      const maxH = large ? Math.floor(Math.min(spec!.tall! * H, free)) : free;
      return { ok: Boolean(b), width: b ? b.width : null, maxH, budget: large ? maxH : null };
    }
    const r = spec!.room(p, W);
    return { ok: r.ok, width: r.width, maxH: H - BOTTOM_BAND - TOP_BAND, budget: null };
  };

  /** Move the card to place p (data-place and width; it is always over the stage body). */
  const put = (p: Place) => {
    if (!card || !spec) return;
    if (placed !== p) {
      card.dataset.place = p;
      placed = p;
    }
    const r = roomAt(p);
    if (r.width) card.style.width = `${r.width}px`;
    else card.style.removeProperty("width");
    // (a card that fills its band: its height budget, given before it lays out; none for a narrower one)
    spec.budget?.(card, r.budget, r.width ?? card.offsetWidth);
    card.toggleAttribute("data-large", r.budget !== null);
    if (p === "beside" && lastBeside) card.style.left = `${Math.round(lastBeside.left)}px`;
    else card.style.removeProperty("left");
    // a phone-narrow card in a band: the widgets' narrow forms key off the card's width (container queries), this only
    // tightens the card's own × corner
    card.toggleAttribute("data-narrow", p === "beside" && Boolean(r.width && r.width < 180));
  };

  const fits = (p: Place): boolean => {
    if (!card) return false;
    const r = roomAt(p);
    if (!r.ok) return false;
    // the content lays itself out for the width just set (the unit card rebuilds its drawing), so the height is true;
    // a card given a fixed height must not overflow it either (its content clipped at the bottom)
    inst?.layout?.();
    return card.offsetHeight <= r.maxH && card.scrollHeight <= card.clientHeight + 1;
  };

  /** The one horizontal leader from the ring's right edge to the card's left edge, with a dot on the ring; hidden while
   *  the ring is not drawn, outside the figure, or not level with the card. */
  const drawLeader = (top: number, ch: number) => {
    if (!leader) return;
    const live = spec?.band?.from === "focus" ? ctx.figure?.lastFocus?.ring : ctx.figure?.lastBand?.anchor;
    const b = placed === "beside" && live ? lastBeside : null;
    const r = b?.ring ?? null;
    const W = stageBody.clientWidth;
    const H = stageBody.clientHeight;
    leader.setAttribute("viewBox", `0 0 ${W} ${H}`);
    leader.setAttribute("width", String(W));
    leader.setAttribute("height", String(H));
    const y = r ? r.y : 0;
    const x0 = r ? r.x + r.rx : 0;
    const inFrame = b && r && r.x >= b.frame.x && r.x <= b.frame.x + b.frame.w && y >= b.frame.y + 4 && y <= b.frame.y + b.frame.h - 4;
    const level = b && r && y >= top + 12 && y <= top + ch - 12 && x0 < b.left - 8;
    const on = Boolean(b && inFrame && level);
    leader.classList.toggle("is-hidden", !on);
    if (!on || !b) return;
    const d = `M${x0.toFixed(1)} ${y.toFixed(1)}H${b.left.toFixed(1)}`;
    leader.querySelector(".demo-leader-halo")!.setAttribute("d", d);
    leader.querySelector(".demo-leader-line")!.setAttribute("d", d);
    const dot = leader.querySelector(".demo-leader-end")!;
    dot.setAttribute("cx", x0.toFixed(1));
    dot.setAttribute("cy", y.toFixed(1));
  };

  /** A band this host reserved is not in yet (a resize asked for it, or the figure is reloading): the card waits, hidden
   *  where it was, instead of hopping to another place and back while the figure eases into the band. */
  let waitSince = 0;
  let waitTimer = 0;
  const bandPending = () => {
    const fig = ctx.figure;
    if (!spec?.band || spec.band.from !== "reserve" || !fig || !fig.reserved) return false;
    const bd = fig.lastBand;
    return !(bd && bd.right > 0 && bd.settled);
  };

  const place = () => {
    if (!card || !spec) return;
    clearTimeout(waitTimer);
    if (bandPending()) {
      const now = performance.now();
      if (!waitSince) waitSince = now;
      if (now - waitSince < BAND_WAIT_MS) {
        card.classList.add("is-waiting");
        leader?.classList.add("is-hidden");
        waitTimer = window.setTimeout(place, BAND_WAIT_MS - (now - waitSince) + 20);
        return;
      }
    } else waitSince = 0;
    const order = spec.order;
    let chosen: Place | null = null;
    let form: Form = "full";
    // the last place with room (its width), for a card too tall for every place
    let last: Place | null = null;
    for (const p of order) {
      if (!roomAt(p).ok) continue;
      last = p;
      put(p);
      for (const f of spec.forms(p)) {
        setForm(f);
        if (fits(p)) {
          chosen = p;
          form = f;
          break;
        }
      }
      if (chosen) break;
    }
    if (!chosen && last) {
      // too tall everywhere: the last place with room, in its smallest form (kept below the figure's top corner text)
      chosen = last;
      const forms = spec.forms(chosen);
      form = forms[forms.length - 1] ?? "full";
    }
    if (!chosen) {
      // no place at all (no band reported yet): wait, hidden where it is, for the figure's next report
      card.classList.add("is-waiting");
      leader?.classList.add("is-hidden");
      return;
    }
    card.classList.remove("is-waiting");
    setForm(form);
    put(chosen);
    inst?.layout?.();
    const H = stageBody.clientHeight;
    const ch = card.offsetHeight;
    if (chosen === "side") {
      // vertically centred in the stage, kept clear of the figure's top and bottom corner text
      const top = Math.max(TOP_BAND, Math.min((H - ch) / 2, H - BOTTOM_BAND - ch));
      card.style.top = `${Math.round(top)}px`;
    } else if (chosen === "beside" && lastBeside) {
      // vertically centred on the ring (or where it was while the ring is not drawn; or in the band's free height),
      // kept clear of the figure's top and bottom corner text (the top wins for a card taller than that height)
      const top = Math.round(Math.max(TOP_BAND, Math.min(lastBeside.cy - ch / 2, besideFloor(lastBeside) - ch)));
      card.style.top = `${top}px`;
      drawLeader(top, ch);
    } else card.style.removeProperty("top");
    if (chosen !== "beside") drawLeader(0, 0);
  };

  // the stage's size: the band a reserved spec needs (a resize may need another, or none), then the card's place
  let sizeKey = "";
  const ro = new ResizeObserver(() => {
    const key = `${stageBody.clientWidth}x${stageBody.clientHeight}`;
    if (key !== sizeKey) {
      sizeKey = key;
      reserveNow();
    }
    place();
  });
  ro.observe(stageBody);
  const onWide = () => place();
  wide.addEventListener("change", onWide);

  const teardown = () => {
    clearTimeout(waitTimer);
    waitSince = 0;
    offMirror?.();
    offMirror = null;
    inst?.destroy();
    inst = null;
    if (card) ro.unobserve(card);
    offFocus?.();
    offFocus = null;
    card?.remove();
    card = null;
    leader?.remove();
    leader = null;
    lastBeside = null;
    placed = null;
  };

  /** `pointer`: the learner closed the card with a mouse or a tap (its × clicked): focus is not handed to the figure
   *  then (the figure's focused drawing would show a focus frame nobody asked for); it simply leaves the card. */
  const hide = (pointer = false) => {
    token++;
    showing = null;
    clearTimeout(hideTimer);
    if (!card) return;
    const el = card;
    // the figure stops mirroring the card at once (the next step's pose must not get its marks)
    offMirror?.();
    offMirror = null;
    // focus would be lost with the card: hand it back to the figure (or the stage) when it came from the keyboard
    const hadFocus = el.contains(document.activeElement);
    el.classList.remove("is-on");
    leader?.classList.remove("is-on");
    hideTimer = window.setTimeout(teardown, ctx.reducedMotion() ? 0 : FADE_MS);
    if (hadFocus && pointer) (document.activeElement as HTMLElement | null)?.blur();
    else if (hadFocus) (ctx.figure ? ctx.figure.focus() : stage.focus());
  };

  const show = (id: DemoId) => {
    if (showing === id && card) return;
    clearTimeout(hideTimer);
    teardown();
    showing = id;
    spec = SPECS[id];
    const my = ++token;
    card = h("aside", { class: "demo-card", role: "region", "aria-label": titleOf(id), "data-edge": spec.edge, "data-demo": id });
    card.innerHTML = `<button type="button" class="demo-close" aria-label="${t("demo.close")}" title="${t("demo.closeTitle")}">${icon("close")}</button><div class="demo-body"></div>`;
    stageBody.append(card);
    const close = (pointer = false) => {
      hide(pointer);
      onClose?.();
    };
    // (a click with a pointer has detail >= 1; Enter or Space on the × gives 0: the keyboard)
    card.querySelector(".demo-close")!.addEventListener("click", (e) => close((e as MouseEvent).detail > 0));
    card.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !e.defaultPrevented) {
        e.preventDefault();
        close();
      }
    });
    if (spec.band) {
      const fig = ctx.figure;
      // the leader lives over the iframe (under the card); it follows every ft:focus / ft:band (resize, pan, zoom, pose)
      leader = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      leader.setAttribute("class", "demo-leader is-hidden");
      leader.setAttribute("aria-hidden", "true");
      leader.innerHTML = `<path class="demo-leader-halo"/><path class="demo-leader-line"/><circle class="demo-leader-end" r="3.5"/>`;
      stageBody.append(leader);
      offFocus = fig ? (spec.band.from === "focus" ? fig.onFocus(() => place()) : fig.onBand(() => place())) : null;
    }
    place();
    ro.observe(card);
    loadWidget(`${id}-demo`)
      .then((mount) => {
        if (my !== token || !card) return;
        inst = mount(body()!, { lesson: ctx.lesson, figure: ctx.figure, theme: ctx.theme, onTheme: ctx.onTheme, reducedMotion: ctx.reducedMotion, lang: ctx.lang, onLang: ctx.onLang });
        place();
        if (spec?.mirror) offMirror = spec.mirror(card, inst, ctx.figure);
        const el = card;
        const ln = leader;
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            el.classList.add("is-on");
            ln?.classList.add("is-on");
          }),
        );
      })
      .catch((err: Error) => {
        console.error(err);
        if (my === token) hide();
      });
  };

  // the card's own chrome follows the site's language (the widget in it repaints its words itself: ctx.onLang)
  const offLang = onLang(() => {
    const x = card?.querySelector<HTMLElement>(".demo-close");
    if (!card || !x || !showing) return;
    card.setAttribute("aria-label", titleOf(showing));
    x.setAttribute("aria-label", t("demo.close"));
    x.title = t("demo.closeTitle");
  });

  return {
    get showing() {
      return showing;
    },
    want(id: DemoId | null) {
      wanted = id;
      reserveNow();
    },
    show,
    hide,
    destroy() {
      token++;
      offLang();
      clearTimeout(hideTimer);
      wide.removeEventListener("change", onWide);
      ro.disconnect();
      teardown();
      showing = null;
      wanted = null;
    },
  };
}

/** Calls `fn` once the figure shows the pose demo `id` belongs with (its SPEC's ready(): velostat = the step's label is
 *  up, the pad is apart and the camera is in its band). Falls back READY_FALLBACK_MS after the figure is ready (a figure
 *  that reports nothing new), at once for a figure without the bridge. Returns a cancel function. */
export function whenReady(id: DemoId, figure: FigureHost | null, fn: () => void): () => void {
  if (!figure) {
    fn();
    return () => {};
  }
  const t0 = performance.now();
  let readyAt = 0;
  const timer = window.setInterval(() => {
    const now = performance.now();
    // the figure answers an act within ~0.1 s; before that its last state is the old pose
    if (now - t0 < 150) return;
    if (figure.status === "ready" && !readyAt) readyAt = now;
    const late = figure.status === "no-bridge" || (readyAt > 0 && now - readyAt > READY_FALLBACK_MS);
    if ((figure.status === "ready" && SPECS[id].ready(figure)) || late) {
      clearInterval(timer);
      fn();
    }
  }, 100);
  return () => clearInterval(timer);
}
