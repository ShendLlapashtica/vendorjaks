import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { CASE_KIND, openCaseOf, tallyCases } from '../lib/openCases.js';

// OPEN CASES — the derived view behind the `raste të hapura` filter on
// /alternativa.
//
// Owner, 2026-09-18: "and when a serbian product and is live a case is
// opened for it", and then, on where they go: "at the very top show the
// ones that have been found always" — so the answered half leads and the
// cases live behind their own tab.
//
// What these tests are actually defending is the thing that could go wrong
// quietly: a "case tracker" that grows an id, a status and a store, and
// then lies about state it cannot keep (there is no backend — api/
// proposals.js answers 503 until someone provisions a KV store). So the
// last describe() reads src/lib/openCases.js as TEXT and fails on any of
// the four shapes that would turn a derived list into a fake database.
// Same technique as src/test/proposals.test.js, for the same reason.

/** One /alternativa row, in the shape AlternativaScreen builds. */
function row(key, { family = null, items = 0 } = {}) {
  return {
    key,
    product: { id: key, name: key },
    listings: 1,
    family,
    answer: { family, items: Array.from({ length: items }, (_, i) => ({ name: `${key}-alt${i}` })) },
  };
}

const answered = (key) => row(key, { family: 'biscuits', items: 2 });
const resolvable = (key) => row(key, { family: 'chocolate-spread', items: 0 });
const unidentified = (key) => row(key, { family: null, items: 0 });

describe('openCaseOf — a case is one fact, not a record', () => {
  it('a row with an exact match is not a case', () => {
    expect(openCaseOf(answered('a'))).toBeNull();
  });

  it('a gap whose family IS established is the resolvable kind', () => {
    expect(openCaseOf(resolvable('b'))).toEqual({
      kind: CASE_KIND.RESOLVABLE,
      family: 'chocolate-spread',
    });
  });

  it('a gap whose family cannot be established is the other kind', () => {
    // 200 open cases split 59 / 141 on the shipped catalogue, and these two
    // are NOT the same admission: one says "we know it is a chocolate
    // spread and have no Kosovar one", the other says "we cannot tell what
    // this is". Collapsing them would be the dishonest simplification.
    expect(openCaseOf(unidentified('c'))).toEqual({
      kind: CASE_KIND.UNIDENTIFIED,
      family: null,
    });
  });

  it('is total over junk input rather than throwing on a half-built row', () => {
    expect(openCaseOf(null)).toBeNull();
    expect(openCaseOf({})).toBeNull();
    expect(openCaseOf({ answer: {} })).toEqual({ kind: CASE_KIND.UNIDENTIFIED, family: null });
  });

  it('decides ONLY from the answer — a family on the row cannot open a case', () => {
    // The row carries `family` too (collectSerbianProducts sets it). If
    // this function ever read that instead of `answer.items`, an answered
    // product would start showing a case badge.
    expect(openCaseOf({ ...answered('d'), family: null })).toBeNull();
  });
});

describe('tallyCases — the counts the page prints', () => {
  const rows = [
    answered('m1'),
    answered('m2'),
    answered('m3'),
    resolvable('r1'),
    resolvable('r2'),
    unidentified('u1'),
    unidentified('u2'),
    unidentified('u3'),
    unidentified('u4'),
  ];

  it('counts every row exactly once', () => {
    const t = tallyCases(rows);
    expect(t).toEqual({ total: 9, matched: 3, open: 6, resolvable: 2, unidentified: 4 });
  });

  it('holds the two invariants the screen depends on', () => {
    const t = tallyCases(rows);
    expect(t.matched + t.open).toBe(t.total);
    expect(t.resolvable + t.unidentified).toBe(t.open);
  });

  it('is zero everywhere on an empty or missing list', () => {
    expect(tallyCases([])).toEqual({ total: 0, matched: 0, open: 0, resolvable: 0, unidentified: 0 });
    expect(tallyCases(undefined)).toEqual({ total: 0, matched: 0, open: 0, resolvable: 0, unidentified: 0 });
  });
});

