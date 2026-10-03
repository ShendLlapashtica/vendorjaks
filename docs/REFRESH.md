# The scheduled refresh — how the catalogue stops being ten days old

**2026-09-16.** Every number in this file is marked **[measured]**
with the command that produced it, or it is not stated.

The owner's words are the spec:

> "the database seems stale . constantly update te gjitha with new info must
> never stay the same very day something new never the same these products been
> the same past 10 days"

He was right, and the reason was not the UI. `rotateWithinBand()` in
`src/lib/bestValue.js` reshuffles the same rows every three hours — that is
presentation, not freshness. **Nothing re-ran the harvest.** Every crawl this
project has ever done was a person typing a command, so the catalogue could not
change no matter what was done downstream of it.

---

## 1. The four pieces

| Piece | What it does |
|---|---|
| `scripts/xapi-crawl.mjs` | Unchanged. Owns the Xapi recon gate, robots.txt, currency verification and GTIN check digits. See `docs/XAPI-SOURCING.md`. |
| `scripts/merge-retail.mjs` | **New.** The merge that used to be a `node -e '…'` paste in `docs/XAPI-SOURCING.md` §6, now a real module with a dry run, a report, and unit tests. |
| `scripts/refresh-catalogue.mjs` | **New.** One command: re-crawl → merge → diff → hard gate → report. |
| `.github/workflows/refresh-catalogue.yml` | **New.** Daily cron at 04:15 UTC. Commits only what passed the gate, and the big files only when they actually changed. Vercel deploys from this repo, so the commit is the deploy. |

```bash
node scripts/refresh-catalogue.mjs                  # the real thing
node scripts/refresh-catalogue.mjs --dry-run        # whole cycle + gate, then restore the tree
node scripts/refresh-catalogue.mjs --skip-crawl     # merge + gate an existing crawl output
node scripts/refresh-catalogue.mjs --gates-only     # just run the gate on what is on disk
node scripts/refresh-catalogue.mjs --sources=buka,amg --limit=50   # smoke test
node scripts/refresh-catalogue.mjs --fast           # skip npm test/build (local loop only)
```

Also wired into `package.json`: `npm run refresh`, `npm run refresh:dry`,
`npm run refresh:gate`, `npm run merge-retail`, `npm run eval-alternatives`.

What it writes, and when each one is committed:

| File | Committed when | Why |
|---|---|---|
| `data/refresh-log.json` | **every run**, including no-change and gate-failure runs | The last 30 runs with the full gate verdict, the diff, and the currency metrics. A `changed: false` entry is the most honest thing in the repo. ~30 KB. |
| `data/price-history.json` | only when a price actually moved | See §4. |
| `data/kosovo-retail.json` | only when rows actually changed | 63 MB. See §5. |
| `data/kosovo-retail-xapi.json` | only when the crawl returned something different | Compared on `products` alone — the file's own `builtAt` changes every run by construction, and rewriting 1.9 MB so two timestamps can differ is the same dishonesty one layer down. |
| `docs/REFRESH.md` | every run | One table row appended at the bottom of this file. |

## 2. The gate — what may not be committed

A scheduled job that can write the catalogue is a scheduled job that can break
it at 04:00 with nobody watching. So the candidate is written to the real path,
every check runs against it for real, and **on any failure the previous file is
restored byte for byte and the process exits non-zero**, which fails the
workflow step and leaves the commit step unreached.

| Gate | Refuses |
|---|---|
| **G1** crawl floor | A crawl returning under 80% of the previous run's rows (min 100). A site redesign, a block or a DNS failure must not look like "the catalogue shrank". |
| **G2** row-count floor | A merged catalogue with fewer than 99.5% of the rows it started with. |
| **G3a-d** currency sanity | A shipped median price outside 0.30–20 EUR, a p90 over 60, more than 2% of rows over 100 EUR, or any shipped row in a currency other than EUR. **This is the scar — see §3.** |
| **G4** size ceiling | A catalogue over 90 MB. GitHub rejects a push containing a file over 100 MB outright. |
| **G5** prune-filter drift | `vite.config.js`, `src/lib/dataLoader.js` and the gate disagreeing about `BLOCKED_SOURCES`. If they drift, G3 measured the wrong set of rows. |
| **G6a-c** `scripts/eval-alternatives.mjs` | A non-zero exit, **any** `WRONG FAMILY` above 0, or `TOTAL LIES` above 0. |
| **G7** `npm test` | |
| **G8** `npm run build` | |

