// Vendorja — SHOPPER-PROPOSED ALTERNATIVES, and the vetting queue they wait in.
//
// Owner, 2026-09-17: "IF NO MATCH FOUND> make it and people can look
// products up and propose alternatives for serb products they will undergo
// a vetting process and then you decide wether 1:1 match aswell"
//
// So: when Vendorja has no exact Kosovar/Albanian equivalent for a Serbian
// product, a person standing in a shop can name one. What they name is a
// CLAIM BY A STRANGER, not evidence, and this file's entire job is to keep
// those two things apart until a human has looked.
//
// This route is a sibling of api/feed.js and deliberately copies it rather
// than inventing a second model: same store, same env vars, same plain
// fetch with no npm dependency, same 503 degradation, same privacy posture,
// same per-IP rate limiting. Read api/feed.js first; everything that is not
// re-explained here is explained there.
//
// ---------------------------------------------------------------------------
// STORAGE
// ---------------------------------------------------------------------------
// An Upstash-compatible Redis REST endpoint, under either env var pair:
//
//   KV_REST_API_URL        + KV_REST_API_TOKEN          (Vercel integration)
//   UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN   (Upstash direct)
//
// If neither is set the route answers 503 { error: "not_provisioned" } and
// the client degrades to "you cannot propose right now" — silently, with no
// retry storm and no pretend success. The app still builds and deploys.
//
// THREE SEPARATE KEYS, and the separation is the safety property:
//
//   vj:prop:q    pending queue   — written by POST here. NO read path in
//                                  this file returns its contents.
//   vj:prop:ok   accepted        — written ONLY by scripts/vet-proposals.mjs
//                                  after a human decided. GET reads this.
//   vj:prop:rej  rejected        — written only by the vetting script, read
//                                  by nothing. Kept so a rejection has a
//                                  record and a re-submission can be seen.
//
// A pending proposal is therefore not "filtered out of" the public answer —
// it is in a key the public answer never names. See handleGet() below, and
// the source-level assertion in src/test/proposals.test.js that proves it.
//
// ---------------------------------------------------------------------------
// PRIVACY — the same rule as the feed, applied to a smaller record
// ---------------------------------------------------------------------------
// STORED:      forCode, forName, forBrand, altCode, altBrand, altName,
//              seenAt (a shop name, free text), owner (the client's private
//              anon id, when there is one), at, id, status.
// PUBLISHED:   only what toPublicAccepted() allow-lists — and `seenAt` and
//              `owner` are NOT in it. "I saw it in Viva Fresh" is a lead for
//              the reviewer, not a fact about the product, and publishing a
//              place a named person stood in is not needed for anything.
// NEVER STORED AT ALL:
//              IP address, precise location (there is no lat/lng field and
//              a `seenAt` that looks like coordinates is dropped), user
//              agent, device or browser identifier, the page they arrived
//              from, any name or contact detail.
// The IP is hashed with the salt into RATE-LIMIT KEY NAMES only —
// `vj:prl:m:<hash>` (EXPIRE 120s) and `vj:prl:d:<hash>` (EXPIRE 172800s) —
// never a value, never a field on a record, never reversible.
// `owner` is stored so a person can delete their own proposals; it is
// stripped from every read path. The public `by` is a truncated hash of
// owner + a monthly salt, exactly as in the feed: it rotates every month
// and cannot be reversed into the delete key.
//
// `anonId` is OPTIONAL here, unlike in the feed. The feed publishes a scan
// the person did not deliberately compose, so it is gated on the cookie
// consent that mints the id; a proposal is a thing someone typed and
// pressed a button to send, and making them accept an unrelated analytics-
// shaped cookie first would be a worse trade than accepting the proposal
// anonymously. Without an id, dedupe falls back to the hashed IP counter
// and the person simply has no delete handle — which is what "anonymous"
// costs.
// ---------------------------------------------------------------------------

import { createHash, randomUUID } from 'node:crypto';

export const PENDING_KEY = 'vj:prop:q';
export const ACCEPTED_KEY = 'vj:prop:ok';
export const REJECTED_KEY = 'vj:prop:rej';

// A flood must not be able to push honest proposals out of the queue, so the
// cap REFUSES new writes rather than LTRIM-ing the oldest away.
export const QUEUE_MAX = 2000;
const ACCEPTED_MAX = 1000;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

