import { describe, it, expect, vi } from 'vitest';
import { resolveAlternatives, resolveAlternativesForRetailProduct, resolveAlternativesForCode } from '../lib/resolveAlternatives.js';
import {
  normalizeBrandAlternatives,
  buildCuratedLocalBrandSet,
  buildNonLocalBrandSet,
} from '../lib/brandAlternatives.js';
import { isTrustedLocalRow, isEligibleLocalCandidate } from '../lib/matcher.js';
import { retailIdentity, headFamilyOf, leadFamilyOf, findAnyAlternative } from '../lib/liveAlternatives.js';
import { allLocalAlternatives } from '../lib/allAlternatives.js';
import { categoryFamilyOf, sameCategoryFamily } from '../lib/categoryFamily.js';
import { normalizeBoycottTable } from '../lib/boycott.js';

// resolveAlternatives calls out to the network (live OFF search) only when
// the static pool comes up short; stub fetch so tests never hit the network.
vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503 })));

const gs1Table = {
  ranges: [
    { min: 860, max: 860, country: 'Serbia', isSerbia: true, isLocal: false },
    { min: 381, max: 381, country: 'Kosovo', isSerbia: false, isLocal: true },
    // 390 and 530 are the other two prefixes the app treats as local, and
    // both matter below: the real Kellogg's row is 390-prefixed and the
    // real Jaffa rows are 530-prefixed.
    { min: 390, max: 390, country: 'Kosovo', isSerbia: false, isLocal: true },
    { min: 530, max: 530, country: 'Albania', isSerbia: false, isLocal: true },
  ],
};

// A minimal stand-in for data/boycott-brands.json. "Jaffa Crvenka" is the
// real entry that the 92 Albanian-prefixed Jaffa rows collide with.
const boycottTable = normalizeBoycottTable({
  brands: [{ brand: 'Jaffa Crvenka', aliases: ['Jaffa'], country: 'serbia', category: 'biscuits' }],
});

const brandAlternatives = normalizeBrandAlternatives({
  nonLocalBrands: [
    {
      brand: "Kellogg's",
      aliases: ['Kelloggs'],
      company: 'Kellanova',
      country: 'US',
      sourceUrl: 'https://en.wikipedia.org/wiki/Kellanova',
      evidence: 'American multinational, HQ Chicago, Illinois.',
    },
  ],
  entries: [
    {
      serbianBrand: 'Bambi',
      serbianCompany: 'Bambi a.d.',
      category: 'biscuits',
      offCategoryTags: ['en:biscuits'],
      verifiedSerbian: true,
      sourceUrl: 'https://example.com/bambi',
      alternatives: [
        {
          brand: 'Sempre',
          company: 'Liri',
          country: 'kosovo',
          pairingEvidence: 'reported',
          pairingUrl: 'https://example.com/sempre',
          evidence: 'Reported Kosovo biscuit alternative.',
        },
      ],
    },
  ],
});

