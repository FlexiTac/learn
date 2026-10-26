// Lesson 3.4: playground (PLAN-section2-3.md §2; it was 3.6 until 3.4-3.5 were set aside). Everything from 3.2-3.3 in one card to try freely: an object pressing
// the finger's pad, the same press read two ways (simulated and real-style: bytes, noise, a baseline), and sliders for
// the press, k_n, k_d, noise and the threshold. The card is src/widgets/sim-playground.ts on the shared engine
// (shared/models/touchsim.mjs). Step 2 turns the real-style noise up (view({noise})) so the two maps visibly differ;
// steps 1 and 3 put it back to the default. Illustrative throughout.
import { NOISE_SCALE, THRESHOLD } from "@shared/data/constants.mjs";
import { DEFAULTS, READOUT } from "@shared/models/touchsim.mjs";
import { fact } from "../content/facts";
import type { Lesson } from "../types";

const MODEL = "touchsim (this course's in-browser model, shared/models/touchsim.mjs)";
/** Step 2's real-style noise (counts): enough that a few readings clear the threshold and speckle the real-style map */
const LOUD = 6;

export const lesson: Lesson = {
  id: "sim-playground",
  n: 12,
  title: "Playground",
  kicker: "Contact to signal",
  lede: `The whole model in one place. Pick an object, turn the knobs, add noise, and compare a simulated frame with a real-style one.`,
  status: "ready",
  features: [
    { icon: "touch", title: "Four objects", text: "A ball, a tube, a bar's edge and a strawberry" },
    { icon: "spring", title: "Every knob", text: "Press, kₙ, k_d, noise and threshold" },
    { icon: "heat", title: "Sim vs real-style", text: "The same press, read two ways" },
  ],
  widget: "sim-playground",
  widgetCard: true,
  overview: `
<p><b>Try it.</b> An object presses into the finger's pad again and again. Drag on the drawing (or click a square on a map)
to move where it presses, and pick another object with the buttons.</p>
<p><b>Two ways to read the same press.</b> The <i>Simulated</i> map is the model's force, scaled by the same rule the real viewer uses (Lesson 1.5).
The <i>Real-style</i> map turns the same force into bytes first, the way a real board would send them: every point has its
own resting level, a little noise, and the viewer subtracts a <dfn>baseline</dfn> measured from the first frames. Then the
same rule scales it.</p>
<p><b>Things to try.</b></p>
<ul>
<li>Make k<sub>n</sub> stiffer: the same press pushes back harder.</li>
<li>Raise k<sub>d</sub> and shorten the press time: the damper adds force while the object moves.</li>
<li>Add noise: the real-style map speckles, but the threshold (${THRESHOLD} counts) hides most of it.</li>
<li>Press very lightly: when a frame's top value is under the threshold, the rule divides by a fixed ${NOISE_SCALE} instead
of the top value, so a light touch stays dim instead of jumping to full brightness.</li>
</ul>
<p class="aside">Every number here is this course's own choice (<span class="badge badge-illustrative">illustrative</span>),
except the viewer's threshold, noise scale and baseline frames, which are the real PyFlexiTac / hardware-repo values. To go
further, the research code is open: VT-Refine and the FlexiTac Isaac Sim simulation.</p>`,
  specs: [
    { label: "Spring, damper (start)", value: `k<sub>n</sub> = ${DEFAULTS.kn} N/mm, k<sub>d</sub> = ${DEFAULTS.kd} N·s/mm`, src: MODEL, badge: "illustrative" },
    { label: "Force to counts", value: "125 counts per newton", src: MODEL, badge: "illustrative" },
    { label: "Engine rate", value: "100 steps a second, like a real pad's frames", src: MODEL },
    fact("host.threshold", "Threshold"),
    fact("host.noiseScale", "Quiet-frame scale"),
    fact("host.initFrames", "Baseline frames"),
  ],
  steps: [
    {
      title: "Pick an object",
      // keep every text to 2-3 lines in a 475-530 px column (1366-1440 px windows)
      text: "An object presses the pad over and over. Pick another one, or drag on the drawing to move where it presses. Both maps show the same press.",
      start: true,
      widgetView: { noise: READOUT.noise },
    },
    {
      title: "Sim vs real-style",
      text: "Left, the simulated frame; right, the same force read like a real board: resting levels, noise, a baseline. The same rule scales both. With the noise turned up, stray dots flicker on the right map only.",
      // the noise up from 1 to 6 counts: a few readings clear the threshold, so the real-style map speckles
      widgetView: { noise: LOUD },
    },
    {
      title: "Turn the knobs",
      text: "Make kₙ stiffer, raise k_d, add noise, change the threshold. Watch which map changes, and how. Reset puts everything back.",
      widgetView: { noise: READOUT.noise },
    },
  ],
  quiz: [
    {
      q: "What does the real-style map add that the simulated one does not have?",
      choices: ["More touch spots", "Resting levels, noise and a baseline, like a real board's bytes", "A different numbering", "Colour"],
      answer: 1,
      why: "The real-style frame turns the force into bytes first: each point has its own resting level and a little noise, and the viewer subtracts a baseline.",
    },
    {
      q: "A very light press: the frame's top value is under the threshold. What does the rule divide by?",
      choices: ["The frame's top value", `A fixed ${NOISE_SCALE}`, "Zero", "The number of points"],
      answer: 1,
      why: `Dividing a nearly empty frame by its own top value would blow tiny noise up to full brightness; a fixed ${NOISE_SCALE} keeps it dim.`,
    },
  ],
};
