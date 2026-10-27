// Lesson schema. One file per lesson in src/lessons/NN-slug.ts exports a `Lesson`; src/lessons/index.ts lists them in order.
// Content strings marked "HTML" may use <b>, <i>, <code>, <a>, <ul>/<li>, <p>, <dfn> and <abbr title>. Keep them plain-language.

import type { FigureHost } from "./figure/FigureHost";
import type { Lang } from "./i18n/lang";

export type { Lang };

export type FigId = "pad" | "crossing" | "board" | "gripper";
export type Theme = "light" | "dark";
/** A home card's looping cover (views/home.ts LOOPS): "pad" = Fig 1's feel mode, "board" = Fig 3 scanning a press
 *  (Lesson 1.4 "Press it"), "useit" = the real sensor and its live heatmap. */
export type CoverLoop = "pad" | "board" | "useit";

/** One figure action, sent to the iframe as {type:'ft:act', name, arg}. Names per figure:
 *  pad      explode | collapse | select(layerId|index) | deselect | step(1-4) | plan | iso | touch({r,c} | [Xmm,Ymm]) | release
 *           feel(true|false)   FEEL mode: plan view of the assembled pad, a fingertip that presses it, ft:touch frames
 *           press({sense, drive, amount} | null)   press at fractional 0-based line indices (amount 0..1); null releases.
 *                              On the focus ring's crossing (below, outside FEEL mode) it makes the ring and the crossing
 *                              glow instead of turning FEEL mode on
 *           focus({sense, drive, span?, room?} | {room} | null)   a ring on ONE crossing of the assembled pad (0-based
 *                              indices), or with span (n, or [senses, drives]) around the block of crossings that starts
 *                              there (lesson 2 step 2: a 2 × 2), posted back as ft:focus (FocusInfo). room = {f, min,
 *                              max} keeps clamp(min, f × width, max) CSS px free on the right of the drawing for a card
 *                              (dropped past half the width); a list of those: the first that fits (lesson 2: half the
 *                              drawing on a desktop, a phone's narrower band)
 *           scan({sense, drive, pressed?} | null)   what a card that reads the grid is doing (sent by src/ui/demo.ts for
 *                              lesson 2's grid and pad cards, momentary): apart, the sense line glows on the Top FPC and
 *                              the drive line on the Bottom FPC; closed, the crossing being read is outlined and the
 *                              pressed crossings ({sense, drive, amount}) glow
 *           reserve({right: px} | null)   a band kept free on the right of the drawing in any pose, without a ring,
 *                              posted back as ft:band (BandInfo); sent by src/ui/demo.ts through FigureHost.reserve()
 *                              (sticky, re-sent after a reload), not by lessons
 *           labels("all" | null)   ALL LABELS: once the pad is expanded, every part's label at once (the five layers'
 *                              cards in one column on the left, top to bottom; the two gold-finger rows' on the right).
 *                              The figure makes room for them when the act arrives; null = back to one label per click
 *  crossing press(0..1?) | release | hold | stop | tour
 *  board    reset | clock | play | pause | toggle | speed(n) | faster | slower | mux | lift | lower | nano
 *           labels("all" | null)   ALL LABELS (lesson 3): one "Click to lift the Nano" hint; a click on the board (or
 *                              lift) lifts the Nano and a card for every component fades in (two aligned columns, each
 *                              card its name, one sentence about its job and "Details ›"); the figure makes room for them
 *                              when the act arrives; reset keeps the mode (the Nano eases down, the cards go)
 *           connect(true | "instant" | false)   the pad wired to the board by its two FFCs, and the 12 × 32 map of
 *                              readings beside it (lesson 4); a theme or layout reload replays true as "instant"
 *           press({sense, drive, amount?, hold?} | number | null)   a fingertip on the connected pad
 *           seek(1-384 | {sense, drive})   pause on that reading (the scan runs on to it)
 *  gripper  step(1-5) | wrap | tail | extend | ffc | usb (each also false) | open | close | gap(mm) | reset | feel(bool)
 *           press({finger: 'left' | 'right', amount?, sense?, drive?, hold?} | null) | release | labels("all" | null)
 *           view('all' | 'fingers' | 'cables' | 'in' | 'out' | 'reset')   Lesson 2.1 (figures/EMBED.md "Fig 5")
 *           teleop({object?} | true | false) | reach(object | {object?, dx?, dy?}) | lift(mm) | move({x?, y?, z?, dur?})
 *                              Lesson 2.2's teleop mode (figures/EMBED.md "Fig 5 gripper: teleop mode"); while it is on,
 *                              open / close / reset are its own
 *  all      pick(id|null) | view('in'|'out'|'reset')   (explore mode; sent by FigureHost, not by lessons)
 *  pad      reveal(true|false)   (reveal mode; sent by FigureHost from Lesson.figure.reveal, not by lessons) */
