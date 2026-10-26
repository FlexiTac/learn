// FigureHost: one anatomy figure in an <iframe>, driven over postMessage (figures/EMBED.md).
//   parent -> iframe  {type:'ft:act', name, arg}
//   parent -> iframe  {type:'ft:hello'} (asks for ft:ready again), {type:'ft:get'} (asks for ft:state), {type:'ft:focus'}
//   iframe -> parent  {type:'ft:ready', fig, actions, theme, mode, size, state}   once the figure can take acts
//                     {type:'ft:state', fig, state}     whenever its readout/model changes (<= 10/s)
//                     {type:'ft:size', fig, width, height}   natural card size ("fill" mode only)
//                     {type:'ft:error', fig, name, message}  an act threw
//                     {type:'ft:parts', fig, parts:[{id,title,icon,short,lesson}]}   once after ft:ready (explore mode)
//                     {type:'ft:pick', fig, part:{id,title,icon,short,intro,facts,lesson} | null}   on every selection change
//                     {type:'ft:details', fig, part:{id,title,icon,short,intro,facts,lesson}}   the learner pressed
//                                       "Details ›" under the figure's label for that part (explore mode)
//                     {type:'ft:touch', fig, frame:{senses, drives, values[senses*drives], press, at:{sense,drive}|null}}
//                                       Fig 1 FEEL mode (ft:act feel): what the pad feels, <= 30/s while it changes,
//                                       then one all-zero frame once a release has faded out (onTouch, lastTouch)
//                     {type:'ft:focus', fig, sense, drive, span?, ring:{x,y,rx,ry}|null, room:{x,y,w,h}|null}
//                                       Fig 1 focus ring (ft:act focus): where the ring on one crossing (or a block,
//                                       span) is and the free
//                                       band right of the pad, in iframe px, whenever either changes (onFocus, lastFocus).
//                                       (The same type name parent -> iframe asks for keyboard focus: the direction tells.)
//                     {type:'ft:band', fig, right, settled, room:{x,y,w,h}|null, bar}
//                                       Fig 1 reserve band (ft:act reserve, sent by reserve() below): the band the camera
//                                       keeps free right of the pad and the free room there, iframe px (onBand, lastBand).
//                                       Whether a card is in that band (or in the focus ring's room) now: ft:act bandcard,
//                                       sent by bandCard() below (the figure's labels keep out of the band only then).
// Explore mode (figures/EMBED.md, "Explore"): the figure starts clean (no dots, no labels). The part under the pointer
// floats a little; a click picks it and the figure shows ONE label for it, with a "Details ›" link under the text; that
// link posts ft:details and the site opens its detail window (src/ui/details.ts). The figure never moves for any of it.
// The host keeps two pieces of sticky UI state outside the act history, `picked` and `reveal`, and re-sends them after
// every ft:ready (so a theme or layout switch keeps the selection and the reveal mode). pick / view / reveal are sent
// only to a figure that declared them in ft:ready, so an older build stays silent instead of warning.
// Reveal mode (Fig 1, figures/EMBED.md "Fig 1 reveal mode"): {name:'reveal', arg:true|false}. The figure starts
// assembled behind a "Click to expand" hint; the learner's click expands it in place, which no act records, so the
// host remembers the figure's last reported expanded state and, after a reload, puts it back with an explode /
// collapse act once the replayed pose has been reported.
// Modes: "stage" (?embed=stage) lays the card out at the iframe's full width AND height at natural CSS px; the drawing
//                 takes the room the chrome leaves and widens its viewBox to that aspect (desktop/tablet stage,
//                 figures/EMBED.md "Stage mode"). No ft:size: the iframe size is ours.
//        "fill"  (?embed) lays the card out at the iframe's width and reports its height with ft:size (stacked layouts).
//        "fit"   (?embed=fit) scales the 650 px card into a fixed-size iframe (kept for compatibility, e.g. a hero tile).
// Acts sent before 'ft:ready' are queued and flushed in order. Every act is also kept in a short history so a
// theme switch (which loads the other build, {fig}.html <-> {fig}-light.html) can replay it and land in the same pose;
// a momentary act (act(name, arg, {once: true}), e.g. a guided step's scripted press) is sent but not kept.
// If a figure never says ready (an older build without the embed bridge), the figure still shows and stays fully
// usable by hand; acts stay queued and `status` becomes "no-bridge".
// Language (docs/i18n.md "Figures"): the page is loaded with &lang=zh while the site is in Chinese (nothing is added in
// English, so English URLs are unchanged). setLang() then switches a loaded figure: with {type:'ft:act', name:'lang',
// arg:'en'|'zh'} when the figure declared 'lang' in ft:ready (no reload, the pose stays; not kept in the act history,
// sticky like reveal); else, when its ft:ready reported a `lang` field (it reads the URL but cannot switch live), by
// reloading it like a theme switch (the history replays the pose); else (a build that knows no language yet) not at all
// until the next load. After a lang act the figure posts ft:parts again and, with a part picked, ft:pick in the new
// language, so an open detail window follows.

