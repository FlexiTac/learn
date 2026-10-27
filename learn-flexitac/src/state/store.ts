import type { StepsChange } from "../types";

// Everything the site remembers lives under one localStorage key. Every access is wrapped: storage can be
// missing or throw (private windows, blocked site data), and the site must work without it.

export interface Saved {
  /** Lesson ids that count as done (quiz passed or every guided step completed). */
  done: string[];
  /** Highest guided step reached, per lesson id (1-based count of completed steps). */
  steps: Record<string, number>;
  /** Last answer index per question, per lesson id. */
  quiz: Record<string, (number | null)[]>;
  /** Edited code params per lesson id. */
  params: Record<string, Record<string, number>>;
  /** Explicit theme choice; absent = follow the system. */
  theme?: "light" | "dark";
  /** The learner's language (src/i18n/lang.ts); absent = English, the default. */
  lang?: "en" | "zh";
  /** Right-panel tab per lesson id. */
  tab?: Record<string, string>;
  /** Per lesson id: how many of the lesson's `stepsAdded` changes its saved `steps` count already accounts for
   *  (absent = saved before any of them; see migrateSteps). */
  stepsRev?: Record<string, number>;
  /** Per lesson id: how many of the lesson's `quizDropped` removals its saved `quiz` answers already account for (absent
   *  = saved before any of them; see migrateQuiz). */
  quizRev?: Record<string, number>;
  /** How many of the lesson id moves (MERGED, migrateIds) this record already accounts for (absent = none). */
  idsRev?: number;
  last?: string;
}

/** Lesson ids that are no longer in the course, old -> where an old #/lesson/<id> link now leads (src/main.ts shows
 *  that lesson under its own address).
 *  2026-10-24, Section 1 became six lessons:
 *  - "Driving 32 lines with 2 pins" and "Listening to 12 lines with one pin" were merged into "Pick one crossing";
 *  - "Flash the firmware" (and "Troubleshooting", its short-lived successor) became the last part of "Build your own";
 *  - "Electrodes, slots and the supporting beam" left the course; its nearest lesson is "The sandwich".
 *  2026-10-25: "Pick one crossing" became "Meet the reading board" (the board's parts, no scanning); its scanning went
 *  into "One frame". Its links, and the two it was made of, now lead to "Meet the reading board".
 *  Only MERGED lessons carry their progress over (migrateIds): a done flag for a lesson that left the course is ignored
 *  (every count filters on the lessons in the course), never deleted. */
export const MOVED: Record<string, string> = {
  "drive-32-lines": "meet-the-board",
  "listen-12-lines": "meet-the-board",
  "pick-one-crossing": "meet-the-board",
  "flash-firmware": "build-your-own",
  troubleshooting: "build-your-own",
  "electrodes-slots-beam": "the-sandwich",
  // 2026-10-25: set aside for now (Section 3 "Train with it" is coming soon)
  "make-sim-feel-real": "how-deep-how-hard",
  "real-sim-real": "why-simulate-touch",
};

/** Saved progress under lessons that were merged into another one moves there, once per revision (idsRev), in order.
 *  Nothing is deleted: the old entries stay, and every list counts only the lessons in the course.
 *  Revision 1 (2026-10-24): drive-32-lines + listen-12-lines -> pick-one-crossing (5 steps: Meet the board <- Meet the
 *  chain, Power one drive line <- Latch it, Walk the 1 <- Walk the 1, Listen to one sense line <- An empty channel, Both
 *  at once <- Watch it switch, counted as a prefix: a step counts only when every step before it does). Its quiz held
 *  drive-32-lines' questions 3 and 4, then listen-12-lines' 1 and 2, so their saved answers went along.
 *  Revision 2 (2026-10-25): pick-one-crossing -> meet-the-board (2 steps: The reading board, Two paths). Done stays
 *  done. Steps: having met the board (its step 1 lifted the Nano and named the chips) counts as step 1; all five counts
 *  as both. Quiz: its questions 1 and 2 (pins for 32 drive lines, which chip drives line 20) are meet-the-board's 1 and
 *  2; its 3 and 4 (a sense line's channel in binary, why add 4) are one-frame's 5 and 6, where the scanning went. */
