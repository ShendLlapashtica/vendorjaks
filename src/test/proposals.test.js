import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import handler, {
  PENDING_KEY,
  ACCEPTED_KEY,
  REJECTED_KEY,
  QUEUE_MAX,
  STATUS,
  MATCH_KINDS,
  proposalsDisabled,
  storeConfig,
  isValidCode,
  isValidAnonId,
  cleanText,
  looksLikeSpam,
  looksLikeCoordinates,
  gs1PrefixOf,
  isSerbianRegistered,
  foldForCompare,
  sanitizeProposal,
  toPublicAccepted,
} from '../../api/proposals.js';

import * as apiModule from '../../api/proposals.js';
import * as clientModule from '../lib/proposals.js';
import {
  submitProposal,
  fetchAcceptedProposals,
  resetProposalState,
  currentProposalState,
  precheckProposal,
  isVettedItem,
  PROPOSAL_OK,
  PROPOSAL_INVALID,
  PROPOSAL_UNAVAILABLE,
} from '../lib/proposals.js';

import { preflight, dossierFor, loadGs1Table, toCuratedEntry } from '../../scripts/vet-proposals.mjs';
import { classifyBarcode } from '../lib/gs1.js';
import { normalizeBoycottTable } from '../lib/boycott.js';

const ROOT = path.resolve(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

// A Serbian-registered barcode and a Kosovo-registered one, from the real
// GS1 ranges the app ships (860 = GS1 Serbia, 381 = GS1 Kosovo).
const SERBIAN = '8600000000017';
const KOSOVAR = '3810000000015';
const ALBANIAN = '5300000000019';

// The marker is what the "nothing pending escapes" test hunts for.
const MARKER = 'MARKER-PENDING-MUST-NEVER-BE-PUBLISHED';

function pendingRecord(extra = {}) {
  return {
    id: 'pend-1',
    status: STATUS.PENDING,
    forCode: SERBIAN,
    forName: 'Plazma 300g',
    forBrand: 'Bambi',
    altCode: KOSOVAR,
    altBrand: MARKER,
    altName: MARKER,
    seenAt: 'Viva Fresh, Prishtinë',
    owner: '0123456789ab',
    at: 1_700_000_000_000,
    ...extra,
  };
}

// ---------------------------------------------------------------------------
// Minimal req/res doubles for the serverless handler.
// ---------------------------------------------------------------------------

function makeRes() {
  const res = {
    statusCode: null,
    headers: {},
    body: null,
    setHeader(k, v) {
      this.headers[k] = v;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    end(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

function makeReq(method, { url = '/api/proposals', body = null } = {}) {
  return { method, url, headers: { 'x-forwarded-for': '203.0.113.9' }, body, socket: {} };
}

// ===========================================================================
// 1. NOTHING IS PUBLISHED UNTIL IT IS VETTED
//
// This is the whole point of the feature and it has to be structural, not
// conventional. Four independent proofs, because each one covers a different
// way the property could be lost.
// ===========================================================================

describe('a pending proposal can never reach a shopper', () => {
  // --- (a) the projection refuses anything that is not accepted -------------
  it('toPublicAccepted() returns null for every status except accepted', () => {
    for (const status of [STATUS.PENDING, STATUS.REJECTED, STATUS.NEEDS_INFO, undefined, null, 'ACCEPTED']) {
      expect(toPublicAccepted(pendingRecord({ status }), 'salt')).toBeNull();
    }
    const ok = toPublicAccepted(pendingRecord({ status: STATUS.ACCEPTED }), 'salt');
    expect(ok).not.toBeNull();
    expect(ok.origin).toBe('community-vetted');
  });

  // --- (b) no export of the route module can hand one over ------------------
  it('the route module exports exactly the frozen set (a new export must be reviewed here)', () => {
    expect(Object.keys(apiModule).sort()).toEqual(
      [
        'ACCEPTED_KEY',
        'MATCH_KINDS',
        'PENDING_KEY',
        'QUEUE_MAX',
        'REJECTED_KEY',
        'STATUS',
        'cleanText',
        'default',
        'foldForCompare',
        'gs1PrefixOf',
        'isSerbianRegistered',
        'isValidAnonId',
        'isValidCode',
        'looksLikeCoordinates',
        'looksLikeSpam',
        'proposalsDisabled',
        'sanitizeProposal',
        'storeConfig',
        'toPublicAccepted',
      ].sort()
    );
  });

  it('no export, given a pending proposal in any plausible shape, yields a publishable item', () => {
    const record = pendingRecord();
    const probes = [
      record,
      [record],
      { items: [record] },
      JSON.stringify(record),
      // the same content wearing the POST body's field names
      { ...record, anonId: record.owner, status: STATUS.ACCEPTED },
      MARKER,
      null,
      undefined,
    ];

    for (const [name, exported] of Object.entries(apiModule)) {
      if (typeof exported !== 'function' || name === 'default') continue;
      for (const probe of probes) {
        let result;
        try {
          result = exported(probe, 'salt');
        } catch {
          continue; // throwing is a refusal, which is fine
        }
        for (const node of walk(result)) {
          if (node && typeof node === 'object' && 'status' in node) {
            // The ONLY status any export may produce is 'pending'.
            expect(
              node.status,
              `${name}() produced status ${JSON.stringify(node.status)}`
            ).toBe(STATUS.PENDING);
          }
          // Nothing derived from a PENDING record may carry the accepted
          // projection's calling card. (The one probe that pre-marks itself
          // accepted is excluded here on purpose: a record already carrying
          // status 'accepted' in the store is publishable by design, and the
          // separate test below proves a client POST cannot mint that value.)
          const probeIsPending = probe?.status !== STATUS.ACCEPTED;
          if (probeIsPending && JSON.stringify(node ?? null).includes(MARKER)) {
            expect(node?.origin, `${name}() marked stranger text as vetted`).not.toBe(
              'community-vetted'
            );
          }
        }
      }
    }
  });

  // --- (c) sanitizeProposal is incapable of minting an accepted record ------
  it('sanitizeProposal() can only ever mint status "pending", whatever the body says', () => {
    for (const claimed of [STATUS.ACCEPTED, 'accepted', 'ACCEPTED', STATUS.REJECTED, 1, true]) {
      const parsed = sanitizeProposal({
        forCode: SERBIAN,
        altCode: KOSOVAR,
        altBrand: 'Sempre',
        status: claimed,
        match: '1:1',
        acceptedAt: Date.now(),
        origin: 'community-vetted',
      });
      expect(parsed.ok).toBe(true);
      expect(parsed.entry.status).toBe(STATUS.PENDING);
      expect(parsed.entry.match).toBeUndefined();
      expect(parsed.entry.acceptedAt).toBeUndefined();
      expect(parsed.entry.origin).toBeUndefined();
      // And the projection still refuses it.
      expect(toPublicAccepted(parsed.entry, 'salt')).toBeNull();
    }
  });

  // --- (d) the GET path does not even NAME the pending key ------------------
  it('the GET handler source never mentions the pending or rejected key', () => {
    const source = read('api/proposals.js');
    const start = source.indexOf('async function handleGet(');
    expect(start).toBeGreaterThan(-1);
    const rest = source.slice(start + 10);
    const end = rest.indexOf('\nasync function ');
    const body = end === -1 ? rest : rest.slice(0, end);
    // LLEN of the pending key is the one allowed mention: a COUNT is not
    // content. Assert it appears only inside an LLEN command and nowhere
    // else — an LRANGE over the queue would fail here.
    const mentions = body.match(/PENDING_KEY/g) || [];
    expect(mentions.length).toBe(1);
    expect(body).toContain("['LLEN', PENDING_KEY]");
    expect(body).not.toContain('REJECTED_KEY');
    expect(body).not.toMatch(/LRANGE',\s*PENDING_KEY/);
  });

  // --- (e) the client drops one even if the server hands it over ------------
  it('the client refuses a non-accepted item even when the backend returns it', async () => {
    resetProposalState();
    globalThis.fetch = vi.fn(async () =>
      jsonResponse(200, { ok: true, items: [pendingRecord(), { ...pendingRecord(), origin: undefined }] })
    );
    const result = await fetchAcceptedProposals({ forCode: SERBIAN });
    expect(result.status).toBe(PROPOSAL_OK);
    expect(result.items).toEqual([]);
  });

  it('the client accepts only a properly projected, vetted item', () => {
    expect(
      isVettedItem({ origin: 'community-vetted', forCode: SERBIAN, altCode: KOSOVAR })
    ).toBe(true);
    // a raw stored record, even one marked accepted, is not a projection
    expect(isVettedItem({ ...pendingRecord(), status: STATUS.ACCEPTED })).toBe(false);
    expect(isVettedItem({ origin: 'curated', forCode: SERBIAN, altCode: KOSOVAR })).toBe(false);
  });
});

/** Depth-first walk of anything, yielding every node. */
function* walk(value, depth = 0) {
  if (depth > 6) return;
  yield value;
  if (Array.isArray(value)) {
    for (const v of value) yield* walk(v, depth + 1);
  } else if (value && typeof value === 'object') {
    for (const v of Object.values(value)) yield* walk(v, depth + 1);
  }
}

function jsonResponse(status, body, type = 'application/json') {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: () => type },
    json: async () => body,
  };
}

// ===========================================================================
// 2. THE 503 DEGRADATION — the DEFAULT state of this repo
// ===========================================================================

describe('no backend configured', () => {
  const saved = {};
  const VARS = [
    'KV_REST_API_URL',
    'KV_REST_API_TOKEN',
    'UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN',
    'PROPOSALS',
    'PUBLIC_FEED',
  ];

  beforeEach(() => {
    for (const k of VARS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    for (const k of VARS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('storeConfig() is null with neither env var pair set', () => {
    expect(storeConfig({})).toBeNull();
    expect(storeConfig({ KV_REST_API_URL: 'https://x' })).toBeNull();
    expect(storeConfig({ KV_REST_API_URL: 'https://x/', KV_REST_API_TOKEN: 't' })).toEqual({
      url: 'https://x',
      token: 't',
    });
  });

  it('every method answers 503 not_provisioned, and no request is attempted', async () => {
    const spy = vi.fn();
    globalThis.fetch = spy;
    for (const method of ['GET', 'POST', 'DELETE']) {
      const res = makeRes();
      await handler(makeReq(method, { body: { forCode: SERBIAN, altBrand: 'Sempre' } }), res);
      expect(res.statusCode).toBe(503);
      expect(JSON.parse(res.body)).toEqual({ ok: false, enabled: true, error: 'not_provisioned' });
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it('the kill-switch answers 410 before anything else', async () => {
    process.env.PROPOSALS = 'off';
    expect(proposalsDisabled(process.env)).toBe(true);
    const res = makeRes();
    await handler(makeReq('GET'), res);
    expect(res.statusCode).toBe(410);
    // PUBLIC_FEED=off is the broader switch and turns proposals off too.
    delete process.env.PROPOSALS;
    process.env.PUBLIC_FEED = 'disabled';
    expect(proposalsDisabled(process.env)).toBe(true);
  });

  it('the client degrades to "unavailable" on 503 and then stops calling the network', async () => {
    resetProposalState();
    const spy = vi.fn(async () => jsonResponse(503, { error: 'not_provisioned' }));
    globalThis.fetch = spy;

    const first = await submitProposal({ forCode: SERBIAN, altBrand: 'Sempre' });
    expect(first.status).toBe(PROPOSAL_UNAVAILABLE);
    expect(spy).toHaveBeenCalledTimes(1);

    const second = await submitProposal({ forCode: SERBIAN, altBrand: 'Liri' });
    const third = await fetchAcceptedProposals({ forCode: SERBIAN });
    expect(second.status).toBe(PROPOSAL_UNAVAILABLE);
    expect(third.status).toBe(PROPOSAL_UNAVAILABLE);
    expect(third.items).toEqual([]);
    expect(spy).toHaveBeenCalledTimes(1); // still one: no retry storm
    expect(currentProposalState()).toBe(PROPOSAL_UNAVAILABLE);
  });

  it('a static host answering 200 text/html is "no backend", not an empty list', async () => {
    resetProposalState();
    globalThis.fetch = vi.fn(async () => jsonResponse(200, {}, 'text/html; charset=utf-8'));
    const result = await fetchAcceptedProposals({});
    expect(result.status).toBe(PROPOSAL_UNAVAILABLE);
    expect(result.items).toEqual([]);
  });

  it('a 400 does NOT poison the session state — the backend is fine, the proposal is not', async () => {
    resetProposalState();
    globalThis.fetch = vi.fn(async () =>
      jsonResponse(400, { ok: false, error: 'invalid', reason: 'same_brand' })
    );
    const result = await submitProposal({
      forCode: SERBIAN,
      forBrand: 'Bambi',
      altBrand: 'Jaffa',
    });
    expect(result.status).toBe(PROPOSAL_INVALID);
    expect(currentProposalState()).toBeNull();
  });
});

// ===========================================================================
// 3. ABUSE — the obvious poisonings, refused at intake
// ===========================================================================

describe('intake refuses the proposals that are nonsense on their face', () => {
  it('refuses a product proposed as its own alternative', () => {
    const r = sanitizeProposal({ forCode: SERBIAN, altCode: SERBIAN, altBrand: 'Bambi x' });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('same_product');
    expect(precheckProposal({ forCode: SERBIAN, altCode: SERBIAN })).toBe('same_product');
  });

  it('refuses the same brand on both sides, diacritics and punctuation folded', () => {
    for (const altBrand of ['Bambi', 'bambi', 'BAMBI', 'B a m b i', 'Bâmbi']) {
      const r = sanitizeProposal({ forCode: SERBIAN, forBrand: 'Bambi', altBrand });
      expect(r.ok, altBrand).toBe(false);
      expect(r.reason).toBe('same_brand');
    }
  });

  it('refuses an "alternative" that is itself registered with GS1 Serbia', () => {
    const r = sanitizeProposal({ forCode: '3870000000012', altCode: SERBIAN, altBrand: 'Zvezda' });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('alternative_serbian');
    expect(precheckProposal({ forCode: '3870000000012', altCode: SERBIAN })).toBe(
      'alternative_serbian'
    );
  });

  it('refuses a proposal that names nothing at all', () => {
    expect(sanitizeProposal({ forCode: SERBIAN }).reason).toBe('nothing_named');
    expect(sanitizeProposal({ forCode: SERBIAN, altName: 'a nice biscuit' }).reason).toBe(
      'nothing_named'
    );
  });

  it('refuses a malformed or absent target product', () => {
    for (const forCode of ['', '123', 'VIVA000003663', null, 12345678, '1'.repeat(40)]) {
      expect(sanitizeProposal({ forCode, altBrand: 'Sempre' }).ok).toBe(false);
    }
  });

  it('accepts a good proposal and stores it pending', () => {
    const r = sanitizeProposal({
      forCode: SERBIAN,
      forName: 'Plazma 300g',
      forBrand: 'Bambi',
      altCode: KOSOVAR,
      altBrand: 'Sempre',
      altName: 'Sempre biskota 150g',
      seenAt: 'Viva Fresh, Prishtinë',
      anonId: '0123456789ab',
    });
    expect(r.ok).toBe(true);
    expect(r.entry.status).toBe(STATUS.PENDING);
    expect(r.entry.altBrand).toBe('Sempre');
    expect(r.entry.owner).toBe('0123456789ab');
    expect(typeof r.entry.id).toBe('string');
  });

  it('the queue cap REFUSES rather than trimming, so a flood cannot evict honest proposals', () => {
    const source = read('api/proposals.js');
    expect(source).toMatch(/queueLen\) >= QUEUE_MAX/);
    expect(source).toContain("error: 'queue_full'");
    // LTRIM on the pending key would be the eviction bug this guards.
    expect(source).not.toMatch(/LTRIM',\s*PENDING_KEY/);
    expect(QUEUE_MAX).toBeGreaterThan(0);
  });
});

// ===========================================================================
// 4. FREE TEXT IS NEITHER EXECUTED NOR RENDERED RAW
// ===========================================================================

describe('free text', () => {
  const PAYLOADS = [
    '<img src=x onerror=alert(1)>',
    '<script>alert(1)</script>',
    'javascript:alert(1)',
    '"><svg/onload=alert(1)>',
    'buy now at http://spam.xyz',
    'www.spam.rs',
    'mail me at a@b.com',
    'data:text/html;base64,PHNjcmlwdD4=',
  ];

  it('every markup / link / scheme payload loses the field rather than being stored', () => {
    for (const payload of PAYLOADS) {
      expect(looksLikeSpam(payload), payload).toBe(true);
      const r = sanitizeProposal({ forCode: SERBIAN, altCode: KOSOVAR, altName: payload });
      expect(r.ok).toBe(true);
      expect(r.entry.altName, payload).toBeNull();
      expect(JSON.stringify(r.entry)).not.toContain('<');
      expect(JSON.stringify(r.entry)).not.toContain('script');
    }
  });

  it('a payload as the ONLY thing named is a refusal, not a blank proposal', () => {
    const r = sanitizeProposal({ forCode: SERBIAN, altBrand: '<script>x</script>' });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('nothing_named');
  });

  it('control characters, zero-width tricks and unbounded length are stripped or capped', () => {
    expect(cleanText('a\u0000\u200bb\nc', 80)).toBe('a b c');
    expect(cleanText('x'.repeat(5000), 60)).toHaveLength(60);
    expect(cleanText('   ', 80)).toBeNull();
    expect(cleanText(42, 80)).toBeNull();
    const r = sanitizeProposal({ forCode: SERBIAN, altBrand: 'S'.repeat(500) });
    expect(r.entry.altBrand).toHaveLength(60);
  });

  it('no propose or read surface renders user text as HTML', () => {
    for (const file of [
      'src/components/ProposeAlternative.jsx',
      'src/lib/proposals.js',
      'api/proposals.js',
    ]) {
      const source = read(file);
      expect(source, file).not.toMatch(/dangerouslySetInnerHTML/);
      expect(source, file).not.toMatch(/\.innerHTML\s*=/);
      expect(source, file).not.toMatch(/\bdocument\.write\b/);
      expect(source, file).not.toMatch(/\beval\s*\(/);
      expect(source, file).not.toMatch(/new Function\s*\(/);
    }
  });

  it('the form is not deleted under the finger of the person using it', () => {
    // REGRESSION, measured in a browser 2026-09-17: the component read
    // currentProposalState() on every render, so the first submit against a
    // deployment with no store flipped the module's session state and the
    // whole panel unmounted on the next render — the form vanished silently
    // the instant the button was pressed, with nothing said to the person
    // who had just typed into it. Reading it ONCE, in a useState
    // initialiser, is what keeps "never offer a control that cannot work"
    // from becoming "delete the control mid-use".
    const source = read('src/components/ProposeAlternative.jsx');
    expect(source).toContain('useState(() => currentProposalState())');
    expect(source).not.toMatch(/^\s*const state = currentProposalState\(\);/m);
    const code = source
      .split('\n')
      .filter((l) => !l.trim().startsWith('//'))
      .join('\n');
    expect((code.match(/currentProposalState\(\)/g) || []).length).toBe(1);
  });

  it('the component renders every proposal field through React text/value, never a template', () => {
    const source = read('src/components/ProposeAlternative.jsx');
    // Each input is a controlled React input: value={values.X}. No field is
    // ever interpolated into markup.
    for (const field of ['altCode', 'altBrand', 'altName', 'seenAt']) {
      expect(source).toContain(`value={values.${field}}`);
    }
  });
});

// ===========================================================================
// 5. PRIVACY — what is stored, and what is never published
// ===========================================================================

describe('privacy', () => {
  it('a precise location never survives intake', () => {
    expect(looksLikeCoordinates('42.66278, 21.16556')).toBe(true);
    const r = sanitizeProposal({
      forCode: SERBIAN,
      altCode: KOSOVAR,
      seenAt: '42.66278, 21.16556',
    });
    expect(r.entry.seenAt).toBeNull();
    // A shop name is fine — it is a lead for the reviewer.
    expect(
      sanitizeProposal({ forCode: SERBIAN, altCode: KOSOVAR, seenAt: 'Viva Fresh, Prishtinë' }).entry
        .seenAt
    ).toBe('Viva Fresh, Prishtinë');
  });

  it('the public projection publishes an allow-list and neither owner nor seenAt', () => {
    const accepted = pendingRecord({
      status: STATUS.ACCEPTED,
      altBrand: 'Sempre',
      altName: 'Sempre biskota',
      match: '1:1',
      acceptedAt: 1_700_000_100_000,
      reviewNote: 'checked the Liri site',
      reviewFlags: ['HEARSAY'],
      decidedBy: 'shend',
    });
    const pub = toPublicAccepted(accepted, '2026-09:salt');
    expect(Object.keys(pub).sort()).toEqual(
      ['acceptedAt', 'altBrand', 'altCode', 'altName', 'at', 'by', 'forCode', 'id', 'match', 'origin', 'sourceUrl'].sort()
    );
    expect(pub.seenAt).toBeUndefined();
    expect(pub.owner).toBeUndefined();
    expect(pub.reviewNote).toBeUndefined();
    expect(pub.decidedBy).toBeUndefined();
    expect(JSON.stringify(pub)).not.toContain('0123456789ab');
  });

  it('`by` is a short, one-way, monthly-rotating hash of the owner id', () => {
    const rec = pendingRecord({ status: STATUS.ACCEPTED });
    const sept = toPublicAccepted(rec, '2026-09:salt').by;
    const oct = toPublicAccepted(rec, '2026-10:salt').by;
    expect(sept).toMatch(/^[0-9a-f]{6}$/);
    expect(sept).not.toBe(oct);
    expect(toPublicAccepted({ ...rec, owner: null }, '2026-09:salt').by).toBeNull();
  });

  it('the route never puts an IP, user agent or referrer on a record', () => {
    const source = read('api/proposals.js');
    // The only use of the client IP is as an ingredient of a hashed KEY NAME.
    const ipUses = source.match(/sha\(`\$\{clientIp\(req\)\}/g) || [];
    expect(ipUses.length).toBe(2); // handlePost + handleDelete rate limits
    // ...and the ONLY other mention is the helper's own declaration.
    expect((source.match(/clientIp\(req\)/g) || []).length).toBe(3);
    expect(source).toMatch(/sha\(`\$\{clientIp\(req\)\}:\$\{salt\(\)\}`\)/);
    expect(source).not.toMatch(/user-agent/i);
    expect(source).not.toMatch(/\breferer\b|\breferrer\b/i);
    const entry = sanitizeProposal({ forCode: SERBIAN, altCode: KOSOVAR, altBrand: 'Sempre' }).entry;
    expect(Object.keys(entry).sort()).toEqual(
      ['altBrand', 'altCode', 'altName', 'at', 'forBrand', 'forCode', 'forName', 'id', 'owner', 'seenAt', 'status'].sort()
    );
  });

  it('an anonymous proposal is accepted — no device id is minted to contribute', () => {
    const r = sanitizeProposal({ forCode: SERBIAN, altCode: KOSOVAR, altBrand: 'Sempre' });
    expect(r.ok).toBe(true);
    expect(r.entry.owner).toBeNull();
    expect(isValidAnonId('0123456789ab')).toBe(true);
    expect(isValidAnonId('nope')).toBe(false);
  });
});

// ===========================================================================
// 6. THE PREFIX READ AGREES WITH THE APP'S OWN CLASSIFIER
//
// api/proposals.js re-implements the GTIN normalisation because it is
// serverless code and src/lib/gs1.js is browser code. Two copies of a rule
// is two chances to disagree, so this test is the rule.
// ===========================================================================

describe('gs1PrefixOf agrees with src/lib/gs1.js', () => {
  const table = loadGs1Table();

  it('matches classifyBarcode() on every GTIN length', () => {
    const codes = [
      SERBIAN, // 13, Serbia
      KOSOVAR, // 13, Kosovo
      ALBANIAN, // 13, Albania
      '03902208390266', // 14, Finnesa flour -> 390 Kosovo (the indicator-digit bug)
      '012345678905', // 12, UPC-A -> 001 US
      '80123457', // 8, EAN-8 -> 801 Italy
    ];
    for (const code of codes) {
      const fromApp = classifyBarcode(code, table);
      expect(gs1PrefixOf(code), code).toBe(fromApp.prefix);
      expect(isSerbianRegistered(code), code).toBe(fromApp.isSerbiaPrefix);
    }
  });

  it('a shelf SKU is not a barcode, in both copies', () => {
    for (const junk of ['VIVA000003663', 'PLU-601', '', '123', null]) {
      expect(gs1PrefixOf(junk)).toBeNull();
      expect(isSerbianRegistered(junk)).toBe(false);
    }
  });

  it('isValidCode and foldForCompare behave as the client expects', () => {
    expect(isValidCode(SERBIAN)).toBe(true);
    expect(isValidCode('86000')).toBe(false);
    expect(foldForCompare('Bâmbi a.d.')).toBe(foldForCompare('BAMBI AD'));
  });
});

// ===========================================================================
// 7. THE VETTING TOOL'S PRE-FLIGHT
// ===========================================================================

describe('scripts/vet-proposals.mjs pre-flight', () => {
  const ctx = {
    gs1Table: loadGs1Table(),
    boycott: normalizeBoycottTable(
      JSON.parse(read('data/boycott-brands.json'))
    ),
    // The 66 MB catalogue is not loaded in the suite; a two-row stand-in
    // exercises the same code paths.
    retail: new Map([
      [
        KOSOVAR,
        {
          name: 'SEMPRE BISKOTA 150G',
          brand: 'Sempre',
          category: 'BISKOTA',
          price: 0.55,
          currency: 'EUR',
          isLocalBrand: true,
          localEvidence: 'Liri, Prizren — named as a domestic producer',
          url: 'https://liriprizren.com/',
          source: 'super-viva.com',
        },
      ],
      [
        SERBIAN,
        {
          name: 'PLAZMA 300G',
          brand: 'Bambi',
          category: 'BISKOTA',
          isLocalBrand: false,
          source: 'super-viva.com',
        },
      ],
      [
        ALBANIAN,
        {
          name: 'QUMESHT 1L',
          brand: 'Lufra',
          category: 'QUMESHT',
          isLocalBrand: null,
          source: 'super-viva.com',
        },
      ],
    ]),
  };

  const flagsFor = (proposal) => {
    const f = dossierFor({ code: proposal.forCode, brand: proposal.forBrand }, ctx);
    const a = dossierFor({ code: proposal.altCode, brand: proposal.altBrand }, ctx);
    return { flags: preflight(proposal, f, a).map((x) => x.tag), f, a };
  };

  it('flags a self-referential proposal', () => {
    expect(flagsFor({ forCode: SERBIAN, altCode: SERBIAN }).flags).toContain('SELF');
    expect(
      flagsFor({ forCode: SERBIAN, forBrand: 'Bambi', altBrand: 'bambi' }).flags
    ).toContain('SELF');
  });

  it('flags a Serbian-registered "alternative"', () => {
    expect(flagsFor({ forCode: '3870000000012', altCode: SERBIAN }).flags).toContain('SERBIAN');
  });

  it('flags a boycott-listed alternative by brand', () => {
    // Taken from the shipped table rather than invented.
    const listed = normalizeBoycottTable(JSON.parse(read('data/boycott-brands.json'))).brands[0];
    expect(listed).toBeTruthy();
    expect(flagsFor({ forCode: SERBIAN, altBrand: listed.brand }).flags).toContain('BOYCOTT');
  });

  it('flags a family mismatch — milk is not an alternative to a biscuit', () => {
    const { flags } = flagsFor({ forCode: SERBIAN, altCode: ALBANIAN });
    expect(flags).toContain('FAMILY');
  });

  it('does NOT flag a family match', () => {
    expect(flagsFor({ forCode: SERBIAN, altCode: KOSOVAR }).flags).not.toContain('FAMILY');
  });

  it('flags an alternative the catalogue has never heard of', () => {
    expect(flagsFor({ forCode: SERBIAN, altCode: '4006034103355' }).flags).toContain('UNKNOWN');
  });

  it('treats isLocalBrand null AND false as "not proven local"', () => {
    // null
    const a = dossierFor({ code: ALBANIAN }, ctx);
    expect(a.localClaim).toBe('unknown');
    expect(preflight({ forCode: SERBIAN, altCode: ALBANIAN }, dossierFor({ code: SERBIAN }, ctx), a).map((x) => x.tag)).toContain(
      'NOT-LOCAL'
    );
    // true
    expect(dossierFor({ code: KOSOVAR }, ctx).localClaim).toBe('proven-local');
  });

  it('flags "I saw it in a shop" as hearsay about origin, not evidence', () => {
    const { flags } = flagsFor({
      forCode: SERBIAN,
      altCode: KOSOVAR,
      seenAt: 'Viva Fresh, Prishtinë',
    });
    expect(flags).toContain('HEARSAY');
  });

  it('nothing in the pre-flight decides — it only returns reasons', () => {
    const source = read('scripts/vet-proposals.mjs');
    const start = source.indexOf('function preflight(');
    const body = source.slice(start, source.indexOf('\n// ---', start));
    expect(body).not.toContain(STATUS.REJECTED);
    expect(body).not.toContain(STATUS.ACCEPTED);
  });

  it('an accepted pairing is marked community-proposed, and claims no origin it cannot prove', () => {
    const proposal = { id: 'p1', forCode: SERBIAN, forBrand: 'Bambi', altCode: ALBANIAN, altBrand: 'Lufra', at: 1 };
    const entry = toCuratedEntry(
      proposal,
      dossierFor({ code: SERBIAN, brand: 'Bambi' }, ctx),
      dossierFor({ code: ALBANIAN, brand: 'Lufra' }, ctx),
      { match: '1:1', note: 'ok', sourceUrl: null, flags: [] }
    );
    expect(entry.alternatives[0].pairingEvidence).toBe('community-proposal-vetted');
    // isLocalBrand was null, so no country is asserted.
    expect(entry.alternatives[0].country).toBeNull();
    expect(entry.alternatives[0].evidence).toMatch(/NOT established/);
    expect(entry.proposal.match).toBe('1:1');
    expect(MATCH_KINDS.has(entry.proposal.match)).toBe(true);

    const proven = toCuratedEntry(
      { ...proposal, altCode: KOSOVAR, altBrand: 'Sempre' },
      dossierFor({ code: SERBIAN, brand: 'Bambi' }, ctx),
      dossierFor({ code: KOSOVAR, brand: 'Sempre' }, ctx),
      { match: 'similar', note: null, sourceUrl: null, flags: [] }
    );
    expect(proven.alternatives[0].country).toBe('kosovo');
  });

  it('the tool writes its own file and never writes brand-alternatives.json', () => {
    const source = read('scripts/vet-proposals.mjs');
    expect(source).toContain("'proposed-alternatives.json'");
    // data/brand-alternatives.json is curated by hand. The tool may NAME it in a
    // comment (it has to, to explain the merge) but must never open it for
    // writing, and must have exactly one output path.
    const writes = source.match(/writeFileSync\(([^,]+),/g) || [];
    expect(writes).toEqual(['writeFileSync(OUT_FILE,']);
    expect(source).toMatch(/OUT_FILE = path\.join\(ROOT, 'data', 'proposed-alternatives\.json'\)/);
    expect(source).not.toMatch(/writeFileSync\([^)]*brand-alternatives/);
  });
});

// ===========================================================================
// 8. THE THREE KEYS ARE DISTINCT — the separation is the safety property
// ===========================================================================

describe('key separation', () => {
  it('pending, accepted and rejected are three different keys', () => {
    expect(new Set([PENDING_KEY, ACCEPTED_KEY, REJECTED_KEY]).size).toBe(3);
  });

  it('the accepted key is written only by the vetting script, never by the route', () => {
    const route = read('api/proposals.js');
    // handlePost may not touch the accepted key at all.
    const start = route.indexOf('async function handlePost(');
    const body = route.slice(start, route.indexOf('\n/**', start));
    expect(body).not.toContain('ACCEPTED_KEY');
    expect(body).toContain("['LPUSH', PENDING_KEY,");
  });
});

// ===========================================================================
// 9. EVERY STRING THE COMPONENT ASKS FOR EXISTS IN BOTH LANGUAGES
// ===========================================================================

describe('i18n', () => {
  it('every t() key used by ProposeAlternative.jsx is defined in sq and en', async () => {
    const { dictionary } = await import('../i18n/dictionary.js');
    const source = read('src/components/ProposeAlternative.jsx');
    const keys = new Set();
    for (const m of source.matchAll(/t\('([A-Za-z0-9_]+)'\)/g)) keys.add(m[1]);
    // the dynamic error key, enumerated from the reasons that can be set
    for (const reason of [
      'no_product',
      'bad_code',
      'nothing_named',
      'same_product',
      'same_brand',
      'alternative_serbian',
      'invalid',
      'unavailable',
      'store',
      'rate_limited',
      'queue_full',
    ]) {
      keys.add(`proposeError_${reason}`);
    }
    expect(keys.size).toBeGreaterThan(15);
    for (const key of keys) {
      expect(dictionary.sq[key], `sq.${key}`).toBeTypeOf('string');
      expect(dictionary.en[key], `en.${key}`).toBeTypeOf('string');
    }
  });
});
