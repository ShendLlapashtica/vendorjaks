# Vendorja — Build Documentation

Live: https://vendorja.vercel.app (Vercel project `vendorja`, team `korea99`)
Source: this repository

## 1. What the app claims — and what it explicitly does not

The load-bearing fact, from GS1's own documentation, quoted directly from
`data/gs1-prefixes.json`'s `disclaimer` field:

> "GS1 prefixes do not identify the country of origin for a given product."

A GS1 company prefix identifies which national/regional **GS1 Member
Organisation issued the number to the brand owner** — i.e. where the brand
owner registered — not where the item was manufactured, assembled, or grown.
`data/gs1-prefixes.json`'s `notes` array spells this out further: a brand can
register with one GS1 Member Organisation and manufacture (or
contract-manufacture) anywhere in the world; multinationals often number all
their products under one home-country prefix regardless of factory location.

Consequently:

- **Claims**: which GS1 organisation a scanned barcode's prefix is registered
  with (e.g. `860` → GS1 Serbia, `381`/`390` → GS1 Kosovo / legacy Kosovo
  range, `530` → GS1 Albania), computed from `data/gs1-prefixes.json`.
- **Never claims**: where the physical product was manufactured. The UI text
  (`src/i18n/dictionary.js`) always says *"barkod i regjistruar në GS1
  Serbi"* / "barcode registered with GS1 Serbia" — never "made in Serbia" or
  the Albanian/Serbian equivalent. This wording appears on the alert banner
  itself (`src/components/ResultScreen.jsx`), not buried in a footnote, and
  a dedicated "honesty" panel repeats the caveat on every result screen via
  the `honestyExplainerTitle` / `honestyExplainerBody` strings.
- **Also does not claim** that every "local alternative" shown is definitely
  Kosovo/Albania-made with equal confidence. Two distinct confidence levels
  are surfaced in the UI (`AlternativesGrid.jsx`, `pairingEvidence`):
  a green **"reported pairing"** (source-cited, e.g. Plazma → Sempre) versus
  a grey **"same-category match"** (same category, no documented brand
  relationship) — see section 3.

## 2. Architecture and the real-time flow

The app is a Vite + React 18 SPA, plain CSS, no UI framework
(`package.json`: react/react-dom, vite, vitest for tests).

Flow, from `src/App.jsx`'s `handleCodeDetected`:

1. A barcode is scanned or manually entered.
2. **The verdict is computed synchronously from the barcode digits alone**,
   against the already-loaded (client-side) GS1 prefix table
   (`classifyBarcode()` in `src/lib/gs1.js`) — no network call is made or
   awaited before this happens. The result screen opens and the verdict
   badge renders immediately.
3. Only *after* the verdict is on screen does the app call Open Food Facts
   (`fetchProductByCode()` in `src/lib/offApi.js`) to get the product's name,
   brand, photo, and category tags.
4. Once the product (or a manually picked category) is known, alternatives
   resolution runs (section 3), asynchronously, updating the same screen in
   place.

**Why the verdict never waits on the network:** Open Food Facts is a free,
shared, unauthenticated API that is observed to return intermittent HTTP 503
"temporarily unavailable" responses (documented in
`scripts/build-dataset.mjs`'s retry logic, which exists for exactly this
reason). If OFF is slow or down, the app must still tell a shopper "this
barcode is registered with GS1 Serbia" without delay. The code comment in
`App.jsx` states this directly: "Requirement: NEVER block the verdict on a
network call." If OFF fails or doesn't have the barcode, `productStatus`
becomes `not_found`/`error`, the verdict stays visible, and a manual category
picker (`CategoryPicker.jsx`) is offered instead of a dead end.

Each barcode lookup is tagged with a monotonically increasing request
sequence number (`requestSeq`) so that a slow/stale async response for a
previous scan can never overwrite the screen for a newer one.

## 3. Alternatives resolution chain

Implemented in `src/lib/resolveAlternatives.js`, tried strictly in order —
the first source that returns at least one item wins outright (results are
not blended across sources, because a documented brand pairing is a
stronger answer than a same-category product):

