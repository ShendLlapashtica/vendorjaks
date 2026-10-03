import { useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { localClaimBadge } from '../../lib/flagTone.js';
import { alternativeDisplayName } from '../../lib/productName.js';
import ProductFacts from '../ProductFacts.jsx';
import Flag from '../Flag.jsx';

// EVERY alternative THAT ACTUALLY FITS THE SCANNED PRODUCT.
//
// This screen used to render the global roster — all 24 curated Kosovar and
// Albanian brands — regardless of what was scanned. The owner saw a ketchup
// scan list Birra Korça, Atlas Mills flour and ABI dairy underneath it and
// said: "this makes no sense only show the ones called for !! only show
// these when it's a passing alternative." (2026-09-12)
//
// They are right, and it also contradicted the app's own category rule: the
// same gate that stops a cookie being offered for an oil was being bypassed
// here, one screen below the place it was being enforced.
//
// So this now renders the RESOLVED alternatives for this specific scan —
// the same category-gated list the hero card takes its top pick from (see
// lib/categoryFamily.js) — minus that top pick, which is already shown
// above. When only one alternative passes, this screen renders nothing at
// all rather than padding the list out with unrelated brands.
function AltRow({ item , onSelectProduct }) {
  const { t } = useLanguage();
  const [imgBroken, setImgBroken] = useState(false);
  // THREE states, not two. `isKosovoCountry(country)` in a two-branch
  // ternary badged every shelf-tier candidate (country: null, meaning only
  // "on sale in Kosovo, not Serbian") as an ALBANIAN producer with an
  // Albanian flag. See lib/flagTone.js#localClaimBadge.
  const badge = localClaimBadge(item);
  const evidence = item.pairingEvidence;
  // Owner, 2026-09-18: "make every product everywhere clickable". Only
  // activatable when there is something real to open.
  const openable = typeof onSelectProduct === 'function' && Boolean(item.row || item.code);
  const openIt = () => onSelectProduct(item.row || { barcode: item.code, name: item.name, brand: item.brand });

  return (
    <li
      className={`vj-allalt-row is-${evidence || 'category'}${openable ? ' is-clickable' : ''}`}
      {...(openable
        ? {
            role: 'button',
            tabIndex: 0,
            onClick: openIt,
            onKeyDown: (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openIt();
              }
            },
          }
        : {})}
    >
      <span className="vj-allalt-media" aria-hidden="true">
        {item.image && !imgBroken ? (
          <img src={item.image} alt="" loading="lazy" onError={() => setImgBroken(true)} />
        ) : (
          badge.claimed && <Flag iso={badge.iso} name={badge.kind === 'kosovo' ? 'Kosovë' : 'Shqipëri'} size="sm" />
        )}
      </span>

      <span className="vj-allalt-text">
        <span className="vj-allalt-brand">{alternativeDisplayName(item, t('unknownBrand'))}</span>
        {item.company && <span className="vj-allalt-company">{item.company}</span>}
        {item.replaces?.length > 0 && (
          <span className="vj-allalt-replaces">{t('allAltReplaces', { brands: item.replaces.join(', ') })}</span>
        )}
        {item.categories?.length > 0 && <span className="vj-allalt-cats">{item.categories.join(' · ')}</span>}
        <ProductFacts product={item} className="vj-allalt-facts" />
      </span>

      <span className="vj-allalt-right">
        <span
          className={`vj-allalt-chip is-${badge.kind === 'kosovo' ? 'ks' : badge.kind === 'albania' ? 'al' : 'unclaimed'}`}
          title={badge.claimed ? undefined : t('badgeSoldInKosovoFull')}
        >
          {t(badge.labelKey)}
        </span>
        {evidence === 'reported' ? (
          <a className="vj-allalt-evidence is-reported" href={item.pairingUrl} target="_blank" rel="noreferrer">
            {t('reportedPairing')} ↗
          </a>
        ) : evidence === 'catalog' ? (
          <span className="vj-allalt-evidence is-catalog">{t('catalogSourced')}</span>
        ) : (
          <span className="vj-allalt-evidence is-category">{t('categoryMatchNotice')}</span>
        )}
      </span>
    </li>
  );
}

export default function AllAlternativesScreen({ alternatives, onSelectProduct }) {
  const { t } = useLanguage();

  const items = alternatives?.items || [];
  // The first item is the hero card on the verdict screen; don't repeat it.
  const rest = items.slice(1);

  if (alternatives?.status !== 'ready' || rest.length === 0) return null;

  const kosovo = rest.filter((i) => localClaimBadge(i).kind === 'kosovo').length;

  return (
    <section className="screen poster-snap vj-allalt-screen" aria-label={t('allAltTitle')}>
      <header className="vj-allalt-head">
        <h2>{t('allAltTitle')}</h2>
        <p className="vj-allalt-count">
          {t('allAltCount', { total: rest.length, kosovo, albania: rest.length - kosovo })}
        </p>
      </header>

      <ol className="vj-allalt-list">
        {rest.map((item) => (
          <AltRow key={item.code || item.brand} item={item}  onSelectProduct={onSelectProduct} />
        ))}
      </ol>

      <p className="vj-allalt-foot">{t('allAltFoot')}</p>
    </section>
  );
}
