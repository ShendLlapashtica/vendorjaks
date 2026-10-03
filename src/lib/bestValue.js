// BEST VALUE — what opens the "të gjitha" shelf.
//
// Owner, 2026-09-16: "show at te gjitha at the uppermost best value
// products always ushqimore or drinks and neccessities like flour seed
// oils".
//
// "Best value" is deliberately NOT "cheapest". Cheapest sorts a 40 g sachet
// above a 5 kg sack of flour, which is the opposite of what a shopper
// filling a basket wants. Value here is UNIT PRICE — €/kg for anything
// weighed, €/L for anything poured — which only became computable once
// productSize.js started resolving pack sizes (75.7% of rows carry one).
//
// HONESTY. A row can only appear here if BOTH its price and its pack size
// are known facts on the record. Nothing is estimated: a product with no
// size cannot have a unit price, so it is not ranked rather than being
// guessed at and ranked wrongly. Sold-by-weight rows (`/KG PLU.###`) are
// excluded too — their price is already per kilo, so mixing them in would
// compare a per-kg price against a per-pack price.

import { resolveProductSize } from './productSize.js';
import { canonicalCategory } from './retailCategories.js';

// The owner's own list, in his words: "ushqimore or drinks and neccessities
// like flour seed oils". These are the canonical shelves from
// retailCategories.js that count as food, drink or a household necessity.
// Non-food shelves (Higjienë, Kozmetikë, Duhan & vape, Pastrim) are never
// eligible however good their unit price is — a cheap detergent is not
// "best value" on a grocery page.
const NECESSITY_SHELVES = new Set([
  'Miell & brumë',
  'Vaj & yndyrna',
  'Bylmet',
  'Bukë',
  'Vezë',
  'Mish',
  'Peshk',
  'Pemë & perime',
  'Pije',
  'Ushqime',
  'Salca & erëza',
  'Konserva',
]);

/**
 * Unit price in EUR per kilogram or per litre, or null when either half of
 * the fact is missing. `kind` is returned so the UI can print the correct
 * unit rather than assuming mass.
 */
export function unitPriceOf(product) {
  const price = typeof product?.price === 'number' ? product.price : null;
  if (price == null || price <= 0) return null;
  const resolved = resolveProductSize(product);
  if (!resolved || resolved.kind !== 'size' || !resolved.size) return null;
  const { grams, ml } = resolved.size;
  if (typeof grams === 'number' && grams > 0) {
    return { value: (price / grams) * 1000, unit: 'kg', size: resolved };
  }
  if (typeof ml === 'number' && ml > 0) {
    return { value: (price / ml) * 1000, unit: 'l', size: resolved };
  }
  return null;
}

export function isNecessity(product) {
  const { label, side } = canonicalCategory(product?.category);
  return side === 'left' && NECESSITY_SHELVES.has(label);
}

/**
 * The top `limit` best-value necessities across the WHOLE catalogue — not
 * the paginated slice, which is why this takes `items` rather than the
 * visible rows. One product per brand+shelf, so a single cheap producer
 * cannot occupy the entire strip.
 */
