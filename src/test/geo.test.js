import { describe, it, expect } from 'vitest';
import { haversineKm, sortStoresByDistance, mapsUrlForStore } from '../lib/geo.js';

describe('haversineKm', () => {
  it('returns ~0 for the same point', () => {
    expect(haversineKm(42.6629, 21.1655, 42.6629, 21.1655)).toBeCloseTo(0, 5);
  });

  it('returns a plausible distance between two known Kosovo cities (Pristina -> Prizren, ~70km straight-line)', () => {
    const km = haversineKm(42.6629, 21.1655, 42.2139, 20.7397);
    expect(km).toBeGreaterThan(50);
    expect(km).toBeLessThan(90);
  });
});

describe('sortStoresByDistance', () => {
  const userLoc = { lat: 42.6629, lng: 21.1655 }; // Pristina

  it('sorts stores with coordinates nearest-first', () => {
    const stores = [
      { name: 'Far', city: 'Prizren', lat: 42.2139, lng: 20.7397 },
      { name: 'Near', city: 'Pristina', lat: 42.665, lng: 21.166 },
    ];
    const sorted = sortStoresByDistance(stores, userLoc);
    expect(sorted[0].name).toBe('Near');
    expect(sorted[1].name).toBe('Far');
    expect(sorted[0].distanceKm).toBeLessThan(sorted[1].distanceKm);
  });

  it('NEVER drops stores with missing coordinates — appends them after the sorted ones instead', () => {
    const stores = [
      { name: 'No coords', city: 'Ferizaj', lat: null, lng: null },
      { name: 'Has coords', city: 'Pristina', lat: 42.665, lng: 21.166 },
    ];
    const sorted = sortStoresByDistance(stores, userLoc);
    expect(sorted).toHaveLength(2);
    expect(sorted.find((s) => s.name === 'No coords')).toBeTruthy();
    // the coordinate-less store has no distanceKm and comes after the sorted ones
    expect(sorted[sorted.length - 1].name).toBe('No coords');
    expect(sorted[sorted.length - 1].distanceKm).toBeUndefined();
  });

  it('handles an empty or non-array input without throwing', () => {
    expect(sortStoresByDistance(null, userLoc)).toEqual([]);
    expect(sortStoresByDistance([], userLoc)).toEqual([]);
  });
});

describe('mapsUrlForStore', () => {
  it('uses a precise lat/lng query when coordinates exist', () => {
    const url = mapsUrlForStore({ lat: 42.6629, lng: 21.1655 });
    expect(url).toBe('https://www.google.com/maps/search/?api=1&query=42.6629,21.1655');
  });

  it('falls back to a text-address query when coordinates are missing, never dropping the store', () => {
    const url = mapsUrlForStore({ name: 'Viva Fresh', address: 'Rr. Nena Tereze', city: 'Prishtina', lat: null, lng: null });
    expect(url).toContain('https://www.google.com/maps/search/?api=1&query=');
    expect(url).toContain(encodeURIComponent('Viva Fresh'));
  });

  it('falls back to the chain name when even name/address/city are missing', () => {
    const url = mapsUrlForStore({ chain: 'Super Viva', lat: null, lng: null });
    expect(url).toContain(encodeURIComponent('Super Viva'));
  });
});