import { t } from "../i18n/strings";
import type { BandInfo, FigAct, FigId, FigPart, FocusInfo, Lang, Theme, TouchFrame } from "../types";

export type FigureStatus = "loading" | "ready" | "no-bridge";
export type FigureMode = "stage" | "fill" | "fit";
type StateFn = (state: Record<string, unknown>) => void;
type SizeFn = (size: { width: number; height: number }) => void;
type StatusFn = (status: FigureStatus) => void;
type PartsFn = (parts: FigPart[]) => void;
type PickFn = (part: FigPart | null, how: "user" | "host") => void;
type DetailsFn = (part: FigPart) => void;
type TouchFn = (frame: TouchFrame | null) => void;
type FocusFn = (focus: FocusInfo | null) => void;
type BandFn = (band: BandInfo | null) => void;
export type ViewCmd = "in" | "out" | "reset";
/** A band for Fig 1's reserve act: CSS px, or a share of the drawing's width, clamp(min, f × width, max). */
export type ReserveRoom = number | { f: number; min?: number; max?: number };

const READY_TIMEOUT_MS = 6000;
const HISTORY_MAX = 40;

const MODE_QUERY: Record<FigureMode, string> = { stage: "?embed=stage", fill: "?embed", fit: "?embed=fit" };

export function figureUrl(fig: FigId, theme: Theme, mode: FigureMode = "stage", lang: Lang = "en"): string {
  return `${import.meta.env.BASE_URL}figures/${fig}${theme === "light" ? "-light" : ""}.html${MODE_QUERY[mode]}${lang === "en" ? "" : `&lang=${lang}`}`;
}

export class FigureHost {
  readonly fig: FigId;
  readonly iframe: HTMLIFrameElement;
  status: FigureStatus = "loading";
  actions: string[] = [];
  lastState: Record<string, unknown> | null = null;
  size: { width: number; height: number } | null = null;
  /** Parts the figure announced (ft:parts); empty until then or for a figure without explore mode. */
  parts: FigPart[] = [];
  /** The picked part (full record from ft:pick), or null. */
  picked: FigPart | null = null;
  /** Fig 1 FEEL mode: the last ft:touch frame, or null (none yet, or the figure was reloaded). */
  lastTouch: TouchFrame | null = null;
  /** Fig 1 focus ring: the last ft:focus, or null (none yet, or the figure was reloaded). */
  lastFocus: FocusInfo | null = null;
  /** Fig 1 reserve band: the last ft:band, or null (none yet, or the figure was reloaded). */
  lastBand: BandInfo | null = null;

  private theme: Theme;
  private mode: FigureMode;
  private lang: Lang;
  /** The figure's last ft:ready reported a `lang` (it reads ?lang=). */
  private langAware = false;

