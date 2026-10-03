import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { isFeedEnabledByBuild } from '../lib/publicFeed.js';
import {
  getConsent,
  grantConsent,
  declineConsent,
  onConsentChange,
  CONSENT_UNKNOWN,
} from '../lib/feedConsent.js';
import '../styles/consent.css';

/**
 * THE PRE-ASK — a bottom banner.
 *
 * Owner, 2026-09-16: "cookies always pre-ask ndaj skanimet e mia me te
 * tjeret per ta ndihmuar shoqerine! tick X"
 * Owner, 2026-09-16 (shape): "show a cookie on there, and make the text
 * shorter and make it like a banner. wiht show more. PO must be like red
 * calling for a click"
 *
 * Four words in those two sentences are the whole specification:
 *
 *   "pre-ask"  — the question comes BEFORE anything is shared. Until this
 *                component existed the only prompt lived inside
 *                PublicFeedPanel on /historiku, so a person who never
 *                opened that screen was never asked at all. Nothing
 *                leaked (publishScan refuses without a grant, and so does
 *                the transport — publicFeed.js), but "never asked" is not
 *                "asked up front", and someone who WANTED to help had no
 *                way to say so. This mounts with the app.
 *
 *   "banner"   — a slim strip at the bottom edge, one sentence on its
 *                face, not a modal that takes the screen. It does not
 *                trap focus and it does not block the app: a person can
 *                keep using Vendorja and answer when they want to, which
 *                is safe precisely because the default is "share nothing".
 *
 *   "show more"— every detail lives behind a real <details>/<summary>, so
 *                it is one keystroke away and a screen reader announces
 *                it as an expandable region. Collapsed by default. What
 *                is inside is exactly what api/feed.js does: the fields
 *                toPublic() emits (code, name, brand, verdict, `at`, and
 *                the truncated month-salted `by`), what is never
 *                published, the hashed anti-spam IP counter, and that the
 *                choice is reversible.
 *
 *   "tick X"   — TWO explicit choices. PO is red (--accent-cta) because
 *                the owner asked for the call to action to look like one,
 *                and this is one of the very few places red is allowed in
 *                the new palette. JO sits immediately beside it at the
 *                SAME height and the same hit area, as the glass
 *                secondary. A styled primary is legitimate; a decline
 *                that is small, grey-on-grey, a text link, or hidden
 *                inside the expander is a dark pattern, and this banner
 *                asks permission to publish somebody's scan history. JO
 *                does not get shrunk. Not for the owner, not for me.
 */

/**
 * The cookie the owner asked for, drawn rather than emoji'd: one stroked
 * circle plus solid crumbs. HOUSE RULE 4 — icons are single-line and
 * modern, so the biscuit is an outline and only the chips are filled.
 */
function CookieMark() {
  return (
    <svg
      className="vj-consent-cookie"
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M21 12a9 9 0 1 1-9-9 3.6 3.6 0 0 0 4 4 3.6 3.6 0 0 0 5 5Z" strokeLinejoin="round" />
      <circle cx="9" cy="9.5" r="1.05" fill="currentColor" stroke="none" />
      <circle cx="8" cy="15" r="1.05" fill="currentColor" stroke="none" />
      <circle cx="13.5" cy="14" r="1.05" fill="currentColor" stroke="none" />
    </svg>
  );
}

export default function ConsentGate() {
  const { t } = useLanguage();
  const buildEnabled = isFeedEnabledByBuild();
  const [consent, setConsent] = useState(() => (buildEnabled ? getConsent() : 'declined'));
  const bannerRef = useRef(null);

  // The /historiku panel can answer the question first, and can be mounted
  // at the same time. One source of truth, republished to both.
  useEffect(() => onConsentChange(setConsent), []);

  const open = buildEnabled && consent === CONSENT_UNKNOWN;

  /**
   * A fixed strip at bottom:0 would sit on top of the home screen's own
   * sticky footer nav, which would make an unblocking banner block
   * something after all. So while it is open the app gets exactly as much
   * bottom padding as the banner is tall, measured rather than guessed
   * (the height changes when "shfaq më shumë" is opened). The rule lives
   * in styles/consent.css under body.vj-consent-open — App.css is
   * not touched.
   */
  useEffect(() => {
    if (!open) return undefined;
    const body = document.body;
    const measure = () => {
      const h = bannerRef.current ? bannerRef.current.offsetHeight : 0;
      document.documentElement.style.setProperty('--vj-consent-h', `${h}px`);
    };
    body.classList.add('vj-consent-open');
    measure();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    if (ro && bannerRef.current) ro.observe(bannerRef.current);
    window.addEventListener('resize', measure);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', measure);
      body.classList.remove('vj-consent-open');
      document.documentElement.style.removeProperty('--vj-consent-h');
    };
  }, [open]);

  if (!open) return null;

  return (
    <aside
      ref={bannerRef}
      className="vj-consent-banner"
      role="region"
      aria-labelledby="vj-consent-title"
    >
      <div className="vj-consent-inner">
        <p className="vj-consent-line" id="vj-consent-title">
          <CookieMark />
          <span>{t('feedConsentTitle')}</span>
        </p>

        {/* Native <details>: keyboard-reachable, announced as expandable,
            and it works with JavaScript half-loaded. */}
        <details className="vj-consent-details">
          <summary className="vj-consent-more">{t('feedConsentMore')}</summary>
          <div className="vj-consent-detail-body">
            <p>{t('feedConsentBody')}</p>
            <p>{t('feedConsentCookie')}</p>
            <p>{t('feedConsentPrivacy')}</p>
            <p>{t('feedConsentNote')}</p>
          </div>
        </details>

        {/* PO red, JO glass — same height, same hit area, side by side. */}
        <div className="vj-consent-actions">
          <button
            type="button"
            className="vj-consent-btn vj-consent-yes"
            /* The face of the button is two letters so the banner can stay
               one strip tall; the full sentence is what a screen reader
               reads out, so "PO" is never an unlabelled choice. */
            aria-label={t('feedConsentAccept')}
            onClick={() => {
              grantConsent();
              setConsent(getConsent());
            }}
          >
            {t('feedConsentYesShort')}
          </button>
          <button
            type="button"
            className="vj-consent-btn vj-consent-no"
            aria-label={t('feedConsentDecline')}
            onClick={() => {
              declineConsent();
              setConsent(getConsent());
            }}
          >
            {t('feedConsentNoShort')}
          </button>
        </div>
      </div>
    </aside>
  );
}
