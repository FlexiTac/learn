// ILLUSTRATIVE press -> taxel resistance curve.
//
// There is NO force/characterization data for FlexiTac (user-confirmed). This
// curve only shows the qualitative Velostat behaviour: squeezing lowers the
// resistance, fast at first, then levelling off. `press` is a unitless 0..1
// "how hard" knob - never convert it to newtons. Every UI that shows it must
// carry the ILLUSTRATIVE label.
//
// Anchors (both still illustrative):
//  * R_REST = 200 kOhm: chosen so an unpressed taxel reads byte ~12 through the
//    10 kOhm divider, inside PyFlexiTac's "typical resting ADC values land
//    around 10-40" (refs/fw/pyflexitac/sensor.py docstring).
//  * R_HARD = 1.4 kOhm: bulk limit of one 0.6 x 0.6 mm crossing through
//    0.1 mm Velostat at the datasheet's < 500 ohm*cm (500*0.01/0.0036 = 1389 ohm).
//
// Shape: log R falls along an ease-out:  R(p) = R_REST * (R_HARD/R_REST)^(1-(1-p)^2)
// strictly decreasing on [0,1], R(0) = R_REST, R(1) = R_HARD.

export const ILLUSTRATIVE = true;
export const LABEL = 'illustrative curve - no force data exists; press is unitless (0 = untouched, 1 = hard press)';
export const R_REST = 200e3;
export const R_HARD = 1.4e3;
export const SOURCES = {
  R_REST: 'illustrative; anchored to PyFlexiTac resting bytes 10-40',
  R_HARD: 'illustrative; Velostat < 500 ohm*cm x 0.1 mm over a 0.6 x 0.6 mm crossing',
};

const clamp01 = (p) => Math.min(1, Math.max(0, p));
const ease = (p) => 1 - (1 - p) * (1 - p);

/** Taxel resistance (ohm) for a unitless press 0..1. ILLUSTRATIVE. */
export function rTaxel(press, { rRest = R_REST, rHard = R_HARD } = {}) {
  const s = ease(clamp01(press));
  return rRest * Math.pow(rHard / rRest, s);
}

/** Inverse of rTaxel (clamped to 0..1). ILLUSTRATIVE. */
export function pressFromR(r, { rRest = R_REST, rHard = R_HARD } = {}) {
  if (r >= rRest) return 0;
  if (r <= rHard) return 1;
  const s = Math.log(r / rRest) / Math.log(rHard / rRest);
  return 1 - Math.sqrt(1 - s);
}

/** Log-spaced resistance stops for a "step the taxel resistance" control (ohm). */
export const R_STOPS = [200e3, 100e3, 48e3, 20e3, 10e3, 5e3, 2e3];

/** Display helper: Velostat squash fraction for drawings (0 = rest, 0.35 = hard). Illustrative. */
export function squash(press) {
  return 0.35 * ease(clamp01(press));
}
