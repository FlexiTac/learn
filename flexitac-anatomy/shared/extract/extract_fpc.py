"""Extract Top/Bottom FPC geometry from the original Gerber zips.

usage: python3 -I extract_fpc.py <work_dir> <data_dir>
  work_dir contains Gerber_Top_FPC_2026-03-02/ and Gerber_Bottom_FPC_2026-03-02/
  (unzipped from /material by run_all.sh). Writes fpc_top.json, fpc_bot.json and
  fpc_top_silk.json, fpc_bot_silk.json into data_dir.
"""
import json
import os
import sys
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gerber import parse_gerber, chains, area, bbox, dedupe, simplify, r  # noqa: E402

SPECS = {
    'top': {'dir': 'Gerber_Top_FPC_2026-03-02', 'zip': 'material/Gerber_Top_FPC_2026-03-02.zip', 'name': 'Top FPC',
            'role': 'sense', 'lineword': 'sense lines', 'orientation': 'vertical (long axis = y)'},
    'bot': {'dir': 'Gerber_Bottom_FPC_2026-03-02', 'zip': 'material/Gerber_Bottom_FPC_2026-03-02.zip', 'name': 'Bottom FPC',
            'role': 'drive', 'lineword': 'drive lines', 'orientation': 'horizontal (long axis = x)'},
}
MIL = 0.0254


def rect_of(cx, cy, w, h):
    return {'x0': cx - w / 2, 'y0': cy - h / 2, 'x1': cx + w / 2, 'y1': cy + h / 2, 'cx': cx, 'cy': cy, 'w': w, 'h': h}


def loops_from(objs, section):
    ch = chains([o for o in objs if o['kind'] == 'line' and o['section'] == section], tol=0.01)
    return [dedupe(c) for c in ch]


