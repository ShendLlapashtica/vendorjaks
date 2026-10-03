// Helpers for the home catalog grid: converting the existing
// local-products.json pool into the same shape as kosovo-retail.json's
// products (used ONLY when the retail catalogue is missing/empty), plus
// simple category/search filtering shared by CatalogScreen.

import { hasGenuinelyLocalPrefix } from './matcher.js';

function humanizeOffTag(tag) {
  if (!tag) return null;
  const clean = String(tag)
    .replace(/^[a-z]{2}:/, '')
    .replace(/-/g, ' ')
    .trim();
  if (!clean) return null;
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

/**
 * Converts local-products.json entries (OFF "sold in Kosovo/Albania" data,
 * NOT necessarily local brands) into the catalog-grid item shape. Local
 * brand status is derived the same way the alternatives-eligibility gate
 * does — via the product's OWN GS1 prefix — never assumed true just because
 * it's in this pool (that was exactly the earlier bug: "sold in Kosovo" is
 * not "made in Kosovo").
 */
export function fallbackPoolToCatalogItems(localProducts, gs1) {
  const list = localProducts?.products || [];
  return list.map((p) => ({
    id: p.code,
    source: null,
    sourceLabel: null,
    name: p.name,
    brand: p.brand,
    category: humanizeOffTag(p.categoriesTags?.[p.categoriesTags.length - 1]),
    price: null,
    currency: null,
    image: p.image,
    url: null,
    barcode: p.code,
    isLocalBrand: hasGenuinelyLocalPrefix(p, gs1),
    localEvidence: null,
  }));
}

/** Distinct category labels present in a list of catalog items, most-common first. */
export function buildCategoryOptions(items) {
  const counts = new Map();
  for (const item of items) {
    if (!item.category) continue;
    counts.set(item.category, (counts.get(item.category) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([category]) => category);
}

/** Simple case-insensitive substring match across name/brand/category. */
export function matchesQuery(item, query) {
  if (!query) return true;
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    (item.name && item.name.toLowerCase().includes(q)) ||
    (item.brand && item.brand.toLowerCase().includes(q)) ||
    (item.category && item.category.toLowerCase().includes(q))
  );
}
