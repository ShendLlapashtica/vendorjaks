#!/usr/bin/env node
// Proves the owner's rule (2026-09-12): "if its sunflower seed oil you must
// not show a kosovar cookie."
//
// Uses the REAL curated data and REAL Open Food Facts category tags.
// Run: node scripts/verify-category-gate.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { categoryFamilyOf, sameCategoryFamily, isMatchableTag } from '../src/lib/categoryFamily.js';
import { normalizeBrandAlternatives, findEntryByBrand, findEntryByCategoryTags } from '../src/lib/brandAlternatives.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (p) => JSON.parse(readFileSync(resolve(__dirname, '..', p), 'utf8'));
const brandAlts = normalizeBrandAlternatives(read('data/brand-alternatives.json'));

// Real OFF categories_tags shapes.
const SUNFLOWER_OIL = [
  'en:plant-based-foods-and-beverages',
  'en:plant-based-foods',
  'en:fats',
  'en:vegetable-fats',
  'en:vegetable-oils',
  'en:sunflower-oils',
];
const COOKIE = [
  'en:plant-based-foods-and-beverages',
  'en:plant-based-foods',
  'en:snacks',
  'en:sweet-snacks',
  'en:biscuits-and-cakes',
  'en:biscuits',
];
const CHIPSY = [
  'en:plant-based-foods-and-beverages',
  'en:plant-based-foods',
  'en:snacks',
  'en:salty-snacks',
  'en:appetizers',
  'en:chips-and-fries',
  'en:crisps',
];
const JUICE = ['en:plant-based-foods-and-beverages', 'en:beverages', 'en:juices-and-nectars', 'en:fruit-juices'];

let failures = 0;
const check = (label, actual, expected) => {
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}  -> ${actual}${ok ? '' : ` (expected ${expected})`}`);
};

console.log('FAMILIES');
console.log(`  sunflower oil -> ${categoryFamilyOf(SUNFLOWER_OIL)}`);
console.log(`  cookie ....... -> ${categoryFamilyOf(COOKIE)}`);
console.log(`  chipsy ....... -> ${categoryFamilyOf(CHIPSY)}`);
console.log(`  juice ........ -> ${categoryFamilyOf(JUICE)}`);
console.log('');

console.log('THE OWNER\'S RULE — oil must never match a cookie');
check('oil vs cookie', sameCategoryFamily(SUNFLOWER_OIL, COOKIE), false);
check('oil vs chipsy', sameCategoryFamily(SUNFLOWER_OIL, CHIPSY), false);
check('oil vs juice', sameCategoryFamily(SUNFLOWER_OIL, JUICE), false);
check('cookie vs chipsy (both "snacks" — must still differ)', sameCategoryFamily(COOKIE, CHIPSY), false);
check('oil vs oil', sameCategoryFamily(SUNFLOWER_OIL, SUNFLOWER_OIL), true);
check('chipsy vs chipsy', sameCategoryFamily(CHIPSY, CHIPSY), true);
console.log('');

console.log('GENERIC TAGS ARE NOT MATCHABLE');
for (const t of ['en:plant-based-foods-and-beverages', 'en:snacks', 'en:foods', 'en:fats']) {
  check(t, isMatchableTag(t), false);
}
for (const t of ['en:crisps', 'en:biscuits', 'en:sunflower-oils']) {
  check(t, isMatchableTag(t), true);
}
console.log('');

console.log('AGAINST THE REAL CURATED MAP (data/brand-alternatives.json)');
const oilEntry = findEntryByCategoryTags(SUNFLOWER_OIL, brandAlts.entries);
console.log(`  sunflower oil -> ${oilEntry ? `${oilEntry.serbianBrand} [${oilEntry.category}]` : 'no entry (honest: nothing curated for oils yet)'}`);
if (oilEntry && !['oil', 'oils', 'cooking-oil'].some((k) => String(oilEntry.category).includes(k))) {
  console.log('  !! FAIL — an oil matched a non-oil curated entry');
  failures++;
}

const chipsEntry = findEntryByCategoryTags(CHIPSY, brandAlts.entries);
const chipsAlt = chipsEntry?.alternatives?.[0];
console.log(`  chipsy -> ${chipsEntry ? `${chipsEntry.serbianBrand} [${chipsEntry.category}] => ${chipsAlt?.brand}` : 'NO MATCH'}`);
check('chipsy still finds its chips pairing', chipsEntry?.category, 'chips-snacks');
check('chipsy alternative is Vipa Chips', chipsAlt?.brand, 'Vipa Chips');

// Brand match must still work and is unaffected by the gate.
const byBrand = findEntryByBrand('Chipsy, Marbo, Pepsico', brandAlts.entries);
check('brand match still resolves Chipsy', byBrand?.category, 'chips-snacks');

console.log('');
console.log(failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
