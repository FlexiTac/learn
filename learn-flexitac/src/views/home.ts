// Home: the hero (the robot grasp), then the course's three sections, each a title and its three chapters as cards with
// a cover picture (2026-10-25, PLAN-section2-3.md §4).
import { lang, loc, locSection, onLang, t } from "../i18n";
import { byId, chapterLessons, chapterRange, LESSONS, lessonNo, SECTIONS } from "../lessons";
import { load } from "../state/store";
import { onTheme, reducedMotion, theme } from "../state/theme";
import type { Chapter, CoverLoop, Section, Theme, WidgetCtx, WidgetInstance } from "../types";
import { esc, h } from "../ui/dom";
import { icon } from "../ui/icons";
import { lc } from "../ui/lessoncolor";
import { figThumb } from "../ui/thumbs";

// Chapter covers (src/lessons/index.ts SECTIONS, Chapter.cover), each taken from the chapter's own figure or widget:
// Section 1's are short muted loops (LOOPS below: the pad, Fig 1's feel mode; the board, Fig 3 scanning a press; use it,
// the real sensor and its live heatmap from the project video); Sections 2 and 3 have stills in both themes,
// public/media/covers/<name>-{light,dark}.webp, made by scripts/covers.mjs from Fig 5 and the simulation cards. A card
// opens its chapter's first lesson; "Coming next" (no lessons yet) is not a link and is styled as coming soon.
// In Chinese, the stills with words in them (the figure's map titles, the cards' labels) have a Chinese picture,
// <name>-zh-<theme>.webp (scripts/covers.mjs --lang zh); the others are the same in both languages.
const ZH_COVERS = new Set(["mount", "grasp", "points", "springs", "loop"]);
const STILL = (name: string, t: Theme) =>
  `${import.meta.env.BASE_URL}media/covers/${name}${lang() === "zh" && ZH_COVERS.has(name) ? "-zh" : ""}-${t}.webp`;

// The section cards' loops (Chapter.cover.loop), each a file path without its extension (.webm, .mp4 and the .webp
// poster sit side by side). Reduced motion, or a video that cannot play, shows the poster frame (mid-press) instead.
// - pad: Fig 1's feel mode as a 7 s seamless loop (a fingertip presses, slides, lifts and presses again, and the touch
//   map lights at the same height), recorded from the figure's film contract into public/media/cover, one set per
//   theme. (It was the hero cover until the robot grasp took that place, mountRobotCover.)
// - board: Fig 3 in connect mode as Lesson 1.4 step 3 "Press it" shows it, a 7 s seamless loop: the pad plugged into
//   the board, the Nano lifted, the scan at 1/100x (a frame a second: the teal sense line steps across the pad while the
//   pink drive lines shimmer), and a fingertip that presses, drifts, lifts and presses again. The map of readings is
//   left out (it stays in the lesson), so the board and the pad fill the card; public/media/board, one set per theme
//   (flexitac-anatomy/film/board-cover-src).
// - useit: the real sensor and its live heatmap, from the project video (one set for both themes).
const MEDIA = `${import.meta.env.BASE_URL}media/`;
// (the pad's loop has the touch map's title and legend in it: in Chinese, its Chinese recording, cover-zh-<theme>,
// flexitac-anatomy/film/cover-src/make-cover-zh.sh; the board's loop and the footage have no words)
const LOOPS: Record<CoverLoop, (t: Theme) => string> = {
  pad: (t) => `${MEDIA}cover/cover-${lang() === "zh" ? "zh-" : ""}${t}`,
  board: (t) => `${MEDIA}board/board-${t}`,
  useit: () => `${MEDIA}useit/useit`,
};
const WIDE = matchMedia("(min-width: 1024px)"); // the hero figure is shown from this width up (pages.css .hero-fig)
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)");