  /** "stage" (the card fills the frame both ways, natural px), "fill" (the card takes the frame width and reports its
   *  height) or "fit" (the 650 px card is scaled into a fixed box). */
  get layout(): FigureMode {
    return this.mode;
  }
  /** The layout the page itself reported in ft:ready (null until then). A build older than stage mode answers "fill"
   *  to ?embed=stage, so this tells the host what it really got. */
  pageMode: string | null = null;
  private sizeFns = new Set<SizeFn>();
  private queue: FigAct[] = [];
  private history: FigAct[] = [];
  private stateFns = new Set<StateFn>();
  private statusFns = new Set<StatusFn>();
  private partsFns = new Set<PartsFn>();
  private pickFns = new Set<PickFn>();
  private detailsFns = new Set<DetailsFn>();
  private touchFns = new Set<TouchFn>();
  private focusFns = new Set<FocusFn>();
  private bandFns = new Set<BandFn>();
  /** The band reserve() asked Fig 1 to keep free on the right (CSS px, or a list whose first fitting entry wins), or
   *  null. Sticky like reveal. */
  private reserveRight: ReserveRoom[] | null = null;
  /** Whether a card is in Fig 1's band (bandCard()), or undefined before any call. Sticky like reveal. */
  private bandCardArg: { part: string | null } | false | undefined = undefined;
  /** Reveal mode (Fig 1) on or off. */
  private revealOn = false;
  /** The figure's last reported expanded state in reveal mode (ft:state.reveal.open), kept across reloads. */
  private revealOpen: boolean | undefined = undefined;
  /** After a reload: the expanded state to put back once the figure reports its replayed pose (undefined = none). */
  private restoreOpen: boolean | undefined = undefined;
  /** Id we asked for with pick(); a matching ft:pick is reported as "host", anything else as "user". */
  private wantPick: string | null | undefined = undefined;
  private timer = 0;
  private onMessage = (e: MessageEvent) => this.receive(e);

  constructor(container: HTMLElement, fig: FigId, theme: Theme, opts: { title?: string; mode?: FigureMode; reveal?: boolean; lang?: Lang } = {}) {
    this.fig = fig;
    this.theme = theme;
    this.mode = opts.mode ?? "stage";
    this.lang = opts.lang ?? "en";
    // reveal mode known up front: the page is loaded with &reveal, so it starts behind its hint (no idle tour) even
    // before our reveal act arrives
    this.revealOn = Boolean(opts.reveal);
    this.iframe = document.createElement("iframe");
    this.iframe.className = "figure-frame";
    // its accessible name: the site's "Fig N · …" in the site's language (src/i18n/en/ui.ts "fig.title.*")
    this.iframe.title = opts.title ?? t(`fig.title.${fig}`);
    this.iframe.setAttribute("loading", "eager");
    window.addEventListener("message", this.onMessage);
    // Safety net: if 'ft:ready' was posted before we listened (or got lost), ask again once the page has loaded.
    this.iframe.addEventListener("load", () => {
      if (this.status !== "ready") this.iframe.contentWindow?.postMessage({ type: "ft:hello" }, "*");
    });
    container.append(this.iframe);
    this.load();
  }

  /** Send an act now if the figure is ready, otherwise queue it. `once`: a momentary act (a press) that a theme or
   *  layout reload must not replay, so it is not kept in the history. */
  act(name: string, arg?: unknown, opts: { once?: boolean } = {}): void {
    const a: FigAct = arg === undefined ? { name } : { name, arg };
    if (!opts.once) this.remember(a);
    if (this.status === "ready") this.post(a);
    else this.queue.push(a);
  }

  acts(list: FigAct | FigAct[] | undefined): void {
    if (!list) return;
    for (const a of Array.isArray(list) ? list : [list]) this.act(a.name, a.arg);
  }

  /** True when the figure declared this action in 'ft:ready' (or when we don't know yet). */
  can(name: string): boolean {
    return this.status !== "ready" || this.actions.includes(name);
  }

