import { describe, it, expect } from 'vitest';
import { findStoresStockingProduct, sellsGroceries } from '../lib/stores.js';

/**
 * Test suite for the new findStoresStockingProduct function.
 * Tests cover:
 * 1. Resolution via the explicit alias map (exact source matching)
 * 2. Honest 'none' evidence when source doesn't resolve
 * 3. Protection against brand-name leakage (the critical bug fix)
 * 4. Returning ALL stores, not a truncated sample
 */

describe('findStoresStockingProduct', () => {
  // Sample store data representing real Kosovo chains
  const mockStores = [
    // Super Viva — 5 stores for testing (real data has 26)
    {
      chain: 'Super Viva',
      name: 'Super Viva 1',
      city: 'Prishtina',
      address: 'Nëna Tereza',
      lat: 42.6629,
      lng: 21.1575,
      hours: '08:00-20:00',
      phone: '+38348900001',
    },
    {
      chain: 'Super Viva',
      name: 'Super Viva 2',
      city: 'Prishtina',
      address: 'Bill Clinton',
      lat: 42.6525,
      lng: 21.1536,
      hours: '08:00-20:00',
      phone: '+38348900002',
    },
    {
      chain: 'Super Viva',
      name: 'Super Viva 3',
      city: 'Ferizaj',
      address: 'Rruga e Madhe',
      lat: 42.3676,
      lng: 21.1536,
      hours: '08:00-19:00',
      phone: '+38348900003',
    },
    {
      chain: 'Super Viva',
      name: 'Super Viva 4',
      city: 'Ferizaj',
      address: 'Fushë Kosovë',
      lat: 42.3622,
      lng: 21.1617,
      hours: '08:00-19:00',
      phone: '+38348900004',
    },
    {
      chain: 'Super Viva',
      name: 'Super Viva 5',
      city: 'Gjakova',
      address: 'Xhep Luka',
      lat: 42.4306,
      lng: 20.4378,
      hours: '08:00-20:00',
      phone: '+38348900005',
    },

    // Viva Fresh Store — 3 stores for testing (real data has 111)
    {
      chain: 'Viva Fresh Store',
      name: 'Viva Fresh 1',
      city: 'Prishtina',
      address: 'Sheshi Adem Jashari',
      lat: 42.666,
      lng: 21.159,
      hours: '08:00-22:00',
      phone: '+38348900101',
    },
    {
      chain: 'Viva Fresh Store',
      name: 'Viva Fresh 2',
      city: 'Prishtina',
      address: 'Qendra e Prishtinës',
      lat: 42.6629,
      lng: 21.1575,
      hours: '08:00-22:00',
      phone: '+38348900102',
    },
    {
      chain: 'Viva Fresh Store',
      name: 'Viva Fresh 3',
      city: 'Peja',
      address: 'Rruga Nuçe',
      lat: 42.662,
      lng: 20.296,
      hours: '08:00-21:00',
      phone: '+38348900103',
    },

    // Albi Market — 2 stores for testing (real data has 37 + 4 hipermarket)
    {
      chain: 'Albi Market',
      name: 'Albi Market 1',
      city: 'Prishtina',
      address: 'Ulpiana',
      lat: 42.6525,
      lng: 21.1687,
      hours: '08:00-21:00',
      phone: '+38348900201',
    },
    {
      chain: 'Albi Market',
      name: 'Albi Market 2',
      city: 'Prizren',
      address: 'Rruga Kaçanik',
      lat: 42.2137,
      lng: 20.7391,
      hours: '08:00-21:00',
      phone: '+38348900202',
    },
  ];

  it('returns ALL stores matching the product source, sorted by city then name', () => {
    const product = { source: 'super-viva.com', sourceLabel: 'Super Viva' };
    const result = findStoresStockingProduct(mockStores, product);

    expect(result).toMatchObject({
      stores: expect.any(Array),
      evidence: 'catalogue',
      evidence: 'catalogue',
    });

    // A catalogue source resolves to the whole CHAIN GROUP, so super-viva.com
    // matches every Viva spelling in the data — 5 "Super Viva" + 3 "Viva Fresh
    // Store" in this fixture. Owner, 2026-09-12: "viva chain not only show only
    // places you sourced it from so all stores."
    expect(result.stores).toHaveLength(8);

    // Verify every store belongs to the Viva group
    result.stores.forEach((store) => {
      expect(['Super Viva', 'Viva Fresh Store']).toContain(store.chain);
    });

    // Verify sorting: city first, then name
    const cities = result.stores.map((s) => s.city || '');
    expect([...cities].sort((a, b) => a.localeCompare(b))).toEqual(cities);
  });

  it('returns evidence "none" when product source does not resolve to a chain', () => {
    const product = {
      source: 'gjirafamall.com', // Not in the alias map
      sourceLabel: 'GjirafaMall',
    };
    const result = findStoresStockingProduct(mockStores, product);

    expect(result).toMatchObject({
      stores: [],
      chains: [],
      evidence: 'none',
    });
  });

  it('returns evidence "none" when product has no source', () => {
    const product = { name: 'Some Product', brand: 'Some Brand' };
    const result = findStoresStockingProduct(mockStores, product);

    expect(result).toMatchObject({
      stores: [],
      chains: [],
      evidence: 'none',
    });
  });

  it('CRITICAL: does NOT match when brand coincides with chain name (prevents brand-leakage bug)', () => {
    // This is the critical test that proves the bug is fixed.
    // A product with brand "Albi" should NOT be matched to "Albi Market" stores
    // because brand is never consulted.
    const product = {
      source: null, // No source → no match
      sourceLabel: null,
      brand: 'Albi', // Brand name coincides with "Albi Market" chain
      company: 'Albi Company',
    };
    const result = findStoresStockingProduct(mockStores, product);

    expect(result).toMatchObject({
      stores: [],
      chains: [],
      evidence: 'none',
    });

    // Explicitly verify no Albi Market stores are included
    expect(result.stores.every((s) => s.chain !== 'Albi Market')).toBe(true);
  });

  it('returns multiple stores when a product appears in a chain with many locations', () => {
    const product = { source: 'super-viva.com' };
    const result = findStoresStockingProduct(mockStores, product);

    // Whole Viva group, not just the literal "Super Viva" spelling.
    expect(result.stores).toHaveLength(8);
    expect(result.evidence).toBe('catalogue');
  });

  it('handles empty store list gracefully', () => {
    const product = { source: 'super-viva.com' };
    const result = findStoresStockingProduct([], product);

    expect(result).toMatchObject({
      stores: [],
      chains: [],
      evidence: 'none',
    });
  });

  it('handles null or undefined product gracefully', () => {
    // `claim` says WHICH of the three defensible answers this is; 'none'
    // is one of them and the panel prints it in words.
    const nothing = { stores: [], chains: [], evidence: 'none', claim: 'none', sourceLabel: null };
    expect(findStoresStockingProduct(mockStores, null)).toEqual(nothing);
    expect(findStoresStockingProduct(mockStores, undefined)).toEqual(nothing);
  });

  it('handles null stores gracefully', () => {
    const product = { source: 'super-viva.com' };
    expect(findStoresStockingProduct(null, product)).toEqual({
      stores: [],
      chains: [],
      evidence: 'none',
      claim: 'none',
      sourceLabel: null,
    });
  });

  it('uses case-insensitive source matching', () => {
    // Test that source matching is case-insensitive
    const product = { source: 'SUPER-VIVA.COM' };
    const result = findStoresStockingProduct(mockStores, product);

    expect(result.stores).toHaveLength(8);
    expect(result.evidence).toBe('catalogue');
  });

  it('returns correct count per chain in real-world scenario', () => {
    // Simulating different products from different sources
    const superVivaProduct = { source: 'super-viva.com' };
    // viva-fresh.com now maps to the same Viva group (2026-09-12) — both
    // domains belong to one chain, so both must surface all its branches.
    const vivaFreshProduct = { source: 'viva-fresh.com' };
    // A domain that belongs to no chain we know still resolves to nothing.
    const unknownProduct = { source: 'not-a-real-shop.example' };

    const superVivaResult = findStoresStockingProduct(mockStores, superVivaProduct);
    const vivaFreshResult = findStoresStockingProduct(mockStores, vivaFreshProduct);
    const unknownResult = findStoresStockingProduct(mockStores, unknownProduct);

    expect(superVivaResult.stores).toHaveLength(8); // The whole Viva group, all spellings
    expect(vivaFreshResult.stores).toHaveLength(8); // Same group, same branches
    expect(unknownResult.stores).toHaveLength(0);
    expect(unknownResult.evidence).toBe('none');
  });

  it('a venue label alone names ONLY that retailer, never the chain group', () => {
    // Most of the catalogue is marketplace listings, one venue at a time
    // ("Super Viva (Wolt)"), and CHAIN_GROUPS knows nothing about them.
    // Those resolve by WHOLE NAME to the named retailer's own locations —
    // the narrow claim — and never expand to a group the way a chain's own
    // catalogue domain does.
    const result = findStoresStockingProduct(mockStores, {
      source: null,
      sourceLabel: 'Super Viva (Wolt)',
    });

    expect(result.claim).toBe('retailer-listing');
    expect(result.stores).toHaveLength(5); // the 5 "Super Viva" rows only
    expect(result.stores.every((s) => s.chain === 'Super Viva')).toBe(true);
    // NOT the 3 "Viva Fresh Store" rows: nothing in a Wolt venue listing
    // says anything about a sibling brand's branches.
    expect(result.chains).toEqual(['Super Viva']);
  });

  it('a generic word is never a chain, never a match, never a heading', () => {
    const junk = [
      { chain: 'Market', name: 'Market', city: 'Gjilan', chainInferred: true },
      { chain: 'market', name: 'market', city: 'Gjilan', chainInferred: true },
      { chain: 'Mini Market', name: 'Mini Market', city: 'Prishtinë', chainInferred: true },
      { chain: 'Supermarket', name: 'Supermarket', city: 'Graçanicë', chainInferred: true },
    ];
    for (const label of ['AMPM Market (Wolt)', 'Market Piccolino (Wolt)', 'Maxi Supermarket (Wolt)']) {
      const result = findStoresStockingProduct(junk, { source: 'wolt.com/x', sourceLabel: label });
      expect(result.stores, label).toEqual([]);
      expect(result.claim).toBe('none');
    }
    // And a product whose venue IS literally the generic word resolves to
    // nothing rather than to all 33 unnamed corner shops.
    expect(
      findStoresStockingProduct(junk, { source: 'wolt.com/market', sourceLabel: 'Market (Wolt)' }).stores
    ).toEqual([]);
  });

  it('an Albanian listing is never Kosovo availability', () => {
    // dataLoader already refuses these at load; this is the
    // second lock. A Tiranë shop is not somewhere a Prishtina shopper can
    // go, and its Lek prices were mislabelled EUR.
    for (const product of [
      { source: 'wolt.com/al/broly-s-market', sourceLabel: "Broly's Market, Tiranë (Wolt Shqipëri)" },
      { source: 'wolt.com/al/big-market', sourceLabel: 'Big Market, Tiranë (Wolt Shqipëri)' },
      // even if it somehow carried a chain domain we DO map
      { source: 'super-viva.com', sourceLabel: 'Super Viva, Tiranë (Wolt Shqipëri)' },
    ]) {
      const result = findStoresStockingProduct(mockStores, product);
      expect(result.stores, product.sourceLabel).toEqual([]);
      expect(result.claim).toBe('none');
    }
  });
});

