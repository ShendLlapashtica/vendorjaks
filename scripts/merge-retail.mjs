#!/usr/bin/env node
/**
 * merge-retail.mjs — fold a crawl output into data/kosovo-retail.json.
 *
 * WHY THIS FILE EXISTS. The merge used to live in docs/XAPI-SOURCING.md §6 as
 * a 25-line `node -e '…'` that a human pasted into a shell. That is not
 * testable, it cannot be called from a scheduled job, and a typo in a shell
 * heredoc silently rewrites a 63 MB catalogue. Same logic, same guarantees,
 * but as a real module with a real dry-run and a real report.
 *
 * THREE OUTCOMES PER INCOMING ROW, and which one applies is decided by WHICH
 * index the row hits — that distinction is the whole correctness of the file.
 *
 *   IMPORT  — neither `id` nor `matchKey` is already held. A genuinely new
 *             product. Appended.
 *
 *   REFRESH — `id` matches. `id` is `<source>:<the source's own key>`, so this
 *             is the same listing on the same site, read again. The fresher
 *             read wins on the VOLATILE fields only. This is what makes a
 *             scheduled refresh mean anything: products turn over slowly,
 *             prices move constantly, and a merge that only ever appends can
 *             never report a price change.
 *
 *   SKIP    — `matchKey` matches but `id` does not. Some other row already
 *             covers this product (e.g. the catalogue holds this GTIN via
 *             `wolt.com/maxi-supermarket` and the new row is from
 *             `maxiks.shop`). The incumbent wins and the new row is dropped.
 *             This is exactly the documented §6 behaviour, left alone
 *             deliberately: those rows belong to a separate harvest and
 *             a cron job is not the place to re-adjudicate them.
 *
 * A matchKey hit is NOT a re-read even when both rows share a source — see the
 * long comment at the decision itself; getting that wrong invented a price
 * change on the first dry run.
 *
 * WHAT REFRESH WILL NOT DO, and why each one is a real bug it avoids:
 *
 *   - It never touches identity or evidence: `id`, `source`, `matchKey`,
 *     `barcode`, `isLocalBrand`, `localEvidence`, `brand`, `brandSource`.
 *     Locality is a sourced CLAIM, not a reading off a shelf; it must not
 *     churn silently because a crawl ran. If the evidence changes, that is a
 *     crawler change and belongs in a reviewed commit, not in a cron job.
 *   - It never overwrites a real price with null. A page that 500s, or
 *     redesigns its price markup, produces `price: null`; writing that over
 *     1.45 EUR would silently blank the catalogue one row at a time. A
 *     missing new price is counted (`priceMissing`) and the old one kept.
 *   - It never writes a price in a currency that is not EUR. This is the
 *     same gate as the import path below. 64% of this catalogue is Albanian
 *     Lek that was stored as EUR; that bug produced a "500.00 EUR"
 *     deodorant and it does not come back through the refresh door.
 *   - It never overwrites a valid barcode with an absent one.
 *
 * APPEND-ONLY, DELIBERATELY. New rows are pushed onto the end of
 * `products` and never re-sorted, and key order inside a refreshed row is
 * preserved. That is not cosmetic: measured on this repo, a daily commit of
 * the 63 MB catalogue costs ~12 KB in the repacked pack BECAUSE the new
 * version is the old version plus an append plus point edits. Re-sorting
 * `products` would turn that 12 KB into a fresh 6.5 MB blob every day. See
 * docs/REFRESH.md §"The 63 MB question".
 *
 * Usage:
 *   node scripts/merge-retail.mjs                       # merge, in place
 *   node scripts/merge-retail.mjs --dry-run             # report only
 *   node scripts/merge-retail.mjs --add=path.json --base=path.json --out=path.json
 *   node scripts/merge-retail.mjs --no-refresh          # §6 behaviour exactly
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(__dirname, '..');

/** Fields a same-source re-read is allowed to update. */
export const VOLATILE_FIELDS = [
  'name',
  'category',
  'price',
  'currency',
  'priceNote',
  'image',
  'url',
  'quantity',
  'quantitySource',
];

/** Fields a merge must never rewrite — identity and sourced claims. */
export const FROZEN_FIELDS = [
  'id',
  'source',
  'sourceLabel',
  'matchKey',
  'barcode',
  'barcodeSource',
  'isLocalBrand',
  'localEvidence',
  'brand',
  'brandSource',
];

// The two lists must not overlap, or a "frozen" field would be updated by the
// volatile loop and the guarantee in the header would be a comment rather than
// a property. Asserted at load, so it fails on `import`, not in production.
for (const f of FROZEN_FIELDS) {
  if (VOLATILE_FIELDS.includes(f)) {
    throw new Error(`merge-retail: "${f}" is listed as both volatile and frozen — a refresh would rewrite a sourced claim`);
  }
}

/** A price may only be written when the source states EUR (or states nothing). */
export function currencyAcceptable(row) {
  return !row.currency || row.currency === 'EUR';
}