**A note on G6 that matters.** `eval-alternatives.mjs` sets a non-zero exit code
for `TOTAL LIES > 0` but **not** for `WRONG FAMILY > 0` — that number is only
printed. Since the house rules call `WRONG FAMILY` "THE NUMBER THAT MUST
NOT MOVE", trusting the exit code alone would let it move silently. So the gate
parses the eval's own output for every `WRONG FAMILY` line — there are two per
set, the tag-based one and the stricter independent check — and every one of
them must read 0. If no such line is found at all, that is a failure too: an
eval that did not run cannot be called a pass.

### The gate is proved, not described

`--inject-fault=<currency|empty-crawl|wipe|nonEurCurrency>` deliberately
corrupts the candidate after the merge and before the gate. It always runs with
the backup in place and the run always exits non-zero. Four proofs, all
**[measured]**, are in §7.

## 3. The currency scar, and the number nobody should forget

Albanian Lek prices were stored with `currency: "EUR"`. A 500 ALL deodorant
(about 5 EUR) became **"500.00 EUR"**. Nothing caught it, because every
individual row looked structurally fine — the tell was only visible in
aggregate.

**[measured]** `node -e` over `data/kosovo-retail.json`, 2026-09-16:

```
WHOLE FILE  91,012 priced rows   p10 1.09   median 150      p90 899   max 199,119
SHIPPED     32,858 priced rows   p10 0.60   median 1.75     p90 5.89  p99 24.90  max 319.99
            23 rows over 100 EUR (0.07%)
```

Two numbers, and the distinction is load-bearing:

- **SHIPPED** is the 33,039 Kosovo rows the build actually ships and the app
  actually renders, after `BLOCKED_SOURCES` (`gjirafa`, `wolt.com/al/`,
  `Wolt Shqipëri`) is applied. **The gate judges this set**, because this is
  what a shopper sees.
- **WHOLE** is all 91,197 rows on disk. Median 150.

**The Lek rows were never deleted.** 63.8% of `data/kosovo-retail.json` is
still Albanian-Lek-as-EUR; it is filtered at build time by `vite.config.js`'s
`closeBundle` and again at runtime by `dataLoader.js`. The gate **reports** the
whole-file median rather than judging on it, so no run can imply the file is
clean when it is not, and G5 exists so that removing the filter fails loudly
instead of shipping a 150-EUR median to production.

## 4. What is genuinely new in a refresh — measured, and it is not what you hope

I re-crawled five sources and diffed the result against the committed data,
field by field, rather than assuming a re-crawl produces news.

**[measured]** `node scripts/xapi-crawl.mjs --sources=buka,vipa,eurofood,amg`
(178 rows, 17 requests, 0.8 MB) diffed against `data/kosovo-retail-xapi.json`:

```
old rows (these 4 sources): 178 new rows: 178
added: 0 gone: 0
field-level changes across the overlap: {}
```

**[measured]** `node scripts/xapi-crawl.mjs --sources=maxi --limit=250` (250
rows, 252 requests, 26.6 MB) diffed the same way:

```
maxi rows in yesterdays file: 1698
re-crawled now: 250 | overlap: 250 | not seen before: 0
field-level changes over the overlap: {}
```

**428 rows re-crawled, zero changes.** Same day, so it is a weak test of
*daily* change and a strong test of something else: **the machinery is stable
and does not invent churn.** A re-crawl that produced spurious diffs would
commit 63 MB every night and call it freshness.

What this says about the realistic daily delta, honestly:

- **Four of the five sources publish no prices at all.** `bukabakery.com`,
  `vipa-ks.com`, `euro-food.org` and `amgketchup-ks.com` are producer
  catalogues; every price is written `null` with a `priceNote`
  (`docs/XAPI-SOURCING.md` §4.3). They cannot produce a price delta, ever.
- **`maxiks.shop` is the only price signal** — 1,698 priced rows. So the honest
  ceiling on "37 prices changed today" is 1,698 rows out of a 33,039-row
  shipped catalogue, about 5%.
- **Producer catalogues change on the order of months, not days.** A bakery
  adds a bread a few times a year.

So the daily delta will usually be **0 to a few dozen Maxi price moves, and a
new product every week or two**. On many days the honest report is "nothing
changed", and the refresh says exactly that rather than dressing it up. **The
real fix for "every day something new" is more priced sources, not a faster
cron** — and the largest one in Kosovo, Viva Fresh (about 7,400 products), is
robots-disallowed on the only path its data travels. See `docs/XAPI-SOURCING.md`
§8.

### The delta that actually happened on day one, and it was not a price

