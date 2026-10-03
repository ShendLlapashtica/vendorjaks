import { describe, expect, it } from 'vitest';
import { feedProduct } from '../lib/publicFeed.js';

// A feed row arrives from ANOTHER device and carries the minimum the server
// stores: code, name, brand, verdict, time. Everything else needed to show
// the product itself — the pack shot, the grams — is already in this device's
// catalogue, so the row is completed locally rather than by asking the server
// for more about other people's scans.
function dataWith(rows) {
  return { localProducts: { byCode: new Map(rows.map((r) => [r.code, r])) } };
}

const CATALOGUE = {
  code: '4860001234567',
  name: 'Plazma 300g',
  brand: 'Bambi',
  image: '/img/plazma.jpg',
  quantity: '300 g',
};

describe('feedProduct', () => {
  it('fills the photo and the grams the feed never carried', () => {
    const row = feedProduct({ code: '4860001234567', name: 'Plazma', brand: null }, dataWith([CATALOGUE]));
    expect(row.image).toBe('/img/plazma.jpg');
    expect(row.quantity).toBe('300 g');
  });

  it("keeps the scanning device's own name — that is what THAT person scanned", () => {
    const row = feedProduct({ code: '4860001234567', name: 'Plazma', brand: 'Bambi d.o.o.' }, dataWith([CATALOGUE]));
    expect(row.name).toBe('Plazma');
    expect(row.brand).toBe('Bambi d.o.o.');
  });

  it('falls back to the catalogue only where the feed is silent', () => {
    const row = feedProduct({ code: '4860001234567', name: null, brand: null }, dataWith([CATALOGUE]));
    expect(row.name).toBe('Plazma 300g');
    expect(row.brand).toBe('Bambi');
  });

  it('never invents a photo for a code the catalogue does not have', () => {
    const item = { code: '9999999999999', name: 'Something', brand: null };
    const row = feedProduct(item, dataWith([CATALOGUE]));
    expect(row).toBe(item);
    expect(row.image).toBeUndefined();
  });

  it('survives a missing catalogue entirely rather than throwing', () => {
    const item = { code: '4860001234567', name: 'Plazma' };
    expect(feedProduct(item, null)).toBe(item);
    expect(feedProduct(item, {})).toBe(item);
    expect(feedProduct(item, { localProducts: {} })).toBe(item);
  });

  it('keeps the verdict and the barcode the feed sent, never the catalogue row id', () => {
    const row = feedProduct(
      { code: '4860001234567', name: null, brand: null, verdict: 'SERBIAN', at: 123 },
      dataWith([CATALOGUE]),
    );
    expect(row.verdict).toBe('SERBIAN');
    expect(row.code).toBe('4860001234567');
    expect(row.at).toBe(123);
  });
});