describe('resolveAlternatives — the canonical Plazma -> Sempre path', () => {
  it('(a) resolves by brand match first, ahead of any category-based lookup', async () => {
    const result = await resolveAlternatives({
      brand: 'Bambi',
      categoriesTags: ['en:snacks', 'en:sweet-snacks', 'en:biscuits-and-cakes', 'en:biscuits-and-crackers', 'en:biscuits'],
      data: { brandAlternatives, categoryIndex: { index: new Map() }, localProducts: { byCode: new Map() }, gs1: gs1Table },
    });

    expect(result.source).toBe('brand-match');
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      brand: 'Sempre',
      company: 'Liri',
      isBrandLevel: true,
      pairingEvidence: 'reported',
      pairingUrl: 'https://example.com/sempre',
    });
  });

  it('(b) falls back to a category match on the brand map when the brand itself is unknown', async () => {
    const result = await resolveAlternatives({
      brand: 'SomeOtherSerbianBrand',
      categoriesTags: ['en:biscuits'],
      data: { brandAlternatives, categoryIndex: { index: new Map() }, localProducts: { byCode: new Map() }, gs1: gs1Table },
    });
    expect(result.source).toBe('brand-category-match');
    expect(result.items[0].brand).toBe('Sempre');
  });

  it('(c) falls back to the static local-products pool — but only genuinely-local (381-prefixed) candidates', async () => {
    const categoryIndex = new Map([['en:water', { count: 1, codes: ['3811110000000'] }]]);
    const localProductsByCode = new Map([
      ['3811110000000', { code: '3811110000000', name: 'Ujë X', brand: 'X', country: 'kosovo', image: 'x.jpg' }],
    ]);
    // 3+ genuinely-local static matches so it doesn't fall through to the live-search lane.
    for (let i = 0; i < 3; i++) {
      const code = '381111000000' + (i + 1);
      categoryIndex.get('en:water').codes.push(code);
      localProductsByCode.set(code, {
        code,
        name: 'Ujë ' + i,
        brand: 'X' + i,
        country: 'kosovo',
        image: 'x.jpg',
      });
    }

    const result = await resolveAlternatives({
      brand: 'Nestle',
      categoriesTags: ['en:beverages', 'en:water'],
      data: { brandAlternatives, categoryIndex: { index: categoryIndex }, localProducts: { byCode: localProductsByCode }, gs1: gs1Table },
    });
    expect(result.source).toBe('static-pool');
    expect(result.items.length).toBeGreaterThan(0);
  });
});

describe('resolveAlternativesForRetailProduct — catalog-grid product detail (Serbian-registered case)', () => {
  const data = { brandAlternatives, categoryIndex: { index: new Map() }, localProducts: { byCode: new Map() }, gs1: gs1Table };

  it('resolves by brand match against the retail product\'s brand', async () => {
    const result = await resolveAlternativesForRetailProduct({ brand: 'Bambi', category: null }, data);
    expect(result.source).toBe('brand-match');
    expect(result.items[0]).toMatchObject({ brand: 'Sempre', isBrandLevel: true });
  });

  it('falls back to a category-key match when the brand is unknown', async () => {
    const result = await resolveAlternativesForRetailProduct({ brand: 'SomeOtherBrand', category: 'biscuits' }, data);
    expect(result.source).toBe('brand-category-match');
    expect(result.items[0].brand).toBe('Sempre');
  });

  it('honestly returns none rather than guessing when neither brand nor category match anything documented', async () => {
    const result = await resolveAlternativesForRetailProduct({ brand: 'CompletelyUnknown', category: 'unknown-category' }, data);
    expect(result.source).toBe('none');
    expect(result.items).toEqual([]);
  });
});

// ===========================================================================
// REGRESSION TESTS FOR THE 2026-09-16 ALTERNATIVE-FINDER DEFECTS
//
// Each block is named after the defect and, where there is one, the owner's
// own words. Do not delete a block without re-measuring the thing it guards
// with `node scripts/eval-alternatives.mjs`.
// ===========================================================================

/** A shelf/retail catalogue with everything the lanes below need. */
function retailData(products, extra = {}) {
  return {
    brandAlternatives,
    categoryIndex: { index: new Map() },
    localProducts: { byCode: new Map() },
    gs1: gs1Table,
    boycott: boycottTable,
    kosovoRetail: { products },
    ...extra,
  };
}

