// Tiny pixel-art rasterizer: draw shapes into a color grid, auto-outline,
// then bake to an offscreen canvas. Keeps all art procedural and crisp.

export class Pix {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.g = new Array(w * h).fill(null);
  }

  set(x, y, c) {
    x |= 0; y |= 0;
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.g[y * this.w + x] = c;
  }

  get(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    return this.g[y * this.w + x];
  }

  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }

  ellipse(cx, cy, rx, ry, c) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, c);
      }
    }
  }

  line(x0, y0, x1, y1, c, thick = 1) {
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    for (;;) {
      for (let j = 0; j < thick; j++) for (let i = 0; i < thick; i++) this.set(x0 + i, y0 + j, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
    }
  }

  // Triangle fill via barycentric test (small sprites, cost negligible).
  tri(x0, y0, x1, y1, x2, y2, c) {
    const minX = Math.min(x0, x1, x2), maxX = Math.max(x0, x1, x2);
    const minY = Math.min(y0, y1, y2), maxY = Math.max(y0, y1, y2);
    const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
    if (area === 0) return;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const w0 = (x1 - x0) * (y + 0.5 - y0) - (x + 0.5 - x0) * (y1 - y0);
        const w1 = (x2 - x1) * (y + 0.5 - y1) - (x + 0.5 - x1) * (y2 - y1);
        const w2 = (x0 - x2) * (y + 0.5 - y2) - (x + 0.5 - x2) * (y0 - y2);
        const neg = w0 < 0 || w1 < 0 || w2 < 0;
        const pos = w0 > 0 || w1 > 0 || w2 > 0;
        if (!(neg && pos)) this.set(x, y, c);
      }
    }
  }

  // Black outline: every filled pixel touching an empty one gets `c`,
  // except pixels whose color is listed in `skip`.
  outline(c = '#141420', skip = []) {
    const src = this.g.slice();
    const idx = (x, y) => y * this.w + x;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const v = src[idx(x, y)];
        if (!v || skip.includes(v)) continue;
        const edge =
          x === 0 || y === 0 || x === this.w - 1 || y === this.h - 1 ||
          !src[idx(x - 1, y)] || !src[idx(x + 1, y)] ||
          !src[idx(x, y - 1)] || !src[idx(x, y + 1)];
        if (edge) this.g[idx(x, y)] = c;
      }
    }
  }

  toCanvas(scale = 1) {
    const c = document.createElement('canvas');
    c.width = this.w * scale;
    c.height = this.h * scale;
    const ctx = c.getContext('2d');
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const v = this.g[y * this.w + x];
        if (v) {
          ctx.fillStyle = v;
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      }
    }
    return c;
  }
}

// Deterministic hash-based pseudo-random in [0,1) for infinite procedural
// placement that stays stable as the world scrolls.
export function hashRand(...nums) {
  let h = 2166136261;
  for (const n of nums) {
    h ^= (n * 2654435761) | 0;
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
