# Vendorja

A mobile-first web app for Kosovo shoppers: point your phone camera at a
product's barcode and Vendorja tells you which country's GS1 organisation
issued that barcode. If it's registered with **GS1 Serbia**, Vendorja alerts
you and shows real, verified Kosovo/Albanian alternative products in the same
category.

Architecture, flow, edge/proxy layers and repo map: **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

Built with Vite + React 18, plain CSS (no Tailwind/UI framework).

Built on my earlier project [vendorja](https://github.com/ShendLlapashtica/vendorja), with AI-assisted development (Claude).

## What Vendorja claims — and what it does NOT claim

**Claims:** which GS1 member organisation a barcode's *company prefix* is
registered with (e.g. `860` → GS1 Serbia, `381`/`390` → GS1 Kosovo/legacy
range, `530` → GS1 Albania), sourced from `data/gs1-prefixes.json`.

**Does NOT claim:** where the physical product was manufactured. GS1's own
documentation is explicit that "GS1 prefixes do not identify the country of
origin for a given product." A company can register with GS1 Serbia and
manufacture anywhere in the world, and vice versa. Vendorja always says
*"barkod i regjistruar në GS1 Serbi"* ("barcode registered with GS1 Serbia"),
**never** "made in Serbia" — and shows this caveat on every result screen,
not buried in a footnote. This is the single most important honesty rule in
the app; see `src/i18n/dictionary.js` → `honestyExplainerBody`.

**Also does NOT claim** that every product shown as a "local alternative" is
in Vendorja's opinion definitively Kosovo/Albanian-made. Two different
confidence levels are shown, labelled differently in the UI:
- a **reported pairing** (green label, with a source link) — a documented,
  source-cited brand association from `data/brand-alternatives.json`, e.g.
  Plazma (Bambi, Serbia) → **Sempre** (Liri, Kosovo);
- a **same-category match** (grey label) — a product that merely shares a
  category with no documented brand relationship.

Vendorja never presents an imported brand that merely happens to be *sold*
in Kosovo/Albania (per Open Food Facts' `countries_tags`) as a "local
alternative." That distinction matters: Open Food Facts' country tags mean
"sold in," not "made by a local producer," and `data/local-products.json` is
harvested that way. A candidate is only shown as local when either (a) its
own barcode is itself issued by a local GS1 range (381/390/530), or (b) its
brand appears in the curated, source-cited `data/brand-alternatives.json`.
Everything else is filtered out — see `isEligibleLocalCandidate` in
`src/lib/matcher.js`. When nothing survives that filter, the app says so
honestly instead of padding the grid with an unrelated import.

## How the matching works

1. **Scan** — `BarcodeDetector` (Chrome/Android) decodes EAN-13/EAN-8/UPC
   live from the camera; ZXing (loaded from a pinned jsdelivr URL) is the
   fallback for browsers without it (iOS Safari, desktop Firefox). Manual
   text entry is always available.
2. **Verdict, instantly** — the barcode's 3-digit prefix is looked up in
   `data/gs1-prefixes.json`. This is pure local computation on the digits
   already in hand: the verdict badge renders before any network request is
   made, so a Serbian-registered barcode is flagged with zero network
   latency, even if Open Food Facts is down or slow.
3. **Product lookup** — Open Food Facts' free `/api/v2/product/<code>.json`
   gives the name, brand, photo and `categories_tags`. If OFF doesn't have
   the barcode (common — it will not have every Serbian product) or is
   temporarily down (it returns intermittent 503s), the verdict stays
   visible and the app offers a one-tap category picker instead of a dead
   end.
4. **Alternatives**, in order of confidence:
   - **(a)** brand match against `data/brand-alternatives.json` — the
     highest-confidence, source-cited answer (the Plazma → Sempre path);
   - **(b)** category match against that same curated file's
     `offCategoryTags`;
   - **(c)** the static `data/local-products.json` pool, walked from the
     scanned product's most-specific OFF category tag to least specific,
     filtered to genuinely-local candidates only;
   - **(d)** a live Open Food Facts search (`countries_tags_en=kosovo` /
     `albania`), same filter applied, used only to top up when (a)-(c) come
     up short. OFF's live search is intermittently unavailable; failures
     degrade silently to whatever was already found, never to a page error.

## Data contract (produced by the data pipeline — read-only here)

- `data/gs1-prefixes.json` — GS1 prefix → issuing country + isSerbia/isLocal.
- `data/local-products.json` — pool of OFF products tagged as sold in
  Kosovo/Albania (code, name, brand, categoriesTags, image, quantity,
  country, prefix).
- `data/category-index.json` — OFF category tag → `{ count, codes }`.
- `data/brand-alternatives.json` — curated, source-cited Serbian-brand →
  Kosovo/Albania-brand pairings; the primary alternatives source.
- `data/local-catalogs.json` — best-effort research notes on genuinely-local
  storefronts, used only to widen the curated-brand eligibility set.

The app never writes to `data/` or to `scripts/build-dataset.mjs` /
`scripts/verify-dataset.mjs`. Every loader in `src/lib/dataLoader.js` is
defensive about shape and degrades to an honest "not loaded yet" state
(clearly surfaced in the UI) rather than crashing, since these files can be
mid-build or briefly unreachable.

## Rebuilding the dataset

The dataset itself is out of this app's scope, but to regenerate it:

```bash
node scripts/build-dataset.mjs    # harvests local-products.json + category-index.json from Open Food Facts
node scripts/verify-dataset.mjs   # spot-checks image/product URLs and dedupe correctness
```

`gs1-prefixes.json` and `brand-alternatives.json` are curated by hand/research
rather than harvested.

## Running it

```bash
npm install
npm run build     # produces dist/ — also copies data/*.json into dist/data/
npm run test      # vitest: gs1 classification, matching/ranking, alternatives resolution
npm run preview   # serves the production build, if you want to check it locally
```

`npm run dev` starts the Vite dev server.

## Verified end-to-end (2026-09-10)

Real Plazma barcode, found via Open Food Facts: **8600043000016** (Bambi,
150 g). Live-fetched from `world.openfoodfacts.org` during development.

- Verdict: **SERBIAN** (prefix `860`, GS1 Serbia) — rendered instantly from
  the barcode alone, no network wait.
- Product lookup: `Plazma` / `Bambi`, `categories_tags` includes
  `en:biscuits`.
- Alternative resolved via brand-match (source `brand-match`):
  **Sempre**, by the Kosovo company **Liri** (Prizren) — a reported pairing
  with a source link, from `data/brand-alternatives.json`.

Camera scanning itself (BarcodeDetector vs. ZXing fallback) was exercised via
code review and the documented API surfaces, not a live phone — this
environment has no camera to test against. The barcode decode → verdict →
lookup → alternatives pipeline downstream of `onDetected(code)` is the same
code path exercised by the manual-entry flow above, which was fully
end-to-end verified against the real Open Food Facts API and the real
dataset files.
