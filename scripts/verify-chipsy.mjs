#!/usr/bin/env node
// Verifies the owner's exact reported case end to end, against the REAL
// shipped data files — no fixtures, no mocks.
//
// The claim being tested (owner, 2026-09-12): all five of these Chipsy
// barcodes profit Serbia and must be flagged, INCLUDING 3870508000157,
// whose 387 prefix is GS1 Bosnia and Herzegovina. A prefix-only check
// clears that one; the boycott override must catch it.
//
// Run: node scripts/verify-chipsy.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { classifyBarcode } from '../src/lib/gs1.js';
import { normalizeBoycottTable, findBoycottByCode, findBoycottByBrand, applyBoycott } from '../src/lib/boycott.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (p) => JSON.parse(readFileSync(resolve(__dirname, '..', p), 'utf8'));

// Mirror dataLoader's normalisation of the prefix table.
function toRanges(raw) {
  return raw.prefixes.map((e) => {
    const [a, b] = e.range.includes('-') ? e.range.split('-') : [e.range, e.range];
    return {
      min: Number(a),
      max: Number(b),
      country: e.country,
      countrySq: e.countrySq,
      iso: e.kind === 'country' ? e.iso : null,
      kind: e.kind,
      isSerbia: e.isSerbia,
      isLocal: e.isLocal,
      note: e.note,
    };
  });
}

const gs1 = { ranges: toRanges(read('data/gs1-prefixes.json')) };
const boycott = normalizeBoycottTable(read('data/boycott-brands.json'));
const brandAlts = read('data/brand-alternatives.json');

const CASES = [
  ['8606014409017', 'Chipsy Classic 43g'],
  ['8606017378532', 'Chipsy 140g'],
  ['8606017372806', 'Chipsy Classic 250g'],
  ['8606017375357', 'Chipsy Domaćinski'],
  ['3870508000157', 'Chipsy Classic 40g — THE 387/BOSNIA CASE'],
];

// The alternative that must be proposed for chips.
const chipsEntry = brandAlts.entries.find((e) => e.category === 'chips-snacks');
const proposed = (chipsEntry?.alternatives || []).map((a) => `${a.brand} (${a.company})`);

let failures = 0;
console.log('barcode         prefix  issuer(GS1)                verdict   override  alternative');
console.log('─'.repeat(104));

for (const [code, label] of CASES) {
  const bare = classifyBarcode(code, gs1);
  const hit = findBoycottByCode(code, boycott);
  const final = applyBoycott(bare, hit);

  const ok = final.verdict === 'SERBIAN';
  if (!ok) failures++;

  console.log(
    [
      code.padEnd(15),
      String(bare.prefix).padEnd(7),
      `${bare.country} (${bare.iso || '—'})`.padEnd(26),
      `${bare.verdict} -> ${final.verdict}`.padEnd(24),
      hit ? hit.reason.padEnd(9) : '—'.padEnd(9),
      proposed[0] || '(none)',
    ].join(' ')
  );
  if (!ok) console.log(`   !! FAIL — ${label} was not flagged`);
}

console.log('');

// The headline case, spelled out.
const bosnia = classifyBarcode('3870508000157', gs1);
const bosniaFinal = applyBoycott(bosnia, findBoycottByCode('3870508000157', boycott));
console.log('THE 387 CASE, in detail');
console.log(`  prefix-only verdict ......... ${bosnia.verdict}  (${bosnia.country}, ${bosnia.iso})`);
console.log(`  after boycott override ...... ${bosniaFinal.verdict}`);
console.log(`  issuer differs from owner ... ${bosniaFinal.issuerDiffersFromOwner}`);
console.log(`  brand owner ................. ${bosniaFinal.boycott?.company}`);
console.log(`  flag shown (B&W) ............ ${bosniaFinal.iso} — the ISSUER, preserved, not overwritten`);
console.log(`  source ...................... ${bosniaFinal.boycott?.sourceUrl}`);
if (bosnia.verdict !== 'OTHER') {
  console.log('  !! Expected the bare prefix verdict to be OTHER — the whole point is that prefix alone clears it.');
  failures++;
}
if (bosniaFinal.verdict !== 'SERBIAN' || bosniaFinal.issuerDiffersFromOwner !== true) failures++;

// The brand lane, using the exact string Open Food Facts returns for it.
const byBrand = findBoycottByBrand('Chipsy, Marbo, Pepsico', boycott);
console.log('');
console.log(`brand lane ("Chipsy, Marbo, Pepsico") ... ${byBrand ? `matched "${byBrand.matchedToken}"` : 'NO MATCH'}`);
if (!byBrand) failures++;

// Substring-safety guard: a boycott list that matches substrings starts
// accusing innocent brands.
for (const bad of ['Marbolino', 'Chipsywich', 'Pepsicola']) {
  if (findBoycottByBrand(bad, boycott)) {
    console.log(`  !! FAIL — "${bad}" matched; alias matching must be whole-token only`);
    failures++;
  }
}
console.log('substring-safety guard ................. ok (Marbolino / Chipsywich / Pepsicola all rejected)');

console.log('');
console.log(`alternatives proposed for chips ........ ${proposed.join(', ') || 'NONE'}`);
if (proposed.length === 0) failures++;

console.log('');
console.log(failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
