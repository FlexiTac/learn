// Lesson 1.4's assembly game: the rules. What the learner has put together (Assembly), what a drop does (drop()), and
// the next single thing to do (next(), the Hint's). Plan millimetres throughout (./geometry.ts); no three.js here, so the
// rules can be read and tested on their own.
//
// The order is Lesson 1.3's: each FPC onto a lamination sheet; the Velostat onto the bottom part; the top part over it
// (it turns face down); an extender (a connector with a socket on each side) onto each tail; a flat cable into each
// extender, then its free end to the board's socket; the Nano into the board. A drop that cannot happen (a part on the wrong place, a step too early) changes nothing and says why.
import { BOARD, CABLE, nanoSeat, PAD_SPOT, PLUG, portOnBoard, SHEET, SNAP, SPOT, START, TAIL, type P2, type Socket } from "./geometry";

export type Sheet = "sheetA" | "sheetB";
export type Fpc = "top" | "bot";
export type Conn = "c16" | "c32";
export type Cable = "f16" | "f32";
export type Port = Conn | Socket;
export type Item = Sheet | Fpc | "velo" | Conn | "nano";
/** A cable's end: in a port, or lying on the mat. */
export type End = { to: Port } | { at: P2 };
export interface Assembly {
  /** where each loose thing lies: a sheet's or an FPC's block centre, the Velostat's and a connector's centre, the
   *  Nano's outline centre */
  pos: Record<Item, P2>;
  /** the sheet each FPC is pressed onto */
  lam: Record<Fpc, Sheet | null>;
  /** the Velostat lies on the bottom part */
  velo: boolean;
  /** the top part is closed over it: the pad */
  closed: boolean;
  /** a connector on its tail (c32 on the bottom FPC's, c16 on the top FPC's) */
  plugged: Record<Conn, boolean>;
  cable: Record<Cable, { a: End; b: End }>;
  /** the Nano in the board's sockets */
  nano: boolean;
}
/** What the pointer took hold of. */
export type Grab = { kind: "item"; id: Item } | { kind: "cable"; id: Cable } | { kind: "end"; id: Cable; end: "a" | "b" };

export const START_ASSEMBLY = (): Assembly => ({
  pos: { sheetA: [...START.sheetA], sheetB: [...START.sheetB], top: [...START.top], bot: [...START.bot], velo: [...START.velo], c16: [...START.c16], c32: [...START.c32], nano: [...START.nano] },
  lam: { top: null, bot: null },
  velo: false,
  closed: false,
  plugged: { c16: false, c32: false },
  cable: { f16: { a: { at: [...START.f16.a] }, b: { at: [...START.f16.b] } }, f32: { a: { at: [...START.f32.a] }, b: { at: [...START.f32.b] } } },
  nano: false,
});
export const clone = (a: Assembly): Assembly => JSON.parse(JSON.stringify(a)) as Assembly;

// ------------------------------------------------------------------ where things are
const add = (p: P2, d: P2): P2 => [p[0] + d[0], p[1] + d[1]];
const dist = (p: P2, q: P2) => Math.hypot(p[0] - q[0], p[1] - q[1]);
/** The sheet with nothing on it yet. */
const sheetOf = (a: Assembly, s: Sheet): Fpc | null => (a.lam.top === s ? "top" : a.lam.bot === s ? "bot" : null);
/** Where an FPC's block centre is (on its sheet, or loose). */
export const fpcAt = (a: Assembly, f: Fpc): P2 => {
  if (f === "top" && a.closed) return fpcAt(a, "bot");
  const s = a.lam[f];
  return s ? a.pos[s] : a.pos[f];
};
/** The pad's centre (the bottom part's), once closed. */
export const padAt = (a: Assembly): P2 => fpcAt(a, "bot");
/** Where a tail's gold fingers are now. */
export const tailAt = (a: Assembly, f: Fpc): P2 => add(fpcAt(a, f), f === "bot" ? TAIL.bot.at : a.closed ? TAIL.topPad.at : TAIL.topUp.at);
/** A connector's centre (on its tail, or loose). */
export const connAt = (a: Assembly, c: Conn): P2 => (a.plugged[c] ? add(padAt(a), PLUG[c].at) : a.pos[c]);
/** A port's mouth: the connector's cable side (toward the viewer), or a board socket's. */
export const portAt = (a: Assembly, p: Port): P2 => (p === "c16" || p === "c32" ? add(connAt(a, p), [0, 6.2]) : portOnBoard(p));
export const nanoAt = (a: Assembly): P2 => (a.nano ? nanoSeat() : a.pos.nano);
/** Which cable fits a port. */
export const fits = (c: Cable, p: Port) => (c === "f16") === (p === "c16" || p === "fpc1");
/** The cable already in a port. */
const inPort = (a: Assembly, p: Port): Cable | null => (["f16", "f32"] as Cable[]).find((c) => ["a", "b"].some((e) => (a.cable[c][e as "a" | "b"] as { to?: Port }).to === p)) ?? null;
/** A cable's ends as plan points. */
export const endAt = (a: Assembly, c: Cable, e: "a" | "b"): P2 => {
  const x = a.cable[c][e];
  return "to" in x ? portAt(a, x.to) : x.at;
};
const freeEnd = (a: Assembly, c: Cable): "a" | "b" | null => ("at" in a.cable[c].a ? "a" : "at" in a.cable[c].b ? "b" : null);

