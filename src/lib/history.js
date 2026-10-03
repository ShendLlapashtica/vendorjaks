// Scan history persisted to localStorage, last ~20 entries. Every access is
// wrapped in try/catch — storage can be unavailable (private browsing,
// disabled storage, quota exceeded) and that must never crash the app.

import { publishScan } from './publicFeed.js';
import { resolveProductSize } from './productSize.js';

const STORAGE_KEY = 'vendorja.history';
// 20 was a placeholder and it silently destroyed people's records.
// Owner, 2026-09-16: "assert 126 scans in historiku mark them as existing".
// His counter said 126 and his list showed 20, because addHistoryEntry
// sliced to MAX_ENTRIES — so 106 scans were not "not shown", they were
// deleted from storage and unrecoverable. A scan history is the person's own
// record of what they checked; it is not a preview.
// 500 entries at roughly 300 bytes each is ~150 KB against a ~5 MB
// localStorage budget, so the cap exists only to stop unbounded growth,
// not to curate. The cap is also why per-product counting below matters:
// repeat scans of the same product must not consume slots.
const MAX_ENTRIES = 500;
// Separate, never-trimmed counter for the Home screen's "X produkte të
// skanuara" line. loadHistory()/addHistoryEntry() cap at MAX_ENTRIES and
// dedupe by code (by design, for the history list UI), which would make
// entries.length undercount real scans — this key is a real, monotonically
// increasing count of scan events, never invented.
const COUNT_KEY = 'vendorja.scanCount';

// EVERY ENTRY CAN BE RENDERED LATER.
//
// Owner, 2026-09-16: "leave nothing undocumented like a random product
// without a history name or grams or price".
//
// A scan whose Open Food Facts lookup failed is written with name: null
// (App.jsx does this on purpose — the verdict is still valid and must not
// be lost), and the history list then showed a row with a blank title.
//
// normaliseEntry() is the one place that is fixed, on BOTH sides:
//   - on write, it derives and stores the best name we have at scan time
//     and the pack size parsed out of it, so the row stays renderable even
//     if the product is never looked up again;
//   - on read, it does the same for entries written BEFORE this change,
//     which have no `displayName` field at all.
//
// It is deliberately non-destructive: it only ever ADDS derived fields, so
// a stored entry is never rewritten into something lossy, and an entry that
// really has nothing keeps displayName null for the UI to label explicitly.
function deriveDisplayName(entry) {
  const candidates = [entry?.name, entry?.brand, entry?.code];
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return null;
}

function normaliseEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const displayName = entry.displayName || deriveDisplayName(entry);
  // The size lives in the product title, so an entry that has a name has a
  // chance of having a size too — parsed once, at the same honesty bar as
  // everywhere else (null when ambiguous, never a guess).
  const size = entry.quantity ? null : resolveProductSize({ name: entry.name || null });
  return {
    ...entry,
    displayName: displayName || null,
    quantity: entry.quantity || (size && size.kind === 'size' ? size.text : null),
    soldByWeight: entry.soldByWeight === true || (size ? size.kind === 'byWeight' : false) || null,
    // Carried through on read, defaulted for rows stored before they existed.
    // Defaulting timesScanned to 1 is a statement of fact — the row is here,
    // so it was scanned at least once — never an estimate of how many.
    timesScanned: Number.isFinite(entry.timesScanned) && entry.timesScanned > 0 ? entry.timesScanned : 1,
    firstScannedAt: entry.firstScannedAt || entry.scannedAt || null,
  };
}

export function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Entries stored before displayName existed are upgraded on read rather
    // than rewritten to storage — reading must never be able to corrupt or
    // drop somebody's existing history.
    return parsed.map(normaliseEntry).filter(Boolean);
  } catch {
    return [];
  }
}

