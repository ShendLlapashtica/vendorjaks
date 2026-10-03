import { useMemo } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { verdictHasFlag, VERDICT } from '../lib/gs1.js';
import { productStance } from '../lib/flagTone.js';
import { countryCodeName } from '../lib/productOrigins.js';
import Flag from './Flag.jsx';

// A country flag for a product ANYWHERE it is listed — explore grid, search
// results, history, alternatives, product detail.
//
// Owner, 2026-09-12: "show flags use flags for countries' products", then:
// "if it's a non recognizer . list them as mos-njohes and their flag becomes
// gray (slovakia, greece, romania). if serbia its red like light red
// opacitated flag — strong must not buy, almost dangerous looking flag".
// Then, 2026-09-16: "always showflag".
//
// WHICH COUNTRY THE FLAG NAMES
// ----------------------------
// The flag answers "where does this come from", so it follows the best
// evidence available, in this order:
//
//   1. A VERIFIED, SOURCE-CITED production country from
//      data/product-origins.json. This is the Bimilk case: barcode
//      8601500111207 is registered with GS1 Serbia, but the yogurt is made
//      by Mlekara AD Bitola in Bitola, North Macedonia. The flag is 🇲🇰, and
//      the Serbian registration moves to its own line on the detail screen
//      instead of being asserted as the product's origin.
//   2. Otherwise, the country the barcode's GS1 prefix was registered with.
//   3. Otherwise, isLocalBrand === true (never false, never null), which is
//      positive catalogue evidence of a Kosovar brand.
//   4. Otherwise, the "we don't know" marker — see below.
//
// All of it goes through lib/flagTone.js#productStance so a row and the page
// it opens cannot disagree, and so a new screen gets the rule for free.
//
// THE UNKNOWN MARKER, and why it is not a flag
// --------------------------------------------
// 58.5% of the catalogue has no barcode, and some rows carry a retailer SKU
// in the barcode field instead ("VIVA000003663"). Those get a marker that is
// deliberately ANTI-flag: round where flags are rectangular, outlined where
// flags are filled, monochrome where flags are coloured (see
// styles/verdict.css). Every row has something in the flag slot; none of
// them claims a country the app cannot evidence.
export default function ProductFlag({ product, data, size = 'sm', showName = false, showTag = false }) {
  const { t, lang } = useLanguage();

  const stance = useMemo(
    () => productStance(product, data),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [product?.code, product?.barcode, product?.brand, product?.isLocalBrand, data?.gs1, data?.boycott, data?.productOrigins, data?.countryStance]
  );

  const { classify, split, tone, nonRecogniser } = stance;

  // 1. Verified production country wins over the registration prefix.
  if (split?.manufactureIso) {
    const name = countryCodeName(split.manufactureIso, lang);
    return (
      <span className={`vj-product-flag is-${tone}`}>
        <Flag iso={split.manufactureIso} name={name} size={size} tone={tone} />
        {showName && <span className="vj-product-flag-name">{name}</span>}
        {/* The registration disagrees with the factory. Say so here in
            miniature; the detail screen says it in full. */}
        {showTag && split.divergent && (
          <span className="vj-origin-chip" title={t('originSplitExplain')}>
            {t('originSplitBadge')}
          </span>
        )}
        {showTag && split.serbianOwned && (
          <span className="vj-origin-chip" title={split.ownership || ''}>
            {t('originSerbianOwned')}
          </span>
        )}
      </span>
    );
  }

  // 2/3/4. No verified production country — fall back to the prefix, then
  // to positive catalogue evidence, then to the unknown marker.
  if (!classify || !verdictHasFlag(classify.verdict) || !classify.iso) {
    // A CURATED BOYCOTT HIT IS ORIGIN EVIDENCE when there is no barcode.
    // Owner, 2026-09-16: "i saw a lot of plazmas with no flag ... if serb
    // and no flag on it REMOVEEE IT COMPLETELYYY". 22 of 48 Bambi Plazma
    // rows carry no barcode, so there was no prefix to read and they fell
    // straight through to the "?" marker — a Serbian biscuit rendering as
    // unattributed. The boycott entry is not a guess: Bambi's cites the
    // company's own contact page and its Požarevac seat. So it flies the
    // flag, rather than the row being deleted. Checked BEFORE the
    // isLocalBrand branch on purpose: a boycott hit must always outrank a
    // local claim, which is the one-way rule boycott.js already enforces.
    if (stance?.stanceIso && stance.flagged) {
      return (
        <span className="vj-product-flag is-muted">
          <Flag iso={stance.stanceIso} name={t('flagSerbia')} size={size} tone="muted" />
          {showName && <span className="vj-product-flag-name">{t('flagSerbia')}</span>}
        </span>
      );
    }
    if (product?.isLocalBrand === true) {
      return (
        <span className="vj-product-flag is-normal">
          <Flag iso="XK" name="Kosovë" size={size} />
          {showName && <span className="vj-product-flag-name">Kosovë</span>}
        </span>
      );
    }
    return (
      <span
        className={`vj-product-flag is-unknown vj-flag-unknown-${size}`}
        role="img"
        title={t('flagUnknownOrigin')}
        aria-label={t('flagUnknownOrigin')}
      >
        <span aria-hidden="true">?</span>
        {showName && <span className="vj-product-flag-name">{t('flagUnknownOrigin')}</span>}
      </span>
    );
  }

  const country = (lang === 'sq' ? classify.countrySq : classify.country) || classify.country;

  return (
    <span className={`vj-product-flag is-${tone}`}>
      <Flag iso={classify.iso} name={country} size={size} tone={tone} />
      {showName && <span className="vj-product-flag-name">{country}</span>}
      {/* The grey flag alone doesn't say WHY it is grey. */}
      {showTag && nonRecogniser && (
        <span className="vj-nonrecogniser" title={t('flagNonRecogniserFull')}>
          {t('flagNonRecogniser')}
        </span>
      )}
      {showTag && classify.verdict === VERDICT.SERBIAN && (
        <span className="vj-nonrecogniser is-boycott">{t('flagBoycott')}</span>
      )}
    </span>
  );
}
