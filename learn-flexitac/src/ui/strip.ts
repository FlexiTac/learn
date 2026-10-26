// Bottom lesson strip: every lesson as a card, the current one highlighted, prev/next arrows.
import { loc, t } from "../i18n";
import { LESSONS, lessonNo, neighbours, sectionOf } from "../lessons";
import type { Lesson } from "../types";
import { isDone } from "../state/store";
import { esc, h } from "./dom";
import { icon } from "./icons";
import { lc } from "./lessoncolor";
import { thumbFor } from "./thumbs";

export function lessonStrip(current: Lesson): HTMLElement {
  const { prev, next } = neighbours(current);
  const el = h("nav", { class: "strip", "aria-label": t("strip.aria") });
  el.innerHTML = `
    <h2 class="strip-title">${t("strip.title")}</h2>
    <div class="strip-row">
      <a class="strip-arrow prev" ${prev ? `href="#/lesson/${prev.id}"` : 'aria-disabled="true"'} aria-label="${prev ? t("strip.prev", { title: esc(loc(prev).title) }) : t("strip.noPrev")}">${icon("chevron")}</a>
      <ol class="strip-list">
        ${LESSONS.map(
          (l, i) => `<li${i && sectionOf(LESSONS[i - 1]) !== sectionOf(l) ? ' class="strip-new-section"' : ""}><a class="strip-card${l === current ? " is-current" : ""}${isDone(l.id) ? " is-done" : ""}" style="${lc(l.n)}" href="#/lesson/${l.id}" ${l === current ? 'aria-current="page"' : ""}>
            <span class="strip-thumb">${thumbFor(l)}</span>
            <span class="strip-name"><span class="lesson-num" aria-hidden="true">${lessonNo(l)}</span><span class="strip-title-text"><span class="visually-hidden">${t("lesson.noTitle", { no: lessonNo(l) })}</span>${esc(loc(l).title)}</span></span>
            ${isDone(l.id) ? `<span class="strip-done" aria-label="${t("state.done")}">${icon("check")}</span>` : l.status === "draft" ? `<span class="strip-draft mono">${t("badge.draft")}</span>` : ""}
          </a></li>`,
        ).join("")}
      </ol>
      <a class="strip-arrow next" ${next ? `href="#/lesson/${next.id}"` : 'aria-disabled="true"'} aria-label="${next ? t("strip.next", { title: esc(loc(next).title) }) : t("strip.noNext")}">${icon("chevron")}</a>
    </div>`;
  // The list shows the current card whole and as near the middle as the cards allow, and it always starts on a whole
  // card: the scroll lands on a card's left edge (never a sliver of a card at the left end). Near the end of the list a
  // spacer after the last card (--strip-end, lesson.css; less than one card) makes that edge reachable. Again on a resize; a scroll of the
  // learner's own snaps to card edges too (scroll-snap-align: start).
  const list = el.querySelector<HTMLElement>(".strip-list")!;
  const place = () => {
    const cur = list.querySelector<HTMLElement>(".is-current")?.closest("li");
    if (!cur || !list.clientWidth) return;
    list.style.setProperty("--strip-end", "0px");
    const pad = parseFloat(getComputedStyle(list).paddingLeft) || 0;
    const box = list.getBoundingClientRect();
    const items = [...list.children] as HTMLElement[];
    const at = (li: HTMLElement) => li.getBoundingClientRect().left - box.left + list.scrollLeft - pad;
    const starts = items.map(at);
    const c = items.indexOf(cur);
    const view = list.clientWidth - 2 * pad;
    const curEnd = starts[c] + cur.getBoundingClientRect().width;
    const content = list.scrollWidth - 2 * pad;
    let left = 0;
    if (content > view + 1) {
      // the ideal: the current card in the middle, but never past the list's natural end (a last card is not centred
      // over an empty band)
      const want = Math.min(starts[c] + (curEnd - starts[c]) / 2 - view / 2, content - view);
      // the card edges at or before the current card that still show it whole; the one nearest the ideal
      const fits = starts.slice(0, c + 1).filter((x) => x + view >= curEnd - 0.5);
      left = fits.reduce((best, x) => (Math.abs(x - want) < Math.abs(best - want) ? x : best), fits[0] ?? starts[c]);
      const short = left + view - content;
      if (short > 0.5) list.style.setProperty("--strip-end", `${Math.ceil(short)}px`);
    }
    list.scrollTo({ left: Math.max(0, Math.round(left)), behavior: "instant" });
  };
  requestAnimationFrame(place);
  // (the cards' widths follow their titles: again once the fonts are in)
  document.fonts?.ready.then(() => el.isConnected && place());
  // (a strip taken out of the page reports a 0 size once: the observer goes then)
  const ro = new ResizeObserver(() => (el.isConnected ? place() : ro.disconnect()));
  ro.observe(list);
  return el;
}
