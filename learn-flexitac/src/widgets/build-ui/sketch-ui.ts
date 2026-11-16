// Lesson 2.2's sketch builder (src/widgets/build-bench.ts, step 4): setup() and loop() as two slots in an editor that
// looks like the Arduino IDE's, and the engine's code tiles under them (../build/sketch.ts TRAY: the five a working
// sketch needs and four decoys). A tile is dragged into a slot, between slots, or back to the tiles; its boxes (pin,
// baud, pause) are typed in place, in a slot or not. Keyboard: Space or Enter on a tile picks it up, the arrow keys move
// it one place at a time (through setup(), loop() and back to the tiles), Space or Enter puts it down, Escape puts it
// back where it was. The widget keeps the state (SketchState) and saves it; this file only draws it and reports changes.
// The Hint (./coach.ts) marks a tile, the box to type in, or the line where the tile goes (hint()).
import { esc } from "../../ui/dom";
import { highlight } from "../../ui/highlight";
import { FIELDS, lineOf, pieces, TRAY, type FieldName, type Sketch, type Tile } from "../build/engine";
import { S } from "./words";

export type ListId = "setup" | "loop" | "tray";
/** Where every tile is, and each tile's typed fields (a tile keeps its fields wherever it goes, the tray too). */
export interface SketchState {
  setup: string[];
  loop: string[];
  tiles: Record<string, Tile>;
}

const fresh = (): Record<string, Tile> => Object.fromEntries(TRAY.map((t) => [t.id, { ...t }]));
export const emptyState = (): SketchState => ({ setup: [], loop: [], tiles: fresh() });
/** A state from a sketch (its tiles in the slots, the rest with their first values). */
export function stateOf(s: Sketch, tiles?: Record<string, Tile>): SketchState {
  const all = { ...fresh(), ...(tiles ?? {}) };
  for (const t of [...s.setup, ...s.loop]) all[t.id] = { ...t };
  return { setup: s.setup.map((t) => t.id), loop: s.loop.map((t) => t.id), tiles: all };
}
export const sketchOf = (st: SketchState): Sketch => ({ setup: st.setup.map((id) => st.tiles[id]), loop: st.loop.map((id) => st.tiles[id]) });
const trayIds = (st: SketchState) => TRAY.map((t) => t.id).filter((id) => !st.setup.includes(id) && !st.loop.includes(id));

/** Is this a state the tray can hold (from saved data)? Every id a tile of the tray, each once, each of its own kind. */
export function validState(x: unknown): x is SketchState {
  if (!x || typeof x !== "object") return false;
  const st = x as SketchState;
  if (!Array.isArray(st.setup) || !Array.isArray(st.loop) || !st.tiles || typeof st.tiles !== "object") return false;
  const used = [...st.setup, ...st.loop];
  if (new Set(used).size !== used.length) return false;
  for (const t of TRAY) {
    const s = st.tiles[t.id];
    if (!s || s.id !== t.id || s.kind !== t.kind) return false;
    for (const f of FIELDS[t.kind]) if (typeof s[f] !== "string") return false;
  }
  return used.every((id) => TRAY.some((t) => t.id === id));
}

const LISTS: ListId[] = ["setup", "loop", "tray"];

export interface SketchUi {
  /** Draw the state again (after a change from outside: Show me, undo, reset, load). */
  paint(): void;
  /** Words again in the language on show. */
  relabel(): void;
  /** Mark the tile a compile error points at (null: none). */
  mark(id: string | null): void;
  /** The Hint's marks: a tile, and where it goes (a line in setup() or loop(), or the tiles), or the box to type in. */
  hint(h: { id: string; to?: { list: ListId; index: number }; field?: string } | null): void;
  destroy(): void;
}

