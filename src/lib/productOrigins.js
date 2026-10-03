// data/product-origins.json — a curated map (from the data pipeline) of
// Serbian GS1-registered brands, and some specific barcodes, to VERIFIED
// production-location evidence. This is the concrete data source the
// ORIGIN WORDING rule was written to wait for:
//
//   - product IS in this table with verified === true and
//     productionCountry === 'RS' -> may say "prodhuar në Serbi".
//   - product IS in this table with verified === true but productionCountry
//     is something else (a Serbian-registered company that actually
//     produces in Kosovo/Albania, e.g.) -> must say so honestly, and must
//     NOT say "prodhuar në Serbi" (that would now be a known-false claim,
//     worse than the hedge).
//   - anything else (no match, or verified === false) -> stays on the
//     hedged "GS1 prefix only" wording. A brand being IN this file with
//     verified:false is explicitly "company confirmed Serbian, production
//     location NOT confirmed" per the file's own disclaimer — never upgrade
//     that to a claim either way.
//
// Missing/unreachable file degrades to "no verified data" (the hedge case
// for everything), same defensive pattern as the rest of dataLoader.js.

function isSerbiaCode(v) {
  return ['rs', 'serbia', 'srbija'].includes(String(v || '').toLowerCase());
}

function normalizeBrand(b) {
  return String(b || '').toLowerCase().trim();
}

function normalizeBrandEntry(raw) {
  if (!raw || !raw.brand) return null;
  const names = [raw.brand, ...(Array.isArray(raw.aliases) ? raw.aliases : [])].map(normalizeBrand).filter(Boolean);
  return {
    names,
    brand: raw.brand,
    company: raw.company || null,
    // Where the COMPANY is registered. Kept separately from where the
    // product is MADE, because for the split-origin cases (see
    // resolveOrigin below) those are two different countries and
    // collapsing them is exactly the bug.
    companyCountry: raw.companyCountry || null,
    productionCity: raw.productionCity || null,
    productionCountry: raw.productionCountry || null,
    verified: raw.verified === true,
    ownership: raw.ownership || null,
    ownershipCountry: raw.ownershipCountry || null,
    ownershipSourceUrl: raw.ownershipSourceUrl || null,
    evidence: raw.evidence || null,
    sourceUrl: raw.sourceUrl || null,
  };
}

export function normalizeProductOrigins(raw) {
  const brandEntries = Array.isArray(raw?.brands) ? raw.brands.map(normalizeBrandEntry).filter(Boolean) : [];
  const byCode = new Map();
  for (const b of Array.isArray(raw?.barcodes) ? raw.barcodes : []) {
    if (b && b.code) byCode.set(String(b.code).trim(), b);
  }
  return { brandEntries, byCode, disclaimer: raw?.disclaimer || null };
}

// AN EXACT NAME BEATS A CONTAINED ONE, ALWAYS.
//
// The containment fallback (`c.includes(n) || n.includes(c)`) exists because
// the brand string can arrive as a fragment — Open Food Facts returns
// "Chipsy, Marbo, Pepsico" and a retail row may carry only "Marbo". It is
// useful and it stays. What it cannot be allowed to do is decide BETWEEN two
// entries whose names contain one another, because then the answer depends on
// array order:
//
//   "Jaffa"          -> Jaffa Crvenka d.o.o., Crvenka, Serbia — biscuits.
//   "Jaffa Champion" -> Fluidi, Velekincë Gjilan, Kosovo — juice.
//
// Containment matches both, in both directions, so before this the Serbian
// entry won every Jaffa Champion lookup purely by sitting earlier in the
// file, and a Kosovar juice resolved to "made in Serbia". The fix is the same
// longest-match-wins discipline findBoycottInTitle() and originFromProduct()
// already use, plus the rule that an exact hit is never overruled by a
// substring of itself.
function findBrandMatch(brandToMatch, brandEntries) {
  if (!brandToMatch) return null;
  const normalized = normalizeBrand(brandToMatch);
  const candidates = String(brandToMatch)
    .split(',')
    .map(normalizeBrand)
    .filter(Boolean);

  let loose = null;
  let looseLength = -1;

  for (const entry of brandEntries) {
    for (const n of entry.names) {
      if (n === normalized || candidates.includes(n)) return entry;
      if (candidates.some((c) => c.includes(n) || n.includes(c)) && n.length > looseLength) {
        loose = entry;
        looseLength = n.length;
      }
    }
  }
  return loose;
}

/**
 * @param {{code?: string, brand?: string}} product
 * @param {{brandEntries, byCode}} table
 * @returns {null | { verified: boolean, productionCountry: string|null, isSerbia: boolean, company: string|null, ownership: string|null, evidence: string|null, sourceUrl: string|null }}
 */
