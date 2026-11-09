// The reading board's factory order as the hardware guide shows it (material/FlexiTac Hardware Guide.docx, "Reading
// Board Manufacturing Guide" step 4, JLCPCB's quote in screenshot image5): 5 boards, the bare boards $2.00 and the
// assembly (PCBA) $38.41, $40.41 in all, before shipping (the board quote, image13, estimates DHL at $24.25); of the
// assembly, two fees are per order, not per board: setup $8.12 and the extended-components fee $12.16 (four of the five
// parts are JLCPCB "Extended" library parts, image2); build time: boards 24 hours, assembly 2-3 days; the guide:
// "expect a delivery time of approximately one week". Shared by lesson 2.3 (src/lessons/07-meet-the-board.ts) and its
// picture (src/widgets/pcb/order.ts), so the number is typed once.
export const ORDER = { boards: 5, pcb: 2.0, pcba: 38.41, setup: 8.12, extended: 12.16 } as const;
export const ORDER_SRC = "material/FlexiTac Hardware Guide.docx Reading Board Manufacturing Guide Step 4 (JLCPCB quote, screenshot image5)";
export const usd = (v: number): string => `$${v.toFixed(2)}`;
export const ORDER_TOTAL = ORDER.pcb + ORDER.pcba;
/** The hardware guide (the Google Doc the hardware repository's README links as its "Hardware Assembly Tutorial"):
 *  its "PCB Related Files" list links this board's schematic, Gerber zip, BOM and pick-and-place file. */
export const GUIDE_URL = "https://docs.google.com/document/d/1bvz6AL7BUkhj4Dj7n9DFXTjnGIX4-ziN8-smiCKpVZU/edit?usp=sharing";
