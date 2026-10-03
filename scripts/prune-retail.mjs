#!/usr/bin/env node
// Removes catalogue sources whose data is not fit for this app.
//
// Owner, 2026-09-12: "ushqime and pije from gjirafa is so wrong remove em
// all".
//
// They are right, and the reason matters for any future source we add.
// GjirafaMall is a MARKETPLACE, not a grocer. Every one of its 747 rows was
// filed under a single category, "Ushqime & Pije", and inspecting them
// shows what that actually contains:
//
//   Tequila Don Julio 1942, 0.7L        €270    brand: "Gekos"
//   Uiski JW Blue Label, 0.7L           €295    brand: "Gekos"
//   Mjaltë Manuka Doctor 1000mgo        €151.99
//   Vitamin D3 + K2 10,000 IU           €10.95  brand: "Royal Parfumes"
//   Lavazza kafe e bluar 250 gr         €7.30   brand: "TuttoCapsule"
//
// Two fatal problems:
//   1. The `brand` field is the SELLER, not the product's brand. "Royal
//      Parfumes" does not make vitamins and "TuttoCapsule" does not make
//      Lavazza. Brand is what the boycott override and the alternatives
//      matcher key on, so a seller-as-brand row can produce a confidently
//      wrong verdict.
//   2. The category is a single junk drawer, so the shelf split and the
//      category gate have nothing real to work with.
//
// This is a shopping list for Kosovo households. €295 whisky filed as
// groceries with a wrong brand is worse than no data.
//
// Run: node scripts/prune-retail.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = resolve(__dirname, '..', 'data', 'kosovo-retail.json');

// Sources removed, with the reason recorded so nobody re-adds them blindly.
const BLOCKED = [
  {
    match: /gjirafa/i,
    reason:
      'Marketplace, not a grocer. All 747 rows filed under one category "Ushqime & Pije"; `brand` holds the SELLER not the product brand (e.g. Lavazza coffee listed under brand "TuttoCapsule", vitamins under "Royal Parfumes"), which can produce a wrong boycott verdict. Removed 2026-09-12 on the owner\'s instruction.',
  },
];

const raw = JSON.parse(readFileSync(FILE, 'utf8'));
const before = raw.products.length;

const kept = [];
const removedBySource = new Map();
for (const p of raw.products) {
  const hay = `${p.source || ''} ${p.sourceLabel || ''}`;
  const blocked = BLOCKED.find((b) => b.match.test(hay));
  if (blocked) {
    const key = p.sourceLabel || p.source || 'unknown';
    removedBySource.set(key, (removedBySource.get(key) || 0) + 1);
    continue;
  }
  kept.push(p);
}

raw.products = kept;
raw.count = kept.length;
raw.prunedAt = new Date().toISOString();
raw.prunedSources = BLOCKED.map((b) => ({ pattern: String(b.match), reason: b.reason }));
if (Array.isArray(raw.sources)) {
  raw.sources = raw.sources.filter((s) => !BLOCKED.some((b) => b.match.test(JSON.stringify(s))));
}

writeFileSync(FILE, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');

console.log(`products: ${before} -> ${kept.length}`);
for (const [src, n] of removedBySource) console.log(`  removed ${n} from ${src}`);
const bySource = kept.reduce((acc, p) => {
  const k = p.sourceLabel || p.source || '?';
  return { ...acc, [k]: (acc[k] || 0) + 1 };
}, {});
console.log('remaining by source:', JSON.stringify(bySource, null, 1));
console.log('with barcode:', kept.filter((p) => p.barcode).length);
