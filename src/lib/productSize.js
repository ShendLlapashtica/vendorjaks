// How much is in the pack — one place, used by the app and by
// scripts/enrich-sizes.mjs, so there is exactly one answer per product.
//
// Owner, 2026-09-16: "leave nothing undocumented like a random product
// without a history name or grams or price".
//
// WHERE THE NUMBER COMES FROM, and why this file exists at all.
//
// data/kosovo-retail.json (90,133 rows) already carries a `quantity` display
// string on 61,603 rows (68.3%), written by parseQuantityFromName() in
// scripts/harvest-more.mjs and labelled `quantitySource`. That stored value
// ALWAYS WINS here (see resolveProductSize) — this module never overrides the
// pipeline, it only answers for the rows the pipeline left null. Two parsers
// printing two different sizes for one product is the failure mode this
// ordering exists to make impossible.
//
// Why 31.7% is missing — MEASURED, not assumed (scripts/enrich-sizes.mjs):
//   * 1,836 rows come from five sources (begmart.com, super-viva.com,
//     wolt.com/al/market-roa-1, /neni-fruits, /dyqan-deti) that never ran
//     through harvest-more.mjs's quantity step at all. This is a PIPELINE
//     coverage gap, not a regex gap: the existing regex reads "POMFRIT
//     2.5KG" and "PARIZIER 300G" correctly — it is case-insensitive and
//     uppercase Albanian titles were never the problem. It simply never saw
//     these rows.
//   * The rest are titles where the unit is written BEFORE the number, the
//     Italian-import convention that dominates the Conad rows:
//     "Novi Tavoletta Gr 100", "Qumesht Uht Conad Lt1", "Crich Frollini
//     G.270", "Migro Lenticchie Gr400", "Kremvice Derri Conad Gr100X4".
//   * And a large, irreducible remainder of titles that genuinely state no
//     size: "Biskrem Duo", "Zott Toasty Emmental", "La Puglia Guanciale".
//     Those stay unknown. There is no size in the string to find.
//
// Titles this module reads:
//
//     "POMFRIT 2.5KG K&K ELKOS (4)"        -> 2.5 kg
//     "Rio Mare Tonno Olio Oliva 2*80Gr"   -> 2 x 80 g  (160 g net)
//     "Labello Soft Rose' Ml.5.5"          -> 5.5 ml
//     "Det.Duel Leng Color Care 2.45 Lit"  -> 2.45 l
//     "RRUSH I ZI /KG PLU.152"             -> sold by weight, no pack size
//
// THE RULE THIS FILE LIVES UNDER: **a wrong gram figure is worse than no
// gram figure.** A shopper comparing two prices per kilo is doing arithmetic
// on whatever we print. So every branch below either returns a figure it can
// point at a substring for, or returns null and lets the UI say "unknown".
// `raw` is that substring, kept on every result, so any number on screen can
// be traced back to the exact characters it was read from.
//
// THINGS THAT LOOK LIKE A SIZE AND ARE NOT — each one is a real pattern in
// this catalogue, each one is deliberately refused:
//
//   "(4)" "(15)" "(30)"      trailing pack count, no unit           -> null
//   "Pz5" "120pcs" "90 kapsula"  piece counts                       -> null
//   "Fru Fru Jogurt 0.1% 150G"   0.1% is fat content, not size      -> 150 g
//   "Succo Ace Conad 200X3"      multipack with no unit anywhere    -> null
//   "Schafer Rena 200X230-Ecru"  textile dimensions in cm           -> null
//   "Corn Tortilla 15Cm X40 1KG" 15Cm is a diameter                 -> 1 kg
//   "Barilla Penne No73 500Gr"   No73 is a shape number             -> 500 g
//   "Kripe Himalaya 0.5Kr"       "Kr" is a typo, not a unit         -> null
//   "Vino Rosso 2019 0.75L"      2019 is a vintage                  -> 0.75 l
//   "Suplement 500MG 90 kapsula" mg is a per-capsule DOSE, not net  -> null
//   "RRUSH I ZI /KG PLU.152"     PLU.152 is a till code, not 152 g  -> byWeight
//
// SOLD BY WEIGHT is a THIRD answer, not a missing one. 64 rows in this
// catalogue are loose goods — apples, grapes, cured meat — listed "/KG" with
// a supermarket price-lookup code ("PLU.152"). They have no pack size
// because they have no pack; their price is per kilo. Reading "152" out of
// "PLU.152" would invent a fact, and calling them "unknown" would hide one.
// parseProductSize() refuses them; isSoldByWeight() names them.
//
// mg is refused ON PURPOSE (see MG_IS_A_DOSE below) even though the token is
// unambiguous, because what it measures is not the thing we would be
// printing it as.

