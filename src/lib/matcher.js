// The heart of the app: given a scanned product's OFF categories_tags, find
// real local (Kosovo/Albania) alternatives in the same category.
//
// OFF's categories_tags run general -> specific (e.g.
// ["en:snacks", "en:sweet-snacks", "en:biscuits-and-cakes", "en:biscuits"]),
// so "most specific first" means walking the array in reverse.
//
// CRITICAL: data/local-products.json is built from Open Food Facts'
// countries_tags, which means "sold in Kosovo/Albania" — NOT "made by a
// Kosovo/Albania producer". It contains plenty of imported international
// brands (and even some Serbian-prefixed products) merely tagged as sold in
// the region. Presenting one of those as a "local alternative" is worse than
// showing nothing, so this module applies a hard eligibility GATE (not just
// a ranking preference) before anything is allowed into the alternatives
// grid: a candidate must either carry its own genuinely local (381/390/530)
// GS1 prefix, or its brand must appear in the curated local-brand set built
// from brand-alternatives.json / local-catalogs.json. A candidate whose own
// barcode classifies as SERBIAN is excluded unconditionally, regardless of
// anything else.

import { classifyBarcode, VERDICT } from './gs1.js';
import { isMatchableTag, familyCompatible } from './categoryFamily.js';
import { findBoycottByBrand, findBoycottByCode } from './boycott.js';

const KOSOVO_COUNTRY_STRINGS = ['kosovo', 'kosove', 'kosovë', 'xk', '381', '390'];

export function isKosovoCountry(country) {
  if (!country) return false;
  return KOSOVO_COUNTRY_STRINGS.includes(String(country).toLowerCase());
}

function normalizeBrand(brand) {
  return String(brand || '').toLowerCase().trim();
}

/**
 * True when two brand strings should be treated as "the same manufacturer".
 * The local-products pool is built from Open Food Facts' countries_tags
 * (i.e. "sold in Kosovo/Albania"), which can include the SAME brand as the
 * scanned product (e.g. another Bambi/Plazma SKU) — that is never a useful
 * "local alternative", regardless of which country it happens to be tagged
 * with, so it's filtered out at the matching layer rather than trusting the
 * dataset to have excluded it.
 */
