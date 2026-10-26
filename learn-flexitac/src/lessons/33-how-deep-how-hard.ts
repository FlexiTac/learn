// Lesson 3.3: how deep, how hard (PLAN-section2-3.md §2). Contact to force, point by point: the penetration depth d of
// each point, a spring and a damper per point (Kelvin-Voigt, f = k_n d + k_d d'), normal force only, and the depth and
// force maps. The card is src/widgets/sim-springs.ts on the shared engine (shared/models/touchsim.mjs); the steps pick
// its tour (view({mode: "slow" | "tap"})). The numbers are the engine's chosen ones (illustrative); the paper's are in
// the Specs tab, with how the released code bases differ.
import { DEFAULTS, PAPER, PRESETS } from "@shared/models/touchsim.mjs";
import type { Lesson } from "../types";

const MODEL = "touchsim (this course's in-browser model, shared/models/touchsim.mjs)";
const VT = "VT-Refine (Huang et al., CoRL 2025) §3, App. B.2";

export const lesson: Lesson = {
  id: "how-deep-how-hard",
  n: 11,
  title: "How deep, how hard",
  kicker: "Contact to signal",
  lede: `When an object presses into the pad, the simulator asks two questions for every point: how deep is it pressed, and how hard does it push back?`,
  status: "ready",
  features: [
    { icon: "ruler", title: "Depth d", text: "How far the object has pushed into each point" },
    { icon: "spring", title: "Spring + damper", text: "f = kₙ·d + k_d·ḋ, at every point" },
    { icon: "heat", title: "Two maps", text: "A depth map and a force map, 12 × 32 each" },
  ],
  widget: "sim-springs",
  widgetCard: true,
  overview: `
<p><b>How deep.</b> Wherever an object overlaps the pad, the simulator measures how far it has pushed into each point: the
<dfn>penetration depth</dfn> d, in millimetres. Points outside the object have d = 0.</p>
<p><b>How hard.</b> Each point then acts like a tiny spring with a damper beside it, a <dfn>Kelvin–Voigt</dfn> model:</p>
<p class="formula">f = k<sub>n</sub> · d + k<sub>d</sub> · ḋ</p>
<p>The spring part, k<sub>n</sub> · d, pushes back more the deeper the point is pressed. The damper part, k<sub>d</sub> · ḋ,
depends on how <i>fast</i> the depth changes (ḋ, "d-dot"): it adds force while the object moves in and takes some away while
it moves out, like a door closer. A point only ever pushes; it never pulls the object in.</p>
<p><b>Push only, no sideways.</b> The model keeps the force straight into the pad and leaves out sideways rubbing (shear).
A FlexiTac pad feels squeezing through its thickness, not sliding across its face, so the simulator does not need it.</p>
<p><b>Two maps.</b> The result is two ${"12 × 32"} pictures, like a real frame: how deep each point is pressed, and how
hard it pushes back. The force map is the one that becomes the simulated pad's reading.</p>
<p class="aside">k<sub>n</sub> = ${DEFAULTS.kn} N/mm and k<sub>d</sub> = ${DEFAULTS.kd} N·s/mm per point are chosen for this
course (<span class="badge badge-illustrative">illustrative</span>). A coming lesson shows how researchers tune the two numbers so
the simulated pad reads like a real one.</p>`,
  specs: [
    { label: "Model", value: "f = k<sub>n</sub> d + k<sub>d</sub> ḋ, normal force only", src: VT },
    { label: "In this course", value: `k<sub>n</sub> = ${DEFAULTS.kn} N/mm, k<sub>d</sub> = ${DEFAULTS.kd} N·s/mm per point`, src: MODEL, badge: "illustrative" },
    { label: "In the paper", value: `k<sub>n</sub> = ${PAPER.kn}, k<sub>d</sub> = ${PAPER.kd} (SI units)`, src: VT, note: "Different units and a different pad model: not comparable one to one" },
    { label: "Released code", value: "spring only (no damper), normal force kept", src: "VT-Refine code (easysim-envs tactile_sensor.py)", note: "The paper's damper is not in the released code" },
    { label: "Isaac Lab port", value: "spring only, clamped at a maximum force", src: "FlexiTac Isaac Sim simulation (warp_sdf_tactile)" },
    { label: "Ball in the card", value: `r = ${PRESETS.fingertip.radius} mm, pressed ${PRESETS.firmDepth} mm`, src: MODEL, badge: "illustrative" },
  ],
  steps: [
    {
      title: "How deep",
      // keep every text to 2-3 lines in a 475-530 px column (1366-1440 px windows)
      text: "Watch the ball press into one row of the pad (or drag up and down on it). For every point, the simulator measures how far it is pushed in: the depth d.",
      start: true,
      widgetView: { mode: "slow" },
    },
    {
      title: "A spring and a damper",
      text: "Each point pushes back like a spring with a damper: f = kₙ·d + k_d·ḋ. The quick tap (played slowly) shows the damper: extra force while the ball moves in.",
      widgetView: { mode: "tap" },
    },
    {
      title: "Push only",
      text: "Only the push straight into the pad counts, never sideways rubbing (shear): FlexiTac feels squeezing through its thickness. And a point never pulls.",
      widgetView: { mode: "slow" },
    },
    {
      title: "Two maps",
      text: "The result is two 12 × 32 maps: how deep each point is pressed, and how hard it pushes back. The force map becomes the simulated pad's reading.",
      widgetView: { mode: "slow" },
    },
  ],
  quiz: [
    {
      q: "What is the penetration depth d of a point?",
      choices: ["How far the object has pushed into that point", "The pad's thickness", "The distance between two points", "How long the press lasts"],
      answer: 0,
      why: "d is how far the object overlaps the pad at that point; outside the object d = 0.",
    },
    {
      q: "In f = kₙ·d + k_d·ḋ, which part depends on how fast the press changes?",
      choices: ["kₙ·d, the spring", "k_d·ḋ, the damper", "Neither", "Both equally"],
      answer: 1,
      why: "ḋ is how fast the depth changes, so the damper adds force while the object moves in and takes some away while it moves out.",
    },
    {
      q: "Why does the model leave out sideways (shear) forces?",
      choices: ["They are too small to matter for any sensor", "A FlexiTac pad feels squeezing through its thickness, not sliding across it", "Simulators cannot compute them", "They would make the maps too bright"],
      answer: 1,
      why: "The pad's Velostat changes with pressure through its thickness; the simulator copies what the real pad can feel.",
    },
  ],
};
