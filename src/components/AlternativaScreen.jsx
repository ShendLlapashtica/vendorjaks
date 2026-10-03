import { useEffect, useMemo, useState } from 'react';
import { rotationSeed } from '../lib/bestValue.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import {
  buildExactIndex,
  collectSerbianProducts,
  exactAlternativesFor,
} from '../lib/exactMatch.js';
import { productStance } from '../lib/flagTone.js';
import { familyLabel } from '../lib/familyLabels.js';
import { CASE_KIND, openCaseOf, tallyCases } from '../lib/openCases.js';
import ProposeAlternative from './ProposeAlternative.jsx';
import '../styles/alternativa.css';

// /alternativa — SERBIAN PRODUCTS ONLY, AND ONLY EXACT REPLACEMENTS.
//
// Owner, 2026-09-17, verbatim:
//
//   "another section. explicitly called alternativa only serb products
//    listed and alternative finding for them . no something close always
//    exact find. EXACT find . no yogurt for cheese or milk . or waffle to
//    biscuit match , always always X to X match 1:1 must be 100% . IF NO
//    MATCH FOUND> make it and people can look products up and propose
//    alternatives for serb products they will undergo a vetting process"
//
// This component holds NO matching logic. Every "is this an exact swap?"
// question is answered by src/lib/exactMatch.js and nothing else, because
// the last four times this class of bug shipped it was because strictness
// was scattered across components and each one was a little bit looser than
// the last. The screen renders whatever that gate returns and renders the
// gap when it returns nothing.
//
// The gap is a FIRST-CLASS STATE, not an error. "No Kosovar or Albanian
// equivalent is known yet" is a true sentence; a wafer offered for a
// biscuit is not. Peanut butter and breakfast cereals have no Kosovar
// producer anywhere in the catalogue, so they render here as gaps, never as
// a match, and that is correct.
//
// AND A GAP IS AN OPEN CASE. Owner, 2026-09-18: "and when a serbian product
// and is live a case is opened for it and its at the very top if it isnt
// not yet on the page at the no alternatives found part there" — then,
// correcting the first attempt at that the same day:
//
//   "at the very top show the ones that have been found always"
//   "only to the second filter can one see raste te hapura and me
//    zevendesim . always show me zevendsim first then the other 2 buttons"
//
// So THE ANSWERED PRODUCTS LEAD, always: `me zëvendësim` is the default tab
// and the first thing on the screen is 159 Kosovar things a shopper can
// actually buy. The 200 unanswered ones are a first-class named thing — an
// OPEN CASE, counted on the tally strip, counted on its own tab, badged on
// every row, with a sentence saying what would close it — reached by
// pressing that tab rather than by burying the useful half underneath them.
//
// The case itself is derived, never stored: src/lib/openCases.js is the
// only place that decides what one is, and the long comment at the top of
// that file is the argument for why it has no id, no status and no database
// behind it.

const PAGE = 24;

/**
 * Round-robin the list across producers, so consecutive rows are different
 * firms, and re-deal it once a day.
 *
 * Answered products keep their place ahead of gaps (that split is useful);
 * the shuffle happens inside each half. The firm is taken from the curated
 * boycott entry where there is one — that is the real company name, so
 * "Bambi" collects Plazma in every size — falling back to the brand column
 * and then to the first word of the title.
 *
 * Seeded from the DAY, not from Math.random(): the order has to be stable
 * while a person scrolls and identical across two tabs, or it looks broken
 * rather than fresh. Same mechanism as the vendore shelf on /eksploro.
 */
