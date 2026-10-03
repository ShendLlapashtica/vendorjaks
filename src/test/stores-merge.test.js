import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseRow, decodePlusCode, metresBetween } from '../../scripts/merge-stores.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(resolve(HERE, '../../data/kosovo-stores.json'), 'utf8'));
const stores = data.stores;
const pasted = stores.filter((s) => s.ratingSource === 'google-maps-owner-paste');

/**
 * These tests guard the merge of the owner's 2026-09-16 Google Maps paste
 * into the 1,200-row OSM store file. Every one of them encodes a way the
 * merge could quietly lie to a shopper.
 */
describe('owner-paste merge — the data that landed', () => {
  it('touched 36 of the 39 pasted rows and added only 10 records', () => {
    expect(pasted).toHaveLength(36);
    expect(stores.filter((s) => s.source === 'google-maps-owner-paste')).toHaveLength(10);
    expect(stores).toHaveLength(data.count);
  });

  it('creates NO duplicate: a row that enriched an existing record is not also added', () => {
    // Every added record must be the only record with that ownerPasteName.
    const added = stores.filter((s) => s.source === 'google-maps-owner-paste');
    for (const rec of added) {
      const sameName = pasted.filter((s) => s.ownerPasteName === rec.ownerPasteName);
      const enrichedExisting = sameName.filter((s) => s.source !== 'google-maps-owner-paste');
      expect(
        enrichedExisting,
        `"${rec.ownerPasteName}" was added as a new record AND enriched an existing one`
      ).toHaveLength(0);
    }
  });

  it('never attaches one pasted row to two records', () => {
    const seen = new Map();
    for (const s of pasted) {
      const key = s.ownerPasteRaw;
      seen.set(key, (seen.get(key) || 0) + 1);
      expect(seen.get(key), `row used twice: ${key}`).toBe(1);
    }
  });

  it('keeps the four Meridian Express branches as four separate records', () => {
    const meridian = pasted.filter((s) => s.ownerPasteName === 'Meridian Express');
    expect(meridian).toHaveLength(4);
    const addresses = new Set(meridian.map((s) => s.address));
    expect(addresses.size).toBe(4);
  });

  it('keeps the four SPAR rows on four separate branches', () => {
    const spar = pasted.filter((s) => /^(spar|spar supermarket|spar kosova)$/i.test(s.ownerPasteName || ''));
    expect(spar).toHaveLength(4);
    expect(new Set(spar.map((s) => s.address)).size).toBe(4);
  });

  it('keeps the two Viva Fresh rows as two records with different coordinates', () => {
    const viva = pasted.filter((s) => s.ownerPasteName === 'Viva Fresh Store');
    expect(viva).toHaveLength(2);
    expect(metresBetween(viva[0], viva[1])).toBeGreaterThan(1000);
  });
});