// Tighter than the feed's 10/min: a scan is something you do repeatedly in
// an aisle, a proposal is something you compose.
const POST_PER_MIN = 3;
const POST_PER_DAY = 20;
// The same person proposing the same thing for the same product again is
// accepted and not stored, for a day.
const DEDUPE_WINDOW_S = 86400;

/** The review states a stored proposal can be in. */
export const STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  NEEDS_INFO: 'needs_info',
};

/** How close the reviewer judged the pairing. The owner's "1:1 match" call. */
export const MATCH_KINDS = new Set(['1:1', 'similar']);

// ---------------------------------------------------------------------------
// Config — identical to api/feed.js so one provisioning step serves both
// ---------------------------------------------------------------------------

/**
 * Kill-switch. PROPOSALS=off (or 0/false/disabled) in the Vercel project's
 * Environment Variables turns the whole surface off: every method answers
 * 410 and the client stops rendering the form, without a code change.
 * PUBLIC_FEED=off also turns proposals off — it is the broader switch and
 * an owner reaching for it means "stop taking contributions".
 */
export function proposalsDisabled(env = process.env) {
  const off = (raw) => {
    const v = String(raw ?? '').trim().toLowerCase();
    return v === 'off' || v === '0' || v === 'false' || v === 'disabled';
  };
  return off(env.PROPOSALS) || off(env.PUBLIC_FEED);
}

/** The Redis REST endpoint, or null when nothing is provisioned. */
export function storeConfig(env = process.env) {
  const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL || '';
  const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN || '';
  if (!url || !token) return null;
  return { url: url.replace(/\/+$/, ''), token };
}

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
// Redis over REST. NOT exported: the vetting script speaks to the store with
// its own copy of these ten lines, so that this module has no export capable
// of handing a caller an arbitrary key's contents.
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
  if (!res.ok) throw new Error(`store ${res.status}`);
  const json = await res.json();
  if (!Array.isArray(json)) throw new Error('store: unexpected response');
  return json.map((r) => (r && 'result' in r ? r.result : null));
}

// ---------------------------------------------------------------------------
// Validation. Everything a client posts is untrusted.
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
 * Free text on a politically charged, user-submitted-content surface is the
 * one thing an attacker can actually use this route for. Anything that
 * smells like a URL, an address, markup or a script loses the FIELD.
 *
 * This is NOT an HTML sanitiser and must not be mistaken for one: nothing in
 * Vendorja ever renders a proposal as HTML (React escapes text children, and
 * src/test/proposals.test.js asserts no propose/read surface uses
 * any raw-HTML escape hatch). This is a link-farm and payload filter on top
 * of that, not instead of it.
 */
export function looksLikeSpam(value) {
  if (typeof value !== 'string') return false;
  return /https?:\/\/|www\.|[a-z0-9-]+\.(com|net|org|info|xyz|ru|rs|shop|top|link)\b|@|[<>]|javascript:|data:|&#|\\u00/i.test(
    value
  );
}

/** Looks like a GPS fix rather than a shop name. Never stored. */
export function looksLikeCoordinates(value) {
  if (typeof value !== 'string') return false;
  return /-?\d{1,3}\.\d{3,}\s*[,;]\s*-?\d{1,3}\.\d{3,}/.test(value);
}

function safeText(value, max) {
  const cleaned = cleanText(value, max);
  if (!cleaned || looksLikeSpam(cleaned)) return null;
  return cleaned;
}

/**
 * Normalise a GTIN the way src/lib/gs1.js:classifyBarcode() does, so the
 * prefix this file reads is the prefix the app reads. Duplicated rather than
 * imported because this is a serverless function and src/ is browser code —
 * the two must agree, and src/test/proposals.test.js asserts they do against
 * the real classifier.
 */
export function gs1PrefixOf(code) {
  const digits = String(code || '').replace(/\D/g, '');
  if (![8, 12, 13, 14].includes(digits.length)) return null;
  let n = digits;
  if (n.length === 14) n = n.slice(1); // drop the packaging indicator
  if (n.length === 12) n = `0${n}`; // UPC-A is a GTIN-13 with a leading 0
  return n.slice(0, 3);
}

/**
 * Is this barcode registered with GS1 Serbia?
 *
 * 860 is the whole of GS1 Serbia in data/gs1-prefixes.json (checked: it is
 * the only entry with isSerbia true). A prefix is a REGISTRATION, not an
 * origin — but "registered under 860" is precisely the thing this app
 * boycotts, so proposing an 860 product as the escape from an 860 product
 * is self-defeating by the app's own published definition, and the route
 * says so at intake instead of spending a reviewer's attention on it.
 */
