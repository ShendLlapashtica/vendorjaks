import { describe, it, expect } from 'vitest';
import { mergeRetail, currencyAcceptable, VOLATILE_FIELDS, FROZEN_FIELDS } from '../../scripts/merge-retail.mjs';

// The merge used to be a `node -e '…'` paste in docs/XAPI-SOURCING.md §6 that a
// human ran by hand against a 63 MB file. It is now run unattended by a daily
// cron job, so every guarantee it makes needs a test that fails when the
// guarantee breaks. These are those tests.

const base = (products, extra = {}) => ({ products, count: products.length, sources: [], ...extra });

const row = (over = {}) => ({
  id: 'maxiks.shop:1',
  source: 'maxiks.shop',
  sourceLabel: 'Maxi',
  name: 'COCA COLA 1.25L',
  category: 'Pije',
  brand: null,
  price: 1.45,
  currency: 'EUR',
  image: 'https://maxiks.shop/a.jpg',
  url: 'https://maxiks.shop/product/coca-cola',
  barcode: '5449000214911',
  isLocalBrand: false,
  localEvidence: 'GS1 barcode prefix 544 — imported',
  matchKey: 'gtin:5449000214911',
  ...over,
});

describe('the volatile/frozen split', () => {
  it('never lists a field as both, so a refresh cannot rewrite a sourced claim', () => {
    for (const f of FROZEN_FIELDS) expect(VOLATILE_FIELDS).not.toContain(f);
  });

  it('freezes exactly the identity and evidence fields', () => {
    for (const f of ['id', 'source', 'barcode', 'isLocalBrand', 'localEvidence', 'brand', 'matchKey']) {
      expect(FROZEN_FIELDS).toContain(f);
    }
  });
});

describe('the currency gate', () => {
  it('accepts EUR and an absent currency, and nothing else', () => {
    expect(currencyAcceptable({ currency: 'EUR' })).toBe(true);
    expect(currencyAcceptable({ currency: null })).toBe(true);
    expect(currencyAcceptable({})).toBe(true);
    expect(currencyAcceptable({ currency: 'ALL' })).toBe(false);
    expect(currencyAcceptable({ currency: 'GBP' })).toBe(false);
  });

  // THE SCAR. 63.8% of this catalogue is Albanian Lek stored as EUR; that bug
  // produced a "500.00 EUR" deodorant. It does not come back through the
  // refresh door.
  it('refuses to import a row priced in Lek', () => {
    const b = base([]);
    const { stats } = mergeRetail(b, { products: [row({ id: 'x:1', currency: 'ALL', price: 500, matchKey: null })] });
    expect(stats.imported).toBe(0);
    expect(stats.skippedCurrency).toBe(1);
    expect(b.products).toHaveLength(0);
  });

  it('refuses to refresh an existing price into a non-EUR currency', () => {
    const incumbent = row();
    const b = base([incumbent]);
    mergeRetail(b, { products: [row({ price: 500, currency: 'ALL' })] });
    expect(incumbent.price).toBe(1.45);
    expect(incumbent.currency).toBe('EUR');
  });
});

describe('import', () => {
  it('appends a genuinely new product and never re-sorts (the 12 KB delta depends on it)', () => {
    const first = row({ id: 'maxiks.shop:0', matchKey: 'gtin:0000000000000' });
    const b = base([first]);
    const { stats } = mergeRetail(b, { products: [row()] });
    expect(stats.imported).toBe(1);
    expect(b.products[0]).toBe(first); // still first
    expect(b.products[1].id).toBe('maxiks.shop:1'); // appended, not inserted
    expect(b.count).toBe(2);
  });
});

describe('skip — the product is already covered by another row', () => {
  it('keeps the incumbent on a matchKey collision from a different source', () => {
    const incumbent = row({ id: 'wolt.com/maxi-supermarket:1', source: 'wolt.com/maxi-supermarket', price: 1.39 });
    const b = base([incumbent]);
    const { stats } = mergeRetail(b, { products: [row()] });
    expect(stats.imported).toBe(0);
    expect(stats.skippedDuplicateOtherSource).toBe(1);
    expect(b.products).toHaveLength(1);
    expect(incumbent.price).toBe(1.39); // untouched
  });

  // THE BUG THIS FILE SHIPPED FIRST AND THE REASON THESE TESTS EXIST.
  // A matchKey hit is not a re-read even when the source matches: the crawl
  // output genuinely holds 16 duplicate matchKeys — two different maxiks.shop
  // listings carrying one barcode. Treating the second as a re-read of the
  // first reported "DOMESTOS ATLANTIC FRESH 1L 2.15 -> 2.55" as a price move
  // when no price had moved.
  it('does NOT treat a same-source matchKey collision as a re-read', () => {
    const incumbent = row({ id: 'maxiks.shop:slug-a', price: 2.15 });
    const b = base([incumbent]);
    const { stats, priceChanges } = mergeRetail(b, {
      products: [row({ id: 'maxiks.shop:slug-b', price: 2.55 })],
    });
    expect(incumbent.price).toBe(2.15);
    expect(stats.priceChanged).toBe(0);
    expect(priceChanges).toHaveLength(0);
    expect(stats.skippedDuplicateOtherSource).toBe(1);
  });
});

