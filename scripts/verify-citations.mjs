#!/usr/bin/env node
// VERIFY CITATIONS — the check that keeps /pse honest after everyone leaves.
//
// Owner, 2026-09-16: "put on a source to all. if no source remove. all must
// have links and IEEE referencing".
//
// A content rule that lives only in a code comment is a rule that lasts until
// the next person edits the file in a hurry. This is the same rule as an
// executable check. It fails if:
//
//   1. any claim on /pse lacks a source;
//   2. any source in the registry lacks a resolvable-looking URL;
//   3. any in-text numeral would have no matching reference entry
//      (i.e. a claim cites a source id the registry does not know);
//   4. any reference entry is unreferenced — nothing cites it;
//   5. any source cannot be rendered as an IEEE entry;
//   6. a claim about an atrocity has no caveat where its source type
//      requires one (an indictment is a charge, not a finding).
//
// Run:      node scripts/verify-citations.mjs
// Verbose:  node scripts/verify-citations.mjs --list
// Links:    node scripts/verify-citations.mjs --check-links   (network)
//
// It also runs inside `npm test` via src/test/citations.test.js, so a broken
// citation fails the suite rather than shipping.

import {
  SOURCES,
  ACCESSED as ACCESSED_DATE,
  assertRegistry,
  formatIeee,
  formatCitationLabel,
} from '../src/content/sources.js';
import { MANIFESTO_SCREENS, argumentSourceIdsInOrder } from '../src/content/argument.js';
import {
  TRADE_STATS,
  TAX_STATS,
  MILITARY_SPEND,
  ARMS_ACQUISITIONS,
  TAX_IMPACT_DERIVED,
  economySourceIdsInOrder,
} from '../src/content/serbiaEconomy.js';
import { PSE_REGISTRY, pseSourceIdsInOrder } from '../src/content/pseCitations.js';

const problems = [];
const notes = [];
const fail = (m) => problems.push(m);

// ---------------------------------------------------------------------------
// 1. The registry itself: every source has a URL, a type, a year, an IEEE form
// ---------------------------------------------------------------------------
try {
  assertRegistry(SOURCES);
} catch (e) {
  fail(e.message);
}

// ---------------------------------------------------------------------------
// 2. Enumerate every CLAIM on /pse and demand a source for each
// ---------------------------------------------------------------------------
/** @type {{where: string, ids: string[], atrocity?: boolean, caveat?: boolean}[]} */
const claims = [];

for (const item of MANIFESTO_SCREENS) {
  claims.push({ where: `argument.js :: ${item.id}`, ids: item.sourceIds || [] });

  for (const site of item.massacres || []) {
    claims.push({
      where: `argument.js :: ${item.id} :: site "${site.place}"`,
      ids: site.sourceIds || [],
      atrocity: true,
      caveat: Boolean(site.caveatEn || site.caveatSq),
      finding: Boolean(site.findingEn || site.findingSq),
    });
  }

  for (const key of ['displaced', 'killed']) {
    const f = item.overallFigures?.[key];
    if (f && f.figure) {
      claims.push({
        where: `argument.js :: ${item.id} :: overallFigures.${key}`,
        ids: f.sourceIds || [],
      });
    }
  }
}

const economyGroups = [
  ['TRADE_STATS', TRADE_STATS],
  ['MILITARY_SPEND', MILITARY_SPEND],
  ['ARMS_ACQUISITIONS', ARMS_ACQUISITIONS],
  ['TAX_STATS', TAX_STATS],
  ['TAX_IMPACT_DERIVED', TAX_IMPACT_DERIVED],
];
for (const [groupName, group] of economyGroups) {
  for (const e of group) {
    claims.push({ where: `serbiaEconomy.js :: ${groupName} :: ${e.id}`, ids: e.sourceIds || [] });
  }
}

// RULE 1 — every claim has at least one source.
for (const c of claims) {
  if (!c.ids || c.ids.length === 0) {
    fail(`UNSOURCED CLAIM: ${c.where} has no sourceIds. Cite it or remove it.`);
  }
}

// RULE 3 — every cited id exists in the registry.
for (const c of claims) {
  for (const id of c.ids || []) {
    if (!SOURCES[id]) {
      fail(
        `DANGLING CITATION: ${c.where} cites "${id}", which is not in SOURCES ` +
          `(src/content/sources.js). This would render a numeral with no reference.`
      );
    }
  }
}

// RULE 6 — an atrocity claim states what its source actually establishes, and
// carries a caveat when it rests on an indictment (a charge, not a finding) or
// on an NGO field investigation.
for (const c of claims.filter((x) => x.atrocity)) {
  if (!c.finding) {
    fail(`ATROCITY CLAIM WITH NO FINDING TEXT: ${c.where} must say what its source establishes.`);
  }
  const needsCaveat = (c.ids || []).some(
    (id) => SOURCES[id]?.isAllegation || SOURCES[id]?.isFieldInvestigation
  );
  const isCourtBacked = (c.ids || []).some(
    (id) => SOURCES[id] && SOURCES[id].type === 'legal' && !SOURCES[id].isAllegation
  );
  if (needsCaveat && !isCourtBacked && !c.caveat) {
    fail(
      `ATROCITY CLAIM NEEDS A CAVEAT: ${c.where} rests only on an indictment or a field ` +
        `investigation. State that it is a charge / not a court finding, or cite a judgement.`
    );
  }
}

