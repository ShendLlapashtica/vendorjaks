import { describe, it, expect } from 'vitest';
import {
  categoriesMostSpecificFirst,
  collectStaticCandidates,
  flattenRankedTiers,
  mergeLiveAlternatives,
  mostSpecificTag,
  isSameBrand,
  isKosovoCountry,
  isEligibleLocalCandidate,
  isOwnBarcodeSerbian,
  isTrustedLocalRow,
} from '../lib/matcher.js';
import { normalizeBoycottTable } from '../lib/boycott.js';

const gs1Table = {
  ranges: [
    { min: 860, max: 860, country: 'Serbia', isSerbia: true, isLocal: false },
    { min: 381, max: 381, country: 'Kosovo', isSerbia: false, isLocal: true },
    { min: 390, max: 390, country: 'Montenegro', isSerbia: false, isLocal: true },
    { min: 530, max: 530, country: 'Albania', isSerbia: false, isLocal: true },
  ],
};

// Mirrors the real Plazma product's actual OFF categories_tags (general -> specific).
const plazmaCategories = ['en:snacks', 'en:sweet-snacks', 'en:biscuits-and-cakes', 'en:biscuits-and-crackers', 'en:biscuits'];

describe('categoriesMostSpecificFirst', () => {
  it('reverses OFF general->specific tags into specific->general order', () => {
    expect(categoriesMostSpecificFirst(plazmaCategories)).toEqual([
      'en:biscuits',
      'en:biscuits-and-crackers',
      'en:biscuits-and-cakes',
      'en:sweet-snacks',
      'en:snacks',
    ]);
  });

  it('returns [] for non-array input rather than throwing', () => {
    expect(categoriesMostSpecificFirst(undefined)).toEqual([]);
  });
});

describe('mostSpecificTag', () => {
  it('picks the most specific (last) OFF tag', () => {
    expect(mostSpecificTag(plazmaCategories)).toBe('en:biscuits');
  });
});

describe('isOwnBarcodeSerbian / isEligibleLocalCandidate — the hard eligibility gate', () => {
  it('flags an 860-prefixed candidate as Serbian regardless of any market/brand tag', () => {
    expect(isOwnBarcodeSerbian({ code: '8600043029536' }, gs1Table)).toBe(true);
  });

  it('never treats a Serbian-prefixed candidate as eligible, even if the curated brand set matches its name', () => {
    const curated = new Set(['bambi']);
    const item = { code: '8600043029536', brand: 'Bambi' };
    expect(isEligibleLocalCandidate(item, gs1Table, curated)).toBe(false);
  });

  it('accepts a candidate whose own prefix is genuinely local (381/390/530), with no curated brand needed', () => {
    expect(isEligibleLocalCandidate({ code: '3811234567890', brand: 'Anything' }, gs1Table, null)).toBe(true);
    expect(isEligibleLocalCandidate({ code: '3902379930018', brand: 'Rugove' }, gs1Table, null)).toBe(true);
    expect(isEligibleLocalCandidate({ code: '5304000044121', brand: 'Anything' }, gs1Table, null)).toBe(true);
  });

  it('accepts a candidate with a foreign prefix ONLY if its brand is in the curated local-brand set', () => {
    const curated = new Set(['sempre']);
    expect(isEligibleLocalCandidate({ code: '8001234567890', brand: 'Sempre' }, gs1Table, curated)).toBe(true);
    expect(isEligibleLocalCandidate({ code: '8001234567890', brand: 'Barilla' }, gs1Table, curated)).toBe(false);
  });

  it('rejects a foreign-prefixed, non-curated candidate outright — the Gullon/Barilla/Milka bug this gate fixes', () => {
    // These are real entries that were sitting in the "en:biscuits" static pool,
    // all foreign brands merely tagged as sold in Albania on Open Food Facts.
    const offenders = [
      { code: '8410376039986', brand: 'Gullon' },
      { code: '8690526010113', brand: 'ETI' },
      { code: '8076809540179', brand: 'Barilla' },
      { code: '7622300479084', brand: 'Milka' },
      { code: '8000350004583', brand: 'Matilde Vicenzi' },
    ];
    for (const item of offenders) {
      expect(isEligibleLocalCandidate(item, gs1Table, new Set())).toBe(false);
    }
  });
});