/** Units we accept, mapped to a canonical unit and a conversion. */
const UNITS = {
  // mass
  KG: { unit: 'kg', kind: 'mass', toGrams: 1000 },
  KGR: { unit: 'kg', kind: 'mass', toGrams: 1000 },
  G: { unit: 'g', kind: 'mass', toGrams: 1 },
  GR: { unit: 'g', kind: 'mass', toGrams: 1 },
  GRAM: { unit: 'g', kind: 'mass', toGrams: 1 },
  GRAME: { unit: 'g', kind: 'mass', toGrams: 1 },
  GRS: { unit: 'g', kind: 'mass', toGrams: 1 },
  // volume
  L: { unit: 'l', kind: 'volume', toMl: 1000 },
  LT: { unit: 'l', kind: 'volume', toMl: 1000 },
  LIT: { unit: 'l', kind: 'volume', toMl: 1000 },
  LITER: { unit: 'l', kind: 'volume', toMl: 1000 },
  LITRA: { unit: 'l', kind: 'volume', toMl: 1000 },
  LITRI: { unit: 'l', kind: 'volume', toMl: 1000 },
  ML: { unit: 'ml', kind: 'volume', toMl: 1 },
  MLL: { unit: 'ml', kind: 'volume', toMl: 1 },
  CL: { unit: 'cl', kind: 'volume', toMl: 10 },
  DL: { unit: 'dl', kind: 'volume', toMl: 100 },
};

// Refused on purpose. Each of these reads as a unit and measures the wrong
// thing, so matching one is a decision to return null rather than to guess.
//   MG  — on this catalogue mg is the active-ingredient dose of one capsule
//         ("Suplement per prostaten 500MG 90 kapsula"), never the net pack
//         weight. Printing it as the pack size would be a fabricated figure.
//   CM / MM — a length: tortilla diameter, foil width, bin-bag dimensions.
//   CC  — ambiguous in this catalogue between cm3 and the "CC cream"
//         cosmetics category; too few rows to be worth the risk of either.
const MG_IS_A_DOSE = new Set(['MG', 'MCG', 'UG', 'IU', 'CM', 'MM', 'CC', 'M', 'KR', 'PZ', 'PCS', 'KOM', 'CP', 'TBL']);

const UNIT_ALTERNATION = Object.keys(UNITS)
  // longest first so "GRAME" is not eaten by "GR"
  .sort((a, b) => b.length - a.length)
  .join('|');

// A number: 1 · 1.5 · 1,5 · 0,33 · 256.2 · 2.45
const NUM = '\\d{1,5}(?:[.,]\\d{1,3})?';

// N x V unit  ("6X1.5L", "2*80Gr", "12 X 135 G", "3x200ml")
const MULTIPACK_RE = new RegExp(`(?<![\\d.,])(\\d{1,3})\\s*[X*×]\\s*(${NUM})\\s*(${UNIT_ALTERNATION})(?![A-Z0-9])`, 'gi');
// V unit x N  ("1.5L X6", "500Gr x 4")
const MULTIPACK_REV_RE = new RegExp(`(?<![\\d.,])(${NUM})\\s*(${UNIT_ALTERNATION})\\s*[X*×]\\s*(\\d{1,3})(?![\\d.,])`, 'gi');
// V unit ("500Gr", "1 KG", "0,33L", "2.45 Lit")
const SINGLE_RE = new RegExp(`(?<![\\d.,])(${NUM})\\s*(${UNIT_ALTERNATION})(?![A-Z0-9])`, 'gi');
// unit V ("Ml.5.5", "Gr 100", "Lt1", "G.270", "Gr400") — the unit written
// BEFORE the number, the Italian-import convention on the Conad rows.
const REVERSED_RE = new RegExp(`(?<![A-Z0-9])(${UNIT_ALTERNATION})\\.?\\s*(${NUM})(?![\\d.,]*\\s*%)(?![A-Z0-9])`, 'gi');
// unit V x N ("Gr100X4", "Gr 100 x 4")
const REVERSED_MULTI_RE = new RegExp(
  `(?<![A-Z0-9])(${UNIT_ALTERNATION})\\.?\\s*(${NUM})\\s*[X*×]\\s*(\\d{1,3})(?![\\d.,])`,
  'gi'
);

