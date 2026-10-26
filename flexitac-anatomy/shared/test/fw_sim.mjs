// Independent simulator for the FlexiTac Arduino sketches, used only by the tests.
//
// It does NOT reuse models/scan.mjs. It transpiles the real .ino source (simple C)
// to JavaScript, runs loop() against a pin-level hardware model of the reading
// board (4x 74HC595 with tied SRCLK/RCLK, CD74HC4067 with E#) and logs every
// analogRead, Serial.write and D8 edge.
import { readFileSync } from 'node:fs';

export function transpileIno(src) {
  let s = src;
  s = s.replace(/\/\/.*$/gm, '');                                   // line comments
  s = s.replace(/#ifndef[\s\S]*?#endif/g, '');                        // cbi/sbi guards (provided by the harness)
  // function-like macros:  #define NAME()  body
  s = s.replace(/^#define\s+(\w+)\(\)\s+(.+)$/gm, (_, n, b) => `const ${n} = () => { ${b}; };`);
  // object-like macros
  s = s.replace(/^#define\s+(\w+)\s+(\S+)\s*$/gm, (_, n, v) => `const ${n} = ${v};`);
  s = s.replace(/\bB([01]{8})\b/g, '0b$1');
  s = s.replace(/\bPORTD\b/g, 'hw.PORTD');
  s = s.replace(/\(byte\)\s*\(([^;]+)\);/g, '(($1) & 255);');
  s = s.replace(/\bvoid\s+(\w+)\s*\(\s*\)/g, 'function $1()');
  s = s.replace(/\bvoid\s+(\w+)\s*\(\s*(?:int|boolean|byte)\s+(\w+)\s*\)/g, 'function $1($2)');
  s = s.replace(/\b(?:int|byte|boolean)\s+(\w+)\s*=/g, 'let $1 =');
  return s + '\nreturn { setup, loop };';
}

/** Pin-level model of the reading board. analog(ch, driveLines) -> 10-bit code. */
export function createBoard(analog) {
  const pin = new Uint8Array(20);           // D0..D13, A0.. (A0 = 14)
  const sr = new Uint8Array(32), latch = new Uint8Array(32);
  const log = { bytes: [], reads: [], d8: [], clocks: 0 };
  let portd = 0;
  function risingD3() {
    // 74HC595: SRCLK and RCLK tied -> storage register gets the pre-shift stage
    const before = Uint8Array.from(sr);
    for (let k = 31; k > 0; k--) sr[k] = sr[k - 1];
    sr[0] = pin[2];
    latch.set(before);
    log.clocks++;
  }
  function setPin(p, v) {
    v = v ? 1 : 0;
    const old = pin[p];
    pin[p] = v;
    if (p === 3 && !old && v) risingD3();
    if (p === 8 && old !== v) log.d8.push({ level: v, atRead: log.reads.length, atByte: log.bytes.length });
  }
  const hw = {
    get PORTD() { return portd; },
    set PORTD(v) { portd = v & 255; for (let b = 0; b < 8; b++) setPin(b, (portd >> b) & 1); },
  };
  const env = {
    hw,
    A0: 14, HIGH: 1, LOW: 0, OUTPUT: 1, INPUT: 0, ADCSRA: 0, ADPS0: 0, ADPS1: 1, ADPS2: 2,
    sbi() {}, cbi() {},
    Serial: { begin() {}, write(b) { log.bytes.push(b & 255); } },
    pinMode() {},
    digitalWrite(p, v) {
      if (p < 8) { portd = v ? portd | (1 << p) : portd & ~(1 << p); }
      setPin(p, v);
    },
    bitRead(x, i) { return (x >> i) & 1; },
    analogRead(p) {
      if (p !== 14) throw new Error('analogRead on unexpected pin ' + p);
      const enabled = pin[8] === 0;
      const ch = pin[4] | (pin[5] << 1) | (pin[6] << 2) | (pin[7] << 3);
      const high = []; for (let k = 0; k < 32; k++) if (latch[k]) high.push(k);
      const code = enabled ? analog(ch, high) : 0;
      log.reads.push({ ch, enabled, high, code, clock: log.clocks });
      return code;
    },
  };
  return { env, log, pin, sr, latch };
}

export function loadSketch(path, analog) {
  const js = transpileIno(readFileSync(path, 'utf8'));
  const board = createBoard(analog);
  const names = Object.keys(board.env);
  // eslint-disable-next-line no-new-func
  const sketch = new Function(...names, js)(...names.map((n) => board.env[n]));
  sketch.setup();
  return { ...sketch, board, js };
}
