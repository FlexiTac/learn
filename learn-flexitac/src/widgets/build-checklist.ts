// Build checklist (lesson 6, Build your own). One card per build step: the hardware guide's photos (and a short muted
// clip from the authors' video), plus checkboxes that persist in this browser. After the test ("First light") come the
// flash card (the commands to type in place of photos) and the Fix card, which is the Troubleshooter
// (src/widgets/flash-doctor.ts, loaded when the card is first opened, kept while it shows). Data: BUILD in
// lessons/12-build-your-own.ts.
import { fill, strings } from "../i18n";
import { paintText } from "../i18n/paint";
import { BUILD, type BuildStep } from "../lessons/12-build-your-own";
import { locBuild } from "../lessons/zh/_build";
import type { WidgetCtx, WidgetInstance } from "../types";
import { esc, h } from "../ui/dom";
import "./build-checklist.css";

const KEY = "learn-flexitac:build-checklist:v1";
interface Saved {
  checked: string[];
  step: string;
}
function read(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as Partial<Saved>;
      return { checked: Array.isArray(s.checked) ? s.checked.filter((x) => typeof x === "string") : [], step: typeof s.step === "string" ? s.step : BUILD[0].id };
    }
  } catch {
    /* storage unavailable */
  }
  return { checked: [], step: BUILD[0].id };
}
function write(s: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* keep in memory */
  }
}

// the widget's words (docs/i18n.md); the steps' own words are BUILD's, in Chinese from src/lessons/zh/_build.ts
const S = strings(
  {
    kicker: "Build checklist",
    untickTitle: "Untick everything",
    reset: "Reset",
    untick: "Untick all?",
    steps: "Build steps",
    zoom: "Photo, full size",
    close: "Close",
    done: "done",
    back: "Back",
    next: "Next step",
    loading: "Loading the troubleshooter…",
    failed: "The troubleshooter failed to load: {msg}",
    openFull: "Open full size",
    clipCap: "{cap} · muted clip from the authors' video",
    photoCap: "{alt} · hardware guide photo",
    thumbs: "Photos and clip",
    clip: "▶ clip",
    photoN: "Photo {k}: {alt}",
  },
  {
    kicker: "制作清单",
    untickTitle: "取消全部勾选",
    reset: "重置",
    untick: "全部取消？",
    steps: "制作步骤",
    zoom: "照片原图",
    close: "关闭",
    done: "已完成",
    back: "上一步",
    next: "下一步",
    loading: "正在加载排错工具……",
    failed: "排错工具加载失败：{msg}",
    openFull: "查看原图",
    clipCap: "{cap} · 取自作者视频的静音片段",
    photoCap: "{alt} · 硬件指南照片",
    thumbs: "照片和视频片段",
    clip: "▶ 片段",
    photoN: "照片 {k}：{alt}",
  },
);

const img = (n: number, size: "sm" | "full") => `media/guide/guide-${String(n).padStart(2, "0")}${size === "sm" ? "-sm" : ""}.webp`;
const keyOf = (s: BuildStep, c: { id: string }) => `${s.id}.${c.id}`;
const TOTAL = BUILD.reduce((n, s) => n + s.checks.length, 0);

