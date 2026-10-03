// Flag helpers.
//
// 2026-09-12: flag RENDERING moved to real artwork — public/flags/<iso>.svg,
// extracted from the MIT-licensed `flag-icons` set by
// scripts/build-flags.mjs and covering all 122 countries in the GS1 table.
// See src/components/Flag.jsx.
//
// The emoji path and its canvas-based support detection are gone: Windows
// ships no flag glyphs, so emoji meant most countries showed a typographic
// "ES" box on desktop rather than a flag. Real files render everywhere.
//
// What remains here are the small pure helpers the tests and other modules
// still use.

/** ISO 3166-1 alpha-2 -> the two regional-indicator code points. */
export function isoToEmoji(iso) {
  const code = String(iso || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return null;
  const A = 0x1f1e6; // REGIONAL INDICATOR SYMBOL LETTER A
  return String.fromCodePoint(A + (code.charCodeAt(0) - 65), A + (code.charCodeAt(1) - 65));
}

// ISO codes we draw ourselves instead of using an emoji.
export const HAND_DRAWN = new Set(['XK', 'RS']);

export function hasHandDrawnFlag(iso) {
  return HAND_DRAWN.has(String(iso || '').toUpperCase());
}

// Kosovo's user-assigned code is not in Unicode's emoji set; nothing else
// in the table is affected.
export function emojiFlagUnsupported(iso) {
  return String(iso || '').toUpperCase() === 'XK';
}

/**
 * Does this browser actually render flag emoji?
 *
 * Windows ships no flag glyphs, so 🇩🇪 comes out as the letters "DE" —
 * which looks broken rather than informative, and is exactly what this
 * check exists to avoid.
 *
 * DETECTION IS BY PIXEL COLOUR, not by text width. The first version of
 * this measured whether the flag glyph was narrower than the two letters
 * it decomposes into — and it was WRONG on Windows Chrome, which reports a
 * narrow width and then paints "BA". Verified against a real Windows
 * Chrome on 2026-09-12, where it wrongly returned true and shipped a
 * hero-sized "BA" where Bosnia's flag should have been.
 *
 * The reliable signal: a real flag glyph is a colour bitmap, so the canvas
 * contains saturated pixels. The letter fallback is drawn in the single
 * solid fillStyle we set, so every pixel is greyscale. Testing for any
 * pixel where the channels differ separates the two cases exactly.
 *
 * Cached — it cannot change within a page load.
 */
let emojiSupport = null;
export function supportsFlagEmoji() {
  if (emojiSupport !== null) return emojiSupport;
  if (typeof document === 'undefined') return false;
  try {
    const size = 24;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return (emojiSupport = false);

    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#000000'; // any fallback letters will be pure greyscale
    ctx.textBaseline = 'top';
    ctx.font = `${size}px sans-serif`;
    ctx.fillText('\u{1F1E9}\u{1F1EA}', 0, 0); // 🇩🇪

    const { data } = ctx.getImageData(0, 0, size, size);
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue; // transparent
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
      // Any meaningful channel spread means a colour glyph was painted.
      if (Math.max(r, g, b) - Math.min(r, g, b) > 24) {
        return (emojiSupport = true);
      }
    }
    emojiSupport = false;
  } catch {
    // Canvas can throw on a tainted/blocked context — fall back to the
    // typographic chip, which always renders correctly.
    emojiSupport = false;
  }
  return emojiSupport;
}

/** Test seam — lets the unit tests drive both branches. */
export function __setFlagEmojiSupport(value) {
  emojiSupport = value;
}
