// Consent for the PUBLIC scan feed, and the anonymous id that goes with it.
//
// Owner, 2026-09-14: "ask for cookies to store the historiku everything from
// everyone what is scanned".
//
// The rule this file exists to enforce: NOTHING is published until the person
// has said yes. Default is OFF. Not "off until they close the banner", not
// "on with an opt-out" — off, and the publish path in history.js refuses to
// send anything while getConsent() !== GRANTED.
//
// Two stores, on purpose:
//   - a real cookie (`vj_feed`, `vj_aid`) — what the owner asked for, and
//     what survives if the person later browses in a way that clears site
//     storage differently;
//   - a localStorage mirror — because the app already depends on
//     localStorage everywhere else and cookies can be blocked outright.
// Either one answering "granted" is enough; withdrawing clears both.
//
// The anonymous id is 12 random hex characters generated ON THIS DEVICE. It
// is not derived from anything about the person, it is never sent anywhere
// except as the `anonId` field of their own posts, and the server never
// publishes it — it publishes a monthly-rotating hash of it. Its only jobs
// are (a) letting the server dedupe a repeated scan and (b) letting the
// person delete their own contributions later.

export const CONSENT_UNKNOWN = 'unknown';
export const CONSENT_GRANTED = 'granted';
export const CONSENT_DECLINED = 'declined';

// Every surface that can change the choice, and every surface that shows
// it, has to agree at all times: the up-front prompt (ConsentGate) and the
// panel on /historiku are two different components that can both be mounted
// at once. A change here notifies both, so "declined" can never be showing
// in one place while the other still believes it may publish.
const CONSENT_EVENT = 'vendorja:feed-consent';

function announce() {
  try {
    if (typeof window === 'undefined' || typeof CustomEvent !== 'function') return;
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: getConsent() }));
  } catch {
    // a browser without CustomEvent still has a correct stored choice
  }
}

/** Subscribe to consent changes. Returns an unsubscribe function. */
export function onConsentChange(handler) {
  if (typeof window === 'undefined' || typeof handler !== 'function') return () => {};
  const listener = () => handler(getConsent());
  window.addEventListener(CONSENT_EVENT, listener);
  return () => window.removeEventListener(CONSENT_EVENT, listener);
}

const COOKIE_CONSENT = 'vj_feed';
const COOKIE_ANON = 'vj_aid';
const LS_CONSENT = 'vendorja.feedConsent';
const LS_ANON = 'vendorja.feedAnonId';
const ONE_YEAR = 365 * 24 * 60 * 60;

// ---------------------------------------------------------------------------
// Storage primitives. Every one of them can throw or be missing entirely
// (SSR, a test running in node, private browsing, cookies disabled) and none
// of them is allowed to take the app down.
// ---------------------------------------------------------------------------

function readCookie(name) {
  try {
    if (typeof document === 'undefined' || !document.cookie) return null;
    const match = document.cookie
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name}=`));
    return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
  } catch {
    return null;
  }
}

function writeCookie(name, value, maxAge = ONE_YEAR) {
  try {
    if (typeof document === 'undefined') return;
    const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure}`;
  } catch {
    // cookies disabled — the localStorage mirror still carries the choice
  }
}

function deleteCookie(name) {
  writeCookie(name, '', 0);
}

function readLocal(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocal(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

function removeLocal(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Anonymous id
// ---------------------------------------------------------------------------

/** 12 lowercase hex characters. Same shape the server validates. */
export function isValidAnonId(id) {
  return typeof id === 'string' && /^[0-9a-f]{12}$/.test(id);
}

function randomAnonId() {
  try {
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    // No WebCrypto (very old browser). Math.random is not a security
    // boundary here — this id guards nothing, it only groups a person's own
    // rows so they can delete them.
    let out = '';
    while (out.length < 12) out += Math.floor(Math.random() * 16).toString(16);
    return out.slice(0, 12);
  }
}

/** The id for this device, or null when consent has not been given. */
export function getAnonId() {
  const fromCookie = readCookie(COOKIE_ANON);
  if (isValidAnonId(fromCookie)) return fromCookie;
  const fromLocal = readLocal(LS_ANON);
  if (isValidAnonId(fromLocal)) {
    // Cookie was cleared but the choice stands — put it back.
    writeCookie(COOKIE_ANON, fromLocal);
    return fromLocal;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Consent
// ---------------------------------------------------------------------------

function normalise(value) {
  if (value === 'yes' || value === CONSENT_GRANTED) return CONSENT_GRANTED;
  if (value === 'no' || value === CONSENT_DECLINED) return CONSENT_DECLINED;
  return null;
}

/** CONSENT_GRANTED | CONSENT_DECLINED | CONSENT_UNKNOWN. Default unknown. */
export function getConsent() {
  return (
    normalise(readCookie(COOKIE_CONSENT)) ||
    normalise(readLocal(LS_CONSENT)) ||
    CONSENT_UNKNOWN
  );
}

export function hasConsent() {
  return getConsent() === CONSENT_GRANTED;
}

/** Say yes. Mints the anonymous id if there isn't one. Returns the id. */
export function grantConsent() {
  writeCookie(COOKIE_CONSENT, 'yes');
  writeLocal(LS_CONSENT, 'yes');
  let id = getAnonId();
  if (!id) {
    id = randomAnonId();
    writeCookie(COOKIE_ANON, id);
    writeLocal(LS_ANON, id);
  }
  announce();
  return id;
}

/**
 * Say no. The id is destroyed too, so nothing on this device can be tied to
 * whatever was published before. Local history is untouched: declining
 * costs the person nothing.
 *
 * This is the answer to the FIRST ask, where there is no id and nothing has
 * ever been published. To withdraw a yes, use stopSharing() instead — see
 * the warning there.
 */
export function declineConsent() {
  writeCookie(COOKIE_CONSENT, 'no');
  writeLocal(LS_CONSENT, 'no');
  deleteCookie(COOKIE_ANON);
  removeLocal(LS_ANON);
  announce();
}

/**
 * Withdraw a yes: stop publishing immediately, but KEEP the anonymous id.
 *
 * The id is the only thing that can delete a person's own rows from the
 * public feed (api/feed.js DELETE takes it, and the server stores nothing
 * else that could identify them). Burning it at the moment they stop
 * sharing would leave everything they already published in the feed
 * forever, beyond their reach — a withdrawal that takes away the remedy is
 * worse than no withdrawal. publishScan() stops on hasConsent() alone, so
 * keeping the id shares nothing further.
 *
 * The id is destroyed by forgetDevice(), which the UI calls after a
 * successful "delete my contributions".
 */
export function stopSharing() {
  writeCookie(COOKIE_CONSENT, 'no');
  writeLocal(LS_CONSENT, 'no');
  announce();
}

/** Destroy the anonymous id. Nothing on this device points at the feed. */
export function forgetDevice() {
  deleteCookie(COOKIE_ANON);
  removeLocal(LS_ANON);
  announce();
}

/** Back to "never asked" — the prompt shows again. */
export function resetConsent() {
  deleteCookie(COOKIE_CONSENT);
  deleteCookie(COOKIE_ANON);
  removeLocal(LS_CONSENT);
  removeLocal(LS_ANON);
  announce();
}