export function isSameBrand(brandA, brandB) {
  const a = normalizeBrand(brandA);
  const b = normalizeBrand(brandB);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

/** Most-specific-first ordering of a product's OFF category tags. */
export function categoriesMostSpecificFirst(categoriesTags) {
  return Array.isArray(categoriesTags) ? [...categoriesTags].reverse() : [];
}

/**
 * Whether a candidate's OWN barcode was itself issued by a local (Kosovo/
 * Albania) GS1 organisation — the strongest available authenticity signal
 * for "this is genuinely a local product", as opposed to merely being
 * tagged on Open Food Facts as sold in Kosovo/Albania (which also catches
 * imported international brands). Reuses the same classifier/table as the
 * scanned product's own verdict rather than a second hardcoded prefix list.
 */
export function hasGenuinelyLocalPrefix(item, gs1Table) {
  if (!gs1Table || !item.code) return false;
  return classifyBarcode(item.code, gs1Table).verdict === VERDICT.LOCAL;
}

/** Hard exclusion: a candidate whose own barcode is itself Serbian-issued is never shown, full stop. */
export function isOwnBarcodeSerbian(item, gs1Table) {
  if (!gs1Table || !item.code) return false;
  return classifyBarcode(item.code, gs1Table).verdict === VERDICT.SERBIAN;
}

/**
 * Eligibility GATE (not a ranking tiebreak): a candidate may enter the
 * alternatives grid only if there is real evidence it is local — either its
 * own barcode prefix, or a brand present in the curated local-brand set.
 * `curatedLocalBrands` is a Set of lowercase brand strings sourced from
 * brand-alternatives.json's alternatives[].brand (and, best-effort,
 * local-catalogs.json) — see resolveAlternatives.js.
 */
export function isEligibleLocalCandidate(item, gs1Table, curatedLocalBrands, nonLocalBrands = null) {
  if (isOwnBarcodeSerbian(item, gs1Table)) return false;
  // A SOURCE-CITED NON-LOCAL BRAND BEATS ITS OWN BARCODE PREFIX (2026-09-16).
  // Kellogg's Corn Flakes on Kosovo prefix 390 was being offered as the
  // local alternative to a Serbian cereal. The prefix says who registered
  // the number, not who owns the brand — brandAlternatives.js's own
  // disclaimer. See buildNonLocalBrandSet / data/brand-alternatives.json's
  // `nonLocalBrands`.
  if (nonLocalBrands && nonLocalBrands.size > 0 && item.brand) {
    const brand = normalizeBrand(item.brand);
    for (const known of nonLocalBrands) {
      if (brandsOverlapAsWords(brand, known)) return false;
    }
  }
  if (hasGenuinelyLocalPrefix(item, gs1Table)) return true;
  if (curatedLocalBrands && curatedLocalBrands.size > 0 && item.brand) {
    const brand = normalizeBrand(item.brand);
    for (const known of curatedLocalBrands) {
      if (brandsOverlapAsWords(brand, known)) return true;
    }
  }
  return false;
}

/**
 * THE SUBSTRING TRAP, FIXED 2026-09-13.
 *
 * This gate used to accept a candidate when either brand string CONTAINED
 * the other. The curated local set holds "vita" (Devolli's Kosovo dairy), so
 * every brand with those four letters anywhere in it was waved through as
 * "genuinely local":
 *
 *   · "Vitalia"  — North Macedonian (GS1 531). Measured: offered as the
 *     local alternative to a Serbian porridge, because no cereals entry
 *     exists and the static pool answered instead.
 *   · "Vitamin"  — that is Vitamin Horgoš, a SERBIAN producer already on
 *     the boycott list. The barcode check above only catches it while its
 *     number is 860-prefixed; a Serbian brand registered through another
 *     GS1 office is exactly the case boycott-brands.json exists for, and
 *     this gate would have handed it to the shopper as the Kosovar answer.
 *
 * That is the same failure that once recommended Milka and Barilla as local
 * alternatives, arriving by a different door.
 *
 * So: match on WHOLE WORDS, the same discipline boycott.js already uses for
 * brand aliases. "vita" matches "Vita" and "Vita 1L" but never "Vitalia";
 * "peja" still matches the curated "birra peja". Tokens shorter than three
 * characters are ignored outright — they carry no evidence.
 */
function brandsOverlapAsWords(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  const words = (s) => String(s).split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 3);
  const aw = words(a);
  const bw = words(b);
  if (aw.length === 0 || bw.length === 0) return false;
  // One side's full word-sequence appearing inside the other's, in order.
  const contains = (hay, needle) => {
    if (needle.length === 0 || needle.length > hay.length) return false;
    for (let i = 0; i + needle.length <= hay.length; i++) {
      let ok = true;
      for (let j = 0; j < needle.length; j++) {
        if (hay[i + j] !== needle[j]) { ok = false; break; }
      }
      if (ok) return true;
    }
    return false;
  };
  return contains(aw, bw) || contains(bw, aw);
}