describe('owner-paste merge — the things it must never invent', () => {
  it('records "No reviews" as null, never 0', () => {
    const noReview = pasted.filter((s) => /Maxi Supermarket (10|12)$/.test(s.ownerPasteName || ''));
    expect(noReview).toHaveLength(2);
    for (const s of noReview) {
      expect(s.rating).toBeNull();
      expect(s.reviewCount).toBeNull();
      expect(s.rating).not.toBe(0);
    }
  });

  it('marks "2.6K" / "3.5K" review counts as approximations', () => {
    const approx = pasted.filter((s) => s.reviewCountApprox);
    expect(approx.length).toBeGreaterThanOrEqual(2);
    for (const s of approx) expect(s.reviewCount % 100).toBe(0);
  });

  it('never invents a sourceUrl for a pasted record', () => {
    for (const s of stores.filter((x) => x.source === 'google-maps-owner-paste')) {
      expect(s.sourceUrl ?? null).toBeNull();
    }
  });

  it('tags every pasted contribution with its source and the date', () => {
    for (const s of pasted) {
      expect(s.ratingSource).toBe('google-maps-owner-paste');
      expect(s.ownerPasteCapturedAt).toBe('2026-09-16');
      expect(Array.isArray(s.ownerPasteFields)).toBe(true);
      expect(s.ownerPasteRaw).toBeTruthy();
    }
  });

  it('never writes a transient "Closed" snapshot into hours', () => {
    // Scoped to the records the paste touched: OSM's own syntax legitimately
    // contains "PH closed" (closed on public holidays), which is a schedule,
    // not a snapshot.
    for (const s of pasted) {
      expect(String(s.hours ?? '')).not.toMatch(/closed/i);
    }
    // A partial snapshot lives in opensAt/closesAt and is flagged as partial.
    const partial = pasted.filter((s) => s.opensAt || s.closesAt);
    expect(partial.length).toBeGreaterThan(0);
    for (const s of partial) expect(s.hoursPartial).toBe(true);
  });

  it('only writes hours for rows that gave a complete schedule ("Open 24 hours")', () => {
    const wrote24 = pasted.filter((s) => (s.ownerPasteFields || []).includes('hours'));
    for (const s of wrote24) {
      expect(s.hours).toBe('24/7');
      expect(s.ownerPasteRaw).toMatch(/Open 24 hours/);
    }
  });

  it('keeps the +381 Serbian phone verbatim, unflagged as dialable, uncorrected', () => {
    const albi = pasted.find((s) => (s.phoneRaw || '').startsWith('+381'));
    expect(albi, 'the +381 row should be in the data').toBeTruthy();
    expect(albi.phoneRaw).toBe('+381 38 500202100');
    expect(albi.phone ?? null).toBeNull(); // never rendered as a tel: link
    expect(albi.phoneFlag).toMatch(/SERBIAN|\+381/i);
  });

  it('flags the malformed +383 number instead of trimming it to fit', () => {
    // This row (Spar, "Pristina, Kosovo") is also unresolvable to a branch,
    // so the flag has to survive in the unresolved list rather than on a
    // store record.
    const bad = data.ownerPasteUnresolved.find((u) => (u.phoneRaw || '').includes('349990137'));
    expect(bad, 'the malformed-phone row should be recorded somewhere').toBeTruthy();
    expect(bad.phoneFlag).toMatch(/malformed/i);
    // and the malformed number never became a dialable phone on any record
    expect(stores.some((s) => String(s.phone || '').includes('349990137'))).toBe(false);
    expect(parseRow(bad.raw, 1).phone).toBeNull();
  });

  it('parks ambiguous rows instead of guessing a branch', () => {
    expect(Array.isArray(data.ownerPasteUnresolved)).toBe(true);
    expect(data.ownerPasteUnresolved.length).toBeGreaterThan(0);
    for (const u of data.ownerPasteUnresolved) {
      expect(u.raw).toBeTruthy();
      expect(u.reason).toBeTruthy();
      // and the row genuinely did not end up in the store list
      expect(pasted.some((s) => s.ownerPasteRaw === u.raw)).toBe(false);
    }
  });
});

describe('plus codes', () => {
  it('decodes a Prishtina short code onto the store it belongs to (Kipper, within 20 m)', () => {
    const got = decodePlusCode('M53M+F7G');
    expect(got.lat).toBeCloseTo(42.6537, 3);
    expect(got.lng).toBeCloseTo(21.1832, 3);
    const kipper = stores.find((s) => s.chain === 'Kipper Market' && s.city === 'Prishtinë' && s.lat);
    expect(metresBetween(got, kipper)).toBeLessThan(20);
  });

  it('decodes every plus code in the paste to somewhere inside Kosovo', () => {
    for (const code of ['M53M+F7G', 'J5H2+WM', 'M544+3QF', 'M55H+M87', 'M44W+QG6', 'M598+F4Q', 'M52C+XHF', 'M44W+PQQ', 'M44W+FHV']) {
      const got = decodePlusCode(code);
      expect(got.lat, `${code} failed to decode`).not.toBeNull();
      expect(got.lat).toBeGreaterThan(41.85);
      expect(got.lat).toBeLessThan(43.27);
      expect(got.lng).toBeGreaterThan(20.01);
      expect(got.lng).toBeLessThan(21.8);
    }
  });

  it('REFUSES a code it cannot verify rather than pinning a store to the wrong place', () => {
    // A well-formed code that recovers to the far side of the planet from the
    // Prishtina reference, and assorted junk.
    for (const bad of ['XXXX+YY', '8FVC+2X', 'M53M', 'not a code', '', null]) {
      const got = decodePlusCode(bad);
      expect(got.lat, `${bad} should not have produced a coordinate`).toBeNull();
      expect(got.lng).toBeNull();
      expect(got.method).toBe('refused');
    }
  });

  it('leaves lat/lng null on any record whose code was refused', () => {
    for (const s of stores) {
      if (s.plusCodeUnresolved) {
        expect(s.lat).toBeNull();
        expect(s.lng).toBeNull();
      }
    }
  });

  it('records how a coordinate was obtained whenever it came from a plus code', () => {
    for (const s of stores.filter((x) => x.coordsSource)) {
      expect(s.coordsSource).toMatch(/google-maps-owner-paste/);
      expect(s.coordsSource).toMatch(/short code/);
      expect(s.lat).not.toBeNull();
    }
  });
});

