#!/usr/bin/env node
/**
 * refresh-catalogue.mjs — the whole freshness cycle, one command, no human.
 *
 * Owner, 2026-09-16:
 *   "the database seems stale . constantly update te gjitha with new info
 *    must never stay the same very day something new never the same these
 *    products been the same past 10 days"
 *
 * He is right, and the reason is not subtle: NOTHING RE-RAN THE HARVEST.
 * Every crawl this project has ever done was a person typing a command.
 * `rotateWithinBand()` in src/lib/bestValue.js reshuffles the same rows every
 * three hours, which is presentation, not freshness. This script plus
 * .github/workflows/refresh-catalogue.yml is the part that was missing.
 *
 * THE CYCLE
 *   1. re-crawl        -> scripts/xapi-crawl.mjs (spawned, not reimplemented:
 *                         it already owns the Xapi recon gate, robots.txt,
 *                         currency verification and GTIN check digits)
 *   2. merge           -> scripts/merge-retail.mjs
 *   3. diff            -> what is genuinely new: added, gone, prices moved
 *   4. HARD GATE       -> and only then is anything allowed to stand
 *   5. report          -> data/refresh-log.json + docs/REFRESH.md
 *
 * THE GATE IS THE POINT. A scheduled job that can write to the catalogue is
 * a scheduled job that can break it at 04:00 with nobody watching. So the
 * candidate catalogue is written to the real path, every check below is run
 * against it for real, and ON ANY FAILURE THE BACKUP IS RESTORED BYTE FOR
 * BYTE and the process exits non-zero. The workflow commits only what
 * survives.
 *
 *   G1  crawl floor        — a crawl that comes back near-empty (a site
 *                            redesigned, a block, a DNS failure) must not be
 *                            allowed to look like "the catalogue shrank".
 *   G2  row-count floor    — the merged catalogue may not lose rows.
 *   G3  currency sanity    — median shelf price must stay in a plausible
 *                            grocery range. THIS IS THE SCAR: 63.8% of this
 *                            catalogue is Albanian Lek stored as EUR, which
 *                            produced a "500.00 EUR" deodorant and a median
 *                            of 150 "EUR" for groceries. See the long note
 *                            on `gateCurrency` below — the gate measures the
 *                            subset the app actually ships, and separately
 *                            reports the whole-file median so nobody forgets
 *                            the contamination is still sitting in the file.
 *   G4  size ceiling       — GitHub hard-fails a file over 100 MB. Fail at 90.
 *   G5  prune-filter drift — the build's prune filter and the app's runtime
 *                            filter must agree, or G3 measured the wrong set.
 *   G6  eval-alternatives  — WRONG FAMILY must be 0 and TOTAL LIES must be 0.
 *   G7  npm test
 *   G8  npm run build
 *
 * Usage:
 *   node scripts/refresh-catalogue.mjs                  # the real thing
 *   node scripts/refresh-catalogue.mjs --dry-run        # everything, then restore
 *   node scripts/refresh-catalogue.mjs --skip-crawl     # merge+gate an existing crawl
 *   node scripts/refresh-catalogue.mjs --gates-only     # just run the gate
 *   node scripts/refresh-catalogue.mjs --sources=buka,amg --limit=50
 *   node scripts/refresh-catalogue.mjs --fast           # skip npm test/build (local loop)
 *   node scripts/refresh-catalogue.mjs --inject-fault=X # PROVE the gate (see below)
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mergeRetail } from './merge-retail.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');
const P = (...p) => path.join(REPO, ...p);
const rel = (p) => path.relative(REPO, p).split(path.sep).join('/');

// ─────────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flag = (n, d = null) => {
  const hit = argv.find((a) => a === `--${n}` || a.startsWith(`--${n}=`));
  if (!hit) return d;
  const eq = hit.indexOf('=');
  return eq === -1 ? true : hit.slice(eq + 1);
};
const OPTS = {
  dryRun: flag('dry-run') === true,
  skipCrawl: flag('skip-crawl') === true,
  gatesOnly: flag('gates-only') === true,
  fast: flag('fast') === true,
  sources: flag('sources') ? String(flag('sources')) : null,
  limit: flag('limit') ? String(flag('limit')) : null,
  concurrency: String(flag('concurrency', '3')),
  delay: String(flag('delay', '400')),
  /**
   * TEST-ONLY. Deliberately corrupts the candidate catalogue after the merge
   * and before the gate, so the gate can be PROVEN to refuse rather than
   * merely described. It is never reachable from the workflow, it always
   * runs with the backup in place, and the run it produces always exits
   * non-zero. Values: `currency` (rewrite prices as Lek-magnitude EUR),
   * `empty-crawl` (hand the merge an empty crawl), `wipe` (delete 90% of the
   * catalogue), `nonEurCurrency` (import a row priced in ALL).
   */
  injectFault: flag('inject-fault') ? String(flag('inject-fault')) : null,
};

const BASE = P('data/kosovo-retail.json');
const CRAWL_OUT = P('data/kosovo-retail-xapi.json');
const LOG = P('data/refresh-log.json');
const PRICE_HISTORY = P('data/price-history.json');
const REFRESH_DOC = P('docs/REFRESH.md');

