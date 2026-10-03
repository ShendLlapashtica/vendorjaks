import { describe, it, expect } from 'vitest';
import { categoryFamilyOf, foldDiacritics, shelfSideFor } from '../lib/categoryFamily.js';

// THE ALBANIAN DIACRITIC FOLD AND ITS TRAPS.
//
// Every FAMILY_RULES pattern is ASCII ('buke', 'uje', 'caj', 'qumesht') while
// the catalogue's categories are spelt properly in Albanian, so `Bukë` could
// not reach the bread family and nearly all of Buka Bakery's real breads — the
// only proven-local bread in the data — were unreachable.
//
// The fold alone was NOT safe. Measured over all 91,197 rows it makes 4,709
// rows gain a family and 122 lose one, but it also CHANGES 903, and three
// classes of those got worse. Each trap below is one of those measured
// regressions, locked so it cannot come back silently. See docs/REFRESH.md §6.

describe('the fold itself', () => {
  it('folds Albanian diacritics for matching', () => {
    expect(foldDiacritics('Bukë Malësie')).toBe('Buke Malesie');
    expect(foldDiacritics('Çaj Mjaltë')).toBe('Caj Mjalte');
    expect(foldDiacritics('Ujë')).toBe('Uje');
  });

  // The exact repro from docs/XAPI-SOURCING.md §7.
  it('places a properly spelt Albanian category, not only the ASCII one', () => {
    expect(categoryFamilyOf(['Bukë Malësie'])).toBe('bread');
    expect(categoryFamilyOf(['Buke Malesie'])).toBe('bread');
    expect(categoryFamilyOf(['Bukë'])).toBe('bread'); // Buka Bakery's own WooCommerce category
    expect(categoryFamilyOf(['Ujë'])).toBe('waters');
    expect(categoryFamilyOf(['Qumësht'])).toBe('milk');
    expect(categoryFamilyOf(['Verë'])).toBe('wine');
    expect(categoryFamilyOf(['Vezë'])).toBe('eggs');
    expect(categoryFamilyOf(['Erëza & Koncentrat'])).toBe('spices-seasonings');
    expect(categoryFamilyOf(['Supë'])).toBe('soups-ready-meals');
  });

  it('still returns an English OFF tag to the same family it always did', () => {
    expect(categoryFamilyOf(['en:sunflower-oil'])).toBe('cooking-oil');
    expect(categoryFamilyOf(['en:yogurts'])).toBe('yogurt');
    expect(categoryFamilyOf(['en:peanut-butters'])).toBe('nut-butter');
    // The word-boundary guards that predate the fold must survive it.
    // "s-HAM-poos" must not be charcuterie and "t-OIL-et" must not be
    // cooking oil — that is what this line is really asserting, and it
    // matters more now that 'vaj' is also a cooking-oil pattern.
    expect(categoryFamilyOf(['en:shampoos'])).toBe('personal-care');
    // `toilet-paper` left `personal-care` on 2026-09-17 and became its own
    // family: nobody swaps a shampoo for a nine-pack of toilet roll, and
    // there is proven-local Kosovar toilet roll to offer. The guard this
    // line exists for is unchanged — it is still not `cooking-oil`.
    expect(categoryFamilyOf(['en:toilet-papers'])).toBe('toilet-paper');
  });
});

