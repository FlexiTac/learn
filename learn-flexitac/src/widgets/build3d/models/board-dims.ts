// The half-size breadboard's numbers (mm), from flexitac-anatomy/figures/bench/bench-real/bench.js: 82.5 x 54.6 x 8.5,
// a 2.54 mm pitch, columns 1-30 centred, rows a-e and f-j either side of the centre channel.
export const BB = { W: 82.5, D: 54.6, H: 8.5, P: 2.54 };
/** Column k (1..30): its x. */
export const colX = (k: number) => (BB.W - 29 * BB.P) / 2 + (k - 1) * BB.P;
const ROWS = "abcdefghij";
/** Row 'a'..'j': its y from the board's top edge (a-e one half, f-j the other, the channel between e and f). */
export const rowY = (r: string) => {
  const i = ROWS.indexOf(r);
  return i < 5 ? 13.33 + i * BB.P : 31.11 + (i - 5) * BB.P;
};
