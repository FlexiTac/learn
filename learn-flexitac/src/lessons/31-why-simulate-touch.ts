// Lesson 3.1: why simulate touch (PLAN-section2-3.md §2). Section 3 needs no GPU and no simulator install: every card is
// a small in-browser simulation on the shared touch engine (shared/models/touchsim.mjs), shown in the middle of the
// stage (Lesson.widgetCard, src/ui/stagecard.ts). This card, src/widgets/sim-loop.ts, is the real -> sim -> real loop
// diagram; the steps light one part of it at a time (view({focus})).
import type { Lesson } from "../types";

const VT = "VT-Refine (Huang et al., CoRL 2025), App. D";

export const lesson: Lesson = {
  id: "why-simulate-touch",
  n: 9,
  title: "Why simulate touch",
  kicker: "Touch as points",
  lede: `Robots learn by trying, over and over. A simulation lets many copies practise at once, but only if the simulated fingers feel like the real FlexiTac pads.`,
  status: "ready",
  features: [
    { icon: "robot", title: "Real tries are slow", text: "One robot, one try at a time, in real time" },
    { icon: "loop", title: "Many copies in sim", text: "They practise side by side, faster than real time" },
    { icon: "heat", title: "Touch must match", text: "The sim pad has to read like the real one" },
  ],
  widget: "sim-loop",
  widgetCard: true,
  overview: `
<p><b>Learning by trying.</b> A robot can learn a skill, like fitting a plug into a socket, by trying it again and again
and keeping what works. That kind of trial-and-error learning (<dfn>reinforcement learning</dfn>) often needs thousands
of tries.</p>
<p><b>Real tries are slow.</b> A real robot makes one try at a time, in real time, and a person has to reset the scene after
each one. Parts wear out, and a bad try can break something.</p>
<p><b>Simulation is fast.</b> In a simulation (a <i>digital twin</i> of the robot and its table), many copies can practise at
once and faster than real time. Nothing breaks. The VT-Refine project ran 100 copies side by side.</p>
<p><b>The catch.</b> If the robot uses touch, its simulated pads must "feel" like the real ones: the same press must give
the same picture. Otherwise the robot practises with the wrong sense of touch and fails when it goes back to the real
world. Getting this right is the <dfn>sim-to-real</dfn> problem, and it is what the rest of this section is about.</p>
<p class="aside">The drawing is <span class="badge badge-illustrative">illustrative</span>: twelve copies stand for the hundred.
The two small maps are made by this course's own touch model, running here in your browser; Lessons 3.2–3.4 show how it
works.</p>`,
  specs: [
    { label: "Copies practising at once", value: "100", src: VT, note: "In VT-Refine's simulation (its config: n_envs 100)" },
    { label: "Real demos to start from", value: "30 per task", src: VT, note: "Teleoperated by a person" },
    { label: "Copies drawn here", value: "12", src: "touchsim (this course's in-browser model)", badge: "illustrative" },
    { label: "Simulator in this course", value: "your browser: no GPU, nothing to install", src: "touchsim (this course's in-browser model)" },
  ],
  steps: [
    {
      title: "Real tries are slow",
      // keep every text to 2-3 lines in a 475-530 px column (1366-1440 px windows)
      text: "A robot can learn a skill by trying it again and again, often thousands of times. A real robot makes one slow try at a time, and things wear out.",
      start: true,
      widgetView: { focus: "real" },
    },
    {
      title: "Many copies at once",
      text: "In a simulation, many copies of the robot practise at the same time, faster than real time, and nothing breaks.",
      widgetView: { focus: "sim" },
    },
    {
      title: "Touch must match",
      text: "But practice only helps if the simulated pad feels like the real one: the same press must give the same map. The next lessons build such a pad.",
      widgetView: { focus: "touch" },
    },
    {
      title: "The whole loop",
      text: "A few real demos teach a first policy; it practises in simulation; the better policy goes back to the real robot. Watch the dot go round.",
      widgetView: { focus: null },
    },
  ],
  quiz: [
    {
      q: "Why practise in simulation instead of on the real robot?",
      choices: ["Simulations are always more accurate", "Many copies can try at once, faster than real time, and nothing breaks", "Real robots cannot learn", "Simulations need no computer"],
      answer: 1,
      why: "A real robot makes one try at a time in real time; a simulation runs many copies in parallel, faster, with no broken parts.",
    },
    {
      q: "What must be true for touch practised in simulation to help on the real robot?",
      choices: ["The simulated pad must be bigger", "The simulated pad must read like the real one for the same press", "The simulation must run slower", "The robot must close its eyes"],
      answer: 1,
      why: "If the sim pad reads differently, the robot learns from the wrong sense of touch, and the skill does not carry over.",
    },
  ],
};