export function findVerifiedOrigin({ code, brand }, table) {
  if (!table) return null;
  const codeEntry = code ? table.byCode.get(String(code).trim()) : null;
  // THE EXACT BARCODE OUTRANKS THE BRAND COLUMN. A curated barcode entry is a
  // claim about this one product; the brand column is a claim about a name,
  // and in this catalogue the same name covers two producers ("Jaffa" is both
  // Jaffa Crvenka's biscuit and Fluidi's Jaffa Champion juice). Reading the
  // brand column first made the 43 curated Jaffa Champion barcodes
  // unreachable — every one of them resolved through the Serbian entry.
  const brandToMatch = codeEntry?.brand || brand || null;
  const brandMatch = findBrandMatch(brandToMatch, table.brandEntries);

  if (!brandMatch) {
    // A confirmed barcode->brand mapping with no brand-level production
    // data at all can't say anything about WHERE it's made — stays null
    // (the hedge case), it just isn't evidence either way.
    return null;
  }

  return {
    verified: brandMatch.verified === true && (codeEntry ? codeEntry.verified !== false : true),
    brand: brandMatch.brand,
    productionCountry: brandMatch.productionCountry,
    productionCity: brandMatch.productionCity,
    isSerbia: isSerbiaCode(brandMatch.productionCountry),
    company: brandMatch.company,
    companyCountry: brandMatch.companyCountry,
    ownership: brandMatch.ownership,
    ownershipCountry: brandMatch.ownershipCountry,
    ownershipSourceUrl: brandMatch.ownershipSourceUrl || brandMatch.sourceUrl,
    evidence: brandMatch.evidence,
    sourceUrl: codeEntry?.sourceUrl || brandMatch.sourceUrl,
  };
}

// ---------------------------------------------------------------------------
// SPLIT ORIGIN — registration, manufacture and ownership are three facts
// ---------------------------------------------------------------------------
//
// THE BIMILK CASE (owner, 2026-09-16: "i saw a bimilk which is originally a
// NMK product get labeled as serbian what an edgecase . be wary of those").
//
// `JOGURT BIMILK 1L 1% BALANS` carries barcode 8601500111207. Prefix 860 is
// GS1 Serbia, so the prefix logic is right and the CONCLUSION was still
// wrong, because a GS1 prefix names the organisation that registered the
// number — never the factory.
//
// Three facts are true about that yogurt at the same time:
//
//   REGISTRATION  GS1 Serbia (860). Checkable from the number itself, and
//                 not in dispute. 8601500 is Imlek's own GS1 company
//                 prefix — QUMESHT IMLEK is 8601500110057, one digit apart.
//   MANUFACTURE   Bitola, North Macedonia. Mlekara AD Bitola, a dairy
//                 operating on that site since 1952.
//   OWNERSHIP     Imlek (Belgrade) / Mid Europa Partners, formerly Danube
//                 Foods Group / Salford. The Bitola dairy is listed as an
//                 Imlek subsidiary.
//
// Saying "Serbian" asserts the first as if it were the second. Silently
// clearing it to "Macedonian" throws away the first and the third. So the
// app states all three separately and lets the shopper weigh them —
// which is the only version of this that is not a lie by omission.
//
// The catalogue itself corroborates the split: the SAME brand also appears
// on 5310054000921, prefix 531 = GS1 North Macedonia. One dairy, two GS1
// offices, two "countries" for the same yogurt. That is the whole argument
// for keeping these three fields apart, in one datum.
//
// The flag drawn on a product answers "where does this come from", so it
// follows MANUFACTURE when manufacture is verified, and falls back to
// registration otherwise. Registration is never hidden; it moves to its own
// line.

const ISO_BY_NAME = { rs: 'RS', serbia: 'RS', srbija: 'RS', xk: 'XK', kosovo: 'XK', al: 'AL', albania: 'AL', me: 'ME', montenegro: 'ME', mk: 'MK', 'north macedonia': 'MK', macedonia: 'MK' };

/** Accepts either an ISO code or a country name; returns an ISO-2 or null. */
export function originIso(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (/^[A-Za-z]{2}$/.test(raw)) return raw.toUpperCase();
  return ISO_BY_NAME[raw.toLowerCase()] || null;
}

/**
 * Pulls apart the three origin facts for one product.
 *
 * @param {object|null} classify  result of classifyBarcode()
 * @param {object|null} origin    result of findVerifiedOrigin()
 * @returns {{
 *   registrationIso: string|null,
 *   manufactureIso: string|null,
 *   manufactureVerified: boolean,
 *   ownership: string|null,
 *   ownershipIso: string|null,
 *   displayIso: string|null,
 *   divergent: boolean,
 *   serbianOwned: boolean,
 * }}
 */
