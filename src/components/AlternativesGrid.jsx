import { useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { alternativeDisplayName } from '../lib/productName.js';
import { productStance, stanceClass, localClaimBadge } from '../lib/flagTone.js';
import ProductFacts from './ProductFacts.jsx';
import ProductBarcode from './ProductBarcode.jsx';
import Flag from './Flag.jsx';

// The origin chip on an alternative card. THREE states, not two.
//
// It used to be `<Flag iso={kosovo ? 'XK' : 'AL'} />` — a two-branch
// ternary over a three-state fact. Shelf-tier candidates carry
// `country: null` by design (it means "same kind of product, on sale in
// Kosovo, not Serbian" and says nothing about the producer), so every one
// of them fell into the else branch and was badged with an ALBANIAN FLAG
// and the word "shqiptare". 45 items on the current eval claimed an
// Albanian producer that nothing in the data supports. That is the
// project's central rule — "sold in Kosovo" is not "made by a Kosovar
// brand" — running backwards.
//
// `isLocalClaim` (from the resolver) is the fact this should have been
// keyed off all along, and it is read strictly as `=== true`: undefined
// and false are both "not proven local".
//
// Owner: "alternativa vendore show always a miniflag if KS or Albanian .
// and more better pronounced". So a genuinely local alternative gets a
// LARGER, more pronounced flag than before — and one with no origin claim
// gets no flag at all, because a flag is a factual claim.
function CountryChip({ item }) {
  const { t } = useLanguage();
  const badge = localClaimBadge(item);

  if (!badge.claimed) {
    return (
      <span className="vendore-chip is-unclaimed" title={t('badgeSoldInKosovoFull')}>
        {t('badgeSoldInKosovo')}
      </span>
    );
  }

  const label = t(badge.labelKey);
  return (
    <span className="vendore-chip is-claimed">
      {/* "more better pronounced" — md rather than sm. */}
      <Flag iso={badge.iso} name={label} size="md" />
      {badge.kind === 'kosovo' && <i className="dot" aria-hidden="true" />}
      {label}
    </span>
  );
}

function AltCard({ item, data, onSelectProduct }) {
  // Owner, 2026-09-18: "make every product everywhere clickable".
  // Activatable only when there is something real to open. Not a <button>
  // wrapper: these cards already contain a flag, a barcode and sometimes a
  // source link, and a button inside a button is invalid HTML browsers
  // resolve unpredictably — so role/tabIndex/keydown on the card itself.
  const canOpen = typeof onSelectProduct === 'function' && Boolean(item.row || item.code);
  const openProps = canOpen
    ? {
        role: 'button',
        tabIndex: 0,
        onClick: () => onSelectProduct(item.row || { barcode: item.code, name: item.name, brand: item.brand }),
        onKeyDown: (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelectProduct(item.row || { barcode: item.code, name: item.name, brand: item.brand });
          }
        },
      }
    : {};
  const { t } = useLanguage();
  const [imgBroken, setImgBroken] = useState(false);
  // BLACK AND WHITE, no exception (owner, 2026-09-16). An alternative is
  // Kosovar or Albanian by construction, so in practice this never fires —
  // which is exactly why it is computed by the same shared function as
  // every other surface rather than assumed away. If the resolver ever
  // returns something Serbian or from a non-recognising country, this card
  // greys out on its own instead of quietly being the one screen that
  // shows a boycott target in colour.
  const stance = productStance(item, data);

  if (item.isBrandLevel) {
    const isReported = item.pairingEvidence === 'reported';
    return (
      <div className={`vj-alt-card vj-alt-card-brand ${isReported ? 'is-reported' : 'is-category'}${stanceClass(stance)}`} {...openProps}>
        <div className="vj-alt-card-media">
          <span className="vj-alt-card-placeholder" aria-hidden="true">
            🏷️
          </span>
          <span className="vj-alt-badge">
            <CountryChip item={item} />
          </span>
        </div>
        <div className="vj-alt-card-body">
          {/* `{item.brand}` alone rendered an EMPTY heading whenever a
              brand-level candidate arrived without a brand string — an
              anonymous card the shopper cannot act on or report. */}
          <h4>{alternativeDisplayName(item, t('unknownBrand'))}</h4>
          {item.company && <p className="vj-alt-brand">{item.company}</p>}
          {/* The barcode, always (owner, 2026-09-16). A brand-level
              pairing legitimately has no code; saying "pa barkod" is the
              honest version of that and is itself informative — it tells
              the shopper this suggestion is a brand, not a scanned SKU. */}
          <ProductBarcode product={item} size="sm" className="vj-alt-card-barcode" />
          {/* An alternative with no price is the COMMON case here: curated
              pairings and Open Food Facts hits carry price: null. Saying so
              is the point — a silent gap reads as "free". */}
          <ProductFacts product={item} className="vj-alt-card-facts" />
          {/* Confidence level — deliberately NOT just different wording: a
              sourced pairing gets a bold red-accented block with its source
              link; a same-category guess gets a small, muted, unlinked
              note. If a shopper can't tell them apart at a glance, the app
              is claiming more than it has earned. */}
          {isReported ? (
            <p className="vj-confidence vj-confidence-reported">
              {t('reportedPairing')}
              {item.pairingUrl && (
                <a className="vj-source-link" href={item.pairingUrl} target="_blank" rel="noreferrer">
                  {t('sourceLink')} ↗
                </a>
              )}
            </p>
          ) : (
            <p className="vj-confidence vj-confidence-category">{t('categoryMatchNotice')}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`vj-alt-card${stanceClass(stance)}`} {...openProps}>
      <div className="vj-alt-card-media">
        {item.image && !imgBroken ? (
          <img src={item.image} alt={alternativeDisplayName({ ...item, brand: item.name || item.brand }, t('unknownProductName'))} loading="lazy" onError={() => setImgBroken(true)} />
        ) : (
          <span className="vj-alt-card-placeholder" aria-hidden="true">
            📦
          </span>
        )}
        <span className="vj-alt-badge">
          <CountryChip item={item} />
        </span>
        {item.live && <span className="vj-alt-badge-live">{t('badgeLive')}</span>}
      </div>
      <div className="vj-alt-card-body">
        <h4>{alternativeDisplayName({ ...item, brand: item.name || item.brand }, t('unknownProductName'))}</h4>
        {item.brand && <p className="vj-alt-brand">{item.brand}</p>}
        <ProductFacts product={item} className="vj-alt-card-facts" />
        <ProductBarcode product={item} size="sm" className="vj-alt-card-barcode" />
        <p className="vj-confidence vj-confidence-category">{t('categoryMatchNotice')}</p>
      </div>
    </div>
  );
}

export default function AlternativesGrid({ items, data , onSelectProduct }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="vj-alternatives-grid">
      {items.map((item) => (
        <AltCard key={item.code || `${item.brand}-${item.company || ''}`} item={item} data={data} onSelectProduct={onSelectProduct} />
      ))}
    </div>
  );
}