The first real end-to-end run found something the catalogue diff could not
show. **[measured]**, `node scripts/refresh-catalogue.mjs`, 2026-09-16:

```
  · maxiks.shop:       1698 rows · xapi verdict no-obvious-data-source
  · bukabakery.com:      40 rows · xapi verdict reverse-engineerable-embedded
  · vipa-ks.com:    NOT CRAWLED (xapi verdict blocked-do-not-build)
  · euro-food.org:       90 rows · xapi verdict no-obvious-data-source
  · amgketchup-ks.com:   20 rows · xapi verdict reverse-engineerable-embedded
```

**`vipa-ks.com` — Vipa Chips, the snack brand of Pestova sh.p.k in Vushtrri —
came back `blocked-do-not-build` from Xapi recon**, having been
`reverse-engineerable-embedded` the day before. Its 28 rows were not crawled,
and the crawler honoured the block rather than working around it. 1,876 rows
became 1,848.

The catalogue was completely unaffected: the merge only adds and patches, so
Vipa's rows from the previous crawl are still there and still answer a crisps
scan. Which means **the single most important fact about that run was invisible
in every catalogue-level number.** `crawlSourceDelta()` was added for exactly
this, and it now reports per source:

```
  THE CRAWL ITSELF MOVED (this never shows up in the catalogue diff,
  because the merge only adds and patches):
    · vipa-ks.com: 28 -> 0 rows  <-- this source produced nothing this run
```

That is the shape of a genuine daily delta in this project: not "37 prices
changed" but "a source went away, and here is which one". If Vipa stays blocked
its rows will go stale in place, and nothing in the current design notices —
**flagged, not fixed**: a per-row `lastSeenAt` and a staleness report is the
obvious next step and it is a schema change to rows the harvest owns.

### Price history — the decision, and why

**Prices are the only field that moves daily, so the refresh tracks them.**
`data/price-history.json` records observed price *changes* only: a row appears
the first time its price moves, never merely because it exists, with at most 8
observations per row, newest first, and a 5,000-row cap.

The reasoning: a shopper comparing a Serbian product to a Kosovar one cares
more about "this went up 18% this week" than about a new SKU appearing, and a
price is the one thing in this catalogue that is genuinely perishable. Recording
it costs nothing on a no-change day, because a file of changes is empty when
nothing changed. Recording every price every day would produce a 33,000-row ×
365 file, which is the 63 MB problem again in a new place.

The 5,000-row cap is a **payload** limit, not a repo one: `vite.config.js`'s
`closeBundle` copies all of `data/` into `dist/`, so both
`data/price-history.json` and `data/refresh-log.json` are shipped to the
browser. Only priced rows can ever enter the history, and `maxiks.shop` — 1,698
rows — is the only source in this crawl that publishes prices at all, so 5,000
is about triple the real ceiling and keeps the worst case under a megabyte. Add
a genuinely priced source and this number needs raising deliberately, with the
shipped payload re-measured.

The history file is written but **nothing in the app reads it yet** — exposing
it is a UI change and belongs to another lane. It exists so that when someone
does want to show a price trend, the data has been accumulating rather than
starting from that day.

## 5. The 63 MB question — measured, and the answer is not what it looks like

> **Read §5.1 with this section.** Its conclusion stands, but the clone cost
> quoted at the end of it was re-measured on 2026-09-18 and is wrong by about
> four times (a full clone of all history is 15.26 MiB, not 63 MB). §5.1 also
> carries the per-field byte table and the build-time size ceiling.

`data/kosovo-retail.json` is 63.1 MB and GitHub hard-fails at 100 MB. The fear
is that a daily commit bloats the repo within weeks. **I measured it instead of
assuming.**

**[measured]** Built two bare repos, pushed the real 63 MB catalogue as v1, then
pushed v2 = v1 plus 1,000 appended rows plus 400 changed prices, then `git gc`:

```
v1 alone, packed:                     5.38 MiB
v1 + v2, packed:                      5.46 MiB
the delta blob for one daily version:    11,738 bytes
```

**A daily commit of the whole 63 MB catalogue costs about 12 KB** in the
repacked pack — roughly 4 MB a year, not gigabytes. Git deltifies these
versions almost perfectly.

**But only because the new version is the old version plus an append plus point
edits.** This is why `merge-retail.mjs` is strictly append-only and never
re-sorts `products`, and why a refreshed row's key order is preserved. Re-sort
that array and every daily commit becomes a fresh 6.5 MB blob instead of 12 KB.