// ─────────────────────────────────────────────────────────────────────────────
// Thresholds. Every one of these is a measured number, not a guess; the
// measurement is named next to it.
// ─────────────────────────────────────────────────────────────────────────────
const LIMITS = {
  // A crawl may lose up to 20% of its rows (a source down, a category empty)
  // before the run is treated as a failed harvest rather than a real delta.
  // Measured baseline 2026-09-16: 1,876 rows across five sources.
  crawlFloorFraction: 0.8,
  crawlFloorAbsolute: 100,
  // The merge is append-and-patch, so the catalogue cannot legitimately
  // shrink. 0.995 leaves room for a future de-duplication pass without
  // making the floor meaningless.
  rowFloorFraction: 0.995,
  // Measured on the SHIPPED subset (33,039 Kosovo rows) 2026-09-16:
  // p10 0.60 · median 1.75 · p90 5.89 · p99 24.90 · max 319.99 EUR.
  // These bands sit well outside those numbers but nowhere near Lek
  // magnitudes (the whole-file median with Lek included is 150).
  medianMin: 0.3,
  medianMax: 20,
  p90Max: 60,
  shareOver100Max: 0.02,
  // GitHub hard-fails a push containing a file over 100 MB.
  maxBytes: 90 * 1024 * 1024,
  // Bounded history so a daily job cannot grow either artefact without limit.
  logRuns: 30,
  docLines: 60,
  priceHistoryPoints: 8,
  // 5,000 rows, not 40,000, and the reason is the payload rather than the
  // repo: vite.config.js's closeBundle copies ALL of data/ into dist/, so
  // data/price-history.json is SHIPPED to the browser along with the
  // catalogue. Only priced rows can ever appear in it, and maxiks.shop is the
  // only source in this crawl that publishes prices at all — 1,698 rows — so
  // 5,000 is roughly triple the real ceiling while keeping the worst case
  // under a megabyte. If a genuinely priced source is added, raise this
  // deliberately and re-check the shipped payload size.
  priceHistoryRows: 5000,
};

/**
 * The build's prune filter (vite.config.js `closeBundle`) and the app's
 * runtime filter (src/lib/dataLoader.js `BLOCKED_SOURCES`) are the same three
 * regexes. G3 must measure the subset a shopper actually sees, so it needs
 * them too — and G5 asserts all three copies still agree, because if they
 * drift, G3 silently starts measuring the wrong set of rows.
 */
const BLOCKED_SOURCES = [/gjirafa/i, /wolt\.com\/al\//i, /Wolt Shqipëri/i];
const BLOCKED_LITERAL = '[/gjirafa/i, /wolt\\.com\\/al\\//i, /Wolt Shqipëri/i]';
const isBlocked = (row) => BLOCKED_SOURCES.some((re) => re.test(`${row?.source || ''} ${row?.sourceLabel || ''}`));

const log = (...a) => console.log(...a);
const hr = (t) => log(`\n${'─'.repeat(72)}\n${t}\n${'─'.repeat(72)}`);

/**
 * Where the pre-run copies live. Module scope so the restore path and the
 * dry-run teardown are the SAME code and cannot disagree about which file to
 * put back — a restore that half-works is worse than no restore at all.
 */
const BACKUP = {
  base: path.join(os.tmpdir(), `vendorja-retail-backup-${process.pid}-${Date.now()}.json`),
  crawl: path.join(os.tmpdir(), `vendorja-xapi-backup-${process.pid}-${Date.now()}.json`),
  taken: false,
  restored: false,
};
function restoreTree(why) {
  if (!BACKUP.taken || BACKUP.restored) return false;
  BACKUP.restored = true;
  if (fs.existsSync(BACKUP.base)) fs.copyFileSync(BACKUP.base, BASE);
  if (fs.existsSync(BACKUP.crawl)) fs.copyFileSync(BACKUP.crawl, CRAWL_OUT);
  else if (fs.existsSync(CRAWL_OUT) && !fs.existsSync(BACKUP.crawl)) { /* there was none before */ }
  log(`\n  RESTORED ${rel(BASE)} and ${rel(CRAWL_OUT)} from the pre-run backup (${why}).`);
  return true;
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}
function quantile(sorted, f) {
  if (!sorted.length) return null;
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * f))];
}
/**
 * For the crawl only: inherit stdio so its progress appears as it happens.
 *
 * The crawl is ~1,700 requests and 177 MB and takes many minutes. Buffering it
 * means a CI log that shows nothing at all until it finishes, which makes a
 * hung crawl indistinguishable from a slow one. Nothing parses the crawl's
 * output — the result is read from the JSON file it writes — so there is no
 * reason to capture it.
 */
/**
 * `node` is spawned WITHOUT a shell and `npm` WITH one, and the split is
 * deliberate rather than fussy.
 *
 * Node 20+ emits DEP0190 ("passing args to a child process with shell option
 * true … the arguments are not escaped, only concatenated") for an args array
 * plus `shell: true`, and it is warning about something real: one of these
 * args is a temp-directory path that this process chose, and on Windows that
 * path can contain a space. So `node` gets `shell: false` with a proper args
 * array — no shell, no quoting question. `npm` on Windows is `npm.cmd` and
 * cannot be spawned without a shell at all, so it gets a shell and a single
 * command string with no args array, which DEP0190 does not apply to.
 */
function spawnNode(args, opts) {
  return spawnSync(process.execPath, args, { cwd: REPO, shell: false, ...opts });
}

