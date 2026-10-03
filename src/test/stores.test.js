import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  findStoresForChain,
  findStoresStockingProduct,
  isGenericStoreName,
  normalizeChainName,
  CLAIM_CHAIN,
  CLAIM_RETAILER,
  CLAIM_NONE,
} from '../lib/stores.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REAL_STORES = JSON.parse(
  readFileSync(resolve(HERE, '../../data/kosovo-stores.json'), 'utf8')
).stores;

const stores = [
  { chain: 'Viva Fresh Store', name: 'Viva Fresh Ulpiana', city: 'Prishtina' },
  { chain: 'Super Viva', name: 'Super Viva Fushe Kosove', city: 'Fushë Kosovë' },
  { chain: 'ETC', name: 'ETC Prizren', city: 'Prizren' },
  { chain: 'Ejona Market', name: 'Ejona Market', city: 'Prishtinë' },
  // The junk the owner saw: OSM points whose only name tag is a shop type.
  { chain: 'Market', name: 'Market', city: 'Gjilan', chainInferred: true },
  { chain: 'market', name: 'market', city: 'Gjilan', chainInferred: true },
];

describe('findStoresForChain — the source is what is consulted, nothing else', () => {
  it('resolves a chain domain to that chain group, and says so', () => {
    const result = findStoresForChain(stores, ['vivafresh.com', null]);
    expect(result.claim).toBe(CLAIM_CHAIN);
    expect(result.stores.map((s) => s.chain).sort()).toEqual(['Super Viva', 'Viva Fresh Store']);
  });

  it('resolves a marketplace venue to that ONE retailer, and says so', () => {
    const result = findStoresForChain(stores, ['wolt.com/ejona-market', 'Ejona Market (Wolt)']);
    expect(result.claim).toBe(CLAIM_RETAILER);
    expect(result.stores).toHaveLength(1);
    expect(result.stores[0].chain).toBe('Ejona Market');
  });

  it('answers "nowhere we can verify" rather than guessing', () => {
    for (const candidates of [[], [null, undefined], ['somecompletelyunrelatedstore.com']]) {
      const result = findStoresForChain(stores, candidates);
      expect(result.stores).toEqual([]);
      expect(result.evidence).toBe('none');
      expect(result.claim).toBe(CLAIM_NONE);
    }
  });

  it('never throws on a missing or empty store list', () => {
    expect(findStoresForChain(null, ['vivafresh.com']).stores).toEqual([]);
    expect(findStoresForChain([], ['vivafresh.com']).stores).toEqual([]);
    expect(findStoresForChain(stores, null).stores).toEqual([]);
  });

  it('IGNORES brand and company even when a call site passes them', () => {
    // ChoiceScreen.jsx calls with [source, sourceLabel, brand, company].
    // A product branded "Ejona" must not resolve to the Ejona Market shop.
    const result = findStoresForChain(stores, [null, null, 'Ejona', 'Ejona Market sh.p.k.']);
    expect(result.stores).toEqual([]);
    expect(result.claim).toBe(CLAIM_NONE);
  });
});

/**
 * THE OWNER'S REPORT, 2026-09-16, as a regression test.
 *
 *   "ku ta blesh afër / ky produkt shitet te: Broly's Market, Tiranë
 *    (Wolt Shqipëri)"  ->  "Market · 23 pika"  "market · 1 pika"
 *
 * Two independent faults in that one line, each pinned below.
 */
