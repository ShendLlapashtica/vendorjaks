import { describe, it, expect } from 'vitest';
import gs1Raw from '../../data/gs1-prefixes.json';
import originsRaw from '../../data/product-origins.json';
import { classifyBarcode, isPlausibleBarcode, VERDICT } from '../lib/gs1.js';
import { normalizeProductOrigins, findVerifiedOrigin, resolveOrigin, originIso } from '../lib/productOrigins.js';
import { productStance, localClaimBadge } from '../lib/flagTone.js';
import { dictionary } from '../i18n/dictionary.js';
import { normalizeBoycottTable } from '../lib/boycott.js';
import boycottRaw from '../../data/boycott-brands.json';
import stanceRaw from '../../data/country-stance.json';
import { normalizeStanceTable } from '../lib/countryStance.js';

// Builds the SHIPPED prefix table the same way dataLoader.js does, so these
// tests run against the real 1000-prefix allocation rather than a fixture
// that could drift away from it.
function buildGs1Table() {
  const ranges = gs1Raw.prefixes.map((p) => {
    const [minStr, maxStr] = String(p.range).split('-');
    const min = parseInt(minStr, 10);
    const max = maxStr ? parseInt(maxStr, 10) : min;
    const kind = p.kind || 'country';
    return {
      min,
      max,
      country: p.country,
      countrySq: p.countrySq || p.country,
      iso: kind === 'country' ? p.iso || null : null,
      kind,
      isSerbia: p.isSerbia === true || min === 860,
      isLocal: p.isLocal === true || [381, 390, 530].includes(min),
      note: p.note || null,
    };
  });
  return { ranges };
}

const gs1 = buildGs1Table();
const productOrigins = normalizeProductOrigins(originsRaw);
const boycott = normalizeBoycottTable(boycottRaw);
const countryStance = normalizeStanceTable(stanceRaw);
const data = { gs1, productOrigins, boycott, countryStance };

// ===========================================================================
// 1. NO BARCODE MAY MAP TO A COUNTRY OUTSIDE ITS GS1 ALLOCATION
// ===========================================================================
//
// Reported by the owner, 2026-09-16: on /eksploro, `UJE DEA 2LX6 MINERAL
// KOMPLET` — a Kosovo water brand — rendered a UNITED STATES flag.
//
// Root cause: classifyBarcode() accepted any digit string of length >= 8 and
// zero-padded 8-digit ones to 13. Super Viva's export puts an internal SKU in
// the barcode field ("VIVA000003663"), which stripped to nine digits, matched
// no normalisation branch, and read as prefix "000" = GS1 US. The same
// padding made every genuine EAN-8 American as well.
describe('classifyBarcode never invents a country', () => {
  it('a retailer SKU in the barcode field is UNKNOWN, not the United States', () => {
    // The exact string from data/kosovo-retail.json for UJE DEA 2LX6 NATYRAL.
    const result = classifyBarcode('VIVA000003663', gs1);
    expect(result.verdict).toBe(VERDICT.UNKNOWN);
    expect(result.iso).toBeNull();
  });

  it('other real SKU shapes in the catalogue also yield no country', () => {
    for (const sku of ['P0241', 'PLU-601', 'KOD0000004390', 'LMX-1705-2']) {
      const result = classifyBarcode(sku, gs1);
      expect(result.iso, `${sku} must not name a country`).toBeNull();
    }
  });

  it('reads an EAN-8 prefix off its own first three digits, not off zero padding', () => {
    // Real catalogue codes. Zero-padding to 13 made every one of these US.
    const cases = [
      ['80053835', 'IT'], // VAJ ULLIRI MONINI 1L    -> 800 Italy
      ['76145759', 'CH'], // Toblerone 35G           -> 761 Switzerland
      ['40145389', 'DE'], // Zott Monte 100G         -> 401 Germany
      ['90169380', 'AT'], // LENG BRAVO 1.5L (Rauch) -> 901 Austria
      ['30158078', 'FR'], // L'Oreal Professionnel   -> 301 France
    ];
    for (const [code, iso] of cases) {
      expect(classifyBarcode(code, gs1).iso, code).toBe(iso);
    }
  });

  it('treats GS1-8 prefixes 0 and 2 as restricted circulation, naming no country', () => {
    expect(classifyBarcode('03400500', gs1).iso).toBeNull();
    expect(classifyBarcode('20605001', gs1).iso).toBeNull();
    expect(classifyBarcode('03400500', gs1).verdict).toBe(VERDICT.NOT_A_COUNTRY);
  });

  it('strips the GTIN-14 packaging indicator before reading the prefix', () => {
    // 03902208390266 -> 3902208390266 -> 390 = Kosovo (Finnesa flour).
    // Reading 039 off the indicator digit made it American.
    expect(classifyBarcode('03902208390266', gs1).iso).toBe('XK');
    // 05319990334411 -> 5319990334411 -> 531 = North Macedonia (was: coupon).
    expect(classifyBarcode('05319990334411', gs1).iso).toBe('MK');
    // 04001686705315 -> 4001686705315 -> 400 = Germany (Haribo; was: restricted).
    expect(classifyBarcode('04001686705315', gs1).iso).toBe('DE');
  });

  it('isPlausibleBarcode agrees with the classifier about what is a barcode', () => {
    for (const good of ['12345678', '123456789012', '8600043000016', '03902208390266']) {
      expect(isPlausibleBarcode(good), good).toBe(true);
    }
    for (const bad of ['VIVA000003663', 'P0241', 'PLU-601', '123', '']) {
      expect(isPlausibleBarcode(bad), bad).toBe(false);
    }
  });

  // The strong form of the owner's complaint: sweep EVERY prefix and assert
  // the ISO it yields belongs to the range the shipped table allocates it to.
  it('every prefix 000-999 resolves to the ISO its own allocation declares', () => {
    for (const entry of gs1Raw.prefixes) {
      const [minStr, maxStr] = String(entry.range).split('-');
      const min = parseInt(minStr, 10);
      const max = maxStr ? parseInt(maxStr, 10) : min;
      const expected = (entry.kind || 'country') === 'country' ? entry.iso || null : null;
      for (let p = min; p <= max; p++) {
        const code = String(p).padStart(3, '0') + '0000000000';
        const got = classifyBarcode(code, gs1).iso;
        expect(got, `prefix ${p} (${entry.range}, ${entry.country})`).toBe(expected);
      }
    }
  });
});