/** What moves together when a thing is taken: a laminated part (its sheet, the Velostat on it), the whole pad (its
 *  connectors and the cable ends in them), a loose thing alone. The Nano in the board stays. */
export function unitOf(a: Assembly, g: Grab): { key: Item | Cable; anchor: P2 } | null {
  if (g.kind !== "item") {
    const c = a.cable[g.id];
    if (g.kind === "end") return "at" in c[g.end] ? { key: g.id, anchor: endAt(a, g.id, g.end) } : null;
    return "at" in c.a && "at" in c.b ? { key: g.id, anchor: endAt(a, g.id, "a") } : null;
  }
  const id = g.id;
  if (id === "nano") return a.nano ? null : { key: "nano", anchor: a.pos.nano };
  if (id === "c16" || id === "c32") return a.plugged[id] ? unitOf(a, { kind: "item", id: "bot" }) : { key: id, anchor: a.pos[id] };
  if (id === "velo") return a.velo ? unitOf(a, { kind: "item", id: "bot" }) : { key: "velo", anchor: a.pos.velo };
  if (id === "sheetA" || id === "sheetB") {
    const f = sheetOf(a, id);
    return f ? unitOf(a, { kind: "item", id: f }) : { key: id, anchor: a.pos[id] };
  }
  // an FPC (or its part, or the pad)
  if (id === "top" && a.closed) return unitOf(a, { kind: "item", id: "bot" });
  return { key: id, anchor: fpcAt(a, id) };
}

/** Move what was taken so its anchor lies at p (nothing joins). */
export function moveUnit(a: Assembly, g: Grab, p: P2): Assembly {
  const u = unitOf(a, g);
  if (!u) return a;
  const b = clone(a);
  const d: P2 = [p[0] - u.anchor[0], p[1] - u.anchor[1]];
  const shift = (q: P2): P2 => [q[0] + d[0], q[1] + d[1]];
  if (g.kind === "end") b.cable[g.id][g.end] = { at: shift(endAt(a, g.id, g.end)) };
  else if (g.kind === "cable") (["a", "b"] as const).forEach((e) => (b.cable[g.id][e] = { at: shift(endAt(a, g.id, e)) }));
  else if (u.key === "top" || u.key === "bot") {
    const s = a.lam[u.key as Fpc];
    if (s) b.pos[s] = shift(a.pos[s]);
    else b.pos[u.key as Fpc] = shift(a.pos[u.key as Fpc]);
    // (the pad's cable ends ride along: they are in its connectors)
  } else b.pos[u.key as Item] = shift(a.pos[u.key as Item]);
  return b;
}

/** The closed pad, moved to its place in front of the board (PAD_SPOT), with all it carries; null when it is not closed
 *  or is there already. The widget does this once, right after the sandwich closes. */
export function toBoard(a: Assembly): Assembly | null {
  if (!a.closed || dist(padAt(a), PAD_SPOT) < 0.5) return null;
  return moveUnit(a, { kind: "item", id: "bot" }, PAD_SPOT);
}

