// What to call a product on screen.
//
// Owner, 2026-09-12: "produkt pa emer? isnt right always show what a
// product it is".
//
// Open Food Facts frequently has a barcode with no `product_name` — the
// 387-prefixed Chipsy is exactly that case: no name, but brands "Chipsy,
// Marbo, Pepsico", a 40 g quantity and a front photo. Rendering that as
// "produkt pa emër" threw away everything we actually knew about it.
//
// So this walks every field that genuinely identifies the item, best first,
// and only falls back to the barcode when literally nothing else exists.
// It never invents a name — each step is a real value from real data.

/** Turn `en:salty-snacks` into `salty snacks`. */
function tagToWords(tag) {
  return String(tag || '')
    .replace(/^[a-z]{2}:/i, '')
    .replace(/-/g, ' ')
    .trim();
}

/**
 * @param {object|null} product   normalised Open Food Facts product
 * @param {object|null} classify  classify result (may carry a boycott entry)
 * @param {string} code           the scanned barcode
 */
export function productDisplayName(product, classify, code) {
  const boycott = classify?.boycott || null;

  // 1. The real product name.
  if (product?.name) return product.name;

  // 2. The boycott table's own name — it covers codes OFF has never heard
  //    of (8606017372806 is one).
  if (boycott?.name) return boycott.name;

  // 3. The descriptor line: "Slani krompirov čips" says what it IS even
  //    when the branded name is missing.
  if (product?.genericName) return product.genericName;

  // 4. Brand + size — "Chipsy · 40 g" identifies the thing on a shelf.
  const brand = product?.brand || boycott?.brand || null;
  const qty = product?.quantity || boycott?.quantity || null;
  if (brand && qty) return `${brand} · ${qty}`;
  if (brand) return brand;

  // 5. The most specific category we have, as words.
  const tags = product?.categoriesTags || [];
  for (let i = tags.length - 1; i >= 0; i--) {
    const words = tagToWords(tags[i]);
    if (words) return words;
  }

  // 6. Last resort: the number itself. Still tells the user what was read.
  return String(code || '').trim() || null;
}

/** True when we are showing the barcode because nothing else was known. */
export function isBarcodeFallback(name, code) {
  return Boolean(name) && name === String(code || '').trim();
}

// ---------------------------------------------------------------------------
// NOTHING RENDERS BLANK.
//
// Owner, 2026-09-16: "leave nothing undocumented like a random product
// without a history name".
//
// productDisplayName() above can still return null — when there is no name,
// no brand, no category AND no barcode, there is genuinely nothing to print.
// Every call site used to handle that itself, and several of them forgot:
// `<h4>{item.brand}</h4>` renders an empty heading, `{item.name || item.code}`
// renders nothing when both are null, and the row becomes an anonymous strip
// the user cannot identify or report.
//
// The two helpers below are the single place that gap is closed. They take
// the already-translated unknown label from the caller (the i18n hook lives
// in components, not here) and are guaranteed to return a non-empty string.
// ---------------------------------------------------------------------------

/** Never returns null or "" — falls back to the caller's unknown label. */
export function displayNameOrUnknown(product, classify, code, unknownLabel) {
  const name = productDisplayName(product, classify, code);
  if (typeof name === 'string' && name.trim()) return name.trim();
  return unknownLabel;
}

/**
 * What to call an ALTERNATIVE on screen. Alternatives are brand-first (the
 * answer to "what should I buy instead" is a brand, not a SKU), so the order
 * is the reverse of a scanned product's: brand, then product name, then the
 * producing company, then — only if all three are missing — the unknown
 * label. Never returns null or "".
 */
export function alternativeDisplayName(item, unknownLabel) {
  const candidates = [item?.brand, item?.name, item?.company];
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return unknownLabel;
}
