// The COMPLETE roster of Kosovar/Albanian alternatives.
//
// Distinct from resolveAlternatives.js, which answers "what should this
// specific Serbian product be replaced with?" and returns a short,
// category-matched, ranked shortlist. This module answers the owner's
// different question (2026-09-12): under the Serbian flag, show ALL
// Kosovo/Albania alternatives — the whole roster, every time, regardless of
// what was scanned.
//
// SAME HONESTY GATE AS EVERYWHERE ELSE. A brand appears here only if it is
// either:
//   (a) named as a Kosovar/Albanian alternative in the curated, source-cited
//       data/brand-alternatives.json, or
//   (b) a kosovo-retail.json product whose OWN record carries
//       isLocalBrand === true (never false, never null).
// "Sold in Kosovo" is not "made by a Kosovar brand" — that conflation is the
// bug this project already had to fix once, and it does not get reintroduced
// here just to make the list longer.

import { brandAltToItem, buildNonLocalBrandSet } from './brandAlternatives.js';
import { isKosovoCountry, isTrustedLocalRow } from './matcher.js';

function brandKey(item) {
  return String(item.brand || item.name || '')
    .toLowerCase()
    .trim();
}

/**
 * Every curated local alternative brand, deduped, with the category it was
 * documented against folded in so one brand can show all its categories.
 *
 * @param {object} data - the loaded dataset from dataLoader.loadAllData()
 * @returns {{items: Array, counts: {total:number, kosovo:number, albania:number, reported:number}}}
 */
export function allLocalAlternatives(data) {
  const byBrand = new Map();
  const nonLocalBrands = buildNonLocalBrandSet(data?.brandAlternatives);

  // (a) The curated, source-cited pairings — the primary and strongest source.
  for (const entry of data?.brandAlternatives?.entries || []) {
    for (const item of (entry.alternatives || []).map((alt) => brandAltToItem(alt, entry))) {
      const key = brandKey(item);
      if (!key) continue;
      const existing = byBrand.get(key);
      if (!existing) {
        byBrand.set(key, {
          ...item,
          categories: entry.category ? [entry.category] : [],
          // Which Serbian brands this one is documented as replacing —
          // useful context, and it is evidence we already hold.
          replaces: entry.serbianBrand ? [entry.serbianBrand] : [],
        });
        continue;
      }
      // Same brand documented against a second category/Serbian brand: merge
      // rather than listing it twice, and keep the STRONGER evidence level.
      if (entry.category && !existing.categories.includes(entry.category)) {
        existing.categories.push(entry.category);
      }
      if (entry.serbianBrand && !existing.replaces.includes(entry.serbianBrand)) {
        existing.replaces.push(entry.serbianBrand);
      }
      if (item.pairingEvidence === 'reported' && existing.pairingEvidence !== 'reported') {
        existing.pairingEvidence = 'reported';
        existing.pairingUrl = item.pairingUrl || existing.pairingUrl;
      }
    }
  }

  // (b) Genuinely-local retail products, gated on their own isLocalBrand flag.
  // These fill out the roster with real shelf products but are marked as
  // catalogue-sourced, never as documented pairings.
  for (const product of data?.kosovoRetail?.products || []) {
    // isLocalBrand === true is necessary but NOT sufficient: the flag comes
    // from the GS1 prefix, and a Serbian brand can hold an Albanian-issued
    // number. Measured: 92 Jaffa rows (boycott-listed "Jaffa Crvenka",
    // serbia) carry prefix 530 and were listed here as Kosovar. See
    // matcher.js#isTrustedLocalRow.
    if (!isTrustedLocalRow(product, { gs1: data?.gs1, boycott: data?.boycott, nonLocalBrands })) continue;
    const key = String(product.brand || '').toLowerCase().trim();
    if (!key) continue;
    const existing = byBrand.get(key);
    if (existing) {
      // Curated entry already covers this brand — just lend it a real product
      // image and price if it has none.
      if (!existing.image && product.image) existing.image = product.image;
      if (existing.price == null && product.price != null) {
        existing.price = product.price;
        existing.currency = product.currency;
      }
      if (!existing.source && product.source) {
        existing.source = product.source;
        existing.sourceLabel = product.sourceLabel;
      }
      continue;
    }
    byBrand.set(key, {
      isBrandLevel: true,
      code: product.barcode || null,
      name: null,
      brand: product.brand,
      company: null,
      image: product.image || null,
      country: 'kosovo',
      live: false,
      // Not a documented Serbian-brand pairing — a local brand found in a
      // Kosovo retail catalogue. Labelled differently in the UI for exactly
      // that reason.
      pairingEvidence: 'catalog',
      pairingUrl: product.url || null,
      evidence: product.localEvidence || null,
      categories: product.category ? [product.category] : [],
      replaces: [],
      price: product.price ?? null,
      currency: product.currency ?? null,
      source: product.source || null,
      sourceLabel: product.sourceLabel || null,
    });
  }

  const items = [...byBrand.values()].sort((a, b) => {
    // Documented pairings first, then catalogue brands; alphabetical within.
    const rank = (x) => (x.pairingEvidence === 'reported' ? 0 : x.pairingEvidence === 'catalog' ? 2 : 1);
    const diff = rank(a) - rank(b);
    if (diff !== 0) return diff;
    return String(a.brand || '').localeCompare(String(b.brand || ''));
  });

  const counts = {
    total: items.length,
    kosovo: items.filter((i) => isKosovoCountry(i.country)).length,
    albania: items.filter((i) => !isKosovoCountry(i.country)).length,
    reported: items.filter((i) => i.pairingEvidence === 'reported').length,
  };

  return { items, counts };
}
