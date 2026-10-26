// App shell: icon sidebar (bottom bar on phones), brand header, progress card, and the view outlet.
// The sidebar's last two buttons switch the language (the globe: English <-> 中文, src/i18n) and the theme. A language
// switch repaints every word here in place (nothing is rebuilt, so focus stays on the globe).
import { COLS, FRAME_HZ, ROWS } from "@shared/data/constants.mjs";
import { LESSONS, lessonNo } from "../lessons";
import { HTML_LANG, lang, loc, onLang, t, toggleLang, type StrKey } from "../i18n";
import { load, subscribe } from "../state/store";
import { onTheme, theme, toggleTheme } from "../state/theme";
import { esc, h } from "./dom";
import { icon, LOGO } from "./icons";
import { lc } from "./lessoncolor";

export type NavId = "home" | "lessons" | "glossary" | "about";

const NAV: { id: NavId; label: StrKey; href: string; ico: Parameters<typeof icon>[0] }[] = [
  { id: "home", label: "nav.home", href: "#/", ico: "home" },
  { id: "lessons", label: "nav.lessons", href: "#/lessons", ico: "book" },
  { id: "glossary", label: "nav.glossary", href: "#/glossary", ico: "glossary" },
  { id: "about", label: "nav.about", href: "#/about", ico: "info" },
];

export interface Shell {
  outlet: HTMLElement;
  setNav(id: NavId | null): void;
  /** Mark the open lesson's pip in the progress card (null = no lesson open). */
  setLesson(id: string | null): void;
}

/** The globe button's label: both languages, the one on show marked (each in its own language, for screen readers and
 *  the :lang(zh) styles). */
const langLabel = () =>
  `<span lang="${HTML_LANG.en}"${lang() === "en" ? ' class="is-on"' : ""}>EN</span><span class="lang-sep" aria-hidden="true">/</span><span lang="${HTML_LANG.zh}"${lang() === "zh" ? ' class="is-on"' : ""}>中文</span>`;