/**
 * MAY THIS RETAIL ROW CARRY THE "vendore / kosovo" CLAIM?  (added 2026-09-16)
 *
 * THE BUG THIS FIXES, measured, not hypothesised. `isLocalBrand === true`
 * was treated on its own as sufficient everywhere a kosovo-retail.json row
 * becomes an alternative. It is not, because the flag is derived from the
 * row's GS1 prefix and a prefix says who ISSUED the number, not who owns
 * the brand:
 *
 *   data/kosovo-retail.json holds 92 rows branded **Jaffa** carrying
 *   Albanian GS1 prefix 530, so every one of them is isLocalBrand: true —
 *   and the app's OWN boycott table lists that brand as
 *   "Jaffa Crvenka (serbia)". `allLocalAlternatives()` listed Jaffa in the
 *   roster of "ALL Kosovar/Albanian alternatives", badged country: kosovo,
 *   and `collectRetailCatalogFallback` could return it as the answer to a
 *   scanned Serbian juice. A Serbian brand offered as the Kosovar
 *   replacement for a Serbian brand.
 *
 * The shelf lane in liveAlternatives.js never had this hole — its
 * isSafeCandidate() already runs every candidate through the boycott table.
 * This function is that same check, lifted out so the two other lanes that
 * skipped it cannot skip it again.
 *
 * @param {object} row  a kosovo-retail.json product
 * @param {object} ctx  { gs1, boycott } from loadAllData()
 */
export function isTrustedLocalRow(row, { gs1 = null, boycott = null, nonLocalBrands = null } = {}) {
  if (!row || row.isLocalBrand !== true) return false;
  const code = row.barcode || row.code || null;
  if (code) {
    if (classifyBarcode(code, gs1)?.verdict === VERDICT.SERBIAN) return false;
    if (findBoycottByCode(code, boycott)) return false;
  }
  if (row.brand && findBoycottByBrand(row.brand, boycott)) return false;
  // Same rule as isEligibleLocalCandidate: a source-cited non-local brand
  // beats a local GS1 prefix, because the prefix names the registrant.
  // THE BRAND COLUMN IS NULL ON 93% OF RETAIL ROWS, so checking it alone
  // meant this gate could almost never fire.
  // Owner, 2026-09-16: "Velo Bright Spearmint ... Shqipëri ... vendore ...
  // barkodi 5301000730801 this product not albanian". He was right: Velo is
  // British American Tobacco's nicotine-pouch line, the rows carry
  // `brand: null`, and the 530 prefix alone earned them a VENDORE badge.
  // A prefix names the organisation that registered the number, not the
  // brand owner — this project's own disclaimer — so the name is checked
  // too, as whole words. Whole words matter: a substring test would match
  // "velo" inside unrelated titles, and a wrong accusation is as bad as a
  // wrong endorsement.
  if (nonLocalBrands && nonLocalBrands.size > 0) {
    const haystacks = [row.brand, row.name].filter(Boolean).map(normalizeBrand);
    for (const hay of haystacks) {
      for (const known of nonLocalBrands) {
        if (brandsOverlapAsWords(hay, known)) return false;
      }
    }
  }
  return true;
}

/**
 * Walks the scanned product's categories from most specific to least
 * specific, collecting ONLY eligible local products (see
 * isEligibleLocalCandidate) from the static category index at each level.
 */
export function collectStaticCandidates(
  categoriesTags,
  categoryIndex,
  localProductsByCode,
  limit = 6,
  excludeBrand = null,
  gs1Table = null,
  curatedLocalBrands = null,
  nonLocalBrands = null
) {
  const tags = categoriesMostSpecificFirst(categoriesTags);
  const seen = new Set();
  const tiers = []; // array of arrays; earlier tier = more specific match

  for (const tag of tags) {
    // CATEGORY SAFETY GATE (2026-09-12). Aisle-level tags like
    // `en:plant-based-foods-and-beverages` or `en:snacks` are shared by
    // oil, biscuits, juice and crisps alike. Matching on one of those is
    // how a Kosovar cookie got offered as the alternative to a Serbian
    // cooking oil. Skip them outright — see lib/categoryFamily.js.
    if (!isMatchableTag(tag)) continue;

    const entry = categoryIndex?.get(tag);
    if (!entry || !Array.isArray(entry.codes) || entry.codes.length === 0) continue;

    const tierItems = [];
    for (const code of entry.codes) {
      if (seen.has(code)) continue;
      const product = localProductsByCode?.get(code);
      if (!product) continue;
      seen.add(code);
      if (excludeBrand && isSameBrand(product.brand, excludeBrand)) continue;
      if (!isEligibleLocalCandidate(product, gs1Table, curatedLocalBrands, nonLocalBrands)) continue;
      // Second guard: a candidate whose OWN tags place it in a different
      // product family is vetoed even on a specific shared tag. Candidates
      // with no tags of their own pass on the strength of the index — see
      // familyCompatible() for why that asymmetry is deliberate.
      if (!familyCompatible(categoriesTags, product.categoriesTags)) continue;
      tierItems.push({ ...product, matchedTag: tag, live: false });
    }
    if (tierItems.length > 0) tiers.push(tierItems);

    const totalSoFar = tiers.reduce((n, t) => n + t.length, 0);
    if (totalSoFar >= limit) break;
  }

  return { tiers, tagsWalked: tags };
}

