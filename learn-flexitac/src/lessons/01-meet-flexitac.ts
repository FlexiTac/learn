// Lesson 1 is the template for every other lesson: copy this file, keep the shape, change the words.
import { COLS, FRAME_HZ, ROWS } from "@shared/data/constants.mjs";
import { fact } from "../content/facts";
import type { Lesson, ShowAct } from "../types";

const TAXELS = ROWS * COLS;

// Step 2's "Show me": the same fingertip choreography as the home cover loop (film/cover-src/cover-shots.mjs). The finger
// presses A, slides to B while held, lifts, glides to C, presses lighter, lifts, glides back to A and goes. Positions are
// (sense, drive) in crossing units; an amount of 0.004 keeps the finger on screen without lighting any spot (the
// figure's floor is 0.02); the figure ramps every change of amount itself.
function fingerDemo(): ShowAct[] {
  const H = 0.004;
  const A: [number, number] = [3.2, 23.5];
  const B: [number, number] = [8.2, 13.0];
  const C: [number, number] = [4.2, 5.5];
  const smooth = (u: number) => {
    u = Math.max(0, Math.min(1, u));
    return u * u * u * (u * (u * 6 - 15) + 10);
  };
  const press = (t: number, [s, d]: [number, number], amount: number): ShowAct => ({
    name: "press",
    arg: { sense: +s.toFixed(3), drive: +d.toFixed(3), amount },
    at: Math.round(t * 1000),
    once: true,
  });
  const acts: ShowAct[] = [press(0, A, H), press(0.4, A, 1), press(3.2, B, H), press(4.5, C, 0.7), press(5.5, C, H)];
  // [t0, t1, from, to, amount]: slide while held, then two hovering glides, sampled at 30 per second
  const moves: [number, number, [number, number], [number, number], number][] = [
    [1.6, 2.7, A, B, 1],
    [3.45, 4.35, B, C, H],
    [5.75, 6.8, C, A, H],
  ];
  for (const [t0, t1, P, Q, amount] of moves) {
    for (let t = t0; t <= t1 + 1e-6; t += 1 / 30) {
      const u = smooth((t - t0) / (t1 - t0));
      acts.push(press(t, [P[0] + (Q[0] - P[0]) * u, P[1] + (Q[1] - P[1]) * u], amount));
    }
  }
  acts.push({ name: "press", arg: null, at: 7200, once: true });
  return acts.sort((a, b) => (a.at ?? 0) - (b.at ?? 0));
}

