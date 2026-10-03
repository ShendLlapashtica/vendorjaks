import { describe, it, expect } from 'vitest';
import {
  witnessFamilyOf,
  exactFamilyOf,
  exactAlternativesFor,
  buildExactIndex,
  collectSerbianProducts,
  gateResolved,
  isExactSource,
  EXACT_SOURCES,
  REJECT,
} from '../lib/exactMatch.js';
import { categoryFamilyOf, freeTextFamiliesOf } from '../lib/categoryFamily.js';
import { titleFamiliesOf } from '../lib/liveAlternatives.js';

// The /alternativa gate. Every case below is a real row or a real pairing
// taken from data/kosovo-retail.json and data/brand-alternatives.json — the
// owner's standing complaint is that this app's tests pass while the screen
// lies, so nothing here is invented to make a green tick.

describe('exactFamilyOf — two witnesses, and they must agree', () => {
  it('takes the shelf label when the title says nothing', () => {
    expect(exactFamilyOf({ name: 'Plazma 300G', category: 'Keksa' })).toBe('biscuits');
  });

  it('takes the title head noun when there is no usable shelf label', () => {
    expect(exactFamilyOf({ name: 'QUMESHT IMLEK 1L 3.2 %', category: 'BYLMET' })).toBe('milk');
  });

  // THE TWO-WITNESS RULE ITSELF IS UNCHANGED (2026-09-19). These two rows
  // still defeat it, and witnessFamilyOf — which IS that rule, exported so
  // it can be tested on its own — still refuses them. What changed is that
  // a third, stronger witness now answers afterwards: a DOCUMENTED product
  // identity (see productIdentity.js). The assertion that matters is not
  // "returns null", it is "never returns the wrong family", and that is
  // what these now say.
  it('the two witnesses still contradict each other, and the rule still refuses', () => {
    // 'Crackers' reads as biscuits; the title says sticks and peanuts.
    const row = { name: 'Trik Shkopinjë Kikirik 110g', category: 'Crackers' };
    expect(witnessFamilyOf(row)).toBeNull();
    // Trik IS a salted stick snack, so this is the right answer and
    // `biscuits` — what the shelf claimed — would have been wrong.
    expect(exactFamilyOf(row)).toBe('savoury-snacks');
    expect(exactFamilyOf(row)).not.toBe('biscuits');
  });

  it('a compound shelf naming two purchases still decides nothing on its own', () => {
    // `Veget Moravka 250G` is a stock seasoning shelved under spices AND
    // sauces; categoryFamilyOf picks ketchup by rule order, the rule refuses.
    expect(freeTextFamiliesOf('Ereza & Salca').size).toBe(2);
    const row = { name: 'Veget Moravka 250G', category: 'Ereza & Salca' };
    expect(witnessFamilyOf(row)).toBeNull();
    // Veget is a universal savoury seasoning. Being a seasoning is the
    // right answer; being a ketchup never was.
    expect(exactFamilyOf(row)).toBe('spices-seasonings');
    expect(exactFamilyOf(row)).not.toBe('ketchup-tomato-sauces');
  });

  it('lets an ambiguous title stand when the shelf is one of the families it names', () => {
    expect(titleFamiliesOf('Vipa Ketchup Chips 30g').size).toBe(2);
    expect(exactFamilyOf({ name: 'Vipa Ketchup Chips 30g', category: 'Chips' })).toBe('crisps');
  });

  it('does not read a flavour as a product', () => {
    // `Jaffa Molle 0.25L` is apple JUICE; 'mollë' is the flavour. Before
    // this rule the screen offered `Krem Banane 17Gr` — a banana cream —
    // because both landed in `fresh-fruit`.
    expect(exactFamilyOf({ name: 'Krem Banane 17Gr', category: null })).toBeNull();
    expect(exactFamilyOf({ name: 'Jaffa Molle 0.25L', category: 'Lengje' })).toBe('juices');
  });

  it('does not read an ingredient after "me" as the product', () => {
    // A honey-flavoured gingerbread heart is not honey, and must not be
    // answered with a honey-and-camomile tea.
    expect(exactFamilyOf({ name: 'Pionir Zemer Me Mjalte 150G', category: 'USHQIMORE' })).toBeNull();
  });

  it('is null for a product nothing can place', () => {
    // These two were `OSH CANTE 3D DINO …` and `OSH TERMOS 600ML …` until
    // 2026-09-17, when the school aisle got its families — a school bag
    // and a vacuum flask are now named (and reported as known gaps, since
    // the catalogue holds no Kosovar one). The rows below are what is
    // genuinely unplaceable in the catalogue today: a retailer's
    // white-goods and kitchen-gadget rows, with no shelf label and a
    // title naming nothing the app has a family for.
    expect(exactFamilyOf({ name: 'Shporet elektrik', category: null })).toBeNull();
    expect(exactFamilyOf({ name: 'Hapse Specave L', category: 'AMVISERI' })).toBeNull();
    expect(exactFamilyOf(null)).toBeNull();
  });
});

