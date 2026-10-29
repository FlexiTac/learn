// Lesson 1.5: put FlexiTac on a robot, then grasp with your mouse (PLAN-section2-3.md §1). 2026-10-29: the course's
// Section 1 ends on the robot, and "Grasp with your mouse" (once Lesson 2.2, now src/lessons/_retired/
// 22-grasp-with-your-mouse.ts) became this lesson's last four steps; its old links and saved progress come here
// (src/state/store.ts MOVED, migrateIds revision 3).
// The robot is already fitted with fin-shaped soft fingers (the UMI finger); the lesson shows how the pad goes on and how
// it is wired, never how to swap the stock gripper, and it says the same three moves (stick it on, plug the tails into an
// extender, cable to a reading board) work on other grippers. Mounting facts are the FlexiTac team's build (their photos,
// refs/s2s3-research/user-photos/, 2026-10-25).
// Step 1 is the robot (Lesson 1.1's robot grasp, src/widgets/robot-grasp.ts, over the stage); steps 2-5 are Fig 5
// (figures/gripper, figures/EMBED.md "Fig 5"): its step acts play each stage of the mounting. Steps 6-9 are Fig 5's
// teleop mode (figures/EMBED.md "Fig 5 gripper: teleop mode"): the gripper over a cutting mat with a strawberry and a
// wooden cube in a row; the learner drives it with a plain 2D mouse (left / right along the row, up / down the height,
// hold the button to grip; figures/EMBED.md "Controls") and the widget under it, src/widgets/teleop-maps.ts, draws what
// the two pads feel, frame by frame, as the figure computes it with the shared touch engine (shared/models/touchsim.mjs:
// the same model Section 3 takes apart). The widget is hidden on steps 1-5 (the figure has the whole stage). Every
// number in the teleop steps is illustrative. Their "Show me"s queue the figure's own guided acts (reach, close, lift),
// and any mouse move, wheel or key hands the gripper back to the learner.
import { COLS, FRAME_HZ, ROWS } from "@shared/data/constants.mjs";
import { DEFAULTS } from "@shared/models/touchsim.mjs";
import { fact, getFact } from "../content/facts";
import type { Lesson } from "../types";

const TAXELS = ROWS * COLS;
/** Source strings (src/content/sources.ts turns them into chips). */
const BUILD = "the FlexiTac team's build (photos, 2026-10-25)";
const REBOT = "reBot-DevArm B601-DM docs (Seeed Studio)";
const UMI = "UMI soft finger (UMI hardware guide, UMI_figure_tip.stl)";
const MODEL = "touchsim (this course's in-browser model, shared/models/touchsim.mjs)";

