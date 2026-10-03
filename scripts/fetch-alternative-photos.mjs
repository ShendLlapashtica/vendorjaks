#!/usr/bin/env node
// fetch-alternative-photos.mjs — sources ONE product photo per Kosovar/
// Albanian alternative brand in data/brand-alternatives.json, from that
// producer's OWN official website, and records the provenance.
//
// WHY THIS EXISTS. The owner's requirement (2026-09-12) is blunt: "this
// vipa chips alternative MUST HAVE A PHOTO". Every alternative brand in
// brand-alternatives.json is brand-level — most of these producers have no
// e-commerce presence, no barcode in Open Food Facts and no row in
// data/kosovo-retail.json, so there is no photo to inherit from the product
// pool. OFF returns count 0 for brands_tags=sempre and brands_tags=peja.
// The only honest source left is the producer's own site.
//
// RULES ENCODED HERE (these are not negotiable, they are the whole point):
//
//   1. SOURCE = THE PRODUCER'S OWN SITE, nothing else. No image search, no
//      stock, no retailer listing, no blog. Each MANIFEST row names the
//      exact page the image was taken from; `imageUrl` must live on that
//      producer's own domain (or the CDN their own site serves from, which
//      is annotated where it happens — prima.al is built on Zyro and serves
//      its assets from assets.zyrosite.com).
//
//   2. PROVENANCE IS RECORDED FOR EVERY FILE. These are the producers'
//      promotional pack shots and the app sends customers TO them, but
//      `imageSource` + `imageCredit` go into brand-alternatives.json for
//      every single image so any producer's objection can be actioned by
//      deleting one row.
//
//   3. A WRONG PACK SHOT IS WORSE THAN NONE. Every image in MANIFEST was
//      eyeballed before it was added. Brands where no photo could be
//      confidently attributed are in GAPS, with what was tried — they get
//      no `image` key at all, and the app shows them without one.
//
//   4. POLITE. robots.txt is honoured (see isAllowedByRobots), one request
//      at a time, REQUEST_DELAY_MS between them, a Referer of the page the
//      image appears on, and no bot-protection bypass of any kind.
//
// RE-RUNNABLE. `node scripts/fetch-alternative-photos.mjs` re-downloads
// every file, re-optimises it, rewrites the image fields in
// data/brand-alternatives.json (leaving every other field untouched) and
// regenerates data/alternative-photos-report.json. `--dry-run` does the
// network work and reports without writing anything.
//
// IMAGE OPTIMISATION. Target: <=800px on the long edge, <=150KB, JPEG or
// WebP. The repo has no image library (no sharp, no ImageMagick), so the
// resize/re-encode is done by a small inline Python/Pillow program (see
// PY_OPTIMISE). If Python or Pillow is missing the download still happens,
// the file is kept as fetched, and the report flags it as unoptimised
// rather than silently shipping a 2MB PNG.

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'public', 'alternatives');
const DATA_FILE = path.join(ROOT, 'data', 'brand-alternatives.json');
const REPORT_FILE = path.join(ROOT, 'data', 'alternative-photos-report.json');
const PUBLIC_PREFIX = '/alternatives';

const MAX_EDGE = 800;
const MAX_BYTES = 150 * 1024;
const REQUEST_DELAY_MS = 1200;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const DRY_RUN = process.argv.includes('--dry-run');

