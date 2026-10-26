// Lesson 3: the shapes cut into the FPCs: electrodes, slots, the supporting beam and the stiffeners.
import { COL_Y } from "@shared/data/constants.mjs";
import { bridge } from "@shared/data/fpc_top.json";
import { fact, getFact, num } from "../../content/facts";
import type { Lesson } from "../../types";

const W = num("fpc_top.electrodes.width");
const PITCH = num("fpc_top.electrodes.pitch");
const N_TOP = num("fpc_top.electrodes.count");
const N_BOT = num("fpc_bot.electrodes.count");
const L_TOP = num("fpc_top.electrodes.length");
const L_BOT = num("fpc_bot.electrodes.length");
const SLOT_TOP = getFact("fpc_top.slots.size").value as number[]; // [w, l]
const SLOT_BOT = getFact("fpc_bot.slots.size").value as number[];
const NS_TOP = num("fpc_top.slots.count");
const NS_BOT = num("fpc_bot.slots.count");
const SLOT = SLOT_TOP[0];
const BEAM = num("fpc_top.bridge.width");
const STIFF = getFact("fpc_top.stiffeners").value as number[]; // [thin, thick]
const FING = getFact("fpc_top.fingers.size").value as number[];
const FING_PITCH = num("fpc_top.fingers.pitch");

const r2 = (v: number) => +v.toFixed(2);
const GAP = r2(PITCH - W); // gap between two copper strips
const LAND = r2((GAP - SLOT) / 2); // film left on each side of the copper
const COPPER_SHARE = Math.round(((W * W) / (PITCH * PITCH)) * 100); // copper overlap / cell area, %
const r3 = (v: number) => +v.toFixed(3);
const BEAM_Y0 = r3(bridge.y0);
const BEAM_Y1 = r3(bridge.y1);

