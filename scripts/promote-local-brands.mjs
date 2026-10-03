#!/usr/bin/env node
/**
 * promote-local-brands.mjs — resolve `isLocalBrand: null` rows in
 * data/kosovo-retail.json where, and ONLY where, the dataset already holds
 * real evidence.
 *
 *   node scripts/promote-local-brands.mjs --dry     # report, write nothing
 *   node scripts/promote-local-brands.mjs           # write the file
 *
 * ---------------------------------------------------------------------------
 * WHAT WAS ASKED FOR, AND WHAT THE DATA ACTUALLY SUPPORTS
 * ---------------------------------------------------------------------------
 * The brief proposed resolving the 51,757 `isLocalBrand: null` rows by
 * looking for "a Kosovo/Albania GS1 prefix (381/390/530) on a barcode".
 * Measured before writing any code:
 *
 *     null rows:                        51,757
 *     ...of which carry ANY barcode:        20
 *     ...of which classify LOCAL:            0
 *
 * The null bucket is null *because* those rows have no barcode — a barcode
 * is the only evidence the harvest ever used. So that route yields nothing,
 * and saying so is the honest answer rather than inventing a second-best
 * signal and calling it evidence.
 *
 * ---------------------------------------------------------------------------
 * THE ROUTE THAT DOES WORK: BRAND-LEVEL TRANSFER, WITH GUARDS
 * ---------------------------------------------------------------------------
 * Some brands appear in the file BOTH with a barcode (proven local by GS1
 * prefix, `isLocalBrand: true`) and without one (`null`). "Peja" is proven
 * Kosovar by prefix 390 on 50 rows and unproven on 73 more, purely because
 * those 73 listings carry no number. Carrying the proven brand verdict
 * across to the same brand's unnumbered rows is the same standard of
 * evidence matcher.js's own gate already accepts (a candidate with no
 * barcode at all is admitted when its BRAND is in the curated local set).
 *
 * Four guards, all of which must pass:
 *
 *   1. The brand must have at least TWO DISTINCT proven-local barcodes in
 *      this file. One row is a data point; two independently-registered
 *      GTINs under the same brand is a pattern. (This alone rejects
 *      "Bravo" — 392 null rows, but its single proven row repeats one
 *      barcode, 5306000077901, and Bravo is Rauch's Austrian juice brand.)
 *   2. The brand must not be on data/boycott-brands.json. This rejects
 *      "Jaffa": 92 rows on Albanian prefix 530 are flagged local in the
 *      file today, and the app's own boycott table calls that brand
 *      "Jaffa Crvenka (serbia)".
 *   3. The brand must not be on data/brand-alternatives.json's
 *      `nonLocalBrands` (source-cited: Kellogg's, Top Budget).
 *   4. The brand's proven evidence must be a GS1 PREFIX, not the softer
 *      "Begmart's own Origjina field" — the shop's own origin label is good
 *      enough for the row it is written on, not for transferring to others.
 *
 * `null` is never *assumed* local. A row is promoted only with a written
 * `localEvidence` naming the brand, the prefix and the exact barcode the
 * verdict came from, so the claim is auditable from the row itself.
 *
 * SIZE. data/kosovo-retail.json is already 76.6 MB and dataLoader fetches
 * the whole thing on every app load, so the evidence string is kept to one
 * line and only written on the rows actually promoted (a few hundred), not
 * on the 51,757.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'data', 'kosovo-retail.json');
const DRY = process.argv.includes('--dry');

const { classifyBarcode, VERDICT } = await import(`file:///${ROOT}/src/lib/gs1.js`);
const { normalizeBoycottTable, findBoycottByBrand } = await import(`file:///${ROOT}/src/lib/boycott.js`);
const { normalizeBrandAlternatives, buildNonLocalBrandSet } = await import(
  `file:///${ROOT}/src/lib/brandAlternatives.js`
);

const readJson = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
// Serve /data/*.json from disk so dataLoader's own normalisers can be
// reused rather than re-implemented (the prefix table needs building into
// ranges before classifyBarcode can read it).
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  const u = String(url);
  if (u.startsWith('/data/')) {
    const fp = path.join(ROOT, u);
    if (!fs.existsSync(fp)) return { ok: false, status: 404, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => JSON.parse(fs.readFileSync(fp, 'utf8')) };
  }
  return realFetch(url, opts);
};
const { loadGs1Prefixes } = await import(`file:///${ROOT}/src/lib/dataLoader.js`);
const gs1 = await loadGs1Prefixes();
if (gs1.isFallback) throw new Error('GS1 table fell back to the built-in list; refusing to write on weak data');
const boycott = normalizeBoycottTable(readJson('data/boycott-brands.json'));
const nonLocal = buildNonLocalBrandSet(normalizeBrandAlternatives(readJson('data/brand-alternatives.json')));

const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const rows = Array.isArray(raw?.products) ? raw.products : Array.isArray(raw) ? raw : null;
if (!rows) throw new Error('kosovo-retail.json: no products array');

const key = (b) => String(b || '').toLowerCase().trim();

// --- Step 1: which brands are proven local by GS1 prefix, and how strongly?
const proof = new Map(); // brand key -> { brand, barcodes:Set, evidence }
for (const r of rows) {
  if (r.isLocalBrand !== true || !r.brand || !r.barcode) continue;
  if (!/GS1 barcode prefix/i.test(String(r.localEvidence || ''))) continue; // guard 4
  const v = classifyBarcode(r.barcode, gs1);
  if (v.verdict !== VERDICT.LOCAL) continue;
  const k = key(r.brand);
  if (!proof.has(k)) proof.set(k, { brand: r.brand, barcodes: new Set(), country: v.country, prefix: String(r.barcode).slice(0, 3) });
  proof.get(k).barcodes.add(String(r.barcode));
}

const eligible = new Map();
const rejected = [];
for (const [k, p] of proof) {
  if (p.barcodes.size < 2) { rejected.push([p.brand, `only ${p.barcodes.size} distinct proven barcode`]); continue; } // guard 1
  const boy = findBoycottByBrand(p.brand, boycott);
  if (boy) { rejected.push([p.brand, `boycott-listed: ${boy.brand} (${boy.country})`]); continue; } // guard 2
  if ([...nonLocal].some((n) => k === n || k.split(/[^a-z0-9]+/).includes(n))) { // guard 3
    rejected.push([p.brand, 'on nonLocalBrands']);
    continue;
  }
  eligible.set(k, p);
}

console.log('BRANDS PROVEN LOCAL BY GS1 PREFIX IN THIS FILE');
for (const [k, p] of proof) {
  const ok = eligible.has(k);
  console.log(`  ${ok ? 'USE ' : 'skip'} ${p.brand.padEnd(18)} ${String(p.barcodes.size).padStart(4)} distinct proven barcode(s)`);
}
if (rejected.length) {
  console.log('\nREJECTED, and why:');
  rejected.forEach(([b, why]) => console.log(`  ! ${String(b).padEnd(18)} ${why}`));
}

// --- Step 2: promote null rows of those brands.
let promoted = 0;
const perBrand = new Map();
for (const r of rows) {
  if (r.isLocalBrand === true || r.isLocalBrand === false) continue;
  if (!r.brand) continue;
  const p = eligible.get(key(r.brand));
  if (!p) continue;
  const witness = [...p.barcodes].sort()[0];
  r.isLocalBrand = true;
  r.localEvidence = `brand "${p.brand}" is proven ${p.country} by GS1 barcode prefix ${p.prefix} on barcode ${witness} elsewhere in this dataset; this listing carries no barcode of its own`;
  r.localEvidenceKind = 'brand-transfer';
  promoted++;
  perBrand.set(p.brand, (perBrand.get(p.brand) || 0) + 1);
}

const before = { t: 0, f: 0, n: 0 };
for (const r of rows) {
  if (r.isLocalBrand === true) before.t++;
  else if (r.isLocalBrand === false) before.f++;
  else before.n++;
}

console.log(`\nPROMOTED: ${promoted} rows`);
[...perBrand.entries()].sort((a, b) => b[1] - a[1]).forEach(([b, n]) => console.log(`  ${b.padEnd(18)} ${n}`));
console.log(`\nisLocalBrand after: true ${before.t} / false ${before.f} / null ${before.n}`);

if (DRY) {
  console.log('\n--dry: nothing written.');
} else if (promoted > 0) {
  // Same 2-space formatting the harvest writes, so the diff is the
  // promoted rows and nothing else.
  fs.writeFileSync(FILE, JSON.stringify(raw, null, 2) + String.fromCharCode(10));
  console.log(`\nwrote ${FILE} (${(fs.statSync(FILE).size / 1e6).toFixed(1)} MB)`);
} else {
  console.log('\nnothing to promote; file untouched.');
}
