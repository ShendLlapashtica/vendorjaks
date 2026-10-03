/**
 * Explicit alias map: domain (from product.source) → chain label (from store.chain).
 * Derived from inspection of kosovo-retail.json products and kosovo-stores.json chains.
 * This is the ONLY authority for which domain resolves to which chain.
 *
 * Domains that do not appear in this map resolve to no chain (evidence: 'none').
 */
// A catalogue source maps to a chain GROUP, not a single store name.
//
// Owner, 2026-09-12: "viva chain not only show only places you sourced it
// from so all stores."
//
// The store data spells the Viva group four different ways — "Super Viva"
// (26), "Viva Fresh Store" (111), "SuperMarket Viva" (1) and "VIVA Market"
// (1). Mapping super-viva.com to only the literal string "Super Viva"
// surfaced 26 of 139 Viva locations and hid the rest, which is what the
// owner is objecting to. A source now resolves to every store name in the
// same retail group.
//
// The claim this makes is "this product is in this chain's catalogue, and
// here is the whole chain" — NOT "we have verified this exact shelf". The
// UI says which catalogue the listing came from so that distinction stays
// visible.
const CHAIN_GROUPS = {
  'super-viva.com': ['Super Viva', 'Viva Fresh Store', 'SuperMarket Viva', 'VIVA Market'],
  'vivafresh.com': ['Viva Fresh Store', 'Super Viva', 'SuperMarket Viva', 'VIVA Market'],
  'viva-fresh.com': ['Viva Fresh Store', 'Super Viva', 'SuperMarket Viva', 'VIVA Market'],
  'etc-ks.com': ['ETC', 'Etc'],
  'begmart.com': ['Begmart', 'BEG Market', 'Beg Market'],
  // Owner, 2026-09-12: "for instance interex goes without saying and add
  // all possible stores you can fetch". These chains already have branch
  // data in kosovo-stores.json, so the moment a catalogue for any of them
  // is harvested their locations resolve with no further code change.
  'interex-ks.com': ['Interex'],
  'interex.com': ['Interex'],
  'meridianexpress.com': ['Meridian Express', 'Median Express'],
  'meridian-express.com': ['Meridian Express', 'Median Express'],
  'albimarket.com': ['Albi Market', 'Albi Market Hipermarket'],
  'albi-market.com': ['Albi Market', 'Albi Market Hipermarket'],
  'spar-ks.com': ['SPAR Kosova'],
  'spar.com': ['SPAR Kosova'],
  'maxi-ks.com': ['Maxi Supermarket', 'Maxi', 'MAX Market'],
  'maxi.com': ['Maxi Supermarket', 'Maxi', 'MAX Market'],
  'maximarket.com': ['Maxi Supermarket', 'Maxi', 'MAX Market'],
  'emona.com': ['Emona'],
  'kam.com': ['KAM Market', 'KAM SUPERMARKET'],
  'mymarket.com': ['My Market'],
  'conad-ks.com': ['CONAD Kosova'],
  'benaf.com': ['Ben-Af'],
  'kipper.com': ['Kipper Market'],
  'elkos-group.com': ['ETC', 'Etc', 'Viva Fresh Store'],
  // gjirafamall.com is deliberately absent: it was removed from the
  // catalogue entirely (see scripts/prune-retail.mjs) and is online-only
  // regardless, so it has no branches to show.
};

/**
 * One normalisation, used for EVERY chain comparison in this file.
 *
 * Owner, 2026-09-16, looking at a product page: the panel listed
 * **"Market · 23 pika"** and **"market · 1 pika"** as two different chains.
 * Two separate faults in one line:
 *   - the same word was not case-folded, so it grouped twice;
 *   - a generic word was being treated as a chain name at all.
 *
 * Case-folding is this function. The generic word is isGenericStoreName().
 *
 * Albanian ë/ç are folded to e/c rather than stripped: stripping turned
 * "Kaçanik" into "kaanik" and "Prishtinë" into "prishtin", which made two
 * spellings of one chain look different.
 */
