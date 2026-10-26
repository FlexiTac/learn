# shared/: the single source of truth

Every figure, the video and the Learn FlexiTac site import their numbers and behaviour from here. Nothing in this folder touches the DOM.

```
shared/
  data/        generated - never edit by hand
    fpc_top.json  fpc_bot.json          pad geometry from the FPC Gerbers
    fpc_top_silk.json  fpc_bot_silk.json silkscreen glyph outlines (optional detail)
    board.json                          reading board 32x16 v-1.0 (Gerber + PnP + BOM + schematic nets)
    stack.json                          pad layer stack, top -> bottom
    firmware.json                       firmware/host constants parsed from the sketches + frame->electrode map
    sources.json                        every fact as {value, unit, src, inferred, note?}
    index.mjs                           ESM: export const fpcTop, fpcBot, board, stack, sources, firmware
    constants.mjs                       ESM: small constants used by the models
  extract/     generators (Python 3, stdlib only, run with -I)
    run_all.sh  gerber.py  extract_fpc.py  extract_board.py  build_meta.py  gen_viridis.py
    work/       unzipped Gerbers (git-ignored)
  models/      pure ESM models: divider, adc, taxel, scan, host (+ viridis LUT, index barrel)
  test/        node:test suites + the Python harness for fast_32_16.py
```

## Regenerate and test

```bash
export PATH=$HOME/miniforge3/envs/anatomy/bin:$PATH     # node 22
cd /home/binghao/learn_flexitac/flexitac-anatomy/shared
bash extract/run_all.sh        # unzips /material/*.zip -> extract/work, writes data/*
npm test                       # = node --test test/*.test.mjs   (20 tests)
```

- `run_all.sh` only **reads** `/home/binghao/learn_flexitac/material` and `../refs`, and only writes inside `shared/`.
- The host comparison test runs the original `refs/fw/fast_32_16.py` with numpy and OpenCV. The test looks for Python in this order:
  1. `$FLEXITAC_PY`;
  2. `../.venv-py/bin/python` (a venv with `numpy` and `opencv-python-headless`, git-ignored);
  3. `python3`.

  If none of them has numpy, the test is skipped and says why.
- `gen_viridis.py` needs OpenCV. It runs only when that venv exists; otherwise the checked-in `models/viridis.mjs` is kept.

### Inputs

| Input | Used for |
|---|---|
| `material/Gerber_Top_FPC_2026-03-02.zip`, `Gerber_Bottom_FPC_2026-03-02.zip` | outline (GKO), slots (GKO "Rect"), electrodes, fingers and traces (GTL), mask (GTS), stiffeners (GBSL 0.1/0.2), silk (GTO), nets (`FlyingProbeTesting.json`) |
| `material/Gerber_16_32.zip` | board outline, vias and header drills, pads and copper connectivity, silk/doc outlines (Nano, USB) |
| `material/PickAndPlace_…csv`, `material/BOM_…csv` (UTF-16) | designators, positions, rotations, pin 1, MPN, LCSC numbers |
| `material/tactile_reading_board_32x16.pdf` (via `refs/elec/sch.txt`) | net names (cited; each one is confirmed against the copper) |
| `refs/fw/32_16_fast.ino`, `refs/fw/fast_32_16.py` | the hardware repo's firmware and host viewer |
| `refs/fw/pyflexitac/template.ino`, `sensor.py` | PyFlexiTac firmware, the default. Fetched from github.com/WT-MM/PyFlexiTac @ e006b17; see `SOURCE.txt` |

## Coordinate frames (all lengths in mm)

**FPC frame** (`fpc_top.json`, `fpc_bot.json`, and the silk files):
- This is each FPC's own Gerber frame, seen from the copper (top) side. x points right and y points up.
- The origin (0,0) is the centre of the electrode array, which is also the centre of the 24 x 64 mm active area. EasyEDA placed the electrode footprint at 0,0 in both designs, so **both FPCs share this origin**.
- Top FPC:
  - 12 vertical electrodes at x = -11 … +11, each 0.6 x 63.0 mm;
  - 22 slots, 1.0 x 31.0 mm;
  - a 0.872 mm uncut centre strip, which is the supporting beam (`bridge`, at y ≈ 0);
  - its tail runs along y ≈ -37 towards -x, and the 12 fingers sit at x ≈ -69 … -63.7, y ≈ -41.9.