describe('DEFECT 1 — no alternative may be a card with nothing on it', () => {
  it('never returns an item with neither a brand nor a name', async () => {
    const result = await resolveAlternatives({
      brand: 'Imlek',
      categoriesTags: ['en:milks'],
      data: retailData([
        // The shape that produced the blank rows: brand null, name present.
        { id: 'r1', name: 'Qumësht Vita 1L 3.2%', brand: null, category: 'Bylmet', isLocalBrand: true, barcode: '3811110000001', price: 0.9 },
        // The shape that must be suppressed outright: nothing renderable.
        { id: 'r2', name: '   ', brand: '', category: 'Bylmet', isLocalBrand: true, barcode: '3811110000002', price: 0.1 },
      ]),
    });
    expect(result.items.length).toBeGreaterThan(0);
    for (const item of result.items) {
      const renderable = String(item.brand || '').trim() || String(item.name || '').trim();
      expect(renderable).not.toBe('');
    }
    expect(result.items.some((i) => i.name === '   ')).toBe(false);
  });

  it('recovers a brand from the title when the catalogue supplies that brand elsewhere', () => {
    const pool = [
      { id: 'a', name: 'Kafe Turke Galla 100Gr', brand: 'Galla', category: 'Pije' },
      { id: 'b', name: 'GALLA kafe e bardhë 200g', brand: null, category: 'Pije' },
      { id: 'c', name: 'Kafe e zezë 500g', brand: null, category: 'Pije' },
    ];
    expect(retailIdentity(pool[1], pool)).toMatchObject({ brand: 'Galla', brandSource: 'derived-from-title' });
    // No brand in the title — the name still carries the card, but we do
    // NOT invent a brand.
    expect(retailIdentity(pool[2], pool)).toMatchObject({ brand: null, name: 'Kafe e zezë 500g' });
    // Nothing at all -> not offerable.
    expect(retailIdentity({ id: 'd', name: '', brand: '' }, pool)).toBeNull();
  });

  it('shows one card per product, not the same SKU once per store', async () => {
    const sameSku = (id, source) => ({
      id, source, name: 'Kikirik Pa Vaj 110Gr', brand: null, category: 'Snack',
      isLocalBrand: true, barcode: '3906139460968', price: 1.2,
    });
    const result = await resolveAlternatives({
      brand: 'Lucar',
      categoriesTags: ['en:peanuts'],
      data: retailData([sameSku('s1', 'a'), sameSku('s2', 'b'), sameSku('s3', 'c')]),
    });
    const labels = result.items.map((i) => String(i.name || i.brand).toLowerCase());
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe('DEFECT 2 — a non-local brand must never be offered as the local alternative', () => {
  it('does not let a Serbian boycott-listed brand through on an Albanian GS1 prefix (the Jaffa case)', () => {
    // 92 real rows in data/kosovo-retail.json look exactly like this.
    const jaffa = {
      id: 'j', name: 'LENG JAFFA 0.25L MULTIVITAMIN', brand: 'Jaffa', category: 'PIJE JO ALKOOLIKE',
      isLocalBrand: true, barcode: '5304000430238',
      localEvidence: 'GS1 barcode prefix 530 (Albania) on barcode 5304000430238',
    };
    expect(isTrustedLocalRow(jaffa, { gs1: gs1Table, boycott: boycottTable })).toBe(false);

    const { items } = allLocalAlternatives(retailData([jaffa]));
    expect(items.some((i) => /jaffa/i.test(String(i.brand)))).toBe(false);
  });

  it('does not let a source-cited non-local brand through on a local GS1 prefix (the Kellogg’s case)', () => {
    // Real row: Kellogg's Corn Flakes, barcode 3904933060414, GS1 390.
    const kelloggs = { code: '3904933060414', brand: "Kellogg's", name: 'Corn flakes', country: 'albania' };
    const curated = buildCuratedLocalBrandSet(brandAlternatives, null);
    const nonLocal = buildNonLocalBrandSet(brandAlternatives);
    expect(nonLocal.has("kellogg's")).toBe(true);
    // Without the list it passes on its prefix alone — that was the bug.
    expect(isEligibleLocalCandidate(kelloggs, gs1Table, curated)).toBe(true);
    expect(isEligibleLocalCandidate(kelloggs, gs1Table, curated, nonLocal)).toBe(false);
  });

  it('a genuine Kosovar row is still trusted', () => {
    const peja = {
      id: 'p', name: 'BIRRE PEJA 0.5L KAN', brand: 'Peja', category: 'Pije',
      isLocalBrand: true, barcode: '3903253650107',
      localEvidence: 'GS1 barcode prefix 390 (Kosovo) on barcode 3903253650107',
    };
    expect(isTrustedLocalRow(peja, { gs1: gs1Table, boycott: boycottTable })).toBe(true);
  });

  it('every returned item carries an explicit isLocalClaim the UI can trust', async () => {
    const result = await resolveAlternatives({
      brand: 'Bambi',
      categoriesTags: ['en:biscuits'],
      data: retailData([]),
    });
    expect(result.items[0].isLocalClaim).toBe(true);
  });
});

describe('DEFECT 3 / owner 2026-09-16 — "and dont recommend milk for yogurt"', () => {
  it('milk and yogurt are different product families', () => {
    expect(categoryFamilyOf(['en:milks'])).toBe('milk');
    expect(categoryFamilyOf(['en:yogurts'])).toBe('yogurt');
    expect(sameCategoryFamily(['en:milks'], ['en:yogurts'])).toBe(false);
  });

  const dairyShelf = [
    { id: 'm', name: 'Qumësht Vita 1L 3.2%', brand: 'Vita', category: 'Bylmet', isLocalBrand: true, barcode: '3811110000001', price: 0.9 },
    { id: 'y', name: 'Jogurt Vita 1L', brand: 'Vita', category: 'Bylmet', isLocalBrand: true, barcode: '3811110000002', price: 1.1 },
  ];

  it('a YOGURT scan is never answered with a plain milk', async () => {
    const result = await resolveAlternatives({
      brand: 'Imlek', categoriesTags: ['en:yogurts'], data: retailData(dairyShelf),
    });
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.every((i) => /jogurt/i.test(String(i.name)))).toBe(true);
    expect(result.items.some((i) => /qumësht/i.test(String(i.name)))).toBe(false);
  });

  it('a MILK scan is never answered with a yogurt', async () => {
    const result = await resolveAlternatives({
      brand: 'Imlek', categoriesTags: ['en:milks'], data: retailData(dairyShelf),
    });
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.every((i) => /qumësht/i.test(String(i.name)))).toBe(true);
    expect(result.items.some((i) => /jogurt/i.test(String(i.name)))).toBe(false);
  });

  it('the other split buckets stay split too', () => {
    expect(sameCategoryFamily(['en:sunflower-oils'], ['en:butters'])).toBe(false);
    expect(sameCategoryFamily(['en:peanut-butters'], ['en:butters'])).toBe(false);
    expect(sameCategoryFamily(['en:biscuits'], ['en:wafers'])).toBe(false);
    expect(sameCategoryFamily(['en:biscuits'], ['en:cakes'])).toBe(false);
    expect(sameCategoryFamily(['en:crisps'], ['en:corn-chips'])).toBe(false);
    expect(sameCategoryFamily(['en:fruit-juices'], ['en:sodas'])).toBe(false);
    expect(sameCategoryFamily(['en:flours'], ['en:pastas'])).toBe(false);
    expect(sameCategoryFamily(['en:coffees'], ['en:teas'])).toBe(false);
    expect(sameCategoryFamily(['en:jams'], ['en:honeys'])).toBe(false);
    expect(sameCategoryFamily(['en:sausages'], ['en:beef'])).toBe(false);
    // ...and a family still matches itself.
    expect(sameCategoryFamily(['en:yogurts'], ['en:yogurts'])).toBe(true);
  });
});

describe('DEFECT 4 — a known family with no local answer says so, instead of offering something unrelated', () => {
  it('a food supplement is not answered with pocket tissues', async () => {
    const result = await resolveAlternatives({
      brand: 'SomeGermanBrand',
      categoriesTags: ['en:dietary-supplements'],
      data: retailData([
        { id: 't', name: 'Faculeta Xhepi Rose', brand: null, category: 'Higjienë', isLocalBrand: true, barcode: '3811110000009', price: 0.2 },
      ]),
    });
    expect(result.source).toBe('none');
    expect(result.items).toEqual([]);
  });

  it('a mustard is not answered with cured ham (the "Senfter Speck" case)', async () => {
    const result = await resolveAlternatives({
      brand: 'Polimark',
      categoriesTags: ['en:mustards'],
      data: retailData([
        { id: 'h', name: 'Senfter Speck 100Gr', brand: null, category: 'Sallameria & Proshuta', isLocalBrand: true, barcode: '3811110000010', price: 2 },
      ]),
    });
    expect(result.items.some((i) => /speck/i.test(String(i.name)))).toBe(false);
  });

  it('peanut butter is not answered with a peanut-butter BISCUIT', async () => {
    const result = await resolveAlternatives({
      brand: 'Granum Food',
      categoriesTags: ['en:peanut-butters'],
      data: retailData([
        { id: 'b', name: 'Biskota Gjalpe Kikiriku 150G', brand: null, category: 'Ëmbëlsira', isLocalBrand: true, barcode: '3811110000011', price: 1.85 },
        { id: 'g', name: 'Happy Swing gjalpë kikiriku 16/150gr', brand: null, category: 'Ëmbëlsira', isLocalBrand: true, barcode: '3811110000012', price: 0.95 },
      ]),
    });
    expect(result.items.some((i) => /biskota/i.test(String(i.name)))).toBe(false);
    expect(result.items.some((i) => /happy swing/i.test(String(i.name)))).toBe(true);
  });
});

// ===========================================================================
// DEFECT 5 / owner 2026-09-16 — "fuck do you mean in the whole of Kosovo no
// bag exists" / "i will not tolerate these lies".
//
// He scanned a bag and the app said there was no local alternative. The
// catalogue ships 26 rows with isLocalBrand === true that are literally bags.
// Three separate things had to be true for that lie to reach the screen and
// each gets a test here:
//
//   1. there was no BAG FAMILY at all, so no lane could search for one;
//   2. the retail tier matched the retailer's free-text category as an exact
//      string, so a row with `category: null` ("Qese për mbeturina") was
//      refused before anything was looked at;
//   3. Open Food Facts — a FOOD database — has none of these barcodes, and
//      the scan path gave up on an OFF miss without asking the catalogue.
// ===========================================================================
describe('DEFECT 5 — a scanned bag is answered with Kosovo-made bags', () => {
  const bagShelf = [
    { id: 'b1', name: 'Qese Per Mbeturina 150L', brand: null, category: 'Higjien Shtepiake', isLocalBrand: true, barcode: '3901152590043', price: 1.2 },
    { id: 'b2', name: 'Strong Garbage Bags 25L', brand: null, category: 'Garbage Bags', isLocalBrand: true, barcode: '3900985020512', price: 0.8 },
    { id: 'b3', name: 'Thase Mbeturinash 70L 10Pcs', brand: null, category: 'Aksesore Pastrimi', isLocalBrand: true, barcode: '3900107830968', price: 0.95 },
    // Present to prove the bag lane does not simply return the cheapest
    // Kosovar thing in the shop — the exact defect that answered a food
    // supplement with pocket tissues.
    { id: 't', name: 'Faculeta Xhepi Rose', brand: null, category: 'Higjienë', isLocalBrand: true, barcode: '3811110000009', price: 0.2 },
    { id: 'o', name: 'ULLINJE TE GJELBERT NE QESE COOP 170GR', brand: null, category: 'TEGLLARINA/KONZERVA', isLocalBrand: true, barcode: '3811110000013', price: 1.5 },
  ];

  it('a bin-bag scan resolves to the bin-bag family, not to nothing', () => {
    expect(categoryFamilyOf(['en:garbage-bags'])).toBe('household-bags');
    expect(categoryFamilyOf(['en:bin-liners'])).toBe('household-bags');
    expect(categoryFamilyOf(['en:freezer-bags'])).toBe('household-bags');
  });

  it('a bin-bag scan is answered with bags', async () => {
    const result = await resolveAlternatives({
      brand: null, categoriesTags: ['en:non-food-products', 'en:garbage-bags'], data: retailData(bagShelf),
    });
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.every((i) => /qese|thase|garbage/i.test(String(i.name)))).toBe(true);
    expect(result.items.some((i) => /faculeta/i.test(String(i.name)))).toBe(false);
  });

  it('a jar of olives that happens to be sold in a bag is not a bin bag', async () => {
    const result = await resolveAlternatives({
      brand: null, categoriesTags: ['en:garbage-bags'], data: retailData(bagShelf),
    });
    expect(result.items.some((i) => /ullinje/i.test(String(i.name)))).toBe(false);
  });

  it('a catalogue row with NO category at all is still placed by its own title', async () => {
    const result = await resolveAlternativesForRetailProduct(
      { id: 'x', name: 'Qese për mbeturina', brand: null, category: null },
      retailData(bagShelf)
    );
    expect(result.source).toBe('catalog-family-fallback');
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.every((i) => /qese|thase|garbage/i.test(String(i.name)))).toBe(true);
    // The tier claims "kosovo", so every row in it must clear the strict bar.
    expect(result.items.every((i) => i.isLocalClaim === true)).toBe(true);
  });

  it('a scan Open Food Facts has never heard of is answered from the shipped catalogue', async () => {
    // The real failing path: OFF returns not_found for 3900985020512, so the
    // app never called the resolver at all.
    const result = await resolveAlternativesForCode('3900985020512', retailData(bagShelf));
    expect(result).not.toBeNull();
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.every((i) => /qese|thase|garbage/i.test(String(i.name)))).toBe(true);
  });

  it('a barcode the catalogue does not have either is left unanswered, not guessed', async () => {
    expect(await resolveAlternativesForCode('4000000000001', retailData(bagShelf))).toBeNull();
  });

  it('a genuine "none" is still a "none" — the supplement case is unchanged', async () => {
    const result = await resolveAlternatives({
      brand: 'SomeGermanBrand', categoriesTags: ['en:dietary-supplements'], data: retailData(bagShelf),
    });
    expect(result.source).toBe('none');
    expect(result.items).toEqual([]);
  });
});

