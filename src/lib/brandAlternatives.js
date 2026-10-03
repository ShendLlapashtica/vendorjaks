import { isMatchableTag, sameCategoryFamily, categoryFamilyOf, categoryFamiliesOf } from './categoryFamily.js';
// data/brand-alternatives.json — a curated, sourced map from Serbian brands
// to real Kosovo/Albanian brands. This is the PRIMARY alternatives source:
// a brand-level "reported" pairing (e.g. Plazma/Bambi -> Sempre/Liri) is a
// higher-confidence answer than anything derived from OFF category tags, and
// it works even when the alternative brand has no product barcode/photo of
// its own (e.g. no e-commerce presence).
//
// Shape (as briefed):
// { builtAt, disclaimer, entries: [ { serbianBrand, serbianCompany, category,
//     offCategoryTags: [...], verifiedSerbian, sourceUrl,
//     alternatives: [ { brand, company, country, sourceUrl, evidence,
//       pairingEvidence: "reported" | "category-match", pairingUrl } ] } ],
//   gaps: [...] }

import { isSameBrand } from './matcher.js';

function normalizeEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const serbianBrand = raw.serbianBrand || raw.brand;
  if (!serbianBrand) return null;
  const alternatives = Array.isArray(raw.alternatives)
    ? raw.alternatives
        .map((a) => {
          if (!a || !a.brand) return null;
          return {
            brand: a.brand,
            company: a.company || null,
            country: a.country || null,
            sourceUrl: a.sourceUrl || null,
            evidence: a.evidence || null,
            pairingEvidence: a.pairingEvidence === 'reported' ? 'reported' : 'category-match',
            pairingUrl: a.pairingUrl || a.sourceUrl || null,
            // Pack shot sourced from the producer's own site. This
            // normaliser is an allow-list, so a field absent here is
            // silently dropped no matter what the JSON holds.
            image: a.image || null,
            imageSource: a.imageSource || null,
            imageCredit: a.imageCredit || null,
          };
        })
        .filter(Boolean)
    : [];

  return {
    serbianBrand,
    serbianCompany: raw.serbianCompany || null,
    category: raw.category || null,
    offCategoryTags: Array.isArray(raw.offCategoryTags) ? raw.offCategoryTags : [],
    verifiedSerbian: raw.verifiedSerbian !== false,
    sourceUrl: raw.sourceUrl || null,
    alternatives,
  };
}

export function normalizeBrandAlternatives(raw) {
  const list = Array.isArray(raw) ? raw : raw?.entries || [];
  const entries = list.map(normalizeEntry).filter((e) => e && e.alternatives.length > 0);
  return {
    entries,
    gaps: Array.isArray(raw?.gaps) ? raw.gaps : [],
    disclaimer: raw?.disclaimer || null,
    // Source-cited brands that a GS1 prefix must never be allowed to pass
    // off as local — see buildNonLocalBrandSet below.
    nonLocalBrands: Array.isArray(raw?.nonLocalBrands) ? raw.nonLocalBrands : [],
  };
}

/**
 * THE PREFIX IS NOT THE OWNER (added 2026-09-16).
 *
 * matcher.js admits a candidate as "genuinely local" when its own barcode
 * carries a Kosovo/Albania GS1 prefix. Measured: barcode 3904933060414 is a
 * pack of **Kellogg's Corn Flakes** on prefix 390 (Kosovo), and it was
 * being returned as the local alternative to a Serbian breakfast cereal.
 *
 * That is this very file's own disclaimer being ignored: "a GS1 prefix
 * identifies where a barcode was registered, not where a product was
 * manufactured." A Kosovo GS1 member number on an imported multinational's
 * pack says the importer registered it, nothing more.
 *
 * So `nonLocalBrands` in data/brand-alternatives.json names, with a source
 * URL and a quote apiece, brands that are demonstrably not Kosovar or
 * Albanian. The list is deliberately short and evidence-only — it is not a
 * guess-list of "sounds foreign", and a brand goes on it only with a
 * citation, exactly like every pairing in this file.
 *
 * @returns {Set<string>} lowercase brand strings and aliases
 */
