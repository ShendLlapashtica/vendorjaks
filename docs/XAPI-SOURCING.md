# Xapi sourcing — what Xapi can actually do for Vendorja, and what it can't

**2026-09-16.** Written after reading the Xapi source on disk and
making real requests against the live deployment. Every claim below is marked
**[code]** (read in the source, with file:line), **[measured]** (a request I
made, with its result), or **[inferred]**.

The owner's ask was:

> "find using xapi always for everything hire him to fetch data that is close
> always" / "xapi is a weapon waiting to be used for crawling alternative
> finding"

He is right about the direction. The gap is narrower and more specific than
"Xapi can't do it": **Xapi's recon organ is genuinely usable from this repo
today, for free, with no token. Xapi's `wrap` organ is not usable for a
grocery catalogue — not because of permissions, but because of its shape.**

---

## 1. Where Xapi lives

- Source on this machine: `C:\Users\Shend\Desktop\llapi-scan-main\Xapi-master`
  (the private consolidated repo). `C:\Users\Shend\Desktop\Xapi` is a much older,
  unrelated tree — a Twitter/X client (`rettiwt-api`, `src/xClient.ts`) with a
  component-verification worker. It has no `wrap` organ. Do not read that one.
- Live deployment: `https://xapi.prishtina-online.workers.dev` **[measured]**

  ```
  $ curl -s https://xapi.prishtina-online.workers.dev/version
  {"sourceRevision":"5b8c5ed33545e3b0dd2fa1365534f79b7e954dfa",
   "buildTime":"2026-09-11T20:49:17.861Z","instanceId":"xapi-worker"}
  ```

  It answers from this shell in ~160 ms. No Vercel-IP problem here.

## 2. The source-wrapping flow, as the code actually defines it

**[code]** `src/wrap/wrap-api.ts`, `src/api/wrap-route.ts`, `src/wrap/wrap-caps.ts`.

1. `POST /admin/wrap { url, email }` → recon runs first
   (`assessReverseEngineerability`).
2. If the verdict is one of `reverse-engineerable-api`,
   `reverse-engineerable-embedded`, `cors-only-proxy-legit`
   (`MINTABLE_VERDICTS`, wrap-api.ts), it **scrapes one thing**:
   - api verdict → the single JSON endpoint recon found reachable;
   - embedded verdict → `__NEXT_DATA__` or JSON-LD on the one page.
3. The result is serialised, size-checked, written to R2 as **one object**, and
   an API key is minted (`mintApiKey`, sha-256 hash stored, plaintext shown
   once). `GET /api/wrapped/:id?key=…` then serves that stored snapshot.

Fetching goes through a multi-proxy fallback chain, `src/lib/proxied-fetch.ts`:
direct → `api.allorigins.win` → `api.codetabs.com` → `api.cors.lol`, plus an
opt-in incogsearch 5th tier **[code, proxied-fetch.ts:44,140,158,166]**.

### Why this cannot wrap a Kosovo grocery catalogue

Three hard facts from the code, not from an opinion:

| Limit | Where | Consequence here |
|---|---|---|
| **One endpoint per wrap.** `scrapeSource()` fetches exactly one URL and returns. | `src/wrap/wrap-api.ts:146` | No pagination, no sitemap walk, no per-product follow-up. Maxi's catalogue is 1,698 product pages. |
| **5 MB snapshot cap.** `MAX_SNAPSHOT_BYTES = 5 * 1024 * 1024` | `src/wrap/wrap-caps.ts:13` | The Maxi crawl alone pulled **177 MB** of HTML (measured) to produce its 1,698 rows. |
| **Full `ADMIN_TOKEN` required** (read-only token gets 403). | `src/api/wrap-route.ts:47` | Not a blocker in principle — the owner has the token — but it makes `wrap` an owner-operated action, not something a repo script runs unattended. Per the standing credential rule, no token was read or relayed for this work. |

`wrap` is built for *"this site has one JSON endpoint that is the data"* — the
TCS fuel-radar case. A retail catalogue is a crawl, not a snapshot.

### What IS usable from this repo, today, with no token