export function normalizeChainName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/ë/g, 'e')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Words that are a SHOP TYPE, not a shop's name.
 *
 * 33 rows in kosovo-stores.json are OpenStreetMap points whose only name tag
 * is a generic word — 23 "Market", 4 "Mini Market", 2 "Minimarket", 2
 * "Supermarket", 1 "market", 1 "minimarket" — and every one of them carries
 * `chainInferred: true`, i.e. scripts/clean-stores.mjs had no chain and fell
 * back to the name. They are real, unnamed corner shops. They are not a
 * chain, they share no owner, and nothing can be known about what any of
 * them stocks.
 *
 * So: a generic word can never be a chain heading, and can never be matched
 * as the retailer that listed a product. The shops themselves are not
 * deleted from the data — they are simply never an answer to "where can I
 * buy this", which is the only honest position.
 *
 * `dyqanipavarur` is here because "Dyqan i pavarur" ("independent shop") is
 * the label clean-stores.mjs gives a row with no name at all; it is a label,
 * not a name, and must not become a chain either.
 */
export const GENERIC_STORE_NAMES = new Set([
  'market',
  'markets',
  'marketi',
  'marketet',
  'minimarket',
  'minimarkets',
  'supermarket',
  'supermarketi',
  'supermarkets',
  'hipermarket',
  'hypermarket',
  'hipermarketi',
  'megamarket',
  'shop',
  'shops',
  'store',
  'stores',
  'grocery',
  'grocerystore',
  'dyqan',
  'dyqani',
  'dyqane',
  'dyqanipavarur',
  'ushqimore',
  'kiosk',
  'bakall',
  'bakalli',
]);

/** True when a name is a shop TYPE rather than a shop's identity. */
export function isGenericStoreName(value) {
  const key = normalizeChainName(value);
  if (!key) return true; // no name at all is not a chain either
  return GENERIC_STORE_NAMES.has(key);
}

/**
 * Store types that cannot answer "you can buy this product here".
 *
 * The owner's 2026-09-16 Google Maps paste brought in venues as well as
 * shops: Central Park, Prishtina Mall, Albi Mall and Royal Mall are shopping
 * malls, and Jumbo is a department store. A mall does not stock groceries —
 * its tenants do — so sending a shopper to one as the place to buy a specific
 * yoghurt is a wrong answer dressed as a helpful one.
 *
 * This is belt-and-braces. The primary protection is that availability is
 * resolved through CHAIN_GROUPS, which only ever names grocery chains, so a
 * mall has no route into an availability answer in the first place. The
 * filter exists so that adding a mall's name to CHAIN_GROUPS by accident
 * cannot turn into a false stock claim, and it is asserted by a test.
 *
 * `sellsGroceries` is only present on records the owner's paste touched. The
 * 1,200 OSM rows have no such field and are NOT filtered out — absent is
 * "unknown", and unknown stays visible. Only an explicit `false` excludes.
 */
export const NON_GROCERY_STORE_TYPES = new Set(['shopping-mall', 'department-store']);

