// "Check yourself": multiple-choice questions. Passing every question marks the lesson done.
// Its words are the lesson's in the site's language (loc); the lesson view builds it again after a language switch
// (the saved answers come back with it).
import { loc, t } from "../i18n";
import type { Lesson } from "../types";
import { load, markDone, migrateQuiz, update } from "../state/store";
import { esc, h } from "./dom";

export function quiz(lesson: Lesson, onPass: () => void): HTMLElement {
  const qs = loc(lesson).quiz ?? [];
  // answers saved before a question was taken out (Lesson.quizDropped) move back onto their own questions first
  migrateQuiz(lesson.id, lesson.quizDropped);
  const answers: (number | null)[] = qs.map((_, i) => load().quiz[lesson.id]?.[i] ?? null);
  const el = h("section", { class: "quiz", "aria-labelledby": `quiz-${lesson.id}` });
  el.innerHTML = `
    <h3 class="section-title" id="quiz-${lesson.id}">${t("quiz.title")}</h3>
    ${qs
      .map(
        (q, i) => `
      <fieldset class="q" data-q="${i}">
        <legend><span class="q-n mono">${i + 1}</span> ${esc(q.q)}</legend>
        <div class="q-choices">
          ${q.choices
            .map(
              (c, j) => `<label class="q-choice"><input type="radio" name="q-${lesson.id}-${i}" value="${j}"><span>${esc(c)}</span></label>`,
            )
            .join("")}
        </div>
        <p class="q-why" aria-live="polite" hidden></p>
      </fieldset>`,
      )
      .join("")}
    <p class="quiz-score mono" aria-live="polite"></p>`;

  const score = el.querySelector<HTMLElement>(".quiz-score")!;
  const paint = () => {
    let right = 0;
    qs.forEach((q, i) => {
      const fs = el.querySelector<HTMLElement>(`[data-q="${i}"]`)!;
      const why = fs.querySelector<HTMLElement>(".q-why")!;
      const a = answers[i];
      for (const inp of fs.querySelectorAll<HTMLInputElement>("input")) {
        inp.checked = a !== null && Number(inp.value) === a;
        const lab = inp.closest("label")!;
        lab.classList.toggle("is-right", a !== null && Number(inp.value) === q.answer && a === q.answer);
        lab.classList.toggle("is-wrong", a !== null && Number(inp.value) === a && a !== q.answer);
      }
      fs.classList.toggle("is-right", a === q.answer);
      fs.classList.toggle("is-wrong", a !== null && a !== q.answer);
      if (a === null) why.hidden = true;
      else {
        why.hidden = false;
        why.innerHTML = a === q.answer ? `${t("quiz.right")} ${q.why}` : t("quiz.wrong");
      }
      if (a === q.answer) right++;
    });
    const answered = answers.filter((a) => a !== null).length;
    score.textContent = answered ? `${t("quiz.score", { right, n: qs.length })}${right === qs.length ? t("quiz.complete") : ""}` : "";
    el.classList.toggle("is-passed", right === qs.length);
    return right === qs.length;
  };

  el.addEventListener("change", (e) => {
    const t = e.target as HTMLInputElement;
    const i = Number(t.closest<HTMLElement>("[data-q]")!.dataset.q);
    answers[i] = Number(t.value);
    update((s) => (s.quiz[lesson.id] = [...answers]));
    if (paint() && markDone(lesson.id)) onPass();
  });
  paint();
  return el;
}
