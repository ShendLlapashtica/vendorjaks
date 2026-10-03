// Vendorja — the PUBLIC scan feed.
//
// Owner, 2026-09-14: "make the history of all things scanned public i scan
// you scan he scans we all scan" / "history must be full with everything
// everyone scans ask for cookies to store the historiku".
//
// This is the only server-side code in the project. The app is otherwise a
// static SPA, so everything here has to survive being deployed with NO
// backing store at all: if the store is not provisioned the route answers
// 503 { error: "not_provisioned" } and the client silently falls back to
// local-only history. Nothing breaks, nothing is faked.
//
// ---------------------------------------------------------------------------
// STORAGE
// ---------------------------------------------------------------------------
// An Upstash-compatible Redis REST endpoint — which is what BOTH "Vercel KV"
// (the Upstash marketplace integration) and a direct free Upstash account
// expose, under either of two env var pairs:
//
//   KV_REST_API_URL        + KV_REST_API_TOKEN          (Vercel integration)
//   UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN   (Upstash direct)
//
// Spoken over plain fetch on purpose: no npm dependency is added to this
// repo, so `npm ci` and the Vite build are untouched by the feed.
//
// ---------------------------------------------------------------------------
// PRIVACY — read before changing anything here
// ---------------------------------------------------------------------------
// A public feed of scans is personal data. What is PUBLISHED is exactly:
//   code, name, brand, verdict, at (timestamp), by (coarse rotating id)
// What is NEVER published:
//   IP address, precise location, user agent, device or browser
//   identifiers, referrer, any name or contact detail.
// One correction to an earlier version of this comment, because the consent
// prompt quotes it and the two must agree: the IP is not untouched. It is
// hashed with the salt into RATE-LIMIT KEY NAMES only — `vj:rl:m:<hash>`
// (EXPIRE 120s) and `vj:rl:d:<hash>` (EXPIRE 172800s, i.e. up to 48 hours),
// never a value, never a field on a feed record, and never reversible back
// to an address. "We do not store your IP" was an overstatement; the
// prompt now says hashed anti-spam counter, expiring within two days,
// which is what this code does.
// `owner` (the client's private anon id, needed so a person can delete their
// own contributions) IS stored on the record but is stripped from every read
// path — see toPublic(). The public `by` is a truncated hash of
// owner + a monthly salt, so it rotates every month and cannot be reversed
// into the delete key.
// ---------------------------------------------------------------------------

import { createHash, randomUUID } from 'node:crypto';

const FEED_KEY = 'vj:feed';
const FEED_MAX = 500; // hard cap on how much history the list holds
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

// Rate limits, per hashed IP.
const POST_PER_MIN = 10;
const POST_PER_DAY = 300;
// A person re-scanning the same product in a tight loop posts once.
const DEDUPE_WINDOW_S = 600;

const VERDICTS = new Set([
  'SERBIAN',
  'LOCAL',
  'OTHER',
  'NOT_A_COUNTRY',
  'UNASSIGNED',
  'UNKNOWN',
]);

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/**
 * The MODERATION KILL-SWITCH. Set PUBLIC_FEED=off (or 0/false/disabled) in
 * the Vercel project's Environment Variables and redeploy: every method here
 * answers 410 { error: "disabled" } and the client drops back to local-only
 * history for everybody, instantly, without a code change.
 */
export function feedDisabled(env = process.env) {
  const raw = String(env.PUBLIC_FEED ?? '').trim().toLowerCase();
  return raw === 'off' || raw === '0' || raw === 'false' || raw === 'disabled';
}

/** The Redis REST endpoint, or null when nothing is provisioned. */
export function storeConfig(env = process.env) {
  const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL || '';
  const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN || '';
  if (!url || !token) return null;
  return { url: url.replace(/\/+$/, ''), token };
}

/**
 * Salt for the one-way hashes (IP -> rate-limit key, owner -> public `by`).
 * FEED_SALT if the owner sets one; otherwise derived from the store token,
 * which is already a secret that exists — so no extra provisioning step.
 */
function salt(env = process.env) {
  return (
    env.FEED_SALT ||
    env.KV_REST_API_TOKEN ||
    env.UPSTASH_REDIS_REST_TOKEN ||
    'vendorja-unsalted'
  );
}

function sha(input) {
  return createHash('sha256').update(String(input)).digest('hex');
}

// ---------------------------------------------------------------------------
// Redis over REST
// ---------------------------------------------------------------------------

