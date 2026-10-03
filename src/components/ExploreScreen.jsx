import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import ProductFlag from './ProductFlag.jsx';
import { canonicalCategory, categoryRank, dedupeCheapest } from '../lib/retailCategories.js';
import { unitPriceOf, rotateWithinBand, vendoreProducts, rotationSeed } from '../lib/bestValue.js';
import { displayNameOrUnknown, alternativeDisplayName } from '../lib/productName.js';
import ProductFacts from './ProductFacts.jsx';
import ProductBarcode from './ProductBarcode.jsx';
import { fallbackPoolToCatalogItems, buildCategoryOptions, matchesQuery } from '../lib/catalog.js';
import { productStance } from '../lib/flagTone.js';
import { isTrustedLocalRow } from '../lib/matcher.js';
import { buildNonLocalBrandSet } from '../lib/brandAlternatives.js';
import { inlineAlternativeFor } from '../lib/inlineAlternative.js';

const PAGE_SIZE = 40;
// HOW FAR INFINITE SCROLL MAY GO ON ITS OWN.
// The observer added PAGE_SIZE every time the sentinel came into view, with
// no ceiling — on an unfiltered catalogue of 15,867 rows that is ~396
// automatic loads, and every row mounts a flag (a barcode classify plus
// three boycott lookups plus an origins lookup), a barcode and an image.
// Left to run it locks the tab: measured, Chrome's own
// Page.captureScreenshot timed out with "the renderer may be frozen".
// Past this many rows the person asks explicitly, with the button that was
// already there.
const AUTO_LOAD_CEILING = 400;
const EAGER_IMAGE_COUNT = 12;

function ExploreRow({ item, index, isFlagged, isNonRecog, isVendore, boycottCategory, onSelect, data }) {
  const { t } = useLanguage();
  const [imgBroken, setImgBroken] = useState(false);
  // Only looked up for products we are actually flagging, so the other ~19,000
  // rows cost nothing.
  const alternative = isFlagged ? inlineAlternativeFor(item, data, boycottCategory) : null;

  // BLACK AND WHITE (owner, 2026-09-16: "serb products and mos-njohese
  // products always black white no exception"). Both classes are consumed
  // by the single rule in App.css; `vj-explore-row-nonrecog` existed only
  // in that stylesheet until now — no JSX ever applied it, so every
  // non-recognising country's pack shot was still in full colour.
  return (
    <button
      type="button"
      className={`vj-explore-row${isFlagged ? ' vj-explore-row-flagged' : ''}${
        isNonRecog ? ' vj-explore-row-nonrecog' : ''
      }`}
      onClick={() => onSelect(item)}
    >
      <div className="vj-explore-row-media">
        {/* Owner, 2026-09-14: "serb products have a red cross over them
            saying BOJKOTO!". Drawn over the pack shot, not beside it, so the
            verdict is unmissable while scrolling. aria-hidden because the row
            already carries the verdict in text for a screen reader. */}
        {isFlagged && (
          <span className="vj-bojkoto" aria-hidden="true">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none">
              <line x1="6" y1="6" x2="94" y2="94" />
              <line x1="94" y1="6" x2="6" y2="94" />
            </svg>
            <span className="vj-bojkoto-word">{t('bojkoto')}</span>
          </span>
        )}
        {item.image && !imgBroken ? (
          <img
            src={item.image}
            alt=""
            loading={index < EAGER_IMAGE_COUNT ? 'eager' : 'lazy'}
            onError={() => setImgBroken(true)}
          />
        ) : (
          <span className="vj-explore-row-placeholder" aria-hidden="true">
            📦
          </span>
        )}
      </div>
      <div className="vj-explore-row-body">
        {/* productDisplayName() can still return null (no name, no brand,
            no category, no barcode) and this heading then rendered empty —
            an unidentifiable row in a 90,000-row list. */}
        <h4>{displayNameOrUnknown(item, null, item.barcode || item.id, t('unknownProductName'))}</h4>
        {item.brand && <p className="vj-explore-row-brand">{item.brand}</p>}
        <div className="vj-explore-row-tags">
          {/* Country flag from the product's own barcode (owner,
              2026-09-12: "use flags for countries' products"). Mono when
              the verdict is boycott, absent when the code names no country. */}
          <ProductFlag product={item} data={data} size="sm" showTag />
          {isFlagged && <span className="vj-tag-flagged">{t('exploreFlaggedBadge')}</span>}
          {isVendore && (
            <span className="vendore-chip">
              <i className="dot" aria-hidden="true" />
              {t('badgeVendore')}
            </span>
          )}
          {/* Grams and price, both always stated. `{price && …}` used to
              leave a silent gap that reads as "free" rather than "unknown",
              and the size was not shown at all on any row. */}
          <ProductFacts product={item} className="vj-explore-row-facts" />
        </div>
        {/* THE EVIDENCE, ON THE ROW. Owner, 2026-09-16: "show always
            barcode for it". The flag above is derived from these digits,
            so the digits travel with it — and where there are none, the
            row says "pa barkod" rather than going quiet about it. */}
        <ProductBarcode product={item} size="sm" className="vj-explore-row-barcode" />
      </div>

      {/* THE LOCAL ALTERNATIVE, IN THE ROW ITSELF. No tap-through: the whole
          point is that a shopper sees what to buy instead at the same moment
          they see the verdict. Null when the curated map has no same-category
          answer -- an empty slot is correct, a wrong product is not. */}
      {alternative && (
        <div className="vj-explore-row-alt">
          <span className="vj-explore-row-alt-label">{t('bleji')}</span>
          <span className="vj-explore-row-alt-card">
            {alternative.image ? (
              <img src={alternative.image} alt="" loading="lazy" />
            ) : (
              <span className="vj-explore-row-alt-noimg" aria-hidden="true">🇽🇰</span>
            )}
            <span className="vj-explore-row-alt-name">{alternativeDisplayName(alternative, t('unknownBrand'))}</span>
          </span>
        </div>
      )}
    </button>
  );
}

