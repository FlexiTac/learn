#!/usr/bin/env node
// i18n check: which English words of the site have no Chinese yet (docs/i18n.md). Read-only; prints a report.
//
//   node scripts/i18n-check.mjs                     everything, grouped: ui, pages, sections, lessons, glossary,
//                                                   widgets (and the site's own UI code), figures
//   node scripts/i18n-check.mjs --summary           one line per lesson / page / widget / figure: what is left
//   node scripts/i18n-check.mjs --only lessons,glossary     just those groups (ui pages sections lessons glossary
//                                                   widgets figures)
//   node scripts/i18n-check.mjs --lesson one-frame  one lesson (its id or its file name, e.g. 09-one-frame)
//   node scripts/i18n-check.mjs --widget sim-loop   one widget file (src/widgets/<name>.ts)
//   node scripts/i18n-check.mjs --figure pad        one figure (pad | board | gripper | crossing)
//   node scripts/i18n-check.mjs --all               also the widgets and the figure no lesson uses today
//   node scripts/i18n-check.mjs --json              the whole report as JSON
//   node scripts/i18n-check.mjs --scaffold 09-one-frame    print a src/lessons/zh/09-one-frame.ts to start from (every
//                                                   English text as a comment above an empty slot), then exit
//   --strict                                        exit 1 when anything is left (default: always 0)
//
// How it knows:
//   - ui / pages: the keys of src/i18n/en/*.ts without a line in src/i18n/zh/*.ts;
//   - sections, lessons, glossary: the content loaded through Vite (as the site does) and laid over with its Chinese
//     (src/i18n/localize.ts loc / locSection / locTerm): a text that is still the English one AND has English words in
//     it (not just numbers, units, code and the names that stay English: docs/i18n-terms-zh.md) is listed. A lesson's
//     Chinese list longer than its English one is listed as stale;
//   - widgets and the site's UI code (src/widgets, src/ui, src/views, src/figure): English-looking strings in the source
//     (texts between tags, aria-label / title / alt / placeholder values, plain strings with words) that are not inside
//     t(), tx(en, zh) or strings(en, zh); tx() without its Chinese and strings() keys missing in the Chinese table too.
//     A heuristic: it lists candidates, and code that is not shown to learners may turn up (class names do not);
//   - figures (../flexitac-anatomy/figures/<fig>): parts.mjs PARTS fields missing in <fig>/zh.mjs PARTS_ZH, and
//     English-looking strings in live.js / explore.js / connect.js / teleop.js that are not keys of <fig>/zh.mjs ZH
//     (docs/i18n.md "Figures": `${x}` in the source matches {name} in a key).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const figuresDir = process.env.FLEXITAC_FIGURES ?? resolve(root, "../flexitac-anatomy/figures");

// ------------------------------------------------------------------ arguments
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const GROUPS = ["ui", "pages", "sections", "lessons", "glossary", "widgets", "figures"];
let only = opt("only") ? opt("only").split(",").map((s) => s.trim()) : GROUPS;
const oneLesson = opt("lesson");
const oneWidget = opt("widget");
const oneFigure = opt("figure");
if (oneLesson) only = ["lessons"];
if (oneWidget) only = ["widgets"];
if (oneFigure) only = ["figures"];
const SUMMARY = flag("summary");
const JSON_OUT = flag("json");
const ALL = flag("all");
const scaffold = opt("scaffold");

// ------------------------------------------------------------------ "has English words that need Chinese"
// Names, units and codes that stay English in Chinese text (docs/i18n-terms-zh.md). Case-sensitive.
const KEEP = new Set(
  (
    "FlexiTac Velostat Linqstat Arduino Nano FPC FPCs FFC FFCs PCB PCBs USB USB-C AA Isaac VT-Refine ViTac 3D-ViTac UMI reBot " +
    "reBot-DevArm DevArm PyFlexiTac Adafruit Gerber Gerbers BOM CD74HC4067 SN74HC595 74HC595 Seeed Studio CoRL Python " +
    "C++ Arduino-IDE IDE ATmega328P CH340 GND VCC Vcc ADC LOW HIGH SER SRCLK RCLK OE COM SPI UART LED LEDs " +
    "mm cm µm um mil Hz kHz MHz ms µs us s kΩ MΩ Ω V mV mA µA A W baud min hex px fps dB N kn kd ḋ d k " +
    "Ctrl Enter Esc Shift Space Tab Alt Cmd ⌘ Mac Windows Linux macOS Chrome GitHub arXiv " +
    "Viridis VIRIDIS RGB PNG CSV JSON numpy NumPy OpenCV Matplotlib pyserial serial Serial PyPI pip CLI arduino-cli " +
    "Kapton Mylar Kelvin Voigt Kelvin–Voigt Kelvin-Voigt"
  ).split(/\s+/),
);
const stripHtml = (s) =>
  String(s)
    .replace(/<(code|kbd|svg|style|script)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\{\w*\}/g, " ");
