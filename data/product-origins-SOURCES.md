# product-origins.json — sourcing notes

Built 2026-09-11. This file documents how `product-origins.json` was researched, what
"verified" means here, what was deliberately left out, and where the app should still
show uncertainty rather than a confident "prodhuar në Serbi" claim.

## Method

- Every entry required a real source that was actually fetched: a company's own
  "o nama" / "about us" / "istorijat" page, a news article about an
  acquisition/privatization, a retailer's printed "Zemlja porekla" (country of origin)
  declaration, or Open Food Facts' `manufacturing_places` / product-page field.
- Open Food Facts (`world.openfoodfacts.org`) was queried two ways: the search API
  (`/api/v2/search?brands_tags=...`), which was frequently rate-limited (HTTP 503 /
  "Page temporarily unavailable" — OFF's own maintenance page, not a real 503 half the
  time), and the stable per-barcode endpoint (`/api/v0/product/<code>.json`), which was
  far more reliable and was used to re-confirm most codes below individually.
- `companyCountry` = where the company is legally registered / headquartered.
  `productionCountry` = where the specific product is physically made. These are
  tracked as separate facts on purpose — a Serbian-registered company can be
  foreign-owned, and a foreign-registered brand can still be made in Serbia (see
  Doncafé below). Neither field is inferred from the other.
- `verified: true` is only set when a source explicitly stated the production
  location (an OFF `manufacturing_places` value, a retailer's origin declaration, or a
  company page naming its factory/city). `verified: false` on a barcode means the
  brand-level production location is verified but that *specific* barcode did not by
  itself carry an explicit per-product source (OFF's `manufacturing_places` field is
  very often blank even on genuine local/regional products) — treat it as "same
  brand, same factory, just not independently re-confirmed for this exact code."

## Headline findings

- **17 of the 23 Serbian-registered brands researched are foreign/multinational-owned**
  at the parent-company level, even though every one of them is genuinely a Serbian
  company (registered, headquartered, and largely produced in Serbia). This is the
  exact nuance a GS1-860 prefix cannot express: Coca-Cola HBC (Bambi, Rosa, Next),
  Atlantic Grupa/Croatia (Štark, Smoki, Grand Kafa, Doncafé), PepsiCo (Marbo
  Product/Chipsy), Mattoni 1873/Czechia (Knjaz Miloš), Molson Coors (Jelen),
  Carlsberg/Denmark (Lav), Nomad Foods/UK (Frikom), MK Group (Dijamant, Carnex — both
  Serbian-owned holding groups), Mid Europa Partners/UK private equity (Imlek), and a
  Cyprus holding company with a reported Serbian beneficial owner (Jaffa).
- Only **6 of the 23** are independently Serbian-owned with no outside stake found:
  Swisslion-Takovo, Cipiripi (Nestlé-owned 2011–2018, bought back into Serbian hands
  in 2018), Polimark, Nectar, VodaVoda, and Zlatiborac (family-owned).
- **Doncafé is the sharpest case of "prefix ≠ origin" found in this pass.** The same
  brand name is produced by two different Strauss-lineage entities: Strauss Romania
  makes it for the Romanian market (barcodes starting `594...`, confirmed via OFF
  `manufacturing_places: Romania` on three separate SKUs), while Strauss Adriatic
  d.o.o. makes it at Šimanovci, Serbia, for the regional/Kosovo market (barcodes
  starting `860...`, confirmed via an explicit retailer "Zemlja porekla: Srbija"
  declaration). **The barcode prefix, not the brand name, decides the country for this
  one** — do not apply one blanket answer to every "Doncafé" scan.