describe('trap 1 — compound aisles (measured: 283 + 183 rows)', () => {
  // "KAFE, ÇAJ, KAKAO" is one shelf for coffee, tea and cocoa. Unfolded, kafe
  // won. Folded, caj won first and 283 rows of instant coffee became TEA.
  it('reads a coffee-and-tea shelf as coffee', () => {
    expect(categoryFamilyOf(['KAFE, ÇAJ, KAKAO'])).toBe('coffee');
    expect(categoryFamilyOf(['KAFE, ÇAJ, KAKAO', 'Nescafe 3In1 Classic 15.5G'])).toBe('coffee');
    expect(categoryFamilyOf(['Çaj & Kafe', 'Kraco Kafe 200Gr'])).toBe('coffee');
  });

  it('still reads a tea-only shelf as tea', () => {
    expect(categoryFamilyOf(['ÇAJ CEYLON DHE ÇAJ FILTËR'])).toBe('tea');
    expect(categoryFamilyOf(['Pije', 'Çaj Fruta Mali Premium 4/40g'])).toBe('tea');
  });

  // The product name is read before the category, so a jar that says what it
  // is still wins over the compound shelf it sits on.
  it('lets the product name override the compound shelf', () => {
    expect(categoryFamilyOf(['Çaj & Kafe', 'Kraco Çaj Xhinxher Me Limon 20B'])).toBe('tea');
    expect(categoryFamilyOf(['KAVANOZË, KONSERVA, NUTELLA', 'Metin - Reçel Dredheze 360gr'])).toBe('jams');
  });

  it('reads a honey-and-jam shelf as honey', () => {
    expect(categoryFamilyOf(['Mjaltë & Reçel'])).toBe('honey');
    expect(categoryFamilyOf(['Mjaltë & Reçel', 'Ambrosoli Miele Millefiori 750Gr'])).toBe('honey');
    expect(categoryFamilyOf(['Reçel'])).toBe('jams');
  });
});

describe('trap 2 — ingredient and packing modifiers', () => {
  // Owner, 2026-09-16: "and dont recommend milk for yogurt". After the fold a
  // YOGURT resolved to milk because its name mentions milk cream.
  it('does not turn a yogurt into milk', () => {
    expect(categoryFamilyOf(['JOGURT ME FRUTA', 'Despar Kos Me Krem Qumështi 500G'])).toBe('yogurt');
  });

  it('does not turn a biscuit or a chocolate bar into milk', () => {
    expect(categoryFamilyOf(['Spar Rolls Çokolladë Me Qumësht 125G'])).not.toBe('milk');
    expect(categoryFamilyOf(['Çokollata', 'Lacta Me Qumesht 85Gr'])).not.toBe('milk');
    expect(categoryFamilyOf(['Biskota të ëmbla', 'Biskota Me Qumesht Colussi 250G'])).not.toBe('milk');
  });

  // The grammar does real work: bare `qumësht` is the product, `qumështi` (the
  // definite form) is almost always a modifier.
  it('still places actual milk', () => {
    expect(categoryFamilyOf(['Qumësht', 'Qumësht Mi99 1,5% 12/1L'])).toBe('milk');
    expect(categoryFamilyOf(['Chips & Snacks', 'Alpsko Qumësht Çokollatë'])).toBe('milk'); // a milk drink
  });

  it('does not turn milk thistle into milk', () => {
    expect(categoryFamilyOf(['BioAgros Herbs & Tea', 'Gjëmbak Qumështi Organik 50G'])).toBe('tea');
  });

  it('reads a packing medium as a medium, not as the product', () => {
    expect(categoryFamilyOf(['MISH I KONSERVUAR DETI', 'Siblou Tuna Në Ujë 185g'])).toBe('fish-seafood');
    expect(categoryFamilyOf(['Shporta bazë', 'Tuna Calvo 80G Ne Uje (3+1)'])).toBe('fish-seafood');
    expect(categoryFamilyOf(['Salcë domatesh', 'Domate të qëruara në lëng domatesh 24/400g'])).not.toBe('juices');
  });

  it('reads egg pasta as pasta', () => {
    expect(categoryFamilyOf(['PASTA', 'Despar Kaneloni Me Vezë 250G'])).toBe('pasta');
    expect(categoryFamilyOf(['Pasta & Oriz', 'Lasagne me veze - Barilla'])).toBe('pasta');
  });

  it('still places actual eggs', () => {
    expect(categoryFamilyOf(['VEZË', 'Kokrra Vezë 30 Cope'])).toBe('eggs');
  });
});

