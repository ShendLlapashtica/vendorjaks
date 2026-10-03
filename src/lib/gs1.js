// Pure logic for turning a barcode + the loaded prefix table into a verdict.
// No fetching here — see dataLoader.js for how the table gets built.

export const VERDICT = {
  SERBIAN: 'SERBIAN',
  LOCAL: 'LOCAL',
  // A real, identified country that is neither Serbia nor Kosovo/Albania.
  // Before 2026-09-12 this shared a screen with LOCAL, so an Italian or
  // German product was shown to the user under the word "vendore" (local)
  // with a green tick. That was the app being flatly wrong about the
  // majority of the world's barcodes; OTHER now has its own screen.
  OTHER: 'OTHER',
  // The prefix is real but identifies no country at all: an in-store
  // retailer number, a coupon, a book (ISBN), a magazine (ISSN), a refund
  // receipt, or a GS1 Global Office allocation. Never show a flag for these.
  NOT_A_COUNTRY: 'NOT_A_COUNTRY',
  // A well-formed barcode whose prefix GS1 has not allocated to anyone.
  UNASSIGNED: 'UNASSIGNED',
  // Not a usable barcode at all (too short, empty, garbage).
  UNKNOWN: 'UNKNOWN',
};

/** Verdicts that should render a country flag. */
export function verdictHasFlag(verdict) {
  return verdict === VERDICT.SERBIAN || verdict === VERDICT.LOCAL || verdict === VERDICT.OTHER;
}

function emptyResult(verdict, prefix = null) {
  return {
    verdict,
    prefix,
    isSerbiaPrefix: false,
    country: null,
    countrySq: null,
    iso: null,
    kind: null,
    note: null,
  };
}

/**
 * The only digit lengths that are a GTIN at all.
 *
 * 8  GTIN-8  (EAN-8)
 * 12 GTIN-12 (UPC-A)
 * 13 GTIN-13 (EAN-13)
 * 14 GTIN-14 (ITF-14 / case code: a GTIN-13 with a leading packaging
 *    indicator digit)
 *
 * ANY OTHER LENGTH IS NOT A BARCODE, and this is load-bearing — see the
 * comment in classifyBarcode().
 */
const GTIN_LENGTHS = new Set([8, 12, 13, 14]);

/**
 * @param {string} code - the scanned/entered barcode (EAN-13, EAN-8, UPC-A or GTIN-14).
 * @param {{ranges: Array<{min:number,max:number,country:string,countrySq:string,iso:string|null,kind:string,isSerbia:boolean,isLocal:boolean,note:string|null}>}} gs1Table
 */
export function classifyBarcode(code, gs1Table) {
  const digits = String(code || '').replace(/\D/g, '');

  // WHY THE LENGTH IS CHECKED EXACTLY RATHER THAN AS `< 8`
  // (root cause of the wrong-flag bug reported by the owner, 2026-09-16:
  // "UJE DEA 2LX6 ... renders a United States flag").
  //
  // 41.5% of data/kosovo-retail.json rows carry a `barcode`, but the field
  // is whatever the retailer's export put there — and for some shops that
  // is an internal SKU, not a GTIN. Super Viva ships "VIVA000003663" and
  // "P0241"; others ship "PLU-601", "KOD0000004390", "LMX-1705-2".
  //
  // The old code stripped non-digits and accepted anything >= 8 digits.
  // "VIVA000003663" therefore became "000003663" — nine digits, no
  // normalisation branch matched, and prefix "000" landed squarely in the
  // GS1 US range 000-019. A Kosovo mineral water rendered the flag of the
  // United States, at full confidence, on the busiest strip of /eksploro.
  //
  // A shelf SKU is not a barcode. Saying "we don't know" is the correct
  // answer for it, and it is the only answer that cannot be wrong.
  if (!GTIN_LENGTHS.has(digits.length)) {
    return emptyResult(VERDICT.UNKNOWN);
  }

  let normalized = digits;

  // GTIN-14 is a GTIN-13 behind a packaging indicator digit. Reading the
  // prefix off the indicator gave nonsense: "03902208390266" (Finnesa
  // flour) read as prefix 039 = GS1 US, when the real code is
  // 3902208390266 -> 390 = Kosovo. 88 catalogue rows, every one wrong.
  if (normalized.length === 14) normalized = normalized.slice(1);

  // UPC-A is conventionally a GTIN-13 with a leading 0, which correctly
  // puts it in the 000-019 US/Canada range.
  if (normalized.length === 12) normalized = `0${normalized}`;

  // GTIN-8 KEEPS ITS OWN FIRST THREE DIGITS. It must NOT be zero-padded to
  // 13: padding forces every EAN-8 to prefix "000" = United States, which
  // is how 1,574 catalogue rows — Monini olive oil (800 = Italy), Toblerone
  // (761 = Switzerland), Zott Monte (401 = Germany), Rauch Bravo (901 =
  // Austria) — all came out American. The GS1 General Specifications
  // allocate GS1-8 Prefixes from the same numeric country space, so the
  // leading three digits read against the same table.
  if (normalized.length === 8) {
    // ...with one carve-out: GS1-8 Prefixes 0 and 2 are reserved for
    // restricted circulation (company-internal / in-store), exactly as
    // 020-029 and 040-049 are in the 13-digit space. They name no country.
    const lead = normalized[0];
    if (lead === '0' || lead === '2') {
      return { ...emptyResult(VERDICT.NOT_A_COUNTRY, normalized.slice(0, 3)), kind: 'restricted' };
    }
  }

  const prefix = normalized.slice(0, 3);
  const prefixNum = parseInt(prefix, 10);

  const ranges = gs1Table?.ranges || [];
  const match = ranges.find((r) => prefixNum >= r.min && prefixNum <= r.max);

  // No match means the loaded table is incomplete, not that the barcode is
  // bad. The shipped table covers all 1000 prefixes, so this is only
  // reachable with the built-in fallback table.
  if (!match) {
    return emptyResult(VERDICT.UNKNOWN, prefix);
  }

  const kind = match.kind || 'country';

  let verdict;
  if (match.isSerbia) verdict = VERDICT.SERBIAN;
  else if (match.isLocal) verdict = VERDICT.LOCAL;
  else if (kind === 'unassigned') verdict = VERDICT.UNASSIGNED;
  else if (kind !== 'country') verdict = VERDICT.NOT_A_COUNTRY;
  else verdict = VERDICT.OTHER;

  return {
    verdict,
    prefix,
    // Whether the PREFIX ITSELF is Serbian, kept separately from the final
    // verdict so a boycott override (see lib/boycott.js) can tell the
    // difference between "860, obviously Serbian" and "387, but the brand
    // is Marbo/Serbia" — the second needs explaining to the user, the
    // first does not.
    isSerbiaPrefix: Boolean(match.isSerbia),
    country: match.country,
    countrySq: match.countrySq || match.country,
    // Only ever set for a real country — guarantees a flag is never drawn
    // for a coupon, an ISBN or an in-store number.
    iso: kind === 'country' ? match.iso || null : null,
    kind,
    note: match.note || null,
  };
}

/**
 * Loosely validates that a string could plausibly be a product barcode.
 *
 * Deliberately the SAME length set the classifier accepts (GTIN_LENGTHS), so
 * a string this returns false for is exactly a string classifyBarcode()
 * refuses to draw a flag from. They used to disagree about 14-digit case
 * codes, which is how a GTIN-14 could be classified but not shown.
 */
export function isPlausibleBarcode(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return GTIN_LENGTHS.has(digits.length);
}
