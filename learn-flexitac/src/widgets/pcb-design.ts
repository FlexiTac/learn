// PCB design: how the reading board was made (lesson 2.5, steps 2-4), a picture that fills the whole stage
// (GuidedStep.stage "pcb-design"; views/lesson.ts gives it each step's widgetView through view()). Three forms, one
// at a time, cross-faded:
//   {view: "schematic"}  the circuit: a simplified schematic drawn from shared/data/board.json (choose a part to see its
//                        wires), or the real EasyEDA page, pannable and zoomable, with R1's mistaken "20k" marked
//                        (./pcb/sch.ts)
//   {view: "layout"}     the real board's copper from board.json: both layers, vias, pads, the parts' outlines, the
//                        Nano over U4 and U5; layer buttons; "Before the copper" (the ratlines); pointing at a trace
//                        names its net (./pcb/board.ts). {net: "D3_CLK"} opens it with that net lit.
//   {view: "order"}      from the design files to a board: export, factory, by hand, flash (./pcb/order.ts)
// Each form opens clean (nothing chosen, its first sub-form) whenever a step shows it. Light and dark come from CSS
// (every colour is a token in pcb-design.css; the realistic pictures in the order view swap on ctx.onTheme), the words
// from ./pcb/words.ts (repainted in place on ctx.onLang). Under reduced motion the forms switch and zoom at once.
// Layout: the box it is mounted in (the stage, or a phone's stage height from lesson.css); a ResizeObserver lays the
// drawings out again. No animation loop runs.
import { COLS, ROWS } from "@shared/data/constants.mjs";
import { paintText } from "../i18n/paint";
import type { WidgetCtx, WidgetInstance } from "../types";
import { boardView } from "./pcb/board";
import { orderView } from "./pcb/order";
import { schView } from "./pcb/sch";
import { S } from "./pcb/words";
import "./pcb-design.css";

type View = "schematic" | "layout" | "order";
const VIEWS: View[] = ["schematic", "layout", "order"];

export function mount(el: HTMLElement, ctx: WidgetCtx): WidgetInstance {
  const coarse = matchMedia("(hover: none), (pointer: coarse)");
  const touch = () => coarse.matches;
  const root = document.createElement("div");
  root.className = "pcb";
  if (ctx.reducedMotion()) root.classList.add("is-reduced");
  root.setAttribute("role", "region");
  root.setAttribute("aria-label", S().aria);
  root.dataset.tAria = "aria";

  const sch = schView({ reducedMotion: ctx.reducedMotion, touch });
  const lay = boardView({ reducedMotion: ctx.reducedMotion, touch });
  const ord = orderView({ theme: ctx.theme, touch });
  const parts = { schematic: sch, layout: lay, order: ord };
  root.append(sch.el, lay.el, ord.el);
  el.append(root);

  let view: View | null = null;
  const layout = () => {
    sch.layout();
    lay.layout();
  };
  const show = (v: View, net: string | null = null) => {
    view = v;
    root.dataset.view = v;
    for (const k of VIEWS) {
      const on = k === v;
      const p = parts[k].el;
      p.classList.toggle("is-on", on);
      p.inert = !on;
      if (on) p.removeAttribute("aria-hidden");
      else p.setAttribute("aria-hidden", "true");
    }
    if (v === "layout") lay.reset(net);
    else parts[v].reset();
    requestAnimationFrame(layout);
  };
  show("schematic");

  const ro = new ResizeObserver(() => layout());
  ro.observe(root);
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "Escape" || !view) return;
    if (parts[view].escape()) e.stopPropagation();
  };
  root.addEventListener("keydown", onKey);
  const relabel = () => {
    paintText(root, S(), { cols: COLS, rows: ROWS });
    sch.relabel();
    lay.relabel();
    ord.relabel();
  };
  const offLang = ctx.onLang(relabel);
  const offTheme = ctx.onTheme((t) => ord.setTheme(t));
  const onCoarse = () => relabel();
  coarse.addEventListener("change", onCoarse);

  return {
    view(v) {
      const want = typeof v?.view === "string" && (VIEWS as string[]).includes(v.view) ? (v.view as View) : "schematic";
      show(want, typeof v?.net === "string" ? v.net : null);
    },
    layout,
    destroy() {
      ro.disconnect();
      offLang();
      offTheme();
      coarse.removeEventListener("change", onCoarse);
      root.removeEventListener("keydown", onKey);
      sch.destroy();
      lay.destroy();
      ord.destroy();
      root.remove();
    },
  };
}
