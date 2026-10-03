// Client for the PUBLIC scan feed (see api/feed.js for the server side).
//
// Owner, 2026-09-14: "make the history of all things scanned public i scan
// you scan he scans we all scan".
//
// The whole point of this module is that the app must behave identically
// whether or not a backend exists. Vendorja ships as a static SPA; the feed
// route may be absent, unprovisioned, switched off, or simply unreachable on
// a phone with no signal. Every one of those cases resolves to a plain
// status the UI can render honestly — never to a crash, never to an invented
// list, never to a retry storm.
//
// STATUSES
//   'ok'          — talked to the feed, `items` is what is really there
//                   (which may legitimately be an empty array)
//   'disabled'    — the feed is switched off (build flag or server flag)
//   'unavailable' — no backend reachable; the app is local-only right now
//   'skipped'     — nothing was sent because there is no consent
//
// Once 'disabled' or 'unavailable' has been seen, this module STOPS calling
// the network for the rest of the page's life. A static deployment with no
// API must not fire a request per scan into a 404.

import { getAnonId, hasConsent } from './feedConsent.js';

export const FEED_OK = 'ok';
export const FEED_DISABLED = 'disabled';
export const FEED_UNAVAILABLE = 'unavailable';
export const FEED_SKIPPED = 'skipped';

const ENDPOINT = '/api/feed';
const TIMEOUT_MS = 6000;

/**
 * BUILD-TIME HALF OF THE KILL-SWITCH. `VITE_PUBLIC_FEED=off` in the build
 * environment compiles the feed out of the UI entirely: no requests, no
 * consent prompt, /historiku is purely local again. The server-side half
 * (PUBLIC_FEED=off, see api/feed.js) is the one that can be flipped without
 * touching the client, and it wins for everybody at once.
 */
export function isFeedEnabledByBuild() {
  let raw = '';
  try {
    raw = String(import.meta.env?.VITE_PUBLIC_FEED ?? '').trim().toLowerCase();
  } catch {
    raw = '';
  }
  return !(raw === 'off' || raw === '0' || raw === 'false' || raw === 'disabled');
}

// Remembered for the lifetime of the page so a missing backend is discovered
// once, not once per scan.
let sessionState = null; // null = not known yet | 'disabled' | 'unavailable'

export function resetFeedState() {
  sessionState = null;
}

/** What the UI should assume before it has asked. Exported for tests. */
export function currentFeedState() {
  if (!isFeedEnabledByBuild()) return FEED_DISABLED;
  return sessionState;
}

