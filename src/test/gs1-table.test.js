import { describe, it, expect } from 'vitest';
import table from '../../data/gs1-prefixes.json' assert { type: 'json' };

describe('gs1-prefixes.json data integrity', () => {
  it('has total coverage of all 1000 prefixes (000-999)', () => {
    const prefixes = table.prefixes;
    expect(prefixes).toBeDefined();
    expect(Array.isArray(prefixes)).toBe(true);
    expect(prefixes.length).toBeGreaterThan(0);
  });

  it('covers every integer prefix 000-999 exactly once (no gaps, no overlaps)', () => {
    const prefixes = table.prefixes;
    const covered = new Set();

    for (const entry of prefixes) {
      const range = entry.range;
      if (!range) continue;

      const parts = range.split('-');
      if (parts.length === 1) {
        // Single prefix: e.g., "860"
        const num = parseInt(parts[0], 10);
        if (covered.has(num)) {
          throw new Error(`Prefix ${num} is covered more than once (overlap)`);
        }
        covered.add(num);
      } else {
        // Range: e.g., "000-019"
        const min = parseInt(parts[0], 10);
        const max = parseInt(parts[1], 10);
        for (let i = min; i <= max; i++) {
          if (covered.has(i)) {
            throw new Error(`Prefix ${i} is covered more than once (overlap in range ${range})`);
          }
          covered.add(i);
        }
      }
    }

    // Check complete coverage: all 1000 prefixes covered
    for (let i = 0; i < 1000; i++) {
      if (!covered.has(i)) {
        throw new Error(`Prefix ${String(i).padStart(3, '0')} is not covered (gap)`);
      }
    }

    expect(covered.size).toBe(1000);
  });

  it('has non-null 2-letter uppercase iso for all country kind entries', () => {
    const prefixes = table.prefixes;

    for (const entry of prefixes) {
      if (entry.kind === 'country') {
        expect(entry.iso).toBeDefined();
        expect(entry.iso).not.toBeNull();
        expect(typeof entry.iso).toBe('string');
        expect(entry.iso).toMatch(/^[A-Z]{2}$/);
      }
    }
  });

  it('has null iso for all non-country kind entries', () => {
    const prefixes = table.prefixes;

    for (const entry of prefixes) {
      if (entry.kind !== 'country') {
        expect(entry.iso).toBeNull();
      }
    }
  });

  it('has non-empty countrySq (Albanian name) for all entries', () => {
    const prefixes = table.prefixes;

    for (const entry of prefixes) {
      expect(entry.countrySq).toBeDefined();
      expect(entry.countrySq).not.toBeNull();
      expect(typeof entry.countrySq).toBe('string');
      expect(entry.countrySq.trim().length).toBeGreaterThan(0);
    }
  });

  it('has exactly one range with isSerbia === true, and it is 860', () => {
    const prefixes = table.prefixes;
    const serbiaRanges = prefixes.filter((p) => p.isSerbia === true);

    expect(serbiaRanges.length).toBe(1);
    expect(serbiaRanges[0].range).toBe('860');
  });

  it('has exactly three ranges with isLocal === true: 381, 390, and 530', () => {
    const prefixes = table.prefixes;
    const localRanges = prefixes
      .filter((p) => p.isLocal === true)
      .map((p) => p.range)
      .sort();

    expect(localRanges).toEqual(['381', '390', '530']);
  });

  it('has 389 (Montenegro) present and NOT local', () => {
    const prefixes = table.prefixes;
    const montenegroEntry = prefixes.find((p) => p.range === '389');

    expect(montenegroEntry).toBeDefined();
    expect(montenegroEntry.country).toContain('Montenegro');
    expect(montenegroEntry.iso).toBe('ME');
    expect(montenegroEntry.isLocal).toBe(false);
  });

  it('distinguishes Kosovo (381) from Montenegro (389) from legacy Kosovo (390)', () => {
    const prefixes = table.prefixes;
    const kosovo = prefixes.find((p) => p.range === '381');
    const montenegro = prefixes.find((p) => p.range === '389');
    const kosovoLegacy = prefixes.find((p) => p.range === '390');

    expect(kosovo.country).toBe('Kosovo');
    expect(kosovo.iso).toBe('XK');
    expect(kosovo.isLocal).toBe(true);

    expect(montenegro.country).toBe('Montenegro');
    expect(montenegro.iso).toBe('ME');
    expect(montenegro.isLocal).toBe(false);

    expect(kosovoLegacy.country).toContain('Kosovo');
    expect(kosovoLegacy.iso).toBe('XK');
    expect(kosovoLegacy.isLocal).toBe(true);
  });
});
