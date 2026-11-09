// Chips lab: the stage of Lesson 2.2 "Chips and connectors" (src/lessons/08-chips-and-connectors.ts), a lesson without a
// figure. One flat drawing per guided step (GuidedStep.widgetView {view}), in the drawing style of Lesson 1.2's demo
// cards, with a card beside it in the demo cards' look:
//   "mux"      the CD74HC4067 as a 16-way rotary switch in a dashed outline: S3-S0 toggles (D7-D4) spell the channel,
//              E# (D8) switches the chip off; three FSRs hang from a +5 V rail (on the pad: the one powered drive line,
//              each FSR a crossing on it) onto channels 5, 8 and 11; COM runs to A0 with Lesson 2.1's 10 kΩ to ground;
//              "Read them in turn" fills a 16-cell bar (./chips/mux.ts; the pressed FSR is Lesson 2.1's, ./chips/press.ts).
//              Card: the wiring to the Nano.
//   "shift"    the 74HC595 as eight boxes and, under them, the output latch's eight: DATA (D2), CLOCK, LATCH, eight LEDs;
//              the walking 1; four chips chained (./chips/shift.ts). Card: the wiring to the Nano (D3 drives both clocks
//              on the board).
//   "fingers"  the pad's two tails to scale, 12 and 32 gold fingers, in the middle with a one-line hint; a click moves
//              them up and shows one finger up close and from the side (./chips/fingers.ts). Card: where else gold fingers
//              are used, and a photo from the hardware guide.
//   "ffc"      a ZIF socket and a flat cable in a side section, cropped to what moves: lift the latch, slide in, press
//              down; turn the cable over and nothing connects (./chips/ffc.ts). Card: where else flat cables are used, two
//              guide photos.
// The stage: the widget fills the stage body (no stage card): a kicker row (the part, and a small note on the right),
// the drawing with the card on its right, the view's buttons and one live caption under them. The drawing is laid out
// in design units and scaled to its box (./chips/svg.ts frame); its type keeps a steady size. Every word is in S below
// (docs/i18n.md): a language switch repaints the words and keeps every state. Colours come from CSS tokens
// (chips-lab.css), so a theme switch needs nothing here. Reduced motion: no tweens and no moving dots; the timed scan
// and the walking 1 still step (the learner starts them). Timers stop while the tab is hidden.
// Run (the code card): sets the multiplexer to the sketch's channel and prints what the Serial Monitor would show (and,
// on steps 2-4, where the multiplexer turned). reset() puts every view back to the lesson's opening state when the
// learner presses "Start the steps again" (WidgetInstance.reset, called by views/lesson.ts).
import { COLS, MUX_OFFSET, ROWS } from "@shared/data/constants.mjs";
import { stack } from "@shared/data/index.mjs";
import { getFact } from "../content/facts";
import { fill, strings } from "../i18n";
import type { WidgetCtx, WidgetInstance } from "../types";
import { h } from "../ui/dom";
import { chainPicture, useIcon, wiringPicture, type PinRow } from "./chips/art";
import { drawFfc, ffcConnected, ffcState, FFC_CLOSED, FFC_SIZE, LATCH_TOP, type FfcDrawing, type FfcPose } from "./chips/ffc";
import { drawFingers, fingersState, FINGERS_SIZE, type FingersDrawing } from "./chips/fingers";
import { drawMux, FSR_CH, muxRead, muxState, MUX_SIZE, readAt, type MuxDrawing } from "./chips/mux";
import { clockOnce, drawShift, latchOnce, setChain, shiftState, SHIFT_SIZE, SHIFT_SIZE_4, type ShiftDrawing } from "./chips/shift";
import { frame } from "./chips/svg";
import "./chips-lab.css";

type ViewId = "mux" | "shift" | "fingers" | "ffc";
const VIEW_IDS: ViewId[] = ["mux", "shift", "fingers", "ffc"];
const LAST_CH = MUX_OFFSET + ROWS - 1;

const FINGERS = {
  count: [getFact("fpc_top.fingers.count").value as number, getFact("fpc_bot.fingers.count").value as number] as [number, number],
  size: getFact("fpc_top.fingers.size").value as [number, number],
  pitch: getFact("fpc_top.fingers.pitch").value as number,
  thick: stack.fpcBuild.goldFingerThickness,
  fpc: getFact("fpc_top.thickness").value as number,
};
// (the numbers in the words below come from the shared data, as the lesson's do)
const [NF_T, NF_B] = FINGERS.count;
const [FW, FL] = FINGERS.size;
const nf = (v: number) => v.toFixed(1);