// ------------------------------------------------------------------ dropping
/** Why a drop did not join anything (the widget says it in words). */
export type Refusal =
  | "velo-top"
  | "velo-bare"
  | "close-novelo"
  | "close-bare"
  | "close-under"
  | "conn-open"
  | "conn-wrong16"
  | "conn-wrong32"
  | "port-loose"
  | "cable-wrong16"
  | "cable-wrong32"
  | "port-taken";
/** A drop's result: what joined (the new assembly), a refusal, or neither (it just lies where it was let go). */
export interface Drop {
  a: Assembly;
  joined: string | null;
  refused: Refusal | null;
  /** the place it would join, for the preview while held */
  at: P2 | null;
}

/** Let go of what was taken with its anchor at p; hand is the pointer's own point (a whole cable joins a port when it is
 *  let go over it, wherever it was held). */
export function drop(a0: Assembly, g: Grab, p: P2, hand: P2 = p): Drop {
  const moved = moveUnit(a0, g, p);
  const none = (refused: Refusal | null = null, at: P2 | null = null): Drop => ({ a: moved, joined: null, refused, at });
  const done = (a: Assembly, joined: string, at: P2): Drop => ({ a, joined, refused: null, at });
  const u = unitOf(a0, g);
  if (!u) return { a: a0, joined: null, refused: null, at: null };

  if (g.kind === "item") {
    const id = u.key as Item;
    // an FPC onto a sheet, or a sheet onto an FPC
    if ((id === "top" || id === "bot") && !a0.lam[id]) {
      for (const s of ["sheetA", "sheetB"] as Sheet[]) {
        if (sheetOf(a0, s) || dist(p, a0.pos[s]) > SNAP.big) continue;
        const b = clone(a0);
        b.lam[id] = s;
        return done(b, `lam-${id}`, a0.pos[s]);
      }
    }
    if ((id === "sheetA" || id === "sheetB") && !sheetOf(a0, id)) {
      for (const f of ["top", "bot"] as Fpc[]) {
        if (a0.lam[f] || dist(p, a0.pos[f]) > SNAP.big) continue;
        const b = clone(a0);
        b.lam[f] = id;
        b.pos[id] = [...a0.pos[f]];
        return done(b, `lam-${f}`, a0.pos[f]);
      }
    }
    // the Velostat onto the bottom part
    if (id === "velo") {
      if (dist(p, fpcAt(a0, "bot")) < SNAP.big) {
        if (!a0.lam.bot) return none("velo-bare", fpcAt(a0, "bot"));
        const b = clone(a0);
        b.velo = true;
        return done(b, "velo", fpcAt(a0, "bot"));
      }
      if (!a0.closed && dist(p, fpcAt(a0, "top")) < SNAP.big) return none("velo-top", fpcAt(a0, "top"));
    }
    // the top part over the bottom part
    if (id === "top" && !a0.closed && dist(p, fpcAt(a0, "bot")) < SNAP.big) {
      if (!a0.lam.top || !a0.lam.bot) return none("close-bare", fpcAt(a0, "bot"));
      if (!a0.velo) return none("close-novelo", fpcAt(a0, "bot"));
      const b = clone(a0);
      b.closed = true;
      return done(b, "close", fpcAt(a0, "bot"));
    }
    if (id === "bot" && !a0.closed && a0.lam.top && dist(p, fpcAt(a0, "top")) < SNAP.big) return none("close-under", fpcAt(a0, "top"));
    // a connector onto its tail
    if (id === "c16" || id === "c32") {
      // (the two tails end 11 mm apart: the nearer one counts)
      const near = (["bot", "top"] as Fpc[]).filter((f) => dist(p, tailAt(a0, f)) <= SNAP.small + 4).sort((f, h) => dist(p, tailAt(a0, f)) - dist(p, tailAt(a0, h)));
      for (const f of near.slice(0, 1)) {
        if (!a0.closed) return none("conn-open", tailAt(a0, f));
        const want: Conn = f === "bot" ? "c32" : "c16";
        if (id !== want) return none(id === "c16" ? "conn-wrong16" : "conn-wrong32", tailAt(a0, f));
        const b = clone(a0);
        b.plugged[id] = true;
        return done(b, `plug-${id}`, tailAt(a0, f));
      }
    }
    // the Nano into the board
    if (id === "nano" && dist(p, nanoSeat()) < SNAP.big) {
      const b = clone(a0);
      b.nano = true;
      return done(b, "nano", nanoSeat());
    }
    return none();
  }

  // a cable: the whole of it (the end nearest the port goes in), or its free end
  const c = g.id;
  const ports: Port[] = ["c32", "c16", "fpc2", "fpc1"];
  const endsMoved: ("a" | "b")[] = g.kind === "end" ? [g.end] : ["a", "b"];
  // (the nearest port within reach: the two connectors' ports are 11 mm apart)
  const near = g.kind === "end" ? endAt(moved, c, g.end) : hand;
  const inReach = ports.filter((q) => dist(near, portAt(a0, q)) <= SNAP.small + 4).sort((q, r) => dist(near, portAt(a0, q)) - dist(near, portAt(a0, r)));
  for (const port of inReach.slice(0, 1)) {
    const at = portAt(a0, port);
    const e = g.kind === "end" ? g.end : endsMoved.reduce((best, k) => (dist(endAt(moved, c, k), at) < dist(endAt(moved, c, best), at) ? k : best));
    if ((port === "c16" || port === "c32") && !a0.plugged[port]) return none("port-loose", at);
    if (!fits(c, port)) return none(c === "f16" ? "cable-wrong16" : "cable-wrong32", at);
    if (inPort(a0, port)) return none("port-taken", at);
    const b = clone(moved);
    b.cable[c][e] = { to: port };
    // a whole cable: its other end lies out straight from the port, along the way it leaves it
    if (g.kind === "cable") {
      const o = e === "a" ? "b" : "a";
      const dir = port === "fpc1" || port === "fpc2" ? -1 : 1;
      b.cable[c][o] = { at: [at[0], at[1] + dir * CABLE.len] };
    }
    return done(b, `cable-${c}-${port}`, at);
  }
  return none();
}