export const lesson: Lesson = {
  id: "meet-flexitac",
  n: 1,
  title: "Meet FlexiTac",
  kicker: "Start here",
  lede: `A robot hand that can feel what it holds. FlexiTac is the thin, bendy touch sensor on its fingers: it feels <b>where</b> it is pressed and roughly <b>how hard</b>.`,
  status: "ready",
  features: [
    { icon: "grid", title: `${ROWS} × ${COLS} grid`, text: `${TAXELS} touch spots in a 24 × 64 mm patch` },
    { icon: "layers", title: "A thin sandwich", text: "Five layers, less than 1 mm in total" },
    { icon: "pulse", title: `${FRAME_HZ} pictures a second`, text: "Each one is a full map of the pressure" },
  ],
  figure: {
    fig: "pad",
    // The lesson opens on step 1, "On a robot": the robot grasp picture covers the stage (GuidedStep.stage) while the
    // figure loads underneath in step 2's pose, "Feel it": the assembled pad seen from above in FEEL mode
    // (figures/EMBED.md, ft:act feel), with a "Click to touch the sensor" hint. Pressing the pad lights the touch spots
    // under the finger, and the figure's own touch map left of the pad (the same size as the sensing area, level with it)
    // shows the frame. initial and reset both land there (and turn step 3's all-labels mode off), so moving on from
    // step 1 shows the figure at once.
    initial: [{ name: "deselect" }, { name: "collapse" }, { name: "labels", arg: null }, { name: "feel", arg: true }],
    reset: [{ name: "deselect" }, { name: "collapse" }, { name: "labels", arg: null }, { name: "feel", arg: true }],
    // Reveal mode: outside FEEL mode the pad sits assembled on its mat with one small "Click to expand" hint and
    // nothing else. Clicking the sensor (or step 3's Show me) takes it apart in place; a click on a layer then shows its
    // label.
    reveal: true,
  },
  overview: `
<p><b>A robot that feels.</b> In step 1 a robot gripper picks up a strawberry. Each of its two soft fingers carries a
FlexiTac pad on the side that touches the fruit, and beside the robot you see what each pad feels while it holds on.
That picture of touch tells the robot where the strawberry sits between its fingers and how firmly it is held, which
helps it hold on without squashing the fruit.</p>
<p>FlexiTac is a thin, bendy <b>skin for robot hands</b>. Wrap it around a fingertip and the robot can feel where it
is being touched, and roughly how hard.</p>
<p><b>How it works.</b> Two thin sheets of copper lines cross each other, with a black pressure-sensitive film
(<dfn>Velostat</dfn>) in between. Every place where two lines cross is one tiny touch spot, a <dfn title="tactile pixel">taxel</dfn>
(<i>tactile pixel</i>). Press a spot and the film there lets electricity through more easily. A small board checks every
spot, one after another, very quickly.</p>
<p><b>What the robot gets.</b> About ${FRAME_HZ} times a second, a complete picture of touch: ${TAXELS} numbers, one per
spot, like the pixels of a camera image but for pressure. From that picture a robot can tell where an object sits in its
fingers and how firmly it is holding it.</p>
<p class="aside">Watch the robot first. Then press the sensor yourself and watch the touch map light up, and take it
apart to see what makes it work. The robot scene is <span class="badge badge-illustrative">illustrative</span>: drawn from
the robot's CAD files, with simulated readings. The later lessons explain each part in detail.</p>`,
  specs: [
    fact("sensor.taxels", "Taxels", { note: "" }),
    fact("sensor.rows", "Sense lines", { note: "On the Top FPC, read through the multiplexer" }),
    fact("sensor.cols", "Drive lines", { note: "On the Bottom FPC, driven by four shift registers" }),
    fact("pad.activeArea", "Sensing area"),
    fact("fpc_top.electrodes.pitch", "Line spacing (pitch)", { note: "Centre to centre, both sheets" }),
    fact("pad.thickness", "Pad thickness"),
    fact("system.frameRate", "Frame rate", { note: "Full pictures per second" }),
    fact("firmware.frameBytes", "Frame size", { note: "AA 55 header + 384 readings" }),
    fact("firmware.baud", "Serial speed"),
    fact("velostat.thickness", "Velostat sheet"),
    fact("build.time", "Build time", { value: (v) => `~${v} min` }),
    fact("cost.unit", "Cost per sensor", { value: (v) => `~$${v}` }),
  ],
  // step 1 ("On a robot") was added in front of the three old steps, and the old step 3 ("Squeeze the Velostat") moved
  // to lesson 2 (saved progress: old step k is step k + 1 now, and a count above 3 drops to 3; src/state/store.ts
  // migrateSteps)
  stepsAdded: [0, { keep: 3 }],
  steps: [
    {
      title: "On a robot",
      // keep it to 2-3 lines in a 475-530 px text column (1366-1440 px windows): the bar takes its longest step's height
      text: `Here FlexiTac is a skin on both fingers of a robot gripper. As the fingers close on a strawberry, each pad sends a ${ROWS} × ${COLS} picture of the touch, ${FRAME_HZ} times a second (right).`,
      // the lesson opens here: the robot grasp loop and its two live touch maps fill the stage (src/widgets/robot-grasp.ts,
      // illustrative); the figure waits underneath in step 2's pose (figure.initial), so no acts here
      start: true,
      stage: "robot-grasp",
    },
    {
      title: "Feel it",
      // keep it to 2-3 lines in a 475-530 px text column (1366-1440 px windows): the bar takes its longest step's height
      text: `Now touch the sensor yourself: each press lights up the touch spots under your finger. The map on the left is what the robot "feels": ${TAXELS} numbers, ${FRAME_HZ} times a second.`,
      act: [{ name: "collapse" }, { name: "feel", arg: true }],
      // the home cover's choreography (flexitac-anatomy/film/cover-src/cover-shots.mjs): press, slide, lift, press again
      show: fingerDemo(),
      // no demo card: Fig 1 draws the 12 × 32 touch map itself, left of the pad, in FEEL mode
    },
    {
      title: "Take it apart",
      text: "How does it do that? Click the sensor to take it apart: it is a stack of five thin layers. Then pick any layer to read what it does.",
      // back to the closed pad with its "Click to expand" hint; Show me takes it apart. labels "all": once it is apart,
      // every part is labelled at once (figures/EMBED.md "Fig 1", All labels: the five layers on the left, top to
      // bottom, the two gold-finger rows on the right); the figure makes room for them now, while the pad is closed
      act: [{ name: "feel", arg: false }, { name: "iso" }, { name: "labels", arg: "all" }],
      show: [{ name: "explode" }],
    },
  ],
  // the Velostat question moved to lesson 2 with its step (saved answers: src/state/store.ts migrateQuiz)
  quizDropped: [1],
  quiz: [
    {
      q: "What is a taxel?",
      choices: ["One layer of the sandwich", "One spot where a drive line crosses a sense line", "One copper line on the top sheet", "The header at the start of a frame"],
      answer: 1,
      why: "A taxel (tactile pixel) is one crossing: a drive line below, a sense line above, and a little Velostat between them.",
    },
    {
      q: `How many taxels does one ${ROWS} × ${COLS} pad have?`,
      choices: [String(ROWS), String(COLS), String(ROWS + COLS), String(TAXELS)],
      answer: 3,
      why: `Every one of the ${ROWS} sense lines crosses every one of the ${COLS} drive lines: ${ROWS} × ${COLS} = ${TAXELS}.`,
    },
  ],
};
