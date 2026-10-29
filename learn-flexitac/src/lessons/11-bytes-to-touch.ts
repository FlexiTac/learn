// Lesson 5: from the byte stream to the live heatmap, following the host viewer (refs/fw/fast_32_16.py) step by step.
import { ALPHA, COLS, FRAME_BYTES, FRAME_HZ, INIT_FRAMES, NOISE_SCALE, ROWS, THRESHOLD } from "@shared/data/constants.mjs";
import { PYFLEXITAC } from "@shared/models/host.mjs";
import { fact } from "../content/facts";
import type { Lesson } from "../types";

const TAXELS = ROWS * COLS;
const PCT = Math.round(ALPHA * 100);

export const lesson: Lesson = {
  id: "bytes-to-touch",
  n: 3,
  title: "Bytes to touch: the heatmap",
  kicker: "Use it",
  lede: `On the computer, ${FRAME_HZ} frames a second become a live picture of touch. Five small steps turn ${TAXELS} raw numbers into colours. Press the simulated pad in the Heatmap lab and watch each step.`,
  status: "ready",
  features: [
    { icon: "heat", title: "Subtract the baseline", text: `Median of the first ${INIT_FRAMES} frames` },
    { icon: "wave", title: `Threshold ${THRESHOLD}`, text: "Ignore small wobbles" },
    { icon: "pulse", title: `Smoothing ${ALPHA}`, text: "Blend each frame with the last" },
  ],
  widget: "heatmap-lab",
  overview: `
<p>The board sends a stream of bytes. The viewer program on your computer (the hardware repo's
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
<a href="#/lesson/build-your-own">Lesson 1.4, Build your own</a>, shows how to flash it, and what to check when the
picture stays dark or looks wrong.</p>`,
  wiring: {
    intro: "Where each step happens. Only the first row runs on the Arduino; everything else runs on your computer.",
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
      "<code>applyColorMap</code> turns 0–255 into viridis colours. Edit the numbers and press <b>Run</b> to retune the lab.",
    ],
  },
  specs: [
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
    {
      q: `What does alpha = ${ALPHA} in the smoothing step mean?`,
      choices: [
        `Only ${PCT} % of taxels are shown`,
        `Each new frame counts ${PCT} % and the previous picture ${100 - PCT} %`,
        "The picture is shown 0.2 s late, always",
        "Values below 0.2 are hidden",
      ],
      answer: 1,
      why: "The exponential moving average blends the new frame with what was shown. A small alpha means smooth but slower to react; alpha 1 means no smoothing at all.",
    },
  ],
};