export function isSerbianRegistered(code) {
  return gs1PrefixOf(code) === '860';
}

/** Fold for comparison only: diacritics out, case down, punctuation out. */
export function foldForCompare(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

/**
 * Turn an untrusted POST body into a storable PENDING record, or a reason to
 * refuse it. Returns { ok:true, entry } or { ok:false, field, reason }.
 *
 * The three refusals below are not judgement calls and are not a moderation
 * system — they are the proposals that are nonsense on their face:
 *   same_product        the "alternative" is the product itself
 *   same_brand          the "alternative" is the same brand
 *   alternative_serbian the "alternative" is itself 860-registered
 * Everything else, including a proposal a reviewer will obviously reject,
 * goes in the queue with its evidence, because deciding is the human's job.
 *
 * This function CANNOT mint any status but 'pending'. That is asserted.
 */
export function sanitizeProposal(body) {
  if (!body || typeof body !== 'object') return { ok: false, field: 'body' };

  // The Serbian product this is an alternative TO.
  if (!isValidCode(body.forCode)) return { ok: false, field: 'forCode' };

  // The proposal itself: a barcode is best because it is checkable; a brand
  // is accepted because most shoppers will not have the box in hand.
  const altCode = isValidCode(body.altCode) ? body.altCode : null;
  if (body.altCode != null && body.altCode !== '' && !altCode) {
    return { ok: false, field: 'altCode' };
  }
  const altBrand = safeText(body.altBrand, 60);
  if (!altCode && !altBrand) return { ok: false, field: 'altBrand', reason: 'nothing_named' };

  const forBrand = safeText(body.forBrand, 60);

  if (altCode && altCode === body.forCode) {
    return { ok: false, field: 'altCode', reason: 'same_product' };
  }
  if (altBrand && forBrand && foldForCompare(altBrand) === foldForCompare(forBrand)) {
    return { ok: false, field: 'altBrand', reason: 'same_brand' };
  }
  if (altCode && isSerbianRegistered(altCode)) {
    return { ok: false, field: 'altCode', reason: 'alternative_serbian' };
  }

  const rawSeen = cleanText(body.seenAt, 60);
  const seenAt =
    rawSeen && !looksLikeSpam(rawSeen) && !looksLikeCoordinates(rawSeen) ? rawSeen : null;

  return {
    ok: true,
    entry: {
      id: randomUUID(),
      // Hard-coded, not read from the body. A client cannot post itself an
      // accepted proposal, and no later edit here can make it possible
      // without failing the test that asserts this literal.
      status: STATUS.PENDING,
      forCode: body.forCode,
      forName: safeText(body.forName, 80),
      forBrand,
      altCode,
      altBrand,
      altName: safeText(body.altName, 80),
      // A lead for the reviewer, never published. "Sold in Kosovo" is not
      // "made by a Kosovar brand" and this field is the shape that lie
      // usually arrives in.
      seenAt,
      owner: isValidAnonId(body.anonId) ? body.anonId : null,
      at: Date.now(),
    },
  };
}

/**
 * THE ONLY PROJECTION A READER EVER SEES.
 *
 * An allow-list, not a delete-list: a field added to the stored record stays
 * invisible until someone adds it here on purpose. And the first line is the
 * belt to the key-separation's braces — a record that is not accepted is not
 * renderable, whatever list it was read out of.
 */
export function toPublicAccepted(record, monthSalt) {
  if (!record || typeof record !== 'object') return null;
  if (record.status !== STATUS.ACCEPTED) return null;
  if (!isValidCode(record.forCode)) return null;
  return {
    id: record.id || null,
    forCode: record.forCode,
    altCode: isValidCode(record.altCode) ? record.altCode : null,
    altBrand: record.altBrand || null,
    altName: record.altName || null,
    // How the reviewer judged it — the owner's "1:1 match" decision. Anything
    // the reviewer did not explicitly mark 1:1 reads as merely similar.
    match: MATCH_KINDS.has(record.match) ? record.match : 'similar',
    // Where this came from, so the UI can never show it as if it were a
    // source-cited curated pairing from data/brand-alternatives.json.
    origin: 'community-vetted',
    sourceUrl: typeof record.sourceUrl === 'string' ? record.sourceUrl : null,
    at: record.at || null,
    acceptedAt: record.acceptedAt || null,
    by: record.owner ? sha(`${record.owner}:${monthSalt}`).slice(0, 6) : null,
    // NOT published, on purpose: owner, seenAt, reviewer identity, flags.
  };
}

function monthSaltFor(env, when = new Date()) {
  const ym = `${when.getUTCFullYear()}-${String(when.getUTCMonth() + 1).padStart(2, '0')}`;
  return `${ym}:${salt(env)}`;
}

// ---------------------------------------------------------------------------
// Request helpers (same as api/feed.js)
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
  try {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 8 * 1024) return null;
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
  if (status === 200) res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=30');
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

  if (proposalsDisabled()) {
    return json(res, 410, { ok: false, enabled: false, error: 'disabled' });
  }

  const cfg = storeConfig();
  if (!cfg) {
    // Deployed, reachable, no store behind it. The honest answer — and the
    // DEFAULT state of this repo, which is why every client path has to
    // treat it as normal rather than as an error.
    return json(res, 503, { ok: false, enabled: true, error: 'not_provisioned' });
  }

  try {
    if (req.method === 'GET') return await handleGet(req, res, cfg);
    if (req.method === 'POST') return await handlePost(req, res, cfg);
    if (req.method === 'DELETE') return await handleDelete(req, res, cfg);
  } catch {
    return json(res, 502, { ok: false, error: 'store_unavailable' });
  }

  res.setHeader('Allow', 'GET, POST, DELETE, OPTIONS');
  return json(res, 405, { ok: false, error: 'method_not_allowed' });
}

