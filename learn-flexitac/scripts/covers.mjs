// Home-page chapter covers and lesson thumbnails for Sections 2 and 3 (2026-10-25), each taken from the chapter's own
// figure or card, in both themes:
//   public/media/covers/<name>-{light,dark}.webp   880 x 605 (16 : 11, the home cards' picture box)
//     mount    Fig 5 at Lesson 2.1's step 5 (pads taped on, tails on the back, FFCs to the two boards, USB in), the
//              right pad pressed and its touch map lit
//     grasp    Lesson 2.2's stage: Fig 5's teleop mode holding the strawberry up (at the right end of the row of objects),
//              the two pads' maps under it
//     next     "Coming next" (Section 2): the two pads' touch spots as points in 3D round a grasped tube (3D-ViTac's
//              idea), drawn here from a small model of that grasp (illustrative)
//     points   Lesson 3.2's card: the fin with its 384 points, the glass ball pressing
//     springs  Lesson 3.3's card: the ball pressed into one row, each point on its spring and damper
//     loop     Lesson 3.1's card: the real -> sim -> real loop
//   public/thumbs/L<07-14>-{light,dark}.webp       560 px wide (lesson strip and lesson list), a closer crop of the same
// Needs Chrome, ffmpeg and THIS SITE'S DEV SERVER (it serves scripts/covers.html, which mounts the widgets from src):
//   npx vite --port 8975 --strictPort     then     node scripts/covers.mjs --port 8975 [--only mount,L07] [--png <dir>]
//   ... --lang zh     the Chinese pictures (docs/i18n.md): <name>-zh-<theme>.webp for the ones with words in them
//                     (mount, grasp, points, springs, loop; L09-L11), drawn by the site and the figure in Chinese. The
//                     site shows them in Chinese (src/views/home.ts ZH_COVERS, src/ui/thumbs.ts ZH_THUMBS)
// Figures are driven through their film contract (?record: window.__film.reset/act/step), so their poses are exact;
// the cards through their own test methods (set / seek / view), so theirs are too. Only the teleop picture runs in real
// time (Fig 5's guided acts), and the script waits for the figure to report the object held and lifted.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const shared = process.env.FLEXITAC_SHARED ?? resolve(root, "../flexitac-anatomy/shared");
const { launch, sleep } = await import(pathToFileURL(resolve(root, "../flexitac-anatomy/figures/pad/shots/clean/cdp.mjs")).href);
const { VIRIDIS_RGB } = await import(pathToFileURL(join(shared, "models/viridis.mjs")).href);

const argv = process.argv.slice(2);
const argOf = (n) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : null);
const port = argOf("port") ?? "8975";
const base = `http://127.0.0.1:${port}`;
// --lang zh: the Chinese pictures, <name>-zh-<theme>.webp, of the pictures that carry words (ZH_NAMES: the others are
// the same in both languages, and the site shows the English file for them). English files are never written then.
const LANG = argOf("lang") === "zh" ? "zh" : "en";
const ZH_NAMES = ["mount", "grasp", "points", "springs", "loop", "L09", "L10", "L11"];
const Q = LANG === "zh" ? "&lang=zh" : "";
const tagOf = (name) => (LANG === "zh" ? `${name}-zh` : name);
const only0 = argOf("only") ? new Set(argOf("only").split(",")) : null;
const only = LANG === "zh" ? new Set(ZH_NAMES.filter((n) => !only0 || only0.has(n))) : only0;
const want = (name) => !only || only.has(name);
const keepPng = argOf("png") ? resolve(argOf("png")) : null;
if (keepPng) mkdirSync(keepPng, { recursive: true });
const coversOut = join(root, "public/media/covers");
const thumbsOut = join(root, "public/thumbs");
mkdirSync(coversOut, { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), "lf-covers-"));
const COVER = [880, 605];
const THUMB_W = 560;

