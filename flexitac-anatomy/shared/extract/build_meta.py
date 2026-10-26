"""Build firmware.json, stack.json, sources.json and the ESM wrappers (index.mjs, constants.mjs).

usage: python3 -I build_meta.py <refs_dir> <data_dir>
Must run after extract_fpc.py and extract_board.py (it reads their JSON so every
geometric fact in sources.json is the extracted number, not a retyped one).
"""
import json
import os
import re
import sys

CONFIRMED = 'user-confirmed 2026-10-21'
GUIDE = 'material/FlexiTac Hardware Guide.docx'
PAPER = 'material/2604.28156v1.pdf'
SCH = 'material/tactile_reading_board_32x16.pdf'
PNP = 'material/PickAndPlace_PCB_05mm_FFC_16_32_1mux_4sr_2025-11-01.csv'
BOM = 'material/BOM_05mm_FFC_16_32_1mux_4sr_2025-11-01.csv'
FW16 = 'refs/fw/32_16_fast.ino (github.com/FlexiTac/FlexiTac_Hardware_Repo)'
FW12 = 'refs/fw/pyflexitac/template.ino (github.com/WT-MM/PyFlexiTac @e006b17, flexitac-flash defaults rows=12 mux-offset=4)'
HOST = 'refs/fw/fast_32_16.py (github.com/FlexiTac/FlexiTac_Hardware_Repo)'
PYFT = 'refs/fw/pyflexitac/sensor.py (github.com/WT-MM/PyFlexiTac @e006b17)'


def defines(path):
    txt = open(path).read()
    return {m.group(1): m.group(2).strip() for m in re.finditer(r'^#define\s+(\w+)\s+(\S+)', txt, re.M)}, txt


def pyconst(path):
    txt = open(path).read()
    out = {}
    for m in re.finditer(r'^(\w+)\s*=\s*([^#\n]+)', txt, re.M):
        out[m.group(1)] = m.group(2).strip()
    return out, txt


