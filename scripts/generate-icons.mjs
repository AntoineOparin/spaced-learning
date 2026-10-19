// Generates the PWA icons in public/ (run: node scripts/generate-icons.mjs).
// The mark: four bars with widening gaps and growing heights — expanding review intervals,
// growing memory stability. Pure Node (zlib) so no image tooling is needed.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BG = [67, 56, 202]; // indigo-700
const FG = [255, 255, 255];

// Bars on a 512 grid: [x, width, height], bottom-aligned at y = 384.
const BARS = [
  [96, 40, 120],
  [160, 40, 172],
  [252, 40, 224],
  [388, 40, 276],
];
const BASELINE = 384;

function crc32(buf) {
  let c;
  let crc = 0xffffffff;
  for (const byte of buf) {
    c = (crc ^ byte) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size, pixel) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
      raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function insideRoundedSquare(u, v, radius) {
  // u, v in [0, 512]
  const r = radius;
  const cx = Math.min(Math.max(u, r), 512 - r);
  const cy = Math.min(Math.max(v, r), 512 - r);
  return (u - cx) ** 2 + (v - cy) ** 2 <= r * r;
}

function insideBar(u, v, scale, offset) {
  for (const [x, w, h] of BARS) {
    const x0 = offset + x * scale;
    const x1 = offset + (x + w) * scale;
    const y1 = offset + BASELINE * scale;
    const y0 = y1 - h * scale;
    if (u >= x0 && u < x1 && v >= y0 && v < y1) return true;
  }
  return false;
}

/** Renders with 4×4 supersampling. `rounded` = transparent rounded corners; `content` scale. */
function render(size, { rounded, contentScale }) {
  const offset = (512 * (1 - contentScale)) / 2;
  return png(size, (x, y) => {
    let bg = 0;
    let fg = 0;
    const n = 4;
    for (let sy = 0; sy < n; sy++) {
      for (let sx = 0; sx < n; sx++) {
        const u = ((x + (sx + 0.5) / n) / size) * 512;
        const v = ((y + (sy + 0.5) / n) / size) * 512;
        if (rounded && !insideRoundedSquare(u, v, 112)) continue;
        if (insideBar(u, v, contentScale, offset)) fg++;
        else bg++;
      }
    }
    const total = n * n;
    const a = (bg + fg) / total;
    if (a === 0) return [0, 0, 0, 0];
    const mix = (i) => Math.round((BG[i] * bg + FG[i] * fg) / (bg + fg));
    return [mix(0), mix(1), mix(2), Math.round(a * 255)];
  });
}

const out = new URL('../public/', import.meta.url);
writeFileSync(new URL('pwa-192.png', out), render(192, { rounded: true, contentScale: 1 }));
writeFileSync(new URL('pwa-512.png', out), render(512, { rounded: true, contentScale: 1 }));
writeFileSync(
  new URL('pwa-maskable-512.png', out),
  render(512, { rounded: false, contentScale: 0.72 }),
);
// iOS applies its own rounding; give it a full-bleed square.
writeFileSync(
  new URL('apple-touch-icon.png', out),
  render(180, { rounded: false, contentScale: 0.8 }),
);

const rects = BARS.map(
  ([x, w, h]) =>
    `<rect x="${x}" y="${BASELINE - h}" width="${w}" height="${h}" rx="6" fill="#fff"/>`,
).join('');
writeFileSync(
  new URL('favicon.svg', out),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><title>Spaced Learning</title><rect width="512" height="512" rx="112" fill="rgb(${BG.join(',')})"/>${rects}</svg>\n`,
);
console.log('Icons written to public/');
