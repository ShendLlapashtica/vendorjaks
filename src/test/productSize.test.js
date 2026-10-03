import { describe, it, expect } from 'vitest';
import {
  parseProductSize,
  parsePieceCount,
  isSoldByWeight,
  formatSize,
  resolveProductSize,
} from '../lib/productSize.js';

// Every title in this file is a REAL string from data/kosovo-retail.json
// (or, where marked, the exact shape the brief called out). The
// false-positive block is the important half: a wrong gram figure is worse
// than no gram figure, because a shopper compares prices per kilo with it.

describe('parseProductSize — real Kosovo retail titles', () => {
  const cases = [
    ['POMFRIT 2.5KG K&K ELKOS (4)', { value: 2.5, unit: 'kg', grams: 2500, raw: '2.5KG' }],
    ['PARIZIER EXTRA KORAL 300G  (20)', { value: 300, unit: 'g', grams: 300, raw: '300G' }],
    ['DJATH SHARRI 800GR (6)', { value: 800, unit: 'g', grams: 800, raw: '800GR' }],
    ['Sos Domatesh Pomi 500Gr', { value: 500, unit: 'g', grams: 500, raw: '500Gr' }],
    ['Frutti Leng Dredheze 1L', { value: 1, unit: 'l', ml: 1000, raw: '1L' }],
    ['Tepelena Ujë Natyral 2L', { value: 2, unit: 'l', ml: 2000, raw: '2L' }],
    ['Ketchup Calve 250Ml', { value: 250, unit: 'ml', ml: 250, raw: '250Ml' }],
    ['SHAMPON  PER FLOKE  BOTHANIK THERAPY 400 ML ', { value: 400, unit: 'ml', ml: 400, raw: '400 ML' }],
    ['Magnum Mini Klasik 256.2Gr', { value: 256.2, unit: 'g', grams: 256.2, raw: '256.2Gr' }],
    ['280g Stir-fried Bamboo Shoots', { value: 280, unit: 'g', grams: 280, raw: '280g' }],
  ];
  for (const [title, want] of cases) {
    it(title.trim(), () => {
      const got = parseProductSize(title);
      expect(got, `expected a size for ${title}`).toBeTruthy();
      expect(got.value).toBe(want.value);
      expect(got.unit).toBe(want.unit);
      expect(got.raw).toBe(want.raw);
      if (want.grams != null) expect(got.grams).toBe(want.grams);
      if (want.ml != null) expect(got.ml).toBe(want.ml);
    });
  }

  it('reads a comma decimal the same as a dot ("0,33L")', () => {
    expect(parseProductSize('Coca Cola 0,33L')).toMatchObject({ value: 0.33, unit: 'l', ml: 330 });
    expect(parseProductSize('Coca Cola 0.33L')).toMatchObject({ value: 0.33, unit: 'l', ml: 330 });
  });

  it('converts cl to ml', () => {
    expect(parseProductSize('Birra Peja 33CL')).toMatchObject({ unit: 'cl', ml: 330 });
  });
});

describe('parseProductSize — multipacks', () => {
  it('"6X1.5L" is 6 bottles of 1.5 l, 9 l net', () => {
    expect(parseProductSize('Uje Rugove 6X1.5L')).toMatchObject({ value: 1.5, unit: 'l', count: 6, ml: 9000 });
  });
  it('"2*80Gr" uses an asterisk', () => {
    expect(parseProductSize('Rio Mare Tonno Olio Oliva 2*80Gr')).toMatchObject({ value: 80, count: 2, grams: 160 });
  });
  it('"12X135G" with a two-digit count', () => {
    expect(parseProductSize('2U Kikirik Krip 12X135G')).toMatchObject({ value: 135, count: 12, grams: 1620 });
  });
  it('"100*2GR" — 100 teabags of 2 g is a real pack, not a misread', () => {
    expect(parseProductSize('CAJ I GJELBERT AHMAD 100*2GR(12)')).toMatchObject({ value: 2, count: 100, grams: 200 });
  });
});