// a cover is exactly COVER (its clip has that aspect already); a thumbnail keeps its aspect at THUMB_W wide
const webp = (src, dst, w) =>
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", src, "-vf", `scale=${w}:${w === COVER[0] ? COVER[1] : -2}:flags=lanczos`, "-c:v", "libwebp", "-quality", "80", "-compression_level", "6", dst]);

/** Save a capture (PNG, base64) as webp at width w. */
function save(b64, dst, w, tag) {
  const png = join(tmp, `${tag}.png`);
  writeFileSync(png, Buffer.from(b64, "base64"));
  if (keepPng) writeFileSync(join(keepPng, `${tag}.png`), Buffer.from(b64, "base64"));
  webp(png, dst, w);
  console.log("wrote", dst.replace(root + "/", ""));
}

/** A rectangle of the given aspect (w / h) round a box, as large as `box` needs, kept inside `within`. */
function aspectClip(box, aspect, within, pad = 0) {
  let w = box.w + 2 * pad;
  let h = box.h + 2 * pad;
  if (w / h < aspect) w = h * aspect;
  else h = w / aspect;
  if (w > within.w) {
    w = within.w;
    h = w / aspect;
  }
  if (h > within.h) {
    h = within.h;
    w = h * aspect;
  }
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const x = Math.min(Math.max(cx - w / 2, within.x), within.x + within.w - w);
  const y = Math.min(Math.max(cy - h / 2, within.y), within.y + within.h - h);
  return { x, y, width: w, height: h };
}

async function capture(b, clip, scale = 2) {
  const r = await b.send("Page.captureScreenshot", { format: "png", clip: { ...clip, scale }, captureBeyondViewport: true });
  return r.data;
}

