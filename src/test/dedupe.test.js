import { describe, it, expect } from 'vitest';
import { productDedupeKey, dedupeCheapest, collapseSameProduct } from '../lib/retailCategories.js';

// Owner, 2026-09-17: "10 times same product try to remove dupes".
//
// One Coca-Cola 2L produced FIVE dedupe keys in the shipped catalogue. These
// tests pin each cause, and — more importantly — pin the guards, because the
// first version of the merge would have badged Coca-Cola as VENDORE.

describe('productDedupeKey', () => {
  it('normalises the brand the same way as the name', () => {
    // The original bug: the name was punctuation-stripped and the brand was
    // not, so "Coca Cola" and "Coca-Cola" were two different products.
    const a = { name: 'Coca Cola 2l', brand: 'Coca Cola' };
    const b = { name: 'Coca Cola 2l', brand: 'Coca-Cola' };
    expect(productDedupeKey(a)).toBe(productDedupeKey(b));
  });

  it('folds diacritics in both halves', () => {
    expect(productDedupeKey({ name: 'Bukë Malësie', brand: 'Bukë' })).toBe(
      productDedupeKey({ name: 'Buke Malesie', brand: 'Buke' })
    );
  });

  it('still prefers the barcode when there is one', () => {
    expect(productDedupeKey({ barcode: '5449000000286', name: 'whatever' })).toBe('b:5449000000286');
  });
});

describe('collapseSameProduct', () => {
  it('folds an unbranded listing into its branded twin', () => {
    const out = collapseSameProduct([
      { name: 'Coca Cola 2l', brand: null, price: 1.69, sourceLabel: 'A' },
      { name: 'Coca Cola 2l', brand: 'Coca Cola', price: 1.35, sourceLabel: 'B' },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].price).toBe(1.35); // cheapest survives
    expect(out[0].brand).toBe('Coca Cola'); // identity is not lost
  });

  it('merges two different GTINs for one product and keeps a barcode', () => {
    const out = collapseSameProduct([
      { name: 'Coca Cola 2l', brand: 'Coca Cola', barcode: '5449000000286', price: 1.69 },
      { name: 'Coca Cola 2l', brand: 'Coca Cola', barcode: '5000112562200', price: 1.55 },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].barcode).toBeTruthy();
  });

  it('REFUSES to merge when two different brands share a product name', () => {
    // A visible duplicate is cosmetic. Merging two producers' products is a
    // wrong answer, so the guard keeps them apart.
    const out = collapseSameProduct([
      { name: 'Jogurt 500g', brand: 'Vita', price: 0.6 },
      { name: 'Jogurt 500g', brand: 'Ajka', price: 0.55 },
    ]);
    expect(out).toHaveLength(2);
  });

  it('NEVER inherits isLocalBrand: true from a disagreeing group', () => {
    // THE BUG THIS EXISTS FOR. Measured in the real catalogue:
    //   "coca cola zero 1,25l" -> true / false
    //   "fanta orange 1,25l"   -> true / false
    // The cheapest row happened to carry `true`. Merging optimistically
    // would have put a VENDORE badge on Coca-Cola.
    const out = collapseSameProduct([
      { name: 'Coca Cola Zero 1,25l', brand: 'Coca Cola', price: 0.89, isLocalBrand: true, localEvidence: 'bogus' },
      { name: 'Coca Cola Zero 1,25l', brand: 'Coca Cola', price: 1.1, isLocalBrand: false, localEvidence: 'GS1 prefix 544' },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].isLocalBrand).toBe(false);
  });

  it('only keeps true when every opinion in the group says true', () => {
    const out = collapseSameProduct([
      { name: 'Liri Biskota 230g', brand: 'Liri', price: 1.8, isLocalBrand: true, localEvidence: 'GS1 prefix 390' },
      { name: 'Liri Biskota 230g', brand: 'Liri', price: 1.9, isLocalBrand: true, localEvidence: 'GS1 prefix 390' },
    ]);
    expect(out[0].isLocalBrand).toBe(true);
    expect(out[0].localEvidence).toContain('390');
  });

  it('degrades to null rather than guessing when nobody has an opinion', () => {
    const out = collapseSameProduct([
      { name: 'Mystery 1kg', brand: 'X', price: 2, isLocalBrand: null },
      { name: 'Mystery 1kg', brand: 'X', price: 3, isLocalBrand: undefined },
    ]);
    expect(out[0].isLocalBrand).toBeNull();
  });

  it('keeps the evidence string consistent with the value it justifies', () => {
    // A row must never read "GS1 prefix 390 (Kosovo)" beside isLocalBrand: false.
    const out = collapseSameProduct([
      { name: 'Thing 1l', brand: 'T', price: 1, isLocalBrand: true, localEvidence: 'prefix 390 Kosovo' },
      { name: 'Thing 1l', brand: 'T', price: 2, isLocalBrand: false, localEvidence: 'prefix 544 imported' },
    ]);
    expect(out[0].isLocalBrand).toBe(false);
    expect(out[0].localEvidence).toBe('prefix 544 imported');
  });

  it('prefers the most specific shelf over the cheapest row.s shelf', () => {
    // 834 groups disagree on category; the catch-all "Të freskëta" can
    // strand a product on a shelf that resolves to no family.
    const out = collapseSameProduct([
      { name: 'Djath Sharri 800gr', brand: 'Sharri', price: 5.99, category: 'TE FRESKETA' },
      { name: 'Djath Sharri 800gr', brand: 'Sharri', price: 6.49, category: 'BYLMET/QUMESHT' },
    ]);
    expect(out[0].price).toBe(5.99);
    expect(out[0].category).toBe('BYLMET/QUMESHT');
  });

  it('records every shop the product was seen in', () => {
    const out = collapseSameProduct([
      { name: 'Uje 1.5l', brand: 'U', price: 0.4, sourceLabel: 'Shop A' },
      { name: 'Uje 1.5l', brand: 'U', price: 0.5, sourceLabel: 'Shop B' },
      { name: 'Uje 1.5l', brand: 'U', price: 0.6, sourceLabel: 'Shop C' },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].alsoAt).toEqual(expect.arrayContaining(['Shop B', 'Shop C']));
    expect(out[0].alsoAt).not.toContain('Shop A'); // the kept row is not "also at" itself
  });
});

describe('dedupeCheapest end to end', () => {
  it('leaves no repeated product name behind', () => {
    const rows = [
      { name: 'Coca Cola 2l', brand: 'Coca Cola', price: 1.35, sourceLabel: 'A' },
      { name: 'Coca Cola 2l', brand: 'Coca-Cola', price: 1.69, sourceLabel: 'B' },
      { name: 'Coca Cola 2l', brand: null, price: 1.69, sourceLabel: 'C' },
      { name: 'Coca Cola 2l', brand: 'Coca-Cola', barcode: '5449000000286', price: 1.69, sourceLabel: 'D' },
      { name: 'Coca Cola 2l', brand: 'Coca-Cola', barcode: '5000112562200', price: 1.55, sourceLabel: 'E' },
    ];
    const out = dedupeCheapest(rows);
    expect(out).toHaveLength(1);
    expect(out[0].price).toBe(1.35);
  });

  it('does not merge different sizes of the same product', () => {
    const out = dedupeCheapest([
      { name: 'Coca Cola 2l', brand: 'Coca Cola', price: 1.35 },
      { name: 'Coca Cola 1.25l', brand: 'Coca Cola', price: 0.99 },
    ]);
    expect(out).toHaveLength(2);
  });
});