// ---------------------------------------------------------------------------
// THE MANIFEST — one row per photo. `pageUrl` is the producer's own page the
// image is published on and is what lands in `imageSource`; `imageUrl` is the
// asset itself. `crop` (fractional [left, top, right, bottom]) is only used to
// trim non-product furniture the producer baked into the same asset, and is
// recorded so the result is reproducible rather than hand-edited.
// ---------------------------------------------------------------------------
const MANIFEST = [
  {
    key: 'vipa-chips',
    file: 'vipa-chips.webp',
    format: 'WEBP',
    brandLabel: 'Vipa Chips',
    pageUrl: 'https://vipa-ks.com/en/product-category/chips-en/',
    imageUrl: 'https://vipa-ks.com/wp-content/uploads/2020/04/07-Classic.png',
    credit: 'Pestova sh.p.k. / Vipa Chips (official site)',
    shows: 'Vipa Classic Ribbed Chips salted potato-crisp bag, transparent-background pack shot.',
  },
  {
    key: 'sempre',
    file: 'sempre.jpg',
    format: 'JPEG',
    brandLabel: 'Sempre',
    pageUrl: 'https://liriprizren.com/',
    imageUrl: 'https://liriprizren.com/images/slides/sempre.jpg',
    credit: 'Liri Prizren (official site)',
    shows: 'Liri homepage slide for its Sempre brand: Sempre carton plus loose biscuits, strapline "Shendeti dhe shije".',
  },
  {
    key: 'frutomania',
    file: 'frutomania.jpg',
    format: 'JPEG',
    brandLabel: 'Frutomania',
    pageUrl: 'https://frutomaniaks.com/',
    imageUrl:
      'https://frutomaniaks.com/__l5e/assets-v1/9165144f-4df3-4d9b-9c1a-8a863e42d536/home-hero-bottles.png',
    credit: 'MOEA / Frutomania (official site)',
    shows: 'Five Frutomania juice bottles (0% added sugar) with the fruit each is pressed from.',
  },
  {
    key: 'rugove-water',
    file: 'rugove-water.jpg',
    format: 'JPEG',
    brandLabel: 'Rugove (water)',
    pageUrl: 'https://rugove.eu/en/products/water-rugove/',
    imageUrl: 'https://rugove.eu/wp-content/uploads/2025/10/Eng-Pallet-info-web-01.jpg',
    // Rugove publishes the bottle and a logistics "pallet info" strip in one
    // asset; the strip is cropped off so the card shows the product only.
    crop: [0.24, 0.0, 0.76, 0.7],
    credit: 'Korporata Rugove (official site)',
    shows: 'Rugove 1.5L spring-water bottle from the product page for Rugove water.',
  },
  {
    key: 'rugove-cheese',
    file: 'rugove-cheese.webp',
    format: 'WEBP',
    brandLabel: 'Rugove (cheese)',
    pageUrl: 'https://rugove.eu/en/products/cheese-rugove/',
    imageUrl: 'https://rugove.eu/wp-content/uploads/2023/09/djathe400-1.png',
    credit: 'Korporata Rugove (official site)',
    shows: 'Rugove branded cheese tub, transparent-background pack shot from the Rugove cheese product page.',
  },
  {
    key: 'birra-peja',
    file: 'birra-peja.webp',
    format: 'WEBP',
    brandLabel: 'Birra Peja',
    pageUrl: 'https://birrapeja.com/products/lager/',
    imageUrl: 'https://birrapeja.com/wp-content/uploads/2025/08/BP-Lager_0000.webp',
    credit: 'Birra Peja sh.a. (official site)',
    shows: 'Birra Peja Premium Lager 0.33L bottle, transparent-background pack shot from the Lager product page.',
  },
  {
    key: 'birra-korca',
    file: 'birra-korca.webp',
    format: 'WEBP',
    brandLabel: 'Birra Korça',
    pageUrl: 'https://birrakorca.com.al/en/',
    imageUrl: 'https://birrakorca.com.al/wp-content/uploads/2021/09/blonde_beer_korca_720x.png',
    credit: 'Birra Korça sh.a. (official site)',
    shows: 'Birra Korça blonde-beer line-up: 1928 bottles and cans with a poured glass.',
  },
  {
    key: 'vita',
    file: 'vita.webp',
    format: 'WEBP',
    brandLabel: 'Vita',
    pageUrl: 'https://www.qumeshtorjavita.com/',
    imageUrl:
      'https://www.qumeshtorjavita.com/wp-content/uploads/2025/11/Vita_Qumesht_3.2_1L-04-Nsh.webp',
    credit: 'Qumështorja Vita / Devolli Group (official site)',
    shows: 'Vita qumësht 3.2% 1L UHT milk carton, transparent-background pack shot.',
  },
  {
    key: 'abi',
    file: 'abi.jpg',
    format: 'JPEG',
    brandLabel: 'ABI',
    pageUrl: 'https://abimilk.com/en/products/',
    imageUrl:
      'https://abimilk.com/wp-content/uploads/2024/05/WhatsApp-Image-2024-05-20-at-15.24.35_d6d7add0-640x638.jpg',
    credit: 'ABI sh.p.k. (official site)',
    shows: 'ABI jogurt bottles on the ABI dairy line, ABI roundel logo on the label.',
  },
  {
    key: 'prince-caffe',
    file: 'prince-caffe.webp',
    format: 'WEBP',
    brandLabel: 'Prince Caffe',
    pageUrl: 'https://devollicorporation.com/en/',
    imageUrl: 'https://devollicorporation.com/wp-content/uploads/2017/02/2-premium-web.png',
    credit: 'Devolli Corporation / Prince Caffe (official site)',
    shows: 'Prince Premium Espresso Caffe bag, transparent-background pack shot from Devolli Corporation\'s coffee range.',
  },
  {
    key: 'prince-caffe-turke',
    file: 'prince-caffe-turke.webp',
    format: 'WEBP',
    brandLabel: 'Prince Caffe Turke',
    pageUrl: 'https://devollicorporation.com/en/',
    imageUrl: 'https://devollicorporation.com/wp-content/uploads/2021/03/1-Turke-web-1.png',
    credit: 'Devolli Corporation / Prince Caffe (official site)',
    shows: 'Prince Caffe "Caffe\' Turca Princ" Turkish-coffee pack, transparent-background pack shot.',
  },
  {
    key: 'miell-diamond',
    file: 'miell-diamond.webp',
    format: 'WEBP',
    brandLabel: 'Miell Diamond',
    pageUrl: 'https://mielldiamond.com/',
    imageUrl: 'https://mielldiamond.com/wp-content/uploads/2025/09/MIELL-Classic.webp',
    credit: 'Miell Diamond (official site)',
    shows: 'Diamond "Miell Gruri Classic" wheat-flour sack with the Diamond roundel logo printed on it.',
  },
  {
    key: 'prima',
    file: 'prima.jpg',
    format: 'JPEG',
    brandLabel: 'Prima (flour and pasta)',
    pageUrl: 'https://prima.al/produkte',
    // prima.al is built on Zyro and serves its own site assets from
    // assets.zyrosite.com — this is Prima's own image on Prima's own site,
    // not a third-party host.
    imageUrl: 'https://assets.zyrosite.com/dJoZMOqnkPfzM4g4/miell-mxB2lpaQzaTZEV25.png',
    credit: 'Prima sh.p.k. (official site)',
    shows: 'Prima flour banner from the Prima products page: Prima wordmark, "Cilësia fillon nga gruri", and a Prima miell retail pack.',
  },
  {
    key: 'atlas-mills',
    file: 'atlas-mills.webp',
    format: 'WEBP',
    brandLabel: 'Atlas Mills',
    pageUrl: 'https://atlasmills.al/produkte/',
    imageUrl: 'https://atlasmills.al/wp-content/uploads/2026/03/MIELL-I-BARDHE-BG-1024x1024.webp',
    credit: 'Atlas Mills (official site)',
    shows: 'Atlas Mills white-flour ("miell i bardhë") retail packs carrying the ATLAS logo, from the Atlas products page.',
  },
  {
    key: 'eurofood-ajvar',
    file: 'eurofood-ajvar.webp',
    format: 'WEBP',
    brandLabel: 'EuroFood (ajvar)',
    pageUrl: 'https://www.euro-food.org/products-categories.php',
    imageUrl: 'https://www.euro-food.org/uploads/categories/692574c68e66e.png',
    credit: 'EuroFood (official site)',
    shows: 'EuroFood ajvar jars ("Ajvar shtëpie") as published under EuroFood\'s own Ajvar product category.',
  },
  {
    key: 'eurofood-ketchup',
    file: 'eurofood-ketchup.webp',
    format: 'WEBP',
    brandLabel: 'EuroFood (ketchup)',
    pageUrl: 'https://www.euro-food.org/products-categories.php',
    imageUrl: 'https://www.euro-food.org/uploads/categories/692574299f095.png',
    credit: 'EuroFood (official site)',
    shows: 'EuroFood Tomato Ketchup and Pizza Ketchup bottles, printed "EuroFood - Prizren, Kosova", as published under EuroFood\'s own Ketchup product category.',
  },

  // ---- 2026-09-12 coverage pass: one photo per newly-added producer --------
  {
    key: 'camel-mando',
    file: 'camel-mando.webp',
    format: 'WEBP',
    brandLabel: 'Camel Mando',
    pageUrl: 'https://www.camel-ks.com/',
    imageUrl: 'https://www.camel-ks.com/img/mando-140g.png',
    credit: 'Camel (official site)',
    shows: 'Mando Skinny Wafers 140 g pack, from Camel\'s own front page product row.',
  },
  {
    key: 'camel-biscam',
    file: 'camel-biscam.webp',
    format: 'WEBP',
    brandLabel: 'Camel Biscam',
    pageUrl: 'https://www.camel-ks.com/',
    imageUrl: 'https://www.camel-ks.com/img/biscam.png',
    credit: 'Camel (official site)',
    shows: 'Camel Biscam 250 g caramel cookies pack, from Camel\'s own front page product row.',
  },
  {
    key: 'liri-wafer',
    file: 'liri-wafer.jpg',
    format: 'JPEG',
    brandLabel: 'Liri (vafera)',
    pageUrl: 'https://liriprizren.com/',
    imageUrl: 'https://liriprizren.com/images/waferia.jpg',
    credit: 'Liri Prizren (official site)',
    shows: 'Liri "Waferia Hazelnut" wafer box, LIRI logo on the pack, from the Liri Prizren site. (The /images/cat-wafer.jpg category tile was rejected first: an unbranded close-up of loose wafers is not a pack shot and could not be confirmed as Liri\'s own product.)',
  },
  {
    key: 'liri-bonbone',
    file: 'liri-bonbone.jpg',
    format: 'JPEG',
    brandLabel: 'Liri (bonbone dhe praline)',
    pageUrl: 'https://liriprizren.com/',
    imageUrl: 'https://liriprizren.com/images/slides/praline.jpg',
    credit: 'Liri Prizren (official site)',
    shows: 'Liri\'s own Praline box carrying the LIRI mark, from the Praline brand slide on the Liri homepage. (The /images/cat-bonbone.jpg tile was rejected first: a tray of loose wrapped sweets carrying another name, not confidently Liri\'s own product.)',
  },
  {
    key: 'piki-cokokrem',
    file: 'piki-cokokrem.webp',
    format: 'WEBP',
    brandLabel: 'Pi&Ki Çokokrem',
    pageUrl: 'https://www.egigroup-ks.com/kategori.php?kategoria=6',
    imageUrl: 'https://www.egigroup-ks.com/images/produkte/egi/coko1.png',
    credit: 'EGI Group sh.p.k. / Pi&Ki (official site)',
    shows: 'Pi&Ki Çokokrem cocoa spread jar, from EGI Group\'s own spreads category.',
  },
  {
    key: 'piki-pasta',
    file: 'piki-pasta.webp',
    format: 'WEBP',
    brandLabel: 'Pi&Ki (makarona)',
    pageUrl: 'https://www.egigroup-ks.com/produkti.php?id=156',
    imageUrl: 'https://www.egigroup-ks.com/images/produkte/egi/capelli500.png',
    credit: 'EGI Group sh.p.k. / Pi&Ki (official site)',
    shows: 'Pi&Ki Capelli d\'Angelo 500 g pasta pack, from EGI Group\'s own product page for that SKU.',
  },
  {
    key: 'piki-spec',
    file: 'piki-spec.webp',
    format: 'WEBP',
    brandLabel: 'Pi&Ki Spec i Kuq',
    pageUrl: 'https://www.egigroup-ks.com/kategori.php?kategoria=15',
    imageUrl: 'https://www.egigroup-ks.com/images/produkte/egi/specibluar200.png',
    credit: 'EGI Group sh.p.k. / Pi&Ki (official site)',
    shows: 'Pi&Ki ground red pepper (Spec i Kuq i bluar) 200 g pack, from EGI Group\'s own spice category.',
  },
  {
    key: 'olim-frito',
    file: 'olim-frito.webp',
    format: 'WEBP',
    brandLabel: 'Olim',
    pageUrl: 'https://olim.al/produkte/',
    imageUrl: 'https://olim.al/wp-content/uploads/2024/05/frito-1l.png',
    credit: 'Olim sh.a. (official site)',
    shows: 'Olim\'s Frito 1 L frying-oil bottle, from the Olim products page.',
  },
  {
    key: 'shkrela-olive',
    file: 'shkrela-olive.jpg',
    format: 'JPEG',
    brandLabel: 'Shkrela',
    pageUrl: 'https://shkrelaoliveoil.com/en/products/',
    imageUrl: 'https://shkrelaoliveoil.com/wp-content/uploads/2025/06/ABC_1282-1-scaled-1.jpg',
    credit: 'Shkrela Olive Oil (official site)',
    shows: 'Shkrela extra-virgin olive oil bottle, studio shot from the producer\'s own products page.',
  },
  {
    key: 'biolive',
    file: 'biolive.webp',
    format: 'WEBP',
    brandLabel: 'Biolive',
    pageUrl: 'https://bioliveoil.com/products',
    imageUrl: 'https://bioliveoil.com/front/products/1/shishe-ekstra.png',
    credit: 'Biolive (official site)',
    shows: 'Biolive 500 ml Extra Virgin Robust bottle, label printed "Product of ALBANIA".',
  },
  {
    key: 'tepelene-water',
    file: 'tepelene-water.webp',
    format: 'WEBP',
    brandLabel: 'Uji i Ftohtë Tepelenë',
    pageUrl: 'https://ujitepelene.com/uji-yne/linja-klasike/',
    imageUrl: 'https://ujitepelene.com/wp-content/uploads/2025/06/image-2.webp',
    credit: 'Uji i Ftohtë Tepelenë (official site)',
    shows: 'Tepelena 1 L PET spring-water bottle from the producer\'s own classic-line page.',
  },
  {
    key: 'lajthiza',
    file: 'lajthiza.webp',
    format: 'WEBP',
    brandLabel: 'Lajthiza',
    pageUrl: 'https://lajthiza.al/produktet/',
    imageUrl: 'https://lajthiza.al/wp-content/uploads/2025/07/1.5-L.webp',
    credit: 'Lajthiza (official site)',
    shows: 'Lajthiza 1.5 L water bottle from the producer\'s own products page.',
  },
  {
    key: 'glina',
    file: 'glina.webp',
    format: 'WEBP',
    brandLabel: 'Glina',
    pageUrl: 'https://glina.com/Produkte.aspx',
    imageUrl: 'https://glina.com/Products/GlinaProdukt.png',
    credit: 'Fabrika e Glinës (official site)',
    shows: 'Glina mineral-water pack shot from the Glina factory\'s own products page.',
  },
  {
    key: 'frutti',
    file: 'frutti.webp',
    format: 'WEBP',
    brandLabel: 'Frutti',
    pageUrl: 'https://frutti-ks.com/sq/molle/',
    imageUrl: 'https://frutti-ks.com/file/2023/10/06/Apple_5.png',
    credit: 'Frutti sh.p.k. (official site)',
    shows: 'Frutti apple juice 1 L carton, transparent-background pack shot from Frutti\'s own apple-juice page.',
  },
  {
    key: 'tango',
    file: 'tango.webp',
    format: 'WEBP',
    brandLabel: 'Tango',
    pageUrl: 'https://devolligroup.com/brands/tango/',
    imageUrl: 'https://devolligroup.com/wp-content/uploads/2026/01/TangoLife_Portokall.webp',
    credit: 'Devolli Group (official site)',
    shows: 'Tango Life orange soft drink, transparent-background pack shot from Devolli Group\'s own Tango brand page.',
  },
  {
    key: 'go-energy',
    file: 'go-energy.webp',
    format: 'WEBP',
    brandLabel: 'GO+',
    pageUrl: 'https://devolligroup.com/brands/go/',
    imageUrl: 'https://devolligroup.com/wp-content/uploads/2026/07/Go_Zero_03.webp',
    credit: 'Devolli Group (official site)',
    shows: 'GO+ Zero energy drink can, transparent-background pack shot from Devolli Group\'s own GO brand page.',
  },
  {
    key: 'golden-eagle',
    file: 'golden-eagle.webp',
    format: 'WEBP',
    brandLabel: 'Golden Eagle',
    pageUrl: 'https://frutex-ks.com/golden-eagle',
    imageUrl: 'https://frutex-ks.com/wp-content/uploads/2026/01/GoldenEagle-716x716-1.png',
    credit: 'Frutex L.L.C. (official site)',
    shows: 'Golden Eagle energy drink can from Frutex\'s own Golden Eagle product page.',
  },
  {
    key: 'art-food-ketchup',
    file: 'art-food-ketchup.webp',
    format: 'WEBP',
    brandLabel: 'Art Food',
    pageUrl: 'https://frutex-ks.com/art-food',
    imageUrl: 'https://frutex-ks.com/wp-content/uploads/2026/04/Art-Ketchup-png.png',
    credit: 'Frutex L.L.C. (official site)',
    shows: 'Art Food ketchup bottle from Frutex\'s own Art Food product page.',
  },
  {
    key: 'ajka-milk',
    file: 'ajka-milk.webp',
    format: 'WEBP',
    brandLabel: 'Ajka',
    pageUrl: 'https://ajka.al/produktet/',
    imageUrl: 'https://ajka.al/wp-content/uploads/2024/06/2.png',
    credit: 'Delta Doni sh.p.k. / Ajka (official site)',
    shows: 'Ajka UHT milk carton (2.8% fat), transparent-background pack shot from the Ajka products page.',
  },
  {
    key: 'mulliri-vjeter',
    file: 'mulliri-vjeter.jpg',
    format: 'JPEG',
    brandLabel: 'Mulliri Vjetër',
    pageUrl: 'https://mullirivjeter.al/produktet/',
    imageUrl: 'https://mullirivjeter.al/wp-content/uploads/2018/07/Mulliri%C2%AE-Moka-Premium-250g.jpg',
    credit: 'Mulliri Vjetër (official site)',
    shows: 'Mulliri Moka Premium 250 g ground-coffee pack from the roaster\'s own products page.',
  },
  {
    key: 'lori-caffe',
    file: 'lori-caffe.webp',
    format: 'WEBP',
    brandLabel: 'Lori Caffè',
    pageUrl: 'https://loricaffe.com/produkte/lori-experience/',
    imageUrl: 'https://loricaffe.com/wp-content/uploads/2024/02/Turke-Ekstra-1.png',
    credit: 'Valtelina / Lori Caffè (official site)',
    shows: 'Lori Caffè Turke Ekstra pack, transparent-background pack shot from the producer\'s own site.',
  },
  {
    key: 'merja-caj',
    file: 'merja-caj.jpg',
    format: 'JPEG',
    brandLabel: 'Merja',
    pageUrl: 'https://merjabioprodukte.com/produkte.php?category=1',
    imageUrl: 'https://merjabioprodukte.com/images/MonOct1312574120259781.jpg',
    credit: 'Bio Produkte Merja (official site)',
    shows: 'Merja "Çaj mali" 25 g mountain-tea pack from the producer\'s own tea category page.',
  },
  {
    key: 'euroni-salt',
    file: 'euroni-salt.webp',
    format: 'WEBP',
    brandLabel: 'Euroni',
    pageUrl: 'https://euroni-ks.com/product-category/vacuum-rock-salt/',
    imageUrl: 'https://euroni-ks.com/wp-content/uploads/2023/04/Untitled-design-40-300x300.png',
    credit: 'Euroni Salt L.L.C. (official site)',
    shows: 'Euroni Salt 1 kg carton box from the producer\'s own vacuum-rock-salt category.',
  },
  {
    key: 'tara-toilet',
    file: 'tara-toilet.jpg',
    format: 'JPEG',
    brandLabel: 'Tara',
    pageUrl: 'https://tarasoft-ks.com/dyqani',
    // tarasoft-ks.com is built on Zyro and serves its own shop assets from
    // cdn.zyrosite.com — Tara's own image on Tara's own store, not a third
    // party host. NOTE: only /dyqani carries real pack shots; the marketing
    // pages of this site use Unsplash/Pexels stock, which is why the shop
    // page is the source of record here.
    imageUrl:
      'https://cdn.zyrosite.com/cdn-ecommerce/store_01JAAF3J8GQTMWKSQ9D4FAAYX3%2Fassets%2F1729077495806-store_01JAAF3J8GQTMWKSQ9D4FAAYX3%252Fassets%252F1729077464274-tara%2520premium%2520-%2520toilet%2520paper.jpeg',
    credit: 'Tara Soft L.L.C. (official site)',
    shows: 'Tara Premium toilet paper pack from Tara Soft\'s own online shop.',
  },
  {
    key: 'er-abi-attix',
    file: 'er-abi-attix.webp',
    format: 'WEBP',
    brandLabel: 'ER-ABI Attix',
    pageUrl: 'https://www.er-abi.com',
    // Max%20Clean-_Gmw_NFJ.png was tried first and REJECTED on sight: it is
    // the Max Clean LOGO, not a product. A logo is not a pack shot — the same
    // rule that kept ABI-ELIF Progres out. This is the dishwashing pack shot.
    imageUrl: 'https://www.er-abi.com/assets/detenp-CR9FCT7s.png',
    credit: 'NTP ER-ABI (official site)',
    shows: 'ER-ABI "Attix" dishwashing liquid 1000 ml bottle, transparent-background pack shot from ER-ABI\'s own site.',
  },
  {
    key: 'er-abi-softly',
    file: 'er-abi-softly.webp',
    format: 'WEBP',
    brandLabel: 'ER-ABI Softly',
    pageUrl: 'https://www.er-abi.com',
    // Dora-DeBTv1Ja.png was tried first and REJECTED on sight: it is a hand
    // holding a blue scouring pad, not the Dora bottle. This asset is the
    // branded hand-soap pack.
    imageUrl: 'https://www.er-abi.com/assets/sapunp-DwquEFBg.png',
    credit: 'NTP ER-ABI (official site)',
    shows: 'ER-ABI "Softly" shampon per duar (liquid hand soap) 1 lit pump bottle, transparent-background pack shot from ER-ABI\'s own site.',
  },
  {
    key: 'er-abi-shampoo',
    file: 'er-abi-shampoo.webp',
    format: 'WEBP',
    brandLabel: 'ER-ABI (shampon)',
    pageUrl: 'https://www.er-abi.com',
    // foto_shampon-DDPmy4p-.jpg was tried first and REJECTED: a bottle
    // splashing into water with an unreadable label — a mood shot, not a
    // pack shot. This is the same bottle photographed as a product.
    imageUrl: 'https://www.er-abi.com/assets/flokp-DRO3g0SL.png',
    credit: 'NTP ER-ABI (official site)',
    shows: 'The hair-care bottle ER-ABI publishes under its own shampoo category ("Rosemary Leaf Oil" shampoo). HONEST LIMIT: the bottle carries the product-line name, not an ER-ABI mark, so the attribution rests on ER-ABI publishing it as its own line.',
  },
  {
    key: 'get-rea',
    file: 'get-rea.jpg',
    format: 'JPEG',
    brandLabel: 'Rea (Get)',
    pageUrl: 'https://get.com.al/product/rea-black/',
    imageUrl: 'https://get.com.al/wp-content/uploads/2019/03/REA2.jpg',
    credit: 'Get sh.p.k. (official site)',
    shows: 'Rea "Zbardhues" bleach bottle, REA mark on the label, from Get sh.p.k.\'s own product page.',
  },
  {
    key: 'abi-progres-ajvar',
    file: 'abi-progres-ajvar.webp',
    format: 'WEBP',
    brandLabel: 'ABI Progres',
    pageUrl: 'https://www.abiprogres.com/products',
    // ABI Progres' PER-PRODUCT images (/app/images/<hash>.png) are broken on
    // their server: they answer 200 with an HTML "404 PAGE" body rather than
    // an image. The category composition images under /app/assets/img/ are
    // real PNGs and are the producer's own photography, so that is what is
    // used here.
    imageUrl: 'https://www.abiprogres.com/app/assets/img/CATEGORIES_AJVAR.png',
    // The asset is a wide category strip: the jar sits in the middle with the
    // word AJVAR set large either side. Crop to the jar so the card shows a
    // product rather than a banner.
    crop: [0.37, 0.0, 0.63, 1.0],
    credit: '"ABI" Progres sh.p.k. (official site)',
    shows: 'ABI Progres ajvar jars, the producer\'s own ajvar category image.',
  },
  {
    key: 'xhoshkun',
    file: 'xhoshkun.jpg',
    format: 'JPEG',
    brandLabel: 'Mishtore Xhoshkun',
    pageUrl: 'https://mishtorexhoshkun.com/produktet/',
    imageUrl: 'https://mishtorexhoshkun.com/wp-content/uploads/2025/04/Rollad-Viqi-683x1024.jpg',
    credit: 'Mishtore Xhoshkun (official site)',
    shows: 'Packaged Rollad Viçi (beef roulade) from the Prizren meat plant\'s own products page.',
  },
  {
    key: 'vipa-flips',
    file: 'vipa-flips.webp',
    format: 'WEBP',
    brandLabel: 'Vipa Flips',
    pageUrl: 'https://vipa-ks.com/en/product-category/flips-en/',
    imageUrl: 'https://vipa-ks.com/wp-content/uploads/2020/04/flips-peanuts-1.png',
    credit: 'Pestova sh.p.k. / Vipa (official site)',
    shows: 'Vipa peanut Flips bag, transparent-background pack shot from Pestova\'s own Flips category.',
  },

  // ---- 2026-09-13 coverage pass: shelves that had no curated entry at all --
  {
    key: 'haje-kikirik',
    file: 'haje-kikirik.webp',
    format: 'WEBP',
    brandLabel: 'Haje',
    pageUrl: 'https://www.haje-ks.com/arrore',
    imageUrl: 'https://www.haje-ks.com/wp-content/uploads/2025/04/kikirik-1024x1024.png',
    credit: 'HAJE SH.P.K. (official site)',
    shows: 'Haje "Kikirik i pjekur dhe i kriposur" roasted-and-salted peanut bag with the hajé roundel, from the Obiliq producer\'s own Arrore product page.',
  },
  {
    key: 'piki-kikirik',
    file: 'piki-kikirik.webp',
    format: 'WEBP',
    brandLabel: 'Pi&Ki (kikirik dhe arra)',
    pageUrl: 'https://www.egigroup-ks.com/kategori.php?kategoria=3',
    imageUrl: 'https://www.egigroup-ks.com/images/produkte/egi/kikirikf11.png',
    credit: 'EGI Group sh.p.k. / Pi&Ki (official site)',
    shows: 'Pi&Ki "Kikirikë / Peantus — i fërguar me kripë" 800 g roasted-salted peanut pack artwork from EGI Group\'s own peanut category page.',
  },
  {
    key: 'piki-fasule',
    file: 'piki-fasule.webp',
    format: 'WEBP',
    brandLabel: 'Pi&Ki Fasule',
    pageUrl: 'https://www.egigroup-ks.com/kategori.php?kategoria=10',
    // EGI publishes this one on a very wide white canvas; the sides are
    // cropped off so the card shows the bag rather than a field of white.
    crop: [0.33, 0.0, 0.66, 1.0],
    imageUrl: 'https://www.egigroup-ks.com/images/produkte/egi/7312014.png',
    credit: 'EGI Group sh.p.k. / Pi&Ki (official site)',
    shows: 'Pi&Ki "Fasule / Beans" 800 g white-bean bag from EGI Group\'s own Fasule category page.',
  },
  {
    key: 'pestova-patate',
    file: 'pestova-patate.webp',
    format: 'WEBP',
    brandLabel: 'Pestova (patate të freskëta)',
    pageUrl: 'https://vipa-ks.com/en/patatja/',
    imageUrl: 'https://vipa-ks.com/wp-content/uploads/2020/08/4.png',
    credit: 'Pestova sh.p.k. (official site)',
    // Pestova publishes this one small (261px wide) — it is the only own-site
    // photo of the packed fresh potato and it is unmistakably theirs, so it is
    // used as published rather than upscaled.
    shows: 'Pestova fresh table potatoes in the producer\'s own red net bag with its printed label, from the Potato page of Pestova\'s own site.',
  },
  {
    key: 'buka-fara',
    file: 'buka-fara.jpg',
    format: 'JPEG',
    brandLabel: 'Buka Bakery',
    pageUrl: 'https://bukabakery.com/produktet/',
    imageUrl: 'https://bukabakery.com/wp-content/uploads/2021/07/43-1.jpg',
    credit: 'Buka Bakery (official site)',
    shows: 'Buka Bakery "Bukë Shtëpie me Fara" — a seeded house loaf, top-down studio shot on white from the bakery\'s own product catalogue.',
  },
  {
    key: 'piki-oriz',
    file: 'piki-oriz.webp',
    format: 'WEBP',
    brandLabel: 'Pi&Ki Oriz',
    pageUrl: 'https://www.egigroup-ks.com/kategori.php?kategoria=11',
    imageUrl: 'https://www.egigroup-ks.com/images/produkte/egi/oriz.png',
    credit: 'EGI Group sh.p.k. / Pi&Ki (official site)',
    shows: 'Pi&Ki "Rice / Oriz" 800 g rice bag from EGI Group\'s own Oriz category page.',
  },
];

