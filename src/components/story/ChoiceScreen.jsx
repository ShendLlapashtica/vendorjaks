import { useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { isKosovoCountry } from '../../lib/matcher.js';
import { findStoresForChain } from '../../lib/stores.js';
import { alternativeDisplayName } from '../../lib/productName.js';
import ProductFacts from '../ProductFacts.jsx';
import Logo from '../Logo.jsx';
import CategoryPicker from '../CategoryPicker.jsx';
import StoreList from '../StoreList.jsx';

const FALLBACK_SOURCES = new Set(['static-pool', 'live', 'catalog-category-fallback']);
const CURATED_SOURCES = new Set(['brand-match', 'brand-category-match']);

function AltPage({ item, index, total, stores, onShare, isReported }) {
  const { t } = useLanguage();
  const [imgBroken, setImgBroken] = useState(false);
  // Green "vendore" is reserved for genuinely Kosovar evidence only.
  const kosovo = isKosovoCountry(item.country);
  const matchingStores = findStoresForChain(stores, [item.source, item.sourceLabel, item.brand, item.company]);
  const itemName = alternativeDisplayName({ ...item, brand: item.name || item.brand }, t('unknownProductName'));

  return (
    <div className="alt-page">
      <div className="alt">
        <span className="label" style={{ color: 'var(--black)', marginTop: '6cqw' }}>
          {t('altPagerLabel', { i: index + 1, n: total })}
        </span>

        <div className="pack">
          {item.image && !imgBroken ? (
            <img src={item.image} alt="" onError={() => setImgBroken(true)} />
          ) : (
            <span>{t('packPhotoPlaceholder')}</span>
          )}
        </div>

        <h3>{itemName}</h3>
        {item.company && <p>{item.company}</p>}
        {/* price was folded into `producerBits` and dropped whole when
            null — grams and price are now both always stated. */}
        <ProductFacts product={item} className="vj-choice-facts" />

        {kosovo && (
          <span className="badge">
            <i className="dot" aria-hidden="true" />
            {t('badgeVendore')}
          </span>
        )}

        {/* Confidence-level distinction (2026-09-11): a sourced pairing and a
            same-category guess must be unmistakable at a glance. */}
        {isReported ? (
          <span className="confidence reported">
            {t('choiceCuratedHeading')}
            {item.pairingUrl && (
              <a href={item.pairingUrl} target="_blank" rel="noreferrer">
                {t('sourceLink')} ↗
              </a>
            )}
          </span>
        ) : (
          <span className="confidence category">{t('choiceFallbackHeading')}</span>
        )}

        {/* Stores are now always shown — no longer hidden behind a
            "ku ta gjej" toggle click (2026-09-11, owner feedback: "show
            the stores mapped out always"). */}
        <div className="choice-stores" style={{ position: 'static', maxHeight: 'none', marginTop: '2cqw' }}>
          <p className="label" style={{ position: 'static', color: 'var(--white)', marginBottom: '1cqw' }}>
            {t('choiceFindStore')}
          </p>
          <StoreList stores={matchingStores} />
        </div>
      </div>

      <div className="actions">
        <button type="button" className="k" style={{ gridColumn: '1 / -1' }} onClick={() => onShare({ serbianName: null, alternativeName: item.name || item.brand || '' })}>
          {t('choiceShare')}
        </button>
      </div>
    </div>
  );
}

// 07 · CHOICE (zgjedhja) — ported from the reference: still red (the "calm"
// is that nothing is cropped anymore, NOT a background/colour change), the
// logo full-size and centered, one alternative fully readable per page,
// swipeable between several.
export default function ChoiceScreen({ resultState, data, onCategoryPick, onScanAnother, onShare }) {
  const { t } = useLanguage();
  const { productStatus, alternatives, categoryPicker } = resultState;

  const needsCategoryPicker = (productStatus === 'not_found' || productStatus === 'error') && categoryPicker?.active;
  const isReported = CURATED_SOURCES.has(alternatives.source);
  const isFallback = FALLBACK_SOURCES.has(alternatives.source);

  return (
    <div className="screen poster-snap vj-story-choice" role="group" aria-label={t('alternativesTitle')}>
      <Logo style={{ top: '22cqw' }} />

      {needsCategoryPicker && !categoryPicker.chosenKey && (
        <div className="choice-category-picker">
          <CategoryPicker selectedKey={categoryPicker.chosenKey} onSelect={onCategoryPick} />
        </div>
      )}

      {alternatives.status === 'loading' && <p className="choice-status">{t('loadingAlternatives')}</p>}

      {alternatives.status === 'ready' && alternatives.items.length > 0 && (
        <div className="alt-track">
          {alternatives.items.map((item, i) => (
            <AltPage
              key={item.code || `${item.brand}-${i}`}
              item={item}
              index={i}
              total={alternatives.items.length}
              stores={data?.kosovoStores?.stores}
              onShare={onShare}
              isReported={isReported && !isFallback}
            />
          ))}
        </div>
      )}

      {alternatives.status === 'ready' && alternatives.items.length === 0 && !needsCategoryPicker && (
        <>
          <p className="choice-status">{t('choiceNoAlternatives')}</p>
          <div className="actions">
            <button type="button" className="w" style={{ gridColumn: '1 / -1' }} onClick={onScanAnother}>
              {t('choiceScanAnother')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