export function sketchUi(
  host: HTMLElement,
  opts: { get(): SketchState; set(st: SketchState, how: "move" | "field"): void; announce(text: string): void },
): SketchUi {
  host.innerHTML = `
    <div class="bb-ide" role="group">
      <div class="bb-fn"><p class="bb-sig mono"><span class="t-kw">void</span> <span class="t-fn">setup</span>() {</p><ol class="bb-list" data-list="setup"></ol><p class="bb-sig mono">}</p></div>
      <div class="bb-fn"><p class="bb-sig mono"><span class="t-kw">void</span> <span class="t-fn">loop</span>() {</p><ol class="bb-list" data-list="loop"></ol><p class="bb-sig mono">}</p></div>
    </div>
    <p class="bb-cap mono bb-tiles-cap"></p>
    <ol class="bb-list bb-tray-list" data-list="tray"></ol>
    <div class="bb-insert" aria-hidden="true"></div>
    <div class="bb-insert bb-coach-line" aria-hidden="true"></div>`;
  const ide = host.querySelector<HTMLElement>(".bb-ide")!;
  const lists = Object.fromEntries(LISTS.map((l) => [l, host.querySelector<HTMLOListElement>(`[data-list="${l}"]`)!])) as Record<ListId, HTMLOListElement>;
  const insertEl = host.querySelector<HTMLElement>(".bb-insert:not(.bb-coach-line)")!;
  const coachLine = host.querySelector<HTMLElement>(".bb-coach-line")!;
  let marked: string | null = null;
  let coach: { id: string; to?: { list: ListId; index: number }; field?: string } | null = null;

  const codeOf = (t: Tile) => lineOf(t);
  const tileHtml = (t: Tile): string => {
    const W = S();
    const parts = pieces(t)
      .map((p) => {
        if ("code" in p) return highlight({ lang: "cpp", source: p.code, params: [] }, {});
        const label = W[`field.${p.field}` as "field.pin"];
        const w = Math.max(2, p.value.length);
        return `<input class="bb-field mono" data-field="${p.field}" value="${esc(p.value)}" spellcheck="false" autocomplete="off" aria-label="${esc(label)}" style="--w:${w}ch">`;
      })
      .join("");
    return `<li class="bb-tile${marked === t.id ? " is-error" : ""}" data-tile="${t.id}" tabindex="0" aria-label="${esc(W["tile.aria"].replace("{code}", codeOf(t)))}"><span class="bb-grip" aria-hidden="true"></span><code class="bb-code mono">${parts}</code></li>`;
  };
  const paint = () => {
    const st = opts.get();
    const W = S();
    for (const l of LISTS) {
      const ids = l === "tray" ? trayIds(st) : st[l];
      lists[l].innerHTML = ids.map((id) => tileHtml(st.tiles[id])).join("") + (ids.length ? "" : `<li class="bb-slot-empty" aria-hidden="true">${esc(l === "tray" ? W["tiles.empty"] : W["slot.empty"])}</li>`);
      lists[l].classList.toggle("is-empty", !ids.length);
    }
    paintCoach();
  };
  /** A line where a tile would land: in list t.list before its t.index-th tile (`skip`, the tile itself, not counted). */
  const lineAt = (line: HTMLElement, t: { list: ListId; index: number }, skip: Element | null) => {
    const hr = host.getBoundingClientRect();
    const list = lists[t.list];
    const items = [...list.querySelectorAll<HTMLElement>("[data-tile]")].filter((x) => x !== skip);
    const lr = list.getBoundingClientRect();
    let y: number;
    if (!items.length) y = lr.top + lr.height / 2;
    else if (t.index >= items.length) y = items[items.length - 1].getBoundingClientRect().bottom + 2;
    else y = items[t.index].getBoundingClientRect().top - 2;
    line.style.transform = `translate(${(lr.left - hr.left + 8).toFixed(1)}px, ${(y - hr.top + host.scrollTop - 1).toFixed(1)}px)`;
    line.style.width = `${Math.max(40, lr.width - 16)}px`;
    line.classList.add("is-on");
  };
  const paintCoach = () => {
    host.querySelectorAll(".is-coach").forEach((x) => x.classList.remove("is-coach"));
    for (const l of LISTS) lists[l].classList.remove("is-coach-target");
    coachLine.classList.remove("is-on");
    if (!coach) return;
    const el = host.querySelector<HTMLElement>(`[data-tile="${coach.id}"]`);
    if (!el) return;
    if (coach.field) {
      el.querySelector(`[data-field="${coach.field}"]`)?.classList.add("is-coach");
      return;
    }
    el.classList.add("is-coach");
    if (!coach.to) return;
    // (into the tiles, or into an empty setup() or loop(): the place itself lights up; else a line between two tiles)
    const list = lists[coach.to.list];
    const others = [...list.querySelectorAll("[data-tile]")].filter((x) => x !== el);
    if (coach.to.list === "tray" || !others.length) list.classList.add("is-coach-target");
    else lineAt(coachLine, coach.to, el);
  };
  const relabel = () => {
    const W = S();
    ide.setAttribute("aria-label", W["sketch.aria"]);
    host.querySelector(".bb-tiles-cap")!.textContent = W["tiles.cap"];
    lists.tray.setAttribute("aria-label", W["tiles.aria"]);
    paint();
  };

  // ------------------------------------------------------------------ typing in a box
  const onInput = (e: Event) => {
    const inp = e.target as HTMLInputElement;
    if (!inp.matches(".bb-field")) return;
    const id = inp.closest<HTMLElement>("[data-tile]")!.dataset.tile!;
    const field = inp.dataset.field as FieldName;
    const st = opts.get();
    const tiles = { ...st.tiles, [id]: { ...st.tiles[id], [field]: inp.value } };
    inp.style.setProperty("--w", `${Math.max(2, inp.value.length)}ch`);
    opts.set({ ...st, tiles }, "field");
  };
  host.addEventListener("input", onInput);

  // ------------------------------------------------------------------ moving a tile
  /** Moves a tile into list `to` at `index` (the tray keeps its own order). */
  const moved = (st: SketchState, id: string, to: ListId, index: number): SketchState => {
    const setup = st.setup.filter((x) => x !== id);
    const loop = st.loop.filter((x) => x !== id);
    if (to === "setup") setup.splice(Math.max(0, Math.min(index, setup.length)), 0, id);
    if (to === "loop") loop.splice(Math.max(0, Math.min(index, loop.length)), 0, id);
    return { ...st, setup, loop };
  };
  const whereIs = (st: SketchState, id: string): { list: ListId; index: number } => {
    for (const l of ["setup", "loop"] as const) {
      const i = st[l].indexOf(id);
      if (i >= 0) return { list: l, index: i };
    }
    return { list: "tray", index: 0 };
  };

  // pointer drags (a clone follows the pointer; a line shows where it would land)
  let drag: { id: string; el: HTMLElement; ghost: HTMLElement; dx: number; dy: number; x0: number; y0: number; on: boolean; pid: number } | null = null;
  let target: { list: ListId; index: number } | null = null;
  const dropAt = (x: number, y: number): { list: ListId; index: number } | null => {
    for (const l of LISTS) {
      const r = lists[l].getBoundingClientRect();
      const pad = l === "tray" ? 14 : 10;
      if (x < r.left - 24 || x > r.right + 24 || y < r.top - pad || y > r.bottom + pad) continue;
      const items = [...lists[l].querySelectorAll<HTMLElement>("[data-tile]")].filter((t) => t !== drag?.el);
      let index = items.length;
      for (let i = 0; i < items.length; i++) {
        const b = items[i].getBoundingClientRect();
        if (y < b.top + b.height / 2) {
          index = i;
          break;
        }
      }
      return { list: l, index };
    }
    return null;
  };
  const showInsert = (t: { list: ListId; index: number } | null) => {
    if (!t || t.list === "tray") {
      insertEl.classList.remove("is-on");
      lists.tray.classList.toggle("is-target", t?.list === "tray");
      return;
    }
    lists.tray.classList.remove("is-target");
    lineAt(insertEl, t, drag?.el ?? null);
  };
  const onDown = (e: PointerEvent) => {
    if (e.button !== 0 || drag) return;
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-tile]");
    if (!el || (e.target as HTMLElement).closest("input")) return;
    const r = el.getBoundingClientRect();
    drag = { id: el.dataset.tile!, el, ghost: el, dx: e.clientX - r.left, dy: e.clientY - r.top, x0: e.clientX, y0: e.clientY, on: false, pid: e.pointerId };
    host.setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.pid) return;
    if (!drag.on) {
      if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 5) return;
      drag.on = true;
      const g = drag.el.cloneNode(true) as HTMLElement;
      g.classList.add("bb-tile-float");
      g.removeAttribute("tabindex");
      g.style.width = `${drag.el.getBoundingClientRect().width}px`;
      document.body.append(g);
      drag.ghost = g;
      drag.el.classList.add("is-lifted");
      host.classList.add("is-dragging");
    }
    drag.ghost.style.transform = `translate(${(e.clientX - drag.dx).toFixed(1)}px, ${(e.clientY - drag.dy).toFixed(1)}px)`;
    target = dropAt(e.clientX, e.clientY);
    showInsert(target);
  };
  const endDrag = (commit: boolean) => {
    if (!drag) return;
    const d = drag;
    drag = null;
    host.classList.remove("is-dragging");
    showInsert(null);
    lists.tray.classList.remove("is-target");
    if (!d.on) return;
    d.ghost.remove();
    d.el.classList.remove("is-lifted");
    if (commit && target) {
      const st = opts.get();
      const from = whereIs(st, d.id);
      if (from.list !== target.list || from.index !== target.index) {
        opts.set(moved(st, d.id, target.list, target.index), "move");
        paint();
        focusTile(d.id);
      }
    }
    target = null;
  };
  const onUp = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.pid) return;
    endDrag(true);
  };
  const onCancel = () => endDrag(false);
  host.addEventListener("pointerdown", onDown);
  host.addEventListener("pointermove", onMove);
  host.addEventListener("pointerup", onUp);
  host.addEventListener("pointercancel", onCancel);

  // keyboard: lift, move one place at a time, put down
  let lifted: { id: string; from: SketchState } | null = null;
  const focusTile = (id: string) => host.querySelector<HTMLElement>(`[data-tile="${id}"]`)?.focus({ preventScroll: false });
  /** Every place a tile can be, in reading order: setup 0..n, loop 0..m, then the tiles. */
  const places = (st: SketchState, id: string): { list: ListId; index: number }[] => {
    const s = st.setup.filter((x) => x !== id).length;
    const l = st.loop.filter((x) => x !== id).length;
    return [...Array.from({ length: s + 1 }, (_, i) => ({ list: "setup" as const, index: i })), ...Array.from({ length: l + 1 }, (_, i) => ({ list: "loop" as const, index: i })), { list: "tray" as const, index: 0 }];
  };
  const sayPlace = (st: SketchState, id: string) => {
    const w = whereIs(st, id);
    const W = S();
    opts.announce(w.list === "tray" ? W["live.tray"] : W["live.in"].replace("{fn}", `${w.list}()`).replace("{n}", String(w.index + 1)));
  };
  const onKey = (e: KeyboardEvent) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-tile]");
    if (!el || (e.target as HTMLElement).closest("input")) return;
    const id = el.dataset.tile!;
    const W = S();
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (lifted && lifted.id === id) {
        lifted = null;
        el.classList.remove("is-held");
        opts.announce(W["live.drop"]);
      } else {
        lifted = { id, from: opts.get() };
        el.classList.add("is-held");
        opts.announce(`${W["live.lift"].replace("{code}", codeOf(opts.get().tiles[id]))}.`);
      }
      return;
    }
    if (e.key === "Escape" && lifted) {
      e.preventDefault();
      const back = lifted.from;
      lifted = null;
      opts.set(back, "move");
      paint();
      focusTile(id);
      sayPlace(back, id);
      return;
    }
    if ((e.key === "ArrowUp" || e.key === "ArrowDown") && lifted?.id === id) {
      e.preventDefault();
      const st = opts.get();
      const all = places(st, id);
      const w = whereIs(st, id);
      const i = all.findIndex((p) => p.list === w.list && p.index === w.index);
      const j = Math.max(0, Math.min(all.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)));
      if (j === i) return;
      const next = moved(st, id, all[j].list, all[j].index);
      opts.set(next, "move");
      paint();
      host.querySelector(`[data-tile="${id}"]`)?.classList.add("is-held");
      focusTile(id);
      sayPlace(next, id);
    }
  };
  host.addEventListener("keydown", onKey);
  const onBlur = (e: FocusEvent) => {
    // (focus leaving a held tile puts it down where it is; checked a moment later, because an arrow move repaints the
    // list, which takes the focused tile away and gives focus back to its new copy)
    const el = (e.target as HTMLElement).closest?.<HTMLElement>("[data-tile]");
    if (!lifted || !el || el.dataset.tile !== lifted.id) return;
    const id = lifted.id;
    window.setTimeout(() => {
      const a = document.activeElement as HTMLElement | null;
      if (lifted?.id !== id || (a?.matches?.("[data-tile]") && a.dataset.tile === id && host.contains(a))) return;
      lifted = null;
      host.querySelector(`[data-tile="${id}"]`)?.classList.remove("is-held");
    });
  };
  host.addEventListener("focusout", onBlur);

  relabel();
  return {
    paint() {
      // (a repaint while a box has focus would drop the caret: keep it there)
      const a = document.activeElement as HTMLElement | null;
      const inField = a?.matches?.(".bb-field") && host.contains(a) ? { id: a.closest<HTMLElement>("[data-tile]")!.dataset.tile!, f: a.dataset.field!, pos: (a as HTMLInputElement).selectionStart } : null;
      const onTile = a?.matches?.("[data-tile]") && host.contains(a) ? a.dataset.tile! : null;
      paint();
      if (inField) {
        const inp = host.querySelector<HTMLInputElement>(`[data-tile="${inField.id}"] [data-field="${inField.f}"]`);
        inp?.focus();
        if (inp && inField.pos !== null) inp.setSelectionRange(inField.pos, inField.pos);
      } else if (onTile) focusTile(onTile);
    },
    relabel,
    mark(id) {
      marked = id;
      host.querySelectorAll(".bb-tile.is-error").forEach((x) => x.classList.remove("is-error"));
      if (id) host.querySelector(`[data-tile="${id}"]`)?.classList.add("is-error");
    },
    hint(h) {
      coach = h;
      paintCoach();
    },
    destroy() {
      endDrag(false);
      host.removeEventListener("input", onInput);
      host.removeEventListener("pointerdown", onDown);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerup", onUp);
      host.removeEventListener("pointercancel", onCancel);
      host.removeEventListener("keydown", onKey);
      host.removeEventListener("focusout", onBlur);
    },
  };
}
