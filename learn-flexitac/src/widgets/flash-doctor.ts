// Flash doctor, shown as the Troubleshooter: the Fix card of lesson 6, Build your own (src/widgets/build-checklist.ts
// mounts it there). Pick a symptom and see what the terminal and the viewer
// would show, and why. Scenarios with a picture are computed, not drawn by hand: the shared scan model plays the firmware
// you "flashed" (rows, mux offset), the pad is wired the confirmed way (sense line s on mux channel s + 4) unless the
// scenario breaks it (a flat 0 or 255, one dead line, a pad pressed all over), and the bytes go through the real host
// pipeline (shared/models/host.mjs = the hardware repo's viewer) with PyFlexiTac's default 12 x 32 frame size, or the
// frame size the scenario's viewer expects.
// A guided step can pick the symptom on show: instance.view({ symptom: "<id>" }) (views/lesson.ts passes a step's
// widgetView), or the "ft:widget-view" event with the same detail on the element the widget was mounted in.
import { BAUD, COLS, FRAME_BYTES, FRAME_HZ, INIT_FRAMES, MUX_OFFSET, ROWS } from "@shared/data/constants.mjs";
import { MAX_CODE } from "@shared/models/adc.mjs";
import { colorize, createHost as createHostJs, toU8 } from "@shared/models/host.mjs";
import { codeForPress, frameBytes as frameBytesJs, frameSize as frameSizeJs } from "@shared/models/scan.mjs";
import { lang, strings, tx } from "../i18n";
import { paintText, setTextBeside } from "../i18n/paint";
import type { WidgetCtx, WidgetInstance } from "../types";
import { esc, h } from "../ui/dom";
import "./flash-doctor.css";

interface Variant {
  rows: number;
  cols: number;
  muxOffset: number;
  rowsPerMux: number;
}
type Reader = { code(row: number, col: number): number };
const frameBytes = frameBytesJs as unknown as (input: Reader, o: { variant: Variant }) => Uint8Array;
const frameSize = frameSizeJs as unknown as (v: Variant) => number;
const createHost = createHostJs as unknown as (o?: { rows?: number; cols?: number }) => {
  feed(c: Uint8Array): { raw: Uint8Array; norm: Float32Array | null }[];
  baseline: Float32Array | null;
};

const N = ROWS * COLS;
const PORT = "/dev/ttyUSB0";
const TAPS = [
  { r: 2, c: 8 },
  { r: 9, c: 23 },
];
/** Where the test fingers press, as a unitless 0..1 map on the real pad (illustrative). */
function pressAt(s: number, c: number): number {
  let p = 0;
  for (const t of TAPS) p += 0.8 * Math.exp(-((s - t.r) ** 2 + (c - t.c) ** 2) / 2.2);
  return Math.min(1, p);
}
/** "One dead line": the sense line and the drive line that never connect (0-based), each through one test finger. */
const DEAD = { sense: TAPS[1].r, drive: TAPS[0].c };
/** "Everything bright": no finger, but the pad squeezed a little all over after the viewer calibrated (bent, clamped, or a
 *  taut cable pulling on one edge), more toward drive line 1. Unitless and illustrative, like the fingers. */
const LOAD = (_s: number, c: number) => 0.16 + 0.12 * (1 - c / (COLS - 1));

interface Sim {
  /** what the viewer shows (0..1 per taxel), or null when no frames arrive */
  seen: Float32Array | null;
  rawMax: number;
  rawRest: number;
  frameBytes: number;
  fps: number;
}

type Wiring = "ok" | "flat0" | "flat255" | "dead" | "load";

/** Run firmware `v` against the real pad and read it with a host that expects `hostRows` x 32 frames (default 12). */
function simulate(v: Variant, wiring: Wiring = "ok", hostRows = ROWS): Sim {
  const reader = (pressed: boolean): Reader => ({
    code(i, j) {
      if (wiring === "flat0") return 0;
      if (wiring === "flat255") return MAX_CODE;
      const ch = (i + v.muxOffset) & 15; // what the firmware selects for frame row i
      const s = ch - MUX_OFFSET; // the pad's sense line on that channel
      if (s < 0 || s >= ROWS) return 0; // nothing connected: R1 pulls A0 to ground (inferred)
      if (wiring === "dead" && (s === DEAD.sense || j === DEAD.drive)) return 0; // that line never connects (inferred)
      if (wiring === "load") return codeForPress(pressed ? LOAD(s, j) : 0);
      return codeForPress(pressed ? pressAt(s, j) : 0);
    },
  });
  const rest = frameBytes(reader(false), { variant: v });
  const press = frameBytes(reader(true), { variant: v });
  const host = createHost({ rows: hostRows, cols: COLS });
  let rawRest = 0;
  let parsed = 0;
  let fed = 0;
  // feed resting frames until the viewer has its baseline (a shorter frame needs several to fill 384 bytes)
  for (let i = 0; i < 4000 && parsed <= INIT_FRAMES; i++, fed++)
    for (const f of host.feed(rest)) (parsed++, (rawRest = Math.max(rawRest, ...f.raw)));
  let seen: Float32Array | null = null;
  let rawMax = 0;
  for (let i = 0; i < 4000 && !seen; i++)
    for (const f of host.feed(press)) {
      rawMax = Math.max(...f.raw);
      if (f.norm) seen = f.norm;
    }
  // the board's rate (a longer frame takes longer to send), times the share of its frames the viewer finds
  const boardFps = (FRAME_HZ * ROWS) / v.rows;
  return { seen, rawMax, rawRest, frameBytes: frameSize(v), fps: Math.round(boardFps * Math.min(1, parsed / Math.max(1, fed))) };
}