- **Jaffa** was double-checked against the possibility of confusion with the unrelated
  UK "Jaffa Cakes" (McVitie's) brand — it is a real, distinct, genuinely
  Serbian-manufactured product (Jaffa Crvenka d.o.o., Crvenka, since 1975), just held
  through a Cyprus holding company.
- **No brand on the required research list turned out to be entirely non-Serbian** at
  the company level (unlike the earlier Vitaminka/Bosnia precedent referenced in the
  brief) — every one of the 23 Serbian names checked out as a real, Serbia-registered
  company. The nuance that matters here is ownership and, in Doncafé's case,
  per-barcode production split, not misattributed nationality.
- **9 Kosovo brands + 1 Albanian brand** were verified as genuinely local producers,
  giving the app positive "made locally" confirmations, not just Serbian-flagging:
  Sempre/Liri, Vipa/Pestova, Birra Peja, Frutomania/MOEA, ABI, Rugove, Golden
  Eagle/Frutex, Sabaja, and Vita/Devolli Group (Kosovo), plus Birra Korça (Albania).
- **7 of 23 Serbian brands were paired with a real, sourced local alternative**
  (Bambi→Sempre, Štark/Smoki→Vipa/Sempre, Marbo/Chipsy→Vipa, Knjaz Miloš/Rosa/VodaVoda
  →Rugove, Next/Nectar→Frutomania/Mia Vita, Imlek→Vita/ABI, Grand Kafa→Prince Caffe,
  Doncafé→Prince Caffe Turke, Jelen/Lav→Birra Peja/Birra Korça). The remaining
  Serbian brands (Swisslion-Takovo, Cipiripi, Polimark, Vital, Dijamant, Carnex,
  Zlatiborac, Frikom) had no verifiable local competitor found in this pass and were
  left with an empty `alternatives` array rather than a forced/invented pairing.

## Per-brand notes worth flagging explicitly

- **Swisslion-Takovo**: genuinely Serbian-owned (DRD Swisslion / Rodoljub Drašković,
  no Swiss parent despite the name), but the group also runs a large plant in
  Trebinje, Bosnia and Herzegovina. Not every Swisslion barcode is Serbian-made — the
  `productionCountry: RS` on the brand entry is the general case, and one Bosnia-made
  SKU (`3875000050020`) is included in the barcode list specifically to show the
  exception.
- **Lav (beer)**: the only brand entry with `verified: false`. Ownership (Carlsberg
  Group, Denmark, since the 2003 privatization) is solid, but no OFF
  `manufacturing_places` record or retailer origin declaration for a specific Lav
  barcode could be independently fetched in this pass — production-in-Serbia is very
  likely (historic Čelarevo brewery) but not yet confirmed by a direct per-product
  source, so it is marked unverified rather than assumed.
- **Vital a.d. Vrbas** and **Carnex**: both are majority-owned by *Serbian* holding
  groups (Invej/Predrag Ranković, and MK Group respectively) — not the
  foreign/Sunoko/Danube-Foods ownership originally hypothesized in the research
  brief. Corrected here rather than repeating the wrong premise.
- **Dijamant**: was Fortenova Grupa (Croatian)-owned, but its own site states
  ownership formally transferred to MK Group (Serbian) on 23 June 2026 — so as of this
  file's build date, Dijamant is Serbian-owned again, not foreign-owned.
- **Frikom**: ownership hypothesis of "MK Group/Danube Foods" was wrong — it is
  UK-owned (Nomad Foods) via the old Agrokor/Fortenova (Croatian) chain, unrelated to
  MK Group's other Serbian food holdings (Dijamant, Carnex).

## Excluded — do not add without new evidence

- **Elkos Group / ETC (Kosovo)**: confirmed to be a distributor/retail chain (~90
  international brands) and a retail-center operator, not a manufacturer with its own
  branded product line. Elkos does run a small farmer-goods packaging depot
  ("Elkos Agrar Center," Rahovec) but no distinct consumer-facing brand name or
  barcode was found for its output. Per the hard rule against guessing, Elkos/ETC are
  **not** included as a "local producer" brand entry.
- **C Kafa (Strauss Adriatic)**: mentioned in earlier project research as a Serbian
  coffee brand, but was folded into the Doncafé/Grand Kafa research (same
  Šimanovci plant, same Atlantic Grupa ownership as of March 2024) rather than
  duplicated as a separate entry — treat Doncafé's evidence as covering it too if it
  is added later.

## Known gaps (real company, no barcode found)

- **Sempre**: Liri (Prizren) is a fully verified real manufacturer, but no EAN
  specific to the Sempre-branded SKU itself could be located; only sibling
  Liri-branded products have confirmed barcodes (e.g. `3901408430031`). No Sempre
  barcode is included — left out rather than guessed.
- **ABI (dairy, Prizren)**: fully verified as a real, established dairy producer, but
  Open Food Facts has zero indexed products under this brand and no barcode could be
  found through any source reached in this pass. No barcode entry included.
- **Sabaja**: confirmed real (Kosovo's first microbrewery, Hajvalija/Prishtina,
  since 2012) with two barcodes independently confirmed via Open Food Facts'
  per-product endpoint (`3908767440022`, `3908767440015`, both under the `390`
  prefix) — note that OFF's `brands_tags=sabaja` *search* endpoint returns 0 results
  for these same codes, so anyone relying only on that search endpoint could
  wrongly conclude no barcode exists; the direct per-barcode lookup is the more
  reliable source and is what is cited here.

## Barcode-prefix observation (not a certified GS1 fact)

Kosovo-linked local brands confirmed in this pass cluster heavily under EAN-13
prefix `390` (Rugove, Sabaja, Vipa, Golden Eagle) and `530` (Vita) — consistent with
`data/gs1-prefixes.json`'s existing note that `390` (officially Montenegro's GS1
range) has long been used in practice by Kosovo producers alongside the newer,
official `381` prefix. This file does not re-certify GS1 ranges (see
`gs1-prefixes.json` for that); it only records what individual barcodes were
actually observed to carry.