| Order | Source | Function | Confidence |
|---|---|---|---|
| (a) | Brand-map match — scanned product's OFF `brands` matches a known Serbian brand in `data/brand-alternatives.json` | `findEntryByBrand` | highest — `brand-match` |
| (b) | Brand-map category match — scanned product's OFF `categories_tags` intersect an entry's `offCategoryTags` | `findEntryByCategoryTags` | `brand-category-match` |
| (c) | Static local-products pool, walked from the scanned product's most-specific OFF category tag to least specific | `collectStaticCandidates` | `static-pool` |
| (d) | Live Open Food Facts search (`countries_tags_en=kosovo`/`albania`) for the most specific category tag, merged in only when (a)–(c) come up short (`LIVE_SEARCH_THRESHOLD = 3`) | `liveSearchLocalAlternatives` + `mergeLiveAlternatives` | `live` |

### The eligibility gate

`data/local-products.json` is harvested from Open Food Facts'
`countries_tags`, which means **"sold in Kosovo/Albania,"** not "made by a
local producer" (see `src/doppelganger`-style comment header in
`src/lib/matcher.js`). That pool therefore contains imported international
brands, and even Serbian-prefixed products, merely tagged as sold in the
region (see Known Limits, section 7).

Because of this, steps (c) and (d) run every candidate through a hard
eligibility gate, `isEligibleLocalCandidate()` in `src/lib/matcher.js` — not
a ranking preference, an outright filter:

1. If the candidate's **own barcode classifies as SERBIAN** (860 prefix),
   it is excluded **unconditionally**, regardless of anything else
   (`isOwnBarcodeSerbian`).
2. Otherwise, it is eligible if its own barcode is itself issued by a local
   GS1 range — **381, 390, or 530** (`hasGenuinelyLocalPrefix`).
3. Otherwise, it is eligible only if its brand appears in a curated
   local-brand set built from `data/brand-alternatives.json`'s
   `alternatives[].brand`/`.company` plus a best-effort brand guess from
   `data/local-catalogs.json`'s `usable` storefronts
   (`buildCuratedLocalBrandSet`).
4. Anything meeting none of the above is dropped, full stop.

When nothing survives the gate, the app says so honestly
(`alternativesNoneAtAll`) rather than padding the grid with an unrelated
import.

## 4. Scanning

Implemented in `src/lib/scanner.js` and `src/components/ScannerView.jsx`:

- **Primary**: the native `BarcodeDetector` API (Chrome/Android), decoding
  EAN-13, EAN-8, UPC-A, and UPC-E live from a `requestAnimationFrame` loop
  against the video element.
- **Fallback**: `@zxing/library`, version **0.21.3**, loaded on demand from a
  pinned jsdelivr URL (`https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js`)
  for browsers without `BarcodeDetector` (iOS Safari, desktop Firefox). The
  code comment notes cdnjs does not mirror this library, hence jsdelivr.
- **Manual entry** (`ManualEntry.jsx`) is always available, both as a
  standalone screen and as a "switch to manual" escape hatch from the
  scanner (including on camera error).
- **Camera lifecycle**: `stopCamera()` stops every media track; it is called
  both when a barcode is successfully detected and in the `ScannerView`
  effect's cleanup function, so closing the scanner (navigating away,
  unmounting) always releases the camera.
- **HTTPS requirement**: `isSecureContextForCamera()` requires
  `window.isSecureContext`, with an explicit exemption for `localhost` /
  `127.0.0.1` / `::1`. Off of localhost, camera access will fail on plain
  HTTP with an `INSECURE_CONTEXT` error, surfaced in the UI.

## 5. GS1 prefixes used

Source of truth: `data/gs1-prefixes.json` (136 prefix-range entries). Key
local/Serbian ranges, quoted from that file's own `notes` and per-entry
`note` fields:

