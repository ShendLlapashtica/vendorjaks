import { useLanguage } from '../i18n/LanguageContext.jsx';
import { formatPrice } from '../lib/format.js';
import { resolveProductSize } from '../lib/productSize.js';

// SIZE AND PRICE, ALWAYS BOTH, ALWAYS SAYING SOMETHING.
//
// Owner, 2026-09-16: "leave nothing undocumented like a random product
// without a history name or grams or price".
//
// Before this component, every screen wrote its own `{price && <span>…}`.
// That reads as "show the price if we have one", and what it actually does
// is leave a silent hole where a fact should be — the shopper cannot tell
// "this is free" from "we never found out". Same for grams, which no screen
// showed at all.
//
// So this renders BOTH slots on every product, every time, and each slot
// either states a real value or states that we do not have it. There is no
// third rendering. The `title` attribute carries the audit trail: when a
// size was parsed out of the product's own name rather than read from a
// field, it says so and quotes the exact substring it was read from, so a
// wrong figure can be traced instead of argued about.
//
// It never invents: a null price prints "çmimi i panjohur", not "0.00 EUR",
// and an unparseable title prints "sasia e panjohur", not a guess.
export default function ProductFacts({ product, price, currency, className = '', showUnknownPrice = true }) {
  const { t } = useLanguage();

  const size = resolveProductSize(product);
  const priceText = formatPrice(
    price !== undefined ? price : product?.price,
    currency !== undefined ? currency : product?.currency
  );

  return (
    <span className={`vj-facts ${className}`.trim()}>
      <SizeFact size={size} t={t} />
      {priceText ? (
        <span className="vj-fact vj-fact-price">{priceText}</span>
      ) : showUnknownPrice ? (
        <span className="vj-fact vj-fact-price is-unknown">{t('priceUnknown')}</span>
      ) : null}
    </span>
  );
}

function SizeFact({ size, t }) {
  if (!size) {
    return <span className="vj-fact vj-fact-size is-unknown">{t('sizeUnknown')}</span>;
  }

  if (size.kind === 'byWeight') {
    return (
      <span className="vj-fact vj-fact-size is-byweight" title={t('soldByWeightNote')}>
        {t('soldByWeight')}
      </span>
    );
  }

  if (size.kind === 'pieces') {
    return <span className="vj-fact vj-fact-size">{t('piecesLabel', { count: size.count })}</span>;
  }

  // `raw` is the exact substring the figure was read from — kept so a wrong
  // parse is traceable to the characters that caused it, not just disputed.
  const provenance =
    size.source === 'parsed-from-product-name' && size.raw
      ? `${t('sizeFromName')}: "${size.raw}"`
      : undefined;

  return (
    <span className="vj-fact vj-fact-size" title={provenance}>
      {size.text}
    </span>
  );
}

/** The size on its own, for screens that lay price out themselves. */
export function ProductSizeFact({ product, className = '' }) {
  const { t } = useLanguage();
  return (
    <span className={`vj-facts ${className}`.trim()}>
      <SizeFact size={resolveProductSize(product)} t={t} />
    </span>
  );
}