export function sellsGroceries(store) {
  if (!store) return false;
  if (store.sellsGroceries === false) return false;
  if (NON_GROCERY_STORE_TYPES.has(store.storeType)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// WHAT THE PANEL IS ALLOWED TO CLAIM
// ---------------------------------------------------------------------------
// Owner, 2026-09-16: "why show markets when not sourced there."
//
// There are exactly three defensible answers, and the UI must say which one
// it is giving rather than let a list of shop names imply the strongest:
//
//   CLAIM_CHAIN    the product is in a CHAIN's own catalogue (its domain is
//                  in CHAIN_GROUPS), and a chain catalogue is chain-wide, so
//                  its branches are named. Still not a verified shelf.
//   CLAIM_RETAILER one named retailer lists it (a marketplace venue). Only
//                  that retailer's own location(s) are named. Nothing is
//                  said about any other shop.
//   CLAIM_NONE     we cannot verify anywhere. This is a CORRECT answer and
//                  the panel says it in words.
//
// There is deliberately no fourth tier that guesses.
export const CLAIM_CHAIN = 'chain-catalogue';
export const CLAIM_RETAILER = 'retailer-listing';
export const CLAIM_NONE = 'none';

/**
 * Resolves a product's catalogue source (domain only — never brand, never
 * company) to the set of store-chain names belonging to that group.
 *
 * @param {string|null|undefined} source
 * @returns {string[]} chain names, empty when the source maps to nothing
 */
function resolveChain(source) {
  if (!source) return [];
  return CHAIN_GROUPS[String(source).toLowerCase().trim()] || [];
}

// ---------------------------------------------------------------------------
// ALBANIAN LISTINGS ARE NOT KOSOVO AVAILABILITY
// ---------------------------------------------------------------------------
// dataLoader already refuses every `wolt.com/al/*` / "Wolt Shqipëri" row in
// src/lib/dataLoader.js, so in the shipped app such a product never reaches
// this file. This is the second lock on the same door: a Tiranë listing has
// no bearing on where a Prishtina shopper can buy something, and if a
// loader ever changes, availability must still refuse it rather than start
// pointing at Kosovo shops because the venue name happens to contain
// "Market". The owner's report — "Broly's Market, Tiranë (Wolt Shqipëri)"
// followed by 23 Kosovo "Market" rows — is exactly this failure.
const ALBANIAN_SOURCE = /(^|[/.])al[/.]|wolt\.com\/al\/|shqip[eë]ri|tiran[eë]|durr[eë]s|vlor[eë]/i;

export function isAlbanianListing(product) {
  if (!product) return false;
  return ALBANIAN_SOURCE.test(`${product.source || ''} ${product.sourceLabel || ''}`);
}

// ---------------------------------------------------------------------------
// THE RETAILER THAT ACTUALLY LISTED THE PRODUCT
// ---------------------------------------------------------------------------
// Most of the catalogue does not come from a chain's own domain — it comes
// from a delivery marketplace, one venue at a time: `wolt.com/ejona-market`,
// sourceLabel "Ejona Market (Wolt)". CHAIN_GROUPS knows nothing about those,
// so before this change they fell through to findStoresForChain()'s loose
// substring matcher, which is what produced the junk. What it was really
// asserting, for the product the owner was looking at, was:
//
//   "Broly's Market, Tiranë" stocks it  ->  therefore 23 unnamed Kosovo
//   corner shops called "Market" stock it
//
// because normalize() reduced the chain "Market" to "market" and
// `t.includes(chain)` is true for any venue name containing the word. The
// same rule attached "Aias" to "Bonsai Asian Market", "ABI" to "Market
// Korabi", "Albi" to "Big Market" and "Toni" to "Market Onio". Every one of
// those is a fabricated stock claim about a real shop.
//
// The replacement asserts only what the listing supports: the venue named
// in the listing, matched on the WHOLE name after normalisation. Nothing is
// inferred from a shared word.

/** Strips the marketplace suffix a venue label carries: "X (Wolt)" -> "X". */
function venueNameFromLabel(label) {
  if (typeof label !== 'string') return '';
  return label.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

/** Last path segment of a marketplace source: "wolt.com/ejona-market". */
function venueNameFromSource(source) {
  if (typeof source !== 'string' || !source.includes('/')) return '';
  return source.split('/').filter(Boolean).pop() || '';
}

/**
 * Exactly the stores whose own name IS the venue that listed the product.
 * Whole-name equality after normalisation — never a substring, never a
 * shared word, never a brand.
 */
function matchVenue(stores, product) {
  const candidates = [venueNameFromLabel(product.sourceLabel), venueNameFromSource(product.source)]
    .map(normalizeChainName)
    .filter((key) => key && !GENERIC_STORE_NAMES.has(key));
  if (candidates.length === 0) return [];

  const wanted = new Set(candidates);
  return stores.filter((s) => {
    if (!sellsGroceries(s)) return false;
    // A row whose only name is "Market" is an unnamed shop, not a venue we
    // can match — see GENERIC_STORE_NAMES.
    if (isGenericStoreName(s?.chain) && isGenericStoreName(s?.name)) return false;
    return wanted.has(normalizeChainName(s?.chain)) || wanted.has(normalizeChainName(s?.name));
  });
}

/**
 * Finds all stores stocking a product, based on the product's catalogue source.
 * Returns a result object with { stores, chains, evidence }.
 *
 * IMPORTANT: The only honest evidence that a product is stocked is that it appeared
 * in that chain's catalogue. Never use brand, company, or any other fields for matching.
 *
 * @param {Array} stores - kosovo-stores.json's `stores` array
 * @param {Object} product - A product object with at least `source` field
 * @returns {Object} { stores: Array, chains: Array<string>, evidence: 'catalogue' | 'none' }
 */
export function findStoresStockingProduct(stores, product) {
  const nothing = { stores: [], chains: [], evidence: 'none', claim: CLAIM_NONE, sourceLabel: null };

  if (!Array.isArray(stores) || !product) return nothing;
  // A Tiranë listing says nothing about Kosovo. See isAlbanianListing.
  if (isAlbanianListing(product)) return nothing;

  // Two claims, in descending strength. Whichever resolves, the panel says
  // in words which one it is making — see StoreList.
  let matched = [];
  let claim = CLAIM_NONE;

  const groupNames = resolveChain(product.source).filter((n) => !isGenericStoreName(n));
  if (groupNames.length > 0) {
    const wanted = new Set(groupNames.map(normalizeChainName));
    // A shopping mall or department store is never an answer to "where can I
    // buy this" — see sellsGroceries above.
    matched = stores.filter((s) => wanted.has(normalizeChainName(s?.chain)) && sellsGroceries(s));
    if (matched.length > 0) claim = CLAIM_CHAIN;
  }

  if (matched.length === 0) {
    matched = matchVenue(stores, product);
    if (matched.length > 0) claim = CLAIM_RETAILER;
  }

  if (matched.length === 0) return nothing;

  // Every branch, never a truncated sample — city then name.
  matched = [...matched].sort(
    (a, b) =>
      String(a.city || '').localeCompare(String(b.city || '')) ||
      String(a.name || '').localeCompare(String(b.name || ''))
  );

  return {
    stores: matched,
    chains: [...new Set(matched.map((s) => s.chain).filter((c) => c && !isGenericStoreName(c)))],
    evidence: 'catalogue',
    claim,
    sourceLabel: product.sourceLabel || product.source || null,
  };
}

/**
 * The call sites' entry point: `findStoresForChain(stores, [source, label, …])`.
 *
 * WHAT THIS USED TO DO, AND WHY IT IS GONE
 * ----------------------------------------
 * It matched a store when either name contained the other as a SUBSTRING,
 * after stripping punctuation. That is how the owner's product page ended
 * up reading
 *
 *     Broly's Market, Tiranë (Wolt Shqipëri)
 *     Market · 23 pika        market · 1 pika
 *
 * — "market" is a substring of nearly every venue label in the catalogue,
 * so 24 unnamed corner shops were asserted to stock a product listed by a
 * shop in another country. Measured over every distinct source in
 * data/kosovo-retail.json, the old rule attached those same 24 rows to 30
 * different sources, plus matches like "Aias" for "Bonsai Asian Market",
 * "ABI" for "Market Korabi" and "Toni" for "Market Onio".
 *
 * It now resolves through findStoresStockingProduct — whole-name matching
 * only — and returns that function's result object, which StoreList already
 * understands (it accepts both the object and the legacy array). Returning
 * the object is the point: it carries `evidence` and `claim`, so the panel
 * can state what it is asserting instead of leaving a bare list of shops to
 * imply it.
 *
 * `chainCandidates` keeps its shape so the two call sites need no change,
 * but ONLY the first two entries are read: source and sourceLabel. A brand
 * or a company name is never consulted — ChoiceScreen passes them and a
 * product branded "Albi" must not resolve to the Albi Market chain.
 *
 * @param {Array} stores - kosovo-stores.json's `stores` array
 * @param {Array<string|null|undefined>} chainCandidates - [source, sourceLabel, …ignored]
 * @returns {{stores: Array, chains: string[], evidence: string, claim: string, sourceLabel: string|null}}
 */
export function findStoresForChain(stores, chainCandidates) {
  const [source = null, sourceLabel = null] = Array.isArray(chainCandidates) ? chainCandidates : [];
  return findStoresStockingProduct(stores, source || sourceLabel ? { source, sourceLabel } : null);
}