const GOOD: Variant = { rows: ROWS, cols: COLS, muxOffset: MUX_OFFSET, rowsPerMux: 16 };

interface Scenario {
  id: string;
  title: string;
  cmd: string;
  out: (s: Sim | null) => string[];
  sim?: () => Sim;
  cause: string;
  fix: string;
  tag?: "external" | "inferred";
  ok?: boolean;
  /** What "Where you press" shows (default: the two test fingers). */
  target?: (s: number, c: number) => number;
}

const statLine = (n: number, fps: number, raw: number, norm: number) =>
  `frame=${String(n).padStart(6)} fps= ~${fps} raw_max=${String(raw).padStart(3)} norm_max=${norm.toFixed(3)}`;
const maxOf = (a: Float32Array | null) => (a ? a.reduce((m, x) => Math.max(m, x), 0) : 0);

const SCENARIOS: Scenario[] = [
  {
    id: "ok",
    title: "Flashed right",
    ok: true,
    cmd: `flexitac-stream --port ${PORT}`,
    sim: () => simulate(GOOD),
    out: (s) => [statLine(10, FRAME_HZ, s!.rawRest, 0), statLine(20, FRAME_HZ, s!.rawMax, maxOf(s!.seen))],
    cause: `Firmware and viewer agree: ${ROWS} rows, mux offset ${MUX_OFFSET}, ${BAUD.toLocaleString("en-US")} baud, ${FRAME_BYTES}-byte frames. <code>raw_max</code> is small at rest and jumps when you press; <code>norm_max</code> rises toward 1.`,
    fix: "Nothing to fix. Run <code>flexitac-heatmap</code> and press the pad: the bright spots should follow your finger.",
  },
  {
    id: "noboard",
    title: "No board detected",
    cmd: "flexitac-flash",
    out: () => ["ERROR no Arduino board detected. Pass --port and --fqbn explicitly."],
    cause: "<code>flexitac-flash</code> asks <code>arduino-cli board list</code> for exactly one recognised board. Many Nanos (and clones with a CH340 USB chip) show up as an unknown serial port, so no board name is found.",
    fix: "Find the port (<code>flexitac-find-port</code>), then name the board yourself:<br><code>flexitac-flash --port /dev/ttyUSB0 --fqbn arduino:avr:nano</code>",
    tag: "inferred",
  },
  {
    id: "sync",
    title: "Upload: not in sync",
    cmd: "flexitac-flash --fqbn arduino:avr:nano",
    out: () => [
      "avrdude: stk500_recv(): programmer is not responding",
      "avrdude: stk500_getsync() attempt 1 of 10: not in sync: resp=0x00",
      "…",
      "ERROR arduino-cli upload … failed",
    ],
    cause: "The Nano's <dfn>bootloader</dfn> (the tiny program that accepts new firmware over USB) comes in two versions that listen at different speeds. Many Nanos, especially clones, have the <i>old</i> one.",
    fix: "Pick the old bootloader: in the Arduino IDE, <b>Tools → Processor → ATmega328P (Old Bootloader)</b>; with the command line, <code>--fqbn arduino:avr:nano:cpu=atmega328old</code>.",
    tag: "external",
  },
  {
    id: "perm",
    title: "Permission denied (Linux)",
    cmd: `flexitac-stream --port ${PORT}`,
    out: () => [`serial.serialutil.SerialException: [Errno 13] could not open port ${PORT}: [Errno 13] Permission denied: '${PORT}'`],
    cause: "On Linux, serial ports belong to the <code>dialout</code> group. Your user is not in it yet, so the program may not open the port. The same error can stop <code>flexitac-flash</code>.",
    fix: `Add yourself to the group once, then log out and back in:<br><code>sudo usermod -aG dialout "$USER"</code><br>On macOS this is rarely needed. Avoid <code>chmod 777</code>: it opens the port to everyone.`,
  },
  {
    id: "noport",
    title: "No serial port",
    cmd: "ls /dev/ttyUSB*",
    out: () => ["ls: cannot access '/dev/ttyUSB*': No such file or directory"],
    cause: "The computer does not see the Nano as a serial port, or you are looking under the wrong name. On Linux it is usually <code>/dev/ttyUSB0</code>, on macOS <code>/dev/cu.usbserial-…</code>, on Windows <code>COM3</code> or similar. Some USB cables carry power only, and Nanos with a CH340 USB chip may need its driver.",
    fix: "Run <code>flexitac-find-port</code>: it asks you to unplug the board and names the port that disappears. Use that port everywhere (<code>--port</code>). No port at all: try another cable and another USB socket.",
    tag: "external",
  },
  {
    id: "baud",
    title: "Baud mismatch",
    cmd: `flexitac-stream --port ${PORT} --baud 115200`,
    out: () => ["TimeoutError: timed out after 5.00s waiting for a frame"],
    cause: `<dfn>Baud</dfn> is the speed of the serial link. The firmware talks at ${BAUD.toLocaleString("en-US")} baud; if the computer listens at another speed, every byte is misread, <code>AA 55</code> never appears, and no frame is found.`,
    fix: `Use the same speed on both sides: ${BAUD.toLocaleString("en-US")} (the default everywhere). Check <code>--rows</code>, <code>--cols</code> and <code>--baud</code> match what you flashed.`,
  },
  {
    id: "viewer16",
    title: "Frames out of step",
    cmd: `flexitac-heatmap --port ${PORT} --rows 16`,
    sim: () => simulate(GOOD, "ok", 16),
    out: (s) => [statLine(20, s!.fps, s!.rawMax, maxOf(s!.seen)), tx(`# board sends ${FRAME_BYTES}-byte frames; viewer cuts ${2 + 16 * COLS}`, `# 板子发送 ${FRAME_BYTES} 字节的帧；查看器按 ${2 + 16 * COLS} 字节切分`)],
    cause: `Every frame starts with the header <code>AA 55</code>; the viewer finds it and takes the next rows × columns bytes as one picture. Told 16 rows (the hardware repo's <code>fast_32_16.py</code> expects 16 × ${COLS}), it takes ${16 * COLS} bytes after each header: the real ${ROWS * COLS}, then the next header and part of the next frame, drawn as 4 extra rows that repeat the first ones. It also skips every other frame.`,
    fix: `Tell the viewer what you flashed: <code>--rows ${ROWS}</code> (PyFlexiTac's default), or set the same rows and columns in the hardware repo's script. Board and viewer must agree on the frame size.`,
    tag: "inferred",
  },
  {
    id: "rows16",
    title: "16-row firmware",
    cmd: `flexitac-heatmap --port ${PORT}`,
    sim: () => simulate({ rows: 16, cols: COLS, muxOffset: 0, rowsPerMux: 16 }),
    out: (s) => [statLine(20, s!.fps, s!.rawMax, maxOf(s!.seen)), tx(`# board sends ${s!.frameBytes}-byte frames; viewer expects ${FRAME_BYTES}`, `# 板子发送 ${s!.frameBytes} 字节的帧；查看器期望 ${FRAME_BYTES} 字节`)],
    cause: `The hardware repo's <code>32_16_fast.ino</code> scans 16 rows from channel 0 and sends ${2 + 16 * COLS}-byte frames. The viewer still finds every <code>AA 55</code>, keeps the first ${ROWS * COLS} bytes and skips the rest, so it shows channels 0–${ROWS - 1}: the same 4-row shift as a wrong offset.`,
    fix: `Use the ${ROWS}-row firmware (<code>flexitac-flash</code> defaults), or tell the viewer the truth with <code>--rows 16</code>.`,
    tag: "inferred",
  },
  {
    id: "offset",
    title: "Mux offset left at 0",
    cmd: `flexitac-heatmap --port ${PORT}`,
    sim: () => simulate({ ...GOOD, muxOffset: 0 }),
    out: (s) => [statLine(20, FRAME_HZ, s!.rawMax, maxOf(s!.seen)), tx("# top 4 rows stay dark; presses near the far edge never show", "# 上面 4 行一直是暗的；靠近远端的按压永远显示不出来")],
    cause: `The pad's ${ROWS} sense lines sit on multiplexer channels ${MUX_OFFSET}–${MUX_OFFSET + ROWS - 1}. With offset 0 the firmware reads channels 0–${ROWS - 1}: the first 4 rows read empty channels and every touch appears 4 rows too low. Sense lines ${ROWS - 3}–${ROWS} are never read.`,
    fix: `Flash again with <code>--mux-offset ${MUX_OFFSET}</code> (the default), or set <code>#define MUX_CHANNEL_OFFSET ${MUX_OFFSET}</code> in the sketch.`,
    tag: "inferred",
  },
  {
    id: "flat0",
    title: "Every byte is 0",
    cmd: `flexitac-stream --port ${PORT}`,
    sim: () => simulate(GOOD, "flat0"),
    out: (s) => [statLine(10, FRAME_HZ, s!.rawRest, 0), statLine(20, FRAME_HZ, s!.rawMax, 0), tx("# pressing changes nothing", "# 按压没有任何变化")],
    cause: "Frames arrive, so the firmware and the baud rate are fine. A flat 0 means no current reaches A0: PyFlexiTac's README calls this a <b>wiring issue, not a flashing issue</b>. Likely spots: a flat cable not fully seated, inserted upside down, or the pad's gold fingers not pushed into the connector.",
    fix: "Unplug the USB. Reseat both flat cables and both pad tails, contacts facing the connector's contacts, latches closed. Then try again; reflashing will not help.",
    tag: "inferred",
  },
  {
    id: "flat255",
    title: "Every byte is 255",
    cmd: `flexitac-stream --port ${PORT}`,
    sim: () => simulate(GOOD, "flat255"),
    out: (s) => [statLine(10, FRAME_HZ, s!.rawRest, 0), statLine(20, FRAME_HZ, s!.rawMax, 0)],
    cause: "A flat 255 means A0 sits at the full 5 V on every reading, pressed or not. That is also a <b>wiring issue</b> (README), for example a short between lines or a damaged pad, not the firmware.",
    fix: "Check the cables and the pad for shorts (folded or creased tails, tape missing at the edges). Try another pad on the same board to see which part is at fault.",
    tag: "inferred",
  },
  {
    id: "dead",
    title: "One dead row or column",
    cmd: `flexitac-heatmap --port ${PORT}`,
    sim: () => simulate(GOOD, "dead"),
    out: (s) => [statLine(20, FRAME_HZ, s!.rawMax, maxOf(s!.seen)), tx(`# row ${DEAD.sense + 1} and column ${DEAD.drive + 1} stay dark, even under a finger`, `# 第 ${DEAD.sense + 1} 行和第 ${DEAD.drive + 1} 列一直是暗的，手指按上去也一样`)],
    cause: "Each row of the picture is one sense line and each column one drive line. A row that never changes means that sense line never reaches the multiplexer; a column, that drive line never gets its 5 V. Likely spots: one contact in a flat-cable connector, a cable pushed in at a slant, or a cracked trace on that line.",
    fix: "Unplug the USB. Reseat that cable straight and all the way in, latches closed, and look at its contacts. If the same line stays dead, swap the cable, then the pad, to find the faulty part.",
    tag: "inferred",
  },
  {
    id: "bright",
    title: "Everything bright",
    cmd: `flexitac-heatmap --port ${PORT}`,
    sim: () => simulate(GOOD, "load"),
    target: LOAD,
    out: (s) => [statLine(20, FRAME_HZ, s!.rawMax, maxOf(s!.seen)), tx("# nobody touches the pad, yet the whole map is lit", "# 没有人碰传感垫，整张图却都亮了")],
    cause: "When the viewer starts it records what every crossing reads at rest (the baseline) and from then on shows only the rise above it. If the pad is bent, clamped or squeezed after that, for example by a taut cable or tail pulling on its edge, every crossing reads a little high. The viewer stretches each frame to its own peak, so the whole map lights up.",
    fix: "Lay the pad flat with nothing on it and the cables slack, then restart the viewer (or recalibrate) so it learns the new rest. Mount it the way it will be used before you start the viewer.",
    tag: "inferred",
  },
];

