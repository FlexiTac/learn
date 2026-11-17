// Lesson 1.4, "Put it together" (2026-11-16, user: an assembly game after Lesson 1.3: laminate each FPC, Velostat on the
// bottom part, the top part over it, the connectors onto the tails, two flat cables to the reading board, the Nano onto
// the board; the polyimide seal left out for now; a Hint when the learner does not know what comes next). The stage is
// src/widgets/assemble-bench.ts, a 3D bench like Lesson 2.2's: every part waits on the mat and is dragged into place,
// the rules (src/widgets/assemble/engine.ts) refuse what cannot go together and say why, and the Hint shows the next
// single move. The FPCs are drawn from their Gerbers, the board from board.json; sizes the materials do not give (the
// sheets, the extenders, the cables' length) are illustrative.
// Same day (user): the bench's progress bar shows the order (top part and bottom part, then Velostat, sandwich,
// extenders, FFCs, the board, the Nano) and the camera follows it. The "connectors" on the tails are called extenders,
// as in the guide's BOM. Then (user): "Bytes to touch: the heatmap" (was 1.3) became this lesson's step 2, the test of
// the pad just put together: the Heatmap lab over the stage (GuidedStep.stage), with that lesson's words, its wiring
// table (where each of the viewer's steps runs), its code and three of its four questions (src/state/store.ts moves its
// old link and saved answers here). "Build your own" is 1.3, so the photos come before the game.
import { ALPHA, COLS, FRAME_BYTES, FRAME_HZ, INIT_FRAMES, NOISE_SCALE, ROWS, THRESHOLD } from "@shared/data/constants.mjs";
import { PYFLEXITAC } from "@shared/models/host.mjs";
import { fact } from "../content/facts";
import type { Lesson } from "../types";

const TAXELS = ROWS * COLS;
const PCT = Math.round(ALPHA * 100);
const GUIDE = "FlexiTac hardware guide (BOM, build photos)";
const BOARD = "board.json (the reading board's Gerber and pick-and-place files)";
const h3 = (t: string) => `<h3 class="section-title" style="margin:1.6em 0 .3em">${t}</h3>`;