// A section card's picture (cls "card-cover", any width, played only while the card is on screen): its loop from LOOPS.
// `src` gives a file's path without its extension.
type CoverOpts = { cls: string; wideOnly: boolean; src: (t: Theme) => string };
function mountCover(box: HTMLElement, { cls, wideOnly, src }: CoverOpts): () => void {
  let video: HTMLVideoElement | null = null;
  let onScreen = true;
  let failed = false;
  const poster = (t: Theme) => `${src(t)}.webp`;
  const fail = () => {
    failed = true;
    paint();
  };
  const showPoster = (t: Theme) => {
    if (video) {
      video.pause();
      video.remove();
      video = null;
    }
    let img = box.querySelector<HTMLImageElement>(`img.${cls}`);
    if (!img) {
      img = h("img", { class: cls, alt: "", decoding: "async", loading: "lazy" });
      box.append(img);
    }
    if (img.getAttribute("src") !== poster(t)) img.src = poster(t);
  };
  const showVideo = (t: Theme) => {
    box.querySelector(`img.${cls}`)?.remove();
    if (video?.dataset.src === src(t)) return;
    // a theme switch keeps the loop's place, so only the colours change
    const at = video ? video.currentTime : 0;
    if (!video) {
      box.insertAdjacentHTML("beforeend", `<video class="${cls}" autoplay muted loop playsinline preload="metadata" disablepictureinpicture aria-hidden="true" tabindex="-1"></video>`);
      video = box.querySelector("video")!;
      video.muted = true;
      video.addEventListener("error", fail);
    }
    video.dataset.src = src(t);
    video.poster = poster(t);
    video.innerHTML = `<source src="${src(t)}.webm" type='video/webm; codecs="vp9"'><source src="${src(t)}.mp4" type="video/mp4">`;
    // the last source failing means every source failed
    video.lastElementChild!.addEventListener("error", fail);
    if (at) video.addEventListener("loadedmetadata", () => video && (video.currentTime = at % (video.duration || 7)), { once: true });
    video.load();
    // blocked autoplay (a power saver, a data saver) leaves the poster showing
    if (onScreen) video.play().catch(() => {});
    else video.pause();
  };
  const paint = () => {
    const t = theme();
    if (failed || REDUCED.matches || (wideOnly && !WIDE.matches)) showPoster(t);
    else showVideo(t);
  };
  paint();
  // play only while the box is on screen
  const seen = new IntersectionObserver(([e]) => {
    onScreen = e.isIntersecting;
    if (!video) return;
    if (onScreen) video.play().catch(() => {});
    else video.pause();
  });
  seen.observe(box);
  const offTheme = onTheme(paint);
  REDUCED.addEventListener("change", paint);
  WIDE.addEventListener("change", paint);
  return () => {
    seen.disconnect();
    offTheme();
    REDUCED.removeEventListener("change", paint);
    WIDE.removeEventListener("change", paint);
    video?.pause();
  };
}

// The hero cover: Lesson 1 step 1's robot grasp, live (src/widgets/robot-grasp.ts in its "cover" form): the reBot arm,
// a FlexiTac pad on each finger, picks up a strawberry, and the two pads' touch maps light up beside it in step with
// the video (illustrative). Autoplay, muted, looping, only while on screen and the tab is visible; reduced motion shows
// the poster (the hold moment) and that moment's maps. The widget (and its video and data) loads only where the hero
// picture shows (wide windows, pages.css .hero-fig); a reduced-motion change mounts it again in the other mode. If the
// widget cannot load, the poster stands in.
const ROBOT_POSTER = (t: Theme) => `${import.meta.env.BASE_URL}media/robot/grasp-${t}.webp`;
function mountRobotCover(box: HTMLElement): () => void {
  let inst: WidgetInstance | null = null;
  let loading = false;
  let gone = false;
  // (the widget's language subscriptions end with the page)
  const offLang: (() => void)[] = [];
  const ctx: WidgetCtx = {
    lesson: LESSONS[0],
    figure: null,
    theme,
    onTheme,
    reducedMotion,
    lang,
    onLang: (fn) => {
      const off = onLang(fn);
      offLang.push(off);
      return off;
    },
  };
  const make = () => {
    if (gone || inst || loading || !WIDE.matches) return;
    loading = true;
    import("../widgets/robot-grasp")
      .then(({ mount }) => {
        loading = false;
        if (gone || inst) return;
        box.querySelector("img.hero-cover")?.remove();
        inst = mount(box, ctx, { form: "cover" });
      })
      .catch((err: Error) => {
        loading = false;
        console.error(err);
        if (gone || box.querySelector("img.hero-cover")) return;
        box.append(h("img", { class: "hero-cover", alt: "", decoding: "async", src: ROBOT_POSTER(theme()) }));
      });
  };
  const again = () => {
    inst?.destroy();
    inst = null;
    make();
  };
  make();
  WIDE.addEventListener("change", make);
  REDUCED.addEventListener("change", again);
  const offTheme = onTheme((t) => {
    const img = box.querySelector<HTMLImageElement>("img.hero-cover");
    if (img) img.src = ROBOT_POSTER(t);
  });
  return () => {
    gone = true;
    WIDE.removeEventListener("change", make);
    REDUCED.removeEventListener("change", again);
    offTheme();
    inst?.destroy();
    for (const off of offLang) off();
  };
}

/** One chapter's cover: a figure thumbnail, a loop (mounted by mountCover below) or a still, both themes. */
function coverHtml(c: Chapter): string {
  if ("fig" in c.cover) return figThumb(c.cover.fig, c.alt);
  if ("loop" in c.cover) return "";
  return `<img class="thumb thumb-light" src="${STILL(c.cover.still, "light")}" alt="${esc(c.alt)}" loading="lazy" decoding="async">` +
    `<img class="thumb thumb-dark" src="${STILL(c.cover.still, "dark")}" alt="" aria-hidden="true" loading="lazy" decoding="async">`;
}

