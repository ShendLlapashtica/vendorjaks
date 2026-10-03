#!/usr/bin/env node
/**
 * Merges the owner's pasted Google-Maps store rows into data/kosovo-stores.json.
 *
 * WHAT THIS IS AND IS NOT
 * ----------------------------------------------------------------------------
 * The 1,200 rows already in kosovo-stores.json were harvested from
 * OpenStreetMap and from chain branch-lists; each carries a `sourceUrl` you
 * can open and re-check. The rows below are DIFFERENT: the owner pasted them
 * out of a Google Maps result set on 2026-09-16. There is no URL to cite and
 * no way to re-fetch them, so every field they contribute is tagged
 * `source: "google-maps-owner-paste"` and listed in `ownerPasteFields`.
 * Nobody downstream should ever mistake an owner-pasted rating for an
 * OSM-verified fact, and a future harvest can re-verify exactly these fields.
 *
 * THE RULES THIS SCRIPT OBEYS (in order of how much damage breaking them does)
 *
 *  1. ENRICH, NEVER DUPLICATE. Most of these places are already in the file
 *     under an OSM/branch-list record with real coordinates. A row is added as
 *     a new store only when no existing record can be identified as the same
 *     branch. A row that matched is never also added.
 *
 *  2. IDENTITY IS A PHONE NUMBER, NOT A NAME. "Meridian Express" appears four
 *     times across the two pastes with four phone numbers — four branches, not
 *     one record seen four times. Matching runs phone → decoded coordinates →
 *     chain+address → (last, and marked low-confidence) a chain that has
 *     exactly one record in the named city.
 *
 *  3. WHEN THE EVIDENCE IS AMBIGUOUS, NOTHING IS WRITTEN. A row that could be
 *     any of several existing branches is parked in `ownerPasteUnresolved`
 *     with its candidates. It is not silently attached to a guess and not
 *     added as a probable duplicate. The owner can settle it in one line.
 *
 *  4. MISSING IS NULL, NEVER ZERO. "No reviews" is `rating: null,
 *     reviewCount: null`. A 0 would be a lie and would sort the store last.
 *
 *  5. A SNAPSHOT IS NOT A SCHEDULE. "Closed · Opens 7 AM" is what Google said
 *     at the moment the owner looked. The transient "Closed" is discarded; the
 *     opening time is kept in `opensAt` and flagged `hoursPartial: true`,
 *     because we know when it opens and NOT when it closes — so it must never
 *     be written into `hours`, which downstream code reads as a full schedule.
 *     "Open 24 hours" IS a complete schedule and does go into `hours` as
 *     `24/7`, the OSM convention already used in this file.
 *
 *  6. NOTHING IS CORRECTED SILENTLY. A malformed or non-Kosovo phone number is
 *     kept verbatim in `phoneRaw` with `phoneFlag` explaining what is wrong,
 *     and is NOT written into `phone` (where the UI would turn it into a
 *     dialable tel: link).
 *
 * Run:  node scripts/merge-stores.mjs            (writes)
 *       node scripts/merge-stores.mjs --dry-run  (prints the plan only)
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = resolve(__dirname, '..', 'data', 'kosovo-stores.json');

const SOURCE_TAG = 'google-maps-owner-paste';
const CAPTURED_AT = '2026-09-16';
const DRY_RUN = process.argv.includes('--dry-run');

// ---------------------------------------------------------------------------
// THE PASTE, VERBATIM
// ---------------------------------------------------------------------------
// Kept as the literal text the owner sent rather than hand-transcribed into
// objects: a hand transcription is a place for a typo to enter data that has
// no source URL to check it against. The parser below is the only thing that
// touches it.

const PASTE_BATCH_1 = String.raw`
Central Park — 4.6 (222) · Shopping mall · Ali Hadri Prishtinë XK · +383 48 675 675 · Closed · Opens 10 AM · "You want to do shopping and eat good that's place for you!"
Market Dardania — 5.0 (17) · Grocery store · 27 Rrugë Sadik Zeneli · +383 44 832 837 · "Great local market with fresh products and friendly staff."
Meridian Express — 4.3 (71) · Supermarket · Rr Nazim Gafurri · +383 49 731 953 · Closed · Opens 7 AM · "Great selection of goods"
KAM — 4.3 (27) · Discount supermarket · Lidhja e Prizrenit · Closed · Opens 8 AM
Kipper — 3.8 (13) · Supermarket · M53M+F7G · "High quality products, lower prices"
Maxi Supermarket 3 — 3.5 (12) · Supermarket · afër Kino ABC, Rexhep Luci · +383 49 772 954 · Closed · Opens 7 AM · "Larger than average supermarket and reasonable prices."
Spar — 4.4 (38) · Supermarket · Pristina, Kosovo · +383 38 349990137 · Closed · Opens 7 AM · "Good selection, large store, nice cafe, underground parking A+++++"
Viva Fresh Store — 4.2 (335) · Supermarket · J5H2+WM · Closed · Opens 7 AM · "Big store, cheap prices"
Jumbo Central Park — 4.4 (294) · Department store · Ali Hadri · +383 48 999 016 · Closed · Opens 9 AM · "In a place with a minimum wage of 170 euros, the prices are surprising."
Prishtina Mall — 4.6 (2.6K) · Shopping mall · M2 (Prishtine - Ferizaj) · +383 38 707 072 · Closed · Opens 9 AM · "Prices are at a similar level to Turkey."
Albi — 4.0 (29) · Supermarket · M544+3QF, Bulevardi Bill Klinton · Closed · Opens 7 AM · "I almost found everything I need"
Interex QKUK — 4.2 (46) · Supermarket · Rr Fehmi Lladrovci · +383 48 160 224 · Closed · Opens 8 AM · "Affordable Prices."
Maxi Supermarket 12 — No reviews · Supermarket · M55H+M87 · +383 49 772 060 · Closed · Opens 7 AM
Viva fresh store 45 — 4.0 (93) · Supermarket · Fushe Kosovo, Kosovo
Interex Prishtinë — 4.0 (4) · Supermarket · Rr.Zahir Pajaziti · +383 48 160 041 · Closed · Opens 7 AM
Albi Market — 3.2 (13) · Grocery store · M44W+QG6, Vicianum · +381 38 500202100 · Closed · Opens 7 AM
Old Market — 4.2 (30) · Market · M598+F4Q · "... are much cheaper than convenience stores and supermarkets."
Interex Fushe Kosove — 4.4 (132) · Supermarket · Rr.Elez Berisha Fushë Kosovë XK · +383 48 160 215 · Closed · Opens 7 AM · "Good prices !"
Maxi Supermarket 10 — No reviews · Supermarket · XK · +383 49 772 021 · Closed · Opens 7 AM
`;

const PASTE_BATCH_2 = String.raw`
Maxi Supermarket 18 — 4.0 (56) · Supermarket · XK · +383 49 773 744 · Open 24 hours · "It will take them a few generations to be integrated with Europe."
Maxi Supermarket 8 - 24h — 4.2 (46) · Supermarket · Rruga B · +383 49 772 968 · Open 24 hours
Maxi Supermarket 13 - 24h — 4.1 (15) · Supermarket · XK · +383 49 934 203 · Open 24 hours
Spar — 3.7 (3) · Supermarket · Rruga B · +383 49 990 147 · Open 24 hours · In-store shopping · Kerbside pickup
Toni Market — 4.2 (49) · Supermarket · Rrugë Haxhi Zeka · Open · Closes 2 AM · "I believe the store is open 24/7"
SPAR Supermarket — 4.0 (27) · Grocery store · Rruga C, Rruga, Enver Maloku · +383 38 729 729 · Closed · Opens 7 AM · "Great place with import items you can't find anywhere else"
Maxi Supermarket 14 — 4.7 (16) · Supermarket · M52C+XHF · +383 49 934 204 · Closed · Opens 7 AM
Interex Mbrapa Teatrit — 3.9 (234) · Supermarket · Rr Rruga Bajram Kelmendi · +383 48 160 418 · Closed · Opens 7 AM · "Huge store with decent variety and accepts card."
Albi Mall — 4.5 (3.5K) · Shopping mall · Zona e Re Industriale, Veternik 10000 Prishtine Prishtina XK · +383 49 771 131 · Closed · Opens 9 AM · "You can buy everything you need without spending too much money"
Royal Mall — 4.3 (508) · Shopping mall · Rruga B · +383 43 900 009 · Closed · Opens 8 AM · "Good prices but have to make sure no defects or stains."
Meridian Express — 4.0 (24) · Supermarket · Rr Hajrullah Abdullahu · +383 49 731 945 · Closed · Opens 7 AM
SPAR Supermarket — 4.4 (21) · Store · Rr Nazim Gafurri · +383 49 990 125 · Closed · Opens 7 AM · "Wonderful international selection"
Maxi Supermarket 17 — 4.1 (15) · Supermarket · XK · +383 49 786 066 · Closed · Opens 7 AM · "Has pretty much all your essentials"
Meridian Express — 4.2 (10) · Supermarket · Fushe Kosovo, Kosovo · +383 49 731 074 · Open 24 hours · In-store shopping · In-store pick-up
Conad Kosova — 4.3 (52) · Grocery store · M44W+PQQ · Closed · Opens 8 AM · "Great place, found many things that nowhere else in Pristina."
Maxi Supermarket 2 — 3.9 (12) · Supermarket · Rrugë Henri Dunan · +383 49 772 938 · Closed · Opens 7 AM
Meridian Express — 4.0 (44) · Supermarket · 1 Rruga B · +383 49 731 071 · Closed · Opens 7 AM · "cool market fridge always full of refreshment nice fruits and vegetables"
Albi Hipermarket (Sheshi George Bush) — 4.3 (23) · Discount supermarket · Sheshi, Xhorxh Bush · Closed · Opens 7 AM · "Limited selection and confusing layout but staff is open to helping."
SPAR Kosova — 4.3 (45) · Supermarket · Çagllavicë, Kosovo · +383 48 402 040 · Closed · Opens 7 AM · "Lots of great products to choose from with parking nearby."
Viva Fresh Store — 3.8 (92) · Supermarket · M44W+FHV, Ahmet Krasniqi · +383 38 408 888 · Closed · Opens 7 AM · On-site services
`;

// ---------------------------------------------------------------------------
// Open Location Code (plus code) decoding
// ---------------------------------------------------------------------------
// Six rows in batch one and three in batch two give a Plus Code instead of a
// street address. A SHORT code like "M53M+F7G" has had its leading four
// characters dropped; those four encode a 1°×1° cell, so the code only means
// anything relative to a locality. Google showed these next to Prishtina
// businesses, so Prishtina is the reference point.
//
// This is the published Open Location Code algorithm (github.com/google/
// open-location-code), implemented here rather than pulled in as a dependency
// — it is ~60 lines and the project has no runtime deps for scripts.
//
// Every decode is then gated three ways before it is allowed to become a
// coordinate (see decodePlusCode): it must round-trip back to the same
// characters, land inside Kosovo, and land within 30 km of the reference. A
// code that fails any gate yields lat/lng null. A store pinned to the wrong
// place is worse than a store with no pin.

const ALPHABET = '23456789CFGHJMPQRVWX';
const SEPARATOR_POSITION = 8;
const GRID_ROWS = 5;
const GRID_COLUMNS = 4;

// Prishtina city centre (Sheshi Skënderbeu), the locality Google resolved
// these short codes against.
const REFERENCE = { lat: 42.6629, lng: 21.1655, label: 'Prishtina city centre' };
const KOSOVO_BBOX = { latMin: 41.85, latMax: 43.27, lngMin: 20.01, lngMax: 21.8 };
const MAX_KM_FROM_REFERENCE = 30;

/** Encodes only the leading `length` characters of the full code for a point. */
function encodePrefix(lat, lng, length) {
  let latVal = Math.min(90, Math.max(-90, lat)) + 90;
  let lngVal = (((lng + 180) % 360) + 360) % 360;
  let out = '';
  let res = 20;
  while (out.length < length) {
    const latDigit = Math.min(19, Math.floor(latVal / res));
    const lngDigit = Math.min(19, Math.floor(lngVal / res));
    out += ALPHABET[latDigit];
    if (out.length < length) out += ALPHABET[lngDigit];
    latVal -= latDigit * res;
    lngVal -= lngDigit * res;
    res /= 20;
  }
  return out;
}

