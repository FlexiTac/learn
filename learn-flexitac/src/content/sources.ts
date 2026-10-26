// Turns a `src` string from shared/data/sources.json (or a lesson spec) into short, readable source chips.
// "material/2604.28156v1.pdf Fig 3a; user-confirmed 2026-10-21" -> [paper · Fig 3a] [confirmed 2026-10-21]
// The chip names are UI strings (src/i18n/en/ui.ts "chip.*"), so they follow the site's language.
import { lang } from "../i18n/lang";
import { t, type StrKey } from "../i18n/strings";

export interface Chip {
  label: string;
  /** Full source text, for the tooltip. */
  title: string;
  href?: string;
}

const PAPER = "https://arxiv.org/abs/2604.28156";
const HW_REPO = "https://github.com/FlexiTac/FlexiTac_Hardware_Repo";
const PYFLEXITAC = "https://github.com/WT-MM/PyFlexiTac";
const SITE = "https://flexitac.github.io/";
const VT_REFINE = "https://binghao-huang.github.io/vt_refine/";
const REBOT = "https://github.com/Seeed-Projects/reBot-DevArm";
const UMI = "https://umi-gripper.github.io/";

const RULES: [RegExp, StrKey, string?][] = [
  [/2604\.28156/, "chip.paper", PAPER],
  [/Hardware Guide\.docx/i, "chip.hardwareGuide"],
  [/Gerber_Top_FPC/, "chip.topGerber"],
  [/Gerber_Bottom_FPC/, "chip.bottomGerber"],
  [/Gerber_16_32/, "chip.boardGerber"],
  [/PickAndPlace|BOM_05mm/, "chip.boardBom"],
  [/tactile_reading_board_32x16\.pdf/, "chip.schematic"],
  [/pyflexitac|PyFlexiTac/, "chip.pyflexitac", PYFLEXITAC],
  [/32_16_fast\.ino|fast_32_16\.py|FlexiTac_Hardware_Repo/, "chip.hwRepo", HW_REPO],
  [/flexitac\.github\.io/, "chip.site", SITE],
  [/^user-confirmed/, "chip.confirmed"],
  [/FlexiTac team's build/i, "chip.teamBuild"],
  [/VT-Refine/i, "chip.vtRefine", VT_REFINE],
  [/reBot/i, "chip.rebot", REBOT],
  [/UMI/, "chip.umi", UMI],
  [/touchsim|in-browser model/i, "chip.model"],
  [/^computed/, "chip.computed"],
  [/datasheet|external/i, "chip.datasheet"],
];

/** Extra detail worth keeping after the file name: a figure, step, section or quoted phrase. In Chinese its words
 *  follow (Fig 3a -> 图 3a, Sec 3.2 -> 第 3.2 节, Step 3 -> 第 3 步, BOM item 5 -> BOM 第 5 项); dates and image names stay. */
function detail(part: string): string {
  const m = part.match(/\b(Fig\s*\w+|Sec\s*[\d.]+|Steps?\s*[\d-]+|image\d+\(?\w?\)?|BOM item \d+|\d{4}-\d{2}-\d{2})/);
  if (!m) return "";
  if (lang() !== "zh") return m[1];
  return m[1]
    .replace(/^Fig\s*(\w+)$/, "图 $1")
    .replace(/^Sec\s*([\d.]+)$/, "第 $1 节")
    .replace(/^Steps?\s*([\d-]+)$/, "第 $1 步")
    .replace(/^BOM item (\d+)$/, "BOM 第 $1 项");
}

/** Chinese for the sources that have no chip name of their own (their text is the chip in English); the tooltip keeps
 *  the source as written. Anything not here shows as in English. */
const RAW_ZH: [RegExp, string][] = [
  [/^BOM MPN (\S+)$/, "BOM 型号 $1"],
  [/^BOM item (\d+)$/, "BOM 第 $1 项"],
  [/^Gerber copper side$/, "Gerber 铜层"],
  [/^Gerber copper trace$/, "Gerber 走线"],
  [/^guide (image\d+\(?\w?\)?)$/, "指南 $1"],
  [/^Arduino Nano \(typical board$/, "Arduino Nano 常见规格"],
  [/^not in the reading-board files\)?$/, "不在读取板文件中"],
  [/^not stated in the board files$/, "读取板文件中未写明"],
  [/^FlexiTac Isaac Sim simulation \((\w+)\)$/, "FlexiTac Isaac Sim 仿真（$1）"],
  [/^Fig (\d+) display choice \(size not given in the materials\)$/, "图 $1 的显示取值（资料中未给出尺寸）"],
];
function rawZh(part: string): string | undefined {
  const bare = part.replace(/\s*\[[\w.]+\]$/, ""); // (a trailing [fact.key] is for the tooltip)
  for (const [re, zh] of RAW_ZH) if (re.test(bare)) return bare.replace(re, zh);
  return undefined;
}

export function chips(src: string): Chip[] {
  const out: Chip[] = [];
  const seen = new Set<string>();
  for (const raw of src.split(/;\s*|\s\+\s/)) {
    const part = raw.trim();
    if (!part) continue;
    let label = "";
    let href: string | undefined;
    if (/^https?:\/\//.test(part)) {
      const u = new URL(part.split(/\s/)[0]);
      label = u.hostname.replace(/^www\./, "");
      href = u.href;
    } else {
      for (const [re, name, link] of RULES) {
        if (re.test(part)) {
          label = t(name);
          href = link;
          break;
        }
      }
      // (Chinese: a source with no chip name of its own may still have Chinese words, RAW_ZH)
      const zh = !label && lang() === "zh" ? rawZh(part) : undefined;
      if (zh) label = zh;
      else {
        if (!label) label = part.length > 28 ? part.slice(0, 26) + "…" : part;
        const d = detail(part);
        if (d && label !== part) label += ` · ${d}`;
      }
    }
    if (seen.has(label)) continue;
    seen.add(label);
    out.push({ label, title: part, href });
  }
  return out;
}

export const LINKS = { PAPER, HW_REPO, PYFLEXITAC, SITE, VT_REFINE, REBOT, UMI };