function runStreaming(args, label) {
  log(`\n$ node ${args.join(' ')}`);
  const t0 = Date.now();
  const r = spawnNode(args, { stdio: 'inherit' });
  log(`  [${label}] exit ${r.status} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  return { status: r.status, out: '' };
}

function runCaptured(args, label) {
  log(`\n$ node ${args.join(' ')}`);
  const t0 = Date.now();
  const r = spawnNode(args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  log(out.trimEnd());
  log(`  [${label}] exit ${r.status} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  return { status: r.status, out };
}

function runNpm(command, label) {
  log(`\n$ ${command}`);
  const t0 = Date.now();
  const r = spawnSync(command, { cwd: REPO, encoding: 'utf8', shell: true, maxBuffer: 256 * 1024 * 1024 });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  log(out.trimEnd());
  log(`  [${label}] exit ${r.status} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  return { status: r.status, out };
}

// ─────────────────────────────────────────────────────────────────────────────
// Fingerprints — what "changed" actually means
// ─────────────────────────────────────────────────────────────────────────────
function fingerprint(products) {
  const prices = new Map();
  const bySource = {};
  for (const r of products) {
    if (!r?.id) continue;
    prices.set(r.id, r.price ?? null);
    bySource[r.source] = (bySource[r.source] || 0) + 1;
  }
  return { ids: new Set(prices.keys()), prices, bySource, count: products.length };
}

function diffCatalogue(before, after) {
  const added = [];
  const gone = [];
  const repriced = [];
  for (const id of after.ids) if (!before.ids.has(id)) added.push(id);
  for (const id of before.ids) if (!after.ids.has(id)) gone.push(id);
  for (const [id, p] of after.prices) {
    if (!before.prices.has(id)) continue;
    const was = before.prices.get(id);
    if (was !== p) repriced.push({ id, from: was, to: p });
  }
  const sourceDelta = {};
  for (const k of new Set([...Object.keys(before.bySource), ...Object.keys(after.bySource)])) {
    const d = (after.bySource[k] || 0) - (before.bySource[k] || 0);
    if (d !== 0) sourceDelta[k] = d;
  }
  return { added, gone, repriced, sourceDelta };
}

/**
 * Did the CRAWL itself return anything different? Compared on `products`
 * only, because the crawl output's own `builtAt` and `stats.elapsedMs` change
 * on every run by construction. Rewriting a 1.9 MB file daily so that two
 * timestamps can differ is exactly the manufactured novelty the owner is
 * complaining about, one layer down.
 */
/**
 * Per-source row counts, this crawl against the previous one.
 *
 * A source dropping out is the single most important thing a refresh can
 * report and it does not show up in the catalogue diff at all, because the
 * merge only ever adds and patches. The first real run made this concrete:
 * `vipa-ks.com` came back `blocked-do-not-build` from Xapi recon, having been
 * `reverse-engineerable-embedded` the day before, so its 28 rows were not
 * crawled. The catalogue was unaffected — it still holds the rows from last
 * time — but "Vipa Chips went from 28 to 0" is exactly what somebody needs to
 * know, and without this it was reported as nothing at all.
 */
function crawlSourceDelta(prevCrawl, nextCrawl) {
  const count = (doc) => {
    const out = {};
    for (const r of doc?.products || []) out[r.source] = (out[r.source] || 0) + 1;
    for (const s of doc?.sources || []) if (out[s.source] === undefined) out[s.source] = 0;
    return out;
  };
  const a = count(prevCrawl);
  const b = count(nextCrawl);
  const delta = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const from = a[k] ?? 0;
    const to = b[k] ?? 0;
    if (from !== to) delta[k] = { from, to };
  }
  return delta;
}

function crawlProductsChanged(oldFile, newProducts) {
  if (!fs.existsSync(oldFile)) return true;
  try {
    const old = readJson(oldFile);
    return JSON.stringify(old.products) !== JSON.stringify(newProducts);
  } catch {
    return true;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// THE GATES
// ─────────────────────────────────────────────────────────────────────────────
const gates = [];
function gate(id, title, ok, detail) {
  gates.push({ id, title, ok: Boolean(ok), detail });
  log(`  ${ok ? 'PASS' : 'FAIL'}  ${id}  ${title}`);
  if (detail) log(`        ${detail}`);
  return Boolean(ok);
}

/**
 * G3 — THE CURRENCY SCAR.
 *
 * What happened: Albanian Lek prices were stored with `currency: "EUR"`.
 * A 500 ALL deodorant (~5 EUR) became "500.00 EUR". Nothing caught it,
 * because every individual row looked structurally fine — the tell was only
 * visible in aggregate: the median "EUR" price of a grocery catalogue was
 * 150. 63.8% of the rows had to stop being shown.
 *
 * Two numbers, and the distinction is load-bearing:
 *
 *   SHIPPED   the 33,039 Kosovo rows the build actually ships and the app
 *             actually renders (`BLOCKED_SOURCES` applied). THIS is what the
 *             gate judges, because this is what a shopper sees. Measured
 *             2026-09-16: median 1.75, p90 5.89, 23 rows over 100 EUR.
 *
 *   WHOLE     all 91,197 rows on disk. Median 150. The Lek contamination was
 *             never deleted from data/kosovo-retail.json — it is filtered at
 *             build time and again at runtime. The gate REPORTS this number
 *             rather than judging on it, so the report never implies the file
 *             is clean when it is not. If someone removes the prune filter,
 *             G5 fails; if someone re-imports Lek into the Kosovo sources,
 *             G3 fails.
 */
function gateCurrency(products) {
  const shipped = products.filter((r) => !isBlocked(r));
  const sp = shipped.map((r) => r.price).filter((v) => typeof v === 'number' && isFinite(v) && v > 0).sort((a, b) => a - b);
  const ap = products.map((r) => r.price).filter((v) => typeof v === 'number' && isFinite(v) && v > 0).sort((a, b) => a - b);
  const median = quantile(sp, 0.5);
  const p90 = quantile(sp, 0.9);
  const over100 = sp.filter((v) => v > 100).length;
  const share = sp.length ? over100 / sp.length : 0;
  const badCurrency = shipped.filter((r) => r.currency && r.currency !== 'EUR');

  const m = {
    shippedRows: shipped.length,
    shippedPriced: sp.length,
    median,
    p10: quantile(sp, 0.1),
    p90,
    p99: quantile(sp, 0.99),
    max: sp.length ? sp[sp.length - 1] : null,
    over100,
    shareOver100: Number((share * 100).toFixed(3)),
    wholeFileMedian: quantile(ap, 0.5),
    nonEurRows: badCurrency.length,
  };

  let ok = true;
  ok = gate('G3a', 'shipped median price is a plausible grocery price',
    median != null && median >= LIMITS.medianMin && median <= LIMITS.medianMax,
    `median ${median} EUR (allowed ${LIMITS.medianMin}–${LIMITS.medianMax}) · p10 ${m.p10} · p90 ${p90} · p99 ${m.p99} · max ${m.max} · ${sp.length} priced rows`) && ok;
  ok = gate('G3b', 'shipped p90 price is not a Lek magnitude',
    p90 != null && p90 <= LIMITS.p90Max, `p90 ${p90} EUR (max allowed ${LIMITS.p90Max})`) && ok;
  ok = gate('G3c', 'almost nothing on a grocery shelf costs over 100 EUR',
    share <= LIMITS.shareOver100Max, `${over100} rows over 100 EUR = ${m.shareOver100}% (max allowed ${LIMITS.shareOver100Max * 100}%)`) && ok;
  ok = gate('G3d', 'no shipped row carries a currency other than EUR',
    badCurrency.length === 0,
    badCurrency.length ? `${badCurrency.length} rows, e.g. ${badCurrency.slice(0, 3).map((r) => `${r.id}=${r.currency}`).join(', ')}` : 'EUR or null on every shipped row') && ok;
  log(`        note: WHOLE-FILE median is ${m.wholeFileMedian} EUR across ${ap.length} priced rows — the Albanian-Lek-as-EUR rows are still in the file and are filtered by the build, not deleted. G5 guards that filter.`);
  return { ok, metrics: m };
}

function gatePruneFilterDrift() {
  const checks = [
    ['src/lib/dataLoader.js', P('src/lib/dataLoader.js')],
    ['vite.config.js', P('vite.config.js')],
  ];
  const missing = [];
  for (const [label, file] of checks) {
    if (!fs.existsSync(file)) { missing.push(`${label} not found`); continue; }
    if (!fs.readFileSync(file, 'utf8').includes(BLOCKED_LITERAL)) missing.push(label);
  }
  return gate('G5', 'the build filter, the app filter and this gate use the same source block list',
    missing.length === 0,
    missing.length ? `DRIFTED in: ${missing.join(', ')} — G3 measured the wrong subset; reconcile BLOCKED_SOURCES before trusting this run` : `all three copies carry ${BLOCKED_LITERAL}`);
}

/**
 * G6 — the correctness gate that already exists, wired in properly.
 *
 * scripts/eval-alternatives.mjs sets a non-zero exit code for TOTAL LIES > 0
 * but NOT for WRONG FAMILY > 0 — that number is only printed. Since
 * The house rules call WRONG FAMILY "THE NUMBER THAT MUST NOT MOVE",
 * relying on the exit code alone would let it move. So the output is parsed
 * for every WRONG FAMILY line (there are two per set: the tag-based one and
 * the stricter independent check) and every one of them must read 0.
 */
function gateEval() {
  const r = runCaptured(['scripts/eval-alternatives.mjs'], 'eval-alternatives');
  const wrongFamily = [...r.out.matchAll(/WRONG FAMILY(?:\s*\(strict\))?:\s*(\d+)/g)].map((m) => Number(m[1]));
  const lies = [...r.out.matchAll(/TOTAL LIES ACROSS ALL SETS:\s*(\d+)/g)].map((m) => Number(m[1]));
  const wfMax = wrongFamily.length ? Math.max(...wrongFamily) : null;
  const lieMax = lies.length ? Math.max(...lies) : null;

  let ok = true;
  ok = gate('G6a', 'eval-alternatives.mjs exits 0', r.status === 0, `exit ${r.status}`) && ok;
  ok = gate('G6b', 'WRONG FAMILY is 0 on every set',
    wrongFamily.length > 0 && wfMax === 0,
    wrongFamily.length ? `WRONG FAMILY lines: [${wrongFamily.join(', ')}]` : 'no WRONG FAMILY line found in the eval output — the eval did not run, so this cannot be called a pass') && ok;
  ok = gate('G6c', 'TOTAL LIES is 0',
    lies.length > 0 && lieMax === 0,
    lies.length ? `TOTAL LIES: ${lieMax}` : 'no TOTAL LIES line found in the eval output') && ok;
  return { ok, wrongFamily, lies: lieMax, out: r.out };
}

// ─────────────────────────────────────────────────────────────────────────────
// Reporting artefacts
// ─────────────────────────────────────────────────────────────────────────────
function writeLog(entry) {
  let doc = { generator: 'scripts/refresh-catalogue.mjs', runs: [] };
  if (fs.existsSync(LOG)) {
    try { doc = readJson(LOG); } catch { /* start fresh rather than die */ }
  }
  doc.generator = 'scripts/refresh-catalogue.mjs';
  doc.note =
    'Every scheduled refresh appends one entry, including the runs where NOTHING CHANGED — ' +
    'that is the point. `changed: false` is a real and useful answer and is never dressed up as news. ' +
    `Capped at the last ${LIMITS.logRuns} runs.`;
  doc.latest = entry;
  doc.runs = [entry, ...(doc.runs || [])].slice(0, LIMITS.logRuns);
  fs.writeFileSync(LOG, JSON.stringify(doc, null, 1));
}

function writePriceHistory(priceChanges, at) {
  if (!priceChanges.length) return 0;
  let doc = { generator: 'scripts/refresh-catalogue.mjs', rows: {} };
  if (fs.existsSync(PRICE_HISTORY)) {
    try { doc = readJson(PRICE_HISTORY); } catch { /* start fresh */ }
  }
  doc.generator = 'scripts/refresh-catalogue.mjs';
  doc.note =
    'Observed price changes only. A row appears here the first time its price MOVED, never merely because it exists — ' +
    `a point per observation, newest first, at most ${LIMITS.priceHistoryPoints} per row. ` +
    'This is the honest daily delta for a grocery catalogue: products turn over slowly, prices do not.';
  doc.rows = doc.rows || {};
  for (const c of priceChanges) {
    const list = doc.rows[c.id] || [];
    if (!list.length && c.from != null) list.push({ at: null, price: c.from, note: 'price before the first observed change' });
    list.unshift({ at, price: c.to });
    doc.rows[c.id] = list.slice(0, LIMITS.priceHistoryPoints);
  }
  const ids = Object.keys(doc.rows);
  if (ids.length > LIMITS.priceHistoryRows) {
    // Keep the most recently moved rows; an unbounded file in a daily job is a
    // slow-motion version of the 63 MB problem.
    ids.sort((a, b) => String(doc.rows[b][0]?.at || '').localeCompare(String(doc.rows[a][0]?.at || '')));
    const keep = {};
    for (const id of ids.slice(0, LIMITS.priceHistoryRows)) keep[id] = doc.rows[id];
    doc.rows = keep;
  }
  doc.rowCount = Object.keys(doc.rows).length;
  doc.updatedAt = at;
  fs.writeFileSync(PRICE_HISTORY, JSON.stringify(doc));
  return doc.rowCount;
}

const RUNLOG_MARKER = '<!-- RUN LOG — appended by scripts/refresh-catalogue.mjs, newest first -->';

function appendDocLine(entry) {
  if (!fs.existsSync(REFRESH_DOC)) return;
  const text = fs.readFileSync(REFRESH_DOC, 'utf8');
  const i = text.indexOf(RUNLOG_MARKER);
  if (i === -1) return;
  const head = text.slice(0, i + RUNLOG_MARKER.length);
  const tail = text.slice(i + RUNLOG_MARKER.length);
  const existing = tail.split('\n').filter((l) => l.trim().startsWith('| 20'));
  const verdict = entry.gatePassed ? (entry.changed ? 'changed' : 'no change') : 'GATE FAILED';
  const line =
    `| ${entry.at.slice(0, 16).replace('T', ' ')} | ${entry.catalogueRows} | ` +
    `+${entry.added} / -${entry.gone} | ${entry.repriced} | ${verdict} | ${entry.headline.replace(/\|/g, '/')} |`;
  const rows = [line, ...existing].slice(0, LIMITS.docLines);
  fs.writeFileSync(
    REFRESH_DOC,
    `${head}\n\n| run (UTC) | rows | products +/- | prices moved | verdict | what actually changed |\n|---|---|---|---|---|---|\n${rows.join('\n')}\n`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// main
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  const at = new Date().toISOString();
  const t0 = Date.now();
  log(`refresh-catalogue — ${at}`);
  log(`  mode: ${OPTS.gatesOnly ? 'gates-only' : OPTS.skipCrawl ? 'merge+gate (crawl skipped)' : 'full cycle'}` +
      `${OPTS.dryRun ? ' · DRY RUN (the tree is restored at the end)' : ''}` +
      `${OPTS.fast ? ' · --fast (npm test/build skipped)' : ''}` +
      `${OPTS.injectFault ? ` · INJECTED FAULT "${OPTS.injectFault}" — this run is a gate proof and is expected to fail` : ''}`);

  const restore = restoreTree;

  const baseDoc = readJson(BASE);
  const before = fingerprint(baseDoc.products);
  log(`  catalogue before: ${before.count} rows, ${(fs.statSync(BASE).size / 1048576).toFixed(1)} MB`);
  fs.copyFileSync(BASE, BACKUP.base);
  if (fs.existsSync(CRAWL_OUT)) fs.copyFileSync(CRAWL_OUT, BACKUP.crawl);
  BACKUP.taken = true;

  let mergeStats = null;
  let priceChanges = [];
  let fieldChanges = {};
  let crawlSummary = null;
  let candidate = baseDoc;

  // ── 1. CRAWL ──────────────────────────────────────────────────────────────
  if (!OPTS.gatesOnly) {
    const prevCrawl = fs.existsSync(CRAWL_OUT) ? readJson(CRAWL_OUT) : null;
    const prevCrawlCount = prevCrawl?.products?.length ?? 0;
    const tmpCrawl = path.join(os.tmpdir(), `vendorja-crawl-${Date.now()}.json`);

    if (OPTS.skipCrawl) {
      hr('1. CRAWL — skipped (--skip-crawl); using the crawl output already on disk');
      fs.copyFileSync(CRAWL_OUT, tmpCrawl);
    } else {
      hr('1. CRAWL — scripts/xapi-crawl.mjs (Xapi recon gate, robots.txt, GTIN + currency validation)');
      const args = ['scripts/xapi-crawl.mjs', `--out=${tmpCrawl}`, `--concurrency=${OPTS.concurrency}`, `--delay=${OPTS.delay}`];
      if (OPTS.sources) args.push(`--sources=${OPTS.sources}`);
      if (OPTS.limit) args.push(`--limit=${OPTS.limit}`);
      const r = runStreaming(args, 'xapi-crawl');
      if (r.status !== 0 || !fs.existsSync(tmpCrawl)) {
        gate('G1', 'the crawl completed', false, `xapi-crawl exited ${r.status}`);
        restore('the crawl failed');
        return finish({ at, t0, ok: false, before, after: before, diff: { added: [], gone: [], repriced: [], sourceDelta: {} }, headline: 'the crawl itself failed; nothing was merged' });
      }
    }

    const crawl = readJson(tmpCrawl);
    const crawlRows = crawl.products?.length ?? 0;
    crawlSummary = {
      rows: crawlRows,
      previousRows: prevCrawlCount,
      sources: (crawl.sources || []).map((s) => ({ source: s.source, crawled: !!s.crawled, count: s.count ?? 0, verdict: s.xapiRecon?.verdict ?? null, reason: s.reason ?? null })),
      requests: crawl.stats?.requests ?? null,
      bytes: crawl.stats?.bytes ?? null,
      robotsBlocked: crawl.stats?.robotsBlocked ?? null,
    };

    if (OPTS.injectFault === 'empty-crawl') {
      crawl.products = [];
      crawlSummary.rows = 0;
      log('\n  [INJECTED FAULT] the crawl output has been emptied.');
    }

    hr('2. G1 — CRAWL FLOOR');
    const floor = Math.max(LIMITS.crawlFloorAbsolute, Math.floor(prevCrawlCount * LIMITS.crawlFloorFraction));
    const g1 = gate('G1', 'the crawl did not come back near-empty',
      (crawl.products?.length ?? 0) >= floor,
      `${crawl.products?.length ?? 0} rows, floor ${floor} (${LIMITS.crawlFloorFraction * 100}% of the previous ${prevCrawlCount}, minimum ${LIMITS.crawlFloorAbsolute}). A site redesign or a block must not be allowed to wipe the catalogue.`);
    if (!g1) {
      restore('G1 failed — the crawl came back near-empty');
      return finish({ at, t0, ok: false, before, after: before, diff: { added: [], gone: [], repriced: [], sourceDelta: {} }, crawlSummary, headline: `the crawl returned ${crawl.products?.length ?? 0} rows against a floor of ${floor}; nothing was merged` });
    }

    // ── 3. MERGE ────────────────────────────────────────────────────────────
    hr('3. MERGE — scripts/merge-retail.mjs');
    if (OPTS.injectFault === 'nonEurCurrency') {
      const sample = { ...(crawl.products[0] || {}), id: 'injected:all-currency', price: 500, currency: 'ALL', name: 'INJECTED DEODORANT 500 ALL' };
      crawl.products.push(sample);
      log('  [INJECTED FAULT] one row priced 500 ALL was added to the crawl output.');
    }
    const merged = mergeRetail(baseDoc, crawl, { refresh: true });
    candidate = merged.base;
    mergeStats = merged.stats;
    priceChanges = merged.priceChanges;
    fieldChanges = merged.fieldChanges;
    log(`  imported ${mergeStats.imported} new · refreshed ${mergeStats.refreshedRows} same-source rows (${mergeStats.priceChanged} price changes)`);
    log(`  skipped ${mergeStats.skippedDuplicateOtherSource} already-held-by-another-source · ${mergeStats.skippedCurrency} for currency · kept ${mergeStats.priceMissingKeptOld} old prices where the new read had none`);
    log(`  other fields refreshed: ${JSON.stringify(fieldChanges)}`);

    if (OPTS.injectFault === 'currency') {
      let n = 0;
      for (const r of candidate.products) {
        if (isBlocked(r) || typeof r.price !== 'number') continue;
        r.price = Math.round(r.price * 100); // EUR -> Lek magnitude, still labelled EUR
        if (++n >= 20000) break;
      }
      log(`  [INJECTED FAULT] ${n} shipped rows re-priced at Lek magnitude while still labelled EUR.`);
    }
    if (OPTS.injectFault === 'wipe') {
      const keep = Math.floor(candidate.products.length * 0.1);
      candidate.products = candidate.products.slice(0, keep);
      candidate.count = keep;
      log(`  [INJECTED FAULT] the catalogue was cut to ${keep} rows.`);
    }

    // THE CANDIDATE IS WRITTEN ONLY IF THE MERGE ACTUALLY CHANGED SOMETHING.
    //
    // When it did, it must go to the REAL path, because eval-alternatives,
    // vitest and vite all read data/kosovo-retail.json and gating a copy would
    // gate nothing. When it did not, the file already on disk IS the
    // candidate, and rewriting 63 MB to put an identical array back would cost
    // a 6.5 MB push for nothing. (The first end-to-end run did exactly that,
    // for a single changed timestamp; see the note in merge-retail.mjs.)
    if (merged.changed) {
      fs.writeFileSync(BASE, JSON.stringify(candidate));
      log(`  candidate written to ${rel(BASE)} (${(fs.statSync(BASE).size / 1048576).toFixed(1)} MB)`);
    } else {
      log(`  ${rel(BASE)} left byte-identical — the merge changed no row, so there is nothing to write`);
    }
    const changedCrawl = crawlProductsChanged(CRAWL_OUT, crawl.products);
    if (changedCrawl) fs.writeFileSync(CRAWL_OUT, JSON.stringify(crawl, null, 1));
    crawlSummary.outputChanged = changedCrawl;
    crawlSummary.sourceDelta = crawlSourceDelta(prevCrawl, crawl);
    log(`  crawl output ${changedCrawl ? 'changed and was rewritten' : 'is identical to the committed one — left untouched rather than churned for a new timestamp'}`);
    if (Object.keys(crawlSummary.sourceDelta).length) {
      log(`  per-source crawl delta vs the previous crawl: ${JSON.stringify(crawlSummary.sourceDelta)}`);
    }
  }

  const after = fingerprint(candidate.products);
  const diff = diffCatalogue(before, after);

  // ── 4. THE GATE ───────────────────────────────────────────────────────────
  hr('4. HARD GATE — nothing may be committed unless every line below says PASS');
  let ok = true;

  const rowFloor = Math.floor(before.count * LIMITS.rowFloorFraction);
  ok = gate('G2', 'the merged catalogue did not lose rows',
    after.count >= rowFloor,
    `${before.count} -> ${after.count} rows, floor ${rowFloor}`) && ok;

  const cur = gateCurrency(candidate.products);
  ok = cur.ok && ok;

  const bytes = fs.statSync(BASE).size;
  ok = gate('G4', 'the catalogue is safely under GitHub\'s 100 MB hard limit',
    bytes <= LIMITS.maxBytes,
    `${(bytes / 1048576).toFixed(1)} MB of a ${(LIMITS.maxBytes / 1048576).toFixed(0)} MB ceiling (GitHub rejects a push over 100 MB outright)`) && ok;

  ok = gatePruneFilterDrift() && ok;

  const ev = gateEval();
  ok = ev.ok && ok;

  if (!OPTS.fast) {
    const t = runNpm('npm test', 'npm test');
    ok = gate('G7', 'npm test is green', t.status === 0, `exit ${t.status}`) && ok;
    const b = runNpm('npm run build', 'npm run build');
    ok = gate('G8', 'npm run build succeeds', b.status === 0, `exit ${b.status}`) && ok;
  } else {
    log('  SKIP  G7/G8  npm test + npm run build (--fast). A --fast run may never be committed.');
  }

  // ── 5. VERDICT ────────────────────────────────────────────────────────────
  const catalogueChanged = diff.added.length > 0 || diff.gone.length > 0 ||
    diff.repriced.length > 0 || Object.keys(fieldChanges).length > 0;
  const realChange = catalogueChanged || (crawlSummary?.outputChanged ?? false);

  // THE HEADLINE MUST NEVER COME BACK EMPTY.
  //
  // It did on the first real run, and the workflow would have committed
  // "Catalogue refresh: " with nothing after the colon. The cause: the
  // catalogue diff was all zeros while the CRAWL OUTPUT had changed (a source
  // was blocked and dropped out), so every clause below was null and the join
  // produced "". A refresh that reports a change owes an account of what
  // changed, in words, or it is no better than the UI reshuffle it replaced.
  const parts = [
    diff.added.length ? `${diff.added.length} new product${diff.added.length === 1 ? '' : 's'}` : null,
    diff.gone.length ? `${diff.gone.length} gone` : null,
    diff.repriced.length ? `${diff.repriced.length} price${diff.repriced.length === 1 ? '' : 's'} moved` : null,
    Object.keys(fieldChanges).length ? `${Object.values(fieldChanges).reduce((a, b) => a + b, 0)} other field updates` : null,
  ].filter(Boolean);

  const crawlDelta = crawlSummary?.sourceDelta || {};
  const crawlWords = Object.entries(crawlDelta)
    .map(([src, d]) => `${src} ${d.from}→${d.to}`)
    .join(', ');

  let headline;
  if (!ok) {
    headline = 'the gate refused this refresh; the catalogue on disk is unchanged';
  } else if (parts.length) {
    headline = parts.join(', ');
  } else if (crawlSummary?.outputChanged) {
    // The catalogue is untouched but the harvest is not what it was. This is a
    // real and useful thing to say, and the commonest form of it is a source
    // going away.
    headline = crawlWords
      ? `no catalogue change, but the crawl itself moved: ${crawlWords}`
      : 'no catalogue change; the crawl output differs only in its own metadata (source verdicts or notes)';
  } else {
    headline = 'every source returned exactly what it returned last time — nothing new today, and that is the honest answer';
  }
  if (ok && parts.length && crawlWords) headline += ` · crawl: ${crawlWords}`;

  if (!ok) restore('the gate failed');
  if (ok && !realChange && !OPTS.gatesOnly) {
    // Nothing real moved, so `mergedXapiAt` alone must not create a diff.
    restore('nothing changed — the byte-identical catalogue is left exactly as it was committed');
  }

  return finish({ at, t0, ok, before, after, diff, mergeStats, priceChanges, fieldChanges, crawlSummary, realChange, ev, currency: cur.metrics, catalogueChanged, headline });
}

function finish(r) {
  const {
    at, t0, ok, before, after, diff, mergeStats = null, priceChanges = [], fieldChanges = {},
    crawlSummary = null, realChange = false, catalogueChanged = false, currency = null, headline,
  } = r;

  hr('5. WHAT IS GENUINELY NEW');
  log(`  products added:   ${diff.added.length}`);
  log(`  products gone:    ${diff.gone.length}`);
  log(`  prices changed:   ${diff.repriced.length}`);
  log(`  other fields:     ${JSON.stringify(fieldChanges)}`);
  log(`  per-source delta: ${Object.keys(diff.sourceDelta).length ? JSON.stringify(diff.sourceDelta) : 'none'}`);
  if (crawlSummary?.sourceDelta && Object.keys(crawlSummary.sourceDelta).length) {
    log('  THE CRAWL ITSELF MOVED (this never shows up in the catalogue diff, because the merge only adds and patches):');
    for (const [src, d] of Object.entries(crawlSummary.sourceDelta)) {
      log(`    · ${src}: ${d.from} -> ${d.to} rows${d.to === 0 ? '  <-- this source produced nothing this run' : ''}`);
    }
  }
  if (crawlSummary) {
    log('  per-source crawl result:');
    for (const s of crawlSummary.sources) {
      log(`    · ${s.source}: ${s.crawled ? `${s.count} rows` : `NOT CRAWLED (${s.reason || 'no reason given'})`}${s.verdict ? ` · xapi verdict ${s.verdict}` : ''}`);
    }
  }
  if (priceChanges.length) {
    log('  price moves:');
    for (const c of priceChanges.slice(0, 20)) {
      log(`    · ${c.name}: ${c.from} -> ${c.to} ${c.currency}${c.pct != null ? ` (${c.pct > 0 ? '+' : ''}${c.pct}%)` : ''}`);
    }
    if (priceChanges.length > 20) log(`    … and ${priceChanges.length - 20} more (all of them in data/price-history.json)`);
  }
  if (!realChange && ok) {
    log('\n  NOTHING CHANGED. Said plainly rather than dressed up: the sources served the same');
    log('  catalogue, at the same prices, as the previous run. No commit will be made. Reshuffling');
    log('  the same rows to look busy is what the owner is already complaining about.');
  }

  const entry = {
    at,
    elapsedMs: Date.now() - t0,
    mode: OPTS.gatesOnly ? 'gates-only' : OPTS.skipCrawl ? 'merge+gate' : 'full',
    dryRun: OPTS.dryRun,
    fast: OPTS.fast,
    injectedFault: OPTS.injectFault,
    gatePassed: ok,
    changed: Boolean(realChange && ok),
    catalogueChanged: Boolean(catalogueChanged),
    crawlOutputChanged: Boolean(crawlSummary?.outputChanged),
    catalogueRowsBefore: before.count,
    catalogueRows: after.count,
    added: diff.added.length,
    gone: diff.gone.length,
    repriced: diff.repriced.length,
    otherFieldChanges: fieldChanges,
    sourceDelta: diff.sourceDelta,
    addedSample: diff.added.slice(0, 20),
    goneSample: diff.gone.slice(0, 20),
    priceChangeSample: priceChanges.slice(0, 50),
    crawl: crawlSummary,
    merge: mergeStats,
    currency,
    gates: gates.map((g) => ({ id: g.id, title: g.title, ok: g.ok, detail: g.detail })),
    headline,
  };

  // A DRY RUN WRITES NOTHING. A rehearsal that leaves a modified refresh log
  // behind is not a rehearsal, and the next real run would then report a diff
  // that the rehearsal invented.
  const persist = !OPTS.dryRun && !OPTS.injectFault;
  if (persist) {
    if (priceChanges.length && ok) entry.priceHistoryRows = writePriceHistory(priceChanges, at);
    writeLog(entry);
    appendDocLine(entry);
  } else {
    log(`\n  ${OPTS.dryRun ? '--dry-run' : `--inject-fault=${OPTS.injectFault}`}: data/refresh-log.json, data/price-history.json and docs/REFRESH.md were NOT written.`);
  }

  hr(ok ? (realChange ? 'REFRESH LANDED' : 'REFRESH RAN — NO CHANGE') : 'REFRESH REFUSED BY THE GATE');
  log(`  ${headline}`);
  log(`  gates: ${gates.filter((g) => g.ok).length}/${gates.length} passed${gates.filter((g) => !g.ok).length ? ` — FAILED: ${gates.filter((g) => !g.ok).map((g) => g.id).join(', ')}` : ''}`);
  log(`  report: ${rel(LOG)}${fs.existsSync(REFRESH_DOC) ? ` and ${rel(REFRESH_DOC)}` : ''}`);
  log(`  elapsed ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  // Machine-readable for the workflow.
  log(`\nREFRESH_RESULT ${JSON.stringify({ gatePassed: ok, changed: entry.changed, added: entry.added, gone: entry.gone, repriced: entry.repriced, rows: entry.catalogueRows })}`);
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT,
      `gate_passed=${ok}\nchanged=${entry.changed}\nheadline=${headline}\nadded=${entry.added}\ngone=${entry.gone}\nrepriced=${entry.repriced}\nrows=${entry.catalogueRows}\n`);
  }

  if (OPTS.dryRun && !restoreTree('--dry-run: putting the tree back exactly as it was')) {
    log('\n  --dry-run: nothing had been written, so there was nothing to restore.');
  }

  // A FAULT-INJECTION RUN ALWAYS RESTORES AND ALWAYS FAILS.
  //
  // This is not belt-and-braces, it is a hole I actually left: with
  // `--inject-fault=nonEurCurrency` the injected row is rejected by the
  // merge's own currency filter, so every gate legitimately PASSES — and
  // without the two lines below the run would be treated as a success and
  // would leave the poisoned crawl output sitting in data/. A proof of the
  // gate must never be able to write anything, whichever way it comes out.
  if (OPTS.injectFault) {
    restoreTree(`--inject-fault=${OPTS.injectFault}: a gate proof never leaves anything behind`);
    log(`  --inject-fault=${OPTS.injectFault}: exiting non-zero regardless of the gate's verdict, so this run can never be mistaken for a refresh.`);
    process.exitCode = 1;
  }

  if (!ok) process.exitCode = 1;
  return entry;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