So the answer is: **commit the merged file, keep the merge append-only, and
guard the file size**, rather than restructure. The three alternatives and why
each was rejected:

- **Commit only the pruned 23 MB Kosovo-only file.** Would cut the size 64%,
  but it means *deleting* 58,158 rows the harvest produced, on the judgement
  of a cron job. The app already refuses those rows in two places; deleting them
  from the source of truth is a decision for the owner, not for this task.
- **Git LFS.** Solves the size but breaks the thing that makes this work: Vercel
  would need LFS fetch configured, and a 12 KB delta would become a 63 MB LFS
  object per day — strictly worse than what git already does for free.
- **Commit the crawl output only and merge at build time.** The cleanest
  long-term shape, and it would keep the big file out of daily commits
  entirely. It requires changing `vite.config.js`'s `closeBundle`, which is
  outside this lane and touches the shipped payload. **Flagged as the right
  next restructure** if the catalogue ever approaches 90 MB — G4 will say so.

Two costs of the chosen answer, stated rather than hidden: every `git clone` and
every CI checkout downloads 63 MB (the workflow uses `fetch-depth: 1` so it
downloads one version, not all of them), and each *push* sends a ~6.5 MB pack
before GitHub repacks it server-side.

## 5.1 The 63 MB question, re-measured 2026-09-18 — and one number in §5 is wrong

§5's conclusion holds: **commit the merged file, keep the merge append-only,
guard the size.** This section is what changed after re-measuring it, because
the cost §5 quotes for keeping the file is overstated by roughly four times
and that materially changes which restructure is worth doing.

### What a clone actually costs — [measured]

§5 ends: *"every `git clone` and every CI checkout downloads 63 MB"*. It does
not. Git transfers the pack, and the pack is the zlib-compressed, deltified
objects; 63 MB is what lands in the **working tree** afterwards.

```
git bundle create ... --all               15.26 MiB   <- a full clone, ALL history
git clone --no-local --depth 1  .git       9.55 MiB   <- what CI actually downloads
git clone --no-local --depth 1  on disk   83.19 MiB   <- what CI actually writes
git count-objects -vH            pack       4.31 MiB
```

Three versions of the 66 MB catalogue are already in this history. The whole
repository, every version of everything, is a **15.26 MiB** download. So the
running cost of the current design is a disk cost and a `git status` cost, not
a bandwidth cost, and "clones are expensive" is not a reason to restructure.

### What the file is actually made of — [measured]

`data/kosovo-retail.json` is 66,195,438 bytes, 91,197 rows, **726 bytes a
row**, on ONE line (it is already minified — the file contains zero newlines,
so "minify it" is not an available saving). Per-field cost, counting the key,
the value, the quotes and the separators:

| field | MiB | % | rows | distinct values |
|---|---:|---:|---:|---:|
| `countrySource` | 7.13 | 11.3 | 88,358 | **2** |
| `image` | 6.78 | 10.8 | 91,197 | 57,737 |
| `localEvidence` | 5.66 | 9.0 | 91,197 | 20,232 |
| `url` | 5.41 | 8.6 | 91,197 | 2,276 |
| `id` | 4.94 | 7.9 | 91,197 | 91,197 |
| `sourceLabel` | 4.06 | 6.4 | 91,197 | 73 |
| `matchKey` | 3.47 | 5.5 | 91,197 | 51,852 |
| `name` | 3.34 | 5.3 | 91,197 | 54,045 |
| `quantitySource` | 3.21 | 5.1 | 89,422 | 734 |
| `source` | 3.01 | 4.8 | 91,197 | 73 |
| everything else | 18.5 | 25.3 | — | — |

**13.84 MiB (21%) of the committed file is fields the app refuses at load.**
`src/lib/dataLoader.js#normalizeRetailProduct` rebuilds every row from a fixed
16-field whitelist, so `countrySource`, `country`, `matchKey`, `brandSource`,
`barcodeSource`, `previousPrice`, `crawledAt`, `ingredients`, `sourceKind`,
`priceNote`, `localEvidenceKind` and `flavour` are dropped before anything
sees them. Some of those the *scripts* need (`matchKey` keys the append-only
merge; `previousPrice` and `crawledAt` feed the refresh), but two are read by
absolutely nothing:

```
countrySource  7.13 MiB  88,358 rows  2 distinct values
country        1.26 MiB  88,358 rows  2 distinct values  ("XK" 30,200 / "AL" 58,158)
               --------
               8.39 MiB = 12.7% of the file, for zero information
```

