// Lesson accents: every lesson has its own colour token, --ft-lesson-<n> (n = its place in the course, 1-14;
// src/styles/tokens.css, light + dark).
// An element that carries `--lc` gets that colour; inside .lesson-view, CSS maps --lc onto --accent and its tints,
// so links, focus rings, step dots, quiz highlights and buttons all take the lesson's colour.

/** Inline style that sets --lc for lesson n, for use in template strings: `<a style="${lc(3)}">`. */
export function lc(n: number): string {
  const k = Math.min(14, Math.max(1, Math.round(n)));
  // (--lc-soft: the tint for a browser without color-mix(), explore.css)
  return `--lc:var(--ft-lesson-${k});--lc-soft:var(--ft-lesson-${k}-soft)`;
}
