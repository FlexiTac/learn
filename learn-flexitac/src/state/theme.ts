// Theme: follows prefers-color-scheme until the learner picks one with the toggle; the choice is stored.
// The resolved theme is stamped on <html data-theme> so CSS tokens and the figure builds agree.
import type { Theme } from "../types";
import { load, update } from "./store";

const media = matchMedia("(prefers-color-scheme: dark)");
const listeners = new Set<(t: Theme) => void>();
let current: Theme = resolve();

function resolve(): Theme {
  return load().theme ?? (media.matches ? "dark" : "light");
}

function apply(t: Theme): void {
  current = t;
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", t === "dark" ? "#0e0e0f" : "#f2f2ef");
  for (const l of listeners) l(t);
}

export function initTheme(): void {
  apply(resolve());
  media.addEventListener?.("change", () => {
    if (!load().theme) apply(resolve());
  });
}

export const theme = (): Theme => current;

export function toggleTheme(): Theme {
  const next: Theme = current === "dark" ? "light" : "dark";
  update((s) => {
    // Picking the system's own theme returns to "follow the system".
    s.theme = next === (media.matches ? "dark" : "light") ? undefined : next;
  });
  apply(next);
  return next;
}

export function onTheme(fn: (t: Theme) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const motion = matchMedia("(prefers-reduced-motion: reduce)");
export const reducedMotion = (): boolean => motion.matches;