describe('parseProductSize — unit written before the number (Conad imports)', () => {
  it('"Gr 100"', () => {
    expect(parseProductSize('Novi Tavoletta Noisette Gr 100')).toMatchObject({ value: 100, unit: 'g', grams: 100 });
  });
  it('"Gr400" glued', () => {
    expect(parseProductSize('Migro Lenticchie Lessate Gr400')).toMatchObject({ value: 400, unit: 'g' });
  });
  it('"G.270" with a full stop', () => {
    expect(parseProductSize('Crich Frollini G.270 Sugarfree')).toMatchObject({ value: 270, unit: 'g' });
  });
  it('"Lt1"', () => {
    expect(parseProductSize('Qumesht Pjese Skrem Uht Conad Lt1')).toMatchObject({ value: 1, unit: 'l', ml: 1000 });
  });
  it('"Ml.5.5"', () => {
    expect(parseProductSize("Labello Soft Rose' Ml.5.5")).toMatchObject({ value: 5.5, unit: 'ml' });
  });
  it('"Gr100X4" is a reversed-unit multipack', () => {
    expect(parseProductSize('Kremvice Derri Conad Gr100X4')).toMatchObject({ value: 100, count: 4, grams: 400 });
  });
});

// ---------------------------------------------------------------------------
// THE HALF THAT MATTERS. Each of these is a real string that LOOKS like it
// contains a size. Returning null here is the correct, required behaviour.
// ---------------------------------------------------------------------------
describe('parseProductSize — refuses things that are not sizes', () => {
  const mustBeNull = [
    ['(4) is a trailing case count', 'MISH I BARDHE COOPAVEL (4)'],
    ['(15) is a trailing case count', 'Barilla Penne Rigate (15)'],
    ['a bare year is not grams', 'Vino Rosso Riserva 2026'],
    ['a vintage year with no unit', 'Prosecco Docg Dogali 2019'],
    ['a percentage is fat content', '3.2% MLEKO'],
    ['fat content alone, no pack size', 'Fru Fru Jogurt 0.1%'],
    ['a multipack with no unit anywhere', 'Succo Ace S/Z Classici Conad 200X3'],
    ['textile dimensions in cm', 'Schafer Rena Double Pike 200X230-Ecru/Mustard'],
    ['a diameter in cm', 'Pjata Plastike 15Cm'],
    ['"Kr" is a typo, not a unit', 'Kripe Himalaya E Trashe 0.5Kr'],
    ['mg is a per-capsule dose, not net weight', 'Suplement per prostaten 500MG'],
    ['a shape/series number', 'Divella Mak. Penne Ziti Rigate No27'],
    ['a series number written Nr3', 'Shpageta Pasta Zara Nr3'],
    ['washes are a dose estimate, not a size', 'Det. Per Rroba 100LARJE Certo'],
    ['a fraction is not a size', 'Proshute E Tymosur 1/2'],
    ['nothing numeric at all', 'Zott Toasty Emmental'],
    ['no size stated', 'Biskrem Duo'],
    ['empty string', ''],
    ['null', null],
  ];
  for (const [why, title] of mustBeNull) {
    it(`null — ${why}: ${JSON.stringify(title)}`, () => {
      expect(parseProductSize(title)).toBeNull();
    });
  }

  it('picks the pack size and ignores the diameter beside it', () => {
    // "15Cm" is a diameter, "X40" a count with no unit, "1KG" the real size.
    expect(parseProductSize('Guanajuato Corn Tortilla 15Cm X40 White 1KG')).toMatchObject({
      value: 1,
      unit: 'kg',
      grams: 1000,
    });
  });

  it('ignores the fat percentage and reads the real size', () => {
    expect(parseProductSize('Fru Fru Jogurt 0.1% 150G')).toMatchObject({ value: 150, unit: 'g', grams: 150 });
    expect(parseProductSize('KOS DRENA 3.2% 1.4KG (4)')).toMatchObject({ value: 1.4, unit: 'kg', grams: 1400 });
  });

  it('ignores a shape number and reads the real size', () => {
    expect(parseProductSize('Barilla Penne Rigate No73 500Gr (15)')).toMatchObject({ value: 500, unit: 'g' });
    expect(parseProductSize('LASAGNE DIVELLA 500G NR.109 (12)')).toMatchObject({ value: 500, unit: 'g' });
  });

  it('two DISAGREEING sizes in one title are ambiguous, so unknown', () => {
    // Guessing which of the two is the pack would be a fabricated fact.
    expect(parseProductSize('Kafe Maceo 250Gr Qese 1KG')).toBeNull();
  });

  it('two AGREEING readings of the same quantity are fine', () => {
    expect(parseProductSize('DJATH KORAB 300G 300 GR')).toMatchObject({ value: 300, unit: 'g' });
  });

  it('refuses an implausibly large mass', () => {
    expect(parseProductSize('Artikull 999999G')).toBeNull();
  });
});

