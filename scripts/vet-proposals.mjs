#!/usr/bin/env node
// ===========================================================================
// vet-proposals.mjs — review shopper-proposed alternatives, one at a time.
//
// Owner, 2026-09-17: "they will undergo a vetting process and then YOU decide
// wether 1:1 match aswell". The decision is a human's. This tool's only job
// is to put every fact the app already holds on the screen BEFORE the human
// answers, so the answer is made against evidence and not against a stranger's
// confidence.
//
// WHAT IT PRE-FLIGHTS, so a human does not have to catch it
//   [SERBIAN]   the proposed "alternative" is itself GS1-Serbia registered
//   [BOYCOTT]   the proposed alternative's barcode or brand is on
//               data/boycott-brands.json
//   [SELF]      it is the same product, or the same brand, as the thing it
//               claims to replace
//   [FAMILY]    the two products' category families disagree — milk is not
//               an alternative to yogurt (house rule 8)
//   [UNKNOWN]   the proposed barcode is in no catalogue we hold, so there is
//               nothing to check it against
//   [NOT-LOCAL] the catalogue row exists but does not prove a local brand.
//               `isLocalBrand: null` and `false` are BOTH "not proven local".
//
// NONE OF THESE AUTO-REJECT. A flag is a reason shown to a reviewer, and the
// reviewer can accept over it (a brand-only proposal for a real Kosovar maker
// the catalogue has never heard of is exactly the case this queue exists for).
// What the tool refuses to do is let the flag go unnoticed.
//
// ---------------------------------------------------------------------------
// RUNNING IT
// ---------------------------------------------------------------------------
//   node scripts/vet-proposals.mjs                 # review the live queue
//   node scripts/vet-proposals.mjs --list          # print the dossiers, decide nothing
//   node scripts/vet-proposals.mjs --input f.json  # review a file instead of the store
//   node scripts/vet-proposals.mjs --dry-run       # decide, write nothing anywhere
//   node scripts/vet-proposals.mjs --no-catalogue  # skip the 66 MB retail load
//
// The live queue needs the same store credentials api/proposals.js uses:
//   KV_REST_API_URL + KV_REST_API_TOKEN   (Vercel KV / Upstash integration)
//   UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN   (Upstash direct)
// With neither set the tool says "not provisioned" and exits 0 — there is
// nothing to review, which is not a failure. `--input` needs no store at all
// and is how this script is exercised in CI and in the tests.
//
// The Redis-over-REST transport below is a deliberate ten-line copy of the one
// in api/proposals.js rather than an import: that module must not EXPORT any
// function capable of handing a caller the pending queue's contents, because
// the test suite walks its exports to prove a pending proposal cannot reach a
// shopper. The privilege to read the queue lives here, in a tool you run with
// the store's own credentials on your own machine.
// ===========================================================================

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

import { classifyBarcode } from '../src/lib/gs1.js';
import { normalizeBoycottTable, findBoycottByCode, findBoycottByBrand } from '../src/lib/boycott.js';
import { categoryFamilyOf } from '../src/lib/categoryFamily.js';
// Read-only import of the resolver helpers. The family a reviewer is
// shown has to be the SAME family the app computes, or the [FAMILY] flag is
// about a different product than the one on the screen — so the resolution
// order below is copied from liveAlternatives.js:findShelfAlternatives().
import { leadFamilyOf } from '../src/lib/liveAlternatives.js';
import { canonicalCategory } from '../src/lib/retailCategories.js';
import {
  PENDING_KEY,
  ACCEPTED_KEY,
  REJECTED_KEY,
  STATUS,
  storeConfig,
  isSerbianRegistered,
  foldForCompare,
} from '../api/proposals.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_FILE = path.join(ROOT, 'data', 'proposed-alternatives.json');

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const value = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : null;
};

const OPTS = {
  list: flag('list'),
  dryRun: flag('dry-run'),
  input: value('input'),
  noCatalogue: flag('no-catalogue'),
  reviewer: value('reviewer') || process.env.VENDORJA_REVIEWER || 'owner',
};

// ---------------------------------------------------------------------------
// Redis over REST (see the header note on why this is a copy)
// ---------------------------------------------------------------------------

