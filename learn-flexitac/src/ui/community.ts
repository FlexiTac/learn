// The FlexiTac repository and Discord server, linked from the header (src/ui/shell.ts) as on flexitac.github.io.
// The GitHub card shows the repository's star and fork counts. The page ships recent counts, so the card reads well
// offline and when GitHub's unauthenticated API says no (it allows 60 requests an hour per address, which a school's
// shared address can use up). Fresh counts are kept for an hour in sessionStorage, under the FlexiTac site's own key:
// the two sites share an origin (flexitac.github.io and its /learn/), so they share a tab's storage, and a tab that
// comes from the main site brings its counts along (and one that goes there takes ours). A refusal makes the tab wait
// that hour too, and a failed request ten minutes, so neither asks again (and logs a failed request) on every page
// load. Every storage access is wrapped, as in src/state/store.ts: without storage the counts are just fetched again
// on the next page load.

export const REPO_URL = "https://github.com/FlexiTac/FlexiTac";
export const DISCORD_URL = "https://discord.gg/6gw887Vxms";

const API = "https://api.github.com/repos/FlexiTac/FlexiTac";
/** flexitac.github.io's cache of the counts (its index.html: {stars, forks, at}, kept for an hour), read and written
 *  here in the same shape; only GitHub's own answers go in it, never the counts shipped with this page */
const SHARED = "gh-stats:FlexiTac/FlexiTac";
/** this site's own note: the time (ms) before which this tab does not ask again, after a refusal or a failure */
const WAIT = "learn-flexitac:gh-wait";
const TTL = 60 * 60 * 1000;
const RETRY = 10 * 60 * 1000;

export interface RepoStats {
  stars: number;
  forks: number;
}

/** The counts on show: the shipped ones (2026-11-02) until a fresher pair arrives. */
let stats: RepoStats = { stars: 159, forks: 17 };
export const repoStats = (): RepoStats => stats;

/** 159 -> "159", 1234 -> "1.2k", 12345 -> "12k", 1234567 -> "1.2m" (GitHub's own short forms; a count that would
 *  round to "1000k" is "1m"). */
export function fmtCount(n: number): string {
  if (n < 1000) return String(n);
  const [v, unit] = n < 999_500 ? [n / 1000, "k"] : [n / 1_000_000, "m"];
  return `${v.toFixed(v >= 10 ? 0 : 1).replace(/\.0$/, "")}${unit}`;
}

const valid = (s: unknown): s is RepoStats & { at: number } => {
  const v = s as Partial<RepoStats & { at: number }> | null;
  return Boolean(v) && typeof v!.stars === "number" && typeof v!.forks === "number" && typeof v!.at === "number";
};

/** A stored value, or null when it is missing, unreadable or storage is blocked. */
const read = (key: string): unknown => {
  try {
    return JSON.parse(sessionStorage.getItem(key) ?? "null");
  } catch {
    return null;
  }
};
const write = (key: string, value: unknown) => {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage blocked: the next page load asks again */
  }
};

/** Fresh counts: the tab's cached pair, then GitHub's when that pair is an hour old or missing (and the tab is not
 *  waiting out a refusal or a failure); `paint` runs only when the counts on show change. An older cached pair still
 *  beats the shipped one while GitHub is asked again. A failed or refused request keeps the counts already on show. */
export function refreshRepoStats(paint: (s: RepoStats) => void): void {
  const take = (s: RepoStats) => {
    if (s.stars === stats.stars && s.forks === stats.forks) return;
    stats = { stars: s.stars, forks: s.forks };
    paint(stats);
  };
  const now = Date.now();
  const cached = read(SHARED);
  if (valid(cached)) {
    take(cached);
    if (now - cached.at < TTL) return;
  }
  const wait = read(WAIT);
  if (typeof wait === "number" && wait > now) return;
  if (typeof fetch !== "function") return;
  const waitFor = (ms: number) => write(WAIT, Date.now() + ms);
  // (a request cut off because the page is reloading or leaving fails too, after the page is hidden: no failure)
  let leaving = false;
  addEventListener("pagehide", () => (leaving = true), { once: true });
  fetch(API, { headers: { Accept: "application/vnd.github+json" } })
    .then(async (r) => {
      const d = (r.ok ? await r.json() : null) as { stargazers_count?: unknown; forks_count?: unknown } | null;
      if (d && typeof d.stargazers_count === "number" && typeof d.forks_count === "number") {
        take({ stars: d.stargazers_count, forks: d.forks_count });
        write(SHARED, { stars: d.stargazers_count, forks: d.forks_count, at: Date.now() });
      } else {
        waitFor(TTL); // (a refusal, the rate limit: the next hour's loads do not ask)
      }
    })
    .catch(() => {
      if (!leaving) waitFor(RETRY); // (offline, blocked, or an answer that is not JSON: ask again in ten minutes)
    });
}