// The symptoms in Chinese (docs/i18n.md): title, cause and fix by scenario id; the commands and the programs' own
// output stay as they are (the widget's own "# …" notes are translated where they are written, with tx()).
const BAUD_TXT = BAUD.toLocaleString("en-US");
const SCENARIOS_ZH: Record<string, { title: string; cause: string; fix: string }> = {
  ok: {
    title: "烧录正确",
    cause: `固件和查看器的设置一致：${ROWS} 行、mux 偏移 ${MUX_OFFSET}、${BAUD_TXT} baud、每帧 ${FRAME_BYTES} 字节。<code>raw_max</code> 静止时很小，按压时会跳高；<code>norm_max</code> 会升到接近 1。`,
    fix: "不用修。运行 <code>flexitac-heatmap</code> 并按压传感垫：亮点应该跟着你的手指走。",
  },
  noboard: {
    title: "检测不到板子",
    cause: "<code>flexitac-flash</code> 会让 <code>arduino-cli board list</code> 找出唯一一块能识别的板子。很多 Nano（以及用 CH340 USB 芯片的兼容板）只显示成一个未知的串口，所以找不到板子的名称。",
    fix: "先找到串口（<code>flexitac-find-port</code>），再自己指定板子：<br><code>flexitac-flash --port /dev/ttyUSB0 --fqbn arduino:avr:nano</code>",
  },
  sync: {
    title: "上传：无法同步",
    cause: `Nano 的<dfn data-term="bootloader">引导程序（bootloader）</dfn>（通过 USB 接收新固件的小程序）有两个版本，监听的速度不同。很多 Nano，尤其是兼容板，用的是<b>旧版</b>。`,
    fix: "选旧版引导程序：在 Arduino IDE 里选 <b>Tools → Processor → ATmega328P (Old Bootloader)</b>；用命令行则加 <code>--fqbn arduino:avr:nano:cpu=atmega328old</code>。",
  },
  perm: {
    title: "权限被拒绝（Linux）",
    cause: "在 Linux 上，串口属于 <code>dialout</code> 用户组。你的用户还不在这个组里，所以程序可能打不开串口。同样的错误也会让 <code>flexitac-flash</code> 失败。",
    fix: `把自己加进这个组（只需一次），然后注销再重新登录：<br><code>sudo usermod -aG dialout "$USER"</code><br>在 macOS 上一般不需要这样做。不要用 <code>chmod 777</code>：它会让所有人都能打开这个串口。`,
  },
  noport: {
    title: "没有串口",
    cause: "电脑没有把 Nano 识别成串口，或者你找错了名字。在 Linux 上通常是 <code>/dev/ttyUSB0</code>，在 macOS 上是 <code>/dev/cu.usbserial-…</code>，在 Windows 上是 <code>COM3</code> 之类。有些 USB 线只能供电，不能传数据；用 CH340 USB 芯片的 Nano 可能还要装它的驱动。",
    fix: "运行 <code>flexitac-find-port</code>：它会让你拔下板子，并告诉你消失的是哪个串口。之后都用这个串口（<code>--port</code>）。一个串口都没有：换一根线、换一个 USB 口试试。",
  },
  baud: {
    title: "波特率不一致",
    cause: `<dfn data-term="baud">波特率（baud rate）</dfn>是串口通信的速度。固件以 ${BAUD_TXT} baud 发送；如果电脑用别的速度接收，每个字节都会读错，<code>AA 55</code> 永远不会出现，也就找不到任何一帧。`,
    fix: `两边用同一个速度：${BAUD_TXT}（各处的默认值）。检查 <code>--rows</code>、<code>--cols</code> 和 <code>--baud</code> 是否和你烧录的一致。`,
  },
  viewer16: {
    title: "帧对不上",
    cause: `每一帧都以帧头 <code>AA 55</code> 开始；查看器找到帧头后，把后面“行数 × 列数”个字节当作一张图。告诉它有 16 行（硬件仓库的 <code>fast_32_16.py</code> 按 16 × ${COLS} 读取），它就会在每个帧头后取 ${16 * COLS} 个字节：先是真正的 ${ROWS * COLS} 个，再加上下一个帧头和下一帧的一部分，画成多出来的 4 行，重复开头几行。它还会每隔一帧跳过一帧。`,
    fix: `告诉查看器你烧录了什么：<code>--rows ${ROWS}</code>（PyFlexiTac 的默认值），或者在硬件仓库的脚本里设成同样的行数和列数。板子和查看器的帧大小必须一致。`,
  },
  rows16: {
    title: "16 行固件",
    cause: `硬件仓库的 <code>32_16_fast.ino</code> 从通道 0 开始扫描 16 行，发送 ${2 + 16 * COLS} 字节的帧。查看器仍能找到每个 <code>AA 55</code>，保留前 ${ROWS * COLS} 个字节，丢掉其余的，所以它显示的是通道 0–${ROWS - 1}：和偏移设错一样，错开了 4 行。`,
    fix: `用 ${ROWS} 行的固件（<code>flexitac-flash</code> 的默认值），或者用 <code>--rows 16</code> 如实告诉查看器。`,
  },
  offset: {
    title: "Mux 偏移仍是 0",
    cause: `传感垫的 ${ROWS} 条感应线接在多路选择器的通道 ${MUX_OFFSET}–${MUX_OFFSET + ROWS - 1} 上。偏移为 0 时，固件读的是通道 0–${ROWS - 1}：前 4 行读到的是空通道，每次触摸都显示得低了 4 行。第 ${ROWS - 3}–${ROWS} 条感应线永远读不到。`,
    fix: `用 <code>--mux-offset ${MUX_OFFSET}</code>（默认值）重新烧录，或者在程序里设置 <code>#define MUX_CHANNEL_OFFSET ${MUX_OFFSET}</code>。`,
  },
  flat0: {
    title: "每个字节都是 0",
    cause: "有帧到达，说明固件和波特率都没问题。全是 0 意味着没有电流到达 A0：PyFlexiTac 的 README 把这称为<b>接线问题，而不是烧录问题</b>。可能的位置：排线没有插到底、插反了，或者传感垫的金手指没有推进连接器。",
    fix: "拔掉 USB。重新插好两条排线和传感垫的两条尾线，触点对着连接器的触点，扣好卡扣。然后再试；重新烧录没有用。",
  },
  flat255: {
    title: "每个字节都是 255",
    cause: "全是 255 意味着无论按不按，每次读数时 A0 都处在满 5 V。这同样是<b>接线问题</b>（见 README），比如线路之间短路或传感垫损坏，而不是固件的问题。",
    fix: "检查排线和传感垫有没有短路（尾线折叠或压出折痕、边上缺了胶带）。在同一块读取板上换一块传感垫试试，看看是哪个部件出了问题。",
  },
  dead: {
    title: "有一行或一列不亮",
    cause: "图中的每一行是一条感应线，每一列是一条驱动线。某一行从不变化，说明那条感应线没有接到多路选择器；某一列从不变化，说明那条驱动线没有得到 5 V。可能的位置：排线连接器里的某个触点、排线插歪了，或者那条线上的铜线断了。",
    fix: "拔掉 USB。把那条排线插正、插到底，扣好卡扣，再看看它的触点。如果还是同一条线不亮，先换排线，再换传感垫，找出有问题的部件。",
  },
  bright: {
    title: "整张图都亮",
    cause: "查看器启动时，会记下每个交叉点静止时的读数（基线），之后只显示比它高出的部分。如果之后传感垫被弯曲、夹住或挤压，比如被绷紧的排线或尾线拉着边缘，每个交叉点的读数都会高一点。查看器会把每一帧按它自己的峰值拉伸，所以整张图都亮了。",
    fix: "把传感垫平放，上面什么都不放，排线放松，然后重启查看器（或重新校准），让它记下新的静止状态。先按实际使用的方式装好传感垫，再启动查看器。",
  },
};
/** A scenario in the current language (the English one itself in English). */
const locS = (s: Scenario): Scenario => {
  const z = lang() === "zh" ? SCENARIOS_ZH[s.id] : undefined;
  return z ? { ...s, ...z } : s;
};