const S = strings(
  {
    // the kicker row
    kMux: "Multiplexer",
    kShift: "Shift register",
    kFingers: "Gold fingers",
    kFfc: "Flat cable",
    pFingers: "the pad's two tails",
    pFfc: "ZIF socket",
    tagMux: "FSR readings illustrative",
    tagFingers: "Drawn to scale",
    tagFfc: "Side view · not to scale",
    ariaMux: `A 16-way switch: four select pins pick the channel that reaches A0. Three FSRs sit on channels ${FSR_CH[0]}, ${FSR_CH[1]} and ${FSR_CH[2]}.`,
    ariaShift: "Eight boxes in a row. Data, clock and latch move a single 1 along eight outputs.",
    ariaFingers: `The ends of the pad's two tails, drawn to scale: ${NF_T} gold fingers and ${NF_B} gold fingers.`,
    ariaFfc: "A flat cable and a ZIF socket, cut through and seen from the side.",
    // the multiplexer
    com: "COM",
    kohm: "10 kΩ",
    gnd: "GND",
    v5: "+5 V",
    fsr: "FSR",
    on: "on",
    off: "off",
    bracket: `on the reading board: sense lines 1–${ROWS}`,
    sum: "{expr} = channel {n}",
    bitAria: "{s}, from Nano pin {d}, worth {w}: now {b}. Press to flip it.",
    eAria: "E#, the enable pin: now {b}, so the chip is {state}. Press to flip it.",
    fsrAria: "FSR on channel {n}: {state}. Press to {act} it.",
    pressed: "pressed",
    notPressed: "not pressed",
    press: "press",
    release: "release",
    cellAria: "channel {n}: {v}",
    readBtn: "Read them in turn",
    stopBtn: "Stop",
    capStart: "The FSR on channel 8 is pressed, but the switch picks channel 0, so A0 reads 0. Click S3 to make it 1: that picks channel 8.",
    capHere: "Channel {n} is picked and its FSR is pressed: current flows through it to A0, which reads {v}.",
    capFsrUp: "Channel {n} is picked, but its FSR is not pressed, so no current flows and A0 reads 0. Click the FSR to press it.",
    capEmpty: "Channel {n} is picked. No FSR sits on it here, so the 10 kΩ resistor holds A0 at 0.",
    capOther: "The pressed FSR on channel {m} is not picked, so A0 can't hear it.",
    capOtherN: "The pressed FSRs on channels {m} are not picked, so A0 can't hear them.",
    and: " and ",
    sp: " ",
    capOff: "E# is HIGH, so every channel is disconnected and A0 reads 0 on any channel. Click E# to set it LOW again.",
    capScan: "Reading channel {n}: the select pins count up in binary, and A0 hears one channel at a time.",
    capScanDone: `All 16 channels, read one at a time: each bright cell is a pressed FSR. On the board, channels ${MUX_OFFSET}\u2060–\u2060${LAST_CH} are the ${ROWS} sense lines.`,
    // the shift register
    data: "DATA",
    latchW: "latch",
    clockW: "clock",
    outputs: "outputs: on the board, drive lines 1–8",
    rowLines: "lines {a}–{b}",
    dataAria: "DATA, from Nano pin D2: now {b}. Press to flip it.",
    dataBtn: "Data {b}",
    clockBtn: "Clock",
    latchBtn: "Latch",
    walkBtn: "Walking 1",
    pauseBtn: "Pause",
    chainBtn: "Chain 4 chips",
    capShiftStart: "DATA is 1. Press Clock: every box passes its bit one box along, and the 1 drops into QA.",
    capData: "DATA is now {b}. The next Clock puts it into QA.",
    capClock: "Clock: every bit moved one box along, and QA took DATA's {b}. The outputs wait for Latch.",
    capSpill: "Clock: the 1 left the last box through QH′. In a chain it would go on into the next chip.",
    capLatch: "Latch: the boxes were copied to the outputs all at once. Outputs on: {n} of {total}.",
    capWalk: "The walking 1: one 1 goes in, then 0s. Each Clock and Latch moves it one output along. That is how the board powers one drive line at a time.",
    capChain: `Four chips in a chain: each QH′ feeds the next chip's first box. ${COLS} outputs, and still no extra Nano pins.`,
    // the gold fingers
    top: "Top FPC · {n} fingers",
    bottom: "Bottom FPC · {n} fingers",
    fHint: "Click a finger to see it up close",
    close: "Up close",
    sideV: "Side view, thickness enlarged",
    wide: "{v} mm wide",
    pitchW: "{v} mm pitch",
    long: "{v} mm long",
    thick: "{v} mm thick",
    finger: "gold finger",
    fpc: "FPC",
    stiff: "stiffener",
    pickAria: "{tail}: press to see a finger up close",
    sizesBtn: "Show the sizes",
    hideBtn: "Hide the sizes",
    capFingers: `One finger for each line, so ${NF_T} on the Top FPC's tail and ${NF_B} on the Bottom FPC's.`,
    capFingerSel: `Each finger is ${FW} mm wide and ${nf(FL)} mm long, one every ${FINGERS.pitch} mm. With its stiffener the tail's end is ${FINGERS.thick} mm thick, the thickness its socket expects.`,
    // the flat cable
    latchL: "latch",
    spring: "spring",
    contacts: "bare contacts",
    board: "board",
    ffcLift: "Lift the latch",
    ffcIn: "Slide the cable in",
    ffcDown: "Press the latch down",
    ffcOut: "Take the cable out",
    ffcFlip: "Turn the cable over",
    cap00: "The latch is down, so the slot is shut. Lift the latch first.",
    cap10: "The slot is open. The cable's bare contacts face down, toward the spring.",
    cap10f: "The cable is turned over: its bare contacts now face up, away from the spring.",
    cap11: "The cable slid in without any force: nothing presses on it yet. Now press the latch down.",
    cap01: "Connected. The latch presses the cable onto the spring, so the bare contact touches metal. Each line has a spring of its own.",
    cap01f: "Latched, but nothing connects: the spring presses on the blue stiffener, and the bare contact faces the latch.",
    // the side card
    wiringK: "Wiring on the reading board",
    nano: "Arduino Nano",
    noteMux: "On the board, D4–D7 spell the channel in binary, and D8 keeps E# LOW almost all the time.",
    noteShift: "On the board, D3 drives SRCLK (the clock) and RCLK (the latch), so every Clock is also a Latch: the outputs follow one clock behind (Lesson 2.4).",
    noteChain: "D2 feeds only the first chip. D3 ticks all four, and each QH′ feeds the next chip's SER.",
    clkBus: "D3: both clocks",
    elseFingers: "Gold fingers elsewhere",
    elseFfc: "Flat cables elsewhere",
    ram: "Memory stick",
    gpu: "Graphics card",
    cart: "Game cartridge",
    laptop: "Laptop",
    camera: "Camera module",
    printer: "Printer",
    photoFingers: "A tail's gold fingers going into an FFC extender · hardware guide",
    photoSockets: "The reading board's two sockets, cables in and latched · hardware guide",
    photoFitting: "Fitting a flat cable into the extender on a tail · hardware guide",
    altFingers: "Two hands push the gold fingers at the end of a FlexiTac tail into a small FFC extender.",
    altSockets: "The reading board's two flat-cable sockets, FPC2 and FPC1, each holding a white cable with a blue stiffener.",
    altFitting: "Two hands slide a white flat cable into the FFC extender on a FlexiTac tail.",
    photoN: "Photo {k} of {n}",
    // Run (the code card)
    runSet: "setChannel({ch}): D7 D6 D5 D4 = {bits}",
    runMon: "Serial Monitor: {v}, {v}, {v}, …",
    runPressed: "(the FSR on channel {ch} is pressed)",
    runNone: "(nothing pressed on channel {ch}, so A0 reads 0)",
    runWalk: `then one clock a loop: the 1 walks drive lines 1 → ${COLS}`,
    runElse: "(in step 1's drawing, the multiplexer turned to channel {ch})",
  },
  {
    kMux: "多路选择器",
    kShift: "移位寄存器",
    kFingers: "金手指",
    kFfc: "FFC 排线",
    pFingers: "传感垫的两条尾线",
    pFfc: "ZIF 座子",
    tagMux: "FSR 读数为示意",
    tagFingers: "按实际比例绘制",
    tagFfc: "侧视图 · 未按比例",
    ariaMux: `一个 16 档开关：四个选择引脚决定哪个通道接到 A0。三个 FSR 接在通道 ${FSR_CH[0]}、${FSR_CH[1]} 和 ${FSR_CH[2]} 上。`,
    ariaShift: "排成一排的八个格子。数据、时钟和锁存让一个 1 沿着八个输出移动。",
    ariaFingers: `传感垫两条尾线的末端，按实际比例绘制：${NF_T} 根金手指和 ${NF_B} 根金手指。`,
    ariaFfc: "剖开后从侧面看到的一根 FFC 排线和一个 ZIF 座子。",
    com: "COM",
    kohm: "10 kΩ",
    gnd: "GND",
    v5: "+5 V",
    fsr: "FSR",
    on: "开",
    off: "关",
    bracket: `在读取板上：感应线 1–${ROWS}`,
    sum: "{expr} = 通道 {n}",
    bitAria: "{s}，接 Nano 的 {d}，权重 {w}：现在是 {b}。点击切换。",
    eAria: "E#，使能引脚：现在是 {b}，芯片{state}。点击切换。",
    fsrAria: "通道 {n} 上的 FSR：{state}。点击{act}。",
    pressed: "已按下",
    notPressed: "未按下",
    press: "按下",
    release: "松开",
    cellAria: "通道 {n}：{v}",
    readBtn: "轮流读一遍",
    stopBtn: "停止",
    capStart: "通道 8 上的 FSR 被按着，可开关选的是通道 0，所以 A0 读到 0。点 S3 把它变成 1，就选中了通道 8。",
    capHere: "选中了通道 {n}，它上面的 FSR 正被按着：电流经过它流到 A0，A0 读到 {v}。",
    capFsrUp: "选中了通道 {n}，但它上面的 FSR 没被按下，没有电流，A0 读到 0。点一下 FSR 把它按下。",
    capEmpty: "选中了通道 {n}。图里这个通道上没有 FSR，10 kΩ 电阻把 A0 拉在 0。",
    capOther: "通道 {m} 上的 FSR 虽然被按着，但没有被选中，A0 听不到它。",
    capOtherN: "通道 {m} 上的 FSR 虽然被按着，但没有被选中，A0 听不到它们。",
    and: " 和 ",
    sp: "",
    capOff: "E# 是 HIGH，所有通道都断开了，无论选哪个通道，A0 都读到 0。点 E# 把它重新设为 LOW。",
    capScan: "正在读通道 {n}：选择引脚按二进制一路数上去，A0 一次只听一个通道。",
    capScanDone: `16 个通道一个一个读完了：亮的格子就是被按下的 FSR。在读取板上，通道 ${MUX_OFFSET}\u2060–\u2060${LAST_CH} 接的是 ${ROWS} 条感应线。`,
    data: "数据",
    latchW: "锁存",
    clockW: "时钟",
    outputs: "输出：在读取板上就是驱动线 1–8",
    rowLines: "驱动线 {a}–{b}",
    dataAria: "数据位，接 Nano 的 D2：现在是 {b}。点击切换。",
    dataBtn: "数据 {b}",
    clockBtn: "时钟",
    latchBtn: "锁存",
    walkBtn: "走动的 1",
    pauseBtn: "暂停",
    chainBtn: "级联 4 片",
    capShiftStart: "数据位是 1。按一下“时钟”：每个格子把自己的位传给下一格，这个 1 就落进 QA。",
    capData: "数据位现在是 {b}。下一次“时钟”会把它放进 QA。",
    capClock: "时钟：所有的位都往后挪了一格，QA 接收了数据位的 {b}。输出要等“锁存”才会变。",
    capSpill: "时钟：这个 1 从最后一格经 QH′ 出去了。级联时，它会接着进入下一片芯片。",
    capLatch: "锁存：所有格子一下子复制到了输出上。{total} 个输出里有 {n} 个亮着。",
    capWalk: "走动的 1：先送进一个 1，之后都送 0。每次“时钟”加“锁存”，它就往后走一个输出。读取板正是这样一次只给一条驱动线通电。",
    capChain: `四片级联：每片的 QH′ 接到下一片的第一个格子。一共 ${COLS} 个输出，Nano 一个引脚也没多用。`,
    top: "顶层 FPC · {n} 根金手指",
    bottom: "底层 FPC · {n} 根金手指",
    fHint: "点一根金手指，近看它的尺寸",
    close: "近看",
    sideV: "侧视图，厚度放大",
    wide: "宽 {v} mm",
    pitchW: "间距 {v} mm",
    long: "长 {v} mm",
    thick: "厚 {v} mm",
    finger: "金手指",
    fpc: "FPC",
    stiff: "补强板",
    pickAria: "{tail}：点击近看一根金手指",
    sizesBtn: "显示尺寸",
    hideBtn: "隐藏尺寸",
    capFingers: `每条线对应一根金手指，所以顶层 FPC 的尾线上有 ${NF_T} 根，底层 FPC 的有 ${NF_B} 根。`,
    capFingerSel: `每根金手指宽 ${FW} mm、长 ${nf(FL)} mm，相邻两根中心相距 ${FINGERS.pitch} mm。加上补强板，尾线末端厚 ${FINGERS.thick} mm，正是座子要求的厚度。`,
    latchL: "锁扣",
    spring: "弹片",
    contacts: "裸露触点",
    board: "电路板",
    ffcLift: "掀开锁扣",
    ffcIn: "插入排线",
    ffcDown: "压下锁扣",
    ffcOut: "拔出排线",
    ffcFlip: "把排线翻过来",
    cap00: "锁扣是压下的，插口关着。先把锁扣掀开。",
    cap10: "插口打开了。排线的裸露触点朝下，对着弹片。",
    cap10f: "排线翻过来了：裸露触点现在朝上，背对着弹片。",
    cap11: "排线不用使劲就插进去了：现在还没有东西压着它。接着把锁扣压下。",
    cap01: "接通了。锁扣把排线压在弹片上，裸露触点碰到了金属。每条线都有自己的一片弹片。",
    cap01f: "锁扣压好了，却什么也没接通：弹片压在蓝色补强板上，裸露触点朝着锁扣。",
    wiringK: "读取板上的接线",
    nano: "Arduino Nano",
    noteMux: "在读取板上，D4–D7 用二进制拼出通道号，D8 几乎一直把 E# 保持在 LOW。",
    noteShift: "在读取板上，D3 同时接 SRCLK（时钟）和 RCLK（锁存），所以每次“时钟”也是一次“锁存”：输出比格子晚一个时钟（第 2.4 课）。",
    noteChain: "D2 只接第一片。D3 同时给四片打时钟，每片的 QH′ 接下一片的 SER。",
    clkBus: "D3：两个时钟",
    elseFingers: "别处的金手指",
    elseFfc: "别处的 FFC 排线",
    ram: "内存条",
    gpu: "显卡",
    cart: "游戏卡带",
    laptop: "笔记本电脑",
    camera: "相机模组",
    printer: "打印机",
    photoFingers: "尾线的金手指插进 FFC 转接板 · 硬件指南",
    photoSockets: "读取板上的两个座子，排线已插好、锁扣已压下 · 硬件指南",
    photoFitting: "把 FFC 排线插进尾线上的转接板 · 硬件指南",
    altFingers: "两只手把 FlexiTac 尾线末端的金手指推进一块小小的 FFC 转接板。",
    altSockets: "读取板上的两个排线座子 FPC2 和 FPC1，各插着一根带蓝色补强板的白色排线。",
    altFitting: "两只手把一根白色 FFC 排线插进 FlexiTac 尾线上的转接板。",
    photoN: "第 {k} 张照片，共 {n} 张",
    runSet: "setChannel({ch})：D7 D6 D5 D4 = {bits}",
    runMon: "串口监视器：{v}, {v}, {v}, …",
    runPressed: "（通道 {ch} 上的 FSR 被按着）",
    runNone: "（通道 {ch} 上没有按下的 FSR，A0 读到 0）",
    runWalk: `然后每轮打一次时钟：这个 1 从驱动线 1 走到 ${COLS}`,
    runElse: "（第 1 步图中的多路选择器已转到通道 {ch}）",
  },
);