describe("the owner's three example pairs are three different families", () => {
  it('yogurt, cheese and milk are not the same family', () => {
    expect(categoryFamilyOf(['en:yogurts'])).toBe('yogurt');
    expect(categoryFamilyOf(['en:cheeses'])).toBe('cheese');
    expect(categoryFamilyOf(['en:milks'])).toBe('milk');
    expect(new Set(['yogurt', 'cheese', 'milk']).size).toBe(3);
  });

  it('wafers and biscuits are not the same family', () => {
    expect(categoryFamilyOf(['en:wafers'])).toBe('wafers');
    expect(categoryFamilyOf(['en:biscuits'])).toBe('biscuits');
    expect(exactFamilyOf({ name: 'Napolitanke Nodello Me Limon 250Gr', category: null })).toBe('wafers');
    expect(exactFamilyOf({ name: 'Biskota Camel 450Gr', category: null })).toBe('biscuits');
  });

  it('refuses a cheese offered for a yogurt', () => {
    const resolved = { source: 'catalog-family-fallback', items: [{ name: 'Djath Mali 400Gr' }] };
    const { accepted, rejected } = gateResolved(
      { name: 'Jogurt Imlek Balans + Kefir 2.8%', category: 'Të freskëta' },
      resolved
    );
    expect(accepted).toHaveLength(0);
    expect(rejected[0].reason).toBe(REJECT.DIFFERENT_FAMILY);
  });

  it('refuses a milk offered for a yogurt', () => {
    const resolved = { source: 'catalog-family-fallback', items: [{ name: 'Qumesht Holla 3.2% 1L' }] };
    const { accepted } = gateResolved(
      { name: 'Jogurt Imlek Balans + Kefir 2.8%', category: 'Të freskëta' },
      resolved
    );
    expect(accepted).toHaveLength(0);
  });

  it('refuses a biscuit offered for a wafer, and the reverse', () => {
    const forWafer = gateResolved(
      { name: 'SL Linea Wafer Choco 100g', category: 'Wafers' },
      { source: 'catalog-family-fallback', items: [{ name: 'Biskota Camel 450Gr' }] }
    );
    expect(forWafer.accepted).toHaveLength(0);

    const forBiscuit = gateResolved(
      { name: 'Plazma 300G', category: 'Keksa' },
      { source: 'catalog-family-fallback', items: [{ name: 'Liri Wafers Lajthi 200G' }] }
    );
    expect(forBiscuit.accepted).toHaveLength(0);
  });
});

