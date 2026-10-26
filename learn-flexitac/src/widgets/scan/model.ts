// Typed views of the shared firmware-scan model (@shared/models/scan.mjs) for the board widgets.
// scan.mjs is plain JS, so TypeScript infers its defaults (`opts = {}`, `input = null`) too narrowly; these
// casts give the documented shapes. Nothing here re-types a number: every value comes from @shared.
import { COLS, MUX_OFFSET } from "@shared/data/constants.mjs";
import * as scan from "@shared/models/scan.mjs";
import { VIRIDIS_RGB } from "@shared/models/viridis.mjs";

export type Phase = "header" | "enableHigh" | "enableLow" | "select" | "load" | "latch" | "read" | "advance";

/** One firmware micro-step, as snap() in scan.mjs returns it. */
export interface Step {
  seq: number;
  frame: number;
  phase: Phase;
  /** D3 clocks since the frame began. */
  clock: number;
  totalClocks: number;
  ser: number;
  eN: number;
  enabled: boolean;
  muxCh: number;
  selectBits: number[];
  senseLine: number | null;
  /** 0-based drive line that is HIGH, or -1. */
  driveLine: number;
  highCount: number;
  latchQ: number[];
  srQ: number[];
  row: number | null;
  col: number | null;
  byteIndex: number | null;
  byte: number | null;
  code: number | null;
  fw?: string;
}

export interface Variant {
  rows: number;
  cols: number;
  muxOffset: number;
  rowsPerMux: number;
  src?: string;
}

type Input = null | number[][] | ((row: number, col: number) => number);

export interface Scanner {
  variant: Variant;
  next(): Step;
  reset(): void;
  current: Step | null;
}

export const createScanner = scan.createScanner as unknown as (opts?: { variant?: string | Partial<Variant>; input?: Input }) => Scanner;
export const frameBytes = scan.frameBytes as unknown as (input?: Input, opts?: { variant?: string | Partial<Variant> }) => Uint8Array;
export const frameSize = scan.frameSize as unknown as (v?: Partial<Variant>) => number;
export const byteIndex = scan.byteIndex as (row: number, col: number) => number;
export const driveLineInfo = scan.driveLineInfo as (j: number) => { index: number; net: string; chip: string; q: string; fpc2Pin: number };
export const muxChannelInfo = scan.muxChannelInfo as unknown as (ch: number) => {
  ch: number;
  bits: number[];
  input: string;
  net: string;
  fpc1Pin: number;
  row: number | null;
  used: boolean;
};
export const DEFAULT_VARIANT = scan.DEFAULT as Variant;
export const VARIANTS = scan.VARIANTS as unknown as Record<string, Variant>;
export const STEPS_PER_FRAME: number = scan.frameTiming().steps;

/** D3 clocks in one sense line: shiftColumn(true), shiftColumn(false), then one per drive line. */
export const CLOCKS_PER_ROW = COLS + 2;
export const CLOCKED = new Set<Phase>(["load", "latch", "advance"]);

/** Which sense line (0-based) a channel carries on the default 12 x 32 build, or null. */
export const rowOfChannel = (ch: number): number | null => muxChannelInfo(ch).row;
export const channelOfRow = (row: number): number => row + MUX_OFFSET;

export const hex2 = (n: number): string => n.toString(16).toUpperCase().padStart(2, "0");
export const bits4 = (ch: number): string => (ch & 15).toString(2).padStart(4, "0");

/** The viewer's colour map (cv2.COLORMAP_VIRIDIS), 0..255 -> "rgb(...)". */
export function viridis(v: number): string {
  const [r, g, b] = (VIRIDIS_RGB as number[][])[Math.max(0, Math.min(255, Math.round(v)))];
  return `rgb(${r},${g},${b})`;
}