## Out of scope for this file (flagged for the task owner)

During this research pass the session also received requests to (a) add a
"who finances Serbia, how much tax each company pays the Serbian state, and an
estimate of resulting military growth" field, and (b) rebuild the app's UI. Both are
explicitly outside this file's job (curated origin data only) and the second is
explicitly out of scope for this data file. On (a) specifically:
no credible public source ties an individual company's tax payments to a specific
share of a state's military budget — publishing such a figure per company would mean
fabricating it, which is exactly the failure mode (a wrong "prodhuar në Serbi"-style
claim presented as fact) this whole file exists to prevent. This file sticks to
what a real source can support: registered company, verified production location,
and ownership structure.

---

## Addendum, 2026-09-16 — the Bimilk split-origin case

Reported by the owner: *"i saw a bimilk which is originally a NMK product get
labeled as serbian what an edgecase . be wary of those."*

### What was measured first

The catalogue holds 45 Bimilk rows. Three of them carry the barcode
`8601500111207` (`JOGURT BIMILK 1L 1% BALANS`), one carries `5310054000921`
(`Bimilk Jogurt Vita Bala.1%1L`), and the remaining 41 carry no barcode at all.
`860` is GS1 Serbia, so the prefix logic was working and the conclusion on
screen was still wrong. `8601500` is specifically **Imlek's own GS1 company
prefix** — `QUMESHT IMLEK 1L 3.2%` in the same catalogue is `8601500110057`,
one digit apart from the Bimilk yogurt.

The strongest single piece of evidence sits inside the catalogue: **the same
brand also ships on prefix `531` = GS1 North Macedonia**. One dairy, two GS1
offices, two different "countries" for the same product. Nothing demonstrates
"a prefix names a registration, not a factory" more plainly.

### Sources fetched (all HTTP 200, 2026-09-16)

1. **https://bimilk.mk/en/about-us/** — the producer's own about page.
   - *"Having a tradition since 1952, «Mlekara AD Bitola» (Joint Stock Company
     for Dairy Product Production- Bitola)"* … *"is today the largest producer
     of milk and dairy products in the Republic Macedonia"*.
   - Plant location, 1984 entry: *"the milk company relocated to brand new
     facilities located on the road to the village of Dolno Orizari"* and
     *"successfully carries out its operations on this location to this day."*
   - Ownership, 2007 entry: *"Mlekara Ad Bitola became part of the milk
     industry Danube Foods Group, meaning the Salford Investment Fund"* …
     *"at the end of 2007"*.
   - Ownership, 2015 entry: *"Danube Foods Group was acquired by the Mid Europe
     Partners Private Investment Fund."*
2. **https://amcham.mk/members/imb-mlekara-bitola/** — AmCham North Macedonia
   member listing: *"IMB Mlekara Bitola"*, *"Address: Gjurcin Naumov Pljakot,
   7000 Bitola, North Macedonia"*, website `bimilk.mk`, *"Member since: 2009"*.
3. **https://en.wikipedia.org/wiki/Imlek_a.d.** (rev. 1359546034) — Imlek is
   *"a Serbian food company based in Belgrade, Serbia"*, owner *"Mid Europa
   Partners"*; subsidiaries list includes *"AD IMB Mlekara Bitola, North
   Macedonia"*; *"In 2004, the "Salford Investment Fund" became the largest
   shareholder of Imlek."*; Mid Europa bought Danube Foods Group *"In February
   2015"*.

