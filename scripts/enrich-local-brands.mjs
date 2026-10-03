#!/usr/bin/env node
// Marks catalogue products as locally-registered, from their OWN barcode.
//
// WHY THIS IS NOW POSSIBLE. Until the 2026-09-12 harvest only 478 of the
// catalogue's rows carried a barcode, so almost nothing could be classified
// and only 49 rows had `isLocalBrand: true` — which is why the alternatives
// lane so often had nothing honest to offer. That harvest took barcode
// coverage to 8,765 rows, and 2,034 of those resolve to GS1 Kosovo (381),
// the legacy Kosovo range (390) or GS1 Albania (530).
//
// WHAT THIS CLAIMS, PRECISELY. A 381/390/530 prefix means the brand owner
// registered that number with the Kosovar or Albanian GS1 organisation. It
// does NOT prove where the item was manufactured — the app says "registered
// with", never "made in", and that wording is unchanged here.
//
// It is nevertheless the STRONGEST authenticity signal the app has, and it
// is already the primary gate elsewhere: matcher.js's
// isEligibleLocalCandidate() admits a candidate on exactly this basis. So
// this script is not inventing a new standard, it is applying the existing
// one to rows that finally have the data to be judged.
//
// WHAT IT WILL NOT DO:
//   · never sets `isLocalBrand: true` from a name, a brand string, a
//     category or a retailer — only from the product's own GS1 prefix;
//   · never sets `false`. Absence of a local prefix is not evidence the
//     product is foreign, so a non-local row keeps whatever it had (usually
//     null = unknown);
//   · never overwrites an existing `true` that came with its own evidence.
//
// Every row it touches records `localEvidence` naming the prefix, so the
// claim is auditable rather than asserted.
//
// Run: node scripts/enrich-local-brands.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RETAIL = resolve(__dirname, '..', 'data', 'kosovo-retail.json');
const PREFIXES = resolve(__dirname, '..', 'data', 'gs1-prefixes.json');

const table = JSON.parse(readFileSync(PREFIXES, 'utf8'));
const localRanges = table.prefixes
  .filter((p) => p.isLocal)
  .map((p) => {
    const [a, b] = p.range.includes('-') ? p.range.split('-') : [p.range, p.range];
    return { min: Number(a), max: Number(b), country: p.country, countrySq: p.countrySq };
  });

function localRangeFor(barcode) {
  const digits = String(barcode || '').replace(/\D/g, '');
  if (digits.length < 8) return null;
  let normalized = digits;
  if (normalized.length === 12) normalized = `0${normalized}`;
  if (normalized.length === 8) normalized = normalized.padStart(13, '0');
  const prefix = parseInt(normalized.slice(0, 3), 10);
  return localRanges.find((r) => prefix >= r.min && prefix <= r.max) || null;
}

const data = JSON.parse(readFileSync(RETAIL, 'utf8'));
let marked = 0;
let alreadyTrue = 0;

for (const p of data.products) {
  if (p.isLocalBrand === true) {
    alreadyTrue += 1;
    continue;
  }
  const hit = localRangeFor(p.barcode);
  if (!hit) continue; // no local prefix -> leave untouched, never set false
  p.isLocalBrand = true;
  p.localEvidence = `Barkodi ${p.barcode} është i regjistruar në GS1 ${hit.countrySq} (prefiksi ${String(hit.min).padStart(3, '0')}). Kjo tregon ku është regjistruar zotëruesi i markës, jo domosdoshmërisht ku është prodhuar.`;
  p.localEvidenceBasis = 'gs1-prefix';
  marked += 1;
}

data.localBrandEnrichedAt = new Date().toISOString();
writeFileSync(RETAIL, `${JSON.stringify(data, null, 2)}\n`, 'utf8');

const total = data.products.filter((p) => p.isLocalBrand === true).length;
console.log(`rows examined ......... ${data.products.length}`);
console.log(`already isLocalBrand .. ${alreadyTrue}`);
console.log(`newly marked local .... ${marked}  (from a 381 / 390 / 530 GS1 prefix)`);
console.log(`total local now ....... ${total}`);
console.log(`still unknown ......... ${data.products.filter((p) => p.isLocalBrand !== true).length}`);
