// Small motion helpers shared by the poster screens.
//
// Sliding itself is done entirely in CSS (transitions/animations) so the
// single global `prefers-reduced-motion` rule in index.css can neutralize
// ALL of it at once by forcing near-zero durations — this module only
// decides WHEN to flip the `.in-view` class that those CSS rules key off,
// and handles the one genuinely JS-only side effect (vibration).

import { useEffect, useRef, useState } from 'react';

/**
 * True once the given element has scrolled into view, and stays true
 * afterwards (poster lines animate in once, they don't reset on scroll-out).
 */
export function useInView(options) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            observer.disconnect();
          }
        }
      },
      { threshold: 0.35, ...options }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return [ref, inView];
}

/**
 * Short vibration used ONLY for the hard cut into the Serbian scan-story —
 * guarded for unsupported browsers/devices (iOS Safari has no
 * navigator.vibrate at all, and some environments throw on call).
 */
export function vibrateSerbianCut() {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate([30, 40, 30]);
    }
  } catch {
    // ignore — vibration is a nice-to-have, never a requirement.
  }
}
