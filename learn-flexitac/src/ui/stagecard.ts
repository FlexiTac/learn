// Stage card (Lesson.widgetCard; Section 3): a lesson without a figure whose widget is one of the simulation cards
// (src/widgets/sim-*.ts, built for the demo cards' frame, src/styles/demo.css) shows it as a card in the middle of the
// stage: the demo cards' frame and lesson-colour band, no close button (the card IS the lesson's picture). The card is
// as large as the stage allows: its height budget is the stage body's height less a margin, its width the stage's width
// less a margin, kept to a comfortable ratio of that height (the cards are drawings with text under them, a little
// wider than tall) and to MAX_W. The card is laid out in its forms, as demo.ts does, until it fits the budget: "full",
// "compact" (it drops .demo-extra; the step text says the same) and "short" (a short stage); if even that is too tall, a
// narrower card. Again on every resize of the stage. Stacked layouts (the stage takes its content's height) give no
// height budget: the card takes the stage's width (at most MAX_W) and its own height.
//
// The cards read their budget two ways (see their headers): sim-points / sim-springs / sim-playground from data-max-h
// on the card (and data-compact / data-short), sim-loop / sim-calibrate / sim-results from fit(maxH).
import { onLang, t } from "../i18n";
import type { WidgetInstance } from "../types";
import { h } from "./dom";

/** Gap kept round the card in the stage (px); a narrow stage keeps less. */
const MARGIN = 20;
const MARGIN_NARROW = 10;
/** The widest card (px): wider than this, the cards' text lines get long and their drawings no better. */
const MAX_W = 920;
/** The narrowest card it tries before giving up shrinking (the cards' "medium" forms start lower). */
const MIN_W = 380;
/** Width : height the card aims for when the stage is wider than that (most cards read best a little wider than tall). */
const ASPECT = 1.22;

type Form = "full" | "compact" | "short";
type Fittable = WidgetInstance & { fit?(maxH: number | null): void };

export interface StageCard {
  /** Mount the widget in this. */
  body: HTMLElement;
  /** The widget is mounted: lay the card out now and on every resize. */
  attach(inst: WidgetInstance): void;
  destroy(): void;
}

export function stageCard(slot: HTMLElement, id: string): StageCard {
  slot.classList.add("has-card");
  const wrap = h("div", { class: "stage-card-wrap" });
  const card = h("aside", { class: "demo-card stage-card is-on", "data-place": "stage", "data-demo": id, "aria-label": t("stagecard.aria") });
  const body = h("div", { class: "demo-body" });
  card.append(body);
  wrap.append(card);
  slot.append(wrap);
  let inst: Fittable | null = null;
  let raf = 0;
  let last = "";

  const setForm = (f: Form) => {
    card.toggleAttribute("data-compact", f !== "full");
    card.toggleAttribute("data-short", f === "short");
  };

  const layout = () => {
    raf = 0;
    if (!inst || !slot.isConnected) return;
    const W = slot.clientWidth;
    const H = slot.clientHeight;
    if (W < 40) return;
    // a stacked stage has no height of its own (the slot grows with the card): no budget
    const fixed = getComputedStyle(slot).getPropertyValue("--stage-card-fixed").trim() !== "0";
    const m = W < 640 ? MARGIN_NARROW : MARGIN;
    const maxH = fixed && H > 120 ? H - 2 * m : 0;
    const key = `${W}x${H}x${maxH}`;
    if (key === last) return;
    last = key;
    let w = Math.min(W - 2 * m, MAX_W, maxH ? Math.round(maxH * ASPECT) : Infinity);
    w = Math.max(Math.min(MIN_W, W - 2 * m), w);
    const tryAt = (width: number): boolean => {
      card.style.width = `${width}px`;
      if (!maxH) {
        delete card.dataset.maxH;
        setForm("full");
        inst!.fit?.(null);
        inst!.layout?.();
        return true;
      }
      card.dataset.maxH = String(maxH);
      for (const f of ["full", "compact", "short"] as Form[]) {
        setForm(f);
        // (the card's border is 1 px each side: its content may take 2 px less than the budget)
        inst!.fit?.(maxH - 2);
        inst!.layout?.();
        if (card.offsetHeight <= maxH) return true;
      }
      return false;
    };
    // narrower, in steps, while even the short form is too tall (never under MIN_W)
    while (!tryAt(w) && w > MIN_W) w = Math.max(MIN_W, Math.round(w * 0.9));
  };
  const soon = () => {
    if (!raf) raf = requestAnimationFrame(layout);
  };
  const ro = new ResizeObserver(soon);
  ro.observe(slot);
  // a language switch can change the card's height (its words): label it again and lay it out again
  const offLang = onLang(() => {
    card.setAttribute("aria-label", t("stagecard.aria"));
    last = "";
    soon();
  });

  return {
    body,
    attach(i) {
      inst = i as Fittable;
      last = "";
      layout();
      // (once more after the fonts are in: the cards measure their text)
      document.fonts?.ready.then(() => {
        last = "";
        soon();
      });
    },
    destroy() {
      offLang();
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
    },
  };
}
