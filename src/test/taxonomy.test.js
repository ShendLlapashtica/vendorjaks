import { describe, it, expect } from 'vitest';
import {
  FAMILY_IDS,
  ESSENTIAL_FAMILIES,
  HOUSEHOLD_FAMILIES,
  freeTextFamiliesOf,
  categoryFamilyOf,
} from '../lib/categoryFamily.js';
import { FAMILY_TERM_IDS, FOOD_FAMILIES, leadFamilyOf, titleFamiliesOf } from '../lib/liveAlternatives.js';
import { FAMILY_LABELS } from '../lib/familyLabels.js';
import { exactFamilyOf } from '../lib/exactMatch.js';

// THE TWO TAXONOMIES MUST NOT DRIFT APART AGAIN.
//
// The app answers "what kind of product is this?" twice, from two files:
//
//   categoryFamily.js  FAMILY_RULES  reads a CATEGORY string or an OFF tag
//   liveAlternatives.js FAMILY_TERMS reads a product TITLE
//
// They have now diverged four times, and every divergence shipped a wrong
// answer to a real shopper:
//
//   'biskot'  in FAMILY_TERMS, missing from FAMILY_RULES
//             -> a pack of Milka biscuits answered with six cartons of milk
//   'vaj'     in FAMILY_TERMS, missing from FAMILY_RULES
//             -> seven bottles of oil on a shelf that named flour and salt
//   'keçap'   in FAMILY_TERMS, missing from FAMILY_RULES
//             -> five bottles of Heinz ketchup filed as MAYONNAISE
//   'kripos'  a STEM_TRAP in liveAlternatives.js, missing from FOLD_TRAPS
//             -> 170 rows of salty snacks filed as SALT
//
// A per-string equality test is not possible and would not be right — the
// two files answer different questions, and 'njelmet' is deliberately a
// shelf word and deliberately not a title word. What CAN be asserted, and
// what would have caught all four, is that they name the same FAMILIES. A
// family known to one file and not the other is either unreachable from
// half the evidence or invisible to half the app.
describe('the two taxonomies name the same families', () => {
  it('every family in categoryFamily.js has search stems in liveAlternatives.js', () => {
    const missing = [...FAMILY_IDS].filter((f) => !FAMILY_TERM_IDS.has(f)).sort();
    expect(missing).toEqual([]);
  });

  it('every family in liveAlternatives.js has patterns in categoryFamily.js', () => {
    const missing = [...FAMILY_TERM_IDS].filter((f) => !FAMILY_IDS.has(f)).sort();
    expect(missing).toEqual([]);
  });

  // Explore's two columns are driven by the same family ids. A food family
  // missing from ESSENTIAL_FAMILIES silently moves that whole shelf into
  // the hygiene-and-cleaning column; a household one missing from
  // HOUSEHOLD_FAMILIES gets there by accident through a free-text regex.
  it('every family is on exactly one side of the Explore split', () => {
    const unplaced = [...FAMILY_IDS].filter(
      (f) => !ESSENTIAL_FAMILIES.has(f) && !HOUSEHOLD_FAMILIES.has(f) && f !== 'supplements'
    ).sort();
    const both = [...FAMILY_IDS].filter((f) => ESSENTIAL_FAMILIES.has(f) && HOUSEHOLD_FAMILIES.has(f)).sort();
    expect({ unplaced, both }).toEqual({ unplaced: [], both: [] });
  });

  // A third list of the same thing. FOOD_FAMILIES gates the food/non-food
  // side check in findShelfAlternatives; ESSENTIAL_FAMILIES gates Explore.
  // They are the same question and must give the same answer.
  it('FOOD_FAMILIES and ESSENTIAL_FAMILIES agree about what is food', () => {
    const onlyFood = [...FOOD_FAMILIES].filter((f) => !ESSENTIAL_FAMILIES.has(f)).sort();
    const onlyEssential = [...ESSENTIAL_FAMILIES].filter((f) => !FOOD_FAMILIES.has(f)).sort();
    expect({ onlyFood, onlyEssential }).toEqual({ onlyFood: [], onlyEssential: [] });
  });

  // A family with no label renders its internal id — "ketchup-tomato-sauces"
  // — to a shopper on /alternativa.
  it('every family has a shopper-facing name in both languages', () => {
    const unlabelled = [...FAMILY_IDS]
      .filter((f) => !FAMILY_LABELS[f]?.sq || !FAMILY_LABELS[f]?.en)
      .sort();
    expect(unlabelled).toEqual([]);
  });

  it('no label exists for a family that does not', () => {
    const orphans = Object.keys(FAMILY_LABELS).filter((f) => !FAMILY_IDS.has(f)).sort();
    expect(orphans).toEqual([]);
  });

  // Round-trip: liveAlternatives.js stamps `matchedTag: family` on shelf
  // candidates, and the harness then asks categoryFamilyOf about it.
  it('every family id resolves to itself', () => {
    for (const family of FAMILY_IDS) {
      expect(categoryFamilyOf([family])).toBe(family);
    }
  });
});