const IDS_REV = 2;

const count = (s: Saved, id: string) => (typeof s.steps[id] === "number" && Number.isFinite(s.steps[id]) ? Math.floor(s.steps[id]) : 0);
const answer = (a: (number | null)[] | undefined, i: number) => (Array.isArray(a) && typeof a[i] === "number" ? a[i] : null);

function migrateIds(s: Saved): boolean {
  const have = s.idsRev ?? 0;
  if (have >= IDS_REV) return false;
  if (have < 1) {
    const pick = "pick-one-crossing";
    for (const from of ["drive-32-lines", "listen-12-lines"]) if (s.done.includes(from) && !s.done.includes(pick)) s.done.push(pick);
    if (!(pick in s.steps)) {
      const d = count(s, "drive-32-lines");
      const l = count(s, "listen-12-lines");
      let n = d >= 1 ? 1 : 0;
      if (n === 1 && d >= 3) n = 2;
      if (n === 2 && d >= 4) n = 3;
      if (n === 3 && l >= 3) n = 4;
      if (n === 4 && l >= 4) n = 5;
      if (n > 0) s.steps[pick] = n;
    }
    const dq = s.quiz["drive-32-lines"];
    const lq = s.quiz["listen-12-lines"];
    if (!s.quiz[pick] && (Array.isArray(dq) || Array.isArray(lq))) s.quiz[pick] = [answer(dq, 2), answer(dq, 3), answer(lq, 0), answer(lq, 1)];
    const tab = s.tab?.["drive-32-lines"] ?? s.tab?.["listen-12-lines"];
    if (tab && s.tab && !s.tab[pick]) s.tab[pick] = tab;
  }
  if (have < 2) {
    const from = "pick-one-crossing";
    const meet = "meet-the-board";
    if (s.done.includes(from) && !s.done.includes(meet)) s.done.push(meet);
    if (!(meet in s.steps)) {
      const n = count(s, from);
      if (n > 0) s.steps[meet] = n >= 5 ? 2 : 1;
    }
    const pq = s.quiz[from];
    if (Array.isArray(pq)) {
      if (!s.quiz[meet] && (answer(pq, 0) !== null || answer(pq, 1) !== null)) s.quiz[meet] = [answer(pq, 0), answer(pq, 1), null, null];
      // one-frame had 4 questions; the two that came from pick-one-crossing are its 5th and 6th (an answer already
      // there is kept)
      if (answer(pq, 2) !== null || answer(pq, 3) !== null) {
        const fq = Array.isArray(s.quiz["one-frame"]) ? [...s.quiz["one-frame"]] : [];
        while (fq.length < 6) fq.push(null);
        if (answer(fq, 4) === null) fq[4] = answer(pq, 2);
        if (answer(fq, 5) === null) fq[5] = answer(pq, 3);
        s.quiz["one-frame"] = fq;
      }
    }
    // (its saved tab: "code" has no tab in the new lesson, which then opens on its Overview)
    const tab = s.tab?.[from];
    if (tab && s.tab && !s.tab[meet]) s.tab[meet] = tab;
  }
  s.idsRev = IDS_REV;
  return true;
}

export const STORAGE_KEY = "learn-flexitac:v1";
const EMPTY: Saved = { done: [], steps: {}, quiz: {}, params: {} };

let cache: Saved | null = null;
const listeners = new Set<(s: Saved) => void>();