describe('collectStaticCandidates + flattenRankedTiers', () => {
  const categoryIndex = new Map([
    [
      'en:biscuits',
      { count: 3, codes: ['3811110000001', '8410376039986', '5301110000002'] }, // local, foreign(ineligible), local
    ],
    ['en:sweet-snacks', { count: 1, codes: ['3901110000004'] }],
  ]);
  const localProductsByCode = new Map([
    ['3811110000001', { code: '3811110000001', name: 'Sempre', brand: 'Sempre', country: 'kosovo', image: 'img1.jpg' }],
    ['8410376039986', { code: '8410376039986', name: 'Gullon Cuordi', brand: 'Gullon', country: 'albania', image: 'img2.jpg' }],
    ['5301110000002', { code: '5301110000002', name: 'No-image biscuit', brand: 'Local Co', country: 'albania', image: null }],
    ['3901110000004', { code: '3901110000004', name: 'Broader snack', brand: 'Other', country: 'kosovo', image: 'img4.jpg' }],
  ]);

  it('excludes ineligible (foreign-brand, foreign-prefix) candidates even from the most specific tier', () => {
    const { tiers } = collectStaticCandidates(plazmaCategories, categoryIndex, localProductsByCode, 6, null, gs1Table, null);
    const flat = tiers.flat();
    expect(flat.some((item) => item.brand === 'Gullon')).toBe(false);
    expect(flat.some((item) => item.name === 'Sempre')).toBe(true);
  });

  it('excludes items sharing the scanned product\'s own brand (never suggest the same manufacturer as an "alternative")', () => {
    const { tiers } = collectStaticCandidates(plazmaCategories, categoryIndex, localProductsByCode, 6, 'Sempre', gs1Table, null);
    const flat = tiers.flat();
    expect(flat.some((item) => item.name === 'Sempre')).toBe(false);
  });

  it('ranks Kosovo-tagged items before Albania-tagged items within the same tier', () => {
    const { tiers } = collectStaticCandidates(plazmaCategories, categoryIndex, localProductsByCode, 6, null, gs1Table, null);
    const ranked = flattenRankedTiers(tiers, 6, gs1Table);
    const firstBiscuitTierItems = ranked.filter((r) => r.matchedTag === 'en:biscuits');
    expect(firstBiscuitTierItems[0].country).toBe('kosovo');
  });

  it('never exceeds the requested limit', () => {
    const { tiers } = collectStaticCandidates(plazmaCategories, categoryIndex, localProductsByCode, 1, null, gs1Table, null);
    const ranked = flattenRankedTiers(tiers, 1, gs1Table);
    expect(ranked.length).toBeLessThanOrEqual(1);
  });

  it('returns nothing (an honest empty result) when no candidate in any walked tier is eligible', () => {
    const onlyForeign = new Map([['en:biscuits', { count: 1, codes: ['8410376039986'] }]]);
    const { tiers } = collectStaticCandidates(['en:biscuits'], onlyForeign, localProductsByCode, 6, null, gs1Table, null);
    expect(flattenRankedTiers(tiers, 6, gs1Table)).toEqual([]);
  });
});

describe('mergeLiveAlternatives', () => {
  it('dedupes local live results against static ones and against each other by code', () => {
    const staticItems = [{ code: '3811110000001', brand: 'X', country: 'kosovo' }];
    const liveItems = [
      { code: '3811110000001', brand: 'X', country: 'kosovo' }, // duplicate of static
      { code: '3901110000009', brand: 'Y', country: 'albania' },
      { code: '3901110000009', brand: 'Y', country: 'albania' }, // duplicate within live
    ];
    const merged = mergeLiveAlternatives(staticItems, liveItems, 6, null, gs1Table, null);
    expect(merged.map((m) => m.code)).toEqual(['3811110000001', '3901110000009']);
  });

  it('excludes live items sharing the scanned brand', () => {
    const merged = mergeLiveAlternatives([], [{ code: '3811110000001', brand: 'Bambi' }], 6, 'Bambi', gs1Table, null);
    expect(merged.length).toBe(0);
  });

  it('applies the same eligibility gate to live results as to the static pool', () => {
    const merged = mergeLiveAlternatives(
      [],
      [{ code: '8410376039986', brand: 'Gullon' }], // foreign prefix, not curated
      6,
      null,
      gs1Table,
      null
    );
    expect(merged.length).toBe(0);
  });

  it('respects the limit', () => {
    const live = Array.from({ length: 10 }, (_, i) => ({ code: '381' + String(i).padStart(10, '0'), brand: 'B' + i }));
    expect(mergeLiveAlternatives([], live, 6, null, gs1Table, null).length).toBe(6);
  });
});

