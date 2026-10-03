import { useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import Cite from './citation/Cite.jsx';
import { PSE_REGISTRY } from '../content/pseCitations.js';
import {
  TRADE_STATS,
  TAX_STATS,
  MILITARY_SPEND,
  ARMS_ACQUISITIONS,
  TAX_IMPACT_DERIVED,
  TAX_IMPACT_COPY,
  PANEL_COPY,
} from '../content/serbiaEconomy.js';

// /pse STATISTICS — one table style for every section.
//
// Owner, 2026-09-12: "taksat e tyre this table putting section looks good
// make it somewhat like that all of the others . these all let them be like
// taksat e tyre style! but place them all at the very bottom of this
// section and remove unneccessary ones . make some shorter."
//
// Owner, 2026-09-14: "this pse section is shit and undersymmetrical
// fixthis right now . and make it a detailed for everythign".
//
// HISTORY, so nobody swings the pendulum back by accident:
//   * The FIRST version rendered all 52 figures as full cards with wrapped
//     source lines: 12,034px of panel, the arms section alone 4,056px.
//   * The SECOND version fixed that by hiding 31 of the 52 figures behind a
//     "show all" toggle. That is what the owner is now calling "shit" — a
//     dossier that shows 21 of its 52 figures is not a dossier.
//   * THIS version keeps the compact row (the part that worked) and drops
//     the curation (the part that did not). Every one of the 52 sourced
//     figures renders by default, in one grid, with its source link and its
//     unverified marker. Measured after the change: ~2.3k px for 52 rows,
//     against 12k for the card version — the row, not the hiding, is what
//     made the panel readable.
//
// The toggle now controls DEPTH, not existence: on, every row also shows
// its sourced note and the name of the document it came from. Nothing is
// ever removed from the page by it.

function pick(lang, en, sq) {
  return lang === 'sq' && sq ? sq : en;
}

function copy(lang, entry) {
  if (!entry) return '';
  return lang === 'sq' ? entry.sq || entry.en : entry.en || entry.sq;
}

/**
 * The citation every sourced row carries. Never conditional on space.
 *
 * 2026-09-16: this used to be a bare "↗" — a link with no identity, which
 * told a reader nothing about WHICH document a figure came from without
 * clicking out of the page. It is now the IEEE numeral, which names the
 * document by its entry in the reference list at the bottom of /pse and
 * still links (to that entry; the entry links onward to the document). The
 * external link is kept alongside it so a reader can still jump straight to
 * the source in one click.
 */
function SourceLink({ entry, registry, t }) {
  return (
    <td className="vj-pse-row-src">
      <Cite ids={entry.sourceIds} registry={registry} t={t} />
      {entry.sourceUrl && (
        <a
          className="vj-pse-row-out"
          href={entry.sourceUrl}
          target="_blank"
          rel="noreferrer"
          title={entry.source}
        >
          ↗
        </a>
      )}
    </td>
  );
}

/** The expandable second line: the sourced note, plus the document name. */
function NoteRow({ entry, lang, show }) {
  const note = pick(lang, entry.note, entry.noteSq);
  if (!show || (!note && !entry.source)) return null;
  return (
    <tr className="vj-pse-noterow">
      <td colSpan={3} className="vj-pse-note">
        {note && <span className="vj-pse-note-text">{note}</span>}
        {entry.source && (
          <span className="vj-pse-note-src">
            {copy(lang, PANEL_COPY.sourceWord)}: {entry.source}
          </span>
        )}
      </td>
    </tr>
  );
}

/** One table row: figure | label + year | source. */
function StatRow({ entry, lang, t, notes, registry }) {
  const label = pick(lang, entry.label, entry.labelSq);
  const unverified = entry.verified === false;
  // Each entry is its own <tbody> (legal HTML, any number per table) so the
  // zebra stripe counts ENTRIES, not <tr>s — with the note row expanded a
  // tr-based stripe puts every figure on the same shade.
  return (
    <tbody className={`vj-pse-entry${unverified ? ' is-unverified' : ''}`}>
      <tr className={`vj-pse-row${unverified ? ' is-unverified' : ''}`}>
        <th scope="row" className="vj-pse-row-value">
          {pick(lang, entry.value, entry.valueSq)}
          {entry.unit ? (
            <span className="vj-pse-row-unit"> {pick(lang, entry.unit, entry.unitSq)}</span>
          ) : null}
        </th>
        {/* NO line clamp here, deliberately — see the CSS note. A clamp was
            tried twice and both times sliced a cited year ("· 2017") in
            half, which is hiding part of a citation. */}
        <td className="vj-pse-row-label">
          {label}
          {entry.year ? <span className="vj-pse-row-year"> · {entry.year}</span> : null}
          {unverified && <span className="vj-pse-row-flag">{t('pseStatsUnverified')}</span>}
        </td>
        <SourceLink entry={entry} registry={registry} t={t} />
      </tr>
      <NoteRow entry={entry} lang={lang} show={notes} />
    </tbody>
  );
}

/** Arms row: quantity | what it is · how many of what · supplier · year. */
function ArmsRow({ entry, lang, t, notes, registry }) {
  const unverified = entry.verified === false;
  // The quantity column holds the NUMBER and nothing else. Qualifiers like
  // "in service, of 125 ordered" used to sit in this cell, which is fixed
  // width with `text-overflow: ellipsis` — so five of the eight visible arms
  // rows rendered as "~80 në shërbi…", "112 të porosit…", "12 avionë (9 nj…".
  // That is a sourced figure truncated mid-word. The qualifier now runs on
  // the label line, where it has the room to be read in full.
  const qualifier = pick(lang, entry.unit, entry.unitSq);
  const system = pick(lang, entry.system, entry.labelSq);
  const supplier = pick(lang, entry.supplier, entry.supplierSq);
  const deal = pick(lang, entry.dealValue, entry.dealValueSq);
  return (
    <tbody className={`vj-pse-entry${unverified ? ' is-unverified' : ''}`}>
      <tr className={`vj-pse-row${unverified ? ' is-unverified' : ''}`}>
        <th scope="row" className="vj-pse-row-value">
          {entry.quantity || '—'}
        </th>
        <td className="vj-pse-row-label">
          {system}
          {qualifier ? <span className="vj-pse-row-qual"> — {qualifier}</span> : null}
          <span className="vj-pse-row-year">
            {supplier ? ` · ${supplier}` : ''}
            {entry.year ? ` · ${entry.year}` : ''}
          </span>
          {/* The deal value used to live in a `title` tooltip, which is
              unreachable on a phone. It is sourced; it shows. */}
          {deal ? (
            <span className="vj-pse-row-deal">
              {copy(lang, PANEL_COPY.dealWord)}: {deal}
            </span>
          ) : null}
          {unverified && <span className="vj-pse-row-flag">{t('pseStatsUnverified')}</span>}
        </td>
        <SourceLink entry={entry} registry={registry} t={t} />
      </tr>
      <NoteRow entry={entry} lang={lang} show={notes} />
    </tbody>
  );
}

function SectionHead({ heading, lead, count, lang }) {
  return (
    <header className="vj-pse-sec-head">
      <h3 className="vj-pse-sec-title">
        {heading}
        <span className="vj-pse-sec-count">
          {count} {copy(lang, PANEL_COPY.figuresWord)}
        </span>
      </h3>
      {lead && <p className="vj-pse-sec-lead">{copy(lang, lead)}</p>}
    </header>
  );
}

function Section({ heading, lead, entries, lang, t, notes, registry, Row = StatRow, onRed = false }) {
  if (!entries || entries.length === 0) return null;
  return (
    <section className={`vj-pse-sec${onRed ? ' is-onred' : ''}`}>
      <SectionHead heading={heading} lead={lead} count={entries.length} lang={lang} />
      <table className={`vj-pse-table${onRed ? ' is-onred' : ''}`}>
        {entries.map((e) => (
          <Row key={e.id} entry={e} lang={lang} t={t} notes={notes} registry={registry} />
        ))}
      </table>
    </section>
  );
}

/**
 * Arms, grouped by what the system IS. 17 acquisitions in one undifferentiated
 * list read as noise; tanks, aircraft, air defence and drones read as an
 * inventory. Group order follows first appearance in the data file — no
 * ranking is implied and no entry is dropped.
 */
function ArmsSections({ lang, t, notes, heading, lead, registry }) {
  const groups = [];
  const byKey = new Map();
  for (const e of ARMS_ACQUISITIONS) {
    const key = e.category || '—';
    if (!byKey.has(key)) {
      const g = { key, label: pick(lang, e.category, e.categorySq), items: [] };
      byKey.set(key, g);
      groups.push(g);
    }
    byKey.get(key).items.push(e);
  }
  return (
    <section className="vj-pse-sec">
      <SectionHead heading={heading} lead={lead} count={ARMS_ACQUISITIONS.length} lang={lang} />
      {groups.map((g) => (
        <div className="vj-pse-group" key={g.key}>
          <h4 className="vj-pse-group-title">
            {g.label}
            <span className="vj-pse-sec-count">{g.items.length}</span>
          </h4>
          <table className="vj-pse-table">
            {g.items.map((e) => (
              <ArmsRow key={e.id} entry={e} lang={lang} t={t} notes={notes} registry={registry} />
            ))}
          </table>
        </div>
      ))}
    </section>
  );
}

/** A derived calculation — visibly not a measured statistic. */
function ImpactRow({ entry, lang, registry, t }) {
  const refusal = entry.kind === 'refusal';
  return (
    <li className={`vj-pse-impact${refusal ? ' is-refusal' : ''}`}>
      <p className="vj-pse-impact-top">
        <span className="vj-pse-impact-figure">{pick(lang, entry.value, entry.valueSq)}</span>
        <span className="vj-pse-impact-badge">
          {copy(lang, refusal ? TAX_IMPACT_COPY.refusalBadge : TAX_IMPACT_COPY.derivedBadge)}
        </span>
      </p>
      <p className="vj-pse-impact-label">{pick(lang, entry.label, entry.labelSq)}</p>
      {entry.arithmetic && <p className="vj-pse-impact-math">{entry.arithmetic}</p>}
      {/* The inputs are the whole point of showing arithmetic: without them
          a reader cannot check the sum. They were carried in the data from
          the start and never rendered. */}
      {(entry.inputs || entry.inputsSq) && (
        <ul className="vj-pse-impact-inputs">
          {(pick(lang, entry.inputs, entry.inputsSq) || []).map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      )}
      <p className="vj-pse-impact-note">
        {pick(lang, entry.assumption, entry.assumptionSq)}
        {/* A derived row is arithmetic, but its INPUTS are claims and the
            inputs have sources. Citing them is what lets a reader check the
            sum rather than take it. */}
        <Cite ids={entry.sourceIds} registry={registry} t={t} />
      </p>
    </li>
  );
}

export default function SerbiaProfitPanel({ registry = PSE_REGISTRY }) {
  const { t, lang } = useLanguage();
  const [notes, setNotes] = useState(false);

  const total =
    TRADE_STATS.length + TAX_STATS.length + MILITARY_SPEND.length + ARMS_ACQUISITIONS.length;

  return (
    <section className="vj-pse-stats" aria-label={t('pseStatsTitle')}>
      <header className="vj-pse-stats-head">
        <h2 className="vj-pse-stats-title">{t('pseStatsTitle')}</h2>
        <p className="vj-pse-stats-count">
          {total} {copy(lang, PANEL_COPY.figuresWord)} · {copy(lang, PANEL_COPY.allShown)}
        </p>
      </header>

      <Section
        heading={t('pseStatsTrade')}
        lead={PANEL_COPY.leadTrade}
        entries={TRADE_STATS}
        lang={lang}
        t={t}
        notes={notes}
        registry={registry}
      />
      <Section
        heading={t('pseStatsMilitary')}
        lead={PANEL_COPY.leadMilitary}
        entries={MILITARY_SPEND}
        lang={lang}
        t={t}
        notes={notes}
        registry={registry}
      />
      <ArmsSections
        heading={t('pseStatsArms')}
        lead={PANEL_COPY.leadArms}
        lang={lang}
        t={t}
        notes={notes}
        registry={registry}
      />

      {/* TAX LAST, in red — the closing argument, not an opening statistic. */}
      <div className="vj-pse-tax-foot">
        <SectionHead
          heading={t('pseStatsTax')}
          lead={PANEL_COPY.leadTax}
          count={TAX_STATS.length}
          lang={lang}
        />
        <table className="vj-pse-table is-onred">
          {TAX_STATS.map((e) => (
            <StatRow key={e.id} entry={e} lang={lang} t={t} notes={notes} registry={registry} />
          ))}
        </table>

        {TAX_IMPACT_DERIVED?.length > 0 && (
          <ul className="vj-pse-impact-list">
            {TAX_IMPACT_DERIVED.map((e) => (
              <ImpactRow key={e.id} entry={e} lang={lang} registry={registry} t={t} />
            ))}
          </ul>
        )}
      </div>

      {/* Depth, not existence: this never removes a figure from the page. */}
      <button
        type="button"
        className="vj-pse-toggle"
        aria-expanded={notes}
        onClick={() => setNotes((v) => !v)}
      >
        {notes ? '−' : '+'} {copy(lang, notes ? PANEL_COPY.notesHide : PANEL_COPY.notesShow)}
      </button>
    </section>
  );
}
