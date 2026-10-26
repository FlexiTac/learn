// Lesson page: stage (figure / widget / media) + guided steps, right panel with tabs, "Try it yourself", lesson strip.
// A language switch (src/i18n) repaints the words in place and keeps the rest: the guided step on show and the figure's
// pose (the figure gets setLang: a live act, never a reload unless it cannot switch live), the widget (ctx.onLang), the
// open tab, the code card's values and output, an open detail window. Only the panel's text, the strip and the steps
// bar's words are drawn again.
import { FigureHost, type FigureMode, type FigureStatus } from "../figure/FigureHost";
import { lang, loc, onLang, t } from "../i18n";
import { onTheme, reducedMotion, theme } from "../state/theme";
import { load, update } from "../state/store";
import type { DemoId, Lesson, LessonCtx, StageId, WidgetInstance } from "../types";
import { loadWidget } from "../widgets";
import { badge, sourceChips, specRows } from "../ui/bits";
import { codeCard, type CodeCard } from "../ui/codecard";
import { enhanceDfns } from "../ui/dfn";
import { esc, h } from "../ui/dom";
import { icon } from "../ui/icons";
import { demoHost, whenReady, type DemoHost } from "../ui/demo";
import { detailsWindow } from "../ui/details";
import { lc } from "../ui/lessoncolor";
import { quiz } from "../ui/quiz";
import { openingStep, stepsBar, type StepsBar } from "../ui/steps";
import { lessonStrip } from "../ui/strip";
import { stageCard, type StageCard } from "../ui/stagecard";
import { lessonNo } from "../lessons";

type TabId = "overview" | "parts" | "wiring" | "code" | "specs";
const TABS: { id: TabId; label: "tab.overview" | "tab.parts" | "tab.wiring" | "tab.code" | "tab.specs" }[] = [
  { id: "overview", label: "tab.overview" },
  { id: "parts", label: "tab.parts" },
  { id: "wiring", label: "tab.wiring" },
  { id: "code", label: "tab.code" },
  { id: "specs", label: "tab.specs" },
];

/** Stacked layouts (one column; the window scrolls): a step change can change the stage's height above the steps bar
 *  (a step that hides the widget, GuidedStep.widget false; a demo card under the figure that comes a moment later). The
 *  learner's finger is on the bar, so for a short while after they use it (a dot, Show me / Next step, restart) the
 *  bar never leaves the screen: when the stage above it shrinks, the bar stays where it was (the page scrolls up by as
 *  much, so what the step shows sits right above the bar); when it grows, the bar moves down only as far as the
 *  bottom of the window, so as much of the figure as fits stays in view (the figure pauses off screen). A scroll of
 *  their own (wheel, touch, keys) lets go at once. Desktop stages have a fixed height, so nothing moves there.
 *  Returns a disposer. */
function keepBarInPlace(stage: HTMLElement, bar: HTMLElement): () => void {
  const wide = matchMedia("(min-width: 1024px) and (min-height: 640px)");
  const HOLD_MS = 3000;
  let keep: { top: number; until: number } | null = null;
  const hold = () => {
    keep = null;
    if (wide.matches) return;
    const r = bar.getBoundingClientRect();
    if (r.bottom <= 0 || r.top >= innerHeight) return;
    keep = { top: r.top, until: performance.now() + HOLD_MS };
  };
  const adjust = () => {
    if (!keep) return;
    if (performance.now() > keep.until || wide.matches) {
      keep = null;
      return;
    }
    const r = bar.getBoundingClientRect();
    // the window's visible bottom: above the phone's fixed bottom bar (the sidebar, shell.css)
    const side = document.querySelector<HTMLElement>(".sidebar");
    const sr = side && getComputedStyle(side).position === "fixed" ? side.getBoundingClientRect() : null;
    const floor = sr && sr.top > innerHeight / 2 ? sr.top : innerHeight;
    // grew: as low as the window allows (never lower than where it lands, never higher than where it was); shrank:
    // it stays put
    const to = r.top > keep.top ? Math.min(r.top, Math.max(keep.top, floor - r.height - 8)) : keep.top;
    keep.top = to;
    const d = r.top - to;
    if (Math.abs(d) >= 1) window.scrollBy({ top: d, behavior: "instant" });
  };
  const letGo = () => {
    keep = null;
  };
  // capture: measured before the step's own handler changes anything
  bar.addEventListener("click", hold, true);
  const ro = new ResizeObserver(adjust);
  ro.observe(stage);
  addEventListener("wheel", letGo, { passive: true });
  addEventListener("touchmove", letGo, { passive: true });
  addEventListener("keydown", letGo);
  return () => {
    ro.disconnect();
    bar.removeEventListener("click", hold, true);
    removeEventListener("wheel", letGo);
    removeEventListener("touchmove", letGo);
    removeEventListener("keydown", letGo);
  };
}