function diversifyByFirm(rows, seed = rotationSeed()) {
  const hash = (str) => {
    let h = 2166136261;
    const s = `${str}|${seed}`;
    for (let i = 0; i < s.length; i += 1) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };
  const firmOf = (entry) =>
    String(
      entry.stance?.boycott?.brand ||
        entry.product?.brand ||
        String(entry.product?.name || '').trim().split(/\s+/)[0] ||
        'other'
    )
      .toLowerCase()
      .trim();

  const half = (list) => {
    const byFirm = new Map();
    for (const entry of list) {
      const k = firmOf(entry);
      if (!byFirm.has(k)) byFirm.set(k, []);
      byFirm.get(k).push(entry);
    }
    // Shuffle within each firm too, so it is not always the 150g pack that
    // represents Plazma.
    for (const [k, group] of byFirm) {
      group.sort((a, b) => hash(`${k}:${a.product.id || a.product.name}`) - hash(`${k}:${b.product.id || b.product.name}`));
    }
    // Firms enter in a day-seeded order; a firm with more products does not
    // get to go first every day just for being large.
    const firms = [...byFirm.entries()].sort((a, b) => hash(a[0]) - hash(b[0]));
    const out = [];
    for (let depth = 0; ; depth += 1) {
      let placed = 0;
      for (const [, group] of firms) {
        if (depth < group.length) {
          out.push(group[depth]);
          placed += 1;
        }
      }
      if (placed === 0) break;
    }
    return out;
  };

  const answered = rows.filter((r) => r.answer.items.length > 0);
  const gaps = rows.filter((r) => r.answer.items.length === 0);
  return [...half(answered), ...half(gaps)];
}

function digitsOf(value) {
  return String(value || '').replace(/\D/g, '');
}

function formatPrice(price, currency) {
  if (typeof price !== 'number' || !Number.isFinite(price)) return null;
  const symbol = currency === 'EUR' || !currency ? '€' : String(currency);
  return `${price.toFixed(2)} ${symbol}`;
}

/** ONE diagonal stroke. Never a fat X — STANDING HOUSE RULES 4. */
function CutMark() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true" focusable="false">
      <line x1="1.4" y1="9.6" x2="9.6" y2="1.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

/**
 * ONE ALTERNATIVE CARD — a photo, the facts, and a way in.
 *
 * Owner, 2026-09-17: "always show photos for vendore options show photos
 * for them make em all clickable".
 *
 * Both halves were real defects. The card rendered three bare `<span>`s, so
 * the SERBIAN product had a pack shot and the Kosovar one the app wants you
 * to buy did not — the condemnation illustrated, the recommendation not.
 * And the card was an `<li>` of spans, so there was no way to get from
 * "here is your alternative" to the product itself.
 *
 * THREE SHAPES, because the two lanes are genuinely different things and
 * the card must not pretend otherwise:
 *
 *   - a catalogue row (`catalog-family-fallback`) carries `row`, so the
 *     card is a real <button> that opens the app's own product detail —
 *     the same `onSelectProduct` path /eksploro already uses, not a second
 *     one invented here.
 *   - a curated brand pairing (`brand-match`) is a BRAND, not a listing;
 *     there is no product page to open, so the card is an <a> to the
 *     sourced pairing evidence when the entry has one.
 *   - an entry with neither is left inert rather than given a control that
 *     does nothing.
 *
 * A missing photo is stated in words, never left as an empty frame (rule
 * 5); buildExactIndex already sorts photographed rows first so this is rare.
 */
function AlternativeCard({ item, t, onSelectProduct }) {
  const name = item.name || item.brand;
  const sub = item.name && item.brand ? item.brand : item.company || t('altBrandLevel');
  const price = formatPrice(item.price, item.currency) || t('altPriceUnknown');

  const body = (
    <>
      <span className={`vj-alt__card-shot${item.image ? '' : ' vj-alt__card-shot--none'}`}>
        {item.image ? (
          <img
            src={item.image}
            alt=""
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <span className="vj-alt__card-shot-none">{t('altNoPhoto')}</span>
        )}
      </span>
      <span className="vj-alt__card-text">
        <span className="vj-alt__card-name">{name}</span>
        <span className="vj-alt__card-meta">{sub}</span>
        <span className="vj-alt__card-meta">{price}</span>
        <span className="vj-alt__vendore">{t('altVendore')}</span>
      </span>
    </>
  );

  if (item.row && typeof onSelectProduct === 'function') {
    return (
      <li>
        <button
          type="button"
          className="vj-alt__card vj-alt__card--open"
          onClick={() => onSelectProduct(item.row)}
          aria-label={`${t('altOpenProduct')}: ${name}`}
        >
          {body}
        </button>
      </li>
    );
  }

  if (item.pairingUrl) {
    return (
      <li>
        <a
          className="vj-alt__card vj-alt__card--open"
          href={item.pairingUrl}
          target="_blank"
          rel="noreferrer noopener"
          aria-label={`${t('altOpenProduct')}: ${name}`}
        >
          {body}
        </a>
      </li>
    );
  }

  return (
    <li>
      <div className="vj-alt__card">{body}</div>
    </li>
  );
}

