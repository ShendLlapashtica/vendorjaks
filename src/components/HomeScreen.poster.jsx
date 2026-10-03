// PRESERVED COPY (2026-09-11) — not wired into the app, not imported anywhere.
//
// This is the exact build of screen 01 (ballina/home) from the owner's
// measured reference, docs/vendorja-ui-reference.html:
//   - `.stagger` at top:30cqw with the reference's literal 4-line wrap,
//     including the leading comma on line 2 (",beogradit!")
//   - `.scanbtn` at left:12.6cqw / top:128cqw — aligned to the text
//     indent, NOT centered
//   - `.search` at top:172cqw
//   - `.reticle` corner icon
//   - `.meta` counter line using the real scanCount (from getScanCount()
//     in src/lib/history.js, threaded through by App.jsx)
//   - black staggered type on pure red, cropped at both edges
//
// The CSS this depends on (`.screen`, `.stagger`, `.scanbtn`, `.reticle`,
// `.search`, `.meta`) still lives in App.css — nothing here needed its own
// stylesheet changes. Exported as `HomeScreenPoster` (not `HomeScreen`) so
// it can't collide with whatever is currently live at HomeScreen.jsx. To
// switch back to this design, import { HomeScreenPoster as HomeScreen }
// from this file in App.jsx — that's the one line the owner would change.
import { useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { isPlausibleBarcode } from '../lib/gs1.js';
import Logo from './Logo.jsx';

// 01 · HOME (ballina) — ported 1:1 from docs/vendorja-ui-reference.html's
// first screen: staggered black sentence cut at both edges, one white scan
// button aligned to the text's own left indent (12.6cqw — NOT centered),
// a real search input in the same slot as the mockup's placeholder text,
// and the real scan counter at the bottom.
export function HomeScreenPoster({ scanCount, onScan, onSubmitBarcode, onSearchExplore, onOpenExplore, onOpenManifesto, onOpenHistory }) {
  const { t, lang, toggleLanguage } = useLanguage();
  const [query, setQuery] = useState('');

  function handleSearchSubmit(e) {
    e.preventDefault();
    const value = query.trim();
    if (!value) return;
    if (isPlausibleBarcode(value)) {
      onSubmitBarcode(value.replace(/\D/g, ''));
    } else {
      onSearchExplore(value);
    }
  }

  const counterText =
    scanCount === 0 ? t('homeCounterZero') : t(scanCount === 1 ? 'homeCounterOne' : 'homeCounterOther', { count: scanCount });

  // The reference hard-wraps its Albanian sample sentence into exactly 4
  // lines with a leading comma on line 2 (the crop is deliberate). The
  // English string in the dictionary is wrapped the same way so both
  // languages keep the same DOM shape (always 4 <span>s).
  const lines = t('homeStaggerLines').split('|');

  return (
    <div className="screen">
      <Logo variant="small" style={{ top: '9cqw' }} />

      <p className="stagger" style={{ top: '30cqw' }} aria-label={t('homeTaglineAria')}>
        {lines.map((line, i) => (
          <span key={i}>{line}</span>
        ))}
      </p>

      <button type="button" className="scanbtn" onClick={onScan} aria-label={t('homeScanAria')}>
        <span className="c" aria-hidden="true">
          <span className="reticle">
            <i /> <i /> <i /> <i />
          </span>
        </span>
        {t('homeScanLabel')}
      </button>

      <form onSubmit={handleSearchSubmit}>
        <input
          className="search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('homeSearchPlaceholder')}
          aria-label={t('homeSearchPlaceholder')}
          inputMode="search"
        />
      </form>

      <div className="meta" style={{ left: '12.6cqw', bottom: '8cqw', color: 'var(--black)' }}>
        {counterText}
      </div>

      {/* Not in the 8-screen reference (which only shows the happy path) but
          required for the app to actually be usable: quiet, small, mono
          links to the rest of the app. Bottom-right, out of the poster's way. */}
      <nav className="home-nav" aria-label="navigation">
        <button type="button" className="home-nav-btn" onClick={onOpenExplore}>
          {t('navExplore')}
        </button>
        <button type="button" className="home-nav-btn" onClick={onOpenManifesto}>
          {t('navManifesto')}
        </button>
        <button type="button" className="home-nav-btn" onClick={onOpenHistory}>
          {t('navHistory')}
        </button>
        <button type="button" className="home-nav-btn" onClick={toggleLanguage} lang={lang === 'sq' ? 'en' : 'sq'}>
          {t('languageToggle')}
        </button>
      </nav>
    </div>
  );
}

export default HomeScreenPoster;