None of the three pages mentions barcodes, GS1 or EAN prefixes. The
registration fact comes from the number itself, not from them.

### Resolution written into the data

`brands[]` entry `Bimilk`, and two `barcodes[]` entries. The three facts are
carried in three separate fields and the app renders them as three separate
lines — it does not collapse them into one verdict word:

| fact | value | field |
|---|---|---|
| registration | GS1 Serbia, prefix 860 (Imlek company prefix 8601500) | derived from the barcode, `gs1Prefixes` |
| manufacture | Bitola, North Macedonia — Mlekara AD Bitola | `productionCountry: "MK"`, `productionCity: "Bitola"`, `verified: true` |
| ownership | Imlek a.d. (Belgrade) / Mid Europa Partners | `ownership`, `ownershipCountry: "RS"` |

Consequence in the UI: the flag follows **manufacture** (🇲🇰), because the flag
on a product row answers "where does this come from". The Serbian registration
keeps its own line, and the Serbian ownership gets an explicit disclosure chip.
Bimilk is therefore **not** greyed out as a Serbian product — it is not one —
but a shopper is told, in words, who owns the dairy.

### The generalisation — what was swept, and what was NOT reclassified

The owner said "be wary of those", so every `860`-prefixed row in the catalogue
was swept: 162 distinct brand heads across ~300 rows. **Only Bimilk got an
override.** Everything below was considered and deliberately left alone,
because leaving a correct-by-default verdict in place is cheaper than an
uncited reclassification:

- **Stella Artois (`8600105004501`), Tuborg (`8600102672253`), Pepsi
  (`8606003340116`)** — foreign brands on a Serbian prefix. The likely reading
  is the *inverse* of Bimilk (foreign brand, Serbian licensee production, i.e.
  Apatinska Pivara / Carlsberg Srbija / Serbian bottler), which would mean the
  current "Serbian" verdict is already right. **Not changed, and not
  re-certified either** — no production-location source was fetched for any of
  them in this pass.
- **Dr. Oetker (`8606015717777`), Thomy (`8607100571137`)** — same shape:
  German/Swiss brands registered through GS1 Serbia, plausibly produced at a
  Serbian subsidiary (Dr. Oetker d.o.o. Šimanovci). Plausible is not sourced.
  **Not changed.**
- **OSH / MSK stationery and houseware (`8605034…`, `8603603…`, ~40 rows)** —
  almost certainly Chinese-made goods registered by a Serbian importer, which
  would make the Bimilk treatment appropriate. No source names a factory.
  **Not changed.**
- **Inverse cases** — the "Chipsy 387" class (a Serbian producer on a Bosnian
  prefix) is already handled by `data/boycott-brands.json` and needs nothing
  here. No *new* inverse case was found with a source: no `381`/`390`/`530`
  (Kosovo/Albania) row in the catalogue could be tied to a Serbian producer by
  a fetched source, so none was reclassified.

The rule this addendum establishes: **one override = one fetched, quoted
source.** A hunch about a factory is not data, and a wrong "made in" claim is
worse than the hedge it replaces.

---

## Addendum, 2026-09-18 — the Fluidi case (the Bimilk mechanism, reversed)

Reported by the owner: *"and if fluidi or albanian product registered in serbia
dont mark as serbian product"*.

Bimilk was a non-Serbian product called Serbian because a Serbian parent
registered its barcode. Fluidi is the same mechanism pointed the other way,
and this direction is the worse one: an **Albanian/Kosovar product called
Serbian** tells a shopper to boycott exactly the local product this app exists
to send them to.

### What was measured first

Seventeen Fluidi rows ship. Five carry prefix `390` (the legacy Kosovo range)
and were already read as local. **One** carried a Serbian number —
`8600101990242`, `Fluidi Leng Fruta 200Ml`, listed by Maxi Supermarket — and
that is the row the owner saw. A second Maxi channel (`maxiks.shop`) publishes
the same product with the barcode corrupted to `8.60E+12`, which the harvester
already rejects as an invalid GTIN.

Sweeping outward from there produced a much larger finding. Of the catalogue's
91,197 rows, **99 sitting on a Kosovo or Albanian GS1 prefix (381/390/530) were
being called Serbian**. Ninety-four of them were a single brand.