def extract(key, work):
    s = SPECS[key]
    d = os.path.join(work, s['dir'])
    src = lambda f: '%s:%s' % (s['zip'], f)  # noqa: E731

    # ---- outline + slots (GKO) ----
    _, gko = parse_gerber(os.path.join(d, 'Gerber_BoardOutlineLayer.GKO'))
    poly_loops = sorted(loops_from(gko, 'PolygonModel'), key=lambda c: -abs(area(c)))
    outline = poly_loops[0]
    if area(outline) < 0:
        outline = outline[::-1]  # CCW
    windows = [c[::-1] if area(c) > 0 else c for c in poly_loops[1:]]  # CW holes
    slot_loops = loops_from(gko, 'Rect')
    slots = []
    for c in slot_loops:
        b = bbox(c)
        slots.append(rect_of((b[0] + b[2]) / 2, (b[1] + b[3]) / 2, b[2] - b[0], b[3] - b[1]))

    # ---- copper (GTL) ----
    ap, gtl = parse_gerber(os.path.join(d, 'Gerber_TopLayer.GTL'))
    flashes = [o for o in gtl if o['kind'] == 'flash']
    sizes = Counter(o['ap'] for o in flashes)
    big = max(sizes, key=lambda a: ap[a]['w'] * ap[a]['h'])
    electrodes = [rect_of(o['at'][0], o['at'][1], ap[o['ap']]['w'], ap[o['ap']]['h']) for o in flashes if o['ap'] == big]
    fingers = [rect_of(o['at'][0], o['at'][1], ap[o['ap']]['w'], ap[o['ap']]['h']) for o in flashes if o['ap'] != big]
    vertical = electrodes[0]['h'] > electrodes[0]['w']
    electrodes.sort(key=lambda e: e['cx'] if vertical else e['cy'])
    tracks = [o for o in gtl if o['kind'] == 'line']
    track_w = ap[tracks[0]['ap']]['w']
    polylines = [dedupe(c) for c in chains(tracks, tol=0.13)]  # half a track width joins EasyEDA gaps

    # ---- nets from FlyingProbeTesting.json (electrode pad <-> finger pad) ----
    fpt = json.load(open(os.path.join(d, 'FlyingProbeTesting.json')))
    pins = [dict(zip(fpt['pins']['fields'], row)) for row in fpt['pins']['rows']]

    def net_at(x, y, tol=0.05):
        for p in pins:
            if abs(p['PIN_X'] * MIL - x) < tol and abs(p['PIN_Y'] * MIL - y) < tol:
                return p['NET_NAME']
        return None
    for e in electrodes:
        e['net'] = net_at(e['cx'], e['cy'])
    for f in fingers:
        f['net'] = net_at(f['cx'], f['cy'])
    finger_by_net = {f['net']: f for f in fingers}
    fingers.sort(key=lambda f: int(f['net'][3:]))
    for i, f in enumerate(fingers):
        f['index'] = i + 1

    # ---- assign fanout polylines to nets (one end on a finger, other on an electrode) ----
    def inside(p, rc, pad=0.2):
        return rc['x0'] - pad <= p[0] <= rc['x1'] + pad and rc['y0'] - pad <= p[1] <= rc['y1'] + pad
    fan = []
    for pl in polylines:
        net = None
        for f in fingers:
            if inside(pl[0], f) or inside(pl[-1], f):
                net = f['net']
                if inside(pl[0], f):
                    pl = pl[::-1]  # orient electrode -> finger
        if net is None:
            for e in electrodes:
                if inside(pl[0], e, 0.05) or inside(pl[-1], e, 0.05):
                    net = e['net']
        L = sum(((pl[i + 1][0] - pl[i][0]) ** 2 + (pl[i + 1][1] - pl[i][1]) ** 2) ** 0.5 for i in range(len(pl) - 1))
        fan.append({'net': net, 'width': track_w, 'length': L, 'pts': simplify(pl, 0.01)})
    fan.sort(key=lambda t: int(t['net'][3:]) if t['net'] else 999)

    # ---- solder-mask openings (GTS) = exposed copper windows ----
    _, gts = parse_gerber(os.path.join(d, 'Gerber_TopSolderMaskLayer.GTS'))
    mask_open = [r(bbox(o['pts'])) for o in gts if o['kind'] == 'region']

    # ---- stiffeners (GBSL, bottom side) ----
    stiff = []
    for fname, t in (('Gerber_BottomStiffenerLayer_pib_0.1.GBSL', 0.1), ('Gerber_BottomStiffenerLayer_pib_0.2.GBSL', 0.2)):
        _, g = parse_gerber(os.path.join(d, fname))
        for o in g:
            if o['kind'] == 'region':
                pts = dedupe(o['pts'])
                if area(pts) < 0:
                    pts = pts[::-1]
                stiff.append({'thickness': t, 'material': 'polyimide (PI)', 'side': 'bottom (non-copper side)',
                              'pts': pts, 'bbox': bbox(pts), 'area': abs(area(pts)), 'src': src(fname)})

    # ---- silkscreen (GTO) text outlines -> separate file ----
    _, gto = parse_gerber(os.path.join(d, 'Gerber_TopSilkscreenLayer.GTO'))
    silk_regions = [{'dark': o['dark'], 'pts': simplify(dedupe(o['pts']) + [dedupe(o['pts'])[0]], 0.01)} for o in gto if o['kind'] == 'region']
    silk_lines = [simplify(c, 0.01) for c in chains([o for o in gto if o['kind'] == 'line'], tol=0.01)]
    silk_all = [p for g in silk_regions for p in g['pts']] + [p for c in silk_lines for p in c]

    # ---- bottom-layer copper check ----
    _, gbl = parse_gerber(os.path.join(d, 'Gerber_BottomLayer.GBL'))
    gbl_count = len(gbl)

    # ---- derived numbers ----
    pos = [e['cx'] if vertical else e['cy'] for e in electrodes]
    pitch = (pos[-1] - pos[0]) / (len(pos) - 1)
    fpos = sorted(f['cx'] for f in fingers)
    fpitch = (fpos[-1] - fpos[0]) / (len(fpos) - 1)
    ew, el = (electrodes[0]['w'], electrodes[0]['h']) if vertical else (electrodes[0]['h'], electrodes[0]['w'])
    sw = min(slots[0]['w'], slots[0]['h'])
    sl = max(slots[0]['w'], slots[0]['h'])

    bridge = None
    if vertical:
        # slots are split above/below y=0: the uncut strip between them is the supporting beam
        upper = [sl_ for sl_ in slots if sl_['cy'] > 0]
        lower = [sl_ for sl_ in slots if sl_['cy'] < 0]
        if upper and lower:
            y0 = max(x['y1'] for x in lower); y1 = min(x['y0'] for x in upper)
            bridge = {'y0': y0, 'y1': y1, 'width': y1 - y0, 'x0': min(x['x0'] for x in slots), 'x1': max(x['x1'] for x in slots),
                      'cy': (y0 + y1) / 2, 'note': 'uncut FPC strip between the upper and lower slot rows; paper Fig 3b callout B "Supporting Beam"',
                      'src': src('Gerber_BoardOutlineLayer.GKO')}

    ob = bbox(outline)
    out = {
        'id': 'fpc_' + key,
        'name': s['name'],
        'units': 'mm',
        'frame': ('Native Gerber frame of %s, viewed from the copper (top) side, x right, y up. '
                  'Origin (0,0) = centre of the electrode array = centre of the active sensing area '
                  '(EasyEDA placed the electrode footprint H1/CN1 at 0,0). Both FPCs use this same origin.') % s['zip'],
        'source': {'zip': s['zip'], 'files': sorted(os.listdir(d)), 'generator': 'EasyEDA Pro (Gerber header)'},
        'copperSide': 'top layer only (GTL); GBL has %d drawn objects' % gbl_count,
        'role': {'value': s['role'], 'lines': s['lineword'], 'orientation': s['orientation']},
        'outline': {'pts': outline, 'bbox': ob, 'size': [ob[2] - ob[0], ob[3] - ob[1]], 'area': abs(area(outline)),
                    'src': src('Gerber_BoardOutlineLayer.GKO')},
        'windows': [{'pts': w, 'bbox': bbox(w), 'area': abs(area(w)), 'note': 'cut-out inside the outline'} for w in windows],
        'electrodes': {
            'count': len(electrodes), 'width': ew, 'length': el, 'pitch': pitch,
            'axis': 'x' if vertical else 'y',
            'positions': pos,
            'rects': electrodes,
            'note': 'exposed copper strips (solder-mask opened); index 0 = most negative %s' % ('x' if vertical else 'y'),
            'src': src('Gerber_TopLayer.GTL') + ' + FlyingProbeTesting.json nets',
        },
        'slots': {'count': len(slots), 'width': sw, 'length': sl, 'rects': sorted(slots, key=lambda q: (q['cx'], q['cy'])),
                  'note': 'through-cuts in the FPC between neighbouring electrodes', 'src': src('Gerber_BoardOutlineLayer.GKO')},
        'bridge': bridge,
        'fingers': {'count': len(fingers), 'width': fingers[0]['w'], 'length': fingers[0]['h'], 'pitch': fpitch,
                    'rects': fingers, 'note': 'gold (ENIG) finger pads; index = net number (NETk), NOT necessarily the FFC/connector pin number',
                    'src': src('Gerber_TopLayer.GTL')},
        'fanout': {'count': len(fan), 'traceWidth': track_w, 'traces': fan,
                   'note': 'trace polylines oriented electrode -> finger, RDP-simplified (eps 0.01 mm); part of each trace runs inside its electrode strip',
                   'src': src('Gerber_TopLayer.GTL')},
        'maskOpenings': {'bboxes': mask_open, 'src': src('Gerber_TopSolderMaskLayer.GTS')},
        'stiffeners': stiff,
        'silkscreen': {'bbox': bbox(silk_all) if silk_all else None, 'file': 'fpc_%s_silk.json' % key, 'side': 'top (copper side)'},
        'thickness': {'value': 0.2, 'unit': 'mm', 'src': 'material/FlexiTac Hardware Guide.docx (JLC order: 0.2 mm)'},
    }
    silk = {'id': 'fpc_%s_silk' % key, 'units': 'mm', 'frame': 'same as fpc_%s.json' % key, 'src': src('Gerber_TopSilkscreenLayer.GTO'),
            'regions': silk_regions, 'lines': silk_lines,
            'note': 'filled glyph outlines (EasyEDA text) + rectangle lines; regions with dark=false are counter-holes'}
    return out, silk


