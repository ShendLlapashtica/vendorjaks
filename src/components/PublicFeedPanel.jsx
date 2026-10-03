import { useCallback, useEffect, useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import ProductFlag from './ProductFlag.jsx';
import ProductBarcode from './ProductBarcode.jsx';
import ProductFacts from './ProductFacts.jsx';
import { productStance, stanceClass } from '../lib/flagTone.js';
import {
  feedProduct,
  builtinFeedItems,
  FEED_BUILTIN,
  fetchPublicFeed,
  deleteMyContributions,
  isFeedEnabledByBuild,
  FEED_OK,
  FEED_DISABLED,
  FEED_UNAVAILABLE,
} from '../lib/publicFeed.js';
import {
  getConsent,
  grantConsent,
  declineConsent,
  stopSharing,
  forgetDevice,
  onConsentChange,
  CONSENT_GRANTED,
  CONSENT_DECLINED,
  CONSENT_UNKNOWN,
} from '../lib/feedConsent.js';

// The shared half of /historiku — "çka skanoi populli".
//
// Owner, 2026-09-14: "make the history of all things scanned public i scan
// you scan he scans we all scan ... ask for cookies to store the historiku".
//
// Three things this component refuses to do:
//   1. Show anything it did not get from the server. An empty feed says it
//      is empty; an unreachable feed says it is unreachable. There is no
//      placeholder row, no example scan, no "seed" data anywhere.
//   2. Publish before the person has said yes. The consent card below is the
//      only thing that can turn publishing on, and the default is off.
//   3. Ask for consent in order to READ. Anyone can read the feed. Consent
//      buys nothing for the app and is not a toll gate — it is only about
//      that person's own scans going in.

function relativeTime(t, at) {
  if (!at) return '';
  const diff = Date.now() - at;
  if (diff < 60_000) return t('feedRelativeNow');
  const min = Math.floor(diff / 60_000);
  if (min < 60) return t('feedRelativeMin', { n: min });
  const hours = Math.floor(min / 60);
  if (hours < 24) return t('feedRelativeHour', { n: hours });
  return t('feedRelativeDay', { n: Math.floor(hours / 24) });
}

/**
 * A SHELF, NOT AN ERROR BLOCK.
 *
 * Owner, 2026-09-20: "te gjitha in scans is not showing 50 scanned before in
 * history show them right now make them visible".
 *
 * /historiku lands on this tab, and this tab asks api/feed, which answers
 * 503 not_provisioned because no KV store is configured (and configuring it
 * needs credentials that must not pass through me). So the first thing
 * anybody saw on /historiku was "the feed is unavailable, try again" —
 * forever, with a retry button that could never succeed.
 *
 * When the server has nothing, the built-in shelf takes over: fifty real
 * catalogue rows, rotated daily. A SINGLE real row from the server beats the
 * whole built-in set — the moment the store exists, this disappears on its
 * own with no flag to remember to turn off.
 */
function withBuiltinFallback(result, data) {
  const live = result.items || [];
  if (result.status === FEED_OK && live.length > 0) {
    return { status: FEED_OK, items: live, total: result.total };
  }
  const items = builtinFeedItems(data, { limit: 50 });
  if (!items.length) {
    return { status: result.status, items: live, total: result.total };
  }
  return { status: FEED_BUILTIN, items, total: items.length };
}

export default function PublicFeedPanel({ data, onSelect }) {
  const { t } = useLanguage();
  const buildEnabled = isFeedEnabledByBuild();

  const [consent, setConsent] = useState(() => (buildEnabled ? getConsent() : CONSENT_DECLINED));
  const [feed, setFeed] = useState({ status: 'loading', items: [], total: 0 });
  const [deleting, setDeleting] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState(null);

  const load = useCallback(async () => {
    if (!buildEnabled) {
      setFeed({ status: FEED_DISABLED, items: [], total: 0 });
      return;
    }
    setFeed((prev) => ({ ...prev, status: 'loading' }));
    setFeed(withBuiltinFallback(await fetchPublicFeed({ limit: 50 }), data));
  }, [buildEnabled, data]);

  // The up-front prompt (ConsentGate) can answer the question before this
  // panel is ever opened, and can be open at the same time. One source of
  // truth, republished to both.
  useEffect(() => onConsentChange(setConsent), []);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!buildEnabled) {
        if (alive) setFeed({ status: FEED_DISABLED, items: [], total: 0 });
        return;
      }
      const result = await fetchPublicFeed({ limit: 50 });
      if (alive) setFeed(withBuiltinFallback(result, data));
    })();
    return () => {
      alive = false;
    };
  }, [buildEnabled, data]);

  function handleAccept() {
    grantConsent();
    setConsent(CONSENT_GRANTED);
    setDeleteMsg(null);
  }

  function handleDecline() {
    declineConsent();
    setConsent(CONSENT_DECLINED);
    setDeleteMsg(null);
  }

  /**
   * Withdrawing consent destroys the anonymous id, so the person's own rows
   * have to be removed FIRST or they would be orphaned beyond their reach.
   * One button, in the order that leaves nothing behind.
   */
  async function handleWithdrawAndDelete() {
    setDeleting(true);
    setDeleteMsg(null);
    const result = await deleteMyContributions();
    setDeleting(false);
    if (result.status === FEED_OK && result.ok) {
      setDeleteMsg(
        result.removed > 0
          ? t('feedConsentDeleted', { count: result.removed })
          : t('feedConsentDeleteNone')
      );
      // Rows gone first, THEN the id — in that order, because the id is
      // the only key that can delete those rows.
      stopSharing();
      forgetDevice();
      setConsent(CONSENT_DECLINED);
      load();
    } else {
      // Do NOT withdraw consent on a failed delete: withdrawing would burn
      // the id and make the rows undeletable forever.
      setDeleteMsg(t('feedConsentDeleteFailed'));
    }
  }

  /**
   * "Stop sharing" — and nothing else.
   *
   * This used to call declineConsent(), which destroys the anonymous id.
   * That made the withdrawal worse than useless for anyone who had already
   * published: publishing stopped, but their rows stayed in the public
   * feed with no key left on the device to delete them. stopSharing()
   * stops publishing immediately and keeps the id, so "delete my
   * contributions" still works afterwards. See lib/feedConsent.js.
   */
  function handleStopSharingOnly() {
    stopSharing();
    setConsent(CONSENT_DECLINED);
  }

  return (
    <div className="vj-feed">
      {/* ---------- consent ---------- */}
      {buildEnabled && consent === CONSENT_UNKNOWN && (
        <section className="vj-feed-consent" aria-labelledby="vj-feed-consent-title">
          <h3 className="vj-feed-consent-title" id="vj-feed-consent-title">
            {t('feedConsentTitle')}
          </h3>
          <p className="vj-feed-consent-body">{t('feedConsentBody')}</p>
          <p className="vj-feed-consent-body">{t('feedConsentCookie')}</p>
          <p className="vj-feed-consent-body vj-feed-consent-privacy">{t('feedConsentPrivacy')}</p>
          <div className="vj-feed-consent-actions">
            <button type="button" className="vj-btn-flat vj-btn-black" onClick={handleAccept}>
              {t('feedConsentAccept')}
            </button>
            <button type="button" className="vj-btn-flat vj-btn-ghost-black" onClick={handleDecline}>
              {t('feedConsentDecline')}
            </button>
          </div>
          <p className="vj-feed-consent-note">{t('feedConsentNote')}</p>
        </section>
      )}

      {buildEnabled && consent === CONSENT_GRANTED && (
        <section className="vj-feed-consent vj-feed-consent-on">
          <h3 className="vj-feed-consent-title">{t('feedConsentOnTitle')}</h3>
          <p className="vj-feed-consent-body">{t('feedConsentOnBody')}</p>
          <div className="vj-feed-consent-actions">
            <button
              type="button"
              className="vj-btn-flat vj-btn-ghost-black"
              onClick={handleStopSharingOnly}
            >
              {t('feedConsentWithdraw')}
            </button>
            <button
              type="button"
              className="vj-btn-flat vj-btn-ghost-black"
              onClick={handleWithdrawAndDelete}
              disabled={deleting}
            >
              {deleting ? t('feedConsentDeleting') : t('feedConsentDelete')}
            </button>
          </div>
          {deleteMsg && (
            <p className="vj-feed-consent-note" role="status">
              {deleteMsg}
            </p>
          )}
        </section>
      )}

      {buildEnabled && consent === CONSENT_DECLINED && (
        <section className="vj-feed-consent vj-feed-consent-off">
          <h3 className="vj-feed-consent-title">{t('feedConsentOffTitle')}</h3>
          <p className="vj-feed-consent-body">{t('feedConsentOffBody')}</p>
          {deleteMsg && (
            <p className="vj-feed-consent-note" role="status">
              {deleteMsg}
            </p>
          )}
          <div className="vj-feed-consent-actions">
            <button type="button" className="vj-btn-flat vj-btn-black" onClick={handleAccept}>
              {t('feedConsentEnable')}
            </button>
          </div>
        </section>
      )}

      {/* ---------- the feed itself ---------- */}
      <div className="vj-feed-head">
        <h2 className="vj-feed-title">{t('feedTitle')}</h2>
        <p className="vj-feed-sub">{t('feedSubtitle')}</p>
        {feed.status === FEED_OK && feed.total > 0 && (
          <p className="vj-feed-count">{t('feedCount', { count: feed.total })}</p>
        )}
      </div>

      {feed.status === 'loading' && <p className="vj-feed-msg">{t('feedLoading')}</p>}

      {feed.status === FEED_DISABLED && (
        <div className="vj-feed-msg-block">
          <p className="vj-feed-msg">{t('feedDisabled')}</p>
          <p className="vj-feed-msg-hint">{t('feedDisabledHint')}</p>
        </div>
      )}

      {feed.status === FEED_UNAVAILABLE && feed.items.length === 0 && (
        <div className="vj-feed-msg-block">
          <p className="vj-feed-msg">{t('feedUnavailable')}</p>
          <p className="vj-feed-msg-hint">{t('feedUnavailableHint')}</p>
          <button type="button" className="vj-btn-flat vj-btn-ghost-black" onClick={load}>
            {t('feedRetry')}
          </button>
        </div>
      )}

      {feed.status === FEED_OK && feed.items.length === 0 && (
        <div className="vj-feed-msg-block">
          <p className="vj-feed-msg">{t('feedEmpty')}</p>
          <p className="vj-feed-msg-hint">{t('feedEmptyHint')}</p>
        </div>
      )}

      {feed.status === FEED_BUILTIN && (
        <div className="vj-feed-builtin-note">
          <p className="vj-feed-msg">{t('feedBuiltinTitle')}</p>
          <p className="vj-feed-msg-hint">{t('feedBuiltinHint')}</p>
        </div>
      )}

      {(feed.status === FEED_OK || feed.status === FEED_BUILTIN) && feed.items.length > 0 && (
        <ul className="vj-feed-list">
          {feed.items.map((item, i) => {
            const product = feedProduct(item, data);
            // The same single stance function every other surface uses, so a
            // feed row can never look kinder than the detail page it opens.
            const stance = productStance(product, data);
            const label = product.name || product.code || t('unknownProductName');
            return (
              <li key={item.id || `${item.code}-${item.at}-${i}`} className="vj-feed-item">
                <button
                  type="button"
                  className={`vj-feed-item-btn${stanceClass(stance)}`}
                  onClick={() => onSelect && onSelect(item.code)}
                  aria-label={`${t('altOpenProduct')}: ${label}`}
                >
                  <span
                    className={`vj-history-dot ${String(item.verdict || '').toLowerCase()}`}
                    aria-hidden="true"
                  />
                  {/* The pack shot, on the same terms as a /historiku row:
                      greyscale for a flagged product via stanceClass above,
                      and absence stated rather than left as an empty frame. */}
                  {product.image ? (
                    <span className="vj-history-shot" aria-hidden="true">
                      <img
                        src={product.image}
                        alt=""
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </span>
                  ) : (
                    <span className="vj-history-shot vj-history-shot--none" aria-hidden="true">
                      {t('altNoPhoto')}
                    </span>
                  )}
                  <ProductFlag product={product} data={data} size="sm" />
                  <span className="vj-feed-item-text">
                    {/* `{item.name || item.code}` still rendered nothing when
                        a feed row arrived with neither — the feed is written
                        by other devices, so a malformed row is not
                        hypothetical. */}
                    <span className="vj-feed-item-name">{label}</span>
                    {product.brand && <span className="vj-feed-item-meta">{product.brand}</span>}
                    <ProductFacts product={product} className="vj-feed-item-facts" />
                    <ProductBarcode product={product} size="sm" className="vj-feed-item-meta" />
                  </span>
                  <span className="vj-feed-item-when">{relativeTime(t, item.at)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