/** Decodes a FULL code to its cell. Returns the cell's centre and size. */
function decodeFull(code) {
  const clean = code.replace(/\+/g, '').replace(/0/g, '').toUpperCase();
  let latLo = -90;
  let lngLo = -180;
  let latRes = 400;
  let lngRes = 400;
  let i = 0;
  for (; i + 1 < clean.length && i < 10; i += 2) {
    latRes /= 20;
    lngRes /= 20;
    latLo += ALPHABET.indexOf(clean[i]) * latRes;
    lngLo += ALPHABET.indexOf(clean[i + 1]) * lngRes;
  }
  for (; i < clean.length; i += 1) {
    latRes /= GRID_ROWS;
    lngRes /= GRID_COLUMNS;
    const d = ALPHABET.indexOf(clean[i]);
    if (d < 0) return null;
    latLo += Math.floor(d / GRID_COLUMNS) * latRes;
    lngLo += (d % GRID_COLUMNS) * lngRes;
  }
  return { lat: latLo + latRes / 2, lng: lngLo + lngRes / 2, latRes, lngRes };
}

/** Recovers the full code for a short code near a reference point. */
function recoverNearest(shortCode, refLat, refLng) {
  const sep = shortCode.indexOf('+');
  const padding = SEPARATOR_POSITION - sep;
  if (padding <= 0 || padding % 2 !== 0) return null;
  const resolution = 20 ** (2 - padding / 2);
  const half = resolution / 2;
  const full = encodePrefix(refLat, refLng, padding) + shortCode.toUpperCase();
  const area = decodeFull(full);
  if (!area) return null;
  let { lat, lng } = area;
  if (refLat + half < lat && lat - resolution >= -90) lat -= resolution;
  else if (refLat - half > lat && lat + resolution <= 90) lat += resolution;
  if (refLng + half < lng && lng - resolution >= -180) lng -= resolution;
  else if (refLng - half > lng && lng + resolution <= 180) lng += resolution;
  return { lat, lng, fullCode: full, cellMetres: Math.round(area.latRes * 111320) };
}

