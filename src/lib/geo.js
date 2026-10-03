// Geolocation + distance helpers for "where to buy nearby".
//
// Geolocation is ONLY ever requested from a direct user tap (see
// ProductDetailScreen's "find nearest to me" button) — never automatically
// on load, per the pivot brief. Every failure mode (permission denied, no
// geolocation API, timeout) resolves to a typed error instead of throwing
// past the caller, so the UI can show an honest message rather than crash.

export const GEO_ERROR = {
  PERMISSION_DENIED: 'permission_denied',
  UNAVAILABLE: 'unavailable',
  TIMEOUT: 'timeout',
};

/** Requests the user's current position exactly once, on demand. */
export function getCurrentPosition(options) {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject({ kind: GEO_ERROR.UNAVAILABLE });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        let kind = GEO_ERROR.UNAVAILABLE;
        if (err && err.code === err.PERMISSION_DENIED) kind = GEO_ERROR.PERMISSION_DENIED;
        else if (err && err.code === err.TIMEOUT) kind = GEO_ERROR.TIMEOUT;
        reject({ kind, message: err && err.message });
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000, ...options }
    );
  });
}

const EARTH_RADIUS_KM = 6371;

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance between two lat/lng points, in kilometres. */
export function haversineKm(lat1, lon1, lat2, lon2) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

function hasCoords(store) {
  return typeof store?.lat === 'number' && typeof store?.lng === 'number' && Number.isFinite(store.lat) && Number.isFinite(store.lng);
}

/**
 * Sorts stores nearest-first when they carry coordinates; stores with no
 * coordinates are NEVER dropped — they are appended after the sorted ones so
 * they can still be listed by city, per the "never silently drop" rule.
 */
export function sortStoresByDistance(stores, userLoc) {
  if (!Array.isArray(stores)) return [];
  const withCoords = [];
  const withoutCoords = [];
  for (const store of stores) {
    if (hasCoords(store) && userLoc) {
      withCoords.push({ ...store, distanceKm: haversineKm(userLoc.lat, userLoc.lng, store.lat, store.lng) });
    } else {
      withoutCoords.push(store);
    }
  }
  withCoords.sort((a, b) => a.distanceKm - b.distanceKm);
  return [...withCoords, ...withoutCoords];
}

/** Google Maps link: precise lat/lng query when available, else a text-address search. */
export function mapsUrlForStore(store) {
  if (hasCoords(store)) {
    return `https://www.google.com/maps/search/?api=1&query=${store.lat},${store.lng}`;
  }
  const text = [store?.name, store?.address, store?.city].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text || store?.chain || '')}`;
}
