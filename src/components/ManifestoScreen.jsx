import { useLanguage } from '../i18n/LanguageContext.jsx';
import { MANIFESTO_SCREENS } from '../content/argument.js';
import { PSE_REGISTRY } from '../content/pseCitations.js';
import { ACCESSED, sourceInstitution } from '../content/sources.js';
import PosterScreen from './poster/PosterScreen.jsx';
import SerbiaProfitPanel from './SerbiaProfitPanel.jsx';
import Cite from './citation/Cite.jsx';
import '../styles/citations.css';

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

/** The owner's long bodies are written with blank lines between paragraphs. */
function paragraphs(text) {
  return String(text || '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

// MANIFESTO ("pse") — the argument start to finish: the legal record, then
// the economic dossier, then the references.
//
// ===========================================================================
// OWNER, 2026-09-16, verbatim:
//   "dont get me started on PSE its so shit  për një Kosovë pa produkte serbe
//    / për një Kosovë pa produkte serbe / për një Kosovë pa produkte serbe /
//    kujto bleje tanen jo t'shkive / bleje tanen / bleje tanen / bleje tanen /
//    jo t'shkive! remove these put on a source to all. if no source remove.
//    all must have links and IEEE referencing"
//
// THE SLOGAN REPETITION IS GONE FROM THIS PAGE. Three consecutive full-screen
// poster panels used to sit here between the last argument screen and the
// statistics:
//
//   1. <ul className="stack"> rendering t('mottoSecondary') three times
//      ("për një Kosovë pa produkte serbe" ×3);
//   2. <TreatmentC> rendering "kujto" / "bleje tanen jo t'shkive";
//   3. <TreatmentA> rendering "bleje tanen" ×3 plus "jo t'shkive!".
//
// That is seven lines of slogan across three full screens, which is what he
// quoted back at us as the complaint. All three panels are removed. The
// argument screens now run straight into the statistics.
//
// THIS REVERSES AN EARLIER INSTRUCTION OF HIS. The comment that stood here
// read, verbatim: "Owner, 2026-09-12: 'për një Kosovë pa produkte serbe is to
// be shown three times but show it down in the middle after the massacres'".
// On 2026-09-16 he reversed himself. The newer instruction wins, and the
// older one is recorded here rather than deleted so that nobody reads it in
// isolation later and "restores" the repetition as a regression fix.
//
// This has now been walked back twice. TreatmentC's own header records that
// it was once six sliding, overlapping copies before being cut to one; the
// SloganScreen header records a cut from thirteen repeats to three. The
// direction of travel across 2026-09-11, -09-12 and -09-16 is one way: less.
// DO NOT ADD A REPEAT BACK without an instruction newer than 2026-09-16.
//
// WHAT WAS KEPT, AND WHERE. The motto is the brand, not just a /pse panel, so
// it was not stripped from the product:
//   * the home screen still opens on it (`homeStaggerLines`);
//   * the share card still carries it;
//   * the standalone story screens SloganScreen and ReminderScreen still
//     render it once each — they are the poster sequence after a scan, where
//     a single slogan panel is the payoff rather than a wall;
//   * /pse itself still ends on it, ONCE, as a single closing line under the
//     references rather than three screens in the middle of the evidence.
//
// ===========================================================================
// SOURCES AND IEEE NUMBERING
//
// Every claim on this page carries a bracketed numeral that links to its
// entry in the reference list at the bottom. The numbers come from
// PSE_REGISTRY, which derives them from the order the claims appear — see
// src/content/pseCitations.js. Nothing here hand-writes a number, a document
// title or a URL.
//
// ===========================================================================
// THE LAYOUT COMPLAINT — "undersymmetrical", 2026-09-14, and "so shit" again
// on 2026-09-16.
//
// The 2026-09-14 pass fixed the detail problem (bodies and evidence lists
// that were in the data but never rendered) and gave every poster the same
// vertical shape. What it did NOT fix is that the page had no sections: it
// was an undifferentiated column of red panels, with three slogan screens
// dropped into the middle of the evidence. Removing those three is half of
// it. The other half is here: the page is now three named parts — the record
// (`vj-manifesto-record`), the money (SerbiaProfitPanel), and the references
// — each introduced by a heading, so the reader always knows which of the
// two evidence bases they are in.
export default function ManifestoScreen() {
  const { t, lang } = useLanguage();
  const reg = PSE_REGISTRY;

  return (
    <div className="vj-manifesto">
      <section className="vj-manifesto-record" aria-label={t('manifestoRecordHeading')}>
        <h2 className="vj-manifesto-part-title">{t('manifestoRecordHeading')}</h2>

        {MANIFESTO_SCREENS.map((item) => {
          // Two entries (kosova-1998-1999, financimi-860) are poster-style:
          // they carry `headline` + `bodySq`/`bodyEn` instead of `sq`/`en`.
          const text =
            (lang === 'sq' ? item.sq : item.en || item.sq) || item.headline || '';
          const subhead = lang === 'sq' ? item.subheadSq : item.subheadEn || item.subheadSq;
          const body = paragraphs(lang === 'sq' ? item.bodySq : item.bodyEn || item.bodySq);
          const sites = item.massacres || [];
          const displaced = item.overallFigures?.displaced;
          const killed = item.overallFigures?.killed;
          const hasVisibleBody = body.length > 0 || sites.length > 0;
          const narrative =
            lang === 'sq' ? item.ariaSq || item.sq : item.ariaEn || item.en || item.sq;
          const ariaLabel = hasVisibleBody
            ? item.headline || text
            : narrative || text;

          return (
            <PosterScreen bg="red" ariaLabel={ariaLabel} key={item.id} snap={false}>
              {/* An argument is labelled as an argument. The owner's
                  financimi-860 manifesto is a call to action resting on
                  sourced premises, not a court finding, and a reader is
                  entitled to see the difference at a glance. */}
              {item.kind === 'argument' && (
                <p className="vj-poster-kind">{t('argumentPositionTag')}</p>
              )}

              <p className="stagger" aria-hidden="true">
                {wrapIntoFourLines(text).map((line, li) => (
                  <span key={li}>{line}</span>
                ))}
              </p>

              {subhead && <p className="vj-poster-standfirst">{subhead}</p>}

              {/* A SHORT SCREEN STILL HAS TO SHOW ITS CITATION.
                  Caught by counting anchors in the browser on 2026-09-16:
                  95 numerals rendered but references [1], [2], [15], [16]
                  and [17] appeared in no numeral at all. The reason: five of
                  the eight screens carry only `sq`/`en` — no `body` — and the
                  citation was rendered only inside the body paragraphs. So
                  the ICJ opinion, Serbia's constitution, UN Resolution 827
                  and both Đorđević documents were in the reference list with
                  nothing on the page pointing at them. Those screens now
                  carry the source line the page used to have, with the
                  numeral in it. */}
              {body.length === 0 && (
                <p className="vj-poster-citeline meta">
                  {t('argumentSourceLabel')}: <Cite ids={item.sourceIds} registry={reg} t={t} />
                </p>
              )}

              {body.map((para, pi) => (
                <p className="vj-poster-body" key={pi}>
                  {para}
                  {/* The citation goes on the last paragraph of the body, so
                      the numeral sits at the end of the claim rather than
                      interrupting it four times. */}
                  {pi === body.length - 1 && <Cite ids={item.sourceIds} registry={reg} t={t} />}
                </p>
              ))}

              {/* The two overall figures. Both are sourced; both say which
                  document, by number, and both present the figure in the
                  source's own terms — "at least 700,000", not "700,000+". */}
              {[displaced, killed].filter((f) => f && f.figure).map((f) => (
                <p className="vj-poster-figure" key={f.figure}>
                  <span className="vj-poster-figure-value">
                    {lang === 'sq' ? f.figureSq || f.figure : f.figure}
                  </span>
                  <span className="vj-poster-figure-label">
                    {lang === 'sq' ? f.descriptionSq || f.description : f.description}
                    <Cite ids={f.sourceIds} registry={reg} t={t} />
                  </span>
                </p>
              ))}

              {/* THE CRIME SITES.
                  Until 2026-09-16 every one of eleven sites carried the same
                  ICTY press release and the same sentence saying the death
                  toll was unconfirmed. That press release named none of them.
                  Each site now carries the document that actually documents
                  it, that document's own figure, and — where it matters —
                  the caveat that goes with it: an indictment is a charge, a
                  Serbian first-instance verdict is not final, and an NGO
                  field investigation is not a court finding. Eleven sites,
                  eleven different citation sets, no shared boilerplate left
                  to collapse. */}
              {sites.length > 0 && (
                <ul className="vj-poster-sites">
                  {sites.map((s) => {
                    const finding = lang === 'sq' ? s.findingSq : s.findingEn || s.findingSq;
                    const caveat = lang === 'sq' ? s.caveatSq : s.caveatEn || s.caveatSq;
                    const figure = lang === 'sq' ? s.figureSq || s.figure : s.figure;
                    return (
                      <li className="vj-poster-site" key={s.place}>
                        <span className="vj-poster-site-place">
                          {lang === 'sq' ? s.placeSq || s.place : s.place}
                        </span>
                        <span className="vj-poster-site-date">{lang === 'sq' ? s.dateSq || s.date : s.date}</span>
                        {figure && <span className="vj-poster-site-figure">{figure}</span>}
                        <span className="vj-poster-site-desc">
                          {finding}
                          <Cite ids={s.sourceIds} registry={reg} t={t} />
                        </span>
                        {caveat && <span className="vj-poster-site-flag">{caveat}</span>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </PosterScreen>
          );
        })}
      </section>

      {/* Owner, 2026-09-12: "place them all at the very bottom of this
          section". Statistics close the argument rather than open it. */}
      <SerbiaProfitPanel registry={reg} />

      {/* THE REFERENCE LIST — IEEE, numbered in citation order, never
          alphabetical, every entry a live link with an access date. Derived
          from PSE_REGISTRY: it cannot fall out of step with the in-text
          numerals because they are the same object. */}
      <section className="vj-refs" aria-label={t('manifestoSourcesHeading')} id="vj-refs">
        <h2 className="vj-manifesto-part-title">{t('manifestoSourcesHeading')}</h2>
        <p className="vj-refs-lead">{t('manifestoSourcesLead')}</p>
        <ol className="vj-refs-list">
          {reg.entries.map((e) => (
            <li className="vj-refs-item" id={`ref-${e.n}`} key={e.id} value={e.n}>
              <span className="vj-refs-num" aria-hidden="true">
                [{e.n}]
              </span>
              <span className="vj-refs-text">
                {e.text}{' '}
                <a
                  className="vj-refs-link"
                  href={e.url}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  {t('manifestoSourcesAvailable')}: {e.url}
                </a>{' '}
                <span className="vj-refs-accessed">
                  [{t('manifestoSourcesAccessed')}: {ACCESSED}]
                </span>
              </span>
              <span className="vj-refs-inst">{sourceInstitution(e.source, lang)}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* The motto, ONCE, as the page's closing line — not three screens of
          it in the middle of the evidence (owner, 2026-09-16). */}
      <p className="vj-manifesto-close">{t('mottoSecondary')}</p>
    </div>
  );
}
