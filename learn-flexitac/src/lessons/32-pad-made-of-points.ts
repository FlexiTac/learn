// Lesson 3.2: a pad made of points (PLAN-section2-3.md §2). How a simulator sees a FlexiTac pad: 12 x 32 points on the
// finger's face, 2 mm apart, numbered in the real frame's order, riding along when the soft finger bends. The card is
// src/widgets/sim-points.ts on the shared engine (shared/models/touchsim.mjs); the steps set its object, the order
// sweep and the bend (view()).
import { COLS, ROWS } from "@shared/data/constants.mjs";
import { fact, getFact } from "../content/facts";
import type { Lesson } from "../types";

const TAXELS = ROWS * COLS;
const VT = "VT-Refine (Huang et al., CoRL 2025), App. B.1";

export const lesson: Lesson = {
  id: "pad-made-of-points",
  n: 10,
  title: "A pad made of points",
  kicker: "Touch as points",
  lede: `To a simulator, a FlexiTac pad is not a sandwich of films. It is ${TAXELS} points on the finger's face, numbered exactly like a real frame.`,
  status: "ready",
  features: [
    { icon: "points", title: `${TAXELS} points`, text: `${ROWS} × ${COLS}, 2 mm apart, on the finger's face` },
    { icon: "byte", title: "Frame order", text: "Point k = i × 32 + j, as the real board sends them" },
    { icon: "finger", title: "They bend along", text: "The points ride with the soft finger" },
  ],
  widget: "sim-points",
  widgetCard: true,
  overview: `
<p><b>Points, not layers.</b> A simulator cannot afford to model the pad's five thin layers and the Velostat inside. It keeps
only what matters: <i>where</i> the pad can feel. It lays ${ROWS} × ${COLS} = ${TAXELS} <dfn>taxel points</dfn> on the
finger's gripping face, 2 mm apart, one for every crossing of the real pad.</p>
<p><b>Touched or not.</b> Every step of the simulation, it checks each point against the objects around it. A point that
ends up inside an object is touched; the others feel nothing. In the card, move the glass ball (or tube) over the pad and
hold the button to press it in.</p>
<p><b>Same numbers as the real pad.</b> Each point gets a number, k = i × 32 + j (i = sense line 0–11, j = drive line
0–31), in exactly the order the reading board sends its ${TAXELS} readings in a frame. So a simulated frame and a real
frame line up square by square, and the same program can read both.</p>
<p><b>They move with the finger.</b> The points are fixed to the finger's surface, so when the finger moves or the soft fin
bends round an object, the points go with it and keep their numbers.</p>
<p class="aside">This is this course's own simplified model, running in your browser
(<span class="badge badge-illustrative">illustrative</span>). Research simulators such as VT-Refine lay their points the
same way: a 12 × 32 lattice at 2 mm on the pad's face.</p>`,
  specs: [
    fact("sensor.taxels", "Points per pad", { note: "One per crossing of the real pad" }),
    fact("fpc_top.electrodes.pitch", "Spacing", { note: "The real pad's line spacing" }),
    { label: "Numbering", value: "k = i × 32 + j", src: getFact("firmware.frameBytes").src, note: "i = sense line 0–11, j = drive line 0–31: the frame's order" },
    { label: "In research simulators", value: "12 × 32 lattice at 2 mm, ray-cast onto the pad", src: VT },
    { label: "Press depth in the card", value: "1.3 mm", src: "touchsim (this course's in-browser model)", badge: "illustrative" },
  ],
  steps: [
    {
      title: "384 points",
      // keep every text to 2-3 lines in a 475-530 px column (1366-1440 px windows)
      text: `To the simulator, the pad is just ${ROWS} × ${COLS} = ${TAXELS} points on the finger's face, 2 mm apart. <span class="only-mouse">Move the ball over it and hold the button</span><span class="only-touch">Press and hold on it, and drag to move the ball</span>: the points inside it light up.`,
      start: true,
      widgetView: { object: "ball", bent: false, order: false },
    },
    {
      title: "In frame order",
      text: "Each point has a number, k = i × 32 + j, in exactly the order the real board sends a frame. Watch the count run through the pad and the map.",
      widgetView: { bent: false, order: true },
    },
    {
      title: "They bend along",
      text: "Soft fingers bend. The points ride along with the finger's face and keep their numbers, so the map below keeps its order. Try the tube too.",
      widgetView: { bent: true, order: false },
    },
  ],
  quiz: [
    {
      q: "How does the simulator in this lesson see a FlexiTac pad?",
      choices: ["As five thin layers", `As ${TAXELS} points on the finger's face`, "As one big spring", "As a camera image"],
      answer: 1,
      why: `One point for every crossing of the real pad: ${ROWS} × ${COLS} = ${TAXELS}, 2 mm apart.`,
    },
    {
      q: "Point k = i × 32 + j. Which number has sense line i = 2 and drive line j = 5?",
      choices: ["7", "37", "69", "165"],
      answer: 2,
      why: "k = 2 × 32 + 5 = 69: the same place the real board's frame puts that reading.",
    },
    {
      q: "The soft finger bends round an object. What happens to the points?",
      choices: ["They stay where they were", "They move with the finger's face and keep their numbers", "They get new numbers", "Half of them switch off"],
      answer: 1,
      why: "The points are fixed to the finger's surface: they follow it and the frame keeps its order.",
    },
  ],
};
