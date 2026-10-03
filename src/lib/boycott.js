// Brand- and barcode-level boycott overrides.
//
// WHY THIS EXISTS (owner, 2026-09-12), stated plainly because it is the
// single most important correction the app has had:
//
//   The GS1 prefix is NOT sufficient. Barcode 3870508000157 is a 40g bag of
//   Chipsy. Its prefix is 387 — GS1 Bosnia and Herzegovina — so a
//   prefix-only check clears it as "not Serbian". Open Food Facts returns
//   brands = "Chipsy, Marbo, Pepsico" for that exact code: it is Marbo
//   Product d.o.o., Bačka Maglić, Serbia. The prefix says Bosnia. The money
//   goes to Serbia.
//
// So: the prefix decides the COUNTRY OF REGISTRATION, and this file decides
// the BOYCOTT VERDICT where the two disagree.
//
// TWO RESOLUTION PATHS, and the timing rule that separates them:
//
//   1. BY BARCODE — a local, exact lookup. Resolves instantly, with no
//      network, so it obeys the app's founding rule that the verdict never
//      waits on a fetch.
//   2. BY BRAND — needs the Open Food Facts brands string, so it can only
//      run once that request returns. It can only ever UPGRADE a verdict to
//      boycott after the fact, never downgrade one.
//
// THE OVERRIDE IS ONE-WAY. It adds boycott verdicts; it never removes one.
// Nothing here can clear an 860-prefixed product.

export function normalizeBoycottTable(raw) {
  const brands = (raw?.brands || []).map((b) => ({
    brand: b.brand,
    company: b.company || null,
    country: b.country || 'serbia',
    category: b.category || null,
    evidence: b.evidence || null,
    sourceUrl: b.sourceUrl || null,
    // Matched as whole, lowercased tokens — never substrings. "marbo" must
    // not match "marbolino"; a substring match is how a boycott list starts
    // accusing innocent brands.
    aliases: [...new Set([b.brand, ...(b.aliases || [])].filter(Boolean).map((a) => String(a).toLowerCase().trim()))],
  }));

  const byCode = new Map();
  for (const entry of raw?.barcodes || []) {
    const code = String(entry.code || '').replace(/\D/g, '');
    if (!code) continue;
    byCode.set(code, {
      code,
      brand: entry.brand || null,
      name: entry.name || null,
      quantity: entry.quantity || null,
      prefixNote: entry.prefixNote || null,
      note: entry.note || null,
      confirmedOn: entry.confirmedOn || null,
    });
  }

  return { brands, byCode, why: raw?.why || [] };
}

function brandEntryFor(brandName, table) {
  const key = String(brandName || '').toLowerCase().trim();
  if (!key) return null;
  return (table?.brands || []).find((b) => b.aliases.includes(key)) || null;
}

/**
 * Exact-barcode boycott lookup. Local and synchronous — safe to call before
 * any network request.
 * @returns {null | {reason:'barcode', brand, company, evidence, sourceUrl, name, quantity, prefixNote, note}}
 */
export function findBoycottByCode(code, table) {
  const digits = String(code || '').replace(/\D/g, '');
  if (!digits) return null;
  const hit = table?.byCode?.get(digits);
  if (!hit) return null;
  const brandEntry = brandEntryFor(hit.brand, table);
  return {
    reason: 'barcode',
    brand: hit.brand,
    company: brandEntry?.company || null,
    country: brandEntry?.country || 'serbia',
    category: brandEntry?.category || null,
    evidence: brandEntry?.evidence || null,
    sourceUrl: brandEntry?.sourceUrl || null,
    name: hit.name,
    quantity: hit.quantity,
    prefixNote: hit.prefixNote,
    note: hit.note,
  };
}

/**
 * Brand-string boycott lookup, for the Open Food Facts `brands` field.
 *
 * OFF returns a comma-separated list ("Chipsy, Marbo, Pepsico"), so each
 * token is tested separately and the first documented match wins. Tokens
 * are compared whole — never as substrings.
 */