export function buildNonLocalBrandSet(brandAlternatives) {
  const set = new Set();
  for (const row of brandAlternatives?.nonLocalBrands || []) {
    const add = (v) => {
      const s = String(v || '').toLowerCase().trim();
      if (s) set.add(s);
    };
    add(row?.brand);
    for (const alias of row?.aliases || []) add(alias);
  }
  return set;
}

/** Every curated entry whose Serbian brand matches the scanned `brands` string. */
export function findEntriesByBrand(brandsString, entries) {
  if (!brandsString || !entries?.length) return [];
  // OFF `brands` can be a comma-separated list ("Bambi, Mondelez").
  const candidates = String(brandsString)
    .split(',')
    .map((b) => b.trim())
    .filter(Boolean);
  return entries.filter((entry) => candidates.some((c) => isSameBrand(c, entry.serbianBrand)));
}

/** Resolution (a): scanned product's OFF `brands` string matches a known Serbian brand entry. */
export function findEntryByBrand(brandsString, entries) {
  return findEntriesByBrand(brandsString, entries)[0] || null;
}

/**
 * THE BRAND LANE USED TO SKIP THE CATEGORY GATE. Measured 2026-09-13 against
 * 1,237 real Open Food Facts products: of 507 alternatives returned for
 * products of brands we list, only 16% were in the same product family as the
 * thing that was actually scanned.
 *
 * Why: a Serbian producer makes more than one kind of thing, and `isSameBrand`
 * matches on substrings. "Štark" matched the Bananica (chocolate) entry before
 * the Smoki (crisps) entry, so scanning a bag of Smoki offered chocolate
 * spread. Imlek's entry resolves to the `cheese` family, so scanning Imlek
 * BUTTER offered cheese. Eurocrem (a chocolate spread) offered wafers.
 *
 * None of that is a data problem — the right entry usually exists. It is that
 * knowing the brand was treated as knowing the product. So: when we can tell
 * what was scanned, pick the entry for THAT family, and when no entry agrees,
 * return nothing from this lane and let the category/shelf lanes answer
 * instead. A brand match is only the best answer when it is about the same
 * kind of product.
 */