const rect = (b, sel) => b.evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;const r=e.getBoundingClientRect();return {x:r.left+scrollX,y:r.top+scrollY,w:r.width,h:r.height}})()`);
const until = async (b, js, ms = 15000) => {
  const t0 = Date.now();
  for (;;) {
    let v = null;
    try {
      v = await b.evaluate(js);
    } catch {}
    if (v) return v;
    if (Date.now() - t0 > ms) throw new Error(`timeout: ${js}`);
    await sleep(100);
  }
};

// ------------------------------------------------------------------ Fig 5 (Lesson 2.1 and 2.2): mount + L07, grasp + L08
// Both in this site's own stage (FigureHost in stage mode, as the lessons show them), in a window wide and tall enough
// for the desktop layout rules (at least 1024 x 640). The figure's corner texts are hidden for the picture.
const BARE = `(()=>{const d=document.querySelector(".figure-frame").contentDocument;const s=d.createElement("style");s.textContent=".iso-plate-corners,.iso-plate-corner,.ft-viewbar,.ft-viewbar *{display:none!important}";d.head.append(s);})()`;

async function figMount(theme) {
  const [W, H] = COVER;
  const b = await launch({ width: 1100, height: 760 });
  try {
    await b.goto(`${base}/scripts/covers.html?w=gripper&theme=${theme}&size=${W}x${H}${Q}`);
    await until(b, `window.__host && __host.status === "ready"`);
    await sleep(800);
    await b.evaluate(`__host.act("step", 5)`);
    await sleep(7000);
    await b.evaluate(`__host.act("press", {finger: "right", amount: 1, sense: 5.5, drive: 14}, {once: true})`);
    await sleep(1200);
    await b.evaluate(BARE);
    await sleep(300);
    const fig = await rect(b, ".figure-frame");
    // a little closer than the stage: the gripper and its maps, the empty band on the left left out
    if (want("mount")) save(await capture(b, { x: fig.x + fig.w * 0.24, y: fig.y + fig.h * 0.09, width: fig.w * 0.76, height: fig.h * 0.76 }), join(coversOut, `${tagOf("mount")}-${theme}.webp`), COVER[0], `${tagOf("mount")}-${theme}`);
    // the lesson thumbnail: the gripper, closer (the middle of the drawing)
    if (want("L07")) save(await capture(b, { x: fig.x + fig.w * 0.22, y: fig.y + fig.h * 0.3, width: fig.w * 0.46, height: (fig.w * 0.46) / 1.52 }), join(thumbsOut, `${tagOf("L07")}-${theme}.webp`), THUMB_W, `${tagOf("L07")}-${theme}`);
    if (b.problems.length) console.warn("problems:", b.problems);
  } finally {
    b.close();
  }
}

async function figGrasp(theme) {
  const [W, H] = COVER;
  const b = await launch({ width: 1100, height: 760 });
  try {
    await b.goto(`${base}/scripts/covers.html?w=teleop&theme=${theme}&size=${W}x${H}${Q}`);
    await until(b, `window.__host && __host.status === "ready" && __host.lastState?.teleop && !__host.lastState.teleop.entering`);
    await sleep(1200);
    const act = (name, arg) => b.evaluate(`__host.act(${JSON.stringify(name)}, ${JSON.stringify(arg ?? null)}, {once: true})`);
    await act("reach", "strawberry");
    await act("close");
    await act("lift", 30);
    await until(b, `(()=>{const t=__host.lastState?.teleop;return t && t.held === "strawberry" && !t.busy && t.gripper.z > 25})()`, 20000);
    await sleep(1500);
    await b.evaluate(BARE);
    await sleep(300);
    const stage = await rect(b, ".stage");
    if (want("grasp")) save(await capture(b, { x: stage.x + 1, y: stage.y + 1, width: W - 2, height: H - 2 }), join(coversOut, `${tagOf("grasp")}-${theme}.webp`), COVER[0], `${tagOf("grasp")}-${theme}`);
    // the thumbnail: the fingers holding the fruit up over the mat (the crop centred on the fruit: the objects stand in
    // a row across the figure, the strawberry at its right end)
    const fig = await rect(b, ".figure-frame");
    const fx = await b.evaluate(`(()=>{const f=document.querySelector(".figure-frame");const T=f.contentWindow.__grTeleop;const p=T.state().objects.strawberry;return T.clientOf(p)[0]})()`);
    const tw = fig.w * 0.56;
    const tx = Math.max(fig.x, Math.min(fig.x + fig.w - tw, fig.x + fx - tw * 0.5));
    if (want("L08")) save(await capture(b, { x: tx, y: fig.y + 4, width: tw, height: tw / 1.52 }), join(thumbsOut, `${tagOf("L08")}-${theme}.webp`), THUMB_W, `${tagOf("L08")}-${theme}`);
    if (b.problems.length) console.warn("problems:", b.problems);
  } finally {
    b.close();
  }
}

// ------------------------------------------------------------------ the Section 3 cards: points, springs, loop + L09-L14
// [widget, card size, prep (in the page, `i` = the card), cover name or null, cover box selector, thumb name, thumb box]
const CARDS = [
  ["sim-loop", "760x780", `i.seek(3.64)`, "loop", ".sl-draw", "L09", ".sl-draw"],
  ["sim-points", "760x700", `i.set({object:"ball", a:-2, b:-3, down:true})`, "points", ".sp-anim", "L10", ".sp-anim"],
  ["sim-springs", "720x760", `i.seek(1.9, "slow")`, "springs", ".ss-anim", "L11", ".ss-anim"],
  ["sim-calibrate", "720x760", `i.view({focus: null, fit: true})`, null, null, "L12", ".sc-csvg"],
  ["sim-results", "760x760", `i.view({step: 3})`, null, null, "L13", ".sr-tile[data-i=\"2\"]"],
  ["sim-playground", "760x720", `i.set({object:"berry"}); i.seek(1.0)`, null, null, "L14", ".sg-anim"],
];

async function cardShots(theme) {
  for (const [w, size, prep, cover, coverSel, thumb, thumbSel] of CARDS) {
    if (!(cover && want(cover)) && !want(thumb)) continue;
    const [W, H] = size.split("x").map(Number);
    const b = await launch({ width: W + 40, height: H + 60 });
    try {
      await b.goto(`${base}/scripts/covers.html?w=${w}&theme=${theme}&size=${size}${Q}`);
      await until(b, `window.__ready && window.__inst`);
      await sleep(900);
      await b.evaluate(`(()=>{const i=window.__inst; i.pause?.(); ${prep};})()`);
      await sleep(1400);
      const card = await rect(b, ".demo-card");
      const inner = { x: card.x + 1, y: card.y + 3, w: card.w - 2, h: card.h - 4 };
      // only the drawing in the picture: everything else on the card is hidden (its place stays blank card face)
      const isolate = (sel) => b.evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(sel)});const card=document.querySelector(".demo-card");for(const e of card.querySelectorAll("*")) e.style.visibility=(e===el||e.contains(el)||el.contains(e))?"":"hidden";})()`);
      if (cover && want(cover)) {
        await isolate(coverSel);
        await sleep(100);
        const box = await rect(b, coverSel);
        save(await capture(b, aspectClip(box, COVER[0] / COVER[1], inner, 10)), join(coversOut, `${tagOf(cover)}-${theme}.webp`), COVER[0], `${tagOf(cover)}-${theme}`);
      }
      if (want(thumb)) {
        let box = null;
        let used = "";
        for (const sel of thumbSel.split(/,\s*/)) if (!box) {
          box = await rect(b, sel);
          used = sel;
        }
        // (Lesson 3.4's chart keeps its knobs round it: the chart alone is mostly white space)
        if (box && thumb !== "L12") await isolate(used);
        await sleep(100);
        save(await capture(b, aspectClip(box ?? inner, THUMB_W / 368, inner, 6)), join(thumbsOut, `${tagOf(thumb)}-${theme}.webp`), THUMB_W, `${tagOf(thumb)}-${theme}`);
      }
      if (b.problems.length) console.warn(w, "problems:", b.problems);
    } finally {
      b.close();
    }
  }
}

