#!/usr/bin/env node
// Generates the PNG icon set from the same geometry as public/favicon.svg.
//
// WHY THIS EXISTS. index.html and site.webmanifest reference
// apple-touch-icon.png and icon-{192,512}.png and icon-maskable-512.png. A
// manifest that points at icons which 404 is worse than having no manifest:
// the install prompt either fails or offers a broken icon. There is no
// rasteriser on this machine — no sharp, no canvas, no ImageMagick (the
// `convert` on PATH is the Windows disk tool) — so rather than ship dangling
// references, the shapes are drawn into an RGBA buffer here and encoded as a
// real PNG with Node's built-in zlib.
//
// The geometry is duplicated from favicon.svg on purpose: the alternative is
// an SVG parser, which is a far bigger surface than four filled shapes. Keep
// the two in sync — there is a test that asserts the colours match the
// tokens, which is the part that actually drifted last time.
//
//   node scripts/build-icons.mjs
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const OUT = path.join(process.cwd(), 'public');

// Literal token values from src/index.css: --accent-cta / --on-light.
const ACCENT = [0xff, 0x2e, 0x2e];
const INK = [0x14, 0x16, 0x1a];

/** The V and the two reticle brackets, in the favicon's 64x64 coordinate space. */
const SHAPES = [
  // Owner, 2026-09-17: "FAVICON just a red bg with a V". The two reticle
  // brackets are gone — at 16px they were the first thing to turn to mush,
  // so dropping them is both what he asked for and the better mark. One
  // shape, maximum weight, nothing to lose when a browser downsamples it.
  // Same geometry as public/favicon.svg; keep the two in sync.
  { poly: [[10, 15], [22.5, 15], [32, 42.5], [41.5, 15], [54, 15], [38.5, 54], [25.5, 54]] },
];

function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * @param {number} size    pixel size
 * @param {number} inset   fraction of the canvas the MARK is inset by. 0 for a
 *                         normal icon; 0.1 for maskable, which Android may
 *                         crop by up to 20% — the mark must sit in the middle
 *                         80% or launchers eat its corners.
 * @param {number} radius  corner radius as a fraction (0 = square, for
 *                         maskable, because the launcher supplies the shape).
 */
function render(size, { inset = 0, radius = 0.22 } = {}) {
  const px = Buffer.alloc(size * size * 4);
  const r = radius * size;
  // Supersample 3x3 so the V's diagonals and the rounded corners are not
  // jagged; at 192px a hard edge is visibly stepped.
  const SS = 3;
  const markScale = (1 - inset * 2) / 64;
  const markOffset = inset * size;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let groundHits = 0;
      let inkHits = 0;
      for (let sy = 0; sy < SS; sy += 1) {
        for (let sx = 0; sx < SS; sx += 1) {
          const fx = x + (sx + 0.5) / SS;
          const fy = y + (sy + 0.5) / SS;
          // Rounded-rect ground.
          let inGround = true;
          if (r > 0) {
            const cx = Math.min(Math.max(fx, r), size - r);
            const cy = Math.min(Math.max(fy, r), size - r);
            inGround = (fx - cx) ** 2 + (fy - cy) ** 2 <= r * r || (fx >= r && fx <= size - r) || (fy >= r && fy <= size - r);
          }
          if (!inGround) continue;
          groundHits += 1;
          // Mark, mapped from the 64-unit space.
          const mx = (fx - markOffset) / (size * markScale);
          const my = (fy - markOffset) / (size * markScale);
          if (SHAPES.some((s) => pointInPoly(mx, my, s.poly))) inkHits += 1;
        }
      }
      const total = SS * SS;
      const i = (y * size + x) * 4;
      if (groundHits === 0) continue; // transparent outside the rounded corner
      const inkA = inkHits / total;
      const groundA = groundHits / total;
      // Composite ink over accent, then the whole thing over transparency.
      for (let c = 0; c < 3; c += 1) {
        px[i + c] = Math.round(ACCENT[c] * (1 - inkA) + INK[c] * inkA);
      }
      px[i + 3] = Math.round(255 * groundA);
    }
  }
  return px;
}

function png(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

let TABLE = null;
function crc32(buf) {
  if (!TABLE) {
    TABLE = new Int32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      TABLE[n] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i += 1) c = TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return c ^ -1;
}

const targets = [
  ['apple-touch-icon.png', 180, { radius: 0 }], // iOS masks it itself and dislikes transparency
  ['icon-192.png', 192, {}],
  ['icon-512.png', 512, {}],
  ['icon-maskable-512.png', 512, { inset: 0.1, radius: 0 }],
  ['favicon-32.png', 32, {}],
  ['favicon-16.png', 16, {}],
];

for (const [name, size, opts] of targets) {
  const buf = png(size, render(size, opts));
  fs.writeFileSync(path.join(OUT, name), buf);
  console.log(`${name.padEnd(26)} ${size}x${size}  ${(buf.length / 1024).toFixed(1)} KB`);
}
console.log('\nicons written to public/ — colours are the literal --accent-cta / --on-light tokens');
