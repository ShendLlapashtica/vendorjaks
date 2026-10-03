#!/usr/bin/env node
// De-duplicates and tidies data/kosovo-stores.json.
//
// The harvest agent found the bug behind this and stalled before fixing it:
// freshly-scraped official branch rows were being merged INTO OpenStreetMap
// rows, and the reconciliation pass then deleted the survivor — losing the
// better of the two records. What it left behind: 1,203 stores, 64 exact
// duplicates on (chain, city, address), and 40 rows with no chain at all.
//
// RULES, chosen so this can never silently delete a real branch:
//
//  1. Two rows are the same branch ONLY when they share a chain AND either
//     (a) the same city and the same NON-EMPTY address, or
//     (b) coordinates within ~60 m of each other.
//     A shared (chain, city, null address) is NOT a match — a chain
//     genuinely has several branches in one city and most of them have no
//     address recorded.
//
//  2. When merging, the surviving row takes the BEST field from either
//     side: a real address beats null, coordinates beat none, hours and
//     phone beat null. Nothing is invented and nothing readable is lost.
//
//  3. A row with no chain is kept, not dropped — it is a real shop someone
//     can walk into. It is only labelled so the UI can group it honestly.
//
//  4. TEXT JUNK IS REPAIRED, NOT DELETED. OSM name tags carry the shop's
//     signage verbatim, so 24 rows arrived wrapped in literal quote
//     characters ("\"Antika\"") and one row has the placeholder chain "."
//     for both chain and name. The quotes are stripped and the placeholder is
//     treated as "no chain" — i.e. it falls into rule 3 and gets labelled,
//     never dropped. A shop whose only recorded name is "." is still a shop,
//     but the UI must not print a full stop as a heading.
//
// This script is safe to run after scripts/merge-stores.mjs: it preserves
// every field on a record, including the owner-paste enrichment, and its
// merge takes the union of both sides rather than a fixed field list.
//
// Run: node scripts/clean-stores.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = resolve(__dirname, '..', 'data', 'kosovo-stores.json');

const norm = (v) =>
  String(v || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9ëç ]/gi, '')
    .trim();

/** Metres between two lat/lng pairs. */
function distance(a, b) {
  if (!a.lat || !a.lng || !b.lat || !b.lng) return Infinity;
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

const better = (a, b) => (a === null || a === undefined || a === '' ? b : a);

function merge(keep, drop) {
  return {
    // Union, not a fixed field list: `...drop` first so any field only the
    // dropped row has (a rating, a storeType, a sourceUrl) survives, then
    // `...keep` so the surviving row wins wherever both have a value.
    ...drop,
    ...keep,
    name: better(keep.name, drop.name),
    city: better(keep.city, drop.city),
    address: better(keep.address, drop.address),
    lat: keep.lat ?? drop.lat ?? null,
    lng: keep.lng ?? drop.lng ?? null,
    hours: better(keep.hours, drop.hours),
    phone: better(keep.phone, drop.phone),
    sourceUrl: better(keep.sourceUrl, drop.sourceUrl),
  };
}

const data = JSON.parse(readFileSync(FILE, 'utf8'));
const input = data.stores || [];

// --- text repair, before anything is compared or merged ------------------
// Runs first so that de-duplication compares repaired strings: '"VEBA"' and
// 'VEBA' are the same shop and must not survive as two rows.
const PLACEHOLDER_NAMES = new Set(['.', '..', '-', '_', '?', 'n/a', 'null', 'unknown']);
let unquoted = 0;
let placeholders = 0;

/** Strips the quote characters OSM signage tags arrive wrapped in. */
function unquote(value) {
  if (typeof value !== 'string') return value;
  let out = value.trim();
  let changed = true;
  while (changed) {
    changed = false;
    const m = out.match(/^["'“”‘’«»](.+)["'“”‘’«»]$/s);
    if (m && m[1].trim()) { out = m[1].trim(); changed = true; }
  }
  return out;
}

for (const s of input) {
  for (const field of ['chain', 'name', 'city', 'address']) {
    if (typeof s[field] !== 'string') continue;
    const fixed = unquote(s[field]);
    if (fixed !== s[field]) { s[field] = fixed; unquoted += 1; }
  }
  // "unknown" is not a schedule. One OSM row carries it literally, and the
  // store list would print it as if it were opening hours.
  if (typeof s.hours === 'string' && PLACEHOLDER_NAMES.has(s.hours.trim().toLowerCase())) {
    s.hours = null;
    placeholders += 1;
  }
  // A placeholder is not a name. Blank it so rule 3 labels the row instead of
  // the UI printing "." as a shop heading.
  for (const field of ['chain', 'name']) {
    if (typeof s[field] === 'string' && PLACEHOLDER_NAMES.has(s[field].trim().toLowerCase())) {
      s[field] = null;
      placeholders += 1;
    }
  }
}

const kept = [];
let mergedAddress = 0;
let mergedProximity = 0;

for (const store of input) {
  const chain = norm(store.chain);
  const addr = norm(store.address);

  let target = -1;
  for (let i = 0; i < kept.length; i++) {
    const k = kept[i];
    if (norm(k.chain) !== chain) continue;

    // (a) same city + same non-empty address
    if (addr && norm(k.address) === addr && norm(k.city) === norm(store.city)) {
      target = i;
      mergedAddress += 1;
      break;
    }
    // (b) within 60 m
    if (distance(k, store) < 60) {
      target = i;
      mergedProximity += 1;
      break;
    }
  }

  if (target === -1) kept.push({ ...store });
  else kept[target] = merge(kept[target], store);
}

// Label chainless rows rather than dropping them — they are real shops.
let unlabelled = 0;
for (const s of kept) {
  if (!s.chain || !String(s.chain).trim()) {
    s.chain = s.name && String(s.name).trim() ? String(s.name).trim() : 'Dyqan i pavarur';
    if (!s.name || !String(s.name).trim()) s.name = s.chain;
    s.chainInferred = true;
    unlabelled += 1;
  }
}

kept.sort(
  (a, b) =>
    String(a.chain || '').localeCompare(String(b.chain || '')) ||
    String(a.city || '').localeCompare(String(b.city || '')) ||
    String(a.name || '').localeCompare(String(b.name || ''))
);

data.stores = kept;
data.count = kept.length;
data.cleanedAt = new Date().toISOString();

writeFileSync(FILE, `${JSON.stringify(data, null, 2)}\n`, 'utf8');

console.log(`stores: ${input.length} -> ${kept.length}`);
console.log(`  merged on same address ... ${mergedAddress}`);
console.log(`  merged within 60 m ....... ${mergedProximity}`);
console.log(`  chainless rows labelled .. ${unlabelled}`);
console.log(`  quoted fields unwrapped .. ${unquoted}`);
console.log(`  placeholder names blanked  ${placeholders}`);
console.log(`  with coordinates ......... ${kept.filter((s) => s.lat && s.lng).length}`);
console.log(`  with address ............. ${kept.filter((s) => s.address).length}`);