describe("the owner's \"Market · 23 pika\" report", () => {
  const brolys = {
    source: 'wolt.com/al/broly-s-market',
    sourceLabel: "Broly's Market, Tiranë (Wolt Shqipëri)",
  };

  it('a Tiranë listing resolves to no Kosovo shop at all', () => {
    const result = findStoresStockingProduct(REAL_STORES, brolys);
    expect(result.stores).toEqual([]);
    expect(result.claim).toBe(CLAIM_NONE);
  });

  it('the generic word "Market" is never returned as a chain, for any source', () => {
    const sources = [
      { source: 'wolt.com/ampm-market', sourceLabel: 'AMPM Market (Wolt)' },
      { source: 'wolt.com/market-piccolino', sourceLabel: 'Market Piccolino (Wolt)' },
      { source: 'wolt.com/maxi-supermarket', sourceLabel: 'Maxi Supermarket (Wolt)' },
      { source: 'super-viva.com', sourceLabel: 'Super Viva' },
      { source: 'etc-ks.com', sourceLabel: 'ETC' },
      brolys,
    ];
    for (const product of sources) {
      const result = findStoresStockingProduct(REAL_STORES, product);
      for (const chain of result.chains) expect(isGenericStoreName(chain)).toBe(false);
      for (const store of result.stores) {
        // Not even as a row: a shop whose only name is "market" cannot be
        // evidence that anything is stocked there.
        expect(isGenericStoreName(store.chain) && isGenericStoreName(store.name)).toBe(false);
      }
    }
  });

  it('"Market" and "market" fold to one key, so they can never be two chains', () => {
    expect(normalizeChainName('Market')).toBe(normalizeChainName('market'));
    expect(normalizeChainName('Viva Fresh Store')).toBe(normalizeChainName('viva-fresh  store'));
    // ë/ç are folded, not stripped: stripping made two spellings of one
    // chain look like two chains.
    expect(normalizeChainName('Kaçanik')).toBe('kacanik');
    expect(normalizeChainName('Prishtinë')).toBe('prishtine');
  });

  it('isGenericStoreName covers the shop types actually in the data', () => {
    for (const generic of ['Market', 'market', 'Mini Market', 'Minimarket', 'minimarket', 'Supermarket', 'Dyqan i pavarur', '', null]) {
      expect(isGenericStoreName(generic)).toBe(true);
    }
    for (const real of ['Super Viva', 'Ejona Market', 'Market Piccolino', 'ETC', 'Maxi Supermarket']) {
      expect(isGenericStoreName(real)).toBe(false);
    }
  });
});

/**
 * The property the panel rests on, checked against the real 1,210-row file
 * and every distinct catalogue source in the real product data: a shop is
 * only ever listed when its own whole name is the retailer that listed the
 * product, or it belongs to the chain whose catalogue the product is in.
 */
describe('no store is ever listed for a product it does not stock', () => {
  const CHAIN_GROUP_SOURCES = ['super-viva.com', 'vivafresh.com', 'etc-ks.com', 'spar-ks.com'];

  it('every returned shop is name-matched, never substring-matched', () => {
    const products = [
      { source: 'wolt.com/bonsai-asian-market', sourceLabel: 'Bonsai Asian Market (Wolt)' },
      { source: 'wolt.com/market-korabi-24h', sourceLabel: 'Market Korabi 24H (Wolt)' },
      { source: 'wolt.com/market-onio', sourceLabel: 'Market Onio (Wolt)' },
      { source: 'wolt.com/big-market', sourceLabel: 'Big Market (Wolt)' },
    ];
    for (const product of products) {
      const result = findStoresStockingProduct(REAL_STORES, product);
      const venue = normalizeChainName(product.sourceLabel.replace(/\s*\([^)]*\)\s*$/, ''));
      for (const store of result.stores) {
        const matched =
          normalizeChainName(store.chain) === venue || normalizeChainName(store.name) === venue;
        expect(matched, `${store.chain} / ${store.name} for ${product.sourceLabel}`).toBe(true);
      }
    }
  });

  it('the old substring rule\'s false positives are all gone', () => {
    // Each of these was really produced by the previous implementation.
    const falsePositives = [
      ['Bonsai Asian Market (Wolt)', 'Aias'],
      ['Market Korabi 24H (Wolt)', 'ABI'],
      ['Market Onio (Wolt)', 'Toni'],
      ['Big Market, Tiranë (Wolt Shqipëri)', 'Albi'],
      ['HIB MARKET HAJVALIA 24H (Wolt)', 'Alia'],
      ['Market Bulmetore Edi, Tiranë (Wolt Shqipëri)', 'Diti'],
    ];
    for (const [label, wrongChain] of falsePositives) {
      const result = findStoresStockingProduct(REAL_STORES, { source: 'wolt.com/x', sourceLabel: label });
      expect(result.chains, label).not.toContain(wrongChain);
    }
  });

  it('a chain-catalogue source names only that chain group', () => {
    for (const source of CHAIN_GROUP_SOURCES) {
      const result = findStoresStockingProduct(REAL_STORES, { source });
      if (result.stores.length === 0) continue;
      expect(result.claim).toBe(CLAIM_CHAIN);
      for (const chain of result.chains) {
        expect(normalizeChainName(chain)).toMatch(/viva|etc|spar/);
      }
    }
  });
});
