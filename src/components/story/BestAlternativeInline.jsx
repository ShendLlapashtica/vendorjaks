import { useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { localClaimBadge } from '../../lib/flagTone.js';
import { alternativeDisplayName } from '../../lib/productName.js';
import ProductFacts from '../ProductFacts.jsx';
import Flag from '../Flag.jsx';

// THE LOCAL ALTERNATIVE, inline on the verdict screen, directly beneath the
// hero — not on a later screen you have to scroll to find.
//
// Owner, 2026-09-12: "this vipa chips alternative MUST HAVE A PHOTO AND MUST
// BE AT THE VERY TOP UNDER THE HERO ... so first JO E JONA . name of serb
// product . then local product name and photo".
//
// The alternative shown here is already category-safe: lib/categoryFamily.js
// gates every candidate so an oil can only ever be replaced by an oil.
//
// PHOTOS. `data/brand-alternatives.json` is a curated BRAND map, and brands
// do not inherently carry a pack shot — as of 2026-09-12 none of the 18
// alternative brands had one, and neither Open Food Facts (count 0 for these
// Kosovo brands) nor the Kosovo retail catalogue had an image to lend. Photos
// are being sourced from the producers' own official sites into
// /alternatives/<brand>.jpg. Until one lands for a given brand, this falls
// back to the country flag rather than a grey placeholder box — a flag is
// honest and carries meaning; an empty frame just looks broken.
export default function BestAlternativeInline({ alternatives, onSelectProduct }) {
  const { t } = useLanguage();
  const [imgBroken, setImgBroken] = useState(false);
  // Owner, 2026-09-18: "make every product everywhere clickable". This is
  // the inline best-alternative on the verdict screen — the very first
  // alternative a shopper sees after a scan, and it was the last surface
  // with no way through to the product.
  const openFor = (best) =>
    typeof onSelectProduct === 'function' && (best?.row || best?.code)
      ? {
          role: 'button',
          tabIndex: 0,
          onClick: () => onSelectProduct(best.row || { barcode: best.code, name: best.name, brand: best.brand }),
          onKeyDown: (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelectProduct(best.row || { barcode: best.code, name: best.name, brand: best.brand });
            }
          },
        }
      : {};

  const status = alternatives?.status || 'idle';
  const best = alternatives?.items?.[0] || null;

  // 'idle' used to render the loading line, which meant a screen where no
  // lookup was ever STARTED sat on "duke kërkuar…" forever — the real case
  // being a foreign product whose Open Food Facts lookup failed, so
  // App.jsx never called loadAlternatives() at all. A spinner that never
  // resolves is the worst version of an undocumented answer: it promises
  // one. 'idle' now means "nothing is coming", and says so.
  if (status === 'loading') {
    return <p className="vj-altinline-status">{t('loadingAlternatives')}</p>;
  }
  if (!best) {
    return (
      <div className="vj-altinline is-empty">
        <p className="vj-altinline-none-title">{t('noLocalAlternativeTitle')}</p>
        <p className="vj-altinline-none">{t('bestAltNone')}</p>
        <p className="vj-altinline-none-why">{t('bestAltNoneWhy')}</p>
      </div>
    );
  }

  // THREE states, not two. `isKosovoCountry(country)` in a two-branch
  // ternary badged every shelf-tier candidate (country: null, meaning only
  // "on sale in Kosovo, not Serbian") as an ALBANIAN producer with an
  // Albanian flag. See lib/flagTone.js#localClaimBadge.
  const badge = localClaimBadge(best);
  const reported = best.pairingEvidence === 'reported';
  const hasPhoto = Boolean(best.image) && !imgBroken;

  return (
    <div className="vj-altinline" {...openFor(best)}>
      <p className="vj-altinline-kicker">{t('bestAltTitle')}</p>

      <div className="vj-altinline-photo">
        {hasPhoto ? (
          <img src={best.image} alt={alternativeDisplayName(best, t('unknownBrand'))} onError={() => setImgBroken(true)} />
        ) : (
          badge.claimed && <Flag iso={badge.iso} name={badge.kind === 'kosovo' ? 'Kosovë' : 'Shqipëri'} size="lg" />
        )}
      </div>

      {/* `{best.brand || best.name}` rendered an empty paragraph when a
          candidate arrived with neither — the alternative with no name at
          all, which is precisely the thing the owner asked to be named. */}
      <p className="vj-altinline-brand">{alternativeDisplayName(best, t('unknownBrand'))}</p>
      {best.company && <p className="vj-altinline-company">{best.company}</p>}
      <ProductFacts product={best} className="vj-altinline-facts" />

      <span
        className={`vj-altinline-chip is-${badge.kind === 'kosovo' ? 'ks' : badge.kind === 'albania' ? 'al' : 'unclaimed'}`}
        title={badge.claimed ? undefined : t('badgeSoldInKosovoFull')}
      >
        {badge.claimed && <Flag iso={badge.iso} name={t(badge.labelKey)} size="md" />}
        {t(badge.labelKey)}
      </span>

      {/* A documented pairing and a same-category match are not equally
          strong and must never look alike. */}
      {reported ? (
        <p className="vj-altinline-why is-reported">
          {t('reportedPairing')}
          {best.pairingUrl && (
            <a href={best.pairingUrl} target="_blank" rel="noreferrer">
              {' '}
              {t('sourceLink')} ↗
            </a>
          )}
        </p>
      ) : (
        <p className="vj-altinline-why is-category">{t('categoryMatchNotice')}</p>
      )}
    </div>
  );
}
