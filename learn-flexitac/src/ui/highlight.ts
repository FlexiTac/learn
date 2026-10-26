// A very small syntax highlighter for the code card: comments, strings, numbers, keywords, calls.
// {{param}} placeholders survive highlighting and come back as editable inline inputs.
import { t } from "../i18n/strings";
import type { CodeParam, CodeSample } from "../types";
import { esc } from "./dom";

const KW: Record<CodeSample["lang"], string[]> = {
  python: "and as assert break class continue def del elif else except False finally for from global if import in is lambda None not or pass raise return True try while with yield print range len".split(" "),
  cpp: "void int uint8_t uint16_t byte bool const static return if else for while do break continue true false HIGH LOW OUTPUT INPUT define include unsigned long char struct sizeof".split(" "),
  bash: "if then else fi for do done case esac in function export cd echo sudo pip pip3 python python3 arduino-cli".split(" "),
  text: [],
};

// Placeholders become one private-use character each (U+E000 + n), which no token rule can split or swallow.
const SENTINEL = (i: number) => String.fromCharCode(0xe000 + i);
const SENTINEL_RE = /[\ue000-\ue0ff]/g;

const TOKEN: Record<CodeSample["lang"], RegExp> = {
  python: /(#[^\n]*)|("""[\s\S]*?"""|'''[\s\S]*?'''|[rbf]?"(?:\\.|[^"\\\n])*"|[rbf]?'(?:\\.|[^'\\\n])*')|(\b0x[0-9a-fA-F]+\b|\b\d+(?:\.\d+)?(?:e-?\d+)?\b)|([A-Za-z_]\w*)/g,
  cpp: /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')|(\b0x[0-9a-fA-F]+\b|\b\d+(?:\.\d+)?[uUlLfF]*\b)|(#?[A-Za-z_]\w*)/g,
  bash: /(#[^\n]*)|("(?:\\.|[^"\\])*"|'[^']*')|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][\w-]*)/g,
  text: /($^)|($^)|($^)|($^)/g,
};

function paramInput(p: CodeParam, value: number): string {
  const w = Math.max(String(p.max).length, String(value).length, String(p.step).length) + 1.2;
  return `<input class="param" type="number" inputmode="decimal" data-param="${esc(p.name)}" value="${value}" min="${p.min}" max="${p.max}" step="${p.step}" aria-label="${esc(t("code.param", { label: p.label, min: p.min, max: p.max }))}" title="${esc(p.label)} · ${p.min}–${p.max}" style="--w:${w}ch">`;
}

/** Highlighted HTML (with live inputs) for a code sample. */
export function highlight(code: CodeSample, values: Record<string, number>): string {
  const names: string[] = [];
  const src = code.source.replace(/\{\{(\w+)\}\}/g, (_, n: string) => {
    names.push(n);
    return SENTINEL(names.length - 1);
  });
  const kw = new Set(KW[code.lang]);
  const re = new RegExp(TOKEN[code.lang].source, "g");
  let out = "";
  let last = 0;
  for (let m = re.exec(src); m; m = re.exec(src)) {
    if (m[0] === "") {
      re.lastIndex++;
      continue;
    }
    out += esc(src.slice(last, m.index));
    last = m.index + m[0].length;
    const [tok, com, str, numb, word] = m;
    if (com) out += `<span class="t-com">${esc(com)}</span>`;
    else if (str) out += `<span class="t-str">${esc(str)}</span>`;
    else if (numb) out += `<span class="t-num">${esc(numb)}</span>`;
    else if (word) {
      const call = /^\s*\(/.test(src.slice(last));
      if (kw.has(word)) out += `<span class="t-kw">${esc(word)}</span>`;
      else if (/^[A-Z][A-Z0-9_]+$/.test(word)) out += `<span class="t-const">${esc(word)}</span>`;
      else if (call) out += `<span class="t-fn">${esc(word)}</span>`;
      else out += esc(word);
    } else out += esc(tok);
  }
  out += esc(src.slice(last));
  return out.replace(SENTINEL_RE, (ch: string) => {
    const name = names[ch.charCodeAt(0) - 0xe000];
    const p = code.params.find((q) => q.name === name);
    if (!p) return `<mark class="t-missing">{{${esc(name)}}}</mark>`;
    return paramInput(p, values[name] ?? p.value);
  });
}

/** Plain source with the current values filled in (for Copy). */
export function fill(code: CodeSample, values: Record<string, number>): string {
  return code.source.replace(/\{\{(\w+)\}\}/g, (_, n: string) => String(values[n] ?? code.params.find((p) => p.name === n)?.value ?? `{{${n}}}`));
}