### Sources fetched (2026-09-18)

**Fluidi is a Kosovar producer, and it bottles in Gjilan.**

1. **https://fluidigroup.com/production-operation/** — the group's own site.
   - *"Fluidi Group produces and operates out of their factory located in
     Gjilan."*
   - *"This is where their wide range of food and beverage products are
     created and later on shared with the rest of the world."*
2. **https://fluidigroup.com/about-the-company/**
   - *"What today is known as Fluidi Group started with our founding father
     Berat Mustafa in 1994 in Gjilan."*
   - The homepage, 28 June 2022: *"at the Fluidi Group factory in Gjilan"*.
3. **https://arbk.org/biz/fluidi-shpk/** — the Kosovo business register (ARBK
   Open, a mirror; the page says so itself).
   - *"Fluidi SH.P.K. është një shoqëri me përgjegjësi të kufizuara e themeluar
     më 22 nëntor 2004, e regjistruar në komunën e Gjilanit, në Velekincë"*,
     NUI 810281387.
   - Primary registered activity: *"1107 Prodhim i pijeve freskuese; prodhimi i
     ujit mineral dhe ujit tjetër në shishe"*.
   - **https://arbk.org/biz/fluidi-group-llc/** — Fluidi Group L.L.C., NUI
     811582651, *"P, n., Velekincë, Gjilan, Kosovo"*.
4. **https://eciks.com/fluidi-invests-over-3-million-euro-in-kosovo/**
   - *"The producer of beverages “Fluidi” From Gjilan has invested more than 3
     million euro in the installation of a new line for the production of the
     non-alcoholic “Jaffa,” an Israeli-American licensed drink."*
   - Albanian original, https://eciks.com/fluidi-investon-mbi-3-milione-euro/ :
     *"Industria e lëngjeve “Fluidi” nga Gjilani ka investuar më shumë se 3
     milionë euro"*.
5. **https://www.frotcom.com/blog/2019/02/frotcom-brings-improved-fleet-efficiency-fluidi**
   - *"As Kosovo's largest producer of soft and carbonated drinks, Fluidi Shkp
     produces approximately 40 million liters of beverages annually"*.
6. **https://rs.linkedin.com/company/fluidi-corporation** — notable because
   this is the *Preševo-headquartered* page, and it still says:
   *"Në vazhdën e zhvillimit ekonomik, në vitin 2004 Fluidi investoi duke hapur
   fabrikën e re në Gjilan ku lansoi teknologjinë më të fundit për prodhimin e
   lëngjeve të licensuara RC."*

**Why the barcodes are foreign — the producer says it himself.**

7. **https://buletiniekonomik.com/2026/02/produktet-made-in-kosova-marrin-identitet-nderkombetar**
   (also carried by mesazhi.com), 19/02/2026.
   - *"products produced in Kosovo have appeared on shelves in European and
     global markets labeled as coming from Albania or other countries."*
   - Fluidi's owner Berat Mustafa: *"I purchased barcodes in Albania because I
     had registered the company there and it was easier."*
   - Prefix `390` was a domestic-only stopgap set up by Kosovo's Chamber of
     Commerce in 2003; `381` is Kosovo's first internationally recognised
     prefix. This is the same fact `gs1-prefixes.json` already records, now
     with a producer attesting to the consequence.

**Jaffa Champion is Fluidi's juice. Jaffa Crvenka makes no drinks at all.**

8. **https://fluidi.net/eng/jaffa-champion/?lang=en**
   - *"Jaffa Champion Lemonade and Jaffa Champion Dredëz 1.5 will be the newest
     flavors in the local and international market from the Fluidi company."*
   - **https://fluidi.net/eng/rreth-nesh/** : *"In March 2003, it was the year
     when the world taste brand Jaffa Champion started its journey"*; the
     packaging list *"1.5L Plastik – 0.5L Plastik – 0.2L Qelq – 0.25L"* and the
     flavour list (Dredhëz, Portokall, Vishnje, Qershi, Pjeshkë, Mollë,
     Multivitamin, Ice Tea, Ananas) match the catalogue rows exactly.
   - **https://fluidi.net/brendet/** : Jaffa Champion fills six of the eight
     tiles on Fluidi's own Brands page.
