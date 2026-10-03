// Client for SHOPPER-PROPOSED ALTERNATIVES (see api/proposals.js).
//
// Owner, 2026-09-17: "IF NO MATCH FOUND> make it and people can look
// products up and propose alternatives for serb products they will undergo
// a vetting process and then you decide wether 1:1 match aswell"
//
// Deliberately the same shape as src/lib/publicFeed.js, for the same reason:
// Vendorja ships as a static SPA and the API route may be absent,
// unprovisioned, switched off, or unreachable on a phone in a basement
// supermarket. Every one of those resolves to a plain status the UI renders
// honestly — never a crash, never an invented list, never a retry storm.
//
// STATUSES
//   'ok'          — talked to the route; what came back is what is there
//   'disabled'    — contributions are switched off
//   'unavailable' — no backend reachable; nobody can propose right now
//
// Once 'disabled' or 'unavailable' has been seen, this module STOPS calling
// the network for the rest of the page's life, and ProposeAlternative stops
// rendering itself. A static deployment with no API must not fire a request
// per product into a 404.
//
// ---------------------------------------------------------------------------
// THE ONE RULE THIS FILE ENFORCES ON THE READ SIDE
// ---------------------------------------------------------------------------
// The server already answers only from the accepted key. This module does
// NOT take that on trust: isVettedItem() below requires
// `origin === 'community-vetted'` and a well-formed barcode before an item
// is handed to the UI, so a mis-deployed or compromised backend still cannot
// put a stranger's unchecked claim in front of a shopper. Two independent
// checks, because one of them is somebody else's code.
//
// And an accepted proposal is NOT a curated, source-cited pairing from
// data/brand-alternatives.json. It carries `origin: 'community-vetted'` all
// the way to the screen so the UI can say where it came from, which is the
// whole difference between "a person suggested this and a human agreed" and
// "here is the document that proves it".
// ---------------------------------------------------------------------------

import { getAnonId } from './feedConsent.js';

export const PROPOSAL_OK = 'ok';
export const PROPOSAL_DISABLED = 'disabled';
export const PROPOSAL_UNAVAILABLE = 'unavailable';
export const PROPOSAL_INVALID = 'invalid';

const ENDPOINT = '/api/proposals';
const TIMEOUT_MS = 8000;

/** Same shape the server validates. */
export function isPlausibleCode(value) {
  return typeof value === 'string' && /^[0-9]{8,14}$/.test(value);
}

/**
 * BUILD-TIME HALF OF THE KILL-SWITCH. `VITE_PROPOSALS=off` (or
 * `VITE_PUBLIC_FEED=off`, the broader one) compiles the propose surface out
 * of the UI entirely. The server-side half (PROPOSALS=off, api/proposals.js)
 * is the one that can be flipped without a rebuild.
 */
export function areProposalsEnabledByBuild() {
  const read = (key) => {
    try {
      return String(import.meta.env?.[key] ?? '').trim().toLowerCase();
    } catch {
      return '';
    }
  };
  const off = (v) => v === 'off' || v === '0' || v === 'false' || v === 'disabled';
  return !(off(read('VITE_PROPOSALS')) || off(read('VITE_PUBLIC_FEED')));
}

let sessionState = null; // null = not known yet | 'disabled' | 'unavailable'

export function resetProposalState() {
  sessionState = null;
}

/** What the UI should assume before it has asked. Exported for tests. */
export function currentProposalState() {
  if (!areProposalsEnabledByBuild()) return PROPOSAL_DISABLED;
  return sessionState;
}

async function call(path, init = {}) {
  if (!areProposalsEnabledByBuild()) return { status: PROPOSAL_DISABLED };
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
      sessionState = PROPOSAL_DISABLED;
      return { status: PROPOSAL_DISABLED };
    }
    // 404/405 = no such route on this deployment. 503 = deployed but no
    // store provisioned (THE DEFAULT STATE OF THIS REPO). 502 = store down.
    // All the same to the shopper: there is nowhere to send this right now.
    if ([404, 405, 502, 503].includes(res.status)) {
      sessionState = PROPOSAL_UNAVAILABLE;
      return { status: PROPOSAL_UNAVAILABLE };
    }

    // A static host with an SPA rewrite answers 200 text/html for a route it
    // does not have. That is "no backend", not "an empty list".
    const type = res.headers.get('content-type') || '';
    if (!type.includes('application/json')) {
      sessionState = PROPOSAL_UNAVAILABLE;
      return { status: PROPOSAL_UNAVAILABLE };
    }

    const body = await res.json();
    // 400 is the server refusing THIS proposal (same brand, same product, a
    // Serbian-registered "alternative"); the backend is fine, so it must not
    // poison sessionState.
    if (res.status === 400) return { status: PROPOSAL_INVALID, body };
    if (!res.ok) return { status: PROPOSAL_OK, ok: false, body, httpStatus: res.status };
    return { status: PROPOSAL_OK, ok: true, body, httpStatus: res.status };
  } catch {
    sessionState = PROPOSAL_UNAVAILABLE;
    return { status: PROPOSAL_UNAVAILABLE };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * The read-side allow-list. An item reaches the UI only if it announces
 * itself as vetted community content about a real barcode.
 *
 * `origin === 'community-vetted'` is set by toPublicAccepted() and by
 * nothing else — a pending record has no `origin` field at all, so a backend
 * handing one over is dropped here rather than rendered.
 */
export function isVettedItem(item) {
  return Boolean(
    item &&
      typeof item === 'object' &&
      item.origin === 'community-vetted' &&
      isPlausibleCode(item.forCode) &&
      (isPlausibleCode(item.altCode) ||
        (typeof item.altBrand === 'string' && item.altBrand.length > 0)) &&
      item.status === undefined // a projection has no review status on it
  );
}

/**
 * Vetted, accepted proposals — optionally only those for one product.
 * Returns { status, items, pendingCount }. Never throws.
 */
export async function fetchAcceptedProposals({ forCode = null, limit = 20 } = {}) {
  const qs = new URLSearchParams({ limit: String(limit) });
  if (isPlausibleCode(forCode)) qs.set('for', forCode);
  const result = await call(`${ENDPOINT}?${qs.toString()}`);
  if (result.status !== PROPOSAL_OK || !result.ok) {
    return {
      status: result.status === PROPOSAL_OK ? PROPOSAL_UNAVAILABLE : result.status,
      items: [],
      pendingCount: 0,
    };
  }
  const body = result.body || {};
  const items = Array.isArray(body.items) ? body.items.filter(isVettedItem) : [];
  return { status: PROPOSAL_OK, items, pendingCount: Number(body.pendingCount) || 0 };
}

/**
 * Trim free text before it goes on the wire. The server does this again and
 * is the authority; doing it here as well means 3 KB of pasted junk never
 * leaves the phone, and the field the person sees is the field that is sent.
 */
export function trimField(value, max) {
  if (typeof value !== 'string') return null;
  // eslint-disable-next-line no-control-regex
  const cleaned = value
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028\u2029]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned ? cleaned.slice(0, max) : null;
}

