"""The brand's lettering ("LEARN FLEXITAC" over "TOUCH · SCAN · SENSE" / "触摸 · 扫描 · 感知") as outlines, written to
src/ui/brand-mark.ts. Drawn as text, the letters' edges fell where each browser's font, hinting and screen scale put
them, so the header's boxes could only be fitted to them by measuring, and on some screens that was a pixel or two out;
as outlines, the letters' cap tops and their feet are the drawings' top and bottom edges, the same lines the boxes are
drawn to, everywhere.
  python3 scripts/brand-mark.py        (needs fontTools: pip install fonttools)
The faces the site's mono stack picked on Linux, which the brand was designed in: DejaVu Sans Mono (the name Bold, the
tagline Book) and Noto Sans CJK SC (the Chinese tagline); override their paths with BRAND_FONT_BOLD, BRAND_FONT_BOOK,
BRAND_FONT_CJK. The spacing is the text's: the name's letters 0.22 em apart (0.16 on phones, 0.1 on the narrowest),
the English tagline's 0.32 (0.22 on phones) with 0.1 after each dot, the Chinese tagline's none, with 0.25 em of space
either side of each dot.
Coordinates are in thousandths of an em, x from the line's start, y down from the baseline. Each drawing spans the line's
width (its last letter's spacing included, as the text's box did) and, in height, from the cap tops (the Chinese
characters' tops) to the baseline (the Chinese characters' feet); a round letter's overshoot (C, O, S: 0.014 em) reaches
past it."""
import os
import sys
from pathlib import Path

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTCollection, TTFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "src/ui/brand-mark.ts"
BOLD = os.environ.get("BRAND_FONT_BOLD", "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf")
BOOK = os.environ.get("BRAND_FONT_BOOK", "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf")
CJK = os.environ.get("BRAND_FONT_CJK", "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc")


def cjk_face(path):
    if not path.endswith(".ttc"):
        return TTFont(path)
    for f in TTCollection(path).fonts:
        if f["name"].getDebugName(1) == "Noto Sans CJK SC":
            return f
    sys.exit(f"no Noto Sans CJK SC in {path}")


class Face:
    def __init__(self, font):
        self.font = font
        self.glyphs = font.getGlyphSet()
        self.cmap = font.getBestCmap()
        self.k = 1000 / font["head"].unitsPerEm

    def glyph(self, ch):
        name = self.cmap.get(ord(ch))
        if name is None:
            sys.exit(f"no glyph for {ch!r} in {self.font['name'].getDebugName(4)}")
        return name

    def advance(self, ch):
        return self.font["hmtx"][self.glyph(ch)][0] * self.k

    def bounds(self, ch):
        pen = BoundsPen(self.glyphs)
        self.glyphs[self.glyph(ch)].draw(pen)
        return pen.bounds and [v * self.k for v in pen.bounds]

    def draw(self, ch, x, pen):
        self.glyphs[self.glyph(ch)].draw(TransformPen(pen, (self.k, 0, 0, -self.k, x, 0)))


def num(v):
    return str(round(v))


def line(face, runs, top, foot):
    """runs: (text, letter spacing in em, space before and after each character in em, class or None). An <svg> of the
    line, its viewBox from y = -top to y = -foot (thousandths of an em above the baseline)."""
    x = 0
    paths = {}
    for text, spacing, margin, cls in runs:
        pen = paths.setdefault(cls, SVGPathPen(face.glyphs, ntos=num))
        for ch in text:
            x += margin * 1000
            if not ch.isspace():
                face.draw(ch, x, pen)
            x += face.advance(ch) + spacing * 1000 + margin * 1000
    body = "".join(f'<path{f" class={chr(34)}{c}{chr(34)}" if c else ""} d="{p.getCommands()}"/>' for c, p in paths.items())
    return round(x), f'viewBox="0 {-top} {round(x)} {top - foot}"', body


def svg(cls, box, body):
    return f'<svg class="bm {cls}" {box} aria-hidden="true" focusable="false">{body}</svg>'


bold = Face(TTFont(BOLD))
book = Face(TTFont(BOOK))
cjk = Face(cjk_face(CJK))
cap = round(bold.bounds("F")[3])  # the name's cap height (flat tops: F, L, E, X, I, T)
cap_book = round(book.bounds("T")[3])
ZH = "触摸扫描感知"
zh_top = round(max(cjk.bounds(c)[3] for c in ZH))
zh_foot = round(min(cjk.bounds(c)[1] for c in ZH))

name = {}
for cls, sp in (("bm-wide", 0.22), ("bm-phone", 0.16), ("bm-tiny", 0.1)):
    w, box, body = line(bold, [("LEARN FLEXITAC", sp, 0, None)], cap, 0)
    name[cls] = svg(cls, box, body)
tag_en = {}
for cls, sp in (("bm-wide", 0.32), ("bm-phone", 0.22)):
    runs = [("TOUCH ", sp, 0, None), ("·", 0.1, 0, "bm-dot"), (" SCAN ", sp, 0, None), ("·", 0.1, 0, "bm-dot"), (" SENSE", sp, 0, None)]
    w, box, body = line(book, runs, cap_book, 0)
    tag_en[cls] = svg(cls, box, body)
w, box, body = line(cjk, [("触摸 ", 0, 0, None), ("·", 0, 0.25, "bm-dot"), (" 扫描 ", 0, 0, None), ("·", 0, 0.25, "bm-dot"), (" 感知", 0, 0, None)], zh_top, zh_foot)
tag_zh = svg("bm-all", box, body)

ts = f"""// The brand's lettering as outlines: written by scripts/brand-mark.py (see there why), do not edit.
// Heights in em of each line's size: the name {cap / 1000:.3f} (cap tops to baseline), the English tagline
// {cap_book / 1000:.3f} (the same), the Chinese tagline {(zh_top - zh_foot) / 1000:.3f} (the characters' tops {zh_top / 1000:.3f} above the baseline
// to their feet {-zh_foot / 1000:.3f} below it). shell.css shows one drawing of each line per width (bm-wide; bm-phone at 600 px and
// below; bm-tiny below 360 px; bm-all always).
export const NAME_MARK = {" + ".join("`" + s + "`" for s in name.values())};
export const TAG_MARK = {{
  en: {" + ".join("`" + s + "`" for s in tag_en.values())},
  zh: `{tag_zh}`,
}};
"""
OUT.write_text(ts)
print(f"{OUT.relative_to(ROOT)}: {len(ts)} bytes; cap {cap}, tagline cap {cap_book}, Chinese {zh_top}..{zh_foot}")