export function load(): Saved {
  if (cache) return cache;
  // (a fresh copy: JSON, not structuredClone, which iOS Safari has only from 15.4 and would stop the whole site)
  let s: Saved = JSON.parse(JSON.stringify(EMPTY)) as Saved;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Saved>;
      s = { ...s, ...parsed };
      if (!Array.isArray(s.done)) s.done = [];
      if (!s.steps || typeof s.steps !== "object") s.steps = {};
      if (!s.quiz || typeof s.quiz !== "object") s.quiz = {};
      if (!s.params || typeof s.params !== "object") s.params = {};
      // the retired "Labels" switch (figures now start without labels)
      delete (s as Saved & { labels?: unknown }).labels;
      // the last lesson opened may have left the course since (home's Resume button): its new place
      if (s.last && MOVED[s.last]) s.last = MOVED[s.last];
      // lessons merged since this was saved
      if (migrateIds(s)) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
        } catch {
          /* keep it in memory only */
        }
      }
    }
  } catch {
    /* storage unavailable: start fresh in memory */
  }
  cache = s;
  return s;
}

export function update(fn: (s: Saved) => void): Saved {
  const s = load();
  fn(s);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* keep it in memory only */
  }
  for (const l of listeners) l(s);
  return s;
}

export function subscribe(fn: (s: Saved) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** A lesson whose guided steps changed (Lesson.stepsAdded, in the order the changes were made): a number is the 0-based
 *  index a step was inserted at (a count saved before it, past that index, moves up by one, so old step k is new step
 *  k + 1); {keep: n} means only the first n steps stayed and the ones after were replaced (a count above n drops to n,
 *  so a step the learner never saw is never marked done); {merge: k} means steps k and k + 1 became one step k (a count
 *  past both drops by one; a count of k + 1, step k done but not k + 1, drops to k: the merged step counts only when
 *  both halves were done). Runs once per learner and lesson; a learner without saved steps is only stamped with the
 *  current revision. Never goes past `total`. */
export function migrateSteps(id: string, changes: StepsChange[] | undefined, total: number): void {
  const rev = changes?.length ?? 0;
  if (!rev) return;
  const s = load();
  const have = s.stepsRev?.[id] ?? 0;
  if (have >= rev) return;
  update((st) => {
    const n = st.steps[id];
    if (typeof n === "number" && Number.isFinite(n) && n > 0) {
      let k = Math.floor(n);
      for (const c of changes!.slice(have)) {
        if (typeof c === "number") {
          if (c < k) k += 1;
        } else if ("merge" in c) {
          const m = Math.max(0, Math.floor(c.merge));
          if (k >= m + 2) k -= 1;
          else if (k === m + 1) k = m;
        } else k = Math.min(k, Math.max(0, Math.floor(c.keep)));
      }
      st.steps[id] = Math.max(0, Math.min(total, k));
    }
    (st.stepsRev ??= {})[id] = rev;
  });
}

/** A lesson whose quiz lost questions (Lesson.quizDropped: the 0-based index each had when it was taken out, in order):
 *  the learner's saved answers drop the answer at each index, once per learner and lesson, so every later answer stays
 *  with its own question. A learner without saved answers is only stamped with the current revision. */
export function migrateQuiz(id: string, dropped: number[] | undefined): void {
  const rev = dropped?.length ?? 0;
  if (!rev) return;
  const have = load().quizRev?.[id] ?? 0;
  if (have >= rev) return;
  update((st) => {
    const a = st.quiz[id];
    if (Array.isArray(a)) {
      const next = [...a];
      for (const i of dropped!.slice(have)) if (Number.isInteger(i) && i >= 0 && i < next.length) next.splice(i, 1);
      st.quiz[id] = next;
    }
    (st.quizRev ??= {})[id] = rev;
  });
}

export function isDone(id: string): boolean {
  return load().done.includes(id);
}

export function markDone(id: string): boolean {
  if (isDone(id)) return false;
  update((s) => s.done.push(id));
  return true;
}

export function resetProgress(): void {
  update((s) => {
    s.done = [];
    s.steps = {};
    s.quiz = {};
    s.params = {};
    s.stepsRev = {};
    s.quizRev = {};
  });
}
