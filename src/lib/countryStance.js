// Country stance checklist — loader + lookup helpers for
// /data/country-stance.json.
//
// WHY THIS EXISTS (owner, 2026-09-12, verbatim):
//
//   "make like a checklist when for instance norway . embargoed serbia.
//    bombed belgrade is in EU .supports independence and ggreat diplomatic
//    relations ! this must be all like a checklist"
//
// So when a scanned barcode resolves to a foreign country, the app can show
// where that country actually stands on Kosovo and where it stood on Serbia.
//
// THE ONE THING THAT MATTERS MOST HERE. The owner's own example contains a
// factual error: Norway is NOT in the European Union. It is in the EEA and
// in EFTA, and it is a founding NATO member. The dataset records
// `NO.euMember === false` deliberately, and this module never "fixes" it.
// Nothing in this file infers one field from another — no "Western European
// therefore EU", no "NATO member therefore bombed Belgrade in 1999" (six of
// the nineteen NATO members of 1999 took no part in Operation Allied Force).
// Every value is read straight out of the sourced dataset, or it stays null.
//
// THREE-STATE VALUES, NEVER TWO. Each criterion is `true | false | null`.
// `null` means "we could not source this", and it is a first-class state:
// the UI must render it as neither a tick nor a cross. Coercing null to
// false here would silently turn "unknown" into "no", which on a screen that
// sits next to genocide documentation is exactly the kind of quiet lie this
// project refuses to ship.

const EMPTY = Object.freeze({
  byIso: new Map(),
  builtAt: null,
  method: null,
  caveats: null,
  sourceCatalog: [],
  counts: null,
  isFallback: true,
});

/** Normalizes anything into `true | false | null` — never a coerced boolean. */
function tribool(value) {
  if (value === true) return true;
  if (value === false) return false;
  return null;
}

function toYear(value) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
}

function normalizeSource(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const url = typeof raw.url === 'string' ? raw.url.trim() : '';
  if (!url) return null;
  return {
    claim: raw.claim || null,
    url,
    institution: raw.institution || null,
  };
}

/** Normalizes one raw country record. Returns null if it has no usable ISO code. */
export function normalizeStanceRecord(raw, isoKey) {
  if (!raw || typeof raw !== 'object') return null;
  const iso = String(raw.iso || isoKey || '').trim().toUpperCase();
  if (!iso) return null;

  const sources = Array.isArray(raw.sources) ? raw.sources.map(normalizeSource).filter(Boolean) : [];

  return {
    iso,
    name: raw.name || iso,
    nameSq: raw.nameSq || raw.name || iso,

    recognisesKosovo: tribool(raw.recognisesKosovo),
    recognitionYear: toYear(raw.recognitionYear),
    recognitionDate: raw.recognitionDate || null,

    // Membership is a plain boolean in the dataset (a state either is or is
    // not on the published member list), but an absent field must not read
    // as `false` — that is how "we didn't check" becomes "it isn't a member".
    euMember: tribool(raw.euMember),
    euAccessionYear: toYear(raw.euAccessionYear),
    natoMember: tribool(raw.natoMember),
    natoAccessionYear: toYear(raw.natoAccessionYear),
    natoAccessionDate: raw.natoAccessionDate || null,

    bombedBelgrade1999: tribool(raw.bombedBelgrade1999),
    bombedBelgrade1999Basis: raw.bombedBelgrade1999Basis || null,

    sanctionedSerbia1990s: tribool(raw.sanctionedSerbia1990s),
    sanctionedSerbia1990sBasis: raw.sanctionedSerbia1990sBasis || null,

    diplomaticRelationsKosovo: tribool(raw.diplomaticRelationsKosovo),

    verified: raw.verified === true,
    unverifiedFields: Array.isArray(raw.unverifiedFields) ? raw.unverifiedFields : null,
    note: raw.note || null,
    sources,
  };
}