9. **https://www.jaffa.rs/en/** — the Serbian Jaffa, in its own words.
   - *"We are Jaffa Crvenka, one of the largest sweets and snacks manufacturer
     in the West Balkans."*
   - **https://www.jaffa.rs/en/our-story/** : *"Our company was founded in a
     small Vojvodina town of Crvenka, way back in 1975"*.
   - Its complete brand list is *"Jaffa cakes"*, *"Munchmallow"*, *"Jaffa
     Wafers"*, *"Jaffa Kolači"*, *"Buttons"*, *"Jaffa Buttero"*, *"O'cake"*,
     *"Tak"*, *"Njamb"*. **Not one drink, nectar or juice.** Its only Kosovo
     link on that site is a distributor: *"Distributor for Kosovo — Albi Group,
     Priština"*.

So two unrelated producers use the Israeli place-name Jaffa: Crvenka for
biscuits since 1975, Fluidi for an Israeli-American-licensed juice since 2003.
The earlier pass on this file checked "Jaffa" against McVitie's Jaffa Cakes and
concluded it was genuinely Serbian; it did not know about Fluidi's juice, and
that is the gap this addendum closes.

### The caveat that is NOT being hidden

10. **https://www.botasot.info/kendi-biznesit/131829/kampion-i-lengjeve-natyrore-shije-e-paster-e-natyres-dhe-krenari-shqiptare/**,
    10 gusht 2011, interview with owner Bujar Mustafa:
    - *"Fabrikën për prodhimin e lëngje natyrore e kemi në Preshevë, ndërsa për
      pijet e ndryshme freskuese, si dhe për pijet energjike e kemi në Gjilan."*
    - *"Në këto fabrika prodhojmë: Fluidi, Jaffa Champion, RC Cola, RCQ, Red
      Rain, Orient Teas, Double Force, pije për fëmijë, si dhe lëngje në 'tetra
      pack'."*

**Fluidi has had a plant in Preševo, which is in Serbia**, and the company's
own site fluidi.net publishes *only* the Preševo address («FLUIDI» Sh.p.k,
Zujinski Str nr 5, 17523 Presevo, Serbia). That is recorded here rather than
suppressed. Three things bound it:

- The 2011 quote does **not** attribute any brand to either plant — the very
  next sentence lists every brand as coming from *"këto fabrika"*, both of them.
