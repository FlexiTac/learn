// About: what this is, where the facts come from, what the badges mean, licences, and a progress reset.
// Its words: src/i18n/en/pages.ts ("about.*", the Chinese in src/i18n/zh/pages.ts) and the UI strings for its buttons.
import { LINKS } from "../content/sources";
import { t } from "../i18n";
import { resetProgress } from "../state/store";
import { badge, badgeTitle } from "../ui/bits";
import { h } from "../ui/dom";

export function renderAbout(outlet: HTMLElement): void {
  const el = h("div", { class: "page about-page prose" });
  el.innerHTML = `
    <header class="page-head">
      <p class="kicker mono">${t("about.kicker")}</p>
      <h1 class="page-title">${t("about.title")}</h1>
      <p class="lede">${t("about.lede", { site: LINKS.SITE })}</p>
    </header>
    <section class="card about-card">
      <h2 class="section-title">${t("about.numbers.title")}</h2>
      <p>${t("about.numbers.p1", { paper: LINKS.PAPER })}</p>
      <ul class="badge-legend">
        ${(["inferred", "illustrative", "external", "proposed"] as const).map((b) => `<li>${t("about.badgeLine", { badge: badge(b), text: badgeTitle(b) })}</li>`).join("")}
      </ul>
      <p>${t("about.numbers.p2")}</p>
    </section>
    <section class="card about-card">
      <h2 class="section-title">${t("about.credits.title")}</h2>
      <ul>
        <li>${t("about.credits.hw", { hwRepo: LINKS.HW_REPO })}</li>
        <li>${t("about.credits.fw", { pyflexitac: LINKS.PYFLEXITAC })}</li>
        <li>${t("about.credits.velostat")}</li>
        <li>${t("about.credits.robot", { rebot: LINKS.REBOT, umi: LINKS.UMI })}</li>
        <li>${t("about.credits.sim", { vtRefine: LINKS.VT_REFINE })}</li>
        <li>${t("about.credits.layout")}</li>
      </ul>
    </section>
    <section class="card about-card">
      <h2 class="section-title">${t("about.progress.title")}</h2>
      <p>${t("about.progress.p")}</p>
      <div class="reset-row">
        <button type="button" class="btn-ghost" data-reset>${t("about.reset")}</button>
        <span class="reset-confirm" hidden>${t("about.confirm")} <button type="button" class="btn-primary" data-yes>${t("about.yes")}</button>
          <button type="button" class="btn-ghost" data-no>${t("about.cancel")}</button></span>
        <span class="reset-done mono" role="status"></span>
      </div>
    </section>`;
  outlet.append(el);
  const confirmEl = el.querySelector<HTMLElement>(".reset-confirm")!;
  const done = el.querySelector<HTMLElement>(".reset-done")!;
  el.querySelector("[data-reset]")!.addEventListener("click", () => {
    confirmEl.hidden = false;
    el.querySelector<HTMLElement>("[data-no]")!.focus();
  });
  el.querySelector("[data-no]")!.addEventListener("click", () => (confirmEl.hidden = true));
  el.querySelector("[data-yes]")!.addEventListener("click", () => {
    resetProgress();
    confirmEl.hidden = true;
    done.textContent = t("about.cleared");
  });
}