async function redis(cfg, commands) {
  const res = await fetch(`${cfg.url}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  if (!res.ok) throw new Error(`store ${res.status}`);
  const json = await res.json();
  if (!Array.isArray(json)) throw new Error('store: unexpected response');
  return json.map((r) => (r && 'result' in r ? r.result : null));
}

// ---------------------------------------------------------------------------
// Evidence the app already holds
// ---------------------------------------------------------------------------

function readJson(rel) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
  } catch {
    return null;
  }
}

/** The GS1 table in the shape src/lib/gs1.js:classifyBarcode() wants. */
function loadGs1Table() {
  const raw = readJson('data/gs1-prefixes.json');
  const list = raw?.prefixes || [];
  const ranges = list
    .map((e) => {
      const parts = String(e.range || '').split('-');
      const min = parseInt(parts[0], 10);
      const max = parseInt(parts[1] ?? parts[0], 10);
      if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
      return {
        min,
        max,
        country: e.country,
        countrySq: e.countrySq || e.country,
        iso: e.iso ?? null,
        kind: e.kind || 'country',
        isSerbia: Boolean(e.isSerbia),
        isLocal: Boolean(e.isLocal),
        note: e.note || null,
      };
    })
    .filter(Boolean);
  return { ranges };
}

/**
 * barcode -> the catalogue row, for the two codes in front of us.
 *
 * The catalogue is 66 MB / ~91k rows and only 41.5% of rows carry a barcode
 * at all (house rules), so "not found" is the common case and
 * means "we hold no row for this", never "this product does not exist".
 */
function loadRetailIndex() {
  if (OPTS.noCatalogue) return null;
  const raw = readJson('data/kosovo-retail.json');
  const rows = raw?.products;
  if (!Array.isArray(rows)) return null;
  const byCode = new Map();
  for (const row of rows) {
    const code = String(row?.barcode || '').replace(/\D/g, '');
    if (code && !byCode.has(code)) byCode.set(code, row);
  }
  return byCode;
}

/** Everything known about one barcode/brand, gathered in one place. */
function dossierFor({ code, brand }, ctx) {
  const out = {
    code: code || null,
    brand: brand || null,
    gs1: null,
    boycott: null,
    retailRow: null,
    family: null,
    familyFrom: null,
    shelf: null,
    localClaim: 'unknown',
  };

  if (code) {
    out.gs1 = classifyBarcode(code, ctx.gs1Table);
    out.boycott = findBoycottByCode(code, ctx.boycott);
    if (ctx.retail) out.retailRow = ctx.retail.get(String(code).replace(/\D/g, '')) || null;
  }
  if (!out.boycott && brand) out.boycott = findBoycottByBrand(brand, ctx.boycott);

  const row = out.retailRow;
  if (row) {
    // Same order as the app: the free-text category first, then the head
    // noun of the title. 0% of catalogue rows carry OFF tags and the retail
    // labels are aisle names ("BYLMET" = dairy), so the title is very often
    // the only thing that resolves — which is exactly why the app reads it.
    const fromCategory = categoryFamilyOf(row.category || null);
    const fromName = fromCategory ? null : leadFamilyOf(row.name || null);
    out.family = fromCategory || fromName || null;
    out.familyFrom = fromCategory ? 'category' : fromName ? 'title' : null;
    out.shelf = canonicalCategory(row.category || null);
    // "Sold in Kosovo" is NOT "made by a Kosovar brand". null and false are
    // both "not proven local" — the conflation was a real shipped bug and it
    // does not come back here to make a queue easier to clear.
    out.localClaim =
      row.isLocalBrand === true ? 'proven-local' : row.isLocalBrand === false ? 'not-local' : 'unknown';
  }
  return out;
}

/** The pre-flight. Returns an array of {tag, why}. Never a decision. */
function preflight(proposal, forDoss, altDoss) {
  const flags = [];

  if (proposal.altCode && proposal.altCode === proposal.forCode) {
    flags.push({ tag: 'SELF', why: 'the proposed alternative IS the product it claims to replace' });
  }
  if (
    proposal.altBrand &&
    proposal.forBrand &&
    foldForCompare(proposal.altBrand) === foldForCompare(proposal.forBrand)
  ) {
    flags.push({ tag: 'SELF', why: `same brand on both sides ("${proposal.altBrand}")` });
  }
  if (proposal.altCode && isSerbianRegistered(proposal.altCode)) {
    flags.push({
      tag: 'SERBIAN',
      why: 'the proposed alternative is itself registered with GS1 Serbia (860)',
    });
  }
  if (altDoss.boycott) {
    flags.push({
      tag: 'BOYCOTT',
      why: `proposed alternative matches the boycott table by ${altDoss.boycott.reason}: ${
        altDoss.boycott.brand || altDoss.boycott.name || '?'
      }`,
    });
  }
  if (forDoss.family && altDoss.family && forDoss.family !== altDoss.family) {
    flags.push({
      tag: 'FAMILY',
      why: `category families disagree: "${forDoss.family}" vs "${altDoss.family}" — would fail the aisle test`,
    });
  }
  if (proposal.altCode && !altDoss.retailRow) {
    flags.push({
      tag: 'UNKNOWN',
      why: 'that barcode is in no catalogue we hold — nothing here can confirm the product exists',
    });
  }
  if (altDoss.retailRow && altDoss.localClaim !== 'proven-local') {
    flags.push({
      tag: 'NOT-LOCAL',
      why: `catalogue row found but isLocalBrand is ${JSON.stringify(
        altDoss.retailRow.isLocalBrand
      )} — NOT proven to be a local brand`,
    });
  }
  if (proposal.seenAt) {
    flags.push({
      tag: 'HEARSAY',
      why: `proposer says they saw it at "${proposal.seenAt}" — sold in Kosovo is NOT made by a Kosovar brand, and this is not evidence of origin`,
    });
  }
  return flags;
}

// ---------------------------------------------------------------------------
// Rendering one dossier
// ---------------------------------------------------------------------------

function line(label, val) {
  return `    ${String(label).padEnd(14)} ${val === null || val === undefined || val === '' ? '—' : val}`;
}

function describe(doss) {
  const out = [];
  out.push(line('barcode', doss.code));
  out.push(line('brand', doss.brand));
  if (doss.gs1) {
    const g = doss.gs1;
    out.push(
      line('GS1', `prefix ${g.prefix ?? '—'} → ${g.country ?? 'unknown'} [${g.verdict}]${g.kind && g.kind !== 'country' ? ` (${g.kind})` : ''}`)
    );
  }
  out.push(line('boycott', doss.boycott ? `HIT by ${doss.boycott.reason}: ${doss.boycott.brand || doss.boycott.name}` : 'no hit'));
  if (doss.retailRow) {
    const r = doss.retailRow;
    out.push(line('in catalogue', `${r.name} — ${r.sourceLabel || r.source}`));
    out.push(line('price', r.price != null ? `${r.price} ${r.currency || ''}`.trim() : 'unknown'));
    out.push(
      line(
        'category',
        `${r.category || 'unknown'}${doss.shelf ? ` → shelf "${doss.shelf.label}" (${doss.shelf.side})` : ''}`
      )
    );
    out.push(line('isLocalBrand', `${JSON.stringify(r.isLocalBrand)} (${doss.localClaim})`));
    if (r.localEvidence) out.push(line('evidence', r.localEvidence));
  } else if (doss.code) {
    out.push(line('in catalogue', 'not found'));
  }
  out.push(
    line(
      'family',
      doss.family ? `${doss.family} (from the ${doss.familyFrom})` : 'undetermined'
    )
  );
  return out.join('\n');
}

function render(proposal, forDoss, altDoss, flags, index, total) {
  const at = proposal.at ? new Date(proposal.at).toISOString() : 'unknown';
  const parts = [];
  parts.push('');
  parts.push('='.repeat(78));
  parts.push(`PROPOSAL ${index + 1} / ${total}   id ${proposal.id || '?'}   submitted ${at}`);
  parts.push('='.repeat(78));
  parts.push('');
  parts.push('  THE SERBIAN PRODUCT');
  parts.push(line('named as', proposal.forName));
  parts.push(describe(forDoss));
  parts.push('');
  parts.push('  THE PROPOSED ALTERNATIVE  (a claim by a stranger, not evidence)');
  parts.push(line('named as', proposal.altName));
  parts.push(line('seen at', proposal.seenAt));
  parts.push(describe(altDoss));
  parts.push('');
  if (flags.length) {
    parts.push('  PRE-FLIGHT — reasons to look harder. None of these auto-reject.');
    for (const f of flags) parts.push(`    [${f.tag}] ${f.why}`);
  } else {
    parts.push('  PRE-FLIGHT — nothing flagged. That is not an endorsement: the app');
    parts.push('  simply holds no fact against it. You still have to decide.');
  }
  parts.push('');
  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Decisions
// ---------------------------------------------------------------------------

/**
 * A prompt that works on a TTY *and* on a pipe.
 *
 * rl.question() alone does not: with stdin redirected from a file, readline
 * drains the whole buffer immediately and every line that arrives while no
 * question is pending is dropped on the floor — so a scripted review answered
 * the first prompt and silently skipped the rest. Buffering the lines
 * ourselves makes `printf 'a\\nnote\\ny\\n' | vet-proposals ...` behave the
 * same as a person typing, which is what makes this tool testable.
 *
 * When stdin ends, every outstanding and future prompt answers '' — which the
 * loop reads as "skip", so an exhausted script leaves the rest of the queue
 * untouched rather than deciding anything by accident.
 */
function makeAsker() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const lines = [];
  const waiting = [];
  let closed = false;

  rl.on('line', (raw) => {
    const value = String(raw).trim();
    if (waiting.length) waiting.shift()(value);
    else lines.push(value);
  });
  rl.on('close', () => {
    closed = true;
    while (waiting.length) waiting.shift()('');
  });

  return {
    ask(question) {
      process.stdout.write(question);
      if (lines.length) {
        const value = lines.shift();
        process.stdout.write(`${value}\n`);
        return Promise.resolve(value);
      }
      if (closed) {
        process.stdout.write('\n');
        return Promise.resolve('');
      }
      return new Promise((resolve) => waiting.push(resolve));
    },
    close: () => rl.close(),
  };
}

/**
 * An accepted proposal becomes a pairing in the SAME SHAPE as a
 * data/brand-alternatives.json entry — written to data/proposed-alternatives.json,
 * NOT to brand-alternatives.json itself, which is curated by hand. The merge
 * is a documented, reviewed step: see docs/PROPOSALS.md §4.
 *
 * `pairingEvidence: "community-proposal-vetted"` is the field that keeps this
 * distinguishable from a source-cited curated pairing forever after. It is not
 * "reported" and it is not "category-match": it is a person's suggestion that
 * a named reviewer agreed with on a named date, and the record says exactly
 * that so nothing downstream can quietly upgrade it.
 */
function toCuratedEntry(proposal, forDoss, altDoss, decision) {
  return {
    serbianBrand: proposal.forBrand || proposal.forName || `barcode ${proposal.forCode}`,
    serbianCompany: null,
    category: altDoss.family || forDoss.family || null,
    offCategoryTags: [],
    verifiedSerbian: Boolean(forDoss.gs1?.isSerbiaPrefix || forDoss.boycott),
    sourceUrl: forDoss.retailRow?.url || null,
    forCode: proposal.forCode,
    alternatives: [
      {
        brand: proposal.altBrand || altDoss.retailRow?.brand || null,
        company: null,
        // NOT asserted as kosovo/albania unless the catalogue proves it.
        // A reviewer saying yes to a pairing is not a finding about origin.
        country: altDoss.localClaim === 'proven-local' ? 'kosovo' : null,
        barcode: proposal.altCode || null,
        sourceUrl: decision.sourceUrl || altDoss.retailRow?.url || null,
        evidence:
          altDoss.localClaim === 'proven-local'
            ? altDoss.retailRow?.localEvidence || 'catalogue row marks this brand local'
            : 'origin NOT established from data Vendorja holds; accepted on reviewer judgement',
        pairingEvidence: 'community-proposal-vetted',
        pairingUrl: decision.sourceUrl || null,
        image: null,
        imageSource: null,
        imageCredit: null,
      },
    ],
    proposal: {
      id: proposal.id,
      proposedAt: proposal.at || null,
      decidedAt: Date.now(),
      decidedBy: OPTS.reviewer,
      match: decision.match,
      reviewNote: decision.note || null,
      preflightFlags: decision.flags,
    },
  };
}

function appendAccepted(entry) {
  let file = readJson('data/proposed-alternatives.json');
  if (!file || !Array.isArray(file.entries)) {
    file = {
      note:
        'ACCEPTED SHOPPER PROPOSALS, awaiting merge into data/brand-alternatives.json. ' +
        'Every entry here was proposed by a member of the public and accepted by a named ' +
        'reviewer on a named date; that is a weaker claim than a source-cited curated ' +
        'pairing and pairingEvidence says so. See docs/PROPOSALS.md.',
      builtBy: 'scripts/vet-proposals.mjs',
      builtAt: null,
      entries: [],
    };
  }
  file.builtAt = new Date().toISOString();
  file.entries.push(entry);
  if (!OPTS.dryRun) fs.writeFileSync(OUT_FILE, `${JSON.stringify(file, null, 2)}\n`);
  return file.entries.length;
}

// ---------------------------------------------------------------------------
// Sources of proposals
// ---------------------------------------------------------------------------

async function loadPending(cfg) {
  if (OPTS.input) {
    const raw = JSON.parse(fs.readFileSync(path.resolve(OPTS.input), 'utf8'));
    const list = Array.isArray(raw) ? raw : raw?.pending || raw?.items || [];
    return list.filter((p) => p && p.status !== STATUS.ACCEPTED && p.status !== STATUS.REJECTED);
  }
  const [rows] = await redis(cfg, [['LRANGE', PENDING_KEY, '0', '999']]);
  return (Array.isArray(rows) ? rows : [])
    .map((raw) => {
      try {
        return typeof raw === 'string' ? JSON.parse(raw) : raw;
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

/**
 * Commit the decisions. The pending list is REWRITTEN to exactly the
 * proposals nobody decided on, and each decided proposal is pushed to its
 * outcome key. Accepted records get `status: 'accepted'` here and nowhere
 * else — api/proposals.js cannot mint that value (asserted in the tests).
 */
async function commit(cfg, decided, untouched) {
  const commands = [['DEL', PENDING_KEY]];
  if (untouched.length) {
    commands.push(['RPUSH', PENDING_KEY, ...untouched.map((p) => JSON.stringify(p))]);
  }
  const accepted = decided.filter((d) => d.status === STATUS.ACCEPTED);
  const refused = decided.filter((d) => d.status !== STATUS.ACCEPTED);
  if (accepted.length) commands.push(['LPUSH', ACCEPTED_KEY, ...accepted.map((p) => JSON.stringify(p))]);
  if (refused.length) commands.push(['LPUSH', REJECTED_KEY, ...refused.map((p) => JSON.stringify(p))]);
  await redis(cfg, commands);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const cfg = storeConfig();
  if (!cfg && !OPTS.input) {
    console.log(
      'No proposal store is provisioned (KV_REST_API_URL / UPSTASH_REDIS_REST_URL are unset),\n' +
        'so there is no queue to review. This is the repo\'s default state and is not a failure.\n' +
        'To review a file instead:  node scripts/vet-proposals.mjs --input proposals.json'
    );
    return;
  }

  const ctx = {
    gs1Table: loadGs1Table(),
    boycott: normalizeBoycottTable(readJson('data/boycott-brands.json') || {}),
    retail: loadRetailIndex(),
  };
  if (!ctx.retail) {
    console.log(
      OPTS.noCatalogue
        ? '(--no-catalogue: catalogue checks skipped, so every barcode will read as UNKNOWN)\n'
        : '(data/kosovo-retail.json unreadable — catalogue checks skipped)\n'
    );
  }

  const pending = await loadPending(cfg);
  if (!pending.length) {
    console.log('Nothing pending. Queue is empty.');
    return;
  }
  console.log(`${pending.length} proposal(s) waiting.`);

  const io = OPTS.list ? null : makeAsker();
  const ask = (q) => (io ? io.ask(q) : Promise.resolve(''));

  const decided = [];
  const untouched = [];

  for (let i = 0; i < pending.length; i += 1) {
    const p = pending[i];
    const forDoss = dossierFor({ code: p.forCode, brand: p.forBrand }, ctx);
    const altDoss = dossierFor({ code: p.altCode, brand: p.altBrand }, ctx);
    const flags = preflight(p, forDoss, altDoss);

    console.log(render(p, forDoss, altDoss, flags, i, pending.length));

    if (OPTS.list) {
      untouched.push(p);
      continue;
    }

    const answer = (
      await ask('  [a]ccept  [r]eject  [n]eeds more info  [s]kip  [q]uit > ')
    ).toLowerCase();

    if (answer === 'q') {
      untouched.push(...pending.slice(i));
      break;
    }
    if (answer === 's' || answer === '') {
      untouched.push(p);
      continue;
    }

    const note = await ask('  note (why — this is the record of your reasoning): ');

    if (answer === 'a') {
      // The owner's own question, asked explicitly rather than assumed.
      const oneToOne = (await ask('  is this a 1:1 replacement? [y/N] ')).toLowerCase() === 'y';
      const sourceUrl = await ask('  source URL for the pairing (blank if none): ');
      const decision = {
        match: oneToOne ? '1:1' : 'similar',
        note: note || null,
        sourceUrl: sourceUrl || null,
        flags: flags.map((f) => f.tag),
      };
      const record = {
        ...p,
        status: STATUS.ACCEPTED,
        match: decision.match,
        sourceUrl: decision.sourceUrl,
        reviewNote: decision.note,
        reviewFlags: decision.flags,
        decidedBy: OPTS.reviewer,
        acceptedAt: Date.now(),
      };
      decided.push(record);
      const count = appendAccepted(toCuratedEntry(p, forDoss, altDoss, decision));
      console.log(
        `  ✓ accepted as ${decision.match}. data/proposed-alternatives.json now holds ${count} entr${
          count === 1 ? 'y' : 'ies'
        }${OPTS.dryRun ? ' (DRY RUN — not written)' : ''}.`
      );
    } else if (answer === 'r') {
      decided.push({
        ...p,
        status: STATUS.REJECTED,
        reviewNote: note || null,
        reviewFlags: flags.map((f) => f.tag),
        decidedBy: OPTS.reviewer,
        decidedAt: Date.now(),
      });
      console.log('  ✗ rejected.');
    } else if (answer === 'n') {
      decided.push({
        ...p,
        status: STATUS.NEEDS_INFO,
        reviewNote: note || null,
        reviewFlags: flags.map((f) => f.tag),
        decidedBy: OPTS.reviewer,
        decidedAt: Date.now(),
      });
      console.log('  ? parked as needs-more-info. It is out of the queue and NOT published.');
    } else {
      untouched.push(p);
    }
  }

  if (io) io.close();

  console.log(
    `\nDecided ${decided.length}, left pending ${untouched.length}.` +
      (OPTS.dryRun ? ' DRY RUN — nothing written.' : '')
  );

  if (!OPTS.dryRun && !OPTS.input && decided.length) {
    await commit(cfg, decided, untouched);
    console.log('Store updated.');
  } else if (OPTS.input && !OPTS.dryRun && decided.length) {
    console.log(
      '--input mode: the source file was not modified; the only thing written is data/proposed-alternatives.json.'
    );
  }
}

// Only when RUN, never when IMPORTED. src/test/proposals.test.js imports this
// file to exercise the pre-flight, and a module that opens a readline on
// import would hang the suite.
const invokedDirectly = (() => {
  try {
    return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
})();

if (invokedDirectly) {
  main().catch((err) => {
    console.error(`vet-proposals failed: ${err.message}`);
    process.exitCode = 1;
  });
}

// Exported for the test suite (which checks the pre-flight without going
// near a store or a TTY). NOTE: none of these reads the pending queue —
// loadPending() is deliberately NOT exported.
export { preflight, dossierFor, toCuratedEntry, loadGs1Table, OPTS };
