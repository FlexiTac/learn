// Lesson 1.5, "Put it together" (2026-11-16, user: an assembly game after Lesson 1.4: laminate each FPC, Velostat on the
// bottom part, the top part over it, the connectors onto the tails, two flat cables to the reading board, the Nano onto
// the board; the polyimide seal left out for now; a Hint when the learner does not know what comes next). The stage is
// src/widgets/assemble-bench.ts, a 3D bench like Lesson 2.2's: every part waits on the mat and is dragged into place,
// the rules (src/widgets/assemble/engine.ts) refuse what cannot go together and say why, and the Hint shows the next
// single move. The FPCs are drawn from their Gerbers, the board from board.json; sizes the materials do not give (the
// sheets, the extenders, the cables' length) are illustrative.
// Same day (user): no steps (a step that only turned the view did nothing); the bench's progress bar shows the order
// (top part and bottom part, then Velostat, sandwich, extenders, FFCs, the board, the Nano) and the camera follows it.
// The "connectors" on the tails are called extenders, as in the guide's BOM. 1.5 and 1.6 are one chapter.
import { COLS, ROWS } from "@shared/data/constants.mjs";
import type { Lesson } from "../types";

const TAXELS = ROWS * COLS;
const GUIDE = "FlexiTac hardware guide (BOM, build photos)";
const BOARD = "board.json (the reading board's Gerber and pick-and-place files)";

export const lesson: Lesson = {
  id: "put-it-together",
  n: 5,
  title: "Put it together",
  kicker: "From parts to robot",
  lede: `Every part of one FlexiTac waits on the bench. Drag them together in the order the bar under the bench shows, from two bare FPCs to a pad cabled to its reading board, and use the Hint when you are not sure what comes next.`,
  status: "ready",
  features: [
    { icon: "layers", title: "Build the pad", text: "Sheets, FPCs and Velostat, in the order that makes it sense" },
    { icon: "cable", title: "Cable it up", text: "The right extender on each tail, the right cable to each socket" },
    { icon: "chip", title: "Finish the board", text: "The Nano goes in last, and the Hint is there if you get stuck" },
  ],
  widget: "assemble-bench",
  overview: `
<p>Lesson 1.4 built a pad by hand from photos. Here you put one together yourself, part by part, on a bench in 3D: the
two FPCs, two lamination sheets, a square of Velostat, two extenders, two flat cables, the reading board and its
Arduino Nano. Each move is one you would make at a real desk, in the same order. The bar under the bench shows that
order, and the view moves on to each part of the bench as you get to it.</p>
<p>First each FPC goes onto a lamination sheet, copper side up. The sheet is clear film, sticky on one side, and it gives
the thin circuit a flat, stiff back. The top FPC carries the ${ROWS} sense lines and the bottom FPC the ${COLS} drive
lines, so the two laminated pieces are the top part and the bottom part.</p>
<p>The Velostat goes on the bottom part, over its electrodes. Then the top part turns face down onto it, so its copper
meets the Velostat and its lines cross the bottom part's at right angles. Every place where two lines cross is a touch
spot, ${TAXELS} in all, and that is the pad. Lesson 1.4 then seals the edges with polyimide tape so the layers cannot
slide; this bench leaves the tape out.</p>
<p>Each FPC ends in a tail of gold fingers. The bottom tail has ${COLS} and takes the 32-pin extender, a tiny board
with a socket on each side. The top tail has ${ROWS}, and its extender is the 16-pin one, with four positions left
empty. On the real pad both tails leave the same corner, so the top tail is lifted over the wide extender to reach its
own; the bench draws it that way.</p>
<p>A flat flexible cable (FFC) goes into the free side of each extender, and its other end into the reading board. The
16-pin cable carries the sense lines to
FPC1, which leads to the multiplexer. The 32-pin cable carries the drive lines to FPC2, which leads to the four shift
registers (Lessons 2.3 and 2.5 take those chips apart). Last, the Nano goes into the board's two rows of sockets, its
USB port toward you. Plug that into a computer and the board reads the whole pad, as in Lesson 1.3.</p>
<p>The bench will not let parts go together the wrong way. An extender that does not fit its tail, a cable in the wrong
socket or the top part closed before the Velostat is in are refused, with the reason. When you do not know what comes
next, the Hint shows the next single move, and its "Do this step" makes that one move for you. Once everything is in,
the Nano's power light comes on and the lesson counts as done.</p>`,
  specs: [
    { label: "Top FPC", value: `${ROWS} sense lines, ${ROWS} gold fingers`, src: "fpc_top.json (its Gerber files)" },
    { label: "Bottom FPC", value: `${COLS} drive lines, ${COLS} gold fingers`, src: "fpc_bot.json (its Gerber files)" },
    { label: "Sensing area", value: "24 × 64 mm", src: GUIDE, note: "Where the two grids of lines overlap" },
    { label: "Lamination sheets", value: "2, pre-cut, one per FPC", src: GUIDE, note: "Drawn here as 30 × 72 mm", badge: "illustrative" },
    { label: "Extenders", value: "16-pin and 32-pin, 0.5 mm pitch", src: GUIDE, note: "A socket on each side: the tail in one, the cable in the other" },
    { label: "Flat cables", value: "16-pin and 32-pin FFC, 0.5 mm pitch", src: GUIDE },
    { label: "Board sockets", value: "FPC1: 16 pins (sense lines) · FPC2: 32 pins (drive lines)", src: BOARD },
    { label: "Nano sockets", value: "Two rows of 15, 2.54 mm pitch", src: BOARD },
  ],
  quiz: [
    {
      q: "Which way does the top part go onto the Velostat?",
      choices: ["Copper side up, so its lines can be seen", "Face down, its copper lines on the Velostat", "Either way: the Velostat conducts through the film", "Standing on its edge"],
      answer: 1,
      why: "The electrodes have to touch the Velostat. The top part turns over so its copper meets it, and its lines cross the bottom part's at right angles.",
    },
    {
      q: `The bottom FPC's tail has ${COLS} gold fingers. Which extender does it take?`,
      choices: ["The 16-pin extender", "The 32-pin extender", "Either one", "None: it is soldered to the board"],
      answer: 1,
      why: `One finger per drive line, ${COLS} in all, so it needs all 32 pins. The top tail's ${ROWS} fingers fit the 16-pin extender.`,
    },
    {
      q: "Which board socket does the top FPC's cable go to?",
      choices: ["FPC1, the 16-pin socket that leads to the multiplexer", "FPC2, the 32-pin socket", "The Nano's USB port", "Either socket"],
      answer: 0,
      why: "The top FPC carries the sense lines. Its 16-pin cable goes to FPC1, wired to the multiplexer; the 32 drive lines go to FPC2 and the shift registers.",
    },
  ],
};
