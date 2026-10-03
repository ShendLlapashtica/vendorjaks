import { useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { localClaimBadge } from '../../lib/flagTone.js';
import { alternativeDisplayName } from '../../lib/productName.js';
import ProductFacts from '../ProductFacts.jsx';
import Flag from '../Flag.jsx';

// 04 · THE ONE ALTERNATIVE — the single product that best replaces the one
// just scanned. Sits directly beneath "vazhdo ↓" (owner, 2026-09-12:
// "here under vazhdo to be shown is the product that best passes as an
// alternative").
//
// THE RULE THIS SCREEN LIVES UNDER, in the owner's words: "i will expect
// from you to find the exact alternative of that product. if its sunflower
// seed oil you must not show a kosovar cookie."
//
// That is enforced upstream, not here — lib/categoryFamily.js gates every
// candidate so a match can only come from the same product family, and
// aisle-level Open Food Facts tags (`en:snacks`,
// `en:plant-based-foods-and-beverages`) are refused as evidence entirely.
// By the time an item reaches this component it is already category-safe.
//
// So the honest empty state matters as much as the match: when nothing
// passes the gate this screen says so plainly. A wrong alternative is worse
// than none — it is the one thing that would make a shopper stop trusting
// every other verdict in the app.
export default function BestAlternativeScreen({ alternatives, scannedName, onSelectProduct }) {
  const { t } = useLanguage();
  const [imgBroken, setImgBroken] = useState(false);

  const status = alternatives?.status || 'idle';
  const best = alternatives?.items?.[0] || null;

  if (status === 'loading') {
    return (
      <section className="screen poster-snap vj-best" aria-label={t('bestAltTitle')}>
        <p className="vj-best-status">{t('loadingAlternatives')}</p>
      </section>
    );
  }

  if (!best) {
    return (
      <section className="screen poster-snap vj-best is-empty" aria-label={t('bestAltTitle')}>
        <p className="vj-best-kicker">{t('bestAltTitle')}</p>
        <p className="vj-best-none-title">{t('noLocalAlternativeTitle')}</p>
        <p className="vj-best-none">{t('bestAltNone')}</p>
        <p className="vj-best-none-why">{t('bestAltNoneWhy')}</p>
      </section>
    );
  }

  // THREE states, not two. `isKosovoCountry(country)` in a two-branch
  // ternary badged every shelf-tier candidate (country: null, meaning only
  // "on sale in Kosovo, not Serbian") as an ALBANIAN producer with an
  // Albanian flag. See lib/flagTone.js#localClaimBadge.
  const badge = localClaimBadge(best);
  const bestName = alternativeDisplayName(best, t('unknownBrand'));
  const reported = best.pairingEvidence === 'reported';

  return (
    <section className="screen poster-snap vj-best" aria-label={`${t('bestAltTitle')} — ${bestName}`}>
      <p className="vj-best-kicker">{t('bestAltTitle')}</p>

      <div className="vj-best-card">
        <div className="vj-best-media">
          {best.image && !imgBroken ? (
            <img src={best.image} alt={bestName} onError={() => setImgBroken(true)} />
          ) : (
            badge.claimed && <Flag iso={badge.iso} name={badge.kind === 'kosovo' ? 'Kosovë' : 'Shqipëri'} size="lg" />
          )}
        </div>

        <p className="vj-best-brand">{bestName}</p>
        {best.company && <p className="vj-best-company">{best.company}</p>}
        {best.name && best.brand && best.name !== best.brand && <p className="vj-best-product">{best.name}</p>}
        {/* Was `{price && …}`: a curated pairing carries price: null, so the
            price line silently vanished on exactly the alternatives the app
            most wants a shopper to act on. */}
        <ProductFacts product={best} className="vj-best-facts" />

        <span
          className={`vj-best-chip is-${badge.kind === 'kosovo' ? 'ks' : badge.kind === 'albania' ? 'al' : 'unclaimed'}`}
          title={badge.claimed ? undefined : t('badgeSoldInKosovoFull')}
        >
          {badge.claimed && <Flag iso={badge.iso} name={t(badge.labelKey)} size="md" />}
          {t(badge.labelKey)}
        </span>

        {/* Why this one, and how strong the claim is. A documented pairing
            and a same-category match are not equally strong and must never
            look alike. */}
        {reported ? (
          <p className="vj-best-why is-reported">
            {t('reportedPairing')}
            {best.pairingUrl && (
              <a href={best.pairingUrl} target="_blank" rel="noreferrer">
                {' '}
                {t('sourceLink')} ↗
              </a>
            )}
          </p>
        ) : (
          <p className="vj-best-why is-category">
            {best.matchedTag ? t('bestAltSameCategory', { category: best.matchedTag }) : t('categoryMatchNotice')}
          </p>
        )}

        {scannedName && <p className="vj-best-instead">{t('allAltReplaces', { brands: scannedName })}</p>}
      </div>

      <p className="vj-best-more">{t('bestAltMore')}</p>
    </section>
  );
}
