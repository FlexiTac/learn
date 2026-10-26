// The frame as a small grid (board widgets: clock-stepper, frame-runner). One cell per crossing: rows are the sense
// lines (sense line 1 at the top), columns the drive lines (drive line 1 on the left), in the order the firmware reads
// them: row by row, left to right. A little extra gap after every 8 columns marks the four shift registers (8 outputs
// each). Paint states:
//   - done: the cell's reading, in the viewer's colour map (viridis, 0..255)
//   - now: the crossing being read (the HIGH drive line on the listened row), signal pink as on the pad cards
//   - not yet: empty, or the previous frame's reading, faded (it stays on screen until the scan reads it again)
//   - the listened row: the sense line the multiplexer connects to A0, outlined in teal (the pad cards' "listen")
// Lanes: extra rows of 32 aligned with the columns (the stepper's outputs and shift stage), placed under the cells.
// Size: fit(maxW, maxH) picks the cell pitch (px per column) that fits both; the host lays the grid out with it.
import { tx } from "../../i18n";
import { viridis } from "./model";

type GridText = { label?: (r: number) => string; axis?: [string, string]; aria?: string; lanes?: string[] };

export interface GridPaint {
  /** The sense line listened to (0-based), or null when none is (power-on, a channel that is not wired). */
  row: number | null;
  /** The HIGH drive line on that row (0-based), or null / -1 when none is HIGH. */
  col: number | null;
  /** Readings done in this frame: cells 0 .. done-1 (row-major) show their value. */
  done: number;
  /** One value 0..255 per cell (row-major, rows × cols). */
  values: ArrayLike<number>;
  /** An earlier frame filled the cells not read yet: show its readings faded. */
  prev?: boolean;
  /** A picked cell (frame-runner), row-major index, or null. */
  sel?: number | null;
}

const CHIP = 8; // a 74HC595 has 8 outputs
const MIN_PITCH = 7;
const MAX_PITCH = 12;

export class FrameGrid {
  readonly el: HTMLElement;
  rows = 0;
  cols = 0;
  pitch = 10;
  private cellsEl: HTMLElement;
  private labelsEl: HTMLElement;
  private band: HTMLElement;
  private axis: HTMLElement;
  private cells: HTMLElement[] = [];
  private labels: HTMLElement[] = [];
  private shown: string[] = [];
  private lanes: { el: HTMLElement; label: HTMLElement }[] = [];

  constructor(rows: number, cols: number, opts: GridText = {}) {
    this.el = document.createElement("div");
    this.el.className = "w-fg";
    this.el.innerHTML = `<div class="w-fg-labels mono" aria-hidden="true"></div>
      <div class="w-fg-cells" role="img"><span class="w-fg-band" aria-hidden="true"></span></div>
      <div class="w-fg-axis mono" aria-hidden="true"><span></span><span></span></div>`;
    this.labelsEl = this.el.querySelector(".w-fg-labels")!;
    this.cellsEl = this.el.querySelector(".w-fg-cells")!;
    this.band = this.el.querySelector(".w-fg-band")!;
    this.axis = this.el.querySelector(".w-fg-axis")!;
    this.label = opts.label ?? FrameGrid.senseLabel;
    const [a, b] = opts.axis ?? [tx("drive line 1 →", "驱动线 1 →"), String(cols)];
    this.axis.children[0].textContent = a;
    this.axis.children[1].textContent = b;
    if (opts.aria) this.cellsEl.setAttribute("aria-label", opts.aria);
    this.build(rows, cols);
  }

  private label: (r: number) => string;
  private static senseLabel = (r: number) => tx("sense {n}", "感应 {n}", { n: r + 1 });

  /** A language switch (docs/i18n.md): the row labels, the axis and the name again, in the host's words (or the
   *  grid's own); the cells and their paint stay. */
  relabel(opts: GridText = {}) {
    this.label = opts.label ?? FrameGrid.senseLabel;
    this.axis.children[0].textContent = opts.axis ? opts.axis[0] : tx("drive line 1 →", "驱动线 1 →");
    if (opts.axis) this.axis.children[1].textContent = opts.axis[1];
    if (opts.aria) this.cellsEl.setAttribute("aria-label", opts.aria);
    this.labels.forEach((l, r) => (l.textContent = this.label(r)));
    // (the lanes' labels by place, as they were added)
    opts.lanes?.forEach((t, k) => {
      if (this.lanes[k] && t !== undefined) this.lanes[k].label.textContent = t;
    });
  }

  /** (Re)build the cells for a rows × cols frame (frame-runner's other firmware builds). */
  build(rows: number, cols: number) {
    this.rows = rows;
    this.cols = cols;
    this.el.style.setProperty("--rows", String(rows));
    this.el.style.setProperty("--cols", String(cols));
    this.el.style.setProperty("--tracks", this.template(cols));
    for (const c of this.cells) c.remove();
    const frag = document.createDocumentFragment();
    this.cells = Array.from({ length: rows * cols }, (_, k) => {
      const i = document.createElement("i");
      i.dataset.k = String(k);
      i.style.gridColumn = String(this.track(k % cols));
      i.style.gridRow = String(Math.floor(k / cols) + 1);
      frag.append(i);
      return i;
    });
    this.cellsEl.append(frag);
    this.shown = new Array(rows * cols).fill("");
    this.labelsEl.innerHTML = Array.from({ length: rows }, (_, r) => `<span data-r="${r}">${this.label(r)}</span>`).join("");
    this.labels = [...this.labelsEl.children] as HTMLElement[];
    this.axis.children[1].textContent = String(cols);
    for (const l of this.lanes) this.fillLane(l.el);
  }

