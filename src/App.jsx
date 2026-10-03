import { useCallback, useEffect, useRef, useState } from 'react';
import Header from './components/Header.jsx';
import HomeScreen from './components/HomeScreen.jsx';
import ExploreScreen from './components/ExploreScreen.jsx';
import ManifestoScreen from './components/ManifestoScreen.jsx';
import ProductDetailScreen from './components/ProductDetailScreen.jsx';
import ScannerView from './components/ScannerView.jsx';
import ScanStory from './components/story/ScanStory.jsx';
import ResultLocalScreen from './components/ResultLocalScreen.jsx';
import ResultOtherScreen from './components/ResultOtherScreen.jsx';
import ResultNotACountryScreen from './components/ResultNotACountryScreen.jsx';
import HistoryScreen from './components/HistoryScreen.jsx';
import ShareCardScreen from './components/ShareCardScreen.jsx';
import ConsentGate from './components/ConsentGate.jsx';
import FaqScreen from './components/FaqScreen.jsx';
import AlternativaScreen from './components/AlternativaScreen.jsx';
import ChatWidget from './components/ChatWidget.jsx';
import { useLanguage } from './i18n/LanguageContext.jsx';
import { loadAllData } from './lib/dataLoader.js';
import { classifyBarcode, VERDICT } from './lib/gs1.js';
import { findBoycottByCode, applyBoycott } from './lib/boycott.js';
import { productStance } from './lib/flagTone.js';
import { fetchProductByCode } from './lib/offApi.js';
import { resolveAlternatives, resolveAlternativesForCategoryKey, resolveAlternativesForCode } from './lib/resolveAlternatives.js';
import { loadHistory, addHistoryEntry, clearHistory, getScanCount, incrementScanCount } from './lib/history.js';
import { vibrateSerbianCut } from './lib/motion.js';
import { ROUTES, currentLocation, navigate } from './lib/router.js';

const EMPTY_ALTERNATIVES = { items: [], status: 'idle', source: null };
const CHROME_ROUTES = new Set([
  ROUTES.EXPLORE,
  ROUTES.MANIFESTO,
  ROUTES.HISTORY,
  ROUTES.FAQ,
  ROUTES.ALTERNATIVA,
]);

