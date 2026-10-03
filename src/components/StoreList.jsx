import { useState, useMemo } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { getCurrentPosition, sortStoresByDistance, mapsUrlForStore, GEO_ERROR } from '../lib/geo.js';
import { normalizeChainName, isGenericStoreName, CLAIM_CHAIN, CLAIM_RETAILER } from '../lib/stores.js';
import '../styles/stores.css';

const GEO_ERROR_KEY = {
  [GEO_ERROR.PERMISSION_DENIED]: 'geoPermissionDenied',
  [GEO_ERROR.UNAVAILABLE]: 'geoUnavailable',
  [GEO_ERROR.TIMEOUT]: 'geoTimeout',
};

/**
 * Labels for the store detail the owner's 2026-09-16 Google Maps paste added.
 *
 * Deliberately local to this component instead of in i18n/dictionary.js:
 * concurrent edits to one dictionary are how translations get lost. Fold these into the
 * dictionary in a later pass.
 */
const LABELS = {
  sq: {
    noRatings: 'ende pa vlerësime',
    opensAt: (time) => `hapet ${time}`,
    closesAt: (time) => `mbyllet ${time}`,
    partialHours: 'vetëm ora e hapjes është e njohur — orari i mbylljes nuk është i dhënë',
    unverifiedPhone: 'numër i padëshmuar',
    pasteProvenance: 'vlerësimi nga një pamje e Google Maps, 16.09.2026 — i padëshmuar',
    approx: '~',
    // The exact claim, in words, above the list. Owner, 2026-09-16: "why
    // show markets when not sourced there."
    claimChain: (label) =>
      `${label} e ka këtë produkt në katalogun e vet. Katalogu është i gjithë zinxhirit, prandaj po i tregojmë të gjitha degët e tij — nuk e kemi parë raftin e secilës.`,
    claimRetailer: (label) =>
      `${label} e ka listuar këtë produkt. Po tregojmë vetëm pikat e atij shitësi — për dyqanet e tjera nuk dimë asgjë.`,
    claimNone:
      'nuk kemi asnjë dëshmi se ku shitet ky produkt afër teje. Më mirë asgjë sesa një dyqan i hamendësuar.',
    unknownCity: 'qytet i panjohur',
  },
  en: {
    noRatings: 'no ratings yet',
    opensAt: (time) => `opens ${time}`,
    closesAt: (time) => `closes ${time}`,
    partialHours: 'opening time only — the closing time was not given',
    unverifiedPhone: 'unverified number',
    pasteProvenance: 'rating from a Google Maps snapshot, 2026-09-16 — unverified',
    approx: '~',
    claimChain: (label) =>
      `${label} lists this product in its own catalogue. That catalogue is chain-wide, so these are all of that chain's branches — we have not checked any individual shelf.`,
    claimRetailer: (label) =>
      `${label} lists this product. These are only that retailer's own locations — we know nothing about any other shop.`,
    claimNone:
      'we have no evidence of anywhere near you that sells this. Better nothing than a guessed shop.',
    unknownCity: 'unknown city',
  },
};

/**
 * Rating, honestly.
 *
 * Three distinct states, and they must stay distinct:
 *  - a rating  -> "4.6 ★ (222)"
 *  - reviewed by nobody (`rating: null` alongside a `ratingSource`)
 *    -> the words "no ratings yet". NOT 0, and NOT an empty five-star row,
 *       either of which reads as "this shop is bad".
 *  - we simply have no rating data for this shop (the 1,200 OSM rows)
 *    -> nothing at all. Silence is the honest rendering of "unknown".
 */
