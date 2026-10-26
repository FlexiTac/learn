import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/shell.css";
import "./styles/lesson.css";
import "./styles/pages.css";
import "./styles/explore.css";
import "./styles/demo.css";
import "./styles/i18n.css";
import { initLang, loc, onLang, t } from "./i18n";
import { byId, lessonNo } from "./lessons";
import { MOVED, update } from "./state/store";
import { initTheme } from "./state/theme";
import { mountShell, pageTitle, type NavId } from "./ui/shell";
import { renderAbout } from "./views/about";
import { renderGlossary } from "./views/glossary";
import { renderHome } from "./views/home";
import { renderLesson } from "./views/lesson";
import { renderLessons } from "./views/lessons";

initTheme();
// the language first: everything below paints its words in it (src/i18n, docs/i18n.md)
initLang();
const skip = document.querySelector<HTMLElement>(".skip-link");
if (skip) skip.textContent = t("skip");
const shell = mountShell(document.getElementById("app")!);
let cleanup: (() => void) | void;
let lastLessonId = "";

type Route = { nav: NavId | null; render: (el: HTMLElement) => (() => void) | void; title: string; lesson?: string };

function route(): Route {
  const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  const [page, arg] = parts;
  if (page === "lesson" && arg) {
    const l = byId(arg) ?? byId(MOVED[arg] ?? "");
    // an old link to a lesson that was merged or left the course: show where it went, under its own address
    if (l && l.id !== arg) history.replaceState(null, "", `#/lesson/${l.id}`);
    if (l) return { nav: "lessons", title: `${lessonNo(l)} ${loc(l).title}`, render: (el) => renderLesson(el, l), lesson: l.id };
  }
  if (page === "lessons") return { nav: "lessons", title: t("route.lessons"), render: renderLessons };
  if (page === "glossary") return { nav: "glossary", title: t("route.glossary"), render: (el) => renderGlossary(el, arg) };
  if (page === "about") return { nav: "about", title: t("route.about"), render: renderAbout };
  return { nav: "home", title: "", render: renderHome };
}

function go(): void {
  const r = route();
  // Moving between guided anchors inside the same lesson must not re-render it.
  if (r.lesson && r.lesson === lastLessonId) return;
  if (typeof cleanup === "function") cleanup();
  shell.outlet.innerHTML = "";
  shell.outlet.dataset.view = r.lesson ? "lesson" : (r.nav ?? "home");
  document.body.dataset.view = shell.outlet.dataset.view;
  shell.setNav(r.nav);
  shell.setLesson(r.lesson ?? null);
  pageTitle(r.title);
  cleanup = r.render(shell.outlet);
  lastLessonId = r.lesson ?? "";
  if (r.lesson) update((s) => (s.last = r.lesson));
  window.scrollTo(0, 0);
  // Move focus to the new view for keyboard and screen-reader users (not on first load).
  if (booted) shell.outlet.focus({ preventScroll: true });
}

// A language switch (the globe, src/ui/shell.ts) never reloads anything: the shell repaints its own words, a lesson
// repaints its text in place (its figure, widget and guided step stay as they are: src/views/lesson.ts), and any other
// page is drawn again where it was scrolled to.
onLang(() => {
  if (skip) skip.textContent = t("skip");
  const r = route();
  pageTitle(r.title);
  if (r.lesson) return;
  const y = window.scrollY;
  // (the glossary's filter keeps what the learner typed)
  const query = shell.outlet.querySelector<HTMLInputElement>(".glossary-page input[type=search]")?.value ?? "";
  if (typeof cleanup === "function") cleanup();
  shell.outlet.innerHTML = "";
  cleanup = r.render(shell.outlet);
  const input = shell.outlet.querySelector<HTMLInputElement>(".glossary-page input[type=search]");
  if (input && query) {
    input.value = query;
    input.dispatchEvent(new Event("input"));
  }
  window.scrollTo(0, y);
  // (after a view's own first-paint scroll, e.g. the glossary's to its #/glossary/<term>)
  requestAnimationFrame(() => window.scrollTo(0, y));
});

let booted = false;
addEventListener("hashchange", go);
go();
booted = true;
document.documentElement.classList.remove("is-loading");