| Prefix | Country (issuer) | isSerbia | isLocal | Note |
|---|---|---|---|---|
| 860 | Serbia | true | false | "GS1 Serbia. Identifies the ISSUING organisation only — does not mean the physical product was manufactured in Serbia." |
| 381 | Kosovo | false | true | "GS1 Kosovo's own, officially assigned prefix (recently assigned)." |
| 390 | Montenegro | false | true | "Officially assigned to GS1 Montenegro, but long used in practice by some Kosovo producers/importers before/alongside prefix 381 becoming available. Treated as LOCAL for Vendorja's matching purposes as a legacy/shared case." |
| 530 | Albania | false | true | "GS1 Albania. Treated as LOCAL for Vendorja." |

The Kosovo nuance, verbatim from the data file's note 5: "381 is Kosovo's
own, recently-assigned official GS1 prefix. 390 is officially assigned to
Montenegro's GS1 Member Organisation, but is also documented as long having
been used in practice by some Kosovo producers before/alongside 381 becoming
available — both are treated here as 'local' for Vendorja's matching
purposes, with 390 flagged distinctly as the legacy/shared case rather than
Kosovo's own official range."

`src/lib/dataLoader.js` also carries a small built-in fallback prefix table
(Serbia/Kosovo/Montenegro/Albania plus a handful of neighbours) used only if
`data/gs1-prefixes.json` cannot be loaded at all — it mirrors the same facts,
not a second source of truth, and is fully superseded the moment the real
file loads.

## 6. Rebuilding the data and deploying

```bash
node scripts/build-dataset.mjs    # harvests local-products.json + category-index.json from Open Food Facts
node scripts/verify-dataset.mjs   # HEAD-checks a random sample of image/OFF-page URLs, checks for duplicate codes and missing category tags
```

`data/gs1-prefixes.json` and `data/brand-alternatives.json` are curated by
hand/research, not harvested, and are not touched by either script.

Deploy:

```bash
npm run build                          # vite build -> dist/, also copies data/*.json into dist/data/ (vite.config.js's serveDataDir plugin)
vercel deploy --prod --scope korea99
```

`npm run dev` starts the Vite dev server for local development; it is not
part of the deploy path.

## 7. Known limits

This section is the most important part of this document.

- **Open Food Facts `countries_tags` means "sold in," not "made in."** This
  is precisely why the eligibility gate (section 3) exists: without it, the
  app's static local-products pool would surface products like Milka,
  Barilla, Gullon, ETI, and Divella — internationally imported brands merely
  tagged as sold in Kosovo/Albania — as "local alternatives." Directly
  verified by reading the harvested data: **32 of the 716 harvested
  "local"-pool products carry a Serbian (860) GS1 prefix on their own
  barcode.**
- **Of the 716 harvested local products, only 171 (23.9%) carry a genuinely
  local GS1 prefix (381/390/530)** — the rest are only present because Open
  Food Facts tagged them as sold in the region, regardless of who made them.
  **Of those 171 genuinely-local-prefix products, only 53 (31.0%) carry any
  OFF category tags at all**, which limits how many of them are reachable by
  category-based matching.
- **389 of the 716 harvested local products (54.3%) have no OFF category
  tags at all**, and are therefore unmatchable by the category-walk lane
  (c) regardless of whether their barcode is genuinely local.
- **Kosovo's 381 prefix is barely in use** — in the harvested pool of 716
  products, **zero carry a 381 prefix**. Of the 171 genuinely-local-prefix
  products, all are split between 390 (59 products, the legacy/shared
  Montenegro-Kosovo range) and 530 (112 products, Albania). This matches
  `gs1-prefixes.json`'s own note that 381 was "recently assigned."
