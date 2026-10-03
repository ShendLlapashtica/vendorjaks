#!/usr/bin/env node
// Measure — and optionally fill — the pack-size coverage of
// data/kosovo-retail.json.
//
//   node scripts/enrich-sizes.mjs            report only, writes nothing
//   node scripts/enrich-sizes.mjs --write    also fill the rows still null
//   node scripts/enrich-sizes.mjs --samples  print worked examples + misses
//
// It uses src/lib/productSize.js — the SAME module the app renders from — so
// what this script reports is exactly what a shopper will see. There is no
// second parser to drift out of step with.
//
// The stored `quantity` written by scripts/harvest-more.mjs is never
// overwritten. This only answers for rows where it is null.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseProductSize, parsePieceCount, formatSize, isSoldByWeight } from '../src/lib/productSize.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'data', 'kosovo-retail.json');

const WRITE = process.argv.includes('--write');
const SAMPLES = process.argv.includes('--samples');

const pct = (n, d) => (d === 0 ? '0.0' : ((100 * n) / d).toFixed(1));

function main() {
  if (!fs.existsSync(FILE)) {
    console.error(`missing ${FILE}`);
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  const rows = raw.products || [];
  const total = rows.length;

  const before = rows.filter((r) => r.quantity).length;

  let parsedNow = 0;
  let byWeight = 0;
  let pieces = 0;
  let stillUnknown = 0;
  let noName = 0;
  const unitTally = new Map();
  const wins = [];
  const misses = [];
  const weighed = [];
  const pieceSamples = [];

  for (const row of rows) {
    if (row.quantity) continue; // the pipeline already answered; never overridden
    const name = row.name || '';
    if (!name.trim()) {
      noName += 1;
      stillUnknown += 1;
      continue;
    }
    if (isSoldByWeight(name)) {
      byWeight += 1;
      if (weighed.length < 10) weighed.push(name);
      if (WRITE) {
        row.soldByWeight = true;
        row.quantitySource = 'sold-by-weight (per-kg listing / PLU code) — src/lib/productSize.js';
      }
      continue;
    }
    const size = parseProductSize(name);
    if (!size) {
      const pc = parsePieceCount(name);
      if (pc) {
        pieces += 1;
        if (pieceSamples.length < 10) pieceSamples.push(`${name}  ->  ${pc.count} copë   [raw: "${pc.raw}"]`);
        if (WRITE) {
          row.quantity = `${pc.count} copë`;
          row.quantitySource = 'piece-count parsed-from-product-name — src/lib/productSize.js';
        }
        continue;
      }
      stillUnknown += 1;
      if (misses.length < 25) misses.push(name);
      continue;
    }
    parsedNow += 1;
    unitTally.set(size.unit, (unitTally.get(size.unit) || 0) + 1);
    if (wins.length < 25) wins.push(`${name}  ->  ${formatSize(size)}   [raw: "${size.raw}"]`);
    if (WRITE) {
      row.quantity = formatSize(size);
      row.quantitySource = 'parsed-from-product-name — src/lib/productSize.js';
    }
  }

  const after = before + parsedNow;
  const accounted = after + byWeight + pieces;

  console.log('=== pack-size coverage, data/kosovo-retail.json ===');
  console.log(`rows                                 ${total}`);
  console.log(`BEFORE  stored quantity (harvest)    ${before}  (${pct(before, total)}%)`);
  console.log(`  + parsed now by productSize.js     ${parsedNow}  (+${pct(parsedNow, total)} pts)`);
  console.log(`AFTER   rows with a size             ${after}  (${pct(after, total)}%)`);
  console.log(`  + sold by weight (per kg / PLU)    ${byWeight}  (${pct(byWeight, total)}%)`);
  console.log(`  + piece count, no mass (copë)      ${pieces}  (${pct(pieces, total)}%)`);
  console.log(`TOTAL   rows with a stated answer    ${accounted}  (${pct(accounted, total)}%)`);
  console.log(`        genuinely no size in title   ${stillUnknown}  (${pct(stillUnknown, total)}%)`);
  console.log(`          of which, no name at all   ${noName}`);
  console.log('');
  console.log('newly parsed, by unit:', JSON.stringify(Object.fromEntries([...unitTally].sort((a, b) => b[1] - a[1]))));

  if (SAMPLES) {
    console.log('\n--- NEWLY PARSED (25) ---');
    console.log(wins.join('\n'));
    console.log('\n--- PIECE COUNTS (10) — no mass exists for these ---');
    console.log(pieceSamples.join('\n'));
    console.log('\n--- SOLD BY WEIGHT (10) ---');
    console.log(weighed.join('\n'));
    console.log('\n--- STILL UNKNOWN (25) — no size is stated in these titles ---');
    console.log(misses.join('\n'));
  }

  if (WRITE) {
    fs.writeFileSync(FILE, `${JSON.stringify(raw, null, 2)}\n`);
    console.log(`\nwrote ${FILE}`);
  } else {
    console.log('\n(report only — pass --write to fill the rows, --samples to see examples)');
  }
}

main();