export function pickEntryForScan(brandsString, categoriesTags, entries, categoryHint = null) {
  const matches = findEntriesByBrand(brandsString, entries);
  if (matches.length === 0) return null;

  const scannedFamily = categoryFamilyOf(categoriesTags);

  // NO CATEGORY TAGS, AND MORE THAN ONE ENTRY FOR THIS BRAND. This is not a
  // rare edge case: it is the app's own "alternative on the spot" lane,
  // which fires the instant a barcode is recognised and deliberately passes
  // categoriesTags: [] so the shopper is not left waiting on a network round
  // trip (App.jsx). Falling back to matches[0] there answered at random —
  // Soko Štark sells both chocolate and Smoki crisps, so scanning a Štark
  // chocolate offered a bag of Vipa Flips. Measured: 2 of 32 brands.
  //
  // The caller usually knows something even without OFF tags: the boycott
  // record carries its own `category` ("chocolate-confectionery"), and a
  // retail row carries a free-text Albanian one. Use it.
  if (!scannedFamily) {
    // No hint either: one entry is all we know, so take it; several and we
    // would be guessing, so decline.
    if (!categoryHint) return matches.length === 1 ? matches[0] : null;

    const norm = (v) => String(v || '').toLowerCase().trim().replace(/[\s_]+/g, '-');
    const hint = norm(categoryHint);

    const exact = matches.find((m) => norm(m.category) === hint);
    if (exact) return exact;

    const hintFamily = categoryFamilyOf(hint) || categoryFamilyOf([hint]);
    if (hintFamily) {
      const byFamily = matches.find((m) => categoryFamiliesOf(m.offCategoryTags).has(hintFamily));
      if (byFamily) return byFamily;
    }

    const words = hint.split('-').filter((w) => w.length > 3);
    const byWord = matches.find((m) => words.some((w) => norm(m.category).includes(w)));
    if (byWord) return byWord;

    // THE HINT CAN VETO, INCLUDING WHEN THERE IS ONLY ONE CANDIDATE. This is
    // the Soko Štark case and the reason "I scan X and get something
    // completely else" survived the first fix: the boycott record for Soko
    // Štark says it sells chocolate-confectionery, but the only curated entry
    // whose brand string matches "Soko Štark" is the Smoki/crisps one — so a
    // single match was not a safe match, it was the wrong product with
    // nothing to compare it against. If every candidate disagrees with what
    // we know the brand sells, this lane returns nothing and the category and
    // shelf lanes answer instead.
    return null;
  }

  // An entry is compared on EVERY family its tags touch, not just the most
  // specific one. Imlek is tagged milks + yogurts + cheeses and Swisslion
  // biscuits + chocolates; collapsing each to one family meant an Imlek MILK
  // scan found nothing (the entry had collapsed to `cheese`) while a
  // Swisslion BISCUIT scan matched an entry labelled chocolate.
  const sameFamily = matches.find((m) => categoryFamiliesOf(m.offCategoryTags).has(scannedFamily));
  if (sameFamily) return sameFamily;

  // An entry we cannot place either is not evidence AGAINST a match — the
  // brand itself vouches for it. An entry that resolves to a DIFFERENT family
  // is a hard veto, and that is the case this function exists for.
  return matches.find((m) => categoryFamiliesOf(m.offCategoryTags).size === 0) || null;
}

/** Resolution (b): scanned product's OFF categories_tags intersect a known entry's offCategoryTags. */
export function findEntryByCategoryTags(categoriesTags, entries) {
  if (!Array.isArray(categoriesTags) || categoriesTags.length === 0 || !entries?.length) return null;
  // CATEGORY SAFETY GATE (2026-09-12): only SPECIFIC shared tags count. A
  // curated entry tagged `en:snacks` must not be returned for a cooking
  // oil just because oil also carries an aisle-level tag. And even on a
  // specific overlap, the two must share a product family.
  const tagSet = new Set(categoriesTags.filter(isMatchableTag));
  if (tagSet.size === 0) return null;
  const exact = entries.find(
    (entry) =>
      entry.offCategoryTags.some((t) => isMatchableTag(t) && tagSet.has(t)) &&
      sameCategoryFamily(categoriesTags, entry.offCategoryTags)
  );
  if (exact) return exact;

  // FAMILY FALLBACK, added 2026-09-16 with the family split.
  //
  // Requiring a literally identical OFF tag was sending real, curated,
  // source-cited pairings to the back of the queue over a spelling. The
  // curated map holds two `ketchup` entries tagged `en:ketchup`; a Serbian
  // ketchup tagged `en:tomato-sauces` shared no tag with them and fell all
  // the way through to the weak shelf lane, which answered it with an
  // anonymous supermarket row. Measured: 5 ketchup scans, 3 breads, 3
  // cereals and 2 mustards in the eval corpus, all with a curated answer
  // sitting unused.
  //
  // This was only unsafe while a "family" was an aisle. It is not one any
  // more: after the split a family is a single purchase — `ketchup-tomato
  // -sauces`, `mustard` and `mayonnaise-dressings` are three different
  // families, and `milk`, `yogurt`, `cream`, `butter` and `cheese` are five.
  // Agreeing on one of those is real evidence, and a curated pairing with a
  // source beats an unbranded shelf row every time.
  // ...but ONLY for an entry that is about exactly one kind of thing.
  //
  // The `fresh-produce` entry is tagged en:potatoes + en:fresh-potatoes +
  // en:fresh-vegetables + en:fresh-fruits and its alternative is "Pestova
  // (patate të freskëta)" — fresh potatoes. Matched on family alone it
  // answered tinned peeled tomatoes, sweetcorn and passata with a sack of
  // potatoes: 15 wrong-family answers across the eval corpus, the first
  // time WRONG FAMILY has been non-zero. An entry spanning several
  // families is not specific enough to answer without a shared tag; the
  // exact-tag path above already handles those safely.
  const family = categoryFamilyOf(categoriesTags);
  if (!family) return null;
  return (
    entries.find((entry) => {
      const families = categoryFamiliesOf(entry.offCategoryTags);
      return families.size === 1 && families.has(family);
    }) || null
  );
}