export interface FigAct {
  name: string;
  arg?: unknown;
}

/** One act of a guided step's "Show me" (GuidedStep.show). */
export interface ShowAct extends FigAct {
  /** Milliseconds after Show me is pressed (default 0 = at once). */
  at?: number;
  /** A momentary act (a press): not kept in the figure's replay history, so a theme or layout reload does not play it
   *  again. */
  once?: boolean;
}

/** One frame of what Fig 1 "feels" in FEEL mode (ft:touch, figures/EMBED.md). Simulated by the figure: a Gaussian
 *  bump around the fingertip on the real 2.0 mm grid, value 0..1 per crossing. */
export interface TouchFrame {
  /** Sense lines (12). */
  senses: number;
  /** Drive lines (32). */
  drives: number;
  /** senses × drives values 0..1, row-major by sense line: values[s * drives + d]. */
  values: number[];
  /** How hard the finger presses, 0..1. */
  press: number;
  /** The fingertip's centre in 0-based line indices (fractional), or null when nothing touches. */
  at: { sense: number; drive: number } | null;
}

/** Fig 1's focus ring (ft:focus, figures/EMBED.md "Fig 1 pad: focus"), in the iframe's CSS px. Posted whenever it
 *  changes (an act, a resize, pan / zoom, a pose or view change). */
export interface FocusInfo {
  /** The ringed crossing (0-based; a block's first), or null when no ring is set. */
  sense: number | null;
  drive: number | null;
  /** A ringed block's size [senses, drives] (focus span), absent for one crossing. */
  span?: [number, number];
  /** The ring's centre and half-extents (an ellipse lying on the top face), or null while it is not drawn (no focus,
   *  FEEL mode, the pad taken apart) or not at rest on the closed pad (the pad opening or closing). */
  ring: { x: number; y: number; rx: number; ry: number } | null;
  /** The free band right of the pad (everything the camera keeps in frame, both poses), to the iframe's right edge. */
  room: { x: number; y: number; w: number; h: number } | null;
  /** The figure's own viewbar (zoom, fit, take apart, top view), or null when it is not shown. */
  bar: { x: number; y: number; w: number; h: number } | null;
  /** The top of the figure's bottom corner texts (hint and readout) under the drawing, or null. */
  text: number | null;
}

/** Fig 1's reserve band (ft:band, figures/EMBED.md "Fig 1 pad: reserve"), in the iframe's CSS px: posted whenever it
 *  changes once a reserve act has run. */
export interface BandInfo {
  /** The band the camera keeps free on the right (CSS px), 0 for none (released, or wider than half the drawing). */
  right: number;
  /** The camera has finished easing into (or out of) the band. */
  settled: boolean;
  /** The free band right of the pad (everything the camera keeps in frame, both poses), to the iframe's right edge. */
  room: { x: number; y: number; w: number; h: number } | null;
  /** The figure's own viewbar, or null when it is not shown. */
  bar: { x: number; y: number; w: number; h: number } | null;
  /** The top of the figure's bottom corner texts (hint and readout) under the drawing, or null. */
  text: number | null;
  /** The part whose label the figure shows, or null. */
  label: string | null;
  /** The picked part's outermost point on the right while its label has no place left of the band (a phone): the
   *  card in the band leads to it itself. */
  anchor: { id: string; x: number; y: number } | null;
}