// ===========================================================================
// DEFECT 6 — a stem is not allowed to be the head of a different word.
//
// "Requiring the term to begin a word kills that whole class of accident"
// (liveAlternatives.js). It only killed half of it: the check looked at the
// character BEFORE the stem and never after, so 'vaj' still matched "vajza"
// — the very example the comment uses. Found by the lie detector in
// scripts/eval-alternatives.mjs, which reported leggings filed as oil.
// ===========================================================================
describe('DEFECT 6 — stems must not swallow a longer, unrelated word', () => {
  it('"vajza" (girls) is not oil, and real oil still is', () => {
    expect(headFamilyOf('Gete për vajza')).toBe(null);
    expect(headFamilyOf('Vaj Luledielli 1L')).toBe('cooking-oil');
  });

  it('"bukuri" (beauty) is not bread, and real bread still is', () => {
    expect(headFamilyOf('Lodër set bukurie')).toBe(null);
    expect(headFamilyOf('Buke Integrale 500Gr')).toBe('bread');
  });

  it('"Butterfly" (a hygiene brand) is not butter', () => {
    expect(headFamilyOf('Butterfly All Cotton 18Pcs')).toBe(null);
  });

  it('"Super…" is not soup and "watermelon" is not water', () => {
    expect(headFamilyOf('Butterfly Deo Super 8/1')).toBe(null);
    expect(headFamilyOf('Watermelon Ice 0.5L')).toBe(null);
  });

  it('"Aksesore Pastrimi" is cleaning, not cake — the pastr/pastrim collision', () => {
    expect(categoryFamilyOf('Aksesore Pastrimi')).not.toBe('cakes-pastry');
    expect(categoryFamilyOf('PASTRIM')).not.toBe('cakes-pastry');
    expect(categoryFamilyOf(['en:pastries'])).toBe('cakes-pastry');
  });

  it('leadFamilyOf: an accessory named after a food is not that food', () => {
    // headFamilyOf still SEES the mention — that is what makes it a good veto
    // — but leadFamilyOf, the one used when the title is the only evidence,
    // refuses to place them.
    expect(leadFamilyOf('Aparat per Kafe')).toBe(null);
    expect(leadFamilyOf('Set Gota Çaji')).toBe(null);
    expect(leadFamilyOf('Tepsi për muffins')).toBe(null);
    // ...while a real grocery title leads with its head noun and still places.
    expect(leadFamilyOf('Djath kaçkavall kg')).toBe('cheese');
    expect(leadFamilyOf('Miell 5kg')).toBe('flour');
    expect(leadFamilyOf('Qese për mbeturina')).toBe('household-bags');
  });
});

