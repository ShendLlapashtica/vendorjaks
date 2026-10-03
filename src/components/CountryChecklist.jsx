import { useLanguage } from '../i18n/LanguageContext.jsx';
import { checklistFor } from '../lib/countryStance.js';

// The country-stance checklist (owner, 2026-09-12, verbatim):
//
//   "make like a checklist when for instance norway . embargoed serbia.
//    bombed belgrade is in EU .supports independence and ggreat diplomatic
//    relations ! this must be all like a checklist"
//
// Rendered under a foreign-country result: where that country stands on
// Kosovo, and where it stood on Serbia.
//
// THREE MARKERS, NOT TWO. true renders a tick, false renders a cross, and
// null renders a clearly different neutral marker (an en dash, plus the
// "e panjohur" / unknown word, plus `is-unknown` on the row). null must
// never be mistakable for either a tick or a cross — "we couldn't source
// this" and "no" are different claims, and on this page the difference
// matters. The dataset carries real nulls (Hong Kong, Macau, Taiwan's
// 1990s sanctions position), so this is not a theoretical case.
//
// The owner's own example is also the reason the data is read verbatim and
// never patched: he said Norway "is in EU". Norway is not — it is in the EEA
// and in EFTA. The dataset says euMember:false and this component renders
// that cross without argument.
//
// CHROME ONLY through t(). The dictionary is another agent's file, so this
// adds no keys — it uses the names being added for it (stanceTitle,
// stanceYes, stanceNo, stanceUnknown, stanceRecognises, stanceEu,
// stanceNato, stanceBombed, stanceSanctioned, stanceDiplomatic,
// stanceSourceLink). A key that does not exist yet renders as its own name;
// that is acceptable for now, so each row falls back to plain wording from
// checklistFor() when t() hands back the raw key.

const MARKERS = {
  true: '✓',
  false: '✗',
  null: '–',
};

function markerFor(value) {
  if (value === true) return MARKERS.true;
  if (value === false) return MARKERS.false;
  return MARKERS.null;
}

function stateFor(value) {
  if (value === true) return 'yes';
  if (value === false) return 'no';
  return 'unknown';
}

/**
 * @param {object|null} record  a record from stanceFor(); null renders nothing
 */
export default function CountryChecklist({ record }) {
  const { t, lang } = useLanguage();

  // No record for this country — render nothing at all. Not an empty box,
  // not a "no data" placeholder: nothing.
  if (!record) return null;

  const rows = checklistFor(record, { lang });
  if (rows.length === 0) return null;

  const countryName = lang === 'en' ? record.name : record.nameSq || record.name;

  // t() returns the key name itself when the key is missing, so compare and
  // fall back to the plain wording rather than printing "stanceRecognises".
  const label = (key, fallback) => {
    const translated = t(key);
    return !translated || translated === key ? fallback : translated;
  };

  const wordFor = (value) => {
    if (value === true) return label('stanceYes', lang === 'en' ? 'yes' : 'po');
    if (value === false) return label('stanceNo', lang === 'en' ? 'no' : 'jo');
    return label('stanceUnknown', lang === 'en' ? 'unknown' : 'e panjohur');
  };

  return (
    <section className="vj-stance" aria-label={label('stanceTitle', lang === 'en' ? 'Where this country stands' : 'Ku qëndron ky shtet')}>
      <h3 className="vj-stance-title">
        {label('stanceTitle', lang === 'en' ? 'Where this country stands' : 'Ku qëndron ky shtet')}
        {countryName ? <span className="vj-stance-country"> — {countryName}</span> : null}
      </h3>

      <ul className="vj-stance-list">
        {rows.map((row) => (
          <li key={row.id} className={`vj-stance-row is-${stateFor(row.value)}`}>
            <span className="vj-stance-marker" aria-hidden="true">
              {markerFor(row.value)}
            </span>
            {/* The marker is decorative; the state is announced as a word so
                a screen reader never has to interpret a glyph. */}
            <span className="vj-stance-state-sr">{wordFor(row.value)}:</span>
            <span className="vj-stance-body">
              <span className="vj-stance-label">{label(row.label, row.fallback)}</span>
              {row.note && <span className="vj-stance-note"> {row.note}</span>}
              {row.value === null && (
                <span className="vj-stance-unknown-word">
                  {' '}
                  ({label('stanceUnknown', lang === 'en' ? 'unknown' : 'e panjohur')})
                </span>
              )}
              {row.source && (
                <a
                  className="vj-stance-source"
                  href={row.source.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  title={row.source.claim || undefined}
                >
                  {label('stanceSourceLink', lang === 'en' ? 'source' : 'burimi')}
                  {row.source.institution ? ` (${row.source.institution})` : ''}
                </a>
              )}
            </span>
          </li>
        ))}
      </ul>

      {/* One record-level note, once — not repeated onto every row. */}
      {record.note && <p className="vj-stance-record-note">{record.note}</p>}

      {/* An unverified record says so, and says which field is missing. A
          checklist that hides its own gaps is worse than no checklist. */}
      {!record.verified && (
        <p className="vj-stance-unverified">
          {lang === 'en'
            ? 'Not fully verified — unsourced field(s): '
            : 'E paverifikuar plotësisht — fusha pa burim: '}
          {(record.unverifiedFields || []).join(', ')}
        </p>
      )}
    </section>
  );
}
