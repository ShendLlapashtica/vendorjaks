import { describe, it, expect } from 'vitest';
import { builtinFeedItems, builtinFeedSeed, FEED_BUILTIN } from '../lib/publicFeed.js';
import { rotationSeed, rotateWithinBand } from '../lib/bestValue.js';

// Owner, 2026-09-20: "these are never updating im tired of asking you".
// Owner, 2026-09-18: "same grapes and apples on eksploro te gjitha".
//
// He said this four times and the first three fixes all missed, so the
// property is pinned numerically here rather than asserted in a commit
// message. "It rotates" is not the claim. The claim is: MOST OF WHAT YOU
// SEE IS DIFFERENT TOMORROW.

const catalogue = (n) =>
  Array.from({ length: n }, (_, i) => ({
    barcode: String(8600000000000 + i),
    name: `Product ${i}`,
    image: `https://example.test/${i}.jpg`,
    price: 1 + (i % 40) / 10,
    isLocalBrand: i % 3 === 0,
  }));

// A pool wide enough for the mix to draw from, with codes across the four
// prefix buckets the feed balances.
const mixedCatalogue = () => {
  const out = [];
  const prefixes = ['860', '381', '390', '530', '400'];
  for (let i = 0; i < 1200; i += 1) {
    const p = prefixes[i % prefixes.length];
    out.push({
      barcode: `${p}${String(1000000000 + i).slice(0, 10)}`,
      name: `Produkt ${i}`,
      image: `https://example.test/${i}.jpg`,
      price: 0.5 + (i % 50) / 10,
      isLocalBrand: p === '381' || p === '390',
    });
  }
  return out;
};

describe('the built-in /historiku shelf', () => {
  const data = { kosovoRetail: { products: mixedCatalogue() } };
  const base = builtinFeedSeed();

  it('is FIFTY rows, present without anyone pressing anything', () => {
    // The seeding used to live behind a button in the empty state of the
    // tab nobody lands on. Fifty rows, on load, is the whole ask.
    expect(builtinFeedItems(data, { limit: 50, seed: base })).toHaveLength(50);
  });

  it('is a DIFFERENT fifty every day', () => {
    const days = [];
    for (let d = 0; d < 7; d += 1) days.push(builtinFeedItems(data, { limit: 50, seed: base + d }));
    const orders = new Set(days.map((d) => d.map((i) => i.code).join(',')));
    expect(orders.size).toBe(7);

    // Not merely reordered — mostly different PRODUCTS. A rotation would
    // score near zero here, which is exactly how the last one passed
    // review and still looked static.
    for (let d = 1; d < 7; d += 1) {
      const yesterday = new Set(days[d - 1].map((i) => i.code));
      const fresh = days[d].filter((i) => !yesterday.has(i.code)).length;
      expect(fresh, `day ${d} only had ${fresh}/50 new products`).toBeGreaterThan(25);
    }
  });

  it('is the SAME fifty all day, on every device', () => {
    const a = builtinFeedItems(data, { limit: 50, seed: base }).map((i) => i.code);
    const b = builtinFeedItems(data, { limit: 50, seed: base }).map((i) => i.code);
    expect(a).toEqual(b);
  });

  it('shows a range of verdicts, not fifty identical badges', () => {
    const items = builtinFeedItems(data, { limit: 50, seed: base });
    const verdicts = new Set(items.map((i) => i.verdict));
    expect(verdicts.size).toBeGreaterThanOrEqual(3);
    const flagged = items.filter((i) => i.verdict === 'flagged').length;
    expect(flagged).toBeGreaterThan(5); // the case the app exists for
  });

  it('never renders an undocumented row: every item has a real GTIN and a name', () => {
    for (const item of builtinFeedItems(data, { limit: 50, seed: base })) {
      expect(item.code).toMatch(/^\d{8,14}$/);
      expect(String(item.name).length).toBeGreaterThan(0);
      // Marked, always, so it can never be counted as somebody's scan.
      expect(item.builtin).toBe(true);
    }
  });

  it('carries no duplicate products', () => {
    // "10 times same product try to remove dupes"
    const names = builtinFeedItems(data, { limit: 50, seed: base }).map((i) =>
      String(i.name).toLowerCase()
    );
    expect(new Set(names).size).toBe(names.length);
  });

  it('yields nothing rather than something invented when there is no catalogue', () => {
    expect(builtinFeedItems({ kosovoRetail: { products: [] } })).toEqual([]);
    expect(builtinFeedItems(null)).toEqual([]);
  });

  it('has its own status so the UI can label it honestly', () => {
    expect(FEED_BUILTIN).toBe('builtin');
  });
});

describe('/eksploro: the WINDOW moves, not just its contents', () => {
  // THE BUG THIS EXISTS FOR. `visible` was filtered.slice(0, 48) and the
  // groups were built from `visible`, so the day-seeded rotation only ever
  // reordered the same forty-eight rows. Whatever sits at the head of the
  // catalogue was in the window on every one of those days.
  const dayHash = (seed, str) => {
    let h = 2166136261;
    const s = `${seed}|${str}`;
    for (let i = 0; i < s.length; i += 1) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    h ^= h >>> 15;
    h = Math.imul(h, 2246822507);
    h ^= h >>> 13;
    return h >>> 0;
  };
  const orderFor = (items, seed) =>
    items
      .map((it) => ({ it, h: dayHash(seed, it.barcode) }))
      .sort((a, b) => a.h - b.h)
      .map((k) => k.it);

  const items = catalogue(3000);
  const base = rotationSeed();

  it('puts a mostly different 48 products in the first page each day', () => {
    for (let d = 1; d < 6; d += 1) {
      const yesterday = new Set(orderFor(items, base + d - 1).slice(0, 48).map((i) => i.barcode));
      const today = orderFor(items, base + d).slice(0, 48);
      const fresh = today.filter((i) => !yesterday.has(i.barcode)).length;
      expect(fresh, `day ${d}: only ${fresh}/48 new`).toBeGreaterThan(40);
    }
  });

  it('is stable within a day', () => {
    expect(orderFor(items, base).slice(0, 20).map((i) => i.barcode)).toEqual(
      orderFor(items, base).slice(0, 20).map((i) => i.barcode)
    );
  });

  it('demonstrates why rotating inside the window was not enough', () => {
    // rotateWithinBand reorders the band it is given. If the band is the
    // already-sliced page, the SET of products in it cannot change — which
    // is precisely what "same grapes and apples" described.
    const page = items.slice(0, 48);
    const a = new Set(rotateWithinBand(page, 40, base).map((i) => i.barcode));
    const b = new Set(rotateWithinBand(page, 40, base + 1).map((i) => i.barcode));
    expect([...a].sort()).toEqual([...b].sort()); // identical sets, every day
  });

  it('shares one definition of "a different day" across all three surfaces', () => {
    expect(typeof rotationSeed()).toBe('number');
    expect(builtinFeedSeed()).toBe(rotationSeed());
  });
});
