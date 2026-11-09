// Pan and zoom an SVG drawing through its viewBox, so it stays sharp at every zoom (src/widgets/pcb-design.ts: the real
// schematic page and the board's copper layout). Wheel zooms about the pointer, a drag moves the drawing, two fingers
// pinch, a double click zooms in; keys when the drawing has focus: + − 0 and the arrows. "Fit" shows the whole drawing
// with a margin. A drag never counts as a click (wasDrag), so parts under the pointer can still be clicked.
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PanZoom {
  /** Show the whole drawing (eased unless reduced motion or `now`). */
  fit(now?: boolean): void;
  /** Show one part of the drawing, as large as it fits (eased unless reduced motion or `now`). */
  show(box: Box, now?: boolean): void;
  /** Zoom by a factor about a point in client px (default the middle). */
  zoomBy(f: number, at?: { x: number; y: number }): void;
  /** Lay out again for the svg's current size (keeps the zoom and the middle point). */
  resize(): void;
  /** Drawing units -> the svg element's CSS px: px = (u - origin) * scale. */
  map(): { scale: number; ox: number; oy: number; w: number; h: number };
  /** The last pointer-up ended a drag (a click right after it is not a click). */
  wasDrag(): boolean;
  /** The zoom relative to "fit" (1 = the whole drawing). */
  zoom(): number;
  destroy(): void;
}