/**
 * Local pre-check, so the obvious mistakes are answered instantly in the
 * form instead of by a round trip. Returns a reason key or null.
 *
 * NOT a security boundary — api/proposals.js re-checks every one of these.
 * The messages for these keys live in the dictionary as
 * proposeError_<reason>.
 */
export function precheckProposal({ forCode, forBrand, altCode, altBrand }) {
  if (!isPlausibleCode(forCode)) return 'no_product';
  const code = trimField(altCode, 20)?.replace(/\D/g, '') || '';
  const brand = trimField(altBrand, 60);
  if (code && !isPlausibleCode(code)) return 'bad_code';
  if (!code && !brand) return 'nothing_named';
  if (code && code === forCode) return 'same_product';
  if (code && gs1PrefixOf(code) === '860') return 'alternative_serbian';
  if (brand && forBrand && fold(brand) === fold(forBrand)) return 'same_brand';
  return null;
}

/**
 * The GTIN-normalising prefix read, identical to src/lib/gs1.js and to
 * api/proposals.js:gs1PrefixOf(). GTIN-14 drops its packaging indicator;
 * UPC-A gains the leading zero; GTIN-8 keeps its own first three digits.
 */
export function gs1PrefixOf(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (![8, 12, 13, 14].includes(digits.length)) return null;
  let n = digits;
  if (n.length === 14) n = n.slice(1);
  if (n.length === 12) n = `0${n}`;
  return n.slice(0, 3);
}

function fold(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

/**
 * Send one proposal. Resolves to { status, queued, reason }.
 *
 * `queued: true` means RECEIVED AND WAITING FOR A HUMAN. It never means
 * published, and the caller must not word it as though it did — nothing a
 * person submits here reaches another shopper until someone has looked at
 * it. The server answers 202 for exactly this reason.
 *
 * The anonymous id is attached only if one already exists (i.e. the person
 * granted feed consent at some point). No id is minted here: a proposal
 * does not need a device identity, and one is not created as a side effect
 * of contributing.
 */
export async function submitProposal(input) {
  if (!areProposalsEnabledByBuild()) return { status: PROPOSAL_DISABLED };

  const forCode = typeof input?.forCode === 'string' ? input.forCode : '';
  const altCode = (trimField(input?.altCode, 20) || '').replace(/\D/g, '');
  const payload = {
    forCode,
    forName: trimField(input?.forName, 80),
    forBrand: trimField(input?.forBrand, 60),
    altCode: altCode || null,
    altBrand: trimField(input?.altBrand, 60),
    altName: trimField(input?.altName, 80),
    seenAt: trimField(input?.seenAt, 60),
  };

  const bad = precheckProposal(payload);
  if (bad) return { status: PROPOSAL_INVALID, reason: bad };

  const anonId = getAnonId();
  if (anonId) payload.anonId = anonId;

  const result = await call(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (result.status === PROPOSAL_INVALID) {
    return { status: PROPOSAL_INVALID, reason: result.body?.reason || 'invalid' };
  }
  if (result.status !== PROPOSAL_OK) return { status: result.status };
  if (!result.ok) {
    return { status: PROPOSAL_UNAVAILABLE, reason: result.body?.error || 'store' };
  }
  return {
    status: PROPOSAL_OK,
    queued: result.body?.stored !== false,
    reason: result.body?.reason || null,
  };
}

/** "Delete what I proposed." Needs the anon id, so call before withdrawing. */
export async function deleteMyProposals() {
  if (!areProposalsEnabledByBuild()) return { status: PROPOSAL_DISABLED };
  const anonId = getAnonId();
  if (!anonId) return { status: PROPOSAL_OK, removed: 0, unlinked: 0 };
  const result = await call(ENDPOINT, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ anonId }),
  });
  if (result.status !== PROPOSAL_OK) return { status: result.status };
  return {
    status: PROPOSAL_OK,
    removed: Number(result.body?.removed) || 0,
    unlinked: Number(result.body?.unlinked) || 0,
  };
}