export default function App() {
  const { t } = useLanguage();
  const [loc, setLoc] = useState(() => currentLocation());
  const [data, setData] = useState(null);
  const [resultState, setResultState] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [history, setHistory] = useState(() => loadHistory());
  const [scanCount, setScanCount] = useState(() => getScanCount());
  const [exploreQuery, setExploreQuery] = useState('');
  const [shareTarget, setShareTarget] = useState(null);
  const requestSeq = useRef(0);
  const dataRef = useRef(null);

  useEffect(() => {
    loadAllData().then((d) => {
      dataRef.current = d;
      setData(d);
    });
  }, []);

  // The URL is the source of truth for which screen is showing, so the
  // back button, a reload and a pasted link all behave the same way.
  useEffect(() => {
    function onPopState() {
      setLoc(currentLocation());
      setShareTarget(null);
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const go = useCallback((route, code = null, opts) => {
    navigate(route, code, opts);
    setLoc({ route, code });
    // Every navigation lands at the top of the new screen — never inherits
    // scroll position from wherever the user was on the previous one.
    window.scrollTo(0, 0);
  }, []);

  const goHome = useCallback(() => go(ROUTES.HOME), [go]);

  const handleSelectProduct = useCallback((product) => {
    setSelectedProduct(product);
    window.scrollTo(0, 0);
  }, []);

  const handleCodeDetected = useCallback(
    async (rawCode) => {
      const code = String(rawCode || '').replace(/\D/g, '');
      if (!code) return;
      const seq = ++requestSeq.current;
      setScanCount(incrementScanCount());

      // Requirement: NEVER block the verdict on a network call. The verdict
      // comes purely from the barcode digits + the (already-loaded, local)
      // GS1 prefix table and boycott table, so it renders instantly.
      //
      // The exact-barcode boycott override runs HERE, before any fetch —
      // that is what makes 3870508000157 (a 387/Bosnia-prefixed Chipsy)
      // come out as a boycott product with no network round trip.
      //
      // THE SCAN SCREEN ASKS THE SAME FUNCTION AS EVERY OTHER SCREEN.
      // flagTone.js was written so that "serb products ... always black
      // white no exception" could actually be kept — "no exception is only
      // achievable if every screen asks the SAME function" — and this one,
      // the screen a shopper is standing in the shop looking at, was still
      // doing its own thing. The visible cost: the Bimilk split-origin
      // override had shipped on /eksploro since 2026-09-16 and `/b/
      // 8601500111207` still said JO E JONA under a Serbian flag. Same for
      // Fluidi (2026-09-18). productStance() runs the identical barcode
      // boycott lookup, so this stays a no-network, no-wait verdict.
      const boycottTable = dataRef.current?.boycott;
      const classify =
        productStance({ barcode: code }, dataRef.current).classify ||
        applyBoycott(classifyBarcode(code, dataRef.current?.gs1), findBoycottByCode(code, boycottTable));
      const isSerbian = classify.verdict === VERDICT.SERBIAN;

      if (isSerbian) vibrateSerbianCut();

      // Every scan now lands on its own shareable URL: /b/<code>.
      go(ROUTES.RESULT, code);

      setResultState({
        code,
        classify,
        product: null,
        productStatus: 'loading',
        alternatives: EMPTY_ALTERNATIVES,
        categoryPicker: { active: false, chosenKey: null },
      });

      // ALTERNATIVE ON THE SPOT. Owner, 2026-09-12: "alternativa must work
      // on the spot right away". When the boycott table already knows this
      // exact barcode it also knows the brand, so the alternative resolves
      // from local data with no network round trip — the same instant the
      // verdict appears. The Open Food Facts lookup below can still refine
      // it later with category tags, but the user never waits to be told
      // what to buy instead.
      if (classify.boycott?.brand) {
        // categoryHint: the boycott record knows what this brand sells, which
        // is the only thing standing between this no-tags lane and answering
        // at random for a brand that makes more than one kind of product.
        resolveAlternatives({
          brand: classify.boycott.brand,
          categoriesTags: [],
          categoryHint: classify.boycott.category || null,
          data: dataRef.current,
        })
          .then((result) => {
            if (seq !== requestSeq.current) return;
            setResultState((prev) =>
              prev && prev.code === code && prev.alternatives.status !== 'ready'
                ? { ...prev, alternatives: { items: result.items, status: 'ready', source: result.source } }
                : prev
            );
          })
          .catch(() => {});
      }

      async function loadAlternatives(brand, categoriesTags) {
        setResultState((prev) =>
          prev && prev.code === code ? { ...prev, alternatives: { ...prev.alternatives, status: 'loading' } } : prev
        );
        const result = await resolveAlternatives({ brand, categoriesTags, data: dataRef.current });
        if (seq !== requestSeq.current) return;
        setResultState((prev) =>
          prev && prev.code === code
            ? { ...prev, alternatives: { items: result.items, status: 'ready', source: result.source } }
            : prev
        );
      }

      let product;
      try {
        product = await fetchProductByCode(code);
      } catch (err) {
        if (seq !== requestSeq.current) return;
        // Requirement: OFF not having the product must NEVER hide the
        // (already-shown) verdict. We just can't category-match, so offer
        // the manual category picker instead of a dead end (Serbian flow only).
        setResultState((prev) =>
          prev && prev.code === code
            ? {
                ...prev,
                productStatus: 'not_found',
                errorKind: err.kind || 'network',
                categoryPicker: { active: isSerbian, chosenKey: null },
              }
            : prev
        );
        setHistory(addHistoryEntry({ code, name: null, brand: null, image: null, verdict: classify.verdict }));

        // "FUCK DO YOU MEAN IN THE WHOLE OF KOSOVO NO BAG EXISTS" (owner,
        // 2026-09-16). This return was the lie.
        //
        // Open Food Facts is a FOOD database. Verified against the live API
        // on 2026-09-16, it has NONE of the bin-bag barcodes this app ships
        // in its own catalogue (3900985020512 Strong Garbage Bags 25L,
        // 3902829070035 Qese Frizi 3Kg, 3901306490144 Thase Per Mbeturina —
        // all `status: 0`). So every bag scan landed here, returned before
        // the resolver was ever called, and BestAlternativeInline printed
        // "nuk u gjet alternativë vendore" — while 26 rows with
        // `isLocalBrand: true` that are literally bags sat in
        // data/kosovo-retail.json, indexed by those exact barcodes.
        //
        // The catalogue is local, already loaded and does not need OFF's
        // permission to be consulted. If it knows this barcode, answer from
        // it. If it does not either, nothing is claimed and the existing
        // "we don't know what this is" wording still stands.
        //
        // Same condition as loadAlternatives() below: a product already
        // judged local does not need to be replaced.
        if (!isSerbian && classify.verdict !== VERDICT.OTHER) return;
        resolveAlternativesForCode(code, dataRef.current)
          .then((result) => {
            if (!result || seq !== requestSeq.current) return;
            if (!result.items?.length) return;
            setResultState((prev) =>
              prev && prev.code === code
                ? { ...prev, alternatives: { items: result.items, status: 'ready', source: result.source } }
                : prev
            );
          })
          .catch(() => {});
        return;
      }

      if (seq !== requestSeq.current) return;

      // Second pass, now that Open Food Facts has returned a brand and a
      // name. Same single function again — it runs the barcode lane, then
      // the brand string ("Chipsy, Marbo, Pepsico"), then the title, and
      // only then the source-cited origin override. This can still only
      // UPGRADE a prefix verdict to boycott; the one thing that can clear
      // one is a verified, quoted production location (see flagTone.js).
      // The whole OFF record, not three fields of it: `quantity` and
      // `categoriesTags` are where OFF puts the size and the kind, and the
      // brand-homonym guard needs both to tell a Jaffa juice from a Jaffa
      // biscuit. See looksLikeDrink().
      const stance = productStance({ ...product, barcode: code }, dataRef.current);
      const finalClassify = stance.classify || classify;
      const nowSerbian = finalClassify.verdict === VERDICT.SERBIAN;
      if (nowSerbian && !isSerbian) vibrateSerbianCut();

      setResultState((prev) =>
        prev && prev.code === code
          ? { ...prev, product, productStatus: 'ready', classify: finalClassify }
          : prev
      );

      // Alternatives are resolved for a FOREIGN product too, not just a
      // boycott target. Owner, 2026-09-12: "shiko alternativat vendore SHOWS
      // DIRECTLY an alternative of the product in question" — that button
      // used to dump the user into the whole Explore catalogue, which
      // answered a different question entirely. Same category gate applies,
      // so a foreign oil still can only be answered with a local oil.
      if (nowSerbian || finalClassify.verdict === VERDICT.OTHER) {
        loadAlternatives(product.brand, product.categoriesTags);
      }

      setHistory(
        addHistoryEntry({
          code,
          name: product.name,
          brand: product.brand,
          image: product.image,
          verdict: finalClassify.verdict,
        })
      );
    },
    [go]
  );

  // A cold load of /b/<code> (a shared link, a bookmark, a reload) has a
  // route but no resultState — resolve it as soon as the dataset is ready.
  useEffect(() => {
    if (loc.route !== ROUTES.RESULT || !loc.code) return;
    if (resultState?.code === loc.code) return;
    if (!data) return; // wait for the prefix table, or the verdict would be a guess
    handleCodeDetected(loc.code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc.route, loc.code, data]);

  const handleCategoryPick = useCallback(
    async (opt) => {
      const code = resultState?.code;
      if (!code) return;
      setResultState((prev) =>
        prev && prev.code === code
          ? { ...prev, categoryPicker: { active: true, chosenKey: opt.key }, alternatives: { items: [], status: 'loading', source: null } }
          : prev
      );
      const result = await resolveAlternativesForCategoryKey(opt.key, opt.offTag, dataRef.current);
      setResultState((prev) =>
        prev && prev.code === code
          ? { ...prev, alternatives: { items: result.items, status: 'ready', source: result.source } }
          : prev
      );
    },
    [resultState?.code]
  );

  function handleClearHistory() {
    clearHistory();
    setHistory([]);
  }

  function handleSearchExplore(query) {
    setExploreQuery(query);
    go(ROUTES.EXPLORE);
  }

  const chromeTitle =
    loc.route === ROUTES.EXPLORE
      ? t('exploreTitle')
      : loc.route === ROUTES.MANIFESTO
      ? t('manifestoTitle')
      : loc.route === ROUTES.HISTORY
      ? t('historyTitle')
      : loc.route === ROUTES.FAQ
      ? t('faqTitle')
      : loc.route === ROUTES.ALTERNATIVA
      ? t('altTitle')
      : '';

  // Which result screen a scan lands on is now decided by the FULL verdict,
  // not just "Serbian or not". Before 2026-09-12 everything that wasn't
  // Serbian — Italian, German, Chinese, a coupon, a shelf label — rendered
  // the white "vendore" (local) screen with a green tick.
  function renderResult() {
    if (!resultState) return null;
    const { classify } = resultState;
    // Every result screen carries the demoted GS1 footnote, which links here.
    const openFaq = () => go(ROUTES.FAQ);

    switch (classify.verdict) {
      case VERDICT.SERBIAN:
        return (
          <ScanStory
            onOpenFaq={openFaq}
            resultState={resultState}
            data={data}
            onCategoryPick={handleCategoryPick}
            onScanAnother={goHome}
            onShare={setShareTarget}
            onClose={goHome}
            onSelectProduct={handleSelectProduct}
          />
        );
      case VERDICT.LOCAL:
        return (
          <ResultLocalScreen
            onBack={goHome}
            onOpenFaq={openFaq}
            product={resultState.product}
            productStatus={resultState.productStatus}
            code={resultState.code}
            classify={classify}
            onScanAnother={goHome}
          />
        );
      case VERDICT.OTHER:
        return (
          <ResultOtherScreen
            onBack={goHome}
            onOpenFaq={openFaq}
            classify={classify}
            product={resultState.product}
            productStatus={resultState.productStatus}
            code={resultState.code}
            onScanAnother={goHome}
            alternatives={resultState.alternatives}
            onBrowseAll={() => go(ROUTES.EXPLORE)}
            data={data}
            onSelectProduct={handleSelectProduct}
          />
        );
      default:
        return (
          <ResultNotACountryScreen
            onBack={goHome}
            onOpenFaq={openFaq}
            classify={classify}
            code={resultState.code}
            onScanAnother={goHome}
            onDetected={handleCodeDetected}
          />
        );
    }
  }

  return (
    <div className="vj-app">
      {loc.route === ROUTES.HOME && (
        <HomeScreen
          scanCount={scanCount}
          onScan={() => go(ROUTES.SCANNER)}
          onSubmitBarcode={handleCodeDetected}
          onSearchExplore={handleSearchExplore}
          onOpenExplore={() => go(ROUTES.EXPLORE)}
          onOpenAlternativa={() => go(ROUTES.ALTERNATIVA)}
          onOpenManifesto={() => go(ROUTES.MANIFESTO)}
          onOpenHistory={() => go(ROUTES.HISTORY)}
        />
      )}

      {loc.route === ROUTES.RESULT && renderResult()}

      {CHROME_ROUTES.has(loc.route) && !selectedProduct && (
        <>
          <Header title={chromeTitle} onBack={goHome} />
          <main className="vj-chrome-main">
            {loc.route === ROUTES.EXPLORE && (
              <ExploreScreen data={data} initialQuery={exploreQuery} onSelectProduct={handleSelectProduct} onBack={goHome} />
            )}
            {loc.route === ROUTES.ALTERNATIVA && (
              <AlternativaScreen data={data} onSelectProduct={handleSelectProduct} />
            )}
            {loc.route === ROUTES.MANIFESTO && <ManifestoScreen />}
            {loc.route === ROUTES.FAQ && <FaqScreen />}
            {loc.route === ROUTES.HISTORY && (
              <HistoryScreen
                entries={history}
                onSelect={handleCodeDetected}
                onClear={handleClearHistory}
                data={data}
                onScan={() => go(ROUTES.SCANNER)}
                onSeed={setHistory}
              />
            )}
          </main>
        </>
      )}

      {selectedProduct && (
        /* onSelectProduct lets a shopper walk the chain — Serbian product
           -> its Kosovar replacement -> where that one is sold — instead of
           hitting a dead end one level in. */
        <ProductDetailScreen
          product={selectedProduct}
          data={data}
          onBack={() => setSelectedProduct(null)}
          onShare={setShareTarget}
          onOpenFaq={() => go(ROUTES.FAQ)}
          onSelectProduct={handleSelectProduct}
        />
      )}

      {loc.route === ROUTES.SCANNER && (
        <ScannerView onDetected={handleCodeDetected} onSearchByName={handleSearchExplore} onClose={goHome} />
      )}

      <ShareCardScreen target={shareTarget} onClose={() => setShareTarget(null)} />

      {/* THE PRE-ASK. Owner, 2026-09-16: "cookies always pre-ask".
          Mounted here, not inside /historiku, because a question only the
          history screen asks is not asked up front. It renders nothing at
          all once the person has answered. See components/ConsentGate.jsx. */}
      <ConsentGate />

      {loc.route !== ROUTES.SCANNER && <ChatWidget />}
    </div>
  );
}