export default function AlternativaScreen({ data, onSelectProduct }) {
  const { t, lang } = useLanguage();
  const [computed, setComputed] = useState(null);
  // DEFAULTS TO THE ANSWERED HALF. Owner, 2026-09-18: "at the very top show
  // the ones that have been found always". `all` was the old default and it
  // opened the page on a mixture; this opens it on the 159 products we can
  // answer, and nothing about the other 200 is hidden — the tab beside this
  // one carries their count.
  const [filter, setFilter] = useState('matched');
  const [query, setQuery] = useState('');
  const [visible, setVisible] = useState(PAGE);

  // DEFERRED ON PURPOSE. collectSerbianProducts() classifies every distinct
  // product in a 33,039-row catalogue and buildExactIndex() sweeps it again;
  // together that is roughly a second of synchronous work. Run inside the
  // render it would block the first paint and the screen would look frozen
  // — which is exactly how /eksploro died on 2026-09-16. A zero-delay
  // timeout lets the header and the loading line paint first.
  useEffect(() => {
    if (!data) return undefined;
    let cancelled = false;
    const handle = setTimeout(() => {
      const index = buildExactIndex(data);
      const rows = collectSerbianProducts(data)
        .map((entry) => {
          const answer = exactAlternativesFor(entry, data, index);
          return { ...entry, answer, stance: productStance(entry.product, data) };
        })
        .sort((a, b) => {
          // Answered products first — they are the actionable half — then
          // gaps.
          const am = a.answer.items.length > 0 ? 0 : 1;
          const bm = b.answer.items.length > 0 ? 0 : 1;
          return am - bm;
        });
      // THEN SPREAD THE FIRMS OUT.
      // Owner, 2026-09-17: "its many times same listing . plazma big plazma
      // small stella big stella can make a more variety-full section there
      // of mixed up messed up more firmas to see there" and "try to not
      // stack at the very top same dupe-like but shuffle them every day".
      //
      // The old order was alphabetical inside each half, which is precisely
      // why four sizes of one biscuit opened the page: "Bambi Plazma 150g /
      // 300g / 600g" sort adjacently by construction. These are genuinely
      // different products — they are not duplicates and must not be merged
      // — but showing them consecutively wastes the top of the page on one
      // producer.
      const diversified = diversifyByFirm(rows);
      if (!cancelled) setComputed(diversified);
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [data]);

  const tally = useMemo(() => tallyCases(computed || []), [computed]);

  const filtered = useMemo(() => {
    if (!computed) return [];
    const q = query.trim().toLowerCase();
    return computed.filter((row) => {
      if (filter === 'matched' && row.answer.items.length === 0) return false;
      if (filter === 'gap' && row.answer.items.length > 0) return false;
      if (!q) return true;
      return (
        String(row.product.name || '').toLowerCase().includes(q) ||
        String(row.product.brand || '').toLowerCase().includes(q)
      );
    });
  }, [computed, filter, query]);

  useEffect(() => {
    setVisible(PAGE);
  }, [filter, query]);

  if (!data) return <p className="vj-alt__loading">{t('altLoading')}</p>;
  if (!computed) return <p className="vj-alt__loading">{t('altLoading')}</p>;

  const shown = filtered.slice(0, visible);

  return (
    <div className="vj-alt">
      <div className="vj-alt__intro">
        <p className="vj-alt__lede">{t('altLede')}</p>
        <p className="vj-alt__rule">{t('altRule')}</p>
      </div>

      <ul className="vj-alt__tally">
        <li>
          <span className="vj-alt__tally-n">{tally.total}</span>
          <span className="vj-alt__tally-k">{t('altTallyTotal')}</span>
        </li>
        <li>
          <span className="vj-alt__tally-n">{tally.matched}</span>
          <span className="vj-alt__tally-k">{t('altTallyMatched')}</span>
        </li>
        <li>
          <span className="vj-alt__tally-n">{tally.open}</span>
          <span className="vj-alt__tally-k">{t('altTallyGap')}</span>
        </li>
      </ul>

      {/* TAB ORDER IS THE SPEC, NOT A DETAIL.
          Owner, 2026-09-18: "always show me zevendsim first then the other
          2 buttons". `me zëvendësim` is both first and the default, so the
          answered half is what a shopper lands on; `raste të hapura` is
          second because the cases are the next most useful thing and the
          owner put them behind a filter deliberately; `të gjitha` is last
          because a mixed list is the least decisive of the three.

          AND THE TABS CARRY THEIR COUNTS. `pa zëvendësim` was the old
          middle label and it described the row rather than the work: once
          the unanswered half is called an open case everywhere else on the
          screen, a tab calling the same 200 rows something different is two
          names for one thing. */}
      <div className="vj-alt__controls">
        {['matched', 'gap', 'all'].map((key) => (
          <button
            key={key}
            type="button"
            className="vj-alt__filter"
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
          >
            {t(key === 'all' ? 'altFilterAll' : key === 'matched' ? 'altFilterMatched' : 'altFilterGap')}
            <span className="vj-alt__filter-n">
              {key === 'all' ? tally.total : key === 'matched' ? tally.matched : tally.open}
            </span>
          </button>
        ))}
        <input
          className="vj-alt__search"
          type="search"
          value={query}
          placeholder={t('altSearchPlaceholder')}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={t('altSearchPlaceholder')}
        />
      </div>

      {/* WHAT AN OPEN CASE IS, SAID WHERE THE CASES ARE.
          This header belongs to the `raste të hapura` view and renders
          nowhere else: on the answered tab it would be an apology over the
          top of the useful half, which is the mistake the owner corrected.
          Here it is the only honest framing of a list of 200 things we
          could not answer — what a case is, the two kinds it splits into
          and why they are not the same work, and the fact that nothing here
          is tracked with a number or a status because there is nowhere to
          keep that. */}
      {filter === 'gap' && (
        <section className="vj-alt__cases" aria-labelledby="vj-alt-cases-h">
          <h2 className="vj-alt__cases-title" id="vj-alt-cases-h">
            {t('altCasesTitle', { n: tally.open })}
          </h2>
          <p className="vj-alt__cases-lede">{t('altCasesLede')}</p>
          <ul className="vj-alt__cases-split">
            <li>
              <span className="vj-alt__cases-split-n">{tally.resolvable}</span>
              <span className="vj-alt__cases-split-k">{t('altCasesKindKnown')}</span>
            </li>
            <li>
              <span className="vj-alt__cases-split-n">{tally.unidentified}</span>
              <span className="vj-alt__cases-split-k">{t('altCasesKindUnknown')}</span>
            </li>
          </ul>
          <p className="vj-alt__cases-note">{t('altCasesNote')}</p>
        </section>
      )}

      {shown.length === 0 && <p className="vj-alt__empty">{t('altEmpty')}</p>}

      <ul className="vj-alt__list">
        {shown.map((row) => (
          <AlternativaRow key={row.key} row={row} t={t} lang={lang} onSelectProduct={onSelectProduct} />
        ))}
      </ul>

      {visible < filtered.length && (
        <button type="button" className="vj-alt__more" onClick={() => setVisible((v) => v + PAGE)}>
          {t('altShowMore', { n: filtered.length - visible })}
        </button>
      )}
    </div>
  );
}

/**
 * The Serbian product's own header — a real button when there is a
 * catalogue row behind it, a plain div when there is not.
 *
 * Deliberately NOT a nested <button>: the row already contains buttons (the
 * alternative cards and the propose control), and a button inside a button
 * is invalid HTML that browsers resolve unpredictably. So this is a div with
 * an explicit role, tabindex and key handling — the accessible way to make a
 * composite region activatable without nesting interactive elements.
 */
function ProductHead({ product, onSelectProduct, className, children }) {
  const canOpen = typeof onSelectProduct === 'function' && (product?.id || product?.barcode);
  if (!canOpen) return <div className={className}>{children}</div>;
  const open = () => onSelectProduct(product);
  return (
    <div
      className={`${className} is-clickable`}
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      }}
    >
      {children}
    </div>
  );
}

function AlternativaRow({ row, t, lang, onSelectProduct }) {
  const { product, answer, stance, listings } = row;
  const code = digitsOf(product.barcode || product.code);
  const price = formatPrice(product.price, product.currency);
  const label = familyLabel(answer.family, lang);
  const hasMatch = answer.items.length > 0;
  // One source of truth for "is this a case", shared with the tally and the
  // tab counts — the row does not re-decide it from `items.length`.
  const openCase = openCaseOf(row);

  // WHY this product is on the list, in words. Both lanes are real and they
  // are not the same claim: a GS1 prefix names the office that issued the
  // barcode, the boycott table names a sourced Serbian producer.
  const why = stance?.boycott?.brand
    ? t('altWhyBoycott', { brand: stance.boycott.brand })
    : code
    ? t('altWhyPrefix', { prefix: code.slice(0, 3) })
    : t('altWhyPrefix', { prefix: '860' });

  return (
    <li className={`vj-alt__row${hasMatch ? '' : ' vj-alt__row--gap'}`}>
      {/* THE SERBIAN PRODUCT IS CLICKABLE TOO.
          Owner, 2026-09-18: "make every product everywhere clickable and a
          view section in itself in alternativa not working yet".
          Only the ALTERNATIVE cards were buttons; the product being judged
          was a plain div — so a shopper could open the thing to buy but not
          the thing they were holding, which is backwards. The head is now a
          button on the same onSelectProduct path /eksploro uses, so the
          detail screen (barcode, GS1 prefix, split origin, where it is
          sold) is reachable from here too. Falls back to a plain div where
          there is no catalogue row behind it, rather than rendering a
          control that does nothing. */}
      <ProductHead
        product={product}
        onSelectProduct={onSelectProduct}
        className="vj-alt__head"
      >
        {product.image ? (
          <img className="vj-alt__shot" src={product.image} alt="" loading="lazy" />
        ) : (
          <span className="vj-alt__shot vj-alt__shot--none">{t('altNoPhoto')}</span>
        )}
        <div className="vj-alt__who">
          <p className="vj-alt__name">{product.name || t('altUnknownName')}</p>
          {/* Rule 5: never a blank, never a bare comma. Each line states a
              value or says in words that we do not have it. */}
          <ul className="vj-alt__meta">
            <li className={price ? undefined : 'is-unknown'}>
              {price ? t('altPrice', { v: price }) : t('altPriceUnknown')}
            </li>
            <li className={product.brand ? undefined : 'is-unknown'}>
              {product.brand ? t('altBrand', { v: product.brand }) : t('altBrandUnknown')}
            </li>
            <li className={code ? undefined : 'is-unknown'}>
              {code ? t('altCode', { v: code }) : t('altCodeUnknown')}
            </li>
            <li className={label ? undefined : 'is-unknown'}>
              {label ? t('altFamily', { v: label }) : t('altFamilyUnknown')}
            </li>
            <li>{t('altListings', { n: listings })}</li>
          </ul>
          <span className="vj-alt__marks">
            <span className="vj-alt__flag">
              <CutMark />
              {why}
            </span>
            {/* THE CASE MARK, on every unanswered row — including the ones
                a shopper reaches through `të gjitha` rather than the case
                tab. A badge that only appeared inside the case filter would
                read as a property of that view rather than of the product,
                and the point is that the product IS an open case wherever
                it is rendered. */}
            {openCase && (
              <span
                className={`vj-alt__case-mark vj-alt__case-mark--${
                  openCase.kind === CASE_KIND.RESOLVABLE ? 'known' : 'unknown'
                }`}
              >
                {openCase.kind === CASE_KIND.RESOLVABLE
                  ? t('altCaseMarkKnown')
                  : t('altCaseMarkUnknown')}
              </span>
            )}
          </span>
        </div>
      </ProductHead>

      {hasMatch ? (
        <div className="vj-alt__answer">
          <p className="vj-alt__answer-label">{t('altAnswerLabel', { v: label })}</p>
          <ul className="vj-alt__cards">
            {answer.items.map((item, i) => (
              <AlternativeCard
                key={`${item.code || item.brand || item.name}-${i}`}
                item={item}
                t={t}
                onSelectProduct={onSelectProduct}
              />
            ))}
          </ul>
          <p className="vj-alt__evidence">
            {answer.source === 'catalog-family-fallback' ? t('altEvidenceCatalog') : t('altEvidenceCurated')}
            {answer.items[0]?.pairingUrl && (
              <>
                {' '}
                <a href={answer.items[0].pairingUrl} target="_blank" rel="noreferrer noopener">
                  {t('altEvidenceSource')}
                </a>
              </>
            )}
            {answer.source === 'catalog-family-fallback' && answer.items[0]?.url && (
              <>
                {' '}
                <a href={answer.items[0].url} target="_blank" rel="noreferrer noopener">
                  {answer.items[0].sourceLabel || t('altEvidenceSource')}
                </a>
              </>
            )}
          </p>
        </div>
      ) : (
        <div className="vj-alt__gap">
          <p className="vj-alt__gap-title">{t('altGapTitle')}</p>
          <p className="vj-alt__gap-body">{t('altGapBody')}</p>
          {/* The two gaps are different facts and the screen says which. */}
          <p className="vj-alt__gap-why">
            {answer.family
              ? t('altGapWhyNoStock', { v: label })
              : t('altGapWhyUndetermined')}
          </p>
          {/* WHAT WOULD CLOSE THIS CASE, in words, immediately above the
              control that does it. The two kinds need different sentences
              because they are asking for different facts: one wants a
              Kosovar product of a family we can already name, the other
              wants to know what the product on the shelf even is. Saying
              "propose an alternative" to both would be the flattening
              openCases.js exists to avoid. */}
          <p className="vj-alt__gap-close">
            {answer.family
              ? t('altCaseCloseKnown', { v: label })
              : t('altCaseCloseUnknown')}
          </p>
        </div>
      )}

      {/* PROPOSE ON EVERY ROW, NOT ONLY THE GAPS.
          Owner, 2026-09-17: "make it able to propose changes for all .
          proopzo is a CTA must be red and cleanups make it symmetrical".
          It used to live inside the gap branch only, which assumed a match
          we already found cannot be bettered — and the whole point of the
          exact-match rule is that our answer is a floor, not a ceiling.
          Someone standing in a shop may well know a closer replacement than
          the catalogue does. Same vetting either way: nothing a stranger
          submits reaches a shopper until a human accepts it. */}
      <div className="vj-alt__propose">
        {/^\d{8,14}$/.test(code) ? (
          <ProposeAlternative
            forCode={code}
            forName={product.name || null}
            forBrand={product.brand || null}
            hasMatch={hasMatch}
          />
        ) : (
          <p className="vj-alt__gap-why">{t('altNoProposeNoCode')}</p>
        )}
      </div>
    </li>
  );
}
