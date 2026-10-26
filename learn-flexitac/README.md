# Learn FlexiTac

An interactive course on the FlexiTac tactile sensor and its reading board. It is a static single-page app
(Vite + vanilla TypeScript, no framework) built around the anatomy figures in `../flexitac-anatomy/figures` (Fig 1–3,
Fig 5 the gripper) and, for Section 3, small in-browser simulation cards on the shared touch engine
(`../flexitac-anatomy/shared/models/touchsim.mjs`). Three sections of three chapters each (`src/lessons/index.ts`
`SECTIONS`): 1 The sensor (1.1–1.6), 2 On a robot (2.1–2.2, then "Coming next"), 3 In simulation (3.1–3.6).

```
#/                     home: hero, then each section's title and its three chapter cards (cover pictures)
#/lessons              all lessons, grouped by section and chapter
#/lesson/<id>          a lesson: stage (figure / widget / media) + guided steps, tabs, "Try it yourself", lesson strip
#/glossary[/<term>]    glossary (a term id scrolls to and highlights it)
#/about                sources, badges, licences, reset progress
```

## Run it

```bash
export PATH=$HOME/miniforge3/envs/anatomy/bin:$PATH   # node 22
npm install
./start.sh             # easiest: sets PATH to the conda env, installs if needed, opens the browser
npm run dev            # runs sync-figures first, then Vite on http://localhost:5173
npm start              # same, and opens the browser
# Both print the address in a box ("Learn FlexiTac is running: http://localhost:5173/"). If 5173 is taken,
# Vite picks the next free port and the box shows that one.
npm run build          # sync-figures, tsc --noEmit, vite build -> dist/
npm run preview        # serve dist/
```

- **`npm run sync-figures`** copies `../flexitac-anatomy/figures/{pad,crossing,board,gripper}/{name}.html` and `{name}-light.html`
  into `public/figures/`. It runs automatically before `dev` and `build`. Rebuild a figure there (`node build.mjs`
  and `node build.mjs --light`) and sync again to pick it up. Set `FLEXITAC_FIGURES=/abs/path` if the folder moves.