export function resolveOrigin(classify, origin) {
  const registrationIso = classify?.iso || null;
  const manufactureVerified = origin?.verified === true && Boolean(origin.productionCountry);
  const manufactureIso = manufactureVerified ? originIso(origin.productionCountry) : null;
  // OWNERSHIP ONLY, never falling back to companyCountry. Where a company
  // is registered and who owns it are different facts, and conflating them
  // is the same mistake this whole module exists to undo: Imlek is a
  // Serbian-registered company owned by a UK private-equity fund, and
  // reading its companyCountry as its ownership would have said "Serbian-
  // owned", which is not what the source says.
  const ownershipIso = originIso(origin?.ownershipCountry);

  // Divergent ONLY when both sides are known and actually disagree. An
  // unknown manufacture country is not a disagreement.
  const divergent = Boolean(registrationIso && manufactureIso && registrationIso !== manufactureIso);

  return {
    registrationIso,
    manufactureIso,
    manufactureVerified,
    manufactureCity: origin?.productionCity || null,
    manufactureCompany: origin?.company || null,
    manufactureSourceUrl: origin?.sourceUrl || null,
    ownership: origin?.ownership || null,
    ownershipIso,
    ownershipSourceUrl: origin?.ownershipSourceUrl || null,
    displayIso: manufactureIso || registrationIso,
    divergent,
    // "The money still goes to Belgrade" — kept separate from the flag so
    // it can be SAID without the flag having to lie about the factory.
    serbianOwned: ownershipIso === 'RS',
    // THE MIRROR FACT, and it needs saying as plainly as the one above.
    //
    // Owner, 2026-09-18: "and if fluidi or albanian product registered in
    // serbia dont mark as serbian product". Bimilk was a non-Serbian factory
    // under Serbian ownership; Fluidi is the opposite — a Kosovar company,
    // registered at Velekincë Gjilan, whose barcodes were bought from GS1
    // Albania and GS1 Serbia because Kosovo had no prefix of its own until
    // 381. Its owner says so himself (see product-origins-SOURCES.md).
    //
    // Without this field the app could record "not Serbian" but had no way
    // to say the positive thing a shopper of this app actually wants to
    // hear: the money goes to Gjilan. `serbianOwned` had no counterpart, so
    // the good news was the only fact with nowhere to live.
    locallyOwned: ownershipIso === 'XK' || ownershipIso === 'AL',
  };
}

export const COUNTRY_CODE_NAMES = {
  RS: { sq: 'Serbi', en: 'Serbia' },
  XK: { sq: 'Kosovë', en: 'Kosovo' },
  AL: { sq: 'Shqipëri', en: 'Albania' },
  ME: { sq: 'Mali i Zi', en: 'Montenegro' },
  MK: { sq: 'Maqedoni e Veriut', en: 'North Macedonia' },
};

export function countryCodeName(code, lang) {
  const entry = COUNTRY_CODE_NAMES[String(code || '').toUpperCase()];
  if (!entry) return code || '';
  return lang === 'en' ? entry.en : entry.sq;
}

// ---------------------------------------------------------------------------
// BRAND -> ORIGIN, the last resort before saying "unknown".
//
// Owner, 2026-09-16: "like what the fuck man?? sempre there and origin
// unknown fuck you mean i dont know ou must know always knoe" — and, on the
// same screen, "try do best at fetching flags. if no flag available after
// 100 tries. remove the product we dont need ?orignin unknown products".
//
// He is right, and the "unknown" was indefensible: **Sempre is named in our
// own data/brand-alternatives.json as a Kosovar alternative.** The app had
// the answer on disk and printed a question mark, purely because that
// catalogue row carries no barcode. 63.8% of Kosovo rows have no usable
// GTIN, so a barcode-only origin resolver is silent on nearly two thirds of
// the shelf.
//
// So before anything is called unknown, the brand is looked up in the three
// places this project ALREADY holds sourced origin facts:
//
//   1. product-origins.json  — explicit, source-cited overrides (Bimilk).
//   2. brand-alternatives.json — `alternatives[]` are curated Kosovar/
//      Albanian producers (that is the file's whole purpose, and each entry
//      is source-cited), and `serbianBrand` is by definition Serbian.
//   3. boycott-brands.json   — curated Serbian brands, including the ones
//      that register barcodes through another country's GS1 office.
//
// This is NOT a guess and not a widening of the honesty rule: every one of
// those three is an existing, curated, cited claim about who makes the
// brand. It is the same standard the barcode lane meets, reached by a
// different route. A brand nobody curated stays unknown — and unknown is
// still a real answer, which is why the deletion half of the instruction is
// deliberately not implemented here: dropping every origin-unknown row
// would delete 20,389 of 31,975 products, i.e. most of the shop.

