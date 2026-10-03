// Orchestrates the full alternatives-resolution order (best confidence
// first, per the 2026-09-10 correctness fix):
//   a) brand-alternatives.json — scanned brand matches a known Serbian brand
//   b) brand-alternatives.json — scanned OFF category tags match an entry
//   c) the static local-products pool, but ONLY genuinely-local candidates
//      (own GS1 prefix is local, or brand is in the curated local-brand set)
//   d) a live Open Food Facts search, filtered by the same eligibility gate
//
// Each source is tried in order; the first one that returns at least one
// item wins outright (a documented brand pairing is a stronger answer than
// a same-category product, so they are not blended together). Steps (c) and
// (d) never include an imported brand merely tagged as "sold in Kosovo/
// Albania" on Open Food Facts, and never include a candidate whose own
// barcode is itself Serbian-issued — see matcher.js's isEligibleLocalCandidate.

import {
  findEntryByBrand,
  pickEntryForScan,
  findEntryByCategoryTags,
  findEntriesByCategoryKey,
  entryToItems,
  buildCuratedLocalBrandSet,
  buildNonLocalBrandSet,
} from './brandAlternatives.js';
import {
  collectStaticCandidates,
  flattenRankedTiers,
  mergeLiveAlternatives,
  mostSpecificTag,
  isSameBrand,
  isTrustedLocalRow,
  LIVE_SEARCH_THRESHOLD,
  ALTERNATIVES_LIMIT,
} from './matcher.js';
import { liveSearchLocalAlternatives } from './offApi.js';
import { findAnyAlternative, retailIdentity, leadFamilyOf, dedupeKeyFor } from './liveAlternatives.js';
import { categoryFamilyOf } from './categoryFamily.js';

function dedupeByBrand(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = String(item.brand || '').toLowerCase().trim();
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    out.push(item);
  }
  return out;
}

/**
 * @param {object} opts
 * @param {string|null} opts.brand - scanned product's OFF `brands` string, if known.
 * @param {string[]} opts.categoriesTags - scanned product's OFF categories_tags, or a
 *   single synthetic tag chosen via the manual category picker when OFF has no product.
 * @param {object} opts.data - { brandAlternatives, categoryIndex, localProducts, localCatalogs, gs1 }
 */
export async function resolveAlternatives({ brand, categoriesTags, categoryHint = null, data }) {
  const entries = data?.brandAlternatives?.entries || [];
  const curatedLocalBrands = buildCuratedLocalBrandSet(data?.brandAlternatives, data?.localCatalogs);
  // Source-cited brands a GS1 prefix must never launder into "local".
  const nonLocalBrands = buildNonLocalBrandSet(data?.brandAlternatives);

  // (a) Brand match — the highest-confidence, documented pairing, but ONLY
  // when the entry is about the same kind of product as the thing scanned.
  // pickEntryForScan is what enforces that; before it existed this lane
  // answered a bag of Smoki with chocolate spread and Imlek butter with
  // cheese, because matching the brand was treated as matching the product.
  if (brand) {
    const entry = pickEntryForScan(brand, categoriesTags, entries, categoryHint);
    if (entry) {
      return {
        items: entryToItems(entry).slice(0, ALTERNATIVES_LIMIT),
        source: 'brand-match',
        sourceEntry: entry,
      };
    }
  }

  // (b) Category match against the curated brand map.
  if (categoriesTags?.length) {
    const entry = findEntryByCategoryTags(categoriesTags, entries);
    if (entry) {
      return {
        items: entryToItems(entry).slice(0, ALTERNATIVES_LIMIT),
        source: 'brand-category-match',
        sourceEntry: entry,
      };
    }
  }

  // (c) Static local-products pool — gated to genuinely-local candidates only.
  const { tiers } = collectStaticCandidates(
    categoriesTags,
    data?.categoryIndex?.index,
    data?.localProducts?.byCode,
    ALTERNATIVES_LIMIT,
    brand,
    data?.gs1,
    curatedLocalBrands,
    nonLocalBrands
  );
  const staticItems = flattenRankedTiers(tiers, ALTERNATIVES_LIMIT, data?.gs1);

  if (staticItems.length >= LIVE_SEARCH_THRESHOLD) {
    return { items: staticItems, source: 'static-pool' };
  }

  // (d) Live Open Food Facts search, merged in after the static pool — same gate applies.
  const tag = mostSpecificTag(categoriesTags);
  if (!tag) {
    if (staticItems.length > 0) return { items: staticItems, source: 'static-pool' };
    // No usable category tag is not a reason to give up — go to the shelf.
    return findAnyAlternative({
      categoriesTags,
      categoryText: null,
      brand,
      name: null,
      data,
      limit: ALTERNATIVES_LIMIT,
    });
  }

  const liveItems = await liveSearchLocalAlternatives(tag);
  const merged = mergeLiveAlternatives(
    staticItems,
    liveItems,
    ALTERNATIVES_LIMIT,
    brand,
    data?.gs1,
    curatedLocalBrands,
    nonLocalBrands
  );
  if (merged.length > 0) return { items: merged, source: 'live' };

  // (e) REAL-TIME SHELF LANE — the last resort, and the reason the app can
  // now answer a category nobody curated. Owner, 2026-09-12: "everything
  // must be alternative findable NO EXCEPTION". Searches the Kosovo retail
  // catalogue the app already ships, gated to the same product family and
  // the same food/non-food shelf, excluding anything Serbian-issued or
  // Serbian-owned. See lib/liveAlternatives.js for what each tier claims.
  return findAnyAlternative({
    categoriesTags,
    categoryText: null,
    brand,
    name: null,
    data,
    limit: ALTERNATIVES_LIMIT,
  });
}

