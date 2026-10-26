"""Extract the 32x16 reading board (v-1.0) from the original files.

usage: python3 -I extract_board.py <work_dir> <material_dir> <data_dir>
  work_dir/Gerber_16_32/ = unzipped material/Gerber_16_32.zip
Reads PickAndPlace + BOM CSVs (UTF-16) from material_dir. Writes data_dir/board.json.

Copper connectivity (tracks + vias + pads, both layers; pours ignored) is traced
from the Gerbers and checked against the schematic net list below.
"""
import csv
import io
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gerber import parse_gerber, parse_excellon, chains, bbox, dedupe, simplify, r  # noqa: E402

ZIP = 'material/Gerber_16_32.zip'
PNP = 'PickAndPlace_PCB_05mm_FFC_16_32_1mux_4sr_2025-11-01.csv'
BOM = 'BOM_05mm_FFC_16_32_1mux_4sr_2025-11-01.csv'
SCH = 'material/tactile_reading_board_32x16.pdf'

# ---------------------------------------------------------------- pin functions (datasheets) ----
P595 = {1: 'QB', 2: 'QC', 3: 'QD', 4: 'QE', 5: 'QF', 6: 'QG', 7: 'QH', 8: 'GND', 9: "QH'", 10: '#SRCLR',
        11: 'SRCLK', 12: 'RCLK', 13: '#OE', 14: 'SER', 15: 'QA', 16: 'VCC'}
P4067 = {1: 'COM', 2: 'I7', 3: 'I6', 4: 'I5', 5: 'I4', 6: 'I3', 7: 'I2', 8: 'I1', 9: 'I0', 10: 'S0', 11: 'S1',
         12: 'GND', 13: 'S3', 14: 'S2', 15: '#E', 16: 'I15', 17: 'I14', 18: 'I13', 19: 'I12', 20: 'I11',
         21: 'I10', 22: 'I9', 23: 'I8', 24: 'VCC'}
NANO = {1: 'D1/TX', 2: 'D0/RX', 3: 'RESET', 4: 'GND', 5: 'D2', 6: 'D3', 7: 'D4', 8: 'D5', 9: 'D6', 10: 'D7',
        11: 'D8', 12: 'D9', 13: 'D10', 14: 'D11', 15: 'D12', 16: 'D13', 17: '3V3', 18: 'AREF', 19: 'A0',
        20: 'A1', 21: 'A2', 22: 'A3', 23: 'A4', 24: 'A5', 25: 'A6', 26: 'A7', 27: '+5V', 28: 'RESET',
        29: 'GND', 30: 'VIN'}
QORDER = ['QA', 'QB', 'QC', 'QD', 'QE', 'QF', 'QG', 'QH']
CHAIN = ['U2', 'U3', 'U4', 'U5']

# ---------------------------------------------------------------- package bodies ----
# L x W from the EasyEDA footprint name (L = along the pin rows); heights are external
# datasheet / typical values (not in the materials) -> inferred.
PACKAGES = {
    'SOP-16_L10.3-W5.4-P1.27-LS7.8-BL': {'package': 'SOP-16 (TI "NS")', 'body': [10.3, 5.4], 'leadSpan': 7.8, 'pitch': 1.27, 'pins': 16,
                                          'height': 2.0, 'heightNote': 'TI NS (SOP) package max 2.00 mm - external datasheet value, inferred'},
    'SOIC-24_L15.4-W7.5-P1.27-LS10.3-BL': {'package': 'SOIC-24 (TI "DW"/M96)', 'body': [15.4, 7.5], 'leadSpan': 10.3, 'pitch': 1.27, 'pins': 24,
                                            'height': 2.65, 'heightNote': 'TI DW (SOIC) package max 2.65 mm - external datasheet value, inferred'},
    'R1206': {'package': '1206 chip resistor', 'body': [3.2, 1.6], 'pitch': None, 'pins': 2,
              'height': 0.55, 'heightNote': '1206 thick-film typical 0.55 mm - external, inferred'},
    'FFC-SMD_FFC05001-16SBB124W5M': {'package': '0.5 mm FFC connector, 16-pin', 'body': None, 'pitch': 0.5, 'pins': 16,
                                     'height': None, 'heightNote': 'no datasheet in the materials; body from pads + silkscreen (inferred)'},
    'FFC-SMD_32P-P0.50_THD0515-32CL-SN': {'package': '0.5 mm FFC connector, 32-pin', 'body': None, 'pitch': 0.5, 'pins': 32,
                                          'height': None, 'heightNote': 'no datasheet in the materials; body from pads + silkscreen (inferred)'},
}