export function mount(el: HTMLElement, ctx: WidgetCtx): WidgetInstance {
  const saved = read();
  const checked = new Set(saved.checked);
  let current = BUILD.some((s) => s.id === saved.step) ? saved.step : BUILD[0].id;
  let photo = 0;
  let showClip = true;

  const root = h("div", { class: "w-build" });
  root.innerHTML = `
    <div class="w-build-head">
      <span class="w-kicker" data-t="kicker">${S().kicker}</span>
      <span class="w-build-count mono" aria-live="polite"></span>
      <span class="w-build-bar" aria-hidden="true"><span></span></span>
      <button type="button" class="w-build-reset btn-ghost" title="${S().untickTitle}" data-t-title="untickTitle">${S().reset}</button>
    </div>
    <nav class="w-build-steps" aria-label="${S().steps}" data-t-aria="steps"></nav>
    <section class="w-build-card" aria-live="polite"></section>`;
  el.append(root);
  // the full-size viewer lives on <body>: the widget is a size container, which would trap position: fixed
  const zoom = h("div", { class: "w-build-zoom", hidden: true, role: "dialog", "aria-modal": "true", "aria-label": S().zoom, "data-t-aria": "zoom" },
    `<button type="button" class="w-build-zoom-close btn-icon" aria-label="${S().close}" data-t-aria="close">×</button><img alt="">`);
  document.body.append(zoom);

  const nav = root.querySelector<HTMLElement>(".w-build-steps")!;
  const card = root.querySelector<HTMLElement>(".w-build-card")!;
  const count = root.querySelector<HTMLElement>(".w-build-count")!;
  const bar = root.querySelector<HTMLElement>(".w-build-bar span")!;
  const zoomImg = zoom.querySelector("img")!;
  const confirmReset = { armed: false, t: 0 };

  const save = () => write({ checked: [...checked], step: current });
  const stepDone = (s: BuildStep) => s.checks.length > 0 && s.checks.every((c) => checked.has(keyOf(s, c)));

  function paintNav() {
    nav.innerHTML = BUILD.map((s) => {
      const done = stepDone(s);
      const z = locBuild(s);
      const label = z.tab;
      return `<button type="button" data-step="${s.id}" aria-current="${s.id === current ? "step" : "false"}" class="${done ? "is-done" : ""}" title="${esc(z.title)}">
        <span class="mono">${label}</span>${done ? `<span class="w-build-tick" aria-label="${S().done}">✓</span>` : ""}</button>`;
    }).join("");
    count.textContent = `${checked.size} / ${TOTAL}`;
    bar.style.width = `${(100 * checked.size) / TOTAL}%`;
  }

  let io: IntersectionObserver | null = null;
  // the Fix card's Troubleshooter: mounted the first time the card opens, gone when another card opens
  let doctor: WidgetInstance | null = null;
  let doctorWant = 0;
  const dropDoctor = () => {
    doctorWant++;
    doctor?.destroy();
    doctor = null;
  };
  const navButtons = (i: number) => `
        <div class="w-build-nav">
          <button type="button" class="btn-ghost" data-go="-1" ${i === 0 ? "disabled" : ""} data-t="back">${S().back}</button>
          <button type="button" class="btn-primary" data-go="1" ${i === BUILD.length - 1 ? "disabled" : ""} data-t="next">${S().next}</button>
        </div>`;
  function paintCard() {
    io?.disconnect();
    dropDoctor();
    const s0 = BUILD.find((x) => x.id === current)!;
    const i = BUILD.indexOf(s0);
    const s = locBuild(s0);
    card.classList.toggle("is-doctor", Boolean(s.doctor));
    if (s.doctor) {
      card.innerHTML = `
      <div class="w-build-body w-build-fixhead">
        <h3>${esc(s.title)}</h3>
        <p>${s.text}</p>
      </div>
      <div class="w-build-doc"><p class="w-build-cap mono" data-t="loading">${S().loading}</p></div>
      ${navButtons(i)}`;
      const slot = card.querySelector<HTMLElement>(".w-build-doc")!;
      const want = doctorWant;
      import("./flash-doctor")
        .then(({ mount: mountDoctor }) => {
          if (want !== doctorWant || !slot.isConnected) return;
          slot.innerHTML = "";
          doctor = mountDoctor(slot, ctx);
        })
        .catch((err: Error) => {
          slot.innerHTML = `<p class="w-build-cap mono">${fill(S().failed, { msg: esc(err.message) })}</p>`;
          console.error(err);
        });
      return;
    }
    if (s.term) {
      card.innerHTML = `
      <div class="w-build-media">
        <pre class="w-build-term mono" aria-label="${esc(s.term.caption)}">${s.term.lines
          .map((l) => (l.startsWith("#") ? `<span class="w-build-com">${esc(l)}</span>` : l ? `<span class="w-build-prompt" aria-hidden="true">$ </span>${esc(l)}` : ""))
          .join("\n")}</pre>
        <p class="w-build-cap">${esc(s.term.caption)}</p>
      </div>
      <div class="w-build-body">
        <h3>${esc(s.title)}</h3>
        <p>${s.text}</p>
        ${checksHtml(s)}
        ${navButtons(i)}
      </div>`;
      return;
    }
    const p = s.photos[Math.min(photo, s.photos.length - 1)];
    const clip = s.clip && showClip ? s.clip : null;
    const auto = !ctx.reducedMotion();
    card.innerHTML = `
      <div class="w-build-media">
        <div class="w-build-view">
          ${
            clip
              ? `<video src="${clip.src}" poster="${clip.poster}" muted loop playsinline preload="metadata" ${auto ? "autoplay" : "controls"} aria-label="${esc(clip.caption)}"></video>`
              : `<button type="button" class="w-build-photo" data-zoom="${p.n}" title="${S().openFull}"><img src="${img(p.n, "sm")}" alt="${esc(p.alt)}" loading="lazy" width="720" height="405"></button>`
          }
        </div>
        <p class="w-build-cap">${clip ? fill(S().clipCap, { cap: esc(clip.caption) }) : fill(S().photoCap, { alt: esc(p.alt) })}</p>
        <div class="w-build-thumbs" role="group" aria-label="${S().thumbs}">
          ${s.clip ? `<button type="button" data-clip aria-pressed="${Boolean(clip)}" class="w-build-thumb is-clip"><img src="${s.clip.poster}" alt=""><span>${S().clip}</span></button>` : ""}
          ${s.photos
            .map(
              (q, k) =>
                `<button type="button" data-photo="${k}" aria-pressed="${!clip && k === photo}" class="w-build-thumb" aria-label="${fill(S().photoN, { k: k + 1, alt: esc(q.alt) })}"><img src="${img(q.n, "sm")}" alt="" loading="lazy"></button>`,
            )
            .join("")}
        </div>
      </div>
      <div class="w-build-body">
        <h3>${esc(s.title)}</h3>
        <p>${s.text}</p>
        ${checksHtml(s)}
        ${navButtons(i)}
      </div>`;
    const v = card.querySelector("video");
    if (v && auto) {
      io = new IntersectionObserver((es) => {
        for (const e of es) e.isIntersecting ? v.play().catch(() => {}) : v.pause();
      });
      io.observe(v);
    }
  }

  // a language switch: the words of the card on show, in place (the Troubleshooter, a playing clip, the photo on show
  // and the ticks stay; the Troubleshooter repaints its own words)
  function relabel() {
    const s = locBuild(BUILD.find((x) => x.id === current)!);
    const p = s.photos[Math.min(photo, s.photos.length - 1)];
    const clip = s.clip && showClip ? s.clip : null;
    const q = (sel: string) => card.querySelector<HTMLElement>(sel);
    const head = card.querySelector(".w-build-body h3");
    if (head) head.innerHTML = esc(s.title);
    const text = card.querySelector(".w-build-body h3 + p");
    if (text) text.innerHTML = s.text;
    // (only the card's own marks: the Troubleshooter inside it has a table of its own)
    for (const m of card.querySelectorAll(".w-build-nav, .w-build-doc > .w-build-cap")) paintText(m, S());
    for (const c of s.checks) {
      const box = q(`[data-check="${CSS.escape(keyOf(s, c))}"]`);
      const span = box?.parentElement?.querySelector("span");
      if (span) span.textContent = c.text;
    }
    if (s.term) {
      q(".w-build-term")?.setAttribute("aria-label", s.term.caption);
      const cap = card.querySelector(".w-build-media .w-build-cap");
      if (cap) cap.textContent = s.term.caption;
      return;
    }
    if (s.doctor) return;
    const cap = card.querySelector(".w-build-media .w-build-cap");
    if (cap) cap.innerHTML = clip ? fill(S().clipCap, { cap: esc(clip.caption) }) : p ? fill(S().photoCap, { alt: esc(p.alt) }) : "";
    q("video")?.setAttribute("aria-label", clip?.caption ?? "");
    const pb = q(".w-build-photo");
    if (pb) pb.title = S().openFull;
    const pi = card.querySelector<HTMLImageElement>(".w-build-photo img");
    if (pi && p) pi.alt = p.alt;
    q(".w-build-thumbs")?.setAttribute("aria-label", S().thumbs);
    const ct = card.querySelector(".w-build-thumb.is-clip span");
    if (ct) ct.textContent = S().clip;
    card.querySelectorAll<HTMLElement>("[data-photo]").forEach((b) => {
      const k = Number(b.dataset.photo);
      if (s.photos[k]) b.setAttribute("aria-label", fill(S().photoN, { k: k + 1, alt: s.photos[k].alt }));
    });
  }

  function checksHtml(s: BuildStep): string {
    if (!s.checks.length) return "";
    return `<ul class="w-build-checks">
          ${s.checks
            .map((c) => {
              const k = keyOf(s, c);
              return `<li><label><input type="checkbox" data-check="${k}" ${checked.has(k) ? "checked" : ""}><span>${esc(c.text)}</span></label></li>`;
            })
            .join("")}
        </ul>`;
  }

  function go(id: string) {
    current = id;
    photo = 0;
    showClip = true;
    save();
    paintNav();
    paintCard();
  }

  nav.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-step]");
    if (b) go(b.dataset.step!);
  });
  card.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    const ph = t.closest<HTMLElement>("[data-photo]");
    if (ph) {
      photo = Number(ph.dataset.photo);
      showClip = false;
      return paintCard();
    }
    if (t.closest("[data-clip]")) {
      showClip = true;
      return paintCard();
    }
    const z = t.closest<HTMLElement>("[data-zoom]");
    if (z) {
      const s = locBuild(BUILD.find((x) => x.id === current)!);
      const p = s.photos.find((q) => String(q.n) === z.dataset.zoom)!;
      zoomImg.src = img(p.n, "full");
      zoomImg.alt = p.alt;
      zoom.hidden = false;
      zoom.querySelector<HTMLButtonElement>("button")!.focus();
      return;
    }
    const g = t.closest<HTMLButtonElement>("[data-go]");
    if (g) {
      const i = BUILD.findIndex((x) => x.id === current) + Number(g.dataset.go);
      if (BUILD[i]) go(BUILD[i].id);
      root.scrollTop = 0;
    }
  });
  card.addEventListener("change", (e) => {
    const c = (e.target as HTMLElement).closest<HTMLInputElement>("[data-check]");
    if (!c) return;
    c.checked ? checked.add(c.dataset.check!) : checked.delete(c.dataset.check!);
    save();
    paintNav();
  });
  const closeZoom = () => {
    zoom.hidden = true;
    zoomImg.removeAttribute("src");
  };
  zoom.addEventListener("click", closeZoom);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape" && !zoom.hidden) closeZoom();
  };
  document.addEventListener("keydown", onKey);

  const resetBtn = root.querySelector<HTMLButtonElement>(".w-build-reset")!;
  resetBtn.addEventListener("click", () => {
    // two clicks: no confirm() dialogs in embedded viewers
    if (!confirmReset.armed) {
      confirmReset.armed = true;
      resetBtn.textContent = S().untick;
      confirmReset.t = window.setTimeout(() => ((confirmReset.armed = false), (resetBtn.textContent = S().reset)), 3000);
      return;
    }
    clearTimeout(confirmReset.t);
    confirmReset.armed = false;
    resetBtn.textContent = S().reset;
    checked.clear();
    save();
    paintNav();
    paintCard();
  });

  const offLang = ctx.onLang(() => {
    paintText(root.querySelector(".w-build-head")!, S());
    root.querySelector(".w-build-steps")!.setAttribute("aria-label", S().steps);
    resetBtn.textContent = confirmReset.armed ? S().untick : S().reset;
    paintText(zoom, S());
    paintNav();
    relabel();
  });

  paintNav();
  paintCard();

  return {
    destroy() {
      offLang();
      io?.disconnect();
      dropDoctor();
      clearTimeout(confirmReset.t);
      document.removeEventListener("keydown", onKey);
      zoom.remove();
      root.remove();
    },
  };
}