// the widget's own words
const S = strings(
  {
    kicker: "Troubleshooter · simulated",
    hint: "Pick a symptom",
    list: "Symptoms",
    custom: "Your flash (Run)",
    target: "Where you press",
    seen: "What the viewer shows",
    why: "Why.",
    fix: "Fix.",
    gap: " ",
    external: "external",
    inferred: "inferred",
    externalTitle: "From outside the FlexiTac materials (Arduino / avrdude behaviour)",
    inferredTitle: "Worked out from the sources and the shared models, not stated in them",
  },
  {
    kicker: "排错工具 · 仿真",
    hint: "选一个症状",
    list: "症状",
    custom: "你的烧录（运行）",
    target: "你按的位置",
    seen: "查看器显示的画面",
    why: "原因：",
    fix: "解决：",
    gap: "",
    external: "外部",
    inferred: "推断",
    externalTitle: "来自 FlexiTac 资料之外（Arduino / avrdude 的行为）",
    inferredTitle: "根据资料和共享模型推算，资料中没有直接写明",
  },
);

/** What a guided step asks of the doctor (GuidedStep.widgetView, or the "ft:widget-view" event's detail). */
export interface DoctorView {
  symptom?: string;
}
export interface FlashDoctorInstance extends WidgetInstance {
  view(v?: DoctorView | null): void;
}