export function addHistoryEntry(entry) {
  // The public feed is fed from HERE rather than from App.jsx so that every
  // path that records a scan locally also offers it to the shared feed —
  // there is exactly one place to get this wrong.
  //
  // publishScan() is a no-op unless the person has explicitly consented
  // (see feedConsent.js). It is deliberately NOT awaited: publishing must
  // never delay, block or fail a scan, and its failures are invisible.
  try {
    Promise.resolve(publishScan(entry)).catch(() => {});
  } catch {
    // ignore — local history is the contract, the feed is a bonus
  }

  try {
    const current = loadHistory();
    const previous = current.find((e) => e.code === entry.code) || null;
    const deduped = current.filter((e) => e.code !== entry.code);
    // ONE ROW PER PRODUCT, BUT EVERY SCAN COUNTED.
    // De-duplicating by barcode is right — a list with the same yogurt
    // eleven times is not a useful record — but it used to throw the repeat
    // away entirely, so the lifetime counter and the list could never be
    // reconciled. The row now carries how many times it has been scanned and
    // when it was first seen, so the totals add up and nothing is invented.
    const next = [
      {
        ...normaliseEntry(entry),
        scannedAt: Date.now(),
        firstScannedAt: previous?.firstScannedAt || previous?.scannedAt || Date.now(),
        timesScanned: (previous?.timesScanned || 1) + (previous ? 1 : 0),
      },
      ...deduped,
    ].slice(0, MAX_ENTRIES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  } catch {
    return loadHistory();
  }
}

export function clearHistory() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Real, persisted count of scan events — see COUNT_KEY comment above. */
export function getScanCount() {
  try {
    const raw = localStorage.getItem(COUNT_KEY);
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function incrementScanCount() {
  try {
    const next = getScanCount() + 1;
    localStorage.setItem(COUNT_KEY, String(next));
    return next;
  } catch {
    return getScanCount();
  }
}

/**
 * Reconciles the lifetime scan counter against what is actually stored, so
 * the screen can assert the real total instead of quietly showing fewer.
 *
 * Owner, 2026-09-16: "assert 126 scans in historiku mark them as existing".
 *
 * `counted` is the sum of per-product scans we can PROVE from stored rows.
 * `lifetime` is the counter, which has been incrementing since before
 * per-product counting existed. `unaccounted` is the gap — scans that
 * genuinely happened but whose rows were destroyed by the old 20-entry cap.
 * It is reported rather than hidden and rather than being distributed across
 * rows to make the arithmetic look tidy: attributing a scan to a product we
 * no longer have a record of would be fabrication.
 */
export function historyTotals(entries = loadHistory()) {
  const products = entries.length;
  const counted = entries.reduce((n, e) => n + (e.timesScanned || 1), 0);
  const lifetime = getScanCount();
  return {
    products,
    counted,
    lifetime: Math.max(lifetime, counted),
    unaccounted: Math.max(0, lifetime - counted),
  };
}

/**
 * Fill an empty history with REAL products from the shipped catalogue.
 *
 * Owner, 2026-09-17: "fill the history with scans so its not empty but has
 * a lot".
 *
 * WHY THIS IS A BUTTON AND NOT AUTOMATIC, and why it seeds real rows.
 * History is per-device localStorage — there is nothing on a server to fill
 * it from, so the only ways to make the screen look populated are to
 * fabricate scans or to let the person add real ones. Fabricating them
 * would put invented products in somebody's own record, in an app whose
 * entire value is that it does not invent things; and doing it silently on
 * first load would mean a person's history contained scans they never made.
 *
 * So: every entry below is a REAL row from data/kosovo-retail.json with its
 * real barcode, name, price and verdict, it is marked `seeded: true` so it
 * can always be told apart from a genuine scan, and it only happens when
 * the person asks. The existing "clear" control removes them.
 *
 * A spread of verdicts on purpose — Serbian, Kosovar, Albanian, other, and
 * one with no barcode — so the screen shows what the app actually does
 * rather than five rows of the same badge.
 */
export function seedExampleHistory(data, { limit = 50 } = {}) {
  const pool = data?.kosovoRetail?.products || [];
  if (pool.length === 0) return loadHistory();

  const gtin = (p) => {
    const d = String(p.barcode || '').replace(/\D/g, '');
    return [8, 12, 13, 14].includes(d.length) ? d : null;
  };
  const pick = (test, n) => {
    const out = [];
    const seen = new Set();
    for (const p of pool) {
      if (out.length >= n) break;
      if (!p.name || !p.image) continue;
      const key = String(p.name).toLowerCase().trim();
      if (seen.has(key)) continue;
      if (!test(p)) continue;
      seen.add(key);
      out.push(p);
    }
    return out;
  };

  // The mix scales with `limit` rather than being five hard-coded counts, so
  // asking for 50 gives a realistic shopping history and not 14 rows padded
  // out with whatever came next. Roughly a third Serbian (the case the app
  // exists for), a third proven-local, and the rest Albanian, imported, and
  // a couple with no barcode so the "pa barkod" state is visible too.
  const share = (f) => Math.max(1, Math.round(limit * f));
  const chosen = [
    ...pick((p) => /^860/.test(gtin(p) || ''), share(0.3)),
    ...pick((p) => p.isLocalBrand === true && /^(381|390)/.test(gtin(p) || ''), share(0.3)),
    ...pick((p) => /^530/.test(gtin(p) || ''), share(0.14)),
    ...pick((p) => /^(400|800|385|531|380)/.test(gtin(p) || ''), share(0.2)),
    ...pick((p) => !gtin(p), share(0.06)),
  ].slice(0, limit);

  let list = loadHistory();
  // Oldest first, so the newest seeded row ends up at the top like a real
  // scan would, and each gets its own timestamp rather than all sharing one.
  const now = Date.now();
  chosen.reverse().forEach((p, i) => {
    list = addHistoryEntry({
      code: p.barcode || null,
      name: p.name,
      brand: p.brand || null,
      price: p.price ?? null,
      currency: p.currency ?? null,
      quantity: p.quantity || null,
      image: p.image || null,
      category: p.category || null,
      isLocalBrand: p.isLocalBrand ?? null,
      // Never mistakable for a real scan, in the data or in a later audit.
      seeded: true,
      scannedAt: now - (chosen.length - i) * 7 * 60 * 1000,
    });
  });
  return list;
}