/**
 * The owner's 2026-09-16 Google Maps paste added venues as well as shops:
 * Central Park, Prishtina Mall, Albi Mall and Royal Mall are shopping malls,
 * Jumbo is a department store. "You can buy this yoghurt at Prishtina Mall"
 * is not an answer — the mall sells nothing; its tenants do.
 */
describe('non-grocery venues never answer "where can I buy this"', () => {
  const mall = {
    chain: 'Super Viva', // deliberately a grocery chain name, to prove the
    name: 'Some Mall',   // type is what excludes it, not the chain label
    city: 'Prishtinë',
    storeType: 'shopping-mall',
    sellsGroceries: false,
  };
  const shop = { chain: 'Super Viva', name: 'Super Viva 1', city: 'Prishtinë', storeType: 'supermarket', sellsGroceries: true };
  const osmRow = { chain: 'Super Viva', name: 'Super Viva 2', city: 'Prishtinë' }; // no type at all

  it('excludes a shopping mall even when it carries a stocked chain name', () => {
    const result = findStoresStockingProduct([mall, shop], { source: 'super-viva.com' });
    expect(result.stores).toHaveLength(1);
    expect(result.stores[0].name).toBe('Super Viva 1');
  });

  it('excludes a department store the same way', () => {
    const dept = { ...mall, name: 'Jumbo', storeType: 'department-store', sellsGroceries: false };
    expect(findStoresStockingProduct([dept], { source: 'super-viva.com' }).stores).toHaveLength(0);
  });

  it('treats an untyped OSM row as unknown, not as excluded', () => {
    // 1,200 rows have no storeType. Absent must never mean "filtered out".
    const result = findStoresStockingProduct([osmRow], { source: 'super-viva.com' });
    expect(result.stores).toHaveLength(1);
    expect(sellsGroceries(osmRow)).toBe(true);
  });

  it('sellsGroceries: only an explicit false or a non-grocery type excludes', () => {
    expect(sellsGroceries({ storeType: 'supermarket' })).toBe(true);
    expect(sellsGroceries({ storeType: 'grocery-store' })).toBe(true);
    expect(sellsGroceries({ storeType: 'market' })).toBe(true);
    expect(sellsGroceries({ storeType: 'store' })).toBe(true); // Google's vaguest label — unknown, kept
    expect(sellsGroceries({ storeType: 'shopping-mall' })).toBe(false);
    expect(sellsGroceries({ storeType: 'department-store' })).toBe(false);
    expect(sellsGroceries({ sellsGroceries: false })).toBe(false);
    expect(sellsGroceries({})).toBe(true);
    expect(sellsGroceries(null)).toBe(false);
  });
});