`country` is exactly derivable from `source`/`sourceLabel` — its 58,158 `"AL"`
rows are precisely the 58,158 rows `BLOCKED_SOURCES` removes (91,197 − 33,039)
— and `countrySource` is one of two constant English sentences derived from
`country`:

> `"the shop this row was read from is a Albania grocery venue on Wolt"`

That sentence is also **the sold-in/made-by conflation this project's first
hard rule exists to forbid**, written 88,358 times into the source of truth,
one whitelist entry away from becoming a country claim in the UI. It was
already flagged as a known defect.

**It was not removed in this pass, and the reason is lane, not doubt.** The
field is written by `scripts/harvest-more.mjs:676`, which this pass does not
own, so a one-off strip would be undone by the next harvest — and a manual
step nobody will remember is worse than the 8 MiB. The durable fix is to stop
writing it there; it is one line, and the 8.39 MiB follows for free.

### What was done instead: the guard, where a harvest actually passes

§5 said "guard the file size" and gate **G4** does — at 90 MB, inside
`scripts/refresh-catalogue.mjs`, i.e. **only on the nightly run**. The thing
that would actually cross the wall is a manual `harvest-more.mjs` /
`merge-retail.mjs`, which never goes near G4.

So the ceiling now also sits in `vite.config.js` (`guardCatalogueSize`, a
`buildStart` hook, deliberately outside the `closeBundle` try/catch that turns
errors into warnings), because `npm run build` runs on every CI job and every
Vercel deploy and nothing can route around it:

- over **50 MB** — warn, and print the remaining headroom;
- over **95 MB** — throw and fail the build. 95, not 100: a failed build is
  recoverable, a committed 100 MB blob needs history rewriting. Above G4's
  90 MB so the nightly job still complains first.

`scripts/prune-payload.mjs` reports the same headroom, because it is the one
tool a human runs by hand after a harvest. It reports and does not enforce —
pruning the payload is read-only against `data/` and must not start failing
because of how big its input is.

**[measured]** the ceiling refuses, it is not merely described. With
`RETAIL_FAIL_BYTES` temporarily lowered to 1 MiB against the real 63.1 MiB
file, `npm run build` exited **1** at `buildStart`. Restored, `npm run build`
is green and the shipped payload is unchanged: `91197 -> 33039 rows, 23.2 MB`,
byte for byte what it was before this section was written.

Normal run:

```
[vendorja] data/kosovo-retail.json is 63.1 MiB — past GitHub's 50 MB file
warning, 31.9 MiB of headroom left before the build refuses.
```

```
$ node scripts/prune-payload.mjs
Input:  91197 rows, 63.1 MB
Output: 33039 rows, 23.2 MB
Reduction: 58158 rows (63.8%)
Source of truth: 63.1 MB of a 95 MB ceiling (GitHub refuses a push over
100 MB) — room for about 46,042 more rows at 726 bytes each.
```

### `.gitattributes` — protecting the 12 KB delta from a config flag

The entire "just commit it" strategy rests on one property: a new version is
the old version plus an append plus point edits, so git deltifies it to ~12 KB.
Two settings can destroy that silently, and one of them is **already true on
the machine this repo is developed on**:

```
$ git config --get core.autocrlf
true
```

With `autocrlf=true` and no attributes, git rewrites line endings on checkout
for files it considers text. For a data file that is not a formatting
preference, it is a content change: the blob hash moves and the delta chain
against the previous version breaks. `kosovo-retail.json` survives today only
by accident — it has no newlines at all — but **13 of the 15 files in `data/`
do** (`kosovo-retail-xapi.json` has 41,668, `kosovo-stores.json` 14,295), and
the day `merge-retail.mjs` writes the catalogue pretty-printed, the accident
ends.

`.gitattributes` therefore sets `data/*.json -text` (never convert, in either
direction) and `-diff` on the two big ones, so nothing tries to render a
textual diff of a 66 MB single line. **`-delta` is deliberately absent** — that
is the one attribute that would cause the bloat this is preventing.

**[measured]** the attributes cost nothing. Two bare repos, the real catalogue
as v1 and v1 + 1,000 appended rows + 400 changed prices as v2, `git gc` after
each:

```
without .gitattributes   v1 packed 5,537 KiB   v1+v2 packed 5,584 KiB
with    .gitattributes   v1 packed 5,537 KiB   v1+v2 packed 5,584 KiB
```

Identical: `text` and `diff` affect checkout filters and diff generation, not
packing. And `git add --renormalize data/` against the current tree produces
**zero** changed files, so adding the file is byte-neutral today.