// EXPLORE — searchable, paginated list of catalogue products grouped by
// category, red Treatment-A-flavoured category headers, white list body.
//
// Perf fix (2026-09-11, reported by the owner testing on a cheap Android
// phone): the old catalog grid rendered all ~1000+ images into the DOM at
// once. This now renders PAGE_SIZE rows per "page", eager-loads only the
// first EAGER_IMAGE_COUNT images (the rest are loading="lazy"), and every
// <img> hides itself on error instead of leaving a broken-image icon.
/**
 * FNV-1a with an avalanche tail, SEED FIRST.
 *
 * Seed first is not a style choice: appending it left the low bits of the
 * hash dominated by the product code, so consecutive days produced almost
 * the same order. That is the bug that made the last "daily" shuffle a
 * rotation by one. Same construction as lib/bestValue.js and
 * lib/publicFeed.js — three surfaces, one definition of "a different day".
 */
function dayHash(seed, str) {
  let h = 2166136261;
  const s = `${seed}|${str}`;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 15;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  return h >>> 0;
}

export default function ExploreScreen({ data, initialQuery, onSelectProduct, onBack }) {
  const { t } = useLanguage();
  const [query, setQuery] = useState(initialQuery || '');
  const [category, setCategory] = useState(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef(null);

  const retail = data?.kosovoRetail;
  const usingFallback = !retail || retail.isFallback || retail.products.length === 0;

  const items = useMemo(() => {
    if (!data) return [];
    // De-duplicate across retailers, keeping the CHEAPEST listing for each
    // product (owner, 2026-09-12: "REMOVE DUPES, show cheapest"). The row
    // that survives records the other shops it was found at on `alsoAt`, so
    // a cheaper listing never silently erases the rest.
    if (!usingFallback) return dedupeCheapest(retail.products);
    return fallbackPoolToCatalogItems(data.localProducts, data.gs1);
  }, [data, usingFallback, retail]);

  // The chips offer the CANONICAL shelves, not the raw retailer strings —
  // and only shelves with enough products to be worth a filter.
  //
  // The catalogue carries 619 distinct raw category strings across four
  // retailers. Canonicalisation folds those to ~300, but the tail is
  // hundreds of one-off labels covering a handful of products each, and
  // every one of them was claiming its own chip: the filter band rendered
  // 2,621px tall and buried the products below the fold.
  //
  // A chip needs MIN_CHIP_PRODUCTS behind it to earn a place. Nothing is
  // hidden — a product keeps its own label as its section heading and is
  // still reachable by search; it simply doesn't get a dedicated filter.
  const MIN_CHIP_PRODUCTS = 15;
  const categoryOptions = useMemo(() => {
    const counts = new Map();
    const sides = new Map();
    for (const item of items) {
      const { label, side } = canonicalCategory(item.category);
      counts.set(label, (counts.get(label) || 0) + 1);
      sides.set(label, side);
    }
    // Owner, 2026-09-13: "te gjitha ushqimi (primary foods goods at start not
    // detergents)". Sorting by product count alone put Higjienë fifth and
    // Duhan & vape ninth — above Bylmet, Mish, Bukë and Vaj. categoryRank
    // puts the staples first, then the rest of the food, then non-food, with
    // count only breaking ties inside a band.
    return [...counts.entries()]
      .filter(([, n]) => n >= MIN_CHIP_PRODUCTS)
      .sort(
        (a, b) =>
          categoryRank(a[0], sides.get(a[0])) - categoryRank(b[0], sides.get(b[0])) || b[1] - a[1]
      )
      .map(([label]) => label);
  }, [items]);

  // THE WINDOW HAS TO MOVE, NOT JUST ITS CONTENTS.
  //
  // Owner, 2026-09-20: "these are never updating im tired of asking you",
  // after 2026-09-18: "i have been checking this page for weeks . same
  // grapes and apples on eksploro te gjitha".
  //
  // He was right both times and my previous fix did not touch the cause.
  // `visible` is filtered.slice(0, 48) and `groups` is built FROM
  // `visible`, so the day-seeded rotateWithinBand() at the bottom of this
  // file was reordering the same forty-eight rows every day. The window
  // never moved. Whatever sits at the head of kosovo-retail.json — grapes
  // and apples — was in it on every single one of those days, and no
  // amount of shuffling inside the window could remove it.
  //
  // So the POOL is ordered by the day seed before anything is sliced off
  // it. Filtering preserves order, so every category and the unfiltered
  // list all move together for free.
  //
  // Cost: one hash per row and one sort, memoised on [items, seed] — about
  // 33k hashes once per day per session, not per render. That distinction
  // is the whole reason this screen is usable; it has frozen twice from
  // per-render work over this same array (measured 2026-09-16).
  const daySeed = rotationSeed();
  const dayOrdered = useMemo(() => {
    const keyed = new Array(items.length);
    for (let i = 0; i < items.length; i += 1) {
      const it = items[i];
      keyed[i] = { it, h: dayHash(daySeed, it.barcode || it.id || it.name || String(i)) };
    }
    keyed.sort((a, b) => a.h - b.h);
    return keyed.map((k) => k.it);
  }, [items, daySeed]);

  const filtered = useMemo(
    () =>
      // A SEARCH IS NOT A SHELF. When the person has typed something they
      // are looking for one product, so the stable catalogue order is kept
      // and the daily shuffle stays out of the way.
      (query ? items : dayOrdered).filter(
        (item) =>
          (!category || canonicalCategory(item.category).label === category) &&
          matchesQuery(item, query)
      ),
    [items, dayOrdered, category, query]
  );

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [query, category]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisibleCount((v) =>
            v >= AUTO_LOAD_CEILING ? v : Math.min(v + PAGE_SIZE, filtered.length, AUTO_LOAD_CEILING)
          );
        }
      },
      { rootMargin: '400px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [filtered.length]);

  const visible = filtered.slice(0, visibleCount);

  // ONE verdict per row per render, shared by the sort and the rows.
  //
  // productStance() is not free — a prefix classify, two boycott lookups and
  // an origins lookup — and Array#sort calls its comparator O(n log n)
  // times, so calling it from inside the comparator would run it thousands
  // of times per shelf on a 40-row page. Memoised on the item identity.
  //
  // It also guarantees the sort and the row agree: before this, a row could
  // be sorted as unflagged and then render flagged, or the reverse.
  // The caches are refs, NOT per-render Maps. Rebuilding them every render
  // was pointless — the whole reason they exist is to be reused — and it is
  // what made /eksploro hang (owner, 2026-09-16: "eksploro not working atp").
  // Reset when the dataset identity changes; item objects are stable across
  // renders because `items` is itself memoised.
  const stanceCacheRef = useRef(new Map());
  const unitCacheRef = useRef(new Map());
  useEffect(() => {
    stanceCacheRef.current = new Map();
    unitCacheRef.current = new Map();
  }, [data]);
  const stanceCache = stanceCacheRef.current;
  const stanceOf = (item) => {
    let s = stanceCache.get(item);
    if (!s) {
      s = productStance(item, data);
      stanceCache.set(item, s);
    }
    return s;
  };
  const isFlaggedItem = (item) => stanceOf(item).flagged;

  // Same reasoning as stanceOf. unitPriceOf() runs resolveProductSize(),
  // which is a regex parse over the product title, and it was being called
  // from inside a sort comparator — O(n log n) parses per shelf per render.
  const unitOf = (item) => {
    const cache = unitCacheRef.current;
    if (cache.has(item)) return cache.get(item);
    const v = unitPriceOf(item);
    cache.set(item, v);
    return v;
  };

  // ONE definition of "vendore" for this screen: the same gate the
  // alternatives resolver uses. Reading item.isLocalBrand directly is what
  // let a BAT nicotine pouch on Albanian prefix 530 wear the badge.
  const nonLocalBrands = useMemo(
    () => buildNonLocalBrandSet(data?.brandAlternatives),
    [data]
  );
  const isVendore = (item) =>
    isTrustedLocalRow(item, { gs1: data?.gs1, boycott: data?.boycott, nonLocalBrands });

  // VENDORE — the section the owner asked for, and the decision he asked me
  // to make about what leads the page.
  // Owner, 2026-09-16: "make a section only for vendore" / "you decide what
  // stays up and shown on the first page im tired of seeing the same shit
  // always always".
  //
  // Only on the unfiltered, unsearched view — once someone has picked a
  // shelf or typed a query their intent outranks ours. Gated on
  // isLocalBrand === true (never false, never null) and never anything
  // flagged, and re-dealt once a DAY from a pool of ~3,000 proven-local
  // products, so the front page is genuinely different tomorrow. See
  // lib/bestValue.js.
  // MEMOISED, and this is not an optimisation — it is the bug fix.
  // Unmemoised this swept all 33,039 rows on EVERY render, calling
  // isTrustedLocalRow (a prefix classify plus two boycott lookups) on each,
  // so every keystroke in the search box re-ran ~33k classifications and the
  // renderer froze. Measured: the page stopped responding to a screenshot
  // request on production.
  const vendore = useMemo(
    () =>
      !category && !query.trim()
        ? vendoreProducts(items, { limit: 24, isFlagged: isFlaggedItem, isTrustedLocal: isVendore })
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, category, query, data, nonLocalBrands]
  );

  // Group the visible slice by category for the red section headers, while
  // keeping a single running index (for the eager/lazy image cutoff) across
  // the whole page, not reset per group.
  // Owner, 2026-09-12: "elementary products that are living required to
  // left. and hygiene others to right". Each category group is placed on a
  // shelf side by lib/categoryFamily.js — the same rules that gate the
  // alternatives, so the two can never disagree about what a product is.
  // Canonical shelves (owner, 2026-09-12): "pije jo alkoolike pije are same
  // one label both as pije" — the catalogue ships 102 raw category strings
  // for what a shopper reads as maybe twenty shelves. Essentials go left,
  // hygiene and non-food right. Cheapest first inside each shelf.
  const groups = [];
  let runningIndex = 0;
  for (const item of visible) {
    const { label, side } = canonicalCategory(item.category);
    let group = groups.find((g) => g.key === label);
    if (!group) {
      group = { key: label, rows: [], side: side === 'left' ? 'essential' : 'household' };
      groups.push(group);
    }
    group.rows.push({ item, index: runningIndex });
    runningIndex += 1;
  }


  // Same order as the chips: primary foods open the page, non-food closes it.
  // Groups used to appear in whatever order the paginated slice happened to
  // produce, so a detergent shelf could be the first thing on a grocery page.
  groups.sort(
    (a, b) =>
      categoryRank(a.key, a.side === 'essential' ? 'left' : 'right') -
      categoryRank(b.key, b.side === 'essential' ? 'left' : 'right')
  );

  // BEST VALUE IS A RULE, NOT A SECTION.
  // Owner, 2026-09-16: "never show best value as text its not meant to be a
  // section its meant to be a rule" — so there is no strip, no heading and
  // no label anywhere. Every shelf is simply ordered so the best buy is the
  // first thing in it, and the shopper is never told that is what happened.
  //
  // Ranked on UNIT price (EUR per kg / per litre), not sticker price: sticker
  // price puts a 40 g sachet above a 5 kg sack of flour, which is the
  // opposite of value. Rows whose pack size is unknown cannot have a unit
  // price and sort after the ones that do, on sticker price — they are not
  // guessed at. Flagged (Serbian / boycott-table) rows sort last within
  // their shelf whatever they cost: the app is not going to open a shelf
  // with the thing it is telling you not to buy.
  if (vendore.length > 0) {
    groups.unshift({
      key: t('exploreVendoreHeading'),
      side: 'vendore',
      pinned: true,
      rows: vendore.map((item, i) => ({ item, index: -1 - i })),
    });
  }

  for (const group of groups) {
    if (group.pinned) continue; // already dealt for today
    group.rows.sort((a, b) => {
      const fa = isFlaggedItem(a.item) ? 1 : 0;
      const fb = isFlaggedItem(b.item) ? 1 : 0;
      if (fa !== fb) return fa - fb;
      const ua = unitOf(a.item);
      const ub = unitOf(b.item);
      if (ua && ub) return ua.value - ub.value;
      if (ua) return -1;
      if (ub) return 1;
      const pa = typeof a.item.price === 'number' ? a.item.price : Infinity;
      const pb = typeof b.item.price === 'number' ? b.item.price : Infinity;
      return pa - pb;
    });
    // Then deal the strong band in a different order every few hours, so a
    // shelf is not the same six faces forever. Only the already-good rows
    // are reordered among themselves; nothing weak is promoted, and nothing
    // on screen says this is happening. See lib/bestValue.js.
    group.rows = rotateWithinBand(group.rows, 40);
  }

  return (
    <div className="vj-explore">
      <div className="vj-explore-search">
        <input
          type="search"
          placeholder={t('exploreSearchPlaceholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={t('exploreSearchPlaceholder')}
        />
      </div>

      {data && usingFallback && <p className="vj-explore-notice">{t('exploreRetailLoading')}</p>}
      {!data && <p className="vj-explore-notice">{t('exploreLoading')}</p>}

      {categoryOptions.length > 0 && (
        <div className="vj-explore-cats">
          <button type="button" className={category === null ? 'active' : ''} onClick={() => setCategory(null)}>
            {t('exploreCategoryAll')}
          </button>
          {categoryOptions.map((c) => (
            <button key={c} type="button" className={category === c ? 'active' : ''} onClick={() => setCategory(c)}>
              {c}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 && data && <p className="vj-explore-empty">{t('exploreEmpty')}</p>}

      <div className="vj-explore-shelf">
      {groups.map((group) => (
        <div className={`vj-explore-group is-${group.side}`} key={group.key}>
          <h3 className="vj-explore-cat-header">{group.key}</h3>
          <div className="vj-explore-list">
            {group.rows.map(({ item, index }) => {
              // ONE stance function for the whole app — lib/flagTone.js.
              // This used to be three separate inline computations (here,
              // in ProductFlag, and on the detail screen) which could and
              // did disagree: the prefix alone is not sufficient
              // (boycott-brands.json exists for the Chipsy 387 case), and
              // an 860 prefix is not sufficient either (the Bimilk case,
              // where product-origins.json carries a sourced Macedonian
              // production location). productStance() settles both.
              const stance = stanceOf(item);
              return (
                <ExploreRow
                  key={item.id}
                  item={item}
                  index={index}
                  isFlagged={stance.flagged}
                  isNonRecog={stance.nonRecogniser}
                  isVendore={isVendore(item)}
                  boycottCategory={stance.boycott?.category || null}
                  onSelect={onSelectProduct}
                  data={data}
                />
              );
            })}
          </div>
        </div>
      ))}
      </div>

      {visibleCount < filtered.length && (
        <div className="vj-explore-more">
          <button type="button" className="vj-btn-flat vj-btn-black" onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}>
            {t('exploreShowMore')}
          </button>
          <div ref={sentinelRef} aria-hidden="true" />
        </div>
      )}
    </div>
  );
}