def main():
    refs, data = sys.argv[1], sys.argv[2]
    top = json.load(open(os.path.join(data, 'fpc_top.json')))
    bot = json.load(open(os.path.join(data, 'fpc_bot.json')))
    board = json.load(open(os.path.join(data, 'board.json')))

    # ------------------------------------------------------------ firmware ----
    d16, t16 = defines(os.path.join(refs, 'fw/32_16_fast.ino'))
    d12, t12 = defines(os.path.join(refs, 'fw/pyflexitac/template.ino'))
    hp, ht = pyconst(os.path.join(refs, 'fw/fast_32_16.py'))
    alpha = float(re.search(r'def temporal_filter\(new_frame, prev_frame, alpha=([\d.]+)\)', ht).group(1))
    assert 'sbi(ADCSRA' in t16 and re.search(r'sbi\(ADCSRA,\s*ADPS2\)', t16) and re.search(r'cbi\(ADCSRA,\s*ADPS1\)', t16) and re.search(r'cbi\(ADCSRA,\s*ADPS0\)', t16)
    assert 'raw_reading >> 2' in t16 and 'raw_reading >> 2' in t12
    assert 'row_number + MUX_CHANNEL_OFFSET' in t12
    fw = {
        'id': 'firmware',
        'default': 'pyflexitac12',
        'variants': {
            'pyflexitac12': {'rows': int(d12['ROW_COUNT']), 'cols': int(d12['COLUMN_COUNT']), 'muxOffset': int(d12['MUX_CHANNEL_OFFSET']),
                             'baud': int(d12['BAUD_RATE']), 'header': [int(d12['START_MARKER_0'], 16), int(d12['START_MARKER_1'], 16)],
                             'frameBytes': 2 + int(d12['ROW_COUNT']) * int(d12['COLUMN_COUNT']), 'src': FW12},
            'repo16': {'rows': int(d16['ROW_COUNT']), 'cols': int(d16['COLUMN_COUNT']), 'muxOffset': 0,
                       'baud': int(d16['BAUD_RATE']), 'header': [0xAA, 0x55],
                       'frameBytes': 2 + int(d16['ROW_COUNT']) * int(d16['COLUMN_COUNT']), 'src': FW16},
        },
        'pins': {'SER': int(d16['PIN_SHIFT_REGISTER_DATA']), 'CLK': int(d16['PIN_SHIFT_REGISTER_CLOCK']),
                 'S0': int(d16['PIN_MUX_CHANNEL_0']), 'S1': int(d16['PIN_MUX_CHANNEL_1']), 'S2': int(d16['PIN_MUX_CHANNEL_2']),
                 'S3': int(d16['PIN_MUX_CHANNEL_3']), 'E0': int(d16['PIN_MUX_INHIBIT_0']), 'E1_unused': int(d16['PIN_MUX_INHIBIT_1']), 'ADC': 'A0'},
        'rowsPerMux': int(d16['ROWS_PER_MUX']), 'muxCount': int(d16['MUX_COUNT']),
        'adc': {'bits': 10, 'prescaler': 16, 'clockHz': 16e6 / 16, 'sentAs': 'raw >> 2 (8 bit)'},
        'naming': 'firmware "row" = mux channel = sense line (Top FPC); firmware "column" = shift-register output = drive line (Bottom FPC)',
        'host': {'initFrames': int(hp['INIT_FRAMES']), 'threshold': float(hp['THRESHOLD']), 'noiseScale': float(hp['NOISE_SCALE']),
                 'clip': [0, 100], 'alpha': alpha, 'colormap': 'cv2.COLORMAP_VIRIDIS', 'cellPx': 30, 'src': HOST,
                 'pyflexitac': {'threshold': 25.0, 'noiseScale': 30.0, 'clip01': True, 'src': PYFT}},
    }
    # frame row/col -> physical electrode (FFC orientation is NOT documented -> inferred, straight-through assumption)
    v = fw['variants']['pyflexitac12']
    top_net_x = {e['net']: e['cx'] for e in top['electrodes']['rects']}
    bot_net_y = {e['net']: e['cy'] for e in bot['electrodes']['rects']}
    fw['taxelMap'] = {
        'inferred': True,
        'note': ('Frame row r is read on mux channel r+%d = net SR(r+%d) = FPC1 pin r+%d (firmware + schematic, certain). '
                 'Which Top-FPC finger lands on which FPC1 pin depends on the FFC cable/extender orientation, which the materials do not document; '
                 'assumed straight-through: Top finger NETk -> FPC1 pin k+%d, Bottom finger NETk -> FPC2 pin k. Mirror the axes if hardware shows otherwise.')
                % (v['muxOffset'], v['muxOffset'] + 1, v['muxOffset'] + 1, v['muxOffset']),
        'rows': [{'row': i, 'muxCh': i + v['muxOffset'], 'sr': 'SR%d' % (i + v['muxOffset'] + 1), 'fpc1Pin': i + v['muxOffset'] + 1,
                  'topNet': 'NET%d' % (i + 1), 'x': top_net_x['NET%d' % (i + 1)]} for i in range(v['rows'])],
        'cols': [{'col': j, 'sc': 'SC%d' % (j + 1), 'fpc2Pin': j + 1, 'botNet': 'NET%d' % (j + 1), 'y': bot_net_y['NET%d' % (j + 1)]}
                 for j in range(v['cols'])],
    }
    json.dump(fw, open(os.path.join(data, 'firmware.json'), 'w'), indent=1)

    # ------------------------------------------------------------ stack ----
    st_top = sorted({s['thickness'] for s in top['stiffeners']})
    stack = {
        'id': 'stack',
        'order': 'top -> bottom (as built; the "top" is the Top-FPC side)',
        'units': 'mm',
        'totalThickness': {'value': 1.0, 'relation': '<', 'unit': 'mm', 'src': PAPER + ' Sec 2.1 "total thickness < 1 mm"', 'inferred': False},
        'layers': [
            {'id': 'pi_top', 'name': 'Polyimide tape seal (top)', 'material': 'polyimide (Kapton-type) adhesive tape', 'thickness': None,
             'coverage': 'border strips only (seals the edges)', 'note': 'thickness not given in the materials',
             'src': GUIDE + ' Step 3 "Seal Edges with Polyimide"; BOM item 2'},
            {'id': 'lam_top', 'name': 'Laminating sheet (top)', 'material': 'adhesive laminating sheet', 'thickness': None,
             'note': 'thickness not given in the materials', 'src': GUIDE + ' Step 1; BOM item 4; ' + PAPER + ' Fig 3a'},
            {'id': 'fpc_top', 'name': 'Top FPC (sense lines)', 'material': 'polyimide flex, 1 oz Cu, ENIG', 'thickness': 0.2,
             'orientation': 'mounted face-down: copper electrodes touch the Velostat (inferred)', 'inferredOrientation': True,
             'stiffeners': {'thicknesses': st_top, 'side': 'non-copper side -> faces outward (up) when mounted face-down', 'src': 'material/Gerber_Top_FPC_2026-03-02.zip:*.GBSL + jlcpcb.json'},
             'src': GUIDE + ' FPC Manufacturing Guide Step 1 "0.2mm"; ' + PAPER + ' (Top FPC 0.2 mm)'},
            {'id': 'velostat', 'name': 'Velostat / Linqstat (Adafruit 1361)', 'material': 'carbon-loaded polyolefin film (piezoresistive)', 'thickness': 0.1,
             'volumeResistivity': {'value': 500, 'relation': '<', 'unit': 'ohm*cm'},
             'surfaceResistivity': {'value': 31000, 'relation': '<', 'unit': 'ohm/sq*cm'},
             'behaviour': 'pressing lowers its resistance (no force characterization in the materials)',
             'src': CONFIRMED + ' (Adafruit 1361: 4 mil); ' + GUIDE + ' BOM item 3'},
            {'id': 'fpc_bot', 'name': 'Bottom FPC (drive lines)', 'material': 'polyimide flex, 1 oz Cu, ENIG', 'thickness': 0.2,
             'orientation': 'face-up: copper electrodes touch the Velostat', 'inferredOrientation': True,
             'stiffeners': {'thicknesses': sorted({s['thickness'] for s in bot['stiffeners']}), 'side': 'non-copper side -> faces outward (down)', 'src': 'material/Gerber_Bottom_FPC_2026-03-02.zip:*.GBSL + jlcpcb.json'},
             'src': GUIDE + ' FPC Manufacturing Guide Step 1-3 "0.2mm"'},
            {'id': 'lam_bot', 'name': 'Laminating sheet (bottom)', 'material': 'adhesive laminating sheet', 'thickness': None,
             'note': 'thickness not given in the materials', 'src': GUIDE + ' Step 1; ' + PAPER + ' Fig 3a'},
            {'id': 'pi_bot', 'name': 'Polyimide tape seal (bottom)', 'material': 'polyimide adhesive tape', 'thickness': None,
             'coverage': 'border strips only', 'note': 'thickness not given in the materials', 'src': GUIDE + ' Step 3'},
        ],
        'fpcBuild': {'dielectric_um': 25, 'coverlay': 'PI 25 um / adhesive 25 um', 'copper': '1 oz', 'finish': 'ENIG 1 u"',
                     'goldFingerThickness': 0.3, 'src': GUIDE + ' JLC order screenshots (image10/11), via refs/dossier.json'},
        'note': 'Display drawings exaggerate thickness; label it (e.g. "thickness x20").',
    }
    json.dump(stack, open(os.path.join(data, 'stack.json'), 'w'), indent=1)

    # ------------------------------------------------------------ sources ----
    F = {}

    def fact(key, value, unit, src, inferred=False, note=None):
        F[key] = {'value': value, 'unit': unit, 'src': src, 'inferred': inferred}
        if note:
            F[key]['note'] = note

    tz, bz = 'material/Gerber_Top_FPC_2026-03-02.zip', 'material/Gerber_Bottom_FPC_2026-03-02.zip'
    # confirmed decisions
    fact('board.R1', 10000, 'ohm', CONFIRMED + '; BOM MPN 1206W4F1002T5E', note='schematic/PnP "20k" label is a documentation error')
    fact('sensor.rows', 12, 'sense lines', CONFIRMED + '; PyFlexiTac defaults', note='12 sense lines on the Top FPC -> mux channels 4-15')
    fact('sensor.cols', 32, 'drive lines', CONFIRMED, note='32 drive lines on the Bottom FPC <- 4x SN74HC595')
    fact('sensor.taxels', 384, 'taxels', CONFIRMED + ' (12 x 32)')
    fact('sensor.muxChannels', [4, 15], 'channel range', CONFIRMED + '; ' + FW12, note='channels 0-3 unused on the 12x32 sensor')
    fact('firmware.default', 'PyFlexiTac 12-row (mux offset 4)', None, CONFIRMED)
    fact('firmware.frameBytes', fw['variants']['pyflexitac12']['frameBytes'], 'bytes', CONFIRMED + '; ' + FW12, note='AA 55 + 384')
    fact('system.frameRate', 100, 'Hz', CONFIRMED + '; ' + PAPER)
    fact('build.time', 3, 'min', CONFIRMED + '; ' + GUIDE + ' "< 3 mins"', note='approximately')
    fact('velostat.thickness', 0.1, 'mm', CONFIRMED + ' (Adafruit 1361, 4 mil)')
    fact('velostat.volumeResistivity', '<500', 'ohm*cm', CONFIRMED + ' (Adafruit 1361)')
    fact('velostat.surfaceResistivity', '<31000', 'ohm/sq*cm', CONFIRMED + ' (Adafruit 1361)')
    fact('velostat.behaviour', 'pressing lowers resistance', None, CONFIRMED)
    fact('characterization', None, None, CONFIRMED, note='no force/characterization data exists: any press->resistance curve is ILLUSTRATIVE; never show newtons')
    fact('naming', 'drive lines (32, shift registers, Bottom FPC) / sense lines (12, mux, Top FPC)', None, CONFIRMED,
         note='firmware calls mux channels "rows" and shift-register lines "columns"')
    fact('audience', 'undergraduate STEM and high-school students', None, CONFIRMED)
    # pad geometry
    for k, o, z in (('fpc_top', top, tz), ('fpc_bot', bot, bz)):
        g = z + ':Gerber_TopLayer.GTL'
        fact(k + '.electrodes.count', o['electrodes']['count'], None, g)
        fact(k + '.electrodes.width', o['electrodes']['width'], 'mm', g)
        fact(k + '.electrodes.length', o['electrodes']['length'], 'mm', g)
        fact(k + '.electrodes.pitch', round(o['electrodes']['pitch'], 4), 'mm', g)
        fact(k + '.slots.count', o['slots']['count'], None, z + ':Gerber_BoardOutlineLayer.GKO')
        fact(k + '.slots.size', [round(o['slots']['width'], 4), round(o['slots']['length'], 4)], 'mm', z + ':Gerber_BoardOutlineLayer.GKO')
        fact(k + '.fingers.count', o['fingers']['count'], None, g)
        fact(k + '.fingers.size', [round(o['fingers']['width'], 3), round(o['fingers']['length'], 3)], 'mm', g)
        fact(k + '.fingers.pitch', round(o['fingers']['pitch'], 3), 'mm', g)
        fact(k + '.outline.bbox', [round(v, 3) for v in o['outline']['size']], 'mm', z + ':Gerber_BoardOutlineLayer.GKO')
        fact(k + '.thickness', 0.2, 'mm', GUIDE + ' (JLC "0.2mm")')
        fact(k + '.stiffeners', sorted({s['thickness'] for s in o['stiffeners']}), 'mm', z + ':Gerber_BottomStiffenerLayer_pib_*.GBSL')
        fact(k + '.copperSide', 'top layer only', None, z + ':GTL/GBL (GBL empty)')
        fact(k + '.traceWidth', o['fanout']['traceWidth'], 'mm', g)
    fact('fpc_top.bridge.width', round(top['bridge']['width'], 4), 'mm', tz + ':Gerber_BoardOutlineLayer.GKO', note='supporting beam, ' + PAPER + ' Fig 3b callout B')
    fact('fpc_top.mounting', 'face-down (copper towards the Velostat)', None, 'Gerber copper side + guide image7(b)', inferred=True)
    fact('pad.activeArea', [24, 64], 'mm', GUIDE + ' image7(b) "24 mm x 64 mm"; computed from electrode pitch')
    fact('pad.crossing', [top['electrodes']['width'], bot['electrodes']['width']], 'mm', 'computed from GTL electrode widths', inferred=True,
         note='copper overlap of one crossing')
    fact('pad.thickness', '<1', 'mm', PAPER)
    fact('pad.layers', [l['name'] for l in stack['layers']], None, PAPER + ' Fig 3a; ' + GUIDE + ' Steps 1-3')
    for l in stack['layers']:
        if l['thickness'] is None:
            fact('stack.%s.thickness' % l['id'], None, 'mm', l['src'], note='not given in the materials')
    # board
    fact('board.size', [round(v, 3) for v in board['outline']['size']], 'mm', 'material/Gerber_16_32.zip:Gerber_BoardOutlineLayer.GKO', note='paper: 56.8 x 39.9 mm')
    fact('board.vias', board['vias']['count'], None, 'material/Gerber_16_32.zip:Drill_PTH_Through_Via.DRL')
    fact('board.viaDrill', board['vias']['drill'], 'mm', 'material/Gerber_16_32.zip:Drill_PTH_Through_Via.DRL')
    fact('board.headerHoles', board['header']['count'], None, 'material/Gerber_16_32.zip:Drill_PTH_Through.DRL')
    fact('board.headerDrill', board['header']['drill'], 'mm', 'material/Gerber_16_32.zip:Drill_PTH_Through.DRL')
    fact('board.mountingHoles', 0, None, 'material/Gerber_16_32.zip drill files')
    fact('board.copperLayers', 2, None, 'material/Gerber_16_32.zip (GTL + GBL)')
    for c in board['components']:
        fact('board.part.%s' % c['designator'], {'mpn': c['mpn'], 'footprint': c['footprint'], 'x': c['x'], 'y': c['y'], 'rotation': c['rotation']},
             'mm/deg', PNP + ' + ' + BOM)
    fact('board.R_on', 70, 'ohm', 'CD74HC4067 typical on-resistance at 4.5 V (LCSC C496123 description / TI datasheet; external)', note='approximate')
    fact('board.595chain', 'D2 -> U2.SER; U2.QH\' -> U3.SER -> U4 -> U5; U5.QH\' n.c.', None, SCH + ' + Gerber copper trace')
    fact('board.clockTie', 'D3 -> SRCLK + RCLK of all 595s', None, SCH + ' + Gerber copper trace',
         note='tied clocks -> output latch runs one clock behind the shift stage')
    fact('board.OE', '#OE -> GND (outputs always driven, unselected drive lines held LOW)', None, SCH + ' + Gerber copper trace')
    fact('board.muxSelect', 'D4..D7 = S0..S3, D8 = #E', None, SCH + ' + Gerber copper trace')
    fact('board.A0', 'A0 = mux COM; R1 from A0 to GND', None, SCH + ' + Gerber copper trace')
    fact('board.FPC1', 'SR1..SR16 -> mux I0..I15 (pin k = channel k-1)', None, SCH + ' + Gerber copper trace')
    fact('board.FPC2', 'SC1..SC32 <- U2.QA..U5.QH', None, SCH + ' + Gerber copper trace')
    fact('board.D9', 'firmware PIN_MUX_INHIBIT_1, not connected on this board', None, FW16 + ' + ' + SCH)
    # firmware / host
    fact('firmware.baud', fw['variants']['pyflexitac12']['baud'], 'baud', FW12 + '; ' + FW16)
    fact('firmware.header', 'AA 55', 'hex', FW12)
    fact('firmware.adcPrescaler', 16, None, FW16 + ' (ADPS2=1, ADPS1=0, ADPS0=0)', note='1 MHz ADC clock at 16 MHz')
    fact('firmware.adcToByte', 'raw >> 2', None, FW16)
    fact('firmware.scanStart', 'shiftColumn(true); shiftColumn(false) before the first read of each row', None, FW12)
    fact('firmware.enablePulse', 'setRow(0): E# HIGH then LOW once per frame', None, FW12)
    fact('firmware.repo16.frameBytes', fw['variants']['repo16']['frameBytes'], 'bytes', FW16, note='16 x 32 build, not the default')
    fact('host.initFrames', fw['host']['initFrames'], 'frames', HOST)
    fact('host.threshold', fw['host']['threshold'], 'counts', HOST)
    fact('host.noiseScale', fw['host']['noiseScale'], 'counts', HOST)
    fact('host.alpha', fw['host']['alpha'], None, HOST)
    fact('host.colormap', 'VIRIDIS', None, HOST)
    fact('host.restingBytes', [10, 40], 'byte', PYFT + ' docstring "Typical resting ADC values land around 10-40"', note='used to anchor the illustrative taxel curve')
    # cost
    fact('cost.unit', 30, 'USD', PAPER, note='approximately')
    fact('cost.fpcPair', 2.5, 'USD', GUIDE + ' BOM')
    fact('cost.nano', 25.10, 'USD', GUIDE + ' BOM')

    sources = {'id': 'sources', 'generated': 'by shared/extract/run_all.sh', 'confirmedOn': '2026-10-21',
               'schema': '{value, unit, src, inferred, note?}', 'facts': F}
    json.dump(sources, open(os.path.join(data, 'sources.json'), 'w'), indent=1, ensure_ascii=False)

    # ------------------------------------------------------------ ESM wrappers ----
    names = {'fpc_top': 'fpcTop', 'fpc_bot': 'fpcBot', 'board': 'board', 'stack': 'stack', 'sources': 'sources', 'firmware': 'firmware'}
    lines = ['// GENERATED by shared/extract/build_meta.py - do not edit. Same content as the *.json files.']
    for f, n in names.items():
        lines.append('export const %s = %s;' % (n, json.dumps(json.load(open(os.path.join(data, f + '.json'))), separators=(',', ':'), ensure_ascii=False)))
    lines.append('export default { %s };' % ', '.join(names.values()))
    open(os.path.join(data, 'index.mjs'), 'w').write('\n'.join(lines) + '\n')

    v12 = fw['variants']['pyflexitac12']
    consts = {
        'ROWS': v12['rows'], 'COLS': v12['cols'], 'MUX_OFFSET': v12['muxOffset'], 'FRAME_BYTES': v12['frameBytes'],
        'HEADER': v12['header'], 'BAUD': v12['baud'], 'FRAME_HZ': 100,
        'R1': 10000, 'R_ON': 70, 'VCC': 5.0, 'ADC_BITS': 10,
        'INIT_FRAMES': fw['host']['initFrames'], 'THRESHOLD': fw['host']['threshold'], 'NOISE_SCALE': fw['host']['noiseScale'],
        'ALPHA': fw['host']['alpha'],
        'PITCH': round(top['electrodes']['pitch'], 4),
        'ROW_X': [r_['x'] for r_ in fw['taxelMap']['rows']], 'COL_Y': [c_['y'] for c_ in fw['taxelMap']['cols']],  # inferred cable orientation
    }
    c = ['// GENERATED by shared/extract/build_meta.py - do not edit. Small constants for the models (no JSON import needed).']
    for k, v in consts.items():
        c.append('export const %s = %s;' % (k, json.dumps(v)))
    open(os.path.join(data, 'constants.mjs'), 'w').write('\n'.join(c) + '\n')
    print('meta: %d facts, stack %d layers, firmware default %s (%d B frames)' % (len(F), len(stack['layers']), fw['default'], v12['frameBytes']))


if __name__ == '__main__':
    main()