const PHOTOS = {
  fingers: [{ src: "media/chips/fingers-in.webp", cap: "photoFingers", alt: "altFingers" }],
  ffc: [
    { src: "media/chips/sockets.webp", cap: "photoSockets", alt: "altSockets" },
    { src: "media/chips/cable-in.webp", cap: "photoFitting", alt: "altFitting" },
  ],
} as const;
type Key = keyof ReturnType<typeof S>;

const ICON_PLAY = '<svg class="cl-ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3.5v9l7.5-4.5z"/></svg>';
const ICON_STOP = '<svg class="cl-ico" viewBox="0 0 16 16" aria-hidden="true"><rect x="4.5" y="4.5" width="7" height="7" rx="1"/></svg>';
const ICON_PAUSE = '<svg class="cl-ico" viewBox="0 0 16 16" aria-hidden="true"><rect x="4" y="3.5" width="2.8" height="9" rx="0.8"/><rect x="9.2" y="3.5" width="2.8" height="9" rx="0.8"/></svg>';

let seq = 0;

export function mount(el: HTMLElement, ctx: WidgetCtx): WidgetInstance {
  const reduced = ctx.reducedMotion();
  const uid = `cl${++seq}`;
  let view: ViewId = "mux";

  // ---- state, kept across views and language switches
  const mux = muxState();
  let muxTouched = false;
  let scanDone = false;
  let scanTimer = 0;
  let scanCh = 0;
  const shift = shiftState();
  let shiftNote: Key | "" = "capShiftStart";
  let shiftVars: Record<string, string | number> = {};
  let walking = false;
  let walkTimer = 0;
  const later: number[] = [];
  const fingers = fingersState();
  const ffc = ffcState();

  // ---- the frame
  const root = h("div", { class: `cl${reduced ? " is-reduced" : ""}`, "data-view": view });
  root.innerHTML = `
    <div class="cl-head">
      <p class="cl-kicker mono"><span class="cl-mark" aria-hidden="true"></span><span class="cl-name"></span><span class="cl-sep" aria-hidden="true">·</span><span class="cl-part"></span></p>
      <p class="cl-tag mono"></p>
    </div>
    <div class="cl-main">
      <div class="cl-draw"><svg class="cl-svg" role="group"></svg></div>
      <aside class="cl-side"></aside>
    </div>
    <div class="cl-foot">
      <div class="cl-ctl"></div>
      <p class="cl-cap" aria-live="polite"></p>
    </div>`;
  el.append(root);
  const $ = <T extends Element = HTMLElement>(sel: string) => root.querySelector(sel) as T;
  const drawBox = $(".cl-draw");
  const svg = $<SVGSVGElement>(".cl-svg");
  const side = $(".cl-side");
  const ctl = $(".cl-ctl");
  const cap = $(".cl-cap");

  let md: MuxDrawing | null = null;
  let sd: ShiftDrawing | null = null;
  let fd: FingersDrawing | null = null;
  let xd: FfcDrawing | null = null;
  let muxWires: SVGPathElement[] = [];
  let shiftWires: SVGPathElement[] = [];
  let chainWires: { data: SVGPathElement; clock: SVGPathElement[] } | null = null;
  let photoK = 0;

  // ---- words
  const W = () => S();
  const kick = () => {
    const s = W();
    const names: Record<ViewId, [string, string, string]> = {
      mux: [s.kMux, "CD74HC4067", s.tagMux],
      shift: [s.kShift, "74HC595", ""],
      fingers: [s.kFingers, s.pFingers, s.tagFingers],
      ffc: [s.kFfc, s.pFfc, s.tagFfc],
    };
    const [n, p, t] = names[view];
    $(".cl-name").textContent = n;
    $(".cl-part").textContent = p;
    $(".cl-tag").textContent = t;
    svg.setAttribute("aria-label", { mux: s.ariaMux, shift: s.ariaShift, fingers: s.ariaFingers, ffc: s.ariaFfc }[view]);
  };

  // ---- the drawing
  const destroyDrawing = () => {
    // (each is let go before it is destroyed: a socket move in flight finishes at once, and its next move must not
    // start on the old drawing)
    const [m, s, x] = [md, sd, xd];
    md = sd = null;
    fd = null;
    xd = null;
    m?.destroy();
    s?.destroy();
    x?.destroy();
  };
  let lastBox = "";
  const draw = (force = false) => {
    const w = drawBox.clientWidth;
    const hgt = drawBox.clientHeight;
    if (w < 40 || hgt < 40) return;
    const key = `${view}|${w}x${hgt}|${shift.chain}`;
    if (!force && key === lastBox) return;
    lastBox = key;
    destroyDrawing();
    const s = W();
    if (view === "mux") {
      const f = frame(svg, w, hgt, MUX_SIZE.w, MUX_SIZE.h, 1.5);
      md = drawMux(
        f,
        mux,
        { com: s.com, a0: "A0", kohm: s.kohm, gnd: s.gnd, v5: s.v5, fsr: s.fsr, eName: "E#", on: s.on, off: s.off, read: "analogRead(A0)", bracket: s.bracket, sum: s.sum, bitAria: s.bitAria, eAria: s.eAria, fsrAria: s.fsrAria, pressed: s.pressed, notPressed: s.notPressed, press: s.press, release: s.release, cellAria: s.cellAria },
        { bit: muxBit, e: muxE, fsr: muxFsr },
        reduced,
      );
    } else if (view === "shift") {
      const size = shift.chain ? SHIFT_SIZE_4 : SHIFT_SIZE;
      // (one chip is two rows of boxes and the LEDs: let it grow more on a big stage)
      const f = frame(svg, w, hgt, size.w, size.h, shift.chain ? 1.5 : 2);
      sd = drawShift(f, shift, { data: s.data, latch: s.latchW, clock: s.clockW, qhp: "QH′", outputs: s.outputs, rowLines: s.rowLines, dataAria: s.dataAria }, { data: shiftData }, reduced);
    } else if (view === "fingers") {
      const f = frame(svg, w, hgt, FINGERS_SIZE.w, FINGERS_SIZE.h, 1.6);
      fd = drawFingers(
        f,
        fingers,
        FINGERS,
        { top: s.top, bottom: s.bottom, hint: s.fHint, close: s.close, side: s.sideV, wide: s.wide, pitch: s.pitchW, long: s.long, thick: s.thick, finger: s.finger, fpc: s.fpc, stiff: s.stiff, pickAria: s.pickAria },
        { pick: fingerPick },
        uid,
      );
    } else {
      // (cropped to what moves, so the socket and its spring can be big; centred on the socket with its latch down when
      // the stage leaves room above it for the latch swung open, as on a desktop stage)
      const kc = Math.min(2.1, w / FFC_CLOSED.w, hgt / FFC_CLOSED.h);
      const room = (hgt - FFC_CLOSED.h * kc) / 2 >= (FFC_CLOSED.y0 - LATCH_TOP) * kc;
      const c = room ? FFC_CLOSED : FFC_SIZE;
      const f = frame(svg, w, hgt, c.w, c.h, 2.1, c.x0, c.y0);
      xd = drawFfc(f, ffc, { latch: s.latchL, spring: s.spring, contacts: s.contacts, stiff: s.stiff, board: s.board }, reduced);
    }
  };

  // ---- the side card
  const sideCard = () => {
    const s = W();
    side.replaceChildren();
    muxWires = [];
    shiftWires = [];
    chainWires = null;
    if (view === "mux" || view === "shift") {
      side.append(h("p", { class: "cl-side-k mono" }, s.wiringK));
      const ws = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      ws.setAttribute("class", "cl-wsvg");
      ws.setAttribute("role", "img");
      side.append(ws);
      if (view === "mux") {
        const rows: PinRow[] = [
          { nano: "D4", chip: "S0", cls: "cl-w-sel" },
          { nano: "D5", chip: "S1", cls: "cl-w-sel" },
          { nano: "D6", chip: "S2", cls: "cl-w-sel" },
          { nano: "D7", chip: "S3", cls: "cl-w-sel" },
          { nano: "D8", chip: "E#", cls: "cl-w-en" },
          { nano: "5V", chip: "VCC", cls: "cl-w-5v" },
          { nano: "GND", chip: "GND", cls: "cl-w-gnd" },
          { nano: "A0", chip: "COM", cls: "cl-w-sig" },
        ];
        muxWires = wiringPicture(ws, { nanoTitle: s.nano, chipTitle: "CD74HC4067", rows, a0Row: 7, kohm: s.kohm });
        ws.setAttribute("aria-label", s.noteMux);
        side.append(h("p", { class: "cl-side-note" }, s.noteMux));
      } else if (!shift.chain) {
        const rows: PinRow[] = [
          { nano: "D2", chip: "SER", cls: "cl-w-data" },
          { nano: "D3", chip: "SRCLK", cls: "cl-w-clk" },
          { chip: "RCLK", cls: "cl-w-clk", branch: true },
          { nano: "5V", chip: "VCC", cls: "cl-w-5v" },
          { chip: "#SRCLR", cls: "cl-w-5v", branch: true },
          { nano: "GND", chip: "GND", cls: "cl-w-gnd" },
          { chip: "#OE", cls: "cl-w-gnd", branch: true },
        ];
        shiftWires = wiringPicture(ws, { nanoTitle: s.nano, chipTitle: "74HC595", rows, chipX: [128, 182], outs: "QA–QH", qh: "QH′" });
        ws.setAttribute("aria-label", s.noteShift);
        side.append(h("p", { class: "cl-side-note" }, s.noteShift));
      } else {
        chainWires = chainPicture(ws, { nanoTitle: s.nano, chips: ["U2", "U3", "U4", "U5"], ser: "SER", clk: s.clkBus, qh: "QH′", lines: [1, 2, 3, 4].map((k) => `${k * 8 - 7}–${k * 8}`) });
        ws.setAttribute("aria-label", s.noteChain);
        side.append(h("p", { class: "cl-side-note" }, s.noteChain));
      }
      paintWires();
    } else {
      const fingersV = view === "fingers";
      side.append(h("p", { class: "cl-side-k mono" }, fingersV ? s.elseFingers : s.elseFfc));
      const uses = h("div", { class: "cl-uses" });
      const kinds = fingersV ? (["ram", "gpu", "cart"] as const) : (["laptop", "camera", "printer"] as const);
      for (const k of kinds) {
        const fig = h("figure", { class: "cl-use" });
        fig.append(useIcon(k));
        fig.append(h("figcaption", {}, s[k]));
        uses.append(fig);
      }
      side.append(uses);
      const photos = fingersV ? PHOTOS.fingers : PHOTOS.ffc;
      photoK = Math.min(photoK, photos.length - 1);
      const p = photos[photoK];
      const fig = h("figure", { class: "cl-photo" });
      fig.append(h("img", { src: p.src, alt: s[p.alt], loading: "lazy", decoding: "async" }));
      // (the source, after the last " · ", stays on one line: no lone word or character left on the next)
      const words = s[p.cap];
      const cut = words.lastIndexOf(" · ");
      const capHtml = cut < 0 ? words : `${words.slice(0, cut)}<span class="cl-photo-src"> · ${words.slice(cut + 3)}</span>`;
      const fc = h("figcaption", {}, `<span class="cl-photo-cap">${capHtml}</span>`);
      if (photos.length > 1) {
        const dots = h("span", { class: "cl-dots" });
        photos.forEach((_, k) => {
          const b = h("button", { type: "button", class: `cl-dot${k === photoK ? " is-on" : ""}`, "aria-label": fill(s.photoN, { k: k + 1, n: photos.length }), "aria-pressed": String(k === photoK) });
          b.addEventListener("click", () => {
            photoK = k;
            sideCard();
          });
          dots.append(b);
        });
        fc.prepend(dots);
      }
      fig.append(fc);
      side.append(fig);
    }
  };
  const paintWires = () => {
    if (view === "mux" && muxWires.length) {
      // rows: S0..S3, E#, 5V, GND, COM (E# HIGH: no channel reaches A0, so its wire goes quiet)
      for (let b = 0; b < 4; b++) muxWires[b]?.classList.toggle("is-1", ((mux.ch >> b) & 1) === 1);
      muxWires[4]?.classList.toggle("is-1", mux.e === 1);
      muxWires[7]?.classList.toggle("is-off", mux.e === 1);
    }
    if (view === "shift") {
      shiftWires[0]?.classList.toggle("is-1", shift.data === 1);
      chainWires?.data.classList.toggle("is-1", shift.data === 1);
    }
  };
  const pulseClock = () => {
    const wires = chainWires ? chainWires.clock : shiftWires.slice(1, 3);
    for (const w of wires) {
      w.classList.remove("is-tick");
      void (w as unknown as HTMLElement).getBoundingClientRect();
      w.classList.add("is-tick");
    }
    later.push(window.setTimeout(() => wires.forEach((w) => w.classList.remove("is-tick")), 360));
  };

  // ---- the buttons
  const btn = (label: string, cls: string, onClick: () => void, opts: { icon?: string; pressed?: boolean; lamp?: boolean } = {}) => {
    const b = h("button", { type: "button", class: `cl-btn ${cls}` });
    b.innerHTML = `${opts.icon ?? ""}${opts.lamp ? '<i class="cl-lamp" aria-hidden="true"></i>' : ""}<span class="cl-btn-t">${label}</span>`;
    if (opts.pressed !== undefined) b.setAttribute("aria-pressed", String(opts.pressed));
    b.addEventListener("click", onClick);
    return b;
  };
  const controls = () => {
    const s = W();
    ctl.replaceChildren();
    if (view === "mux") {
      ctl.append(btn(mux.scanning ? s.stopBtn : s.readBtn, "cl-btn-main", toggleScan, { icon: mux.scanning ? ICON_STOP : ICON_PLAY }));
    } else if (view === "shift") {
      ctl.append(
        btn(fill(s.dataBtn, { b: shift.data }), "cl-btn-data", shiftData, { pressed: shift.data === 1 }),
        btn(s.clockBtn, "", shiftClock),
        btn(s.latchBtn, "", shiftLatch),
        h("span", { class: "cl-ctl-gap", "aria-hidden": "true" }),
        btn(walking ? s.pauseBtn : s.walkBtn, "cl-btn-main", toggleWalk, { icon: walking ? ICON_PAUSE : ICON_PLAY }),
        btn(s.chainBtn, "cl-btn-lamp", toggleChain, { lamp: true, pressed: shift.chain }),
      );
    } else if (view === "fingers") {
      ctl.append(btn(fingers.sel ? s.hideBtn : s.sizesBtn, "cl-btn-lamp", toggleSizes, { lamp: true, pressed: fingers.sel !== null }));
    } else {
      const label = ffc.latch < 0.5 ? (ffc.ins < 0.5 ? s.ffcLift : s.ffcOut) : ffc.ins < 0.5 ? s.ffcIn : s.ffcDown;
      const main = btn(label, "cl-btn-main", ffcNext);
      const flip = btn(s.ffcFlip, "cl-btn-lamp", ffcFlip, { lamp: true, pressed: ffc.flip > 0.5 });
      main.disabled = ffc.busy;
      flip.disabled = ffc.busy;
      ctl.append(main, flip);
    }
  };

  // ---- the caption
  const caption = () => {
    const s = W();
    let t = "";
    if (view === "mux") {
      if (mux.scanning) t = fill(s.capScan, { n: scanCh });
      else if (scanDone) t = s.capScanDone;
      else if (!muxTouched) t = s.capStart;
      else if (mux.e) t = s.capOff;
      else {
        const here = (FSR_CH as readonly number[]).includes(mux.ch);
        if (mux.pressed.has(mux.ch)) t = fill(s.capHere, { n: mux.ch, v: muxRead(mux) });
        else t = fill(here ? s.capFsrUp : s.capEmpty, { n: mux.ch });
        const others = [...mux.pressed].filter((c) => c !== mux.ch).sort((a, b) => a - b);
        if (!mux.pressed.has(mux.ch) && others.length) t += s.sp + fill(others.length > 1 ? s.capOtherN : s.capOther, { m: others.join(s.and) });
      }
    } else if (view === "shift") {
      t = shiftNote ? fill(s[shiftNote], shiftVars) : "";
    } else if (view === "fingers") {
      t = fingers.sel ? s.capFingerSel : s.capFingers;
    } else {
      const flipped = ffc.flip > 0.5;
      if (ffc.latch < 0.5 && ffc.ins < 0.5) t = s.cap00;
      else if (ffc.ins < 0.5) t = flipped ? s.cap10f : s.cap10;
      else if (ffc.latch > 0.5) t = s.cap11;
      else t = ffcConnected(ffc) ? s.cap01 : s.cap01f;
    }
    cap.textContent = t;
  };

  // ---- the multiplexer's handlers
  const muxPaint = (animate: boolean) => {
    md?.update(mux, animate);
    paintWires();
    caption();
  };
  const muxBit = (b: number) => {
    stopScan();
    muxTouched = true;
    scanDone = false;
    mux.ch ^= 1 << b;
    muxPaint(true);
  };
  const muxE = () => {
    stopScan();
    muxTouched = true;
    scanDone = false;
    mux.e = mux.e ? 0 : 1;
    muxPaint(true);
  };
  const muxFsr = (ch: number) => {
    muxTouched = true;
    scanDone = false;
    if (mux.pressed.has(ch)) mux.pressed.delete(ch);
    else mux.pressed.add(ch);
    muxPaint(false);
  };
  const stopScan = () => {
    if (!mux.scanning) return;
    clearTimeout(scanTimer);
    mux.scanning = false;
    if (view === "mux") {
      controls();
      caption();
      md?.update(mux, false);
    }
  };
  const scanStep = () => {
    if (document.hidden) {
      scanTimer = window.setTimeout(scanStep, 400);
      return;
    }
    mux.ch = scanCh;
    md?.update(mux, true);
    paintWires();
    caption();
    scanTimer = window.setTimeout(() => {
      mux.cells[scanCh] = readAt(mux, scanCh);
      md?.update(mux, false);
      if (scanCh >= 15) {
        mux.scanning = false;
        scanDone = true;
        controls();
        caption();
        return;
      }
      scanCh++;
      scanTimer = window.setTimeout(scanStep, 150);
    }, 260);
  };
  const toggleScan = () => {
    if (mux.scanning) {
      stopScan();
      return;
    }
    muxTouched = true;
    scanDone = false;
    mux.cells = Array(16).fill(null);
    mux.scanning = true;
    scanCh = 0;
    controls();
    scanStep();
  };

  // ---- the shift register's handlers
  const shiftCaption = (k: Key, vars: Record<string, string | number> = {}) => {
    shiftNote = k;
    shiftVars = vars;
    if (view === "shift") caption();
  };
  const shiftData = () => {
    stopWalk();
    shift.data = shift.data ? 0 : 1;
    sd?.update(shift);
    paintWires();
    controls();
    shiftCaption("capData", { b: shift.data });
  };
  const shiftClock = () => {
    stopWalk();
    const spill = clockOnce(shift);
    sd?.clock(shift, spill);
    pulseClock();
    shiftCaption(spill === 1 ? "capSpill" : "capClock", { b: shift.boxes[0] });
  };
  const shiftLatch = () => {
    stopWalk();
    latchOnce(shift);
    sd?.latch(shift);
    shiftCaption("capLatch", { n: shift.outs.filter((b) => b === 1).length, total: shift.outs.length });
  };
  const clearLater = () => {
    while (later.length) clearTimeout(later.pop());
  };
  const walkTick = () => {
    if (document.hidden) {
      walkTimer = window.setTimeout(walkTick, 400);
      return;
    }
    const empty = shift.boxes.every((b) => b === 0);
    shift.data = empty ? 1 : 0;
    const spill = clockOnce(shift);
    sd?.clock(shift, spill);
    pulseClock();
    paintWires();
    if (empty) {
      later.push(
        window.setTimeout(() => {
          shift.data = 0;
          sd?.update(shift);
          paintWires();
        }, 330),
      );
    }
    later.push(
      window.setTimeout(() => {
        latchOnce(shift);
        sd?.latch(shift, true);
      }, 300),
    );
    walkTimer = window.setTimeout(walkTick, shift.chain ? 470 : 780);
  };
  const toggleWalk = () => {
    if (walking) {
      stopWalk();
      return;
    }
    walking = true;
    clearLater();
    // start clean: every box 0, so the first tick puts the 1 in
    shift.boxes = shift.boxes.map(() => 0);
    shift.outs = shift.outs.map(() => 0);
    sd?.update(shift);
    controls();
    shiftCaption("capWalk");
    walkTick();
  };
  const stopWalk = () => {
    if (!walking) return;
    walking = false;
    clearTimeout(walkTimer);
    clearLater();
    sd?.update(shift);
    paintWires();
    // (the walk's caption would still describe a running walk: say what DATA holds now instead)
    if (shiftNote === "capWalk") {
      shiftNote = "capData";
      shiftVars = { b: shift.data };
    }
    if (view === "shift") {
      controls();
      caption();
    }
  };
  const toggleChain = () => {
    const was = walking;
    stopWalk();
    setChain(shift, !shift.chain);
    draw(true);
    sideCard();
    controls();
    shiftCaption(shift.chain ? "capChain" : shift.data ? "capShiftStart" : "capData", { b: shift.data });
    if (was) toggleWalk();
  };

  // ---- the fingers
  const fingerPick = (tail: 0 | 1, i: number) => {
    fingers.sel = fingers.sel && fingers.sel.tail === tail && fingers.sel.i === i ? null : { tail, i };
    fd?.update(fingers);
    controls();
    caption();
  };
  const toggleSizes = () => {
    fingers.sel = fingers.sel ? null : { tail: 1, i: Math.floor(FINGERS.count[1] / 2) };
    fd?.update(fingers);
    controls();
    caption();
  };

  // ---- the flat cable
  const ffcGo = (to: FfcPose, done?: () => void) => {
    ffc.busy = true;
    controls();
    const finish = () => {
      Object.assign(ffc, to);
      ffc.busy = false;
      if (view === "ffc") {
        controls();
        caption();
      }
      done?.();
    };
    if (xd && view === "ffc") xd.go(to, finish);
    else finish();
  };
  const ffcNext = () => {
    if (ffc.busy) return;
    const p = { latch: ffc.latch, ins: ffc.ins, flip: ffc.flip };
    if (p.latch < 0.5 && p.ins < 0.5) ffcGo({ ...p, latch: 1 });
    else if (p.ins < 0.5) ffcGo({ ...p, ins: 1 });
    else if (p.latch > 0.5) ffcGo({ ...p, latch: 0 });
    else ffcGo({ ...p, latch: 1 }, () => ffcGo({ ...p, latch: 1, ins: 0 }));
  };
  const ffcFlip = () => {
    if (ffc.busy) return;
    const flip = ffc.flip > 0.5 ? 0 : 1;
    const out = () => ffcGo({ latch: 1, ins: 0, flip });
    if (ffc.ins > 0.5) {
      if (ffc.latch < 0.5) ffcGo({ latch: 1, ins: 1, flip: ffc.flip }, () => ffcGo({ latch: 1, ins: 0, flip: ffc.flip }, out));
      else ffcGo({ latch: 1, ins: 0, flip: ffc.flip }, out);
    } else ffcGo({ latch: ffc.latch < 0.5 ? 1 : ffc.latch, ins: 0, flip });
  };

  // ---- one view
  const show = (v: ViewId) => {
    if (v !== view) {
      stopScan();
      stopWalk();
      // a socket move in flight ends at its target (destroying its drawing runs the rest of the moves at once)
      if (view === "ffc") destroyDrawing();
      view = v;
      photoK = 0;
    }
    root.dataset.view = view;
    kick();
    sideCard();
    controls();
    caption();
    // the drawing after the card: the card's width sets the drawing's box
    lastBox = "";
    draw(true);
  };

  // ---- layout, language, visibility
  let raf = 0;
  const ro = new ResizeObserver(() => {
    if (!raf)
      raf = requestAnimationFrame(() => {
        raf = 0;
        draw();
      });
  });
  ro.observe(drawBox);
  const offLang = ctx.onLang(() => {
    kick();
    sideCard();
    controls();
    caption();
    draw(true);
  });

  show(view);

  const lines = (params: Record<string, number>): string[] => {
    const s = W();
    const ch = Math.max(0, Math.min(15, Math.round(params.ch ?? mux.ch)));
    const bits = [3, 2, 1, 0].map((b) => (ch >> b) & 1).join(" ");
    const v = readAt({ ...mux, e: 0 }, ch);
    const out = [fill(s.runSet, { ch, bits }), fill(s.runMon, { v }), mux.pressed.has(ch) ? fill(s.runPressed, { ch }) : fill(s.runNone, { ch }), s.runWalk];
    // (on steps 2-4 the stage shows another drawing: say where the multiplexer turned)
    if (view !== "mux") out.push(fill(s.runElse, { ch }));
    return out;
  };

  /** Back to the lesson's opening state, every view ("Start the steps again": WidgetInstance.reset). */
  const reset = () => {
    stopScan();
    stopWalk();
    clearLater();
    if (ffc.busy) destroyDrawing();
    Object.assign(mux, muxState());
    muxTouched = false;
    scanDone = false;
    Object.assign(shift, shiftState());
    shiftNote = "capShiftStart";
    shiftVars = {};
    fingers.sel = null;
    Object.assign(ffc, ffcState());
    photoK = 0;
    view = "mux";
    show("mux");
  };

  const inst = {
    view(v?: Record<string, unknown>) {
      const want = v?.view;
      show(VIEW_IDS.includes(want as ViewId) ? (want as ViewId) : "mux");
    },
    reset,
    layout() {
      draw();
    },
    run(params: Record<string, number>) {
      const ch = Math.max(0, Math.min(15, Math.round(params.ch ?? mux.ch)));
      stopScan();
      muxTouched = true;
      scanDone = false;
      mux.ch = ch;
      mux.e = 0;
      if (view === "mux") muxPaint(true);
      return lines(params);
    },
    say(params: Record<string, number>) {
      return lines(params);
    },
    destroy() {
      stopScan();
      stopWalk();
      clearLater();
      destroyDrawing();
      cancelAnimationFrame(raf);
      ro.disconnect();
      offLang();
      root.remove();
    },
  };
  // (built as a variable, so reset() rides along until WidgetInstance declares it)
  return inst;
}
