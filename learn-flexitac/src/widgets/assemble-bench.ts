// Lesson 1.4, "Put it together": an assembly game. Every part of one FlexiTac waits on a blue anti-static mat in 3D
// (./assemble3d/scene.ts): two FPCs, two lamination sheets taped down in the work area, the Velostat, a 16-pin and a
// 32-pin connector, a 16-pin and a 32-pin flat cable, and the Arduino Nano; the reading board sits in front, put
// together but for its Nano. The learner drags the parts together in Lesson 1.3's order (the rules: ./assemble/
// engine.ts): each FPC onto a sheet, the Velostat onto the bottom part, the top part over it (it turns face down), a
// extender onto each tail, each flat cable into its extender, then its free end to the board's socket, the Nano into the
// board. While a part is held, the place it would join is outlined (teal) or, when it cannot go there, outlined red, and
// letting go there says why. A click on a part (without dragging) says what it is. Drag on empty space turns the view,
// the wheel zooms, a right drag pans; the corner has "from above", "back to the view", Undo and Start over.
// The lesson has no steps (2026-11-16, user: a step that only turned the view did nothing). The progress bar under the
// bench shows the order instead: the top part and the bottom part side by side, joining into the Velostat, then the
// sandwich, the extenders, the FFCs, the board and the Nano; a stop turns teal when it is done, the stop to do now is
// dark and its line above the bar says what to do. When a stop is done the camera flies to the next one's part of the
// mat; a click on a stop goes there and says what it asks for. When everything is in, "Good job!" comes up and the bar
// leads on to the lesson's step 2, the test (ctx.nextStep: the Heatmap lab over the stage); the lesson counts as done
// there, as its steps bar counts it.
// The Hint button (as in Lesson 2.2) says the next single thing to do, in the bar's line in place of the stop's own words,
// outlines the part and the place (amber, with a line between them), and its "Do this step" does that one thing; it
// follows along until the button is pressed again. The note (what a part is, what joined, why not) shows just above the
// bar's card.
// The assembly is saved in localStorage (try/catch) and comes back; Start over clears it, and Undo brings back what was
// there.
import { strings } from "../i18n";
import { paintText } from "../i18n/paint";
import type { Theme, WidgetCtx, WidgetInstance } from "../types";
import { h } from "../ui/dom";
import { icon } from "../ui/icons";
import { nextLessonButton } from "../ui/steps";
import {
  allDone,
  clone,
  connAt,
  drop,
  fpcAt,
  met,
  moveUnit,
  next,
  portAt,
  STAGE_ORDER,
  STAGES,
  toBoard,
  stageDone,
  stagesNow,
  START_ASSEMBLY,
  unitOf,
  type Assembly,
  type Cable,
  type Drop,
  type Goal,
  type Grab,
  type Item,
  type Move,
  type Port,
  type Stage,
} from "./assemble/engine";
import { BOARD, BOARD_PORT_Z, CABLE, CONN, LAYOUT, PLUG, SHEET, SOCK, VELO, nanoSeat, type P2 } from "./assemble/geometry";
import { createScene, type AsmScene, type Hit, type P3, type View } from "./assemble3d/scene";
import "./assemble-bench.css";