/**
 * Last-resort tier for resolveAlternativesForRetailProduct: per the owner's
 * explicit "never a dead end after a scan" instruction, when the curated
 * brand map has nothing, fall back to genuinely-local products already in
 * the SAME retail catalogue (kosovo-retail.json) and the SAME free-text
 * category — never anything merely "sold in Kosovo": the hard gate is
 * isLocalBrand === true (never false/null) on the candidate's OWN record,
 * exactly the same honesty bar the static/live lanes already enforce for
 * the barcode-scan flow.
 */
function collectRetailCatalogFallback(product, data) {
  const pool = data?.kosovoRetail?.products || [];
  const nonLocalBrands = buildNonLocalBrandSet(data?.brandAlternatives);
  if (pool.length === 0) return [];
  const targetCategory = product?.category ? String(product.category).toLowerCase().trim() : null;
  if (!targetCategory) return [];
  return pool
    // isLocalBrand === true PLUS the boycott/Serbian-barcode check: the flag
    // alone let 92 Jaffa rows (Serbian brand on an Albanian GS1 prefix)
    // qualify as the Kosovar answer. See matcher.js#isTrustedLocalRow.
    .filter((p) => isTrustedLocalRow(p, { gs1: data?.gs1, boycott: data?.boycott, nonLocalBrands }))
    .filter((p) => p.category && String(p.category).toLowerCase().trim() === targetCategory)
    .filter((p) => p.id !== product.id)
    .filter((p) => !product.brand || !p.brand || !isSameBrand(p.brand, product.brand))
    // Never offer a row a shopper cannot read. See liveAlternatives.js.
    .filter((p) => retailIdentity(p, pool) !== null)
    .slice(0, ALTERNATIVES_LIMIT)
    .map((p) => ({
      isBrandLevel: false,
      code: p.barcode || p.id,
      name: p.name,
      brand: retailIdentity(p, pool)?.brand ?? null,
      image: p.image,
      // Honest, not fabricated: this tier is sourced from kosovo-retail.json
      // (Kosovo supermarket listings) AND gated on isLocalBrand === true, so
      // "kosovo" is a true label here, not a guess.
      country: 'kosovo',
      isLocalClaim: true,
      live: false,
      matchedTag: p.category,
      source: p.source || null,
      sourceLabel: p.sourceLabel || null,
    }));
}

/**
 * Catalogue-grid variant of alternative resolution, used by ProductDetailScreen
 * for a Serbian-registered retail product. Retail products (kosovo-retail.json)
 * don't carry OFF categories_tags, so the first two tiers are the
 * highest-confidence, documented sources — brand match, then a loose
 * category-key match against the curated brand map. If BOTH come up empty,
 * a third tier falls back to genuinely-local catalogue products in the same
 * free-text category (see collectRetailCatalogFallback) rather than ever
 * showing a dead end after a scan. Only when even that is empty do we say so
 * honestly ('none') — never fabricating a pairing to fill the screen.
 */