// ===========================================================================
// DEFECT 7 / 2026-09-18 — THE LAST DISHONEST LANE: findAnyAlternative tier 4.
//
// When no family could be established at all, the cascade ended by handing
// back the six cheapest proven-local rows in the whole catalogue. Measured
// over data/eval-corpus.json before the fix, every one of the 28 scans that
// reached it (Set A 1, Set B 7, Set D 20) got the BYTE-IDENTICAL six cards —
// "Faculeta Xhepi Rose" (pocket tissues) first, then Vipa/Skoki corn puffs —
// for Pesto alla Genovese, an avocado, Argeta pate, Vegeta, ajvar and a beer.
// The output did not depend on the input, so no UI wording could rescue it,
// and no component ever read `alternatives.source` to attempt one.
//
// A gap is an honest answer (house rule). These tests are what stops
// the tier growing back.
// ===========================================================================
describe('DEFECT 7 — an unplaceable scan gets nothing, not "the cheapest Kosovar brands"', () => {
  /** The exact shape of the deleted tier's output: cheap, proven-local, unrelated. */
  const cheapLocalPool = [
    { id: 'f', name: 'Faculeta Xhepi Rose', brand: null, category: 'Higjienë', isLocalBrand: true, barcode: '3811110000020', price: 0.15 },
    { id: 'v1', name: 'Vipa Flips Grill 16Gr', brand: 'Vipa', category: 'Snacks', isLocalBrand: true, barcode: '3811110000021', price: 0.2 },
    { id: 'v2', name: 'Vipa Flips Ketchup 16Gr', brand: 'Vipa', category: 'Snacks', isLocalBrand: true, barcode: '3811110000022', price: 0.2 },
  ];

  it('a scan with no establishable family returns nothing at all', async () => {
    const result = await resolveAlternatives({
      brand: 'Barilla',
      // Real tags off 8076809513746 (Pesto alla Genovese). categoryFamilyOf
      // places none of them, which is exactly how tier 4 was reached.
      categoriesTags: ['en:condiments', 'en:sauces', 'en:pestos', 'en:green-pestos'],
      data: retailData(cheapLocalPool),
    });
    expect(result.items).toEqual([]);
    expect(result.source).toBe('none');
    expect(result.tier).toBe('no-family');
  });

  it('pocket tissues are never offered for a product we could not place', async () => {
    for (const tags of [['en:spreads'], ['hr:vegeta'], ['en:Food'], ['fr:mousse de thon']]) {
      const result = await resolveAlternatives({ brand: null, categoriesTags: tags, data: retailData(cheapLocalPool) });
      expect(result.items.some((i) => /faculeta/i.test(String(i.name)))).toBe(false);
      expect(result.items).toEqual([]);
    }
  });

  it('the source string "local-brands" is gone — nothing may emit it', async () => {
    const result = await resolveAlternatives({
      brand: null,
      categoriesTags: ['en:condiments'],
      data: retailData(cheapLocalPool),
    });
    expect(result.source).not.toBe('local-brands');
  });

  it('a scan the app CAN place is unaffected — the gap is only where we know nothing', async () => {
    const result = await resolveAlternatives({
      brand: 'Bambi',
      categoriesTags: ['en:biscuits'],
      data: retailData(cheapLocalPool),
    });
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0].brand).toBe('Sempre');
  });

  it('tier 2 matches whole words, not substrings ("alla" in "Sallam" is not a pesto match)', () => {
    // Tier 2 is unreachable from resolveAlternatives today (both call sites
    // pass name: null), so only a direct call can measure it. Left loose, it
    // was the same defect behind an unused door: a raw hay.includes(token)
    // answered "Pesto alla Genovese" with salami.
    const data = retailData([
      { id: 's', name: 'Sallam Viqi Dinamika 300Gr', brand: null, category: 'Sallameria', isLocalBrand: true, barcode: '3811110000030', price: 1.5 },
      { id: 'p', name: 'Despar Pesto Me Hudher 90G', brand: null, category: 'Salca', isLocalBrand: true, barcode: '3811110000031', price: 2.5 },
    ]);
    const result = findAnyAlternative({ categoriesTags: [], categoryText: null, brand: 'Barilla', name: 'Pesto alla Genovese', data, limit: 6 });
    expect(result.tier).toBe('name');
    expect(result.items.some((i) => /sallam/i.test(String(i.name)))).toBe(false);
    expect(result.items.some((i) => /pesto/i.test(String(i.name)))).toBe(true);
  });
});