**[code]** `src/api/router.ts:422` routes `POST /admin/recon` with no auth check;
the endpoint's own self-description in the router index says
*"public, no token, per-IP rate-limited (20/60s)"*.

**[measured]** It works from this shell:

```
$ curl -s -X POST https://xapi.prishtina-online.workers.dev/admin/recon \
    -H 'content-type: application/json' -d '{"url":"https://gjirafamall.com/"}'
{"verdict":"blocked-do-not-build","confidence":"high","root":{"kind":"server-block"}, ...}
```

So `scripts/xapi-crawl.mjs` **hires Xapi as the gate**: every source is
reconned by Xapi before a single product page is fetched, and the verdict,
confidence, root kind, detected framework and probed endpoints are written into
the output file as provenance. A `blocked-do-not-build` or `auth-required`
verdict aborts that source — Xapi's refusal is honoured, not worked around.

Other public, tokenless routes that may be worth using later **[code, router.ts]**:
`POST /admin/scout` (a proposal → similar repos + competitor sites reconned),
`GET|POST /admin/listings` (schema.org listings from a classifieds source),
`POST /recall`. Token-gated and therefore owner-operated:
`/admin/incog/fetch` (the encar-style header-profile → owner-proxy → relay →
R2-cache chain, with `robotsDisallowed` reported and never bypassed),
`/admin/incog/search`, `/admin/wrap`.

### The one real capability gap, precisely stated

**Xapi recon only reads the served HTML.** `fetchSafe` in
`src/recon/reverse-engineerability.ts` fetches the page (and, per its own
comment at line ~392, "the HTML plus up to two of its own script bundles") and
regex-scans it for `__NEXT_DATA__`, JSON-LD, inline JSON and same-origin `/api/`
strings. It does not execute JS and does not observe network traffic.

Measured consequence: **every modern client-rendered Kosovo shop comes back
`no-obvious-data-source` even when a perfectly good endpoint exists.**

| Site | Xapi verdict **[measured]** | Reality **[measured]** |
|---|---|---|
| `online.vivafresh.shop` | `no-obvious-data-source`, framework `next.js` | Real API at `/lib/config/proxy.php?endpoint=…`, found by downloading and reading chunk `6217-97f1948562d520cf.js` |
| `maxiks.shop` | `no-obvious-data-source`, framework `null` | `GET /search/suggest` with no query returns the **entire 1,698-product catalogue** in one 722 KB response |
| `bukabakery.com` | `reverse-engineerable-embedded` | An open **WooCommerce Store API** at `/wp-json/wc/store/v1/products` — this should have been `reverse-engineerable-api` |

**If one thing were added to Xapi for this job**, it is that: after the HTML
scan finds nothing, download the page's own JS chunks and regex them for
endpoint strings, and probe the handful of well-known platform paths
(`/wp-json/wc/store/v1/products`, `/products.json`, `/wp-json/`, `/graphql`,
`/sitemap.xml`). Both are plain fetches of public URLs — no new capability, no
new ethics. That alone would have turned three `no-obvious-data-source`
verdicts into three correct ones in this pass.

The second thing, if the owner wants `wrap` itself to cover retail: a paginated
wrap mode (follow `?page=N` / a sitemap, cap at N pages, store as N R2 objects)
and a snapshot cap above 5 MB.

---

## 3. What was sourced

Kosovo only. Candidates were checked against the 36 distinct `source` values
already in `data/kosovo-retail.json` (31,975 Kosovo rows after the Albania
block); none of the four below was already there.

### Crawled

