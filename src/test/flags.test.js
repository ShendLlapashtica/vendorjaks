import { describe, it, expect } from 'vitest';
import {
  isoToEmoji,
  hasHandDrawnFlag,
  emojiFlagUnsupported,
  supportsFlagEmoji,
  __setFlagEmojiSupport,
} from '../lib/flags.js';

describe('flags.js', () => {
  describe('isoToEmoji', () => {
    it('converts valid ISO 3166-1 alpha-2 codes to regional-indicator emoji', () => {
      const deEmoji = isoToEmoji('DE');
      expect(deEmoji).toBeDefined();
      // Regional Indicator Symbols are surrogate pairs in UTF-16, so two of them = length 4
      expect(deEmoji.length).toBe(4);
      // Verify it's the correct two code points (REGIONAL INDICATOR SYMBOL LETTER D + E)
      const A = 0x1f1e6;
      const expected = String.fromCodePoint(A + 3, A + 4); // D=3, E=4
      expect(deEmoji).toBe(expected);
    });

    it('converts lowercase input to uppercase', () => {
      expect(isoToEmoji('de')).toBe(isoToEmoji('DE'));
    });

    it('returns null for invalid input', () => {
      expect(isoToEmoji('D')).toBeNull();
      expect(isoToEmoji('DEU')).toBeNull();
      expect(isoToEmoji('d1')).toBeNull();
      expect(isoToEmoji('')).toBeNull();
      expect(isoToEmoji(null)).toBeNull();
      expect(isoToEmoji(undefined)).toBeNull();
    });

    it('works for various valid codes (spot checks)', () => {
      expect(isoToEmoji('US')).toBeDefined();
      expect(isoToEmoji('FR')).toBeDefined();
      expect(isoToEmoji('XK')).toBeDefined();
      expect(isoToEmoji('RS')).toBeDefined();
    });
  });

  describe('hasHandDrawnFlag', () => {
    it('is true for XK (Kosovo) and RS (Serbia)', () => {
      expect(hasHandDrawnFlag('XK')).toBe(true);
      expect(hasHandDrawnFlag('RS')).toBe(true);
    });

    it('is false for other countries like DE', () => {
      expect(hasHandDrawnFlag('DE')).toBe(false);
      expect(hasHandDrawnFlag('US')).toBe(false);
      expect(hasHandDrawnFlag('AL')).toBe(false);
    });

    it('is case-insensitive', () => {
      expect(hasHandDrawnFlag('xk')).toBe(true);
      expect(hasHandDrawnFlag('rs')).toBe(true);
      expect(hasHandDrawnFlag('de')).toBe(false);
    });
  });

  describe('emojiFlagUnsupported', () => {
    it('is true for XK (Kosovo)', () => {
      expect(emojiFlagUnsupported('XK')).toBe(true);
    });

    it('is false for supported codes like DE', () => {
      expect(emojiFlagUnsupported('DE')).toBe(false);
      expect(emojiFlagUnsupported('RS')).toBe(false);
      expect(emojiFlagUnsupported('US')).toBe(false);
    });

    it('is case-insensitive', () => {
      expect(emojiFlagUnsupported('xk')).toBe(true);
    });
  });

  describe('supportsFlagEmoji', () => {
    it('returns false in a non-browser environment (no document)', () => {
      // In Node.js/Vitest, document is undefined
      expect(supportsFlagEmoji()).toBe(false);
    });

    it('can be driven by __setFlagEmojiSupport for testing', () => {
      __setFlagEmojiSupport(true);
      expect(supportsFlagEmoji()).toBe(true);

      __setFlagEmojiSupport(false);
      expect(supportsFlagEmoji()).toBe(false);

      // Reset
      __setFlagEmojiSupport(null);
    });
  });
});
