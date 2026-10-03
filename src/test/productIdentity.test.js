import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  PRODUCT_IDENTITIES,
  IDENTIFIED_BUT_UNANSWERABLE,
  identityFamilyOf,
  identityEntryOf,
} from '../lib/productIdentity.js';
import { exactFamilyOf, witnessFamilyOf } from '../lib/exactMatch.js';
import { FAMILY_TERM_IDS } from '../lib/liveAlternatives.js';

// Owner, 2026-09-19: "gjeji me shume alternativa".
//
// 97 of the 294 Serbian products on /alternativa could not be identified
// at all, because both witnesses were mute: the shelf was a catch-all
// ("Ushqimore"), a compound, or plain wrong (a bag of crisps filed under
// "Ice Tea"), and the title was a BRAND, which leadFamilyOf() — which
// reads only the first word — cannot use.
//
// The identity table fixes that, and these tests exist to keep it from
// becoming a back door. The single most important property is DIRECTION:
// it may only speak where the witnesses were silent.

describe('the identity table can only ever add', () => {
  it('is never consulted when the two witnesses already agree', () => {
    // A row both witnesses resolve. Its answer must come from them, and
    // must be unchanged by anything in the identity table.
    const row = { name: 'Vipa Chips Ketchup 40 Gr', category: 'Chips' };
    expect(witnessFamilyOf(row)).toBe('crisps');
    expect(exactFamilyOf(row)).toBe(witnessFamilyOf(row));
  });

  it('only speaks where the witnesses were silent', () => {
    const row = { name: 'Clipsy Sweet Chilli', category: 'CHIPS & FLIPS' };
    expect(witnessFamilyOf(row)).toBeNull();
    expect(exactFamilyOf(row)).toBe('crisps');
  });

  it('NEVER contradicts a family the witnesses do resolve', () => {
    // A contradiction means either an entry or the taxonomy is wrong, and
    // both are worth failing a build over. This is the assertion that
    // would have caught a careless entry like /\bmilk\b/ -> milk.
    const rows = [
      { name: 'Vipa Chips Ketchup 40 Gr', category: 'Chips' },
      { name: 'Uje Rugove 0.33L', category: 'Ujë' },
      { name: 'Minella Biscuit 150G', category: 'Biskota' },
      { name: 'Kikirik Me Varse 40Gr', category: 'Njelmeta' },
      { name: 'SENF 550 gr', category: 'Ereza & Salca' },
      { name: 'Fresh Zbutes Rose 1L', category: 'Detergjent' },
    ];
    for (const row of rows) {
      const witnessed = witnessFamilyOf(row);
      const identity = identityFamilyOf(row);
      if (witnessed && identity) expect(identity).toBe(witnessed);
    }
  });
});

describe('every entry is usable and documented', () => {
  it('names a family the rest of the app actually knows', () => {
    // The taxonomy has drifted four times, every time producing a wrong
    // answer. An entry pointing at a family that does not exist would be
    // a silent dead end.
    for (const entry of PRODUCT_IDENTITIES) {
      expect(FAMILY_TERM_IDS.has(entry.family), `unknown family: ${entry.family}`).toBe(true);
    }
  });

  it('carries a note and a real local example for every entry', () => {
    for (const entry of PRODUCT_IDENTITIES) {
      expect(entry.note.length, `empty note on ${entry.re}`).toBeGreaterThan(20);
      expect(entry.localExample.length, `empty example on ${entry.re}`).toBeGreaterThan(3);
    }
  });

  it('names local examples that are STILL IN the Kosovo catalogue', () => {
    // "this family has an answer" is a checked claim, not an assumption.
    // If the catalogue stops carrying one of these, this says so rather
    // than the screen quietly going empty.
    const file = path.join(process.cwd(), 'data', 'kosovo-retail.json');
    if (!fs.existsSync(file)) return; // the pruned build does not ship it
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    const names = new Set(
      (raw.products || []).map((p) => String(p.name || '').trim().toLowerCase())
    );
    const missing = PRODUCT_IDENTITIES.map((e) => e.localExample).filter(
      (n) => !names.has(n.trim().toLowerCase())
    );
    expect(missing, `local examples no longer in the catalogue: ${missing.join(', ')}`).toEqual([]);
  });

  it('refuses rather than guessing when two entries disagree', () => {
    // A silent tie-break on source order is how a wrong answer survives.
    // No title in the catalogue should hit two families, but the guard
    // is what makes that safe to assume.
    expect(identityFamilyOf({ name: 'nothing matches this at all' })).toBeNull();
    expect(identityFamilyOf(null)).toBeNull();
    expect(identityFamilyOf({ name: '' })).toBeNull();
  });
});