| # | Source | Who | How it yields data | robots.txt |
|---|---|---|---|---|
| 1 | `maxiks.shop` | **Maxi Supermarket** — Kosovo chain, 19 retail points in Prishtina, 3 open 24 h (`maxiks.com`) | `GET /search/suggest` with no query returns the whole catalogue as HTML cards; each `/product/<slug>` page then carries `item_id`, a `€` price in a hidden input, category/subcategory/childcategory, the gallery image and a `Barkodi:` field | `User-agent: * / Disallow:` — everything allowed |
| 2 | `bukabakery.com` | **Buka Bakery** — Kosovar bread/pastry producer, founded 2012, 100+ staff, 16 locations (15 inside the Meridian Express network) | Open **WooCommerce Store API**, `/wp-json/wc/store/v1/products?per_page=100&page=N` | allows all but `/wp-admin/` and some `wc-logs` upload paths |
| 2b | `vipa-ks.com` | **Vipa Chips** — the snack brand of **Pestova sh.p.k**, Vushtrri: one of Kosovo's largest potato processors (est. 1991), selling into 8 EU countries. Crisps, flips, stix, popcorn, extruded snacks | same open **WooCommerce Store API** | allows all but `/wp-admin/` and some `wc-logs` upload paths |
| 3 | `euro-food.org` | **Eurofood sh.p.k** — Rr. Turgut Ozal, Prizren. Ajvar, ketchup, mayonnaise, jams, syrups, pickles, vinegar, juices, water | `products.php?category=1..10`; each card carries `data-product-name/-image/-weight/-shija` | no robots.txt served (404) — permitted by default; still throttled |
| 4 | `amgketchup-ks.com` | **AMG Foods** — Ballofc, Podujevë 11000. *"Fabrika për prodhimin dhe përpunimin e produkteve ushqimore."* Ketchup, mayonnaise, **senf (mustard)**, pickles | server-rendered Elementor grid on `/produktet/` | allows all but `/wp-admin/` |

### Checked and NOT crawled — and exactly why

These are also recorded machine-readably in `rejectedSources` inside the output
file, so nobody re-spends the hours.

| Source | Why not |
|---|---|
| **`online.vivafresh.shop`** — Kosovo's largest retailer, 110+ stores, ~7,400 products across 75 sitemaps | **robots-disallowed.** Its `/product?id=N` pages are client-rendered Next.js with no data in the HTML. All product data flows through `/lib/config/proxy.php?endpoint=…` (found by reading the site's own JS chunk). Its robots.txt contains `Disallow: /lib/`. The only data path is the one the site asks crawlers to stay out of. Not crawled. **This is the single biggest missed prize and it is missed on purpose.** |
| **`gjirafamall.com`** | Xapi recon returned `blocked-do-not-build`, confidence high, root `server-block`. Xapi's own gate refuses it and so do we. |
| **`gertifoods.com`** — Kosovar bakery, Prizren | robots.txt is `Allow: /` for pages but `Disallow: /api/`, and the product data is behind `/api/`. Worth a later HTML-only pass over `/products`. |
| **`madein-kosova.com`** — directory of Kosovar producers with a "Mayonnaise and ketchup" section | DNS does not resolve from this machine (`EAI_AGAIN`); Xapi recon reported root `server-error`. Worth a retry from another network — a producer directory would cover many weak categories at once. |
| **`essigroup.eu`** | Real Kosovar producer, but `products-sitemap.xml` lists **5** products, all "444 Extra" tea. |
| **`abi-center.com`** — ABI sh.p.k, Prizren (took over the PROGRES fruit-and-veg factory in 2001 with ELIF 19) | Xapi recon `reverse-engineerable-embedded` (WordPress + JSON-LD), but `sitemap_index.xml` has no product post type — corporate site, nothing to crawl. |
| `elkosgroup.com`, `frutomania.com`, `rugove.com` | Xapi recon `no-obvious-data-source` on all three — corporate/brochure sites, no product listing. |
| `albimarket.com`, `meridianexpress.com`, `emonagroup.com` | Xapi recon `reverse-engineerable-embedded` (WordPress), but `/wp-json/` shows **no WooCommerce namespace** on any of them — brochure sites for chains with 35 / 36 / 9 physical stores. Nothing to crawl. |
| `vivafresh.shop`, `smardonline.com` | 403 / DNS failure from this shell. |
| `foleja.com`, `gjirafa50.com`, `e-baa.com` | Reachable, but electronics/homeware, not groceries. |

---

## 4. The honesty gates, in code

All of these are enforced in `scripts/xapi-crawl.mjs`, not just described.

