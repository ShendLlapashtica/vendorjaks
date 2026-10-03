import { describe, it, expect } from 'vitest';
import { classifyBarcode, isPlausibleBarcode, VERDICT } from '../lib/gs1.js';

const gs1Table = {
  ranges: [
    {
      min: 860,
      max: 860,
      country: 'Serbia',
      countrySq: 'Serbi',
      iso: 'RS',
      kind: 'country',
      isSerbia: true,
      isLocal: false,
    },
    {
      min: 381,
      max: 381,
      country: 'Kosovo',
      countrySq: 'Kosovë',
      iso: 'XK',
      kind: 'country',
      isSerbia: false,
      isLocal: true,
    },
    {
      min: 390,
      max: 390,
      country: 'Kosovo (legacy range)',
      countrySq: 'Kosovë (rreze e vjetër)',
      iso: 'XK',
      kind: 'country',
      isSerbia: false,
      isLocal: true,
    },
    {
      min: 530,
      max: 530,
      country: 'Albania',
      countrySq: 'Shqipëri',
      iso: 'AL',
      kind: 'country',
      isSerbia: false,
      isLocal: true,
    },
    {
      min: 400,
      max: 440,
      country: 'Germany',
      countrySq: 'Gjermani',
      iso: 'DE',
      kind: 'country',
      isSerbia: false,
      isLocal: false,
    },
    {
      min: 868,
      max: 869,
      country: 'Turkey',
      countrySq: 'Turqi',
      iso: 'TR',
      kind: 'country',
      isSerbia: false,
      isLocal: false,
    },
    {
      min: 140,
      max: 199,
      country: 'Unassigned',
      countrySq: 'E paalokuar',
      iso: null,
      kind: 'unassigned',
      isSerbia: false,
      isLocal: false,
    },
    {
      min: 990,
      max: 999,
      country: 'Coupons',
      countrySq: 'Kuponë',
      iso: null,
      kind: 'coupon',
      isSerbia: false,
      isLocal: false,
    },
  ],
};

describe('classifyBarcode', () => {
  it('classifies the real Plazma (Bambi/Serbia) barcode as SERBIAN', () => {
    const result = classifyBarcode('8600043000016', gs1Table);
    expect(result.verdict).toBe(VERDICT.SERBIAN);
    expect(result.prefix).toBe('860');
    expect(result.country).toBe('Serbia');
    expect(result.iso).toBe('RS');
    expect(result.kind).toBe('country');
  });

  it('classifies a 381-prefixed code as LOCAL (Kosovo official)', () => {
    const result = classifyBarcode('3811234567890', gs1Table);
    expect(result.verdict).toBe(VERDICT.LOCAL);
    expect(result.iso).toBe('XK');
    expect(result.kind).toBe('country');
  });

  it('classifies a 390-prefixed code as LOCAL (legacy Kosovo)', () => {
    const result = classifyBarcode('3902379930018', gs1Table);
    expect(result.verdict).toBe(VERDICT.LOCAL);
    expect(result.iso).toBe('XK');
    expect(result.kind).toBe('country');
  });

  it('classifies a 530-prefixed code as LOCAL (Albania)', () => {
    const result = classifyBarcode('5304000044121', gs1Table);
    expect(result.verdict).toBe(VERDICT.LOCAL);
    expect(result.iso).toBe('AL');
    expect(result.kind).toBe('country');
  });

  it('classifies a range like Germany 400-440 as OTHER, not just the boundary', () => {
    const result = classifyBarcode('4200000000000', gs1Table);
    expect(result.verdict).toBe(VERDICT.OTHER);
    expect(result.iso).toBe('DE');
    expect(result.kind).toBe('country');
  });

  it('handles a UPC-A (12 digit) code by left-padding with a 0', () => {
    // 012345678905 -> 0012345678905, prefix 001 falls outside our test table -> UNKNOWN, which is fine;
    // the important thing is it does not throw and still returns a shape.
    const result = classifyBarcode('012345678905', gs1Table);
    expect(result).toHaveProperty('verdict');
  });

  it('returns NOT_A_COUNTRY for a coupon prefix', () => {
    // 999 is in the 990-999 range which is coupons (kind !== 'country')
    const result = classifyBarcode('9999999999999', gs1Table);
    expect(result.verdict).toBe(VERDICT.NOT_A_COUNTRY);
    expect(result.prefix).toBe('999');
    expect(result.kind).toBe('coupon');
    expect(result.iso).toBeNull();
  });

  it('returns UNASSIGNED for an explicitly unassigned prefix', () => {
    // 150 is in the 140-199 range which is unassigned
    const result = classifyBarcode('1501234567890', gs1Table);
    expect(result.verdict).toBe(VERDICT.UNASSIGNED);
    expect(result.kind).toBe('unassigned');
    expect(result.iso).toBeNull();
  });

  it('returns UNKNOWN for garbage input rather than throwing', () => {
    expect(classifyBarcode('', gs1Table).verdict).toBe(VERDICT.UNKNOWN);
    expect(classifyBarcode(null, gs1Table).verdict).toBe(VERDICT.UNKNOWN);
  });

  it('includes isSerbiaPrefix as true only for 860', () => {
    expect(classifyBarcode('8600043000016', gs1Table).isSerbiaPrefix).toBe(true);
    expect(classifyBarcode('3811234567890', gs1Table).isSerbiaPrefix).toBe(false);
  });
});

describe('isPlausibleBarcode', () => {
  it('accepts 8, 12 and 13 digit codes', () => {
    expect(isPlausibleBarcode('12345678')).toBe(true);
    expect(isPlausibleBarcode('123456789012')).toBe(true);
    expect(isPlausibleBarcode('8600043000016')).toBe(true);
  });

  it('rejects other lengths and non-numeric input', () => {
    expect(isPlausibleBarcode('123')).toBe(false);
    expect(isPlausibleBarcode('abcdefgh')).toBe(false);
    expect(isPlausibleBarcode('')).toBe(false);
  });
});