function validGtinDigits(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  if (![8, 12, 13, 14].includes(d.length)) return false;
  const digits = d.split('').map(Number);
  const check = digits.pop();
  let sum = 0;
  for (let i = digits.length - 1, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) sum += digits[i] * w;
  return (10 - (sum % 10)) % 10 === check;
}

/**
 * The merge itself. Pure: it mutates `base.products` rows in place for the
 * refresh case (that is the point — a 91k-row array is not copied for fun)
 * but it takes no view on files and returns everything it did.
 *
 * @param {{products:any[], sources?:any[]}} base   parsed data/kosovo-retail.json
 * @param {{products:any[], sources?:any[]}} add    parsed crawl output
 * @param {{refresh?:boolean}} [opts]
 */
export function mergeRetail(base, add, opts = {}) {
  const refresh = opts.refresh !== false;
  const incoming = Array.isArray(add?.products) ? add.products : [];
  const rows = base.products;

  const byId = new Map();
  const byKey = new Map();
  for (const r of rows) {
    if (r?.id && !byId.has(r.id)) byId.set(r.id, r);
    if (r?.matchKey && !byKey.has(r.matchKey)) byKey.set(r.matchKey, r);
  }

  const stats = {
    incoming: incoming.length,
    imported: 0,
    skippedCurrency: 0,
    skippedDuplicateOtherSource: 0,
    skippedSameRowNoRefresh: 0,
    refreshedRows: 0,
    priceChanged: 0,
    priceMissingKeptOld: 0,
    priceCurrencyRefused: 0,
    unchanged: 0,
  };
  /** Every genuine change, for the diff report. Bounded by what actually moved. */
  const priceChanges = [];
  const fieldChanges = {};
  const addedRows = [];

  for (const r of incoming) {
    if (!r || !r.id) continue;

    // The import-side currency gate. Unchanged from docs/XAPI-SOURCING.md §6.
    if (!currencyAcceptable(r)) {
      stats.skippedCurrency++;
      continue;
    }

    // A RE-READ IS IDENTIFIED BY `id`, NEVER BY `matchKey`.
    //
    // This distinction was a bug in the first version of this file and it is
    // worth spelling out, because it produced a fake price change on the very
    // first dry run. `id` is `<source>:<the source's own product key>`, so an
    // id match IS the same listing on the same site, read again — the only
    // thing a refresh may legitimately update. A `matchKey` match
    // (`gtin:4006034103355`) only means "some row already covers this
    // product", and the crawl output genuinely contains 16 duplicate
    // matchKeys: two different maxiks.shop listings carrying one barcode.
    // Treating the second as a re-read of the first merged one real product
    // into another and reported "DOMESTOS ATLANTIC FRESH 1L 2.15 -> 2.55" as
    // a price move when no price had moved at all. Exactly the manufactured
    // novelty this whole task exists to avoid.
    const sameRow = byId.get(r.id);
    const coveredElsewhere = !sameRow && r.matchKey ? byKey.get(r.matchKey) : null;

    if (!sameRow && !coveredElsewhere) {
      rows.push(r);
      byId.set(r.id, r);
      if (r.matchKey) byKey.set(r.matchKey, r);
      stats.imported++;
      addedRows.push({ id: r.id, source: r.source, name: r.name, price: r.price ?? null, currency: r.currency ?? null });
      continue;
    }

    if (!sameRow) {
      // Another row already covers this product. Incumbent wins; this is the
      // §6 rule and it is not relitigated in a cron job.
      stats.skippedDuplicateOtherSource++;
      continue;
    }

    if (!refresh) {
      stats.skippedSameRowNoRefresh++;
      continue;
    }

    const incumbent = sameRow;

    // Same listing, read again. Update volatile fields only.
    let touched = false;
    for (const f of VOLATILE_FIELDS) {
      if (!(f in r)) continue;
      const next = r[f];
      const prev = incumbent[f];

      if (f === 'price') {
        if (next == null) {
          if (prev != null) stats.priceMissingKeptOld++;
          continue;
        }
        if (r.currency && r.currency !== 'EUR') {
          stats.priceCurrencyRefused++;
          continue;
        }
        if (prev !== next) {
          priceChanges.push({
            id: incumbent.id,
            source: incumbent.source,
            name: incumbent.name,
            from: prev ?? null,
            to: next,
            currency: r.currency || incumbent.currency || 'EUR',
            pct: prev ? Number((((next - prev) / prev) * 100).toFixed(1)) : null,
          });
          incumbent.price = next;
          stats.priceChanged++;
          touched = true;
        }
        continue;
      }

      if (f === 'currency') {
        // Only ever set to EUR, and only alongside a price we accepted.
        if (next && next !== 'EUR') continue;
        if (next && prev !== next) {
          incumbent.currency = next;
          fieldChanges.currency = (fieldChanges.currency || 0) + 1;
          touched = true;
        }
        continue;
      }

      if (next == null || next === '') continue; // absence is not new information
      if (JSON.stringify(prev) === JSON.stringify(next)) continue;
      incumbent[f] = next;
      fieldChanges[f] = (fieldChanges[f] || 0) + 1;
      touched = true;
    }

    // A barcode may be gained, never lost.
    if (!incumbent.barcode && r.barcode && validGtinDigits(r.barcode)) {
      incumbent.barcode = r.barcode;
      if (r.barcodeSource) incumbent.barcodeSource = r.barcodeSource;
      fieldChanges.barcode = (fieldChanges.barcode || 0) + 1;
      touched = true;
    }

    if (touched) stats.refreshedRows++;
    else stats.unchanged++;
  }

  base.count = rows.length;

  // Source provenance. Only crawled sources, only once each.
  const known = new Set((base.sources || []).map((s) => `${s.domain}|${s.endpoint}`));
  const newSources = (add?.sources || [])
    .filter((s) => s.crawled)
    .map((s) => ({
      domain: s.source,
      platform: `${s.kind} — wrapped via ${s.xapiRecon?.verdict ?? 'direct'}`,
      endpoint: s.url,
      count: s.count,
    }))
    .filter((s) => !known.has(`${s.domain}|${s.endpoint}`));
  base.sources = [...(base.sources || []), ...newSources];

  // `mergedXapiAt` IS ONLY BUMPED WHEN SOMETHING ACTUALLY MERGED.
  //
  // This was a bug and the first real end-to-end run caught it: the merge
  // imported 0 rows and refreshed 0 rows, the products array came back
  // byte-identical — and the 63 MB catalogue was still rewritten, because
  // this line had stamped a new timestamp on it unconditionally. A daily
  // 6.5 MB push so that one ISO string could differ is precisely the
  // manufactured novelty this whole task exists to remove, and it would have
  // been invisible: `git status` says "modified" and nobody diffs 63 MB.
  const changed = stats.imported > 0 || stats.refreshedRows > 0;
  if (changed || newSources.length) base.mergedXapiAt = new Date().toISOString();

  return { base, stats, priceChanges, fieldChanges, addedRows, newSources, changed };
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────────
function isMain() {
  return process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
}

if (isMain()) {
  const argv = process.argv.slice(2);
  const flag = (n, d = null) => {
    const hit = argv.find((a) => a === `--${n}` || a.startsWith(`--${n}=`));
    if (!hit) return d;
    const eq = hit.indexOf('=');
    return eq === -1 ? true : hit.slice(eq + 1);
  };
  const abs = (p) => (path.isAbsolute(p) ? p : path.join(REPO, p));

  const basePath = abs(String(flag('base', 'data/kosovo-retail.json')));
  const addPath = abs(String(flag('add', 'data/kosovo-retail-xapi.json')));
  const outPath = abs(String(flag('out', flag('base', 'data/kosovo-retail.json'))));
  const dryRun = flag('dry-run') === true;
  const refresh = flag('no-refresh') !== true;

  const base = JSON.parse(fs.readFileSync(basePath, 'utf8'));
  const add = JSON.parse(fs.readFileSync(addPath, 'utf8'));
  const before = base.products.length;

  const { stats, priceChanges, fieldChanges, newSources } = mergeRetail(base, add, { refresh });

  console.log(`merge-retail — ${path.relative(REPO, addPath)} -> ${path.relative(REPO, basePath)}`);
  console.log(`  incoming rows:                 ${stats.incoming}`);
  console.log(`  imported (new products):       ${stats.imported}`);
  console.log(`  refreshed (same source re-read): ${stats.refreshedRows}`);
  console.log(`    · price changed:             ${stats.priceChanged}`);
  console.log(`    · other fields changed:      ${JSON.stringify(fieldChanges)}`);
  console.log(`  identical, nothing to do:      ${stats.unchanged}`);
  console.log(`  skipped, product already covered by another row: ${stats.skippedDuplicateOtherSource}`);
  console.log(`  skipped, same row but --no-refresh:  ${stats.skippedSameRowNoRefresh}`);
  console.log(`  skipped, currency not EUR:     ${stats.skippedCurrency}`);
  console.log(`  price present before, absent now (old kept): ${stats.priceMissingKeptOld}`);
  console.log(`  rows: ${before} -> ${base.products.length}`);
  console.log(`  new source records: ${newSources.length}`);
  if (priceChanges.length) {
    console.log('  SAMPLE PRICE CHANGES:');
    for (const c of priceChanges.slice(0, 10)) {
      console.log(`    ${c.name} — ${c.from} -> ${c.to} ${c.currency}${c.pct != null ? ` (${c.pct > 0 ? '+' : ''}${c.pct}%)` : ''}`);
    }
  }

  if (dryRun) {
    console.log('\n  --dry-run: nothing written.');
  } else {
    fs.writeFileSync(outPath, JSON.stringify(base));
    console.log(`\n  written: ${path.relative(REPO, outPath)} (${(fs.statSync(outPath).size / 1048576).toFixed(1)} MB)`);
  }
}