1. **`isLocalBrand: true` needs proof.** Two admissible kinds, and every row
   states which one in `localEvidence`:
   - **GS1 barcode** — the row's own barcode is a **check-digit-valid** GTIN
     (8/12/13/14) whose prefix is 381 / 390 / 530. `data/gs1-prefixes.json` is
     the authority (`isLocal: true` on those three ranges only).
   - **Producer citation** — the row comes from a Kosovar producer's own
     website, and the evidence string names the company, its Kosovo address and
     the page it was read from. A row with producer-citation evidence and **no**
     barcode says so explicitly: *"the locality claim rests on the producer
     citation alone, not on a GS1 prefix."*

   A barcode that says *foreign* always wins over a producer citation — the
   producer override is applied only when the barcode gate did not already
   return `false`.

   "Sold by a Kosovo shop" is never used as evidence. Maxi rows are local only
   when their own barcode says so.

2. **Barcodes are validated.** Maxi's `Barkodi:` field is frequently
   Excel-mangled scientific notation (`#7.90E+12`) — those are **dropped**, not
   stored. Where the gallery image filename is itself a valid GTIN (Maxi names
   product photos after the barcode) it is used as a **second, separately
   labelled** source: `barcodeSource` says which, and the check digit is
   verified either way.

3. **Currency is verified, never assumed.** Maxi ships
   `<input id="set_currency" value="€">`; the crawler reads it and refuses to
   write a price when it is not `€`, and applies a 0.05–400 EUR plausibility
   band. **Known-product check [measured]:** `COCA COLA 1.25L` = **1.45 €**,
   `BIRRA PEJA CRUDO QELQ 0.33L` = **0.89 €**. Both are real Kosovo shelf prices
   in euro; in Lek they would be ~145 / ~89. The currency is EUR.

   Both WooCommerce producer stores report **every** price as `"0"` —
   `bukabakery.com` in `GBP`, `vipa-ks.com` in `EUR`. Neither is a price: they
   are unpriced catalogues. Both are written as `price: null, currency: null`
   with a `priceNote` saying exactly that. A `0` is a missing price, not a free
   product, and writing it as `0.00 EUR` would be the same class of bug as the
   Lek-as-EUR one that cost this project 64.5% of its catalogue.

4. **robots.txt is obeyed.** Fetched and parsed per host (longest-match wins,
   Allow beats Disallow on a tie), checked before every request, and a blocked
   URL is counted and skipped. Nothing is routed around.

5. **Kosovo only.** All four sources are Kosovo-registered companies with
   published Kosovo addresses. No Albanian venues.

---

## 5. Running it

```bash
node scripts/xapi-crawl.mjs --recon-only            # just the Xapi verdicts, no crawling
node scripts/xapi-crawl.mjs --sources=buka,eurofood,amg
node scripts/xapi-crawl.mjs --limit=25              # cap products per source (smoke test)
node scripts/xapi-crawl.mjs                         # everything -> data/kosovo-retail-xapi.json
```

Flags: `--sources=a,b` · `--limit=N` · `--out=PATH` · `--recon-only` ·
`--no-recon` · `--concurrency=N` (default 3) · `--delay=MS` (default 500, per
worker). The Xapi recon calls are spaced 3.5 s apart to stay well inside the
public 20 req / 60 s limit.

Measured result of the full run (2026-09-16, `node scripts/xapi-crawl.mjs
--concurrency=3 --delay=400`):

```
=== TOTAL ===
  1876 rows -> data\kosovo-retail-xapi.json
  proven local: 363
    · by GS1 barcode prefix:  185
    · by producer citation:   178
  not local (foreign GS1):    991
  undetermined (null):        522
  priced: 1698 · with quantity: 1519
  http: 1717 requests, 177.4 MB, 0 errors, 0 robots-blocked
```

Per source: `maxiks.shop` 1,698 · `euro-food.org` 90 · `bukabakery.com` 40 ·
`vipa-ks.com` 28 · `amgketchup-ks.com` 20. Currency distribution across the
whole file: **EUR 1,698, null 178, nothing else**. Every row has a
`localEvidence` string, and every `isLocalBrand:true` row names which of the
two admissible evidence kinds it rests on (checked: 0 rows fail either test).