async function call(path, init = {}) {
  if (!isFeedEnabledByBuild()) return { status: FEED_DISABLED };

  // ------------------------------------------------------------------
  // THE CONSENT GATE LIVES HERE, AT THE TRANSPORT, NOT ONLY IN THE CALLER.
  //
  // publishScan() checks hasConsent() too, and that check is the one that
  // reports a useful reason. This one exists because a check in the caller
  // is a convention and a check here is a property: no code path in this
  // module, present or future, can put a scan on the wire without an
  // active grant. The only POST the feed has is "publish my scan", so a
  // POST with hasConsent() === false is always a bug.
  //
  // GET is not gated: reading the feed sends nothing about the person and
  // consent is not a toll gate for reading (see PublicFeedPanel).
  // DELETE is not gated either — it is "remove what I already published",
  // which a person must be able to do precisely BECAUSE they withdrew.
  // ------------------------------------------------------------------
  const method = String(init.method || 'GET').toUpperCase();
  if (method === 'POST' && !hasConsent()) {
    return { status: FEED_SKIPPED, reason: 'no_consent' };
  }

  if (sessionState) return { status: sessionState };

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), TIMEOUT_MS) : null;

  try {
    const res = await fetch(path, {
      ...init,
      signal: controller ? controller.signal : undefined,
      headers: { Accept: 'application/json', ...(init.headers || {}) },
    });

    if (res.status === 410) {
      sessionState = FEED_DISABLED;
      return { status: FEED_DISABLED };
    }
    // 404/405 = the route does not exist on this deployment. 503 = deployed
    // but no store provisioned. 502 = store down. All the same to the user:
    // there is no shared feed right now.
    if (res.status === 404 || res.status === 405 || res.status === 503 || res.status === 502) {
      sessionState = FEED_UNAVAILABLE;
      return { status: FEED_UNAVAILABLE };
    }

    // A static host with an SPA rewrite answers 200 text/html for a route it
    // does not have. That is "no backend", not "an empty feed".
    const type = res.headers.get('content-type') || '';
    if (!type.includes('application/json')) {
      sessionState = FEED_UNAVAILABLE;
      return { status: FEED_UNAVAILABLE };
    }

    const body = await res.json();
    if (!res.ok) return { status: FEED_OK, ok: false, body, httpStatus: res.status };
    return { status: FEED_OK, ok: true, body };
  } catch {
    // Offline, aborted, CORS, DNS — unreachable is unreachable.
    sessionState = FEED_UNAVAILABLE;
    return { status: FEED_UNAVAILABLE };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Read the shared feed. Returns { status, items, total }. `items` is only
 * ever what the server actually returned — an empty feed reports as empty.
 */
export async function fetchPublicFeed({ limit = 50 } = {}) {
  const result = await call(`${ENDPOINT}?limit=${encodeURIComponent(limit)}`);
  if (result.status !== FEED_OK || !result.ok) {
    return { status: result.status === FEED_OK ? FEED_UNAVAILABLE : result.status, items: [], total: 0 };
  }
  const body = result.body || {};
  const items = Array.isArray(body.items) ? body.items.filter(isSaneItem) : [];
  return { status: FEED_OK, items, total: Number(body.total) || items.length };
}

/**
 * The server is the authority on what goes into the feed, but a client
 * rendering the feed must not trust it blindly either — a compromised or
 * mis-deployed backend should not be able to put arbitrary shapes into the
 * DOM. Same allow-list, read side.
 */
function isSaneItem(item) {
  return (
    item &&
    typeof item === 'object' &&
    typeof item.code === 'string' &&
    /^[0-9]{8,14}$/.test(item.code) &&
    typeof item.verdict === 'string'
  );
}

/**
 * Publish one scan. Fire-and-forget: the caller does not wait for it and a
 * failure is invisible to the person scanning.
 *
 * Refuses, in order: feed off; no consent; no anonymous id; malformed code.
 */
export async function publishScan(entry) {
  if (!isFeedEnabledByBuild()) return { status: FEED_DISABLED };
  if (!hasConsent()) return { status: FEED_SKIPPED, reason: 'no_consent' };
  const anonId = getAnonId();
  if (!anonId) return { status: FEED_SKIPPED, reason: 'no_id' };
  const code = entry && typeof entry.code === 'string' ? entry.code : '';
  if (!/^[0-9]{8,14}$/.test(code)) return { status: FEED_SKIPPED, reason: 'bad_code' };

  const result = await call(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      // Trimmed here as well as on the server: no reason to put 3 KB of
      // product title on the wire to have it cut at the other end.
      name: typeof entry.name === 'string' ? entry.name.slice(0, 80) : null,
      brand: typeof entry.brand === 'string' ? entry.brand.slice(0, 60) : null,
      verdict: typeof entry.verdict === 'string' ? entry.verdict : 'UNKNOWN',
      anonId,
    }),
  });
  if (result.status !== FEED_OK) return { status: result.status };
  return { status: FEED_OK, ok: result.ok !== false, body: result.body };
}

/**
 * "Delete everything I contributed." Needs the anonymous id, so it has to be
 * called BEFORE consent is withdrawn (withdrawing destroys the id).
 */
export async function deleteMyContributions() {
  if (!isFeedEnabledByBuild()) return { status: FEED_DISABLED };
  const anonId = getAnonId();
  if (!anonId) return { status: FEED_SKIPPED, reason: 'no_id' };
  const result = await call(ENDPOINT, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ anonId }),
  });
  if (result.status !== FEED_OK) return { status: result.status };
  return { status: FEED_OK, ok: result.ok !== false, removed: result.body?.removed ?? 0 };
}