describe('isSoldByWeight — loose goods are a third answer, not a gap', () => {
  const byWeight = [
    'MOLLE DELISHES KG/PLU.601',
    'RRUSH I ZI /KG PLU.152',
    'PJESHKA /KG PLU.86',
    'SUXHUK BUQUKU/KG PLU.367 (10)',
    'MISH I TERUR KL .I OREX KG/PLU 1151(10)',
  ];
  for (const title of byWeight) {
    it(`sold by weight: ${title}`, () => {
      expect(isSoldByWeight(title)).toBe(true);
      // and critically, the PLU digits are NEVER read as a quantity
      expect(parseProductSize(title)).toBeNull();
    });
  }

  it('a normal packaged product is not sold by weight', () => {
    expect(isSoldByWeight('POMFRIT 2.5KG K&K ELKOS (4)')).toBe(false);
    expect(isSoldByWeight('Sos Domatesh Pomi 500Gr')).toBe(false);
  });

  it('"PLU.152" never becomes 152 of anything', () => {
    const r = resolveProductSize({ name: 'RRUSH I ZI /KG PLU.152' });
    expect(r.kind).toBe('byWeight');
    expect(r.text).toBeNull();
  });
});

describe('parsePieceCount', () => {
  it('reads "94 COPE"', () => {
    expect(parsePieceCount('PELENA PER FEMIJE VIOLETA GIGA 94 COPE(11-25')).toMatchObject({ count: 94 });
  });
  it('reads the "10/1" roll notation', () => {
    expect(parsePieceCount('LETER TUALETI PALOMA WHITE 10/1 (9)')).toMatchObject({ count: 10 });
  });
  it('does not read washes as pieces', () => {
    expect(parsePieceCount('Det. Per Rroba 100LARJE Certo')).toBeNull();
  });
  it('returns null when there is no count', () => {
    expect(parsePieceCount('Zott Toasty Emmental')).toBeNull();
  });
});

describe('formatSize', () => {
  it('renders a single pack plainly', () => {
    expect(formatSize(parseProductSize('Sos Domatesh Pomi 500Gr'))).toBe('500 g');
  });
  it('renders a multipack with its net total', () => {
    expect(formatSize(parseProductSize('Uje Rugove 6X1.5L'))).toBe('6 × 1.5 l (9 l)');
  });
  it('returns null for null rather than a placeholder', () => {
    expect(formatSize(null)).toBeNull();
  });
});

describe('resolveProductSize — one answer per product', () => {
  it('a stored quantity from the harvest pipeline always wins over parsing', () => {
    // If these ever disagreed, the app would show two sizes for one product
    // depending on which screen rendered it. The stored value wins, always.
    const r = resolveProductSize({ name: 'Hello Panda (520gr)', quantity: '520 g', quantitySource: 'wolt `unit_info` field' });
    expect(r.text).toBe('520 g');
    expect(r.source).toBe('wolt `unit_info` field');
  });

  it('falls back to the title when the pipeline left it null', () => {
    const r = resolveProductSize({ name: 'POMFRIT 2.5KG K&K ELKOS (4)', quantity: null });
    expect(r).toMatchObject({ kind: 'size', text: '2.5 kg', source: 'parsed-from-product-name', raw: '2.5KG' });
  });

  it('returns null — not an empty string — when nothing is knowable', () => {
    expect(resolveProductSize({ name: 'Zott Toasty Emmental' })).toBeNull();
    expect(resolveProductSize(null)).toBeNull();
  });

  it('keeps `raw` so any number on screen is traceable to its substring', () => {
    const r = resolveProductSize({ name: 'Rio Mare Tonno Olio Oliva 2*80Gr' });
    expect(r.raw).toBe('2*80Gr');
    expect(r.size.grams).toBe(160);
  });
});