function normBrandKey(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

let brandOriginCache = null;
let brandOriginCacheKey = null;

/**
 * brand (normalised) -> { iso, basis } built once per dataset.
 * Stronger sources win: an explicit override beats a boycott listing beats
 * a curated alternative.
 */
export function buildBrandOriginIndex(data) {
  const key = data?.brandAlternatives?.entries?.length ?? -1;
  if (brandOriginCache && brandOriginCacheKey === key) return brandOriginCache;

  const map = new Map();
  const put = (brand, iso, basis, rank) => {
    const k = normBrandKey(brand);
    if (!k || !iso) return;
    const prev = map.get(k);
    if (prev && prev.rank <= rank) return;
    map.set(k, { iso, basis, rank });
  };

  // 3 — curated Serbian brands (weakest of the three only in the sense that
  // the other two are more specific; all are cited).
  for (const b of data?.boycott?.brands || []) {
    put(b.brand || b.name, 'RS', 'boycott-brands.json', 3);
    for (const alias of b.aliases || []) put(alias, 'RS', 'boycott-brands.json', 3);
  }

  // 2 — the curated pairing map.
  for (const entry of data?.brandAlternatives?.entries || []) {
    if (entry.serbianBrand) put(entry.serbianBrand, 'RS', 'brand-alternatives.json', 2);
    for (const alt of entry.alternatives || []) {
      const iso = /albania|shqip/i.test(String(alt.country || '')) ? 'AL' : 'XK';
      put(alt.brand || alt.name, iso, 'brand-alternatives.json', 2);
    }
  }

  // 1 — explicit, source-cited overrides win outright.
  for (const rec of data?.productOrigins?.byBrand
    ? Object.values(data.productOrigins.byBrand)
    : []) {
    const iso = originIso(rec?.productionCountry);
    if (iso) put(rec.brand, iso, 'product-origins.json', 1);
  }

  brandOriginCache = map;
  brandOriginCacheKey = key;
  return map;
}

/**
 * @returns {{iso: string, basis: string}|null} — null means genuinely not
 *   curated anywhere, which the UI must still render honestly.
 */
export function brandOrigin(brand, data) {
  if (!brand) return null;
  const hit = buildBrandOriginIndex(data).get(normBrandKey(brand));
  return hit ? { iso: hit.iso, basis: hit.basis } : null;
}

/**
 * The same lookup, but reading the brand out of the PRODUCT TITLE when the
 * `brand` column is empty — which it is on 93% of retail rows. The owner's
 * example, "SEMPRE ..." , carries its producer in the name and nowhere else,
 * so a brand-column-only lookup recovered 86 rows out of 20,389.
 *
 * Whole-word matching only, longest brand first, and AMBIGUITY IS REFUSED:
 * if two different curated brands both appear in one title we return null
 * rather than pick. That is the same discipline harvest-retail.mjs and
 * the resolver's retailIdentity() already use, and it is what keeps this a
 * lookup rather than a guess.
 */
export function originFromProduct(product, data) {
  const direct = brandOrigin(product?.brand, data);
  if (direct) return direct;

  const title = normBrandKey(product?.name);
  if (!title) return null;
  const hay = ` ${title} `;

  const index = buildBrandOriginIndex(data);
  if (!index.__sorted) {
    // Longest first so "camel biscam" wins over "camel".
    Object.defineProperty(index, '__sorted', {
      value: [...index.keys()].filter((k) => k.length >= 3).sort((a, b) => b.length - a.length),
      enumerable: false,
    });
  }

  let found = null;
  for (const key of index.__sorted) {
    if (!hay.includes(` ${key} `)) continue;
    // A SHORT BRAND NAME BURIED MID-TITLE IS NOT EVIDENCE.
    // Measured on the real catalogue: "Rosa" (the Serbian water brand, 4
    // letters) matched "Gioia Rosa Verë rose" — an Italian wine — and
    // "3 ROSA Sapun i parfumuar", a soap, and flagged both as Serbian.
    // Accusing an unrelated product of being Serbian is far worse than
    // saying "unknown", so a short key only counts when the title STARTS
    // with it, which is how this catalogue writes brands ("Smoki ...",
    // "SEMPRE ..."). Longer keys may match anywhere.
    if (key.length < 6 && !title.startsWith(key)) continue;
    const hit = index.get(key);
    if (!found) {
      found = { key, ...hit };
      continue;
    }
    // A second, DIFFERENT brand in the same title. Unless it is a substring
    // of the one already found (so the same producer spelled two ways),
    // the title is ambiguous and gets no origin at all.
    if (hit.iso !== found.iso && !found.key.includes(key)) return null;
  }
  return found ? { iso: found.iso, basis: `${found.basis} (brand in title)` } : null;
}