- Bottom FPC:
  - 32 horizontal electrodes at y = -31 … +31, each 23.0 x 0.6 mm;
  - 31 slots, 23.0 x 1.0 mm, with no beam;
  - an A-shaped tail towards +x around one window, with the 32 fingers at x = 54 … 69.5, y ≈ -32.
- A taxel is the crossing `(activeArea.taxels.senseX[i], driveY[j])`. The copper overlap of one crossing is 0.6 x 0.6 mm (*inferred*).
- **Assembled pad frame (*inferred*).** Use the Top FPC as-is and the Bottom FPC mirrored `x → -x` (`assembly.padFrameTransform`). That reproduces the guide photo (image7b): both tails leave on the same side, and the Top FPC's tail runs along the bottom edge. The Top FPC is mounted face-down, so its copper touches the Velostat and its stiffeners face outward.
- `electrodes.rects[k].net` and `fingers.rects[k].net` (NET1…) come from `FlyingProbeTesting.json`. Top NET1 is the electrode at x = +11. Bottom NET1 is the electrode at y = -31. `fingers.rects[k].index` is the net number, **not** a connector pin.

**Board frame** (`board.json`):
- These are the EasyEDA board coordinates that the Gerbers and the PnP share. x points right and y points up, seen from the component side. Rotation is in degrees counter-clockwise, as in the PnP.
- Outline: x 7.000 … 63.754, y 96.139 … 135.999 (56.754 x 39.860 mm).
- For board-local coordinates use `x - origin.x, y - origin.y`, where `origin` is the outline's lower-left corner.
- The FFC connectors sit along the top edge (y ≈ 130–135). The Nano covers the left side, and its USB overhangs the bottom edge (`header.usbOutline`).

**Taxel and frame indices** (`firmware.json.taxelMap`, `constants.mjs` `ROW_X`, `COL_Y`):
- These facts are certain (firmware + schematic + copper):
  - frame row `r` = mux channel `r+4` = net `SR(r+5)` = FPC1 pin `r+5` = sense line;
  - frame column `c` = net `SC(c+1)` = FPC2 pin `c+1` = `U(2+⌊c/8⌋).Q[A..H]` = drive line.
- Which physical electrode lands on which connector pin depends on how the FFC and extender are oriented, and the materials do not document that. The map therefore assumes the cable goes straight through: Top NETk → FPC1 pin k+4, and Bottom NETk → FPC2 pin k. `inferred: true`. If the hardware shows otherwise, flip the axis.

## Data files (key fields)

- **fpc_top / fpc_bot**
  - `outline {pts (CCW), bbox, size, area}` and `windows[]`
  - `electrodes {count, width, length, pitch, axis, positions[], rects[{x0,y0,x1,y1,cx,cy,w,h,net}]}`
  - `slots {count, width, length, rects[]}` and `bridge {y0,y1,width,x0,x1}` (Top only)
  - `fingers {count, width, length, pitch, rects[{…, net, index}]}`
  - `fanout {traceWidth, traces[{net, width, length, pts (electrode → finger, simplified to 0.01 mm)}]}`
  - `maskOpenings`
  - `stiffeners[{thickness 0.1|0.2, pts, bbox, side}]`
  - `activeArea {cellGrid 24x64, electrodeOverlap, nominal, taxels}`
  - `assembly` (*inferred*) and `thickness`