/** Icon names a figure part can use (parts.mjs `icon`). All are drawn in src/ui/icons.ts. */
export type PartIcon =
  | "layers" | "chip" | "plug" | "ruler" | "bolt" | "wave" | "grid" | "touch"
  | "cable" | "board" | "resistor" | "usb" | "gauge" | "film" | "gold"
  | "finger" | "tape" | "motor" | "rail" | "holder";

/** One fact row about a figure part (values come from flexitac-anatomy/shared). */
export interface PartFact {
  label: string;
  value: string;
  src: string;
  badge?: Badge;
}

/** A clickable component of a figure, as sent by the figure in ft:parts (summary), ft:pick and ft:details (full). */
export interface FigPart {
  id: string;
  title: string;
  icon: PartIcon | string;
  /** One line, <= 60 characters (the text on the figure's label). */
  short: string;
  /** 2-4 plain sentences. Only in ft:pick / ft:details (the site's detail window shows it). */
  intro?: string;
  /** 2-4 rows. Only in ft:pick / ft:details. */
  facts?: PartFact[];
  /** The lesson that teaches this part: its order number in the course (1-14; Fig 1-3) or its section number as text
   *  ("2.1"; Fig 5). */
  lesson?: number | string;
  /** A card's ft:pick: the part it was picked for (Fig 3's all-labels mode), asked for again after a reload. */
  via?: string;
}

/** Which badge a fact carries. Anything not read straight from the sources must carry one. */
export type Badge = "inferred" | "illustrative" | "external" | "proposed";

export interface Feature {
  /** Icon id from src/ui/icons.ts (ICONS). */
  icon: IconId;
  title: string;
  /** Short plain text (HTML allowed). */
  text: string;
}

export interface Spec {
  label: string;
  /** Display value (HTML allowed). Prefer fact() from src/content/facts.ts so the number comes from shared/data/sources.json. */
  value: string;
  /** Where the number comes from: a file path inside the project ("material/…", "refs/…"), a URL, or "user-confirmed …". */
  src: string;
  badge?: Badge;
  /** Optional one-line explanation shown under the value. */
  note?: string;
  /** Set by fact() (src/content/facts.ts): the shared fact this row shows, and whether its value and note are the
   *  fact's own (not the lesson's), so the Chinese site can use src/content/facts.zh.ts for them. */
  fact?: { key: string; value: boolean; note: boolean };
}

export interface WiringRow {
  from: string;
  to: string;
  /** What travels on this connection, in plain words. */
  note: string;
  badge?: Badge;
}

export interface Wiring {
  /** Intro paragraph (HTML). */
  intro?: string;
  rows: WiringRow[];
  /** Footnote under the table (HTML). */
  foot?: string;
}

export interface PartRow {
  /** The part, in plain words (HTML allowed). */
  name: string;
  /** How many, e.g. "2" or "4 (2 per finger)". */
  qty: string;
  /** What it does here, one plain sentence. */
  note: string;
  /** Where the part and its count come from (source chips, as Spec.src). */
  src?: string;
  badge?: Badge;
}

export interface Parts {
  /** Intro paragraph (HTML). */
  intro?: string;
  rows: PartRow[];
  /** Footnote under the table (HTML). */
  foot?: string;
}

/** One chapter of a course section (src/lessons/index.ts SECTIONS): a home card with a cover picture, and a group in
 *  the lesson list. */
export interface Chapter {
  title: string;
  /** Its lessons' ids, in order. Empty: a "coming next" chapter (no lessons yet; its card is styled as coming soon). */
  lessons: string[];
  /** One or two plain sentences for its home card. */
  text: string;
  /** The card's picture, taken from the chapter's own figure or widget: a figure thumbnail (public/thumbs/<fig>-*.webp),
   *  a short muted loop (views/home.ts LOOPS), or a still in both themes, public/media/covers/<still>-{light,dark}.webp
   *  (scripts/covers.mjs). */
  cover: { fig: FigId } | { loop: CoverLoop } | { still: string };
  /** What the picture shows, for screen readers. */
  alt: string;
}

/** A course section: three chapters (src/lessons/index.ts SECTIONS). */
export interface Section {
  /** 1-based: the first part of its lessons' numbers (2 -> 2.1, 2.2). */
  n: number;
  title: string;
  /** One line under its title on the home page. */
  blurb: string;
  chapters: Chapter[];
}