// Every case below is a real row from data/kosovo-retail.json, named with
// the shelf label the retailer actually wrote. None is invented to make a
// green tick.
describe('families added 2026-09-17 — the school aisle', () => {
  it('names a school bag, which the shelf label "LIBRARI" cannot', () => {
    expect(exactFamilyOf({ name: 'OSH CANTE 3D DINO 42X30X22CM SC2996', category: 'LIBRARI' })).toBe('school-bags');
  });

  it('keeps a pencil case separate from the bag it goes in', () => {
    expect(exactFamilyOf({ name: 'OSH FOTROLLE ME 1 ZIP KITTY SC2930', category: 'LIBRARI' })).toBe('pencil-cases');
    expect(exactFamilyOf({ name: 'OSH TERMOS 600ML PUPPY SC3402', category: 'LIBRARI' })).toBe('vacuum-flasks');
  });

  // The refused near-miss. 'canta' would have reached a soft drink.
  it('does not read "Cantabile" as a school bag', () => {
    expect(titleFamiliesOf('Cantabile Apple Ade').has('school-bags')).toBe(false);
  });
});

describe('families added 2026-09-17 — paper goods', () => {
  it('places toilet roll and kitchen towel, which are different purchases', () => {
    expect(exactFamilyOf({ name: 'Perfex Leter Toaleti Kamomil 8+2', category: 'HIGJENA' })).toBe('toilet-paper');
    expect(exactFamilyOf({ name: 'Leter Kuzhine Perefex 2/1', category: 'SHPORTA BAZE' })).toBe('kitchen-towel');
  });

  // The row that proved the split was worth making: a nine-pack of toilet
  // roll whose brand line says "Green Tea" was in the TEA family.
  it('does not read "Green Tea" toilet roll as tea', () => {
    const row = { name: 'Paloma Deluxe Green Tea Leter Toaleti 10rolls', category: 'LETËR TUALETI' };
    expect(exactFamilyOf(row)).toBe('toilet-paper');
  });

  it('a bare "letër" is not enough — it is in baking paper and wet wipes too', () => {
    expect(freeTextFamiliesOf('Letër').size).toBe(0);
  });
});

describe('a compound shelf label is weak evidence, not no evidence', () => {
  // "Njelmeta" is the salty aisle: it honestly names two purchases.
  it('reports both families the salty aisle names', () => {
    expect([...freeTextFamiliesOf('Njelmeta')].sort()).toEqual(['crisps', 'savoury-snacks']);
  });

  // THE ROW THIS RULE EXISTS FOR. Ketchup is the commonest flavour word on
  // a crisp packet, and 'keqap' had to be added for the real ketchups.
  it('never calls a ketchup-flavoured crisp packet a ketchup', () => {
    // This test used to assert null, because refusing was the best the two
    // witnesses could do. Since 2026-09-19 a documented product identity
    // answers afterwards — Clipsy is Marbo's potato crisp — so the row now
    // resolves to what it actually is. The property being defended has not
    // changed and is spelled out rather than implied: it is not ketchup.
    const row = { name: 'Clipsy Dini Keqap 30G', category: 'Njelmeta' };
    expect(exactFamilyOf(row)).not.toBe('ketchup-tomato-sauces');
    expect(exactFamilyOf(row)).not.toBe('ketchup');
    expect(exactFamilyOf(row)).toBe('crisps');
  });

  it('accepts the same mention when the shelf corroborates it', () => {
    expect(exactFamilyOf({ name: 'Vipa Chips Ketchup 40 Gr', category: 'Njelmeta' })).toBe('crisps');
  });

  // ...and the head noun still beats the compound label, because an aisle
  // string like "PRODUKTE TË FTOHTA NGA MISHI & PESHKU" names the counter,
  // not the purchase. A stricter first draft refused all 40 of these.
  it('does not let a compound aisle label veto a head noun', () => {
    expect(
      exactFamilyOf({ name: 'Proshute E Thate Gjedhi Franca 90Gr', category: 'PRODUKTE TË FTOHTA NGA MISHI & PESHKU' })
    ).toBe('charcuterie');
    expect(exactFamilyOf({ name: 'Kripe Deti E Trashe 1Kg', category: 'Ereza & Salca' })).toBe('salt');
  });
});