export function panZoom(svg: SVGSVGElement, content: Box, opts: { pad?: number; max?: number; arrows?: boolean; reduced: () => boolean; onChange?: () => void }): PanZoom {
  const pad = opts.pad ?? 12;
  const MAX = opts.max ?? 8;
  /** zoom relative to fit, and the drawing point at the middle of the view */
  let k = 1;
  let cx = content.x + content.w / 2;
  let cy = content.y + content.h / 2;
  let W = 1;
  let H = 1;
  let raf = 0;
  let dragged = false;

  const fitScale = () => Math.max(1e-6, Math.min((W - 2 * pad) / content.w, (H - 2 * pad) / content.h));
  const clamp = () => {
    k = Math.min(MAX, Math.max(1, k));
    // the middle stays inside the drawing; at fit it is its centre
    const s = fitScale() * k;
    const hw = W / 2 / s;
    const hh = H / 2 / s;
    const loX = content.x + Math.min(hw, content.w / 2) - pad / s;
    const hiX = content.x + content.w - Math.min(hw, content.w / 2) + pad / s;
    const loY = content.y + Math.min(hh, content.h / 2) - pad / s;
    const hiY = content.y + content.h - Math.min(hh, content.h / 2) + pad / s;
    cx = loX > hiX ? content.x + content.w / 2 : Math.min(hiX, Math.max(loX, cx));
    cy = loY > hiY ? content.y + content.h / 2 : Math.min(hiY, Math.max(loY, cy));
  };
  const apply = () => {
    clamp();
    const s = fitScale() * k;
    svg.setAttribute("viewBox", `${(cx - W / 2 / s).toFixed(3)} ${(cy - H / 2 / s).toFixed(3)} ${(W / s).toFixed(3)} ${(H / s).toFixed(3)}`);
    svg.dataset.zoom = k > 1.001 ? "in" : "fit";
    opts.onChange?.();
  };
  const measure = () => {
    const r = svg.getBoundingClientRect();
    W = Math.max(1, r.width);
    H = Math.max(1, r.height);
  };
  /** a client point -> drawing units */
  const toUnits = (px: number, py: number) => {
    const r = svg.getBoundingClientRect();
    const s = fitScale() * k;
    return { x: cx + (px - r.left - W / 2) / s, y: cy + (py - r.top - H / 2) / s };
  };
  const zoomAt = (f: number, px?: number, py?: number) => {
    const r = svg.getBoundingClientRect();
    const ax = px ?? r.left + W / 2;
    const ay = py ?? r.top + H / 2;
    const before = toUnits(ax, ay);
    k = Math.min(MAX, Math.max(1, k * f));
    const s = fitScale() * k;
    // keep the point under the pointer where it was
    cx = before.x - (ax - r.left - W / 2) / s;
    cy = before.y - (ay - r.top - H / 2) / s;
    apply();
  };
  const ease = (k1: number, cx1: number, cy1: number) => {
    cancelAnimationFrame(raf);
    if (opts.reduced()) {
      k = k1;
      cx = cx1;
      cy = cy1;
      apply();
      return;
    }
    const k0 = k;
    const cx0 = cx;
    const cy0 = cy;
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / 260);
      const e = 1 - Math.pow(1 - t, 3);
      k = k0 * Math.pow(k1 / k0, e);
      cx = cx0 + (cx1 - cx0) * e;
      cy = cy0 + (cy1 - cy0) * e;
      apply();
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  };

  // ---- pointer: drag to move, two fingers to pinch
  const pts = new Map<number, { x: number; y: number }>();
  let start: { x: number; y: number; cx: number; cy: number } | null = null;
  let pinch: { d: number; k: number; mid: { x: number; y: number } } | null = null;
  const onDown = (e: PointerEvent) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    dragged = false;
    if (pts.size === 1) start = { x: e.clientX, y: e.clientY, cx, cy };
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), k, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
    }
  };
  const onMove = (e: PointerEvent) => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pts.size >= 2) {
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d > 0 && pinch.d > 0) {
        dragged = true;
        const f = (pinch.k * (d / pinch.d)) / k;
        zoomAt(f, pinch.mid.x, pinch.mid.y);
      }
      return;
    }
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (!dragged && Math.hypot(dx, dy) < 4) return;
    if (!dragged) {
      dragged = true;
      try {
        svg.setPointerCapture(e.pointerId);
      } catch {
        /* (a pointer that already went) */
      }
      svg.classList.add("is-dragging");
    }
    const s = fitScale() * k;
    cx = start.cx - dx / s;
    cy = start.cy - dy / s;
    apply();
  };
  const onUp = (e: PointerEvent) => {
    pts.delete(e.pointerId);
    if (pts.size < 2) pinch = null;
    if (!pts.size) {
      start = null;
      svg.classList.remove("is-dragging");
    }
  };
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    zoomAt(Math.exp(-dy * 0.0016), e.clientX, e.clientY);
  };
  const onDbl = (e: MouseEvent) => {
    const r = svg.getBoundingClientRect();
    const u = toUnits(e.clientX, e.clientY);
    const k1 = Math.min(MAX, k * 2);
    const s = fitScale() * k1;
    ease(k1, u.x - (e.clientX - r.left - W / 2) / s, u.y - (e.clientY - r.top - H / 2) / s);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const s = fitScale() * k;
    const step = 60 / s;
    let done = true;
    if (e.key === "+" || e.key === "=") zoomAt(1.4);
    else if (e.key === "-" || e.key === "_") zoomAt(1 / 1.4);
    else if (e.key === "0") ease(1, content.x + content.w / 2, content.y + content.h / 2);
    else if (opts.arrows === false) done = false;
    else if (e.key === "ArrowLeft" && k > 1.001) (cx -= step), apply();
    else if (e.key === "ArrowRight" && k > 1.001) (cx += step), apply();
    else if (e.key === "ArrowUp" && k > 1.001) (cy -= step), apply();
    else if (e.key === "ArrowDown" && k > 1.001) (cy += step), apply();
    else done = false;
    if (done) e.preventDefault();
  };
  svg.addEventListener("pointerdown", onDown);
  svg.addEventListener("pointermove", onMove);
  svg.addEventListener("pointerup", onUp);
  svg.addEventListener("pointercancel", onUp);
  svg.addEventListener("wheel", onWheel, { passive: false });
  svg.addEventListener("dblclick", onDbl);
  svg.addEventListener("keydown", onKey);

  measure();
  apply();
  return {
    fit(now = false) {
      const c = { x: content.x + content.w / 2, y: content.y + content.h / 2 };
      if (now) {
        cancelAnimationFrame(raf);
        k = 1;
        cx = c.x;
        cy = c.y;
        apply();
      } else ease(1, c.x, c.y);
    },
    show(b, now = false) {
      measure();
      const want = Math.min((W - 2 * pad) / b.w, (H - 2 * pad) / b.h);
      const k1 = Math.min(MAX, Math.max(1, want / fitScale()));
      const cx1 = b.x + b.w / 2;
      const cy1 = b.y + b.h / 2;
      if (now || opts.reduced()) {
        cancelAnimationFrame(raf);
        k = k1;
        cx = cx1;
        cy = cy1;
        apply();
      } else ease(k1, cx1, cy1);
    },
    zoomBy(f, at) {
      zoomAt(f, at?.x, at?.y);
    },
    resize() {
      measure();
      apply();
    },
    map() {
      const s = fitScale() * k;
      return { scale: s, ox: cx - W / 2 / s, oy: cy - H / 2 / s, w: W, h: H };
    },
    wasDrag: () => dragged,
    zoom: () => k,
    destroy() {
      cancelAnimationFrame(raf);
      svg.removeEventListener("pointerdown", onDown);
      svg.removeEventListener("pointermove", onMove);
      svg.removeEventListener("pointerup", onUp);
      svg.removeEventListener("pointercancel", onUp);
      svg.removeEventListener("wheel", onWheel);
      svg.removeEventListener("dblclick", onDbl);
      svg.removeEventListener("keydown", onKey);
    },
  };
}
