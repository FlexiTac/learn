// Lesson 3.4: make sim feel real (PLAN-section2-3.md §2; VT-Refine §5.1, App. C.1). Calibration in three moves: the real
// pad's press curve, k_n and k_d tuned until the simulated curve matches it, and one normalisation rule for both, checked
// by comparing the two pads' readings over many presses. The card is src/widgets/sim-calibrate.ts on the shared engine
// (shared/models/touchsim.mjs); the steps set what it highlights (view({focus, reset, fit})). No measured force curve
// was supplied (D8), so the "real" curve is the engine's illustrative one.
import { THRESHOLD, NOISE_SCALE } from "@shared/data/constants.mjs";
import { fact } from "../content/facts";
import type { Lesson } from "../types";

const MODEL = "touchsim (this course's in-browser model, shared/models/touchsim.mjs)";
const VT = "VT-Refine (Huang et al., CoRL 2025) §5.1, App. C.1";

export const lesson: Lesson = {
  id: "make-sim-feel-real",
  n: 12,
  title: "Make sim feel real",
  kicker: "Contact to signal",
  lede: `Two knobs, one curve, one rule. Tune the simulated pad until it reads like the real one, then check it over many presses.`,
  status: "ready",
  features: [
    { icon: "gauge", title: "The real curve", text: "Press one real point in and out, record its reading" },
    { icon: "spring", title: "Two knobs", text: "Turn kₙ and k_d until the sim's curve matches" },
    { icon: "chart", title: "Check the match", text: "Same rule for both pads, then compare many presses" },
  ],
  widget: "sim-calibrate",
  widgetCard: true,
  overview: `
<p><b>Why calibrate?</b> The spring and damper of Lesson 3.3 have two numbers, k<sub>n</sub> and k<sub>d</sub>. Pick them badly
and the simulated pad reads softer or stiffer than the real one, and a robot trained in simulation would be surprised by
the real pad. <dfn>Calibration</dfn> picks them by matching a real measurement.</p>
<p><b>1. The real curve.</b> Press one touch spot of a real pad in and let it go, slowly and evenly, and record its reading at
every depth (researchers use a precise testing machine). The readings rise as it goes in, and come back a little lower on
the way out: a small loop.</p>
<p><b>2. Two knobs.</b> Replay the same press on the simulated point and turn the knobs until the two curves line up:
k<sub>n</sub> sets how steep the line is, k<sub>d</sub> how wide its loop is. "Fit" does it for you, by finding the two values
with the smallest gap. Then the same two numbers are used for every point.</p>
<p><b>3. One rule for both.</b> Real and simulated frames are scaled by the same rule before anyone compares them: subtract
a small threshold (${THRESHOLD} counts), then divide by the frame's largest value, or by a fixed ${NOISE_SCALE} when the
frame is quiet. That is the same rule the real viewer uses.</p>
<p><b>4. Check the match.</b> Finally, many different presses are read both ways. If the two sets of readings (the
histograms) overlap, the simulated pad feels like the real one, and what a robot learns in simulation can carry over.</p>
<p class="aside">No measured force curve for FlexiTac was available, so the "real" curve here is
<span class="badge badge-illustrative">illustrative</span>: a stand-in pad with a little noise. The method is VT-Refine's.</p>`,
  specs: [
    { label: "Tuned", value: "k<sub>n</sub> and k<sub>d</sub> only, then used for every point", src: VT },
    { label: "Real measurement", value: "one taxel, force against reading, on a testing machine", src: VT, note: "No FlexiTac curve was supplied: the card's is a stand-in" },
    { label: "Real curve in the card", value: "a stand-in pad with noise", src: MODEL, badge: "illustrative" },
    fact("host.threshold", "Threshold", { note: "Readings below it count as 0 (the real viewer's rule)" }),
    fact("host.noiseScale", "Quiet-frame scale", { note: "Used instead of the frame's top value when that is under the threshold" }),
    fact("host.initFrames", "Baseline frames", { note: "The real viewer's resting level: the median of the first frames" }),
    { label: "Presses compared", value: "28 presses, 36 frames each at 100 Hz", src: MODEL, badge: "illustrative" },
  ],
  steps: [
    {
      title: "The real pad's curve",
      // keep every text to 2-3 lines in a 475-530 px column (1366-1440 px windows)
      text: "Press one real touch spot in and let it go, and record its reading at every depth: the dots. The straight line is the sim's spring, still too soft.",
      start: true,
      widgetView: { focus: "curve", reset: true },
    },
    {
      title: "Turn the two knobs",
      text: "Turn kₙ (steeper line) and k_d (wider loop) until the line runs through the dots, or press Fit. The gap between the curves shrinks.",
      widgetView: { focus: "curve" },
    },
    {
      title: "One rule for both",
      text: `Real and sim frames go through the same rule: subtract a small threshold, then divide by the frame's largest value (or a fixed ${NOISE_SCALE} when it is quiet).`,
      widgetView: { focus: "hist" },
    },
    {
      title: "Check the match",
      text: "Now compare 28 different presses read both ways. Once fitted, the two histograms of readings overlap: the sim pad reads like the real one.",
      widgetView: { focus: "hist", fit: true },
    },
  ],
  quiz: [
    {
      q: "What does calibration change in the simulated pad?",
      choices: ["The number of points", "The two numbers kₙ and k_d", "The size of the pad", "The order of the frame"],
      answer: 1,
      why: "Only the spring and damper numbers are tuned, until the simulated press curve matches the real one; then they are used for every point.",
    },
    {
      q: "Why scale real and simulated frames with the same rule?",
      choices: ["So the maps look more colourful", "So the two can be compared fairly, reading for reading", "Because the simulator cannot store big numbers", "To hide the noise"],
      answer: 1,
      why: "If the two were scaled differently, a perfect simulation would still look wrong next to the real pad.",
    },
  ],
};