export interface CodeParam {
  /** Placeholder name: `{{name}}` in `source`. */
  name: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
}

export interface CodeSample {
  lang: "python" | "cpp" | "bash" | "text";
  /** Shown above the code, e.g. "Python · host side". */
  caption?: string;
  /** Source with {{param}} placeholders. Every placeholder must be listed in `params`. */
  source: string;
  params: CodeParam[];
  /** The "Code" tab: one plain-language note per idea in the snippet (HTML). */
  notes?: string[];
  /**
   * The sim. Called by Run (button or Ctrl/Cmd+Enter) with the current param values. Drive the stage through
   * ctx.figure / ctx.widget and return lines for the little console under the code. Without `run` the Run
   * button is hidden (a widget's own run(params) is still called if the lesson has a widget).
   */
  run?: (params: Record<string, number>, ctx: LessonCtx) => string | string[] | void;
  /** run() only computes its lines and drives nothing, so a language switch may call it again to repaint the console
   *  in the new language. Without it the console is cleared on a switch (docs/i18n.md). */
  pureRun?: boolean;
}

/** A small demo card a guided step can show beside the figure (src/ui/demo.ts, which also says which side of the stage
 *  each one takes). Each id is a module src/widgets/<id>-demo.ts that exports mount(el, ctx) like any widget.
 *  velostat    press -> resistance (Lesson 2 step 1), right of the pad taken apart
 *  unit        one touch spot in 3D wired with R1 to 5 V and a voltmeter (Lesson 2 step 2), right of the pad, level
 *              with Fig 1's focus ring and joined to it by one horizontal leader; it presses the ringed crossing in step
 *              with its loop
 *  grid        four touch spots (2 × 2) read one at a time (Lesson 2 step 3), right of the pad, led from the ring around
 *              the 2 × 2 block; the figure mirrors its reading (act scan)
 *  pad         the whole pad: 12 × 32 scanned line by line, with a cross-section of the layers (Lesson 2 step 4), right
 *              of the pad taken apart; the figure lights the lines it reads (act scan)
 *  (Lesson 1 step 2's touch map is drawn by Fig 1 itself in FEEL mode, not by a demo card.) */
export type DemoId = "velostat" | "unit" | "grid" | "pad";

/** A picture that takes the whole stage while one guided step is on show (GuidedStep.stage), in place of the lesson's
 *  figure. Each id is a widget module src/widgets/<id>.ts (mount(el, ctx), filling the box it is given).
 *  robot-grasp   FlexiTac on both fingers of a robot gripper picking up a strawberry (a 9 s loop) beside the two pads'
 *                live 12 × 32 touch maps (Lesson 1.1 step 1, Lesson 2.1 step 1); illustrative */
export type StageId = "robot-grasp";

export interface GuidedStep {
  /** Short title, e.g. "Take it apart". */
  title: string;
  /** What to look at (HTML). */
  text: string;
  /** The step's pose: acts sent to the lesson figure when the learner reaches the step ("Next step", its dot, or "Show
   *  me" on a step not reached yet). Jumping to step k replays the acts of steps 1..k. */
  act?: FigAct | FigAct[];
  /** Optional "Show me" for a step that is already in its pose: acts played when the learner presses Show me there (a
   *  scripted press, the pad taken apart), each `at` ms after the press. They are never replayed when jumping to a
   *  later step. Without `show`, reaching the step is all there is (the button reads "Next step" at once). */
  show?: ShowAct[];
  /** Only for the first step: the lesson's `figure.initial` acts already put the figure in this step's pose. The lesson
   *  then always opens on this step, already reached (its demo card opens with the lesson; saved progress still marks
   *  the dots done), and the restart button comes back to it. */
  start?: boolean;
  /** Optional demo card shown while this step is active, once its acts have played and the figure is in the pose the
   *  card needs (src/ui/demo.ts): over the stage on desktop beside the pad (never over it), in the page flow under the
   *  stage when stacked. It goes away when the step changes, the lesson changes or the learner closes it (×). */
  demo?: DemoId;
  /** false hides the lesson's widget while this step is on show (a split stage then gives the figure the whole stage;
   *  the widget stays mounted). Default: shown. */
  widget?: boolean;
  /** A picture that fills the whole stage while this step is on show, over the lesson's figure (views/lesson.ts). The
   *  figure stays loaded underneath, hidden, and keeps taking the step's acts, so give this step the pose the NEXT step
   *  starts from (Lesson 1: the figure's initial pose is step 2's): moving on shows it at once. The two cross-fade on a
   *  step change; the steps bar, the right panel and the dots work as on any step. */
  stage?: StageId;
  /** What the lesson's widget shows while this step is on show, passed to its view() (views/lesson.ts) when the step is
   *  reached or opened on; a step without it passes undefined (the widget's default form). Each widget says what it
   *  takes: frame-runner {grid: false} (the strip: lesson 4), flash-doctor {symptom: id}, clock-stepper {extra:
   *  "outputs" | "mux" | null} (no lesson uses it since lesson 3 became "Meet the reading board"). */
  widgetView?: Record<string, unknown>;
}