/**
 * Read VETTED pairings. ACCEPTED_KEY is the only key named in this function,
 * and src/test/proposals.test.js reads this file's source to prove it stays
 * that way — if a future edit reaches for the pending queue here, the suite
 * goes red before a shopper ever sees a stranger's unchecked claim.
 *
 * `pendingCount` is a NUMBER, never content: it lets the UI honestly say
 * "12 waiting to be checked" without showing one of them.
 */
async function handleGet(req, res, cfg) {
  const url = new URL(req.url, 'http://localhost');
  const asked = parseInt(url.searchParams.get('limit') || '', 10);
  const limit = Number.isFinite(asked) ? Math.min(Math.max(asked, 1), MAX_LIMIT) : DEFAULT_LIMIT;
  const forCode = url.searchParams.get('for');

  const [rawItems, total, pendingCount] = await pipeline(cfg, [
    ['LRANGE', ACCEPTED_KEY, '0', String(ACCEPTED_MAX - 1)],
    ['LLEN', ACCEPTED_KEY],
    ['LLEN', PENDING_KEY],
  ]);

  const ms = monthSaltFor(process.env);
  let items = (Array.isArray(rawItems) ? rawItems : [])
    .map((raw) => {
      try {
        return toPublicAccepted(typeof raw === 'string' ? JSON.parse(raw) : raw, ms);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  if (isValidCode(forCode)) items = items.filter((it) => it.forCode === forCode);
  items = items.slice(0, limit);

  return json(res, 200, {
    ok: true,
    enabled: true,
    items,
    total: Number(total) || items.length,
    pendingCount: Number(pendingCount) || 0,
  });
}

async function handlePost(req, res, cfg) {
  const body = await readBody(req);
  const parsed = sanitizeProposal(body);
  if (!parsed.ok) {
    return json(res, 400, {
      ok: false,
      error: 'invalid',
      field: parsed.field,
      reason: parsed.reason || null,
    });
  }

  const ipKey = sha(`${clientIp(req)}:${salt()}`).slice(0, 24);
  const minute = Math.floor(Date.now() / 60000);
  const day = Math.floor(Date.now() / 86400000);
  const minKey = `vj:prl:m:${ipKey}:${minute}`;
  const dayKey = `vj:prl:d:${ipKey}:${day}`;
  // Dedupe on (who, which product, what was named). Without an anonId the
  // hashed IP stands in, which is coarser but still stops a stuck button.
  const who = parsed.entry.owner || ipKey;
  const what = foldForCompare(`${parsed.entry.altCode || ''}|${parsed.entry.altBrand || ''}`);
  const dupKey = `vj:pdup:${sha(`${who}:${parsed.entry.forCode}:${what}`).slice(0, 24)}`;

  const [minCount, , dayCount, , dupSet, queueLen] = await pipeline(cfg, [
    ['INCR', minKey],
    ['EXPIRE', minKey, '120'],
    ['INCR', dayKey],
    ['EXPIRE', dayKey, '172800'],
    ['SET', dupKey, '1', 'NX', 'EX', String(DEDUPE_WINDOW_S)],
    ['LLEN', PENDING_KEY],
  ]);

  if (Number(minCount) > POST_PER_MIN || Number(dayCount) > POST_PER_DAY) {
    res.setHeader('Retry-After', '60');
    return json(res, 429, { ok: false, error: 'rate_limited' });
  }
  if (dupSet === null) {
    // Already proposed by this person for this product. Accepted, not
    // stored — not an error the shopper needs to see.
    return json(res, 200, { ok: true, stored: false, reason: 'duplicate' });
  }
  if (Number(queueLen) >= QUEUE_MAX) {
    // REFUSE rather than LTRIM. Trimming would let a flood delete the
    // honest proposals ahead of it, which is the cheapest possible attack
    // on a queue whose whole value is that a human will read it.
    res.setHeader('Retry-After', '3600');
    return json(res, 503, { ok: false, error: 'queue_full' });
  }

  await pipeline(cfg, [['LPUSH', PENDING_KEY, JSON.stringify(parsed.entry)]]);

  // 202, not 201: received and queued, NOT published. The client renders
  // this as "it will be checked", never as "it is live".
  return json(res, 202, {
    ok: true,
    stored: true,
    status: STATUS.PENDING,
    id: parsed.entry.id,
    at: parsed.entry.at,
  });
}

/**
 * "Delete what I proposed."
 *
 * Pending proposals by that owner are removed outright. Accepted ones are
 * KEPT but UNLINKED — `owner` is nulled — because once a human vetted the
 * pairing it is curated content about two products, not a record about the
 * person, and the person's interest is in not being linked to it. Either
 * way the response is counts only: this method never returns proposal
 * content, pending or otherwise.
 */
async function handleDelete(req, res, cfg) {
  const body = await readBody(req);
  const anonId = body && body.anonId;
  if (!isValidAnonId(anonId)) {
    return json(res, 400, { ok: false, error: 'invalid', field: 'anonId' });
  }

  const ipKey = sha(`${clientIp(req)}:${salt()}`).slice(0, 24);
  const delKey = `vj:prl:x:${ipKey}:${Math.floor(Date.now() / 60000)}`;
  const [delCount] = await pipeline(cfg, [
    ['INCR', delKey],
    ['EXPIRE', delKey, '120'],
  ]);
  if (Number(delCount) > 5) {
    res.setHeader('Retry-After', '60');
    return json(res, 429, { ok: false, error: 'rate_limited' });
  }

  const [rawPending, rawAccepted] = await pipeline(cfg, [
    ['LRANGE', PENDING_KEY, '0', String(QUEUE_MAX - 1)],
    ['LRANGE', ACCEPTED_KEY, '0', String(ACCEPTED_MAX - 1)],
  ]);

  const parse = (raw) => {
    try {
      return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
      return null;
    }
  };

  const keptPending = [];
  let removed = 0;
  for (const raw of Array.isArray(rawPending) ? rawPending : []) {
    const rec = parse(raw);
    if (rec && rec.owner === anonId) {
      removed += 1;
      continue;
    }
    keptPending.push(typeof raw === 'string' ? raw : JSON.stringify(raw));
  }

  const rewrittenAccepted = [];
  let unlinked = 0;
  for (const raw of Array.isArray(rawAccepted) ? rawAccepted : []) {
    const rec = parse(raw);
    if (rec && rec.owner === anonId) {
      unlinked += 1;
      rewrittenAccepted.push(JSON.stringify({ ...rec, owner: null }));
      continue;
    }
    rewrittenAccepted.push(typeof raw === 'string' ? raw : JSON.stringify(raw));
  }

  const commands = [];
  if (removed > 0) {
    commands.push(['DEL', PENDING_KEY]);
    if (keptPending.length) commands.push(['RPUSH', PENDING_KEY, ...keptPending]);
  }
  if (unlinked > 0) {
    commands.push(['DEL', ACCEPTED_KEY]);
    if (rewrittenAccepted.length) commands.push(['RPUSH', ACCEPTED_KEY, ...rewrittenAccepted]);
  }
  if (commands.length) await pipeline(cfg, commands);

  return json(res, 200, { ok: true, removed, unlinked });
}
