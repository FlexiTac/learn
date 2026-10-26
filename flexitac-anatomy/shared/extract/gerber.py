"""Minimal RS-274X Gerber + Excellon parser for the FlexiTac EasyEDA exports.

Pure standard library (run with `python3 -I`). Handles what these files use:
%FS / %MO / %AD (C, R, O, aperture macros) / %AM / %LP, G01 linear, G02/G03
arcs (G75 multi-quadrant, I/J offsets), G36/G37 regions, D01/D02/D03 and the
EasyEDA "G04 <Section> Start*" comments (kept as a `section` tag per object).

All coordinates are returned in millimetres in the file's own frame.
"""
import math
import re


def _num(s, dec):
    """Gerber/Excellon fixed-point integer string -> float (leading zeros omitted)."""
    return int(s) / (10 ** dec)


def _macro_bbox(body, params):
    """Approximate an aperture macro by the bbox of its primitives -> (w, h)."""
    def val(tok):
        tok = tok.strip()
        for i, p in enumerate(params, 1):
            tok = tok.replace('$%d' % i, repr(p))
        tok = tok.replace('x', '*').replace('X', '*')
        return float(eval(tok, {'__builtins__': {}}, {}))  # noqa: S307 (numeric macro expr only)
    xs, ys = [], []
    for prim in body.split('*'):
        prim = prim.strip()
        if not prim or prim.startswith('0 '):
            continue
        f = prim.split(',')
        code = int(f[0])
        a = [val(t) for t in f[1:]]
        if code == 1:  # circle: exp, dia, x, y
            d, x, y = a[1], a[2], a[3]
            xs += [x - d / 2, x + d / 2]; ys += [y - d / 2, y + d / 2]
        elif code == 20:  # vector line: exp, w, x1, y1, x2, y2, rot
            w = a[1]
            xs += [a[2], a[4]]; ys += [a[3] - w / 2, a[5] + w / 2, a[3] + w / 2, a[5] - w / 2]
        elif code == 21:  # centre line: exp, w, h, x, y, rot
            w, h, x, y, rot = a[1], a[2], a[3], a[4], a[5]
            if int(round(rot)) % 180 == 90:
                w, h = h, w
            xs += [x - w / 2, x + w / 2]; ys += [y - h / 2, y + h / 2]
        elif code == 4:  # outline: exp, n, x0, y0, ..., rot
            n = int(a[1])
            pts = a[2:2 + 2 * (n + 1)]
            xs += pts[0::2]; ys += pts[1::2]
    if not xs:
        return (0.0, 0.0)
    return (max(xs) - min(xs), max(ys) - min(ys))


def parse_gerber(path):
    txt = open(path, encoding='utf-8', errors='ignore').read()
    fs = re.search(r'%FSLAX(\d)(\d)Y(\d)(\d)\*%', txt)
    dec = int(fs.group(2)) if fs else 5
    macros = {m.group(1): m.group(2) for m in re.finditer(r'%AM(\w+)\*(.*?)%', txt, re.S)}
    apertures = {}
    for m in re.finditer(r'%ADD(\d+)([A-Za-z_][\w.]*?)(?:,([^*]*))?\*%', txt):
        name = m.group(2)
        params = [float(p) for p in m.group(3).split('X')] if m.group(3) else []
        if name == 'C':
            ap = {'shape': 'C', 'w': params[0], 'h': params[0]}
        elif name in ('R', 'O'):
            ap = {'shape': name, 'w': params[0], 'h': params[1]}
        elif name in macros:
            w, h = _macro_bbox(macros[name], params)
            ap = {'shape': 'M', 'macro': name, 'w': w, 'h': h}
        else:
            ap = {'shape': '?', 'w': params[0] if params else 0.1, 'h': params[1] if len(params) > 1 else (params[0] if params else 0.1)}
        apertures[int(m.group(1))] = ap

    objs = []
    x = y = 0.0
    cur = None
    region = False
    poly = []
    dark = True
    interp = 1
    section = None
    tokens = re.findall(r'%(LP[DC])\*%|(%[^%]*%)|([^*%]+)\*', txt)

    def flush_region():
        nonlocal poly
        if len(poly) > 2:
            objs.append({'kind': 'region', 'pts': poly, 'dark': dark, 'section': section})
        poly = []

    for lp, _ext, c in tokens:
        if lp:
            dark = lp == 'LPD'
            continue
        if not c:
            continue
        c = c.strip()
        if c.startswith('G04'):
            m = re.match(r'G04\s+(.*?)\s+(Start|End)$', c)
            if m:
                section = m.group(1) if m.group(2) == 'Start' else None
            continue
        if c.startswith('M02'):
            break
        if c == 'G36':
            region = True; poly = []; continue
        if c == 'G37':
            flush_region(); region = False; continue
        if c in ('G75', 'G74', 'G90', 'G71'):
            continue
        m = re.match(r'^(?:G54)?D(\d+)$', c)
        if m and int(m.group(1)) >= 10:
            cur = int(m.group(1)); continue
        m = re.match(r'^G0?([123])$', c)
        if m:
            interp = int(m.group(1)); continue
        m = re.match(r'^(?:G0?([123]))?(?:X(-?\d+))?(?:Y(-?\d+))?(?:I(-?\d+))?(?:J(-?\d+))?(?:D0?([123]))?$', c)
        if not m or c == '':
            continue
        if m.group(1):
            interp = int(m.group(1))
        nx = _num(m.group(2), dec) if m.group(2) else x
        ny = _num(m.group(3), dec) if m.group(3) else y
        d = int(m.group(6)) if m.group(6) else 1
        pts = [(nx, ny)]
        if interp in (2, 3) and d == 1:
            i = _num(m.group(4), dec) if m.group(4) else 0.0
            j = _num(m.group(5), dec) if m.group(5) else 0.0
            cx, cy = x + i, y + j
            r = math.hypot(x - cx, y - cy)
            a0 = math.atan2(y - cy, x - cx)
            a1 = math.atan2(ny - cy, nx - cx)
            if interp == 3:  # CCW
                while a1 <= a0: a1 += 2 * math.pi
            else:
                while a1 >= a0: a1 -= 2 * math.pi
            n = max(4, int(abs(a1 - a0) / (math.pi / 16)))
            pts = [(cx + r * math.cos(a0 + (a1 - a0) * k / n), cy + r * math.sin(a0 + (a1 - a0) * k / n)) for k in range(1, n + 1)]
            pts[-1] = (nx, ny)
        if region:
            if d == 2:
                flush_region(); poly = [(nx, ny)]
            elif d == 1:
                if not poly: poly = [(x, y)]
                poly.extend(pts)
        else:
            if d == 1:
                prev = (x, y)
                for p in pts:
                    objs.append({'kind': 'line', 'a': prev, 'b': p, 'ap': cur, 'dark': dark, 'section': section})
                    prev = p
            elif d == 3:
                objs.append({'kind': 'flash', 'at': (nx, ny), 'ap': cur, 'dark': dark, 'section': section})
        x, y = nx, ny
    return apertures, objs