describe('the rows this was built for', () => {
  const cases = [
    ['Clipsy Sweet Chilli', 'crisps'],
    ['Marbo Chipsy Cut Salted', 'crisps'],
    ['Clipsy Max Sweet Chilli', 'crisps'],
    ['Doritos Bbq 100Gr', 'crisps'],
    ['Smoki Stark 130gr', 'savoury-snacks'],
    ['Smoki', 'savoury-snacks'],
    ['Trik Shkopinjë 200g', 'savoury-snacks'],
    ['Banini Trik Mix 300Gr', 'savoury-snacks'],
    ['Shtapiq Pardon', 'savoury-snacks'],
    ['Pardon Kikiriki', 'savoury-snacks'],
    ['Gud Kikirik 40Gr', 'nuts-seeds'],
    ['Gud Peanut Fried Salted 30X80Gr', 'nuts-seeds'],
    ['Plazma Keks 150g', 'biscuits'],
    ['Veget Moravka 250G', 'spices-seasonings'],
    ['POLIMARK SENF FINI 550g', 'mustard'],
    ['Prolom Voda 1.5L', 'waters'],
    ['Rc Bitter Lemon 0.5L', 'soft-drinks'],
    ['DUEL ZBUTESE SOFT LOTUES', 'fabric-softener'],
  ];
  it.each(cases)('%s -> %s', (name, family) => {
    expect(identityFamilyOf({ name })).toBe(family);
  });

  it('folds diacritics and case the way the catalogue spells things', () => {
    // "Shkopinjë" folds to "shkopinje"; a closing \b on the stem made it
    // match nothing at all, and the fix is pinned here.
    expect(identityFamilyOf({ name: 'Trik Shkopinjë  95g' })).toBe('savoury-snacks');
    expect(identityFamilyOf({ name: 'TRIK SHKOPINJE 200G' })).toBe('savoury-snacks');
  });

  it('explains itself, so the screen can say why', () => {
    const entry = identityEntryOf({ name: 'Smoki Stark 130gr' });
    expect(entry?.note).toContain('Štark');
    expect(entry?.family).toBe('savoury-snacks');
  });
});

describe('what it deliberately refuses', () => {
  it('leaves Munchmallow, Jaffa Cakes and Pionir UNIDENTIFIED', () => {
    // These are identified with certainty and still left out: the only
    // local family with stock is cakes-pastry, and every row in it is a
    // Belino croissant. A marshmallow teacake answered with a cream
    // croissant is the waffle-for-a-biscuit swap this screen exists to
    // refuse. They stay open cases.
    for (const name of [
      'Munchmallow Family Pack 210G',
      'Jaffa Sandwich Apricot 380Gr',
      'Pionir Zemer Me Mjalte 150G',
      'Krem Gatim Dijamant 250G Classic Yndyre Bimore',
      'Faculet Letre Mint',
    ]) {
      expect(identityFamilyOf({ name }), `${name} must stay an open case`).toBeNull();
    }
  });

  it('keeps the refusals written down rather than in a comment', () => {
    expect(IDENTIFIED_BUT_UNANSWERABLE.length).toBeGreaterThan(5);
    for (const row of IDENTIFIED_BUT_UNANSWERABLE) {
      expect(row.what.length).toBeGreaterThan(8);
      expect(row.why.length).toBeGreaterThan(15);
    }
  });

  it('matches only the Duel SOFTENER, never the washing powder', () => {
    // Kosovo has no proven-local laundry detergent, so offering a
    // softener for a detergent would be the wrong purchase, not a
    // cheaper one.
    expect(identityFamilyOf({ name: 'DUEL ZBUTESE SOFT LOTUES' })).toBe('fabric-softener');
    expect(identityFamilyOf({ name: 'Duel Ultra Fresh 2.7Kg Lemon (6)' })).toBeNull();
    expect(identityFamilyOf({ name: 'Duel detergjent gel universal 2.45L' })).toBeNull();
  });
});
