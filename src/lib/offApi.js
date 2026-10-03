// Thin wrapper around the free, keyless Open Food Facts API.
// Docs: https://openfoodfacts.github.io/openfoodfacts-server/api/

const OFF_BASE = 'https://world.openfoodfacts.org';
// Owner (2026-09-12): "show the exact product when scanned not just the
// name the exact product name what flavouor chips how many mg and all
// specs". So the lookup now pulls the full spec set, not just a name:
// the flavour/descriptor (generic_name), net weight, serving size, the
// per-100g nutrition block, ingredients, allergens, packaging and
// Nutri-Score. Verified against barcode 8606014409017, which returns
// generic_name "Slani krompirov čips", quantity 43 g, serving 30 g and a
// complete nutriments object.
const PRODUCT_FIELDS = [
  'code',
  'product_name',
  'generic_name',
  'brands',
  'quantity',
  'product_quantity',
  'serving_size',
  'labels',
  'ingredients_text',
  'allergens',
  'packaging',
  'nutriscore_grade',
  'nova_group',
  'categories_tags',
  'countries_tags',
  'image_front_small_url',
  'image_front_url',
  'nutriments',
].join(',');
const SEARCH_FIELDS = 'code,product_name,brands,image_front_small_url';

// Open Food Facts asks integrators to identify themselves via User-Agent,
// but browsers block setting that header on fetch — this is sent as a best
// effort where the runtime allows it (e.g. during tests/SSR) and silently
// ignored in the browser.
const HEADERS = { 'User-Agent': 'Vendorja/1.0 (Kosovo GS1 origin checker)' };

export class OffLookupError extends Error {
  constructor(message, kind) {
    super(message);
    this.kind = kind; // 'not_found' | 'network' | 'server'
  }
}

// Per-100g nutrition rows, in the order a label prints them. `key` is the
// Open Food Facts nutriments field; a row with no value is dropped rather
// than rendered as a blank or a zero we did not measure.
const NUTRIMENT_ROWS = [
  { key: 'energy-kj_100g', id: 'energyKj', unit: 'kJ' },
  { key: 'energy-kcal_100g', id: 'energyKcal', unit: 'kcal' },
  { key: 'fat_100g', id: 'fat', unit: 'g' },
  { key: 'saturated-fat_100g', id: 'saturatedFat', unit: 'g' },
  { key: 'carbohydrates_100g', id: 'carbohydrates', unit: 'g' },
  { key: 'sugars_100g', id: 'sugars', unit: 'g' },
  { key: 'fiber_100g', id: 'fiber', unit: 'g' },
  { key: 'proteins_100g', id: 'proteins', unit: 'g' },
  { key: 'salt_100g', id: 'salt', unit: 'g' },
  { key: 'sodium_100g', id: 'sodium', unit: 'g' },
];

function buildNutrition(nutriments) {
  if (!nutriments || typeof nutriments !== 'object') return [];
  const rows = [];
  for (const row of NUTRIMENT_ROWS) {
    const value = nutriments[row.key];
    // Only a real number counts. Absent is absent — never rendered as 0.
    if (typeof value !== 'number' || Number.isNaN(value)) continue;
    rows.push({ id: row.id, value, unit: row.unit });
  }
  return rows;
}

function cleanString(value) {
  const s = String(value ?? '').trim();
  return s.length > 0 ? s : null;
}

/**
 * Strips Open Food Facts taxonomy language prefixes from a display string.
 *
 * OFF returns taxonomy-backed fields with a language code baked in, e.g.
 * packaging = "en:Plastic, 90 C/PP" and allergens = "en:milk,en:gluten".
 * Rendering that verbatim leaked "en:Plastic" into the spec sheet — seen on
 * screen 2026-09-12. Splits on commas, drops the `xx:` prefix from each
 * entry, and reassembles.
 */