/** A chapter's card: its cover, its name and lesson numbers, one or two sentences, its lessons. */
function chapterCard(c: Chapter, done: string[]): string {
  const ls = chapterLessons(c);
  const pic = `<span class="fig-card-img"${"loop" in c.cover ? ` data-card-loop="${c.cover.loop}" role="img" aria-label="${esc(c.alt)}"` : ""}>${coverHtml(c)}</span>`;
  if (!ls.length)
    // Section 2's "Coming next": no lesson yet, so no link
    return `<div class="card fig-card is-soon" role="group" aria-label="${t("home.soonAria", { title: esc(c.title) })}">
      ${pic.replace('<span class="fig-card-img">', `<span class="fig-card-img"><span class="soon-pill mono">${t("home.soonPill")}</span>`)}
      <span class="fig-card-body">
        <span class="kicker mono">${t("home.soonKicker", { title: esc(c.title) })}</span>
        <span class="fig-card-go mono is-soon">${icon("soon")}<span>${t("home.soonPill")}</span></span>
      </span>
    </div>`;
  const first = ls[0];
  return `<a class="card fig-card" href="#/lesson/${first.id}" style="${lc(first.n)}">
    ${pic}
    <span class="fig-card-body">
      <span class="kicker mono">${esc(c.title)} · ${esc(chapterRange(c).toLowerCase())}</span>
      <span class="fig-card-lessons">${ls
        .map(
          (l, i) => `<span class="fig-card-go mono" style="${lc(l.n)}"><span class="lesson-num" aria-hidden="true">${lessonNo(l)}</span><span class="visually-hidden">${t("lesson.noTitle", { no: lessonNo(l) })}</span><span class="fig-card-name">${esc(loc(l).title)}</span>${done.includes(l.id) ? ` <span class="tick" aria-label="${t("state.done")}">${icon("check")}</span>` : i === 0 ? icon("chevron") : ""}</span>`,
        )
        .join("")}</span>
    </span>
  </a>`;
}

/** One section: its title (over a thin band of its lessons' colours), a line about it and its chapters' cards. */
function sectionBlock(sec: Section, done: string[]): string {
  const ls = sec.chapters.flatMap(chapterLessons);
  const n = ls.filter((l) => done.includes(l.id)).length;
  const band = ls.map((l) => `var(--ft-lesson-${l.n})`).join(", ");
  return `<section class="sec-block" aria-labelledby="sec-title-${sec.n}">
    <header class="sec-head" style="--g:linear-gradient(90deg, ${band})">
      <h2 class="sec-title" id="sec-title-${sec.n}"><span class="sec-n mono">${t("section.no", { n: sec.n })}</span><span class="sec-name">${esc(sec.title)}</span></h2>
      <p class="sec-blurb">${esc(sec.blurb)}</p>
      <p class="sec-count mono">${t("home.secCount", { n: ls.length })}${n ? t("home.secDone", { n }) : ""}</p>
    </header>
    <div class="fig-cards">${sec.chapters.map((c) => chapterCard(c, done)).join("")}</div>
  </section>`;
}

export function renderHome(outlet: HTMLElement): () => void {
  // only lessons still in the course count (lessons 4-6 were set aside; old progress may list them); a copy, so the
  // saved progress itself is left alone
  const saved = load();
  const s = { ...saved, done: saved.done.filter((id) => LESSONS.some((l) => l.id === id)) };
  const resume = s.last ? byId(s.last) : undefined;
  const el = h("div", { class: "page home" });
  el.innerHTML = `
    <section class="hero">
      <div class="hero-text">
      <p class="kicker mono">${t("home.kicker", { sections: SECTIONS.length, lessons: LESSONS.length })}</p>
      <h1 class="hero-title">${t("home.title")}</h1>
      <p class="hero-tagline">${t("home.tagline")}</p>
      <ul class="hero-kw" role="list">
        ${(
          [
            ["accessible", "touch"],
            ["customizable", "tools"],
            ["flexible", "layers"],
          ] as const
        )
          .map(([k, ic]) => `<li title="${esc(t(`home.kw.${k}Tip`))}">${icon(ic)}<span>${t(`home.kw.${k}`)}</span></li>`)
          .join("")}
      </ul>
      <p class="hero-stack">${t("home.stack")}</p>
      <div class="hero-actions">
        <a class="btn-primary btn-lg" href="#/lesson/${(resume ?? LESSONS[0]).id}">${icon("play")}<span>${resume && resume !== LESSONS[0] ? t("home.resume", { no: lessonNo(resume) }) : t("home.start", { no: lessonNo(LESSONS[0]) })}</span></a>
        <a class="btn-ghost btn-lg" href="#/lessons">${icon("book")}<span>${t("home.all")}</span></a>
      </div>
      </div>
      <a class="hero-fig" href="#/lesson/${LESSONS[0].id}" aria-label="${esc(t("home.figAria", { no: lessonNo(LESSONS[0]) }))}">
        <div class="hero-fig-img" data-cover></div>
      </a>
    </section>

    <div class="sec-blocks">${SECTIONS.map((sec) => sectionBlock(locSection(sec), s.done)).join("")}</div>`;
  outlet.append(el);
  const offHero = mountRobotCover(el.querySelector<HTMLElement>("[data-cover]")!);
  const offCards = [...el.querySelectorAll<HTMLElement>("[data-card-loop]")].map((box) =>
    mountCover(box, {
      cls: "card-cover",
      wideOnly: false,
      src: LOOPS[box.dataset.cardLoop as CoverLoop],
    }),
  );
  return () => {
    offHero();
    for (const off of offCards) off();
  };
}