// ------------------------------------------------------------------ progress and the next step
/** One thing done. A cable counts twice: in its extender (ffc-), then at the board (board-). */
export type Goal = "lam-top" | "lam-bot" | "velo" | "close" | "plug-c32" | "plug-c16" | "ffc-f32" | "ffc-f16" | "board-f32" | "board-f16" | "nano";
export const GOALS: Goal[] = ["lam-top", "lam-bot", "velo", "close", "plug-c32", "plug-c16", "ffc-f32", "ffc-f16", "board-f32", "board-f16", "nano"];
const CABLE_PORTS: Record<Cable, { conn: Conn; sock: Socket }> = { f32: { conn: "c32", sock: "fpc2" }, f16: { conn: "c16", sock: "fpc1" } };
/** A cable has an end in this port. */
const cableIn = (a: Assembly, c: Cable, p: Port) => (["a", "b"] as const).some((e) => (a.cable[c][e] as { to?: Port }).to === p);
export function met(a: Assembly, g: Goal): boolean {
  switch (g) {
    case "lam-top":
      return Boolean(a.lam.top);
    case "lam-bot":
      return Boolean(a.lam.bot);
    case "velo":
      return a.velo;
    case "close":
      return a.closed;
    case "plug-c32":
      return a.plugged.c32;
    case "plug-c16":
      return a.plugged.c16;
    case "ffc-f32":
    case "ffc-f16": {
      const c = g === "ffc-f32" ? "f32" : "f16";
      return cableIn(a, c, CABLE_PORTS[c].conn);
    }
    case "board-f32":
    case "board-f16": {
      const c = g === "board-f32" ? "f32" : "f16";
      return cableIn(a, c, CABLE_PORTS[c].sock);
    }
    case "nano":
      return a.nano;
  }
}
export const allDone = (a: Assembly) => GOALS.every((g) => met(a, g));

/** The progress bar under the bench, in order: the top and the bottom part side by side (either first), then one stop
 *  after another. Each stop is done when all its goals are. */