export const lesson: Lesson = {
  id: "put-on-a-robot",
  n: 5,
  title: "Put FlexiTac on a robot",
  kicker: "On a robot",
  lede: `Two pads, two boards, two USB cables: how FlexiTac goes onto a gripper's fingers and how its touch gets to the computer. Then drive the gripper yourself and feel what it grasps.`,
  status: "ready",
  features: [
    { icon: "tape", title: "Tape it on", text: "Polyimide tape holds the pad on, its tails round the finger to the back" },
    { icon: "usb", title: "One board per finger", text: "Two boards, two USB cables, two touch maps" },
    { icon: "mouse", title: "Grasp with your mouse", text: "Pick up a strawberry or a cube and watch both maps" },
  ],
  figure: {
    fig: "gripper",
    // The lesson opens on step 1, the robot (a picture over the stage). Underneath, Fig 5 waits in the pose step 2 starts
    // from: the fingers bare (wrap false takes the pads, tape, tails, cables and USB off), so step 2 shows the pad going
    // on. reset (a dot or the restart button) does the same from any pose: it ends the teleop mode of steps 6-9 first,
    // then step 5's press mode.
    initial: [{ name: "wrap", arg: false }],
    reset: [{ name: "teleop", arg: false }, { name: "labels", arg: null }, { name: "feel", arg: false }, { name: "reset" }, { name: "wrap", arg: false }],
  },
  // steps 6-9: the two maps, a force bar and one status line under the figure (the widget asks the split stage for its
  // short row); steps 1-5 hide it
  widget: "teleop-maps",
  overview: `
<p><b>Where the touch goes.</b> A gripper touches things with the flat faces of its fingers, so that is where the pads go:
one FlexiTac pad on each finger's gripping face. Here the gripper has soft, fin-shaped fingers that bend round what they
hold, so more of the pad touches the object.</p>
<p><b>Three moves.</b></p>
<ul>
<li><b>Stick it on.</b> Thin single-sided <dfn>polyimide</dfn> tape presses the pad flat. Each strip runs along the finger:
over the pad, round the fingertip and onto the finger's back, so the pad cannot peel off when the finger bends.</li>
<li><b>Tails to the back.</b> The pad's two tails come out of its side (as you saw from the top in Lesson 1.1). Each
wraps round the finger's side to its back and never goes past the fingertip. Their <dfn>gold fingers</dfn> plug into a
small off-the-shelf <dfn>FFC</dfn> extender there, and a flat cable of about 15 cm runs to the reading board.</li>
<li><b>One board per finger.</b> Each finger's cables go to its own reading board beside the gripper motor, and each board
has its own USB cable. The computer sees two serial ports: left finger and right finger.</li>
</ul>
<p><b>Why one board per finger?</b> Each board reads exactly one pad (${ROWS} × ${COLS} = ${TAXELS} touch spots), so the
two pads never share wires or wait for each other: each sends its own ${FRAME_HZ} frames a second. The cables stay short and
only have to follow the finger's slide, never a robot joint. They still need slack, so the fingers can open and close all
the way without pulling on them.</p>
<p><b>Other grippers.</b> This is one example. The same three moves work on flat parallel jaws, ALOHA and xArm grippers and
LeRobot arms: stick the pad on the gripping surface, plug the tails into extenders, cable them to a board. Only the holder
that carries the finger changes.</p>
<p><b>Your turn to drive (steps 6-9).</b> The fingertips follow the mouse: move it left and right and the gripper slides
along the row of things on the mat; move it up and down and the gripper rises and sinks. Hold the mouse button to close
the fingers; let go to open them. Close on something and move the mouse up: it comes along. Near an object the gripper
eases onto it, a dashed line shows where the fingertips will land, and the object glows when the open fingers are low
enough round it. (Keys work too: the arrows move it and raise and lower it, Space grips; the wheel also raises and
lowers.) <span class="only-touch">On a touch screen, drag on the drawing to move the gripper and tap <b>Grip</b> to close
the fingers; <b>Let go</b> opens them.</span></p>
<p><b>What the maps show.</b> Under the gripper are the two pads' touch maps, left finger and right finger, each
${ROWS} × ${COLS} squares: exactly what the two reading boards would send. A square lights where its touch spot is pressed,
and the harder it is pressed, the brighter it gets. The bar beside them is the total squeeze, with a mark at the squeeze
this object needs before it lifts.</p>
<p><b>Shapes leave patterns.</b> The strawberry leaves a rounded patch, the cube's edge a line along the finger. Grab
off-centre and only one finger touches at first: one map lights, the other stays dark, and the object is pushed along
until the second finger meets it.</p>
<p><b>Why it matters.</b> A robot that sees these pictures knows whether it is really holding something, where it sits
between its fingers and how firmly, even when a camera cannot see the fingers.</p>
<p class="aside">The mounting follows the FlexiTac team's own build (their photos). The robot is a reBot-DevArm with UMI
soft fingers. The finger holders and the board trays are drawn for this gripper: <span class="badge badge-proposed">proposed</span>,
one way to do it. The touch maps from step 5 on are simulated in your browser (<span class="badge badge-illustrative">illustrative</span>):
each pad is ${TAXELS} points pressed by the objects' shapes, a tiny spring per point and the same rule the real viewer uses
to scale a frame. <a href="#/lesson/why-simulate-touch">Section 3</a> takes that model apart, one idea at a time.</p>`,
  parts: {
    intro: "What this lesson adds to a two-finger gripper: the pads you met in Lessons 1.1–1.4, and the reading board that Section 2 opens up.",
    rows: [
      { name: "FlexiTac pad", qty: "2", note: "One on each finger's gripping face.", src: getFact("sensor.taxels").src },
      { name: "Single-sided polyimide tape", qty: "a few strips", note: "Presses each pad flat; each strip runs over the pad, round the fingertip and onto the back.", src: BUILD },
      { name: "FFC extender (20/40-pin, from the BOM)", qty: "4", note: "Two per finger, one for each tail: the tail's gold fingers go in one side, a flat cable in the other.", src: BUILD },
      { name: "FFC cable, 0.5 mm pitch, about 15 cm", qty: "4", note: "A 32-pin and a 16-pin per finger, from the extenders to that finger's board, with slack.", src: `${BUILD}; ${getFact("board.part.FPC2").src}` },
      { name: "Reading board with Arduino Nano", qty: "2", note: "One per finger, beside the gripper motor.", src: BUILD },
      { name: "USB cable (mini-USB to USB-A)", qty: "2", note: "One per board, to the computer: two serial ports, left and right.", src: BUILD },
      { name: "Finger holder and board tray", qty: "2 + 2", note: "Printed parts that carry the fingers and the boards on this gripper.", src: REBOT, badge: "proposed" },
    ],
    foot: "The soft fingers themselves (UMI fin, printed in TPU 95A) are already on the robot at the start of this lesson.",
  },
  specs: [
    fact("sensor.taxels", "Touch spots per pad"),
    fact("pad.activeArea", "Sensing area"),
    { label: "Pads and boards", value: "2 pads, 2 reading boards, 2 USB cables", src: BUILD },
    { label: "Where the boards sit", value: "beside the gripper motor, one per finger", src: BUILD },
    { label: "Cable length", value: "about 15 cm, slack for the full stroke", src: BUILD },
    fact("system.frameRate", "Frames per board", { note: "Each board sends its own pad's frames" }),
    fact("firmware.frameBytes", "Frame size", { note: "Per board, per frame" }),
    { label: "Soft finger", value: "UMI fin, TPU 95A, 40 × 123.4 × 25.8 mm", src: UMI },
    { label: "Gripper opening", value: "0–100 mm", src: REBOT },
    { label: "Holders and trays", value: "drawn for this gripper", src: REBOT, badge: "proposed" },
    // the teleop steps (6-9)
    { label: "Grip force", value: "up to 5 N per pad", src: MODEL, badge: "illustrative", note: "Where the closing stops: the motor's stall in this model" },
    { label: "Spring per point", value: `k<sub>n</sub> = ${DEFAULTS.kn} N/mm`, src: MODEL, badge: "illustrative" },
    { label: "Damper per point", value: `k<sub>d</sub> = ${DEFAULTS.kd} N·s/mm`, src: MODEL, badge: "illustrative" },
    { label: "Friction", value: "μ = 0.6", src: MODEL, badge: "illustrative", note: "An object lifts once the squeeze × μ holds its weight" },
    { label: "Objects", value: "strawberry 20 g · cube 28 mm, 14 g", src: MODEL, badge: "illustrative" },
    fact("host.threshold", "Noise threshold", { note: "The real viewer's rule, used here too: smaller readings count as 0" }),
    fact("host.noiseScale", "Quiet-frame scale", { note: "A frame whose top value is under the threshold is divided by this" }),
  ],
  // steps 6-9 came from "Grasp with your mouse" at the end, so saved counts stay where they are (its own saved steps move
  // on top of a finished mounting: src/state/store.ts migrateIds revision 3)
  steps: [
    {
      title: "A robot that can feel",
      // keep every text to 2-3 lines in a 475-530 px column (1366-1440 px windows)
      text: "This robot has a FlexiTac pad on each soft finger, right where the fingers touch what they grab. The same steps work on flat jaws and other grippers too.",
      // the robot grasp (Lesson 1.1's picture) over the stage; Fig 5 waits underneath with bare fingers (figure.initial)
      start: true,
      stage: "robot-grasp",
      widget: false,
    },
    {
      title: "Wrap the pad on",
      text: "Lay the pad on the finger's flat gripping face. Strips of polyimide tape press it flat: over the pad, round the fingertip and onto the finger's back.",
      act: { name: "step", arg: 2 },
      widget: false,
    },
    {
      title: "Tail to the back",
      text: "The tails come out of the pad's side. Fold them round the finger's side to its back, never past the tip, so the gold contacts sit behind the finger.",
      act: { name: "step", arg: 3 },
      widget: false,
    },
    {
      title: "Extenders and cables",
      text: "Each tail plugs into a small FFC extender. Flat cables (about 15 cm) run on to that finger's board by the motor. Watch the loop of slack as the gripper opens and closes.",
      // Fig 5's step 4 also labels the near finger's FFC extender (its one label, Details ›) once the extenders seat,
      // and takes it away on the next step or a reset (figures/EMBED.md "Fig 5", step)
      act: { name: "step", arg: 4 },
      widget: false,
    },
    {
      title: "Two boards, two USB",
      text: `Each board has its own USB cable, so the computer gets two touch maps: left and right. <span class="only-mouse">Click</span><span class="only-touch">Tap</span> a finger to press its pad and watch its map light up.`,
      // the USB cables plug in and the two maps appear; a click on a finger presses its pad (feel mode); Show me presses
      // the left finger, then the right (momentary: never replayed after a theme switch)
      act: [{ name: "step", arg: 5 }, { name: "feel", arg: true }],
      show: [
        { name: "press", arg: { finger: "left", amount: 1, hold: 1.4 }, at: 300, once: true },
        { name: "press", arg: { finger: "right", amount: 1, hold: 1.4 }, at: 2300, once: true },
      ],
      widget: false,
    },
    {
      title: "Your turn: reach",
      text: `<span class="only-mouse">Move the mouse</span><span class="only-touch">Drag on the drawing</span>: left and right slide the gripper along the row, up and down raise and lower it. Bring the open fingers down round the strawberry, or press Show me.`,
      // into teleop mode: the camera eases to the table, the mat and objects fade in, the gripper waits over the cube
      act: [{ name: "labels", arg: null }, { name: "feel", arg: false }, { name: "teleop", arg: { object: "strawberry" } }],
      show: [{ name: "reach", arg: "strawberry", once: true }],
    },
    {
      title: "Close",
      text: `<span class="only-mouse">Hold the mouse button</span><span class="only-touch">Tap <b>Grip</b></span> to close the fingers. Both maps light up where the pads touch the fruit; a firmer squeeze reads brighter.`,
      show: [{ name: "close", once: true }],
    },
    {
      title: "Lift",
      text: `<span class="only-mouse">Keep holding and move the mouse up.</span><span class="only-touch">Keep them closed and drag up.</span> If the squeeze is enough, the strawberry comes along. The bar shows the squeeze it needs.`,
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
  // (questions 4-6 came from "Grasp with your mouse" with their saved answers, src/state/store.ts migrateIds)
  quiz: [
    {
      q: "Why do the pad's tails wrap round to the finger's back?",
      choices: ["To make the pad more sensitive", "So the gold contacts and cables stay away from what the finger grips", "Because the tape only sticks there", "To keep the pad warm"],
      answer: 1,
      why: "On the back, the gold contacts, extenders and cables are out of the way: only the flat pad meets the object.",
    },
    {
      q: "A two-finger gripper with one pad per finger, wired as in this lesson. How many USB cables go to the computer?",
      choices: ["1", "2", "4", "384"],
      answer: 1,
      why: "One reading board per finger, and each board has its own USB cable: two in all, so the computer sees two serial ports.",
    },
    {
      q: "Why do the flat cables need a loop of slack?",
      choices: ["So the fingers can open and close all the way without pulling on them", "To make the signal stronger", "Because shorter cables cannot carry 32 lines", "To cool the board"],
      answer: 0,
      why: "The fingers slide in and out; the boards stay by the motor. The loop takes up the change in distance, so nothing is ever pulled tight.",
    },
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