// (v2, 2026-11-16: the parts start in a new layout, geometry.ts START; a bench saved in the old one starts over)
const KEY = "learn-flexitac:assemble:v2";
const S = strings(
  {
    aria: "An assembly bench: the parts of one FlexiTac pad and its reading board, to drag together",
    kicker: "Put it together",
    "view.top": "From above",
    "view.angle": "At an angle",
    "view.home": "Back to the view of what to do now",
    undo: "Undo",
    reset: "Start over",
    "reset.aria": "Start over: every part back in the box",
    "coach.btn": "Hint",
    "coach.aria": "Hint: the next thing to do",
    "coach.cap": "Hint · next",
    "coach.done": "All done",
    "coach.do": "Do this step",
    "coach.close": "Close the hint",
    // the progress bar
    "path.aria": "The order of the build",
    "path.top": "Top part",
    "path.bot": "Bottom part",
    "path.velo": "Velostat",
    "path.sandwich": "Sandwich",
    "path.extender": "Extenders",
    "path.ffc": "FFCs",
    "path.board": "Connect to board",
    "path.nano": "Nano",
    "path.done": "done",
    "path.now": "do this now",
    "path.todo": "still to do",
    // what a stop asks for (the line above the bar, and a click on a stop)
    "do.parts": "Drag each FPC onto a lamination sheet: that makes the top part and the bottom part.",
    "do.top": "Drag the top FPC (12 lines) onto a lamination sheet.",
    "do.bot": "Drag the bottom FPC (32 lines) onto a lamination sheet.",
    "do.velo": "Lay the Velostat on the bottom part, over its electrodes.",
    "do.sandwich": "Drag the top part onto the bottom part. It turns face down onto the Velostat.",
    "do.extender": "Push an extender onto each tail: the 32-pin one on the bottom tail, the 16-pin one on the top tail.",
    "do.ffc": "Plug each flat cable into its extender: the 32-pin cable into the 32-pin one, the 16-pin into the 16-pin.",
    "do.board": "Take each cable's free end to the board: the 32-pin cable to FPC2, the 16-pin cable to FPC1.",
    "do.nano": "Drop the Arduino Nano into the board's two sockets, its USB toward you.",
    "do.done": "All put together. Next, plug it in and test it.",
    // the parts' names, on the mat
    "name.top": "Top FPC · 12 lines",
    "name.bot": "Bottom FPC · 32 lines",
    "name.sheet": "Lamination sheet",
    "name.sheets": "2 lamination sheets",
    "name.velo": "Velostat",
    "name.c16": "16-pin extender",
    "name.c32": "32-pin extender",
    "name.f16": "16-pin cable",
    "name.f32": "32-pin cable",
    "name.nano": "Arduino Nano",
    "name.board": "Reading board",
    "name.topPart": "Top part",
    "name.botPart": "Bottom part",
    // a click on a part
    "info.top": "Top FPC: 12 copper sense lines, and a long tail that ends in 12 gold fingers.",
    "info.bot": "Bottom FPC: 32 copper drive lines, and an A-shaped tail that ends in 32 gold fingers.",
    "info.sheet": "Lamination sheet: clear film, sticky on one side. It gives the thin FPC a flat, stiff back.",
    "info.velo": "Velostat: a black film whose resistance falls where it is pressed. It goes between the two grids of lines.",
    "info.c16": "16-pin extender: a tiny board with a socket on each side. The top tail goes into one, the 16-pin cable into the other.",
    "info.c32": "32-pin extender: the same, 32 pins wide. The bottom tail goes into one side, the 32-pin cable into the other.",
    "info.f16": "16-pin flat cable (FFC), 0.5 mm pitch: it carries the 12 sense lines to the board's FPC1 socket.",
    "info.f32": "32-pin flat cable: it carries the 32 drive lines to the board's FPC2 socket.",
    "info.nano": "Arduino Nano: it runs the scan and sends every frame to the computer over USB.",
    "info.board": "The reading board: four shift registers power the drive lines one at a time, a multiplexer picks a sense line for A0. Its Nano is still missing.",
    // what a drop joined
    "ok.lam-top": "The top FPC is on its sheet: that is the top part.",
    "ok.lam-bot": "The bottom FPC is on its sheet: that is the bottom part.",
    "ok.velo": "The Velostat covers the bottom part's electrodes.",
    "ok.close": "The top part turns face down onto the Velostat: its 12 lines cross the bottom part's 32. That is the pad.",
    "ok.plug-c32": "The 32-pin extender is on the bottom tail.",
    "ok.plug-c16": "The 16-pin extender is on the top tail. Its tail rises over the 32-pin extender.",
    "ok.ffc-f32": "The 32-pin cable is in its extender. Its free end goes to FPC2.",
    "ok.ffc-f16": "The 16-pin cable is in its extender. Its free end goes to FPC1.",
    "ok.board-f32": "The 32-pin cable reaches FPC2: the 32 drive lines are on the board.",
    "ok.board-f16": "The 16-pin cable reaches FPC1: the 12 sense lines are on the board.",
    "ok.nano": "The Nano sits in the board's two sockets.",
    // everything in: the badge
    "done.kicker": "Put together",
    "done.title": "Good job!",
    "done.text": "A whole FlexiTac: the pad, two extenders, two cables and the reading board with its Nano. Next, plug it in and test it.",
    "done.look": "Look around",
    "next.test": "Next: test it",
    // why a drop could not join
    "no.velo-top": "The Velostat goes on the bottom part (the 32 drive lines). The top part closes over it.",
    "no.velo-bare": "Press the bottom FPC onto a lamination sheet first.",
    "no.close-novelo": "Lay the Velostat on the bottom part first. Without it the two grids would touch directly.",
    "no.close-bare": "Put both FPCs on their lamination sheets first.",
    "no.close-under": "Bring the top part to the bottom part: it is the top part that turns face down onto the Velostat.",
    "no.conn-open": "Close the sandwich first. The tails get their extenders after that.",
    "no.conn-wrong16": "Too narrow: the bottom tail has 32 gold fingers. It takes the 32-pin extender.",
    "no.conn-wrong32": "The top tail has 12 gold fingers. It takes the 16-pin extender.",
    "no.port-loose": "Push this extender onto its tail first. Then the cable goes into its other side.",
    "no.cable-wrong16": "That socket is 32 pins wide. The 16-pin cable goes to the 16-pin extender and FPC1.",
    "no.cable-wrong32": "That socket is 16 pins wide. The 32-pin cable goes to the 32-pin extender and FPC2.",
    "no.port-taken": "That socket already has a cable.",
    // the Hint
    "hint.lam-bot": "Drag the bottom FPC (32 drive lines) onto the near lamination sheet. Its copper side stays up.",
    "hint.lam-top": "Drag the top FPC (12 sense lines) onto the other lamination sheet.",
    "hint.velo": "Lay the Velostat on the bottom part, over its electrodes.",
    "hint.close": "Drag the top part onto the bottom part. It turns face down, so its copper meets the Velostat.",
    "hint.plug-c32": "Push the 32-pin extender onto the bottom tail, the wide one with 32 gold fingers.",
    "hint.plug-c16": "Push the 16-pin extender onto the top tail's 12 gold fingers.",
    "hint.ffc-f32": "Plug the 32-pin cable into the 32-pin extender.",
    "hint.ffc-f16": "Plug the 16-pin cable into the 16-pin extender.",
    "hint.board-f32": "Take the 32-pin cable's free end to FPC2 on the reading board.",
    "hint.board-f16": "Take the 16-pin cable's free end to FPC1 on the reading board.",
    "hint.nano": "Drop the Arduino Nano into the board's two sockets, its USB toward you.",
    "hint.done": "Everything is put together. Nothing left to do.",
  },
  {
    aria: "组装台：一块 FlexiTac 传感垫和读取板的全部零件，把它们拖到一起",
    kicker: "动手拼装",
    "view.top": "俯视",
    "view.angle": "斜视",
    "view.home": "回到现在这一步的视角",
    undo: "撤销",
    reset: "从头开始",
    "reset.aria": "从头开始：所有零件放回盒子",
    "coach.btn": "提示",
    "coach.aria": "提示：下一步做什么",
    "coach.cap": "提示 · 下一步",
    "coach.done": "全部完成",
    "coach.do": "替我做这一步",
    "coach.close": "关闭提示",
    "path.aria": "拼装的顺序",
    "path.top": "上半部分",
    "path.bot": "下半部分",
    "path.velo": "Velostat",
    "path.sandwich": "三明治",
    "path.extender": "转接板",
    "path.ffc": "排线",
    "path.board": "接到读取板",
    "path.nano": "Nano",
    "path.done": "已完成",
    "path.now": "现在做这一步",
    "path.todo": "还没做",
    "do.parts": "把两块 FPC 各拖到一张覆膜上，做出上半部分和下半部分。",
    "do.top": "把上层 FPC（12 条线）拖到一张覆膜上。",
    "do.bot": "把下层 FPC（32 条线）拖到一张覆膜上。",
    "do.velo": "把 Velostat 铺到下半部分上，盖住它的电极。",
    "do.sandwich": "把上半部分拖到下半部分上。它会翻过来，铜面朝下盖住 Velostat。",
    "do.extender": "每条尾线插一块转接板：32 针的插下层尾线，16 针的插上层尾线。",
    "do.ffc": "把每根排线插到它的转接板上：32 针排线插 32 针转接板，16 针插 16 针。",
    "do.board": "把每根排线空着的一头接到读取板：32 针排线接 FPC2，16 针排线接 FPC1。",
    "do.nano": "把 Arduino Nano 插进读取板的两排座子，USB 口朝向你。",
    "do.done": "全部拼好了。下一步，接上电脑测一测。",
    "name.top": "上层 FPC · 12 条线",
    "name.bot": "下层 FPC · 32 条线",
    "name.sheet": "覆膜",
    "name.sheets": "两张覆膜",
    "name.velo": "Velostat",
    "name.c16": "16 针转接板",
    "name.c32": "32 针转接板",
    "name.f16": "16 针排线",
    "name.f32": "32 针排线",
    "name.nano": "Arduino Nano",
    "name.board": "读取板",
    "name.topPart": "上半部分",
    "name.botPart": "下半部分",
    "info.top": "上层 FPC：12 条铜感应线，加一条长长的尾线，尾端是 12 根金手指。",
    "info.bot": "下层 FPC：32 条铜驱动线，加一条 A 字形的尾线，尾端是 32 根金手指。",
    "info.sheet": "覆膜：一面带胶的透明膜。它给薄薄的 FPC 一个平整、挺括的背面。",
    "info.velo": "Velostat：一张黑色薄膜，哪里被压，哪里的电阻就变小。它夹在两层线中间。",
    "info.c16": "16 针转接板：一块小板，两边各有一个座子。上层尾线插一边，16 针排线插另一边。",
    "info.c32": "32 针转接板：一样的东西，宽到 32 针。下层尾线插一边，32 针排线插另一边。",
    "info.f16": "16 针排线（FFC），间距 0.5 mm：把 12 条感应线送到读取板的 FPC1 座子。",
    "info.f32": "32 针排线：把 32 条驱动线送到读取板的 FPC2 座子。",
    "info.nano": "Arduino Nano：它负责扫描，再通过 USB 把每一帧送到电脑。",
    "info.board": "读取板：四个移位寄存器轮流给驱动线通电，多路选择器挑一条感应线接到 A0。它还缺一块 Nano。",
    "ok.lam-top": "上层 FPC 贴到覆膜上了：这就是上半部分。",
    "ok.lam-bot": "下层 FPC 贴到覆膜上了：这就是下半部分。",
    "ok.velo": "Velostat 盖住了下半部分的电极。",
    "ok.close": "上半部分翻面盖到 Velostat 上：它的 12 条线和下半部分的 32 条线十字交叉。这就是传感垫。",
    "ok.plug-c32": "32 针转接板插到了下层尾线上。",
    "ok.plug-c16": "16 针转接板插到了上层尾线上。这条尾线从 32 针转接板上方翘过去。",
    "ok.ffc-f32": "32 针排线插进了它的转接板。空着的一头要接到 FPC2。",
    "ok.ffc-f16": "16 针排线插进了它的转接板。空着的一头要接到 FPC1。",
    "ok.board-f32": "32 针排线接到了 FPC2：32 条驱动线连上了读取板。",
    "ok.board-f16": "16 针排线接到了 FPC1：12 条感应线连上了读取板。",
    "ok.nano": "Nano 插进了读取板的两排座子。",
    "done.kicker": "拼装成功",
    "done.title": "做得好！",
    "done.text": "一块完整的 FlexiTac：传感垫、两块转接板、两根排线和插好 Nano 的读取板。下一步，接上电脑测一测。",
    "done.look": "再看看",
    "next.test": "下一步：测一测",
    "no.velo-top": "Velostat 要铺在下半部分上（32 条驱动线那块）。上半部分再盖上来。",
    "no.velo-bare": "先把下层 FPC 贴到一张覆膜上。",
    "no.close-novelo": "先把 Velostat 铺到下半部分上。没有它，两层线会直接碰在一起。",
    "no.close-bare": "先把两块 FPC 都贴到覆膜上。",
    "no.close-under": "要把上半部分拿到下半部分上：翻面盖到 Velostat 上的是上半部分。",
    "no.conn-open": "先把三明治合上，然后再给尾线插转接板。",
    "no.conn-wrong16": "太窄了：下层尾线有 32 根金手指，要用 32 针转接板。",
    "no.conn-wrong32": "上层尾线只有 12 根金手指，要用 16 针转接板。",
    "no.port-loose": "先把这块转接板插到它的尾线上，排线再插到它的另一边。",
    "no.cable-wrong16": "这个座子是 32 针宽的。16 针排线要接 16 针转接板和 FPC1。",
    "no.cable-wrong32": "这个座子是 16 针宽的。32 针排线要接 32 针转接板和 FPC2。",
    "no.port-taken": "这个座子已经插了一根排线。",
    "hint.lam-bot": "把下层 FPC（32 条驱动线）拖到近处那张覆膜上，铜面朝上。",
    "hint.lam-top": "把上层 FPC（12 条感应线）拖到另一张覆膜上。",
    "hint.velo": "把 Velostat 铺到下半部分上，盖住它的电极。",
    "hint.close": "把上半部分拖到下半部分上。它会翻过来，铜面朝下贴住 Velostat。",
    "hint.plug-c32": "把 32 针转接板插到下层尾线上，就是有 32 根金手指的那条宽尾线。",
    "hint.plug-c16": "把 16 针转接板插到上层尾线的 12 根金手指上。",
    "hint.ffc-f32": "把 32 针排线插到 32 针转接板上。",
    "hint.ffc-f16": "把 16 针排线插到 16 针转接板上。",
    "hint.board-f32": "把 32 针排线空着的一头接到读取板的 FPC2 上。",
    "hint.board-f16": "把 16 针排线空着的一头接到读取板的 FPC1 上。",
    "hint.nano": "把 Arduino Nano 插到读取板的两排座子上，USB 口朝向你。",
    "hint.done": "全部拼好了，没有要做的了。",
  },
);
type Words = ReturnType<typeof S>;

