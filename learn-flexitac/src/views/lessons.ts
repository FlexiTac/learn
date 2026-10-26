// All lessons, grouped by section and chapter (src/lessons/index.ts SECTIONS), with done / draft state. A chapter
// without lessons yet ("Coming next") shows one "to be continued" card.
import { loc, locSection, t } from "../i18n";
import { chapterLessons, LESSONS, lessonNo, SECTIONS } from "../lessons";
import { load } from "../state/store";
import type { Chapter } from "../types";
import { esc, h } from "../ui/dom";
import { icon } from "../ui/icons";
import { lc } from "../ui/lessoncolor";
import { thumbFor } from "../ui/thumbs";

function chapterGroup(sec: number, k: number, c: Chapter, done: string[]): string {
  const ls = chapterLessons(c);
  const id = `ch-${sec}-${k + 1}`;
  return `<div class="chapter-group" aria-labelledby="${id}">
    <h3 class="chapter-title mono" id="${id}">${esc(c.title)}</h3>
    <ol class="lesson-cards">
      ${
        ls.length
          ? ls
              .map(
                (l) => `<li><a class="card lesson-card${done.includes(l.id) ? " is-done" : ""}" href="#/lesson/${l.id}" style="${lc(l.n)}">
                <span class="lesson-card-thumb">${thumbFor(l)}</span>
                <span class="lesson-card-body">
                  <span class="kicker mono"><span class="lesson-num" aria-hidden="true">${lessonNo(l)}</span>${t("lesson.no", { no: lessonNo(l) })}${l.status === "draft" ? ` · <span class="badge badge-draft">${t("badge.draft")}</span>` : ""}${done.includes(l.id) ? ` · ${icon("check")} ${t("state.done")}` : ""}</span>
                  <span class="lesson-card-title">${esc(loc(l).title)}</span>
                  <span class="lesson-card-lede">${loc(l).lede}</span>
                </span>
              </a></li>`,
              )
              .join("")
          : `<li><div class="card lesson-card is-soon">
                <span class="lesson-card-thumb">${icon("soon", "thumb-icon")}</span>
                <span class="lesson-card-body">
                  <span class="kicker mono">${t("soon.kicker")}</span>
                  <span class="lesson-card-title">${t("soon.title")}</span>
                  <span class="lesson-card-lede">${esc(c.text)}</span>
                </span>
              </div></li>`
      }
    </ol>
  </div>`;
}

export function renderLessons(outlet: HTMLElement): void {
  // only lessons still in the course count (lessons 4-6 were set aside; old progress may list them)
  const done = load().done.filter((id) => LESSONS.some((l) => l.id === id));
  const el = h("div", { class: "page lessons-page" });
  el.innerHTML = `
    <header class="page-head">
      <p class="kicker mono">${t("lessons.kicker", { done: done.length, total: LESSONS.length })}</p>
      <h1 class="page-title">${t("lessons.title")}</h1>
      <p class="lede">${t("lessons.lede")}</p>
    </header>
    ${SECTIONS.map((sec) => locSection(sec)).map(
      (sec) => `<section class="lesson-group" aria-labelledby="sec-${sec.n}">
        <h2 class="section-title" id="sec-${sec.n}"><span class="sec-n">${t("section.no", { n: sec.n })}</span> · ${esc(sec.title)}</h2>
        <div class="chapter-groups">${sec.chapters.map((c, k) => chapterGroup(sec.n, k, c, done)).join("")}</div>
      </section>`,
    ).join("")}`;
  outlet.append(el);
}