function rankWithinTier(items, gs1Table) {
  return [...items].sort((a, b) => {
    // Among already-eligible items, an item that is local by its OWN prefix
    // outranks one that's only eligible via the curated-brand fallback.
    const aOwnPrefix = hasGenuinelyLocalPrefix(a, gs1Table) ? 0 : 1;
    const bOwnPrefix = hasGenuinelyLocalPrefix(b, gs1Table) ? 0 : 1;
    if (aOwnPrefix !== bOwnPrefix) return aOwnPrefix - bOwnPrefix;
    const aKosovo = isKosovoCountry(a.country) ? 0 : 1;
    const bKosovo = isKosovoCountry(b.country) ? 0 : 1;
    if (aKosovo !== bKosovo) return aKosovo - bKosovo;
    const aImg = a.image ? 0 : 1;
    const bImg = b.image ? 0 : 1;
    return aImg - bImg;
  });
}

/** Flattens ranked tiers into a single ordered, deduped, length-limited list. */
export function flattenRankedTiers(tiers, limit = 6, gs1Table = null) {
  const out = [];
  for (const tier of tiers) {
    for (const item of rankWithinTier(tier, gs1Table)) {
      if (out.length >= limit) return out;
      out.push(item);
    }
  }
  return out;
}

/**
 * Merges live Open Food Facts search results in after the static pool,
 * deduped by code (static wins on collision), running every live candidate
 * through the SAME eligibility gate as the static pool (rule 1/2 apply
 * equally here — a live-fetched imported brand is just as inadmissible as a
 * static-pool one), and never exceeding `limit` total.
 */
export function mergeLiveAlternatives(
  staticItems,
  liveItems,
  limit = 6,
  excludeBrand = null,
  gs1Table = null,
  curatedLocalBrands = null,
  nonLocalBrands = null
) {
  const seen = new Set(staticItems.map((p) => p.code));
  const rankedLive = rankWithinTier(
    liveItems
      .filter((p) => p.code && !seen.has(p.code))
      .filter((p) => !excludeBrand || !isSameBrand(p.brand, excludeBrand))
      .filter((p) => isEligibleLocalCandidate(p, gs1Table, curatedLocalBrands, nonLocalBrands))
      .map((p) => ({ ...p, live: true })),
    gs1Table
  );
  const dedupedLive = [];
  const liveSeen = new Set();
  for (const item of rankedLive) {
    if (liveSeen.has(item.code)) continue;
    liveSeen.add(item.code);
    dedupedLive.push(item);
  }
  return [...staticItems, ...dedupedLive].slice(0, limit);
}

/**
 * The most specific category tag to use for the live-search lane: the first
 * (most specific) tag in the scanned product's category list, if any.
 */
export function mostSpecificTag(categoriesTags) {
  const tags = categoriesMostSpecificFirst(categoriesTags);
  return tags.length > 0 ? tags[0] : null;
}

export const LIVE_SEARCH_THRESHOLD = 3;
export const ALTERNATIVES_LIMIT = 6;
