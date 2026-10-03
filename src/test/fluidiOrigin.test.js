// ===========================================================================
// THE FLUIDI CASE — the Bimilk mechanism, pointed the other way
// ===========================================================================
//
// Owner, 2026-09-18: "and if fluidi or albanian product registered in serbia
// dont mark as serbian product".
//
// Bimilk (2026-09-16) was a North Macedonian dairy called Serbian because its
// Serbian parent registered the barcode on GS1 Serbia's 860 block. Fluidi is
// the same mechanism doing the damage in the direction that matters most to
// this app: a KOSOVAR producer called Serbian, which tells a shopper to
// boycott exactly the local product the app exists to send them to.
//
// Two distinct faults were found and both are covered here.
//
//   1. REGISTRATION READ AS MANUFACTURE. Fluidi bottles at Velekincë, Gjilan
//      and registers barcodes at three GS1 offices — 390 (the legacy Kosovo
//      range), 530 (GS1 Albania) and 860 (GS1 Serbia, through the group's
//      Preševo entity). Its owner says why, on the record: Kosovo had no
//      international prefix of its own until 381.
//
//   2. A NAME COLLISION READ AS AN IDENTIFICATION. "jaffa" is an alias of
//      the Serbian biscuit maker Jaffa Crvenka in boycott-brands.json, and
//      it was matching Fluidi's Jaffa Champion juice. 92 of the 94 rows on a
//      Kosovo/Albanian prefix that the app was calling Serbian were this one
//      mistake. Jaffa Crvenka makes no beverage of any kind (jaffa.rs).
//
// Every claim asserted below is quoted with its URL in
// data/product-origins-SOURCES.md, addendum 2026-09-18.

import { describe, it, expect } from 'vitest';
import gs1Raw from '../../data/gs1-prefixes.json';
import originsRaw from '../../data/product-origins.json';
import boycottRaw from '../../data/boycott-brands.json';
import stanceRaw from '../../data/country-stance.json';
import { classifyBarcode, VERDICT } from '../lib/gs1.js';
import { normalizeProductOrigins, findVerifiedOrigin, resolveOrigin } from '../lib/productOrigins.js';
import { normalizeBoycottTable, findBrandHomonym, looksLikeDrink, BRAND_HOMONYMS } from '../lib/boycott.js';
import { normalizeStanceTable } from '../lib/countryStance.js';
import { productStance } from '../lib/flagTone.js';

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

// The exact row the owner was looking at: the one Fluidi product in the
// catalogue that carries a Serbian GS1 number.
const FLUIDI_RS = '8600101990242'; // Fluidi Leng Fruta 200Ml (wolt.com/maxi-supermarket)
const FLUIDI_XK = '3900386780435'; // Fluidi Biter Lemon 2L  (prefix 390)
const JAFFA_AL = '5304000430238'; // Jaffa Champion Multivitamin 0.25L (prefix 530 = GS1 Albania)
const JAFFA_XK = '3902076610336'; // the same 1.5L orange, prefix 390
const JAFFA_RS = '8600101990518'; // ...and again on GS1 Serbia
const CRVENKA = '8600114000013'; // Jaffa Cakes 150g — the real Serbian Jaffa