def read_utf16_tsv(path):
    raw = open(path, 'rb').read().decode('utf-16')
    return list(csv.DictReader(io.StringIO(raw), delimiter='\t'))


def mm(s):
    return float(s.replace('mm', '').strip())


def rot(p, deg):
    a = math.radians(deg)
    return (p[0] * math.cos(a) - p[1] * math.sin(a), p[0] * math.sin(a) + p[1] * math.cos(a))


def seg_dist(p, a, b):
    ax, ay = a; bx, by = b; px, py = p
    dx, dy = bx - ax, by - ay
    L2 = dx * dx + dy * dy
    t = 0 if L2 == 0 else max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / L2))
    return math.hypot(px - ax - t * dx, py - ay - t * dy)


class UF:
    def __init__(self):
        self.p = {}

    def f(self, x):
        self.p.setdefault(x, x)
        while self.p[x] != x:
            self.p[x] = self.p[self.p[x]]
            x = self.p[x]
        return x

    def u(self, a, b):
        self.p[self.f(a)] = self.f(b)


def main():
    work, material, data = sys.argv[1], sys.argv[2], sys.argv[3]
    g = os.path.join(work, 'Gerber_16_32')
    src = lambda f: '%s:%s' % (ZIP, f)  # noqa: E731

    # ---------------- outline ----------------
    _, gko = parse_gerber(os.path.join(g, 'Gerber_BoardOutlineLayer.GKO'))
    ol = dedupe(chains([o for o in gko if o['kind'] == 'line'])[0])
    ob = bbox(ol)
    origin = (ob[0], ob[1])

    # ---------------- drills ----------------
    vias = parse_excellon(os.path.join(g, 'Drill_PTH_Through_Via.DRL'))
    pth = parse_excellon(os.path.join(g, 'Drill_PTH_Through.DRL'))
    big_d = max(h['dia'] for h in pth)
    headers = [h for h in pth if h['dia'] == big_d]

    # ---------------- copper ----------------
    apT, gtl = parse_gerber(os.path.join(g, 'Gerber_TopLayer.GTL'))
    apB, gbl = parse_gerber(os.path.join(g, 'Gerber_BottomLayer.GBL'))
    via_d = min(h['dia'] for h in pth)

    def pads_of(objs, ap):
        out = []
        for o in objs:
            if o['kind'] == 'flash':
                a = ap[o['ap']]
                out.append({'x': o['at'][0], 'y': o['at'][1], 'w': a['w'], 'h': a['h'], 'shape': a['shape']})
        return out
    padsT, padsB = pads_of(gtl, apT), pads_of(gbl, apB)

    # ---------------- header (Arduino Nano U1) ----------------
    xs = sorted(set(round(h['x'], 3) for h in headers))
    left, right = xs[0], xs[-1]
    lrow = sorted([h for h in headers if round(h['x'], 3) == left], key=lambda h: -h['y'])
    rrow = sorted([h for h in headers if round(h['x'], 3) == right], key=lambda h: h['y'])
    header_pins = []
    for i, h in enumerate(lrow + rrow):
        n = i + 1
        sq = any(p['shape'] == 'R' and abs(p['x'] - h['x']) < 0.05 and abs(p['y'] - h['y']) < 0.05 for p in padsT)
        header_pins.append({'pin': n, 'name': NANO[n], 'x': h['x'], 'y': h['y'], 'drill': h['dia'], 'pad': 1.6, 'square': sq})
    assert header_pins[0]['square'] and header_pins[29]['square'], 'pin-1/VIN square pads not where expected'

    # ---------------- PnP + BOM ----------------
    pnp = read_utf16_tsv(os.path.join(material, PNP))
    bom = read_utf16_tsv(os.path.join(material, BOM))
    bom_by = {}
    for row in bom:
        for des in row['Designator'].replace('"', '').split(','):
            bom_by[des.strip()] = {k: (v or '').strip().strip('"').strip() for k, v in row.items()}

    def snap(x, y, tol=0.25):
        best, bd = None, tol
        for p in padsT:
            dd = math.hypot(p['x'] - x, p['y'] - y)
            if dd < bd:
                best, bd = p, dd
        return best

    comps = []
    for row in pnp:
        des = row['Designator']
        fp = row['Footprint']
        mx, my = mm(row['Mid X']), mm(row['Mid Y'])
        px, py = mm(row['Pad X']), mm(row['Pad Y'])
        rdeg = float(row['Rotation'])
        pk = PACKAGES[fp]
        l1 = rot((px - mx, py - my), -rdeg)  # pin-1 in the footprint's own (rot 0) frame
        n = pk['pins']
        loc = []
        if fp.startswith('SOP') or fp.startswith('SOIC'):
            p = pk['pitch']
            for k in range(n // 2):
                loc.append((l1[0] + k * p, l1[1]))
            for k in range(n // 2):
                loc.append((-l1[0] - k * p, -l1[1]))
        elif fp.startswith('FFC'):
            for k in range(n):
                loc.append((l1[0] + k * 0.5, l1[1]))
        else:
            loc = [l1, (-l1[0], -l1[1])]
        pins = []
        for k, lp in enumerate(loc):
            gx, gy = rot(lp, rdeg)
            gx += mx; gy += my
            pad = snap(gx, gy)
            assert pad is not None, '%s pin %d: no copper pad near (%.3f, %.3f)' % (des, k + 1, gx, gy)
            fn = P595.get(k + 1) if des in CHAIN else P4067.get(k + 1) if des == 'U6' else None
            if des == 'FPC1':
                fn = 'SR%d' % (k + 1)
            if des == 'FPC2':
                fn = 'SC%d' % (k + 1)
            if des == 'R1':
                fn = 'GND' if k == 0 else 'A0'  # traced from copper: pad 1 -> GND, pad 2 -> A0/COM
            pins.append({'pin': k + 1, 'fn': fn, 'x': pad['x'], 'y': pad['y'], 'padW': pad['w'], 'padH': pad['h'],
                         'err': math.hypot(pad['x'] - gx, pad['y'] - gy)})
        allp = [(q['x'] - q['padW'] / 2, q['y'] - q['padH'] / 2) for q in pins] + [(q['x'] + q['padW'] / 2, q['y'] + q['padH'] / 2) for q in pins]
        tabs = []
        if fp.startswith('FFC'):
            # mounting tabs = the two big rectangular pads nearest the connector
            cand = sorted([p for p in padsT if p['w'] >= 1.4 and p['shape'] == 'R' and p['w'] < 3 and abs(p['y'] - my) < 4 and abs(p['x'] - mx) < (n * 0.25 + 4)],
                          key=lambda p: abs(p['x'] - mx))
            tabs = [{'x': p['x'], 'y': p['y'], 'w': p['w'], 'h': p['h']} for p in cand[:2]]
            allp += [(t['x'] - t['w'] / 2, t['y'] - t['h'] / 2) for t in tabs] + [(t['x'] + t['w'] / 2, t['y'] + t['h'] / 2) for t in tabs]
        b = bom_by.get(des, {})
        comps.append({
            'designator': des, 'footprint': fp, 'comment': row['Comment'], 'layer': 'top' if row['Layer'] == 'T' else 'bottom',
            'x': mx, 'y': my, 'rotation': rdeg, 'pin1': {'x': px, 'y': py},
            'mpn': b.get('Manufacturer Part') or b.get('Name') or None, 'manufacturer': b.get('Manufacturer') or None,
            'lcsc': b.get('Supplier Part') or None,
            'package': {k: v for k, v in pk.items() if k != 'pins'} | {'pins': n},
            'padBBox': bbox(allp), 'pins': pins, 'tabs': tabs,
            'src': 'material/%s + %s + %s:Gerber_TopLayer.GTL (pads)' % (PNP, BOM, ZIP),
        })
    by = {c['designator']: c for c in comps}
    # R1: the BOM part number decodes to 10.0 kOhm; PnP/schematic label "20k" is a documentation error (user-confirmed)
    by['R1']['value'] = {'value': 10000, 'unit': 'ohm', 'src': 'user-confirmed 2026-10-21; BOM MPN 1206W4F1002T5E (1002 = 10.0 kOhm)',
                         'note': 'PnP Comment / schematic label "20k" is a documentation error'}
    by['R1']['marking'] = '1002'

    # ---------------- silkscreen outlines near each component ----------------
    _, gto = parse_gerber(os.path.join(g, 'Gerber_TopSilkscreenLayer.GTO'))
    silk_chains = [(o_ap, c) for o_ap in (10, 12) for c in chains([o for o in gto if o['kind'] == 'line' and o['ap'] == o_ap], tol=0.01)]
    for c in comps:
        pb = c['padBBox']
        sel = []
        for _, ch in silk_chains:
            bb = bbox(ch)
            cx, cy = (bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2
            if pb[0] - 2.5 <= bb[0] and bb[2] <= pb[2] + 2.5 and pb[1] - 2.5 <= bb[1] and bb[3] <= pb[3] + 2.5:
                sel.append(bb)
        if sel:
            c['silkBBox'] = [min(b[0] for b in sel), min(b[1] for b in sel), max(b[2] for b in sel), max(b[3] for b in sel)]
        if c['package']['body'] is None:
            sb = c.get('silkBBox') or pb
            # long side along the pin row (local x); rotation 180 keeps it along global x
            c['package']['body'] = [sb[2] - sb[0], sb[3] - sb[1]]
            c['package']['bodyNote'] = 'extent of copper pads + silkscreen outline (inferred, no datasheet in the materials)'

    # Nano outline + USB from the document layer (regions) / silkscreen
    _, gdl = parse_gerber(os.path.join(g, 'Gerber_DocumentLayer.GDL'))
    regs = sorted([bbox(o['pts']) for o in gdl if o['kind'] == 'region'], key=lambda b: -(b[2] - b[0]) * (b[3] - b[1]))
    nano_bb = regs[0]
    usb_bb = [b for b in regs if b[1] < ob[1] and b[3] > ob[1] - 10 and b[2] - b[0] < 8][0]

    # ---------------- connectivity ----------------
    uf = UF()
    items = []  # (id, layer, kind, data)

    def add_layer(objs, ap, layer):
        for i, o in enumerate(objs):
            if o['kind'] == 'line':
                items.append(('%s:t%d' % (layer, i), layer, 'track', (o['a'], o['b'], ap[o['ap']]['w'])))
            elif o['kind'] == 'flash':
                a = ap[o['ap']]
                items.append(('%s:p%d' % (layer, i), layer, 'pad', (o['at'], a['w'], a['h'])))
    add_layer(gtl, apT, 'T')
    add_layer(gbl, apB, 'B')
    tracks = [it for it in items if it[2] == 'track']
    pads = [it for it in items if it[2] == 'pad']
    for it in items:
        uf.f(it[0])
    # track-track (same layer): endpoint touching the other segment
    for i, a in enumerate(tracks):
        (a0, a1, aw) = a[3]
        for b in tracks[i + 1:]:
            if b[1] != a[1]:
                continue
            (b0, b1, bw) = b[3]
            tol = (aw + bw) / 2 * 0.5
            if (seg_dist(a0, b0, b1) < tol or seg_dist(a1, b0, b1) < tol or seg_dist(b0, a0, a1) < tol or seg_dist(b1, a0, a1) < tol):
                uf.u(a[0], b[0])
    # track-pad
    for t in tracks:
        (t0, t1, tw) = t[3]
        for p in pads:
            if p[1] != t[1]:
                continue
            (c, w, h) = p[3]
            for e in (t0, t1):
                if abs(e[0] - c[0]) <= w / 2 + 0.01 and abs(e[1] - c[1]) <= h / 2 + 0.01:
                    uf.u(t[0], p[0])
    # through-holes (vias + header) join top & bottom pads at the same spot
    for h in vias + headers:
        ids = [p[0] for p in pads if math.hypot(p[3][0][0] - h['x'], p[3][0][1] - h['y']) < 0.05]
        for k in ids[1:]:
            uf.u(ids[0], k)

    def pad_id(x, y, layer='T'):
        for p in pads:
            if p[1] == layer and math.hypot(p[3][0][0] - x, p[3][0][1] - y) < 0.02:
                return p[0]
        return None

    # name every pin node
    members = {}
    def tag(node, label):
        if node:
            members.setdefault(uf.f(node), []).append(label)
    for hp in header_pins:
        tag(pad_id(hp['x'], hp['y']), 'U1.%d(%s)' % (hp['pin'], hp['name']))
    for c in comps:
        for p in c['pins']:
            tag(pad_id(p['x'], p['y']), '%s.%d%s' % (c['designator'], p['pin'], '(%s)' % p['fn'] if p['fn'] else ''))

    def traced(label):
        for root, labs in members.items():
            if label in labs:
                return root, labs
        return None, []

    # ---------------- schematic nets (authoritative) + copper check ----------------
    def nano(name):
        hp = [h for h in header_pins if h['name'] == name][-1]  # GND: pin 29 (pin 4 joins via the pour)
        return 'U1.%d(%s)' % (hp['pin'], name)

    def pin(des, n):
        c = by[des]; p = [q for q in c['pins'] if q['pin'] == n][0]
        return '%s.%d%s' % (des, n, '(%s)' % p['fn'] if p['fn'] else '')

    def p595(des, fn):
        return pin(des, [k for k, v in P595.items() if v == fn][0])

    def p4067(fn):
        return pin('U6', [k for k, v in P4067.items() if v == fn][0])

    nets = []
    def net(name, nodes, role, note=None, sch=True):
        nets.append({'name': name, 'nodes': nodes, 'role': role, 'note': note,
                     'src': ('%s (schematic)' % SCH) if sch else 'inferred'})
    net('D2_SER', [nano('D2'), p595('U2', 'SER')], 'shift-register serial data in (first 595 of the chain)')
    net('D3_CLK', [nano('D3')] + [p595(u, f) for u in CHAIN for f in ('SRCLK', 'RCLK')], 'SRCLK and RCLK of all four 595s tied together -> output latch lags the shift stage by one clock')
    for k, dn in enumerate(['D4', 'D5', 'D6', 'D7']):
        net('%s_S%d' % (dn, k), [nano(dn), p4067('S%d' % k)], 'mux channel-select bit %d' % k)
    net('D8_E', [nano('D8'), p4067('#E')], 'mux enable (active LOW); firmware pulses it HIGH->LOW once per frame')
    net('A0_COM', [nano('A0'), p4067('COM'), pin('R1', 2)], 'mux common output -> ADC A0, top of R1')
    net('GND', [nano('GND'), pin('R1', 1), p4067('GND')] + [p595(u, 'GND') for u in CHAIN] + [p595(u, '#OE') for u in CHAIN],
        'ground; R1 pulls A0 to GND; #OE tied LOW -> 595 outputs always enabled (push-pull)', 'pour-connected pins are not traced by the copper check')
    net('VCC', [nano('+5V'), p4067('VCC')] + [p595(u, 'VCC') for u in CHAIN] + [p595(u, '#SRCLR') for u in CHAIN],
        '+5 V from the Nano; #SRCLR tied HIGH (never cleared)', 'pour-connected pins are not traced by the copper check')
    for a, b in zip(CHAIN, CHAIN[1:]):
        net('CHAIN_%s_%s' % (a, b), [p595(a, "QH'"), p595(b, 'SER')], "daisy chain %s.QH' -> %s.SER" % (a, b))
    for i in range(32):
        u = CHAIN[i // 8]; q = QORDER[i % 8]
        net('SC%d' % (i + 1), [p595(u, q), pin('FPC2', i + 1)], 'drive line %d: %s.%s -> FPC2 pin %d -> Bottom FPC' % (i + 1, u, q, i + 1))
    for i in range(16):
        net('SR%d' % (i + 1), [p4067('I%d' % i), pin('FPC1', i + 1)], 'sense line %d: FPC1 pin %d -> mux channel I%d%s' % (
            i + 1, i + 1, i, '' if i >= 4 else ' (unused by the 12x32 sensor)'))
    nets.append({'name': "U5_QH'", 'nodes': [p595('U5', "QH'")], 'role': 'end of chain, not connected', 'note': None, 'src': '%s (schematic)' % SCH})

    # copper check + track geometry per net
    tracks_by_root = {}
    for t in tracks:
        tracks_by_root.setdefault(uf.f(t[0]), []).append(t)
    via_by_root = {}
    for h in vias:
        pid = None
        for p in pads:
            if math.hypot(p[3][0][0] - h['x'], p[3][0][1] - h['y']) < 0.05:
                pid = p[0]; break
        if pid:
            via_by_root.setdefault(uf.f(pid), []).append(h)
    bad = []
    for n in nets:
        roots = set()
        for node in n['nodes']:
            root, _ = traced(node)
            roots.add(root)
        n['copperVerified'] = len(roots) == 1 and None not in roots
        if not n['copperVerified'] and n['name'] not in ('GND', 'VCC', "U5_QH'"):
            bad.append(n['name'])
        if len(roots) == 1 and None not in roots:
            root = roots.pop()
            segs = tracks_by_root.get(root, [])
            geo = {}
            for layer in ('T', 'B'):
                ls = [{'a': s[3][0], 'b': s[3][1]} for s in segs if s[1] == layer]
                geo['top' if layer == 'T' else 'bottom'] = [simplify(dedupe(c), 0.005) for c in chains(ls, tol=0.01)]
            n['tracks'] = geo
            n['trackWidth'] = 0.254
            n['vias'] = [[h['x'], h['y']] for h in via_by_root.get(root, [])]
            n['allTracedPins'] = sorted(members.get(root, []))
    if bad:
        print('WARNING: copper does not confirm nets:', bad)

    # ---------------- assemble ----------------
    fpc1 = by['FPC1']; fpc2 = by['FPC2']
    out = {
        'id': 'board',
        'name': 'Tactile Reading Board 32x16 v-1.0',
        'units': 'mm',
        'frame': ('EasyEDA board coordinates (Gerber + PickAndPlace share them): x right, y up, viewed from the top (component) side. '
                  'Board-local coordinates = (x - origin.x, y - origin.y); origin = lower-left corner of the GKO outline. '
                  'Rotation = degrees CCW as in the PnP file.'),
        'origin': {'x': origin[0], 'y': origin[1]},
        'outline': {'pts': ol, 'bbox': ob, 'size': [ob[2] - ob[0], ob[3] - ob[1]], 'src': src('Gerber_BoardOutlineLayer.GKO'),
                    'paperSize': [56.8, 39.9], 'docLayerSize': [56.642, 40.005]},
        'layers': {'copper': 2, 'material': 'FR-4', 'allSmdOn': 'top', 'thickness': None,
                   'note': 'board thickness not stated in the materials'},
        'components': comps,
        'connectors': {
            'FPC1': {'pins': 16, 'role': 'sense lines SR1-SR16 -> mux I0-I15 (Top FPC, 12 fingers on pins 5-16 for the 12x32 sensor: mux channels 4-15)',
                     'pin1': fpc1['pin1'], 'pinStep': [fpc1['pins'][1]['x'] - fpc1['pins'][0]['x'], fpc1['pins'][1]['y'] - fpc1['pins'][0]['y']],
                     'pins16': [[p['x'], p['y']] for p in fpc1['pins']], 'mpn': fpc1['mpn'], 'lcsc': fpc1['lcsc']},
            'FPC2': {'pins': 32, 'role': 'drive lines SC1-SC32 <- 4x 74HC595 (Bottom FPC, 32 fingers)',
                     'pin1': fpc2['pin1'], 'pinStep': [fpc2['pins'][1]['x'] - fpc2['pins'][0]['x'], fpc2['pins'][1]['y'] - fpc2['pins'][0]['y']],
                     'pins32': [[p['x'], p['y']] for p in fpc2['pins']], 'mpn': fpc2['mpn'], 'lcsc': fpc2['lcsc']},
            'src': 'material/%s (Pad X/Y = pin 1) + Gerber pads' % PNP,
        },
        'vias': {'count': len(vias), 'drill': via_d, 'pad': 0.6096, 'positions': [[h['x'], h['y']] for h in vias], 'src': src('Drill_PTH_Through_Via.DRL')},
        'header': {
            'part': 'Arduino Nano (U1, through-hole, not in the PnP)', 'count': len(headers), 'drill': big_d, 'pad': 1.6, 'pitch': 2.54,
            'rowSpacing': right - left, 'rows': {'left': left, 'right': right},
            'pins': header_pins,
            'pinOrder': 'pin 1 = TX (square pad) top-left, pins 1-15 run down the left row (x=%.3f), pins 16-30 run up the right row (x=%.3f); VIN = pin 30 (square)' % (left, right),
            'nanoOutline': nano_bb, 'usbOutline': usb_bb, 'nanoOutlineSrc': src('Gerber_DocumentLayer.GDL') + ' (regions)',
            'src': src('Drill_PTH_Through.DRL') + ' T02 + schematic U1 pin names',
        },
        'mountingHoles': {'count': 0, 'note': 'only drills are vias and header holes'},
        'nets': nets,
        'netsCopperCheck': {'verified': [n['name'] for n in nets if n.get('copperVerified')], 'notVerified': [n['name'] for n in nets if not n.get('copperVerified')],
                            'method': 'union-find over tracks, pads, vias and header holes on GTL+GBL (copper pours ignored)'},
        'nano': {'D2': 'SER (595 data)', 'D3': 'SRCLK+RCLK (tied)', 'D4': 'S0', 'D5': 'S1', 'D6': 'S2', 'D7': 'S3', 'D8': '#E (mux enable)',
                 'D9': 'defined in firmware (PIN_MUX_INHIBIT_1) - not connected on this board', 'A0': 'mux COM + R1 to GND',
                 'src': '%s + refs/fw/32_16_fast.ino' % SCH},
    }
    json.dump(r(out), open(os.path.join(data, 'board.json'), 'w'), indent=1)
    print('board: %d components, %d vias, %d header holes, outline %s, nets %d (copper-verified %d)' % (
        len(comps), len(vias), len(headers), r(out['outline']['size'], 3), len(nets), len(out['netsCopperCheck']['verified'])))
    print('max pin snap error %.4f mm' % max(p['err'] for c in comps for p in c['pins']))


if __name__ == '__main__':
    main()