- **`npm run thumbs`** re-makes `public/thumbs/*.webp` (~5–25 KB each) in headless Chrome + ffmpeg: the three
  figure cards (`<fig>-<theme>.webp`), one picture per figure lesson (`L01`–`L04-<theme>.webp`, each figure driven
  through its film contract into a pose that shows that lesson's idea), a heatmap rendered from the shared scan model
  for lesson 5 (`L05.webp`) and a footage frame for lesson 6 (`L06.webp`). The poses are listed in `scripts/thumbs.mjs`
  (`--only L03,L04` re-makes just those). The thumbnails are
  committed; re-run only when a figure changes a lot.
- **`node scripts/covers.mjs --port <p>`** (needs this site's own dev server on that port: `npx vite --port <p>
  --strictPort`; it serves `scripts/covers.html`) re-makes the Section 2 and 3 chapter covers,
  `public/media/covers/<name>-{light,dark}.webp` (880 × 605: mount, grasp, next, points, springs, loop) and the
  lesson thumbnails `L07`–`L14` from Fig 5 and the simulation cards (`--only mount,L07` for some of them).
- **`bash scripts/explore-review.sh [base] [outDir]`** (against `npx vite preview --port 4322`) is the end-to-end
  explore review used for the integration pass (one run: `scripts/explore-review.mjs <base> <outDir> <lessonId> <n>
  <w> <h> light|dark [link|-]`). Screenshots go to `review/explore/`, named
  `<width>-<theme>-L<nn>-<k>-<what>.png`): every lesson at 1440×900 in both themes and lessons 1, 4, 7 at 390×844, each
  checking figure ready, a clean start (no Labels switch, no callout cards or hotspot dots at rest), every guided
  step's act (no `ft:error`), wheel/pinch zoom, drag/one-finger pan, the fit button, three picks (a click on a
  focusable part button, or `ft:act pick`) answered by `ft:pick`, the detail window for each (`ft:details` posted from
  inside the iframe), a click on the drawing, Escape (figure and page focus), the theme toggle keeping the pick, pose
  and detail window, the "Taught in Lesson N" link, no horizontal scroll and a clean console.
- **`node --experimental-websocket scripts/clean-review.mjs <base> <outDir> <lessonId> <w> <h> light|dark`** checks
  the clean start and the detail window of one lesson: no Labels switch / stage inspector at rest (and reports any
  callout cards or dots the figure shows), a pick, then `ft:details` posted from inside the iframe; the window must
  open on the panel's own edges, top-aligned, no taller than the panel, with focus inside, while the figure's frame,
  its viewBox and the panel's cards stay put; another pick swaps it; Escape and × close it and return focus to the
  figure. Phones: a bottom sheet above the bottom bar. Screenshots `<lesson>-<w>x<h>-<theme>-<k>-<what>.png`.
- **`node scripts/unit-review.mjs --size <w>x<h> --theme light|dark [--phone] [--reduced] [--old-progress] [--base <url>]`**
  walks lesson 2 step 1 on a static build with real mouse / touch / key input: no layer inspector, Fig 1's ring on sense
  6 × drive 16 (`ft:focus`), the unit card right of the pad (clear of the pad and the mat, on the stage's right edge,
  centred on the ring or clamped) with one horizontal leader from the ring's right edge to the card's left edge (a phone:
  under the figure, no leader), three moments of the loop (the meter reads `rTaxel(press)` and drops, the ring glows with
  the same press), a hover / touch scrub and the keys, a zoom in the figure (the leader follows), a theme toggle, step 2
  (inspector back, ring and card gone) and the step-1 dot. `--old-progress` starts from progress saved with the 4-step
  lesson. Screenshots and `<tag>.json` in `review/lesson2-unit/`.
- **`node scripts/feel-review.mjs --size <w>x<h> --theme light|dark [--phone] [--reduced] [--base <url>]`** walks
  lesson 1 with real mouse / touch / key input on a static build: the "Feel it" first screen (feel mode, the figure's
  touch map exactly the size of the sensing area and level with it, left of the pad), the finger, presses at three
  crossings lining up with the map, a drag, Show me, a theme toggle, step 2's in-place expand and collapse, step 3's
  Velostat label and card (resistance at press 0 / 0.5 / 1 against `@shared/models/taxel.mjs`), Details ›, and the
  step-1 dot. Screenshots and `<tag>.json` in `review/feel/`.
- **`npm run check -- <url> <outDir> [w h light|dark steps|heat|pick|page]`** is a CDP smoke test (headless Chrome,
  no npm deps). Against `npm run preview -- --port 4317` it drives lesson 1's guided steps, Run, the theme toggle
  and the quiz, prints the figure bridge log and every console error, and saves screenshots. `pick` clicks the first
  part of an explore-mode figure (`ft:act pick`, or, for a figure without explore mode, posts `ft:parts`/`ft:pick`
  from inside the iframe), then posts `ft:details` from inside the iframe and checks the detail window and Escape. `REDUCED=1` emulates reduced motion; `FULL=1`
  captures the whole page.

### Shared numbers and models

`@shared` is a Vite alias (and a tsconfig path) for `../flexitac-anatomy/shared`, the single source of truth that
the figures and the video also use. Override it with `FLEXITAC_SHARED=/abs/path`. Import, never re-type:

```ts
import { ROWS, COLS, FRAME_BYTES, FRAME_HZ, R1 } from "@shared/data/constants.mjs";
import { byteIndex, frameBytes } from "@shared/models/scan.mjs";
import { createHost } from "@shared/models/host.mjs";
import { fact } from "../content/facts";          // spec rows straight from shared/data/sources.json
```

Avoid importing `@shared/data/index.mjs` from lesson files: it is ~110 KB of geometry. Widgets that need it are
code-split automatically.

## Deploy (Vercel)

`vercel.json` sets `npm run build` and `dist/`. The build reads two folders outside this one
(`../flexitac-anatomy/shared` and `../flexitac-anatomy/figures`), so pick one of:

1. **Prebuilt (simplest):** `npx vercel build --prod && npx vercel deploy --prebuilt --prod`. The build runs on your
   machine, where `../flexitac-anatomy` exists, and only the output is uploaded. (Or upload `dist/` to any static host.)
2. **Git deploy from the parent repo:** set the Vercel project's *Root Directory* to `learn-flexitac` and turn on
   *Include files outside the root directory in the Build Step*.

Vercel serves the figure HTML (up to 762 KB for `board.html`) gzip/brotli-compressed by default; on another static
host, turn compression on for `.html`. `base` is `./` and routing is by hash, so `dist/` also works from a sub-path such as `flexitac.github.io/learn/`
with no rewrites.

## How the figures are embedded

`src/figure/FigureHost.ts` puts a figure in an `<iframe>` and talks to it with the postMessage bridge from
`figures/EMBED.md` / `tools/film-kit.mjs`:

| direction | message |
|---|---|
| site → figure | `{type:'ft:act', name, arg}`, `{type:'ft:hello'}` (resend ready), `{type:'ft:get'}` (resend state), `{type:'ft:focus'}` |
| figure → site | `{type:'ft:ready', fig, actions, mode, size, state}`, `{type:'ft:state', fig, state}` (≤ 10/s), `{type:'ft:size', fig, width, height}`, `{type:'ft:error', fig, name, message}` |
| figure → site (explore) | `{type:'ft:parts', fig, parts:[{id,title,icon,short,lesson}]}` once after ready, `{type:'ft:pick', fig, part:{id,title,icon,short,intro,facts,lesson}\|null}` on every selection change, `{type:'ft:details', fig, part:{id,title,icon,short,intro,facts,lesson}}` when "Details ›" under the figure's label is pressed |
| site → figure (explore) | `ft:act` `pick` (id \| null), `view` ('in' \| 'out' \| 'reset'), Fig 1 only: `reveal` (true \| false) |
| site → figure (Fig 1 feel) | `ft:act` `feel` (true \| false), `press` ({sense, drive, amount} \| null: fractional 0-based line indices, amount 0..1; null releases) |
| figure → site (Fig 1 feel) | `{type:'ft:touch', fig:'pad', frame:{senses:12, drives:32, values:number[384], press, at:{sense,drive}\|null}}`: ≤ 30/s while the press changes, then one all-zero frame once a release has faded out. `values[s*32 + d]` (row-major by sense line), 0..1 |
| site → figure (Fig 1 focus) | `ft:act` `focus` ({sense, drive, room?} \| {room} \| null: a ring on one crossing, 0-based; `room` = `{f, min, max}` CSS px kept free right of the pad), `press` ({sense, drive, amount, focus: true}: the ring and the crossing glow, feel mode stays off) |
| figure → site (Fig 1 focus) | `{type:'ft:focus', fig:'pad', sense, drive, ring:{x,y,rx,ry}\|null, room:{x,y,w,h}}` in iframe px, whenever the ring or the free band beside the pad changes (the same type name site → figure asks for keyboard focus; the direction tells) |

- It loads `figures/<fig>.html` (dark) or `figures/<fig>-light.html` with `?embed=stage` on desktop (window at least
  1024 × 640): the card fills the fixed stage both ways at natural CSS px, the drawing takes the room the chrome
  leaves and widens its viewBox to it, and text grows only gently with the frame width (`figures/EMBED.md`, "Stage
  mode"). The stacked tablet and phone layouts use `?embed` ("fill": the card takes the stage width and reports its
  height with `ft:size`, so phones get the figure's own narrow layout). `?embed=fit` (the old desktop mode, which
  CSS-zoomed the whole 650 px card into the stage) still works in `FigureHost` (`mode: "fit"`) but is not used.
  The stage body carries `data-fig-mode` (`stage` / `fill`) for the CSS.
- Acts sent before `ft:ready` are queued. Every act is kept in a short history; a theme toggle or a layout change
  loads the other build and replays it, so the figure keeps its pose.
- No `ft:ready` within 6 s (an old figure build) → status `no-bridge`: the figure still works by hand, and a
  note says the guided steps can't move it.
- **Explore mode** (the figures' side is in `figures/EMBED.md`). The figures start clean: no hotspot dots, no
  callout cards, no "Labels" switch. Drag pans, the wheel zooms; on a desktop pointer the part under it floats up a
  few px with a soft outline; a click picks it and the figure shows ONE label for it (icon, title, one line and a
  small "Details ›" link), with a straight horizontal leader to the part's outermost point. Another click moves the
  label; a click on empty space or Escape removes it. Parts stay reachable with Tab (a focus ring on the part, Enter =
  click). None of this moves the figure's camera or resizes the drawing: only the view bar, plan view (Fig 1) and a
  window resize do. `FigureHost` keeps `parts` (from `ft:parts`) and `picked` (from `ft:pick`), with `onParts(fn)`,
  `onPick(fn(part, how))`, `onDetails(fn(part))`, `pick(id|null)`, `view('in'|'out'|'reset')` and `supports(name)`.
  `pick` is sticky: it is re-sent after every `ft:ready`, so a theme or layout switch keeps the selection. Acts go
  only to a figure that declared them in `ft:ready` (older builds stay silent).
- **Detail window** (`src/ui/details.ts`): "Details ›" under the figure's label posts `ft:details`, and the site opens
  a floating card over the right panel column, where the Overview is: the panel's own left and right edges,
  top-aligned with it, as tall as its content up to the panel's height (it scrolls inside). Icon + title with the
  lesson's colour on the rule under it, intro, facts with source chips and badges, "Taught in Lesson N →" when
  another lesson teaches the part, ×. It is absolute inside `.panel`, so it covers the panel without reflowing it, and
  the stage is never touched (the figure does not move). Focus moves into it; × or Escape closes it and returns focus
  to the figure. Picking another part while it is open swaps its content; clearing the pick (the label goes away)
  closes it. Stacked layouts (< 1024 px wide or < 640 px tall) show it as a bottom sheet (above the phone's bottom
  bar). A figure that does not send `ft:details` yet simply never opens it; if `ft:details` carries only the summary,
  the intro and facts come from the `ft:pick` record of the same part.
- **Reveal** (lesson 1, `lesson.figure.reveal: true`, Fig 1 only): the figure starts assembled on its mat with one
  small "Click to expand" hint (an arrow pointing at the pad) and nothing else. A click on the pad, the hint, Space,
  or a step's `explode` / `select` takes it apart in place (same camera); no label shows until a layer is clicked. The
  view bar's "Take apart" toggle, Space, Escape (with nothing labelled) or a `collapse` act puts it back together and
  brings the hint back. `FigureHost.reveal(true|false)` sends `{name:'reveal', arg:true}` after `ft:ready` (only to a
  figure that declared `reveal`; the page is also loaded with `&reveal`, so it starts behind its hint). The learner's
  click is not in the act history, so after a theme or layout reload the host compares the figure's first
  `ft:state.reveal.open` with what the learner left and puts it back with an `explode` / `collapse` act.
- **Feel** (lesson 1 step 1, Fig 1 only; the figure's side is `figures/EMBED.md`, Feel mode): `feel: true` shows the
  plan view of the assembled pad with a "Click to touch the sensor" hint; over the sensing area a fingertip follows
  the pointer and a press lights the touch spots under it. The figure itself draws the touch map ("What the sensor
  feels", 12 × 32 squares, viridis) left of the pad: exactly the size of the sensing area and level with it, and the
  plan view's fit holds the pad and the map together, so both shrink as one and the map stays on the left at every
  stage size (half-screen windows and phones included). The site draws no map of its own. Each change is also posted
  as `ft:touch` (a 12 × 32 frame); `FigureHost.onTouch(fn)` / `lastTouch` hand it on (null when the figure reloads).
  `ft:state.feel` reports `{on, press, at, lit, peak, area, pad, map, kicker, legend}` (boxes in iframe px).
  `press` acts from a guided step are sent with `act(name, arg, {once: true})`, so a theme reload does not replay
  them.
- **Focus** (lesson 2 step 1, Fig 1 only; the figure's side is `figures/EMBED.md`, "Fig 1 pad: focus"): the act
  `focus {sense: 5, drive: 15, room}` rings ONE crossing of the assembled pad (an ellipse on the top face, teal, a soft
  pulse) and, with `room`, fits the pad left of a band kept free for a card. The figure posts `ft:focus` (the ring's box
  and that band, in iframe px) on every change; `FigureHost.onFocus(fn)` / `lastFocus` hand it on (null when the figure
  reloads). The `unit` demo card sits in that band, vertically centred on the ring, and `src/ui/demo.ts` draws ONE
  horizontal leader over the iframe from the ring's right edge to the card, with a dot on the ring. While the card
  animates it sends `press {sense, drive, amount, focus: true}` (`act(…, {once: true})`), so the ring and the crossing glow
  in step; `focus: true` means a late press after the ring has gone is dropped instead of turning feel mode on.
- **Parts per figure** (ids are what `pick` uses; the
  full records live in `../flexitac-anatomy/figures/<fig>/parts.mjs`):
  - Fig 1 `pad` (12): `lam_t fpc_t elec_t beam velostat fpc_b elec_b slots lam_b fingers_t fingers_b stiff` (only the
    five-layer sensor on a cutting mat: no connectors, and the mat is not a part)
  - Fig 2 `crossing` (14): `press plunger sense velostat drive taxel hc595 hc4067 r1 a0 gnd adc current board`
  - Fig 3 `board` (14): `nano usb u2 u3 u4 u5 u6 r1 fpc2 fpc1 d2d3 d4d8 vias pcb`
- **Gestures inside a figure**: drag pans (after 4 px), wheel / pinch zooms toward the pointer (1×–4×; at 1× a wheel
  scroll down is left to the page), double-click / `0` / the view bar's fit button resets. A click picks; Escape or a
  click on empty background clears. Old gestures are grab handles on their own part only: Fig 1 drag-to-touch on the
  sensing area in top view, Fig 2 press-and-hold on the plunger, Fig 3 clocks with →, its buttons and `clock` acts.
- Figure keyboard shortcuts work only while the iframe has focus (the browser guarantees it). The site's only
  global shortcut is Ctrl/⌘ + Enter (Run), which never reaches a focused figure.

## Lesson page layout (desktop)

The right column gives the lesson text priority: the code card is capped at 40% of the column, the Run output floats
over the bottom of the code (× closes it) instead of pushing the cards, and the chevron at the end of the tab row
folds the code card to its header ("read the lesson"). Below 860 px of window height the "Edit the boxed numbers" hint
is dropped. Stacked layouts show everything in page flow.

## Add a lesson

1. Copy `src/lessons/01-meet-flexitac.ts` to `src/lessons/NN-slug.ts` and edit it (the `Lesson` type in
   `src/types.ts` documents every field).
2. Register it in order in `src/lessons/index.ts` (`LESSONS`) and in its chapter in `SECTIONS`. `n` must equal its
   position in `LESSONS` (it picks the colour and the thumbnail); the number learners see ("2.1") comes from the
   section (`lessonNo()`). The console warns when the two lists disagree.
3. Check: `npm run build` (type errors fail the build), then open `#/lesson/<id>`.

The `id` is the URL and the progress key: never change it once published.

### Lesson colours

Every lesson has a colour, `--ft-lesson-<n>` (and `-soft`), copied from `../flexitac-anatomy/figures/palette.css` into
`src/styles/tokens.css` for both themes (`npm run sync-figures` warns when they drift); 13 and 14 (3.5, 3.6) are the
site's own (no figure uses them). `lc(n)` from
`src/ui/lessoncolor.ts` returns the inline `--lc` style; `src/styles/explore.css` maps `--lc` onto `--accent` inside
`.lesson-view`, the strip and lesson cards, so links, focus rings, step dots, quiz marks and the primary buttons of a
lesson all take its colour. `--on-lc` is the text colour on a lesson-colour fill (number chips). Every accent is
≥ 4.5:1 as text in its theme.

### Writing rules

- **Audience:** undergraduate STEM and high-school students. Intuition first, formula second. One idea per paragraph.
- **Define every new term the first time** with `<dfn>` and add it to `src/content/glossary.ts`. Each `<dfn>` in a
  lesson becomes a popover (hover, keyboard focus or tap) with the glossary definition and a link to
  `#/glossary/<id>`; `src/ui/dfn.ts` matches the dfn text to a term's `term`, `id` or `aka` (plurals too), and falls
  back to the dfn's `title`. Give a term an `aka` when the lesson words it differently.
- **Counting rule (stated in lesson 1).** "Sense line N" and "drive line N" always count from 1, like the figures and
  widgets. A firmware (0-based) number is always written as `i`/`j` (or `row`/`col` in Python): "sense line 6
  (i = 5)", "drive line 17 (j = 16)", `byte index = 2 + i × 32 + j`. Bytes are "byte N of 386" (from 1) or
  "index" / `frame[k]` (from 0).
- Say **drive lines** (32, Bottom FPC, shift registers) and **sense lines** (12, Top FPC, multiplexer). The firmware
  says columns and rows; explain that once, in lesson 1 (done).
- **No hand-typed numbers.** Use the constants and `fact()` so a corrected source updates the whole site.
- **Badges:** anything worked out rather than stated is `inferred` (e.g. the cable pin map assumes a straight-through
  FFC); anything without data behind it is `illustrative` (every press → resistance curve; never newtons); anything
  from outside the FlexiTac materials is `external` (datasheets); a part drawn only for an example (Fig 5's finger
  holders and board trays) is `proposed`. Sections 2–3 show simulated forces in newtons, always `illustrative`.
- **Guided steps** (`steps`): 2–4 short steps. A step's `act` (one act or a list) is its pose: the figure plays it
  when the learner reaches the step ("Next step", its dot, or "Show me" on a step not reached yet); jumping to step k
  replays the poses of steps 1..k. An optional `show` list is that step's "Show me" once it is in its pose (a
  scripted press, the pad taken apart): each `{name, arg, at?: ms, once?: true}`, never replayed for a jump. The
  button reads "Show me" while there is something to show, then "Next step", then "Done". A first step marked
  `start: true` is the lesson's starting pose (`figure.initial` puts the figure there): the lesson always opens on
  it, already reached, whatever progress was saved (the dots still show what was done), and "start again" returns to
  it. Give the figure a `reset` list so "start again" and jumping between steps land in a known pose.
  Act names per figure are listed on `FigAct` in `src/types.ts` (exact arguments: each figure's `live.js`).
  The steps bar keeps the height of the lesson's longest step text (and the button the width of its widest label),
  so moving between steps never resizes the figure. A step may add `demo: "<id>"` (`DemoId`): a small card
  (`src/ui/demo.ts`, content `src/widgets/<id>-demo.ts`) that opens once the step's pose is up and closes when the
  step changes or the learner closes it. Each demo has a side and its placement rules in `src/ui/demo.ts` (`SPECS`):
  - `velostat` (lesson 1 step 3): RIGHT of the exploded pad, press → resistance (illustrative).
  - `unit` (lesson 2 step 1): one touch spot wired to an ohmmeter, RIGHT of the assembled pad in the band Fig 1 keeps
    free (`focus` act with `room`), level with the ring and joined to it by one horizontal leader; desktop and stacked
    alike (a narrow card puts its meter under the drawing). On a phone (no band) it sits in the stage card right under
    the figure, above the guided steps, with no leader. Loop: press 2.2 s, hold 0.6 s, release 1.4 s, rest 0.6 s; hover
    / drag on the drawing scrubs it, ← → when focused; reduced motion: scrub only. R from `@shared/models/taxel.mjs`.

  A step may also set `widget: false`: the lesson's widget hides while that step is on show and a split stage gives the
  figure the whole stage (lesson 2 step 1 hides the layer inspector; it comes back from step 2). A step inserted in front
  of steps learners may already have done is listed in the lesson's `stepsAdded` (0-based indices, in the order they were
  added): saved progress is moved onto the same steps once per learner (`migrateSteps` in `src/state/store.ts`, the
  revision kept in `stepsRev`).
- **Quiz:** 3 questions, one clearly right answer each, and a `why` that teaches, not just confirms.
- **Code** (`code`): ≤ ~46 characters per line so it fits the card. `{{name}}` placeholders become editable
  numbers; give each a `params` entry. `run(params, ctx)` is the sim: drive `ctx.figure` / `ctx.widget` and
  return the console lines.

A lesson counts as done when its quiz is fully right **or** all its guided steps have been shown. Progress, quiz
answers, edited code values, the chosen tab, the theme and the language live in `localStorage["learn-flexitac:v1"]`
(every access is wrapped; the site works without storage).

## Two languages (English, 简体中文)

The globe button above Theme switches the whole site between English (the default) and Simplified Chinese, without a
reload (`?lang=zh` / `?lang=en` in the address does the same). English is never changed: Chinese is laid over it from
`src/lessons/zh/<same file name>.ts`, `src/content/glossary.zh.ts`, `src/content/facts.zh.ts`,
`src/lessons/zh/_sections.ts` and the string tables in `src/i18n/`, and anything missing shows in English. The contract
(lessons, widgets, figures, CSS) is `docs/i18n.md`; the words follow `docs/i18n-terms-zh.md`;
`node scripts/i18n-check.mjs` lists what has no Chinese yet (`--scaffold <lesson file>` starts a lesson's Chinese file).

## Add a widget

Create `src/widgets/<id>.ts`; it is picked up automatically (`import.meta.glob`) and loaded only when a lesson with
`widget: "<id>"` opens.

```ts
import type { WidgetCtx, WidgetInstance } from "../types";
export function mount(el: HTMLElement, ctx: WidgetCtx): WidgetInstance {
  // draw into el; ctx.figure (FigureHost | null), ctx.theme(), ctx.onTheme(fn), ctx.reducedMotion(),
  // ctx.lang(), ctx.onLang(fn) (repaint your words on a switch, keep your state: docs/i18n.md)
  return {
    destroy() { /* cancel rAF, remove listeners */ },
    run(params) { /* called by Run with the code card's values; return console lines */ },
  };
}
```

A lesson with both `figure` and `widget` gets a split stage (figure above, widget below). On desktop ("stage") the
widget row takes 36 % of the stage body, kept between 260 and 380 px (what the widgets need), and the figure takes the
rest, at least min(300 px, 64 %); in short windows the widget gives way first and scrolls inside its row.
`figure.split` (the figure's share, 0.55 in lessons 2–3) sets that widget share (`--split-widget-share`). The figure's
own readout corner is legible in "stage" (11–13 px), so the duplicate readout row (`.figure-readout`, from
`ft:state.readout`) shows only under a scaled "fit" card. On a narrow desktop stage (under 780 px: 1024–1280 px
windows) the guided-steps bar puts its text on its own full-width row (a container query on `.stage`). In the stacked tablet/phone layout a widget that is alone on the stage (lessons 10–12) flows with
the page instead of scrolling inside a fixed box. `src/widgets/heatmap.ts`
(lesson 11) is the reference: it runs the shared scan and host models end to end.

## Files

```
index.html                 shell + pre-paint theme stamp
vite.config.ts             @shared alias, fs.allow, relative base
scripts/sync-figures.mjs   figures -> public/figures
scripts/thumbs.mjs         figure + lesson thumbnails -> public/thumbs/*.webp
scripts/check.mjs          CDP smoke test
scripts/explore-review.*   end-to-end explore review (all lessons, both themes, phones)
scripts/clean-review.mjs   clean start + detail window review (one lesson, one size)
scripts/feel-review.mjs    lesson 1 end to end: feel mode, take apart, Velostat (one size)
scripts/unit-review.mjs    lesson 2 step 1 end to end: focus ring, unit card + leader, loop, scrub, step 2 (one size)
scripts/i18n-check.mjs     what has no Chinese yet (lessons, glossary, pages, widgets, figures); --scaffold
docs/i18n.md               the two-language contract; docs/i18n-terms-zh.md the Chinese term sheet
src/main.ts                router
src/types.ts               Lesson / widget schema
src/figure/FigureHost.ts   iframe + postMessage bridge
src/lessons/               one file per lesson + index.ts
src/widgets/               one file per widget + index.ts (registry)
src/content/               facts.ts (sources.json -> spec rows), sources.ts (source chips), glossary.ts
src/state/                 store.ts (localStorage), theme.ts
src/i18n/                  lang.ts (language state), strings.ts + en/ zh/ (t(), tx(), strings()), localize.ts (loc())
src/lessons/zh/            each lesson's Chinese (same file name), _sections.ts
src/ui/                    shell, code card, highlighter, quiz, guided steps, lesson strip, icons, thumbs, dfn popovers,
                           details (part detail window), demo (step demo cards + the unit card's leader), ohms (fmtR),
                           lessoncolor (lc())
src/views/                 home, lesson, lessons, glossary, about
src/styles/                tokens (light + dark, lesson colours), base, shell, lesson, pages, explore (lesson colours,
                           part detail window), i18n (:lang(zh): CJK fonts, no upper case / letter spacing)
```