export interface QuizQuestion {
  q: string;
  choices: string[];
  /** Index into `choices`. */
  answer: number;
  /** Why the answer is right (HTML). Shown after any attempt. */
  why: string;
}

export interface MediaItem {
  kind: "image" | "video";
  /** Path under public/ (no leading slash), e.g. "media/build-step1.jpg". */
  src: string;
  alt: string;
  caption?: string;
  badge?: Badge;
}

export interface Lesson {
  /** URL id: #/lesson/<id>. Lowercase-kebab, never change once published (progress is keyed by it). */
  id: string;
  /** 1-based place in the whole course (LESSONS order: 1-14). It picks the lesson's colour (--ft-lesson-n) and its
   *  thumbnail (public/thumbs/L<nn>-*.webp). The number shown to learners is its section number, lessonNo() in
   *  src/lessons/index.ts ("1.1" ... "3.6"). */
  n: number;
  title: string;
  /** Small line above the title, e.g. "Start here". */
  kicker: string;
  /** One or two sentences under the title (HTML). */
  lede: string;
  /** Exactly three. */
  features: [Feature, Feature, Feature];
  /** The anatomy figure on the stage. `initial` acts run once the figure is ready; `reset` acts run when the
   *  learner restarts the guided steps (put the figure back in its starting pose). */
  figure?: {
    fig: FigId;
    initial?: FigAct[];
    reset?: FigAct[];
    /** Desktop only, when the lesson also has a widget: the share of the stage height given to the figure
     *  (0.3–0.8, default 0.6). The widget gets the rest. Stacked layouts ignore it. */
    split?: number;
    /** Reveal mode (Fig 1 only, figures/EMBED.md "Fig 1 reveal mode"): the figure starts assembled on its mat with one
     *  small "Click to expand" hint. Clicking the sensor (or a step's explode / select) takes it apart in place; no
     *  label shows until the learner clicks a layer. Collapsing it brings the hint back. */
    reveal?: boolean;
  };
  /** Widget id = module name in src/widgets/ (registered in src/widgets/index.ts). Shown instead of / beside the figure. */
  widget?: string;
  /** A lesson without a figure whose widget is a card (Section 3's simulation cards, src/widgets/sim-*.ts): the stage
   *  shows it in a card frame (the demo cards' look, src/ui/stagecard.ts) in the middle of the stage, as large as the
   *  stage allows, instead of stretching the widget over the whole stage. The steps drive it through widgetView. */
  widgetCard?: boolean;
  /** Photos or footage for the stage when there is no figure and no widget. */
  media?: MediaItem[];
  /** Overview tab body (HTML). Plain words; define every term at first use with <dfn>. */
  overview: string;
  wiring?: Wiring;
  /** The "Parts" tab: what this lesson's build needs (Lesson 2.1). Hidden when absent. */
  parts?: Parts;
  code?: CodeSample;
  specs: Spec[];
  steps?: GuidedStep[];
  quiz?: QuizQuestion[];
  /** Id of the next lesson; defaults to the following lesson in the registry. */
  next?: string;
  /** Draft lessons show a "draft" chip and their stub outline. */
  status?: "ready" | "draft";
  /** How the guided steps changed after learners may already have saved progress (counted in completed steps), in the
   *  order the changes were made (src/state/store.ts migrateSteps runs them once per learner, so the dots still mark the
   *  steps the learner did): a number is the 0-based index a step was inserted at (a count past it moves up by one);
   *  {keep: n} means only the first n steps stayed and the rest were replaced (a count above n drops to n); {merge: k}
   *  means steps k and k + 1 (0-based) became one step k (a count past both moves down by one; a count that covers step k
   *  but not k + 1 drops to k, so the merged step counts only when both halves were done). */
  stepsAdded?: StepsChange[];
  /** Questions taken out of `quiz` after learners may already have saved answers, in the order they were taken out: the
   *  0-based index each had in the list at the time (src/state/store.ts migrateQuiz drops that saved answer once per
   *  learner, so the answers after it still meet their own questions). A new question goes at the END of the list. */
  quizDropped?: number[];
}

