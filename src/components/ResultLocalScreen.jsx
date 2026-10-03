import { useLanguage } from '../i18n/LanguageContext.jsx';
import Logo from './Logo.jsx';
import StoryNav from './StoryNav.jsx';
import Flag from './Flag.jsx';
import GsFootnote from './GsFootnote.jsx';
import ProductSpecs from './ProductSpecs.jsx';
import { displayNameOrUnknown } from '../lib/productName.js';

// 08 · CLEAR (vendore / not from Serbia) — ported from the reference: the
// ONLY white screen, small RED logo, a green check, the word "vendore"
// fully visible and uncropped, then a full-width red button. This contrast
// with every red poster screen before it is the reward — nothing here is
// cropped or animated.
//
// The honesty caveat ("not registered with GS1 Serbia") sits in the SAME
// block as the verdict word, same type size class as the product name —
// not shrunk to a footnote.
export default function ResultLocalScreen({ product, productStatus, code, onScanAnother, onBack, classify, onOpenFaq }) {
  const { t, lang } = useLanguage();
  // productDisplayName() returns null when there is no name, brand,
  // category or code — this printed a blank line between the verdict word
  // and the caveat.
  const name =
    productStatus === 'loading'
      ? t('unknownProductName')
      : displayNameOrUnknown(product, classify, code, t('unknownProductName'));
  const country = (lang === 'sq' ? classify?.countrySq : classify?.country) || classify?.country;

  // A SPLIT-ORIGIN PRODUCT REACHES THIS SCREEN TOO, AND THE CAVEAT BELOW
  // WOULD BE A LIE ON IT.
  //
  // `resultNote` is the hardcoded "nuk është regjistruar në GS1 Serbi". That
  // is true of an ordinary 390/381/530 product and FALSE of the case added
  // 2026-09-18: Fluidi's juice is made in Gjilan and its barcode really is
  // registered with GS1 Serbia (see product-origins-SOURCES.md). The whole
  // point of the split is that both facts are stated, so the screen says the
  // registration out loud instead of denying it.
  const registrationCountry =
    lang === 'sq' ? classify?.registrationCountrySq : classify?.registrationCountry;
  const split = Boolean(classify?.splitOrigin && registrationCountry);
  const note = split
    ? t('resultRegisteredNote', { country: registrationCountry })
    : t('resultNote');

  return (
    <div className="screen white vj-result-local" role="group" aria-label={`${t('resultAriaPrefix')} — ${name}`}>
      {/* Owner, 2026-09-12: "the post-scan has no return button or navbar
          must have a navbar". */}
      <StoryNav title={t('navPageResult')} onBack={onBack || onScanAnother} />

      <Logo variant="small red" style={{ top: '9cqw' }} />

      <div className="clear">
        {/* Kosovo or Albania, in full colour — the one screen in the app
            where a flag is a reward rather than an indictment. */}
        {classify?.iso && (
          <div className="vj-result-local-flag">
            <Flag iso={classify.iso} name={country} size="hero" />
            {/* "Kosovë · prefiksi 530" would read as "530 is Kosovo", which
                is false — 530 is GS1 Albania. On a split-origin product the
                flag names the FACTORY, so the prefix has to be spelled out
                with the office that actually issued it, not glued to the
                country beside it. */}
            <span className="vj-result-local-country">
              {split
                ? `${country} · ${t('issuedBy', { prefix: classify.prefix, country: registrationCountry })}`
                : `${country} · ${t('prefixLabel', { prefix: classify.prefix })}`}
            </span>
          </div>
        )}
        <div className="check" role="img" aria-label={t('resultCheckAria')} />
        <p className="word">{t('resultVendoreWord')}</p>
        <p>
          {name}
          <br />
          {note}
        </p>
      </div>

      {/* Full specs for a local product too — owner, 2026-09-12: "show all
          its specs macronutrients when its Kosovo or knower". */}
      <ProductSpecs product={product} fallbackName={product?.name} fallbackQuantity={product?.quantity} />

      <button type="button" className="redbtn" onClick={onScanAnother}>
        {t('resultScanAnother')}
      </button>

      <GsFootnote onOpenFaq={onOpenFaq} tone="light" />
    </div>
  );
}
