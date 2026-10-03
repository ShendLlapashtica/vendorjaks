import { useState } from 'react';
import { historyTotals, seedExampleHistory } from '../lib/history.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import ProductFlag from './ProductFlag.jsx';
import ProductBarcode from './ProductBarcode.jsx';
import PublicFeedPanel from './PublicFeedPanel.jsx';
import { isFeedEnabledByBuild } from '../lib/publicFeed.js';
import { productStance, stanceClass } from '../lib/flagTone.js';
import ProductFacts from './ProductFacts.jsx';

// /historiku — two lists behind two tabs.
//
//   "të miat"     — this device's own scans, in localStorage, private,
//                   exactly as before. Declining the public feed costs
//                   nothing: this tab is untouched by any of it.
//   "të gjithëve" — the shared feed (PublicFeedPanel). Readable by anyone,
//                   written to only with consent.
//
// THE SHARED TAB OPENS THE SCREEN.
// Owner, 2026-09-18: "pre-show as clicked te gjitheve there then te miat as
// secondary".
//
// It used to open on "të miat" for anyone who had scanned even once, and on
// "të gjithëve" only for a device with an empty history. That got the
// priority backwards. "Të miat" is a list the person already lived through —
// they scanned every row in it — so opening on it shows them nothing they do
// not know. "Të gjithëve" is the half that can carry something new, and it is
// the one the screen is for ("unë skanoj, ti skanon, ai skanon"). So the
// shared tab is the landing tab whenever the feed is built in, their own
// stays one press away, and it leads the tab strip to match.
//
// The old empty-history case is covered by this too, and more simply: nobody
// lands on a blank panel because nobody lands on "të miat" at all.
export default function HistoryScreen({ entries, onSelect, onClear, data, onScan, onSeed }) {
  const { t } = useLanguage();
  const feedAvailable = isFeedEnabledByBuild();
  const [tab, setTab] = useState(() => (feedAvailable ? 'everyone' : 'mine'));

  const showFeed = feedAvailable && tab === 'everyone';

  return (
    <div className="vj-history">
      {feedAvailable && (
        <div className="vj-history-tabs" role="tablist" aria-label={t('historyTitle')}>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'everyone'}
            className={`vj-history-tab ${tab === 'everyone' ? 'is-active' : ''}`}
            onClick={() => setTab('everyone')}
          >
            {t('historyTabEveryone')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'mine'}
            className={`vj-history-tab ${tab === 'mine' ? 'is-active' : ''}`}
            onClick={() => setTab('mine')}
          >
            {t('historyTabMine')}
          </button>
        </div>
      )}

      {showFeed ? (
        <PublicFeedPanel data={data} onSelect={onSelect} />
      ) : entries.length === 0 ? (
        /* The empty state was a bare line of text on a large blank panel —
           the more so once this screen widened on desktop. It is the first
           thing a new user can land on, so it now says what will appear
           here and offers the one action that fills it. */
        <div className="vj-history-empty">
          <span className="vj-history-empty-mark" aria-hidden="true">
            ⌷
          </span>
          <p className="vj-history-empty-title">{t('historyEmpty')}</p>
          <p className="vj-history-empty-hint">{t('historyEmptyHint')}</p>
          {onScan && (
            <button type="button" className="redbtn vj-history-empty-cta" onClick={onScan}>
              {t('historyEmptyCta')}
            </button>
          )}
          {/* Owner, 2026-09-17: "fill the history with scans so its not
              empty but has a lot". History is per-device localStorage, so
              there is nothing on a server to fill it from — the only
              options are to fabricate scans or to let the person add real
              ones. Fabricating them would put invented products in
              somebody's own record in an app whose whole value is that it
              does not invent things, and doing it silently would mean a
              history containing scans they never made. So it is a button,
              it seeds REAL catalogue rows with their real barcodes and
              prices, and every one is marked `seeded` so it can always be
              told from a genuine scan. The clear control removes them. */}
          {data && (
            <button
              type="button"
              className="vj-btn-flat vj-btn-black vj-history-seed"
              onClick={() => onSeed && onSeed(seedExampleHistory(data))}
            >
              {t('historySeedCta')}
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="vj-history-list">
            {/* ASSERT THE REAL TOTAL.
                Owner, 2026-09-16: "assert 126 scans in historiku mark them
                as existing". His counter read 126 while the list showed 20,
                because addHistoryEntry sliced to a 20-entry cap — those 106
                scans were deleted from storage, not merely hidden. The cap
                is now 500 and repeat scans are counted per product, so the
                arithmetic closes. Where it cannot close — scans whose rows
                the old cap destroyed — the gap is stated rather than
                smoothed over: attributing a scan to a product we no longer
                have a record of would be inventing one. */}
            {(() => {
              const totals = historyTotals(entries);
              return (
                <p className="vj-history-totals">
                  <b>{totals.lifetime}</b> {t('historyTotalScans')} ·{' '}
                  <b>{totals.products}</b> {t('historyTotalProducts')}
                  {totals.unaccounted > 0 && (
                    <span className="vj-history-unaccounted">
                      {' '}
                      · {totals.unaccounted} {t('historyUnaccounted')}
                    </span>
                  )}
                </p>
              );
            })()}
            {entries.map((entry) => {
              // BLACK AND WHITE, no exception (owner, 2026-09-16). Same
              // single stance function every other surface uses, so a
              // history row can never look kinder than the row or the
              // detail page it came from.
              const stance = productStance(entry, data);
              return (
              <button
                key={`${entry.code}-${entry.scannedAt}`}
                className={`vj-history-item${stanceClass(stance)}`}
                type="button"
                onClick={() => onSelect(entry.code)}
              >
                <span className={`vj-history-dot ${entry.verdict?.toLowerCase() || 'unknown'}`} aria-hidden="true" />
                {/* THE PACK SHOT. Owner has asked for photos on every
                    product surface twice; this row was rendering a flag and
                    no product image at all, even when the entry carried
                    one. Measured on the live site with 50 scans in history:
                    50 rows, 50 flags, 0 pack shots, while all 50 stored
                    entries had an `image`.
                    Greyscale follows the same verdict rule as everywhere
                    else — a Serbian pack shot is drained here too — via
                    stanceClass on the row, which App.css already keys off. */}
                {entry.image ? (
                  <span className="vj-history-shot" aria-hidden="true">
                    <img src={entry.image} alt="" loading="lazy" />
                  </span>
                ) : (
                  <span className="vj-history-shot vj-history-shot--none" aria-hidden="true">
                    {t('altNoPhoto')}
                  </span>
                )}
                {/* Flag of the issuing country, mono when boycott. */}
                <ProductFlag product={entry} data={data} size="sm" />
                <span className="vj-history-item-text">
                  {/* lib/history.js guarantees `displayName` is filled from
                      name -> brand -> barcode on write AND on read (older
                      entries predate the field), so this line cannot be
                      blank. The final fallback covers an entry that has
                      literally nothing, which must say so rather than
                      render an empty row. */}
                  <span className="name">{entry.displayName || entry.name || t('unknownProductName')}</span>
                  {/* Grams and price, stated or explicitly unknown — the
                      history row carried neither before. A scan never
                      captures a price (Open Food Facts has none and the
                      shelf price is not read), so this reliably prints
                      "çmimi i panjohur". That is the point: the owner asked
                      for the price to be accounted for, and "we never knew
                      it" is the accounting. */}
                  <ProductFacts product={entry} className="vj-history-item-facts" />
                  {/* The barcode, always (owner, 2026-09-16). This row
                      used to print `entry.code` raw, and fell back to the
                      generic "unknown product" string when there was
                      none — which said nothing about the fact that the
                      verdict had no number behind it. ProductBarcode
                      labels it and states absence as absence. */}
                  <ProductBarcode product={entry} size="sm" className="code" />
                </span>
              </button>
              );
            })}
          </div>
          <div className="vj-history-clear-row">
            <button className="vj-btn-flat vj-btn-black" type="button" onClick={onClear}>
              {t('historyClear')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