function cleanTaxonomyString(value) {
  const raw = cleanString(value);
  if (!raw) return null;
  const parts = raw
    .split(',')
    .map((part) => part.trim().replace(/^[a-z]{2}:/i, '').trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : null;
}

function normalizeOffProduct(p) {
  if (!p) return null;
  return {
    code: p.code,
    name: cleanString(p.product_name),
    // The flavour/descriptor line — "Slani krompirov čips" for Chipsy
    // Classic. This is what answers "what flavour".
    genericName: cleanString(p.generic_name),
    brand: cleanString(p.brands),
    categoriesTags: Array.isArray(p.categories_tags) ? p.categories_tags : [],
    countriesTags: Array.isArray(p.countries_tags) ? p.countries_tags : [],
    image: p.image_front_small_url || null,
    imageLarge: p.image_front_url || p.image_front_small_url || null,
    quantity: cleanString(p.quantity),
    // Grams as a number where OFF has parsed it, for "how many mg/g".
    quantityGrams: typeof p.product_quantity === 'number' ? p.product_quantity : Number(p.product_quantity) || null,
    servingSize: cleanString(p.serving_size),
    labels: cleanTaxonomyString(p.labels),
    ingredients: cleanString(p.ingredients_text),
    allergens: cleanTaxonomyString(p.allergens),
    packaging: cleanTaxonomyString(p.packaging),
    nutriscore: cleanString(p.nutriscore_grade),
    novaGroup: typeof p.nova_group === 'number' ? p.nova_group : null,
    nutrition: buildNutrition(p.nutriments),
  };
}

/** Looks up a single product by barcode. Throws OffLookupError on failure. */
export async function fetchProductByCode(code) {
  const digits = String(code).replace(/\D/g, '');
  const url = `${OFF_BASE}/api/v2/product/${encodeURIComponent(digits)}.json?fields=${PRODUCT_FIELDS}`;

  let res;
  try {
    res = await fetch(url, { headers: HEADERS });
  } catch (err) {
    throw new OffLookupError(`Network error reaching Open Food Facts: ${err.message}`, 'network');
  }

  if (res.status >= 500 || res.status === 503) {
    throw new OffLookupError(`Open Food Facts returned HTTP ${res.status}`, 'server');
  }
  if (!res.ok) {
    throw new OffLookupError(`Open Food Facts returned HTTP ${res.status}`, 'network');
  }

  let json;
  try {
    json = await res.json();
  } catch (err) {
    throw new OffLookupError('Open Food Facts returned an invalid response', 'server');
  }

  if (json.status !== 1 || !json.product) {
    throw new OffLookupError('Product not found on Open Food Facts', 'not_found');
  }

  return normalizeOffProduct(json.product);
}

/**
 * Live search for local products in a given category, used to top up the
 * static local-products pool when it doesn't have enough alternatives.
 * Degrades to an empty array on ANY failure (including OFF's frequent 503s)
 * — this lane is a best-effort supplement, never a hard requirement.
 */
export async function searchLocalByCategory(categoryTag, countryTagEn) {
  const params = new URLSearchParams({
    countries_tags_en: countryTagEn,
    categories_tags: categoryTag,
    fields: SEARCH_FIELDS,
    page_size: '10',
  });
  const url = `${OFF_BASE}/api/v2/search?${params.toString()}`;

  try {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) return [];
    const json = await res.json();
    const products = Array.isArray(json?.products) ? json.products : [];
    return products
      .map((p) => ({
        code: p.code,
        name: p.product_name || null,
        brand: p.brands || null,
        image: p.image_front_small_url || null,
        country: countryTagEn,
        live: true,
      }))
      .filter((p) => p.code);
  } catch {
    return [];
  }
}

/** Runs the Kosovo + Albania live searches in parallel, merging failures away. */
export async function liveSearchLocalAlternatives(categoryTag) {
  const [kosovo, albania] = await Promise.all([
    searchLocalByCategory(categoryTag, 'kosovo'),
    searchLocalByCategory(categoryTag, 'albania'),
  ]);
  return [...kosovo, ...albania];
}