Output: **`data/kosovo-retail-xapi.json`** — a new file. It carries
`builtAt`, `xapi` (which endpoint was used and which was not and why),
`honestyGates`, `sources[]` (each with its full Xapi recon report, robots rules
and crawl notes), `rejectedSources[]`, `stats` and `products[]`.

## 6. The merge — now a real script, and it runs itself

**Superseded 2026-09-16.** The `node -e '…'` paste that used to live
here was not testable, could not be called from a scheduled job, and rewrote a
63 MB file from a shell heredoc. The same logic, with the same guarantees, is
now `scripts/merge-retail.mjs`, and it is run unattended every day by
`scripts/refresh-catalogue.mjs` behind a hard gate. **Read `docs/REFRESH.md`.**

```bash
node scripts/merge-retail.mjs --dry-run     # report what would land, write nothing
node scripts/merge-retail.mjs               # merge into data/kosovo-retail.json
npm run refresh                             # re-crawl + merge + gate, the whole cycle
```

What carried over unchanged: de-duplication on `id` then on `matchKey`, the
incumbent winning a collision, and the refusal to import a row whose currency
is anything but EUR or null.

What is new, and it is the part that makes a *refresh* mean anything: an
incoming row whose **`id`** already exists is not a duplicate, it is a re-read
of the same listing on the same site, so the fresher read updates that row's
volatile fields — price, name, category, image, url, quantity — and the change
is reported. Identity and sourced claims (`barcode`, `isLocalBrand`,
`localEvidence`, `brand`, `matchKey`) are frozen: locality is evidence, not a
shelf reading, and a cron job may not move it. A `matchKey` hit is still a
plain skip even when the sources match, because the crawl output genuinely
contains 16 duplicate matchKeys — two different `maxiks.shop` listings carrying
one barcode — and treating the second as a re-read of the first invented a
price change that had not happened.

The merge is also strictly **append-only** and never re-sorts `products`. That
is load-bearing rather than tidy: measured, a daily commit of the 63 MB
catalogue costs ~12 KB in the repacked pack precisely because the new version
is the old one plus an append plus point edits. See `docs/REFRESH.md` §5.

**Measured 2026-09-16**, the merge of this file into the catalogue as it stands:

```
$ node scripts/merge-retail.mjs --dry-run
  incoming rows:                 1876
  imported (new products):       0
  refreshed (same source re-read): 0
  identical, nothing to do:      1064
  skipped, product already covered by another row: 812
  skipped, currency not EUR:     0
  rows: 91197 -> 91197
```

The 1,064 rows from the original pass are already in the catalogue (they were
merged; `mergedXapiAt` is set and `count` is 91,197) and the 812
duplicates are almost all Maxi products the catalogue already holds via
`wolt.com/maxi-supermarket`. **The decision left open is unchanged:**
this merge keeps the incumbent Wolt row on a GTIN collision, while the direct
`maxiks.shop` row is arguably better (a real category path, the shop's own
photo, a price straight from the retailer). Flipping it is a one-line change in
`merge-retail.mjs` — turn the `matchKey` skip into a field-level merge — but it
rewrites rows the harvest owns, so it is still not done.

Then, in order (all of these are gates G6-G8 inside `refresh-catalogue.mjs`, so
the scheduled run already does them):

```bash
node scripts/verify-local-brand-gate.mjs     # the gate must stay green
node scripts/eval-alternatives.mjs           # WRONG FAMILY must still be 0
npm test && npm run build
```

**Do not merge without re-running `eval-alternatives.mjs`.** The number that
must not move is `WRONG FAMILY = 0`.

## 7. Weak-category coverage — measured, not claimed

Measured by resolving every new row through the repo's own
`src/lib/categoryFamily.js` (`categoryFamilyOf([category, name])`) and counting
only rows with `isLocalBrand === true`. The weak list came from the finder's
own misses.