/** English words in `s` that need Chinese (not names, units, codes, single letters or identifiers). */
function englishWords(s) {
  const words = stripHtml(s).match(/[A-Za-z][A-Za-z0-9'’+#-]*/g) ?? [];
  return words.filter((w) => {
    const bare = w.replace(/[’'-]+$/, "");
    if (bare.length < 2 || KEEP.has(bare) || KEEP.has(w)) return false;
    if (/\d/.test(bare)) return false; // D2, SR1, I15, 2D, 4x
    if (/^[A-Z]{2,5}s?$/.test(bare)) return false; // acronyms: ADC, LED, BOMs
    if (/^[a-z]+[A-Z]\w*$/.test(bare) || /_/.test(bare)) return false; // camelCase / snake_case identifiers
    return true;
  });
}
const needsZh = (s) => typeof s === "string" && englishWords(s).length > 0;
const short = (s, n = 90) => {
  // (for reading: tags and code out, {placeholders} kept)
  const t = String(s).replace(/<(svg|style|script)\b[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
};

// ------------------------------------------------------------------ load the site's content through Vite (SSR)
let vite = null;
async function siteModules() {
  const { createServer } = await import("vite");
  vite = await createServer({
    root,
    configFile: join(root, "vite.config.ts"),
    logLevel: "silent",
    appType: "custom",
    server: { middlewareMode: true, hmr: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  // (nothing the content needs touches the DOM when it is imported; these keep a stray top-level call quiet)
  globalThis.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
  const load = (p) => vite.ssrLoadModule(p);
  const [lessons, localize, strings, glossary] = await Promise.all([
    load("/src/lessons/index.ts"),
    load("/src/i18n/localize.ts"),
    load("/src/i18n/strings.ts"),
    load("/src/content/glossary.ts"),
  ]);
  return { lessons, localize, strings, glossary };
}

// English lesson files: id -> file name (the Chinese file must have the same name)
function lessonFiles() {
  const dir = join(root, "src/lessons");
  const out = new Map();
  for (const f of readdirSync(dir)) {
    if (!/^\d.*\.ts$/.test(f)) continue;
    const src = readFileSync(join(dir, f), "utf8");
    // the lesson's own id: the first `id:` after `export const lesson` (a file may list other ids before it)
    const at = src.search(/export const lesson\b/);
    const m = (at >= 0 ? src.slice(at) : src).match(/^\s*id:\s*"([^"]+)"/m);
    if (m) out.set(m[1], f);
  }
  return out;
}
function zhLessonFiles() {
  const dir = join(root, "src/lessons/zh");
  const out = new Map();
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".ts") || f.startsWith("_")) continue;
    const m = readFileSync(join(dir, f), "utf8").match(/\bid:\s*"([^"]+)"/);
    out.set(f, m ? m[1] : null);
  }
  return out;
}

// ------------------------------------------------------------------ report
const report = { ui: [], pages: [], sections: [], lessons: [], glossary: [], widgets: [], figures: [], notes: [] };

function checkStrings(strings) {
  const { EN, ZH } = strings;
  const uiKeys = new Set(Object.keys(readKeys("src/i18n/en/ui.ts")));
  for (const k of Object.keys(EN)) {
    if (ZH[k] !== undefined) continue;
    if (!needsZh(EN[k])) continue;
    (uiKeys.has(k) ? report.ui : report.pages).push({ where: k, en: short(EN[k]) });
  }
}
// keys of an `export const X = { "a.b": ... }` table, read from the source (to tell ui keys from page keys)
function readKeys(rel) {
  const src = readFileSync(join(root, rel), "utf8");
  const keys = {};
  for (const m of src.matchAll(/^\s*"([\w.]+)":/gm)) keys[m[1]] = true;
  return keys;
}

function checkSections(lessons, localize) {
  for (const sec of lessons.SECTIONS) {
    const z = localize.locSection(sec, "zh");
    const item = { where: `Section ${sec.n} · ${sec.title}`, missing: [] };
    for (const f of ["title", "blurb"]) if (z[f] === sec[f] && needsZh(sec[f])) item.missing.push({ path: f, en: short(sec[f]) });
    sec.chapters.forEach((c, i) => {
      for (const f of ["title", "text", "alt"]) if (z.chapters[i][f] === c[f] && needsZh(c[f])) item.missing.push({ path: `chapters[${i}].${f}`, en: short(c[f]) });
    });
    if (item.missing.length) report.sections.push(item);
  }
}

/** Every text of a lesson, as [path, english, chinese-or-english] (Chinese = loc(lesson, "zh")). */
function lessonTexts(L, Z) {
  const out = [];
  const add = (path, en, zh) => {
    if (typeof en === "string") out.push([path, en, zh]);
  };
  add("title", L.title, Z.title);
  add("kicker", L.kicker, Z.kicker);
  add("lede", L.lede, Z.lede);
  L.features.forEach((f, i) => {
    add(`features[${i}].title`, f.title, Z.features[i].title);
    add(`features[${i}].text`, f.text, Z.features[i].text);
  });
  add("overview", L.overview, Z.overview);
  L.specs.forEach((s, i) => {
    const hint = s.fact ? ` (fact ${s.fact.key})` : "";
    add(`specs[${i}].label${hint}`, s.label, Z.specs[i].label);
    add(`specs[${i}].value${hint}`, s.value, Z.specs[i].value);
    add(`specs[${i}].note${hint}`, s.note, Z.specs[i].note);
  });
  (L.steps ?? []).forEach((s, i) => {
    add(`steps[${i}].title`, s.title, Z.steps[i].title);
    add(`steps[${i}].text`, s.text, Z.steps[i].text);
  });
  (L.quiz ?? []).forEach((q, i) => {
    add(`quiz[${i}].q`, q.q, Z.quiz[i].q);
    q.choices.forEach((c, j) => add(`quiz[${i}].choices[${j}]`, c, Z.quiz[i].choices[j]));
    add(`quiz[${i}].why`, q.why, Z.quiz[i].why);
  });
  for (const k of ["wiring", "parts"]) {
    const e = L[k];
    if (!e) continue;
    add(`${k}.intro`, e.intro, Z[k].intro);
    add(`${k}.foot`, e.foot, Z[k].foot);
    const cols = k === "wiring" ? ["from", "to", "note"] : ["name", "qty", "note"];
    e.rows.forEach((r, i) => cols.forEach((c) => add(`${k}.rows[${i}].${c}`, r[c], Z[k].rows[i][c])));
  }
  if (L.code) {
    add("code.caption", L.code.caption, Z.code.caption);
    (L.code.notes ?? []).forEach((n, i) => add(`code.notes[${i}]`, n, Z.code.notes[i]));
    L.code.params.forEach((p, i) => add(`code.params[${i}].label`, p.label, Z.code.params[i].label));
  }
  (L.media ?? []).forEach((m, i) => {
    add(`media[${i}].alt`, m.alt, Z.media[i].alt);
    add(`media[${i}].caption`, m.caption, Z.media[i].caption);
  });
  return out;
}

function checkLessons(lessons, localize) {
  const files = lessonFiles();
  const zhFiles = zhLessonFiles();
  const ids = new Set(lessons.LESSONS.map((l) => l.id));
  for (const [f, id] of zhFiles) {
    if (!id) report.notes.push(`src/lessons/zh/${f}: no \`id: "…"\` (export const zh: LessonZh = { id: "<lesson id>", … })`);
    else if (!ids.has(id)) report.notes.push(`src/lessons/zh/${f}: id "${id}" is not a lesson in the course`);
    else if (files.get(id) !== f) report.notes.push(`src/lessons/zh/${f}: lesson "${id}" lives in src/lessons/${files.get(id)}; name the Chinese file the same`);
  }
  for (const L of lessons.LESSONS) {
    const file = files.get(L.id) ?? "?";
    if (oneLesson && oneLesson !== L.id && oneLesson !== file.replace(/\.ts$/, "")) continue;
    const z = localize.lessonZh(L.id);
    const Z = localize.loc(L, "zh");
    const texts = lessonTexts(L, Z);
    const missing = texts.filter(([, en, zh]) => en === zh && needsZh(en)).map(([path, en]) => ({ path, en: short(en) }));
    const need = texts.filter(([, en]) => needsZh(en)).length;
    const stale = [];
    if (z) {
      const len = (a) => (Array.isArray(a) ? a.length : 0);
      for (const [k, en] of [["features", L.features], ["specs", L.specs], ["steps", L.steps], ["quiz", L.quiz], ["media", L.media]])
        if (len(z[k]) > len(en)) stale.push(`${k}: the Chinese has ${len(z[k])}, the lesson ${len(en)}`);
      (z.quiz ?? []).forEach((q, i) => {
        if (q?.choices && L.quiz?.[i] && q.choices.length > L.quiz[i].choices.length) stale.push(`quiz[${i}].choices: ${q.choices.length} in Chinese, ${L.quiz[i].choices.length} in English`);
      });
      for (const k of ["wiring", "parts"]) if (z[k]?.rows && len(z[k].rows) > len(L[k]?.rows)) stale.push(`${k}.rows: ${len(z[k].rows)} in Chinese, ${len(L[k]?.rows)} in English`);
      if (z.code?.notes && len(z.code.notes) > len(L.code?.notes)) stale.push(`code.notes: ${len(z.code.notes)} in Chinese, ${len(L.code?.notes)} in English`);
    }
    report.lessons.push({
      where: `${lessons.lessonNo(L)} ${L.title}`,
      id: L.id,
      file: `src/lessons/${file}`,
      zhFile: z ? `src/lessons/zh/${file}` : null,
      done: need - missing.length,
      of: need,
      missing,
      stale,
    });
  }
}

function checkGlossary(glossary, localize) {
  for (const g of glossary.GLOSSARY) {
    const z = localize.locTerm(g, "zh");
    const missing = [];
    if (!z.zh && needsZh(g.term)) missing.push({ path: "term", en: g.term });
    if (z.def === g.def && needsZh(g.def)) missing.push({ path: "def", en: short(g.def) });
    if (missing.length) report.glossary.push({ where: `${g.id} (${g.term})`, missing });
  }
}

// ------------------------------------------------------------------ source scan (widgets, UI code, figures)
let ts = null;
async function typescript() {
  ts ??= (await import("typescript")).default;
  return ts;
}

// calls whose direct string arguments are never learner-facing
const SKIP_CALLS = new Set(
  (
    "querySelector querySelectorAll closest matches getElementById getElementsByClassName add remove toggle contains " +
    "setAttribute getAttribute removeAttribute toggleAttribute hasAttribute addEventListener removeEventListener dispatchEvent " +
    "createElement createElementNS getPropertyValue setProperty removeProperty matchMedia postMessage act acts can supports " +
    "import require fetch startsWith endsWith includes split indexOf lastIndexOf match test exec padStart padEnd join " +
    "localeCompare getContext Event CustomEvent KeyboardEvent MouseEvent PointerEvent URL URLSearchParams get set has delete " +
    "loadWidget icon partIcon lc h $ animate toFixed Number parseFloat parseInt NumberFormat requestAnimationFrame " +
    "setTimeout setInterval toggleClass attr"
  ).split(/\s+/),
);
// calls whose string arguments, however deep, are never learner-facing (or are already translated)
const SKIP_INSIDE = new Set("t tx strings T log warn error info debug assert trace Error TypeError RangeError SyntaxError".split(" "));
// texts that stay English everywhere (the brand)
const KEEP_PHRASES = [/Learn FlexiTac/g];
// object keys whose string values are never learner-facing
const SKIP_KEYS = new Set(
  (
    "class className id role type href src d viewBox style fill stroke transform mode kind icon edge place lang key name " +
    "fig part from as tag data dataset width height x y cx cy r rx ry points font family weight anchor align baseline " +
    "cursor display position color background border easing ease direction unit format codec mime poster preload " +
    "decoding loading crossOrigin rel target inputmode autocomplete spellcheck pattern step min max value_type event " +
    "stage demo widget select tab theme state status phase variant symptom form side shape cap join cls svg path"
  ).split(/\s+/),
);
const TEXT_ATTRS = /\b(aria-label|aria-valuetext|aria-description|title|alt|placeholder|data-tip|data-label)\s*=\s*"([^"]*)"/g;

/** The learner-facing pieces of a string: HTML gives its texts and its labelled attributes; anything else is one piece. */
function pieces(s) {
  if (!/<[a-z!/]/i.test(s)) return [s];
  const out = [];
  const noCode = s.replace(/<(code|kbd|style|script)\b[\s\S]*?<\/\1>/gi, " ");
  for (const m of noCode.matchAll(/<[^>]*>/g)) for (const a of m[0].matchAll(TEXT_ATTRS)) out.push(a[2]);
  for (const t of noCode.split(/<[^>]*>/)) if (t.trim()) out.push(t);
  return out;
}
/** A piece that reads like words a learner sees (not a class list, selector, path, CSS or code). */
function prose(p) {
  if (/^\s*[a-z-]+:[^\s:]*\s*$/.test(p)) return false; // one CSS declaration ("font-size:{}px")
  let t = p.replace(/\{\}/g, " ").replace(/\s+/g, " ").trim();
  for (const re of KEEP_PHRASES) t = t.replace(re, " ").trim();
  if (!t || t.length < 2) return false;
  if (/="|^\[|^:|^[\w-]+\/[\w-]*$|^[\w-]+(:[\w-]+)+$/.test(t)) return false; // attribute syntax, selectors, partial paths, keys
  const toks = t.split(" ");
  if (toks.every((w) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(w)) && toks.some((w) => w.includes("-"))) return false; // a class list
  if (/^(https?:|#\/|\.{0,2}\/|data:)/.test(t) || /\.(css|m?js|ts|html|png|webp|webm|mp4|svg|json|ino|py)\b/.test(t)) return false;
  if (/[{};]|=>|\bvar\(|\b(rgba?|hsla?|calc|translate|rotate|scale|matrix|cubic-bezier|url)\(/.test(t)) return false;
  if (/^[\w-]+(?:\s+[\w-]+)*$/.test(t) && t.split(/\s+/).every((w) => /^[a-z0-9]+(?:[-_][a-z0-9]+)+$/.test(w) || /^[a-z]+$/.test(w)) && !/\s/.test(t)) return false;
  if (/^[a-z][\w-]*$/.test(t)) return false; // one lowercase token: an id, a key, an event name
  if (/^[\w.-]+$/.test(t) && /[-_.]/.test(t)) return false; // kebab / dotted tokens
  if (/^[MLHVCSQTAZmlhvcsqtaz0-9 .,-]+$/.test(t)) return false; // SVG path data
  const words = englishWords(t);
  if (!words.length) return false;
  // several words, or one capitalised word ("Ready", "Press")
  return /[A-Za-z]{2,}[\s,.:;!?'’()/-]+[A-Za-z]{2,}/.test(t) || /^[A-Z][a-z]{2,}[.!:…]?$/.test(t) || words.some((w) => /^[A-Z][a-z]{2,}$/.test(w) && t.includes(" "));
}

/** Scan one source file: candidates not translated, tx() without Chinese, strings() keys without Chinese. */
// in a figure's code: the layout audit's reasons (fanWhy = "left column too tall", ALL.why = …, last = …) and the
// labels a helper puts in its thrown errors (idx(v, n, "pressed sense")) are for the developer, never shown; so are the
// words parts.mjs checks its facts still say (says(key, "…"), nanoSays(pin, "…"))
const FIG_AUDIT_SINK = /^(\w*why|last)$/i;
const FIG_SKIP_CALLS = new Set(["idx", "says", "nanoSays"]);

/** Scan one source file: candidates not translated, tx() without Chinese, strings() keys without Chinese.
 *  opts.figure: a figure's code (FIG_AUDIT_SINK, FIG_SKIP_CALLS). */
async function scanFile(file, isTranslated = () => false, opts = {}) {
  const ts = await typescript();
  const text = readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith(".ts") ? ts.ScriptKind.TS : ts.ScriptKind.JS);
  const found = [];
  const line = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  const calleeName = (c) => {
    const e = c.expression;
    if (ts.isIdentifier(e)) return e.text;
    if (ts.isPropertyAccessExpression(e)) return e.name.text;
    return "";
  };
  const objKeys = (o) => (o && ts.isObjectLiteralExpression(o) ? o.properties.filter((p) => p.name).map((p) => (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name) ? p.name.text : "")) : []);
  const nameOf = (n) => (n.expression && ts.isIdentifier(n.expression) ? n.expression.text : n.expression && ts.isPropertyAccessExpression(n.expression) ? n.expression.name.text : "");
  const PASS = new Set([ts.SyntaxKind.PlusToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.AmpersandAmpersandToken]);
  const COMPARE = new Set([ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken, ts.SyntaxKind.InKeyword]);
  const skip = (node) => {
    // anywhere inside: imports, types, t() / tx() / strings() (translated), console and Error messages (developers)
    for (let a = node.parent; a; a = a.parent) {
      if (ts.isImportDeclaration(a) || ts.isExportDeclaration(a) || ts.isTypeNode(a)) return true;
      if ((ts.isCallExpression(a) || ts.isNewExpression(a)) && SKIP_INSIDE.has(nameOf(a))) return true;
    }
    // the string's own place, through parentheses, `a ? "x" : "y"`, `+`, `??`, arrays and template slots
    let n = node.parent;
    let child = node;
    while (
      n &&
      (ts.isParenthesizedExpression(n) || ts.isAsExpression(n) || (ts.isSatisfiesExpression?.(n) ?? false) || ts.isArrayLiteralExpression(n) ||
        ts.isTemplateSpan(n) || ts.isTemplateExpression(n) || ts.isSpreadElement(n) ||
        (ts.isConditionalExpression(n) && child !== n.condition) || (ts.isBinaryExpression(n) && PASS.has(n.operatorToken.kind)))
    ) {
      child = n;
      n = n.parent;
    }
    if (!n) return false;
    if (ts.isPropertyAssignment(n) && child === n.initializer) {
      const k = ts.isIdentifier(n.name) || ts.isStringLiteral(n.name) ? n.name.text : "";
      return SKIP_KEYS.has(k);
    }
    if (ts.isPropertyAssignment(n) && child === n.name) return true;
    // "a b c".split(" ") and friends: a word list for code, not text
    if (ts.isPropertyAccessExpression(n) && child === n.expression && /^(split|match|matchAll|replace|replaceAll|startsWith|endsWith|includes|indexOf|repeat|charCodeAt|codePointAt|search)$/.test(n.name.text)) return true;
    if (ts.isBinaryExpression(n) && COMPARE.has(n.operatorToken.kind)) return true;
    if (ts.isCaseClause(n) && child === n.expression) return true;
    if (ts.isElementAccessExpression(n) && child === n.argumentExpression) return true;
    if (opts.figure && ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken && child === n.right) {
      const target = ts.isIdentifier(n.left) ? n.left.text : ts.isPropertyAccessExpression(n.left) ? n.left.name.text : "";
      if (FIG_AUDIT_SINK.test(target)) return true;
    }
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken && child === n.right && ts.isPropertyAccessExpression(n.left)) {
      if (/^(className|id|type|src|href|cursor|display|lang|name|rel|target|inputMode)$/.test(n.left.name.text)) return true;
      if (ts.isPropertyAccessExpression(n.left.expression) && /^(style|dataset)$/.test(n.left.expression.name.text)) return true;
    }
    if ((ts.isCallExpression(n) || ts.isNewExpression(n)) && n.arguments?.includes(child)) {
      const name = nameOf(n);
      if (opts.figure && FIG_SKIP_CALLS.has(name)) return true;
      if (!SKIP_CALLS.has(name)) return false;
      // setAttribute("aria-label", "words"): the value is learner-facing
      if (name === "setAttribute" && child === n.arguments[1] && ts.isStringLiteral(n.arguments[0]) && /^(aria-label|title|alt|placeholder|aria-valuetext)$/.test(n.arguments[0].text)) return false;
      return true;
    }
    return false;
  };
  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const name = calleeName(node);
      if (name === "tx" && node.arguments.length < 2 && node.arguments[0] && (ts.isStringLiteralLike(node.arguments[0]) || ts.isTemplateExpression(node.arguments[0]))) {
        const en = ts.isTemplateExpression(node.arguments[0]) ? node.arguments[0].getText(sf).slice(1, -1) : node.arguments[0].text;
        if (needsZh(en)) found.push({ line: line(node), text: short(en), kind: "tx() without Chinese" });
      }
      if (name === "strings" && node.arguments.length >= 1) {
        const en = node.arguments[0];
        const zhKeys = new Set(objKeys(node.arguments[1]));
        if (en && ts.isObjectLiteralExpression(en))
          for (const p of en.properties) {
            const k = p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) ? p.name.text : "";
            const v = ts.isPropertyAssignment(p) && ts.isStringLiteralLike(p.initializer) ? p.initializer.text : ts.isPropertyAssignment(p) ? p.initializer.getText(sf) : "";
            if (k && !zhKeys.has(k) && needsZh(v)) found.push({ line: line(p), text: `${k}: ${short(v, 70)}`, kind: "strings() key without Chinese" });
          }
      }
    }
    let str = null;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) str = node.text;
    else if (ts.isTemplateExpression(node)) str = node.head.text + node.templateSpans.map((s) => "{}" + s.literal.text).join("");
    if (str !== null && !skip(node)) {
      for (const p of pieces(str)) {
        if (!prose(p)) continue;
        const norm = p.replace(/\s+/g, " ").trim();
        if (isTranslated(norm)) continue;
        found.push({ line: line(node), text: short(norm), kind: "text" });
      }
    }
    if (!ts.isTemplateExpression(node)) ts.forEachChild(node, visit);
    else for (const s of node.templateSpans) visit(s.expression);
  };
  visit(sf);
  // one entry per line and text
  const seen = new Set();
  return found.filter((f) => {
    const k = `${f.line}|${f.text}|${f.kind}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// the widgets the course uses: lessons' widget, steps' stage and demo cards, the home hero; and what they import
function widgetsInUse(lessons) {
  const ids = new Set(["robot-grasp"]);
  for (const L of lessons.LESSONS) {
    if (L.widget) ids.add(L.widget);
    for (const s of L.steps ?? []) {
      if (s.stage) ids.add(s.stage);
      if (s.demo) ids.add(`${s.demo}-demo`);
    }
  }
  const dir = join(root, "src/widgets");
  const files = new Set([...ids].map((id) => join(dir, `${id}.ts`)).filter(existsSync));
  for (const f of [...files]) {
    for (const m of readFileSync(f, "utf8").matchAll(/from\s+"\.\/([\w/-]+)"/g)) {
      const dep = join(dir, `${m[1]}.ts`);
      if (existsSync(dep) && !files.has(dep)) files.add(dep);
    }
  }
  return files;
}

async function checkWidgets(lessons) {
  const used = widgetsInUse(lessons);
  const dir = join(root, "src/widgets");
  const all = [...readdirSync(dir).filter((f) => f.endsWith(".ts") && f !== "index.ts").map((f) => join(dir, f)), ...readdirSync(join(dir, "scan")).filter((f) => f.endsWith(".ts")).map((f) => join(dir, "scan", f))];
  const ui = ["src/ui", "src/views", "src/figure"].flatMap((d) => readdirSync(join(root, d)).filter((f) => f.endsWith(".ts")).map((f) => join(root, d, f)));
  const targets = [
    ...all.filter((f) => ALL || used.has(f)).map((f) => ({ f, group: "widget" })),
    ...ui.map((f) => ({ f, group: "site UI" })),
    { f: join(root, "src/main.ts"), group: "site UI" },
  ];
  for (const { f, group } of targets) {
    const name = basename(f, ".ts");
    if (oneWidget && oneWidget !== name && oneWidget !== relative(root, f)) continue;
    const found = await scanFile(f);
    report.widgets.push({ where: relative(root, f), group, used: group === "site UI" || used.has(f), missing: found });
  }
  if (!ALL) {
    const unused = all.filter((f) => !used.has(f)).map((f) => basename(f, ".ts"));
    if (unused.length && !oneWidget) report.notes.push(`widgets no lesson uses today (not scanned; --all scans them): ${unused.join(", ")}`);
  }
}

const FIGS_USED = ["pad", "board", "gripper"];
async function checkFigures() {
  const figs = oneFigure ? [oneFigure] : ALL ? [...FIGS_USED, "crossing"] : FIGS_USED;
  for (const fig of figs) {
    const dir = join(figuresDir, fig);
    if (!existsSync(dir)) {
      report.notes.push(`figure ${fig}: no folder ${dir}`);
      continue;
    }
    let zh = { ZH: {}, PARTS_ZH: {} };
    const zhFile = join(dir, "zh.mjs");
    if (existsSync(zhFile)) {
      try {
        zh = { ZH: {}, PARTS_ZH: {}, ...(await import(pathToFileURL(zhFile).href + `?t=${Date.now()}`)) };
      } catch (err) {
        report.notes.push(`figure ${fig}: ${relative(root, zhFile)} failed to load: ${err.message}`);
      }
    }
    const key = (s) => s.replace(/\$\{[^}]*\}|\{\w*\}/g, "{}").replace(/\s+/g, " ").trim();
    const keys = new Set(Object.keys(zh.ZH ?? {}).map(key));
    const item = { where: `figures/${fig}`, zhFile: existsSync(zhFile) ? relative(root, zhFile) : null, parts: [], missing: [] };
    // parts.mjs: every part's words (PARTS, and board's SHIFT record), against PARTS_ZH[id]; the all-labels cards'
    // titles against CARDS_ZH[id] (or the part's Chinese title). A fact's src stays English (zh.mjs: "src and badge
    // stay the English ones"), so it counts as done.
    const partsFile = join(dir, "parts.mjs");
    let partTexts = new Set();
    /** the texts parts.mjs makes (whitespace normalised): a source string with ${} slots is covered when it matches inside one */
    let partFull = [];
    if (existsSync(partsFile)) {
      try {
        const { PARTS = [], SHIFT = null, CARDS = [] } = await import(pathToFileURL(partsFile).href);
        const PZ = zh.PARTS_ZH ?? {};
        const CZ = zh.CARDS_ZH ?? {};
        const done = (s) => {
          partTexts.add(key(s));
          partFull.push(s.replace(/\s+/g, " ").trim());
        };
        for (const p of [...PARTS, ...(SHIFT && typeof SHIFT === "object" ? [SHIFT] : [])]) {
          const z = PZ[p.id] ?? {};
          for (const f of ["title", "chip", "short", "intro", "explain", "lineDown", "lineUp"]) {
            if (typeof p[f] !== "string") continue;
            done(p[f]);
            if (z[f] === undefined && needsZh(p[f])) item.parts.push({ path: `${p.id}.${f}`, en: short(p[f]) });
          }
          if (typeof p.src === "string") done(p.src);
          (p.facts ?? []).forEach((fct, i) => {
            for (const f of ["label", "value"]) {
              if (typeof fct[f] !== "string") continue;
              done(fct[f]);
              if (z.facts?.[i]?.[f] === undefined && needsZh(fct[f])) item.parts.push({ path: `${p.id}.facts[${i}].${f}`, en: short(fct[f]) });
            }
            if (typeof fct.src === "string") done(fct.src);
          });
        }
        for (const c of Array.isArray(CARDS) ? CARDS : []) {
          if (!c || typeof c !== "object" || typeof c.id !== "string") continue;
          const z = CZ[c.id] ?? {};
          const zTitle = z.title ?? PZ[c.id]?.title;
          const title = c.record?.title ?? c.title;
          if (typeof title === "string") {
            done(title);
            if (zTitle === undefined && needsZh(title)) item.parts.push({ path: `card ${c.id}.title`, en: short(title) });
          }
          if (typeof c.label === "string") {
            done(c.label);
            if ((z.label ?? zTitle) === undefined && needsZh(c.label)) item.parts.push({ path: `card ${c.id}.label`, en: short(c.label) });
          }
        }
      } catch (err) {
        report.notes.push(`figure ${fig}: parts.mjs failed to load in node (${err.message}); its parts are scanned as source instead`);
        partTexts = new Set();
        partFull = [];
      }
    }
    const esc = (x) => x.replace(/[.*+?^$()|[\]\\{}]/g, "\\$&");
    const inParts = (s) => {
      if (!partFull.length) return false;
      const re = new RegExp(s.replace(/\s+/g, " ").trim().split("{}").map(esc).join("[\\s\\S]*?"));
      return partFull.some((t) => re.test(t));
    };
    for (const f of ["live.js", "explore.js", "connect.js", "teleop.js", "parts.mjs"]) {
      const file = join(dir, f);
      if (!existsSync(file)) continue;
      // parts.mjs: its PARTS words are counted above; the rest of the file (helpers that build text) is scanned
      const found = await scanFile(file, (s) => keys.has(key(s)) || partTexts.has(key(s)) || inParts(s), { figure: true });
      for (const x of found) item.missing.push({ ...x, file: f });
    }
    report.figures.push(item);
  }
}

// ------------------------------------------------------------------ scaffold
function printScaffold(lessons, localize, file) {
  const files = lessonFiles();
  const id = [...files].find(([, f]) => f === file || f === `${file}.ts` || f.replace(/\.ts$/, "") === file)?.[0] ?? file;
  const L = lessons.LESSONS.find((l) => l.id === id) ?? null;
  if (!L) {
    console.error(`i18n-check --scaffold: no lesson "${file}" (have: ${[...files.values()].join(", ")})`);
    return 1;
  }
  const f = files.get(L.id);
  const Z = localize.loc(L, "zh");
  // the English as it is (HTML kept: the Chinese keeps the same tags), one line
  const c = (s) => `// EN: ${String(s).replace(/\s+/g, " ").trim()}`;
  const block = (s) => `/* EN:\n${String(s).trim().replace(/\*\//g, "* /")}\n  */`;
  const q = "``";
  const lines = [];
  lines.push(`// Chinese for src/lessons/${f} (docs/i18n.md; words per docs/i18n-terms-zh.md). An empty slot shows the English.`);
  lines.push(`import type { LessonZh } from "../../i18n/localize";`, "");
  lines.push(`export const zh: LessonZh = {`, `  id: "${L.id}",`);
  lines.push(`  ${c(L.title)}`, `  title: "",`, `  ${c(L.kicker)}`, `  kicker: "",`, `  ${c(L.lede)}`, `  lede: ${q},`);
  lines.push(`  features: [`);
  for (const ft of L.features) lines.push(`    // EN: ${ft.title} | ${ft.text}`, `    { title: "", text: "" },`);
  lines.push(`  ],`, `  // the Overview (HTML): keep its tags; a defined term is <dfn data-term="<glossary id>">中文（English）</dfn>`, `  ${block(L.overview)}`, `  overview: ${q},`);
  lines.push(`  specs: [`);
  L.specs.forEach((s, i) => {
    // (a value already in Chinese through src/content/facts.zh.ts, or only numbers and units, needs no slot)
    const v = Z.specs[i].value === s.value && needsZh(s.value);
    lines.push(`    // EN: ${s.label} | ${s.value}${s.note ? " | " + s.note : ""}${s.fact ? `  (fact ${s.fact.key})` : ""}`, `    { label: ""${v ? ', value: ""' : ""}${s.note ? ', note: ""' : ""} },`);
  });
  lines.push(`  ],`);
  if (L.steps?.length) {
    lines.push(`  steps: [`);
    for (const s of L.steps) lines.push(`    ${c(s.title)}`, `    ${c(s.text)}`, `    { title: "", text: ${q} },`);
    lines.push(`  ],`);
  }
  if (L.quiz?.length) {
    lines.push(`  quiz: [`);
    for (const qq of L.quiz) {
      lines.push(`    ${c(qq.q)}`, `    // EN choices: ${qq.choices.join(" | ")}`, `    ${c(qq.why)}`);
      lines.push(`    { q: "", choices: [${qq.choices.map(() => '""').join(", ")}], why: ${q} },`);
    }
    lines.push(`  ],`);
  }
  for (const k of ["wiring", "parts"]) {
    const e = L[k];
    if (!e) continue;
    const cols = k === "wiring" ? ["from", "to", "note"] : ["name", "qty", "note"];
    lines.push(`  ${k}: {`);
    if (e.intro) lines.push(`    ${c(e.intro)}`, `    intro: ${q},`);
    lines.push(`    rows: [`);
    for (const r of e.rows) lines.push(`      // EN: ${cols.map((x) => String(r[x] ?? "").replace(/\s+/g, " ")).join(" | ")}`, `      { ${cols.filter((x) => needsZh(r[x])).map((x) => `${x}: ""`).join(", ")} },`);
    lines.push(`    ],`);
    if (e.foot) lines.push(`    ${c(e.foot)}`, `    foot: ${q},`);
    lines.push(`  },`);
  }
  if (L.code) {
    lines.push(`  code: {`);
    if (L.code.caption) lines.push(`    ${c(L.code.caption)}`, `    caption: "",`);
    if (L.code.notes?.length) {
      lines.push(`    notes: [`);
      for (const n of L.code.notes) lines.push(`      ${c(n)}`, `      ${q},`);
      lines.push(`    ],`);
    }
    if (L.code.params.length) lines.push(`    params: [${L.code.params.map((p) => `{ label: "" } /* ${p.label} */`).join(", ")}],`);
    lines.push(`  },`);
  }
  lines.push(`};`);
  console.log(lines.join("\n"));
  return 0;
}

// ------------------------------------------------------------------ run
let exit = 0;
try {
  const needSite = only.some((g) => ["ui", "pages", "sections", "lessons", "glossary", "widgets"].includes(g)) || scaffold;
  const site = needSite ? await siteModules() : null;
  if (scaffold) {
    exit = printScaffold(site.lessons, site.localize, scaffold);
  } else {
    if (only.includes("ui") || only.includes("pages")) checkStrings(site.strings);
    if (only.includes("sections")) checkSections(site.lessons, site.localize);
    if (only.includes("lessons")) checkLessons(site.lessons, site.localize);
    if (only.includes("glossary")) checkGlossary(site.glossary, site.localize);
    if (only.includes("widgets")) await checkWidgets(site.lessons);
    if (only.includes("figures")) await checkFigures();
    print();
    const left =
      report.ui.length + report.pages.length + report.sections.length + report.glossary.length +
      report.lessons.reduce((n, l) => n + l.missing.length + l.stale.length, 0) +
      report.widgets.reduce((n, w) => n + w.missing.length, 0) +
      report.figures.reduce((n, f) => n + f.missing.length + f.parts.length, 0);
    if (flag("strict") && left) exit = 1;
  }
} catch (err) {
  console.error(err);
  exit = 2;
} finally {
  await vite?.close();
}
process.exit(exit);

function print() {
  if (JSON_OUT) return console.log(JSON.stringify(report, null, 2));
  const out = [];
  const head = (s) => out.push("", `== ${s}`);
  const list = (items, fmt) => items.forEach((x) => out.push("   " + fmt(x)));
  if (only.includes("ui")) {
    head(`UI chrome (src/i18n/zh/ui.ts): ${report.ui.length} key(s) without Chinese`);
    if (!SUMMARY) list(report.ui, (x) => `${x.where}: ${x.en}`);
  }
  if (only.includes("pages")) {
    head(`Page texts (src/i18n/zh/pages.ts: home, lesson list, about): ${report.pages.length} key(s) without Chinese`);
    if (!SUMMARY) list(report.pages, (x) => `${x.where}: ${x.en}`);
  }
  if (only.includes("sections")) {
    const n = report.sections.reduce((k, s) => k + s.missing.length, 0);
    head(`Sections and chapters (src/lessons/zh/_sections.ts): ${n} text(s) without Chinese`);
    for (const s of report.sections) {
      out.push(`   ${s.where}: ${s.missing.length}`);
      if (!SUMMARY) list(s.missing, (x) => `   ${x.path}: ${x.en}`);
    }
  }
  if (only.includes("lessons")) {
    head(`Lessons (src/lessons/zh/<same file name>.ts; specs also src/content/facts.zh.ts)`);
    for (const l of report.lessons) {
      out.push(`   ${l.where}  [${l.id}]  ${l.done}/${l.of} texts in Chinese${l.zhFile ? "" : `  (no ${l.file.replace("src/lessons/", "src/lessons/zh/")} yet)`}`);
      if (!SUMMARY) list(l.missing, (x) => `   ${x.path}: ${x.en}`);
      list(l.stale, (x) => `   STALE ${x}`);
    }
  }
  if (only.includes("glossary")) {
    const n = report.glossary.length;
    head(`Glossary (src/content/glossary.zh.ts): ${n} term(s) not fully in Chinese`);
    if (!SUMMARY) list(report.glossary, (x) => `${x.where}: ${x.missing.map((m) => m.path).join(", ")}`);
  }
  if (only.includes("widgets")) {
    head(`Widgets and the site's UI code: English-looking strings outside t() / tx() / strings() (candidates)`);
    for (const w of report.widgets) {
      if (!w.missing.length && SUMMARY) continue;
      out.push(`   ${w.where}${w.group === "widget" ? "" : "  (site UI)"}: ${w.missing.length}`);
      if (!SUMMARY) list(w.missing, (x) => `   :${x.line}  ${x.kind === "text" ? "" : `[${x.kind}] `}${x.text}`);
    }
  }
  if (only.includes("figures")) {
    head(`Figures (../flexitac-anatomy/figures/<fig>/zh.mjs: ZH for strings, PARTS_ZH for parts)`);
    for (const f of report.figures) {
      out.push(`   ${f.where}: ${f.parts.length} part text(s), ${f.missing.length} string(s) without Chinese${f.zhFile ? "" : "  (no zh.mjs yet)"}`);
      if (!SUMMARY) {
        list(f.parts, (x) => `   part ${x.path}: ${x.en}`);
        list(f.missing, (x) => `   ${x.file}:${x.line}  ${x.text}`);
      }
    }
  }
  if (report.notes.length) {
    head("Notes");
    list(report.notes, (x) => x);
  }
  console.log(out.join("\n").replace(/^\n/, ""));
}
