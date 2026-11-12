// The pressed FSR of Lesson 2.3's drawings (./mux.ts, ./together.ts) and its Specs row (src/lessons/08-two-chips.ts), from
// Lesson 2.1's model (../bench/fsr.ts, Adafruit's table for an Interlink FSR 402), so the lessons read the same sensor the
// same way: a light press, 1 N, is 6 kΩ (R_LIGHT, a row of that table and of Lesson 2.1's Specs). Illustrative.
// (A module of its own, so the lesson file can read it without pulling the drawing into the lessons' bundle.)
import { FSR_TABLE_SRC, R_LIGHT } from "../bench/fsr";

/** How hard a pressed FSR is pressed (N): R_LIGHT's press. */
export const PRESS_N = 1;
/** Its resistance (Ω). */
export const R_PRESSED = R_LIGHT;
export const FSR_SRC = FSR_TABLE_SRC;