export function renderLesson(outlet: HTMLElement, lesson: Lesson): () => void {
  const disposers: (() => void)[] = [];
  // Every lesson has its own colour (--ft-lesson-n): CSS maps it onto --accent inside the view.
  const view = h("div", { class: "lesson-view", style: lc(lesson.n), "data-lesson": lesson.n });
  outlet.append(view);

  // ---------------------------------------------------------------- stage
  const stage = h("section", { class: "stage card", "aria-label": t("lesson.stageAria") });
  const stageBody = h("div", { class: "stage-body" });
  stage.append(stageBody);

  let figure: FigureHost | null = null;
  let widget: WidgetInstance | null = null;
  const ctx: LessonCtx = {
    lesson,
    get figure() {
      return figure;
    },
    get widget() {
      return widget;
    },
    theme,
    onTheme(fn) {
      const off = onTheme(fn);
      disposers.push(off);
      return off;
    },
    reducedMotion,
    lang,
    onLang(fn) {
      const off = onLang(fn);
      disposers.push(off);
      return off;
    },
  };

  const split = Boolean(lesson.figure && lesson.widget);
  stageBody.classList.toggle("is-split", split);
  // A step may hide the widget (GuidedStep.widget: false): the split stage then gives the figure
  // the whole stage body for that step. The widget stays mounted, only hidden; the figure refits to its new size (a
  // layout change on a step change, like any resize). Applied before the stage is in the page, so the figure loads at
  // the size of the step the lesson opens on.
  let widgetSlot: HTMLElement | null = null;
  /** The step on show (for Run in a step that hides the widget). */
  let stepNow = 0;
  // A step may also ask the widget for a form of its own (GuidedStep.widgetView -> WidgetInstance.view: lesson 4's frame
  // strip); in a lesson that uses it, a
  // step without one gets the widget's default form. Sent when the step is reached or opened on, and once the widget
  // has mounted (it loads after the steps bar is built).
  const viewing = Boolean(lesson.steps?.some((s) => s.widgetView));
  const showWidgetAt = (k: number) => {
    stepNow = k;
    if (!lesson.widget) return;
    const on = lesson.steps?.[k]?.widget !== false;
    if (widgetSlot) widgetSlot.hidden = !on;
    stageBody.classList.toggle("is-split", split && on);
    if (viewing) widget?.view?.(lesson.steps?.[k]?.widgetView);
  };
  if (split && lesson.figure?.split) {
    // as a ratio against 1fr (0.55 -> 1.222fr : 1fr, the same split): when the figure row sits at its minimum
    // (lesson.css), the widget's flex factor alone must still be >= 1, or the leftover height goes to the readout row
    const f = Math.min(0.8, Math.max(0.3, lesson.figure.split));
    stageBody.style.setProperty("--split-fig", `${(f / (1 - f)).toFixed(3)}fr`);
    stageBody.style.setProperty("--split-widget", "1fr");
    // "stage": the widget row's share of the stage body (default 36 %, the figure gets the rest; lesson.css clamps
    // the row to 260-380 px). Scaled so the default split (1.15 : 1, f = 0.535) maps to that same 36 %.
    stageBody.style.setProperty("--split-widget-share", `${((1 - f) * 77.4).toFixed(1)}%`);
  }

  if (lesson.figure) {
    const slot = h("div", { class: "figure-slot" });
    const status = h("div", { class: "figure-status mono", role: "status" });
    slot.append(status);
    stageBody.append(slot);
    // Desktop/tablet: the stage has a fixed size and the card fills it both ways at natural px ("stage"; the drawing
    // widens its viewBox to the room, so extra width is usable and text stays at its own size). Stacked layouts: the
    // card takes the stage width and tells us its height ("fill"), so phones get the figure's own narrow layout.
    // ("fit", the old desktop mode that zoomed the whole 650 px card, still works in FigureHost but is not used here.)
    const wide = matchMedia("(min-width: 1024px) and (min-height: 640px)");
    const modeNow = (): FigureMode => (wide.matches ? "stage" : "fill");
    figure = new FigureHost(slot, lesson.figure.fig, theme(), { title: t(`fig.title.${lesson.figure.fig}`), mode: modeNow(), reveal: Boolean(lesson.figure.reveal), lang: lang() });
    const host = figure;
    // CSS hook: the split-stage row shares and the duplicate readout depend on the layout (lesson.css)
    stageBody.dataset.figMode = host.currentMode;
    const onWide = () => {
      host.setMode(modeNow());
      stageBody.dataset.figMode = host.currentMode;
    };
    wide.addEventListener("change", onWide);
    disposers.push(() => wide.removeEventListener("change", onWide));
    disposers.push(
      figure.onSize(({ height }) => {
        if (host.currentMode === "fill") slot.style.setProperty("--fig-h", `${height}px`);
      }),
    );
    figure.acts(lesson.figure.initial);
    if (split) {
      // In "fit" the split stage scales the figure card down, so its own readout gets tiny: repeat it here at a legible
      // size. Only "fit" shows it: CSS hides it in "stage" (the card is not scaled; the figure's readout corner is
      // 11-13 px, measured at 1024-2560 px windows) and in the stacked layouts. It stays in the DOM so a layout switch
      // (window resize, setMode) needs no bookkeeping here.
      const read = h("p", { class: "figure-readout", "aria-hidden": "true" });
      stageBody.append(read);
      disposers.push(
        figure.onState((st) => {
          const t = typeof st.readout === "string" ? st.readout : "";
          if (read.textContent !== t) read.textContent = t;
        }),
      );
    }
    const paintStatus = (s: FigureStatus) => {
      slot.dataset.status = s;
      status.textContent = s === "loading" ? t("fig.loading") : s === "no-bridge" ? t("fig.noBridge") : "";
      status.hidden = s === "ready";
    };
    disposers.push(figure.onStatus(paintStatus));
    // a language switch: the figure's own words (figures/EMBED.md, docs/i18n.md "Figures") and its frame's title
    disposers.push(
      onLang((l) => {
        host.setLang(l);
        host.setTitle(t(`fig.title.${host.fig}`));
        paintStatus(host.status);
      }),
    );
    disposers.push(onTheme((t) => figure?.setTheme(t)));
    // Clicking anywhere on the figure focuses the iframe so the figure's own keys work there (and only there).
    figure.iframe.addEventListener("load", () => slot.classList.add("is-loaded"));

    // Explore mode: the figure starts clean (no dots, no labels). A click on a part shows that part's label inside the
    // figure; its "Details ›" link opens the detail window over the right panel (ft:details, below). Nothing here
    // resizes or refits the figure. Reveal mode (lesson 1): the pad starts assembled behind a "Click to expand" hint.
    if (lesson.figure.reveal) host.reveal(true);
  }

  if (lesson.widget) {
    const slot = h("div", { class: "widget-slot" }, `<p class="figure-status mono">${t("widget.loading")}</p>`);
    stageBody.append(slot);
    widgetSlot = slot;
    showWidgetAt(openingStep(lesson));
    // Section 3: the widget is a card in the middle of the stage (Lesson.widgetCard, src/ui/stagecard.ts)
    let card: StageCard | null = null;
    disposers.push(() => card?.destroy());
    loadWidget(lesson.widget)
      .then((mount) => {
        if (!view.isConnected) return;
        slot.innerHTML = "";
        if (lesson.widgetCard && !lesson.figure) card = stageCard(slot, lesson.widget!);
        widget = mount(card ? card.body : slot, { lesson, figure, theme, onTheme: ctx.onTheme, reducedMotion, lang, onLang: ctx.onLang });
        if (viewing) widget.view?.(lesson.steps?.[stepNow]?.widgetView);
        card?.attach(widget);
      })
      .catch((err: Error) => {
        slot.innerHTML = `<p class="figure-status mono">${t("widget.failed", { msg: esc(err.message) })}</p>`;
        console.error(err);
      });
  }

  if (!lesson.figure && !lesson.widget) {
    const media = loc(lesson).media ?? [];
    const L = loc(lesson);
    stageBody.append(
      media.length
        ? h(
            "div",
            { class: "media-grid" },
            media
              .map((m) =>
                m.kind === "video"
                  ? `<figure><video src="${esc(m.src)}" controls preload="metadata" playsinline aria-label="${esc(m.alt)}"></video>${m.caption ? `<figcaption>${esc(m.caption)} ${badge(m.badge)}</figcaption>` : ""}</figure>`
                  : `<figure><img src="${esc(m.src)}" alt="${esc(m.alt)}" loading="lazy">${m.caption ? `<figcaption>${esc(m.caption)} ${badge(m.badge)}</figcaption>` : ""}</figure>`,
              )
              .join(""),
          )
        : h(
            "div",
            { class: "stage-empty" },
            `<span class="stage-empty-icon">${icon(lesson.id === "build-your-own" ? "photo" : lesson.features[0].icon)}</span>
             <p class="mono">${lesson.id === "build-your-own" ? t("stage.buildMedia") : t("stage.noFigure")}</p>
             <p>${esc(L.features.map((f) => f.title).join(" · "))}</p>`,
          ),
    );
  }

  // A step's own picture over the whole stage (GuidedStep.stage; lesson 1 step 1: the robot grasp). It is a widget
  // mounted in a layer over the stage body the first time a step asks for it, and kept (hidden, so its video pauses)
  // until the lesson goes. The figure stays loaded underneath, in the pose the step's acts give it (the next step's),
  // inert and hidden from assistive tech while it is covered. A step change cross-fades: the layer fades in over the
  // figure (which is then hidden), or the figure shows again under the layer as it fades out. Stacked layouts swap the
  // two in the page flow instead (the layer takes its own height there).
  const STAGE_FADE_MS = 320;
  let over: HTMLElement | null = null;
  let overId: StageId | null = null;
  let overInst: WidgetInstance | null = null;
  let overTimer = 0;
  const figSlot = stageBody.querySelector<HTMLElement>(":scope > .figure-slot");
  const showStageAt = (k: number) => {
    const want = lesson.steps?.[k]?.stage ?? null;
    if (want === (over && !over.hidden && over.classList.contains("is-on") ? overId : null)) return;
    clearTimeout(overTimer);
    const fade = reducedMotion() ? 0 : STAGE_FADE_MS;
    if (want) {
      if (!over || overId !== want) {
        overInst?.destroy();
        overInst = null;
        over?.remove();
        overId = want;
        const layer = h("div", { class: "stage-over", "data-stage": want });
        over = layer;
        stageBody.append(layer);
        loadWidget(want)
          .then((mount) => {
            if (!view.isConnected || over !== layer) return;
            overInst = mount(layer, { lesson, figure, theme, onTheme: ctx.onTheme, reducedMotion, lang, onLang: ctx.onLang });
          })
          .catch((err: Error) => {
            layer.innerHTML = `<p class="figure-status mono">${t("stage.failed", { msg: esc(err.message) })}</p>`;
            console.error(err);
          });
      }
      const layer = over;
      layer.hidden = false;
      stageBody.dataset.stage = want;
      // the figure under it: no pointer, no keys, no screen reader while it is covered (it keeps rendering: a hidden
      // frame may be throttled, and the next step must find it settled)
      if (figSlot) {
        figSlot.inert = true;
        figSlot.setAttribute("aria-hidden", "true");
      }
      if (!stage.isConnected) {
        // the lesson opens on this step: the picture is there from the first paint, no fade
        layer.classList.add("is-on");
        stageBody.classList.add("is-over");
        return;
      }
      // (two frames: the layer is laid out at opacity 0 before it fades in)
      requestAnimationFrame(() => requestAnimationFrame(() => over === layer && !layer.hidden && layer.classList.add("is-on")));
      // (a marker once the figure is fully covered)
      overTimer = window.setTimeout(() => stageBody.classList.add("is-over"), fade);
    } else {
      delete stageBody.dataset.stage;
      stageBody.classList.remove("is-over");
      if (figSlot) {
        figSlot.inert = false;
        figSlot.removeAttribute("aria-hidden");
      }
      if (!over) return;
      const layer = over;
      layer.classList.remove("is-on");
      overTimer = window.setTimeout(() => {
        if (!layer.classList.contains("is-on")) layer.hidden = true;
      }, fade);
    }
  };
  if (lesson.steps?.some((s) => s.stage)) {
    showStageAt(openingStep(lesson));
    disposers.push(() => {
      clearTimeout(overTimer);
      overInst?.destroy();
    });
  }

  const onComplete = () => {
    stage.classList.add("just-done");
    setTimeout(() => stage.classList.remove("just-done"), 1600);
    view.querySelector(".lesson-done-chip")?.removeAttribute("hidden");
  };
  // A step's demo card (GuidedStep.demo) opens once that step's acts have played and the figure shows the pose the card
  // belongs with (src/ui/demo.ts whenReady: the label up for velostat), and goes away when the step changes or the
  // learner closes it (× / Escape; a band the figure keeps for it stays until the step changes, so the figure moves only
  // on a step change). A card for a step that labels a part (its `select` act) belongs to that part; any other card
  // belongs to the step's own pose (nothing picked: lesson 2's ring). While the learner has another part picked, the
  // card steps aside and comes back when the step's part (or nothing) is picked again; the figure is told
  // (FigureHost.bandCard), so that part's labels (e.g. an FPC's on the left and its gold-finger label on the right) may
  // use the band from their first frame, while the camera keeps it. The host is created below, once the panel exists.
  let demos: DemoHost | null = null;
  let demoWant: DemoId | null = null;
  let demoPart: string | null = null;
  let cancelDemoWait: (() => void) | null = null;
  const syncDemo = () => {
    cancelDemoWait?.();
    cancelDemoWait = null;
    // the figure keeps its labels out of the band only while the card is in it: nothing (or the step's part) picked
    figure?.bandCard(demoWant ? { part: demoPart } : false);
    const other = Boolean(figure?.picked && figure.picked.id !== demoPart);
    const id = demoWant && !other ? demoWant : null;
    if (!id) return demos?.hide();
    if (demos?.showing === id) return;
    cancelDemoWait = whenReady(id, figure, () => {
      cancelDemoWait = null;
      demos?.show(id);
    });
  };
  const onStep = (k: number, on: boolean) => {
    showWidgetAt(k);
    if (over || lesson.steps?.[k]?.stage) showStageAt(k);
    const step = lesson.steps?.[k];
    demoWant = (on && step?.demo) || null;
    const sel = (Array.isArray(step?.act) ? step.act : step?.act ? [step.act] : []).find((a) => a.name === "select");
    demoPart = demoWant && typeof sel?.arg === "string" ? sel.arg : null;
    // the figure makes room for the card now, with the step's acts (one movement), and gives it back on step exit
    demos?.want(demoWant);
    syncDemo();
  };
  if (figure && lesson.steps?.some((s) => s.demo)) disposers.push(figure.onPick(() => demoWant && syncDemo()));
  disposers.push(() => cancelDemoWait?.());
  let bar: StepsBar | null = null;
  if (lesson.steps?.length) {
    bar = stepsBar(lesson, figure, onComplete, onStep);
    stage.append(bar);
    disposers.push(keepBarInPlace(stage, bar));
  }

  // ---------------------------------------------------------------- right panel
  const panel = h("div", { class: "panel" });
  const info = h("section", { class: "card info-card", "aria-label": t("lesson.panelAria") });
  const savedTab = (load().tab?.[lesson.id] as TabId | undefined) ?? "overview";
  const has: Record<TabId, boolean> = { overview: true, parts: Boolean(lesson.parts), wiring: Boolean(lesson.wiring), code: Boolean(lesson.code), specs: true };
  let active: TabId = has[savedTab] ? savedTab : "overview";
  const pane = (id: TabId) => info.querySelector<HTMLElement>(`#pane-${id}`)!;

  const select = (id: TabId, focus = false) => {
    active = id;
    for (const tb of info.querySelectorAll<HTMLButtonElement>("[role=tab]")) {
      const on = tb.dataset.tab === id;
      tb.setAttribute("aria-selected", String(on));
      tb.tabIndex = on ? 0 : -1;
      tb.classList.toggle("is-active", on);
      if (on && focus) tb.focus();
    }
    for (const tb of TABS) pane(tb.id).hidden = tb.id !== id;
    update((s) => ((s.tab ??= {})[lesson.id] = id));
  };

  // The panel's words, in the site's language (loc: the lesson's Chinese file over the English). Painted once, and
  // again after a language switch (the open tab, its scroll and the reading fold stay).
  let offDfns: (() => void) | null = null;
  disposers.push(() => offDfns?.());
  const paintInfo = () => {
    const L = loc(lesson);
    const reading = panel.classList.contains("is-reading");
    info.setAttribute("aria-label", t("lesson.panelAria"));
    info.innerHTML = `
    <div class="tabs-row"><div class="tabs" role="tablist" aria-label="${t("lesson.tabsAria")}">
      ${TABS.map(
        // a lesson shows only the tabs it has content for (lesson 1: Overview and Specs)
        (tb) => `<button type="button" role="tab" id="tab-${tb.id}" aria-controls="pane-${tb.id}" data-tab="${tb.id}" class="tab"${has[tb.id] ? "" : " hidden"}>${t(tb.label)}</button>`,
      ).join("")}
      </div><button type="button" class="read-toggle" aria-pressed="${reading}" title="${t(reading ? "read.unfold" : "read.fold")}" aria-label="${t("read.foldAria")}">${icon("chevron")}</button></div>
    ${TABS.map((tb) => `<div class="pane" role="tabpanel" id="pane-${tb.id}" aria-labelledby="tab-${tb.id}" tabindex="0" hidden></div>`).join("")}`;

    // Overview
    pane("overview").innerHTML = `
    <p class="kicker lesson-kicker mono"><span class="lesson-num" aria-hidden="true">${lessonNo(lesson)}</span>${t("lesson.kicker", { no: lessonNo(lesson), kicker: esc(L.kicker) })} ${lesson.status === "draft" ? `<span class="badge badge-draft">${t("badge.draft")}</span>` : ""}
      <span class="lesson-done-chip" ${load().done.includes(lesson.id) ? "" : "hidden"}>${icon("check")} ${t("state.done")}</span></p>
    <h1 class="lesson-title">${esc(L.title)}</h1>
    <p class="lede">${L.lede}</p>
    <ul class="features">
      ${L.features.map((f) => `<li class="feature"><span class="feature-icon">${icon(f.icon)}</span><span><b>${esc(f.title)}</b><span>${f.text}</span></span></li>`).join("")}
    </ul>
    <div class="prose">${L.overview}</div>`;
    if (L.quiz?.length) pane("overview").append(quiz(lesson, onComplete));

    // Parts (Lesson 2.1: what the build needs)
    pane("parts").innerHTML = L.parts
      ? `${L.parts.intro ? `<p class="prose">${L.parts.intro}</p>` : ""}
       <div class="table-wrap"><table class="pin-table parts-table">
         <thead><tr><th scope="col">${t("parts.part")}</th><th scope="col">${t("parts.qty")}</th><th scope="col">${t("parts.note")}</th></tr></thead>
         <tbody>${L.parts.rows
           .map((r) => `<tr><td>${r.name} ${badge(r.badge)}</td><td>${esc(r.qty)}</td><td>${esc(r.note)}${r.src ? `<span class="chips" aria-label="${t("sources.aria")}">${sourceChips(r.src)}</span>` : ""}</td></tr>`)
           .join("")}</tbody>
       </table></div>
       ${L.parts.foot ? `<p class="foot">${L.parts.foot}</p>` : ""}`
      : `<p class="empty">${t("parts.none")}</p>`;

    // Wiring
    pane("wiring").innerHTML = L.wiring
      ? `${L.wiring.intro ? `<p class="prose">${L.wiring.intro}</p>` : ""}
       <div class="table-wrap"><table class="pin-table">
         <thead><tr><th scope="col">${t("wiring.from")}</th><th scope="col">${t("wiring.to")}</th><th scope="col">${t("wiring.note")}</th></tr></thead>
         <tbody>${L.wiring.rows
           .map((r) => `<tr><td>${esc(r.from)}</td><td>${esc(r.to)}</td><td>${esc(r.note)} ${badge(r.badge)}</td></tr>`)
           .join("")}</tbody>
       </table></div>
       ${L.wiring.foot ? `<p class="foot">${L.wiring.foot}</p>` : ""}`
      : `<p class="empty">${t("wiring.none")}</p>`;

    // Code notes
    pane("code").innerHTML = L.code
      ? `<p class="prose">${t("code.what")}</p>
       <ol class="code-notes">${(L.code.notes ?? []).map((n) => `<li>${n}</li>`).join("")}</ol>`
      : `<p class="empty">${t("code.none")}</p>`;

    // Specs
    pane("specs").innerHTML = `${specRows(L.specs)}
    <p class="foot">${t("specs.foot")}
      ${badge("inferred")} ${t("specs.inferred")} · ${badge("illustrative")} ${t("specs.illustrative")} · ${badge("external")} ${t("specs.external")}${L.specs.some((x) => x.badge === "proposed") || L.parts?.rows.some((r) => r.badge === "proposed") ? ` · ${badge("proposed")} ${t("specs.proposed")}` : ""}${t("specs.end")}</p>`;

    offDfns?.();
    offDfns = enhanceDfns(info);
    info.querySelector<HTMLButtonElement>(".read-toggle")!.hidden = !lesson.code;
  };
  paintInfo();

  // (delegated: the panel's buttons are drawn again after a language switch)
  info.addEventListener("click", (e) => {
    const tb = (e.target as HTMLElement).closest<HTMLElement>("[role=tab]");
    if (tb) select(tb.dataset.tab as TabId);
    const readBtn = (e.target as HTMLElement).closest<HTMLButtonElement>(".read-toggle");
    if (readBtn) {
      const on = !panel.classList.contains("is-reading");
      panel.classList.toggle("is-reading", on);
      readBtn.setAttribute("aria-pressed", String(on));
      readBtn.title = t(on ? "read.unfold" : "read.fold");
    }
  });
  info.addEventListener("keydown", (e) => {
    if (!(e.target as HTMLElement).closest(".tabs")) return;
    const k = (e as KeyboardEvent).key;
    const shown = TABS.filter((tb) => has[tb.id]);
    const i = shown.findIndex((tb) => tb.id === active);
    const n = shown.length;
    const to = k === "ArrowRight" ? (i + 1) % n : k === "ArrowLeft" ? (i + n - 1) % n : k === "Home" ? 0 : k === "End" ? n - 1 : -1;
    if (to < 0) return;
    e.preventDefault();
    select(shown[to].id, true);
  });
  select(active);
  panel.append(info);

  // Try it yourself
  let card: CodeCard | null = null;
  if (lesson.code) {
    const code = lesson.code;
    const canRun = Boolean(code.run || lesson.widget);
    card = codeCard(lesson, loc(lesson).code ?? code, {
      canRun,
      onRun: (values) => {
        const lines: string[] = [];
        const a = code.run?.(values, ctx);
        if (a) lines.push(...(Array.isArray(a) ? a : [a]));
        const b = widget?.run?.(values);
        if (b) lines.push(...(Array.isArray(b) ? b : [b]));
        // a step that hides the widget (GuidedStep.widget false): the widget still takes the values, and says when it shows them
        if (widget?.run && widgetSlot?.hidden) {
          const next = (lesson.steps ?? []).findIndex((s, k) => k > stepNow && s.widget !== false);
          const name = (lesson.widget ?? "widget").replace(/-/g, " ");
          lines.push(next >= 0 ? t("run.drawsFrom", { name, n: next + 1, title: loc(lesson).steps![next].title }) : t("run.hidden", { name }));
        }
        if (!figure && !widget && !code.run) lines.push(t("run.nothing"));
        return lines;
      },
      // a language switch: the same lines in the new language, from the parts that can say them without running
      onSay: (values) => {
        const lines: string[] = [];
        const add = (x: string | string[] | void) => {
          if (x) lines.push(...(Array.isArray(x) ? x : [x]));
        };
        if (code.run) {
          if (!code.pureRun) return null;
          add(code.run(values, ctx));
        }
        if (widget?.run) {
          if (!widget.say) return null;
          add(widget.say(values));
          if (widgetSlot?.hidden) {
            const next = (lesson.steps ?? []).findIndex((s, k) => k > stepNow && s.widget !== false);
            const name = (lesson.widget ?? "widget").replace(/-/g, " ");
            lines.push(next >= 0 ? t("run.drawsFrom", { name, n: next + 1, title: loc(lesson).steps![next].title }) : t("run.hidden", { name }));
          }
        }
        if (!figure && !widget && !code.run) lines.push(t("run.nothing"));
        return lines;
      },
    });
    panel.append(card.el);
  }

  let strip = lessonStrip(lesson);
  view.append(stage, panel, strip);
  if (lesson.steps?.some((s) => s.demo)) {
    const host = demoHost({ stage, stageBody }, ctx, () => {
      // closed by the learner: stays closed until the step changes (the band stays, and the figure's labels may use it)
      demoWant = null;
      cancelDemoWait?.();
      cancelDemoWait = null;
      figure?.bandCard(false);
    });
    demos = host;
    disposers.push(() => host.destroy());
  }
  // "Details ›" under a part's label in the figure: a floating window over this panel (a bottom sheet when stacked).
  const details = figure ? detailsWindow(panel, figure, lesson) : null;
  if (details) disposers.push(() => details.destroy());

  // A language switch: the words again, in place (the header of this file says what stays).
  disposers.push(
    onLang(() => {
      stage.setAttribute("aria-label", t("lesson.stageAria"));
      // the open pane keeps its place (as a share of its height: the new words are longer or shorter)
      const open = pane(active);
      const room = open.scrollHeight - open.clientHeight;
      const at = room > 0 ? open.scrollTop / room : 0;
      const focusTab = info.contains(document.activeElement) && (document.activeElement as HTMLElement).matches("[role=tab]");
      paintInfo();
      select(active, focusTab);
      const now = pane(active);
      now.scrollTop = at * Math.max(0, now.scrollHeight - now.clientHeight);
      bar?.relabel();
      if (card && lesson.code) card.relabel(loc(lesson).code ?? lesson.code);
      details?.relabel();
      const next = lessonStrip(lesson);
      strip.replaceWith(next);
      strip = next;
      const ws = stageBody.querySelector<HTMLElement>(".widget-slot > .figure-status");
      if (ws && !widget) ws.textContent = t("widget.loading");
    }),
  );

  return () => {
    for (const d of disposers) d();
    card?.destroy();
    widget?.destroy();
    figure?.destroy();
  };
}
