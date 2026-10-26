// Lesson 2.2: grasp with your mouse (PLAN-section2-3.md §1, D4 (a): the gripper close-up and a table, fully live). Fig 5's
// teleop mode (figures/EMBED.md "Fig 5 gripper: teleop mode") puts the gripper over a cutting mat with a strawberry, a
// wooden cube in a row; the learner drives it with a plain 2D mouse (left / right along the row, up / down the
// height, hold the button to grip; figures/EMBED.md "Controls") and the widget under it,
// src/widgets/teleop-maps.ts, draws what the two pads feel, frame by frame, as the figure computes it with the shared
// touch engine (shared/models/touchsim.mjs: the same model Section 3 takes apart). Every number is illustrative.
// The guided steps are optional: each "Show me" queues the figure's own guided acts (reach, close, lift), and any mouse
// move, wheel or key hands the gripper back to the learner.
import { COLS, ROWS } from "@shared/data/constants.mjs";
import { DEFAULTS } from "@shared/models/touchsim.mjs";
import { fact, getFact } from "../content/facts";
import type { Lesson } from "../types";

const MODEL = "touchsim (this course's in-browser model, shared/models/touchsim.mjs)";

export const lesson: Lesson = {
  id: "grasp-with-your-mouse",
  n: 8,
  title: "Grasp with your mouse",
  kicker: "Grasp with touch",
  lede: `Drive the gripper yourself and pick something up. The moment the fingers close, both pads' touch maps show what each finger feels.`,
  status: "ready",
  features: [
    { icon: "mouse", title: "Mouse only", text: "Left / right along the row, up / down for height, hold the button to grip" },
    { icon: "heat", title: "Two live maps", text: `Left and right finger, ${ROWS} × ${COLS} each` },
    { icon: "touch", title: "Shapes leave patterns", text: "A patch for the fruit, a line along the cube's edge" },
  ],
  figure: {
    fig: "gripper",
    // teleop mode: the camera eases to the table, the mat and objects fade in, the gripper waits over the cube. reset (a
    // dot, the restart button) is teleop's own while it is on: objects back in place, the gripper home and open.
    initial: [{ name: "teleop", arg: { object: "strawberry" } }],
    reset: [{ name: "teleop", arg: { object: "strawberry" } }, { name: "reset" }],
  },
  // the two maps, a force bar and one status line under the figure (the widget asks the split stage for its short row)
  widget: "teleop-maps",
  overview: `
<p><b>Your turn to drive.</b> The fingertips follow the mouse: move it left and right and the gripper slides along the
row of things on the mat; move it up and down and the gripper rises and sinks. Hold the mouse button to close the fingers;
let go to open them. Close on something and move the mouse up: it comes along. Near an object the gripper eases onto it,
a dashed line shows where the fingertips will land, and the object glows when the open fingers are low enough round it.
(Keys work too: the arrows move it and raise and lower it, Space grips; the wheel also raises and lowers.)</p>
<p><b>What the maps show.</b> Under the gripper are the two pads' touch maps, left finger and right finger, each
${ROWS} × ${COLS} squares: exactly what the two reading boards from Lesson 2.1 would send. A square lights where its touch
spot is pressed, and the harder it is pressed, the brighter it gets. The bar beside them is the total squeeze, with a mark
at the squeeze this object needs before it lifts.</p>
<p><b>Shapes leave patterns.</b> The strawberry leaves a rounded patch, the cube's edge a line along the finger. Grab
off-centre and only one finger touches at first: one map lights, the other stays dark, and the object is pushed along
until the second finger meets it.</p>
<p><b>Why it matters.</b> A robot that sees these pictures knows whether it is really holding something, where it sits
between its fingers and how firmly, even when a camera cannot see the fingers.</p>
<p class="aside">Everything here is simulated in your browser (<span class="badge badge-illustrative">illustrative</span>):
each pad is ${ROWS * COLS} points pressed by the objects' shapes, a tiny spring per point and the same rule the real
viewer uses to scale a frame. <a href="#/lesson/why-simulate-touch">Section 3</a> takes that model apart, one idea at a
time.</p>`,
  specs: [
    { label: "Touch spots", value: `${ROWS} × ${COLS} per pad, 2 pads`, src: getFact("sensor.taxels").src },
    { label: "Grip force", value: "up to 5 N per pad", src: MODEL, badge: "illustrative", note: "Where the closing stops: the motor's stall in this model" },
    { label: "Spring per point", value: `k<sub>n</sub> = ${DEFAULTS.kn} N/mm`, src: MODEL, badge: "illustrative" },
    { label: "Damper per point", value: `k<sub>d</sub> = ${DEFAULTS.kd} N·s/mm`, src: MODEL, badge: "illustrative" },
    { label: "Friction", value: "μ = 0.6", src: MODEL, badge: "illustrative", note: "An object lifts once the squeeze × μ holds its weight" },
    { label: "Objects", value: "strawberry 20 g · cube 28 mm, 14 g", src: MODEL, badge: "illustrative" },
    fact("host.threshold", "Noise threshold", { note: "The real viewer's rule, used here too: smaller readings count as 0" }),
    fact("host.noiseScale", "Quiet-frame scale", { note: "A frame whose top value is under the threshold is divided by this" }),
  ],
  steps: [
    {
      title: "Reach",
      // keep every text to 2-3 lines in a 475-530 px column (1366-1440 px windows)
      text: "Move the mouse: left and right slide the gripper along the row, up and down raise and lower it. Bring the open fingers down round the strawberry, or press Show me.",
      // the lesson opens here, in teleop mode (figure.initial)
      start: true,
      show: [{ name: "reach", arg: "strawberry", once: true }],
    },
    {
      title: "Close",
      text: "Hold the mouse button to close the fingers. Both maps light up where the pads touch the fruit; a firmer squeeze reads brighter.",
      show: [{ name: "close", once: true }],
    },
    {
      title: "Lift",
      text: "Keep holding and move the mouse up. If the squeeze is enough, the strawberry comes along. The bar shows the squeeze it needs.",
      show: [{ name: "lift", arg: 35, once: true }],
    },
    {
      title: "Try another shape",
      text: "Let go, then grab the cube. Its edge leaves a different pattern: a line along the finger, not a patch. Grab it off-centre and only one side lights.",
      // the figure queues these one after another (each starts when the one before is done)
      show: [
        { name: "open", once: true },
        { name: "reach", arg: "cube", once: true },
        { name: "close", once: true },
        { name: "lift", arg: 35, once: true },
      ],
    },
  ],
  quiz: [
    {
      q: "You squeeze the strawberry harder. What happens on the maps?",
      choices: ["They go dark", "The touched squares get brighter", "More rows appear", "Nothing changes"],
      answer: 1,
      why: "Each square's colour shows how hard its touch spot is pressed: a firmer squeeze reads brighter.",
    },
    {
      q: "You grab the cube off-centre and only the left map lights up. Why?",
      choices: ["The right pad is broken", "Only the left pad touches the cube so far", "The right board is not plugged in", "Cubes only show on one side"],
      answer: 1,
      why: "The left finger meets the cube first and pushes it along; the right map lights once the right finger reaches it too.",
    },
    {
      q: "Which pattern does the cube's edge leave on a pad?",
      choices: ["A round patch", "A line along the finger", "A ring", "Every square at once"],
      answer: 1,
      why: "The cube is turned so one of its vertical edges meets each pad: a thin line of touch spots along the finger.",
    },
  ],
};