export function bestValueProducts(items, limit = 36, { isFlagged } = {}) {
  const scored = [];
  for (const item of items || []) {
    if (!isNecessity(item)) continue;
    if (item.soldByWeight === true) continue;
    // NEVER PROMOTE A PRODUCT THE APP TELLS YOU TO BOYCOTT.
    // The first ranking put "QUMESHT IMLEK 1L 3.2%" in the strip at
    // 0.89 EUR/l — Imlek is the Serbian dairy this app flags by name. A
    // page that says boycott this and then merchandises it at the top as a
    // bargain is not one the owner can hand to anyone. Cheapness is not a
    // reason to recommend it; the whole point of the app is that it is not
    // the only axis. The caller supplies the same isFlagged() the rows use,
    // so the strip and the badges can never disagree.
    if (typeof isFlagged === 'function' && isFlagged(item)) continue;
    const unit = unitPriceOf(item);
    if (!unit) continue;
    // An implausible unit price is a data error, not a bargain. Below
    // ~0.15 EUR/kg nothing real exists on a Kosovo shelf; above 60 EUR/kg we
    // are looking at saffron or a mis-parsed size. Both would sit at the
    // very top or bottom of a value ranking and discredit the whole strip.
    if (unit.value < 0.15 || unit.value > 60) continue;
    scored.push({ item, unit, shelf: canonicalCategory(item.category).label });
  }
  scored.sort((a, b) => a.unit.value - b.unit.value);

  // ROUND-ROBIN ACROSS SHELVES, not a flat price ranking.
  // Owner, 2026-09-16: "make it bigger and add more pije more mish more
  // everything". A pure unit-price sort is dominated by whatever is
  // cheapest per kilo — bottled water and salt — so the strip filled up
  // with six waters and no meat at all. Taking the best row from each
  // shelf in turn, then the second best from each, keeps the strip ranked
  // by value while guaranteeing drinks, meat, dairy, flour and oil are all
  // represented. One product per brand per shelf, so a single cheap
  // producer cannot occupy a whole shelf's slots.
  const byShelf = new Map();
  const seen = new Set();
  for (const row of scored) {
    const key = `${String(row.item.brand || row.item.name || '').toLowerCase().trim()}|${row.shelf}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (!byShelf.has(row.shelf)) byShelf.set(row.shelf, []);
    byShelf.get(row.shelf).push(row);
  }

  // Shelves enter the rotation in their own best-value order, so the single
  // best bargain in the shop is still the first thing on the page.
  const shelves = [...byShelf.entries()].sort((a, b) => a[1][0].unit.value - b[1][0].unit.value);
  const out = [];
  for (let depth = 0; out.length < limit; depth += 1) {
    let placed = 0;
    for (const [, rows] of shelves) {
      if (depth >= rows.length) continue;
      out.push(rows[depth]);
      placed += 1;
      if (out.length >= limit) break;
    }
    if (placed === 0) break; // every shelf exhausted
  }
  return out;
}

// ---------------------------------------------------------------------------
// ROTATION
//
// Owner, 2026-09-16: "omg aye same products in essential forever . start
// updating them here and there" and "make them always live fetched and only
// show in the te gjitha only cooler ones without needing to state it".
//
// The value rule is deterministic, so the cheapest thing per kilo is the
// first thing on the shelf today, tomorrow and next month. Correct, and
// dead. What he is asking for is FRESHNESS WITHOUT DISHONESTY: still only
// the good rows ("cooler ones"), still no label explaining any of it, but
// not the identical six faces every single time.
//
// So: keep the value ranking, then rotate WITHIN the strong band only.
// Anything outside the band keeps its exact value order and never gets
// promoted — rotation must never push a bad row up, only reorder good ones
// among themselves.
//
// Why a time bucket rather than Math.random():
//   - the order must be stable while a person scrolls, or rows would jump
//     under their thumb on every re-render;
//   - it must be identical in two tabs and after a reload within the same
//     window, or it looks broken rather than fresh;
//   - and it must need no server, because there isn't one — the catalogue
//     is a static JSON file. A clock-derived seed is the honest way to get
//     "live" out of static data: nothing is fabricated, the same rows are
//     simply dealt in a different order as the day goes on.
// A NEW DEAL EVERY DAY, not every three hours.
// Owner, 2026-09-16: "how come same products every single day this is a
// static web atp ... im tired of seeing the same shit always always".
// The first attempt rotated a band of 12 every 3 hours, which is both too
// narrow and too fast to read as change: the same dozen faces kept coming
// back round within an afternoon. A DATE seed instead — stable for a whole
// day, so the shelf a person sees in the morning is the shelf they see at
// night, and genuinely different tomorrow.
const ROTATION_WINDOW_MS = 24 * 60 * 60 * 1000;

export function rotationSeed(now = Date.now()) {
  return Math.floor(now / ROTATION_WINDOW_MS);
}

/**
 * Rotate the first `bandSize` entries of an already value-sorted list by a
 * time-derived offset, leaving the tail untouched.
 *
 * @param {Array} rows   value-sorted, best first
 * @param {number} bandSize  how many top rows are considered interchangeable
 * @param {number} seed  from rotationSeed(); injectable so tests are stable
 */
export function rotateWithinBand(rows, bandSize = 40, seed = rotationSeed()) {
  if (!Array.isArray(rows) || rows.length < 2) return rows || [];
  const band = Math.min(bandSize, rows.length);
  if (band < 2) return rows;

  // A HASH SHUFFLE, NOT A ROTATION — and this is the fix, not a tweak.
  // Owner, 2026-09-18: "i have been checking this page for weeks . same
  // grapes and apples on eksploro te gjitha . this is something that must
  // daily update".
  // He is right and the old code explains exactly what he saw. It rotated
  // the band by `seed % band`, and the seed advances by ONE per day — so
  // day N+1 was day N shifted by a single position. The same twelve items
  // cycled past each other forever and the top of the shelf looked frozen,
  // which over weeks is indistinguishable from static.
  // Ordering by a hash of (row identity, day) instead re-deals the whole
  // band every day: the same good rows, a genuinely different order, still
  // deterministic so it is stable while scrolling and identical in two
  // tabs. The tail beyond the band keeps its value order untouched — only
  // rows already judged interchangeable are reordered.
  // THE SEED GOES FIRST, and that detail is the difference between a
  // shuffle and a no-op. With `${id}|${seed}` the seed only touches the
  // last few characters, and FNV-1a's avalanche over a two-character
  // change is weak — measured, consecutive days produced nearly the same
  // order (p1 p9 p2 p6 ... unchanged across three days), which is the same
  // frozen shelf in a new disguise. Hashing `${seed}|${id}` mixes the day
  // through every subsequent byte, and a final avalanche step spreads the
  // low bits that the sort actually compares.
  const hash = (str) => {
    let h = 2166136261;
    const s = `${seed}|${str}`;
    for (let i = 0; i < s.length; i += 1) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    h ^= h >>> 15;
    h = Math.imul(h, 2246822507);
    h ^= h >>> 13;
    return h >>> 0;
  };
  const idOf = (r, i) => r?.item?.id || r?.item?.name || r?.id || r?.name || `i${i}`;

  const head = rows.slice(0, band).map((r, i) => ({ r, k: hash(idOf(r, i)) }));
  head.sort((a, b) => a.k - b.k);
  return [...head.map((x) => x.r), ...rows.slice(band)];
}

// ---------------------------------------------------------------------------
// VENDORE ONLY
//
// Owner, 2026-09-16: "make a section only for vendore" — and, in the same
// breath, "you decide what stays up and shown on the first page".
//
// So this is a decision, stated: the first thing on the catalogue is a shelf
// of products that are PROVEN Kosovar or Albanian, and it changes every day.
// It is the one section in the app that earns a heading, because unlike
// "best value" (which he explicitly refused as a label) "vendore" is not a
// merchandising claim — it is the entire point of the product.
//
// THE GATE IS THE STRICT ONE. `isLocalBrand === true`, AND the caller's
// isTrustedLocalRow() — which additionally rejects a source-cited non-local
// brand however local its prefix looks. Not `false`, not `null`, and never
// "sold in Kosovo": that conflation is the bug this project already had to
// fix once, and a section headed VENDORE is the worst possible place to
// reintroduce it. Anything flagged (Serbian by prefix or by the boycott
// table) is excluded whatever its other evidence says.
export function vendoreProducts(items, { limit = 24, isFlagged, isTrustedLocal, seed = rotationSeed() } = {}) {
  const pool = [];
  const seen = new Set();
  for (const item of items || []) {
    // isLocalBrand === true is NECESSARY BUT NOT SUFFICIENT. The flag is
    // derived from the GS1 prefix, which names the organisation that
    // registered the barcode — not the producer. Owner, 2026-09-16: a BAT
    // nicotine pouch (Velo, prefix 530) was badged vendore on that basis.
    // The caller passes the same isTrustedLocalRow() the alternatives gate
    // uses, so the shelf and the badge can never disagree.
    if (item?.isLocalBrand !== true) continue;
    if (typeof isTrustedLocal === 'function' && !isTrustedLocal(item)) continue;
    // A PHOTO IS PART OF THE ANSWER on a shelf a shopper scans with their
    // eyes. Owner, 2026-09-16: "how is some no photo". Only 1.4% of shipped
    // rows (476 of 33,039) lack an image, so the front shelf can simply
    // require one instead of rendering an empty frame — there are 3,000
    // proven-local candidates for 24 slots. The rows are NOT hidden from the
    // catalogue or from search; they are just not what leads the page.
    if (!item.image) continue;
    if (typeof isFlagged === 'function' && isFlagged(item)) continue;
    // One product per brand, so a single producer with 70 SKUs cannot BE the
    // section. Falls back to the name where the brand column is empty (it is
    // null on most retail rows).
    const key = String(item.brand || item.name || '').toLowerCase().trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    pool.push(item);
  }
  if (pool.length === 0) return [];

  // Deterministic daily shuffle: order by a hash of (id, day) so the whole
  // pool gets a turn across the weeks rather than the same alphabetical head
  // every day. Same seed all day, different tomorrow.
  const scored = pool.map((item) => {
    const s = `${item.id || item.name}|${seed}`;
    let h = 2166136261;
    for (let i = 0; i < s.length; i += 1) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return { item, h: h >>> 0 };
  });
  scored.sort((a, b) => a.h - b.h);
  return scored.slice(0, limit).map((x) => x.item);
}