// ---------------------------------------------------------------------------
// WHICH ALTERNATIVE GETS WHICH PHOTO.
//
// `BY_BRAND` applies a photo to every alternatives[] row with that exact
// `brand` string, wherever it appears (Rugove water is cited under three
// different Serbian waters, Birra Peja under two Serbian beers, and so on).
//
// `OVERRIDES` wins where one brand legitimately needs two different photos —
// EuroFood is cited once for ajvar and once for ketchup, and must not show a
// jar of ajvar to someone who scanned a ketchup.
// ---------------------------------------------------------------------------
const BY_BRAND = {
  'Vipa Chips': 'vipa-chips',
  Sempre: 'sempre',
  Frutomania: 'frutomania',
  Rugove: 'rugove-water',
  'Rugove (cheese)': 'rugove-cheese',
  'Birra Peja': 'birra-peja',
  'Birra Korça': 'birra-korca',
  Vita: 'vita',
  ABI: 'abi',
  'Prince Caffe': 'prince-caffe',
  'Prince Caffe Turke': 'prince-caffe-turke',
  'Miell Diamond': 'miell-diamond',
  'Prima (flour and pasta)': 'prima',
  'Atlas Mills': 'atlas-mills',
  EuroFood: 'eurofood-ajvar',

  // ---- 2026-09-12 coverage pass ------------------------------------------
  'Camel Mando': 'camel-mando',
  'Camel Biscam': 'camel-biscam',
  'Liri (vafera)': 'liri-wafer',
  'Liri (bonbone dhe praline)': 'liri-bonbone',
  'Pi&Ki Çokokrem': 'piki-cokokrem',
  'Pi&Ki (makarona)': 'piki-pasta',
  'EFI Spec i Kuq (EGI Group)': 'piki-spec',
  Olim: 'olim-frito',
  Shkrela: 'shkrela-olive',
  Biolive: 'biolive',
  'Uji i Ftohtë Tepelenë': 'tepelene-water',
  Lajthiza: 'lajthiza',
  Glina: 'glina',
  Frutti: 'frutti',
  Tango: 'tango',
  'GO+': 'go-energy',
  'Golden Eagle': 'golden-eagle',
  'Art Food': 'art-food-ketchup',
  Ajka: 'ajka-milk',
  'Mulliri Vjetër': 'mulliri-vjeter',
  'Lori Caffè': 'lori-caffe',
  Merja: 'merja-caj',
  Euroni: 'euroni-salt',
  Tara: 'tara-toilet',
  'ER-ABI Attix': 'er-abi-attix',
  'ER-ABI Softly': 'er-abi-softly',
  'ER-ABI (shampon)': 'er-abi-shampoo',
  'Rea (Get)': 'get-rea',
  'ABI Progres': 'abi-progres-ajvar',
  'Mishtore Xhoshkun': 'xhoshkun',
  'Vipa Flips': 'vipa-flips',

  // ---- 2026-09-13 coverage pass ------------------------------------------
  Haje: 'haje-kikirik',
  'Buka Bakery': 'buka-fara',
  'Pestova (patate të freskëta)': 'pestova-patate',
  'Pi&Ki (kikirik dhe arra)': 'piki-kikirik',
  'Pi&Ki Fasule': 'piki-fasule',
  'Pi&Ki Oriz': 'piki-oriz',
};