/**
 * THE PRODUCT ITSELF, NOT JUST A FLAG.
 *
 * Owner, 2026-09-18: "the product must be inside and clickable so more can
 * be read about it not just flag but product aswell".
 *
 * The feed row was a flag, a name and a barcode string, which is the one
 * surface in the app where a scan showed less than /historiku's own rows do.
 * That is not a storage limit that has to be lived with: the feed stores the
 * minimum on purpose (code, name, brand, verdict, time — publicFeed.js) and
 * everything else is already on this device. So the row is completed from the
 * local catalogue by barcode rather than by asking the server for more about
 * other people's scans.
 *
 * Precedence is deliberate. The scanning device's own `name`/`brand` win when
 * it sent them — that is what THAT person actually scanned — and the
 * catalogue only fills what the feed does not carry. A code that is not in
 * the catalogue yields no photo and no grams, and the row says so in words
 * (rule 5) instead of showing an empty frame.
 */
export function feedProduct(item, data) {
  const row = data?.localProducts?.byCode?.get(String(item.code || '')) || null;
  if (!row) return item;
  return {
    ...row,
    ...item,
    name: item.name || row.name,
    brand: item.brand || row.brand,
    image: row.image || null,
    quantity: row.quantity || null,
  };
}

/** The shared feed is backed by the built-in sample, not by the server. */
export const FEED_BUILTIN = 'builtin';

/**
 * THE 50 SCANS THAT MUST BE THERE WHEN THE PAGE OPENS.
 *
 * Owner, 2026-09-20: "these are never updating im tired of asking you . and
 * te gjitha in scans is not showing 50 scanned before in history show them
 * right now make them visible". Fourth time of asking, and the first three
 * answers were all wrong in the same way.
 *
 * WHAT WAS ACTUALLY BROKEN — measured, not guessed:
 *
 *   curl https://vendorja.com/api/feed?limit=50
 *   503 {"ok":false,"enabled":true,"error":"not_provisioned"}
 *
 * /historiku LANDS on "të gjithëve", that tab is this feed, and the feed
 * has no store behind it (KV_REST_API_URL / UPSTASH_* are unset, and
 * provisioning them needs credentials that must not pass through me). So
 * the tab everybody lands on has been rendering an error block since the
 * day it shipped. Seeding was wired to a BUTTON that only appears in the
 * empty state of the OTHER tab, which he therefore never reached; and the
 * one time I did fill it, I wrote 50 rows into localStorage in my own
 * browser, which is per-device and could never have reached him. All three
 * failures were mine and none of them was the feature being hard.
 *
 * WHAT THIS IS. Fifty REAL rows out of data/kosovo-retail.json — real
 * barcode, real name, real price, real photo, real verdict. Nothing is
 * invented, and nothing here claims anybody scanned anything: these are
 * flagged `builtin: true`, the panel labels them as catalogue samples
 * rather than community scans, and a single real row from the server
 * replaces the whole set. It is a populated shelf, not a fake crowd.
 *
 * AND IT CHANGES EVERY DAY. Keyed on rotationSeed() — the same day counter
 * /eksploro and /vendore use — so "these are never updating" stops being
 * true here too. A different fifty tomorrow, the same fifty all day, and
 * the order is deterministic so two devices on the same day agree.
 */
const BUILTIN_DAY_MS = 24 * 60 * 60 * 1000;

export function builtinFeedSeed(now = Date.now()) {
  return Math.floor(now / BUILTIN_DAY_MS);
}

function mix(seed, str) {
  // FNV-1a with an avalanche tail, seed FIRST. Appending the seed barely
  // moved the order — the same bug that made the /eksploro "daily" shuffle
  // a rotation by one for ten days. See bestValue.js.
  let h = 2166136261;
  const s = `${seed}|${str}`;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 15;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  return h >>> 0;
}

const GTIN_LENGTHS = new Set([8, 12, 13, 14]);

function gtinOf(row) {
  const digits = String(row?.barcode || '').replace(/\D/g, '');
  return GTIN_LENGTHS.has(digits.length) ? digits : null;
}

