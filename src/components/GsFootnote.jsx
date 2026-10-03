import { useLanguage } from '../i18n/LanguageContext.jsx';

// The GS1 registration-vs-origin caveat, as a FOOTNOTE.
//
// This deliberately reverses an earlier project rule. That rule said the
// caveat must be rendered at the same type size as the verdict and "never
// shrunk to a footnote". The owner overruled it directly (2026-09-12),
// reacting to the full-size block:
//
//   "this shit makes no sense how does apple have barcode only show this
//    when neccessary in a footnote down in footer"
//
// So: one short line, small, at the bottom of EVERY result screen (the
// owner asked for it on all products), with a link into the Q&A where the
// actual explaining now lives — including the apple question, which is
// answered there as faqQ1 because it was the owner's own question.
//
// The caveat is not gone and is not hidden behind a click: it is present on
// every single result. It is just no longer competing with the verdict.
export default function GsFootnote({ onOpenFaq, tone = 'light' }) {
  const { t } = useLanguage();

  return (
    <p className={`vj-gs-footnote is-${tone}`}>
      {t('gsFootnote')}{' '}
      {onOpenFaq && (
        <button type="button" className="vj-gs-footnote-link" onClick={onOpenFaq}>
          {t('gsFootnoteMore')}
        </button>
      )}
    </p>
  );
}