### Left alone deliberately

- **Git LFS** — §5 rejected it and re-measuring strengthens that. A clone
  costs 15.26 MiB today; under LFS each daily version is a fresh ~63 MB
  object, Vercel needs LFS fetch configured, and the 12 KB delta is gone.
  Strictly worse on every number.
- **Commit only the pruned 23 MB file** — still deletes 58,158 rows on a
  cron's judgement. Owner's call, unchanged.
- **Commit the crawl output and merge at build time** — §5 calls this the
  right next restructure and it still is, *as an aspiration*. It is not
  available now: the merged file is the only complete copy. The crawl outputs
  that exist (`kosovo-retail-xapi.json`, 1.9 MB) cannot regenerate 91,197
  rows; the bulk came from harvest runs whose raw output was never kept. Doing
  this means re-harvesting first, which is a new dependency on sources that
  have already shown they can go `blocked-do-not-build` overnight (§4).
- **Stripping unread fields from the SHIPPED payload** (`dist/`) would be a
  real win on a Kosovo mobile connection and is entirely inside
  `vite.config.js` — but the brief for this pass required `npm run build` to
  produce *the same* pruned output, so it was not done. It is worth measuring
  next: the 23.2 MB payload carries `countrySource` on all 33,039 shipped rows
  and the browser throws every byte away at load.
- **`public/data/` is not in `.gitignore`.** `scripts/prune-payload.mjs`
  writes a 24 MB `public/data/kosovo-retail.json` there, `public/` is tracked
  and is copied into `dist/`, and nothing ignores it — so one `git add -A`
  after running that script commits a 24 MB duplicate of the payload. The
  artefact created while measuring this section was deleted rather than
  committed. `.gitignore` is out of scope here; the fix is one line:
  `public/data/`.


## 6. The diacritic fix in `src/lib/categoryFamily.js`

Reported with a repro by the previous pass (`docs/XAPI-SOURCING.md` §7) and
fixed here, because a stale catalogue and an unreachable catalogue are the same
problem from a shopper's side.

```
$ node -e 'import("./src/lib/categoryFamily.js").then(m=>{
    console.log(m.categoryFamilyOf(["Bukë Malësie"]), m.categoryFamilyOf(["Buke Malesie"]))})'
bread bread      # was: null bread
```

**[measured]** across all 91,197 rows, comparing the committed
`categoryFamily.js` against the patched one on the same tree: **4,709 rows gain
a family, 903 change family, 122 lose one.** The fold alone was *not* safe —
these are the three classes that got worse, and the traps for them:

1. **Compound aisles.** `KAFE, ÇAJ, KAKAO` is one shelf for coffee, tea and
   cocoa. Unfolded, `çaj` could not match the ASCII pattern `caj`, so `kafe`
   won and the shelf was coffee. Folded, `caj` matched first and **283 rows —
   every instant coffee on that shelf, Nescafé 3in1, Prince Caffe Devolli —
   became TEA.** Same shape for `Mjaltë & Reçel` (honey & jam): **183 rows of
   honey became jam.** Fixed by ordering `coffee` before `tea` and `honey`
   before `jams`, with the reasoning in the file. Cost, stated: 61 rows of
   genuine tea shelved under `KAFE & ÇAJ` now read as coffee. Net +222, and the
   properly correct fix — per-product name patterns for `Nescaffe`, `Te' Verde`
   — is a bigger change I did not make.
2. **Ingredient and packing modifiers.** Albanian names ingredients inline, and
   after folding the ingredient beat the product: `Spar Rolls Çokolladë Me
   Qumësht` → milk, `Despar Kos Me Krem Qumështi` → **milk, for a YOGURT**,
   `Siblou Tuna Në Ujë` → water, `Despar Kaneloni Me Vezë` → eggs, `Gjëmbak
   Qumështi Organik` → milk, for milk *thistle*. Fixed with a modifier strip
   that leans on the grammar: bare `qumësht` is the product (`Qumësht 1L`,
   `Alpsko Qumësht Çokollatë` — a milk drink, correctly milk), while `qumështi`,
   the definite form, is almost always a modifier.
