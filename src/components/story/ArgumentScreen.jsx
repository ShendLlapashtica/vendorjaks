import { useLanguage } from '../../i18n/LanguageContext.jsx';
import PosterScreen from '../poster/PosterScreen.jsx';
import TreatmentB from '../poster/TreatmentB.jsx';

/**
 * Distributes a dynamic sentence across exactly 4 lines by word count.
 * The reference's own sample text is hand-wrapped (down to a specific
 * leading comma on line 2) — that exact artistry isn't reproducible for
 * arbitrary, varying-length real sourced claims, so this is a even,
 * mechanical word-count split instead. Noted as an approximation in the
 * build report.
 */
function wrapIntoFourLines(text) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  if (words.length === 0) return ['', '', '', ''];
  const lines = [[], [], [], []];
  const perLine = Math.ceil(words.length / 4);
  words.forEach((w, i) => {
    lines[Math.min(3, Math.floor(i / perLine))].push(w);
  });
  return lines.map((l) => l.join(' '));
}

// 04 · ARGUMENT (argumenti) — ported from the reference: a "argumenti i/n"
// label, the SAME stagger treatment/indents as Home, positioned lower
// (top:66cqw) to leave room for the label, and a small mono source line at
// the bottom. Content is real, sourced facts from src/content/argument.js
// (owned by the content module) — this component only lays it out, never
// invents or edits the claims themselves.
//
// Extended to support optional headline/subhead/body fields for longer
// memorial content. Entries with these fields render as a multi-part layout;
// entries without render as before (short text wrapped into 4 lines).
export default function ArgumentScreen({ item }) {
  const { t, lang } = useLanguage();
  const source = item.source || {};
  const sourceLine = [source.institution, source.document, source.year].filter(Boolean).join(', ');

  // Detect whether this is an extended format (headline + subhead + body)
  const isExtended = !!(item.headline && (item.bodySq || item.bodyEn));

  if (isExtended) {
    // Extended format: headline, subhead, body (for memorial screens)
    const bodySq = item.bodySq || '';
    const bodyEn = item.bodyEn || '';
    const bodyText = lang === 'sq' ? bodySq : bodyEn || bodySq;

    // Construct full accessible text for screen reader
    const fullText = [
      item.headline,
      lang === 'sq' ? item.subheadSq : item.subheadEn,
      bodyText,
    ]
      .filter(Boolean)
      .join(' — ');

    return (
      <PosterScreen bg="red" ariaLabel={`${fullText} — ${sourceLine}`} className="vj-story-argument vj-story-argument-extended">
        <div style={{ padding: '4cqw' }}>
          {item.headline && (
            <div style={{ fontSize: '3cqw', fontWeight: 'bold', marginBottom: '2cqw' }}>
              {item.headline}
            </div>
          )}
          {(lang === 'sq' ? item.subheadSq : item.subheadEn) && (
            <div style={{ fontSize: '2cqw', fontStyle: 'italic', marginBottom: '3cqw', lineHeight: 1.4 }}>
              {lang === 'sq' ? item.subheadSq : item.subheadEn}
            </div>
          )}
          <div style={{ fontSize: '2cqw', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {bodyText}
          </div>
        </div>
        <div className="meta arg-source">
          {item.verified === false && (
            <span className="vj-tag-unverified" style={{ marginRight: '2cqw' }}>
              {t('argumentUnverifiedTag')}
            </span>
          )}
          {t('argumentSourceLabel')}: {sourceLine}
          {source.url && (
            <>
              {' '}
              <a href={source.url} target="_blank" rel="noreferrer">
                ↗
              </a>
            </>
          )}
        </div>
      </PosterScreen>
    );
  }

  // Original format: short text wrapped into 4 lines
  const text = lang === 'sq' ? item.sq : item.en || item.sq;
  const fullText = lang === 'sq' ? item.ariaSq || item.sq : item.ariaEn || item.en || item.sq;
  const lines = wrapIntoFourLines(text);

  return (
    <PosterScreen bg="red" ariaLabel={`${fullText} — ${sourceLine}`} className="vj-story-argument">
      <TreatmentB lines={lines} style={{ top: '66cqw' }} />
      <div className="meta arg-source">
        {item.verified === false && (
          <span className="vj-tag-unverified" style={{ marginRight: '2cqw' }}>
            {t('argumentUnverifiedTag')}
          </span>
        )}
        {t('argumentSourceLabel')}: {sourceLine}
        {source.url && (
          <>
            {' '}
            <a href={source.url} target="_blank" rel="noreferrer">
              ↗
            </a>
          </>
        )}
      </div>
    </PosterScreen>
  );
}
