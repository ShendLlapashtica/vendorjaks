// Minimal path router.
//
// Before 2026-09-12 every screen was pure React state behind a single "/"
// URL, with a bare history.pushState(null) so the Android back button
// wouldn't leave the app. That meant a scan result could not be linked,
// shared, bookmarked or reloaded — and "skano dhe të çon në një faqe"
// (scan and it takes you to a page) was the owner's explicit requirement.
//
// Deliberately hand-rolled rather than pulling in a router dependency: the
// app has five routes and one parameter, and the whole thing is 60 lines.
//
// Paths are ALBANIAN, because the app is Albanian-first.

export const ROUTES = {
  HOME: 'home',
  SCANNER: 'scanner',
  RESULT: 'result',
  EXPLORE: 'explore',
  MANIFESTO: 'manifesto',
  HISTORY: 'history',
  FAQ: 'faq',
  // Named by the owner, verbatim and in Albanian: "another section.
  // explicitly called alternativa" (2026-09-17). The path IS the name.
  ALTERNATIVA: 'alternativa',
};

const STATIC_PATHS = {
  '/': ROUTES.HOME,
  '/skano': ROUTES.SCANNER,
  '/eksploro': ROUTES.EXPLORE,
  '/pse': ROUTES.MANIFESTO,
  '/historiku': ROUTES.HISTORY,
  '/pyetje': ROUTES.FAQ,
  '/alternativa': ROUTES.ALTERNATIVA,
};

const PATH_FOR = {
  [ROUTES.HOME]: '/',
  [ROUTES.SCANNER]: '/skano',
  [ROUTES.EXPLORE]: '/eksploro',
  [ROUTES.MANIFESTO]: '/pse',
  [ROUTES.HISTORY]: '/historiku',
  [ROUTES.FAQ]: '/pyetje',
  [ROUTES.ALTERNATIVA]: '/alternativa',
};

/** '/b/8600043000016' -> { route: 'result', code: '8600043000016' } */
export function parsePath(pathname) {
  const path = (pathname || '/').replace(/\/+$/, '') || '/';

  const barcode = path.match(/^\/b\/(\d{8,14})$/);
  if (barcode) return { route: ROUTES.RESULT, code: barcode[1] };

  const staticRoute = STATIC_PATHS[path];
  if (staticRoute) return { route: staticRoute, code: null };

  // Unknown path — treat as home rather than rendering a dead end.
  return { route: ROUTES.HOME, code: null };
}

export function pathFor(route, code) {
  if (route === ROUTES.RESULT) {
    const digits = String(code || '').replace(/\D/g, '');
    return digits ? `/b/${digits}` : '/';
  }
  return PATH_FOR[route] || '/';
}

/** Full absolute URL for a scan result — used by the share card. */
export function shareUrlFor(code) {
  if (typeof window === 'undefined') return null;
  const digits = String(code || '').replace(/\D/g, '');
  if (!digits) return null;
  return `${window.location.origin}/b/${digits}`;
}

export function currentLocation() {
  if (typeof window === 'undefined') return { route: ROUTES.HOME, code: null };
  return parsePath(window.location.pathname);
}

/** Pushes a route without reloading. Falls back silently in a sandboxed frame. */
export function navigate(route, code, { replace = false } = {}) {
  const path = pathFor(route, code);
  try {
    if (replace) window.history.replaceState({ vjRoute: route, vjCode: code }, '', path);
    else window.history.pushState({ vjRoute: route, vjCode: code }, '', path);
  } catch {
    // ignore — e.g. a sandboxed iframe with no history access
  }
}
