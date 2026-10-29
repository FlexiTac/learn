// Detail window: opens when the learner presses "Details ›" under a part's label in the figure (ft:details).
// Desktop: a floating card over the right panel column, where the Overview is: the panel's own left and right edges,
// top-aligned with it, as tall as its content up to the panel's height (it scrolls inside). It covers the panel and
// never reflows it, and it never touches the stage: the figure does not move. Stacked layouts (< 1024 px wide or
// < 640 px tall): a bottom sheet.
// Content: icon + TITLE (the lesson's colour on the rule under it), intro, facts with source chips and badges, and
// "Taught in Lesson N →" when another lesson teaches the part. Picking another part in the figure while it is open
// swaps the content; clearing the pick (the figure's label goes away) closes it. × or Escape closes it and returns
// focus to the figure.
// The part's own words (title, intro, facts) come from the figure, in the figure's language (a figure that switches
// language re-sends ft:pick, which re-renders the window); the window's chrome follows the site (relabel()).
import { loc, t } from "../i18n";
import { lessonForPart, lessonNo } from "../lessons";
import type { FigPart, Lesson } from "../types";
import type { FigureHost } from "../figure/FigureHost";
import { badge, sourceChips } from "./bits";
import { esc, h } from "./dom";
import { icon, partIcon } from "./icons";
import { lc } from "./lessoncolor";

const FIG_NO = { pad: 1, crossing: 2, board: 3, gripper: 5 } as const;
/** Matches the CSS transition on .details (explore.css), so the card is hidden only once it has faded out. */
const CLOSE_MS = 200;

export interface DetailsWindow {
  el: HTMLElement;
  readonly part: FigPart | null;
  open(part: FigPart, focus?: boolean): void;
  close(returnFocus?: boolean): void;
  /** Paint the open window again in the site's language (after a switch); keeps focus inside it. */
  relabel(): void;
  destroy(): void;
}

export function detailsWindow(panel: HTMLElement, figure: FigureHost, lesson: Lesson): DetailsWindow {
  const titleId = `details-title-${lesson.n}`;
  const el = h("section", { class: "details", role: "dialog", "aria-modal": "false", "aria-labelledby": titleId, hidden: true });
  panel.append(el);
  let current: FigPart | null = null;
  let hideTimer = 0;

  const render = (part: FigPart) => {
    // Fig 1-3 name the lesson by its place in the course, Fig 5 by its shown number ("2.1"), both as the figures were
    // built (src/lessons/index.ts lessonForPart)
    const target = lessonForPart(part.lesson);
    const facts = (part.facts ?? []).slice(0, 4);
    el.innerHTML = `
      <header class="det-head">
        <span class="det-icon" aria-hidden="true">${partIcon(part.icon)}</span>
        <div class="det-titles">
          <p class="det-kicker mono">${t("details.kicker", { fig: t("fig.no", { n: FIG_NO[figure.fig] }) })}</p>
          <h2 class="det-title" id="${titleId}" tabindex="-1">${esc(part.title)}</h2>
        </div>
        <button type="button" class="det-close" aria-label="${t("details.close")}" title="${t("details.closeTitle")}">${icon("close")}</button>
      </header>
      <div class="det-body">
        <p class="det-intro">${esc(part.intro || part.short || "")}</p>
        ${facts.length
          ? `<dl class="det-facts">${facts
              .map(
                (f) => `<div class="det-fact">
                  <dt>${esc(f.label)}</dt>
                  <dd><span class="det-value">${esc(f.value)}</span>${badge(f.badge)}
                    ${f.src ? `<span class="chips" aria-label="${t("sources.aria")}">${sourceChips(f.src)}</span>` : ""}</dd>
                </div>`,
              )
              .join("")}</dl>`
          : ""}
        ${target && target.id !== lesson.id
          ? `<a class="det-lesson" href="#/lesson/${target.id}" style="${lc(target.n)}"><span class="det-lesson-n mono">${lessonNo(target)}</span><span>${t("details.taught", { no: lessonNo(target), title: esc(loc(target).title) })}</span>${icon("chevron")}</a>`
          : ""}
      </div>`;
    el.querySelector(".det-close")!.addEventListener("click", () => close(true));
    el.scrollTop = 0;
  };

  const open = (part: FigPart, focus = true) => {
    clearTimeout(hideTimer);
    const swap = current !== null && !el.hidden && current.id !== part.id;
    // re-rendering drops whatever had focus inside the card: keep focus in it
    const inside = el.contains(document.activeElement);
    current = part;
    render(part);
    if (el.hidden) {
      el.hidden = false;
      el.classList.remove("is-on");
      void el.offsetWidth;
      el.classList.add("is-on");
    } else {
      el.classList.add("is-on");
      if (swap) {
        el.classList.remove("is-swap");
        void el.offsetWidth;
        el.classList.add("is-swap");
      }
    }
    if (focus || inside) el.querySelector<HTMLElement>(".det-title")?.focus({ preventScroll: true });
  };

  const close = (returnFocus = true) => {
    if (!current) return;
    current = null;
    el.classList.remove("is-on", "is-swap");
    clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => {
      if (!current) el.hidden = true;
    }, CLOSE_MS);
    if (returnFocus) figure.focus();
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape" && current && !e.defaultPrevented) {
      e.preventDefault();
      close(true);
    }
  };
  document.addEventListener("keydown", onKey);
  const offDetails = figure.onDetails((part) => open(part, true));
  // The window belongs to the part the figure has labelled: another pick swaps it, no pick closes it.
  const offPick = figure.onPick((part) => {
    if (!current) return;
    if (!part) close(false);
    else if (part.id !== current.id || part.intro !== current.intro) open(part, false);
  });

  return {
    el,
    get part() {
      return current;
    },
    open,
    close,
    relabel() {
      if (!current || el.hidden) return;
      const inside = el.contains(document.activeElement);
      const top = el.scrollTop;
      render(current);
      el.scrollTop = top;
      if (inside) el.querySelector<HTMLElement>(".det-title")?.focus({ preventScroll: true });
    },
    destroy() {
      clearTimeout(hideTimer);
      offDetails();
      offPick();
      document.removeEventListener("keydown", onKey);
      el.remove();
    },
  };
}