export async function resolveAlternativesForRetailProduct(product, data) {
  const entries = data?.brandAlternatives?.entries || [];

  if (product?.brand) {
    // Was findEntryByBrand — the FIRST entry for the brand, with no check on
    // what the product actually is. Same defect the scan lane had: a brand
    // that makes two kinds of thing answered at random. Retail rows carry no
    // OFF tags, but they do carry a free-text Albanian category, and that is
    // enough to tell a Štark chocolate from a Štark crisp.
    const entry = pickEntryForScan(product.brand, [], entries, product.category || null);
    if (entry) {
      return { items: entryToItems(entry).slice(0, ALTERNATIVES_LIMIT), source: 'brand-match' };
    }
  }

  if (product?.category) {
    const matchingEntries = findEntriesByCategoryKey(product.category, entries);
    if (matchingEntries.length > 0) {
      const items = dedupeByBrand(matchingEntries.flatMap(entryToItems)).slice(0, ALTERNATIVES_LIMIT);
      if (items.length > 0) {
        return { items, source: 'brand-category-match' };
      }
    }
  }

  // AISLE BEFORE BUCKET (reordered 2026-09-16). Hard
  // rule 8: "Alternatives pass the AISLE TEST, not the bucket test". The
  // retailer's free-text category IS a bucket — "HIGJENË SHTËPIAKE" holds
  // bin bags and paper napkins side by side, so matching on that string
  // answered a bag with a napkin. When the row can be placed in a family,
  // that is the better answer; the raw-category tier stays underneath it
  // for everything the family map cannot place.
  const sameFamily = collectRetailFamilyFallback(product, data);
  if (sameFamily.length > 0) {
    return { items: sameFamily, source: 'catalog-family-fallback' };
  }

  const catalogFallback = collectRetailCatalogFallback(product, data);
  if (catalogFallback.length > 0) {
    return { items: catalogFallback, source: 'catalog-category-fallback' };
  }

  return { items: [], source: 'none' };
}

/**
 * SAME AISLE, NOT SAME STRING (added 2026-09-16).
 *
 * Owner, 2026-09-16: "fuck do you mean in the whole of Kosovo no bag
 * exists nigga" / "i will not tolerate these lies".
 *
 * He was right and this function is the reason. The tier above matches the
 * catalogue's free-text category as an EXACT lowercase string, so two rows
 * that are obviously the same thing to a shopper never meet:
 *
 *   "Qese për mbeturina"        category: null               -> no answer
 *   "Qese Per Mbeturina 150L"   category: "Higjien Shtepiake"   isLocalBrand: true
 *   "Strong Garbage Bags 25L"   category: "Garbage Bags"        isLocalBrand: true
 *
 * 226 loaded rows carry `category: null` and the tier above bailed out on
 * every one of them before looking at anything; the rest are split across
 * four retailers' spellings of the same shelf. So this tier asks the aisle
 * question instead: what FAMILY is this, judged from the row's own title
 * (head noun) or its shelf label — and which proven-local rows are in it?
 *
 * The honesty bar is unchanged and is the strict one: `isTrustedLocalRow`,
 * i.e. `isLocalBrand === true` on the candidate's own record plus the
 * boycott and Serbian-barcode checks. An unplaceable product still gets
 * nothing, and that "nothing" is still a correct answer.
 */
// Cached per row object: headFamilyOf() walks ~200 stems and this runs once
// per catalogue row per resolution. The catalogue is loaded once and never
// mutated, so the answer cannot go stale.
const ROW_FAMILY_CACHE = new WeakMap();

function retailRowFamily(row) {
  if (!row || typeof row !== 'object') return null;
  if (ROW_FAMILY_CACHE.has(row)) return ROW_FAMILY_CACHE.get(row);
  // leadFamilyOf, not headFamilyOf: this is the ONLY evidence of what the
  // row is, so a passing mention ("Set Gota Çaji" = tea glasses) must not
  // count. See liveAlternatives.js#leadFamilyOf.
  const family = categoryFamilyOf(row.category) || leadFamilyOf(row.name) || null;
  ROW_FAMILY_CACHE.set(row, family);
  return family;
}