export const lesson: Lesson = {
  id: "put-it-together",
  n: 4,
  title: "Put it together",
  kicker: "Build it",
  lede: `Every part of one FlexiTac waits on the bench. Drag them together in the order the bar under the bench shows, from two bare FPCs to a pad cabled to its reading board. Then test it: press the pad and watch the computer turn its bytes into a live heatmap.`,
  status: "ready",
  features: [
    { icon: "layers", title: "Build the pad", text: "Sheets, FPCs and Velostat, in the order that makes it sense" },
    { icon: "cable", title: "Cable it up", text: "The right extender on each tail, the right cable to each socket, the Nano last" },
    { icon: "heat", title: "Test it", text: "Press the pad and follow its bytes to the heatmap" },
  ],
  widget: "assemble-bench",
  steps: [
    {
      title: "Put it together",
      text: "Drag the parts together in the order the bar under the bench shows, from the two FPCs to the Nano. Not sure what comes next? Press <b>Hint</b>.",
      start: true,
    },
    {
      title: "Test it",
      text: `The pad is plugged in and sends ${FRAME_HZ} frames a second. Press it in the lab and follow your press through the viewer's five steps, from raw bytes to the heatmap.`,
      stage: "heatmap-lab",
    },
  ],
  overview: `
${h3("Put it together")}
<p>Lesson 1.3 built a pad by hand from photos. Here you put one together yourself, part by part, on a bench in 3D: the
two FPCs, two lamination sheets, a square of Velostat, two extenders, two flat cables, the reading board and its
Arduino Nano. Each move is one you would make at a real desk, in the same order. The bar under the bench shows that
order, and the view moves on to each part of the bench as you get to it.</p>
<p>First each FPC goes onto a lamination sheet, copper side up. The sheet is clear film, sticky on one side, and it gives
the thin circuit a flat, stiff back. The top FPC carries the ${ROWS} sense lines and the bottom FPC the ${COLS} drive
lines, so the two laminated pieces are the top part and the bottom part.</p>
<p>The Velostat goes on the bottom part, over its electrodes. Then the top part turns face down onto it, so its copper
meets the Velostat and its lines cross the bottom part's at right angles. Every place where two lines cross is a touch
spot, ${TAXELS} in all, and that is the pad. Lesson 1.3 then seals the edges with polyimide tape so the layers cannot
slide; this bench leaves the tape out.</p>
<p>Each FPC ends in a tail of gold fingers. The bottom tail has ${COLS} and takes the 32-pin extender, a tiny board
with a socket on each side. The top tail has ${ROWS}, and its extender is the 16-pin one, with four positions left
empty. On the real pad both tails leave the same corner, so the top tail is lifted over the wide extender to reach its
own; the bench draws it that way.</p>
<p>A flat flexible cable (FFC) goes into the free side of each extender, and its other end into the reading board. The
16-pin cable carries the sense lines to
FPC1, which leads to the multiplexer. The 32-pin cable carries the drive lines to FPC2, which leads to the four shift
registers (Lessons 2.3 and 2.5 take those chips apart). Last, the Nano goes into the board's two rows of sockets, its
USB port toward you.</p>
<p>The bench will not let parts go together the wrong way. An extender that does not fit its tail, a cable in the wrong
socket or the top part closed before the Velostat is in are refused, with the reason. When you do not know what comes
next, the Hint shows the next single move, and its "Do this step" makes that one move for you. Once everything is in,
the Nano's power light comes on, and step 2 tests the pad.</p>
${h3("Test it")}
<p>Plugged into a computer, the board sends a stream of bytes. The viewer program on your computer (the hardware repo's
<code>fast_32_16.py</code>, ported line for line into this page) first finds the <dfn>header bytes</dfn>
<code>AA 55</code> in the stream. The ${TAXELS} bytes after them are one <dfn>frame</dfn>. Then it does five things to every frame.</p>
<p><b>1 · Raw bytes.</b> Each byte (0–255) says how much voltage came back through one crossing. An untouched
crossing still lets a little current through, so it reads a small number, not zero. Real pads rest at roughly 10–40.</p>
<p><b>2 · Baseline.</b> Every crossing rests at a slightly different value. So when the viewer starts, it records the
first ${INIT_FRAMES} frames and keeps, for each taxel, the <dfn title="the middle value after sorting">median</dfn>:
sort the ${INIT_FRAMES} readings and take the middle one. A median ignores the odd spike that an average would let in.
This per-taxel resting value is the <dfn>baseline</dfn>. <b>Don't touch the pad while it calibrates</b>, or your
finger becomes part of "resting".</p>
<p><b>3 · Contact.</b> For every taxel: <code>raw − baseline − ${THRESHOLD}</code>, then kept between 0 and 100. The
<dfn>threshold</dfn> (${THRESHOLD} counts) throws away small wobbles from electrical noise, so only a real press survives.</p>
<p><b>4 · Normalise.</b> To <dfn title="rescale so the values run from 0 to 1">normalise</dfn> means to rescale
the values to run from 0 to 1. The viewer divides the whole frame by its strongest value (the <i>peak</i>). If even the
peak is below the threshold, nothing is really touching, so it divides by ${NOISE_SCALE} instead to keep the leftovers dim.
One surprise: because of this step, a light press and a hard press both reach full brightness.
<b>The heatmap shows <i>where</i> you press, not how hard.</b></p>
<p><b>5 · Smooth and colour.</b> Each new picture is blended with the previous one:
<code>shown = ${ALPHA} × new + ${(1 - ALPHA).toFixed(1)} × previous</code>. This is an
<dfn title="exponential moving average">exponential moving average (EMA)</dfn>; the weight ${ALPHA} is called
<i>alpha</i>. Smaller alpha means a calmer but slower picture. Finally each value 0–1 gets a colour from the
<dfn>viridis</dfn> colour map, dark purple through teal to yellow, which stays readable for colour-blind viewers
and in greyscale.</p>
<p class="aside">Try it: set <b>Threshold</b> to 0 and lift your finger, and the noise lights up the whole pad. Then
hold a press and click <b>Recalibrate</b>: after you let go, that spot goes dead. The lab is
<span class="badge badge-illustrative">illustrative</span>: the press strength and noise are made-up knobs, but every
step after the bytes is the real viewer code.</p>
<p class="aside">To watch it with a real pad, the Nano needs the scanning firmware first:
<a href="#/lesson/build-your-own">Lesson 1.3, Build your own</a>, shows how to flash it, and what to check when the
picture stays dark or looks wrong.</p>`,
  wiring: {
    intro: "Step 2: where each of the viewer's steps happens. Only the first row runs on the Arduino; everything else runs on your computer.",
    rows: [
      { from: "Arduino Nano", to: "USB serial", note: `Frames of ${FRAME_BYTES} bytes: AA 55, then ${TAXELS} readings, sense line by sense line.` },
      { from: "Byte stream", to: "Frame finder", note: "Searches for AA 55 and cuts out the next 384 bytes." },
      { from: `First ${INIT_FRAMES} frames`, to: "Baseline", note: "Per-taxel median: what each crossing reads at rest." },
      { from: "Each new frame", to: "Contact", note: `raw − baseline − ${THRESHOLD}, clipped to 0…100.` },
      { from: "Contact", to: "Normalised", note: `÷ peak, or ÷ ${NOISE_SCALE} when the peak is below the threshold.` },
      { from: "Normalised", to: "Screen", note: `EMA with alpha ${ALPHA}, then ×255 and the viridis colour map.` },
    ],
    foot: `PyFlexiTac's <code>FlexiTacSensor</code> does the same steps with slightly different settings
(threshold ${PYFLEXITAC.threshold}, noise scale ${PYFLEXITAC.noiseScale}, result clipped to 0–1, and no EMA in
<code>frame.normalized</code>). This lesson follows the hardware repo's viewer.`,
  },
  code: {
    lang: "python",
    caption: "Python · the viewer's per-frame steps",
    source: `THRESHOLD = {{threshold}}  # counts above rest
ALPHA = {{alpha}}        # weight of the new frame
NOISE = ${NOISE_SCALE}

frames = first_frames(${INIT_FRAMES})  # at rest
base = np.median(frames, axis=0)

def show(raw, prev):
    c = raw - base - THRESHOLD
    c = np.clip(c, 0, 100)       # contact
    peak = c.max()
    if peak < THRESHOLD:
        n = c / NOISE            # nothing pressed
    else:
        n = c / (peak + 1e-6)    # 0 to 1
    s = ALPHA * n + (1 - ALPHA) * prev
    u8 = np.clip(s * 255, 0, 255)
    img = cv2.applyColorMap(
        u8.astype(np.uint8),
        cv2.COLORMAP_VIRIDIS)
    return s, img`,
    params: [
      { name: "threshold", label: "Threshold (counts)", min: 0, max: 60, step: 1, value: THRESHOLD },
      { name: "alpha", label: "Smoothing alpha", min: 0.05, max: 1, step: 0.05, value: ALPHA },
    ],
    notes: [
      `<code>base</code> is the baseline: for each of the ${TAXELS} taxels, the median of its first ${INIT_FRAMES} readings.`,
      `<code>c</code> is the contact: how far each taxel rose above its baseline, minus the threshold, kept between 0 and 100.`,
      "<code>peak</code> is the strongest taxel in this frame. Dividing by it stretches the frame to fill 0–1, so the picture always uses the full colour range.",
      `When <code>peak</code> is below the threshold nothing is pressed, so it divides by ${NOISE_SCALE} instead; leftovers stay dark.`,
      `<code>s</code> is the smoothed picture: ${PCT} % new frame, ${100 - PCT} % of what was shown before. The real viewer runs this blend once per pass of its display loop.`,
      "<code>applyColorMap</code> turns 0–255 into viridis colours.",
    ],
  },
  specs: [
    { label: "Top FPC", value: `${ROWS} sense lines, ${ROWS} gold fingers`, src: "fpc_top.json (its Gerber files)" },
    { label: "Bottom FPC", value: `${COLS} drive lines, ${COLS} gold fingers`, src: "fpc_bot.json (its Gerber files)" },
    { label: "Sensing area", value: "24 × 64 mm", src: GUIDE, note: "Where the two grids of lines overlap" },
    { label: "Lamination sheets", value: "2, pre-cut, one per FPC", src: GUIDE, note: "Drawn here as 30 × 72 mm", badge: "illustrative" },
    { label: "Extenders", value: "16-pin and 32-pin, 0.5 mm pitch", src: GUIDE, note: "A socket on each side: the tail in one, the cable in the other" },
    { label: "Flat cables", value: "16-pin and 32-pin FFC, 0.5 mm pitch", src: GUIDE },
    { label: "Board sockets", value: "FPC1: 16 pins (sense lines) · FPC2: 32 pins (drive lines)", src: BOARD },
    { label: "Nano sockets", value: "Two rows of 15, 2.54 mm pitch", src: BOARD },
    fact("firmware.frameBytes", "Frame size", { note: "AA 55 header + one byte per taxel" }),
    fact("firmware.header", "Frame header"),
    fact("system.frameRate", "Frames per second"),
    fact("host.initFrames", "Baseline frames", { note: "Per-taxel median" }),
    fact("host.threshold", "Threshold", { note: "Counts above the baseline that are ignored" }),
    fact("host.noiseScale", "Noise scale", { note: "Divisor when the peak is below the threshold" }),
    fact("host.alpha", "Smoothing alpha (EMA)"),
    fact("host.colormap", "Colour map"),
    fact("host.restingBytes", "Typical resting bytes", { value: (v) => `${v[0]}–${v[1]}`, note: "PyFlexiTac's docstring; the lab rests near 12" }),
  ],
  quiz: [
    {
      q: "Which way does the top part go onto the Velostat?",
      choices: ["Copper side up, so its lines can be seen", "Face down, its copper lines on the Velostat", "Either way: the Velostat conducts through the film", "Standing on its edge"],
      answer: 1,
      why: "The electrodes have to touch the Velostat. The top part turns over so its copper meets it, and its lines cross the bottom part's at right angles.",
    },
    {
      q: `The bottom FPC's tail has ${COLS} gold fingers. Which extender does it take?`,
      choices: ["The 16-pin extender", "The 32-pin extender", "Either one", "None: it is soldered to the board"],
      answer: 1,
      why: `One finger per drive line, ${COLS} in all, so it needs all 32 pins. The top tail's ${ROWS} fingers fit the 16-pin extender.`,
    },
    {
      q: "Which board socket does the top FPC's cable go to?",
      choices: ["FPC1, the 16-pin socket that leads to the multiplexer", "FPC2, the 32-pin socket", "The Nano's USB port", "Either socket"],
      answer: 0,
      why: "The top FPC carries the sense lines. Its 16-pin cable goes to FPC1, wired to the multiplexer; the 32 drive lines go to FPC2 and the shift registers.",
    },
    {
      q: "Why does the viewer subtract a baseline from every frame?",
      choices: [
        "To convert bytes into newtons",
        "Because every crossing reads a slightly different value at rest",
        "To find the AA 55 header",
        "To make the frame smaller",
      ],
      answer: 1,
      why: "An untouched crossing still reads a small number, and each one differs a little. Subtracting each taxel's own resting value leaves only the change your finger made.",
    },
    {
      q: "You press lightly in one spot, then hard in the same spot. How does the heatmap's brightest colour change?",
      choices: ["It gets brighter with the hard press", "It stays about the same", "It gets darker", "It turns red"],
      answer: 1,
      why: "Each frame is divided by its own peak, so the strongest taxel always lands near 1. The heatmap shows where you press; how hard is lost in this step.",
    },
    {
      q: "You hold your finger on the pad while the viewer starts. What happens after you let go?",
      choices: [
        "Nothing: the baseline ignores fingers",
        "That spot reads low, because your press became part of its baseline",
        "The whole pad lights up",
        "The frame rate drops",
      ],
      answer: 1,
      why: "The baseline is the median of the first frames. If you were pressing the whole time, the pressed value is the median, so that spot only shows touches harder than your first one.",
    },
  ],
};