  onState(fn: StateFn): () => void {
    this.stateFns.add(fn);
    if (this.lastState) fn(this.lastState);
    return () => this.stateFns.delete(fn);
  }

  /** Natural card size, reported in "fill" mode (and in ft:ready). */
  onSize(fn: SizeFn): () => void {
    this.sizeFns.add(fn);
    if (this.size) fn(this.size);
    return () => this.sizeFns.delete(fn);
  }

  onStatus(fn: StatusFn): () => void {
    this.statusFns.add(fn);
    fn(this.status);
    return () => this.statusFns.delete(fn);
  }

  /** Parts list, as soon as the figure announces it (explore-mode figures only). */
  onParts(fn: PartsFn): () => void {
    this.partsFns.add(fn);
    if (this.parts.length) fn(this.parts);
    return () => this.partsFns.delete(fn);
  }

  /** Selection changes: a click in the figure ("user") or the answer to pick() ("host"). The figure shows its own
   *  label for the picked part; the site only needs this to keep an open detail window in step. */
  onPick(fn: PickFn): () => void {
    this.pickFns.add(fn);
    return () => this.pickFns.delete(fn);
  }

  /** "Details ›" pressed under the figure's label (ft:details): the full part record, to show in the site's detail
   *  window. A figure that does not send ft:details simply never calls this. */
  onDetails(fn: DetailsFn): () => void {
    this.detailsFns.add(fn);
    return () => this.detailsFns.delete(fn);
  }

  /** Fig 1 FEEL mode: every ft:touch frame (what the pad feels), and null when the figure reloads (a theme or layout
   *  switch), so a map drawn from it clears. Called at once with the last frame, if any. */
  onTouch(fn: TouchFn): () => void {
    this.touchFns.add(fn);
    if (this.lastTouch) fn(this.lastTouch);
    return () => this.touchFns.delete(fn);
  }

  /** Fig 1's focus ring (ft:focus): where the ring is and the free band beside the pad, in iframe px, on every change;
   *  null when the figure reloads. Called at once with the last one, if any. */
  onFocus(fn: FocusFn): () => void {
    this.focusFns.add(fn);
    if (this.lastFocus) fn(this.lastFocus);
    return () => this.focusFns.delete(fn);
  }

  /** Fig 1's reserve band (ft:band) on every change; null when the figure reloads. Called at once with the last one. */
  onBand(fn: BandFn): () => void {
    this.bandFns.add(fn);
    if (this.lastBand) fn(this.lastBand);
    return () => this.bandFns.delete(fn);
  }

  /** Fig 1 (figures/EMBED.md "Fig 1 pad: reserve"): keep `right` CSS px free on the right of the drawing for a card
   *  beside it, in any pose (the camera eases there), or give it back (null). `right` may be a list (CSS px or
   *  {f, min?, max?} of the drawing's width): the figure keeps the first that fits its share (half the drawing).
   *  Sticky: not in the act history (a resize may send it again and again), re-sent after a theme or layout reload.
   *  Sent only to a figure that declared it. */
  reserve(right: ReserveRoom | ReserveRoom[] | null): void {
    const list = (Array.isArray(right) ? right : right === null ? [] : [right])
      .map((r) => (typeof r === "number" ? Math.round(r) : r))
      .filter((r) => (typeof r === "number" ? r > 0 : r.f > 0));
    const v = list.length ? list : null;
    if (JSON.stringify(v) === JSON.stringify(this.reserveRight)) return;
    this.reserveRight = v;
    if (this.supports("reserve")) this.post({ name: "reserve", arg: { right: this.reserveArg() } });
  }

  /** The band reserve() asked for (its first entry), or null. */
  get reserved(): ReserveRoom | null {
    return this.reserveRight ? this.reserveRight[0] : null;
  }

