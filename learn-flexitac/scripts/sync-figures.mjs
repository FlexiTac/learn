// Copy the finished anatomy figures into public/figures so Vite serves and ships them as static files.
//   node scripts/sync-figures.mjs            (also runs before `npm run dev` and `npm run build`)
// Source: ../flexitac-anatomy/figures/{pad,crossing,board,gripper}/{name}.html and {name}-light.html
// Override the source with FLEXITAC_FIGURES=/abs/path/to/figures.
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const src = process.env.FLEXITAC_FIGURES ?? resolve(root, "../flexitac-anatomy/figures");
const out = join(root, "public/figures");
const FIGS = ["pad", "crossing", "board", "gripper"];

mkdirSync(out, { recursive: true });
let copied = 0;
const missing = [];
for (const fig of FIGS) {
  for (const name of [`${fig}.html`, `${fig}-light.html`]) {
    const from = join(src, fig, name);
    if (!existsSync(from)) {
      missing.push(from);
      continue;
    }
    const to = join(out, name);
    const fresh = !existsSync(to) || statSync(to).mtimeMs < statSync(from).mtimeMs || statSync(to).size !== statSync(from).size;
    if (fresh) copyFileSync(from, to);
    copied++;
    console.log(`${fresh ? "copied " : "up to date"}  ${name}  (${(statSync(to).size / 1024).toFixed(0)} KB)`);
  }
}
if (missing.length) {
  // Missing figures are an error when nothing usable is in public/figures already.
  const have = FIGS.every((f) => existsSync(join(out, `${f}.html`)) && existsSync(join(out, `${f}-light.html`)));
  console[have ? "warn" : "error"](`sync-figures: missing ${missing.length} source file(s):\n  ${missing.join("\n  ")}`);
  if (!have) process.exit(1);
}
console.log(`sync-figures: ${copied} file(s) in public/figures`);

// The site copies the lesson accents, the hotspot teal and a few materials (gold, Velostat, rubber, signal pink: the
// Velostat demo card) from figures/palette.css into src/styles/tokens.css.
// Warn (don't fail) when the two drift apart.
const palette = join(src, "palette.css");
if (existsSync(palette)) {
  const grab = (css, start, end) => {
    const i = css.indexOf(start);
    if (i < 0) return {};
    const block = css.slice(i, end ? css.indexOf(end, i + start.length) : undefined);
    return Object.fromEntries([...block.matchAll(/(--ft-(?:lesson-\d+(?:-soft)?|hotspot(?:-soft)?|(?:gold|velostat|rubber)-(?:top|left|right|edge)|signal(?:-soft)?)):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim().toLowerCase()]));
  };
  const pal = readFileSync(palette, "utf8");
  const tok = readFileSync(join(root, "src/styles/tokens.css"), "utf8");
  const pairs = [
    ["light", grab(pal, ':root[data-theme="light"]', "}"), grab(tok, ":root {", "}")],
    ["dark", grab(pal, ":root, .iso", "}"), grab(tok, ':root[data-theme="dark"]', "}")],
  ];
  const off = [];
  for (const [name, a, b] of pairs) for (const [k, v] of Object.entries(a)) if (b[k] !== v) off.push(`${name} ${k}: palette ${v}, tokens ${b[k] ?? "missing"}`);
  if (off.length) console.warn(`sync-figures: src/styles/tokens.css differs from figures/palette.css:\n  ${off.join("\n  ")}`);
  else console.log("sync-figures: lesson colours match figures/palette.css");
}