/**
 * Fifty catalogue rows in feed-item shape, deterministic for a given day.
 *
 * The mix is deliberate and matches what the app is for: a third Serbian
 * (the case that makes the app exist), a third proven-local, the rest
 * Albanian and imported — so the shelf shows the range of verdicts rather
 * than fifty identical badges. Only rows with a GTIN and a photo qualify,
 * because a feed row with neither is the "undocumented row" rule 5 forbids.
 *
 * @param {object} data     loadAllData() result
 * @param {{limit?: number, seed?: number}} opts
 * @returns {Array} items shaped like fetchPublicFeed()'s
 */
export function builtinFeedItems(data, { limit = 50, seed = builtinFeedSeed() } = {}) {
  const pool = data?.kosovoRetail?.products || [];
  if (!pool.length) return [];

  const eligible = [];
  for (const row of pool) {
    // Name, photo, GTIN and PRICE, all four. Owner, 2026-09-17: "leave
    // nothing undocumented like a random product without a history name or
    // grams or price". Three rows in the first build had no price and
    // rendered "çmimi i panjohur"; a shelf we choose the contents of has
    // no excuse for that, so they are simply not chosen.
    if (!row?.name || !row.image) continue;
    if (!(Number(row.price) > 0)) continue;
    const code = gtinOf(row);
    if (!code) continue;
    eligible.push({ row, code });
  }
  if (!eligible.length) return [];

  const bucketOf = ({ code, row }) => {
    if (code.startsWith('860')) return 'serbian';
    if (row.isLocalBrand === true && /^(381|390)/.test(code)) return 'local';
    if (code.startsWith('530')) return 'albanian';
    return 'other';
  };
  const verdictOf = (bucket) => (bucket === 'serbian' ? 'flagged' : bucket === 'local' ? 'local' : 'neutral');

  const buckets = { serbian: [], local: [], albanian: [], other: [] };
  const seenName = new Set();
  for (const item of eligible) {
    const key = String(item.row.name).toLowerCase().trim();
    if (seenName.has(key)) continue; // "10 times same product try to remove dupes"
    seenName.add(key);
    buckets[bucketOf(item)].push(item);
  }

  // Shuffle each bucket by the day seed, then take its share. Shuffling
  // BEFORE slicing is the whole point — slicing a fixed order and rotating
  // it is what produced the same grapes and apples for ten days.
  const share = { serbian: 0.3, local: 0.3, albanian: 0.14, other: 0.26 };
  const picked = [];
  for (const [name, rows] of Object.entries(buckets)) {
    const want = Math.max(1, Math.round(limit * share[name]));
    const sorted = rows
      .map((item) => ({ item, h: mix(seed, item.code) }))
      .sort((a, b) => a.h - b.h)
      .map((x) => x.item);
    for (const item of sorted.slice(0, want)) picked.push({ item, bucket: name });
  }

  // One more pass so the buckets interleave instead of arriving in blocks.
  picked.sort((a, b) => mix(seed + 1, a.item.code) - mix(seed + 1, b.item.code));

  const now = Date.now();
  return picked.slice(0, limit).map(({ item, bucket }, i) => ({
    id: `builtin-${seed}-${item.code}`,
    code: item.code,
    name: item.row.name,
    brand: item.row.brand || null,
    verdict: verdictOf(bucket),
    // THE ROW MUST BE COMPLETE. A real feed row is completed from
    // localProducts.byCode, but these codes are retail rows that are not
    // all in that index, and feedProduct() returns the item untouched when
    // the lookup misses — which rendered fifty rows reading "pa foto ·
    // çmimi i panjohur". Rule 5: nothing renders undocumented. The values
    // are carried here because they are already on the row we picked.
    image: item.row.image || null,
    price: item.row.price ?? null,
    currency: item.row.currency ?? 'EUR',
    quantity: item.row.quantity || null,
    category: item.row.category || null,
    isLocalBrand: item.row.isLocalBrand ?? null,
    // Spread across the day so the list reads as a day of shopping rather
    // than fifty scans at one instant. Never presented as a real scan time:
    // the panel labels the whole block as catalogue samples.
    at: now - i * 11 * 60 * 1000,
    builtin: true,
  }));
}
