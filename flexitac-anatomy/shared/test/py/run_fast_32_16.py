"""Run the ORIGINAL fast_32_16.py processing on a synthetic serial stream.

usage: python -I run_fast_32_16.py <fast_32_16.py> <input.json> <output.json>

The script is executed unmodified with stub `serial`, `threading`, `scipy` and a
GUI-less `cv2` wrapper (real cv2.applyColorMap if OpenCV is importable), then its
own readThread() is driven with a fake serial device that serves the chunks from
input.json one read() at a time. After each read() the global contact_data_norm
is captured; the display loop body (temporal_filter -> clip*255 -> uint8 ->
applyColorMap) is then replayed once per captured frame with the script's own
temporal_filter.
input.json: {"rows": R, "cols": C, "chunks": [[byte,...], ...]}
"""
import io
import json
import sys
import types
import contextlib

import numpy as np

src_path, in_path, out_path = sys.argv[1], sys.argv[2], sys.argv[3]
spec = json.load(open(in_path))


class EndOfData(Exception):
    pass


class FakeSerial:
    def __init__(self, *a, **k):
        self.chunks = [bytes(c) for c in spec['chunks']]
        self.timeout = None
        self.on_read = None

    def flush(self):
        pass

    def reset_input_buffer(self):
        pass

    def read(self, n):
        if self.on_read:
            self.on_read()
        if not self.chunks:
            raise EndOfData()
        c = self.chunks.pop(0)
        if len(c) > n:
            self.chunks.insert(0, c[n:])
            c = c[:n]
        return c

    def readinto(self, mv):
        got = 0
        while got < len(mv) and self.chunks:
            c = self.chunks.pop(0)
            take = min(len(c), len(mv) - got)
            mv[got:got + take] = c[:take]
            if take < len(c):
                self.chunks.insert(0, c[take:])
            got += take
        return got


serial_mod = types.ModuleType('serial'); serial_mod.Serial = FakeSerial
threading_mod = types.ModuleType('threading')


class FakeThread:
    def __init__(self, target=None, args=()):
        self.daemon = False

    def start(self):
        pass


threading_mod.Thread = FakeThread
scipy_mod = types.ModuleType('scipy'); nd = types.ModuleType('scipy.ndimage'); nd.gaussian_filter = lambda *a, **k: None; scipy_mod.ndimage = nd
try:
    import cv2 as real_cv2
    have_cv2 = True
except Exception:
    real_cv2 = None
    have_cv2 = False
cv2_mod = types.ModuleType('cv2')
cv2_mod.WINDOW_NORMAL = 0
cv2_mod.COLORMAP_VIRIDIS = getattr(real_cv2, 'COLORMAP_VIRIDIS', 16)
for fn in ('namedWindow', 'resizeWindow', 'imshow'):
    setattr(cv2_mod, fn, lambda *a, **k: None)
cv2_mod.waitKey = lambda *a, **k: -1
cv2_mod.applyColorMap = (real_cv2.applyColorMap if have_cv2 else (lambda a, m: None))
sys.modules.update({'serial': serial_mod, 'threading': threading_mod, 'scipy': scipy_mod, 'scipy.ndimage': nd, 'cv2': cv2_mod})

g = {'__name__': 'fast_32_16_under_test', '__file__': src_path}
code = compile(open(src_path).read(), src_path, 'exec')
exec(code, g)

# switch geometry (the original is 16x32; the 12-row firmware streams 12x32)
g['ROWS'], g['COLS'] = spec['rows'], spec['cols']
g['FRAME_BYTES'] = spec['rows'] * spec['cols']

dev = FakeSerial()
captured = []
last = {'obj': g['contact_data_norm']}  # keep a reference: no id() reuse


def on_read():
    cur = g['contact_data_norm']
    if g['flag'] and cur is not last['obj']:
        captured.append(np.array(cur).copy())
        last['obj'] = cur


dev.on_read = on_read
with contextlib.redirect_stdout(io.StringIO()):
    try:
        g['readThread'](dev)
    except EndOfData:
        pass

prev = np.zeros((spec['rows'], spec['cols']), dtype=np.float32)
filtered, u8s, rgbs = [], [], []
for norm in captured:
    t = g['temporal_filter'](norm, prev, alpha=0.2)
    prev = t
    sc = np.clip(t * 255.0, 0, 255).astype(np.uint8)
    filtered.append(t.astype(np.float32).ravel().tolist())
    u8s.append(sc.ravel().tolist())
    if have_cv2:
        cm = cv2_mod.applyColorMap(sc, cv2_mod.COLORMAP_VIRIDIS)  # BGR
        rgbs.append(cm[..., ::-1].reshape(-1).tolist())

json.dump({'numpy': np.__version__, 'cv2': getattr(real_cv2, '__version__', None),
           'norms': [n.ravel().astype(float).tolist() for n in captured],
           'normDtype': str(captured[0].dtype) if captured else None,
           'filtered': filtered, 'u8': u8s, 'rgb': rgbs}, open(out_path, 'w'))