/** Accepts either `{ countries: { XX: {...} } }` or a bare array/map of records. */
export function normalizeStanceTable(raw) {
  let entries = [];

  if (Array.isArray(raw)) {
    entries = raw.map((r) => normalizeStanceRecord(r));
  } else if (raw && typeof raw === 'object') {
    const src = raw.countries || raw.table || raw.data || null;
    if (Array.isArray(src)) {
      entries = src.map((r) => normalizeStanceRecord(r));
    } else if (src && typeof src === 'object') {
      entries = Object.entries(src).map(([iso, r]) => normalizeStanceRecord(r, iso));
    }
  }

  const byIso = new Map();
  for (const rec of entries) {
    if (rec) byIso.set(rec.iso, rec);
  }
  if (byIso.size === 0) return null;

  return {
    byIso,
    builtAt: raw?.builtAt || null,
    method: raw?.method || null,
    caveats: raw?.caveats || null,
    sourceCatalog: Array.isArray(raw?.sourceCatalog)
      ? raw.sourceCatalog.map(normalizeSource).filter(Boolean)
      : [],
    counts: raw?.counts || null,
  };
}

/**
 * Loads /data/country-stance.json.
 *
 * Follows the same contract as every loader in lib/dataLoader.js: it never
 * throws, and on any failure it degrades to an EMPTY result. An empty table
 * means `stanceFor()` returns null for everything, which means the checklist
 * renders nothing at all — the app simply shows what it always showed. A
 * missing dataset must never be able to break a scan.
 */