| Weak family | Proven-local new rows | Where from |
|---|---|---|
| `ketchup-tomato-sauces` (5 misses) | **27** | Eurofood + AMG + Vipa |
| `mayonnaise-dressings` (2) | **14** | Eurofood + AMG |
| `mustard` (2) | **2** | AMG (SENF 550 g, 5 kg) — the only Kosovar mustard found anywhere |
| `bread` (3) | **7** (+17 more blocked by the diacritic bug below) | Maxi own-label |
| `savoury-snacks` (3) | **6** | Vipa Chips (Pestova) |
| `crisps` | **12** | Vipa Chips |
| `salt` (1) | **2** | Maxi (`EURONI KRIPE KUZHINE 900g`) |
| `charcuterie` (1) | **1** | Maxi (`MEKA SALLAM PULE EXTRA 350GR`) |
| `breakfast-cereals` (3) | **0** | still none — see gaps |
| `nut-butter` (3) | **0** | still none |
| `spirits` (1) | **0** of 11 rows | 11 new spirits rows, none with a Kosovo/Albania GS1 prefix |
| `dried-fruits`, `milk-pudding`, `soups-ready-meals` (1 each) | **0** | still none |

### A finder bug this data exposes — Albanian diacritics (H's lane, not fixed here)

`categoryFamilyOf` lowercases but does not fold diacritics, so every Albanian
category spelt properly misses its family. Reproducible in one line:

```
$ node -e 'import("./src/lib/categoryFamily.js").then(m=>{
    console.log(m.categoryFamilyOf(["Bukë Malësie"]), m.categoryFamilyOf(["Buke Malesie"]))})'
null bread
```

`Bukë` → `null`, `Buke` → `bread`. Measured on this output file: **45 rows have
no family today and would get one** if `[category, name]` were folded with
`.normalize("NFD").replace(/[̀-ͯ]/g,"")` before token matching —
17 of them `bread`, 14 `waters`, 6 `tea`, 4 `milk`, 4 `juices`. Nearly all of
Buka Bakery's 22 real breads are in that group, because its WooCommerce
category is literally `Bukë`.

Caveat, honestly: 48 other rows would *change* family under the same fold, and
not all of those look like improvements (`CORNY BIG QUMËSHT 50G` becomes `milk`,
which it is not). **FIXED 2026-09-16** in `src/lib/categoryFamily.js`, with traps for
the cases where the fold made things worse and the eval re-run behind it: the
45/48 measured here turned out to be 4,709 gained / 903 changed / 122 lost
across the whole 91,197-row catalogue, `WRONG FAMILY` stayed 0 on both checks,
and `lëngshëm` (Albanian for LIQUID) would have filed 576 rows of liquid
detergent as juice. Full account and the A/B numbers in `docs/REFRESH.md` §6.

## 8. Known gaps after this pass

- **Viva Fresh stays out** (robots). It is the largest single prize in Kosovo
  retail and it is the one source a polite crawler cannot take. If the owner
  wants it, the honest routes are (a) ask Viva Fresh for the feed, or (b) if
  the `Disallow: /lib/` is incidental rather than deliberate, ask them to
  narrow it. Neither is a code change.
- **Peanut butter and cornflakes/breakfast cereal**: no Kosovar producer was
  found on this pass either. `madein-kosova.com` (unreachable from here) is the
  best remaining lead. Until one is found, *"there is no local alternative"*
  remains the correct answer for those two — it must not be papered over with
  an invented pairing. (Bahra Biscuit Factory turns out to be **Azerbaijani**,
  not Kosovar; it is not a lead.)
- **Spirits, dried fruits, milk pudding, ready soups** still have no
  proven-local row. For spirits the likely producers are Kosovo's Rahovec-area
  wineries/distilleries; none of the obvious domains resolved from this machine
  (`stonecastle-ks.com`, `bodrumiivjeter.com`, `suharekawinery.com` all
  `ENOTFOUND`). Worth a proper search next pass rather than domain guessing.
- **Brand is null on every Maxi row.** The product page does not publish it;
  Maxi has a `/brands` page that was not crawled. Brand derivation from the
  title is the finder's job, not this crawler's.