/** Metres between two lat/lng pairs. */
export function metresBetween(a, b) {
  if (!a || !b || a.lat == null || a.lng == null || b.lat == null || b.lng == null) return Infinity;
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const l1 = (a.lat * Math.PI) / 180;
  const l2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(l1) * Math.cos(l2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Decodes a short plus code against the Prishtina reference, refusing the
 * answer unless it passes every verification gate.
 *
 * @returns {{lat:number|null,lng:number|null,method:string,note:string}}
 */
export function decodePlusCode(shortCode, ref = REFERENCE) {
  const code = String(shortCode || '').trim().toUpperCase();
  if (!/^[23456789CFGHJMPQRVWX]{4}\+[23456789CFGHJMPQRVWX]{2,3}$/.test(code)) {
    return { lat: null, lng: null, method: 'refused', note: `not a 4+2/4+3 short plus code: ${shortCode}` };
  }
  const got = recoverNearest(code, ref.lat, ref.lng);
  if (!got) return { lat: null, lng: null, method: 'refused', note: 'recoverNearest failed' };

  // Gate 1 — round trip: re-encoding the decoded point must reproduce the code.
  const roundTrip = encodePrefix(got.lat, got.lng, code.replace('+', '').length);
  const expected = got.fullCode.replace('+', '');
  if (roundTrip !== expected.slice(0, roundTrip.length)) {
    return { lat: null, lng: null, method: 'refused', note: `round-trip mismatch ${roundTrip} != ${expected}` };
  }
  // Gate 2 — inside Kosovo.
  if (
    got.lat < KOSOVO_BBOX.latMin || got.lat > KOSOVO_BBOX.latMax ||
    got.lng < KOSOVO_BBOX.lngMin || got.lng > KOSOVO_BBOX.lngMax
  ) {
    return { lat: null, lng: null, method: 'refused', note: 'decoded outside Kosovo' };
  }
  // Gate 3 — plausibly the same locality as the reference.
  const km = metresBetween({ lat: ref.lat, lng: ref.lng }, got) / 1000;
  if (km > MAX_KM_FROM_REFERENCE) {
    return { lat: null, lng: null, method: 'refused', note: `${km.toFixed(1)} km from ${ref.label}` };
  }
  return {
    lat: Number(got.lat.toFixed(6)),
    lng: Number(got.lng.toFixed(6)),
    method: 'plus-code-recovered',
    note: `short code ${code} recovered against ${ref.label} (${ref.lat},${ref.lng}) -> full ${got.fullCode}, ` +
      `cell ~${got.cellMetres} m, ${km.toFixed(1)} km from reference`,
  };
}

// ---------------------------------------------------------------------------
// Parsing the paste
// ---------------------------------------------------------------------------

const CATEGORY_TYPES = {
  'Supermarket': { storeType: 'supermarket', sellsGroceries: true },
  'Grocery store': { storeType: 'grocery-store', sellsGroceries: true },
  'Discount supermarket': { storeType: 'discount-supermarket', sellsGroceries: true },
  'Market': { storeType: 'market', sellsGroceries: true },
  'Store': { storeType: 'store', sellsGroceries: null },
  'Shopping mall': { storeType: 'shopping-mall', sellsGroceries: false },
  'Department store': { storeType: 'department-store', sellsGroceries: false },
};

const PLUS_CODE_RE = /\b([23456789CFGHJMPQRVWX]{4}\+[23456789CFGHJMPQRVWX]{2,3})\b/;

function to24h(time, meridiem) {
  let h = Number(time);
  if (meridiem.toUpperCase() === 'PM' && h !== 12) h += 12;
  if (meridiem.toUpperCase() === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:00`;
}

/**
 * A Kosovo number is +383 followed by exactly 8 digits. Anything else is kept
 * verbatim and flagged rather than "fixed" — see rule 6 at the top.
 */
function classifyPhone(raw) {
  if (!raw) return { phone: null, phoneRaw: null, phoneFlag: null };
  const digits = raw.replace(/[^\d]/g, '');
  if (/^383\d{8}$/.test(digits)) return { phone: raw.trim(), phoneRaw: raw.trim(), phoneFlag: null };
  if (digits.startsWith('381')) {
    return {
      phone: null,
      phoneRaw: raw.trim(),
      phoneFlag:
        `+381 is the SERBIAN country code; Kosovo is +383. Kept verbatim, not dialable, not corrected. ` +
        `(${digits.length - 3} digits after the country code, a Kosovo number has 8.)`,
    };
  }
  return {
    phone: null,
    phoneRaw: raw.trim(),
    phoneFlag: `malformed: ${digits.length - 3} digits after +383, a Kosovo number has 8. Kept verbatim, not dialable.`,
  };
}

/** Parses one pasted line into a structured row. Throws on anything it cannot read. */
export function parseRow(line, batch) {
  const [namePart, rest] = line.split('—').map((s) => s.trim());
  if (!rest) throw new Error(`no em-dash separator: ${line}`);
  const segs = rest.split('·').map((s) => s.trim()).filter(Boolean);

  // segs[0] is always the rating, segs[1] the Google business category,
  // segs[2] the address line. Everything after that is positional noise
  // (transient open/closed status, services, a review quote) and is
  // classified by shape, never by position.
  const row = {
    raw: line,
    batch,
    name: namePart,
    rating: null,
    reviewCount: null,
    reviewCountApprox: false,
    googleCategory: segs[1] || null,
    addressLine: segs[2] || null,
    plusCode: null,
    phoneRaw: null,
    opensAt: null,
    closesAt: null,
    hours: null,
    reviewQuote: null,
    services: [],
  };

  const ratingSeg = segs[0] || '';
  if (/^no reviews$/i.test(ratingSeg)) {
    // Explicitly null, never 0 — see rule 4.
    row.rating = null;
    row.reviewCount = null;
  } else {
    const m = ratingSeg.match(/^([\d.]+)\s*\(([\d.]+)(K?)\)$/i);
    if (!m) throw new Error(`unreadable rating segment "${ratingSeg}" in: ${line}`);
    row.rating = Number(m[1]);
    row.reviewCount = m[3] ? Math.round(Number(m[2]) * 1000) : Number(m[2]);
    row.reviewCountApprox = Boolean(m[3]); // "2.6K" is ~2600, not 2600 exactly.
  }

  if (!CATEGORY_TYPES[row.googleCategory]) throw new Error(`unknown category "${row.googleCategory}" in: ${line}`);
  Object.assign(row, CATEGORY_TYPES[row.googleCategory]);

  const pc = (row.addressLine || '').match(PLUS_CODE_RE);
  if (pc) {
    row.plusCode = pc[1];
    const remainder = row.addressLine.replace(pc[0], '').replace(/^[,\s]+|[,\s]+$/g, '');
    row.addressLine = remainder || null;
  }
  // "XK" / "Pristina, Kosovo" / "Fushe Kosovo, Kosovo" are country/town stubs,
  // not addresses. Keep the text but never treat it as a matchable address —
  // "Fushe Kosovo" fits every Fushë Kosovë branch of every chain.
  row.addressIsStub =
    !row.addressLine || /^(xk|pristina,? kosovo|fushe kosovo,? kosovo|kosovo)$/i.test(row.addressLine.trim());

  for (const seg of segs.slice(3)) {
    if (/^\+/.test(seg)) { row.phoneRaw = seg; continue; }
    if (/^open 24 hours$/i.test(seg)) { row.hours = '24/7'; continue; }
    if (/^closed$/i.test(seg) || /^open$/i.test(seg)) continue; // transient — discarded, see rule 5
    let m = seg.match(/^Opens\s+(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
    if (m) { row.opensAt = to24h(m[1], m[3]); continue; }
    m = seg.match(/^Closes\s+(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
    if (m) { row.closesAt = to24h(m[1], m[3]); continue; }
    if (/^["“]/.test(seg)) { row.reviewQuote = seg.replace(/^["“]|["”]$/g, ''); continue; }
    row.services.push(seg);
  }

  Object.assign(row, classifyPhone(row.phoneRaw));

  if (row.plusCode) {
    const d = decodePlusCode(row.plusCode);
    row.lat = d.lat;
    row.lng = d.lng;
    row.plusCodeMethod = d.method;
    row.plusCodeNote = d.note;
  } else {
    row.lat = null;
    row.lng = null;
  }

  // The owner's paste sometimes names a city inside the address line. Only an
  // explicitly written city is used; a city is never inferred from a name.
  row.city = null;
  const addrForCity = `${row.name} ${segs[2] || ''}`;
  if (/fush[eë]\s*kosov/i.test(addrForCity)) row.city = 'Fushë Kosovë';
  else if (/çagllavic|cagllavic/i.test(addrForCity)) row.city = 'Çagllavicë';
  else if (/prishtin|pristin/i.test(addrForCity)) row.city = 'Prishtinë';

  row.id = `owner-paste-${batch}-${slug(row.name)}-${(row.phoneRaw || row.plusCode || row.addressLine || 'x')
    .replace(/[^\dA-Za-z]/g, '')
    .slice(-8)
    .toLowerCase()}`;
  return row;
}

function slug(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const digitsOf = (s) => String(s || '').replace(/[^\d]/g, '');

/** Last 8 digits — the subscriber number, ignoring how the country code was written. */
function phoneKey(s) {
  const d = digitsOf(s);
  return d.length >= 8 ? d.slice(-8) : null;
}

const STOPWORDS = new Set(['rr', 'rruga', 'rrugë', 'rruge', 'market', 'supermarket', 'store', 'the', 'kosovo', 'xk', 'nr', 'prishtine', 'prishtina']);
function tokens(s) {
  return norm(s).split(' ').filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

/**
 * Do a pasted row and an existing record plausibly belong to the same brand?
 *
 * Compared against the record's CHAIN, deliberately not its name. Comparing
 * names matched "Central Park" (the mall) to "Interex Fushë Kosovë / Central
 * Park" (a supermarket inside it), "Albi Mall" to "Flying Tiger Copenhagen
 * Albi Mall" (a shop inside it), and "Viva Fresh Store" to a Vushtrri record
 * whose chain is a person's name. A venue and its tenants are not the same
 * business and must not inherit each other's ratings.
 */
function brandCompatible(row, store) {
  const a = tokens(row.name);
  const b = tokens(store.chain);
  if (!a.length || !b.length) return false;
  // The brand is the FIRST word of both. Accepting an overlap anywhere made
  // "Jumbo Central Park" compatible with the chain "Park Market" and
  // "Central Park" with it too — a shared common noun is not a shared brand.
  return a[0] === b[0];
}

/**
 * The row names a city and the record names a different one, and nothing in
 * the record mentions the row's city. Blocks the text-based strategies only —
 * a matching phone number or a coordinate 10 m away beats a city label, which
 * in this file is frequently null, a district, or a mall name.
 */
function cityConflicts(row, store) {
  if (!row.city || !store.city) return false;
  const a = norm(row.city);
  const b = norm(store.city);
  if (a === b || b.includes(a) || a.includes(b)) return false;
  return !norm(`${store.address || ''} ${store.name || ''}`).includes(a);
}

// The whole paste is a Prishtina-area Google Maps result set — that is a fact
// about the source, not an inference about any one row. It is used only to
// narrow "this brand has exactly one record" from nationwide to the region
// the paste actually covers (Jumbo has one Prishtina record and one in
// Prizren, 70 km away).
const PRISHTINA_REGION = { latMin: 42.55, latMax: 42.73, lngMin: 21.0, lngMax: 21.31 };
const PRISHTINA_REGION_CITIES = ['prishtine', 'prishtina', 'fushe kosove', 'cagllavice', 'prishtina mall', 'veternik'];
function inPrishtinaRegion(store) {
  if (store.lat != null && store.lng != null) {
    return (
      store.lat >= PRISHTINA_REGION.latMin && store.lat <= PRISHTINA_REGION.latMax &&
      store.lng >= PRISHTINA_REGION.lngMin && store.lng <= PRISHTINA_REGION.lngMax
    );
  }
  const c = norm(store.city);
  return PRISHTINA_REGION_CITIES.some((x) => c.includes(x));
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

function findMatch(row, stores) {
  // 1 — PHONE. The strongest discriminator: four "Meridian Express" rows have
  //     four different numbers and resolve to four different branches.
  const key = phoneKey(row.phoneRaw);
  if (key && !row.phoneFlag) {
    const hits = stores.filter((s) => phoneKey(s.phone) === key);
    const compatible = hits.filter((s) => brandCompatible(row, s));
    const pool = compatible.length ? compatible : [];
    if (pool.length === 1) {
      return { store: pool[0], method: 'phone', confidence: 'high' };
    }
    if (pool.length > 1) {
      // Same number on several branches (Interex uses one number for two
      // Fushë Kosovë shops) — the address breaks the tie.
      const byAddr = pool.filter((s) => addressAgrees(row, s));
      if (byAddr.length === 1) return { store: byAddr[0], method: 'phone+address', confidence: 'high' };
      return { store: null, method: 'ambiguous', candidates: pool, reason: `phone ${row.phoneRaw} is on ${pool.length} records` };
    }
    if (hits.length && !compatible.length) {
      // A number that matches a record of a different brand is a coincidence,
      // not a match. Fall through to the other strategies.
    }
  }

  // 2 — DECODED COORDINATES. Only when the decode survived every gate.
  if (row.lat != null && row.lng != null) {
    const near = stores
      .filter((s) => s.lat != null && s.lng != null && brandCompatible(row, s))
      .map((s) => ({ s, m: metresBetween(row, s) }))
      .filter((x) => x.m <= 150)
      .sort((a, b) => a.m - b.m);
    if (near.length >= 1) {
      return { store: near[0].s, method: `plus-code ${Math.round(near[0].m)} m`, confidence: 'high' };
    }
  }

  // A SHOPPING MALL is a building full of other people's shops. Its name and
  // address are all over its tenants' records, so every text-based strategy
  // below would attach the mall's 2,600 reviews to the Interex inside it.
  // A mall may only match on a phone number or a decoded coordinate; if
  // neither identified one, the mall is a venue this file does not have.
  if (row.storeType === 'shopping-mall') return { store: null, method: 'new' };

  // 3 — CHAIN + ADDRESS.
  if (!row.addressIsStub && row.addressLine) {
    const hits = stores.filter((s) => brandCompatible(row, s) && !cityConflicts(row, s) && addressAgrees(row, s));
    if (hits.length === 1) return { store: hits[0], method: 'chain+address', confidence: 'high' };
    if (hits.length > 1) {
      return { store: null, method: 'ambiguous', candidates: hits, reason: `address "${row.addressLine}" fits ${hits.length} records of this chain` };
    }
  }

  // 3b — NAME, within a compatible brand ("Albi Hipermarket, (Sheshi George W
  //      Bush)"). Two guards: brand compatibility (without it this step
  //      matched malls to their tenants) and a DISCRIMINATING part — the
  //      match must be carried by the words that are not the brand name.
  //      "Viva fresh store 45" is brand + a number; matching it to the one
  //      OSM node literally called "Viva Fresh Store" would be picking a
  //      branch out of 111 because it happens to be the one spelled plainly.
  const nameHits = stores.filter((s) => {
    if (!brandCompatible(row, s) || cityConflicts(row, s)) return false;
    const chainTokens = new Set(tokens(s.chain));
    const distinctive = tokens(row.name).filter((t) => !chainTokens.has(t));
    if (!distinctive.length) return false;
    const b = norm(`${s.name}`);
    return distinctive.every((t) => b.includes(t));
  });
  if (nameHits.length === 1) return { store: nameHits[0], method: 'name', confidence: 'medium' };

  // 4 — LAST RESORT: this brand has exactly one record in the region the
  //     paste covers. Low confidence, reported, never used to move a
  //     coordinate.
  const chainRows = stores.filter((s) => brandCompatible(row, s) && !cityConflicts(row, s));
  const regional = chainRows.filter(inPrishtinaRegion);
  if (regional.length === 1) {
    return { store: regional[0], method: 'sole-record-for-this-brand-in-the-region', confidence: 'low' };
  }
  if (row.city) {
    const inCity = chainRows.filter((s) => norm(s.city) === norm(row.city));
    if (inCity.length === 1) return { store: inCity[0], method: 'sole-branch-in-city', confidence: 'low' };
  }

  // A verified coordinate with no same-brand record within 150 m is a place
  // this file does not have. Add it — but say so if the brand also has
  // coordinate-less records nearby that it could in principle be.
  if (row.lat != null) {
    return {
      store: null,
      method: 'new',
      coordlessSiblings: chainRows.filter((s) => s.lat == null).length,
      brandChains: [...new Set(chainRows.map((s) => s.chain))],
    };
  }

  if (chainRows.length > 1) {
    return {
      store: null,
      method: 'unresolved',
      candidates: chainRows,
      reason:
        `the brand has ${chainRows.length} records and this row carries no phone, no plus code and no address that identifies one of them`,
    };
  }
  return { store: null, method: 'new', brandChains: [...new Set(chainRows.map((s) => s.chain))] };
}

function addressAgrees(row, store) {
  if (row.addressIsStub || !row.addressLine) return false;
  const b = norm(`${store.address || ''} ${store.name || ''}`);
  if (!b.trim()) return false;
  const a = tokens(row.addressLine);
  if (!a.length) {
    // An address that is nothing but street-words ("Rruga B") still
    // identifies a branch when it matches one exactly.
    const bare = norm(row.addressLine);
    return Boolean(bare) && (norm(store.address) === bare || norm(store.name) === bare);
  }
  const hit = a.filter((t) => b.includes(t)).length;
  // Every token, or a clear majority. A bare 2-of-4 let "Rr.Elez Berisha
  // Fushë Kosovë" match the Central Park branch on "fushe kosove" alone.
  return hit === a.length || (hit >= 2 && hit / a.length >= 0.6);
}

// ---------------------------------------------------------------------------
// Applying
// ---------------------------------------------------------------------------

/** Fields the paste contributes to a record, with provenance attached. */
function pasteFields(row, existing) {
  const out = {};
  const contributed = [];
  const add = (k, v) => { out[k] = v; contributed.push(k); };

  add('rating', row.rating);                       // null when "No reviews"
  add('reviewCount', row.reviewCount);             // null when "No reviews"
  if (row.reviewCountApprox) add('reviewCountApprox', true);
  add('googleCategory', row.googleCategory);
  add('storeType', row.storeType);
  if (row.sellsGroceries !== null) add('sellsGroceries', row.sellsGroceries);
  if (row.reviewQuote) add('reviewQuote', row.reviewQuote);
  if (row.services.length) add('services', row.services);

  // Hours. A full schedule ("Open 24 hours") may fill an empty `hours`.
  // A snapshot may never touch `hours` — see rule 5.
  if (row.hours) {
    if (!existing || !existing.hours || existing.hours === 'unknown') add('hours', row.hours);
    else out.hoursOwnerPaste = row.hours;
  }
  if (row.opensAt) { add('opensAt', row.opensAt); add('hoursPartial', true); }
  if (row.closesAt) { add('closesAt', row.closesAt); add('hoursPartial', true); }

  // Phone. Never overwrite an existing number with a different one; record
  // the disagreement instead.
  if (row.phone) {
    if (!existing || !existing.phone) add('phone', row.phone);
    else if (phoneKey(existing.phone) !== phoneKey(row.phone)) out.phoneOwnerPaste = row.phone;
  }
  if (row.phoneFlag) { add('phoneRaw', row.phoneRaw); add('phoneFlag', row.phoneFlag); }

  out.ownerPasteFields = contributed;
  out.ratingSource = SOURCE_TAG;
  out.ownerPasteCapturedAt = CAPTURED_AT;
  out.ownerPasteName = row.name;
  out.ownerPasteRaw = row.raw;
  return out;
}

function main() {
  const data = JSON.parse(readFileSync(FILE, 'utf8'));
  const before = data.stores.length;

  // Re-running must not pile up duplicates: drop anything a previous run of
  // this script added, then rebuild it from the paste.
  const stores = data.stores.filter((s) => s.source !== SOURCE_TAG);
  const removedFromPreviousRun = data.stores.length - stores.length;
  // ...and strip the previous run's enrichment off the records it touched, so
  // a row that no longer matches does not leave a stale rating behind.
  for (const s of stores) {
    if (s.ratingSource === SOURCE_TAG) {
      for (const f of s.ownerPasteFields || []) delete s[f];
      delete s.ratingSource; delete s.ownerPasteCapturedAt; delete s.ownerPasteName;
      delete s.ownerPasteRaw; delete s.ownerPasteFields; delete s.hoursOwnerPaste;
      delete s.phoneOwnerPaste; delete s.matchMethod; delete s.matchConfidence;
      delete s.matchNote; delete s.coordsSource;
    }
  }

  const rows = [
    ...PASTE_BATCH_1.trim().split('\n').map((l) => parseRow(l.trim(), 1)),
    ...PASTE_BATCH_2.trim().split('\n').map((l) => parseRow(l.trim(), 2)),
  ];

  const report = { matched: [], added: [], unresolved: [] };
  const alreadyMatched = new Set();
  // Matching runs against the file as it was, never against rows this run has
  // just added: otherwise "Jumbo Central Park" matches the "Central Park"
  // shopping-mall record created three rows earlier and inherits its type.
  const baseStores = [...stores];

  for (const row of rows) {
    const m = findMatch(row, baseStores);

    if (m.store && !alreadyMatched.has(m.store)) {
      alreadyMatched.add(m.store);
      Object.assign(m.store, pasteFields(row, m.store));
      m.store.matchMethod = m.method;
      m.store.matchConfidence = m.confidence;
      const notes = [];
      // A plus code can give an existing coordinate-less record a real pin.
      if (row.lat != null && m.store.lat == null) {
        m.store.lat = row.lat;
        m.store.lng = row.lng;
        m.store.coordsSource = `${SOURCE_TAG}: ${row.plusCodeNote}`;
        m.store.ownerPasteFields.push('lat', 'lng');
      }
      if (row.city && m.store.city && norm(row.city) !== norm(m.store.city)) {
        notes.push(`owner paste says city "${row.city}", record says "${m.store.city}" — record kept`);
      }
      if (m.store.phoneOwnerPaste) {
        notes.push(`owner paste phone ${m.store.phoneOwnerPaste} differs from the record's ${m.store.phone} — both kept`);
      }
      // If some OTHER record carries this row's exact name, say so: the match
      // was made on address/phone evidence and the reader deserves to see the
      // record that merely shares the label.
      const namesakes = baseStores.filter(
        (s) => s !== m.store && norm(s.name) === norm(row.name) && brandCompatible(row, s)
      );
      if (namesakes.length) {
        notes.push(
          `another record is literally named "${row.name}" (${namesakes[0].chain} | ${namesakes[0].city || '-'}` +
          `${namesakes[0].lat != null ? ` | ${namesakes[0].lat},${namesakes[0].lng}` : ''}); this row was matched on ` +
          `${m.method} instead, which is the stronger evidence — check if you disagree`
        );
      }
      if (notes.length) m.store.matchNote = notes.join('; ');
      report.matched.push({ row, store: m.store, method: m.method, confidence: m.confidence, notes });
      continue;
    }

    if (m.store && alreadyMatched.has(m.store)) {
      report.unresolved.push({ row, reason: `would have matched a record already claimed by an earlier row (${m.method})`, candidates: [m.store] });
      continue;
    }

    if (m.method === 'ambiguous' || m.method === 'unresolved') {
      report.unresolved.push({ row, reason: m.reason, candidates: m.candidates || [] });
      continue;
    }

    // Genuinely new: no existing record can be identified as this place.
    const rec = {
      chain: row.name,
      name: row.name,
      city: row.city,
      address: row.addressIsStub ? null : row.addressLine,
      lat: row.lat,
      lng: row.lng,
      hours: null,
      phone: null,
      sourceUrl: null, // there is no URL for a paste; inventing one is a lie
      source: SOURCE_TAG,
      ...pasteFields(row, null),
    };
    if (rec.lat != null && rec.city == null &&
        rec.lat > 42.62 && rec.lat < 42.69 && rec.lng > 21.11 && rec.lng < 21.21) {
      rec.city = 'Prishtinë';
      rec.cityInferred = true; // from the verified decoded coordinate, not from the name
    }
    if (rec.lat != null) rec.coordsSource = `${SOURCE_TAG}: ${row.plusCodeNote}`;
    if (m.brandChains && m.brandChains.length && !m.brandChains.includes(rec.chain)) {
      // The file already knows this brand under a different chain label. The
      // record is NOT quietly filed under it: chain membership is what the
      // availability answer means by "stocked here", and a Google label is
      // not evidence of that. The candidate is written down instead.
      rec.chainNote =
        `the file already has this brand as chain "${m.brandChains.join('" / "')}"; kept under the pasted name ` +
        `because nothing in the paste proves this branch belongs to that chain's catalogue`;
    }
    if (m.coordlessSiblings) {
      // Honest about the residual risk: this brand has records with no
      // coordinates at all, so one of them could be this same shop. The new
      // record is kept because it carries a verified pin, a rating and a
      // phone that none of those records have — but the risk is written down
      // rather than hidden.
      rec.possibleDuplicateOf =
        `${m.coordlessSiblings} record(s) of this brand have no coordinates, so one of them could be this shop; ` +
        `no evidence identified which, and this row brings a verified pin they lack`;
    }
    if (row.plusCode && rec.lat == null) {
      rec.plusCodeUnresolved = `${row.plusCode} — ${row.plusCodeNote}`;
    }
    rec.ownerPasteId = row.id;
    stores.push(rec);
    report.added.push({ row, rec });
  }

  stores.sort(
    (a, b) =>
      String(a.chain || '').localeCompare(String(b.chain || '')) ||
      String(a.city || '').localeCompare(String(b.city || '')) ||
      String(a.name || '').localeCompare(String(b.name || ''))
  );

  data.stores = stores;
  data.count = stores.length;
  data.ownerPasteMergedAt = new Date().toISOString();
  data.ownerPasteProvenance = {
    source: SOURCE_TAG,
    capturedAt: CAPTURED_AT,
    rows: rows.length,
    note:
      'Rows the owner pasted from a Google Maps result set. No source URL exists for them; ' +
      'fields they contributed are listed per record in ownerPasteFields. Ratings, review counts ' +
      'and business categories from this source are NOT OSM-verified facts.',
    plusCodeReference: REFERENCE,
  };
  data.ownerPasteUnresolved = report.unresolved.map((u) => ({
    raw: u.row.raw,
    name: u.row.name,
    reason: u.reason,
    ...(u.row.phoneFlag ? { phoneRaw: u.row.phoneRaw, phoneFlag: u.row.phoneFlag } : {}),
    candidates: u.candidates.slice(0, 8).map((c) => `${c.chain} | ${c.name} | ${c.city || '-'} | ${c.address || '-'}`),
  }));

  // ---- report -------------------------------------------------------------
  console.log(`stores: ${before} -> ${stores.length}  (+${stores.length - before})`);
  if (removedFromPreviousRun) console.log(`  (re-run: dropped ${removedFromPreviousRun} rows a previous run added, rebuilt below)`);
  console.log(`pasted rows: ${rows.length}  matched ${report.matched.length}  new ${report.added.length}  unresolved ${report.unresolved.length}`);

  console.log('\n--- MATCHED (enriched, no new record) ---');
  for (const m of report.matched) {
    console.log(
      `  [${m.confidence.padEnd(6)}] ${m.row.name}  ->  ${m.store.chain} | ${m.store.name} | ${m.store.city || '-'} | ` +
      `${m.store.address || 'no address'}   via ${m.method}` +
      (m.notes.length ? `\n              note: ${m.notes.join('; ')}` : '')
    );
  }
  console.log('\n--- NEW (no existing record is this place) ---');
  for (const a of report.added) {
    console.log(
      `  ${a.rec.name} | ${a.rec.city || '-'} | ${a.rec.address || '-'} | ` +
      `${a.rec.lat != null ? `${a.rec.lat},${a.rec.lng}` : 'no coords'} | ${a.rec.storeType}` +
      (a.rec.possibleDuplicateOf ? `
      risk: ${a.rec.possibleDuplicateOf}` : '') +
      (a.rec.chainNote ? `
      chain: ${a.rec.chainNote}` : '')
    );
  }
  console.log('\n--- UNRESOLVED (recorded in ownerPasteUnresolved, NOT written into stores) ---');
  for (const u of report.unresolved) {
    console.log(`  ${u.row.name}: ${u.reason}`);
    for (const c of u.candidates.slice(0, 4)) console.log(`      candidate: ${c.chain} | ${c.name} | ${c.city || '-'} | ${c.address || '-'}`);
  }
  console.log('\n--- PLUS CODES ---');
  for (const r of rows.filter((x) => x.plusCode)) {
    console.log(`  ${r.plusCode.padEnd(9)} ${r.lat != null ? `${r.lat},${r.lng}` : 'REFUSED'}  ${r.plusCodeNote}`);
  }
  console.log('\n--- PHONE FLAGS ---');
  for (const r of rows.filter((x) => x.phoneFlag)) console.log(`  ${r.name}: ${r.phoneRaw}\n      ${r.phoneFlag}`);
  console.log('\n--- NON-GROCERY (excluded from product-availability answers) ---');
  for (const r of rows.filter((x) => x.sellsGroceries === false)) console.log(`  ${r.name} (${r.googleCategory})`);
  console.log('\n--- NO REVIEWS (rating null, never 0) ---');
  for (const r of rows.filter((x) => x.rating === null)) console.log(`  ${r.name}`);

  if (DRY_RUN) {
    console.log('\n[dry run] nothing written');
    return;
  }
  writeFileSync(FILE, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  console.log(`\nwrote ${FILE}`);
}

if (process.argv[1] && process.argv[1].endsWith('merge-stores.mjs')) main();
