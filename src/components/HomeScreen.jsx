import { useState } from 'react';
import '../styles/glass-traces.css';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { isPlausibleBarcode } from '../lib/gs1.js';

// HOME — rebuilt 2026-09-11 per direct owner feedback rejecting the
// giant-cropped-poster treatment that was here before ("wrong is
// everything... looks bad"). This is a conventional, clean mobile layout:
// white background, red used only as an accent (logo, primary button,
// active states) — never as a full-bleed background — real readable type
// at normal sizes, and the scan action as the unmistakable primary CTA.
// Product browsing ("eksploro") is one quiet secondary link among several,
// not a grid competing with scan for attention.
//
// *** DO NOT REVERT THIS TO THE OLD `.screen`/`.stagger` POSTER LAYOUT. ***
// The owner explicitly rejected that direction on 2026-09-11 ("this looks
// absolutely dogshit... looks bad... wrong is everything"). If you are
// about to "restore" the reference-matched version of this
// specific file, stop — the reference doc is stale for THIS screen. This
// note exists because that revert already happened once and got deployed
// to production by mistake.
//
// Deliberately scoped to ONLY this file + its own `.vj-home2-*` CSS block
// in App.css, so it doesn't touch `.screen` / `.stagger` / `.logo` etc.
// that the post-scan story screens still rely on.
export default function HomeScreen({ scanCount, onScan, onSubmitBarcode, onSearchExplore, onOpenExplore, onOpenAlternativa, onOpenManifesto, onOpenHistory }) {
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

  return (
    <div className="vj-home2">
      {/* Traces on the pane. Owner, 2026-09-17: the front section "looks
          like a window", so he asked for dark-red hints "left on the glass"
          — explicitly not a splatter. Static, decorative, aria-hidden and
          pointer-events:none, so it carries no meaning and can never
          intercept a tap. See src/styles/glass-traces.css for why it is
          built the way it is. */}
      <div className="vj-glass-traces" aria-hidden="true" />
      <header className="vj-home2-bar">
        <img src="/logo-wordmark-red.png" alt="vendorja" className="vj-home2-logo" />
        <button type="button" className="vj-home2-lang" onClick={toggleLanguage} lang={lang === 'sq' ? 'en' : 'sq'}>
          {t('languageToggle')}
        </button>
      </header>

      <main className="vj-home2-main">
        <p className="vj-home2-tagline">{t('homeTaglineAria')}</p>

        <button type="button" className="vj-home2-scan" onClick={onScan} aria-label={t('homeScanAria')}>
          <span className="vj-home2-scan-icon" aria-hidden="true">
            <svg viewBox="0 0 48 48" width="26" height="26" fill="none">
              <path d="M6 16V9a3 3 0 0 1 3-3h7" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" />
              <path d="M42 16V9a3 3 0 0 0-3-3h-7" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" />
              <path d="M6 32v7a3 3 0 0 0 3 3h7" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" />
              <path d="M42 32v7a3 3 0 0 1-3 3h-7" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" />
              <rect x="17" y="17" width="14" height="14" rx="2" fill="currentColor" />
            </svg>
          </span>
          {t('homeScanLabel')}
        </button>

        <form className="vj-home2-search" onSubmit={handleSearchSubmit}>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('homeSearchPlaceholder')}
            aria-label={t('homeSearchPlaceholder')}
            inputMode="search"
          />
          <button type="submit" aria-label={t('homeSearchPlaceholder')}>
            →
          </button>
        </form>

        <p className="vj-home2-counter">{counterText}</p>
      </main>

      {/* ALTERNATIVA IS NOT A NAV ITEM.
          Owner, 2026-09-17: "place this alternativa above the three so it
          doesnt ruin the symmetry its three down as navbar this as a button
          on the middle of the page a bit above the navbar shiko
          alternativat!"
          It was briefly the fourth item in the footer nav, which wrapped to
          two lines at 1346px and broke the three-up rhythm. The nav is back
          to exactly three, and this is its own centred call to action
          sitting just above it.
          Styled as the GLASS button, not the red one, on purpose: SKANO is
          the primary red on this screen and the standing palette rule is
          that red is CTA-only and "almost nothing". Two competing reds
          above each other would spend the one accent the design has. */}
      <div className="vj-home2-altcta">
        <button type="button" className="vj-btn-flat vj-btn-black" onClick={onOpenAlternativa}>
          {t('homeAlternativaCta')}
        </button>
      </div>

      <footer className="vj-home2-footer">
        <nav className="vj-home2-nav" aria-label="navigation">
          <button type="button" onClick={onOpenExplore}>
            {t('navExplore')}
          </button>
          <button type="button" onClick={onOpenManifesto}>
            {t('navManifesto')}
          </button>
          <button type="button" onClick={onOpenHistory}>
            {t('navHistory')}
          </button>
          {/* INSIDE the nav, not under it.
              Owner, 2026-09-17: "powered by shend.dev must be over it like
              on it inside not under . and must look like a forwarding
              button aswell". So it sits in the nav row with the three
              links, styled as a small forwarding control rather than as a
              footnote hanging below the bar. */}
          <a
            className="vj-nav-credit"
            href="https://shend.dev/"
            target="_blank"
            rel="me noopener noreferrer"
          >
            shend.dev
          </a>
        </nav>
      </footer>


    </div>
  );
}
