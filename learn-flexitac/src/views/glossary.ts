// Glossary: searchable, alphabetical; #/glossary/<id> scrolls to and highlights one term.
// In Chinese each term shows its Chinese name (src/content/glossary.zh.ts) with the English one beside it, in the
// English order (so it lines up with the English names learners meet in code and datasheets); the filter matches both.
import { GLOSSARY } from "../content/glossary";
import { lang, locTerm, t } from "../i18n";
import { byId, lessonNo } from "../lessons";
import { esc, h } from "../ui/dom";

export function renderGlossary(outlet: HTMLElement, focusId?: string): void {
  const zh = lang() === "zh";
  const terms = [...GLOSSARY].sort((a, b) => a.term.localeCompare(b.term)).map((en) => ({ ...locTerm(en), enAka: en.aka }));
  const el = h("div", { class: "page glossary-page" });
  el.innerHTML = `
    <header class="page-head">
      <p class="kicker mono">${t("glossary.kicker", { n: terms.length })}</p>
      <h1 class="page-title">${t("glossary.title")}</h1>
      <p class="lede">${t("glossary.lede")}</p>
      <label class="search"><span class="visually-hidden">${t("glossary.filter")}</span>
        <input type="search" placeholder="${esc(t("glossary.placeholder"))}" autocomplete="off" spellcheck="false"></label>
    </header>
    <dl class="glossary">
      ${terms
        .map((g) => {
          const l = g.lesson ? byId(g.lesson) : undefined;
          // Chinese: the English name leads the aka line ("Taxel · tactile pixel"), when the term has a Chinese name
          const aka = zh && g.zh ? [g.en, g.aka].filter(Boolean).join(" · ") : g.aka;
          // (Chinese: the filter also finds the English name and aka)
          const text = zh ? [g.term, g.en, g.aka ?? "", g.enAka ?? "", g.def].join(" ") : g.term + " " + (g.aka ?? "") + " " + g.def;
          return `<div class="term card" id="term-${g.id}" data-text="${esc(text.toLowerCase())}">
            <dt><a class="term-link" href="#/glossary/${g.id}">${esc(g.term)}</a>${aka ? ` <span class="aka mono">${esc(aka)}</span>` : ""}</dt>
            <dd>${g.def}${l ? ` <a class="term-lesson mono" href="#/lesson/${l.id}">${t("lesson.no", { no: lessonNo(l) })}</a>` : ""}</dd>
          </div>`;
        })
        .join("")}
    </dl>
    <p class="empty" hidden>${t("glossary.none")}</p>`;
  outlet.append(el);
  const input = el.querySelector<HTMLInputElement>("input")!;
  const empty = el.querySelector<HTMLElement>(".empty")!;
  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    let shown = 0;
    for (const t of el.querySelectorAll<HTMLElement>(".term")) {
      const on = !q || t.dataset.text!.includes(q);
      t.hidden = !on;
      if (on) shown++;
    }
    empty.hidden = shown > 0;
  });
  if (focusId) {
    const t = el.querySelector<HTMLElement>(`#term-${CSS.escape(focusId)}`);
    if (t) {
      t.classList.add("is-target");
      requestAnimationFrame(() => t.scrollIntoView({ block: "center" }));
    }
  }
}
