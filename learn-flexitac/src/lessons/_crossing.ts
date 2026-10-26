// Shared bits for lessons 4-6 ("The crossing") and their widgets (divider-calc, adc-ladder).
// Not a lesson: it is not registered in index.ts. Every number comes from @shared/models.
import { R_HARD, R_REST, rTaxel } from "@shared/models/taxel.mjs";

/** Same rounding as Fig 2's readout: "200 kΩ", "4.8 kΩ". */
export function kOhm(r: number): string {
  if (!Number.isFinite(r)) return "∞ Ω";
  if (r < 1000) return `${Math.round(r)} Ω`;
  return r >= 9950 ? `${Math.round(r / 1e3)} kΩ` : `${(r / 1e3).toFixed(1)} kΩ`;
}

export const volts = (v: number, d = 2): string => `${v.toFixed(d)} V`;
export const milliamps = (i: number): string => `${(i * 1e3).toFixed(i * 1e3 < 0.1 ? 3 : 2)} mA`;

/** Groups binary digits in fours from the right, like people write them: 10 1011 0010. */
export function bits(n: number, width: number): string {
  const s = n.toString(2).padStart(width, "0");
  return s.replace(/\B(?=(\d{4})+(?!\d))/g, " ");
}

/**
 * Inline SVG of the ILLUSTRATIVE press -> resistance curve (log y axis), straight from shared/models/taxel.mjs.
 * Uses only theme tokens, so it follows light and dark. Native <title> tooltips on the marked points.
 */
export function curveSvg(): string {
  const W = 340;
  const H = 168;
  const L = 46; // plot box
  const R = 12;
  const T = 10;
  const B = 34;
  const pw = W - L - R;
  const ph = H - T - B;
  const lo = Math.log10(1000);
  const hi = Math.log10(500000); // headroom above the untouched end
  const x = (p: number) => L + p * pw;
  const y = (r: number) => T + ((hi - Math.log10(r)) / (hi - lo)) * ph;
  const pts: string[] = [];
  for (let k = 0; k <= 60; k++) {
    const p = k / 60;
    pts.push(`${x(p).toFixed(1)},${y(rTaxel(p)).toFixed(1)}`);
  }
  const ticks = [1e3, 1e4, 1e5]
    .map(
      (r) => `<line x1="${L}" x2="${W - R}" y1="${y(r)}" y2="${y(r)}" style="stroke:var(--line)" stroke-width="1"/>
      <text x="${L - 6}" y="${y(r) + 3.5}" text-anchor="end">${kOhm(r)}</text>`,
    )
    .join("");
  const marks = [0, 0.5, 1]
    .map((p) => {
      const r = rTaxel(p);
      return `<circle cx="${x(p)}" cy="${y(r)}" r="4.5" style="fill:var(--accent);stroke:var(--card)" stroke-width="2"><title>press ${p} → ${kOhm(r)} (illustrative)</title></circle>`;
    })
    .join("");
  return `<figure class="cr-curve" style="margin:14px 0 6px">
<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:420px;display:block;font:11px var(--mono);fill:var(--muted)" role="img"
 aria-label="Illustrative curve: taxel resistance falls from ${kOhm(R_REST)} untouched to about ${kOhm(R_HARD)} at a hard press, fast at first, then levelling off.">
${ticks}
<line x1="${L}" x2="${L}" y1="${T}" y2="${T + ph}" style="stroke:var(--line-strong)"/>
<line x1="${L}" x2="${W - R}" y1="${T + ph}" y2="${T + ph}" style="stroke:var(--line-strong)"/>
<polyline points="${pts.join(" ")}" fill="none" style="stroke:var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
${marks}
<text x="${x(0) + 9}" y="${y(R_REST) + 4}" style="fill:var(--ink)">${kOhm(R_REST)} untouched</text>
<text x="${x(1) - 2}" y="${y(R_HARD) - 22}" text-anchor="end" style="fill:var(--ink)">≈ ${kOhm(R_HARD)} hard</text>
<text x="${L}" y="${H - 16}">0</text><text x="${W - R}" y="${H - 16}" text-anchor="end">1</text>
<text x="${L + pw / 2}" y="${H - 4}" text-anchor="middle">how hard (no units, not newtons)</text>
</svg>
<figcaption class="aside" style="margin-top:4px">Taxel resistance against how hard you press, log scale.
<span class="badge badge-illustrative" title="Shape only: there is no measured data behind it">illustrative</span></figcaption>
</figure>`;
}