// ===========================================================================
// 2. KOSOVO AND ALBANIAN PREFIXES NEVER RENDER A FOREIGN FLAG
// ===========================================================================
describe('Kosovo (381/390) and Albania (530) prefixes', () => {
  const KOSOVO = ['381', '390'];
  const ALBANIA = ['530'];

  it('381 and 390 always resolve to XK, in every GTIN length', () => {
    for (const p of KOSOVO) {
      expect(classifyBarcode(`${p}0000000000`, gs1).iso, `${p} as EAN-13`).toBe('XK');
      expect(classifyBarcode(`0${p}0000000000`, gs1).iso, `${p} as GTIN-14`).toBe('XK');
      expect(classifyBarcode(`${p}00000`, gs1).iso, `${p} as EAN-8`).toBe('XK');
    }
  });

  it('530 always resolves to AL, in every GTIN length', () => {
    for (const p of ALBANIA) {
      expect(classifyBarcode(`${p}0000000000`, gs1).iso, `${p} as EAN-13`).toBe('AL');
      expect(classifyBarcode(`0${p}0000000000`, gs1).iso, `${p} as GTIN-14`).toBe('AL');
      expect(classifyBarcode(`${p}00000`, gs1).iso, `${p} as EAN-8`).toBe('AL');
    }
  });

  it('a Kosovo or Albanian prefix is LOCAL and never Serbian', () => {
    for (const p of [...KOSOVO, ...ALBANIA]) {
      const r = classifyBarcode(`${p}0000000000`, gs1);
      expect(r.verdict).toBe(VERDICT.LOCAL);
      expect(r.isSerbiaPrefix).toBe(false);
    }
  });

  it('real Kosovo/Albanian catalogue codes keep their own flag', () => {
    expect(classifyBarcode('3900864510066', gs1).iso).toBe('XK'); // Koral parizier
    expect(classifyBarcode('3908767440022', gs1).iso).toBe('XK'); // Sabaja
    expect(classifyBarcode('5304000430238', gs1).iso).toBe('AL'); // Jaffa Albania
  });
});