// ------------------------------------------------------------------ "Coming next": touch as points in 3D (a drawing)
// Two pads (12 x 32 points, 2 mm apart) face each other across a grasped glass tube that runs diagonally between them,
// as in the FlexiTac team's photo of a gripper holding a test tube; each point is drawn where it sits in 3D, coloured by
// how far the tube presses into it (viridis, as the maps), the others faint: the idea of 3D-ViTac's tactile point
// clouds. Isometric (azimuth 40°, elevation 30°, the cards' camera). Illustrative.
function nextSvg(theme) {
  const dark = theme === "dark";
  const bg = dark ? "#18181a" : "#f4f4f1";
  const faint = dark ? "#3c3c42" : "#cfcfca";
  const line = dark ? "#5a5a62" : "#b9b9b3";
  const glass = dark ? "rgba(170, 205, 225, 0.13)" : "rgba(120, 170, 200, 0.14)";
  const glassEdge = dark ? "rgba(200, 230, 245, 0.55)" : "rgba(70, 120, 150, 0.5)";
  const [W, H] = COVER;
  const az = (40 * Math.PI) / 180;
  const el = (28 * Math.PI) / 180;
  const s = 6.2;
  const proj = ([x, y, z]) => [W / 2 + s * (x * Math.cos(az) - y * Math.sin(az)), H / 2 + 8 + s * ((x * Math.sin(az) + y * Math.cos(az)) * Math.sin(el) - z * Math.cos(el))];
  const depthOf = ([x, y, z]) => (x * Math.sin(az) + y * Math.cos(az)) * Math.cos(el) + z * Math.sin(el);
  // the tube: radius r, its axis through the origin in the y-z plane, tilted 35° from vertical
  const r = 7;
  const tilt = (35 * Math.PI) / 180;
  const axis = [0, Math.sin(tilt), Math.cos(tilt)];
  const gap = 2 * r - 1.6; // each pad pressed in 0.8 mm at the most
  const pts = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < 12; i++) {
      for (let j = 0; j < 32; j++) {
        // pad plane x = side * gap / 2; across (i) along y, along the finger (j) along z (fingertip at the bottom)
        const p = [(side * gap) / 2, (i - 5.5) * 2, (j - 15.5) * 2];
        const t = p[1] * axis[1] + p[2] * axis[2];
        const q = [p[0], p[1] - t * axis[1], p[2] - t * axis[2]];
        const d = r - Math.hypot(...q);
        pts.push({ p, v: Math.max(0, Math.min(1, d / 0.8)), side });
      }
    }
  }
  const col = (v) => `rgb(${VIRIDIS_RGB[Math.round(40 + v * 215)].join(",")})`;
  const plate = (side) => {
    const x = (side * gap) / 2 + side * 0.6;
    const c = [[x, -13, -33], [x, 13, -33], [x, 13, 33], [x, -13, 33]].map(proj);
    return `<path d="M${c.map((p) => p.map((n) => n.toFixed(1)).join(" ")).join("L")}Z" fill="none" stroke="${line}" stroke-width="1" stroke-dasharray="3 4"/>`;
  };
  const dot = ({ p, v }) => {
    const [x, y] = proj(p);
    return v > 0.02 ? `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(2.4 + 1.6 * v).toFixed(2)}" fill="${col(v)}"/>` : `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.5" fill="${faint}"/>`;
  };
  // the tube, between the two pads: a see-through glass capsule along its axis (the far pad's points show through it)
  const a = proj(axis.map((n) => n * -46));
  const z = proj(axis.map((n) => n * 46));
  const R = r * s;
  const L = Math.hypot(z[0] - a[0], z[1] - a[1]);
  const n = [-(z[1] - a[1]) / L, (z[0] - a[0]) / L];
  const P = (q, k) => `${(q[0] + n[0] * R * k).toFixed(1)} ${(q[1] + n[1] * R * k).toFixed(1)}`;
  const capsule = `M${P(a, 1)}L${P(z, 1)}A${R.toFixed(1)} ${R.toFixed(1)} 0 0 0 ${P(z, -1)}L${P(a, -1)}A${R.toFixed(1)} ${R.toFixed(1)} 0 0 0 ${P(a, 1)}Z`;
  const shine = `M${P(a, 0.55)}L${P(z, 0.55)}`;
  const tube = `<path d="${capsule}" fill="${glass}" stroke="${glassEdge}" stroke-width="1.6"/><path d="${shine}" stroke="${dark ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.75)"}" stroke-width="3.5" stroke-linecap="round" fill="none"/>`;
  const far = pts.filter((q) => q.side === -1).sort((m, n) => depthOf(m.p) - depthOf(n.p));
  const near = pts.filter((q) => q.side === 1).sort((m, n) => depthOf(m.p) - depthOf(n.p));
  // which pad is nearer the viewer: the one with the larger depth
  const [back, front] = depthOf([-1, 0, 0]) < depthOf([1, 0, 0]) ? [far, near] : [near, far];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${bg}"/>${plate(back[0].side)}${back.map(dot).join("")}${tube}${plate(front[0].side)}${front.map(dot).join("")}</svg>`;
}

async function nextShot(theme) {
  const svg = join(tmp, `next-${theme}.svg`);
  writeFileSync(svg, nextSvg(theme));
  const b = await launch({ width: COVER[0], height: COVER[1] });
  try {
    await b.goto(pathToFileURL(svg).href);
    await sleep(300);
    save(await capture(b, { x: 0, y: 0, width: COVER[0], height: COVER[1] }), join(coversOut, `${tagOf("next")}-${theme}.webp`), COVER[0], `${tagOf("next")}-${theme}`);
  } finally {
    b.close();
  }
}

for (const theme of ["light", "dark"]) {
  if (want("mount") || want("L07")) await figMount(theme);
  if (want("grasp") || want("L08")) await figGrasp(theme);
  await cardShots(theme);
  if (want("next")) await nextShot(theme);
}
rmSync(tmp, { recursive: true, force: true });
console.log("covers: done");
process.exit(0);