  private reserveArg(): ReserveRoom | ReserveRoom[] | null {
    const v = this.reserveRight;
    return v ? (v.length === 1 ? v[0] : v) : null;
  }

  /** Fig 1 (figures/EMBED.md "Fig 1 pad: focus", Out of the band): whether a card of ours is in the band the figure keeps
   *  (a reserve, or the focus ring's room). {part}: while nothing (or `part`, when not null) is picked; the card steps
   *  aside while another part is picked, and the figure's labels may use the band then, from their first frame.
   *  false: no card in it (the learner closed it). The camera keeps the band either way. Sticky like reserve(). */
  bandCard(arg: { part: string | null } | false): void {
    if (JSON.stringify(arg) === JSON.stringify(this.bandCardArg)) return;
    this.bandCardArg = arg;
    if (this.supports("bandcard")) this.post({ name: "bandcard", arg });
  }

  /** True only when the figure is ready and declared this action (unlike can(), which is optimistic). */
  supports(name: string): boolean {
    return this.status === "ready" && this.actions.includes(name);
  }

  /** Select a part (or none). Sticky: re-sent after a theme/layout reload. */
  pick(id: string | null): void {
    this.wantPick = id;
    if (id === null && this.picked) {
      // Close at once on our side; the figure's ft:pick null confirms it.
      this.picked = null;
      for (const fn of this.pickFns) fn(null, "host");
    }
    if (this.supports("pick")) this.post({ name: "pick", arg: id });
  }

  /** Reveal mode (Fig 1): the figure starts assembled behind a "Click to expand" hint and shows no labels; the
   *  learner's click (or an explode / select act) expands it in place. false turns it off. Sticky like pick().
   *  Sent only to a figure that declared 'reveal'. */
  reveal(on: boolean): void {
    this.revealOn = on;
    if (!on) this.revealOpen = undefined;
    if (this.supports("reveal")) this.post({ name: "reveal", arg: on });
  }

  /** Whether the reveal-mode figure is expanded (from its last ft:state), or undefined when not known / not in reveal. */
  get revealExpanded(): boolean | undefined {
    return this.revealOn ? this.revealOpen : undefined;
  }

  /** Zoom in / out / fit, the same as the figure's own viewbar. */
  view(cmd: ViewCmd): void {
    if (this.supports("view")) this.post({ name: "view", arg: cmd });
  }

  /** Load the other theme build and replay the act history into it. */
  setTheme(theme: Theme): void {
    if (theme === this.theme) return;
    this.theme = theme;
    this.reload();
  }

  /** Switch the figure's language (see the header): a live 'lang' act when the figure declared it, else a reload when it
   *  reads ?lang=, else nothing until its next load. */
  setLang(lang: Lang): void {
    if (lang === this.lang) return;
    this.lang = lang;
    if (this.supports("lang")) this.post({ name: "lang", arg: lang });
    else if (this.status === "ready" && this.langAware) this.reload();
  }

  get currentLang(): Lang {
    return this.lang;
  }

  /** The iframe's accessible title (the site's language changed). */
  setTitle(title: string): void {
    this.iframe.title = title;
  }

  /** Switch between the "stage", "fill" and "fit" layouts (reloads the figure and replays its history). */
  setMode(mode: FigureMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this.reload();
  }

  get currentMode(): FigureMode {
    return this.mode;
  }

  /** Forget the history (used when a lesson's guided steps restart). */
  clearHistory(): void {
    this.history = [];
  }

  /** Focus the figure so its own keyboard shortcuts work (without scrolling the page to it). */
  focus(): void {
    this.iframe.focus({ preventScroll: true });
    this.iframe.contentWindow?.postMessage({ type: "ft:focus" }, "*");
  }

  /** Ask the figure for a fresh ft:state. */
  refresh(): void {
    if (this.status === "ready") this.iframe.contentWindow?.postMessage({ type: "ft:get" }, "*");
  }