const OVERRIDES = {
  'Polimark::EuroFood': 'eurofood-ketchup',
};

// ---------------------------------------------------------------------------
// BRANDS WITH NO PHOTO. An honest gap, not a placeholder. Each row says what
// was actually tried so the next pass does not repeat it.
// ---------------------------------------------------------------------------
const GAPS = [
  {
    brand: 'Mia Vita',
    company: 'listed in brand-alternatives.json as Devolli Group, Fushë Kosovë',
    reason:
      'No official page for a "Mia Vita" product could be found, so no photo could be attributed with confidence.',
    tried: [
      'https://devolligroup.com/ — brand index lists Aquavita, Birra Peja, Go, Holla, Sola, Tango and Vita; there is no Mia Vita brand page and the string "Mia Vita" does not appear on the site.',
      'https://devolligroup.com/brands/ — same: no Mia Vita.',
      'https://devollicorporation.com/en/ (the separate Devolli Corporation, Pejë) — coffee and logistics only, no Mia Vita.',
      'https://www.qumeshtorjavita.com/ — Vita dairy only (milk, yogurt, cream, cheese); no juice line under this name.',
      'Web search for "Mia Vita" juice Kosovo / lëng frutash — returned only Vita dairy coverage and unrelated juice producers (Frutti, Frutomania).',
    ],
    recommendation:
      'Before a photo is attached, the Mia Vita pairing itself should be re-verified — the alternative may need to be replaced by a documented Kosovo juice brand (Frutomania is already in this file; Frutti sh.p.k., https://frutti-ks.com/, is the obvious second candidate).',
  },
  {
    brand: 'ABI-ELIF 19 Progres',
    company: 'ABI / ELIF 19, Prizren',
    reason:
      'The official group site publishes only the ABI PROGRES wordmark logo, not a product photo. A logo is not a product photo and was not used.',
    tried: [
      'https://abi-center.com/en/companies/ — every image under this page is a company logo (ABI_PROGRES_LOGO, abi-shpk-transparent, abi-store, abi_plus, furra, kino …); no packaged-product shot.',
      'https://abi-center.com/en/ and /en/about-us/ — same asset set, no product photography.',
      'https://abimilk.com/ — this is the ABI dairy arm and has real product photography, but it is a different product line (milk/yogurt/cheese) and cannot stand in for Progres preserves.',
    ],
    recommendation:
      'A Progres pack shot would have to come from a Progres product page that does not currently exist. Until then the ajvar entry still has EuroFood and Krusha alongside it, and EuroFood does have a photo.',
  },
  {
    brand: 'Krusha (KB Krusha cooperative)',
    company: 'Kooperativa Bujqësore Krusha, Krushë e Madhe',
    reason:
      'The cooperative has no reachable official website, and the only source in the data file (balkanappetite.com) is a retailer listing, which the sourcing rules exclude.',
    tried: [
      'https://kbkrusha.net/ and http://kbkrusha.net/ — the domain cited on the cooperative\'s own Facebook page does not resolve (DNS failure, curl exit 6).',
      'https://krusha.net/, https://kbkrusha.com/ — do not resolve either.',
      'https://balkanappetite.com/products/krusha-ajvar-home-made-720gr — this is the source already in brand-alternatives.json, but it is a third-party shop listing, not the producer\'s own site, so its imagery is out of bounds.',
      'The cooperative\'s only live official presence found is https://www.facebook.com/gratekrushes/ — Facebook\'s robots.txt disallows the crawling this would require, so it was not scraped.',
    ],
    recommendation:
      'Ask KB Krusha directly for a pack shot, or use the Facebook page only with the cooperative\'s written permission. Do not lift the retailer photo.',
  },
  {
    brand: 'Sharri',
    company: 'Qumështorja Sharri, Rr. Besim Shala p.n., Prizren',
    reason:
      'Sharri publishes excellent pack shots for its whole range, and sharrimilk.com/robots.txt leaves `User-agent: *` wide open — but the SAME file carries an explicit `User-agent: ClaudeBot / Disallow: /` block, alongside `Content-Signal: ai-train=no`. This crawler treats AI-crawler opt-outs as binding. Sending a browser User-Agent and then treating the ClaudeBot rule as "not about us" would be a bot-protection bypass dressed up as a technicality, so the photos were not taken. The alternative is still listed, just without an image — which is the correct outcome under rule 3.',
    tried: [
      'https://www.sharrimilk.com/robots.txt — Cloudflare-managed file: `User-agent: * / Content-Signal: search=yes,ai-train=no,use=reference / Allow: /`, then explicit `Disallow: /` blocks for ClaudeBot, GPTBot, CCBot, Google-Extended, Bytespider, Amazonbot, Applebot-Extended and meta-externalagent.',
      'https://www.sharrimilk.com/produktet/ — 19 usable own-site pack shots exist here (jogurt 500ml/1l, djath i bardhë 800g/2kg/4kg, Djathi i Sharrit 1kg/2kg, kaçkavall, dhallë, ayran, kos, gjizë, gjalpë). None were downloaded.',
      'The robots parser in this script was widened in the same pass so the rule is enforced automatically rather than relying on someone remembering it — see SELF_UA_TOKENS in loadRobots().',
    ],
    recommendation:
      'Ask Qumështorja Sharri directly for permission or for a press pack. Do not fetch these assets while that ClaudeBot rule stands.',
  },
  {
    brand: 'Bletoria',
    company: 'Bletoria, Kamenicë (Gollak)',
    reason:
      'The only product image on Bletoria\'s own product page is a MARKETING BANNER — black background, "OFERTË SPECIALE", "3 KG 70€ 60€" struck-through pricing and a honey dipper — not a pack shot. Shipping it would put a price promotion that expires into the app\'s alternatives grid, and the jar inside it cannot be confirmed as Bletoria\'s own rather than a stock composite. The producer itself is well evidenced and stays listed; only the photo is withheld.',
    tried: [
      'https://bletoria.com/images/products/pako-familjare-3kg.jpg — fetched and eyeballed: it is the special-offer banner described above, not a product photograph.',
      'https://bletoria.com/produktet/ — the rest of the range is presented with the same promotional treatment.',
      'https://bletoria.com/images/story/lifestyle-jar.png — a lifestyle composition rather than a pack shot, and the jar carries no readable Bletoria label.',
    ],
    recommendation:
      'Ask Bletoria for a plain jar photograph. Until then the honey/preserves entry still carries ABI Progres, which does have a usable own-site image.',
  },
  {
    brand: 'Apetit',
    company: 'Apetit Group sh.p.k., Fshati Babi Most, Obiliq',
    reason:
      'Apetit is a verified Kosovo meat producer with its own licensed slaughterhouse, but no image on its site could be confidently identified as an Apetit product. The two candidate files under the site\'s own "produktet" section carry empty alt text, and the neighbouring gallery page is still filled with unedited site-template stock (a boat, a butterfly, an iPhone) — so an image from this site cannot be trusted to be the producer\'s own product without a human eyeball.',
    tried: [
      'https://apetitgroup.com/ — returns a 500-status iframe wrapper; the real site is at https://apetitgroup.com/wp/.',
      'https://apetitgroup.com/wp/ — img/1.jpg and img/2.jpg sit inside the #produktet section and are real JPEGs, but have no alt text and could not be confirmed as pack shots.',
      'https://apetitgroup.com/wp/galeri.html — template stock imagery, which is what makes the two candidates above untrustworthy.',
    ],
    recommendation:
      'A human should look at apetitgroup.com/wp/img/1.jpg and decide. Until then the meat entries still carry Mishtore Xhoshkun, which does have a verified own-site product photo.',
  },
  {
    brand: 'Bodrumi i Vjetër',
    company: 'Veraria "Bodrumi i Vjetër", Rr. Gzim Hamza PN, 21000 Rahovec, Kosovë',
    reason:
      'Same situation as Sharri: the Rahovec winery publishes clean bottle shots for its whole range, but bodrumivjeter.com/robots.txt carries a Cloudflare-managed block with an explicit `User-agent: ClaudeBot / Disallow: /` (plus `Content-Signal: ai-train=no`). This crawler treats AI-crawler opt-outs as binding, so the photos were not taken. The alternative is listed without an image, which is the correct outcome under rule 3.',
    tried: [
      'https://bodrumivjeter.com/robots.txt — `User-agent: * / Content-Signal: search=yes,ai-train=no,use=reference / Allow: /`, then explicit `Disallow: /` for ClaudeBot, GPTBot, CCBot, Google-Extended, Bytespider, Amazonbot, Applebot-Extended, meta-externalagent and CloudflareBrowserRenderingCrawler.',
      'https://bodrumivjeter.com/produkte/ — 28 own-site bottle shots exist here (Vranac, Riesling Italian, Cabernet Sauvignon, Merlot, Merlot Barrique, Chardonnay, Pinot Noir, Rosé, Terra, Elephant, Rozafa, DARDA Raki Rrushi, Dhurata e Parë). None were downloaded.',
      'https://stonecastlewinery.com/ — checked as a second Kosovo winery so the entry would not depend on one blocked site: the domain now serves only a redirect to /lander and its sitemap has a single URL, i.e. it is parked. Rejected, no longer an official producer site.',
      'https://suharekaverari.com/ — resolves, but serves an untouched default WordPress install ("My Blog / My WordPress Blog"). Rejected on the same ground.',
    ],
    recommendation:
      'Ask Veraria Bodrumi i Vjetër for a press pack or written permission. Do not fetch these assets while the ClaudeBot rule stands.',
  },
];