describe('the two splits this screen forced', () => {
  it('tofu is not cheese', () => {
    expect(exactFamilyOf({ name: 'Tofu Djath Soye Natyral 200Gr', category: null })).toBe('tofu');
    const { accepted } = gateResolved(
      { name: 'Sirnik Maje Djathi 500G', category: 'Konserva' },
      { source: 'catalog-family-fallback', items: [{ name: 'Tofu Djath Soye Natyral 200Gr' }] }
    );
    expect(accepted).toHaveLength(0);
  });

  it('a fabric softener is not a surface cleaner', () => {
    expect(exactFamilyOf({ name: 'Duel Zbutese Soft Lotues', category: 'HIGJENA' })).toBe('fabric-softener');
    const { accepted } = gateResolved(
      { name: 'Duel Zbutese Soft Lotues', category: 'HIGJENA' },
      { source: 'catalog-family-fallback', items: [{ name: 'Elax Detergjent I Xhamave 750 Ml' }] }
    );
    expect(accepted).toHaveLength(0);
  });

  it('a milk-named brand on a biscuit shelf is a biscuit, not milk', () => {
    // `Milka Biskote Çoko Jaffa Portokall 147G` used to resolve to MILK,
    // because the stem 'milk' begins "Milka" and it leads the title, and
    // the screen answered a pack of biscuits with six cartons of UHT milk.
    expect(exactFamilyOf({ name: 'Milka Biskote Çoko Jaffa Portokall 147G', category: 'BISKOTA' })).toBe('biscuits');
  });
});

describe('the source gate', () => {
  it('allows only the three exact tiers', () => {
    expect([...EXACT_SOURCES].sort()).toEqual([
      'brand-category-match',
      'brand-match',
      'catalog-family-fallback',
    ]);
  });

  it('refuses the loose tiers whatever they returned', () => {
    for (const source of ['shelf', 'local-brands', 'static-pool', 'live', 'catalog-category-fallback', 'none']) {
      expect(isExactSource(source)).toBe(false);
      const { accepted, rejected } = gateResolved(
        { name: 'Plazma 300G', category: 'Keksa' },
        { source, items: [{ name: 'Biskota Camel 450Gr' }] }
      );
      expect(accepted).toHaveLength(0);
      expect(rejected[0].reason).toBe(REJECT.LOOSE_SOURCE);
    }
  });

  it('treats an undetermined family on either side as no match, never as a match', () => {
    const scannedUnknown = gateResolved(
      // Was `OSH TERMOS 600ML PUPPY SC3402` — now a `vacuum-flasks` row,
      // so it would be rejected as a DIFFERENT family, not an unknown one.
      { name: 'Shporet elektrik', category: null },
      { source: 'catalog-family-fallback', items: [{ name: 'Biskota Camel 450Gr' }] }
    );
    expect(scannedUnknown.accepted).toHaveLength(0);
    expect(scannedUnknown.rejected[0].reason).toBe(REJECT.SCANNED_UNDETERMINED);

    const candidateUnknown = gateResolved(
      { name: 'Plazma 300G', category: 'Keksa' },
      { source: 'catalog-family-fallback', items: [{ name: 'Shporet elektrik' }] }
    );
    expect(candidateUnknown.accepted).toHaveLength(0);
    expect(candidateUnknown.rejected[0].reason).toBe(REJECT.CANDIDATE_UNDETERMINED);
  });

  it('accepts a same-family candidate from an exact tier', () => {
    const { accepted } = gateResolved(
      { name: 'Plazma 300G', category: 'Keksa' },
      { source: 'catalog-family-fallback', items: [{ name: 'Biskota Camel 450Gr' }] }
    );
    expect(accepted).toHaveLength(1);
  });

  it('refuses a curated brand-level pairing whose entry spans several families', () => {
    const { accepted, rejected } = gateResolved(
      { name: 'Plazma 300G', category: 'Keksa' },
      {
        source: 'brand-match',
        items: [{ isBrandLevel: true, brand: 'Pestova' }],
        sourceEntry: { offCategoryTags: ['en:potatoes', 'en:fresh-fruits'] },
      }
    );
    expect(accepted).toHaveLength(0);
    expect(rejected[0].reason).toBe(REJECT.ENTRY_SPANS_FAMILIES);
  });
});

