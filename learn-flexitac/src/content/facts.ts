// Spec rows straight from shared/data/sources.json, so the site never re-types a number.
//   fact("sensor.taxels", "Taxels")                       -> {label, value: "384 taxels", src, badge?}
//   fact("pad.activeArea", "Active area", { value: (v) => `${v[0]} × ${v[1]} mm` })
import sources from "@shared/data/sources.json";
import type { Badge, Spec } from "../types";
import { FORMAT_ZH, UNITS_ZH } from "./facts.zh";

export interface Fact {
  value: unknown;
  unit: string | null;
  src: string;
  inferred: boolean;
  note?: string;
}

const FACTS = (sources as { facts: Record<string, Fact> }).facts;

export function getFact(key: string): Fact {
  const f = FACTS[key];
  if (!f) throw new Error(`facts: no fact "${key}" in shared/data/sources.json`);
  return f;
}

const UNIT: Record<string, string> = { ohm: "Ω", "ohm*cm": "Ω·cm", "ohm/sq*cm": "Ω/sq", USD: "USD" };

/** The fact's value as shown in a Specs row. `lang` "zh" writes its counted nouns in Chinese (UNITS_ZH in
 *  ./facts.zh.ts); numbers and real units stay as they are. */
export function formatValue(f: Fact, lang: "en" | "zh" = "en"): string {
  const unit = f.unit ? (lang === "zh" ? UNITS_ZH[f.unit] : undefined) ?? UNIT[f.unit] ?? f.unit : "";
  const v = f.value;
  if (Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === "number")) {
    return f.unit === "channel range" ? `${v[0]}–${v[1]}` : `${v[0]} × ${v[1]}${unit ? " " + unit : ""}`;
  }
  if (typeof v === "number") {
    if (f.unit === "USD") return `$${v}`;
    if (f.unit === "ohm" && v >= 1000) return `${v / 1000} kΩ`;
    if (f.unit === "baud") return `${v.toLocaleString("en-US")} baud`;
    return `${v}${unit ? " " + unit : ""}`;
  }
  if (typeof v === "string") return `${v}${unit && unit !== "hex" ? " " + unit : ""}`;
  return String(v ?? (lang === "zh" ? FORMAT_ZH.missing : "not given in the materials"));
}

export function fact(
  key: string,
  label: string,
  opts: { value?: (v: any, f: Fact) => string; badge?: Badge; note?: string } = {},
): Spec {
  const f = getFact(key);
  const badge: Badge | undefined = opts.badge ?? (f.inferred ? "inferred" : /external/i.test(f.src) ? "external" : undefined);
  return {
    label,
    value: opts.value ? opts.value(f.value, f) : formatValue(f),
    src: f.src,
    badge,
    note: opts.note ?? f.note,
    // for the Chinese site (src/i18n/localize.ts): which fact this is, and which of its words are the fact's own
    fact: { key, value: !opts.value, note: opts.note === undefined },
  };
}

/** The raw value, for prose and code (e.g. `${num("sensor.taxels")} taxels`). */
export function num(key: string): number {
  const v = getFact(key).value;
  if (typeof v !== "number") throw new Error(`facts: "${key}" is not a number`);
  return v;
}
