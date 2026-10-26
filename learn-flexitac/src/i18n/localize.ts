// Chinese versions of the course's content, laid over the English without copying any of its logic. docs/i18n.md.
//   loc(lesson)        the lesson with its words from src/lessons/zh/<same file name>.ts (export const zh: LessonZh)
//                      wherever that file has them; everything else (ids, acts, answers, code, numbers) is the English
//                      lesson's own. In English (or for a lesson without a Chinese file) it is the lesson itself.
//   locSection(sec)    a section with its title, blurb and chapters from src/lessons/zh/_sections.ts
//   locTerm(term)      a glossary term with its name, aka and definition from src/content/glossary.zh.ts
//   locSpec(spec, z)   a Specs row: the lesson's Chinese, else src/content/facts.zh.ts (the fact's own words, then the
//                      English text's: SPECS_ZH)
// Anything missing in Chinese stays English: never blank.
import { getFact, formatValue } from "../content/facts";
import { FACTS_ZH, SPECS_ZH } from "../content/facts.zh";
import type { Term } from "../content/glossary";
import { GLOSSARY_ZH } from "../content/glossary.zh";
import { SECTIONS_ZH } from "../lessons/zh/_sections";
import type { Chapter, Lesson, Section, Spec } from "../types";
import { lang, type Lang } from "./lang";

/** A list given by place: entry i overrides the English entry i; leave a hole (or undefined / null) to keep one. */
export type ZhList<T> = (T | undefined | null)[];

/** One lesson's Chinese (src/lessons/zh/<same file name as the English lesson>.ts: `export const zh: LessonZh`). Only
 *  words: every field is optional, lists go by place. Write the Chinese for what the English says, keep its HTML
 *  (<b>, <dfn>, <i>, badges) and its numbers from the shared data (import them as the English file does). */
export interface LessonZh {
  /** The English lesson's id (the file is found by it). */
  id: string;
  title?: string;
  kicker?: string;
  /** HTML. */
  lede?: string;
  /** By place (the lesson has three). */
  features?: ZhList<{ title?: string; text?: string }>;
  /** HTML. For a defined term write <dfn data-term="taxel">触觉像素（taxel）</dfn>: data-term is the glossary id, so the
   *  popover finds the term whatever the words. */
  overview?: string;
  /** By place in the English `specs` list. `value` only where the English value has words in it (most rows are
   *  numbers and units and need none). */
  specs?: ZhList<{ label?: string; value?: string; note?: string }>;
  /** By place: the step's title and text (HTML). Keep each text to 3 lines at 1366-1440 px windows. */
  steps?: ZhList<{ title?: string; text?: string }>;
  /** By place; `choices` by place too (the answer index is the English one: keep the order). */
  quiz?: ZhList<{ q?: string; choices?: ZhList<string>; why?: string }>;
  wiring?: { intro?: string; foot?: string; rows?: ZhList<{ from?: string; to?: string; note?: string }> };
  parts?: { intro?: string; foot?: string; rows?: ZhList<{ name?: string; qty?: string; note?: string }> };
  /** The code itself stays as it is; its caption, the notes on the Code tab and the labels of its editable numbers. */
  code?: { caption?: string; notes?: ZhList<string>; params?: ZhList<{ label?: string }> };
  media?: ZhList<{ alt?: string; caption?: string }>;
}

export interface SectionZh {
  title?: string;
  blurb?: string;
  /** By place (0-based, as in SECTIONS). */
  chapters?: ZhList<{ title?: string; text?: string; alt?: string }>;
}

// Every src/lessons/zh/*.ts except _*.ts (shared tables), keyed by the lesson id it names.
const FILES = import.meta.glob<{ zh?: LessonZh }>(["../lessons/zh/*.ts", "!../lessons/zh/_*.ts"], { eager: true });
const LESSONS_ZH = new Map<string, LessonZh>();
for (const [path, mod] of Object.entries(FILES)) {
  const z = mod.zh;
  if (!z || typeof z.id !== "string") {
    console.warn(`i18n: ${path} has no \`export const zh: LessonZh\` with an id`);
    continue;
  }
  LESSONS_ZH.set(z.id, z);
}

/** The Chinese file for a lesson id, if there is one (for the check script and tests). */
export const lessonZh = (id: string): LessonZh | undefined => LESSONS_ZH.get(id);

// (an empty Chinese slot counts as missing: a half-filled file never blanks a text)
const str = (z: unknown, en: string): string => (typeof z === "string" && z.trim() !== "" ? z : en);

function over<E, Z>(en: E[], zh: ZhList<Z> | undefined, f: (e: E, z: Z) => E): E[] {
  if (!zh) return en;
  return en.map((e, i) => {
    const z = zh[i];
    return z === undefined || z === null ? e : f(e, z);
  });
}

/** A Specs row in Chinese: the lesson's own Chinese (z), else the fact's own words (FACTS_ZH, UNITS_ZH), else the
 *  English text's (SPECS_ZH), else the fact's default label, else English (src/content/facts.zh.ts). */