def chains(lines, tol=0.02):
    """Join consecutive/touching line segments into polylines. Returns list of point lists."""
    segs = [(l['a'], l['b']) for l in lines]
    out = []
    used = [False] * len(segs)
    def close(p, q):
        return abs(p[0] - q[0]) <= tol and abs(p[1] - q[1]) <= tol
    for i, (a, b) in enumerate(segs):
        if used[i]:
            continue
        used[i] = True
        pl = [a, b]
        grown = True
        while grown:
            grown = False
            for k, (c, d) in enumerate(segs):
                if used[k]:
                    continue
                if close(pl[-1], c): pl.append(d)
                elif close(pl[-1], d): pl.append(c)
                elif close(pl[0], d): pl.insert(0, c)
                elif close(pl[0], c): pl.insert(0, d)
                else: continue
                used[k] = True; grown = True
        out.append(pl)
    return out


def area(pts):
    s = 0.0
    for i in range(len(pts)):
        x1, y1 = pts[i]; x2, y2 = pts[(i + 1) % len(pts)]
        s += x1 * y2 - x2 * y1
    return s / 2


def bbox(pts):
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    return [min(xs), min(ys), max(xs), max(ys)]


def dedupe(pts, tol=1e-4):
    out = []
    for p in pts:
        if not out or abs(out[-1][0] - p[0]) > tol or abs(out[-1][1] - p[1]) > tol:
            out.append(p)
    if len(out) > 2 and abs(out[0][0] - out[-1][0]) <= tol and abs(out[0][1] - out[-1][1]) <= tol:
        out.pop()
    return out


def simplify(pts, eps=0.02):
    """Ramer-Douglas-Peucker simplification of an open polyline."""
    if len(pts) < 3:
        return list(pts)
    (x1, y1), (x2, y2) = pts[0], pts[-1]
    L = math.hypot(x2 - x1, y2 - y1)
    dmax, idx = -1.0, 0
    for i in range(1, len(pts) - 1):
        px, py = pts[i]
        d = math.hypot(px - x1, py - y1) if L == 0 else abs((x2 - x1) * (y1 - py) - (x1 - px) * (y2 - y1)) / L
        if d > dmax:
            dmax, idx = d, i
    if dmax > eps:
        return simplify(pts[:idx + 1], eps)[:-1] + simplify(pts[idx:], eps)
    return [pts[0], pts[-1]]


def parse_excellon(path):
    """Excellon drill file -> list of {tool, dia, x, y} (mm). Assumes METRIC with explicit FILE_FORMAT."""
    txt = open(path, encoding='utf-8', errors='ignore').read()
    fm = re.search(r'FILE_FORMAT=(\d):(\d)', txt)
    idig, ddig = (int(fm.group(1)), int(fm.group(2))) if fm else (3, 3)
    tools = {m.group(1): float(m.group(2)) for m in re.finditer(r'^T(\d+)C([\d.]+)', txt, re.M)}
    holes = []
    tool = None
    body = txt.split('%', 1)[1] if '%' in txt else txt
    for line in body.splitlines():
        line = line.strip()
        m = re.match(r'^T(\d+)$', line)
        if m:
            tool = m.group(1); continue
        m = re.match(r'^X(-?\d+)Y(-?\d+)$', line)
        if m and tool:
            def conv(s):
                neg = s.startswith('-'); s = s.lstrip('-')
                # LZ = leading zeros kept -> fixed integer digits
                s = s.ljust(idig + ddig, '0')
                v = int(s[:idig]) + int(s[idig:idig + ddig]) / 10 ** ddig
                return -v if neg else v
            holes.append({'tool': 'T' + tool, 'dia': tools[tool], 'x': conv(m.group(1)), 'y': conv(m.group(2))})
    return holes


def r(v, n=4):
    """Round floats recursively for JSON output."""
    if isinstance(v, float):
        return round(v, n) + 0.0
    if isinstance(v, (list, tuple)):
        return [r(x, n) for x in v]
    if isinstance(v, dict):
        return {k: r(x, n) for k, x in v.items()}
    return v