describe('the screen data path', () => {
  const data = {
    gs1: null,
    boycott: { brands: [], byCode: new Map(), byBrand: new Map() },
    brandAlternatives: { entries: [], nonLocalBrands: [] },
    kosovoRetail: {
      products: [
        // Two proven-local biscuits and one proven-local wafer.
        { id: 'a', name: 'Biskota Camel 450Gr', category: 'Keksa', isLocalBrand: true, price: 1.2, barcode: '3900000000001' },
        { id: 'b', name: 'Minella Biscuit 150G', category: 'Keksa', isLocalBrand: true, price: 0.8, barcode: '3900000000002' },
        { id: 'c', name: 'Liri Wafers Lajthi 200G', category: 'Wafers', isLocalBrand: true, price: 1.5, barcode: '3900000000003' },
        // Not proven local — must never be offered.
        { id: 'd', name: 'Biskota Import 200G', category: 'Keksa', isLocalBrand: null, price: 0.5, barcode: '4000000000004' },
      ],
    },
  };

  it('indexes only proven-local rows, keyed by the same family function', () => {
    const index = buildExactIndex(data);
    expect(index.byFamily.get('biscuits').map((r) => r.id)).toEqual(['b', 'a']); // cheapest first
    expect(index.byFamily.get('wafers').map((r) => r.id)).toEqual(['c']);
    expect(index.byFamily.get('biscuits').some((r) => r.id === 'd')).toBe(false);
  });

  it('answers a biscuit with biscuits and never with the wafer', () => {
    const index = buildExactIndex(data);
    const res = exactAlternativesFor({ product: { id: 'x', name: 'Plazma 300G', category: 'Keksa' }, family: 'biscuits' }, data, index);
    expect(res.source).toBe('catalog-family-fallback');
    expect(res.items.map((i) => i.name)).toEqual(['Minella Biscuit 150G', 'Biskota Camel 450Gr']);
    expect(res.items.every((i) => i.family === 'biscuits')).toBe(true);
  });

  it('returns a gap, not a guess, for a product it cannot place', () => {
    const index = buildExactIndex(data);
    const res = exactAlternativesFor({ product: { id: 'y', name: 'OSH TERMOS 600ML PUPPY', category: 'LIBRARI' }, family: null }, data, index);
    expect(res.items).toHaveLength(0);
    expect(res.family).toBeNull();
    expect(res.rejected[0].reason).toBe(REJECT.SCANNED_UNDETERMINED);
  });

  it('returns a gap for a family with no proven-local stock — peanut butter and cereals', () => {
    const index = buildExactIndex(data);
    for (const [name, category, family] of [
      ['Puter od kikirikija 350g', 'Embela', 'nut-butter'],
      ['Nestle Cornflakes 250g', 'Breakfast Cereal', 'breakfast-cereals'],
    ]) {
      const res = exactAlternativesFor({ product: { id: name, name, category }, family }, data, index);
      expect(res.items).toHaveLength(0);
    }
  });

  it('lists a Serbian product once however many stores stock it', () => {
    const many = {
      ...data,
      kosovoRetail: {
        products: [
          { id: '1', source: 'a', name: 'Plazma 300G', category: 'Keksa', barcode: '8600000000011', price: 1.9 },
          { id: '2', source: 'b', name: 'Plazma 300G', category: 'Keksa', barcode: '8600000000011', price: 1.5 },
          { id: '3', source: 'c', name: 'Plazma 300G', category: 'Keksa', barcode: '8600000000011', price: 2.1 },
        ],
      },
      gs1: { ranges: [{ min: 860, max: 860, country: 'Serbia', isSerbia: true, isLocal: false }] },
    };
    const rows = collectSerbianProducts(many);
    const plazma = rows.filter((r) => r.product.name === 'Plazma 300G');
    expect(plazma).toHaveLength(1);
    expect(plazma[0].listings).toBe(3);
    expect(plazma[0].product.price).toBe(1.5); // cheapest listing wins
  });
});