describe('parseRow', () => {
  it('discards the transient status and keeps the opening time', () => {
    const row = parseRow(
      'Meridian Express — 4.3 (71) · Supermarket · Rr Nazim Gafurri · +383 49 731 953 · Closed · Opens 7 AM · "Great selection of goods"',
      1
    );
    expect(row.rating).toBe(4.3);
    expect(row.reviewCount).toBe(71);
    expect(row.opensAt).toBe('07:00');
    expect(row.hours).toBeNull();
    expect(row.reviewQuote).toBe('Great selection of goods');
  });

  it('reads "Open 24 hours" as a real schedule', () => {
    const row = parseRow('Spar — 3.7 (3) · Supermarket · Rruga B · +383 49 990 147 · Open 24 hours · In-store shopping · Kerbside pickup', 2);
    expect(row.hours).toBe('24/7');
    expect(row.services).toContain('In-store shopping');
  });

  it('does not promote a reviewer’s belief into a schedule', () => {
    const row = parseRow('Toni Market — 4.2 (49) · Supermarket · Rrugë Haxhi Zeka · Open · Closes 2 AM · "I believe the store is open 24/7"', 2);
    expect(row.hours).toBeNull(); // the review says 24/7; a customer's guess is not a schedule
    expect(row.closesAt).toBe('02:00');
    expect(row.reviewQuote).toMatch(/24\/7/);
  });

  it('types malls and department stores as not selling groceries', () => {
    expect(parseRow('Prishtina Mall — 4.6 (2.6K) · Shopping mall · M2 (Prishtine - Ferizaj) · +383 38 707 072 · Closed · Opens 9 AM', 1).sellsGroceries).toBe(false);
    expect(parseRow('Jumbo Central Park — 4.4 (294) · Department store · Ali Hadri · +383 48 999 016 · Closed · Opens 9 AM', 1).sellsGroceries).toBe(false);
    expect(parseRow('KAM — 4.3 (27) · Discount supermarket · Lidhja e Prizrenit · Closed · Opens 8 AM', 1).sellsGroceries).toBe(true);
  });
});

describe('data hygiene (scripts/clean-stores.mjs)', () => {
  it('leaves no record whose chain or name is a placeholder like "."', () => {
    const junk = stores.filter((s) => ['.', '..', '-', '?'].includes(String(s.chain ?? '').trim()) || ['.', '..', '-', '?'].includes(String(s.name ?? '').trim()));
    expect(junk).toHaveLength(0);
  });

  it('leaves no name or chain wrapped in quote characters', () => {
    const wrapped = stores.filter((s) =>
      ['chain', 'name'].some((f) => typeof s[f] === 'string' && /^["“‘«].*["”’»]$/.test(s[f].trim()))
    );
    expect(wrapped).toHaveLength(0);
  });

  it('gives every record a chain and a name to display', () => {
    for (const s of stores) {
      expect(String(s.chain || '').trim()).not.toBe('');
      expect(String(s.name || '').trim()).not.toBe('');
    }
  });
});