  destroy(): void {
    window.removeEventListener("message", this.onMessage);
    clearTimeout(this.timer);
    this.stateFns.clear();
    this.statusFns.clear();
    this.sizeFns.clear();
    this.partsFns.clear();
    this.pickFns.clear();
    this.detailsFns.clear();
    this.touchFns.clear();
    this.focusFns.clear();
    this.bandFns.clear();
    this.iframe.remove();
  }

  // ------------------------------------------------------------------ internals
  private reload(): void {
    // Fig 3's plug-in (connect true) is a 2.6 s animation with a camera ease: a reloaded figure lands plugged in at once
    this.queue = this.history.map((a) => (a.name === "connect" && a.arg === true ? { name: "connect", arg: "instant" } : a));
    this.size = null;
    this.pageMode = null;
    this.load();
  }

  private load(): void {
    this.setStatus("loading");
    this.lastState = null;
    // a reloaded figure starts untouched: clear anything drawn from its frames
    if (this.lastTouch) {
      this.lastTouch = null;
      for (const fn of this.touchFns) fn(null);
    }
    if (this.lastFocus) {
      this.lastFocus = null;
      for (const fn of this.focusFns) fn(null);
    }
    if (this.lastBand) {
      this.lastBand = null;
      for (const fn of this.bandFns) fn(null);
    }
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      if (this.status === "loading") this.setStatus("no-bridge");
    }, READY_TIMEOUT_MS);
    // &reveal: the page starts in reveal mode (Fig 1), so a reload never flashes the idle tour before our act lands
    this.iframe.src = figureUrl(this.fig, this.theme, this.mode, this.lang) + (this.revealOn ? "&reveal" : "");
  }

  private receive(e: MessageEvent): void {
    if (e.source !== this.iframe.contentWindow) return;
    const msg = e.data as {
      type?: string; fig?: string; actions?: unknown; state?: unknown; size?: unknown; mode?: unknown; lang?: unknown;
      width?: number; height?: number; name?: string; message?: string; parts?: unknown; part?: unknown;
    } | null;
    if (!msg || typeof msg !== "object" || typeof msg.type !== "string") return;
    if (msg.fig && msg.fig !== this.fig) return;
    if (msg.type === "ft:ready") {
      if (this.status === "ready") return; // a repeat answer to our ft:hello
      this.actions = Array.isArray(msg.actions) ? msg.actions.map(String) : [];
      this.pageMode = typeof msg.mode === "string" ? msg.mode : null;
      this.langAware = typeof msg.lang === "string";
      clearTimeout(this.timer);
      const sz = msg.size as { width?: number; height?: number } | null | undefined;
      if (sz && sz.width && sz.height) this.setSize(sz.width, sz.height);
      // the ready state predates our replay and reveal act (a reloaded reveal page starts collapsed): keep what the
      // learner left, to put back below
      const wasOpen = this.revealOpen;
      if (msg.state && typeof msg.state === "object") this.emitState(msg.state as Record<string, unknown>);
      this.revealOpen = wasOpen;
      this.setStatus("ready");
      const pending = this.queue;
      this.queue = [];
      for (const a of pending) this.post(a);
      // Sticky explore state survives reloads (theme / layout switch). Reveal goes after the replayed acts; a click on
      // the sensor is not in the act history, so the expanded state the learner left is compared with the replayed
      // pose on the next ft:state and put back with explode / collapse (emitState).
      if (this.revealOn && this.supports("reveal")) {
        this.post({ name: "reveal", arg: true });
        this.restoreOpen = wasOpen;
      }
      // (a reserve band too: the reloaded figure lands in it at once, its first screen; and whether a card is in it)
      if (this.reserveRight && this.supports("reserve")) this.post({ name: "reserve", arg: { right: this.reserveArg() } });
      if (this.bandCardArg !== undefined && this.supports("bandcard")) this.post({ name: "bandcard", arg: this.bandCardArg });
      const keep = this.wantPick !== undefined ? this.wantPick : (this.picked?.id ?? null);
      if (keep && this.supports("pick")) this.post({ name: "pick", arg: keep });
      // (a figure that came up in another language than the site's, e.g. one that missed ?lang=: switch it now)
      if (this.langAware && msg.lang !== this.lang && this.supports("lang")) this.post({ name: "lang", arg: this.lang });
    } else if (msg.type === "ft:parts" && Array.isArray(msg.parts)) {
      this.parts = msg.parts.filter(isPart);
      for (const fn of this.partsFns) fn(this.parts);
    } else if (msg.type === "ft:pick") {
      const part = isPart(msg.part) ? (msg.part as FigPart) : null;
      const how: "user" | "host" = this.wantPick !== undefined && (part?.id ?? null) === this.wantPick ? "host" : "user";
      this.wantPick = undefined;
      if ((part?.id ?? null) === (this.picked?.id ?? null) && part && this.picked && part.intro === this.picked.intro) return;
      if (!part && !this.picked) return;
      this.picked = part;
      for (const fn of this.pickFns) fn(part, how);
    } else if (msg.type === "ft:details" && isPart(msg.part)) {
      // a figure may send the summary only: fill in intro / facts from the full ft:pick record of the same part
      let part = msg.part as FigPart;
      if (!part.intro && this.picked?.id === part.id) part = { ...this.picked, ...part, intro: this.picked.intro, facts: part.facts ?? this.picked.facts };
      for (const fn of this.detailsFns) fn(part);
    } else if (msg.type === "ft:touch") {
      const frame = touchFrameOf((msg as { frame?: unknown }).frame);
      if (!frame) return;
      this.lastTouch = frame;
      for (const fn of this.touchFns) fn(frame);
    } else if (msg.type === "ft:focus") {
      const focus = focusInfoOf(msg);
      if (!focus) return;
      this.lastFocus = focus;
      for (const fn of this.focusFns) fn(focus);
    } else if (msg.type === "ft:band") {
      const band = bandInfoOf(msg);
      if (!band) return;
      this.lastBand = band;
      for (const fn of this.bandFns) fn(band);
    } else if (msg.type === "ft:size" && msg.width && msg.height) {
      this.setSize(msg.width, msg.height);
    } else if (msg.type === "ft:error") {
      console.warn(`FigureHost(${this.fig}): act "${msg.name}" failed: ${msg.message}`);
    } else if (msg.type === "ft:state" && msg.state && typeof msg.state === "object") {
      this.emitState(msg.state as Record<string, unknown>);
    }
  }

  private emitState(s: Record<string, unknown>): void {
    this.lastState = s;
    // A reloaded page reports reveal: null until our reveal act arrives, so only a known shape updates what we remember.
    const open = this.revealOn ? revealOpenOf(s) : undefined;
    if (open !== undefined) {
      this.revealOpen = open;
      if (this.restoreOpen !== undefined && this.status === "ready") {
        const want = this.restoreOpen;
        this.restoreOpen = undefined;
        if (want !== open) this.post({ name: want ? "explode" : "collapse" });
      }
    }
    for (const fn of this.stateFns) fn(s);
  }

  private setSize(width: number, height: number): void {
    this.size = { width, height };
    for (const fn of this.sizeFns) fn(this.size);
  }

  private post(a: FigAct): void {
    if (this.actions.length && !this.actions.includes(a.name)) {
      console.warn(`FigureHost(${this.fig}): figure has no action "${a.name}" (has ${this.actions.join(", ")})`);
      return;
    }
    // targetOrigin: the figures are served from this site, so pin it to our own origin.
    this.iframe.contentWindow?.postMessage({ type: "ft:act", name: a.name, arg: a.arg }, location.origin === "null" ? "*" : location.origin);
  }

  private remember(a: FigAct): void {
    this.history.push(a);
    if (this.history.length > HISTORY_MAX) this.history.splice(0, this.history.length - HISTORY_MAX);
  }

  private setStatus(s: FigureStatus): void {
    this.status = s;
    for (const fn of this.statusFns) fn(s);
  }
}

