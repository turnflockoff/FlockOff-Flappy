// Generates the PWA / app icons as PNGs with zero dependencies:
// draws the disguised dove on a 32x32 pixel grid, scales nearest-neighbor,
// and encodes PNG via node:zlib. Run: node scripts/gen-icons.mjs
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(OUT_DIR, { recursive: true });

// ---- tiny PNG encoder ----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePNG(rgba, w, h) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  const raw = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 4)] = 0; // filter none
    rgba.copy(raw, y * (1 + w * 4) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- 32x32 icon art ----
const PAL = {
  B: [16, 16, 26, 255],     // background navy
  b: [26, 30, 46, 255],     // bg vignette
  o: [20, 20, 32, 255],     // outline
  w: [248, 248, 248, 255],  // dove white
  s: [201, 206, 222, 255],  // dove shade
  k: [245, 146, 30, 255],   // beak
  e: [255, 255, 255, 255],  // eye white
  p: [20, 20, 32, 255],     // pupil
  g: [28, 28, 40, 255],     // glasses
  n: [217, 160, 102, 255],  // fake nose
  m: [90, 58, 34, 255],     // mustache
  r: [255, 60, 60, 255],    // red scanner glint
};

const ART = [
  'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
  'BbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbB',
  'BbbbbbbbbbbbbbbbbbbbbbbbbbbrbbbB',
  'BbbbbbbbbbbbbooooobbbbbbbbbbbbbB',
  'BbbbbbbbbbbooowwwooobbbbbbbbbbbB',
  'BbbbbbbbbboowwwwwwwoobbbbbbbbbbB',
  'BbbbbbbbbowwwwwwwwwwobbbbbbbbbbB',
  'BbbbbbbbowwwwooooowwwobbbbbbbbbB',
  'BbbbbbbbowwwoggggowwwobbbbbbbbbB',
  'BbbbbbbowwwogeeeegowwwobbbbbbbbB',
  'BbbbbbbowwwogeppegowwwooobbbbbbB',
  'BbbbbbbowwwogeeeegowwokkkobbbbbB',
  'BbbbbbbowwwwoggggowwokkkkkobbbbB',
  'BbbbbbbowwwwwonnowwwwokkkobbbbbB',
  'BbbbbbowwwwwonnnnowwwwooobbbbbbB',
  'BbbbbbowwwwommmmmmowwwwobbbbbbbB',
  'BbbbbbowwwommmmmmmmowwwobbbbbbbB',
  'BbbbbboswwwommmmmmowwwsobbbbbbbB',
  'BbbbbboswwwwoooooowwwssobbbbbbbB',
  'BbbbbbosswwwwwwwwwwwsssobbbbbbbB',
  'BbbbbbbosswwwwwwwwwsssobbbbbbbbB',
  'BbbbbbbbossswwwwwsssoobbbbbbbbbB',
  'BbbbbbbbboosssssssoobbbbbbbbbbbB',
  'BbbbbbbbbbbooooooobbbbbbbbbbbbbB',
  'BbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbB',
  'BbbbwbbbbbbbbbbbbbbbbbbbbbbbbbbB',
  'BbbbbbbbbbbbbbbbbbbbbbsbbbbbbbbB',
  'BbbbbbbsbbbbbbbbbbbbbbbbbbbbbbbB',
  'BbbbbbbbbbbbbbbbwbbbbbbbbbbbbbbB',
  'BbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbB',
  'BbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbB',
  'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
];

function renderIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const scale = size / 32;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const ch = ART[Math.min(31, (y / scale) | 0)][Math.min(31, (x / scale) | 0)];
      const c = PAL[ch] || PAL.B;
      const i = (y * size + x) * 4;
      rgba[i] = c[0]; rgba[i + 1] = c[1]; rgba[i + 2] = c[2]; rgba[i + 3] = c[3];
    }
  }
  return rgba;
}

for (const size of [64, 180, 192, 512]) {
  writeFileSync(join(OUT_DIR, `icon-${size}.png`), encodePNG(renderIcon(size), size, size));
}
// maskable: same art (already has generous padding)
writeFileSync(join(OUT_DIR, 'icon-512-maskable.png'), encodePNG(renderIcon(512), 512, 512));
console.log('icons written to', OUT_DIR);