function StoreRating({ store, labels, lang }) {
  const known = typeof store.rating === 'number';
  if (!known && !store.ratingSource) return null;
  if (!known) return <span className="vj-store-rating-none">{labels.noRatings}</span>;

  const count = typeof store.reviewCount === 'number' ? store.reviewCount : null;
  return (
    <span className="vj-store-rating">
      <span className="vj-store-rating-value">{store.rating.toFixed(1)}</span>
      <span className="vj-store-rating-star" aria-hidden="true">
        ★
      </span>
      {count != null && (
        <span className="vj-store-rating-count">
          {/* "2.6K" was written down as ~2,600: the tilde is the whole point,
              the source never gave us a precise figure. */}
          ({store.reviewCountApprox ? labels.approx : ''}
          {count.toLocaleString(lang === 'sq' ? 'sq-AL' : 'en-GB')})
        </span>
      )}
    </span>
  );
}

function StoreRow({ store }) {
  const { t, lang } = useLanguage();
  const labels = LABELS[lang] || LABELS.en;
  const addressLine = [store.address, store.city].filter(Boolean).join(', ') || store.city;
  const metaBits = [];

  if (store.googleCategory) {
    metaBits.push(
      <span key="type" className="vj-store-type">
        {store.googleCategory}
      </span>
    );
  }
  // A full schedule if we have one. Otherwise the opening (or closing) time
  // the owner's snapshot gave us, explicitly marked as partial — never
  // dressed up as a schedule, and never the transient "Closed" that Google
  // showed at the moment he looked.
  if (store.hours) metaBits.push(store.hours);
  else if (store.opensAt || store.closesAt) {
    metaBits.push(
      <span key="partial" className="vj-store-row-hours-partial" title={labels.partialHours}>
        {store.opensAt ? labels.opensAt(store.opensAt) : labels.closesAt(store.closesAt)}
      </span>
    );
  }
  if (store.phone) {
    metaBits.push(
      <a key="phone" href={`tel:${store.phone}`} className="vj-store-row-phone-link">
        {store.phone}
      </a>
    );
  } else if (store.phoneRaw) {
    // A number we were given but could not verify (a +381 Serbian code on a
    // Kosovo shop, or a malformed length). Shown verbatim so the owner can
    // see it, never as a tel: link that would dial something wrong.
    metaBits.push(
      <span key="phone-raw" className="vj-store-phone-unverified" title={store.phoneFlag || labels.unverifiedPhone}>
        {store.phoneRaw}
      </span>
    );
  }

  return (
    <div className="vj-store-row">
      <div className="vj-store-row-main">
        <h4>
          {store.name || store.chain} <StoreRating store={store} labels={labels} lang={lang} />
        </h4>
        {addressLine && <p className="vj-store-row-addr">{addressLine}</p>}
        {metaBits.length > 0 && (
          <p className="vj-store-row-meta">
            {metaBits.map((bit, i) => (
              <span key={i}>
                {i > 0 && ' · '}
                {bit}
              </span>
            ))}
          </p>
        )}
        {typeof store.distanceKm === 'number' && (
          <p className="vj-store-row-distance">{store.distanceKm < 1 ? '<1' : store.distanceKm.toFixed(1)} km</p>
        )}
        {/* Where the rating came from. The rest of this file's data is
            OpenStreetMap with a checkable sourceUrl; this is not, and saying
            so is the difference between a fact and a screenshot. */}
        {store.ratingSource === 'google-maps-owner-paste' && (
          <small className="vj-store-provenance">{labels.pasteProvenance}</small>
        )}
      </div>
      <a className="vj-btn vj-btn-ghost vj-btn-sm" href={mapsUrlForStore(store)} target="_blank" rel="noreferrer" title={t('storesOpenMap')}>
        {t('openInMaps')}
      </a>
    </div>
  );
}

/**
 * StoreList: Display all stores stocking a product, grouped by chain and city.
 *
 * Accepts either:
 * 1. New format: { stores: Array, chains: Array<string>, evidence: 'catalogue' | 'none' }
 * 2. Legacy format: Array of stores (no evidence tracking)
 *
 * When evidence === 'none', shows an honest message that we don't have confirmed stock data.
 * When stores are present, groups them by chain then city, with per-chain counts.
 *
 * Geolocation is ONLY requested on button click, never automatically.
 */