export async function loadCountryStance() {
  try {
    const res = await fetch('/data/country-stance.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();
    const normalized = normalizeStanceTable(raw);
    if (!normalized) throw new Error('country-stance.json had no usable country records');
    return { ...normalized, isFallback: false };
  } catch (err) {
    console.warn('[vendorja] country-stance.json not available:', err.message);
    return { ...EMPTY, byIso: new Map(), sourceCatalog: [] };
  }
}

/** Returns the record for an ISO 3166-1 alpha-2 code, or null. */
export function stanceFor(iso, table) {
  if (!iso || !table) return null;
  const byIso = table instanceof Map ? table : table.byIso;
  if (!byIso || typeof byIso.get !== 'function') return null;
  return byIso.get(String(iso).trim().toUpperCase()) || null;
}

// Row labels. `label` is the dictionary key the UI resolves through t(); the
// keys themselves are owned by another agent's file, and a key that does not
// exist yet renders as its own name, which is ugly but never wrong.
// `fallback` is the plain-language wording used for the source-link title and
// as a last resort.
const ROW_DEFS = [
  { id: 'recognises', label: 'stanceRecognises', fallbackSq: 'E njeh pavarësinë e Kosovës', fallbackEn: 'Recognises Kosovo’s independence' },
  { id: 'diplomatic', label: 'stanceDiplomatic', fallbackSq: 'Marrëdhënie diplomatike me Kosovën', fallbackEn: 'Diplomatic relations with Kosovo' },
  { id: 'eu', label: 'stanceEu', fallbackSq: 'Anëtare e Bashkimit Evropian', fallbackEn: 'European Union member' },
  { id: 'nato', label: 'stanceNato', fallbackSq: 'Anëtare e NATO-s', fallbackEn: 'NATO member' },
  { id: 'bombed', label: 'stanceBombed', fallbackSq: 'Mori pjesë në bombardimet e NATO-s 1999', fallbackEn: 'Took part in the 1999 NATO air campaign' },
  { id: 'sanctioned', label: 'stanceSanctioned', fallbackSq: 'Zbatoi embargon e OKB-së ndaj Serbisë', fallbackEn: 'Implemented the UN embargo on Serbia' },
];

/** Picks the source whose claim best matches a row, so each row can link out. */
function sourceForRow(id, record) {
  const sources = record.sources || [];
  if (sources.length === 0) return null;
  const patterns = {
    recognises: /recognition|recognise/i,
    diplomatic: /diplomatic relations/i,
    // Deliberately narrow: "EU membership and year of accession" and "NATO
    // membership and date of accession" both contain "accession", so a
    // looser NATO pattern would link the NATO row at europa.eu.
    eu: /EU membership/i,
    nato: /NATO membership/i,
    bombed: /Allied Force|aircraft|air campaign/i,
    sanctioned: /UNSCR|embargo|admission date/i,
  };
  const re = patterns[id];
  if (!re) return null;
  return sources.find((s) => s.claim && re.test(s.claim)) || null;
}

/**
 * Turns a record into the ordered rows the checklist renders.
 *
 * Returns `[]` for a missing record, so a caller can render nothing without
 * a special case. Each row is `{ id, label, value: true|false|null, note }`.
 *
 * The order is the order the owner said it in: recognition and relations
 * first (where the country stands on Kosovo today), then the memberships,
 * then the two 1999/1990s historical facts. `value` is passed straight
 * through, nulls included.
 */
export function checklistFor(record, { lang = 'sq' } = {}) {
  if (!record) return [];

  const values = {
    recognises: record.recognisesKosovo,
    diplomatic: record.diplomaticRelationsKosovo,
    eu: record.euMember,
    nato: record.natoMember,
    bombed: record.bombedBelgrade1999,
    sanctioned: record.sanctionedSerbia1990s,
  };

  // Per-row note. Never invented: a year is only shown when the dataset
  // carries it, and a basis string is only shown when the dataset carries it.
  // The record-level `note` is deliberately NOT repeated onto every row —
  // the component renders it once, below the list.
  const notes = {
    recognises: record.recognisesKosovo === true && record.recognitionYear ? String(record.recognitionYear) : null,
    diplomatic: null,
    eu: record.euMember === true && record.euAccessionYear ? String(record.euAccessionYear) : null,
    nato: record.natoMember === true && record.natoAccessionYear ? String(record.natoAccessionYear) : null,
    bombed: record.bombedBelgrade1999Basis
      ? {
          aircraft: lang === 'en'
            ? 'contributed aircraft to Operation Allied Force'
            : 'dërgoi avionë në Operacionin Allied Force',
          'member-abstained': lang === 'en'
            ? 'a NATO member in 1999 that took no part in the air operations'
            : 'anëtare e NATO-s në 1999 që nuk mori pjesë në operacionet ajrore',
          'non-member': lang === 'en'
            ? 'not a NATO member in 1999; the operation was NATO-only'
            : 'jo anëtare e NATO-s në 1999; operacioni ishte vetëm i NATO-s',
          target: lang === 'en'
            ? 'it was inside the FRY, the target of the operation'
            : 'ishte brenda RFJ-së, objektiv i operacionit',
        }[record.bombedBelgrade1999Basis] || null
      : null,
    sanctioned: record.sanctionedSerbia1990sBasis
      ? {
          un: lang === 'en'
            ? 'as a UN member bound by UNSCR 757/820'
            : 'si anëtare e OKB-së, e detyruar nga Rezoluta 757/820',
          'un-late': lang === 'en'
            ? 'from its admission to the UN, part-way through the embargo'
            : 'nga anëtarësimi në OKB, në mes të embargos',
          autonomous: lang === 'en'
            ? 'autonomously — it was not a UN member at the time'
            : 'në mënyrë autonome — nuk ishte anëtare e OKB-së atëherë',
          target: lang === 'en'
            ? 'it was inside the FRY, the target of the embargo'
            : 'ishte brenda RFJ-së, objektiv i embargos',
        }[record.sanctionedSerbia1990sBasis] || null
      : null,
  };

  return ROW_DEFS.map((def) => ({
    id: def.id,
    label: def.label,
    fallback: lang === 'en' ? def.fallbackEn : def.fallbackSq,
    value: values[def.id] ?? null,
    note: notes[def.id] || null,
    source: sourceForRow(def.id, record),
  }));
}