export const STAGES = {
  top: ["lam-top"],
  bot: ["lam-bot"],
  velo: ["velo"],
  sandwich: ["close"],
  extender: ["plug-c32", "plug-c16"],
  ffc: ["ffc-f32", "ffc-f16"],
  board: ["board-f32", "board-f16"],
  nano: ["nano"],
} as const satisfies Record<string, readonly Goal[]>;
export type Stage = keyof typeof STAGES;
export const STAGE_ORDER = Object.keys(STAGES) as Stage[];
export const stageDone = (a: Assembly, s: Stage) => (STAGES[s] as readonly Goal[]).every((g) => met(a, g));
/** The stops to do now: the first not done (both parts, while either is not). Empty when everything is put together. */
export function stagesNow(a: Assembly): Stage[] {
  const parts = (["top", "bot"] as const).filter((s) => !stageDone(a, s));
  if (parts.length) return parts;
  const s = STAGE_ORDER.find((k) => !stageDone(a, k));
  return s ? [s] : [];
}

/** The Hint: the next single move, as a grab and the point to let go at (and what it is for). */
export interface Move {
  goal: Goal;
  grab: Grab;
  to: P2;
  /** the port or place it goes (for the marks) */
  target: "sheetA" | "sheetB" | "bot" | "tail-bot" | "tail-top" | Port | "nano";
}
export function next(a: Assembly): Move | null {
  const freeSheet = (prefer: Sheet): Sheet => (!sheetOf(a, prefer) ? prefer : prefer === "sheetA" ? "sheetB" : "sheetA");
  // (the Hint lays the bottom FPC on the near sheet, nearest the board, and the top FPC on the far one)
  if (!a.lam.bot) {
    const s = freeSheet("sheetA");
    return { goal: "lam-bot", grab: { kind: "item", id: "bot" }, to: a.pos[s], target: s };
  }
  if (!a.lam.top) {
    const s = freeSheet("sheetB");
    return { goal: "lam-top", grab: { kind: "item", id: "top" }, to: a.pos[s], target: s };
  }
  if (!a.velo) return { goal: "velo", grab: { kind: "item", id: "velo" }, to: fpcAt(a, "bot"), target: "bot" };
  if (!a.closed) return { goal: "close", grab: { kind: "item", id: "top" }, to: fpcAt(a, "bot"), target: "bot" };
  if (!a.plugged.c32) return { goal: "plug-c32", grab: { kind: "item", id: "c32" }, to: tailAt(a, "bot"), target: "tail-bot" };
  if (!a.plugged.c16) return { goal: "plug-c16", grab: { kind: "item", id: "c16" }, to: tailAt(a, "top"), target: "tail-top" };
  // each cable into its extender, then each to the board (a cable in a wrong port cannot happen: the rules refuse it)
  for (const step of ["ffc", "board"] as const)
    for (const c of ["f32", "f16"] as Cable[]) {
      const goal = `${step}-${c}` as Goal;
      if (met(a, goal)) continue;
      const port: Port = step === "ffc" ? CABLE_PORTS[c].conn : CABLE_PORTS[c].sock;
      const ends = a.cable[c];
      if ("at" in ends.a && "at" in ends.b) return { goal, grab: { kind: "cable", id: c }, to: portAt(a, port), target: port };
      const fe = freeEnd(a, c);
      if (fe) return { goal, grab: { kind: "end", id: c, end: fe }, to: portAt(a, port), target: port };
    }
  if (!a.nano) return { goal: "nano", grab: { kind: "item", id: "nano" }, to: nanoSeat(), target: "nano" };
  return null;
}

/** Where a whole cable's anchor (end a) must be let go so its end `e` lands on p. */
export function cableAnchorFor(a: Assembly, c: Cable, e: "a" | "b", p: P2): P2 {
  if (e === "a") return p;
  const pa = endAt(a, c, "a");
  const pb = endAt(a, c, "b");
  return [p[0] - (pb[0] - pa[0]), p[1] - (pb[1] - pa[1])];
}

/** Sanity limits the widget uses: the board is fixed, the sheets start in the work area. */
export const FIXED = { board: BOARD, spots: SPOT, sheet: SHEET };