function collectRetailFamilyFallback(product, data) {
  const pool = data?.kosovoRetail?.products || [];
  if (pool.length === 0) return [];
  const family = retailRowFamily(product);
  if (!family) return [];
  const nonLocalBrands = buildNonLocalBrandSet(data?.brandAlternatives);
  const self = dedupeKeyFor(product);
  const seen = new Set();

  return pool
    .filter((p) => isTrustedLocalRow(p, { gs1: data?.gs1, boycott: data?.boycott, nonLocalBrands }))
    .filter((p) => p.id !== product.id && dedupeKeyFor(p) !== self)
    .filter((p) => !product.brand || !p.brand || !isSameBrand(p.brand, product.brand))
    .filter((p) => retailRowFamily(p) === family)
    .filter((p) => retailIdentity(p, pool) !== null)
    .sort((a, b) => (typeof a.price === 'number' ? a.price : Infinity) - (typeof b.price === 'number' ? b.price : Infinity))
    // The same SKU is in the catalogue once per store — one card each.
    .filter((p) => {
      const key = dedupeKeyFor(p);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, ALTERNATIVES_LIMIT)
    .map((p) => ({
      isBrandLevel: false,
      code: p.barcode || p.id,
      name: p.name,
      brand: retailIdentity(p, pool)?.brand ?? null,
      image: p.image,
      // Gated on isTrustedLocalRow, exactly like the tier above, so
      // "kosovo" is a measured label here and not a guess.
      country: 'kosovo',
      isLocalClaim: true,
      live: false,
      matchedTag: family,
      price: p.price ?? null,
      currency: p.currency ?? null,
      source: p.source || null,
      sourceLabel: p.sourceLabel || null,
      url: p.url || null,
    }));
}

/**
 * A SCAN THAT OPEN FOOD FACTS HAS NEVER HEARD OF (added 2026-09-16).
 *
 * THIS IS THE BUG THE OWNER HIT. Open Food Facts is a FOOD database. Every
 * bin-bag barcode in this app's own catalogue is absent from it — measured
 * against the live API on 2026-09-16:
 *
 *   3900985020512 (Strong Garbage Bags 25L)   -> OFF status 0, not found
 *   3902829070035 (Qese Frizi 3Kg)            -> OFF status 0, not found
 *   3901306490144 (Thase Per Mbeturina 35L)   -> OFF status 0, not found
 *
 * On an OFF miss App.jsx set productStatus 'not_found' and returned without
 * ever calling the resolver, so the alternatives stayed empty and the
 * screen printed "nuk u gjet alternativë vendore" — while those exact
 * barcodes sit in data/kosovo-retail.json with `isLocalBrand: true`. The
 * app was not filtering the answer out; it never asked the question.
 *
 * So: before believing OFF, look the barcode up in the catalogue this app
 * already ships and resolve from the row it finds. Returns null when the
 * catalogue does not have it either — then "we do not know what this is"
 * is the truth and the caller should say so.
 */
export async function resolveAlternativesForCode(code, data) {
  const digits = String(code || '').replace(/\D/g, '');
  if (digits.length < 8) return null;
  const pool = data?.kosovoRetail?.products || [];
  const row = pool.find((p) => String(p.barcode || '').replace(/\D/g, '') === digits);
  if (!row) return null;
  return resolveAlternativesForRetailProduct(row, data);
}

/** Category-picker fallback: no OFF product at all, just a hand-picked category. */
export async function resolveAlternativesForCategoryKey(categoryKey, offTag, data) {
  const entries = data?.brandAlternatives?.entries || [];
  const matchingEntries = findEntriesByCategoryKey(categoryKey, entries);
  if (matchingEntries.length > 0) {
    const items = dedupeByBrand(matchingEntries.flatMap(entryToItems)).slice(0, ALTERNATIVES_LIMIT);
    if (items.length > 0) {
      return { items, source: 'brand-category-match' };
    }
  }
  return resolveAlternatives({ brand: null, categoriesTags: offTag ? [offTag] : [], data });
}