// ===========================================================================
// 3. THE BIMILK CASE — registration, manufacture and ownership stay apart
// ===========================================================================
describe('Bimilk: a North Macedonian product on a Serbian GS1 prefix', () => {
  const BIMILK_RS = '8601500111207'; // JOGURT BIMILK 1L 1% BALANS
  const BIMILK_MK = '5310054000921'; // same brand, GS1 North Macedonia
  const product = { barcode: BIMILK_RS, name: 'JOGURT BIMILK 1L 1% BALANS', brand: 'Bimilk' };

  it('the prefix really is Serbian — that fact is not being denied', () => {
    const c = classifyBarcode(BIMILK_RS, gs1);
    expect(c.prefix).toBe('860');
    expect(c.iso).toBe('RS');
    expect(c.isSerbiaPrefix).toBe(true);
  });

  it('the same brand also ships on a North Macedonian prefix', () => {
    expect(classifyBarcode(BIMILK_MK, gs1).iso).toBe('MK');
  });

  it('product-origins.json carries a verified Macedonian production location', () => {
    const origin = findVerifiedOrigin({ code: BIMILK_RS, brand: 'Bimilk' }, productOrigins);
    expect(origin).not.toBeNull();
    expect(origin.verified).toBe(true);
    expect(origin.productionCountry).toBe('MK');
    expect(origin.isSerbia).toBe(false);
    expect(origin.sourceUrl).toMatch(/^https?:\/\//);
    expect(origin.ownership).toBeTruthy();
    expect(origin.ownershipCountry).toBe('RS');
  });

  it('resolveOrigin keeps all three facts, and marks them divergent', () => {
    const classify = classifyBarcode(BIMILK_RS, gs1);
    const origin = findVerifiedOrigin({ code: BIMILK_RS, brand: 'Bimilk' }, productOrigins);
    const split = resolveOrigin(classify, origin);
    expect(split.registrationIso).toBe('RS'); // registration: still stated
    expect(split.manufactureIso).toBe('MK'); // manufacture: the flag drawn
    expect(split.serbianOwned).toBe(true); // ownership: still disclosed
    expect(split.divergent).toBe(true);
    expect(split.displayIso).toBe('MK');
  });

  it('is NOT flagged as a Serbian product, and is NOT greyed out', () => {
    const stance = productStance(product, data);
    expect(stance.flagged).toBe(false);
    expect(stance.nonRecogniser).toBe(false); // North Macedonia recognises Kosovo
    expect(stance.tone).toBe('normal');
    expect(stance.splitOrigin).toBe(true);
  });

  it('Imlek itself, one digit away on the same company prefix, IS still Serbian', () => {
    // 8601500110057 = QUMESHT IMLEK 1L 3.2%. The override must not leak to
    // the rest of Imlek's company prefix — it is one cited claim about one
    // dairy, not a blanket amnesty for 8601500.
    const imlek = productStance({ barcode: '8601500110057', name: 'QUMESHT IMLEK 1L 3.2 %' }, data);
    expect(imlek.flagged).toBe(true);
  });

  it('originIso accepts both an ISO code and a country name', () => {
    expect(originIso('MK')).toBe('MK');
    expect(originIso('North Macedonia')).toBe('MK');
    expect(originIso('Serbia')).toBe('RS');
    expect(originIso('')).toBeNull();
    expect(originIso('Freedonia')).toBeNull();
  });
});

// ===========================================================================
// 4. THE ONE-WAY BOYCOTT RULE IS NOT WEAKENED BY THE SPLIT-ORIGIN PATH
// ===========================================================================
describe('productStance: a curated boycott hit always wins', () => {
  it('still flags the Chipsy 387 case (Serbian producer, Bosnian prefix)', () => {
    const stance = productStance({ barcode: '3870508000157', brand: 'Chipsy' }, data);
    expect(stance.flagged).toBe(true);
  });

  it('still flags an ordinary 860 product with no origin override', () => {
    expect(productStance({ barcode: '8600043000016', brand: 'Bambi' }, data).flagged).toBe(true);
  });

  it('greys a non-recognising country without calling it a boycott target', () => {
    // 520 = Greece, which does not recognise Kosovo.
    const stance = productStance({ barcode: '5202178006166', name: 'Olympus Kefir' }, data);
    expect(stance.flagged).toBe(false);
    expect(stance.nonRecogniser).toBe(true);
    expect(stance.tone).toBe('muted');
  });

  it('leaves a recognising country in full colour', () => {
    const stance = productStance({ barcode: '8001860259401', name: 'ORIZ SCOTTI' }, data);
    expect(stance.flagged).toBe(false);
    expect(stance.nonRecogniser).toBe(false);
    expect(stance.tone).toBe('normal');
  });

  it('returns a usable stance for a product with no barcode at all', () => {
    const stance = productStance({ name: 'Qumesht Bimilk 1L 2.8%' }, data);
    expect(stance.flagged).toBe(false);
    expect(stance.classify).toBeNull();
    expect(stance.tone).toBe('normal');
  });
});

// ===========================================================================
// 5. EVERY ORIGIN OVERRIDE CARRIES A REAL SOURCE
// ===========================================================================
describe('product-origins.json integrity', () => {
  it('every verified brand entry has a resolving source URL and evidence', () => {
    for (const b of originsRaw.brands) {
      if (b.verified !== true) continue;
      expect(b.sourceUrl, `${b.brand} sourceUrl`).toMatch(/^https?:\/\//);
      expect(String(b.evidence || '').length, `${b.brand} evidence`).toBeGreaterThan(30);
    }
  });

  it('any brand whose production country is not Serbia states where it IS made', () => {
    for (const b of originsRaw.brands) {
      if (b.verified !== true) continue;
      expect(b.productionCountry, `${b.brand} productionCountry`).toBeTruthy();
      expect(originIso(b.productionCountry), `${b.brand} productionCountry is an ISO`).not.toBeNull();
    }
  });
});

// ===========================================================================
// 6. "SOLD IN KOSOVO" IS NOT "MADE BY A KOSOVAR BRAND"
// ===========================================================================
//
// The alternatives badge was a two-branch ternary over a three-state fact,
// so every shelf-tier candidate (country: null) was badged as an ALBANIAN
// producer with an Albanian flag. 45 items on the eval claimed a producer
// nothing in the data supports.
describe('localClaimBadge: three states, never two', () => {
  it('badges a proven Kosovar alternative with the Kosovo flag', () => {
    const b = localClaimBadge({ isLocalClaim: true, country: 'kosovo' });
    expect(b.kind).toBe('kosovo');
    expect(b.iso).toBe('XK');
    expect(b.claimed).toBe(true);
  });

  it('badges a proven Albanian alternative with the Albanian flag', () => {
    const b = localClaimBadge({ isLocalClaim: true, country: 'albania' });
    expect(b.kind).toBe('albania');
    expect(b.iso).toBe('AL');
  });

  it('gives a shelf-tier candidate NO FLAG and no local claim', () => {
    // country: null means "same kind of product, on sale in Kosovo, not
    // Serbian". It is not a statement about the producer.
    const b = localClaimBadge({ country: null });
    expect(b.kind).toBe('none');
    expect(b.iso).toBeNull();
    expect(b.claimed).toBe(false);
    expect(b.labelKey).toBe('badgeSoldInKosovo');
  });

  it('reads isLocalClaim strictly — false and undefined are both "not proven"', () => {
    expect(localClaimBadge({ isLocalClaim: false, country: 'kosovo' }).claimed).toBe(false);
    expect(localClaimBadge({ country: 'kosovo' }).claimed).toBe(false);
    expect(localClaimBadge({ isLocalClaim: 'true', country: 'kosovo' }).claimed).toBe(false);
    expect(localClaimBadge(null).claimed).toBe(false);
  });

  it('never returns an ISO without a claim behind it', () => {
    for (const item of [{}, { country: null }, { country: 'italy' }, { isLocalClaim: false }]) {
      const b = localClaimBadge(item);
      expect(b.iso, JSON.stringify(item)).toBeNull();
    }
  });
});

describe('both badge label keys exist in both languages', () => {
  it('badgeSoldInKosovo and badgeSoldInKosovoFull are translated', () => {
    for (const lang of ['sq', 'en']) {
      for (const key of ['badgeSoldInKosovo', 'badgeSoldInKosovoFull', 'badgeKosovar', 'badgeShqiptar']) {
        expect(dictionary[lang][key], `${lang}.${key}`).toBeTruthy();
      }
    }
  });

  it('every new verdict-lane string exists in both languages', () => {
    const keys = [
      'barcodeLabel',
      'barcodeNone',
      'barcodeNoneWhy',
      'barcodeNoneNote',
      'barcodeCheckPack',
      'originSplitBadge',
      'originRegisteredIn',
      'originMadeIn',
      'originMadeInCity',
      'originOwnedBy',
      'originSplitExplain',
      'originSerbianOwned',
      'originSourceLink',
    ];
    for (const lang of ['sq', 'en']) {
      for (const key of keys) {
        expect(dictionary[lang][key], `${lang}.${key}`).toBeTruthy();
      }
    }
  });
});