- Every source from 2019 onward (fluidigroup.com, Frotcom, ARBK, and the
  Preševo entity's own LinkedIn page) names **only** Gjilan as the production
  site. None says the Preševo plant closed, and this file does not claim it did.
- Preševo is an Albanian-majority municipality and the company is Albanian
  either way: Fluidi is not a Serbian company under any reading of any source
  fetched here.

So the brand entries carry `productionCountry: "XK"`, `productionCity: "Gjilan
(Velekincë)"` as the **general case**, exactly the way Swisslion-Takovo carries
`RS` as its general case with one Bosnia-made SKU held out in the barcode list.
If a source ever attributes a specific SKU to Preševo, that SKU gets a
barcode-level exception the same way.

### Resolution written into the data

`brands[]`: `Fluidi` and `Jaffa Champion`, both `productionCountry: "XK"`,
`productionCity: "Gjilan (Velekincë)"`, `verified: true`, `ownershipCountry:
"XK"`. `barcodes[]`: 43 GTINs, each with a `prefixNote` naming the GS1 office
that issued it.

| fact | value |
|---|---|
| registration | GS1 Albania (530) / legacy Kosovo (390) / GS1 Serbia (860, via the Preševo entity) |
| manufacture | Velekincë, Gjilan, Kosovo — `productionCountry: "XK"`, `verified: true` |
| ownership | Fluidi SH.P.K. / Fluidi Group L.L.C., Mustafa family, Gjilan — `ownershipCountry: "XK"` |

`resolveOrigin()` gained `locallyOwned`, the mirror of the `serbianOwned` field
Bimilk needed. Bimilk's bad news (Serbian owner, foreign factory) had a field;
Fluidi's good news (Kosovar owner, foreign-issued barcode) had nowhere to live.

`findVerifiedOrigin()` now reads the **exact barcode entry's brand before the
row's brand column**, and `findBrandMatch()` now lets an exact name beat a
contained one. Without both, all 43 curated Jaffa Champion barcodes were
unreachable: the bare brand column `"Jaffa"` matched the Serbian entry first
purely because it sits earlier in the file.

The name collision itself is fixed in `src/lib/boycott.js` (`BRAND_HOMONYMS`),
not by weakening the one-way rule. **A curated boycott hit still beats an
origin override** — `productStance()`'s `clearedBySource` still requires
`!boycott`, and the guard refuses to look at a `reason: 'barcode'` hit at all.
What the guard corrects is the *identification*: when a name-based hit lands on
a product the boycotted company demonstrably does not make, the hit was never
about that company. The test is positive-only — a row that cannot be shown to
be a drink keeps the verdict it had.

### Measured effect

Whole-catalogue diff, `productStance()` at HEAD vs. after, all 91,197 rows:

```
rows whose verdict changed:   189
  184  flagged/RS/muted  ==>  clear/XK/normal   (Jaffa Champion, prefixes 530 & 390)
    3  flagged/BR/muted  ==>  clear/XK/normal   (three rows on an in-store 790 code)
    2  flagged/XK/muted  ==>  clear/XK/normal   (had a Kosovo flag AND a boycott mark)
rows newly ACCUSED (was clear, now flagged):   0
```

`npm test` green, plus 22 new assertions in `src/test/fluidiOrigin.test.js`.
`npm run build` green. `node scripts/eval-alternatives.mjs`: **WRONG FAMILY 0**
plain and strict in every set, **TOTAL LIES 0**, Set C still 6 flagged Serbian
— unchanged from the 2026-09-16 baseline.

### The correction was invisible on the screen a shopper actually uses

Found by opening the page rather than trusting the unit tests. `/b/` — the
scan result, the app's primary surface — never adopted `productStance()`.
`App.jsx` was still calling `classifyBarcode` + `findBoycottByCode` itself,
so `productStance()`'s split-origin clearing had never applied there. The
consequence was live in production: **`/b/8601500111207` still said JO E JONA
under a Serbian flag**, more than two days after the Bimilk fix shipped and
passed its tests, because only `/eksploro`, the detail page and the
alternatives grid ask the shared function.

That is the same drift `flagTone.js` was written to end — *"no exception is
only achievable if every screen asks the SAME function"* — so `App.jsx` now
asks it, in both passes (the instant no-network verdict and the refinement
after Open Food Facts returns). It runs the identical barcode lookup, so the
verdict still renders without waiting on a fetch.

Wiring it up exposed three more defects, all fixed:

1. **The flag did not follow the factory.** `resolveOrigin()` has said since
   the Bimilk fix that *"the flag drawn on a product answers 'where does this
   come from', so it follows MANUFACTURE"*, but only surfaces reading
   `stance.stanceIso` honoured it; the result screens read `classify.iso`.
   `productStance()` now writes the manufacture country onto `classify`
   itself and preserves the registration in new `registrationIso` /
   `registrationCountry` / `registrationCountrySq` fields, leaving `prefix`
   and `isSerbiaPrefix` untouched. A verified **XK or AL** factory makes the
   verdict `LOCAL`, not merely `OTHER` — a Fluidi bottle is the local product
   the app is trying to point a shopper at, not a foreign one to shrug at.
2. **`ResultLocalScreen` printed a falsehood.** Its caveat is the hardcoded
   *"nuk është regjistruar në GS1 Serbi"*, and the Fluidi juice **is**
   registered with GS1 Serbia. On a split-origin product it now states the
   registration instead of denying it, and the line under the flag spells out
   the issuing office (`Kosovë · prefiksi 860 është regjistruar te GS1 Serbi`)
   rather than juxtaposing a country and a prefix that belong to different
   countries. `ResultOtherScreen`'s caveat got the same correction.
3. **The homonym guard could not see an Open Food Facts product.** A
   catalogue row carries its size in the title (`Jaffa Multivitamin 0.25L`);
   OFF splits it into `quantity` and `categories_tags`. Reading only `name`
   meant the same juice cleared on `/eksploro` and stayed accused on the scan
   screen. `looksLikeDrink()` now reads name, quantity, category and tags.

One consequence worth stating plainly, because it looks like a miss: a **live
scan** of Bimilk still shows JO E JONA. Open Food Facts reports that yogurt's
brand as `Imlek`, which is a curated boycott entry, and the one-way rule says
a curated hit wins. This is unchanged from before this pass (it was verified
in the browser first), it is the rule working as written, and it is not
something an origin override is allowed to overturn. The catalogue rows for
the same product, which carry `brand: "Bimilk"`, do clear.

Verdict and flag can no longer disagree: the split-origin rewrite is gated on
`!boycott`, so when a boycott hit stands it stands whole. Without that gate
the app would have drawn a greyed **Macedonian** flag over JO E JONA — the app
accusing the wrong country out loud. The rewrite is also refused when the
verified factory is in Serbia, so this path can move a flag OFF Serbia and
never onto it; upgrading a product TO Serbian still requires a curated
boycott entry.

### Final gates

- `npx vitest run` — **553 passed, 26 files**, including the 25 in the new
  `src/test/fluidiOrigin.test.js`.
- `npm run build` — green, `✓ built in 2.00s`.
- `node scripts/eval-alternatives.mjs` — **WRONG FAMILY 0** plain and strict
  in Sets A, B and D; **TOTAL LIES ACROSS ALL SETS: 0**; **Set C 6 flagged
  Serbian**, unchanged from the 2026-09-16 baseline.
- Browser, dev server on :5199, console filtered to errors
  only → **no console errors** on `/b/…` or `/eksploro`.
  Checked by eye: `/b/8600101990242` (Kosovo flag, "vendore", registration
  stated), `/b/5304000430238` (Kosovo flag, prefix 530 named as GS1 Albania),
  `/b/8600114000013` (Jaffa Cakes, still JO E JONA under a grey Serbian flag),
  `/b/8601500111207` (Bimilk, see above), `/eksploro`.

### Considered and REFUSED — no source, no override

The same sweep surfaced more rows that look like the same error. None got an
override, because none could be sourced in this pass, and the rule from the
Bimilk addendum holds: **one override = one fetched, quoted source.**

- **`Rosa Kripe Paketim I Zi 500Gr` and `Rosa Himalaya Kripore 250Gr`**
  (`5301000311338`, `5301000313103`, prefix 530 = GS1 Albania, 3 rows). Flagged
  because "rosa" is the Serbian water brand (Coca-Cola HBC). A water bottler
  selling Himalayan table salt is implausible, and an Albanian-prefixed salt is
  very likely an Albanian packer — but no source naming that packer could be
  fetched. **Not changed.** This is the strongest remaining candidate.
- **`Smoki Flips Pi&Ki 25Gr`** (`3900334991432`, prefix 390, 2 rows). Smoki
  genuinely is Soko Štark's, so the hit may simply be correct with a locally
  registered number. Unresolved either way. **Not changed.**
- **`Rc Bitter Lemon 0.5L`** on `8606112181099` (prefix 860). RC Cola *is*
  Fluidi's licensed line in Kosovo and the identical product also ships on
  `3902076611395`, but `8606112` is not one of Fluidi's company prefixes — the
  only other product on it is a pepper corer — so this looks like a retailer
  attaching the wrong number. Guessing which reading is right is not sourcing
  it. **Not changed.**
- **The three `790…` Jaffa Champion codes** (`7900001142101`, `…224`, `…385`)
  are almost certainly a retailer's in-store numbers, not GTINs, so they were
  deliberately left OUT of `barcodes[]`. They clear through the brand lookup
  instead, which is the honest route: nothing here certifies an internal code.

Three further "jaffa" hits are certainly wrong but belong to producers outside
this pass's scope, so they are recorded rather than fixed: `Milka Biskote Çoko
Jaffa Portokall 147G` (Mondelez), `Vit Jaffa Frutti 336G` (Vitaminka, North
Macedonia) and `Dorina Jaffa 100G` (Kraš/Dorina). All three are biscuits or
chocolate using "jaffa" as a flavour word, and all three are still flagged
Serbian. They need either a narrower alias in `boycott-brands.json` (out of
scope here) or their own sourced entries.

Also observed while sweeping, and left alone as out of lane: the 860/861 block
holds 364 rows across 164 brand heads, and nothing in it besides Fluidi, Jaffa
Champion and the already-handled Bimilk reads as an Albanian or Kosovar
producer. The OSH/MSK stationery and the Dr. Oetker / Thomy / Stella Artois /
Tuborg / Pepsi cases flagged in the 2026-09-16 addendum are all still
unsourced and all still unchanged.
