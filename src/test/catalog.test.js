import { describe, it, expect } from 'vitest';
import { fallbackPoolToCatalogItems, buildCategoryOptions, matchesQuery } from '../lib/catalog.js';

const gs1Table = {
  ranges: [
    { min: 860, max: 860, country: 'Serbia', isSerbia: true, isLocal: false },
    { min: 381, max: 381, country: 'Kosovo', isSerbia: false, isLocal: true },
  ],
};

describe('fallbackPoolToCatalogItems — used only when kosovo-retail.json is absent/empty', () => {
  it('only marks isLocalBrand true when the product\'s OWN barcode prefix is genuinely local', () => {
    const localProducts = {
      products: [
        { code: '3811234567890', name: 'Ujë Rugova', brand: 'Rugove', categoriesTags: ['en:waters'], image: null, country: 'kosovo' },
        { code: '8600043000016', name: 'Imported/Serbian-registered', brand: 'Bambi', categoriesTags: ['en:biscuits'], image: null, country: 'kosovo' },
      ],
    };
    const items = fallbackPoolToCatalogItems(localProducts, gs1Table);
    const local = items.find((i) => i.id === '3811234567890');
    const notLocal = items.find((i) => i.id === '8600043000016');
    expect(local.isLocalBrand).toBe(true);
    // Merely "sold in Kosovo" (per the OFF-derived pool) must NEVER be badged
    // local just because it's in this fallback pool — the exact bug this
    // project already had to fix once for the alternatives grid.
    expect(notLocal.isLocalBrand).toBe(false);
  });

  it('humanizes the most-specific OFF category tag into a readable category label', () => {
    const localProducts = {
      products: [{ code: '3811234567890', name: 'X', brand: 'Y', categoriesTags: ['en:snacks', 'en:biscuits-and-crackers'], image: null }],
    };
    const items = fallbackPoolToCatalogItems(localProducts, gs1Table);
    expect(items[0].category).toBe('Biscuits and crackers');
  });

  it('returns [] for a missing/empty pool without throwing', () => {
    expect(fallbackPoolToCatalogItems(null, gs1Table)).toEqual([]);
    expect(fallbackPoolToCatalogItems({ products: [] }, gs1Table)).toEqual([]);
  });
});

describe('buildCategoryOptions', () => {
  it('lists distinct categories, most-common first, ignoring items with no category', () => {
    const items = [{ category: 'Dairy' }, { category: 'Dairy' }, { category: 'Water' }, { category: null }];
    expect(buildCategoryOptions(items)).toEqual(['Dairy', 'Water']);
  });
});

describe('matchesQuery', () => {
  const item = { name: 'Ujë Rugova', brand: 'Rugove', category: 'Water' };

  it('matches on name, brand, or category, case-insensitively', () => {
    expect(matchesQuery(item, 'rugova')).toBe(true);
    expect(matchesQuery(item, 'RUGOVE')).toBe(true);
    expect(matchesQuery(item, 'water')).toBe(true);
  });

  it('returns true for an empty/blank query (no filtering)', () => {
    expect(matchesQuery(item, '')).toBe(true);
    expect(matchesQuery(item, '   ')).toBe(true);
  });

  it('returns false when nothing matches', () => {
    expect(matchesQuery(item, 'nonexistent-brand-xyz')).toBe(false);
  });
});
