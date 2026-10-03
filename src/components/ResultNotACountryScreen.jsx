import { useLanguage } from '../i18n/LanguageContext.jsx';
import { VERDICT } from '../lib/gs1.js';
import Logo from './Logo.jsx';
import StoryNav from './StoryNav.jsx';
import ManualEntry from './ManualEntry.jsx';
import GsFootnote from './GsFootnote.jsx';

// 08c · NOT A COUNTRY — the prefix is valid but identifies no country:
//   NOT_A_COUNTRY : an in-store retailer number, a coupon, a book (ISBN),
//                   a magazine (ISSN), a refund receipt, a GS1 Global
//                   Office allocation.
//   UNASSIGNED    : a well-formed prefix GS1 has allocated to nobody.
//   UNKNOWN       : not a usable barcode at all.
//
// All three previously landed on the white "vendore" screen and were
// announced as local products. A store's own shelf-label barcode is not a
// Kosovar product, and saying so was a lie the app told constantly.
//
// No flag is ever drawn here — there is no country to draw.
const KIND_COPY = {
  // The owner's real-world example is a Kosovo shelf label for loose apples:
  //   "MOLLE DELISHES KG/PLU.601 / PEMET/PERIME / 0.99 EUR"
  // That is a supermarket weight/PLU code, not a producer's barcode, so it
  // gets the specific shelf-label copy rather than the generic one.
  restricted: ['pluWord', 'pluBody'],
  coupon: ['notCountryCouponWord', 'notCountryCouponBody'],
  isbn: ['notCountryIsbnWord', 'notCountryIsbnBody'],
  issn: ['notCountryIssnWord', 'notCountryIssnBody'],
  refund: ['notCountryRefundWord', 'notCountryRefundBody'],
  office: ['notCountryOfficeWord', 'notCountryOfficeBody'],
  unassigned: ['notCountryUnassignedWord', 'notCountryUnassignedBody'],
};

export default function ResultNotACountryScreen({ classify, code, onScanAnother, onBack, onDetected, onOpenFaq }) {
  const { t } = useLanguage();

  const [wordKey, bodyKey] =
    KIND_COPY[classify?.kind] ||
    (classify?.verdict === VERDICT.UNASSIGNED
      ? KIND_COPY.unassigned
      : ['notCountryUnknownWord', 'notCountryUnknownBody']);

  return (
    <div className="screen white vj-result-country" role="group" aria-label={t(wordKey)}>
      {/* Owner, 2026-09-12: "the post-scan has no return button or navbar
          must have a navbar". */}
      <StoryNav title={t('navPageResult')} onBack={onBack || onScanAnother} />

      <Logo variant="small red" style={{ top: '9cqw' }} />

      <div className="vj-country-block">
        <span className="vj-noflag" aria-hidden="true">
          ?
        </span>
        <p className="vj-country-verdict">{t(wordKey)}</p>
        {classify?.prefix && <p className="vj-country-prefix">{t('prefixLabel', { prefix: classify.prefix })}</p>}
        <p className="vj-country-note">{t(bodyKey)}</p>
        <p className="vj-country-meta">{code || t('unknownProductName')}</p>
      </div>

      {/* "if none say there is none that is local" (owner, 2026-09-16).
          This screen never had an alternatives section at all, so the
          question simply went unanswered here. It cannot be answered with a
          product — a shelf label, a coupon or an ISBN identifies no product
          and therefore no category to match within — so the screen states
          that reason instead of staying silent. Saying WHY we cannot look
          is a real answer; showing nothing is not. */}
      <section className="vj-local-alt-section" aria-label={t('localAlternativeTitle')}>
        <h3 className="vj-local-alt-title">{t('localAlternativeTitle')}</h3>
        <div className="vj-altinline is-empty">
          <p className="vj-altinline-none-title">{t('noLocalAlternativeTitle')}</p>
          <p className="vj-altinline-none-why">{t('noLocalAlternativeUnknownProduct')}</p>
        </div>
      </section>

      <div className="vj-country-actions">
        {/* A store's own label barcode is the commonest way to land here, and
            the product usually DOES have a real manufacturer barcode
            elsewhere on the pack — so offer to try another one right here
            rather than sending the user back to the start. */}
        <p className="label">{t('notCountryTryAnother')}</p>
        <ManualEntry onSubmit={onDetected} />
        <button type="button" className="redbtn" onClick={onScanAnother}>
          {t('resultScanAnother')}
        </button>
      </div>

      <GsFootnote onOpenFaq={onOpenFaq} tone="light" />
    </div>
  );
}
