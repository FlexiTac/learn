// @ts-nocheck
// A height map to a normal map. Copied from flexitac-anatomy/figures/board/pbr/board-real/pcb.js (heightToNormal).
import * as THREE from 'three';

export function heightToNormal(h, W, H, PX, k = 1) {
  const b = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let s = 0;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= H) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= W) continue;
          const w = dx === 0 && dy === 0 ? 4 : dx === 0 || dy === 0 ? 2 : 1;
          s += h[yy * W + xx] * w;
          n += w;
        }
      }
      b[y * W + x] = s / n;
    }
  }
  const out = new Uint8ClampedArray(W * H * 4);
  const px = 1000 / PX; // um per pixel
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const xl = b[y * W + Math.max(0, x - 1)];
      const xr = b[y * W + Math.min(W - 1, x + 1)];
      const yu = b[Math.max(0, y - 1) * W + x];
      const yd = b[Math.min(H - 1, y + 1) * W + x];
      const dhdx = ((xr - xl) / (2 * px)) * k;
      const dhdy = ((yu - yd) / (2 * px)) * k; // board +y is up the canvas
      const l = Math.hypot(dhdx, dhdy, 1);
      const i = (y * W + x) * 4;
      out[i] = (-dhdx / l) * 127.5 + 127.5;
      out[i + 1] = (-dhdy / l) * 127.5 + 127.5;
      out[i + 2] = (1 / l) * 127.5 + 127.5;
      out[i + 3] = 255;
    }
  }
  return out;
}
