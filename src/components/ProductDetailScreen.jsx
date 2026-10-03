import { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { resolveAlternativesForRetailProduct } from '../lib/resolveAlternatives.js';
import { findStoresForChain } from '../lib/stores.js';
import { countryCodeName } from '../lib/productOrigins.js';
import { productStance, stanceClass } from '../lib/flagTone.js';
import { ARGUMENT_SCREENS } from '../content/argument.js';
import AlternativesGrid from './AlternativesGrid.jsx';
import StoreList from './StoreList.jsx';
import GsFootnote from './GsFootnote.jsx';
import ProductFlag from './ProductFlag.jsx';
import ProductBarcode from './ProductBarcode.jsx';
import Flag from './Flag.jsx';
import { displayNameOrUnknown } from '../lib/productName.js';
import ProductFacts from './ProductFacts.jsx';

// THREE FACTS, THREE LINES — the Bimilk block.
//
// Owner, 2026-09-16: "i saw a bimilk which is originally a NMK product get
// labeled as serbian what an edgecase . be wary of those."
//
// Registration, manufacture and ownership are different claims with
// different evidence, and the app used to collapse all three into the one
// word "Serbian". This states each separately, with its own flag and its
// own source, and lets the shopper weigh them. It renders only when the
// facts actually diverge — on an ordinary product there is nothing to
// disentangle and the block would be noise.
function SplitOriginBlock({ split, classify, lang, t }) {
  // ONLY when registration and manufacture actually disagree. A plain
  // Serbian product has nothing to disentangle, and heading its page
  // "origjinë e ndarë" would be its own small untruth — the boycott
  // section below already carries its ownership line.
  if (!split?.divergent) return null;

  const regName = classify ? (lang === 'sq' ? classify.countrySq : classify.country) : null;
  const madeName = split.manufactureIso ? countryCodeName(split.manufactureIso, lang) : null;

  return (
    <section className="vj-origin-split" aria-label={t('originSplitBadge')}>
      <p className="vj-origin-split-title">{t('originSplitBadge')}</p>

      {classify?.prefix && regName && (
        <p className="vj-origin-line">
          <Flag iso={classify.iso} name={regName} size="sm" tone="muted" />
          <span>{t('originRegisteredIn', { country: regName, prefix: classify.prefix })}</span>
        </p>
      )}

      {madeName && (
        <p className="vj-origin-line">
          <Flag iso={split.manufactureIso} name={madeName} size="sm" />
          <span>
            {split.manufactureCity
              ? t('originMadeInCity', { city: split.manufactureCity, country: madeName })
              : t('originMadeIn', { country: madeName })}
            {split.manufactureCompany ? ` — ${split.manufactureCompany}` : ''}
          </span>
          {split.manufactureSourceUrl && (
            <a className="vj-origin-src" href={split.manufactureSourceUrl} target="_blank" rel="noreferrer">
              {t('originSourceLink')} ↗
            </a>
          )}
        </p>
      )}

      {split.ownership && (
        <p className="vj-origin-line">
          {split.ownershipIso && <Flag iso={split.ownershipIso} name={countryCodeName(split.ownershipIso, lang)} size="sm" tone="muted" />}
          <span>{t('originOwnedBy', { owner: split.ownership })}</span>
          {split.ownershipSourceUrl && (
            <a className="vj-origin-src" href={split.ownershipSourceUrl} target="_blank" rel="noreferrer">
              {t('originSourceLink')} ↗
            </a>
          )}
        </p>
      )}

      <p className="vj-origin-note">{t('originSplitExplain')}</p>
    </section>
  );
}

const EMPTY_ALT_STATE = { status: 'idle', items: [], source: null };
const CURATED_SOURCES = new Set(['brand-match', 'brand-category-match']);
const FALLBACK_SOURCES = new Set(['static-pool', 'live', 'catalog-category-fallback']);

// ALTERNATIVE / PRODUCER PAGE — white background, red only for the header
// bar and buttons, per the palette rule. Answers three things: what the
// product is, what the local alternative is (only when Serbian-registered),
// and where to buy nearby.
export default function ProductDetailScreen({ product, data, onBack, onShare, onOpenFaq, onSelectProduct }) {
  const { t, lang } = useLanguage();
  const [altState, setAltState] = useState(EMPTY_ALT_STATE);
  const [imgBroken, setImgBroken] = useState(false);

  // ONE stance for the whole app — see lib/flagTone.js#productStance. This
  // page used to compute its own `classify` from the prefix alone, so it
  // could disagree with the row that opened it: a boycott-table hit on a
  // Bosnian prefix was flagged in /eksploro and clean here, and an 860 code
  // with a sourced non-Serbian production location was called Serbian on
  // both. Now there is a single answer.
  const stance = useMemo(() => productStance(product, data), [product, data]);
  const { classify, split } = stance;
  const isSerbian = stance.flagged;
  const displayName = displayNameOrUnknown(product, classify, product.barcode || product.id, t('unknownProductName'));

  // Ownership + "why not to buy this" — real, sourced data only: the
  // `ownership` field comes from data/product-origins.json (verified
  // company research), and the boycott reasoning reuses the same sourced
  // ICJ/ICTY/UN facts the scan-story "argument" screens use (never
  // invented here). Picking a stable-but-varied pair per product (by
  // barcode) rather than always the same two facts.
  const origin = stance.origin;
  const boycottFacts = useMemo(() => {
    if (!isSerbian || ARGUMENT_SCREENS.length === 0) return [];
    const seed = String(product.barcode || product.id || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const start = seed % ARGUMENT_SCREENS.length;
    return [ARGUMENT_SCREENS[start], ARGUMENT_SCREENS[(start + 1) % ARGUMENT_SCREENS.length]];
  }, [isSerbian, product.barcode, product.id]);

  useEffect(() => {
    if (!isSerbian) {
      setAltState(EMPTY_ALT_STATE);
      return;
    }
    let cancelled = false;
    setAltState({ status: 'loading', items: [], source: null });
    resolveAlternativesForRetailProduct(product, data).then((result) => {
      if (cancelled) return;
      setAltState({ status: 'ready', items: result.items, source: result.source });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id, isSerbian]);

  const matchingStores = findStoresForChain(data?.kosovoStores?.stores, [product.source, product.sourceLabel]);

  const altSubtitle = CURATED_SOURCES.has(altState.source)
    ? t('alternativesSubtitleSerbian')
    : FALLBACK_SOURCES.has(altState.source)
    ? t('alternativesFallbackSubtitle')
    : null;

  const firstAlt = altState.items[0];

  return (
    /* BLACK AND WHITE, no exception (owner, 2026-09-16). The two classes
       drive the single greyscale rule in App.css; neither was ever applied
       here, so the detail hero of a Serbian or non-recognising product was
       still in full colour even though the row that opened it was grey. */
    <div className={`vj-alt-page${stanceClass(stance)}`}>
      <div className="vj-alt-header-bar">
        <button className="vj-alt-back" type="button" onClick={onBack}>
          ← {t('backToExplore')}
        </button>
        {isSerbian && (
          <button className="vj-alt-share" type="button" onClick={() => onShare({ serbianName: displayName, alternativeName: firstAlt?.brand || firstAlt?.name || '' })}>
            {t('shareButton')}
          </button>
        )}
      </div>

      <div className="vj-alt-body">
        {/* 1) WHAT THE PRODUCT IS */}
        {/* HERO. Owner, 2026-09-12: "in eksploro i click on a product. it
            must be shown big as a hero section almost" — the photo was a
            small thumbnail beside the title. */}
        <div className="vj-alt-hero">
          <div className="vj-alt-hero-media">
            {product.image && !imgBroken ? (
              <img src={product.image} alt={displayName} onError={() => setImgBroken(true)} />
            ) : (
              <span className="vj-alt-photo-placeholder" aria-hidden="true">
                📦
              </span>
            )}
          </div>
          <h1 className="vj-alt-hero-name">{displayName}</h1>
          {product.brand && <p className="vj-alt-hero-brand">{product.brand}</p>}
          {/* Grams AND price, both always stated. The price was `{price &&
              …}` — an empty hero with no explanation whenever the row had
              none — and the pack size was never shown at all. */}
          <ProductFacts product={product} className="vj-alt-hero-facts" />
          <span className="vj-alt-hero-meta">
            <ProductFlag product={product} data={data} size="md" showName showTag />
            {product.isLocalBrand === true && (
              <span className="vendore-chip">
                <i className="dot" aria-hidden="true" />
                {t('badgeVendore')}
              </span>
            )}
          </span>
          {/* THE EVIDENCE. Owner, 2026-09-16: "show always barcode for
              it". This is the number the shopper checks against the pack
              in their hand; without it every statement below is an
              assertion they cannot verify. Absent is stated, not hidden. */}
          <ProductBarcode product={product} size="md" className="vj-alt-hero-barcode" />
        </div>

        {/* Registration ≠ manufacture ≠ ownership, when they actually differ. */}
        <SplitOriginBlock split={split} classify={classify} lang={lang} t={t} />

        {isSerbian && (
          <div className="vj-alt-flag-banner">
            <p>
              {lang === 'sq'
                ? `"${displayName}" ka një barkod të regjistruar në GS1 Serbi.`
                : `"${displayName}" has a barcode registered with GS1 Serbia.`}
            </p>
          </div>
        )}

        {/* Suppressed when SplitOriginBlock is on screen — it states the
            same registration fact, in context, next to the two facts that
            disagree with it. Two copies would read as two claims. */}
        {classify?.prefix && classify.country && !split?.divergent && (
          <p className="vj-alt-issued-line">{t('issuedBy', { prefix: classify.prefix, country: lang === 'sq' ? classify.countrySq : classify.country })}</p>
        )}

        {/* The long GS1 explainer used to sit here as an inline <details>
            block on EVERY product. Owner, 2026-09-12: "if apple and if
            normal nonserb product like this dont bother showing this text
            ... this text GS1 must be footnoted and referenced in footer".
            So it is gone from the body; the one-line footnote at the bottom
            of this screen carries it, and links to the Q&A where the full
            explanation now lives. */}

        {/* 2) WHAT THE ALTERNATIVE IS — only surfaced when Serbian-registered */}
        {isSerbian && (
          <>
            <h2 className="vj-alt-section-title">{t('alternativesTitle')}</h2>
            {altSubtitle && <p className="vj-alt-section-subtitle">{altSubtitle}</p>}

            {altState.status === 'loading' && <p className="vj-alt-section-subtitle">{t('loadingAlternatives')}</p>}

            {altState.status === 'ready' && altState.items.length > 0 && <AlternativesGrid items={altState.items} data={data} onSelectProduct={onSelectProduct} />}

            {altState.status === 'ready' && altState.items.length === 0 && (
              <div className="vj-alt-empty-box">
                <p>{t('alternativesNoneAtAll')}</p>
              </div>
            )}
          </>
        )}

        {/* 3) WHY NOT TO BUY THIS — Serbian-registered products only.
            No "where to buy" here — this is a boycott page, not a shopping
            page. Ownership comes from the verified data/product-origins.json
            table; the reasons reuse the same sourced ICJ/ICTY/UN facts as
            the scan-story argument screens, never invented here. */}
        {isSerbian ? (
          <>
            <h2 className="vj-alt-section-title vj-alt-boycott-title">{t('whyBoycottTitle')}</h2>
            {origin?.ownership && (
              <p className="vj-alt-section-subtitle">
                <strong>{t('ownershipLabel')}:</strong> {origin.ownership}
              </p>
            )}
            {boycottFacts.map((item) => {
              const text = lang === 'sq' ? item.sq : item.en || item.sq;
              const source = item.source || {};
              const sourceLine = [source.institution, source.document, source.year].filter(Boolean).join(', ');
              return (
                <div className="vj-alt-empty-box" key={item.id}>
                  <p>{text}</p>
                  {sourceLine && (
                    <p className="vj-alt-meta-line">
                      {sourceLine}
                      {source.url && (
                        <>
                          {' '}
                          <a href={source.url} target="_blank" rel="noreferrer">
                            ↗
                          </a>
                        </>
                      )}
                    </p>
                  )}
                </div>
              );
            })}
          </>
        ) : (
          <>
            {/* WHERE TO BUY NEARBY — only for non-Serbian / local products. */}
            <h2 className="vj-alt-section-title">{t('nearbyTitle')}</h2>
            {(product.source || product.sourceLabel) && (
              <p className="vj-alt-section-subtitle">
                {t('listedAtIntro')} {product.sourceLabel || product.source}
              </p>
            )}
            <StoreList key={product.id} stores={matchingStores} />

            {product.url && (
              <a className="vj-alt-source-link" href={product.url} target="_blank" rel="noreferrer">
                {t('viewOnStoreSite')} ↗
              </a>
            )}
          </>
        )}

        {/* Footer: the GS1 caveat, one line, referenced rather than
            explained inline. Shown on every product — apple included. */}
        <GsFootnote onOpenFaq={onOpenFaq} tone="light" />
      </div>
    </div>
  );
}