describe('isSameBrand', () => {
  it('matches identical and substring brand names case-insensitively', () => {
    expect(isSameBrand('Bambi', 'bambi')).toBe(true);
    expect(isSameBrand('Bambi', 'Bambi a.d.')).toBe(true);
    expect(isSameBrand('Sempre', 'Bambi')).toBe(false);
  });

  it('is false when either side is empty', () => {
    expect(isSameBrand('', 'Bambi')).toBe(false);
    expect(isSameBrand(null, null)).toBe(false);
  });
});

describe('isKosovoCountry', () => {
  it('recognises common Kosovo country strings', () => {
    expect(isKosovoCountry('kosovo')).toBe(true);
    expect(isKosovoCountry('Kosovo')).toBe(true);
    expect(isKosovoCountry('albania')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2026-09-16: THE GS1 PREFIX IS NOT THE BRAND OWNER.
//
// isEligibleLocalCandidate admitted anything whose own barcode carried a
// Kosovo/Albania prefix. Measured against the real data:
//   · 3904933060414 is Kellogg's Corn Flakes on Kosovo prefix 390, and it
//     was being returned as the local alternative to a Serbian cereal;
//   · 92 rows in data/kosovo-retail.json branded "Jaffa" carry Albanian
//     prefix 530 and are flagged isLocalBrand: true, while the app's own
//     boycott table lists that brand as "Jaffa Crvenka (serbia)".
// A prefix names the GS1 member that issued the number — the importer, very
// often — which is what data/brand-alternatives.json's own disclaimer says.
// ---------------------------------------------------------------------------
describe('the prefix is not the owner', () => {
  const nonLocal = new Set(["kellogg's", 'kelloggs', 'top budget']);
  const boycott = normalizeBoycottTable({
    brands: [{ brand: 'Jaffa Crvenka', aliases: ['Jaffa'], country: 'serbia', category: 'biscuits' }],
  });

  it('a source-cited non-local brand is rejected despite a local prefix', () => {
    const kelloggs = { code: '3904933060414', brand: "Kellogg's", name: 'Corn flakes', country: 'albania' };
    expect(isEligibleLocalCandidate(kelloggs, gs1Table, new Set(), nonLocal)).toBe(false);
  });

  it('a genuine local product with no listed objection still passes on its prefix', () => {
    const rugove = { code: '3811110000000', brand: 'Rugove', name: 'Ujë Rugove', country: 'kosovo' };
    expect(isEligibleLocalCandidate(rugove, gs1Table, new Set(), nonLocal)).toBe(true);
  });

  it('isTrustedLocalRow refuses a boycott-listed Serbian brand on an Albanian prefix', () => {
    const jaffa = {
      name: 'LENG JAFFA 0.25L MULTIVITAMIN', brand: 'Jaffa', isLocalBrand: true,
      barcode: '5304000430238',
    };
    expect(isTrustedLocalRow(jaffa, { gs1: gs1Table, boycott })).toBe(false);
  });

  it('isTrustedLocalRow accepts a real Kosovar row', () => {
    const peja = { name: 'BIRRE PEJA 0.5L KAN', brand: 'Peja', isLocalBrand: true, barcode: '3903253650107' };
    expect(isTrustedLocalRow(peja, { gs1: gs1Table, boycott })).toBe(true);
  });

  it('isTrustedLocalRow never trusts an unproven (null) row', () => {
    expect(isTrustedLocalRow({ name: 'X', brand: 'Y', isLocalBrand: null }, { gs1: gs1Table, boycott })).toBe(false);
    expect(isTrustedLocalRow({ name: 'X', brand: 'Y', isLocalBrand: false }, { gs1: gs1Table, boycott })).toBe(false);
  });
});