describe('trap 3 — lëngshëm means LIQUID, not juice (measured: 643 rows, 576 of them detergent)', () => {
  // Without this trap the fold files Ajax Kitchen and Smac Sgrassatore in the
  // juice family, so a juice scan could be answered with a bottle of
  // degreaser. It is the "Kosovar cookie for a sunflower oil" failure exactly.
  it('never files liquid detergent as juice', () => {
    expect(categoryFamilyOf(['Detergjent të lëngshëm', 'Ajax Kitchen 750Ml'])).not.toBe('juices');
    expect(categoryFamilyOf(['Detergjent të lëngshëm', 'Smac Sgrassatore 650Ml'])).not.toBe('juices');
    expect(categoryFamilyOf(['Liquid Detergent', 'Arix soft det. i lengshem 4.5L'])).not.toBe('juices');
  });

  it('never files liquid soap as juice', () => {
    expect(categoryFamilyOf(['Shporta bazë', 'Sapun I Lengshem Allways Me Vaj Argani 1L'])).not.toBe('juices');
  });

  // `detergjent` was simply missing from the cleaning patterns — the reason
  // those 576 rows had no family for the juice pattern to steal in the first
  // place. 2,107 rows gained `cleaning` when it was added.
  it('places Albanian-spelt detergent in the cleaning family', () => {
    expect(categoryFamilyOf(['DETERXHENTE SHTEPIAKE', 'DETERGJENT PER RROBA PERSIL 5KG'])).toBe('cleaning');
    expect(categoryFamilyOf(['Detergjent rrobash'])).toBe('cleaning');
    expect(shelfSideFor(['Detergjent rrobash'], 'Detergjent rrobash')).toBe('household');
  });

  it('reads drinking yogurt as yogurt, not juice and not nothing', () => {
    expect(categoryFamilyOf(['Kos', 'Erzeni Kos I Lengshem 2.8% 900 Ml'])).toBe('yogurt');
    expect(categoryFamilyOf(['Kos', 'Lufra Kos I Lengshem Tetra 750 Ml'])).toBe('yogurt');
  });

  // Bare 'kos' is NOT admissible as a yogurt pattern: it is the first three
  // letters of "Kosova". This test is the reason the pattern is 'kos i'.
  it('does not file anything named after the country as yogurt', () => {
    expect(categoryFamilyOf(['Uji i Kosovës'])).not.toBe('yogurt');
    expect(categoryFamilyOf(['Made in Kosova'])).not.toBe('yogurt');
  });

  // Real juice must still be juice, or the trap has overreached.
  it('still places real juice', () => {
    expect(categoryFamilyOf(['LËNGJE', 'Lëng Brusnice 100% Fruta 1000 Ml'])).toBe('juices');
    expect(categoryFamilyOf([null, 'Lëng frutash'])).toBe('juices');
  });
});

describe('false friends the fold created or exposed', () => {
  it('an aubergine is a vegetable, not a pâté', () => {
    expect(categoryFamilyOf(['Perime', 'Patellxhan'])).toBe('fresh-vegetables');
    expect(categoryFamilyOf(['PERIME'])).toBe('fresh-vegetables');
    expect(categoryFamilyOf(['Perime', 'Patëllxhan'])).toBe('fresh-vegetables');
  });

  it('a teapot is not tea — and is admitted to be unplaceable rather than guessed', () => {
    expect(categoryFamilyOf(['AMVISERI', 'GJYGYMA TE ÇAJIT E VOGEL 3/1'])).toBe(null);
  });

  // These two were wrong BEFORE the fold, matching 'lamb' inside "Lambrusco"
  // and 'ham' inside "Hamburgeri". The fold fixes them as a side effect.
  it('Lambrusco is wine and a hamburger bun is bread', () => {
    expect(categoryFamilyOf(['VERËRA', "Contrada d'Este Verë Lambrusco 750ml"])).toBe('wine');
    expect(categoryFamilyOf(['BUKË', 'Despar Bukë Hamburgeri 6 Copë 300G'])).toBe('bread');
  });
});