export function locSpec(s: Spec, z?: { label?: string; value?: string; note?: string } | null): Spec {
  const f = s.fact ? FACTS_ZH[s.fact.key] : undefined;
  const byText = (en: string | undefined): string | undefined => {
    const v = en ? SPECS_ZH[en.trim()] : undefined;
    return v?.trim() ? v : undefined;
  };
  let value = s.value;
  if (z?.value?.trim()) value = z.value;
  else if (s.fact?.value) {
    if (f?.value?.trim()) value = f.value;
    else {
      try {
        value = formatValue(getFact(s.fact.key), "zh");
      } catch {
        /* keep the English */
      }
    }
  } else value = byText(s.value) ?? s.value;
  const note = z?.note?.trim() ? z.note : s.fact?.note && f?.note?.trim() ? f.note : byText(s.note) ?? s.note;
  return { ...s, label: str(z?.label, byText(s.label) ?? f?.label ?? s.label), value, note };
}

function merge(en: Lesson, z: LessonZh | undefined): Lesson {
  const out: Lesson = {
    ...en,
    title: str(z?.title, en.title),
    kicker: str(z?.kicker, en.kicker),
    lede: str(z?.lede, en.lede),
    features: over(en.features, z?.features, (f, y) => ({ ...f, title: str(y.title, f.title), text: str(y.text, f.text) })) as Lesson["features"],
    overview: str(z?.overview, en.overview),
    specs: en.specs.map((s, i) => locSpec(s, z?.specs?.[i])),
  };
  if (en.steps) out.steps = over(en.steps, z?.steps, (s, y) => ({ ...s, title: str(y.title, s.title), text: str(y.text, s.text) }));
  if (en.quiz)
    out.quiz = over(en.quiz, z?.quiz, (q, y) => ({
      ...q,
      q: str(y.q, q.q),
      choices: over(q.choices, y.choices ?? undefined, (c, yc) => str(yc, c)),
      why: str(y.why, q.why),
    }));
  if (en.wiring && z?.wiring) {
    const w = z.wiring;
    out.wiring = {
      ...en.wiring,
      intro: en.wiring.intro === undefined ? undefined : str(w.intro, en.wiring.intro),
      foot: en.wiring.foot === undefined ? undefined : str(w.foot, en.wiring.foot),
      rows: over(en.wiring.rows, w.rows, (r, y) => ({ ...r, from: str(y.from, r.from), to: str(y.to, r.to), note: str(y.note, r.note) })),
    };
  }
  if (en.parts && z?.parts) {
    const p = z.parts;
    out.parts = {
      ...en.parts,
      intro: en.parts.intro === undefined ? undefined : str(p.intro, en.parts.intro),
      foot: en.parts.foot === undefined ? undefined : str(p.foot, en.parts.foot),
      rows: over(en.parts.rows, p.rows, (r, y) => ({ ...r, name: str(y.name, r.name), qty: str(y.qty, r.qty), note: str(y.note, r.note) })),
    };
  }
  if (en.code && z?.code) {
    const c = z.code;
    out.code = {
      ...en.code,
      caption: en.code.caption === undefined ? undefined : str(c.caption, en.code.caption),
      notes: en.code.notes ? over(en.code.notes, c.notes, (n, y) => str(y, n)) : undefined,
      params: over(en.code.params, c.params, (p, y) => ({ ...p, label: str(y.label, p.label) })),
    };
  }
  if (en.media && z?.media) out.media = over(en.media, z.media, (m, y) => ({ ...m, alt: str(y.alt, m.alt), caption: m.caption === undefined ? undefined : str(y.caption, m.caption) }));
  return out;
}

const memo = new WeakMap<Lesson, Lesson>();

/** The lesson in the current language (or `l`). In English: the lesson itself. */
export function loc(lesson: Lesson, l: Lang = lang()): Lesson {
  if (l !== "zh") return lesson;
  let m = memo.get(lesson);
  if (!m) {
    m = merge(lesson, LESSONS_ZH.get(lesson.id));
    memo.set(lesson, m);
  }
  return m;
}

const secMemo = new WeakMap<Section, Section>();

/** A section (and its chapters) in the current language. In English: the section itself. */
export function locSection(sec: Section, l: Lang = lang()): Section {
  if (l !== "zh") return sec;
  let m = secMemo.get(sec);
  if (!m) {
    const z = SECTIONS_ZH[sec.n];
    m = {
      ...sec,
      title: str(z?.title, sec.title),
      blurb: str(z?.blurb, sec.blurb),
      chapters: over<Chapter, { title?: string; text?: string; alt?: string }>(sec.chapters, z?.chapters, (c, y) => ({
        ...c,
        title: str(y.title, c.title),
        text: str(y.text, c.text),
        alt: str(y.alt, c.alt),
      })),
    };
    secMemo.set(sec, m);
  }
  return m;
}

/** A glossary term in the current language, with `en` its English name. In Chinese, `term` is the Chinese name when
 *  there is one (product names stay English), `aka` the Chinese aka (else the English). */
export function locTerm(term: Term, l: Lang = lang()): Term & { en: string; zh?: string } {
  if (l !== "zh") return { ...term, en: term.term };
  const z = GLOSSARY_ZH[term.id];
  return { ...term, en: term.term, zh: z?.term, term: str(z?.term, term.term), aka: z?.aka ?? term.aka, def: str(z?.def, term.def) };
}