export const lesson: Lesson = {
  id: "electrodes-slots-beam",
  n: 3,
  title: "Electrodes, slots and the supporting beam",
  kicker: "The pad",
  lede: "Thin copper lines, long cuts between them and one uncut strip across the middle: the shapes that let the pad bend, and make each crossing feel a press.",
  status: "ready",
  features: [
    { icon: "grid", title: `${W} mm lines`, text: `At ${PITCH.toFixed(1)} mm pitch on both sheets` },
    { icon: "beam", title: `${SLOT.toFixed(1)} mm slots`, text: "Let each line bend on its own and focus the press" },
    { icon: "ruler", title: `${r2(BEAM)} mm beam`, text: "The uncut strip that holds the Top FPC in shape" },
  ],
  figure: {
    fig: "pad",
    initial: [{ name: "plan" }],
    reset: [{ name: "release" }, { name: "deselect" }, { name: "plan" }],
    split: 0.55,
  },
  widget: "layer-inspector",
  overview: `
<p>An <dfn>electrode</dfn> is a conductor that touches the material you want to measure. On FlexiTac the electrodes
are copper strips printed right on the FPCs and left bare, so they press straight onto the Velostat. (FlexiTac's
earlier version used conductive threads lined up by hand; printing the electrodes removes that fiddly step.)</p>
<p><b>Thin lines, wide spacing.</b> Every electrode is <b>${W} mm</b> wide, and neighbouring lines sit
<b>${PITCH.toFixed(1)} mm</b> apart, centre to centre. That spacing is called the <dfn>pitch</dfn>. The Top FPC has
${N_TOP} lines, ${L_TOP} mm long, running the long way; the Bottom FPC has ${N_BOT} lines, ${L_BOT} mm long, running
across. Where two cross, the copper overlaps in a ${W} × ${W} mm square: that is one taxel. Only about
${COPPER_SHARE}% of each ${PITCH} × ${PITCH} mm cell is copper overlap; the pitch, not the copper, sets how finely
the pad can tell two touches apart.</p>
<p><b>Slots.</b> Between neighbouring lines, a <dfn title="a long, narrow cut right through the FPC">slot</dfn> is
cut right through the film: <b>${SLOT.toFixed(1)} mm</b> wide (${NS_TOP} on the Top FPC, ${SLOT_TOP[1]} mm long;
${NS_BOT} on the Bottom FPC, ${SLOT_BOT[1]} mm long). The gap between two copper strips is ${PITCH} − ${W} = ${GAP} mm;
the slot takes ${SLOT} mm of it, leaving a ${LAND} mm rim of film on each side of the copper. Each sheet becomes a
comb of narrow strips.</p>
<p>The paper gives the slots two jobs:</p>
<ul>
  <li><b>Bending.</b> They raise the sheet's <dfn title="how easily something gives or bends under a force; the opposite of stiffness">compliance</dfn>,
  which means how easily it gives way when pushed or bent (the opposite of stiffness). Each strip can bend on its own, so the pad wraps around curved or soft fingers instead of creasing.</li>
  <li><b>Focusing the press.</b> They concentrate the deformation onto the Velostat. Pressure is force divided by
  area: a sharp pencil hurts more than a flat thumb with the same push. Pressing on narrow strips, rather than on one
  continuous sheet that spreads the push around, squeezes the Velostat at the crossing harder, so the sensor is more
  sensitive.</li>
</ul>
<p><b>The supporting beam.</b> Cut every gap of a ${L_TOP} mm sheet and you get long, floppy strips. So on the Top FPC
the slots stop short of the middle: two rows of ${SLOT_TOP[1]} mm slots leave one uncut strip,
<b>${r2(BEAM)} mm</b> wide, straight across the sheet. That is the
<dfn title="the uncut strip across the middle of the Top FPC that ties all the strips together">supporting beam</dfn>.
It ties all ${N_TOP} strips together and keeps the sheet from warping during assembly and use.</p>
<p class="aside">A note on the sources: the paper's text says the beam is there because the <i>bottom</i> FPC has
the longer traces. Its own Fig 3b and the Gerber files put the beam on the <b>Top</b> FPC, whose lines are the long
ones (${L_TOP} mm against ${L_BOT} mm). We follow the drawing and the files. The Bottom FPC's ${L_BOT} mm strips are
short enough to need no beam <span class="badge badge-inferred">inferred</span>.</p>
<p><b>Stiffeners.</b> Away from the sensing area, each FPC narrows into a tail ending in gold
<dfn title="gold-plated contact pads at the end of a flex tail that slide into a connector">fingers</dfn>:
${FING[0]} mm pads, ${FING_PITCH} mm apart, that push into the reading board's connectors. A floppy tail is hard to push
in and its contacts don't sit flat, so a <dfn title="an extra layer of film glued to the back of an FPC to make one area rigid">stiffener</dfn>
of polyimide is glued behind them: <b>${STIFF[1]} mm</b> under the fingers and <b>${STIFF[0]} mm</b> where the tail
leaves the sensing area. The paper says the stiffeners sit on the FPCs' "bottom layer", meaning the side without
copper, not the Bottom FPC. On the flipped Top FPC that side faces up. (The figure leaves the stiffeners out, to keep
the drawing simple.)</p>
<p class="aside">All of these sizes are read from the <dfn title="the standard manufacturing drawings of a circuit board, one file per layer">Gerber files</dfn>,
the drawings the FPC factory works from.</p>`,
  wiring: {
    intro: "Where each shape lives. Sizes are read from each FPC's Gerber files.",
    rows: [
      { from: `${N_TOP} electrodes · ${W} × ${L_TOP} mm`, to: "Top FPC, the long way", note: "The sense lines. Copper-down onto the Velostat.", badge: "inferred" },
      { from: `${N_BOT} electrodes · ${W} × ${L_BOT} mm`, to: "Bottom FPC, across", note: "The drive lines. Copper-up onto the Velostat." },
      { from: `${NS_TOP} slots · ${SLOT_TOP[0]} × ${SLOT_TOP[1]} mm`, to: "Top FPC, two rows", note: "One between every pair of sense lines, above and below the beam." },
      { from: `${NS_BOT} slots · ${SLOT_BOT[0]} × ${SLOT_BOT[1]} mm`, to: "Bottom FPC, one row", note: "One between every pair of drive lines." },
      { from: `Supporting beam · ${r2(BEAM)} mm`, to: "Top FPC, across the middle", note: "Uncut film that ties the strips together (paper Fig 3b, B)." },
      { from: `Stiffener · ${STIFF[1]} mm`, to: "Behind the gold fingers", note: "Makes the tail rigid enough to push into its connector." },
      { from: `Stiffener · ${STIFF[0]} mm`, to: "Where each tail leaves the pad", note: "Stops the tail from creasing at its root." },
    ],
    foot: "The stiffeners sit on the side of each FPC that has no copper (the figure leaves them out).",
  },
  code: {
    lang: "python",
    caption: "Python · one slice across the Top FPC",
    source: `PITCH = ${PITCH}    # mm, line to line   [Gerber]
WIDTH = ${W}    # mm of copper       [Gerber]
SLOT  = ${SLOT}    # mm cut between     [Gerber]
BEAM  = (${BEAM_Y0}, ${BEAM_Y1})  # uncut, mm

gap  = PITCH - WIDTH  # gap between copper
land = (gap - SLOT) / 2    # rim each side
print(f"gap {gap:.1f} mm, rim {land:.1f} mm")

y = {{y}}   # where to slice, mm from centre
if BEAM[0] <= y <= BEAM[1]:
    print("on the beam: no slots here")
else:
    print("slots cut through the film")`,
    params: [{ name: "y", label: "Slice position y (mm)", min: -32, max: 32, step: 0.25, value: 1 }],
    notes: [
      `Between two copper strips there is ${PITCH} − ${W} = ${GAP} mm of film. The slot removes ${SLOT} mm, leaving a ${LAND} mm rim on each side.`,
      `<code>y</code> is how far from the pad's centre you slice, along its ${L_TOP} mm length. The beam spans y = ${BEAM_Y0} to ${BEAM_Y1} mm.`,
      "Press <b>Run</b>: the inspector redraws the slice at <code>y</code>. Try <code>0</code> (the beam), <code>1</code> (along a drive line) and <code>2</code> (between two drive lines).",
      "If the slice runs along a drive line's copper, the figure lights that drive line.",
    ],
    run(p, ctx) {
      const y = Math.max(-32, Math.min(32, p.y));
      const onBeam = y >= BEAM_Y0 && y <= BEAM_Y1;
      const near = COL_Y.reduce((best, cy, i) => (Math.abs(cy - y) < Math.abs(COL_Y[best] - y) ? i : best), 0);
      const onCopper = Math.abs(COL_Y[near] - y) <= W / 2;
      if (ctx.figure) {
        ctx.figure.act("plan");
        if (onCopper) ctx.figure.act("touch", { r: 5, c: near });
        else ctx.figure.act("release");
      }
      return [
        `gap ${GAP} mm, rim ${LAND} mm`,
        onBeam ? `y = ${y}: on the beam, no slots in the Top FPC` : `y = ${y}: slots cut through the Top FPC`,
        onCopper ? `the slice runs along drive line ${near + 1} (j = ${near})` : "the slice runs between drive lines",
      ];
    },
  },
  specs: [
    fact("fpc_top.electrodes.width", "Electrode width", { note: "Both FPCs" }),
    fact("fpc_top.electrodes.pitch", "Pitch", { note: "Centre to centre, both FPCs" }),
    fact("fpc_top.electrodes.length", "Sense line length", { note: `${N_TOP} on the Top FPC` }),
    fact("fpc_bot.electrodes.length", "Drive line length", { note: `${N_BOT} on the Bottom FPC` }),
    fact("pad.crossing", "One crossing", { note: "Copper overlap of one taxel" }),
    fact("fpc_top.slots.size", "Top FPC slots", { note: `${NS_TOP}, in two rows` }),
    fact("fpc_bot.slots.size", "Bottom FPC slots", { note: `${NS_BOT}, in one row` }),
    fact("fpc_top.bridge.width", "Supporting beam", { note: "Uncut strip across the Top FPC (paper Fig 3b)" }),
    fact("fpc_top.stiffeners", "Stiffeners", { value: (v: number[]) => `${v[0]} and ${v[1]} mm`, note: `${STIFF[1]} mm behind the fingers; on the non-copper side` }),
    fact("fpc_top.fingers.size", "Gold fingers", { note: `${FING_PITCH} mm pitch, into the board's connectors` }),
  ],
  steps: [
    {
      title: "Look from above",
      text: `${N_TOP} sense lines run the long way and ${N_BOT} drive lines run across, ${PITCH.toFixed(1)} mm apart. The uncut strip across the middle, where the slots stop, is the supporting beam.`,
      act: [{ name: "release" }, { name: "plan" }],
    },
    {
      title: "One crossing",
      text: `Where one ${W} mm sense line crosses one ${W} mm drive line, the copper overlaps in a ${W} × ${W} mm square: one taxel.`,
      act: [{ name: "plan" }, { name: "touch", arg: { r: 5, c: 16 } }],
    },
    {
      title: "Slots and the beam",
      text: `The Top FPC alone: a slot between every pair of lines, in two rows, with the ${r2(BEAM)} mm beam left uncut between them. The slots are cut right through, so you can see the layer below. In the inspector, try <b>Through the beam</b>.`,
      act: [{ name: "release" }, { name: "select", arg: "fpc_t" }],
    },
    {
      title: "Stiff where it plugs in",
      text: "Guide step 4: the gold fingers (glowing in the figure) push into the reading board's connectors. Polyimide stiffeners glued behind them (not drawn) keep the tails flat and firm.",
      act: { name: "step", arg: 4 },
    },
  ],
  quiz: [
    {
      q: `The electrodes are ${W} mm wide at ${PITCH.toFixed(1)} mm pitch. How wide is the gap between two neighbouring copper strips?`,
      choices: [`${W} mm`, `${GAP} mm`, `${PITCH} mm`, `${r2(PITCH + W)} mm`],
      answer: 1,
      why: `Pitch is centre to centre, so subtract one strip width: ${PITCH} − ${W} = ${GAP} mm. The ${SLOT} mm slot is cut into that gap, leaving a ${LAND} mm rim of film on each side.`,
    },
    {
      q: "Why do the slots make the sensor more sensitive?",
      choices: [
        "They let air cool the Velostat",
        "They concentrate the deformation onto the Velostat, so a press squeezes it harder",
        "They add more copper",
        "They make the pad thicker",
      ],
      answer: 1,
      why: "Narrow strips can't spread a push sideways the way a continuous sheet does, so the force lands on a smaller area of Velostat: more pressure, a bigger change in resistance.",
    },
    {
      q: "Where is the supporting beam?",
      choices: ["Under the gold fingers", "Across the middle of the Top FPC, where its slots stop", "Along the edge of the Bottom FPC", "Inside the Velostat"],
      answer: 1,
      why: `The Top FPC's slots come in two rows that stop short of the middle, leaving a ${r2(BEAM)} mm uncut strip that ties all ${N_TOP} long strips together.`,
    },
    {
      q: "What is a stiffener for?",
      choices: ["Sensing pressure", "Making the tail with the gold fingers rigid enough to plug in", "Joining the two FPCs", "Sealing the edges"],
      answer: 1,
      why: `A ${STIFF[1]} mm polyimide layer behind the fingers keeps the tail flat and firm, so it pushes into the connector and every contact touches.`,
    },
  ],
};