/** The part of the mat each stop works on (the camera flies there when it is the stop to do now). */
const STAGE_VIEW: Record<Stage, View> = { top: "all", bot: "all", velo: "velostat", sandwich: "close", extender: "connect", ffc: "ffc", board: "cables", nano: "nano" };
/** A stop's number on the bar: the two parts share the first. */
const STAGE_NO: Record<Stage, number> = { top: 1, bot: 1, velo: 2, sandwich: 3, extender: 4, ffc: 5, board: 6, nano: 7 };
const CHECK = `<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.6 6.3 5 8.6l4.4-5"/></svg>`;

export function mount(el: HTMLElement, ctx: WidgetCtx): WidgetInstance {
  const reduced = ctx.reducedMotion();
  const root = document.createElement("div");
  root.className = "w-ab";
  root.setAttribute("role", "group");
  root.dataset.tAria = "aria";
  root.innerHTML = `
    <div class="ab-stage" tabindex="0">
      <div class="ab-view"></div>
      <svg class="ab-marks" aria-hidden="true"></svg>
      <div class="ab-labels" aria-hidden="true"></div>
      <p class="ab-kicker mono" data-t="kicker"></p>
      <div class="ab-corner">
        <button type="button" class="ab-icon-btn" data-act="top"></button>
        <button type="button" class="ab-icon-btn" data-act="home" data-t-aria="view.home" data-t-title="view.home"><svg class="icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 8a5.5 5.5 0 1 0 1.6-3.9"/><path d="M2.3 2.2v3.1h3.1"/></svg></button>
        <button type="button" class="ab-icon-btn" data-act="undo" data-t-aria="undo" data-t-title="undo"><svg class="icon ab-undo-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 2 2.5 5l3 3"/><path d="M2.5 5h7a4 4 0 0 1 0 8H7"/></svg></button>
        <button type="button" class="ab-text-btn mono" data-act="clear" data-t="reset" data-t-aria="reset.aria"></button>
      </div>
      <div class="ab-note" role="status"></div>
      <div class="ab-done" hidden>
        <div class="ab-done-card" role="status">
          <div class="ab-done-mark" aria-hidden="true"><span class="ab-burst"></span><svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="22"/><path d="M14.5 24.5l6.5 6.5 12.5-13.5"/></svg></div>
          <p class="ab-done-kicker mono" data-t="done.kicker"></p>
          <p class="ab-done-title" data-t="done.title"></p>
          <p class="ab-done-text" data-t="done.text"></p>
          <div class="ab-done-go"><span class="ab-done-next"></span><button type="button" class="btn-ghost ab-done-look" data-t="done.look"></button></div>
        </div>
      </div>
      <div class="ab-foot">
        <div class="ab-track">
          <div class="ab-now"><span class="ab-now-n"></span><p class="ab-now-text"></p><div class="ab-coach" role="status" hidden><p class="ab-coach-cap mono"></p><p class="ab-coach-text"></p><button type="button" class="ab-coach-do mono" data-t="coach.do"></button></div><span class="ab-onward"></span><button type="button" class="ab-show mono" aria-expanded="false" data-t-aria="coach.aria"><span class="ab-show-icon"><svg class="icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 12.5h4M6.6 14.5h2.8"/><path d="M5.3 10.2a4.6 4.6 0 1 1 5.4 0c-.5.4-.7.9-.7 1.5v.3H6v-.3c0-.6-.2-1.1-.7-1.5z"/></svg></span><span data-t="coach.btn"></span></button></div>
          <ol class="ab-path" data-t-aria="path.aria">
            <li class="ab-fork">${(["top", "bot"] as Stage[]).map((k) => `<button type="button" class="ab-step" data-stage="${k}"><i></i><span class="ab-step-name"></span></button>`).join("")}</li>
            ${STAGE_ORDER.slice(2)
              .map((k) => `<li><button type="button" class="ab-step" data-stage="${k}"><i></i><span class="ab-step-name"></span><span class="ab-step-n"></span></button></li>`)
              .join("")}
          </ol>
        </div>
      </div>
    </div>`;
  el.append(root);
  const $ = <T extends Element>(sel: string) => root.querySelector<T>(sel)!;
  const stage = $<HTMLElement>(".ab-stage");
  const marks = $<SVGSVGElement>(".ab-marks");
  const labelsEl = $<HTMLElement>(".ab-labels");
  const noteEl = $<HTMLElement>(".ab-note");
  const pathEl = $<HTMLElement>(".ab-path");
  const trackEl = $<HTMLElement>(".ab-track");
  const hintBtn = $<HTMLButtonElement>(".ab-show");
  const coachEl = $<HTMLElement>(".ab-coach");
  const coachCap = $<HTMLElement>(".ab-coach-cap");
  const coachText = $<HTMLElement>(".ab-coach-text");
  const coachDo = $<HTMLButtonElement>(".ab-coach-do");
  const topBtn = $<HTMLButtonElement>('[data-act="top"]');
  const undoBtn = $<HTMLButtonElement>('[data-act="undo"]');

  // ------------------------------------------------------------------------------------------------ the assembly
  const load = (): Assembly => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const a = JSON.parse(raw) as Assembly;
        if (a && a.pos && a.lam && a.cable && a.plugged) return a;
      }
    } catch {
      /* fresh */
    }
    return START_ASSEMBLY();
  };
  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(a));
    } catch {
      /* in memory only */
    }
  };
  let a = load();
  const undo: Assembly[] = [];
  let top = false;
  let coachOn = false;
  let held: { grab: Grab; off: P2; hand: P2; preview: Drop | null } | null = null;
  let theme: Theme = ctx.theme();

  const scene: AsmScene = createScene($<HTMLElement>(".ab-view"), theme);
  scene.show(a);
  scene.power(allDone(a));
  /** The view of the stop to do now (the finished thing, once everything is in). */
  const viewNow = (): View => {
    const now = stagesNow(a);
    return now.length ? STAGE_VIEW[now[0]] : "end";
  };
  let framed: View = viewNow();
  scene.home(framed, false);

  // ------------------------------------------------------------------------------------------------ words
  const W = (): Words => S();
  const say = (k: string) => (W() as Record<string, string>)[k] ?? k;
  let noteTimer = 0;
  const note = (text: string, kind: "ok" | "no" | "info" = "info", ms = 4200) => {
    noteEl.textContent = text;
    noteEl.dataset.kind = kind;
    noteEl.classList.add("is-on");
    window.clearTimeout(noteTimer);
    noteTimer = window.setTimeout(() => noteEl.classList.remove("is-on"), ms);
  };
  // ------------------------------------------------------------------------------------------------ the progress bar
  let onward: HTMLElement | null = null;
  /** The way on once everything is in: the lesson's next step, the test (ctx.nextStep), in the lesson colour as the
   *  steps bar's "Next step" is; in a lesson without one, the way to the next lesson. */
  const onwardButton = (): HTMLElement | null => {
    const next = ctx.nextStep;
    if (!next) return nextLessonButton(ctx.lesson);
    const b = h("button", { type: "button", class: "btn-primary ab-to-test" }, `<span data-t="next.test">${say("next.test")}</span>${icon("chevron")}`);
    b.addEventListener("click", () => {
      hideDone();
      next();
    });
    return b;
  };
  const paintBar = () => {
    const now = stagesNow(a);
    for (const b of pathEl.querySelectorAll<HTMLButtonElement>(".ab-step")) {
      const k = b.dataset.stage as Stage;
      const goals = STAGES[k] as readonly Goal[];
      const n = goals.filter((g) => met(a, g)).length;
      const done = n === goals.length;
      const isNow = now.includes(k);
      b.classList.toggle("is-done", done);
      b.classList.toggle("is-now", isNow);
      if (isNow) b.setAttribute("aria-current", "step");
      else b.removeAttribute("aria-current");
      b.querySelector("i")!.innerHTML = done ? CHECK : String(STAGE_NO[k]);
      b.querySelector(".ab-step-name")!.textContent = say(`path.${k}`);
      b.title = say(`path.${k}`);
      const part = b.querySelector(".ab-step-n");
      if (part) part.textContent = !done && n ? `${n}/${goals.length}` : "";
      b.setAttribute("aria-label", `${STAGE_NO[k]}. ${say(`path.${k}`)}: ${say(done ? "path.done" : isNow ? "path.now" : "path.todo")}`);
      // (the line into a stop is teal once the stop before it is done; the fork's bracket once both parts are)
      const li = b.closest("li")!;
      const before = STAGE_ORDER[STAGE_ORDER.indexOf(k) - 1];
      if (k === "velo") li.classList.toggle("is-in", stageDone(a, "top") && stageDone(a, "bot"));
      else if (before && before !== "top") li.classList.toggle("is-in", stageDone(a, before));
    }
    pathEl.querySelector(".ab-fork")!.classList.toggle("is-done", stageDone(a, "top") && stageDone(a, "bot"));
    const key = now.length === 2 ? "do.parts" : now.length ? `do.${now[0]}` : "do.done";
    $<HTMLElement>(".ab-now-n").innerHTML = now.length ? String(STAGE_NO[now[0]]) : CHECK;
    $<HTMLElement>(".ab-now-text").textContent = say(key);
    trackEl.classList.toggle("is-done", !now.length);
    hintBtn.hidden = !now.length;
    // (everything in: the way on to the next lesson, as the last step of a lesson with steps; a lesson whose steps bar
    // leads on to the test needs none here, the badge and that bar have it)
    onward?.remove();
    onward = !now.length && !ctx.nextStep ? onwardButton() : null;
    if (onward) $<HTMLElement>(".ab-onward").append(onward);
    fitPath();
  };
  /** A bench too narrow for every stop's name drops the names of the stops done, then of the stops still to do; the
   *  stops to do now keep theirs (the others show theirs on hover). */
  const fitPath = () => {
    pathEl.classList.remove("is-tight", "is-tighter");
    for (const c of ["is-tight", "is-tighter"]) if (pathEl.scrollWidth > pathEl.clientWidth + 1) pathEl.classList.add(c);
  };
  pathEl.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>(".ab-step");
    if (!b) return;
    const k = b.dataset.stage as Stage;
    fly(STAGE_VIEW[k]);
    note(say(`do.${k}`), stageDone(a, k) ? "ok" : "info", 5200);
  });

  // ------------------------------------------------------------------------------------------------ the camera
  // it frames the stop to do now: it flies on when that changes (after what just moved has settled), and a click on a
  // stop takes it to that one
  let lastNow = stagesNow(a).join();
  let followTimer = 0;
  let slideNext = false;
  const fly = (v: View) => {
    window.clearTimeout(followTimer);
    framed = v;
    top = false;
    scene.home(v, false, 0, reduced ? 0 : 900);
    paintTop();
  };
  const follow = () => {
    const key = stagesNow(a).join();
    if (key === lastNow) return;
    lastNow = key;
    window.clearTimeout(followTimer);
    const go = () => {
      if (held || scene.busy()) {
        followTimer = window.setTimeout(go, 150);
        return;
      }
      // (just closed: the pad slides to its place in front of the board as the camera moves on)
      if (slideNext) {
        slideNext = false;
        const b = toBoard(a);
        if (b) {
          a = b;
          scene.show(a, { glide: reduced ? 0 : 800 });
          save();
        }
      }
      if (viewNow() !== framed) fly(viewNow());
    };
    followTimer = window.setTimeout(go, 450);
  };
  function paintTop() {
    topBtn.setAttribute("aria-label", say(top ? "view.angle" : "view.top"));
    topBtn.title = say(top ? "view.angle" : "view.top");
    topBtn.innerHTML = top
      ? `<svg class="icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 11.5 8 14l6-2.5M2 11.5 8 9l6 2.5M2 7.5 8 5l6 2.5"/></svg>`
      : `<svg class="icon" viewBox="0 0 16 16" aria-hidden="true"><rect x="2.5" y="2.5" width="11" height="11" rx="1.5"/><path d="M8 5.5v5M5.5 8h5"/></svg>`;
  }
  const paintWords = () => {
    paintText(root, W());
    if (!doneEl.hidden) paintDoneNext();
    paintTop();
    paintBar();
    paintCoach();
    paintLabels();
  };

  // ------------------------------------------------------------------------------------------------ labels on the mat
  // the parts still waiting (and the parts before the pad closes), named above them; the board always
  const labelEls = new Map<string, HTMLElement>();
  const wanted = (): [string, Item | Cable | "board" | "sheets", string][] => {
    const L: [string, Item | Cable | "board" | "sheets", string][] = [];
    const used = (c: Cable) => ["a", "b"].some((e) => "to" in a.cable[c][e as "a" | "b"]);
    for (const f of ["top", "bot"] as const) {
      if (a.closed) continue;
      L.push([f, f, a.lam[f] ? say(f === "top" ? "name.topPart" : "name.botPart") : say(`name.${f}`)]);
    }
    // (the two sheets side by side, both free: one name over the pair)
    const free = (["sheetA", "sheetB"] as const).filter((s) => a.lam.top !== s && a.lam.bot !== s);
    if (free.length === 2) L.push(["sheets", "sheets", say("name.sheets")]);
    else for (const s of free) L.push([s, s, say("name.sheet")]);
    if (!a.velo) L.push(["velo", "velo", say("name.velo")]);
    for (const c of ["c16", "c32"] as const) if (!a.plugged[c]) L.push([c, c, say(`name.${c}`)]);
    for (const c of ["f16", "f32"] as const) if (!used(c)) L.push([c, c, say(`name.${c}`)]);
    if (!a.nano) L.push(["nano", "nano", say("name.nano")]);
    L.push(["board", "board", say("name.board")]);
    return L;
  };
  type Box = { x: number; y: number; w: number; h: number } | null;
  const both = (p: Box, q: Box): Box => {
    if (!p || !q) return p ?? q;
    const x = Math.min(p.x, q.x);
    const y = Math.min(p.y, q.y);
    return { x, y, w: Math.max(p.x + p.w, q.x + q.w) - x, h: Math.max(p.y + p.h, q.y + q.h) - y };
  };
  function paintLabels() {
    const want = wanted();
    const keep = new Set(want.map((w) => w[0]));
    for (const [k, e] of labelEls) if (!keep.has(k)) (e.remove(), labelEls.delete(k));
    for (const [k, id, text] of want) {
      let e = labelEls.get(k);
      if (!e) {
        e = document.createElement("span");
        e.className = "ab-label mono";
        labelsEl.append(e);
        labelEls.set(k, e);
      }
      e.textContent = text;
      const b = id === "sheets" ? both(scene.boxOf("sheetA"), scene.boxOf("sheetB")) : scene.boxOf(id);
      if (!b) {
        e.hidden = true;
        continue;
      }
      e.hidden = false;
      // (under it: the board's name, and the lower one's of each stacked pair, the 16-pin extender and cable; the others
      // above)
      const below = id === "board" || id === "c16" || id === "f16";
      e.style.transform = `translate(${(b.x + b.w / 2).toFixed(1)}px, ${(below ? b.y + b.h + 4 : b.y - 20).toFixed(1)}px)`;
    }
  }

  // ------------------------------------------------------------------------------------------------ marks
  // outlines on the canvas (screen px): the Hint's part and place (amber) and, while a part is held, the place it would
  // join (teal) or cannot (red)
  type Rect = { c: P2; w: number; d: number; z: number };
  const quad = (r: Rect) => {
    const pts: P3[] = [
      [r.c[0] - r.w / 2, r.c[1] - r.d / 2, r.z],
      [r.c[0] + r.w / 2, r.c[1] - r.d / 2, r.z],
      [r.c[0] + r.w / 2, r.c[1] + r.d / 2, r.z],
      [r.c[0] - r.w / 2, r.c[1] + r.d / 2, r.z],
    ];
    const s = pts.map((p) => scene.toScreen(p));
    return s.every(Boolean) ? (s as P2[]) : null;
  };
  /** Where a move's target lies, as a rectangle on the mat (plan). */
  const placeRect = (t: Move["target"] | "conn-c16" | "conn-c32"): Rect => {
    const pad = fpcAt(a, "bot");
    switch (t) {
      case "sheetA":
      case "sheetB":
        return { c: a.pos[t], w: SHEET.w + 2, d: SHEET.h + 2, z: 0.4 };
      case "bot":
        return { c: fpcAt(a, "bot"), w: VELO.w + 2, d: VELO.h + 2, z: 0.6 };
      case "tail-bot":
        return { c: [pad[0] + PLUG.c32.at[0], pad[1] + PLUG.c32.at[1]], w: CONN.c32.w + 2, d: CONN.d + 1, z: 3 };
      case "tail-top":
        return { c: [pad[0] + PLUG.c16.at[0], pad[1] + PLUG.c16.at[1]], w: CONN.c16.w + 2, d: CONN.d + 1, z: 5.5 };
      case "c16":
      case "c32": {
        const p = portAt(a, t);
        return { c: [p[0], p[1] + 1], w: CABLE[t === "c16" ? "f16" : "f32"].w + 3, d: 5, z: (t === "c16" ? PLUG.c16.z : 0) + 3 };
      }
      case "fpc1":
      case "fpc2": {
        const p = portAt(a, t);
        return { c: [p[0], p[1] + 2.4], w: SOCK.w(t === "fpc1" ? 16 : 32) + 2, d: SOCK.d + 1.5, z: BOARD_PORT_Z + 1 };
      }
      case "nano":
        return { c: nanoSeat(), w: 19, d: 44, z: BOARD.t + 11 };
      default:
        return { c: connAt(a, t === "conn-c16" ? "c16" : "c32"), w: 14, d: 14, z: 2 };
    }
  };
  /** The place a drop points at, from what it would join (or refuse). */
  const dropRect = (d: Drop, g: Grab): Rect | null => {
    if (!d.at) return null;
    if (g.kind !== "item") {
      const port = (["c16", "c32", "fpc1", "fpc2"] as Port[]).find((p) => Math.hypot(portAt(a, p)[0] - d.at![0], portAt(a, p)[1] - d.at![1]) < 0.5);
      return port ? placeRect(port) : null;
    }
    const id = g.id;
    if (d.joined?.startsWith("lam") || id === "sheetA" || id === "sheetB" || ((id === "top" || id === "bot") && !d.joined && !a.lam[id])) return { c: d.at, w: SHEET.w + 2, d: SHEET.h + 2, z: 0.5 };
    if (id === "velo" || id === "top" || id === "bot") return { c: d.at, w: VELO.w + 2, d: VELO.h + 2, z: 0.6 };
    if (id === "c16" || id === "c32") {
      const near = d.refused === "conn-wrong16" || d.joined === "plug-c32" ? "tail-bot" : d.refused === "conn-wrong32" || d.joined === "plug-c16" ? "tail-top" : null;
      return near ? placeRect(near) : { c: d.at, w: 12, d: 6, z: 1 };
    }
    if (id === "nano") return placeRect("nano");
    return null;
  };
  let coachMove: Move | null = null;
  function paintMarks() {
    const parts: string[] = [];
    const poly = (r: Rect | null, cls: string) => {
      if (!r) return null;
      const q = quad(r);
      if (!q) return null;
      parts.push(`<polygon class="${cls}" points="${q.map((p) => p.map((v) => v.toFixed(1)).join(",")).join(" ")}"/>`);
      return q.reduce<P2>((m, p) => [m[0] + p[0] / 4, m[1] + p[1] / 4], [0, 0]);
    };
    if (held?.preview?.at) poly(dropRect(held.preview, held.grab), held.preview.joined ? "ab-mk ab-mk-ok" : held.preview.refused ? "ab-mk ab-mk-bad" : "ab-mk");
    if (coachOn && coachMove && !held) {
      const g = coachMove.grab;
      const id: Item | Cable = g.kind === "item" ? g.id : g.id;
      let from: P2 | null = null;
      if (g.kind === "end") {
        const p = (() => {
          const e = a.cable[g.id][g.end];
          return "at" in e ? scene.toScreen([e.at[0], e.at[1], 0.2]) : null;
        })();
        if (p) {
          parts.push(`<circle class="ab-mk ab-mk-coach ab-mk-ring" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="13"/>`);
          from = p;
        }
      } else {
        const b = scene.boxOf(id);
        if (b) {
          parts.push(`<rect class="ab-mk ab-mk-coach" x="${(b.x - 6).toFixed(1)}" y="${(b.y - 6).toFixed(1)}" width="${(b.w + 12).toFixed(1)}" height="${(b.h + 12).toFixed(1)}" rx="10"/>`);
          from = [b.x + b.w / 2, b.y + b.h / 2];
        }
      }
      const to = poly(placeRect(coachMove.target), "ab-mk ab-mk-coach ab-mk-place");
      if (from && to) parts.push(`<line class="ab-mk-line" x1="${from[0].toFixed(1)}" y1="${from[1].toFixed(1)}" x2="${to[0].toFixed(1)}" y2="${to[1].toFixed(1)}"/>`);
    }
    marks.innerHTML = parts.join("");
  }
  scene.onChange(() => {
    paintLabels();
    paintMarks();
  });

  // ------------------------------------------------------------------------------------------------ the Hint
  const hintKey = (m: Move) => `hint.${m.goal}`;
  function paintCoach() {
    root.classList.toggle("has-coach", coachOn);
    hintBtn.classList.toggle("is-on", coachOn);
    hintBtn.setAttribute("aria-expanded", String(coachOn));
    coachEl.hidden = !coachOn;
    coachMove = coachOn ? next(a) : null;
    if (coachOn) {
      coachCap.textContent = say(coachMove ? "coach.cap" : "coach.done");
      coachText.textContent = say(coachMove ? hintKey(coachMove) : "hint.done");
      coachDo.hidden = !coachMove;
    }
    paintMarks();
  }
  hintBtn.addEventListener("click", () => {
    coachOn = !coachOn;
    paintCoach();
  });
  coachDo.addEventListener("click", () => {
    const m = next(a);
    if (!m) return;
    const d = drop(a, m.grab, m.to, m.to);
    if (d.joined) commit(d, 650);
  });

  // ------------------------------------------------------------------------------------------------ changes
  let wasDone = allDone(a);
  const changed = () => {
    save();
    paintBar();
    paintCoach();
    paintLabels();
    undoBtn.disabled = !undo.length;
    scene.power(allDone(a));
    follow();
    // (put together: the badge comes up once the Nano is in)
    if (allDone(a) && !wasDone) {
      window.clearTimeout(doneTimer);
      doneTimer = window.setTimeout(showDone, reduced ? 0 : 750);
    }
    if (!allDone(a)) hideDone();
    wasDone = allDone(a);
  };

  // ------------------------------------------------------------------------------------------------ the badge
  // "Good job!" over the bench when the last part goes in (not when a finished bench is opened again): a tick that draws
  // itself in a teal disc, a burst of bits in the parts' colours, the way on to step 2 (the test) and "Look around", which
  // (as Escape or a click beside the card) puts it away to see the finished thing
  const doneEl = $<HTMLElement>(".ab-done");
  const burst = $<HTMLElement>(".ab-burst");
  const BITS = ["var(--ft-hotspot)", "#f2b445", "#ef8a3a", "#4f7cf7", "var(--ink)"];
  const N = 30;
  burst.innerHTML = Array.from({ length: N }, (_, i) => {
    const t = (i / N) * Math.PI * 2 + (i % 3) * 0.19;
    const r = 84 + (i % 5) * 19;
    const dot = i % 4 === 3 ? " class=\"is-dot\"" : "";
    return `<i${dot} style="--dx:${(Math.cos(t) * r * 1.25).toFixed(1)}px;--dy:${(Math.sin(t) * r * 0.75 - 18).toFixed(1)}px;--r:${(i * 67) % 360 + 180}deg;--c:${BITS[i % BITS.length]};--d:${((i % 6) * 0.025).toFixed(3)}s"></i>`;
  }).join("");
  let doneTimer = 0;
  let doneOnward: HTMLElement | null = null;
  const paintDoneNext = () => {
    doneOnward?.remove();
    doneOnward = onwardButton();
    if (doneOnward) $<HTMLElement>(".ab-done-next").append(doneOnward);
  };
  function showDone() {
    if (!allDone(a)) return;
    paintDoneNext();
    doneEl.hidden = false;
    // (again from the start each time it comes up)
    doneEl.classList.remove("is-on");
    void doneEl.offsetWidth;
    doneEl.classList.add("is-on");
  }
  function hideDone() {
    window.clearTimeout(doneTimer);
    doneEl.hidden = true;
    doneEl.classList.remove("is-on");
  }
  $<HTMLButtonElement>(".ab-done-look").addEventListener("click", hideDone);
  doneEl.addEventListener("click", (e) => {
    if (!(e.target as HTMLElement).closest(".ab-done-card")) hideDone();
  });
  root.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !doneEl.hidden) hideDone();
  });
  function commit(d: Drop, glide: number) {
    undo.push(clone(a));
    if (undo.length > 60) undo.shift();
    a = d.a;
    scene.show(a, { glide });
    // (everything in: the bar says so, and the Hint has nothing left to say)
    if (allDone(a)) coachOn = false;
    slideNext = d.joined === "close";
    if (d.joined) {
      // (a cable's join is "cable-<cable>-<port>": into its extender, or at the board)
      const [, c, port] = d.joined.split("-");
      const k = d.joined.startsWith("cable-") ? `ok.${port.startsWith("fpc") ? "board" : "ffc"}-${c}` : `ok.${d.joined}`;
      // (the last one: the badge says it, not a note)
      if (allDone(a)) noteEl.classList.remove("is-on");
      else note(say(k), "ok", 4200);
    }
    changed();
  }

  // ------------------------------------------------------------------------------------------------ the pointer
  const PICK_SLOP = 5;
  let down: { x: number; y: number; hit: Hit | null; id: number } | null = null;
  const grabOf = (h: Hit | null): Grab | null => {
    if (!h || h.kind === "board") return null;
    if (h.kind === "cable") {
      // (a cable with one end in a port is taken by its free end)
      const c = a.cable[h.id];
      if ("to" in c.a && "to" in c.b) return null;
      if ("to" in c.a) return { kind: "end", id: h.id, end: "b" };
      if ("to" in c.b) return { kind: "end", id: h.id, end: "a" };
      return { kind: "cable", id: h.id };
    }
    return h;
  };
  const infoOf = (h: Hit): string => {
    if (h.kind === "board") return say("info.board");
    const id = h.id;
    if (id === "sheetA" || id === "sheetB") return say("info.sheet");
    return say(`info.${id}`);
  };
  stage.addEventListener(
    "pointerdown",
    (e) => {
      if (e.button !== 0 || (e.target as HTMLElement).closest("button, a, .ab-coach, .ab-track, .ab-done")) return;
      const hit = scene.pick(e.clientX, e.clientY);
      const g = grabOf(hit);
      down = { x: e.clientX, y: e.clientY, hit, id: e.pointerId };
      if (!g || !unitOf(a, g)) return;
      // a part: the view stays still while it is held
      scene.orbit(false);
      const p = scene.planAt(e.clientX, e.clientY, 0);
      const u = unitOf(a, g)!;
      if (!p) return;
      held = { grab: g, off: [u.anchor[0] - p[0], u.anchor[1] - p[1]], hand: p, preview: null };
      stage.setPointerCapture(e.pointerId);
    },
    { capture: true },
  );
  stage.addEventListener("pointermove", (e) => {
    if (!held) {
      // what is under the pointer: a hand over what can be taken
      if (e.buttons) return;
      const g = grabOf(scene.pick(e.clientX, e.clientY));
      root.dataset.cursor = g && unitOf(a, g) ? "grab" : "";
      return;
    }
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < PICK_SLOP && !root.classList.contains("is-holding")) return;
    const p = scene.planAt(e.clientX, e.clientY, 0);
    if (!p) return;
    root.classList.add("is-holding");
    held.hand = p;
    const anchor: P2 = [p[0] + held.off[0], p[1] + held.off[1]];
    held.preview = drop(a, held.grab, anchor, p);
    scene.show(moveUnit(a, held.grab, anchor), { held: held.grab });
    paintMarks();
  });
  const end = (e: PointerEvent) => {
    const wasDrag = root.classList.contains("is-holding");
    root.classList.remove("is-holding");
    if (held && wasDrag) {
      const anchor: P2 = [held.hand[0] + held.off[0], held.hand[1] + held.off[1]];
      const d = drop(a, held.grab, anchor, held.hand);
      held = null;
      if (d.joined) commit(d, 260);
      else {
        // (it lies where it was let go; a refusal says why)
        if (d.refused) note(say(`no.${d.refused}`), "no", 5200);
        undo.push(clone(a));
        a = keepOnMat(d.a);
        scene.show(a, { glide: 120 });
        changed();
      }
    } else if (down && e.type === "pointerup" && Math.hypot(e.clientX - down.x, e.clientY - down.y) < PICK_SLOP && down.hit) note(infoOf(down.hit), "info", 5200);
    held = null;
    down = null;
    scene.orbit(true);
    paintMarks();
  };
  stage.addEventListener("pointerup", end);
  stage.addEventListener("pointercancel", end);
  /** Nothing is let go off the mat: a part dropped past its edge comes back onto it. */
  const keepOnMat = (b: Assembly): Assembly => {
    const lim = (p: P2): P2 => [Math.min(LAYOUT.x1 + 40, Math.max(LAYOUT.x0 - 30, p[0])), Math.min(LAYOUT.y1 + 30, Math.max(LAYOUT.y0 - 25, p[1]))];
    for (const k of Object.keys(b.pos) as Item[]) b.pos[k] = lim(b.pos[k]);
    for (const c of ["f16", "f32"] as const) for (const e of ["a", "b"] as const) if ("at" in b.cable[c][e]) b.cable[c][e] = { at: lim((b.cable[c][e] as { at: P2 }).at) };
    return b;
  };

  // ------------------------------------------------------------------------------------------------ the corner
  root.querySelector(".ab-corner")!.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (!b) return;
    const act = b.dataset.act;
    if (act === "top") {
      top = !top;
      scene.home(framed, top);
      paintTop();
    } else if (act === "home") fly(viewNow());
    else if (act === "undo") {
      const prev = undo.pop();
      if (!prev) return;
      slideNext = false;
      a = prev;
      scene.show(a, { glide: 260 });
      changed();
    } else if (act === "clear") {
      slideNext = false;
      undo.push(clone(a));
      a = START_ASSEMBLY();
      scene.show(a, { glide: 420 });
      changed();
    }
  });

  // ------------------------------------------------------------------------------------------------ size, theme, words
  const ro = new ResizeObserver(() => {
    const r = stage.getBoundingClientRect();
    scene.resize(r.width, r.height);
    paintLabels();
    paintMarks();
    fitPath();
  });
  ro.observe(stage);
  // (the note sits just above the bar's card, which grows with the Hint's row)
  const foot = $<HTMLElement>(".ab-foot");
  const roFoot = new ResizeObserver(() => root.style.setProperty("--ab-foot", `${foot.offsetHeight}px`));
  roFoot.observe(foot);
  const offTheme = ctx.onTheme((t) => {
    theme = t;
    scene.setTheme(t);
  });
  const offLang = ctx.onLang(() => paintWords());
  paintWords();
  changed();
  // (the dev server's checks reach the scene and the assembly here; the build leaves it out)
  if (import.meta.env.DEV) Object.assign(root, { __ab: { scene, state: () => a } });

  return {
    reset() {
      undo.length = 0;
      a = START_ASSEMBLY();
      coachOn = false;
      scene.show(a);
      changed();
    },
    layout() {
      const r = stage.getBoundingClientRect();
      scene.resize(r.width, r.height);
    },
    destroy() {
      window.clearTimeout(noteTimer);
      window.clearTimeout(doneTimer);
      window.clearTimeout(followTimer);
      ro.disconnect();
      roFoot.disconnect();
      offTheme();
      offLang();
      scene.dispose();
      root.remove();
    },
  };
}
