// Defined terms (<dfn>) in lesson text: each one gets a popover with its definition and a link to its glossary
// entry. The popover opens on hover, on keyboard focus (every dfn is tabbable) and on tap, so it works on touch
// screens too. One shared popover lives in <body> (position: fixed) so a scrolling pane never clips it.
// <dfn data-term="taxel">触觉像素（taxel）</dfn> names its glossary entry by id (the Chinese lessons do: their words are
// not the English term); the popover shows the term and its definition in the site's language (src/i18n locTerm).
import { GLOSSARY, type Term } from "../content/glossary";
import { GLOSSARY_ZH } from "../content/glossary.zh";
import { lang, locTerm, t as tr } from "../i18n";
import { esc } from "./dom";

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/<[^>]*>/g, "")
    .replace(/[(（].*?[)）]/g, " ")
    .replace(/[’']/g, "'")
    .replace(/\s+/g, " ")
    .trim();

/** Glossary entry for a dfn's text: exact term / aka / id (and the Chinese name and aka, src/content/glossary.zh.ts;
 *  a gloss in ASCII or full-width brackets is ignored: 触觉像素（taxel） finds taxel), then without a plural "s", then
 *  the first word group. A Chinese lesson names the entry with data-term anyway. */
export function termFor(text: string): Term | undefined {
  const t = norm(text);
  const keys = (g: Term) => {
    const z = GLOSSARY_ZH[g.id];
    // (the Chinese aka only where it is Chinese: an English dfn finds exactly what it found before)
    const zh = [...(z?.term ? [z.term] : []), ...(z?.aka ? z.aka.split(/\s*[·、，,]\s*/).filter((a) => /[\u3400-\u9fff]/.test(a)) : [])];
    return [g.term, g.id.replace(/-/g, " "), ...(g.aka ? g.aka.split(/,\s*/) : []), ...zh].map(norm);
  };
  const tries = [t, t.replace(/s$/, ""), t.replace(/es$/, ""), t.replace(/ (lines|sheets|bytes|files)$/, (m) => m.slice(0, -1))];
  for (const k of tries) {
    const hit = GLOSSARY.find((g) => keys(g).includes(k));
    if (hit) return hit;
  }
  return undefined;
}

let tip: HTMLElement | null = null;
let owner: HTMLElement | null = null;
let hideTimer = 0;
let shownAt = 0;

function ensureTip(): HTMLElement {
  if (tip) return tip;
  tip = document.createElement("div");
  tip.className = "dfn-tip";
  tip.id = "dfn-tip";
  tip.setAttribute("role", "tooltip");
  tip.hidden = true;
  tip.addEventListener("mouseenter", () => clearTimeout(hideTimer));
  tip.addEventListener("mouseleave", () => hideSoon());
  tip.addEventListener("focusout", (e) => {
    if (!tip!.contains(e.relatedTarget as Node) && e.relatedTarget !== owner) hide();
  });
  document.body.append(tip);
  return tip;
}

let safeProbe: HTMLElement | null = null;
/** The notch / rounded-corner insets on the left and right (a notched phone on its side; 0 everywhere else), in px:
 *  the tip keeps clear of them (tokens.css --safe-l / --safe-r). */
function safeX(): [number, number] {
  if (!safeProbe) {
    safeProbe = document.createElement("div");
    safeProbe.setAttribute("aria-hidden", "true");
    safeProbe.style.cssText = "position:fixed;top:0;height:0;left:var(--safe-l,0px);right:var(--safe-r,0px);visibility:hidden;pointer-events:none";
    document.body.append(safeProbe);
  }
  const b = safeProbe.getBoundingClientRect();
  return [Math.max(0, b.left), Math.max(0, document.documentElement.clientWidth - b.right)];
}

function place(el: HTMLElement) {
  const t = ensureTip();
  const r = el.getBoundingClientRect();
  const [sl, sr] = safeX();
  const w = Math.min(300, window.innerWidth - 24 - sl - sr);
  t.style.width = `${w}px`;
  const left = Math.max(12 + sl, Math.min(window.innerWidth - w - 12 - sr, r.left));
  t.style.left = `${left}px`;
  const below = r.bottom + 6;
  t.style.top = `${below}px`;
  // flip above when there is no room below
  const h = t.offsetHeight;
  if (below + h > window.innerHeight - 8 && r.top - h - 6 > 8) t.style.top = `${r.top - h - 6}px`;
}

function show(el: HTMLElement) {
  clearTimeout(hideTimer);
  const t = ensureTip();
  if (owner && owner !== el) owner.removeAttribute("aria-describedby");
  owner = el;
  const id = el.dataset.term;
  t.innerHTML = `<b>${esc(el.dataset.name ?? el.textContent ?? "")}</b> ${el.dataset.def ?? ""}${
    id ? ` <a class="dfn-tip-link mono" href="#/glossary/${id}">${tr("dfn.glossary")}</a>` : ""
  }`;
  if (t.hidden || owner !== el) shownAt = performance.now();
  t.hidden = false;
  el.setAttribute("aria-describedby", "dfn-tip");
  place(el);
}
function hide() {
  clearTimeout(hideTimer);
  if (tip) tip.hidden = true;
  owner?.removeAttribute("aria-describedby");
  owner = null;
}
function hideSoon() {
  clearTimeout(hideTimer);
  hideTimer = window.setTimeout(hide, 180);
}

/** Wire every <dfn> under root. Returns a cleanup function. */
export function enhanceDfns(root: HTMLElement): () => void {
  for (const d of root.querySelectorAll<HTMLElement>("dfn")) {
    const byIdTerm = d.dataset.term ? GLOSSARY.find((x) => x.id === d.dataset.term) : undefined;
    const g = byIdTerm ?? termFor(d.textContent ?? "");
    const def = d.getAttribute("title");
    if (!g && !def) continue;
    d.classList.add("dfn");
    d.tabIndex = 0;
    // the term in the site's language: Chinese "触觉像素（Taxel）" when it has a Chinese name
    const z = g ? locTerm(g) : undefined;
    d.dataset.def = z ? z.def : esc(def!);
    d.dataset.name = z ? (lang() === "zh" && z.zh ? `${z.term}（${z.en}）` : z.term) : d.textContent ?? "";
    if (g) d.dataset.term = g.id;
    d.removeAttribute("title");
  }
  const over = (e: Event) => {
    const d = (e.target as Element).closest?.<HTMLElement>("dfn.dfn");
    if (d) show(d);
  };
  const out = (e: Event) => {
    const d = (e.target as Element).closest?.<HTMLElement>("dfn.dfn");
    if (d) hideSoon();
  };
  const click = (e: Event) => {
    const d = (e.target as Element).closest?.<HTMLElement>("dfn.dfn");
    if (!d) return;
    // a tap focuses (which opens the popover) and then clicks: only a later tap on the same term closes it
    if (owner === d && tip && !tip.hidden && performance.now() - shownAt > 400 && (e as PointerEvent).pointerType !== "mouse") hide();
    else show(d);
  };
  const focusout = (e: FocusEvent) => {
    const d = (e.target as Element).closest?.<HTMLElement>("dfn.dfn");
    if (d && !(tip && tip.contains(e.relatedTarget as Node))) hide();
  };
  const key = (e: KeyboardEvent) => {
    if (e.key === "Escape" && owner) {
      const o = owner;
      hide();
      o.focus();
    }
  };
  const away = () => hide();
  // scrolling keeps the popover on its term; it closes once the term leaves the screen
  const follow = () => {
    if (!owner || !tip || tip.hidden) return;
    const r = owner.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) hide();
    else place(owner);
  };
  root.addEventListener("mouseover", over);
  root.addEventListener("mouseout", out);
  root.addEventListener("click", click);
  root.addEventListener("focusin", over);
  root.addEventListener("focusout", focusout);
  document.addEventListener("keydown", key);
  window.addEventListener("resize", away);
  document.addEventListener("scroll", follow, true);
  return () => {
    root.removeEventListener("mouseover", over);
    root.removeEventListener("mouseout", out);
    root.removeEventListener("click", click);
    root.removeEventListener("focusin", over);
    root.removeEventListener("focusout", focusout);
    document.removeEventListener("keydown", key);
    window.removeEventListener("resize", away);
    document.removeEventListener("scroll", follow, true);
    hide();
  };
}