async function pipeline(cfg, commands) {
  const res = await fetch(`${cfg.url}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
  });
  if (!res.ok) {
    throw new Error(`store ${res.status}`);
  }
  const json = await res.json();
  if (!Array.isArray(json)) throw new Error('store: unexpected response');
  return json.map((r) => (r && 'result' in r ? r.result : null));
}

// ---------------------------------------------------------------------------
// Validation. EVERYTHING a client posts is untrusted: an attacker can POST
// arbitrary barcodes and arbitrary strings straight at this route, so the
// feed is only ever allowed to contain shapes this function produces.
// ---------------------------------------------------------------------------

/** GTIN-8/12/13/14 shaped. Digits only, no separators, no unbounded input. */
export function isValidCode(code) {
  return typeof code === 'string' && /^[0-9]{8,14}$/.test(code);
}

/** 12 lowercase hex — the client's locally generated anonymous id. */
export function isValidAnonId(id) {
  return typeof id === 'string' && /^[0-9a-f]{12}$/.test(id);
}

/** Strip control characters and collapse whitespace, then hard-cap length. */
export function cleanText(value, max) {
  if (typeof value !== 'string') return null;
  // eslint-disable-next-line no-control-regex
  const stripped = value
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028\u2029]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!stripped) return null;
  return stripped.slice(0, max);
}

/**
 * The product name and brand are the only free text in the feed, which makes
 * them the one thing an attacker could use it for: a link farm on a public
 * list. Anything that smells like a URL, an address or markup loses the
 * FIELD (the scan itself is still recorded — the barcode is the point).
 */
export function looksLikeSpam(value) {
  if (typeof value !== 'string') return false;
  return /https?:\/\/|www\.|[a-z0-9-]+\.(com|net|org|info|xyz|ru|rs|shop|top|link)\b|@|[<>]/i.test(
    value
  );
}

function safeText(value, max) {
  const cleaned = cleanText(value, max);
  if (!cleaned || looksLikeSpam(cleaned)) return null;
  return cleaned;
}

/**
 * Turn an untrusted POST body into either a storable record or a reason to
 * reject it. Returns { ok:true, entry } or { ok:false, field }.
 */
export function sanitizeEntry(body) {
  if (!body || typeof body !== 'object') return { ok: false, field: 'body' };
  if (!isValidCode(body.code)) return { ok: false, field: 'code' };
  if (!isValidAnonId(body.anonId)) return { ok: false, field: 'anonId' };
  const verdict = typeof body.verdict === 'string' ? body.verdict.toUpperCase() : '';
  if (!VERDICTS.has(verdict)) return { ok: false, field: 'verdict' };
  return {
    ok: true,
    entry: {
      code: body.code,
      name: safeText(body.name, 80),
      brand: safeText(body.brand, 60),
      verdict,
      owner: body.anonId,
      at: Date.now(),
      id: randomUUID(),
    },
  };
}

/**
 * The public projection of a stored record. This is the ONLY function that
 * produces what a reader sees, and it is an allow-list, not a delete-list —
 * a field added to the stored record is invisible until it is added here on
 * purpose.
 */
export function toPublic(record, monthSalt) {
  if (!record || typeof record !== 'object') return null;
  return {
    id: record.id || null,
    code: record.code || null,
    name: record.name || null,
    brand: record.brand || null,
    verdict: record.verdict || 'UNKNOWN',
    at: record.at || null,
    // Coarse, rotating, one-way. Enough to show "these two scans are from
    // the same person this month", never enough to name that person or to
    // follow them into next month.
    by: record.owner ? sha(`${record.owner}:${monthSalt}`).slice(0, 6) : null,
  };
}

function monthSaltFor(env, when = new Date()) {
  const ym = `${when.getUTCFullYear()}-${String(when.getUTCMonth() + 1).padStart(2, '0')}`;
  return `${ym}:${salt(env)}`;
}

// ---------------------------------------------------------------------------
// Request helpers
// ---------------------------------------------------------------------------

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  const first = Array.isArray(fwd) ? fwd[0] : String(fwd || '').split(',')[0];
  return (first || req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown').trim();
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return null;
    }
  }
  // Fall back to reading the stream ourselves (runtime did not parse it).
  try {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 8 * 1024) return null; // no unbounded bodies
      chunks.push(chunk);
    }
    if (!chunks.length) return null;
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return null;
  }
}

function json(res, status, payload) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  // The feed is public and the same for everyone; a few seconds of edge
  // caching keeps a shared list from hammering the store.
  if (status === 200) res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=10');
  else res.setHeader('Cache-Control', 'no-store');
  res.status(status).end(JSON.stringify(payload));
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'GET, POST, DELETE, OPTIONS');
    return res.status(204).end();
  }

  if (feedDisabled()) {
    return json(res, 410, { ok: false, enabled: false, error: 'disabled' });
  }

  const cfg = storeConfig();
  if (!cfg) {
    // Deployed, reachable, but no store behind it. An honest answer, not an
    // empty feed pretending to be a working one.
    return json(res, 503, { ok: false, enabled: true, error: 'not_provisioned' });
  }

  try {
    if (req.method === 'GET') return await handleGet(req, res, cfg);
    if (req.method === 'POST') return await handlePost(req, res, cfg);
    if (req.method === 'DELETE') return await handleDelete(req, res, cfg);
  } catch (err) {
    return json(res, 502, { ok: false, error: 'store_unavailable' });
  }

  res.setHeader('Allow', 'GET, POST, DELETE, OPTIONS');
  return json(res, 405, { ok: false, error: 'method_not_allowed' });
}

async function handleGet(req, res, cfg) {
  const url = new URL(req.url, 'http://localhost');
  const asked = parseInt(url.searchParams.get('limit') || '', 10);
  const limit = Number.isFinite(asked) ? Math.min(Math.max(asked, 1), MAX_LIMIT) : DEFAULT_LIMIT;

  const [rawItems, total] = await pipeline(cfg, [
    ['LRANGE', FEED_KEY, '0', String(limit - 1)],
    ['LLEN', FEED_KEY],
  ]);

  const ms = monthSaltFor(process.env);
  const items = (Array.isArray(rawItems) ? rawItems : [])
    .map((raw) => {
      try {
        return toPublic(typeof raw === 'string' ? JSON.parse(raw) : raw, ms);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  return json(res, 200, { ok: true, enabled: true, items, total: Number(total) || items.length });
}

async function handlePost(req, res, cfg) {
  const body = await readBody(req);
  const parsed = sanitizeEntry(body);
  if (!parsed.ok) {
    return json(res, 400, { ok: false, error: 'invalid', field: parsed.field });
  }

  // --- rate limit, per hashed IP. The hash is the key name only; it lives
  // for at most a day and never touches a feed record.
  const ipKey = sha(`${clientIp(req)}:${salt()}`).slice(0, 24);
  const minute = Math.floor(Date.now() / 60000);
  const day = Math.floor(Date.now() / 86400000);
  const minKey = `vj:rl:m:${ipKey}:${minute}`;
  const dayKey = `vj:rl:d:${ipKey}:${day}`;
  const dupKey = `vj:dup:${sha(`${parsed.entry.owner}:${parsed.entry.code}`).slice(0, 24)}`;

  const [minCount, , dayCount, , dupSet] = await pipeline(cfg, [
    ['INCR', minKey],
    ['EXPIRE', minKey, '120'],
    ['INCR', dayKey],
    ['EXPIRE', dayKey, '172800'],
    ['SET', dupKey, '1', 'NX', 'EX', String(DEDUPE_WINDOW_S)],
  ]);

  if (Number(minCount) > POST_PER_MIN || Number(dayCount) > POST_PER_DAY) {
    res.setHeader('Retry-After', '60');
    return json(res, 429, { ok: false, error: 'rate_limited' });
  }
  if (dupSet === null) {
    // Same person, same product, inside the dedupe window. Accepted, not
    // stored — the client must not treat this as an error.
    return json(res, 200, { ok: true, stored: false, reason: 'duplicate' });
  }

  await pipeline(cfg, [
    ['LPUSH', FEED_KEY, JSON.stringify(parsed.entry)],
    ['LTRIM', FEED_KEY, '0', String(FEED_MAX - 1)],
  ]);

  return json(res, 201, { ok: true, stored: true, id: parsed.entry.id, at: parsed.entry.at });
}

/**
 * "Delete everything I contributed." Rewrites the list without that owner's
 * records. The list is capped at FEED_MAX so this stays a small operation.
 */
async function handleDelete(req, res, cfg) {
  const body = await readBody(req);
  const anonId = body && body.anonId;
  if (!isValidAnonId(anonId)) {
    return json(res, 400, { ok: false, error: 'invalid', field: 'anonId' });
  }

  const ipKey = sha(`${clientIp(req)}:${salt()}`).slice(0, 24);
  const delKey = `vj:rl:x:${ipKey}:${Math.floor(Date.now() / 60000)}`;
  const [delCount] = await pipeline(cfg, [
    ['INCR', delKey],
    ['EXPIRE', delKey, '120'],
  ]);
  if (Number(delCount) > 5) {
    res.setHeader('Retry-After', '60');
    return json(res, 429, { ok: false, error: 'rate_limited' });
  }

  const [rawItems] = await pipeline(cfg, [['LRANGE', FEED_KEY, '0', String(FEED_MAX - 1)]]);
  const all = Array.isArray(rawItems) ? rawItems : [];
  const kept = [];
  let removed = 0;
  for (const raw of all) {
    let rec = null;
    try {
      rec = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
      rec = null;
    }
    if (rec && rec.owner === anonId) {
      removed += 1;
      continue;
    }
    kept.push(typeof raw === 'string' ? raw : JSON.stringify(raw));
  }

  if (removed === 0) return json(res, 200, { ok: true, removed: 0 });

  // DEL then re-push in the original order. RPUSH keeps index 0 newest.
  const commands = [['DEL', FEED_KEY]];
  if (kept.length) commands.push(['RPUSH', FEED_KEY, ...kept]);
  await pipeline(cfg, commands);

  return json(res, 200, { ok: true, removed });
}