- **board**
  - `outline`
  - `components[]`, each with:
    - `designator, footprint, comment, layer, x, y, rotation, pin1`;
    - `mpn, manufacturer, lcsc`;
    - `package {body [L,W], leadSpan, pitch, height, heightNote}`;
    - `pins[{pin, fn, x, y, padW, padH}]`, every one snapped to a real Gerber pad (error ≤ 0.013 mm);
    - `tabs`, `padBBox`, `silkBBox`.
  - R1 carries `value` = 10000 Ω (user-confirmed) and `marking` "1002".
  - `connectors.FPC1/FPC2 {pin1, pinStep, pinsNN[]}`
  - `vias {count 39, drill 0.305, positions}`
  - `header {30 holes, 0.901 drill, 2.54 pitch, rows at x 8.509 / 23.749, pins[{pin, name, x, y, square}], nanoOutline, usbOutline}`
  - `nets[]`, each `{name, nodes, role, src, copperVerified, tracks {top[], bottom[]}, vias, allTracedPins}`. The nets are:
    - `D2_SER`, `D3_CLK` (SRCLK + RCLK of all four 595s), `D4_S0` … `D7_S3`, `D8_E`;
    - `A0_COM` (A0, mux COM and R1 pad 2) and `GND` (includes R1 pad 1 and every 595 `#OE`);
    - `VCC` (includes every `#SRCLR`);
    - `CHAIN_U2_U3`, `CHAIN_U3_U4`, `CHAIN_U4_U5` (QH' → SER) and `U5_QH'` (not connected);
    - `SC1` … `SC32` (595 → FPC2) and `SR1` … `SR16` (FPC1 → mux I0 … I15).
  - `netsCopperCheck`: all 62 nets are confirmed by union-find over the tracks, pads, vias and header holes (pours ignored).
  - Package heights and FFC connector bodies are not in the materials, so they are marked inferred.
- **stack**
  - `layers[]` run top → bottom. Each has `{id, name, material, thickness | null, note, src}`. The layers are: PI tape, laminating sheet, Top FPC 0.2, Velostat 0.1, Bottom FPC 0.2, laminating sheet, PI tape.
  - `totalThickness` < 1 mm [paper].
- **firmware**
  - `variants.pyflexitac12` (default: 12 x 32, mux offset 4, 386 B frames) and `variants.repo16` (16 x 32, 514 B);
  - pin map, ADC settings, `host` constants, `taxelMap`.
- **sources**
  - `facts[key] = {value, unit, src, inferred, note?}` for 94 facts.
  - The confirmed decisions carry `src: "user-confirmed 2026-10-21"`.

## Models API (`models/*.mjs`, pure ESM, deterministic)

```js
import { vA0, current, rTaxelFromV, divider, R1, R_ON, VCC, FIRST_ORDER, NOTE } from './models/divider.mjs';
// V_A0 = 5·R1/(R1 + R_taxel + R_on). R1 is fixed at 10 kΩ (no toggle). R_on = 70 Ω. FIRST_ORDER = true.
// divider(48e3) -> {vA0: 0.86103, current: 8.61e-5, vTaxel, vOn, ...}

import { adcCode, toByte, voltsToByte, codeToVolts, byteToVolts, ADC_CLOCK_HZ, CONVERSION_S } from './models/adc.mjs';
// adcCode(v) = clamp(floor(v·1024/5), 0, 1023);  toByte(code) = code >> 2
// 48 kΩ -> 0.861 V -> ADC 176 -> byte 44   (asserted in test/models.test.mjs)

import { rTaxel, pressFromR, squash, ILLUSTRATIVE, LABEL, R_REST, R_HARD, R_STOPS } from './models/taxel.mjs';
// ILLUSTRATIVE === true. press is unitless 0..1. Never show newtons.
// R(p) = R_REST·(R_HARD/R_REST)^(1-(1-p)^2): 200 kΩ (rest, byte 12) -> 1.4 kΩ (hard, byte 223)

import { createScanner, microSteps, frameBytes, createPlayer, frameTiming,
         byteIndex, rowColOfByte, driveLineInfo, muxChannelInfo, frameSize, VARIANTS } from './models/scan.mjs';
// createScanner({variant: 'pyflexitac12' | 'repo16', input}).next() -> one micro-step:
//   {seq, frame, phase, clock, totalClocks, ser, eN, enabled, muxCh, selectBits, senseLine, senseNet,
//    driveLine, highCount, latchQ[32], srQ[32], row, col, byteIndex, byte, code, fw}
//   phase order per frame:
//     header x2
//     enableHigh, enableLow (the E# pulse, once per frame)
//     then for each row: select, load, latch, then (read, advance) x 32
//   latchQ runs one clock behind srQ (tied SRCLK/RCLK)
// input: null | press[12][32] | (row, col) => press | {code: (row, col) => 10-bit code}
// frameBytes(input) -> Uint8Array(386) = AA 55 + 384 bytes; byteIndex(r, c) = 2 + r·32 + c
// createPlayer({speed}).advance(dt) -> micro-steps run in dt·speed seconds of scan time
//   (100 Hz frame, display timing only); .stepOnce(), .stepTo('latch'), .reset()

import { createHost, createParser, median, processFrame, ema, toU8, colorize, viridis, viridisCss,
         PYFLEXITAC } from './models/host.mjs';
// createHost().feed(bytes) -> [{raw, norm|null, init}]; 30 init frames -> per-pixel median baseline
// processFrame: clip(raw - median - 15, 0, 100); divide by (max + 1e-6) if max >= 15, else by 60 (float32, like numpy)
// host.tick() = one EMA(0.2) display step; host.image() = OpenCV VIRIDIS RGB bytes
```

`data/index.mjs` and `data/constants.mjs` are plain ESM, so pages can import them without JSON import attributes.

### Using the models under the film contract
- `__film.step(dt)` → `player.advance(dt)` for the scan, plus your own springs. `act('clock')` → `player.stepOnce()`. `act('reset')` → `player.reset()`.
- The models have no timers or randomness, and they read no clock.
- `state()` can return the latest micro-step together with `divider()` and `adcCode()` values.

## Tests (`npm test`)

- **`scan.test.mjs`**
  - `test/fw_sim.mjs` transpiles the **real** `template.ino` and `32_16_fast.ino` to JS and runs `loop()` for two frames against an independent pin-level board model: a 595 chain with tied clocks, plus a 4067 with E#.
  - Checked against the model, read by read: mux channel, the single HIGH drive line, the D3 clock count, the 10-bit code, every byte on the wire, and the E# HIGH→LOW pulse once per frame.
  - Also checked: the latch lag, the channel map 4–15, the frame size, and that the player is deterministic.
- **`models.test.mjs`**
  - The divider, ADC and byte numbers (the 48 kΩ worked example is computed exactly).
  - The taxel curve: it carries the ILLUSTRATIVE flag, falls monotonically, inverts correctly, and its resting byte lies within PyFlexiTac's 10–40.
- **`host.test.mjs`**
  - `test/py/run_fast_32_16.py` executes the **unmodified** `fast_32_16.py` with stubbed serial, threading and GUI. It replays a synthetic stream through the script's own `readThread()`, in both 12x32 and 16x32. The stream includes garbage bytes, split markers, split payloads, a below-threshold frame and moving presses.
  - The JS port must match **bit for bit**: the float32 norms, the EMA, the uint8 values and the OpenCV VIRIDIS RGB.
  - Also covered: parser quirks, a scan → host round trip, and the LUT.

## Notes and caveats

- **Taxel curve.** The task suggested about 1 MΩ unpressed. `R_REST` is set to 200 kΩ instead, so that an untouched taxel gives byte ≈ 12. That matches the PyFlexiTac docstring ("typical resting ADC values land around 10-40"). `R_HARD` = 1.4 kΩ is the bulk resistance of a 0.6 x 0.6 mm crossing through 0.1 mm Velostat at < 500 Ω·cm. Both values stay **illustrative**. Pass `{rRest, rHard}` to change them.
- **EMA timing.** `fast_32_16.py` applies the EMA once per display-loop tick (sleep 5 ms + imshow), not once per frame. The port therefore keeps the EMA as `tick()`.
- **PyFlexiTac host constants.** PyFlexiTac's own `FlexiTacSensor` uses threshold 25 and noise scale 30, and clips to 0..1. They are exported as `PYFLEXITAC` for reference only. The figures use `fast_32_16.py`.
- **Inferred items** (`inferred: true` in the data):
  - the Top FPC is mounted face-down, and the assembled-pad transform;
  - the FFC pin orientation (`taxelMap`);
  - the crossing overlap;
  - package heights and FFC connector bodies.
- **Values not in the materials** (stored as `null` with a note): laminating sheet and polyimide tape thickness, and board thickness.