def main():
    work, data = sys.argv[1], sys.argv[2]
    os.makedirs(data, exist_ok=True)
    res = {}
    for key in ('top', 'bot'):
        out, silk = extract(key, work)
        res[key] = out
        json.dump(r(out), open(os.path.join(data, 'fpc_%s.json' % key), 'w'), indent=1)
        json.dump(r(silk, 3), open(os.path.join(data, 'fpc_%s_silk.json' % key), 'w'), separators=(',', ':'))

    # ---- shared sensor geometry: active area, taxel grid, assembly ----
    top, bot = res['top'], res['bot']
    xs = top['electrodes']['positions']
    ys = bot['electrodes']['positions']
    cell = top['electrodes']['pitch']
    active = {'x0': xs[0] - cell / 2, 'x1': xs[-1] + cell / 2, 'y0': ys[0] - cell / 2, 'y1': ys[-1] + cell / 2}
    active['w'] = active['x1'] - active['x0']; active['h'] = active['y1'] - active['y0']
    copper = {'x0': max(top['electrodes']['rects'][0]['x0'], bot['electrodes']['rects'][0]['x0']),
              'x1': min(top['electrodes']['rects'][-1]['x1'], bot['electrodes']['rects'][-1]['x1']),
              'y0': max(top['electrodes']['rects'][0]['y0'], bot['electrodes']['rects'][0]['y0']),
              'y1': min(top['electrodes']['rects'][-1]['y1'], bot['electrodes']['rects'][-1]['y1'])}
    for o, other in ((top, bot), (bot, top)):
        o['activeArea'] = {
            'cellGrid': active,
            'electrodeOverlap': copper,
            'nominal': {'w': 24, 'h': 64, 'src': 'material/FlexiTac Hardware Guide.docx image7(b) "24 mm x 64 mm"'},
            'taxels': {'senseLines': len(xs), 'driveLines': len(ys), 'count': len(xs) * len(ys),
                       'senseX': xs, 'driveY': ys,
                       'note': 'senseX = Top-FPC electrode centres (x), driveY = Bottom-FPC electrode centres (y); taxel = (senseX[i], driveY[j]). Frame row/col -> electrode: see firmware.json taxelMap',
                       'crossing': {'w': top['electrodes']['width'], 'h': bot['electrodes']['width'],
                                    'note': 'copper overlap of one top x bottom electrode crossing (inferred)'}},
            'note': 'cellGrid = electrode centres +/- half a pitch (computed); both FPCs share the origin at its centre',
        }
        o['assembly'] = {
            'inferred': True,
            'stackPosition': 'upper electrode layer (face-down, copper towards the Velostat)' if o is top else 'lower electrode layer (face-up, copper towards the Velostat)',
            'padFrameTransform': ({'mirrorX': False, 'note': 'in the guide photo (image7b) frame the Top FPC appears as in its Gerber: tail along the bottom edge going -x'}
                                  if o is top else
                                  {'mirrorX': True, 'note': 'in the guide photo (image7b) frame the Bottom FPC appears mirrored x -> -x: its A-shaped tail goes -x, so both tails leave on the same side'}),
            'src': 'inferred from Gerber copper side + guide image7(b) (crop7.jpg); not stated in the materials',
        }
        json.dump(r(o), open(os.path.join(data, 'fpc_%s.json' % ('top' if o is top else 'bot')), 'w'), indent=1)
    print('fpc_top: %d electrodes, %d slots, %d fingers, %d traces, bridge %.3f mm, bbox %s' % (
        top['electrodes']['count'], top['slots']['count'], top['fingers']['count'], top['fanout']['count'],
        top['bridge']['width'], r(top['outline']['size'], 3)))
    print('fpc_bot: %d electrodes, %d slots, %d fingers, %d traces, windows %d, bbox %s' % (
        bot['electrodes']['count'], bot['slots']['count'], bot['fingers']['count'], bot['fanout']['count'],
        len(bot['windows']), r(bot['outline']['size'], 3)))


if __name__ == '__main__':
    main()