export function findBoycottByBrand(brandsString, table) {
  const tokens = String(brandsString || '')
    .split(',')
    .map((s) => s.toLowerCase().trim())
    .filter(Boolean);

  for (const token of tokens) {
    const entry = brandEntryFor(token, table);
    if (entry) {
      return {
        reason: 'brand',
        brand: entry.brand,
        company: entry.company,
        country: entry.country,
        category: entry.category,
        evidence: entry.evidence,
        sourceUrl: entry.sourceUrl,
        matchedToken: token,
      };
    }
  }
  return null;
}

/**
 * Folds a boycott hit into a classify() result.
 *
 * The prefix's own country is PRESERVED, not overwritten — the user is told
 * both facts: where the barcode was issued, and who actually owns the brand.
 * Hiding the Bosnian issuer would be its own small dishonesty, and the
 * discrepancy is the most persuasive thing on the screen.
 */
export function applyBoycott(classify, boycott) {
  if (!boycott) return classify;
  return {
    ...classify,
    verdict: 'SERBIAN',
    boycott,
    // True when the prefix pointed somewhere other than Serbia — i.e. the
    // override changed the answer rather than merely confirming it.
    issuerDiffersFromOwner: !classify.isSerbiaPrefix,
  };
}

/**
 * THE BOYCOTT TABLE, MATCHED AGAINST A PRODUCT TITLE.
 *
 * Owner, 2026-09-16: "i saw a lot of plazmas with no flag. products that are
 * understandably serbian but have no barcode or flag remove them completely".
 *
 * Measured: 48 Plazma rows ship, 22 of them with no usable barcode, and
 * `brand` is NULL on all 48 — as it is on 93% of retail rows. Bambi has been
 * in data/boycott-brands.json the whole time, with "plazma" among its
 * aliases and its seat in Požarevac cited. The table was right; the lookup
 * could not reach it, because findBoycottByBrand() only reads the brand
 * column. So the app showed a Serbian biscuit with no flag and no verdict.
 *
 * REMOVAL WOULD HAVE BEEN THE WRONG FIX, and it is worth writing down why:
 * deleting unflagged Serbian products makes them invisible, and this app
 * exists to make them visible. A shopper browsing the catalogue should see
 * Plazma struck through with BOJKOTO, not see nothing and assume we checked.
 * Detecting them is strictly better than hiding them.
 *
 * Whole-word matching only, longest alias first. A substring test would let
 * a three-letter alias hit an unrelated title, and a false BOYCOTT badge on
 * an innocent product is a worse error than a missing one — it is an
 * accusation. Aliases under 4 characters are required to start the title.
 */
// Built ONCE per table, not once per product.
// Measured after shipping the first version: 142 ms for 2,000 rows, because
// every call rebuilt and re-sorted all ~185 brand/alias keys. On a catalogue
// page rendering thousands of rows that is most of a second of pure garbage,
// and it was a real contributor to /eksploro locking up while typing.
const candidateCache = new WeakMap();