export function mount(el: HTMLElement, ctx: WidgetCtx): FlashDoctorInstance {
  const root = h("div", { class: "w-doc" });
  root.innerHTML = `
    <div class="w-doc-head">
      <span class="w-kicker" data-t="kicker">${S().kicker}</span>
      <span class="w-doc-hint" data-t="hint">${S().hint}</span>
    </div>
    <div class="w-doc-body">
      <div class="w-doc-list" role="group" aria-label="${S().list}" data-t-aria="list">
        ${SCENARIOS.map((s) => `<button type="button" class="w-doc-pick" data-id="${s.id}" aria-pressed="false"><span class="w-doc-dot${s.ok ? " is-ok" : ""}" aria-hidden="true"></span>${esc(locS(s).title)}</button>`).join("")}
        <button type="button" class="w-doc-pick" data-id="custom" aria-pressed="false" hidden><span class="w-doc-dot is-custom" aria-hidden="true"></span><span data-t="custom">${S().custom}</span></button>
      </div>
      <div class="w-doc-main">
        <pre class="w-doc-term mono" aria-live="polite"></pre>
        <div class="w-doc-pics">
          <figure><canvas data-pic="target" aria-hidden="true"></canvas><figcaption class="mono" data-t="target">${S().target}</figcaption></figure>
          <figure><canvas data-pic="seen" aria-hidden="true"></canvas><figcaption class="mono" data-t="seen">${S().seen}</figcaption></figure>
        </div>
        <div class="w-doc-why">
          <p><b data-t="why">${S().why}</b>${S().gap}<span data-why></span></p>
          <p><b data-t="fix">${S().fix}</b>${S().gap}<span data-fix></span></p>
        </div>
      </div>
    </div>`;
  el.append(root);

  const term = root.querySelector<HTMLElement>(".w-doc-term")!;
  const pics = root.querySelector<HTMLElement>(".w-doc-pics")!;
  const why = root.querySelector<HTMLElement>("[data-why]")!;
  const fix = root.querySelector<HTMLElement>("[data-fix]")!;
  const target = root.querySelector<HTMLCanvasElement>('[data-pic="target"]')!;
  const seenCv = root.querySelector<HTMLCanvasElement>('[data-pic="seen"]')!;
  const picks = [...root.querySelectorAll<HTMLButtonElement>(".w-doc-pick")];
  const customBtn = picks.find((b) => b.dataset.id === "custom")!;

  // a picture is as many rows as the viewer reads (16 when it expects a 16-row frame), 32 columns
  const paint = (cv: HTMLCanvasElement, vals: ArrayLike<number> | null) => {
    const rows = vals ? Math.max(1, Math.round(vals.length / COLS)) : ROWS;
    cv.width = COLS;
    cv.height = rows;
    cv.style.aspectRatio = `${COLS} / ${rows}`;
    const g = cv.getContext("2d")!;
    const img = g.createImageData(COLS, rows);
    const rgb = vals ? colorize(toU8(vals)) : null;
    for (let k = 0; k < COLS * rows; k++) {
      img.data[4 * k] = rgb ? rgb[3 * k] : 40;
      img.data[4 * k + 1] = rgb ? rgb[3 * k + 1] : 40;
      img.data[4 * k + 2] = rgb ? rgb[3 * k + 2] : 44;
      img.data[4 * k + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  };
  const mapOf = (f: (s: number, c: number) => number) => Float32Array.from({ length: N }, (_, k) => f(Math.floor(k / COLS), k % COLS));
  const fingers = mapOf(pressAt);
  let targetNow: ((s: number, c: number) => number) | null = null;
  const showTarget = (f: ((s: number, c: number) => number) | undefined) => {
    const want = f ?? pressAt;
    if (want === targetNow) return;
    targetNow = want;
    paint(target, want === pressAt ? fingers : mapOf(want));
  };
  showTarget(undefined);

  const cache = new Map<string, Sim>();
  let custom: Scenario | null = null;
  let customP: { rows: number; offset: number } | null = null;
  /** "Your flash" (the code card's Run): the firmware's rows and mux offset against the real pad. */
  function makeCustom(rows: number, offset: number): Scenario {
    const v: Variant = { rows, cols: COLS, muxOffset: offset, rowsPerMux: 16 };
    const good = rows === ROWS && offset === MUX_OFFSET;
    const wraps = offset + rows - 1 > 15;
    return {
      id: "custom",
      title: tx("Your flash", "你的烧录"),
      cmd: `flexitac-heatmap --port ${PORT}`,
      sim: () => simulate(v),
      out: (s) => [
        tx(`# flashed: ROW_COUNT ${rows}, MUX_CHANNEL_OFFSET ${offset}`, `# 已烧录：ROW_COUNT ${rows}，MUX_CHANNEL_OFFSET ${offset}`),
        statLine(20, s!.fps, s!.rawMax, maxOf(s!.seen)),
        s!.frameBytes === FRAME_BYTES
          ? tx(`# frames are ${FRAME_BYTES} bytes, as the viewer expects`, `# 每帧 ${FRAME_BYTES} 字节，和查看器期望的一致`)
          : tx(`# frames are ${s!.frameBytes} bytes; the viewer expects ${FRAME_BYTES}`, `# 每帧 ${s!.frameBytes} 字节；查看器期望 ${FRAME_BYTES} 字节`),
      ],
      cause: good
        ? tx("These are the defaults: the picture matches your press.", "这些是默认值：画面和你的按压一致。")
        : tx(
            `The firmware reads mux channels ${offset}–${(offset + rows - 1) & 15}${wraps ? " (wrapping past 15)" : ""}, but the pad's sense lines are on ${MUX_OFFSET}–${MUX_OFFSET + ROWS - 1}${rows !== ROWS ? `, and the frame size no longer matches the viewer's ${FRAME_BYTES} bytes` : ""}. Compare the two pictures.`,
            `固件读取的是 mux 通道 ${offset}–${(offset + rows - 1) & 15}${wraps ? "（超过 15 后从头绕回）" : ""}，但传感垫的感应线在 ${MUX_OFFSET}–${MUX_OFFSET + ROWS - 1}${rows !== ROWS ? `，而且帧大小也和查看器期望的 ${FRAME_BYTES} 字节对不上了` : ""}。对比一下这两张图。`,
          ),
      fix: good
        ? tx("Nothing to fix.", "不用修。")
        : tx(`Flash with <code>--rows ${ROWS} --mux-offset ${MUX_OFFSET}</code> (the defaults).`, `用 <code>--rows ${ROWS} --mux-offset ${MUX_OFFSET}</code>（默认值）重新烧录。`),
      tag: good ? undefined : "inferred",
      ok: good,
    };
  }

  let shownId = "ok";
  function show(id: string) {
    shownId = id;
    const s = id === "custom" ? custom! : locS(SCENARIOS.find((x) => x.id === id)!);
    for (const b of picks) b.setAttribute("aria-pressed", String(b.dataset.id === id));
    let sim: Sim | null = null;
    if (s.sim) {
      if (id === "custom" || !cache.has(id)) cache.set(id, s.sim());
      sim = cache.get(id)!;
    }
    term.innerHTML = [`<span class="w-doc-prompt">$ ${esc(s.cmd)}</span>`, ...s.out(sim).map((l) => (l.startsWith("#") ? `<span class="w-doc-com">${esc(l)}</span>` : esc(l)))].join("\n");
    term.classList.toggle("is-error", !s.sim);
    pics.hidden = !s.sim;
    if (sim) {
      showTarget(s.target);
      paint(seenCv, sim.seen);
    }
    const T = S();
    const tag = s.tag ? ` <span class="badge badge-${s.tag}" title="${s.tag === "external" ? T.externalTitle : T.inferredTitle}">${T[s.tag]}</span>` : "";
    why.innerHTML = s.cause + tag;
    fix.innerHTML = s.fix;
  }

  root.querySelector(".w-doc-list")!.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-id]");
    if (b) show(b.dataset.id!);
  });
  show("ok");

  // a language switch: the words again, and the symptom on show (its pictures come from the cache: nothing re-runs)
  const offLang = ctx.onLang(() => {
    paintText(root, S());
    // (the space after "Why." / "Fix." is bare text, as in English; Chinese has none after its colon)
    setTextBeside(why, S().gap);
    setTextBeside(fix, S().gap);
    for (const b of picks) {
      const sc = SCENARIOS.find((x) => x.id === b.dataset.id);
      if (sc) setTextBeside(b.querySelector(".w-doc-dot"), locS(sc).title, true);
    }
    if (customP) custom = makeCustom(customP.rows, customP.offset);
    show(shownId);
  });

  /** A step's symptom (unknown ids are ignored; view() alone changes nothing, so the learner's pick stays). */
  function view(v?: DoctorView | null) {
    const id = v?.symptom;
    if (!id || (id !== "custom" && !SCENARIOS.some((x) => x.id === id)) || (id === "custom" && !custom)) return;
    show(id);
  }
  const onViewEvent = (e: Event) => view((e as CustomEvent<DoctorView | null>).detail ?? undefined);
  el.addEventListener("ft:widget-view", onViewEvent);

  return {
    view,
    destroy() {
      el.removeEventListener("ft:widget-view", onViewEvent);
      offLang();
      root.remove();
    },
    run(p) {
      const rows = Math.round(p.rows ?? ROWS);
      const offset = Math.round(p.offset ?? MUX_OFFSET);
      const good = rows === ROWS && offset === MUX_OFFSET;
      customP = { rows, offset };
      custom = makeCustom(rows, offset);
      customBtn.hidden = false;
      show("custom");
      return good
        ? [tx(`picture matches the press: ${ROWS} rows from channel ${MUX_OFFSET}`, `画面和按压一致：从通道 ${MUX_OFFSET} 开始的 ${ROWS} 行`)]
        : [tx(`mismatch: see "Your flash" in the Troubleshooter`, "不匹配：请看排错工具里的“你的烧录”"), tx(`viewer reads ${ROWS} × ${COLS} = ${ROWS * COLS} bytes per frame`, `查看器每帧读取 ${ROWS} × ${COLS} = ${ROWS * COLS} 字节`)];
    },
  };
}
