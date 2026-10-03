// OPEN CASES — the unanswered half of /alternativa, named and given a
// filter of its own.
//
// Owner, 2026-09-18, verbatim:
//
//   "and when a serbian product and is live a case is opened for it and its
//    at the very top if it isnt not yet on the page at the no alternatives
//    found part there"
//
// A Serbian product that is in the catalogue and has NO exact 1:1
// replacement is not a dead end, it is an outstanding piece of work — a
// CASE — rather than the "no alternatives found" footnote it used to be.
//
// WHERE THEY GO — and the first answer was wrong (same day, corrected by
// the owner before it shipped):
//
//   "at the very top show the ones that have been found always"
//   "only to the second filter can one see raste te hapura and me
//    zevendesim . always show me zevendsim first then the other 2 buttons"
//
// So the cases are NOT what greets a shopper. The 159 products we can
// actually answer lead the page — `me zëvendësim` is the default tab —
// and the 200 cases live behind their own filter, counted in the tally
// strip and on the tab itself so they are impossible to miss and equally
// impossible to mistake for the whole screen. A first cut of this feature
// promoted six cases to the very top of the default view; that inverted
// the app, because someone opening /alternativa wants the thing they can
// buy instead, not the list of things we have failed to find. Hence this
// module has no "board": there is no subset to pick, because the case list
// is a filter now and shows all 200.
//
// ---------------------------------------------------------------------------
// A CASE IS DERIVED, NOT STORED. THIS IS THE WHOLE DESIGN.
// ---------------------------------------------------------------------------
// There is no backend provisioned on this repo: api/proposals.js answers
// 503 { error: "not_provisioned" } until someone sets KV_REST_API_URL, and
// src/lib/proposals.js degrades the UI to "you cannot propose right now".
// So this module has NO case id, NO status field, NO assignee, NO opened-at
// timestamp, NO store and NO writes. Every one of those would be a database
// column, and a case tracker whose state cannot survive a page reload is a
// worse lie than no tracker at all — it would show "3 cases closed" that
// nobody closed.
//
// A case is a QUESTION THE DATA ALREADY ASKS, recomputed on every render
// from exactly one fact: `answer.items.length === 0`. Close the gap in the
// data and the case disappears by itself, because it was never anywhere
// else. If you find yourself adding `caseId` below, stop.
//
// ---------------------------------------------------------------------------
// TWO KINDS, AND THEY ARE GENUINELY DIFFERENT WORK
// ---------------------------------------------------------------------------
// The screen already distinguishes them and that distinction is the honest
// part of this feature — collapsing them into one number would flatten "we
// know what this is and have nothing to offer" into "we have no idea what
// this is", which are not the same admission and are not closed the same
// way. Measured on the shipped catalogue, 2026-09-18
// (`node scripts/eval-alternatives.mjs`, SET F):
//
//   359 Serbian products · 159 with an exact match · 200 open cases
//     59  RESOLVABLE   — the family IS established (chocolate-spread,
//                        school-bags, vacuum-flasks...) and there is simply
//                        no proven-local product in it. Someone standing in
//                        a shop who knows a Kosovar chocolate spread can
//                        close this with one proposal: we know what to
//                        compare it against.
//    141  UNIDENTIFIED — `exactFamilyOf` could not establish what the thing
//                        even is, so there is nothing to compare against.
//                        A proposal still helps, but the missing fact is
//                        the product's own identity, not a replacement.
//
// Both numbers are printed above the case list, never summed into one, and
// each row says which kind it is and what would close it.

/** The two kinds of open case. Derived labels, not stored states. */
export const CASE_KIND = Object.freeze({
  /** Family established, no proven-local product in it. */
  RESOLVABLE: 'family-known',
  /** Family could not be established at all. */
  UNIDENTIFIED: 'family-undetermined',
});

/**
 * Is this row an open case, and which kind?
 *
 * @param {{answer?: {items?: unknown[], family?: string|null}}|null} row
 *   one entry as AlternativaScreen builds it: a Serbian product plus the
 *   answer `exactAlternativesFor` returned for it.
 * @returns {{kind: string, family: string|null}|null}
 *   null when the row has an exact match — an answered row is not a case.
 */
export function openCaseOf(row) {
  const answer = row?.answer;
  if (!answer) return null;
  if ((answer.items?.length || 0) > 0) return null;
  return {
    kind: answer.family ? CASE_KIND.RESOLVABLE : CASE_KIND.UNIDENTIFIED,
    family: answer.family || null,
  };
}

/**
 * The page's counts, in one pass.
 *
 * `open === resolvable + unidentified` and `total === matched + open` are
 * both invariants of this function and both asserted in the tests, because
 * the one way a derived count can lie is by being computed twice in two
 * places that drift apart.
 *
 * @returns {{total: number, matched: number, open: number,
 *            resolvable: number, unidentified: number}}
 */
export function tallyCases(rows) {
  const out = { total: 0, matched: 0, open: 0, resolvable: 0, unidentified: 0 };
  for (const row of rows || []) {
    out.total += 1;
    const open = openCaseOf(row);
    if (!open) {
      out.matched += 1;
      continue;
    }
    out.open += 1;
    if (open.kind === CASE_KIND.RESOLVABLE) out.resolvable += 1;
    else out.unidentified += 1;
  }
  return out;
}
