import { useState } from 'react';
// Styling owned by the verdict lane (the "we don't know" marker, the
// always-on barcode line, the split-origin block). Imported here rather
// than from main.jsx because App.css/index.css and main.jsx stay
// untouched, and because every product surface in the app reaches this file.
import '../styles/verdict.css';

// A country flag — REAL artwork, for every country.
//
// Owner, 2026-09-12: "the flags must show all of them . make sure
// recognizers get the real flag shown! and get them from a real source!!"
//
// Artwork is the `flag-icons` set (MIT, github.com/lipis/flag-icons),
// extracted into public/flags/<iso>.svg by scripts/build-flags.mjs. All 122
// countries in data/gs1-prefixes.json are covered, with none missing —
// including Kosovo (`xk`), the one flag Unicode emoji genuinely cannot
// render because XK is a user-assigned code outside the RGI set.
//
// WHAT THIS REPLACED, and why it had to go:
//   · Unicode emoji flags. Correct on phones, but Windows ships no flag
//     glyphs whatsoever, so desktop fell through to a typographic "ES" box.
//     Most countries therefore never showed a flag at all on desktop.
//   · Two hand-drawn SVGs (Serbia, Kosovo) that deliberately omitted the
//     coat of arms and the gold map, because approximating national heraldry
//     from memory produces a wrong drawing of a national symbol. Real
//     artwork removes that trade-off entirely — Serbia now renders WITH its
//     coat of arms, Kosovo WITH its map and six stars, because these are
//     properly drawn files rather than my approximations.
//
// TONES carry the app's judgement and are applied in CSS over the real
// artwork, so the flag underneath is always the correct one:
//   normal — full colour.
//   muted  — greyscale. Serbia (boycott) and "mos-njohës" countries that do
//            not recognise Kosovo.
//   danger — red hazard wash. Kept available; see lib/flagTone.js.

const SIZES = { sm: 'sm', md: 'md', lg: 'lg', hero: 'hero' };

/**
 * @param {object} props
 * @param {string|null} props.iso   ISO 3166-1 alpha-2, or null for a non-country prefix.
 * @param {string} props.name       country name — the accessible label.
 * @param {'normal'|'danger'|'muted'} [props.tone]
 * @param {boolean} [props.mono]    legacy alias for tone="muted".
 * @param {'sm'|'md'|'lg'|'hero'} [props.size]
 */
export default function Flag({ iso, name, mono = false, tone = 'normal', size = 'md' }) {
  const [broken, setBroken] = useState(false);
  const code = String(iso || '').toLowerCase();
  const label = name || code.toUpperCase();
  const effectiveTone = tone !== 'normal' ? tone : mono ? 'muted' : 'normal';
  const cls = `vj-flag vj-flag-${SIZES[size] || 'md'} is-${effectiveTone}`;

  // No ISO code: a coupon, an ISBN, an in-store/PLU number, an unallocated
  // prefix. There is no flag to show, and inventing one would be a lie
  // about what the barcode says.
  if (!code) {
    return (
      <span className={`${cls} is-none`} role="img" aria-label={label}>
        <span className="vj-flag-chip" aria-hidden="true">
          —
        </span>
      </span>
    );
  }

  // Only if the file genuinely fails to load — every country in the table
  // has artwork, so this is a safety net, not a routine path.
  if (broken) {
    return (
      <span className={`${cls} is-chip`} role="img" aria-label={label}>
        <span className="vj-flag-chip" aria-hidden="true">
          {code.toUpperCase()}
        </span>
      </span>
    );
  }

  return (
    <span className={cls}>
      <img
        className="vj-flag-img"
        src={`/flags/${code}.svg`}
        alt={label}
        loading="lazy"
        decoding="async"
        onError={() => setBroken(true)}
      />
    </span>
  );
}
