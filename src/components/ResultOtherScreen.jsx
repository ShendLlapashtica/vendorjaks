import { useLanguage } from '../i18n/LanguageContext.jsx';
import Logo from './Logo.jsx';
import StoryNav from './StoryNav.jsx';
import Flag from './Flag.jsx';
import GsFootnote from './GsFootnote.jsx';
import CountryChecklist from './CountryChecklist.jsx';
import BestAlternativeInline from './story/BestAlternativeInline.jsx';
import ProductSpecs from './ProductSpecs.jsx';
import { displayNameOrUnknown } from '../lib/productName.js';
import { stanceFor } from '../lib/countryStance.js';
import { isNonRecogniser } from '../lib/flagTone.js';

// 08b · OTHER COUNTRY — a real country that is neither Serbia nor
// Kosovo/Albania.
//
// This screen exists because until 2026-09-12 there wasn't one: every
// non-Serbian barcode fell through to ResultLocalScreen, so an Italian
// pasta, a German shampoo and a Chinese kettle were all shown to the user
// under the word "vendore" (local) with a green tick. That was the app
// asserting something flatly false about the majority of the world's
// barcodes — the single worst bug it had.
//
// Deliberately NOT the white "vendore" reward screen and NOT the red
// Serbian poster: a neutral black screen, because the honest answer here is
// neutral. It is foreign, it is not Serbian, and Vendorja has no claim to
// make about it beyond naming where it was registered.
export default function ResultOtherScreen({ classify, product, productStatus, code, onScanAnother, onBack, onBrowseAll, onOpenFaq, data, alternatives , onSelectProduct }) {
  const { t, lang } = useLanguage();
  const country = (lang === 'sq' ? classify?.countrySq : classify?.country) || classify?.country;
  // productDisplayName() can return null; this line printed an empty <p>
  // for a foreign product Open Food Facts has never heard of.
  const name =
    productStatus === 'loading'
      ? t('unknownProductName')
      : displayNameOrUnknown(product, classify, code, t('unknownProductName'));

  return (
    <div className="screen white vj-result-country" role="group" aria-label={`${t('resultAriaPrefix')} — ${country}`}>
      {/* Owner, 2026-09-12: "the post-scan has no return button or navbar
          must have a navbar". */}
      <StoryNav title={t('navPageResult')} onBack={onBack || onScanAnother} />

      <Logo variant="small red" style={{ top: '9cqw' }} />

      <div className="vj-country-block">
        <Flag
          iso={classify?.iso}
          name={country}
          size="hero"
          tone={isNonRecogniser(classify?.iso, data?.countryStance) ? 'muted' : 'normal'}
        />
        {/* A grey flag is an accusation; say out loud what it means. */}
        {isNonRecogniser(classify?.iso, data?.countryStance) && (
          <span className="vj-nonrecogniser">{t('flagNonRecogniser')}</span>
        )}
        <p className="vj-country-name">{country}</p>
        <p className="vj-country-prefix">{t('prefixLabel', { prefix: classify?.prefix })}</p>

        <p className="vj-country-verdict">{t('resultForeignWord')}</p>

        <p className="vj-country-meta">{name}</p>
        {/* The registration-vs-manufacture caveat is the same size as the
            verdict line, never shrunk to a footnote. */}
        {/* On a split-origin product `country` is the FACTORY's country (the
            flag above), so naming it as the registrar would be false — a
            Bimilk yogurt is made in Bitola and registered with GS1 Serbia.
            The caveat names whichever office actually issued the number. */}
        <p className="vj-country-note">
          {t('resultRegisteredNote', {
            country:
              (classify?.splitOrigin &&
                (lang === 'sq' ? classify?.registrationCountrySq : classify?.registrationCountry)) ||
              country,
          })}
        </p>
      </div>

      {/* Same full spec sheet as every other verdict. */}
      <ProductSpecs product={product} fallbackName={product?.name} fallbackQuantity={product?.quantity} />

      {/* THE LOCAL ALTERNATIVE FOR A NON-SERBIAN PRODUCT — always rendered,
          never behind a toggle.
          Owner, 2026-09-16: "for other nationalities name aswell an
          alternative if none say there is none that is local".
          It used to sit behind "shiko alternativat vendore" and default to
          hidden, so the answer to the owner's question — including the
          honest "there is no local one" — was invisible unless you thought
          to press a button. Same category gate as the boycott flow, so a
          foreign oil is still answered with a local oil or with nothing at
          all; BestAlternativeInline states the nothing in words. */}
      <section className="vj-local-alt-section" aria-label={t('localAlternativeTitle')}>
        <h3 className="vj-local-alt-title">{t('localAlternativeTitle')}</h3>
        <BestAlternativeInline alternatives={alternatives} onSelectProduct={onSelectProduct} />
      </section>

      <div className="vj-country-actions">
        <button type="button" className="redbtn" onClick={onScanAnother}>
          {t('resultScanAnother')}
        </button>
        {onBrowseAll && (
          <button type="button" className="vj-btn-ghost" onClick={onBrowseAll}>
            {t('resultSeeLocalAnyway')}
          </button>
        )}
      </div>

      {/* Owner, 2026-09-12: "make like a checklist ... embargoed serbia,
          bombed belgrade, is in EU, supports independence, diplomatic
          relations". Sourced per country; unknown never renders as a
          tick or a cross. */}
      <CountryChecklist record={stanceFor(classify?.iso, data?.countryStance)} />

      <GsFootnote onOpenFaq={onOpenFaq} tone="light" />
    </div>
  );
}