describe('a case is DERIVED — the module must not grow a database', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'src/lib/openCases.js'), 'utf8');
  // Strip comments first: the file ARGUES about ids and statuses at length
  // and that prose must not trip the assertions below.
  const code = src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');

  it('never mints an id, a status or an assignee', () => {
    for (const forbidden of [/\bcaseId\b/, /\bassignee\b/, /randomUUID/, /\bstatus\s*:/]) {
      expect(code, `openCases.js must not contain ${forbidden}`).not.toMatch(forbidden);
    }
  });

  it('never writes anywhere — no storage, no network, no clock', () => {
    for (const forbidden of [/localStorage/, /sessionStorage/, /indexedDB/, /\bfetch\s*\(/, /Date\.now/]) {
      expect(code, `openCases.js must not contain ${forbidden}`).not.toMatch(forbidden);
    }
  });

  it('holds no module-level mutable state a "case" could be parked in', () => {
    expect(code).not.toMatch(/^\s*(let|var)\s/m);
  });
});

describe('every string the case UI renders exists in BOTH languages', () => {
  it('has no missing key and no placeholder left unfilled', async () => {
    const { dictionary, translate } = await import('../i18n/dictionary.js');
    const keys = [
      'altCasesTitle',
      'altCasesLede',
      'altCasesKindKnown',
      'altCasesKindUnknown',
      'altCasesNote',
      'altCaseMarkKnown',
      'altCaseMarkUnknown',
      'altCaseCloseKnown',
      'altCaseCloseUnknown',
      'altTallyGap',
      'altFilterGap',
    ];
    for (const key of keys) {
      expect(dictionary.sq[key], `sq.${key}`).toBeTypeOf('string');
      expect(dictionary.en[key], `en.${key}`).toBeTypeOf('string');
      expect(dictionary.sq[key].length, `sq.${key}`).toBeGreaterThan(0);
      expect(dictionary.en[key].length, `en.${key}`).toBeGreaterThan(0);
    }
    // Every {placeholder} the screen passes is actually substituted — an
    // unfilled `{n}` is the kind of thing a green suite has shipped before.
    for (const lang of ['sq', 'en']) {
      expect(translate(lang, 'altCasesTitle', { n: 200 })).not.toMatch(/[{}]/);
      expect(translate(lang, 'altCasesNote')).not.toMatch(/[{}]/);
      expect(translate(lang, 'altCaseCloseKnown', { v: 'krem çokollate' })).not.toMatch(/[{}]/);
      expect(translate(lang, 'altCaseCloseUnknown')).not.toMatch(/[{}]/);
    }
  });
});

describe('the answered half leads — the owner corrected this once already', () => {
  // Owner, 2026-09-18: "at the very top show the ones that have been found
  // always" and "always show me zevendsim first then the other 2 buttons".
  //
  // Read as SOURCE TEXT rather than rendered, for the same reason
  // src/test/proposals.test.js reads its component: this repo has no DOM
  // test environment, and the two facts worth locking are the default tab
  // and the tab ORDER — both single expressions that a later edit could
  // flip back without anything else failing.
  const src = fs.readFileSync(path.join(process.cwd(), 'src/components/AlternativaScreen.jsx'), 'utf8');

  it("opens on the products we CAN answer, not on the gaps", () => {
    expect(src).toMatch(/useState\('matched'\)/);
    expect(src).not.toMatch(/useState\('all'\)/);
    expect(src).not.toMatch(/useState\('gap'\)/);
  });

  it('orders the tabs: with a match, then the cases, then everything', () => {
    expect(src).toMatch(/\['matched', 'gap', 'all'\]/);
  });

  it('renders the open-case header only inside the case filter', () => {
    // A banner explaining the 200 unanswered products, sitting over the
    // default view, is exactly the inversion that had to be undone.
    expect(src).toMatch(/filter === 'gap' && \(/);
  });

  it('adds no parallel submit path — the case is closed by the propose control that already exists', () => {
    expect(src).toMatch(/<ProposeAlternative/);
    expect(src.match(/<ProposeAlternative/g)).toHaveLength(1);
    expect(src).not.toMatch(/fetch\(/);
  });
});