export function mountShell(app: HTMLElement): Shell {
  app.innerHTML = "";
  app.className = "app";

  const side = h("nav", { class: "sidebar", "aria-label": t("nav.aria") });
  side.innerHTML = `
    <a class="side-logo" href="#/" aria-label="${t("nav.homeAria")}">${LOGO}</a>
    <ul class="side-nav">
      ${NAV.map((n) => `<li><a href="${n.href}" data-nav="${n.id}" title="${t(n.label)}">${icon(n.ico)}<span class="side-label">${t(n.label)}</span></a></li>`).join("")}
      <li class="side-lang"><button type="button" class="lang-toggle" data-lang-toggle>${icon("globe")}<span class="side-label lang-label">${langLabel()}</span></button></li>
      <li class="side-theme"><button type="button" class="theme-toggle" data-theme-toggle>${icon("sun", "i-sun")}${icon("moon", "i-moon")}<span class="side-label">${t("theme.label")}</span></button></li>
    </ul>`;

  const top = h("header", { class: "topbar" });
  top.innerHTML = `
    <a class="brand" href="#/">
      ${LOGO}
      <span class="brand-rule" aria-hidden="true"></span>
      <span class="brand-text">
        <span class="brand-name" lang="${HTML_LANG.en}">Learn FlexiTac</span>
        <span class="brand-tag">${t("brand.tag")}</span>
      </span>
    </a>
    <div class="status">
      <a class="progress-card" href="#/lessons" aria-label="${t("progress.aria")}">
        ${icon("book", "progress-icon")}
        <span class="progress-body">
          <span class="progress-label">${t("progress.label")}</span>
          <span class="progress-row">
            <span class="progress-track progress-pips" role="progressbar" aria-label="${t("progress.track")}" aria-valuemin="0" aria-valuemax="${LESSONS.length}" aria-valuenow="0">${LESSONS.map((l) => `<span class="pip" style="${lc(l.n)}" data-id="${l.id}" title="${lessonNo(l)} ${esc(loc(l).title)}"></span>`).join("")}</span>
            <span class="progress-count mono">0/${LESSONS.length}</span>
          </span>
        </span>
      </a>
      <div class="spec-card mono" aria-label="${t("spec.aria")}">
        <span>${t("spec.taxels", { rows: ROWS, cols: COLS })}</span>
        <span>${t("spec.rate", { hz: FRAME_HZ })}</span>
      </div>
    </div>`;

  const outlet = h("main", { id: "content", class: "outlet", tabindex: "-1" });
  app.append(side, top, outlet);

  // theme toggle
  const toggle = side.querySelector<HTMLButtonElement>("[data-theme-toggle]")!;
  const paintTheme = () => {
    const th = theme();
    toggle.setAttribute("aria-label", t(th === "dark" ? "theme.toLight" : "theme.toDark"));
    toggle.title = toggle.getAttribute("aria-label")!;
  };
  toggle.addEventListener("click", () => toggleTheme());
  onTheme(paintTheme);
  paintTheme();

  // language switch (the globe)
  const globe = side.querySelector<HTMLButtonElement>("[data-lang-toggle]")!;
  const paintGlobe = () => {
    globe.setAttribute("aria-label", t("lang.switch"));
    globe.title = t("lang.switch");
    globe.querySelector(".lang-label")!.innerHTML = langLabel();
  };
  globe.addEventListener("click", () => toggleLang());
  paintGlobe();

  // progress
  const pips = [...top.querySelectorAll<HTMLElement>(".pip")];
  const count = top.querySelector<HTMLElement>(".progress-count")!;
  const track = top.querySelector<HTMLElement>(".progress-track")!;
  const paintProgress = () => {
    const done = load().done.filter((id) => LESSONS.some((l) => l.id === id)).length;
    const ids = load().done;
    for (const p of pips) p.classList.toggle("is-done", ids.includes(p.dataset.id!));
    count.textContent = `${done}/${LESSONS.length}`;
    track.setAttribute("aria-valuenow", String(done));
    track.setAttribute("aria-valuetext", t("progress.valuetext", { done, total: LESSONS.length }));
  };
  subscribe(paintProgress);
  paintProgress();

  // every word again, in place, after a language switch
  onLang(() => {
    side.setAttribute("aria-label", t("nav.aria"));
    side.querySelector(".side-logo")!.setAttribute("aria-label", t("nav.homeAria"));
    for (const n of NAV) {
      const a = side.querySelector<HTMLElement>(`[data-nav="${n.id}"]`)!;
      a.title = t(n.label);
      a.querySelector(".side-label")!.textContent = t(n.label);
    }
    toggle.querySelector(".side-label")!.textContent = t("theme.label");
    paintTheme();
    paintGlobe();
    top.querySelector(".brand-tag")!.innerHTML = t("brand.tag");
    top.querySelector(".progress-card")!.setAttribute("aria-label", t("progress.aria"));
    top.querySelector(".progress-label")!.textContent = t("progress.label");
    track.setAttribute("aria-label", t("progress.track"));
    for (const p of pips) {
      const l = LESSONS.find((x) => x.id === p.dataset.id);
      if (l) p.title = `${lessonNo(l)} ${loc(l).title}`;
    }
    const spec = top.querySelector<HTMLElement>(".spec-card")!;
    spec.setAttribute("aria-label", t("spec.aria"));
    spec.innerHTML = `<span>${t("spec.taxels", { rows: ROWS, cols: COLS })}</span><span>${t("spec.rate", { hz: FRAME_HZ })}</span>`;
    paintProgress();
  });

  return {
    outlet,
    setLesson(id) {
      for (const p of pips) p.classList.toggle("is-current", p.dataset.id === id);
    },
    setNav(id) {
      for (const a of side.querySelectorAll<HTMLAnchorElement>("[data-nav]")) {
        const on = a.dataset.nav === id;
        a.classList.toggle("is-active", on);
        if (on) a.setAttribute("aria-current", "page");
        else a.removeAttribute("aria-current");
      }
    },
  };
}

export function pageTitle(s: string): void {
  document.title = s ? t("site.titleSuffix", { page: s }) : t("site.title");
}

export { esc };
