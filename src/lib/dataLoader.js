// Loads the data files produced by the dataset scripts:
//   /data/gs1-prefixes.json
//   /data/local-products.json
//   /data/category-index.json
//   /data/brand-alternatives.json
//
// These files may not exist yet, may be temporarily unreachable, or may
// arrive in one of a few reasonable shapes (an array at the top level, or an
// object wrapping the array/map under an obvious key). This loader is
// deliberately defensive about shape so the app degrades honestly instead of
// crashing while the dataset is still being built or served.

import { normalizeBrandAlternatives } from './brandAlternatives.js';
import { normalizeProductOrigins } from './productOrigins.js';
import { normalizeBoycottTable } from './boycott.js';
import { loadCountryStance } from './countryStance.js';

async function fetchJson(path) {
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Failed to load ${path}: HTTP ${res.status}`);
  }
  return res.json();
}

// --- gs1-prefixes.json -----------------------------------------------------

// Minimal resilience fallback used ONLY when data/gs1-prefixes.json cannot be
// loaded (missing, still being built, network error). It mirrors the facts
// the app was briefed with, not a second "real" source of truth — the moment
// the real file loads successfully it takes over completely.
// 2026-09-12: 390 was previously labelled "Montenegro (legacy Kosovo range)".
// That was wrong in both directions — 389 is GS1 Montenegro, and 390 is the
// range Kosovo producers used before Kosovo's own 381 existed. Corrected, and
// 389 (which was missing entirely) added.
const FALLBACK_PREFIX_RANGES = [
  { min: 860, max: 860, country: 'Serbia', countrySq: 'Serbi', iso: 'RS', kind: 'country', isSerbia: true, isLocal: false },
  { min: 381, max: 381, country: 'Kosovo', countrySq: 'Kosovë', iso: 'XK', kind: 'country', isSerbia: false, isLocal: true },
  { min: 390, max: 390, country: 'Kosovo (legacy range)', countrySq: 'Kosovë (rreze e vjetër)', iso: 'XK', kind: 'country', isSerbia: false, isLocal: true },
  { min: 530, max: 530, country: 'Albania', countrySq: 'Shqipëri', iso: 'AL', kind: 'country', isSerbia: false, isLocal: true },
  { min: 389, max: 389, country: 'Montenegro', countrySq: 'Mal i Zi', iso: 'ME', kind: 'country', isSerbia: false, isLocal: false },
  { min: 387, max: 387, country: 'Bosnia and Herzegovina', countrySq: 'Bosnjë e Hercegovinë', iso: 'BA', kind: 'country', isSerbia: false, isLocal: false },
  { min: 385, max: 385, country: 'Croatia', countrySq: 'Kroaci', iso: 'HR', kind: 'country', isSerbia: false, isLocal: false },
  { min: 531, max: 531, country: 'North Macedonia', countrySq: 'Maqedoni e Veriut', iso: 'MK', kind: 'country', isSerbia: false, isLocal: false },
  { min: 383, max: 383, country: 'Slovenia', countrySq: 'Slloveni', iso: 'SI', kind: 'country', isSerbia: false, isLocal: false },
  { min: 380, max: 380, country: 'Bulgaria', countrySq: 'Bullgari', iso: 'BG', kind: 'country', isSerbia: false, isLocal: false },
  { min: 868, max: 869, country: 'Türkiye', countrySq: 'Turqi', iso: 'TR', kind: 'country', isSerbia: false, isLocal: false },
  { min: 400, max: 440, country: 'Germany', countrySq: 'Gjermani', iso: 'DE', kind: 'country', isSerbia: false, isLocal: false },
  { min: 800, max: 839, country: 'Italy', countrySq: 'Itali', iso: 'IT', kind: 'country', isSerbia: false, isLocal: false },
];

const FALLBACK_DISCLAIMER = {
  sq: 'Prefiksi GS1 tregon vetëm organizatën ku është regjistruar barkodi, jo domosdoshmërisht origjinën e prodhimit të produktit.',
  en: 'A GS1 prefix only identifies the organisation the barcode is registered with — not necessarily the product’s country of manufacture.',
};

function toInt(value) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
}

/** Normalizes one raw prefix-table record into {min, max, country, countrySq, isSerbia, isLocal}. */
function normalizePrefixEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;

  let min = null;
  let max = null;

  if (Array.isArray(raw.range) && raw.range.length === 2) {
    min = toInt(raw.range[0]);
    max = toInt(raw.range[1]);
  } else if (typeof raw.range === 'string' && raw.range.includes('-')) {
    const [a, b] = raw.range.split('-');
    min = toInt(a);
    max = toInt(b);
  } else if (typeof raw.range === 'string') {
    min = max = toInt(raw.range);
  } else if (raw.rangeStart != null || raw.rangeEnd != null) {
    min = toInt(raw.rangeStart ?? raw.rangeEnd);
    max = toInt(raw.rangeEnd ?? raw.rangeStart);
  } else if (raw.prefixStart != null || raw.prefixEnd != null) {
    min = toInt(raw.prefixStart ?? raw.prefixEnd);
    max = toInt(raw.prefixEnd ?? raw.prefixStart);
  } else if (raw.from != null || raw.to != null) {
    min = toInt(raw.from ?? raw.to);
    max = toInt(raw.to ?? raw.from);
  } else if (raw.prefix != null) {
    min = max = toInt(raw.prefix);
  } else if (raw.code != null) {
    min = max = toInt(raw.code);
  }

  if (min == null || max == null) return null;
  if (min > max) [min, max] = [max, min];

  const country =
    raw.country || raw.countryName || raw.name || raw.issuingCountry || raw.iso || 'Unknown';
  const countrySq = raw.countrySq || raw.countryAl || raw.nameSq || country;

  // 'country' | 'restricted' | 'coupon' | 'isbn' | 'issn' | 'refund' |
  // 'office' | 'unassigned'. Absent in older builds of the file, where every
  // entry was a country — default accordingly so an old file still works.
  const kind = raw.kind || 'country';

  // ISO 3166-1 alpha-2, used to draw the flag. Deliberately only kept for
  // real countries: a coupon or ISBN range must never render a flag.
  const iso = kind === 'country' ? raw.iso || raw.isoCode || raw.cc || null : null;

  const isSerbia =
    raw.isSerbia === true || /serbia|serbi/i.test(String(country)) || min === 860;
  const isLocal =
    raw.isLocal === true ||
    raw.isKosovo === true ||
    raw.isAlbania === true ||
    [381, 390, 530].includes(min);

  return { min, max, country, countrySq, iso, kind, isSerbia, isLocal, note: raw.note || null };
}

function normalizePrefixTable(raw) {
  let list = null;
  let disclaimer = null;

  if (Array.isArray(raw)) {
    list = raw;
  } else if (raw && typeof raw === 'object') {
    list = raw.prefixes || raw.entries || raw.ranges || raw.table || raw.data;
    if (raw.disclaimer) {
      disclaimer =
        typeof raw.disclaimer === 'object'
          ? { sq: raw.disclaimer.sq || raw.disclaimer.al, en: raw.disclaimer.en }
          : { sq: raw.disclaimer, en: raw.disclaimerEn || raw.disclaimer };
    }
  }

  if (!Array.isArray(list)) return null;

  const ranges = list.map(normalizePrefixEntry).filter(Boolean);
  if (ranges.length === 0) return null;

  return { ranges, disclaimer: disclaimer || FALLBACK_DISCLAIMER };
}

export async function loadGs1Prefixes() {
  try {
    const raw = await fetchJson('/data/gs1-prefixes.json');
    const normalized = normalizePrefixTable(raw);
    if (normalized) {
      return { ...normalized, isFallback: false };
    }
    throw new Error('gs1-prefixes.json had an unrecognised shape');
  } catch (err) {
    console.warn('[vendorja] using built-in fallback GS1 prefix table:', err.message);
    return { ranges: FALLBACK_PREFIX_RANGES, disclaimer: FALLBACK_DISCLAIMER, isFallback: true };
  }
}

// --- local-products.json ----------------------------------------------------

function normalizeProduct(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const code = String(raw.code ?? raw.barcode ?? '').trim();
  if (!code) return null;
  return {
    code,
    name: raw.name || raw.product_name || raw.productName || null,
    brand: raw.brand || raw.brands || null,
    categoriesTags: Array.isArray(raw.categoriesTags)
      ? raw.categoriesTags
      : Array.isArray(raw.categories_tags)
      ? raw.categories_tags
      : [],
    image: raw.image || raw.image_front_small_url || raw.imageUrl || null,
    quantity: raw.quantity || null,
    country: raw.country || raw.countryCode || null, // 'kosovo' | 'albania' | similar
  };
}

export async function loadLocalProducts() {
  try {
    const raw = await fetchJson('/data/local-products.json');
    const list = Array.isArray(raw) ? raw : raw?.products || raw?.data || [];
    const products = list.map(normalizeProduct).filter(Boolean);
    return { byCode: new Map(products.map((p) => [p.code, p])), products, isFallback: false };
  } catch (err) {
    console.warn('[vendorja] local-products.json not available yet:', err.message);
    return { byCode: new Map(), products: [], isFallback: true };
  }
}

// --- category-index.json ----------------------------------------------------

export async function loadCategoryIndex() {
  try {
    const raw = await fetchJson('/data/category-index.json');
    const map = new Map();
    const source =
      (raw?.index && typeof raw.index === 'object' && raw.index) ||
      (raw?.tags && typeof raw.tags === 'object' && raw.tags) ||
      (Array.isArray(raw) ? null : raw);
    if (source && typeof source === 'object') {
      for (const [tag, entry] of Object.entries(source)) {
        const codes = Array.isArray(entry) ? entry : entry?.codes || [];
        map.set(tag, { count: entry?.count ?? codes.length, codes });
      }
    }
    if (map.size === 0) throw new Error('category-index.json was empty or unrecognised');
    return { index: map, isFallback: false };
  } catch (err) {
    console.warn('[vendorja] category-index.json not available yet:', err.message);
    return { index: new Map(), isFallback: true };
  }
}

// --- brand-alternatives.json -------------------------------------------------

export async function loadBrandAlternatives() {
  try {
    const raw = await fetchJson('/data/brand-alternatives.json');
    const normalized = normalizeBrandAlternatives(raw);
    if (normalized.entries.length === 0) throw new Error('brand-alternatives.json had no usable entries');
    return { ...normalized, isFallback: false };
  } catch (err) {
    console.warn('[vendorja] brand-alternatives.json not available yet:', err.message);
    return { entries: [], gaps: [], disclaimer: null, isFallback: true };
  }
}

// --- local-catalogs.json -----------------------------------------------------
// Best-effort research notes on genuinely-local e-commerce/brand storefronts
// (see brandAlternatives.js's buildCuratedLocalBrandSet). Not a hard app
// dependency — an empty/missing file just means the curated-brand fallback
// relies on brand-alternatives.json alone.

export async function loadLocalCatalogs() {
  try {
    const raw = await fetchJson('/data/local-catalogs.json');
    const usable = Array.isArray(raw?.usable) ? raw.usable : [];
    return { usable, isFallback: false };
  } catch (err) {
    console.warn('[vendorja] local-catalogs.json not available:', err.message);
    return { usable: [], isFallback: true };
  }
}

// --- kosovo-retail.json ------------------------------------------------------
// The PRIMARY dataset for the home catalogue grid, built by the
// harvest scripts scraping Kosovo supermarket chains (Viva Fresh, Super Viva, etc).
// May not exist yet, or may exist with 0 rows while it's still being built —
// both cases degrade to an empty (never fake) list, and the caller falls
// back to the existing local-products.json pool for the grid.
//
// HONESTY RULE: `isLocalBrand` on each product is `true | false | null`.
// Only `true` may ever be shown as a local/"vendore" badge — `false`/`null`
// means "sold in Kosovo" at most, not "made by a Kosovo brand" (the exact
// bug this project already had to fix once for the alternatives grid).

function normalizeRetailProduct(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id ?? raw.code ?? raw.barcode ?? raw.url ?? '').trim();
  const name = raw.name || raw.product_name || null;
  if (!id && !name) return null;
  return {
    id: id || `${raw.source || 'retail'}-${name}`,
    source: raw.source || null,
    sourceLabel: raw.sourceLabel || raw.source || null,
    name,
    brand: raw.brand || null,
    category: raw.category || null,
    price: typeof raw.price === 'number' ? raw.price : raw.price != null ? Number(raw.price) || null : null,
    currency: raw.currency || null,
    image: raw.image || null,
    url: raw.url || null,
    barcode: raw.barcode ? String(raw.barcode).trim() : null,
    // Deliberately NOT coerced to a boolean — null is a distinct, meaningful
    // "we don't know" state that must never render as either badge.
    isLocalBrand: raw.isLocalBrand === true ? true : raw.isLocalBrand === false ? false : null,
    localEvidence: raw.localEvidence || null,
    // HOW MUCH IS IN THE PACK. scripts/harvest-more.mjs has been writing
    // `quantity` ("520 g") and `quantitySource` onto 68.3% of rows since
    // 2026-09-14, and this whitelist was silently dropping both at load
    // time, so the UI could never show a size no matter what the data held
    // (harvest-more.mjs flagged this itself and could not fix it — it does
    // not own src/). src/lib/productSize.js reads this field FIRST and only
    // parses the title when it is null, so the pipeline's answer always
    // wins and one product can never show two different sizes.
    quantity: raw.quantity || null,
    quantitySource: raw.quantitySource || null,
    // Loose goods listed per kilo ("RRUSH I ZI /KG PLU.152"). Not a missing
    // size — a different kind of answer, and the UI says so in words.
    soldByWeight: raw.soldByWeight === true ? true : null,
  };
}

// Sources the app refuses to show, enforced at LOAD time.
//
// Owner, 2026-09-12: "ushqime and pije from gjirafa is so wrong remove em
// all". scripts/prune-retail.mjs strips these from the data file, but a
// harvest run overwrote the file and brought all 747 GjirafaMall rows
// straight back — so the rule is enforced here too, where no background job
// can undo it.
//
// Why GjirafaMall specifically: it is a marketplace, not a grocer. Every row
// sat under one category, and `brand` held the SELLER rather than the
// product's brand (Lavazza coffee under "TuttoCapsule", vitamins under
// "Royal Parfumes"). Brand is what the boycott override and the alternatives
// matcher key on, so those rows can produce a confidently WRONG verdict.
//
// ALBANIA. Owner, 2026-09-16: "why wolt shqiperi albania tirane this is
// kosovo onnly" / "why show markets when not sourced there".
//
// 58,158 of the 90,133 rows (64.5%) came from `wolt.com/al/*` — Wolt
// ALBANIA. Two independent reasons they cannot ship, either one fatal:
//
//   1. THE PRICES ARE IN A DIFFERENT CURRENCY AND MISLABELLED. Every row in
//      the file carries `currency: "EUR"` — it is the only value present —
//      but the Albanian rows are quoted in Albanian Lek. Measured against
//      the same product on a Kosovo source:
//        Coca Cola 2Lt   (Wolt AL, Tiranë) ->   199 "EUR"
//        Coca Cola 2l    (Begmart, Kosovo) ->  1.35  EUR
//      That is where the owner's "500.00 EUR" deodorant and "99.00 EUR"
//      rice drink came from: ~100x inflated, on 64.5% of the catalogue.
//      Median price across the file was 150 "EUR" for groceries.
//
//   2. A SHOPPER IN PRISHTINA CANNOT SHOP IN TIRANË. These rows fed the
//      "ku ta blesh afër" ("where to buy nearby") panel with shops in
//      another country — "ky produkt shitet te: Big Market, Tiranë".
//      Availability is the one claim on that screen and it was false.
//
// NOTE WHAT THIS DOES *NOT* DO. Albanian BRANDS remain first-class local
// alternatives — that is the entire premise of the app (Kosovar/Albanian
// vs. Serbian) and `brand-alternatives.json`, the GS1 530 prefix and the
// local-brand gate are all untouched. What is blocked is Albanian RETAIL
// LISTINGS being presented as Kosovo shelf stock at Lek prices labelled
// EUR. Nothing is deleted from the data file; it is refused at load.
const BLOCKED_SOURCES = [/gjirafa/i, /wolt\.com\/al\//i, /Wolt Shqipëri/i];

function isBlockedSource(product) {
  const hay = `${product?.source || ''} ${product?.sourceLabel || ''}`;
  return BLOCKED_SOURCES.some((re) => re.test(hay));
}

export async function loadKosovoRetail() {
  try {
    const raw = await fetchJson('/data/kosovo-retail.json');
    const list = Array.isArray(raw?.products) ? raw.products : Array.isArray(raw) ? raw : [];
    const products = list.map(normalizeRetailProduct).filter(Boolean).filter((p) => !isBlockedSource(p));
    if (products.length === 0) throw new Error('kosovo-retail.json has 0 products so far');
    return {
      products,
      count: products.length,
      builtAt: raw?.builtAt || null,
      sources: Array.isArray(raw?.sources) ? raw.sources : [],
      isFallback: false,
    };
  } catch (err) {
    console.warn('[vendorja] kosovo-retail.json not available yet:', err.message);
    return { products: [], count: 0, builtAt: null, sources: [], isFallback: true };
  }
}

// --- kosovo-stores.json -------------------------------------------------------
// Store locations for the "where to buy nearby" section. May be missing or
// empty while the harvest is still building it; a missing/empty file
// must never crash the product-detail view — it just means we honestly say
// "we don't have store data for this chain yet" instead of a store list.

function normalizeStore(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const chain = raw.chain || raw.sourceLabel || null;
  const name = raw.name || chain || null;
  if (!chain && !name) return null;
  const lat = typeof raw.lat === 'number' ? raw.lat : raw.lat != null ? Number(raw.lat) : null;
  const lng = typeof raw.lng === 'number' ? raw.lng : raw.lng != null ? Number(raw.lng) : null;
  return {
    chain,
    name,
    city: raw.city || null,
    address: raw.address || null,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    hours: raw.hours || null,
    phone: raw.phone || null,
    sourceUrl: raw.sourceUrl || null,

    // Owner-pasted Google Maps detail (scripts/merge-stores.mjs, 2026-09-16).
    // Present only on the records that paste touched; `undefined` everywhere
    // else, which every consumer must read as "not known" rather than as a
    // zero. `rating: null` specifically means "this shop has no reviews" —
    // never 0, which would sort a new shop below a bad one.
    rating: typeof raw.rating === 'number' ? raw.rating : null,
    reviewCount: typeof raw.reviewCount === 'number' ? raw.reviewCount : null,
    reviewCountApprox: raw.reviewCountApprox === true,
    ratingSource: raw.ratingSource || null,
    googleCategory: raw.googleCategory || null,
    storeType: raw.storeType || null,
    sellsGroceries: typeof raw.sellsGroceries === 'boolean' ? raw.sellsGroceries : null,
    opensAt: raw.opensAt || null,
    closesAt: raw.closesAt || null,
    hoursPartial: raw.hoursPartial === true,
    phoneRaw: raw.phoneRaw || null,
    phoneFlag: raw.phoneFlag || null,
    source: raw.source || null,
  };
}

export async function loadKosovoStores() {
  try {
    const raw = await fetchJson('/data/kosovo-stores.json');
    const list = Array.isArray(raw?.stores) ? raw.stores : Array.isArray(raw) ? raw : [];
    const stores = list.map(normalizeStore).filter(Boolean);
    if (stores.length === 0) throw new Error('kosovo-stores.json has 0 stores so far');
    return { stores, count: stores.length, builtAt: raw?.builtAt || null, isFallback: false };
  } catch (err) {
    console.warn('[vendorja] kosovo-stores.json not available yet:', err.message);
    return { stores: [], count: 0, builtAt: null, isFallback: true };
  }
}

// --- product-origins.json ----------------------------------------------------
// The ORIGIN WORDING rule's actual evidence source (see lib/productOrigins.js
// for the full rationale): verified production-location data for Serbian
// GS1-registered brands. Missing/unreachable degrades to "no verified data"
// — i.e. every product stays on the hedged wording, never a guess.

export async function loadProductOrigins() {
  try {
    const raw = await fetchJson('/data/product-origins.json');
    const normalized = normalizeProductOrigins(raw);
    if (normalized.brandEntries.length === 0) throw new Error('product-origins.json had no usable brand entries');
    return { ...normalized, isFallback: false };
  } catch (err) {
    console.warn('[vendorja] product-origins.json not available yet:', err.message);
    return { brandEntries: [], byCode: new Map(), disclaimer: null, isFallback: true };
  }
}

// --- boycott-brands.json ------------------------------------------------------
// The prefix-override table (see lib/boycott.js). A missing file must never
// break a scan: it degrades to "prefix only", which is the app's previous
// behaviour, not a crash.

export async function loadBoycott() {
  try {
    const raw = await fetchJson('/data/boycott-brands.json');
    const normalized = normalizeBoycottTable(raw);
    if (normalized.brands.length === 0 && normalized.byCode.size === 0) {
      throw new Error('boycott-brands.json had no usable entries');
    }
    return { ...normalized, isFallback: false };
  } catch (err) {
    console.warn('[vendorja] boycott-brands.json not available:', err.message);
    return { brands: [], byCode: new Map(), why: [], isFallback: true };
  }
}

export async function loadAllData() {
  const [gs1, localProducts, categoryIndex, brandAlternatives, localCatalogs, kosovoRetail, kosovoStores, productOrigins, boycott, countryStance] =
    await Promise.all([
      loadGs1Prefixes(),
      loadLocalProducts(),
      loadCategoryIndex(),
      loadBrandAlternatives(),
      loadLocalCatalogs(),
      loadKosovoRetail(),
      loadKosovoStores(),
      loadProductOrigins(),
      loadBoycott(),
      loadCountryStance(),
    ]);
  return { gs1, localProducts, categoryIndex, brandAlternatives, localCatalogs, kosovoRetail, kosovoStores, productOrigins, boycott, countryStance };
}