describe('Fluidi: a Kosovar producer on a Serbian GS1 prefix', () => {
  it('the prefix really is Serbian — that fact is not denied', () => {
    const c = classifyBarcode(FLUIDI_RS, gs1);
    expect(c.prefix).toBe('860');
    expect(c.iso).toBe('RS');
    expect(c.isSerbiaPrefix).toBe(true);
  });

  it('the same producer also ships on the Kosovo and Albanian ranges', () => {
    expect(classifyBarcode(FLUIDI_XK, gs1).iso).toBe('XK');
    expect(classifyBarcode(JAFFA_AL, gs1).iso).toBe('AL');
  });

  it('product-origins.json carries a verified Kosovar production location', () => {
    const origin = findVerifiedOrigin({ code: FLUIDI_RS }, productOrigins);
    expect(origin).not.toBeNull();
    expect(origin.verified).toBe(true);
    expect(origin.productionCountry).toBe('XK');
    expect(origin.isSerbia).toBe(false);
    expect(origin.sourceUrl).toMatch(/^https?:\/\//);
    expect(origin.ownershipCountry).toBe('XK');
  });

  it('resolveOrigin keeps registration, manufacture and ownership apart', () => {
    const classify = classifyBarcode(FLUIDI_RS, gs1);
    const origin = findVerifiedOrigin({ code: FLUIDI_RS }, productOrigins);
    const split = resolveOrigin(classify, origin);
    expect(split.registrationIso).toBe('RS'); // registration: still stated
    expect(split.manufactureIso).toBe('XK'); // manufacture: the flag drawn
    expect(split.divergent).toBe(true);
    expect(split.displayIso).toBe('XK');
    // THE MIRROR OF serbianOwned. Bimilk was foreign-made, Serbian-owned;
    // Fluidi is the opposite and the app can now say so.
    expect(split.serbianOwned).toBe(false);
    expect(split.locallyOwned).toBe(true);
  });

  it('the flag follows the factory and the registration keeps its own line', () => {
    // The three result screens read classify.iso/country, not stance.split,
    // so /b/8600101990242 dropped the boycott and then drew a Serbian flag
    // over a Kosovar juice. Half a correction reads as a failed correction.
    const c = productStance({ barcode: FLUIDI_RS, name: 'Fluidi Leng Fruta 200Ml' }, data).classify;
    expect(c.iso).toBe('XK');
    expect(c.countrySq).toBe('Kosovë');
    expect(c.verdict).toBe(VERDICT.LOCAL); // a verified XK factory is LOCAL, not merely "not Serbian"
    // ...and nothing about the registration is deleted.
    expect(c.prefix).toBe('860');
    expect(c.isSerbiaPrefix).toBe(true);
    expect(c.registrationIso).toBe('RS');
    expect(c.registrationCountrySq).toBe('Serbi');
    expect(c.splitOrigin).toBe(true);
  });

  it('a verified factory moves the flag even when there was nothing to clear', () => {
    // Prefix 530 already read as LOCAL, so the clearing branch never ran and
    // the scan screen drew an Albanian flag while /eksploro drew a Kosovar
    // one. Same product, two screens, two countries.
    const c = productStance({ barcode: JAFFA_AL, brand: 'Jaffa', name: 'Jaffa Multivitamin 0.25L' }, data).classify;
    expect(c.iso).toBe('XK');
    expect(c.registrationIso).toBe('AL');
    expect(c.verdict).toBe(VERDICT.LOCAL); // was already LOCAL; the verdict did not move
    expect(c.prefix).toBe('530');
  });

  it('when a boycott stands, the flag stays with it — verdict and flag never disagree', () => {
    // With the flag moving independently of the verdict, a product whose
    // boycott hit survives would have rendered a greyed MACEDONIAN flag over
    // JO E JONA: the app accusing the wrong country out loud. Open Food
    // Facts reports this yogurt's brand as "Imlek", which is curated.
    const stance = productStance({ barcode: '8601500111207', brand: 'Imlek', name: 'Balans' }, data);
    expect(stance.flagged).toBe(true);
    expect(stance.classify.iso).toBe('RS');
    expect(stance.classify.splitOrigin).toBeUndefined();
  });

  it('the product the owner reported is no longer marked Serbian', () => {
    const before = classifyBarcode(FLUIDI_RS, gs1).verdict;
    expect(before).toBe(VERDICT.SERBIAN); // what a prefix-only read says

    const stance = productStance({ barcode: FLUIDI_RS, name: 'Fluidi Leng Fruta 200Ml' }, data);
    expect(stance.flagged).toBe(false);
    expect(stance.tone).toBe('normal');
    expect(stance.stanceIso).toBe('XK');
    expect(stance.splitOrigin).toBe(true);
    expect(stance.locallyOwned).toBe(true);
  });
});

describe('Jaffa Champion (Fluidi, Gjilan) is not Jaffa Crvenka (Crvenka, Serbia)', () => {
  it('the juice is cleared on every one of its three GS1 offices', () => {
    for (const [code, name] of [
      [JAFFA_AL, 'LENG JAFFA 0.25L MULTIVITAMIN  (27)'],
      [JAFFA_XK, 'Jaffa Champ. Orange 1.5L'],
      [JAFFA_RS, 'Jaffa Orange Pet 1.5Lt'],
    ]) {
      const stance = productStance({ barcode: code, brand: 'Jaffa', name }, data);
      expect(stance.flagged, name).toBe(false);
      expect(stance.stanceIso, name).toBe('XK');
      expect(stance.tone, name).toBe('normal');
    }
  });

  it('the Serbian biscuit keeps its boycott verdict — the name did not clear the company', () => {
    const stance = productStance({ barcode: CRVENKA, brand: 'Jaffa', name: 'Jaffa Cakes Orange 150g' }, data);
    expect(stance.flagged).toBe(true);
    expect(stance.boycott.brand).toBe('Jaffa Crvenka');
    expect(stance.homonym).toBeNull();
  });

  it('Munchmallow, the same company under another name, is untouched', () => {
    expect(productStance({ name: 'Munchmallow Family Pack 210g' }, data).flagged).toBe(true);
  });

  it('a barcode-less Jaffa juice resolves through Fluidi, not through the Serbian entry', () => {
    // 93% of retail rows carry no barcode, so this is the common case, and it
    // is the one where a bare "Jaffa" brand column used to decide everything.
    const stance = productStance({ brand: 'Jaffa', name: 'Jaffa Multivitamin 1.5 L', category: 'Pije' }, data);
    expect(stance.flagged).toBe(false);
    expect(stance.homonym.otherBrand).toBe('Jaffa Champion');
    expect(stance.stanceIso).toBe('XK');
  });

  it('a barcode-less Jaffa BISCUIT stays flagged', () => {
    const stance = productStance({ brand: 'Jaffa', name: 'Jaffa Cakes', category: 'CHOCOLATES & CAKES' }, data);
    expect(stance.flagged).toBe(true);
  });
});

describe('looksLikeDrink: a positive test, never an assumption', () => {
  it('reads a liquid volume in the title', () => {
    expect(looksLikeDrink({ name: 'Jaffa Multivitamin 1.5 L' })).toBe(true);
    expect(looksLikeDrink({ name: 'Jaffa Vishnje Kanaqe 0.25Ml' })).toBe(true);
  });

  it('reads the category when the title has no size', () => {
    expect(looksLikeDrink({ name: 'Jaffa Multivitamin', category: 'Pije' })).toBe(true);
    expect(looksLikeDrink({ name: 'Leng Jaffa Boronice', category: 'Lengje' })).toBe(true);
  });

  it('a weighed product is not a drink, whatever its category says', () => {
    expect(looksLikeDrink({ name: 'Jaffa Snack 27Gr', category: 'Pije' })).toBe(false);
    expect(looksLikeDrink({ name: 'Jaffa Sandwich Apricot 380Gr' })).toBe(false);
  });

  it('a cake is not a drink', () => {
    expect(looksLikeDrink({ name: 'Jaffa Cakes' })).toBe(false);
    expect(looksLikeDrink({ name: 'Jaffa Napolitanke' })).toBe(false);
    expect(looksLikeDrink({ name: 'Eurofood Jaffa Cakes Orange 125g' })).toBe(false);
  });

  it('an unknown row is not a drink — silence is not a clearance', () => {
    expect(looksLikeDrink({ name: 'Jaffa Euro Food' })).toBe(false);
    expect(looksLikeDrink(null)).toBe(false);
    expect(looksLikeDrink({})).toBe(false);
  });
});

// ===========================================================================
// THE ONE-WAY RULE, IN BOTH DIRECTIONS
// ===========================================================================
//
// originVerdict.test.js already asserts the Bimilk direction: a verified
// foreign production location does NOT clear a curated boycott hit. These are
// the mirror assertions — the homonym guard must not become a back door into
// that rule.
describe('the homonym guard cannot clear a real boycott', () => {
  it('never second-guesses an exact curated BARCODE hit', () => {
    // Chipsy on a Bosnian prefix: a per-product curated claim, so the guard
    // must refuse to look at it even if the row reads as a drink.
    const hit = { reason: 'barcode', brand: 'Jaffa Crvenka', matchedToken: 'jaffa' };
    expect(findBrandHomonym(hit, { name: 'Anything 1.5L' })).toBeNull();
    expect(productStance({ barcode: '3870508000157', brand: 'Chipsy' }, data).flagged).toBe(true);
  });

  it('only fires for a curated homonym, never for an arbitrary brand', () => {
    const hit = { reason: 'brand', brand: 'Bambi', matchedToken: 'plazma' };
    expect(findBrandHomonym(hit, { name: 'Plazma Drink 1L' })).toBeNull();
    expect(productStance({ barcode: '8600043000016', brand: 'Bambi' }, data).flagged).toBe(true);
  });

  it('only fires when the alias AND the boycotted brand both match the entry', () => {
    const wrongBrand = { reason: 'brand', brand: 'Somebody Else', matchedToken: 'jaffa' };
    expect(findBrandHomonym(wrongBrand, { name: 'Jaffa Orange 1.5L' })).toBeNull();
  });

  it('a hit with no product context stands', () => {
    const hit = { reason: 'brand', brand: 'Jaffa Crvenka', matchedToken: 'jaffa' };
    expect(findBrandHomonym(hit, null)).toBeNull();
  });

  it('Imlek and Bimilk are both still decided the way they were', () => {
    // Regression guard on findBrandMatch(): the exact-beats-contained change
    // must not have moved the precedent this file is modelled on.
    expect(productStance({ barcode: '8601500111207', name: 'JOGURT BIMILK 1L 1% BALANS', brand: 'Bimilk' }, data).flagged).toBe(false);
    expect(productStance({ barcode: '8601500110057', name: 'QUMESHT IMLEK 1L 3.2 %' }, data).flagged).toBe(true);
  });
});

describe('every homonym entry is source-cited, like every origin override', () => {
  it('names both producers, a source URL and a positive test', () => {
    expect(BRAND_HOMONYMS.length).toBeGreaterThan(0);
    for (const h of BRAND_HOMONYMS) {
      expect(h.alias, 'alias').toMatch(/^[a-z0-9 ]+$/);
      expect(h.boycottBrand, `${h.alias} boycottBrand`).toBeTruthy();
      expect(h.otherBrand, `${h.alias} otherBrand`).toBeTruthy();
      expect(h.sourceUrl, `${h.alias} sourceUrl`).toMatch(/^https?:\/\//);
      expect(String(h.note || '').length, `${h.alias} note`).toBeGreaterThan(30);
      expect(typeof h.applies, `${h.alias} applies`).toBe('function');
    }
  });

  it('the brand it redirects to exists in product-origins.json, verified', () => {
    for (const h of BRAND_HOMONYMS) {
      const entry = originsRaw.brands.find((b) => b.brand === h.otherBrand);
      expect(entry, `${h.otherBrand} in product-origins.json`).toBeTruthy();
      expect(entry.verified, `${h.otherBrand} verified`).toBe(true);
      expect(entry.productionCountry, `${h.otherBrand} productionCountry`).toBe(h.otherCountry);
    }
  });
});