/** Fig 1's expanded state in reveal mode: ft:state.reveal.open (or reveal itself when a build reports a plain boolean). */
function revealOpenOf(s: Record<string, unknown>): boolean | undefined {
  const r = s.reveal as { open?: unknown } | boolean | null | undefined;
  if (typeof r === "boolean") return r;
  if (r && typeof r === "object" && typeof r.open === "boolean") return r.open;
  return undefined;
}

/** A well-formed ft:touch frame (values: senses × drives finite numbers), clamped to 0..1, or null. */
function touchFrameOf(f: unknown): TouchFrame | null {
  if (!f || typeof f !== "object") return null;
  const { senses, drives, values, press, at } = f as Partial<TouchFrame>;
  if (!Number.isInteger(senses) || !Number.isInteger(drives) || !Array.isArray(values)) return null;
  if (senses! <= 0 || drives! <= 0 || values.length !== senses! * drives!) return null;
  const v = values.map((x) => (typeof x === "number" && x > 0 ? Math.min(1, x) : 0));
  const okAt = at && typeof at === "object" && Number.isFinite(at.sense) && Number.isFinite(at.drive);
  return {
    senses: senses!,
    drives: drives!,
    values: v,
    press: typeof press === "number" && press > 0 ? Math.min(1, press) : 0,
    at: okAt ? { sense: at.sense, drive: at.drive } : null,
  };
}