/** Resolution for the category-picker fallback: find every entry tagged with a given category key. */
export function findEntriesByCategoryKey(categoryKey, entries) {
  if (!categoryKey || !entries?.length) return [];
  const key = String(categoryKey).toLowerCase().replace(/[\s_-]+/g, '-');
  return entries.filter((entry) => {
    const entryKey = String(entry.category || '').toLowerCase().replace(/[\s_-]+/g, '-');
    return entryKey === key || (entry.offCategoryTags || []).some((t) => t.toLowerCase().includes(key));
  });
}

/** Uniform "alternative item" shape shared with product-pool/live items, for one brand-map alternative. */
export function brandAltToItem(alt, sourceEntry) {
  return {
    isBrandLevel: true,
    code: null,
    name: null,
    brand: alt.brand,
    company: alt.company,
    // Curated pack shots, sourced from each producer's own official site
    // into public/alternatives/ (2026-09-12). This was hard-coded to null
    // back when brand entries carried no imagery, which silently swallowed
    // every photo and left the UI falling back to a flag.
    image: alt.image || null,
    imageSource: alt.imageSource || null,
    imageCredit: alt.imageCredit || null,
    country: alt.country,
    // Every curated alternative in this file IS a Kosovar/Albanian brand by
    // construction — that is the file's entire premise. See the same flag
    // on the shelf lane in liveAlternatives.js for why it is spelled out.
    isLocalClaim: true,
    live: false,
    pairingEvidence: alt.pairingEvidence,
    pairingUrl: alt.pairingUrl,
    evidence: alt.evidence,
    matchedTag: sourceEntry?.category || null,
  };
}

export function entryToItems(entry) {
  return (entry?.alternatives || []).map((alt) => brandAltToItem(alt, entry));
}

const LEGAL_SUFFIX_RE = /\b(sh\.?p\.?k\.?|shpk|d\.?o\.?o\.?|doo|a\.?d\.?|ad|l\.?l\.?c\.?|ltd|inc)\b\.?/gi;

/** Best-effort brand-name extraction from a local-catalogs.json "usable" storeName, e.g. "Vipa (Pestova Sh.P.K.)" -> "vipa". */
function extractBrandFromStoreName(storeName) {
  if (!storeName) return null;
  const beforeParen = storeName.split('(')[0];
  const cleaned = beforeParen.replace(LEGAL_SUFFIX_RE, '').trim();
  return cleaned || null;
}

/**
 * Builds the curated local-brand set used as the eligibility-gate fallback
 * in matcher.js: every brand named as a real Kosovo/Albania alternative in
 * brand-alternatives.json, plus a best-effort brand guess from each
 * genuinely-local storefront documented in local-catalogs.json. Returns a
 * Set of lowercase, trimmed brand strings.
 */
export function buildCuratedLocalBrandSet(brandAlternatives, localCatalogs) {
  const set = new Set();
  for (const entry of brandAlternatives?.entries || []) {
    for (const alt of entry.alternatives || []) {
      const b = String(alt.brand || '').toLowerCase().trim();
      if (b) set.add(b);
      const c = String(alt.company || '').toLowerCase().trim();
      if (c) set.add(c);
    }
  }
  for (const catalog of localCatalogs?.usable || []) {
    const brand = extractBrandFromStoreName(catalog.storeName);
    if (brand) set.add(brand.toLowerCase().trim());
  }
  return set;
}