describe('refresh — the same listing, read again', () => {
  it('updates the price and reports the change with a percentage', () => {
    const incumbent = row();
    const b = base([incumbent]);
    const { stats, priceChanges } = mergeRetail(b, { products: [row({ price: 1.59 })] });
    expect(incumbent.price).toBe(1.59);
    expect(stats.priceChanged).toBe(1);
    expect(stats.refreshedRows).toBe(1);
    expect(priceChanges[0]).toMatchObject({ from: 1.45, to: 1.59, currency: 'EUR' });
    expect(priceChanges[0].pct).toBeCloseTo(9.7, 1);
  });

  it('reports nothing at all when the read is identical', () => {
    const b = base([row()]);
    const { stats, priceChanges, fieldChanges } = mergeRetail(b, { products: [row()] });
    expect(stats.unchanged).toBe(1);
    expect(stats.refreshedRows).toBe(0);
    expect(priceChanges).toHaveLength(0);
    expect(Object.keys(fieldChanges)).toHaveLength(0);
  });

  // A page that 500s, or redesigns its price markup, produces price:null.
  // Writing that over 1.45 EUR would blank the catalogue one row at a time.
  it('never overwrites a real price with null', () => {
    const incumbent = row();
    const b = base([incumbent]);
    const { stats } = mergeRetail(b, { products: [row({ price: null })] });
    expect(incumbent.price).toBe(1.45);
    expect(stats.priceMissingKeptOld).toBe(1);
    expect(stats.priceChanged).toBe(0);
  });

  it('updates the volatile fields and leaves every frozen field alone', () => {
    const incumbent = row();
    const b = base([incumbent]);
    mergeRetail(b, {
      products: [row({
        name: 'COCA COLA 1.25L NEW PACK',
        category: 'Pije / Gazuara',
        image: 'https://maxiks.shop/b.jpg',
        isLocalBrand: true,
        localEvidence: 'INVENTED',
        brand: 'INVENTED',
        barcode: '0000000000000',
      })],
    });
    expect(incumbent.name).toBe('COCA COLA 1.25L NEW PACK');
    expect(incumbent.category).toBe('Pije / Gazuara');
    expect(incumbent.image).toBe('https://maxiks.shop/b.jpg');
    // Locality is a sourced claim, not a shelf reading. A cron job may not move it.
    expect(incumbent.isLocalBrand).toBe(false);
    expect(incumbent.localEvidence).toBe('GS1 barcode prefix 544 — imported');
    expect(incumbent.brand).toBe(null);
    expect(incumbent.barcode).toBe('5449000214911');
  });

  it('lets a row gain a check-digit-valid barcode but never lose one', () => {
    const gains = row({ barcode: null, barcodeSource: null, matchKey: null });
    const b1 = base([gains]);
    mergeRetail(b1, { products: [row({ matchKey: null, barcodeSource: 'product-page' })] });
    expect(gains.barcode).toBe('5449000214911');
    expect(gains.barcodeSource).toBe('product-page');

    const keeps = row();
    const b2 = base([keeps]);
    mergeRetail(b2, { products: [row({ barcode: null })] });
    expect(keeps.barcode).toBe('5449000214911');
  });

  it('refuses a barcode that fails its check digit', () => {
    const gains = row({ barcode: null, matchKey: null });
    const b = base([gains]);
    mergeRetail(b, { products: [row({ barcode: '5449000214912', matchKey: null })] });
    expect(gains.barcode).toBe(null);
  });

  it('treats an absent incoming value as no information, not as a deletion', () => {
    const incumbent = row();
    const b = base([incumbent]);
    mergeRetail(b, { products: [row({ name: '', category: null, image: undefined })] });
    expect(incumbent.name).toBe('COCA COLA 1.25L');
    expect(incumbent.category).toBe('Pije');
    expect(incumbent.image).toBe('https://maxiks.shop/a.jpg');
  });

  it('--no-refresh reproduces the old §6 behaviour exactly', () => {
    const incumbent = row();
    const b = base([incumbent]);
    const { stats } = mergeRetail(b, { products: [row({ price: 9.99 })] }, { refresh: false });
    expect(incumbent.price).toBe(1.45);
    expect(stats.skippedSameRowNoRefresh).toBe(1);
    expect(stats.priceChanged).toBe(0);
  });
});

describe('source provenance', () => {
  it('records a crawled source once and never duplicates it', () => {
    const b = base([]);
    const add = {
      products: [],
      sources: [
        { source: 'maxiks.shop', url: 'https://maxiks.shop/search/suggest', kind: 'retailer', count: 1698, crawled: true, xapiRecon: { verdict: 'no-obvious-data-source' } },
        { source: 'gjirafamall.com', url: 'https://gjirafamall.com/', kind: 'retailer', count: 0, crawled: false },
      ],
    };
    mergeRetail(b, add);
    expect(b.sources).toHaveLength(1);
    expect(b.sources[0].domain).toBe('maxiks.shop');
    expect(b.sources[0].platform).toContain('no-obvious-data-source');

    mergeRetail(b, add); // run it twice
    expect(b.sources).toHaveLength(1);
  });
});