/** One change to a lesson's guided steps (Lesson.stepsAdded). */
export type StepsChange = number | { keep: number } | { merge: number };

/** What lesson code (sims) and widgets can reach. */
export interface LessonCtx {
  lesson: Lesson;
  /** The figure on the stage, or null when the lesson has none. */
  figure: FigureHost | null;
  /** The mounted widget, or null. */
  widget: WidgetInstance | null;
  theme(): Theme;
  /** Called with the new theme when the learner toggles it. Returns an unsubscribe function. */
  onTheme(fn: (t: Theme) => void): () => void;
  reducedMotion(): boolean;
  /** The site's language now ("en" default, "zh"): docs/i18n.md. */
  lang(): Lang;
  /** Called with the new language when the learner switches it (the globe button): paint your words again, keep your
   *  state. Returns an unsubscribe function (also dropped with the lesson). */
  onLang(fn: (l: Lang) => void): () => void;
}

/** src/widgets/<id>.ts must `export function mount(el, ctx): WidgetInstance`. */
export interface WidgetInstance {
  destroy(): void;
  /** Called by Run with the code card's current param values. */
  run?(params: Record<string, number>): string | string[] | void;
  /** The lines run(params) returns, in the language on show, without touching the widget: a language switch repaints
   *  the code card's console with them (docs/i18n.md). Without it the console is cleared on a switch. */
  say?(params: Record<string, number>): string | string[] | void;
  /** Lay out again now for the size the host just gave it (a demo card measures its height right after). */
  layout?(): void;
  /** Show the form a guided step asks for (GuidedStep.widgetView; undefined = the widget's default form). */
  view?(v?: Record<string, unknown>): void;
}

export type WidgetMount = (el: HTMLElement, ctx: WidgetCtx) => WidgetInstance;

export interface WidgetCtx {
  /** The English lesson (its words in the current language: loc(ctx.lesson), src/i18n). */
  lesson: Lesson;
  figure: FigureHost | null;
  theme(): Theme;
  onTheme(fn: (t: Theme) => void): () => void;
  reducedMotion(): boolean;
  /** The site's language now ("en" default, "zh"): docs/i18n.md. */
  lang(): Lang;
  /** Called with the new language when the learner switches it: repaint your labels, keep your state (no remount).
   *  Returns an unsubscribe function; the subscription also ends with the lesson. */
  onLang(fn: (l: Lang) => void): () => void;
}

// Kept here so lesson files only import from "../types".
export type IconId =
  | "grid"
  | "layers"
  | "pulse"
  | "touch"
  | "chip"
  | "cable"
  | "clock"
  | "bolt"
  | "wave"
  | "byte"
  | "usb"
  | "ruler"
  | "beam"
  | "mux"
  | "shift"
  | "flash"
  | "heat"
  | "tools"
  | "book"
  | "home"
  | "glossary"
  | "info"
  | "sun"
  | "moon"
  | "play"
  | "copy"
  | "check"
  | "reset"
  | "chevron"
  | "photo"
  | "plug"
  | "board"
  | "resistor"
  | "gauge"
  | "film"
  | "gold"
  | "close"
  | "tag"
  | "finger"
  | "tape"
  | "motor"
  | "rail"
  | "holder"
  | "mouse"
  | "spring"
  | "points"
  | "loop"
  | "chart"
  | "robot"
  | "soon"
  | "globe";
