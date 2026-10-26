// Lesson 3.5: real -> sim -> real (PLAN-section2-3.md §2; VT-Refine §4-5, App. D, Table 1). The pipeline in four tiles
// and the paper's real-robot results. The card is src/widgets/sim-results.ts (its pictures drawn with sim-loop.ts's iso
// toolkit); the steps select a tile (view({step}), 0-based), which also eases the bars between "before sim" and "after sim".
// Every number on this lesson is the paper's.
import type { Lesson } from "../types";

const VT = "VT-Refine (Huang et al., CoRL 2025), Table 1";
const VT_D = "VT-Refine (Huang et al., CoRL 2025), App. D";

export const lesson: Lesson = {
  id: "real-sim-real",
  n: 13,
  title: "Real → sim → real",
  kicker: "Train with it",
  lede: `Learn from a few real demos, practise thousands of times in simulation, then go back to the real robot. With touch, it works much better.`,
  status: "ready",
  features: [
    { icon: "robot", title: "30 real demos", text: "A person drives the robot through the task" },
    { icon: "loop", title: "Practice in sim", text: "100 copies try, and keep what works" },
    { icon: "chart", title: "Back to real", text: "With touch: 35–65 % → 75–95 % success" },
  ],
  widget: "sim-results",
  widgetCard: true,
  overview: `
<p><b>The recipe</b> (from the VT-Refine project, which used FlexiTac-type pads on a two-armed robot with soft fingers):</p>
<ol>
<li><b>Record demos.</b> A person drives the real robot through the task about 30 times (<dfn>teleoperation</dfn>), while it
records what its cameras see, what its pads feel and how it moved.</li>
<li><b>Pre-train a policy.</b> A <dfn>policy</dfn>, the program that turns what the robot sees and feels into its next move,
learns to copy those demos. It works sometimes.</li>
<li><b>Practise in simulation.</b> 100 simulated copies try the task over and over and get a reward only when the parts fit.
By trial and error (<dfn>reinforcement learning</dfn>) the policy gets better. The simulated pads are the calibrated ones
of Lesson 3.4.</li>
<li><b>Back to the real robot.</b> The improved policy runs on the real robot, with no extra real practice.</li>
</ol>
<p><b>The result.</b> On five plug-and-socket tasks (each fit only about 2 mm loose), the policy that used vision and touch
went from 35–65 % success to 75–95 %. The same recipe with vision only improved much less. Touch helps most where the
camera cannot see: the moment two parts meet.</p>
<p class="aside">The bars are the paper's numbers for the real robot (Table 1). The small pictures are drawings.</p>`,
  specs: [
    { label: "Demos per task", value: "30, teleoperated", src: VT_D },
    { label: "Copies in simulation", value: "100", src: VT_D },
    { label: "Reward", value: "1 when the parts fit, else 0", src: VT_D },
    { label: "Vision + touch, real robot", value: "35–65 % → 75–95 % success", src: VT },
    { label: "Vision only, real robot", value: "20–40 % → 30–75 % success", src: VT },
    { label: "Tasks", value: "5 plug-and-socket pairs, about 2 mm clearance", src: VT_D },
  ],
  steps: [
    {
      title: "Record demos",
      // keep every text to 2-3 lines in a 475-530 px column (1366-1440 px windows)
      text: "A person drives the real robot through the task about 30 times. The robot records what it sees, what its pads feel and how it moved.",
      start: true,
      widgetView: { step: 0 },
    },
    {
      title: "Pre-train a policy",
      text: "A policy (the robot's program) learns to copy those demos. On the real robot it then works only sometimes: 35–65 % of tries with touch.",
      widgetView: { step: 1 },
    },
    {
      title: "Practise in sim",
      text: "100 simulated copies try the task again and again and score only when the parts fit. Trial and error makes the policy better.",
      widgetView: { step: 2 },
    },
    {
      title: "Back to the real robot",
      text: "The improved policy runs on the real robot: 75–95 % success with touch. Vision alone gained much less (the grey bars).",
      widgetView: { step: 3 },
    },
  ],
  quiz: [
    {
      q: "In this recipe, where does the robot do most of its practice?",
      choices: ["On the real robot", "In simulation", "In the person's demos", "Nowhere: it never practises"],
      answer: 1,
      why: "The real demos only start it off; the many tries happen in simulation, with 100 copies at once.",
    },
    {
      q: "What did adding touch do in VT-Refine's real-robot results?",
      choices: ["Nothing", "Success rose much more than with vision alone", "It made the robot slower", "It only helped in simulation"],
      answer: 1,
      why: "With vision and touch, success went from 35–65 % to 75–95 %; with vision only, from 20–40 % to 30–75 %.",
    },
  ],
};