3. **The worst gain, and it is not a diacritic at all.** `lëngshëm` is the
   Albanian adjective **liquid**, and it folds to `lengsh`, which contains
   `leng` — the pattern for juice. **643 rows carry it and 576 of those are
   the category "Detergjent të lëngshëm", LIQUID DETERGENT.** Without a trap the
   fold files Ajax Kitchen and Smac Sgrassatore in the juice family, so a juice
   scan could be answered with a bottle of degreaser — the "Kosovar cookie for
   a sunflower oil" failure this file exists to prevent. Trapped, and
   `detergjent` (which was simply missing from the cleaning patterns, the reason
   those 576 rows had no family to begin with) was added, so **2,107 rows of
   detergent now resolve to `cleaning` instead of nothing.**

Also fixed by the fold, as side effects worth naming: `Verë Lambrusco` stops
being fresh meat (it had matched `lamb` inside "Lambrusco"), `Bukë Hamburgeri`
stops being charcuterie (`ham` inside "Hamburgeri"), `Patëllxhan` stops being
charcuterie (`pate` inside the folded "patellxhan" — a false friend the fold
created, so the word is rewritten to `aubergine`), and `Kos i lëngshëm`
(drinking yogurt) stops being juice and becomes yogurt.

### The fold also fixes Explore's two columns, and the traps broke them first

Owner, 2026-09-12: *"elementary products that are living required to left. and
hygiene others to right."* `shelfSideFor` drives that split off the same family
map, and a product it cannot place falls to the right-hand household column.

**[measured]** across all 91,197 rows: **7,373 rows move from the household
column to the essential one** — yogurt (`BYLMET`, `Kos`), milk (`QUMËSHT`),
cream (`AJKË`), crisps, eggs (`VEZË`), spices (`Erëza`), wine (`Verë`),
chocolate, biscuits — every one of which was sitting in the hygiene column
purely because its properly spelt Albanian category could not be placed.

It went the wrong way first, and that is worth recording. `shelfSideFor` has a
free-text fallback for the case where no family resolves, and once the
`qumështi` trap correctly stopped calling a milk chocolate "milk", about 90 rows
of chocolate, caramel, biscuit and egg lasagne lost the family that had been
putting them on the food shelf *by accident* — and moved into the cleaning
column. A bar of Lindt is not a household product. Fixed by folding that
fallback too and adding the Albanian food words it was missing
(`cokollat`, `karamel`, `biskot`, `makaron`, `lasagne`, `oriz`, `qumesht`,
`bylmet`, `ereza`, `akullore`, `torte`, `embl`). **44 rows still move to
household and 42 of them are correct** — `Sapun i lëngshëm` (liquid soap),
`Detergjent Faks`, `Shampo me Qumësht` — all of which the old code had on the
FOOD shelf. The 2 that are wrong are `Lasagne Me Vezë` under the unplaceable
category `PRODUKTET E FTOHTA - TJERA`.

**The number that must not move did not move.** A/B on the same tree:

| | pre-fold | post-fold |
|---|---|---|
| WRONG FAMILY (all sets) | 0 | **0** |
| WRONG FAMILY strict (all sets) | 0 | **0** |
| TOTAL LIES | 0 | **0** |
| Set D same family | 549 | **553** |
| Set D family undetermined | 139 | **127** |
| Set E answered | 506 | **515** |
| Set E returned nothing | 327 | **318** |
| Set A alternatives returned | 453 | 449 |
| Set D alternatives returned | 688 | 680 |

The two `returned` counts going **down** is the change working, not failing: a
milk chocolate is no longer counted as `milk`, so a milk scan no longer offers
it. Fewer answers, each of which a shopper would actually accept.

**[measured]** `npm test`: **364 passed, 18 files** — 324 that already existed,
plus `src/test/categoryFamilyDiacritics.test.js` (23) and
`src/test/mergeRetail.test.js` (17). Every trap above has a test that fails if
it is removed, and every merge guarantee has one too; both files are new, so
neither collides with another lane.

## 7. Proving the gate refuses — [measured]

All four run as `node scripts/refresh-catalogue.mjs --skip-crawl --fast
--inject-fault=X`, and after every one of them `git diff --stat
data/kosovo-retail.json` was empty.

| Injected fault | Caught by | Verdict line | exit |
|---|---|---|---|
| `currency` — 20,000 shipped rows re-priced at Lek magnitude, still labelled EUR | **G3a, G3b, G3c** | `gates: 8/11 passed — FAILED: G3a, G3b, G3c` | 1 |
| `empty-crawl` | **G1**, before the merge even runs | `gates: 0/1 passed — FAILED: G1` | 1 |
| `wipe` — catalogue cut to 9,119 rows | **G2** | `gates: 10/11 passed — FAILED: G2` | 1 |
| `nonEurCurrency` — a row priced 500 ALL | the merge's own currency filter, upstream of the gate | `1 for currency`; every gate legitimately passes because the row never entered | 1 |

