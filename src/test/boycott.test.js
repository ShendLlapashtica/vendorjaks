import { describe, it, expect } from 'vitest';
import { classifyBarcode, VERDICT } from '../lib/gs1.js';
import { findBoycottByCode, findBoycottByBrand, applyBoycott, normalizeBoycottTable } from '../lib/boycott.js';
import rawBoycottData from '../../data/boycott-brands.json' assert { type: 'json' };
import rawGs1Table from '../../data/gs1-prefixes.json' assert { type: 'json' };

// Convert the GS1 prefixes format (with range strings) to the format classifyBarcode expects (with min/max)
function buildGs1Table(rawTable) {
  const ranges = [];
  for (const entry of rawTable.prefixes) {
    const rangeParts = entry.range.split('-');
    const min = parseInt(rangeParts[0], 10);
    const max = rangeParts.length === 1 ? min : parseInt(rangeParts[1], 10);
    ranges.push({
      min,
      max,
      country: entry.country,
      countrySq: entry.countrySq,
      iso: entry.iso,
      kind: entry.kind,
      isSerbia: entry.isSerbia,
      isLocal: entry.isLocal,
      note: entry.note,
    });
  }
  return { ranges };
}

const gs1Table = buildGs1Table(rawGs1Table);
const boycottTable = normalizeBoycottTable(rawBoycottData);

describe('boycott.js', () => {
  describe('findBoycottByCode', () => {
    it('finds Chipsy by each of its five known barcodes', () => {
      const codes = [
        '8606014409017',
        '8606017378532',
        '8606017372806',
        '8606017375357',
        '3870508000157',
      ];

      for (const code of codes) {
        const result = findBoycottByCode(code, boycottTable);
        expect(result).toBeDefined();
        expect(result.reason).toBe('barcode');
        expect(result.brand).toBe('Chipsy');
      }
    });

    it('returns null for unknown barcodes', () => {
      const result = findBoycottByCode('1234567890123', boycottTable);
      expect(result).toBeNull();
    });
  });

  describe('findBoycottByBrand', () => {
    it('matches the real Open Food Facts brands string (comma-separated, case-insensitive)', () => {
      const result = findBoycottByBrand('Chipsy, Marbo, Pepsico', boycottTable);
      expect(result).toBeDefined();
      expect(result.brand).toBe('Chipsy');
      expect(result.reason).toBe('brand');
    });

    it('uses whole-token matching, never substring matching', () => {
      // These should NOT match
      expect(findBoycottByBrand('Marbolino', boycottTable)).toBeNull();
      expect(findBoycottByBrand('Chipsywich', boycottTable)).toBeNull();

      // These should match
      expect(findBoycottByBrand('marbo', boycottTable)).toBeDefined();
      expect(findBoycottByBrand('chipsy', boycottTable)).toBeDefined();
    });

    it('returns null for unrelated brands', () => {
      const result = findBoycottByBrand('Coca-Cola', boycottTable);
      expect(result).toBeNull();
    });
  });

  describe('applyBoycott', () => {
    it('THE CRITICAL CASE: 387 (Bosnia) Chipsy becomes SERBIAN with issuerDiffersFromOwner=true', () => {
      const bosniaChipsyCode = '3870508000157';

      // First, classify by prefix alone
      const classify = classifyBarcode(bosniaChipsyCode, gs1Table);
      expect(classify.verdict).toBe(VERDICT.OTHER);
      expect(classify.country).toBe('Bosnia and Herzegovina');
      expect(classify.iso).toBe('BA');
      expect(classify.isSerbiaPrefix).toBe(false);

      // Then find the boycott override
      const boycott = findBoycottByCode(bosniaChipsyCode, boycottTable);
      expect(boycott).toBeDefined();

      // Apply the boycott
      const result = applyBoycott(classify, boycott);
      expect(result.verdict).toBe(VERDICT.SERBIAN);
      expect(result.issuerDiffersFromOwner).toBe(true);
      // The issuer (Bosnia/BA) is PRESERVED, not overwritten
      expect(result.iso).toBe('BA');
      expect(result.country).toBe('Bosnia and Herzegovina');
    });

    it('an 860-prefixed Chipsy has issuerDiffersFromOwner=false', () => {
      const serbiaChipsyCode = '8606014409017';

      const classify = classifyBarcode(serbiaChipsyCode, gs1Table);
      expect(classify.verdict).toBe(VERDICT.SERBIAN);
      expect(classify.isSerbiaPrefix).toBe(true);

      const boycott = findBoycottByCode(serbiaChipsyCode, boycottTable);
      expect(boycott).toBeDefined();

      const result = applyBoycott(classify, boycott);
      expect(result.verdict).toBe(VERDICT.SERBIAN);
      expect(result.issuerDiffersFromOwner).toBe(false);
    });

    it('returns classify unchanged when boycott is null', () => {
      const classify = classifyBarcode('4200000000000', gs1Table);
      const result = applyBoycott(classify, null);

      expect(result).toEqual(classify);
    });

    it('never turns a SERBIAN verdict into non-SERBIAN (one-way override)', () => {
      // Create a mock classify for an 860 barcode
      const serbiaClassify = {
        verdict: VERDICT.SERBIAN,
        isSerbiaPrefix: true,
      };

      // Create a mock boycott that tries to "clear" it
      const mockClearBoycott = {
        reason: 'barcode',
        brand: 'SomeSerbian',
      };

      const result = applyBoycott(serbiaClassify, mockClearBoycott);
      // Verdict should still be SERBIAN
      expect(result.verdict).toBe(VERDICT.SERBIAN);
    });
  });
});
