// Resistance for display: 2-3 significant digits ("200 kΩ", "48 kΩ", "4.8 kΩ", "1.4 kΩ", "1.0 MΩ"). Used by the demo
// cards that read the illustrative press -> resistance curve (@shared/models/taxel.mjs).
export function fmtR(r: number): string {
  const k = r / 1000;
  if (k >= 1000) return `${(k / 1000).toFixed(1)} MΩ`;
  if (k >= 10) return `${Math.round(k)} kΩ`;
  return `${k.toFixed(1)} kΩ`;
}