/** A well-formed ft:focus message (finite numbers), or null. */
function focusInfoOf(m: unknown): FocusInfo | null {
  if (!m || typeof m !== "object") return null;
  const { sense, drive, span, ring, room, bar, text } = m as Partial<FocusInfo>;
  const fin = (...v: unknown[]) => v.every((x) => typeof x === "number" && Number.isFinite(x));
  const box = (o: FocusInfo["room"] | undefined) => (o && typeof o === "object" && fin(o.x, o.y, o.w, o.h) ? { x: o.x, y: o.y, w: o.w, h: o.h } : null);
  const r = ring && typeof ring === "object" && fin(ring.x, ring.y, ring.rx, ring.ry) ? { x: ring.x, y: ring.y, rx: ring.rx, ry: ring.ry } : null;
  const sp = Array.isArray(span) && span.length === 2 && fin(span[0], span[1]) ? { span: [span[0], span[1]] as [number, number] } : {};
  return { sense: fin(sense) ? sense! : null, drive: fin(drive) ? drive! : null, ...sp, ring: r, room: box(room), bar: box(bar), text: fin(text) ? text! : null };
}

/** A well-formed ft:band message (finite numbers), or null. */
function bandInfoOf(m: unknown): BandInfo | null {
  if (!m || typeof m !== "object") return null;
  const { right, settled, room, bar, text, label, anchor } = m as Partial<BandInfo>;
  const fin = (...v: unknown[]) => v.every((x) => typeof x === "number" && Number.isFinite(x));
  const box = (o: BandInfo["room"] | undefined) => (o && typeof o === "object" && fin(o.x, o.y, o.w, o.h) ? { x: o.x, y: o.y, w: o.w, h: o.h } : null);
  const at = anchor && typeof anchor === "object" && typeof anchor.id === "string" && fin(anchor.x, anchor.y) ? { id: anchor.id, x: anchor.x, y: anchor.y } : null;
  return { right: fin(right) && right! > 0 ? right! : 0, settled: settled !== false, room: box(room), bar: box(bar), text: fin(text) ? text! : null, label: typeof label === "string" ? label : null, anchor: at };
}

function isPart(p: unknown): p is FigPart {
  return Boolean(p && typeof p === "object" && typeof (p as FigPart).id === "string" && typeof (p as FigPart).title === "string");
}
