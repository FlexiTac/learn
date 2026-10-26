// Guided steps under the stage. A step has a pose (`act`: played when the learner reaches the step) and may have a
// "Show me" (`show`: a scripted press, the pad taken apart) that plays once the step is in its pose.
//   button   "Show me"   the step is not reached yet (its pose, then its show) or it is reached and has a show left
//            "Next step" moves on: reaches the next step (plays its pose)
//            "Done"      the last step, shown
// Completing every step marks the lesson done. Jumping to step k (its dot) replays the poses of steps 1..k so the figure
// lands in the same pose no matter where you start; shows are never replayed.
// A first step marked `start` is the lesson's starting pose (lesson.figure.initial puts the figure there): the lesson
// always opens on it, already reached, and the restart button comes back to it (lesson 1: "On a robot"; lesson 2:
// "Squeeze the Velostat"; lesson 3: "The reading board"; lesson 4: "Plug in the pad").
// A lesson without one resumes where the learner left off, but a lesson whose steps were all done opens on step 1 again
// (2026-10-25, user: "I entered lesson 4 and it went straight to step 4"): coming back to a finished lesson starts it
// over, never on its last step with the figure still at its starting pose.
// The step text sits in a box as tall as the lesson's longest step text (hidden copies of every text share its grid
// cell) and the Show me / Next step / Done button keeps the width of its widest label, so moving between steps never
// changes the bar's height, and so never resizes or refits the figure above it.
// onStep(k, on) reports every time a step is reached (on = true, including the start step when the bar is built and on
// restart) and a restart onto a step that is not reached yet (on = false): the lesson view uses it for a step's demo
// card (src/ui/demo.ts).
// The words (each step's title and text, the button labels) are in the site's language: the bar's relabel() paints them
// again after a language switch and keeps everything else (the step on show, its pose, a Show me in progress).
import { loc, t } from "../i18n";
import type { FigAct, Lesson } from "../types";
import type { FigureHost } from "../figure/FigureHost";
import { load, markDone, migrateSteps, update } from "../state/store";
import { h } from "./dom";
import { icon } from "./icons";

const asList = (a: FigAct | FigAct[] | undefined): FigAct[] => (a ? (Array.isArray(a) ? a : [a]) : []);
const goLabels = () => ({
  show: `${icon("play")}<span>${t("steps.show")}</span>`,
  next: `<span>${t("steps.next")}</span>${icon("chevron")}`,
  done: `${icon("check")}<span>${t("steps.done")}</span>`,
});

/** The guided-steps bar; relabel() paints its words again in the site's language. */
export type StepsBar = HTMLElement & { relabel(): void };

/** The step a lesson opens on: its start step; else where the learner left off (after migrateSteps), or step 1 again
 *  once every step was done. */
export function openingStep(lesson: Lesson): number {
  const steps = lesson.steps ?? [];
  if (!steps.length) return 0;
  if (steps[0].start) return 0;
  migrateSteps(lesson.id, lesson.stepsAdded, steps.length);
  const n = Math.floor(Number(load().steps[lesson.id]) || 0);
  return n >= steps.length ? 0 : Math.max(0, n);
}