describe('spellings that were only in one of the two files', () => {
  it('reads all three Albanian spellings of ketchup from a shelf label', () => {
    expect(categoryFamilyOf('Keqap')).toBe('ketchup-tomato-sauces');
    expect(categoryFamilyOf('Keçap')).toBe('ketchup-tomato-sauces');
    // "KEÇAP DHE MAJONEZË" names two purchases, and the two readings of it
    // are both correct and deliberately different: categoryFamilyOf is
    // first-match-wins and answers `mayonnaise-dressings` because that
    // rule is written first, while freeTextFamiliesOf reports the set and
    // is what /alternativa uses. Before 'keçap' was added to this file the
    // set had ONE member and five bottles of Heinz ketchup were filed as
    // mayonnaise with nothing to contradict it.
    expect([...freeTextFamiliesOf('KEÇAP DHE MAJONEZË')].sort()).toEqual([
      'ketchup-tomato-sauces',
      'mayonnaise-dressings',
    ]);
    expect(exactFamilyOf({ name: 'Heinz Keqap Djeges 570Ml', category: 'KEÇAP DHE MAJONEZË' })).toBe(
      'ketchup-tomato-sauces'
    );
  });

  it('reads "vaj" as oil from a shelf label, and never from "vajza"', () => {
    expect([...freeTextFamiliesOf('Miell, Vaj & Sheqer , Kripë')].sort()).toEqual([
      'cooking-oil',
      'flour',
      'salt',
    ]);
    expect(freeTextFamiliesOf('Gete për vajza').has('cooking-oil')).toBe(false);
  });

  it('reads "të kriposur" as an adjective, not as salt', () => {
    expect(freeTextFamiliesOf('PROGRAMI I KRIPOSUR').has('salt')).toBe(false);
    expect(exactFamilyOf({ name: 'Smoki Flips Pi&Ki 25Gr', category: 'PROGRAMI I KRIPOSUR' })).toBe('savoury-snacks');
  });

  it('reads the two Albanian words for crisps from a shelf label', () => {
    expect(categoryFamilyOf('Qipsa')).toBe('crisps');
    expect(categoryFamilyOf('Patatina')).toBe('crisps');
  });

  it('reads "eurocrem" with a c', () => {
    expect(leadFamilyOf('Eurocrem Bllok 90Gr')).toBe('chocolate-spread');
  });

  // "Pije / Lëngje frutash" is the JUICE shelf; 'fruta' made it ambiguous.
  it('reads the fruit-juice shelf as juice', () => {
    expect([...freeTextFamiliesOf('Pije / Lëngje frutash')]).toEqual(['juices']);
    expect(exactFamilyOf({ name: 'JAFFA CHAMP.MOLLE 2L', category: 'Pije / Lëngje frutash' })).toBe('juices');
  });

  // ...and the iced teas that share that shelf are still refused, by the
  // second witness rather than by a special case.
  it('still refuses an iced tea shelved with the juice', () => {
    expect(exactFamilyOf({ name: 'SOLA CAJ I FTOHT PJESHKE 0.5 L', category: 'Pije / Lëngje frutash' })).toBe(null);
  });
});

// The families we can name but deliberately cannot answer. Naming a product
// and having no local stock for it is a KNOWN GAP and an honest screen; the
// failure mode this whole file guards against is naming it wrongly.
describe('families that exist to say "we know what this is and there is none"', () => {
  it('has no shelf search stems for the school aisle beyond its own words', () => {
    // A school bag search must not reach a household bag: the two families
    // are separate and `household-bags` stems are compounds about rubbish.
    expect(titleFamiliesOf('OSH CANTE 3D DINO 42X30X22CM SC2996').has('household-bags')).toBe(false);
    expect(titleFamiliesOf('Qese Per Mbeturina 30L').has('school-bags')).toBe(false);
  });
});