The `currency` proof in full:

```
  FAIL  G3a  shipped median price is a plausible grocery price
        median 80 EUR (allowed 0.3–20) · p10 1.05 · p90 415 · p99 2290 · max 31999 · 32858 priced rows
  FAIL  G3b  shipped p90 price is not a Lek magnitude
        p90 415 EUR (max allowed 60)
  FAIL  G3c  almost nothing on a grocery shelf costs over 100 EUR
        14483 rows over 100 EUR = 44.078% (max allowed 2%)
  ...
  RESTORED data/kosovo-retail.json and data/kosovo-retail-xapi.json from the pre-run backup (the gate failed).
  gates: 8/11 passed — FAILED: G3a, G3b, G3c
```

**The fourth proof found a hole in the proofs themselves.** With
`nonEurCurrency` the poisoned row is rejected by the merge, so the gate
correctly passes — and the run would have been treated as a *successful
refresh*, leaving the poisoned crawl output in `data/`. So a fault-injection run
now always restores the tree and always exits non-zero whichever way the gate
goes. A proof of the gate must not be able to write anything.

## 8. Two bugs the first real run caught, that a dry run would not have

Both are recorded because they are the exact failure mode the owner is
complaining about, produced by my own code.

1. **A 63 MB rewrite for a timestamp.** The first end-to-end run imported 0
   rows and refreshed 0 rows, the `products` array came back byte-identical —
   and `data/kosovo-retail.json` was still rewritten, because the merge stamped
   a fresh `mergedXapiAt` unconditionally. `git status` says "modified" and
   nobody diffs 63 MB, so this would have pushed ~6.5 MB every night for one ISO
   string, and looked like daily freshness while changing nothing. Confirmed by
   diffing every key against the pre-run backup:

   ```
   META DIFF mergedXapiAt : "2026-09-15T23:51:11.327Z" -> "2026-09-16T13:36:58.162Z"
   products identical: true
   ```

   Now `mergedXapiAt` only moves when a row did, and the candidate is not
   written at all unless the merge changed something.

2. **A commit message with nothing after the colon.** The same run reported
   `changed: true` with an empty headline, because the catalogue diff was all
   zeros while the crawl output had changed (Vipa dropping out). The workflow
   would have committed `Catalogue refresh: `. A refresh that claims a change
   owes an account of it in words, so the headline now has a branch for
   crawl-only changes and reads
   `no catalogue change, but the crawl itself moved: vipa-ks.com 28→0`.

And one found by the very first `--dry-run` of the merge, before any of this
ran: treating a `matchKey` collision as a same-source re-read reported
`DOMESTOS ATLANTIC FRESH 1L 2.15 -> 2.55` as a price move when no price had
moved. Two different `maxiks.shop` listings share that barcode. A re-read is
identified by `id`, never by `matchKey`; the test that locks it is in
`src/test/mergeRetail.test.js`.

## 9. What I could not do

- **Prove a day-over-day price delta.** Every measurement here is same-day, and
  same-day gives zero. The number the owner actually wants — "N prices changed
  overnight" — cannot be produced until the cron has run on two different days.
  The machinery to detect and report it is in place and tested; the number is
  not claimed.
- **Make the source file clean.** The Albanian-Lek rows are still in
  `data/kosovo-retail.json` (63.8% of it), filtered rather than deleted. G3
  judges the shipped subset and reports the contaminated whole-file figure so
  the difference stays visible, but deleting 58,158 rows is the owner's call.
- **Notice a source going stale.** Rows carry no `lastSeenAt`, so a source that
  is blocked indefinitely — Vipa, today — keeps answering scans with data of
  unknown age and nothing flags it. Needs a row-level schema change.
- **Add priced sources.** Four of the five sources publish no prices at all, so
  the daily delta has a hard ceiling of 1,698 rows however often the cron runs.
  Fixing "every day something new" properly means more sources, and the biggest
  one is robots-blocked.

---

<!-- RUN LOG — appended by scripts/refresh-catalogue.mjs, newest first -->

| run (UTC) | rows | products +/- | prices moved | verdict | what actually changed |
|---|---|---|---|---|---|
| 2026-09-16 13:50 | 91197 | +0 / -0 | 0 | no change | every source returned exactly what it returned last time — nothing new today, and that is the honest answer |
| 2026-09-16 13:41 | 91197 | +0 / -0 | 0 | changed | no catalogue change, but the crawl itself moved: vipa-ks.com 0→28 |
