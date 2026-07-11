// Bitmap pixel fonts rendered directly to canvas (no external assets).
// FONT5: 5x5 main UI font. FONT3: 3x5 micro font for in-world signage.

const F5 = {
  A: [0b01110, 0b10001, 0b11111, 0b10001, 0b10001],
  B: [0b11110, 0b10001, 0b11110, 0b10001, 0b11110],
  C: [0b01111, 0b10000, 0b10000, 0b10000, 0b01111],
  D: [0b11110, 0b10001, 0b10001, 0b10001, 0b11110],
  E: [0b11111, 0b10000, 0b11110, 0b10000, 0b11111],
  F: [0b11111, 0b10000, 0b11110, 0b10000, 0b10000],
  G: [0b01111, 0b10000, 0b10011, 0b10001, 0b01111],
  H: [0b10001, 0b10001, 0b11111, 0b10001, 0b10001],
  I: [0b11111, 0b00100, 0b00100, 0b00100, 0b11111],
  J: [0b00111, 0b00010, 0b00010, 0b10010, 0b01100],
  K: [0b10001, 0b10010, 0b11100, 0b10010, 0b10001],
  L: [0b10000, 0b10000, 0b10000, 0b10000, 0b11111],
  M: [0b10001, 0b11011, 0b10101, 0b10001, 0b10001],
  N: [0b10001, 0b11001, 0b10101, 0b10011, 0b10001],
  O: [0b01110, 0b10001, 0b10001, 0b10001, 0b01110],
  P: [0b11110, 0b10001, 0b11110, 0b10000, 0b10000],
  Q: [0b01110, 0b10001, 0b10101, 0b10010, 0b01101],
  R: [0b11110, 0b10001, 0b11110, 0b10010, 0b10001],
  S: [0b01111, 0b10000, 0b01110, 0b00001, 0b11110],
  T: [0b11111, 0b00100, 0b00100, 0b00100, 0b00100],
  U: [0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  V: [0b10001, 0b10001, 0b10001, 0b01010, 0b00100],
  W: [0b10001, 0b10001, 0b10101, 0b11011, 0b10001],
  X: [0b10001, 0b01010, 0b00100, 0b01010, 0b10001],
  Y: [0b10001, 0b01010, 0b00100, 0b00100, 0b00100],
  Z: [0b11111, 0b00010, 0b00100, 0b01000, 0b11111],
  0: [0b01110, 0b10011, 0b10101, 0b11001, 0b01110],
  1: [0b00100, 0b01100, 0b00100, 0b00100, 0b01110],
  2: [0b01110, 0b10001, 0b00110, 0b01000, 0b11111],
  3: [0b11110, 0b00001, 0b00110, 0b00001, 0b11110],
  4: [0b00110, 0b01010, 0b10010, 0b11111, 0b00010],
  5: [0b11111, 0b10000, 0b11110, 0b00001, 0b11110],
  6: [0b01110, 0b10000, 0b11110, 0b10001, 0b01110],
  7: [0b11111, 0b00001, 0b00010, 0b00100, 0b00100],
  8: [0b01110, 0b10001, 0b01110, 0b10001, 0b01110],
  9: [0b01110, 0b10001, 0b01111, 0b00001, 0b01110],
  ' ': [0, 0, 0, 0, 0],
  '.': [0, 0, 0, 0, 0b00100],
  ',': [0, 0, 0, 0b00100, 0b01000],
  ':': [0, 0b00100, 0, 0b00100, 0],
  '!': [0b00100, 0b00100, 0b00100, 0, 0b00100],
  '?': [0b01110, 0b10001, 0b00110, 0, 0b00100],
  "'": [0b00100, 0b00100, 0, 0, 0],
  '-': [0, 0, 0b01110, 0, 0],
  '+': [0, 0b00100, 0b01110, 0b00100, 0],
  '/': [0b00001, 0b00010, 0b00100, 0b01000, 0b10000],
  '(': [0b00010, 0b00100, 0b00100, 0b00100, 0b00010],
  ')': [0b01000, 0b00100, 0b00100, 0b00100, 0b01000],
  '<': [0b00010, 0b00100, 0b01000, 0b00100, 0b00010],
  '>': [0b01000, 0b00100, 0b00010, 0b00100, 0b01000],
  '%': [0b11001, 0b11010, 0b00100, 0b01011, 0b10011],
  '"': [0b01010, 0b01010, 0, 0, 0],
  '*': [0b00100, 0b10101, 0b01110, 0b10101, 0b00100],
  '@': [0b01110, 0b10001, 0b10111, 0b10000, 0b01111],
  '=': [0, 0b01110, 0, 0b01110, 0],
  '_': [0, 0, 0, 0, 0b11111],
  // icon glyphs
  '$': [0b01110, 0b11111, 0b11011, 0b11111, 0b01110], // coin
  '^': [0b00100, 0b01110, 0b11111, 0b01110, 0b00100], // star/spark
  '~': [0b01010, 0b11111, 0b11111, 0b01110, 0b00100], // heart
  '#': [0b01010, 0b11111, 0b01010, 0b11111, 0b01010],
};

const F3 = {
  A: [7, 5, 7, 5, 5], B: [6, 5, 6, 5, 6], C: [7, 4, 4, 4, 7],
  D: [6, 5, 5, 5, 6], E: [7, 4, 6, 4, 7], F: [7, 4, 6, 4, 4],
  G: [7, 4, 5, 5, 7], H: [5, 5, 7, 5, 5], I: [7, 2, 2, 2, 7],
  J: [1, 1, 1, 5, 7], K: [5, 5, 6, 5, 5], L: [4, 4, 4, 4, 7],
  M: [5, 7, 7, 5, 5], N: [6, 5, 5, 5, 5], O: [7, 5, 5, 5, 7],
  P: [7, 5, 7, 4, 4], Q: [7, 5, 5, 7, 1], R: [6, 5, 6, 5, 5],
  S: [7, 4, 7, 1, 7], T: [7, 2, 2, 2, 2], U: [5, 5, 5, 5, 7],
  V: [5, 5, 5, 5, 2], W: [5, 5, 7, 7, 5], X: [5, 5, 2, 5, 5],
  Y: [5, 5, 2, 2, 2], Z: [7, 1, 2, 4, 7],
  0: [7, 5, 5, 5, 7], 1: [2, 6, 2, 2, 7], 2: [7, 1, 7, 4, 7],
  3: [7, 1, 7, 1, 7], 4: [5, 5, 7, 1, 1], 5: [7, 4, 7, 1, 7],
  6: [7, 4, 7, 5, 7], 7: [7, 1, 1, 2, 2], 8: [7, 5, 7, 5, 7],
  9: [7, 5, 7, 1, 7],
  ' ': [0, 0, 0, 0, 0], '.': [0, 0, 0, 0, 2], '!': [2, 2, 2, 0, 2],
  '-': [0, 0, 7, 0, 0], ':': [0, 2, 0, 2, 0], "'": [2, 2, 0, 0, 0],
};

// Per-glyph trimmed widths for FONT5, computed once.
const W5 = {};
for (const ch in F5) {
  const rows = F5[ch];
  let min = 5, max = -1;
  for (const r of rows) {
    for (let b = 0; b < 5; b++) {
      if (r & (1 << (4 - b))) { if (b < min) min = b; if (b > max) max = b; }
    }
  }
  W5[ch] = max < 0 ? { off: 0, w: 3 } : { off: min, w: max - min + 1 };
}

export function textWidth(text, scale = 1) {
  let w = 0;
  for (const ch of text.toUpperCase()) {
    const g = W5[ch] || W5['?'];
    w += (g.w + 1) * scale;
  }
  return w - scale;
}

export function drawText(ctx, text, x, y, color = '#ffffff', scale = 1, align = 'left') {
  text = String(text).toUpperCase();
  if (align === 'center') x -= (textWidth(text, scale) / 2) | 0;
  else if (align === 'right') x -= textWidth(text, scale);
  x |= 0; y |= 0;
  ctx.fillStyle = color;
  for (const ch of text) {
    const rows = F5[ch] || F5['?'];
    const g = W5[ch] || W5['?'];
    for (let ry = 0; ry < 5; ry++) {
      const r = rows[ry];
      for (let b = g.off; b < g.off + g.w; b++) {
        if (r & (1 << (4 - b))) {
          ctx.fillRect(x + (b - g.off) * scale, y + ry * scale, scale, scale);
        }
      }
    }
    x += (g.w + 1) * scale;
  }
}

export function drawTextShadow(ctx, text, x, y, color, shadow, scale = 1, align = 'left') {
  drawText(ctx, text, x + scale, y + scale, shadow, scale, align);
  drawText(ctx, text, x, y, color, scale, align);
}

export function microWidth(text, scale = 1) {
  return (String(text).length * 4 - 1) * scale;
}

export function drawMicro(ctx, text, x, y, color = '#ffffff', scale = 1, align = 'left') {
  text = String(text).toUpperCase();
  if (align === 'center') x -= (microWidth(text, scale) / 2) | 0;
  else if (align === 'right') x -= microWidth(text, scale);
  x |= 0; y |= 0;
  ctx.fillStyle = color;
  for (const ch of text) {
    const rows = F3[ch] || F3[' '];
    for (let ry = 0; ry < 5; ry++) {
      const r = rows[ry];
      for (let b = 0; b < 3; b++) {
        if (r & (1 << (2 - b))) ctx.fillRect(x + b * scale, y + ry * scale, scale, scale);
      }
    }
    x += 4 * scale;
  }
}