  /** Grid track of column c: one gap track after every CHIP columns. */
  private track(c: number) {
    return c + Math.floor(c / CHIP) + 1;
  }
  private template(cols: number) {
    const groups = Math.ceil(cols / CHIP);
    return Array.from({ length: groups }, (_, g) => `repeat(${Math.min(CHIP, cols - g * CHIP)}, var(--p))`).join(" var(--cg) ");
  }
  private fillLane(el: HTMLElement) {
    el.style.setProperty("--tracks", this.template(this.cols));
    el.innerHTML = Array.from({ length: this.cols }, (_, j) => `<i data-j="${j}" style="grid-column:${this.track(j)}"></i>`).join("");
  }

  /** An extra row of `cols` items aligned with the columns, under the cells (and its label in the label column). */
  addLane(cls: string, label: string): HTMLElement[] {
    const lab = document.createElement("span");
    lab.className = `w-fg-lanelab mono ${cls}`;
    lab.textContent = label;
    const el = document.createElement("div");
    el.className = `w-fg-lane ${cls}`;
    el.setAttribute("aria-hidden", "true");
    this.fillLane(el);
    this.el.insertBefore(lab, this.axis);
    this.el.insertBefore(el, this.axis);
    this.lanes.push({ el, label: lab });
    return [...el.children] as HTMLElement[];
  }
  /** A lane of group captions (one per CHIP columns), e.g. the shift registers' names. */
  addGroupLane(cls: string, label: string, names: string[]): HTMLElement {
    const lab = document.createElement("span");
    lab.className = `w-fg-lanelab mono ${cls}`;
    lab.textContent = label;
    const el = document.createElement("div");
    el.className = `w-fg-lane w-fg-groups mono ${cls}`;
    el.setAttribute("aria-hidden", "true");
    el.style.setProperty("--tracks", this.template(this.cols));
    el.innerHTML = names.map((n, g) => `<span style="grid-column:${this.track(g * CHIP)} / span ${CHIP}">${n}</span>`).join("");
    this.el.insertBefore(lab, this.axis);
    this.el.insertBefore(el, this.axis);
    this.lanes.push({ el, label: lab });
    return el;
  }

  /** Height in px of a grid at this pitch: cells, lanes shown and the axis line (as laid out by scan.css). */
  heightAt(p: number, lanes: number, axis: boolean) {
    return this.rows * p - 1 + lanes + (axis ? 17 : 0);
  }
  /** Width in px at this pitch, label column included (labelW measured by the host, or a fair guess). */
  widthAt(p: number, labelW = 52) {
    const groups = Math.ceil(this.cols / CHIP);
    return labelW + 8 + this.cols * p - 1 + (groups - 1) * 3;
  }
  /** The largest pitch (px per row / column) for which the grid fits maxW × maxH (lanesH: px the lanes take). */
  fit(maxW: number, maxH: number, lanesH = 0, axis = true, labelW = 52): number {
    let p = MAX_PITCH;
    while (p > MIN_PITCH && (this.widthAt(p, labelW) > maxW || this.heightAt(p, lanesH, axis) > maxH)) p--;
    this.setPitch(p);
    return p;
  }
  setPitch(p: number) {
    this.pitch = p;
    this.el.style.setProperty("--p", `${p - 1}px`);
    this.el.style.setProperty("--pitch", `${p}px`);
  }
  /** Label width the host can measure once the grid is in the page. */
  labelWidth(): number {
    return this.labelsEl.getBoundingClientRect().width || 52;
  }

  paint(s: GridPaint) {
    const { rows, cols } = this;
    const n = rows * cols;
    const row = s.row !== null && s.row >= 0 && s.row < rows ? s.row : null;
    const col = row !== null && s.col !== null && s.col >= 0 ? s.col : -1;
    const now = col >= 0 ? row! * cols + col : -1;
    for (let k = 0; k < n; k++) {
      const v = s.values[k] ?? 0;
      let state: string;
      if (k === now) state = "now";
      else if (k < s.done) state = `d${v}`;
      else if (s.prev) state = `o${v}`;
      else state = "t";
      const inRow = row !== null && Math.floor(k / cols) === row;
      const key = `${state}|${inRow ? 1 : 0}|${s.sel === k ? 1 : 0}`;
      if (this.shown[k] === key) continue;
      this.shown[k] = key;
      const c = this.cells[k];
      c.className = state === "now" ? "is-now" : state === "t" ? "is-todo" : state[0] === "o" ? "is-old" : "is-done";
      if (inRow) c.classList.add("is-row");
      if (s.sel === k) c.classList.add("is-sel");
      c.style.background = state[0] === "d" || state[0] === "o" ? viridis(v) : "";
    }
    this.band.hidden = row === null;
    if (row !== null) this.el.style.setProperty("--row", String(row));
    // the first and last row are always named; a name next to the listened row's would crowd it, so it steps aside
    this.labels.forEach((l, r) => {
      l.classList.toggle("is-cur", r === row);
      l.classList.toggle("is-end", (r === 0 || r === rows - 1) && (row === null || Math.abs(r - row) > 1));
    });
  }

  /** Row-major cell index under a pointer event target, or -1. */
  cellOf(target: EventTarget | null): number {
    const i = (target as Element | null)?.closest?.<HTMLElement>(".w-fg-cells i");
    return i ? Number(i.dataset.k) : -1;
  }
  cellEl(k: number): HTMLElement | undefined {
    return this.cells[k];
  }
  get cellsBox(): HTMLElement {
    return this.cellsEl;
  }
}