// ---------------------------------------------------------------------------
// Inline Python/Pillow optimiser. argv: in out format maxEdge maxBytes [crop]
// ---------------------------------------------------------------------------
const PY_OPTIMISE = `
import sys, os
from PIL import Image, ImageFile
ImageFile.LOAD_TRUNCATED_IMAGES = True

src, dst, fmt, max_edge, max_bytes = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]), int(sys.argv[5])
crop = [float(x) for x in sys.argv[6].split(',')] if len(sys.argv) > 6 and sys.argv[6] else None

im = Image.open(src)
if crop:
    w, h = im.size
    im = im.crop((int(crop[0]*w), int(crop[1]*h), int(crop[2]*w), int(crop[3]*h)))

if fmt == 'JPEG':
    # JPEG has no alpha: flatten onto white, which is what every one of these
    # pack shots is designed to sit on anyway.
    if im.mode in ('RGBA', 'LA', 'P'):
        im = im.convert('RGBA')
        bg = Image.new('RGBA', im.size, (255, 255, 255, 255))
        bg.alpha_composite(im)
        im = bg
    im = im.convert('RGB')
else:
    im = im.convert('RGBA' if 'A' in im.getbands() or im.mode == 'P' else 'RGB')

im.thumbnail((max_edge, max_edge), Image.LANCZOS)

quality = 88
while True:
    if fmt == 'JPEG':
        im.save(dst, 'JPEG', quality=quality, optimize=True, progressive=True)
    else:
        im.save(dst, 'WEBP', quality=quality, method=6)
    if os.path.getsize(dst) <= max_bytes or quality <= 40:
        break
    quality -= 8

print('%s %dx%d q%d %d' % (fmt, im.size[0], im.size[1], quality, os.path.getsize(dst)))
`;

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const robotsCache = new Map();