function candidateList(table) {
  if (!table || typeof table !== 'object') return [];
  const hit = candidateCache.get(table);
  if (hit) return hit;
  const out = [];
  for (const entry of table.brands || []) {
    for (const name of [entry.brand, ...(entry.aliases || [])]) {
      const key = String(name || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
      if (key) out.push({ key, entry });
    }
  }
  // Longest first, so "knjaz milos" wins over "knjaz".
  out.sort((a, b) => b.key.length - a.key.length);
  candidateCache.set(table, out);
  return out;
}

export function findBoycottInTitle(title, table) {
  const hay = ` ${String(title || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()} `;
  if (hay.trim().length === 0) return null;

  // ALIASES THAT ARE ALSO ORDINARY WORDS.
  // This is the general rule, not a patch for one product. A brand name
  // that is ALSO an ingredient, a flavour or a common noun cannot be
  // matched mid-title, because mid-title it is almost always the word and
  // not the brand. Measured on the real catalogue:
  //   "guarana" (Knjaz Miloš's drink) hit "Glina Uje Mineral me Pjeshke dhe
  //     Guarana" — Glina is a KOSOVAR water brand and guarana is the plant.
  //   "nektar"/"nectar" (the Serbian juice company) hit 29 rows including
  //     "Despar Nektar Dardhe", where nektar is simply the word for nectar.
  // Each of these is a real Serbian brand and stays in the table; what
  // changes is that it must LEAD the title to count, which is how this
  // catalogue writes a producer ("Nectar Sok...", "Guarana 0.25l").
  // Add to this list whenever an alias is also a normal word — that is the
  // systemic fix, rather than excusing one product at a time.
  const AMBIGUOUS_ALIASES = new Set([
    'guarana',
    'nektar',
    'nectar',
    'gud',
    'stark',
    'duel',
    'pardon',
    'jaffa',
    'next',
    'sok',
    'voda',
    'vital',
  ]);

  const candidates = candidateList(table);

  for (const { key, entry } of candidates) {
    if (!hay.includes(` ${key} `)) continue;
    // A SHORT ALIAS BURIED MID-TITLE IS NOT EVIDENCE — it is an accusation.
    // Measured on the real catalogue with a 4-character floor: "rosa" (the
    // Serbian water brand) matched "Gioia Rosa Verë" (an Italian wine) and
    // "3 ROSA Sapun i parfumuar" (a soap), and a short alias reached
    // "Glina", a KOSOVAR water brand. Branding a Kosovar product Serbian is
    // the single worst error this app can make.
    // In this catalogue the producer leads the title ("Bambi Plazma...",
    // "Smoki"), so a short alias only counts at the START. Anything six
    // characters or longer ("plazma", "knjaz milos") is distinctive enough
    // to match anywhere, which is what catches "Biskote Bambi 300Gr Plazma".
    if (key.length < 6 && !hay.startsWith(` ${key} `)) continue;
    if (AMBIGUOUS_ALIASES.has(key) && !hay.startsWith(` ${key} `)) continue;
    return {
      reason: 'brand-in-title',
      brand: entry.brand,
      company: entry.company,
      country: entry.country,
      category: entry.category,
      evidence: entry.evidence,
      sourceUrl: entry.sourceUrl,
      matchedToken: key,
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// WHEN TWO REAL PRODUCERS SHARE ONE NAME
// ---------------------------------------------------------------------------
//
// Owner, 2026-09-18: "and if fluidi or albanian product registered in serbia
// dont mark as serbian product".
//
// AMBIGUOUS_ALIASES above handles a brand name that is also an ordinary word
// ("nektar", "voda"). This handles the harder version: a brand name that is
// also A DIFFERENT COMPANY'S BRAND. There the fix cannot be positional,
// because the other producer leads the title too.
//
// Measured on the shipped catalogue: 94 rows on a KOSOVO OR ALBANIAN GS1
// prefix were being flagged Serbian, and 92 of them were one brand — every
// single one a Fluidi juice caught by the "jaffa" alias of Jaffa Crvenka.
// That is this app's worst possible error: it told a shopper to boycott the
// Kosovar product it exists to send them to.
//
// The distinction is not a hunch, it is two fetched pages:
//   * jaffa.rs/en — "We are Jaffa Crvenka, one of the largest sweets and
//     snacks manufacturer in the West Balkans", founded "in a small
//     Vojvodina town of Crvenka, way back in 1975". Its complete brand list
//     (Jaffa cakes, Munchmallow, Napolitanke, Kolači, Buttons, Buttero,
//     O'cake, Tak, Njamb) contains NO drink of any kind.
//   * fluidi.net / fluidigroup.com — Jaffa Champion is Fluidi's juice, and
//     "Fluidi Group produces and operates out of their factory located in
//     Gjilan".
// Both are quoted in full in data/product-origins-SOURCES.md, at the same
// bar as an origin override: one entry here = one fetched, quoted source.
//
// THE GUARD IS DELIBERATELY NARROW, three ways:
//   1. It only ever fires on a hit that already happened, so it can never
//      invent a verdict — it can only withdraw a misidentification.
//   2. It never touches `reason: 'barcode'`. A curated barcode is a claim
//      about one product, not a name, and the one-way rule keeps its full
//      strength there.
//   3. It requires a POSITIVE test that the row is the other producer's kind
//      of product. An unclear row keeps the verdict it had — leaving a
//      correct-by-default answer alone is cheaper than an uncited flip.

const LIQUID_SIZE = /\b\d+(?:[.,]\d+)?\s*(?:l|lt|ltr|ml)\b/;
const WEIGHED = /\b\d+(?:[.,]\d+)?\s*(?:g|gr|gram|kg)\b/;
const NOT_A_DRINK = /cake|biskot|biscuit|keks|napolitank|kolac|sandwich|snack|wafer|vafel|munchmallow|button|\btops\b|brownie|cokollat|chocolat|bombon|karamel/;
// Covers both the Albanian free-text categories the retail catalogue uses
// ("PIJE", "Pije Freskuese", "Lengje") and Open Food Facts' English tag
// taxonomy ("en:fruit-juices", "en:non-alcoholic-beverages").
const DRINK_CATEGORY = /\bpije\b|\bpijet\b|leng|lengje|juice|drink|beverage|\bsok\b|soda|nektar|nectar|smoothie|lemonade/;

function fold(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Is this row positively a DRINK? Used only by the homonym guard, so a
 * "don't know" answer is safe: it leaves the existing verdict standing.
 *
 * It has to read more than `name` because the two sources shape a product
 * differently and the guard must behave identically on both. A catalogue row
 * carries its size inside the title ("Jaffa Multivitamin 0.25L") and a free
 * text `category`; Open Food Facts splits the size out into `quantity` and
 * gives `categories_tags`. Reading only the title meant the same juice
 * cleared on /eksploro and stayed accused on the scan screen.
 *
 * @param {{name?: string, quantity?: string, category?: string, categoriesTags?: string[]}|null} product
 */
export function looksLikeDrink(product) {
  const name = fold(product?.name);
  const size = fold(product?.quantity);
  if (!name && !size) return false;
  if (NOT_A_DRINK.test(name)) return false;
  if (WEIGHED.test(name) || (!LIQUID_SIZE.test(size) && WEIGHED.test(size))) return false;
  const tags = fold([product?.category, ...(product?.categoriesTags || [])].filter(Boolean).join(' '));
  return LIQUID_SIZE.test(name) || LIQUID_SIZE.test(size) || DRINK_CATEGORY.test(tags);
}

export const BRAND_HOMONYMS = [
  {
    alias: 'jaffa',
    boycottBrand: 'Jaffa Crvenka',
    otherBrand: 'Jaffa Champion',
    otherProducer: 'Fluidi Group L.L.C. — Velekincë, Gjilan, Kosovo',
    otherCountry: 'XK',
    applies: looksLikeDrink,
    note:
      'Jaffa Crvenka d.o.o. (Crvenka, Serbia) makes biscuits, wafers and sweets and no beverage at all; the "Jaffa" juice sold in Kosovo is Fluidi\'s Jaffa Champion, made in Gjilan.',
    sourceUrl: 'https://www.jaffa.rs/en/',
  },
];

/**
 * @param {object|null} boycott result of one of the three lookups above
 * @param {object|null} product  the catalogue row the hit was made against
 * @returns {null | typeof BRAND_HOMONYMS[number]} the homonym that makes this
 *   hit a misidentification — null means the hit stands.
 */
export function findBrandHomonym(boycott, product) {
  if (!boycott || !product) return null;
  // Rule 2: an exact curated barcode is never second-guessed here.
  if (boycott.reason === 'barcode') return null;
  // Both name-based lookups report the exact alias they matched on, which is
  // the only thing this guard is about — not the entry's display name.
  const token = fold(boycott.matchedToken);
  if (!token) return null;
  for (const h of BRAND_HOMONYMS) {
    if (h.alias !== token) continue;
    if (h.boycottBrand !== boycott.brand) continue;
    if (h.applies(product)) return h;
  }
  return null;
}
