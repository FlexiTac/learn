// Lesson 2.1: put FlexiTac on a robot (PLAN-section2-3.md §1). The robot is already fitted with fin-shaped soft fingers
// (the UMI finger); the lesson shows how the pad goes on and how it is wired, never how to swap the stock gripper, and
// it says the same three moves (stick it on, plug the tails into an extender, cable to a reading board) work on other
// grippers. Mounting facts are the FlexiTac team's build (their photos, refs/s2s3-research/user-photos/, 2026-10-25).
// Step 1 is the robot (Lesson 1.1's robot grasp, src/widgets/robot-grasp.ts, over the stage); steps 2-5 are Fig 5
// (figures/gripper, figures/EMBED.md "Fig 5"): its step acts play each stage of the mounting.
import { COLS, FRAME_HZ, ROWS } from "@shared/data/constants.mjs";
import { fact, getFact } from "../content/facts";
import type { Lesson } from "../types";

const TAXELS = ROWS * COLS;
/** Source strings (src/content/sources.ts turns them into chips). */
const BUILD = "the FlexiTac team's build (photos, 2026-10-25)";
const REBOT = "reBot-DevArm B601-DM docs (Seeed Studio)";
const UMI = "UMI soft finger (UMI hardware guide, UMI_figure_tip.stl)";

export const lesson: Lesson = {
  id: "put-on-a-robot",
  n: 7,
  title: "Put FlexiTac on a robot",
  kicker: "Mount it",
  lede: `Two pads, two boards, two USB cables. How FlexiTac goes onto a gripper's fingers and how its touch gets to the computer.`,
  status: "ready",
  features: [
    { icon: "tape", title: "Tape it on", text: "Polyimide tape holds the pad on, round the fingertip to the back" },
    { icon: "cable", title: "Tails to the back", text: "Out of the pad's side, round the finger's side to its back" },
    { icon: "usb", title: "One board per finger", text: "Two boards, two USB cables, two touch maps" },
  ],
  figure: {
    fig: "gripper",
    // The lesson opens on step 1, the robot (a picture over the stage). Underneath, Fig 5 waits in the pose step 2 starts
    // from: the fingers bare (wrap false takes the pads, tape, tails, cables and USB off), so step 2 shows the pad going
    // on. reset (a dot or the restart button) does the same from any pose, also ending step 5's press mode.
    initial: [{ name: "wrap", arg: false }],
    reset: [{ name: "labels", arg: null }, { name: "feel", arg: false }, { name: "reset" }, { name: "wrap", arg: false }],
  },
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
<p class="aside">The mounting follows the FlexiTac team's own build (their photos). The robot is a reBot-DevArm with UMI
soft fingers. The finger holders and the board trays are drawn for this gripper: <span class="badge badge-proposed">proposed</span>,
one way to do it. The touch maps in step 5 are simulated (<span class="badge badge-illustrative">illustrative</span>).</p>`,
  parts: {
    intro: "What this lesson adds to a two-finger gripper (the pads and boards are the ones from Section 1).",
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
  ],
  steps: [
    {
      title: "A robot that can feel",
      // keep every text to 2-3 lines in a 475-530 px column (1366-1440 px windows)
      text: "This robot has a FlexiTac pad on each soft finger, right where the fingers touch what they grab. The same steps work on flat jaws and other grippers too.",
      // the robot grasp (Lesson 1.1's picture) over the stage; Fig 5 waits underneath with bare fingers (figure.initial)
      start: true,
      stage: "robot-grasp",
    },
    {
      title: "Wrap the pad on",
      text: "Lay the pad on the finger's flat gripping face. Strips of polyimide tape press it flat: over the pad, round the fingertip and onto the finger's back.",
      act: { name: "step", arg: 2 },
    },
    {
      title: "Tail to the back",
      text: "The tails come out of the pad's side. Fold them round the finger's side to its back, never past the tip, so the gold contacts sit behind the finger.",
      act: { name: "step", arg: 3 },
    },
    {
      title: "Extenders and cables",
      text: "Each tail plugs into a small FFC extender. Flat cables (about 15 cm) run on to that finger's board by the motor. Watch the loop of slack as the gripper opens and closes.",
      // Fig 5's step 4 also labels the near finger's FFC extender (its one label, Details ›) once the extenders seat,
      // and takes it away on the next step or a reset (figures/EMBED.md "Fig 5", step)
      act: { name: "step", arg: 4 },
    },
    {
      title: "Two boards, two USB",
      text: "Each board has its own USB cable, so the computer gets two touch maps: left and right. Click a finger to press its pad and watch its map light up.",
      // the USB cables plug in and the two maps appear; a click on a finger presses its pad (feel mode); Show me presses
      // the left finger, then the right (momentary: never replayed after a theme switch)
      act: [{ name: "step", arg: 5 }, { name: "feel", arg: true }],
      show: [
        { name: "press", arg: { finger: "left", amount: 1, hold: 1.4 }, at: 300, once: true },
        { name: "press", arg: { finger: "right", amount: 1, hold: 1.4 }, at: 2300, once: true },
      ],
    },
  ],
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
  ],
};
