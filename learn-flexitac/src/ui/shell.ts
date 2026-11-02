// App shell: icon sidebar (bottom bar on phones), brand header (the brand and the progress card on the left, the
// GitHub card and the Discord button on the right, as on flexitac.github.io), and the view outlet.
// The sidebar's last two buttons switch the language (the globe: English <-> 中文, src/i18n) and the theme. A language
// switch repaints every word here in place (nothing is rebuilt, so focus stays on the globe).
import { LESSONS, lessonNo } from "../lessons";
import { HTML_LANG, lang, loc, onLang, t, toggleLang, type StrKey } from "../i18n";
import { load, subscribe } from "../state/store";
import { onTheme, theme, toggleTheme } from "../state/theme";
import { DISCORD_URL, fmtCount, refreshRepoStats, REPO_URL, repoStats } from "./community";
import { esc, h } from "./dom";
import { DISCORD_MARK, FORK_MARK, GITHUB_MARK, icon, LOGO, STAR_MARK } from "./icons";
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
    <div class="topbar-links">
      <a class="gh-card" href="${REPO_URL}" target="_blank" rel="noopener noreferrer" data-gh>
        ${GITHUB_MARK}
        <span class="gh-text">
          <span class="gh-name" lang="${HTML_LANG.en}">FlexiTac</span>
          <span class="gh-stats mono"><span>${STAR_MARK}<b data-gh-stars>${fmtCount(repoStats().stars)}</b></span><span>${FORK_MARK}<b data-gh-forks>${fmtCount(repoStats().forks)}</b></span></span>
        </span>
      </a>
      <a class="discord-btn" href="${DISCORD_URL}" target="_blank" rel="noopener noreferrer" data-discord>
        ${DISCORD_MARK}<span class="discord-label" lang="${HTML_LANG.en}">Discord</span>
      </a>
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

  // the GitHub card's counts and the two links' names (the counts are in the name: the card's own text is hidden from
  // screen readers by it; the title is the same words, a tooltip once the narrower headers show only the marks)
  const gh = top.querySelector<HTMLAnchorElement>("[data-gh]")!;
  const discord = top.querySelector<HTMLAnchorElement>("[data-discord]")!;
  const paintLinks = () => {
    const s = repoStats();
    gh.querySelector("[data-gh-stars]")!.textContent = fmtCount(s.stars);
    gh.querySelector("[data-gh-forks]")!.textContent = fmtCount(s.forks);
    gh.setAttribute("aria-label", t("community.github", { stars: s.stars, forks: s.forks }));
    gh.title = gh.getAttribute("aria-label")!;
    discord.setAttribute("aria-label", t("community.discord"));
    discord.title = t("community.discord");
  };
  paintLinks();
  refreshRepoStats(paintLinks);

  // On phones the brand's row ends in the GitHub and Discord marks and the progress card takes the next row (shell.css),
  // so there the card also comes after the links in the page, and Tab goes through the header in the order it is seen
  // (brand, GitHub, Discord, progress); wider, it sits right after the brand. (Moving the card drops focus from it, so
  // a card in focus is focused again.)
  const progressCard = top.querySelector<HTMLAnchorElement>(".progress-card")!;
  const links = top.querySelector<HTMLElement>(".topbar-links")!;
  const phone = matchMedia("(max-width: 600.98px)");
  const placeProgress = () => {
    const focused = document.activeElement === progressCard;
    (phone.matches ? links : top.querySelector(".brand")!).after(progressCard);
    if (focused) progressCard.focus({ preventScroll: true });
  };
  phone.addEventListener("change", placeProgress);
  placeProgress();

  // The boxes in the header (progress, GitHub, Discord) are exactly as tall as the brand's lettering and line up with
  // it: from the cap tops of "LEARN FLEXITAC" to the foot of the tagline (its baseline in English; the Chinese
  // tagline's characters reach about 1 px below theirs). The brand's text boxes are taller than the letters (~3 px of
  // the font's ascent above the capitals, ~5 px of descent and line spacing below the tagline), by an amount that
  // depends on the font the system picked (SF Mono, DejaVu Sans Mono, a CJK face for the Chinese tagline) and on how it
  // is hinted at that size, so the letters are measured, not guessed: each line is drawn on a hidden canvas at the
  // screen's resolution, in its own colour on the page's, and its first and last rows that show at least half the
  // ink's contrast are laid on the line's baseline in the page, read off a zero-size probe. (Glyph metrics alone were
  // up to 1 px out: Chrome rounds a CJK glyph's bounds to whole pixels, and hinting moves the name's capitals by up to
  // a pixel at the sizes between 1024 and 1200 px windows. Black on a clear canvas was a device pixel short for the
  // Chinese tagline at 125-150 % scaling: Chrome darkens or lightens text by its colour as it draws it, and in the
  // tagline's grey the characters' outer strokes reach half the contrast one row further out.) shell.css then
  // trims the brand's text to its letters (negative margins) and gives every box their height, so the row is as tall
  // as the lettering and the header's padding is measured from the letters. At a scaling between whole numbers the
  // letters can still land a device pixel from the boxes' edges (under 1 px): Chrome puts a line's glyphs on the
  // device grid by rules the page cannot read. Measured again whenever the brand's text changes size (the name's size
  // follows the window; a language switch swaps the tagline), when the theme changes (the colours), when the screen's
  // resolution changes (a zoom, another monitor: the letters are hinted anew) and once the fonts are ready.
  const brandText = top.querySelector<HTMLElement>(".brand-text")!;
  const brandName = top.querySelector<HTMLElement>(".brand-name")!;
  const brandTag = top.querySelector<HTMLElement>(".brand-tag")!;
  const inkCanvas = document.createElement("canvas");
  const inkCtx = inkCanvas.getContext("2d", { willReadFrequently: true });
  const probe = h("span", { class: "baseline-probe", "aria-hidden": "true" });
  /** The colour the brand is drawn on: the first background behind it that is not see-through (the page's). */
  const paperOf = (el: Element | null) => {
    for (; el; el = el.parentElement) {
      const c = getComputedStyle(el).backgroundColor;
      if (c && c !== "transparent" && c !== "rgba(0, 0, 0, 0)") return c;
    }
    return "#fff";
  };
  /** How far a line's letters reach above and below its baseline (CSS px). A browser that blurs what a page reads back
   *  from a canvas (against fingerprinting) gives rows no font has; then the glyph metrics are used. */
  const inkReach = (el: HTMLElement, ctx: CanvasRenderingContext2D, paper: string) => {
    const cs = getComputedStyle(el);
    const dpr = window.devicePixelRatio || 1;
    const em = parseFloat(cs.fontSize);
    const font = `${cs.fontStyle} ${cs.fontWeight} ${em * dpr}px ${cs.fontFamily}`;
    const text = cs.textTransform === "uppercase" ? (el.textContent ?? "").toUpperCase() : (el.textContent ?? "");
    ctx.font = font;
    const m = ctx.measureText(text);
    const w = Math.ceil(m.width) + 8;
    const tall = Math.ceil(em * dpr * 2);
    const base = Math.round(em * dpr * 1.4);
    inkCanvas.width = w;
    inkCanvas.height = tall; // (resizing clears the canvas and its font)
    // the paper, one pixel of the ink on it (read back as drawn, whatever the colour's notation), then the line
    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, w, tall);
    ctx.fillStyle = cs.color;
    ctx.fillRect(0, 0, 1, 1);
    const ink = ctx.getImageData(0, 0, 1, 1).data;
    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, 1, 1);
    ctx.font = font;
    ctx.fillStyle = cs.color;
    ctx.fillText(text, 4, base);
    const px = ctx.getImageData(0, 0, w, tall).data;
    const [r0, g0, b0] = [px[0], px[1], px[2]];
    const half = Math.max(Math.abs(ink[0] - r0), Math.abs(ink[1] - g0), Math.abs(ink[2] - b0)) / 2;
    let first = -1;
    let last = -1;
    for (let y = 0; y < tall && half > 0; y++) {
      for (let i = y * w * 4, end = (y + 1) * w * 4; i < end; i += 4) {
        if (Math.max(Math.abs(px[i] - r0), Math.abs(px[i + 1] - g0), Math.abs(px[i + 2] - b0)) >= half) {
          if (first < 0) first = y;
          last = y;
          break;
        }
      }
    }
    const up = (base - first) / dpr;
    const down = (last + 1 - base) / dpr;
    if (first >= 0 && up > 0.3 * em && up < 1.2 * em && down > -0.3 * em && down < 0.6 * em) return { up, down };
    return { up: m.actualBoundingBoxAscent / dpr, down: m.actualBoundingBoxDescent / dpr };
  };
  const baseline = (el: HTMLElement) => {
    el.append(probe);
    const y = probe.getBoundingClientRect().bottom;
    probe.remove();
    return y;
  };
  const fitToBrand = () => {
    if (!inkCtx) return; // (no canvas: the boxes keep shell.css's fallback height, centred on the brand)
    const box = brandText.getBoundingClientRect();
    if (!box.height) return;
    const paper = paperOf(top);
    const inkTop = baseline(brandName) - inkReach(brandName, inkCtx, paper).up;
    const inkBottom = baseline(brandTag) + inkReach(brandTag, inkCtx, paper).down;
    // (three decimals: Chrome lays out in 64ths of a pixel, and a rounded-off hundredth can tip a box's edge into the
    // next device pixel at a scaling like 110 %)
    top.style.setProperty("--ink-top", `${(inkTop - box.top).toFixed(3)}px`);
    top.style.setProperty("--ink-foot", `${(box.bottom - inkBottom).toFixed(3)}px`);
    top.style.setProperty("--ink-h", `${(inkBottom - inkTop).toFixed(3)}px`);
  };
  new ResizeObserver(fitToBrand).observe(brandText);
  void document.fonts?.ready.then(fitToBrand);
  onTheme(fitToBrand);
  const onResolution = () =>
    matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`).addEventListener(
      "change",
      () => {
        fitToBrand();
        onResolution();
      },
      { once: true },
    );
  onResolution();

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
    brandTag.innerHTML = t("brand.tag");
    progressCard.setAttribute("aria-label", t("progress.aria"));
    top.querySelector(".progress-label")!.textContent = t("progress.label");
    track.setAttribute("aria-label", t("progress.track"));
    for (const p of pips) {
      const l = LESSONS.find((x) => x.id === p.dataset.id);
      if (l) p.title = `${lessonNo(l)} ${loc(l).title}`;
    }
    paintProgress();
    paintLinks();
    fitToBrand();
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
