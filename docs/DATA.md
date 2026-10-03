# Vendorja — Data Layer Documentation

Everything in `data/` is owned by a separate data-building workflow, not the
app itself. The app (`src/lib/dataLoader.js`) only ever reads these files —
it never writes to `data/`, and it degrades to an honest "not loaded yet"
state if a file is missing, unreachable, or in an unrecognised shape, rather
than crashing. This document describes each file as it exists on disk today.

All record counts and field shapes below were obtained by reading the actual
files in `data/`, not estimated.

## GS1 disclaimer (verbatim)

From `data/gs1-prefixes.json`'s `disclaimer` field:

> "GS1 prefixes do not identify the country of origin for a given product."

And from that same file's `notes` array (quoted in full, since every other
file's design follows from this):

1. "A GS1 'company prefix' identifies which national/regional GS1 Member
   Organisation issued the number to the brand owner -- i.e. where the brand
   owner registered -- not where the item was manufactured, assembled, or
   grown."
2. "A brand can register with one GS1 Member Organisation and manufacture
   (or contract-manufacture) anywhere in the world; multinationals often
   number all their products under one home-country prefix regardless of
   factory location."
3. "This table is therefore a REGISTRATION/ISSUER map, never a
   manufacturing-origin map. Vendorja must only ever say 'issued by GS1
   <X>', never 'made in <X>'."
4. "Ranges below reflect GS1's published global 'GS1 Prefix' allocation
   list. Multi-digit country prefixes (e.g. Germany 400-440) are contiguous
   blocks assigned to one Member Organisation, not one code per digit."
5. "381 is Kosovo's own, recently-assigned official GS1 prefix. 390 is
   officially assigned to Montenegro's GS1 Member Organisation, but is also
   documented as long having been used in practice by some Kosovo producers
   before/alongside 381 becoming available -- both are treated here as
   'local' for Vendorja's matching purposes, with 390 flagged distinctly as
   the legacy/shared case rather than Kosovo's own official range."

---

## `data/gs1-prefixes.json`

**Purpose**: the GS1 company-prefix → issuing-organisation lookup table.
This is the sole input to `classifyBarcode()` (`src/lib/gs1.js`), which
produces the instant, offline verdict (SERBIAN / LOCAL / OTHER / UNKNOWN).

**Provenance**: curated by hand/research from GS1's published global "GS1
Prefix" allocation list (per note 4, above) — not harvested from an API, and
not touched by either script in `scripts/`.

**Record count**: 136 entries in the `prefixes` array. Several ranges (e.g.
530/Albania, 531/North Macedonia, 860/Serbia) intentionally appear twice —
once as a general table entry and once again explicitly marked "Duplicate
entry retained for range-table completeness" — a deliberate defensive
redundancy, not a data-quality bug.

**Shape**:

```
{
  builtAt: string (ISO 8601 timestamp),
  disclaimer: string,
  notes: string[],           // 5 entries, see above
  prefixes: [
    {
      range: string,          // a single 3-digit prefix ("860") or, for some
                               // entries, a "min-max" range string
      country: string,
      isSerbia: boolean,
      isLocal: boolean,       // true only for 381, 390, 530
      note: string            // free-text rationale, see table in BUILD.md
    },
    ...
  ]
}
```

`src/lib/dataLoader.js`'s `normalizePrefixEntry()` is tolerant of several
alternate shapes for the range (`range` as `[min,max]` array, `rangeStart`/
`rangeEnd`, `prefixStart`/`prefixEnd`, `from`/`to`, or a single `prefix`/
`code`) — the on-disk file currently uses the `range: "NNN"` string form.

**Local/Serbian ranges** (see BUILD.md section 5 for the full note text):

| Prefix | Country | isSerbia | isLocal |
|---|---|---|---|
| 860 | Serbia | true | false |
| 381 | Kosovo | false | true |
| 390 | Montenegro (legacy Kosovo range) | false | true |
| 530 | Albania | false | true |

**Known weaknesses**: this is a curated, not harvested, table — its accuracy
depends on the research pass that built it, not on a live source. It is not
re-verified against GS1's official prefix list automatically; any future
GS1 reallocation would require manually updating this file.

---

## `data/local-products.json`

**Purpose**: the static pool of products used as candidate "local
alternatives" — walked by category tag in `collectStaticCandidates()`
(`src/lib/matcher.js`) and gated for eligibility before being shown.