// Loose goods: a per-kilo listing, usually with the till's price-lookup code.
//   "MOLLE DELISHES KG/PLU.601"  "RRUSH I ZI /KG PLU.152"  "PJESHKA /KG PLU.86"
// The "/KG" is the giveaway; PLU alone is enough too, since a PLU code only
// exists for unpackaged produce and counter goods.
const BY_WEIGHT_RE = /(^|[\s(/])(?:kg\s*\/|\/\s*kg\b|per\s*kg\b)|(^|[\s(/.])plu[\s.:]*\d/i;

/**
 * True when the LISTING is per kilo rather than per pack — loose produce and
 * counter goods. A real, stateable answer ("shitet me kilogram"), never to be
 * reported as a missing size.
 */
export function isSoldByWeight(title) {
  const text = String(title || '');
  if (!text.trim()) return false;
  return BY_WEIGHT_RE.test(text);
}

// Piece counts, for things that have no sensible mass at all: toilet roll,
// nappies, teabags, wet wipes. Same vocabulary as RE_PIECES in
// scripts/harvest-more.mjs so the two agree, plus the "10/1" notation this
// catalogue uses constantly ("LETER TUALETI PALOMA WHITE 10/1 (9)" = 10
// rolls). Deliberately NOT included: "100 LARJE" (washes) and "87Larj",
// which are a dose estimate the manufacturer prints, not a count of objects
// in the box.
const PIECES_RE = /(?<![\d.,])(\d{1,4})\s*(cope|copë|cop|pcs|pcsz|pc|pz|ks|kom|kokrra)\b/i;
const PIECES_SLASH_RE = /(?<![\d.,/])(\d{1,3})\s*\/\s*1(?![\d.,])/;

/**
 * A pack's piece count when it has one and no mass/volume — "10 copë".
 * Returned as its own kind so it can never be printed where grams belong.
 */
export function parsePieceCount(title) {
  const text = String(title || '');
  if (!text.trim()) return null;
  const m = text.match(PIECES_RE) || text.match(PIECES_SLASH_RE);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (!Number.isFinite(n) || n <= 0 || n > 5000) return null;
  return { count: n, raw: m[0].trim() };
}

// Plausibility fence. Nothing sold in a Kosovo supermarket is 300 kg, and a
// four-digit "gram" reading is far more often a model number than a sack.
const MAX_GRAMS = 50000;
const MAX_ML = 50000;

function toNumber(str) {
  // "1,5" and "1.5" are the same number here; the catalogue uses both, often
  // in the same title. No thousands separators appear in these size tokens
  // (the largest real value is a 25 kg flour sack), so a comma is always a
  // decimal point.
  const n = parseFloat(String(str).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function trimNumber(n) {
  return Math.round(n * 1000) / 1000;
}

/**
 * Build a candidate from a parsed (count, value, unitToken) triple, or null
 * if it does not survive the plausibility fence.
 */
function makeCandidate({ count, value, unitToken, raw, index }) {
  const spec = UNITS[unitToken.toUpperCase()];
  if (!spec) return null;
  if (value == null || !(value > 0)) return null;
  const packs = count && count > 0 ? count : 1;
  // Same ceiling as parseQuantityFromName() in scripts/harvest-more.mjs, on
  // purpose: the two must agree about what counts as a plausible multipack.
  // ("CAJ I GJELBERT AHMAD 100*2GR" really is 100 teabags of 2 g.)
  if (packs > 200) return null;

  const cand = {
    value: trimNumber(value),
    unit: spec.unit,
    count: packs,
    kind: spec.kind,
    grams: null,
    ml: null,
    raw,
    index,
  };

  if (spec.kind === 'mass') {
    const grams = trimNumber(value * spec.toGrams * packs);
    if (!(grams > 0) || grams > MAX_GRAMS) return null;
    cand.grams = grams;
  } else {
    const ml = trimNumber(value * spec.toMl * packs);
    if (!(ml > 0) || ml > MAX_ML) return null;
    cand.ml = ml;
  }
  return cand;
}

/** Same physical quantity? Used to decide whether two matches disagree. */
function sameQuantity(a, b) {
  if (a.kind !== b.kind) return false;
  const x = a.kind === 'mass' ? a.grams : a.ml;
  const y = b.kind === 'mass' ? b.grams : b.ml;
  return Math.abs(x - y) < 0.001;
}

/**
 * Parse a pack size out of a product title.
 *
 * @param {string} title
 * @returns {null | {
 *   value: number,     // size of ONE item ("1.5" of "6 x 1.5 L")
 *   unit: string,      // canonical: kg | g | l | ml | cl | dl
 *   count: number,     // multipack multiplier, 1 when not a multipack
 *   kind: 'mass'|'volume',
 *   grams: number|null,// TOTAL net mass, when the unit measures mass
 *   ml: number|null,   // TOTAL net volume, when the unit measures volume
 *   raw: string,       // the exact substring this was read from — the audit trail
 * }}
 */
export function parseProductSize(title) {
  const text = String(title || '');
  if (!text.trim()) return null;

  // Loose goods have no pack size to find, and their PLU digits are the one
  // thing in these titles most likely to be misread as one. Refused whole
  // rather than picked at — isSoldByWeight() is the answer for these.
  if (isSoldByWeight(text)) return null;

  const candidates = [];
  const claimed = [];

  function overlapsClaimed(start, end) {
    return claimed.some(([s, e]) => start < e && end > s);
  }

  // 1. Multipacks first — "6X1.5L" must not be read as a bare "1.5L", and
  //    its own "6" must not later be read as a separate number.
  for (const m of text.matchAll(MULTIPACK_RE)) {
    const cand = makeCandidate({
      count: parseInt(m[1], 10),
      value: toNumber(m[2]),
      unitToken: m[3],
      raw: m[0].trim(),
      index: m.index,
    });
    claimed.push([m.index, m.index + m[0].length]);
    if (cand) candidates.push(cand);
  }
  for (const m of text.matchAll(MULTIPACK_REV_RE)) {
    if (overlapsClaimed(m.index, m.index + m[0].length)) continue;
    const cand = makeCandidate({
      count: parseInt(m[3], 10),
      value: toNumber(m[1]),
      unitToken: m[2],
      raw: m[0].trim(),
      index: m.index,
    });
    claimed.push([m.index, m.index + m[0].length]);
    if (cand) candidates.push(cand);
  }

  // 2. Plain "<number><unit>".
  for (const m of text.matchAll(SINGLE_RE)) {
    if (overlapsClaimed(m.index, m.index + m[0].length)) continue;
    // A number immediately preceded by "no", "nr", "n." is a shape/series
    // number that happens to be followed by a unit-looking letter.
    const before = text.slice(Math.max(0, m.index - 4), m.index).toUpperCase();
    if (/\b(NO|NR|N)\.?\s*$/.test(before)) continue;
    // "%" before the number means we are in a fat/alcohol-content clause.
    const cand = makeCandidate({
      count: 1,
      value: toNumber(m[1]),
      unitToken: m[2],
      raw: m[0].trim(),
      index: m.index,
    });
    claimed.push([m.index, m.index + m[0].length]);
    if (cand) candidates.push(cand);
  }

  // 3. "<unit><number>" — "Gr 100", "Lt1", "Ml.5.5", "Gr100X4". Only
  //    consulted when nothing else matched, because it is the loosest form:
  //    a stray "L" or "G" in a brand name sitting next to any number would
  //    otherwise become a size.
  if (candidates.length === 0) {
    for (const m of text.matchAll(REVERSED_MULTI_RE)) {
      const cand = makeCandidate({
        count: parseInt(m[3], 10),
        value: toNumber(m[2]),
        unitToken: m[1],
        raw: m[0].trim(),
        index: m.index,
      });
      claimed.push([m.index, m.index + m[0].length]);
      if (cand) candidates.push(cand);
    }
    for (const m of text.matchAll(REVERSED_RE)) {
      if (overlapsClaimed(m.index, m.index + m[0].length)) continue;
      const cand = makeCandidate({
        count: 1,
        value: toNumber(m[2]),
        unitToken: m[1],
        raw: m[0].trim(),
        index: m.index,
      });
      claimed.push([m.index, m.index + m[0].length]);
      if (cand) candidates.push(cand);
    }
  }

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return finalise(candidates[0]);

  // Several readings. They only agree if they are literally the same
  // quantity ("500 Gr ... 500G" in a doubled title). Anything else is
  // ambiguous — "Kafe 250Gr Qese 1KG" could be either — and ambiguous means
  // unknown, not "pick the biggest and hope".
  const first = candidates[0];
  if (candidates.every((c) => sameQuantity(c, first))) return finalise(first);
  return null;
}

function finalise(cand) {
  // `index` is an internal detail of the overlap bookkeeping, not part of
  // the contract.
  const { index, ...rest } = cand;
  return rest;
}

/**
 * The size as a shopper reads it. Returns null when there is no size — the
 * caller is responsible for saying "unknown" out loud, this never invents a
 * placeholder.
 *
 *   {value:1.5, unit:'l', count:6}  -> "6 × 1.5 l (9 l)"
 *   {value:500, unit:'g', count:1}  -> "500 g"
 */
export function formatSize(size) {
  if (!size) return null;
  const one = `${trimNumber(size.value)} ${size.unit}`;
  if (!size.count || size.count === 1) return one;
  const total = size.kind === 'mass' ? formatTotalMass(size.grams) : formatTotalVolume(size.ml);
  return total ? `${size.count} × ${one} (${total})` : `${size.count} × ${one}`;
}

function formatTotalMass(grams) {
  if (grams == null) return null;
  return grams >= 1000 ? `${trimNumber(grams / 1000)} kg` : `${trimNumber(grams)} g`;
}

function formatTotalVolume(ml) {
  if (ml == null) return null;
  return ml >= 1000 ? `${trimNumber(ml / 1000)} l` : `${trimNumber(ml)} ml`;
}

/**
 * THE ONE ENTRY POINT. Every screen asks this and nothing else, so one
 * product can only ever have one size on it.
 *
 * Order matters and is not arbitrary:
 *   1. A stored `quantity` string — Open Food Facts publishes one, and
 *      data/kosovo-retail.json carries one on 68.3% of rows written by
 *      scripts/harvest-more.mjs. The pipeline's answer always wins; this
 *      module never second-guesses a value someone else already recorded.
 *   2. A `size` object already parsed onto the record.
 *   3. Sold-by-weight, from the title — a real answer, not a gap.
 *   4. The title, parsed here. This is the 31.7% the pipeline never reached.
 *
 * @returns {{kind:'size'|'byWeight', text: string|null, source: string,
 *            raw: string|null, size: object|null} | null}
 *          null means genuinely unknown — the caller MUST then render the
 *          "unknown" string. It must never render an empty element.
 */
export function resolveProductSize(product) {
  if (!product) return null;

  const explicit = product.quantity || product.size_text || null;
  if (typeof explicit === 'string' && explicit.trim()) {
    return {
      kind: 'size',
      text: explicit.trim(),
      source: product.quantitySource || 'field',
      raw: explicit.trim(),
      size: null,
    };
  }

  if (product.size && typeof product.size === 'object' && product.size.unit) {
    const text = formatSize(product.size);
    if (text) return { kind: 'size', text, source: 'field', raw: product.size.raw || null, size: product.size };
  }

  const title = product.name || product.title || '';

  if (isSoldByWeight(title)) {
    return { kind: 'byWeight', text: null, source: 'parsed-from-product-name', raw: null, size: null };
  }

  const parsed = parseProductSize(title);
  if (parsed) {
    const text = formatSize(parsed);
    if (text) return { kind: 'size', text, source: 'parsed-from-product-name', raw: parsed.raw, size: parsed };
  }

  // No mass or volume — but a roll count or a teabag count is still a real,
  // printed fact about the pack, and it goes in its own slot so it can never
  // be mistaken for grams.
  const pieces = parsePieceCount(title);
  if (pieces) {
    return { kind: 'pieces', text: null, count: pieces.count, source: 'parsed-from-product-name', raw: pieces.raw, size: null };
  }

  return null;
}