- **Categories with no verified local alternative**, from
  `data/brand-alternatives.json`'s `gaps` array (4 entries, each with a
  stated reason from real research):
  - **Chocolate confectionery** — Serbian imports (Štark's
    Bananica/Krem-banana, Cipiripi by Paraćinka) are confirmed high-volume,
    but no Kosovo/Albanian industrial-scale chocolate/wafer manufacturer
    comparable in scale could be verified; only small artisan/pastry-shop
    chocolate makers were found, not a realistic substitute for a
    mass-market product.
  - **Cooking oil** — Dijamant (Zrenjanin, Serbia) is a verified Serbian
    sunflower-oil producer; Albania has real olive-oil producers (Vaj
    Ulliri Shqiponja, Musai, Fabrika Mema) but olive oil is a different
    product tier/price point than everyday sunflower/vegetable frying oil.
    No local sunflower/vegetable-oil refinery was found in Kosovo or
    Albania.
  - **Cleaning products** — no currently-active, verifiable major Serbian
    cleaning-product brand could be confirmed (candidate "Merkur" turned
    out to be unrelated companies; "Merima" was absorbed by Henkel and
    discontinued in 2012). No specific manufactured Kosovo detergent brand
    could be attributed with a citable source.
  - **Personal care** — similarly, no currently-active, verifiable major
    Serbian personal-care/cosmetics brand was confirmed (a candidate,
    "Vitex," turned out to be a Greek-origin paint brand). A genuine Kosovo
    manufacturer (Pupla Group) was found but is left unpaired rather than
    forcing a match against an unverified Serbian brand.
- **Only 3 of the 23 total brand pairings in `data/brand-alternatives.json`
  are backed by real reporting** (`pairingEvidence: "reported"`) — the
  remaining **20 are `category-match`**, i.e. this project's own
  same-category reasoning rather than a documented brand relationship. (21
  brand entries total; one entry, Bambi/Plazma, carries the single `reported`
  alternative used as the canonical example below; the app's UI visibly
  distinguishes reported vs. category-match pairings — see section 1.)
- **Open Food Facts caps deep pagination** at roughly offset 1000 for its
  search API. `scripts/build-dataset.mjs` observed and logged this directly:
  the Albania harvest's pages 11–12 (of 12 total pages at page_size=100)
  were unreachable/skipped after exhausting retries, meaning roughly
  **105 Albanian products were never reachable** by this harvest method.
- **Camera/`BarcodeDetector` behaviour was never tested on a real device.**
  It was verified by code review and against the documented browser API
  surfaces only — the development environment has no camera. The
  barcode-decode → verdict → lookup → alternatives pipeline downstream of
  `onDetected(code)` is the same code path exercised by the manual-entry
  flow, which *was* fully end-to-end verified against the real Open Food
  Facts API and the real dataset files (section 8).

## 8. Verification performed

- `npm run test` (vitest): **33 tests passed, across 3 test files**
  (`src/test/gs1.test.js` — 10 tests, `src/test/matcher.test.js` — 20 tests,
  `src/test/resolveAlternatives.test.js` — 3 tests). 0 failed.

- **Canonical case**, exercised through the manual-entry code path against
  the real Open Food Facts API and the real dataset files:
  - Barcode **8600043000016** — a real Plazma product (Bambi, 150 g),
    found via Open Food Facts.
  - Verdict: **SERBIAN** (prefix `860`, GS1 Serbia) — rendered instantly
    from the barcode digits alone, before any network request.
  - Product lookup: `Plazma` / `Bambi`, `categories_tags` includes
    `en:biscuits`.
  - Alternative resolved via the brand-map (source `brand-match`):
    **Sempre**, made by the Kosovo company **Liri** (Prizren) — a
    **reported** pairing (`pairingEvidence: "reported"`), sourced to
    `kallxo.com` (`https://kallxo.com/shkurt/media-serbe-sempre-ne-vend-te-plazma-s-menyra-e-re-e-patriotizmit-ne-kosove/`),
    with supporting evidence from `prizrenpress.com` that Liri is a
    Prizren-based manufacturer confirmed to produce Sempre biscuits.
  - This exact case is also directly asserted by the automated test suite
    (`src/test/gs1.test.js`, `src/test/matcher.test.js`,
    `src/test/resolveAlternatives.test.js` all reference barcode
    `8600043000016` and/or the Sempre pairing).