**Provenance**: harvested by `scripts/build-dataset.mjs` from the Open Food
Facts search API (`https://world.openfoodfacts.org/api/v2/search`), querying
`countries_tags_en=kosovo` and `countries_tags_en=albania` separately, with
fields `code,product_name,brands,categories_tags,countries_tags,image_front_small_url,quantity`,
`page_size=100`, paginated until an empty page or the last page (per
`count`) is reached. The full list of 16 URLs actually used for the current
file is recorded verbatim in the file's own `sources` array.

**IMPORTANT — what "local" means here**: Open Food Facts' `countries_tags`
field records where a product is reported as **sold**, not where it was
manufactured. This file is explicitly built that way (see the script's own
header comment: "this script does NOT infer or claim manufacturing origin.
It only records what OFF itself reports"). It therefore includes imported
international brands and, in 32 cases, products whose own GS1 prefix
classifies as Serbian (860) — see Known weaknesses below. This is exactly
why the app-side eligibility gate exists (`isEligibleLocalCandidate` in
`src/lib/matcher.js`, documented in BUILD.md section 3): this file alone is
not sufficient evidence that a product is genuinely local.

**Record count**: `count: 716` (matches `products.length`).

Harvest accounting, from the file's own `harvest` field:

| | Kosovo | Albania |
|---|---|---|
| Raw rows fetched | 327 | 998 |
| Total pages | 4 | 12 |
| Pages skipped after exhausting retries | 0 | 2 (pages 11, 12) |

Drop counts (applied across both countries before dedup): 284 dropped for no
`product_name`, 306 dropped for no image — a row with neither cannot be
rendered as a real alternative tile, so it is dropped once at harvest time
rather than making every UI consumer defend against nulls.

**Shape**:

```
{
  builtAt: string (ISO 8601 timestamp),
  count: number,
  sources: string[],          // every OFF search URL actually fetched
  harvest: {
    rawCounts: { kosovo: number, albania: number },
    dropCounts: { noName: number, noImage: number },
    skippedPagesByCountry: {
      kosovo:  { skippedPages: number[], totalPages: number },
      albania: { skippedPages: number[], totalPages: number }
    }
  },
  products: [
    {
      code: string,              // barcode, deduped (first-seen wins)
      name: string,               // OFF product_name, required (non-null)
      brand: string | null,       // first of a comma-separated OFF `brands` list
      categoriesTags: string[],   // OFF categories_tags, general -> specific
      image: string,              // OFF image_front_small_url, required
      quantity: string | null,
      country: 'kosovo' | 'albania',  // which harvest query first found it
      prefix: string               // first 3 digits of `code`
    },
    ...
  ]
}
```

**Known weaknesses**:
- 32 of the 716 products carry a Serbian (860) GS1 prefix on their own
  barcode, despite being in the "local" pool — caught only by the app's
  runtime eligibility gate, not filtered out of this file itself.
- Only 171 of 716 (23.9%) carry a genuinely local GS1 prefix (381/390/530);
  the remainder are present purely because OFF tagged them as sold in the
  region.
- 389 of 716 (54.3%) have zero category tags at all, making them
  unreachable by the category-walk matching lane regardless of their
  prefix.
- Zero products in the current file carry the 381 (Kosovo's own) prefix;
  the 171 genuinely-local-prefix products split as 59 under 390 (legacy
  Montenegro/Kosovo-shared range) and 112 under 530 (Albania).
- The Albania harvest's pages 11 and 12 (of 12) were unreachable after
  exhausting retries, so roughly the last ~105 Albania-tagged products (2
  pages × up to 100) available on OFF at harvest time were never captured.
- `scripts/verify-dataset.mjs` HEAD-checks image/OFF-page reachability on
  only a random 25-product sample per run, not the full 716 — a passing
  verify run is evidence about that sample, not a guarantee for every row.

---

## `data/category-index.json`

**Purpose**: an inverted index from an Open Food Facts category tag to the
`local-products.json` codes carrying that tag, so the matcher can look up
"which local products are in category X" in O(1) instead of scanning the
whole product list per lookup.

**Provenance**: derived deterministically from `local-products.json` by
`scripts/build-dataset.mjs` in the same run that produces it (not
independently fetched).

**Record count**: 507 distinct category tags (`Object.keys(tags).length`).

**Shape**:

```
{
  builtAt: string (ISO 8601 timestamp),
  tags: {
    "<OFF category tag, e.g. 'en:dairies'>": {
      count: number,      // codes.length
      codes: string[]     // local-products.json barcodes carrying this tag
    },
    ...
  }
}
```

`src/lib/dataLoader.js`'s `loadCategoryIndex()` accepts this object either
directly at the top level, or nested under a `tags` or `index` key (the
on-disk file uses `tags`), and converts it into a `Map<tag, {count, codes}>`
at load time.

**Inverted-index structure and the general → specific ordering**: Open Food
Facts' `categories_tags` field lists a product's categories from most
general to most specific — e.g. a biscuit product's tags run
`["en:snacks", "en:sweet-snacks", "en:biscuits-and-cakes", "en:biscuits"]`.
The matcher (`categoriesMostSpecificFirst()` in `src/lib/matcher.js`)
reverses this order and walks the index from the *last* (most specific) tag
toward the *first* (most general), collecting eligible candidates at each
tier, so that a match on "en:biscuits" is preferred over a much broader
match on "en:snacks" if both exist. `build-dataset.mjs` notes that tag
*string length* is used only as a cheap, non-authoritative specificity hint
for consumers — OFF does not supply an explicit category-tree depth in this
field, so no consumer of this file should treat tag length as ground truth.

**Known weaknesses**: this index is only as complete as `local-products.json`
— a category with zero locally-eligible products will simply have no
reachable entries here, even if the tag itself is populated with imported
products (the index does not distinguish eligible from ineligible codes;
that filtering happens later, in `matcher.js`, against the live GS1 table
and curated brand set).

---

## `data/brand-alternatives.json`

**Purpose**: the curated, source-cited map from a known Serbian brand to
real Kosovo/Albania alternative brand(s). This is the **primary**
alternatives source — checked first, before the harvested product pool —
because a documented brand-level pairing is a stronger answer than a
same-category product match, and it works even for an alternative brand
with no e-commerce presence or product photo of its own.

**Provenance**: curated by hand/research (public sources, cited per entry);
not harvested by either script.

**Record count**: 21 entries in `entries`; **23 total alternative pairings**
across those entries (most entries have exactly one alternative, at least
one has more); **4 entries** in `gaps`.

Of the 23 alternative pairings, **`pairingEvidence` breaks down as**:

| pairingEvidence | Count |
|---|---|
| `reported` (documented in real reporting) | 3 |
| `category-match` (same-category reasoning only) | 20 |

**Shape**:

```
{
  builtAt: string (ISO 8601 timestamp),
  disclaimer: string,
  entries: [
    {
      serbianBrand: string,
      serbianCompany: string | null,
      category: string,
      offCategoryTags: string[],
      verifiedSerbian: boolean,
      sourceUrl: string | null,        // evidence the Serbian brand/company is real
      alternatives: [
        {
          brand: string,
          company: string | null,
          country: string,              // e.g. "kosovo"
          sourceUrl: string | null,
          evidence: string | null,
          pairingEvidence: "reported" | "category-match",
          pairingUrl: string | null     // source for the PAIRING claim specifically
        },
        ...
      ]
    },
    ...
  ],
  gaps: [
    { category: string, reason: string },
    ...
  ]
}
```

**The canonical entry** (Bambi/Plazma → Sempre), quoted in full since it is
the app's own worked example:

```json
{
  "serbianBrand": "Bambi (Plazma)",
  "serbianCompany": "Bambi a.d. Požarevac",
  "category": "biscuits",
  "offCategoryTags": ["en:biscuits", "en:sweet-biscuits"],
  "verifiedSerbian": true,
  "sourceUrl": "https://bambi.rs/en/brendovi/plazma/",
  "alternatives": [{
    "brand": "Sempre",
    "company": "Liri",
    "country": "kosovo",
    "sourceUrl": "https://prizrenpress.com/haradinaj-viziton-kompanine-liri-ne-prizren-ketu-prodhohen-produktet-me-te-mira/",
    "evidence": "Liri is a Prizren-based Kosovo manufacturer confirmed to produce Sempre biscuits; visited and named by the then-PM as a domestic producer.",
    "pairingEvidence": "reported",
    "pairingUrl": "https://kallxo.com/shkurt/media-serbe-sempre-ne-vend-te-plazma-s-menyra-e-re-e-patriotizmit-ne-kosove/"
  }]
}
```

This is the file's only `"reported"` pairing among the 23 total.

**The 4 documented gaps** (categories with no verified local alternative,
reasons quoted/summarized from the file):

| Category | Reason |
|---|---|
| `chocolate-confectionery` | Serbian imports (Štark's Bananica/Krem-banana, Cipiripi by Paraćinka) are confirmed high-volume, but no Kosovo/Albanian industrial-scale chocolate/wafer manufacturer comparable in scale was verified — only small artisan/pastry-shop makers were found, not a realistic mass-market substitute. |
| `cooking-oil` | Dijamant (Zrenjanin, Serbia) is a verified sunflower-oil producer; Albania has real olive-oil producers but that is a different product tier/price point than everyday sunflower/vegetable frying oil. No local sunflower/vegetable-oil refinery was found in Kosovo or Albania. |
| `cleaning-products` | No currently-active, verifiable major Serbian cleaning-product brand could be confirmed ("Merkur" turned out to be unrelated companies; "Merima" was absorbed by Henkel and discontinued in 2012). No specific Kosovo detergent brand could be attributed with a citable source. |
| `personal-care` | No currently-active, verifiable major Serbian personal-care/cosmetics brand was confirmed ("Vitex" turned out to be a Greek paint brand). A genuine Kosovo manufacturer (Pupla Group) was found but left unpaired rather than forcing a match against an unverified Serbian brand. |

**Known weaknesses**: 20 of 23 pairings (87%) are this project's own
same-category reasoning, not documented brand relationships — the UI labels
these differently (grey "same-category match" vs. green "reported pairing")
specifically because of this gap in evidence quality. Coverage is also
incomplete by the curators' own admission: 4 categories have no pairing at
all rather than a forced/invented one.

---

## `data/local-catalogs.json`

**Purpose**: best-effort research notes on Kosovo/Albania e-commerce
storefronts, used only to widen the curated-local-brand eligibility set
(`buildCuratedLocalBrandSet()` in `src/lib/brandAlternatives.js`) via a
best-effort brand-name extraction from each usable storefront's name. Not a
hard app dependency — `src/lib/dataLoader.js`'s `loadLocalCatalogs()`
degrades to an empty `usable` list if the file is missing, and the curated
brand set then relies on `brand-alternatives.json` alone.

**Provenance**: manual/research-driven web reconnaissance (checking real
storefronts for a machine-readable product API), recorded with an honest
pass/fail outcome and reasoning for every domain checked, not just the ones
that worked.

**Record count**: `usable`: 4 domains; `rejected`: 20 domains; `brandFindings`:
17 brand-existence checks.

**Shape**:

```
{
  checkedAt: string (ISO 8601 timestamp),
  usable: [
    {
      domain: string,
      platform: string,           // e.g. "woocommerce" | "shopify"
      endpoint: string,           // the working, machine-readable product API URL
      storeName: string,
      currency: string,
      sampleCount: number,
      exampleProducts: string[],
      hasImages: boolean,
      note: string                // caveats, e.g. "all prices are 0 -- showcase site"
    },
    ...
  ],
  rejected: [
    { domain: string, reason: string },   // why it could NOT be used (403s, dead DNS, no API, etc.)
    ...
  ],
  brandFindings: [
    {
      brand: string,
      found: boolean,
      where: string,               // URL(s) supporting the finding, or "not found online"
      note: string
    },
    ...
  ]
}
```

Of the 4 `usable` domains, only one (`vipa-ks.com`, Pestova Sh.P.K.'s Vipa
chips line) is both genuinely local *and* already named in the app's brief
as a target brand; `dyqanibio.com` is usable but almost entirely imported
goods (3 of 44 vendors are the store's own label); `shopstop.al` is a
general electronics importer, irrelevant to the FMCG use case;
`birrakorca.com.al` is a real Albanian brewery but Albania-delivery-only per
its own product text.

**Known weaknesses**: this file records a single manual research pass
(`checkedAt: "2026-09-10T19:47:00Z"`) over a hand-picked candidate list, not
a systematic crawl — the 20 `rejected` domains include real, verified Kosovo
brands/companies (e.g. Birra Peja, ABI Dairy, GjirafaMall) that were simply
found to expose no machine-readable product API at check time, not brands
that don't exist. A brand marked `found: false` in `brandFindings` (e.g.
Bimeri, Agrokultura, Tepelena, Bylis) means it could not be independently
verified in this pass — it is explicitly not asserted to not exist.