// ---------------------------------------------------------------------------
// 3. The rendered registry: numbering, and no orphan entries
// ---------------------------------------------------------------------------
let registry = null;
try {
  registry = PSE_REGISTRY;
} catch (e) {
  fail(`REGISTRY BUILD FAILED: ${e.message}`);
}

if (registry) {
  const citedIds = new Set(pseSourceIdsInOrder());

  // RULE 4 — nothing in the registry is unreferenced.
  for (const id of Object.keys(SOURCES)) {
    if (!citedIds.has(id)) {
      fail(
        `UNREFERENCED SOURCE: "${id}" is in SOURCES but no claim on /pse cites it. ` +
          `An IEEE reference list carries cited works only — remove it, or cite it.`
      );
    }
  }

  // Numbering must be 1..n, contiguous, in document order.
  registry.entries.forEach((e, i) => {
    if (e.n !== i + 1) fail(`NUMBERING BROKEN: entry ${i} has number ${e.n}, expected ${i + 1}.`);
    if (!e.url) fail(`REFERENCE WITHOUT URL: [${e.n}] ${e.id}.`);
    if (!e.text || e.text.length < 12) fail(`REFERENCE WITHOUT IEEE TEXT: [${e.n}] ${e.id}.`);
  });

  // Every claim resolves to at least one real number.
  for (const c of claims) {
    const ns = (c.ids || []).map((id) => registry.numberOf(id)).filter(Number.isInteger);
    if (ns.length === 0) {
      fail(`CLAIM RENDERS NO NUMERAL: ${c.where} — would print nothing where a citation belongs.`);
    }
  }

  notes.push(`${claims.length} claims audited`);
  notes.push(`${registry.entries.length} references, numbered 1–${registry.entries.length}`);
  notes.push(`${argumentSourceIdsInOrder().length} sources in the legal record`);
  notes.push(`${economySourceIdsInOrder().length} sources in the economic dossier`);
}

// ---------------------------------------------------------------------------
// 4. Sanity-check the in-text label formatter (IEEE ranges)
// ---------------------------------------------------------------------------
const labelCases = [
  [[1], '[1]'],
  [[1, 4], '[1], [4]'],
  [[1, 2], '[1], [2]'],
  [[1, 2, 3], '[1]–[3]'],
  [[1, 2, 3, 7], '[1]–[3], [7]'],
  [[], ''],
];
for (const [input, expected] of labelCases) {
  const got = formatCitationLabel(input);
  if (got !== expected) {
    fail(`IEEE LABEL FORMAT: formatCitationLabel(${JSON.stringify(input)}) = "${got}", expected "${expected}".`);
  }
}

// ---------------------------------------------------------------------------
// Optional: actually fetch every URL. Off by default — the check must pass
// offline and in CI without network, and link rot is a separate concern from
// "is this claim cited".
// ---------------------------------------------------------------------------
async function checkLinks() {
  const results = [];
  for (const [id, s] of Object.entries(SOURCES)) {
    try {
      const res = await fetch(s.url, {
        redirect: 'follow',
        headers: { 'user-agent': 'Mozilla/5.0 (vendorja link check)' },
      });
      results.push([res.status, id, s.url]);
      if (res.status >= 400 && !s.botBlocked) {
        fail(`DEAD LINK: [${res.status}] ${id} -> ${s.url}`);
      }
    } catch (e) {
      results.push(['ERR', id, s.url]);
      if (!s.botBlocked) fail(`UNREACHABLE: ${id} -> ${s.url} (${e.message})`);
    }
  }
  for (const [status, id, url] of results) console.log(`  ${String(status).padEnd(4)} ${id}  ${url}`);
}

const argv = process.argv.slice(2);

if (argv.includes('--list') && registry) {
  console.log('\nREFERENCE LIST (IEEE, citation order)\n');
  for (const e of registry.entries) {
    console.log(`[${e.n}] ${formatIeee(e.source)}`);
    console.log(`     Available: ${e.url}\n`);
  }
}

// --markdown regenerates the machine-written half of src/content/SOURCES.md,
// so the prose file and the registry cannot drift apart. SOURCES.md keeps the
// human half (what each source does and does NOT support, what was removed
// and why) above the marker; everything below it is generated.
if (argv.includes('--markdown') && registry) {
  const lines = [];
  lines.push('### Reference list (IEEE, citation order)');
  lines.push('');
  lines.push(`Generated by \`node scripts/verify-citations.mjs --markdown\`. ${registry.entries.length} references; every one is cited on /pse and every one resolves. Do not hand-edit below this point.`);
  lines.push('');
  for (const e of registry.entries) {
    lines.push(`${e.n}. ${formatIeee(e.source)} [Online]. Available: <${e.url}> [Accessed: ${ACCESSED_DATE}]`);
  }
  lines.push('');
  lines.push('### Which claim cites which reference');
  lines.push('');
  lines.push('| Claim | References |');
  lines.push('| --- | --- |');
  for (const c of claims) {
    const ns = (c.ids || []).map((id) => registry.numberOf(id)).filter(Number.isInteger);
    lines.push(`| ${c.where.split('|').join('\\|')} | ${formatCitationLabel(ns)} |`);
  }
  console.log(lines.join('\n'));
}

if (argv.includes('--check-links')) {
  console.log('\nLINK CHECK\n');
  await checkLinks();
}

console.log('');
if (problems.length) {
  console.error(`verify-citations: FAILED with ${problems.length} problem(s):\n`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  console.error('');
  process.exit(1);
}

console.log('verify-citations: OK');
for (const n of notes) console.log(`  · ${n}`);
console.log('');

export { problems };