/**
 * robots.txt path patterns are prefix matches with two wildcards: `*` (any
 * run of characters) and a trailing `$` (end anchor).
 *
 * Getting this wrong is not harmless. A naive "cut the rule at the first
 * star and prefix-match" reading turns vipa-ks.com's `Disallow: /*?add-to-cart=`
 * into `Disallow: /` and silently blocks the whole site — which is exactly
 * how the owner's headline example, Vipa Chips, came back empty on the first
 * run of this script.
 */
function robotsRuleToRegExp(rule) {
  let pattern = rule;
  let anchored = false;
  if (pattern.endsWith('$')) {
    anchored = true;
    pattern = pattern.slice(0, -1);
  }
  const escaped = pattern
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${escaped}${anchored ? '$' : ''}`);
}

/**
 * WHICH robots.txt GROUPS WE OBEY (widened 2026-09-12).
 *
 * The first version of this parser read only the `User-agent: *` group. That
 * was not enough. Several producers' sites (sharrimilk.com is the one that
 * forced this change) publish a Cloudflare-managed robots.txt that leaves
 * `*` wide open but carries an explicit
 *
 *     User-agent: ClaudeBot
 *     Disallow: /
 *
 * block. This script sends a browser User-Agent
 * string, so the `*` group is the one a server would technically apply to
 * it — and reading only that group would let the script hoover up assets
 * from a site that has said, in the clearest terms available to it, that it
 * does not want this kind of access. Sending a browser UA and then claiming
 * the ClaudeBot rule "doesn't apply to us" is exactly the bot-protection
 * bypass this file's rule 4 forbids.
 *
 * So the check is the UNION of every group that could plausibly name us:
 * `*`, `claudebot`, `claude-web`, `anthropic-ai`. If ANY of them disallows
 * the path, the asset is skipped and the brand is recorded as an honest gap
 * with the reason — the same outcome Krusha already has for Facebook.
 *
 * `Crawl-delay` is read from the same groups and honoured per host (see
 * hostDelays), because a site that asks for 60s between requests and gets
 * 1.2s is not being crawled politely, whatever the Disallow lines say.
 *
 * Fail-open on 404/network error (no robots.txt = no restriction stated).
 */
const SELF_UA_TOKENS = new Set(['*', 'claudebot', 'claude-web', 'anthropic-ai']);

async function loadRobots(origin) {
  if (robotsCache.has(origin)) return robotsCache.get(origin);
  let parsed = { disallow: [], crawlDelayMs: 0, groups: [] };
  try {
    const res = await fetch(`${origin}/robots.txt`, { headers: { 'User-Agent': USER_AGENT } });
    if (res.ok) {
      const text = await res.text();
      // A group is one or more consecutive User-agent lines followed by its
      // rules; a new User-agent line after a rule line starts a new group.
      let current = [];
      let lastWasAgent = false;
      const apply = (key, value) => {
        if (!current.some((a) => SELF_UA_TOKENS.has(a))) return;
        if (key === 'disallow' && value) parsed.disallow.push(value);
        if (key === 'crawl-delay') {
          const secs = Number.parseFloat(value);
          if (Number.isFinite(secs) && secs > 0) {
            parsed.crawlDelayMs = Math.max(parsed.crawlDelayMs, secs * 1000);
          }
        }
      };
      for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.replace(/#.*$/, '').trim();
        if (!line) continue;
        const [field, ...rest] = line.split(':');
        const value = rest.join(':').trim();
        const key = field.trim().toLowerCase();
        if (key === 'user-agent') {
          if (!lastWasAgent) current = [];
          current.push(value.toLowerCase());
          if (SELF_UA_TOKENS.has(value.toLowerCase())) parsed.groups.push(value.toLowerCase());
          lastWasAgent = true;
        } else {
          lastWasAgent = false;
          apply(key, value);
        }
      }
    }
  } catch {
    parsed = { disallow: [], crawlDelayMs: 0, groups: [] };
  }
  robotsCache.set(origin, parsed);
  return parsed;
}

async function isAllowedByRobots(url) {
  const u = new URL(url);
  const { disallow } = await loadRobots(u.origin);
  const target = u.pathname + u.search;
  return !disallow.some((rule) => robotsRuleToRegExp(rule).test(target));
}

/** The delay this host asked for, or the script default, whichever is longer. */
async function delayForHost(url) {
  const { crawlDelayMs } = await loadRobots(new URL(url).origin);
  return Math.max(REQUEST_DELAY_MS, crawlDelayMs || 0);
}

async function download(url, referer) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Referer: referer,
      Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

function pythonExe() {
  for (const exe of ['python', 'python3', 'py']) {
    const probe = spawnSync(exe, ['-c', 'import PIL'], { encoding: 'utf8' });
    if (probe.status === 0) return exe;
  }
  return null;
}

/** Intrinsic pixel size, with no image library: PNG / JPEG / WebP headers only. */
function imageSize(buf) {
  if (buf.length > 24 && buf.toString('ascii', 1, 4) === 'PNG') {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf.length > 30 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const kind = buf.toString('ascii', 12, 16);
    if (kind === 'VP8X') return { width: (buf.readUIntLE(24, 3) & 0xffffff) + 1, height: (buf.readUIntLE(27, 3) & 0xffffff) + 1 };
    if (kind === 'VP8 ') return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    if (kind === 'VP8L') {
      const b = buf.readUInt32LE(21);
      return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
    }
  }
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length - 9) {
      if (buf[i] !== 0xff) { i += 1; continue; }
      const marker = buf[i + 1];
      const len = buf.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      }
      i += 2 + len;
    }
  }
  return { width: null, height: null };
}

// ---------------------------------------------------------------------------
// JSON writer that keeps brand-alternatives.json's existing house style:
// two-space indent, and arrays of plain values kept on one line.
// ---------------------------------------------------------------------------
function stringify(value, indent = 0) {
  const pad = '  '.repeat(indent);
  const padIn = '  '.repeat(indent + 1);
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    if (value.every((v) => v === null || typeof v !== 'object')) {
      return `[${value.map((v) => JSON.stringify(v)).join(', ')}]`;
    }
    return `[\n${value.map((v) => padIn + stringify(v, indent + 1)).join(',\n')}\n${pad}]`;
  }
  const keys = Object.keys(value);
  if (keys.length === 0) return '{}';
  return `{\n${keys
    .map((k) => `${padIn}${JSON.stringify(k)}: ${stringify(value[k], indent + 1)}`)
    .join(',\n')}\n${pad}}`;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
async function main() {
  if (!DRY_RUN) fs.mkdirSync(OUT_DIR, { recursive: true });
  const py = pythonExe();
  if (!py) {
    console.warn(
      '[warn] no Python with Pillow on PATH — images will be saved exactly as fetched and flagged unoptimised in the report.'
    );
  }

  const results = [];
  // Per-host politeness: never hit the same origin again inside the delay that
  // host asked for in robots.txt (ajka.al asks for Crawl-delay: 60), and never
  // go faster than REQUEST_DELAY_MS globally.
  const lastHitAt = new Map();

  for (const item of MANIFEST) {
    const origin = new URL(item.imageUrl).origin;
    const wait = await delayForHost(item.imageUrl);
    const since = Date.now() - (lastHitAt.get(origin) || 0);
    if (lastHitAt.has(origin) && since < wait) await sleep(wait - since);
    else if (lastHitAt.size > 0) await sleep(REQUEST_DELAY_MS);
    lastHitAt.set(origin, Date.now());

    const row = {
      key: item.key,
      brand: item.brandLabel,
      file: `${PUBLIC_PREFIX}/${item.file}`,
      imageSource: item.pageUrl,
      imageUrl: item.imageUrl,
      imageCredit: item.credit,
      shows: item.shows,
      ok: false,
    };

    try {
      if (!(await isAllowedByRobots(item.imageUrl))) {
        throw new Error('robots.txt disallows this path — skipped');
      }
      const buf = await download(item.imageUrl, item.pageUrl);
      row.sourceBytes = buf.length;
      row.sourceSize = imageSize(buf);
      row.sha256 = createHash('sha256').update(buf).digest('hex').slice(0, 16);

      if (DRY_RUN) {
        row.ok = true;
        row.note = 'dry run — not written';
        results.push(row);
        console.log(`  ok  ${item.key.padEnd(20)} ${buf.length} bytes (dry run)`);
        continue;
      }

      const dest = path.join(OUT_DIR, item.file);
      if (py) {
        const tmp = path.join(os.tmpdir(), `vendorja-alt-${item.key}-${process.pid}`);
        fs.writeFileSync(tmp, buf);
        const args = [
          '-',
          tmp,
          dest,
          item.format,
          String(MAX_EDGE),
          String(MAX_BYTES),
          item.crop ? item.crop.join(',') : '',
        ];
        const proc = spawnSync(py, args, { input: PY_OPTIMISE, encoding: 'utf8' });
        fs.rmSync(tmp, { force: true });
        if (proc.status !== 0) throw new Error(`optimiser failed: ${(proc.stderr || '').trim()}`);
        row.optimised = (proc.stdout || '').trim();
      } else {
        fs.writeFileSync(dest, buf);
        row.optimised = null;
        row.warning = 'saved as fetched — no Pillow available to resize/re-encode';
      }

      const finalBuf = fs.readFileSync(dest);
      row.bytes = finalBuf.length;
      row.size = imageSize(finalBuf);
      const longEdge = Math.max(row.size.width || 0, row.size.height || 0);
      row.withinBudget = row.bytes <= MAX_BYTES && longEdge <= MAX_EDGE;
      if (!row.withinBudget) {
        row.warning = `${row.warning ? row.warning + '; ' : ''}over budget: ${row.bytes} bytes, ${longEdge}px long edge (limits ${MAX_BYTES} / ${MAX_EDGE})`;
      }
      row.ok = true;
      console.log(
        `  ok  ${item.key.padEnd(20)} ${String(row.bytes).padStart(7)} bytes  ${row.size.width}x${row.size.height}${row.withinBudget ? '' : '  ** OVER BUDGET **'}`
      );
    } catch (err) {
      row.error = String(err.message || err);
      console.error(`  FAIL ${item.key.padEnd(20)} ${row.error}`);
    }

    results.push(row);
  }

  const byKey = new Map(results.filter((r) => r.ok && !DRY_RUN).map((r) => [r.key, r]));

  // ---- patch data/brand-alternatives.json -----------------------------------
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const applied = [];
  const unphotographed = [];

  for (const entry of data.entries || []) {
    for (const alt of entry.alternatives || []) {
      const key = OVERRIDES[`${entry.serbianBrand}::${alt.brand}`] || BY_BRAND[alt.brand];
      const row = key ? byKey.get(key) : null;
      if (row) {
        alt.image = row.file;
        alt.imageSource = row.imageSource;
        alt.imageCredit = row.imageCredit;
        applied.push({ serbianBrand: entry.serbianBrand, brand: alt.brand, image: row.file });
      } else {
        // No photo for this brand: make sure a stale one is not left behind.
        delete alt.image;
        delete alt.imageSource;
        delete alt.imageCredit;
        unphotographed.push({ serbianBrand: entry.serbianBrand, brand: alt.brand });
      }
    }
  }

  if (!DRY_RUN) {
    fs.writeFileSync(DATA_FILE, stringify(data) + '\n', 'utf8');

    const report = {
      builtAt: new Date().toISOString(),
      purpose:
        'Provenance and gap record for the product photos in public/alternatives/, produced by scripts/fetch-alternative-photos.mjs. Every photo comes from the named producer\'s own official website; nothing here is from an image search, a stock library or a retailer listing.',
      rules: [
        "Only the producer's own official site (or the CDN that site serves its own assets from).",
        'Never attach a photo that is not confidently the named brand\'s own product — an absent image is correct, a wrong one is not.',
        'robots.txt honoured, one request at a time, polite delay between requests, no bot-protection bypass.',
        'imageSource + imageCredit recorded for every file so a producer objection can be actioned by deleting one row.',
      ],
      limits: { maxLongEdgePx: MAX_EDGE, maxBytes: MAX_BYTES },
      photographed: results,
      appliedTo: applied,
      brandsWithoutPhoto: GAPS,
      alternativesWithoutPhoto: unphotographed,
    };
    fs.writeFileSync(REPORT_FILE, stringify(report) + '\n', 'utf8');
  }

  const failed = results.filter((r) => !r.ok);
  console.log(
    `\n${results.length - failed.length}/${results.length} photos fetched; ${applied.length} alternatives given an image; ${unphotographed.length} left without one; ${GAPS.length} brands recorded as gaps.`
  );
  if (failed.length) {
    console.log('failed:', failed.map((f) => `${f.key} (${f.error})`).join(', '));
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
