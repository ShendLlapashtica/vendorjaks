#!/usr/bin/env node
// Copies the real flag artwork for every country in the GS1 table into
// public/flags/.
//
// WHY (owner, 2026-09-12): "the flags must show all of them . make sure
// recognizers get the real flag shown! and get them from a real source!!"
//
// The previous approach had three rendering paths and only one of them was
// real artwork:
//   1. Unicode emoji flags — correct on phones, but Windows ships NO flag
//      glyphs at all, so desktop fell through to a typographic "ES" chip.
//      Verified on a real Windows Chrome: every flag was letters in a box.
//   2. Two hand-drawn SVGs (Serbia, Kosovo) that deliberately omitted the
//      coat of arms and the gold map because drawing national heraldry from
//      memory produces a WRONG picture of a national symbol.
//   3. An ISO-code chip fallback.
//
// So most countries never showed a real flag anywhere, and the two that did
// were simplifications. This replaces all of it with genuine artwork.
//
// SOURCE: `flag-icons` (npm, MIT licence, github.com/lipis/flag-icons) —
// a maintained set of SVG flags covering every ISO 3166-1 code, INCLUDING
// `xk` for Kosovo, which is the one Unicode emoji cannot represent because
// XK is a user-assigned code outside the RGI set. MIT permits redistribution
// with the licence notice, which is copied alongside the files.
//
// Run: node scripts/build-flags.mjs

import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SRC = join(ROOT, 'node_modules', 'flag-icons', 'flags', '4x3');
const OUT = join(ROOT, 'public', 'flags');
const LICENSE_SRC = join(ROOT, 'node_modules', 'flag-icons', 'LICENSE');

if (!existsSync(SRC)) {
  console.error('flag-icons not installed. Run: npm install flag-icons');
  process.exit(1);
}

// Every ISO code the app can actually resolve a barcode to.
const table = JSON.parse(readFileSync(join(ROOT, 'data', 'gs1-prefixes.json'), 'utf8'));
const needed = [...new Set(table.prefixes.filter((p) => p.kind === 'country' && p.iso).map((p) => p.iso.toLowerCase()))].sort();

mkdirSync(OUT, { recursive: true });

const copied = [];
const missing = [];
for (const iso of needed) {
  const from = join(SRC, `${iso}.svg`);
  if (!existsSync(from)) {
    missing.push(iso);
    continue;
  }
  copyFileSync(from, join(OUT, `${iso}.svg`));
  copied.push(iso);
}

// Ship the licence with the artwork — MIT requires the notice to travel
// with redistributed copies.
if (existsSync(LICENSE_SRC)) {
  const text = readFileSync(LICENSE_SRC, 'utf8');
  writeFileSync(
    join(OUT, 'LICENSE.txt'),
    `Flag artwork in this directory comes from the "flag-icons" project\n` +
      `(https://github.com/lipis/flag-icons), redistributed under the MIT\n` +
      `licence reproduced below. Copied by scripts/build-flags.mjs.\n\n` +
      text,
    'utf8'
  );
}

const bytes = readdirSync(OUT)
  .filter((f) => f.endsWith('.svg'))
  .reduce((n, f) => n + readFileSync(join(OUT, f)).length, 0);

console.log(`Flags needed by data/gs1-prefixes.json: ${needed.length}`);
console.log(`Copied into public/flags/: ${copied.length}`);
console.log(`Total size: ${(bytes / 1024).toFixed(1)} KB`);
if (missing.length > 0) {
  console.log(`MISSING (no artwork in flag-icons): ${missing.join(', ')}`);
} else {
  console.log('MISSING: none — every country in the table has real artwork.');
}