export function stepsBar(
  lesson: Lesson,
  figure: FigureHost | null,
  onComplete: () => void,
  onStep?: (k: number, on: boolean) => void,
): StepsBar {
  const steps = lesson.steps ?? [];
  /** The steps' words in the site's language (same steps, same order). */
  const words = () => loc(lesson).steps ?? steps;
  // progress saved before a step was inserted (Lesson.stepsAdded) is moved onto the same steps first
  migrateSteps(lesson.id, lesson.stepsAdded, steps.length);
  const el = h("section", { class: "steps", "aria-label": t("steps.aria") }) as StepsBar;
  const startStep = Boolean(steps[0]?.start);
  const hasShow = (k: number) => Boolean(steps[k]?.show?.length);
  // A start step: always open on it (the figure is in its pose). Otherwise resume where the learner left off (step 1
  // once every step was done).
  let i = openingStep(lesson);
  /** The current step's pose is on the figure. */
  let reachedNow = startStep;
  /** Its show has played (or it has none). */
  let shown = reachedNow && !hasShow(0);
  // Resuming mid-way: the first Show me replays the earlier steps too.
  let fresh = i > 0;

  el.innerHTML = `
    <div class="steps-dots" role="list" aria-label="${t("steps.dotsAria")}">
      ${words().map((s, k) => `<button type="button" role="listitem" class="step-dot" data-k="${k}" aria-label="${t("steps.dot", { k: k + 1, title: s.title })}"><span class="mono">${k + 1}</span></button>`).join("")}
    </div>
    <div class="steps-body" aria-live="polite">
      <p class="steps-kicker mono"></p>
      <div class="steps-textbox">
        <p class="steps-text"></p>
        ${words().map((s) => `<p class="steps-text steps-sizer" aria-hidden="true">${s.text}</p>`).join("")}
      </div>
    </div>
    <div class="steps-actions">
      <button type="button" class="btn-ghost" data-restart title="${t("steps.restart")}" aria-label="${t("steps.restart")}">${icon("reset")}</button>
      <button type="button" class="btn-primary" data-go></button>
    </div>`;

  const kicker = el.querySelector<HTMLElement>(".steps-kicker")!;
  const text = el.querySelector<HTMLElement>(".steps-text")!;
  const go = el.querySelector<HTMLButtonElement>("[data-go]")!;

  const reached = () => load().steps[lesson.id] ?? 0;
  const paint = () => {
    const s = words()[i];
    kicker.textContent = t("steps.kicker", { k: i + 1, n: steps.length, title: s.title });
    text.innerHTML = s.text;
    const last = i === steps.length - 1;
    // all three labels share the button's grid cell (only the current one is visible), so the button keeps one width
    // and the step text beside it never rewraps when the label changes
    const cur = !reachedNow || !shown ? "show" : last ? "done" : "next";
    const labels = goLabels();
    go.innerHTML = (Object.keys(labels) as (keyof typeof labels)[])
      .map((k) => `<span class="go-label${k === cur ? "" : " go-sizer"}"${k === cur ? "" : ' aria-hidden="true"'}>${labels[k]}</span>`)
      .join("");
    go.disabled = shown && last;
    for (const d of el.querySelectorAll<HTMLElement>(".step-dot")) {
      const k = Number(d.dataset.k);
      d.classList.toggle("is-current", k === i);
      d.classList.toggle("is-done", k < reached());
      if (k === i) d.setAttribute("aria-current", "step");
      else d.removeAttribute("aria-current");
    }
  };

  const progress = (k: number) => {
    if (k + 1 > reached())
      update((s) => {
        s.steps[lesson.id] = k + 1;
        // (the count is made against today's steps: stamp the revision, so no later migration moves it)
        if (lesson.stepsAdded?.length) (s.stepsRev ??= {})[lesson.id] = lesson.stepsAdded.length;
      });
    if (reached() >= steps.length && markDone(lesson.id)) onComplete();
  };

  /** Reach step k: play its pose (and, with replay, the poses of every step before it). */
  const reach = (k: number, replay: boolean) => {
    cancelShow();
    const acts = replay ? steps.slice(0, k + 1).flatMap((s) => asList(s.act)) : asList(steps[k].act);
    figure?.acts(acts);
    reachedNow = true;
    shown = !hasShow(k);
    fresh = false;
    progress(k);
    onStep?.(k, true);
  };

  /** Step k's Show me. A longer show (lesson 1's 7 s fingertip demo) is cut short when the step changes: its pending
   *  timed acts are dropped and its last act (the release) is sent at once, so a release is never lost. */
  let pending: number[] = [];
  let settle: (() => void) | null = null;
  const cancelShow = () => {
    if (!pending.length) return;
    for (const t of pending) window.clearTimeout(t);
    pending = [];
    settle?.();
    settle = null;
  };
  const showMe = (k: number) => {
    cancelShow();
    const list = steps[k].show ?? [];
    const last = list.reduce<(typeof list)[number] | null>((m, a) => (!m || (a.at ?? 0) >= (m.at ?? 0) ? a : m), null);
    for (const a of list) {
      const send = () => figure?.act(a.name, a.arg, { once: a.once });
      if (a.at && a.at > 0) {
        const t = window.setTimeout(() => {
          pending = pending.filter((p) => p !== t);
          if (a === last) settle = null;
          if (el.isConnected) send();
        }, a.at);
        pending.push(t);
      } else send();
    }
    settle = last && last.at ? () => figure?.act(last.name, last.arg, { once: last.once }) : null;
    shown = true;
    progress(k);
  };

  go.addEventListener("click", () => {
    if (!reachedNow) {
      // Show me on a step not reached yet: its pose, then its show
      reach(i, fresh);
      if (!shown) showMe(i);
    } else if (!shown) showMe(i);
    else if (i < steps.length - 1) {
      i++;
      reach(i, false);
    }
    paint();
  });
  // A Show me that only opens the figure may be done by the learner's own hand, as the step text asks: lesson 1's takes
  // the pad apart (a click on the sensor, ft:state apart), lesson 3's lifts the Nano (a click on the board, ft:state
  // lift). Once the figure reports it opened after this step was reached, its show is done and the button moves on
  // ("Next step"), instead of an act that would change nothing. Seen as a change in ft:state (closed, then open), so a
  // state still on its way from before the step's acts never counts. A lift by hand is not an act, so it is sent as one
  // then (it changes nothing on the figure): kept in the figure's history, a theme switch brings the Nano back up.
  const OPENS: Record<string, (s: Record<string, unknown>) => boolean> = {
    explode: (s) => s.apart === true,
    lift: (s) => typeof s.lift === "number" && s.lift >= 0.5,
  };
  const opener = (k: number): string | null => {
    const names = new Set((steps[k]?.show ?? []).map((a) => a.name));
    const [name] = names;
    return hasShow(k) && names.size === 1 && name in OPENS ? name : null;
  };
  const openSeen: Record<string, boolean | null> = { explode: null, lift: null };
  let connected = false;
  const stopState = figure?.onState((s) => {
    if (el.isConnected) connected = true;
    else if (connected) {
      stopState?.();
      return;
    }
    const by = opener(i);
    for (const [name, test] of Object.entries(OPENS)) {
      const now = test(s);
      const opened = openSeen[name] === false && now;
      openSeen[name] = now;
      if (opened && name === by && reachedNow && !shown) {
        shown = true;
        if (name === "lift") figure?.act("lift");
        progress(i);
        paint();
      }
    }
  });
  el.querySelector(".steps-dots")!.addEventListener("click", (e) => {
    const d = (e.target as HTMLElement).closest<HTMLElement>(".step-dot");
    if (!d) return;
    const k = Number(d.dataset.k);
    figure?.acts(lesson.figure?.reset);
    i = k;
    reach(k, true);
    paint();
  });
  el.querySelector("[data-restart]")!.addEventListener("click", () => {
    figure?.clearHistory();
    figure?.acts(lesson.figure?.reset);
    i = 0;
    reachedNow = startStep;
    shown = reachedNow && !hasShow(0);
    fresh = false;
    paint();
    onStep?.(0, reachedNow);
  });
  paint();
  // the start step is on show from the beginning (its demo card opens with the lesson)
  if (reachedNow) queueMicrotask(() => el.isConnected && onStep?.(0, true));
  el.relabel = () => {
    const w = words();
    el.setAttribute("aria-label", t("steps.aria"));
    el.querySelector(".steps-dots")!.setAttribute("aria-label", t("steps.dotsAria"));
    for (const d of el.querySelectorAll<HTMLElement>(".step-dot")) {
      const k = Number(d.dataset.k);
      d.setAttribute("aria-label", t("steps.dot", { k: k + 1, title: w[k].title }));
    }
    // the hidden copies that size the text box: every step's text in the new language
    const sizers = el.querySelectorAll<HTMLElement>(".steps-sizer");
    sizers.forEach((p, k) => (p.innerHTML = w[k].text));
    const restart = el.querySelector<HTMLElement>("[data-restart]")!;
    restart.title = t("steps.restart");
    restart.setAttribute("aria-label", t("steps.restart"));
    paint();
  };
  return el;
}
