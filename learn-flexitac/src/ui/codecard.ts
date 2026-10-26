// "Try it yourself": highlighted code with editable {{param}} values, copy, and Run (button or Ctrl/Cmd+Enter).
// The code itself never changes with the language; relabel(code) repaints the card's words (its caption and the labels
// of its numbers from the lesson's Chinese) and keeps the values, the output and the focus.
import { t } from "../i18n";
import type { CodeSample, Lesson } from "../types";
import { load, update } from "../state/store";
import { copyText, esc, flash, h } from "./dom";
import { fill, highlight } from "./highlight";
import { icon } from "./icons";

export interface CodeCard {
  el: HTMLElement;
  values(): Record<string, number>;
  run(): void;
  /** Paint the card's words again in the site's language; `code` is the same sample in that language (loc(lesson).code). */
  relabel(code: CodeSample): void;
  destroy(): void;
}

export function codeCard(
  lesson: Lesson,
  code: CodeSample,
  opts: {
    canRun: boolean;
    onRun: (values: Record<string, number>) => string | string[] | void;
    /** The last run's lines again, in the language on show, without running anything (null: they cannot be had). */
    onSay?: (values: Record<string, number>) => string[] | null;
  },
): CodeCard {
  const saved = load().params[lesson.id] ?? {};
  const defaults = Object.fromEntries(code.params.map((p) => [p.name, p.value]));
  const values: Record<string, number> = { ...defaults, ...saved };

  const el = h("section", { class: "card code-card", "aria-labelledby": `try-${lesson.id}` });
  const lines = code.source.split("\n").length;
  const hint = () => `${t("code.hint")}${opts.canRun ? t("code.hintRun") : ""}${t("code.hintEnd")}`;
  el.innerHTML = `
    <header class="card-head">
      <h2 class="card-title" id="try-${lesson.id}">${t("code.try")}</h2>
      <div class="code-actions">
        ${code.params.length ? `<button type="button" class="btn-icon" data-reset title="${t("code.reset")}" aria-label="${t("code.reset")}">${icon("reset")}</button>` : ""}
        <button type="button" class="btn-icon" data-copy title="${t("code.copy")}" aria-label="${t("code.copy")}">${icon("copy")}</button>
        ${opts.canRun ? `<button type="button" class="btn-run" data-run title="${t("code.runTitle")}" aria-keyshortcuts="Control+Enter Meta+Enter">${icon("play")}<span>${t("code.run")}</span></button>` : ""}
      </div>
    </header>
    ${code.caption ? `<p class="code-caption mono">${esc(code.caption)}</p>` : ""}
    <div class="code-wrap">
      <div class="code-gutter mono" aria-hidden="true">${Array.from({ length: lines }, (_, i) => `<span>${i + 1}</span>`).join("")}</div>
      <pre class="code mono" tabindex="0" aria-label="${t("code.aria")}"><code class="lang-${code.lang}"></code></pre>
    </div>
    ${code.params.length ? `<p class="code-hint">${hint()}</p>` : ""}
    <div class="console mono" hidden>
      <button type="button" class="console-close" aria-label="${t("code.closeOut")}" title="${t("code.closeOutTitle")}">×</button>
      <div class="console-lines" role="log" aria-live="polite" aria-label="${t("code.output")}"></div>
    </div>`;

  const codeEl = el.querySelector("code")!;
  const out = el.querySelector<HTMLElement>(".console")!;
  const outLines = out.querySelector<HTMLElement>(".console-lines")!;
  out.querySelector(".console-close")!.addEventListener("click", () => {
    out.hidden = true;
    el.querySelector<HTMLElement>("[data-run]")?.focus();
  });
  let shown = code;
  const paint = () => {
    codeEl.innerHTML = highlight(shown, values);
  };
  paint();

  let saveTimer = 0;
  const persist = () => {
    clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => update((s) => (s.params[lesson.id] = { ...values })), 300);
  };

  const setValue = (name: string, v: number, from?: HTMLInputElement) => {
    const p = code.params.find((q) => q.name === name);
    if (!p || !Number.isFinite(v)) return;
    const clamped = Math.min(p.max, Math.max(p.min, Math.round(v / p.step) * p.step));
    const fixed = Number(clamped.toFixed(6));
    const same = fixed === values[name] && from?.value === String(fixed);
    values[name] = fixed;
    persist();
    if (same) return;
    for (const inp of codeEl.querySelectorAll<HTMLInputElement>(`input[data-param="${name}"]`)) {
      if (inp !== from || inp.value !== String(fixed)) inp.value = String(fixed);
      flash(inp);
    }
  };

  codeEl.addEventListener("input", (e) => {
    const t = e.target as HTMLInputElement;
    if (t.matches("input[data-param]") && t.value !== "" && !t.value.endsWith(".")) {
      const v = Number(t.value);
      // live update other copies + flash; clamp on change/blur
      if (Number.isFinite(v)) {
        values[t.dataset.param!] = v;
        persist();
        for (const inp of codeEl.querySelectorAll<HTMLInputElement>(`input[data-param="${t.dataset.param}"]`)) {
          if (inp !== t) inp.value = t.value;
          flash(inp);
        }
      }
    }
  });
  codeEl.addEventListener("change", (e) => {
    const t = e.target as HTMLInputElement;
    if (t.matches("input[data-param]")) setValue(t.dataset.param!, Number(t.value), t);
  });

  /** the values of the last Run whose output is on show (a language switch writes its lines again) */
  let lastRun: Record<string, number> | null = null;
  const runNow = () => {
    if (!opts.canRun) return;
    const btn = el.querySelector<HTMLElement>("[data-run]");
    if (btn) flash(btn, "is-running");
    // commit any half-typed value first
    for (const inp of codeEl.querySelectorAll<HTMLInputElement>("input[data-param]")) setValue(inp.dataset.param!, Number(inp.value), inp);
    let lines: string | string[] | void;
    lastRun = { ...values };
    try {
      lines = opts.onRun({ ...values });
    } catch (err) {
      lines = [t("code.error", { msg: (err as Error).message })];
      lastRun = null; // (an error's message has no other language)
      console.error(err);
    }
    showLines(lines === undefined ? [] : Array.isArray(lines) ? lines : [lines]);
    flash(out);
  };
  const showLines = (arr: string[]) => {
    out.hidden = arr.length === 0;
    outLines.innerHTML = arr.map((l) => `<div class="console-line"><span class="console-prompt" aria-hidden="true">›</span> ${esc(l)}</div>`).join("");
  };

  el.querySelector("[data-run]")?.addEventListener("click", runNow);
  el.querySelector("[data-reset]")?.addEventListener("click", () => {
    for (const p of code.params) setValue(p.name, p.value);
  });
  const copyBtn = el.querySelector<HTMLButtonElement>("[data-copy]")!;
  copyBtn.addEventListener("click", async () => {
    const ok = await copyText(fill(code, values));
    copyBtn.classList.toggle("is-done", ok);
    copyBtn.setAttribute("aria-label", t(ok ? "code.copied" : "code.copyFailed"));
    copyBtn.innerHTML = icon(ok ? "check" : "copy");
    setTimeout(() => {
      copyBtn.classList.remove("is-done");
      copyBtn.setAttribute("aria-label", t("code.copy"));
      copyBtn.innerHTML = icon("copy");
    }, 1400);
  });

  // Ctrl/Cmd+Enter anywhere in the page runs (keys pressed inside the figure iframe never reach us).
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !e.altKey) {
      e.preventDefault();
      runNow();
    }
  };
  if (opts.canRun) document.addEventListener("keydown", onKey);

  return {
    el,
    values: () => ({ ...values }),
    run: runNow,
    relabel(next) {
      shown = next;
      const q = <T extends Element>(sel: string) => el.querySelector<T>(sel);
      q("#try-" + CSS.escape(lesson.id))!.textContent = t("code.try");
      const reset = q<HTMLElement>("[data-reset]");
      if (reset) {
        reset.title = t("code.reset");
        reset.setAttribute("aria-label", t("code.reset"));
      }
      copyBtn.title = t("code.copy");
      if (!copyBtn.classList.contains("is-done")) copyBtn.setAttribute("aria-label", t("code.copy"));
      const run = q<HTMLElement>("[data-run]");
      if (run) {
        run.title = t("code.runTitle");
        run.querySelector("span")!.textContent = t("code.run");
      }
      const cap = q<HTMLElement>(".code-caption");
      if (cap && next.caption) cap.textContent = next.caption;
      q("pre.code")!.setAttribute("aria-label", t("code.aria"));
      const hintEl = q<HTMLElement>(".code-hint");
      if (hintEl) hintEl.innerHTML = hint();
      const close = q<HTMLElement>(".console-close")!;
      close.setAttribute("aria-label", t("code.closeOut"));
      close.title = t("code.closeOutTitle");
      outLines.setAttribute("aria-label", t("code.output"));
      // the output follows the language: the last Run's lines again (nothing runs), or, when they cannot be had, none
      if (!out.hidden) {
        let again: string[] | null = null;
        try {
          again = lastRun && opts.onSay ? opts.onSay({ ...lastRun }) : null;
        } catch (err) {
          console.error(err);
        }
        showLines(again ?? []);
        if (!again) lastRun = null;
      }
      // the inputs carry their labels: draw them again (same values), keeping the focus in the one that had it
      const focused = codeEl.contains(document.activeElement) ? (document.activeElement as HTMLElement).dataset.param : undefined;
      if (shown.params.length) {
        paint();
        if (focused) codeEl.querySelector<HTMLInputElement>(`input[data-param="${focused}"]`)?.focus({ preventScroll: true });
      }
    },
    destroy() {
      document.removeEventListener("keydown", onKey);
      clearTimeout(saveTimer);
    },
  };
}
