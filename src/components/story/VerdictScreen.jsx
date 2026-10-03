import { useMemo, useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { findVerifiedOrigin, countryCodeName } from '../../lib/productOrigins.js';
import PosterScreen from '../poster/PosterScreen.jsx';
import TreatmentA from '../poster/TreatmentA.jsx';
import Flag from '../Flag.jsx';
import GsFootnote from '../GsFootnote.jsx';
import { displayNameOrUnknown } from '../../lib/productName.js';
import ProductSpecs from '../ProductSpecs.jsx';
import BestAlternativeInline from './BestAlternativeInline.jsx';

// 03 · VERDICT (vendimi)
//
// Layout is the owner's, stated directly (2026-09-12): "i scan, must show
// product photo how it looks like, and in the meantime the flag above it
// (if a boycott flag must be BW) and under it alternatives."
//
//   FLAG (black & white when the verdict is boycott)
//   PRODUCT PHOTO — what the thing actually looks like on the shelf
//   VERDICT WORD
//   [the complete alternatives roster follows on the next screen]
//
// The verdict is PURE local computation from the barcode's own digits plus
// the local boycott table — it renders with zero network latency. The photo
// and the product name arrive later from Open Food Facts and are never
// allowed to delay or hide it.

export default function VerdictScreen({ product, productStatus, code, errorKind, data, classify, onOpenFaq, alternatives , onSelectProduct }) {
  const { t, lang } = useLanguage();
  const [reported, setReported] = useState(false);
  const [flagged, setFlagged] = useState(false);

  const origin = useMemo(
    () => findVerifiedOrigin({ code, brand: product?.brand }, data?.productOrigins),
    [code, product?.brand, data?.productOrigins]
  );

  const boycott = classify?.boycott || null;

  // ORIGIN WORDING (non-negotiable): "barkod i regjistruar në GS1 Serbi",
  // never "prodhuar në Serbi" unless product-origins.json verifies it.
  let originLine;
  let showReport = false;
  if (origin?.verified && origin.isSerbia) {
    originLine = t('originVerifiedSerbia');
  } else if (origin?.verified && origin.productionCountry) {
    originLine = t('originCorrectionNote', { country: countryCodeName(origin.productionCountry, lang) });
  } else {
    originLine = t('originUnverified');
    showReport = true;
  }

  // The boycott table carries a name/size for codes Open Food Facts has
  // never heard of (8606017372806 is one), so the screen is not blank just
  // because OFF is missing the product.
  // Never null: a verdict whose scanned-product line is blank is the
  // "random product" case the owner objected to.
  const name = displayNameOrUnknown(product, classify, code, t('unknownProductName'));
  const brand = product?.brand || boycott?.brand || null;
  const quantity = product?.quantity || boycott?.quantity || null;
  const metaBits = [name, brand, quantity].filter(Boolean).join(' · ');

  const issuerCountry = (lang === 'sq' ? classify?.countrySq : classify?.country) || classify?.country;
  const ariaLabel = `${t('verdictStackWord')} — ${metaBits || code} — ${originLine}`;

  return (
    <PosterScreen bg="red" ariaLabel={ariaLabel} className="vj-story-verdict">
      {/* 1 · THE FLAG — the issuing country's, drained of colour because the
          verdict is boycott. For 3870508000157 this is Bosnia's flag, not
          Serbia's, and the discrepancy line below says why that is. */}
      <div className="vj-verdict-flag">
        <Flag iso={classify?.iso || 'RS'} name={issuerCountry || 'Serbi'} tone="muted" size="hero" />
        <p className="vj-verdict-flag-caption">
          {t('prefixLabel', { prefix: classify?.prefix || '860' })} · {issuerCountry}
        </p>
      </div>

      {/* The prefix said one country, the brand belongs to another. This is
          the most persuasive fact on the screen, so it is stated in full
          rather than quietly resolved behind the scenes. */}
      {boycott && classify?.issuerDiffersFromOwner && (
        <p className="vj-verdict-discrepancy">
          {t('boycottIssuerDiffers', { issuer: issuerCountry, company: boycott.company || boycott.brand })}
          {boycott.sourceUrl && (
            <a href={boycott.sourceUrl} target="_blank" rel="noreferrer">
              {' '}
              {t('sourceLink')} ↗
            </a>
          )}
        </p>
      )}

      {/* NO PRODUCT PHOTO FOR A BOYCOTT TARGET.
          Owner, 2026-09-12: "dont show a picture when its an non-local ever
          why serb product photo show". Correct — a hero pack shot of the
          product you are telling someone not to buy is free advertising for
          it, and it was the largest thing on the screen. The only photo on
          this page now is the LOCAL alternative's, which is the thing we
          actually want recognised on a shelf. */}
      {/* 3 · THE VERDICT WORD */}
      <TreatmentA lines={[t('verdictStackWord')]} />

      {/* 4 · THE SERBIAN PRODUCT'S NAME, then 5 · THE LOCAL ALTERNATIVE
          with its photo — in that order, directly under the hero (owner,
          2026-09-12: "first JO E JONA . name of serb product . then local
          product name and photo"). Everything else comes after. */}
      {metaBits && <p className="vj-verdict-scanned-name">{metaBits}</p>}

      <BestAlternativeInline alternatives={alternatives} onSelectProduct={onSelectProduct} />

      {/* Why an 860 product is boycotted even when the factory is elsewhere
          (owner, 2026-09-12): "even if a product is not serbian but is 860
          is productive to serbs so that its boycott aswell". */}
      <div className="vj-boycott860">
        <p className="vj-boycott860-word">{t('boycott860Word')}</p>
        <p className="vj-boycott860-body">{t('boycott860Body')}</p>
      </div>

      {/* FULL SPECS — the exact product, not just its name: flavour, net
          weight, serving, nutrition, ingredients (owner, 2026-09-12). */}
      <ProductSpecs product={product} fallbackName={name} fallbackQuantity={quantity} />

      {/* Open Food Facts couldn't identify this exact product — the verdict
          above is untouched by this; only the product-name line is missing. */}
      {productStatus === 'not_found' && !metaBits && (
        <div className="verdict-info">
          {errorKind === 'not_found' ? (
            <>
              <p className="name">{t('failOffNotFoundWord')}</p>
              <p className="origin">{t('failOffNotFoundBody')}</p>
              <button type="button" className="report-btn" onClick={() => setFlagged(true)} disabled={flagged}>
                {flagged ? t('failOffSubmitThanks') : t('failOffSubmitReview')}
              </button>
            </>
          ) : (
            <>
              <p className="name">{t('failOffSlowWord')}</p>
              <p className="origin">{t('failOffSlowBody')}</p>
            </>
          )}
          <p className="origin" style={{ marginTop: '2cqw' }}>
            {originLine}
          </p>
        </div>
      )}

      <div className="meta scroll-hint">{t('verdictScrollHint')}</div>

      {/* FOOTER. Owner, 2026-09-12: the product meta line and the
          registration caveat belong "at the very end of the footer", not
          competing with the verdict. */}
      <footer className="vj-verdict-footer">
        {metaBits && <p className="vj-verdict-footer-meta">{metaBits}</p>}
        <p className="vj-verdict-footer-origin">{originLine}</p>
        {showReport && (
          <button type="button" className="report-btn" onClick={() => setReported(true)} disabled={reported}>
            {reported ? t('reportedThanks') : t('reportButton')}
          </button>
        )}
        <GsFootnote onOpenFaq={onOpenFaq} tone="dark" />
      </footer>
    </PosterScreen>
  );
}