export default function StoreList({ stores: storesInput }) {
  const { t, lang } = useLanguage();
  const labels = LABELS[lang] || LABELS.en;
  const [geoStatus, setGeoStatus] = useState('idle'); // idle | locating | ready | error
  const [geoErrorKind, setGeoErrorKind] = useState(null);
  const [expandedChains, setExpandedChains] = useState(new Set());

  // Normalize input: handle both new object format and legacy array format
  const { stores, chains, evidence, claim, sourceLabel } = useMemo(() => {
    if (!storesInput) {
      return { stores: [], chains: [], evidence: 'none', claim: 'none', sourceLabel: null };
    }
    if (Array.isArray(storesInput)) {
      // Legacy format: just an array
      return { stores: storesInput, chains: [], evidence: 'none', claim: 'none', sourceLabel: null };
    }
    // New format: object with stores, chains, evidence, claim
    return {
      stores: storesInput.stores || [],
      chains: storesInput.chains || [],
      evidence: storesInput.evidence || 'none',
      claim: storesInput.claim || 'none',
      sourceLabel: storesInput.sourceLabel || null,
    };
  }, [storesInput]);

  /**
   * Group by a CASE-FOLDED key, not by the raw string.
   *
   * Owner, 2026-09-16: the panel showed "Market · 23 pika" and
   * "market · 1 pika" as two chains. Grouping on `store.chain` verbatim is
   * why: "Market" and "market" are different object keys. The key is now
   * normalizeChainName() (shared with src/lib/stores.js, so grouping and
   * matching can never disagree), and the heading is the best-spelled
   * variant actually present in the data rather than whichever row came
   * first.
   *
   * A row whose only name is the word "market" is an unnamed corner shop,
   * not a chain — src/lib/stores.js keeps those out of an availability
   * answer entirely. Should one ever arrive here (a legacy array, say), it
   * is grouped under its own shop name and never printed as a chain
   * heading.
   */
  const groups = useMemo(() => {
    const byKey = new Map();
    stores.forEach((store) => {
      const chainRaw = store.chain || store.name || null;
      const usable = chainRaw && !isGenericStoreName(chainRaw) ? chainRaw : null;
      const key = usable ? normalizeChainName(usable) : `unnamed:${normalizeChainName(store.name)}`;
      if (!byKey.has(key)) byKey.set(key, { key, labels: [], cities: new Map(), count: 0 });
      const group = byKey.get(key);
      if (usable) group.labels.push(usable);
      group.count += 1;
      const cityKey = store.city || labels.unknownCity;
      if (!group.cities.has(cityKey)) group.cities.set(cityKey, []);
      group.cities.get(cityKey).push(store);
    });

    // Heading: the most frequent spelling, ties broken by the one with the
    // most capital letters ("Viva Fresh Store" over "viva fresh store").
    for (const group of byKey.values()) {
      const tally = new Map();
      for (const l of group.labels) tally.set(l, (tally.get(l) || 0) + 1);
      group.label =
        [...tally.entries()].sort(
          (a, b) =>
            b[1] - a[1] ||
            (b[0].match(/[A-ZÇË]/g) || []).length - (a[0].match(/[A-ZÇË]/g) || []).length ||
            a[0].localeCompare(b[0])
        )[0]?.[0] || null;
    }

    return [...byKey.values()].sort((a, b) =>
      String(a.label || '').localeCompare(String(b.label || ''))
    );
  }, [stores, labels]);

  // Apply geolocation sorting. `nearest` is null until the person asks —
  // geolocation is NEVER requested automatically.
  const [nearest, setNearest] = useState(null);

  async function handleFindNearby() {
    setGeoStatus('locating');
    setGeoErrorKind(null);
    try {
      const coords = await getCurrentPosition();
      setNearest(sortStoresByDistance(stores, coords));
      setGeoStatus('ready');
    } catch (err) {
      setNearest(null);
      setGeoErrorKind(err?.kind || GEO_ERROR.UNAVAILABLE);
      setGeoStatus('error');
    }
  }

  // ------------------------------------------------------------------
  // "Nowhere nearby that we can verify" is a correct answer.
  // Owner, 2026-09-16: "why show markets when not sourced there."
  // ------------------------------------------------------------------
  if (stores.length === 0) {
    return (
      <div className="vj-empty-box">
        <p>{t(evidence === 'none' ? 'storesNoneKnown' : 'nearbyNoStores')}</p>
        <p className="vj-stores-claim vj-stores-claim-none">{labels.claimNone}</p>
      </div>
    );
  }

  // The claim, in words, before the list of shops — so a list of names can
  // never be read as a stronger statement than the evidence supports.
  const claimText =
    claim === CLAIM_CHAIN && sourceLabel
      ? labels.claimChain(sourceLabel)
      : claim === CLAIM_RETAILER && sourceLabel
        ? labels.claimRetailer(sourceLabel)
        : null;

  // Determine if we should show "show all" expander (show expander if list is "long")
  const hasExpander = stores.length > 10;
  const initialExpanded = !hasExpander; // Auto-expand if not too many stores

  function toggleChain(key) {
    const newSet = new Set(expandedChains);
    if (newSet.has(key)) newSet.delete(key);
    else newSet.add(key);
    setExpandedChains(newSet);
  }

  return (
    <div>
      {chains.length > 0 && (
        <>
          <h3 className="vj-stores-title">{t('storesStockingTitle')}</h3>
          {claimText && <p className="vj-stores-claim">{claimText}</p>}
          <button
            className="vj-btn vj-btn-ghost"
            type="button"
            onClick={handleFindNearby}
            disabled={geoStatus === 'locating'}
          >
            {geoStatus === 'locating' ? t('locating') : t('findNearMe')}
          </button>
          {geoStatus === 'error' && (
            <p className="vj-field-error">{t(GEO_ERROR_KEY[geoErrorKind] || 'geoUnavailable')}</p>
          )}
        </>
      )}

      {/* Once the person has shared their position, distance order is the
          useful order and the chain grouping stops being the point. Before
          that the button did sort a list that was never rendered. */}
      {geoStatus === 'ready' && nearest ? (
        <div className="vj-store-list">
          <div className="vj-stores-in-city">
            {nearest.map((store, i) => (
              <StoreRow key={`near-${store.name}-${store.city}-${i}`} store={store} />
            ))}
          </div>
        </div>
      ) : (
        <div className="vj-store-list">
          {groups.map((group) => {
            const cityNames = [...group.cities.keys()].sort((a, b) => a.localeCompare(b));
            const isExpanded = initialExpanded || expandedChains.has(group.key);

            return (
              <div key={group.key} className="vj-stores-chain-group">
                <div className="vj-stores-chain-header">
                  {/* A generic word is never printed as a chain heading —
                      see the grouping comment above. Such a row shows only
                      its own shop name, in the body. */}
                  {group.label && <span className="vj-stores-chain-name">{group.label}</span>}{' '}
                  {/* `storesChainCount` interpolates BOTH {chain} and {count};
                      passing only count left a literal "{chain}" on screen —
                      the "{} chain" the owner reported. */}
                  <span className="vj-stores-chain-count">
                    {t('storesChainCount', { chain: group.label || '', count: group.count })}
                  </span>
                  {hasExpander && (
                    <button
                      type="button"
                      className="vj-stores-expander-btn"
                      onClick={() => toggleChain(group.key)}
                      aria-expanded={isExpanded}
                    >
                      {isExpanded ? t('storesShowLess') : t('storesShowAll')}
                    </button>
                  )}
                </div>

                {isExpanded && (
                  <div className="vj-stores-chain-body">
                    {cityNames.map((city) => (
                      <div key={city} className="vj-stores-city-group">
                        {cityNames.length > 1 && <h5 className="vj-stores-city-name">{city}</h5>}
                        <div className="vj-stores-in-city">
                          {group.cities.get(city).map((store, i) => (
                            <StoreRow key={`${group.key}-${city}-${store.name}-${i}`} store={store} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
