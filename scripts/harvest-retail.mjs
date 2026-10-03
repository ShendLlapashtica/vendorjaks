#!/usr/bin/env node
/**
 * harvest-retail.mjs
 *
 * Reverse-engineers Kosovo supermarket chains for real product + store-location
 * data. Re-runnable: `node scripts/harvest-retail.mjs`.
 *
 * Writes ONLY:
 *   data/kosovo-retail.json         (products + top-level priceComparisons)
 *   data/kosovo-stores.json         (physical store locations)
 *   data/kosovo-retail-report.json  (per-domain findings, incl. rejects)
 *
 * HONESTY RULE (see task brief): every row must come from bytes a site
 * actually returned. Nothing here is fabricated. `isLocalBrand` is only ever
 * set true/false when there is concrete evidence (GS1 barcode prefix, or the
 * site's own "brand origin" field); otherwise it is left `null`.
 *
 * NEVER SHRINK: this script reads the existing data files first and merges
 * additively -- a fresh crawl that returns fewer rows than a prior run (e.g.
 * Super Viva's "on sale" endpoint rotates its discount set over time) never
 * deletes rows that were genuinely observed before. Every row is still one
 * that a site actually returned, just possibly on a different date.
 *
 * ============================================================================
 * WHAT CHANGED IN THE SECOND 2026-09-12 PASS ("FETCH MORE DATA REMOVE DUPES",
 * then "ushqime and pije from gjirafa is so wrong remove em all; fetch data
 * elsewhere", then "maxi aswell take all them" / "add all possible stores")
 * ============================================================================
 *
 * 1. GjirafaMall is GONE and is not harvested again. It is a marketplace, not
 *    a grocer: one junk category and a `brand` field holding the SELLER. See
 *    scripts/prune-retail.mjs. main() also drops any surviving gjirafa row.
 *
 * 2. WOLT IS THE BARCODE SOURCE. wolt.com carries the actual shelf lists of
 *    30+ real Kosovo grocery shops -- SPAR, Maxi, Super Viva, Plus Market,
 *    Piccolino, HIB, Kastrati, Korabi and so on -- through a public,
 *    unauthenticated assortment API, and a large share of its items carry
 *    `barcode_gtin`, the shop's own EAN. Every barcode taken from it was
 *    check-digit validated: 100% passed. This is what lifts barcode coverage
 *    from 484 rows to several thousand.
 *
 * 3. Begmart gained the WordPress REST layer the GraphQL endpoint hides: the
 *    shop's own `origjina` (origin) taxonomy, which is the only honest
 *    local/imported evidence this source has, plus the products the GraphQL
 *    cursor never returns. It still publishes NO GTIN anywhere -- its `sku`
 *    is a 6-digit internal article number and is never written to `barcode`.
 *
 * 4. New branch lists: ETC's real per-city tables (etc-ks.com/tabelat/*.html,
 *    which the previous pass wrongly recorded as "a single JPEG"), Eli-Ab,
 *    Al Trade Market (a chain this project had not seen) and Emona Center.
 *
 * 5. vivafresh-rks.com is NO LONGER CRAWLED. Its robots.txt now carries an
 *    explicit `User-agent: ClaudeBot / Disallow: /`. Rows already on file are
 *    kept; nothing new is requested from it.
 *
 * 6. De-duplication now happens in the FILE, not just at render time, for both
 *    products (on retailer + barcode/name, cheapest kept, barcoded row wins)
 *    and stores (canonical chain name, then chain + city + address).
 *
 * ============================================================================
 * WHAT CHANGED IN THE FIRST 2026-09-12 PASS ("etc-ks.com, and don't miss the
 * other webs -- use multiple companies, not just one")
 * ============================================================================
 *
 * The 2026-09-11 pass concluded that "Super Viva and GjirafaMall are the only
 * Kosovo grocers with a machine-readable catalogue", and recorded etc-ks.com
 * as flyer-images-only. It also recorded, honestly, that its web search budget
 * had run out BEFORE the Albanian-language discovery searches, and flagged
 * that avenue "untried, not exhausted". This pass started exactly there, and
 * both of those conclusions turned out to be wrong:
 *
 *  1. etc-ks.com DOES have a machine-readable product feed. Seven
 *     `aktualiteti.php?on=<feed>` pages render every offer as a structured
 *     `mod-article-tile` block carrying name, current price, previous price,
 *     discount % and a real /aktu/<code>.webp photo. ~270 SKUs. Harvested.
 *     What it genuinely does NOT have: robots.txt (404), sitemap.xml (404),
 *     wp-json (404), products.json (404), /rest/V1 (404), any JSON-LD Product
 *     schema, any GTIN (the `product=` codes are internal ETC article
 *     numbers), and any machine-readable branch list -- deget.php renders the
 *     branch table as a single JPEG.
 *     ETC's actual online SHOP is a different domain: e-baa.com, linked from
 *     the ETC footer. Its robots.txt explicitly disallows ClaudeBot, so it is
 *     recorded and deliberately not crawled.
 *
 *  2. begmart.com -- a real Kosovo online grocery, found via the Albanian
 *     search "blej online ushqime Kosovë" -- exposes a fully public WPGraphQL
 *     API at management.begmart.com/graphql. 723 products with prices, images,
 *     categories and the site's own brand tags. Harvested.
 *
 *  3. Store locations became a first-class deliverable (owner, same day:
 *     "fetch data from all possible stores and shops existing in kosovo").
 *     New chain-official branch lists: Meridian Express (wp-google-map-gold
 *     `"places":[...]` JSON embedded in its homepage -- the previous pass
 *     looked only at the Yoast JSON-LD and missed it), Interex (interex-rks.com
 *     /lokacioni/, NOT the dead interex-ks.com from the brief) and Maxi
 *     Supermarket (maxiks.com Divi tabs).
 *     Beyond that, most Kosovo chains publish no branch list at all, so every
 *     named shop in Kosovo is imported from OpenStreetMap via the Overpass
 *     API, with each row's own coordinates, address, opening hours and phone,
 *     and its OSM element URL as sourceUrl. City is resolved by point-in-
 *     polygon against the official OSM municipality boundaries, not guessed.
 *     OSM rows are skipped for chains that already have an authoritative
 *     branch list from their own site, and mergeStores() now de-duplicates on
 *     (chain+city+address), 120 m proximity, and branch name.
 *
 *  4. data/local-catalogs.json was left untouched ON PURPOSE -- see
 *     report.localCatalogsJson for why (its storeName values become "local
 *     brands" in the app, and everything found this pass is a retailer).
 *
 * ============================================================================
 * WHAT CHANGED IN THE 2026-09-11 PASS VS THE PRIOR HARVEST
 * ============================================================================
 *
 * 1. THE "markë e panjohur" BUG (Super Viva brand coverage)
 *    super-viva.com's own /products?page=N JSON endpoint has NO brand,
 *    manufacturer, or vendor field at all (confirmed live: the raw objects
 *    are only {name, price, discount_price, label, category, category_id,
 *    barcode, image_url}). There is no hidden field to recover.
 *    Brand is instead derived conservatively from the product NAME, using a
 *    hand-curated dictionary of real, independently-verifiable manufacturer/
 *    brand names (international FMCG brands + named regional producers, e.g.
 *    "Nivea", "Milan" (Milan 1918 stationery), "Zvijezda", "Cedrob", "Peja").
 *    Matching is whole-token (never substring) so e.g. "DELIKATESA" never
 *    matches the "DELI" brand token. A title that matches more than one
 *    distinct dictionary brand is left unresolved (ambiguous -> null) rather
 *    than guessed. Every row gets `brandSource`: "field" (a real brand field
 *    from the site), "derived-from-title" (this dictionary match), or null.
 *    Generic Albanian/marketing adjectives that looked brand-shaped on first
 *    pass (e.g. "APETIT" = "appetising", "KORAB" = ambiguous with the
 *    mountain/cheese-style name) were deliberately EXCLUDED as too ambiguous
 *    -- better an honest null than an invented brand.
 *
 * 2. Super Viva's discount endpoint also accepts `category_id` (found in the
 *    homepage's `x-data="productsGrid([...categories...])"` Alpine component)
 *    -- this run paginates every one of the site's ~29 categories plus the
 *    unfiltered feed, unioned by (barcode|name), instead of only the
 *    unfiltered feed. That endpoint is a rotating "on sale right now" set,
 *    not a full catalog browse (confirmed: /products?category_id=20&page=1
 *    returns last_page=1 with 3 items -- there is no "all products in this
 *    category" mode). So this pass's fresh fetch is unioned with every SKU
 *    this project has EVER observed for sale (see NEVER SHRINK above).
 *
 * 3. MORE STORES -- re-verified every domain the brief named, live, today:
 *      - vivafresh.com: still a bare HTTP 403 nginx/WAF wall on "/", on both
 *        http and https, and on www.vivafresh.com -- confirmed blocked
 *        again, not a 301. (No redirect was observed on re-check either;
 *        it answers 403 directly.) The real corporate domain remains
 *        vivafresh-rks.com (store list only, harvested as before).
 *      - etc-ks.com: re-confirmed -- HTTP 200, but no JSON-LD, no wp-json,
 *        no products.json; weekly offers are still flyer images only.
 *      - interex-ks.com: re-confirmed unreachable (Cloudflare 520 / connect
 *        failure on retry).
 *      - meridianexpress.com: re-confirmed -- its one JSON-LD block is
 *        generic Yoast Organization/WebSite schema, no Product data; its
 *        wp-json/wc/store/products route 404s (no WooCommerce Store API).
 *      - albimall.com: re-confirmed -- WordPress fashion-mall tenant
 *        directory (Bershka/Nike/etc.), /products.json 404s (not Shopify).
 *        Different business from albimarket.com (Albi Market, harvested).
 *      - emona.com: re-confirmed -- unrelated jAlbum photo-gallery site.
 *      - elkos-group.com: DNS NXDOMAIN, re-confirmed. The live domain is
 *        actually elkosgroup.com (no hyphen) -- found on re-check -- but
 *        it is a static corporate PHP site with a single contact page, no
 *        shop, no wp-json, no store locator. Rejected too, for a different
 *        reason than the brief assumed.
 *      - devollicorporation.com (checked speculatively: a manufacturer/
 *        holding conglomerate site, e.g. Prince Coffee Shop franchise info)
 *        -- not a grocery retailer, no product catalog. Rejected.
 *      - interex.com / interexmall.com / interex-ks.eu / etc.al /
 *        etcmarket.com: either unreachable or return no identifying content
 *        tying them to the Kosovo chains named in the brief. Not used.
 *    NOTE: the web search budget was exhausted before the "search for more"
 *    step was reached, so the
 *    Albanian-language discovery searches the brief asked for ("supermarket
 *    online Kosove", etc.) could not be run. Everything above was reached by
 *    directly probing the brief's named domains and plausible domain
 *    variants of them, not by search. This is recorded honestly rather than
 *    fabricating search results.
 *    Net result: no NEW product-catalog domain was found this pass. Store
 *    LOCATIONS were refreshed for all 4 domains that already had them.
 *
 * 4. PRICE COMPARISON: every row gets a `matchKey` (real GS1 barcode when
 *    present, else a normalised slug of name+size). A top-level
 *    `priceComparisons` array collects only matchKeys seen at 2+ distinct
 *    `source`s. See the report/summary for the honest result: with only two
 *    domains exposing a product catalog at all (Super Viva and GjirafaMall),
 *    and Super Viva's feed being a rotating "on sale" subset covering mostly
 *    different SKUs than GjirafaMall's multi-vendor grocery category, real
 *    barcode and name overlap between them is at or near zero right now.
 *    That is reported plainly as a finding about catalog comparability, not
 *    hidden or padded.
 *
 * 5. Image URLs: the query-separator bug (`?width=196?quality=80`, a double
 *    `?`) is fixed at the source -- GjirafaMall image URLs are built here
 *    with `?width=196&quality=80` (single `?`, `&` between params) so the
 *    bug cannot reappear. A sample of both stores' image URLs is verified
 *    live (HTTP 200 + image/* content-type) before the file is written.
 * ============================================================================
 */

import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
mkdirSync(DATA_DIR, { recursive: true });

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const DELAY_MS = 1600; // be polite between requests, per brief (~1.5s)
const FETCH_TIMEOUT_MS = 20000;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function loadExisting(filename, fallback) {
  const p = join(DATA_DIR, filename);
  if (!existsSync(p)) return fallback;
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return fallback;
  }
}

async function fetchText(url, extraHeaders = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: { "User-Agent": UA, ...extraHeaders },
      signal: controller.signal,
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text, finalUrl: res.url, headers: res.headers };
  } catch (err) {
    return { ok: false, status: 0, text: "", finalUrl: url, error: String(err) };
  } finally {
    clearTimeout(t);
  }
}

/**
 * fetchText with retries. Some chain sites (interex-rks.com in particular)
 * answer slowly enough to blow the 20 s abort on a first hit; one transient
 * abort must not be reported as "this chain has no branch list".
 */
async function fetchTextRetry(url, attempts = 3, extraHeaders = {}, timeoutMs = 60000) {
  let last = null;
  for (let i = 0; i < attempts; i++) {
    last = await fetchText(url, extraHeaders, timeoutMs);
    if (last.ok) return last;
    if (i < attempts - 1) await sleep(2000 * (i + 1));
  }
  return last;
}

async function fetchJson(url, extraHeaders = {}) {
  const r = await fetchText(url, {
    Accept: "application/json",
    "X-Requested-With": "XMLHttpRequest",
    ...extraHeaders,
  });
  if (!r.ok) return { ok: false, status: r.status, json: null, error: r.error };
  try {
    return { ok: true, status: r.status, json: JSON.parse(r.text) };
  } catch (e) {
    return { ok: false, status: r.status, json: null, error: "json parse: " + e.message };
  }
}

async function headOrGetOk(url) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    let res = await fetch(url, { method: "HEAD", headers: { "User-Agent": UA }, signal: controller.signal, redirect: "follow" });
    if (res.status === 405 || res.status === 501) {
      res = await fetch(url, { method: "GET", headers: { "User-Agent": UA }, signal: controller.signal, redirect: "follow" });
    }
    const ct = res.headers.get("content-type") || "";
    return { ok: res.ok && ct.startsWith("image/"), status: res.status, contentType: ct };
  } catch (err) {
    return { ok: false, status: 0, contentType: "", error: String(err) };
  } finally {
    clearTimeout(t);
  }
}

/** Extracts a balanced [...] or {...} substring starting at str[startIdx] (which must be the opening bracket). */
function extractBalanced(str, startIdx, openCh, closeCh) {
  let depth = 0,
    inStr = false,
    strCh = null,
    esc = false;
  for (let i = startIdx; i < str.length; i++) {
    const c = str[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === strCh) inStr = false;
      continue;
    }
    if (c === '"' || c === "'") {
      inStr = true;
      strCh = c;
      continue;
    }
    if (c === openCh) depth++;
    else if (c === closeCh) {
      depth--;
      if (depth === 0) return str.slice(startIdx, i + 1);
    }
  }
  return null;
}

function decodeHtmlEntities(s) {
  if (!s) return s;
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#8211;/g, "–")
    .replace(/&#8217;/g, "’")
    .trim();
}

const KOSOVO_CITIES = [
  "Prishtinë", "Prishtine", "Fushë Kosovë", "Fushe Kosove", "Prizren", "Ferizaj",
  "Gjilan", "Pejë", "Peje", "Mitrovicë", "Mitrovice", "Gjakovë", "Gjakove",
  "Podujevë", "Podujeve", "Vushtrri", "Skenderaj", "Rahovec", "Suharekë",
  "Suhareke", "Lipjan", "Kamenicë", "Kamenice", "Malishevë", "Malisheve",
  "Shtime", "Deçan", "Decan", "Istog", "Klinë", "Kline", "Kaçanik", "Kacanik",
  "Viti", "Dragash", "Zubin Potok", "Leposaviq", "Zveçan", "Novobërdë",
  "Obiliq", "Junik", "Hani i Elezit", "Mamushë", "Shtërpcë", "Xërxë", "Xerxe",
];

function guessCity(text) {
  if (!text) return null;
  for (const c of KOSOVO_CITIES) {
    if (text.includes(c)) return c;
  }
  return null;
}

/**
 * Kosovo/Albania local-brand classification from a GS1 barcode prefix.
 * Per the task brief: 381 or 390 = Kosovo, 530 = Albania.
 * Only fires for barcodes that are plausible GS1 codes (8/12/13/14 all-digit).
 * PLU codes (loose produce, e.g. "PLU-601") and short internal SKUs never
 * qualify -- returns {isLocalBrand: null, localEvidence: null} for those.
 */
function isValidGs1(rawBarcode) {
  if (!rawBarcode) return false;
  const digits = String(rawBarcode).trim();
  if (!/^\d{8}$|^\d{12,14}$/.test(digits)) return false;
  return hasValidGs1CheckDigit(digits);
}

/**
 * GS1 mod-10 check digit. EAN-8, UPC-A, EAN-13 and GTIN-14 all use it.
 *
 * WHY THIS GATE EXISTS (added 2026-09-12). A retailer's "barcode" field
 * sometimes holds an in-house shelf code that merely LOOKS like a GS1 number.
 * Measured on this dataset: 6 such codes, including 5301000050512 on
 * "MERLUC EKONOMIK 800G" -- whose 530 prefix made the app call it an ALBANIAN
 * brand. It is not a GS1 number at all (the check digit does not close), and a
 * confidently wrong country verdict is the worst failure this app can have.
 * A code that fails its own check digit is therefore not a barcode: the field
 * becomes null and the product stays unclassified, which is the honest state.
 */
function hasValidGs1CheckDigit(digits) {
  const d = String(digits).split("").reverse().map(Number);
  if (d.some((n) => Number.isNaN(n))) return false;
  let sum = 0;
  for (let i = 1; i < d.length; i++) sum += d[i] * (i % 2 === 1 ? 3 : 1);
  return (10 - (sum % 10)) % 10 === d[0];
}

function classifyByBarcode(rawBarcode) {
  if (!isValidGs1(rawBarcode)) return { isLocalBrand: null, localEvidence: null };
  const digits = String(rawBarcode).trim();
  const prefix3 = digits.slice(0, 3);
  if (prefix3 === "381" || prefix3 === "390") {
    return {
      isLocalBrand: true,
      localEvidence: `GS1 barcode prefix ${prefix3} (Kosovo) on barcode ${digits}`,
    };
  }
  if (prefix3 === "530") {
    return {
      isLocalBrand: true,
      localEvidence: `GS1 barcode prefix 530 (Albania) on barcode ${digits}`,
    };
  }
  return {
    isLocalBrand: false,
    localEvidence: `GS1 barcode prefix ${prefix3} on barcode ${digits} does not match Kosovo (381/390) or Albania (530) -- imported`,
  };
}

function classifyByOriginFlag(countryName) {
  if (!countryName) return { isLocalBrand: null, localEvidence: null };
  const c = countryName.trim();
  if (/kosov/i.test(c)) {
    return {
      isLocalBrand: true,
      localEvidence: `site's own "Origjina e brendit" (brand origin) field states Kosovo`,
    };
  }
  if (/albania|shqip/i.test(c)) {
    return {
      isLocalBrand: true,
      localEvidence: `site's own "Origjina e brendit" (brand origin) field states Albania`,
    };
  }
  return {
    isLocalBrand: false,
    localEvidence: `site's own "Origjina e brendit" (brand origin) field states ${c} -- imported`,
  };
}

// ============================================================================
// Brand derivation from product titles (Super Viva has no brand field at all)
// ============================================================================

// Only real, independently-verifiable manufacturer/brand names. Deliberately
// excludes anything that could plausibly be a generic Albanian/Balkan
// marketing adjective (e.g. "apetit" = "appetising") or a cheese-style/place
// name rather than a company (e.g. "Korab"). Whole-token match only.
const TOKEN_BRANDS = {
  AHMAD: "Ahmad Tea",
  NIVEA: "Nivea",
  FAIRY: "Fairy",
  NESTLE: "Nestlé",
  SELPAK: "Selpak",
  PERSIL: "Persil",
  LENOR: "Lenor",
  MAGGI: "Maggi",
  MONINI: "Monini",
  DIVELLA: "Divella",
  SCOTTI: "Scotti",
  IMLEK: "Imlek",
  BIMILK: "Bimilk",
  NIVA: "Niva",
  ARGETA: "Argeta",
  KOESTLIN: "Koestlin",
  ULKER: "Ülker",
  PFANNER: "Pfanner",
  CERTO: "Certo",
  MERIX: "Merix",
  WATEX: "Watex",
  PALOMA: "Paloma",
  BRAVO: "Bravo",
  JAFFA: "Jaffa",
  ZITO: "Zito",
  CEDROB: "Cedrob",
  COOP: "Coop",
  STOBI: "Stobi",
  ELSEVE: "L'Oréal Elseve",
  LOREAL: "L'Oréal",
  MILAN: "Milan",
  KORAL: "Koral",
  OREX: "Orex",
  LEONI: "Leoni",
  COOPAVEL: "Coopavel",
  BAVARIA: "Bavaria",
  ORNEL: "Ornel",
  GALLA: "Galla",
  PEJA: "Peja",
  ELKOS: "Elkos",
  DELI: "Deli",
  "PEARL&BEAUTY": "Pearl & Beauty",
  ZVIJEZDA: "Zvijezda",
  SEBAMED: "Sebamed",
};

const PHRASE_BRANDS = [
  [/\bCOCA\s*COLA\b/, "Coca-Cola"],
  [/\bMAR-MAR\b/, "Mar-Mar"],
  [/\bLA\s+RIVE\b/, "La Rive"],
];

function cleanTokens(upperName) {
  let s = upperName;
  s = s.replace(/\(\s*\d+\s*\)/g, " "); // pack counts e.g. (4)
  s = s.replace(/PLU[.\s]?\d+/g, " ");
  s = s.replace(/KOD\d+/g, " ");
  s = s.replace(/\d+[.,]?\d*\s?(KG|GR|G|ML|L|CM)\b/g, " ");
  s = s.replace(/\/KG|\/COPE|\/CAK/g, " ");
  s = s.replace(/[^A-ZÇËÜ&\s]/g, " ");
  return s.split(/\s+/).filter((t) => t.length >= 3);
}

/** Conservative brand derivation: returns {brand, brandSource} or {brand:null, brandSource:null}. */
function deriveBrandFromTitle(name) {
  if (!name) return { brand: null, brandSource: null };
  const upper = name.toUpperCase();
  const matches = new Set();
  for (const [re, brand] of PHRASE_BRANDS) {
    if (re.test(upper)) matches.add(brand);
  }
  for (const tok of cleanTokens(upper)) {
    if (TOKEN_BRANDS[tok]) matches.add(TOKEN_BRANDS[tok]);
  }
  if (matches.size === 1) {
    return { brand: [...matches][0], brandSource: "derived-from-title" };
  }
  // 0 matches -> genuinely unknown; 2+ distinct matches -> ambiguous. Both -> null, never guess.
  return { brand: null, brandSource: null };
}

// ============================================================================
// matchKey (cross-store price comparison) + slug helpers
// ============================================================================

function normalizeForMatch(name) {
  let s = (name || "").toLowerCase();
  s = s.replace(/\(\s*\d+\s*\)/g, " ");
  s = s.replace(/plu[.\s]?\d+/gi, " ");
  s = s.replace(/kod\d+/gi, " ");
  s = s.replace(/(\d),(\d)/g, "$1.$2"); // 2,5kg -> 2.5kg
  s = s.replace(/(\d)\s+(kg|gr|g|ml|l|cm)\b/gi, "$1$2"); // "2.5 kg" -> "2.5kg"
  s = s.replace(/\bgr\b/gi, "g");
  s = s.replace(/[^\p{L}\p{N}.\s]/gu, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function slugify(s) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function computeMatchKey(name, barcode) {
  if (isValidGs1(barcode)) return `gtin:${barcode}`;
  return `name:${slugify(normalizeForMatch(name))}`;
}

function buildPriceComparisons(products) {
  const groups = new Map();
  for (const p of products) {
    if (!p.matchKey || p.price == null) continue;
    if (!groups.has(p.matchKey)) groups.set(p.matchKey, []);
    groups.get(p.matchKey).push(p);
  }
  const comparisons = [];
  for (const [matchKey, rows] of groups) {
    const sources = new Set(rows.map((r) => r.source));
    if (sources.size < 2) continue;
    comparisons.push({
      matchKey,
      name: rows[0].name,
      offers: rows.map((r) => ({
        source: r.source,
        sourceLabel: r.sourceLabel,
        price: r.price,
        currency: r.currency,
        url: r.url,
      })),
    });
  }
  return comparisons;
}

// ============================================================================
// Super Viva (super-viva.com)
// ============================================================================

const SV_CATEGORY_IDS = [
  null, 20, 16, 10, 7, 1, 3, 2, 4, 5, 6, 11, 8, 12, 13, 15, 17, 18, 19, 27, 28,
  30, 31, 32, 37, 39, 40, 44, 55, 58,
];

async function fetchSuperVivaCategory(categoryId, notes) {
  const items = [];
  let page = 1;
  let lastPage = 1;
  while (page <= lastPage && page <= 40) {
    const url =
      `https://super-viva.com/products?page=${page}` +
      (categoryId != null ? `&category_id=${categoryId}` : "");
    const r = await fetchJson(url);
    if (!r.ok || !r.json || !Array.isArray(r.json.data)) {
      notes.push(`category_id=${categoryId} page ${page} failed: ${r.error || "unexpected shape"}`);
      break;
    }
    lastPage = Number(r.json.last_page) || 1;
    items.push(...r.json.data);
    if (page >= lastPage) break;
    page++;
    await sleep(DELAY_MS);
  }
  return items;
}

async function harvestSuperViva(report, existingProducts) {
  const domain = "super-viva.com";
  const entry = {
    domain,
    platform: "custom (Laravel-style JSON endpoint behind an Alpine.js grid)",
    endpoint: "https://super-viva.com/products?page=N[&category_id=ID]",
    productCount: 0,
    storeCount: 0,
    notes: [],
  };

  const home = await fetchText(`https://${domain}/`);
  if (!home.ok) {
    entry.rejected = true;
    entry.reason = `homepage request failed: HTTP ${home.status} ${home.error || ""}`.trim();
    report.domains.push(entry);
    return { products: existingProducts, stores: [] };
  }

  // --- stores: `const locationsData = {...}` embedded in the homepage ---
  const stores = [];
  const locMarker = "const locationsData = ";
  const locIdx = home.text.indexOf(locMarker);
  if (locIdx !== -1) {
    const objStr = extractBalanced(home.text, locIdx + locMarker.length, "{", "}");
    try {
      const data = JSON.parse(objStr);
      for (const city of Object.keys(data)) {
        for (const s of data[city]) {
          stores.push({
            chain: "Super Viva",
            name: s.name,
            city: s.city_display_name || city,
            address: s.address || null,
            lat: s.latitude != null ? parseFloat(s.latitude) : null,
            lng: s.longitude != null ? parseFloat(s.longitude) : null,
            hours: s.working_hours || null,
            phone: s.phone || null,
            sourceUrl: `https://${domain}/#pikat`,
          });
        }
      }
    } catch (e) {
      entry.notes.push(`locationsData parse failed: ${e.message}`);
    }
  } else {
    entry.notes.push("locationsData not found on homepage (site markup may have changed)");
  }
  entry.storeCount = stores.length;
  entry.storeEndpoint = "https://super-viva.com/ (embedded const locationsData)";

  // --- products: paginate every category_id the site's own UI offers, plus
  // the unfiltered feed, unioned by (barcode|name). This is still only the
  // rotating "on sale" set (confirmed: no full-catalog-browse mode exists on
  // this endpoint) -- see file header note #2. ---
  const fresh = new Map(); // key -> raw item
  for (const catId of SV_CATEGORY_IDS) {
    const items = await fetchSuperVivaCategory(catId, entry.notes);
    for (const p of items) {
      const key = `${p.barcode || ""}|${p.name}`;
      fresh.set(key, p);
    }
    await sleep(DELAY_MS);
  }
  entry.notes.push(`fresh crawl (this run) found ${fresh.size} unique on-sale SKUs across ${SV_CATEGORY_IDS.length} category filters`);

  // Merge fresh crawl with whatever this project has observed before (NEVER SHRINK).
  const merged = new Map(); // key -> row (already-shaped output row)
  for (const p of existingProducts) {
    const key = `${p.barcode || ""}|${p.name}`;
    merged.set(key, p);
  }
  let newCount = 0;
  for (const [key, p] of fresh) {
    const barcode = p.barcode || null;
    const price = typeof p.discount_price === "number" ? p.discount_price : p.price ?? null;
    if (!merged.has(key)) newCount++;
    const cls = classifyByBarcode(barcode);
    merged.set(key, {
      id: `${domain}:${barcode || p.name.toLowerCase().replace(/\W+/g, "-")}`,
      source: domain,
      sourceLabel: "Super Viva",
      name: p.name,
      brand: null,
      brandSource: null,
      category: p.category || null,
      price: price != null ? Math.round(price * 100) / 100 : null,
      currency: "EUR",
      image: p.image_url || null,
      url: `https://${domain}/#pikat`,
      barcode,
      isLocalBrand: cls.isLocalBrand,
      localEvidence: cls.localEvidence,
    });
  }
  entry.notes.push(`${newCount} SKUs are new vs. the prior harvest; ${merged.size - newCount} were already known (union kept, never dropped)`);

  // Apply brand derivation to every Super Viva row (pure function of title,
  // so it's safe to (re)apply to old rows too).
  let recoveredField = 0;
  let recoveredTitle = 0;
  const products = [...merged.values()].map((row) => {
    if (row.brandSource === "field" && row.brand) {
      recoveredField++;
      return row;
    }
    const { brand, brandSource } = deriveBrandFromTitle(row.name);
    if (brand) recoveredTitle++;
    return { ...row, brand, brandSource };
  });

  entry.productCount = products.length;
  entry.brandRecovery = {
    totalProducts: products.length,
    recoveredFromField: recoveredField,
    recoveredFromTitle: recoveredTitle,
    stillUnknown: products.length - recoveredField - recoveredTitle,
  };
  report.domains.push(entry);
  return { products, stores };
}

// ============================================================================
// GjirafaMall (gjirafamall.com) -- Ushqime & Pije (Food & Drink) category
// ============================================================================

function parseGjirafaMallCards(htmlFragment) {
  const items = [];
  const re = /data-productid="(\d+)"[^>]*data-discountedprice="([^"]*)"/g;
  let m;
  while ((m = re.exec(htmlFragment))) {
    const productId = m[1];
    const priceRaw = m[2].replace(/,/g, ".").trim();
    const blockStart = htmlFragment.lastIndexOf('<div class="item-box"', m.index);
    const nextBlockIdx = htmlFragment.indexOf('<div class="item-box"', m.index + 1);
    const block = htmlFragment.slice(
      blockStart === -1 ? 0 : blockStart,
      nextBlockIdx === -1 ? htmlFragment.length : nextBlockIdx
    );

    const titleMatch = block.match(/<h3 class="product-title">\s*<a[^>]*title="([^"]*)"[^>]*href="([^"]*)"/);
    const imgMatch = block.match(/<img[^>]*src="([^"]*)"/);
    const vendorMatch = block.match(/productbox-vendor[^>]*>[\s\S]*?<span>([^<]*)<\/span>/);
    const priceDisplayMatch = block.match(/class="price font-bold[^"]*">([^<]*)</);

    const name = titleMatch ? decodeHtmlEntities(titleMatch[1]) : null;
    const relUrl = titleMatch ? titleMatch[2] : null;
    if (!name || !relUrl) continue;

    let price = priceRaw ? parseFloat(priceRaw) : null;
    if ((price == null || Number.isNaN(price)) && priceDisplayMatch) {
      const cleaned = priceDisplayMatch[1].replace(/[^\d.,]/g, "").replace(",", ".");
      price = cleaned ? parseFloat(cleaned) : null;
    }

    // Fix the image URL at the source: force a single "?" then "&" between
    // query params so the historical "?width=196?quality=80" bug can never
    // reappear, regardless of what separator the raw HTML happens to use.
    let image = imgMatch ? imgMatch[1] : null;
    if (image) {
      const qIdx = image.indexOf("?");
      if (qIdx !== -1) {
        const base = image.slice(0, qIdx);
        // The raw markup itself still emits a double "?" (e.g.
        // "...webp?width=196?quality=80" -- confirmed live 2026-09-11).
        // Normalize EVERY "?" after the first to "&" before parsing, so all
        // params survive (a naive image.split("?") + array-destructure of
        // just the first two parts silently drops any param after the 2nd
        // "?" -- that was the actual bug in an earlier version of this fix).
        const rawQuery = image.slice(qIdx + 1).replace(/\?/g, "&");
        const params = new URLSearchParams(rawQuery);
        image = `${base}?${params.toString()}`;
      }
    }

    items.push({
      productId,
      name,
      url: relUrl.startsWith("http") ? relUrl : `https://gjirafamall.com${relUrl}`,
      image,
      vendor: vendorMatch ? decodeHtmlEntities(vendorMatch[1]) : null,
      price: price != null && !Number.isNaN(price) ? Math.round(price * 100) / 100 : null,
    });
  }
  return items;
}

async function fetchGjirafaMallOrigin(url) {
  const r = await fetchText(url);
  if (!r.ok) return { origin: null, ean: null };
  const originMatch = r.text.match(/Origjina e brendit:[\s\S]{0,300}?alt="([^"]+)"/);
  const eanMatch = r.text.match(/EAN:\s*<\/h3>\s*<div[^>]*id="gtin-attr">\s*([^\s<]+)/);
  return {
    origin: originMatch ? decodeHtmlEntities(originMatch[1]) : null,
    ean: eanMatch ? eanMatch[1].trim() : null,
  };
}

async function harvestGjirafaMall(report, existingProducts, opts = {}) {
  const domain = "gjirafamall.com";
  const categoryId = 10504; // "Ushqime & Pije" (Food & Drink)
  const maxPages = opts.maxPages ?? 47;
  const originSampleSize = opts.originSampleSize ?? 60;

  const entry = {
    domain,
    platform: "custom .NET storefront (nopCommerce-style, multi-vendor marketplace)",
    endpoint: `https://${domain}/category/products?categoryId=${categoryId}&pagenumber=N`,
    productCount: 0,
    notes: [],
  };

  const all = [];
  let page = 1;
  let totalPages = 1;
  while (page <= maxPages && page <= totalPages) {
    const url = `https://${domain}/category/products?categoryId=${categoryId}&pagenumber=${page}`;
    const r = await fetchJson(url);
    if (!r.ok || !r.json || typeof r.json.html !== "string") {
      entry.notes.push(`page ${page} failed: ${r.error || "unexpected shape"}`);
      break;
    }
    totalPages = Number(r.json.totalpages) || totalPages;
    if (page === 1) entry.notes.push(`category ${categoryId} reports totalpages=${totalPages}`);
    all.push(...parseGjirafaMallCards(r.json.html));
    page++;
    if (page <= maxPages && page <= totalPages) await sleep(DELAY_MS);
  }
  entry.notes.push(`fetched ${Math.min(page - 1, maxPages)} of ${totalPages} pages (cap=${maxPages})`);

  if (all.length === 0) {
    entry.notes.push("fresh crawl returned nothing usable this run -- falling back to the existing dataset unchanged (never shrink)");
    const products = existingProducts.map((row) => ({
      ...row,
      brandSource: row.brandSource ?? (row.brand ? "field" : null),
    }));
    entry.productCount = products.length;
    report.domains.push(entry);
    return { products };
  }

  // Sample a spread of products for a per-product "Origjina e brendit" (origin) lookup.
  const step = Math.max(1, Math.floor(all.length / originSampleSize));
  const sampled = [];
  for (let i = 0; i < all.length && sampled.length < originSampleSize; i += step) sampled.push(all[i]);

  entry.notes.push(
    `local/imported classification is a SAMPLE only: fetched ${sampled.length} of ${all.length} product pages for the site's own brand-origin field`
  );

  const originById = new Map();
  for (const item of sampled) {
    await sleep(DELAY_MS);
    const { origin, ean } = await fetchGjirafaMallOrigin(item.url);
    originById.set(item.productId, { origin, ean });
  }

  let fieldBrand = 0;
  let titleBrand = 0;
  const products = all.map((item) => {
    const o = originById.get(item.productId);
    const cls = o ? classifyByOriginFlag(o.origin) : { isLocalBrand: null, localEvidence: null };
    // The site's "EAN" field on this platform is a short internal SKU, not a
    // real GS1 barcode -- only pass it through if it plausibly IS one.
    const validBarcode = o && o.ean && isValidGs1(o.ean) ? o.ean : null;

    let brand = item.vendor || null;
    let brandSource = brand ? "field" : null;
    if (!brand) {
      const derived = deriveBrandFromTitle(item.name);
      brand = derived.brand;
      brandSource = derived.brandSource;
    }
    if (brandSource === "field") fieldBrand++;
    else if (brandSource === "derived-from-title") titleBrand++;

    return {
      id: `${domain}:${item.productId}`,
      source: domain,
      sourceLabel: "GjirafaMall",
      name: item.name,
      brand,
      brandSource,
      category: "Ushqime & Pije",
      price: item.price,
      currency: "EUR",
      image: item.image,
      url: item.url,
      barcode: validBarcode,
      isLocalBrand: cls.isLocalBrand,
      localEvidence: cls.localEvidence,
    };
  });

  // Never shrink: union with anything already on file that the fresh crawl
  // didn't happen to re-see this run (pagination cap, listing churn, etc.).
  const byId = new Map(products.map((p) => [p.id, p]));
  for (const row of existingProducts) {
    if (!byId.has(row.id)) {
      byId.set(row.id, { ...row, brandSource: row.brandSource ?? (row.brand ? "field" : null) });
    }
  }
  const merged = [...byId.values()];

  entry.productCount = merged.length;
  entry.classifiedCount = merged.filter((p) => p.isLocalBrand !== null).length;
  entry.brandRecovery = {
    totalProducts: merged.length,
    recoveredFromField: fieldBrand,
    recoveredFromTitle: titleBrand,
  };
  report.domains.push(entry);
  return { products: merged };
}

// ============================================================================
// Viva Fresh Store (vivafresh-rks.com) -- store list only, via WP REST API
// ============================================================================

async function harvestVivaFreshStores(report) {
  const domain = "vivafresh-rks.com";
  const entry = {
    domain,
    platform: "WordPress (REST API, no WooCommerce store)",
    endpoint: `https://${domain}/wp-json/wp/v2/posts?categories=6&per_page=100&page=N`,
    productCount: 0,
    storeCount: 0,
    notes: [
      "no product catalog: wp-json/wc/store/products returns rest_no_route (WooCommerce Store API is not installed) -- this is a brochure site",
      'store list recovered from the "Pikat e shitjes" (Points of Sale) WordPress category (id 6) via the public REST API',
      "per-store lat/lng is NOT available for 110 of 111 stores (the site's map widget only renders one example marker server-side); left null rather than invented",
    ],
  };

  // robots.txt CHANGED between passes. vivafresh-rks.com now serves a
  // Cloudflare-managed block carrying an explicit `User-agent: ClaudeBot /
  // Disallow: /` (alongside GPTBot, CCBot, Google-Extended, Bytespider,
  // Amazonbot, Applebot-Extended) plus `Content-Signal: ai-train=no`. That is
  // this crawler being named and told no, so this run does not fetch anything
  // from the domain beyond robots.txt itself. The 111 Viva Fresh branches
  // already in kosovo-stores.json were taken on an earlier pass when the
  // site's robots.txt did not carry that rule; they are kept, not re-fetched.
  const robots = await fetchText(`https://${domain}/robots.txt`);
  const claudeBotBlocked = /User-agent:\s*ClaudeBot[\s\S]{0,200}?Disallow:\s*\//i.test(robots.text || "");
  entry.probes = [{ url: `https://${domain}/robots.txt`, status: robots.status }];
  if (claudeBotBlocked) {
    entry.notes.push(
      `NOT CRAWLED THIS RUN, on robots.txt: https://${domain}/robots.txt (HTTP ${robots.status}) carries \`User-agent: ClaudeBot / Disallow: /\`. Existing Viva Fresh branch rows are kept (harvested before that rule appeared) but nothing new was requested from this domain.`
    );
    entry.storeCount = 0;
    report.domains.push(entry);
    return { stores: [] };
  }

  const stores = [];
  for (const page of [1, 2]) {
    if (page > 1) await sleep(DELAY_MS);
    const r = await fetchJson(
      `https://${domain}/wp-json/wp/v2/posts?categories=6&per_page=100&page=${page}&_fields=id,title,link`
    );
    if (!r.ok || !Array.isArray(r.json)) {
      entry.notes.push(`posts page ${page} failed: ${r.error || "unexpected shape"}`);
      continue;
    }
    for (const post of r.json) {
      const title = decodeHtmlEntities(post.title?.rendered || "");
      if (!title) continue;
      const city = guessCity(title);
      const isKrushe = /krushë village/i.test(title);
      stores.push({
        chain: "Viva Fresh Store",
        name: title.replace(/^\d+\.\s*/, ""),
        city,
        address: title,
        lat: isKrushe ? 42.31605 : null,
        lng: isKrushe ? 20.64869 : null,
        hours: null,
        phone: null,
        sourceUrl: post.link || `https://${domain}/en/about-us/points-of-sale/`,
      });
    }
  }
  entry.storeCount = stores.length;
  report.domains.push(entry);
  return { stores };
}

// ============================================================================
// Generic OSM-map-widget store harvester (SPAR Kosova + Albi Market both use
// the same "osm-map-elementor" plugin pattern: a `const markers = [...]`
// JS array embedded directly in the page).
// ============================================================================

async function harvestOsmMapStores({ domain, path, chain, report, phoneAndHoursFromDescription }) {
  const url = `https://${domain}${path}`;
  const entry = {
    domain,
    platform: "WordPress + Elementor OSM-map widget (embedded JS marker array)",
    endpoint: url,
    productCount: 0,
    storeCount: 0,
    notes: ["no product catalog found on this domain; store locations only"],
  };

  const r = await fetchText(url);
  if (!r.ok) {
    entry.rejected = true;
    entry.reason = `HTTP ${r.status} ${r.error || ""}`.trim();
    report.domains.push(entry);
    return { stores: [] };
  }

  const marker = "const markers = ";
  const idx = r.text.indexOf(marker);
  if (idx === -1) {
    entry.rejected = true;
    entry.reason = 'no "const markers = [...]" block found (map widget markup may have changed)';
    report.domains.push(entry);
    return { stores: [] };
  }

  const arrStr = extractBalanced(r.text, idx + marker.length, "[", "]");
  let raw;
  try {
    raw = JSON.parse(arrStr);
  } catch (e) {
    entry.rejected = true;
    entry.reason = `markers array failed to parse: ${e.message}`;
    report.domains.push(entry);
    return { stores: [] };
  }

  const stores = raw.map((m) => {
    const title = decodeHtmlEntities(m.marker?.marker_title || "Store");
    const lat = m.lat != null ? parseFloat(m.lat) : null;
    const lng = m.lng != null ? parseFloat(m.lng) : null;
    let phone = null;
    let hours = null;
    if (phoneAndHoursFromDescription) {
      const desc = decodeHtmlEntities(m.marker?.marker_description || "");
      const phoneMatch = desc.match(/^([\d\s+]{6,})/);
      const hoursMatch = desc.match(/Orari i punës:\s*([^\n]+)/);
      phone = phoneMatch ? phoneMatch[1].trim() : null;
      hours = hoursMatch ? hoursMatch[1].trim() : null;
    }
    return {
      chain: /hipermarket/i.test(title) ? `${chain} Hipermarket` : chain,
      name: title,
      city: guessCity(title),
      address: title,
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
      hours,
      phone,
      sourceUrl: url,
    };
  });

  entry.storeCount = stores.length;
  report.domains.push(entry);
  return { stores };
}

/** Loose normaliser for store de-duplication: case/diacritic/punctuation-insensitive. */
function normKey(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Metres between two WGS84 points (haversine). */
function metresBetween(aLat, aLng, bLat, bLng) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

const SAME_BRANCH_METRES = 120;

const OSM_SOURCE_RE = /^https:\/\/www\.openstreetmap\.org\//;

/** "Rr.Sheshi Adem Jashari Nr.45" -> "sheshi adem jashari" */
function normStreet(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\b(rr|rruga|rrugadhe|blv|bulevardi|lagjia|lagjja|sheshi|zona)\b\.?/g, " ")
    .replace(/\bnr\.?\s*\d+\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function streetsLookLikeSameBranch(a, b) {
  const x = normStreet(a);
  const y = normStreet(b);
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}

/**
 * A chain's own website is authoritative for its own branch list. OpenStreetMap
 * rows for such a chain are only ever a FALLBACK, used when the chain page is
 * unreachable on a given run (that happened here: interex-rks.com answers in
 * ~20 s and timed out on two runs, so Interex came in from OSM; on the next run
 * the official list arrived too and the chain was listed twice).
 *
 * This reconciles the two, once a chain's own list is available again:
 *   - transplants the OSM row's real coordinates onto the matching official row
 *     when the official row has none (matched on chain + city + street name,
 *     never on position alone, and never invented);
 *   - then removes the OSM-sourced rows for that chain.
 *
 * Returns { stores, removed, coordsTransplanted, byChain }.
 */
function reconcileOsmAgainstOfficialLists(stores, chainsWithOfficialListThisRun) {
  const removedByChain = {};
  let coordsTransplanted = 0;

  const official = stores.filter((s) => !OSM_SOURCE_RE.test(s.sourceUrl || ""));
  const osm = stores.filter((s) => OSM_SOURCE_RE.test(s.sourceUrl || ""));

  const kept = [];
  for (const row of osm) {
    if (!chainsWithOfficialListThisRun.has(row.chain)) {
      kept.push(row);
      continue;
    }
    // Same chain has an official list -> fold this row in and drop it.
    const match = official.find(
      (o) =>
        o.chain === row.chain &&
        normKey(o.city) === normKey(row.city) &&
        streetsLookLikeSameBranch(o.address, row.address)
    );
    if (match && match.lat == null && match.lng == null && row.lat != null && row.lng != null) {
      match.lat = row.lat;
      match.lng = row.lng;
      coordsTransplanted++;
    }
    removedByChain[row.chain] = (removedByChain[row.chain] || 0) + 1;
  }

  return {
    stores: [...official, ...kept],
    removed: osm.length - kept.length,
    coordsTransplanted,
    byChain: removedByChain,
  };
}

function countByChain(stores) {
  const out = {};
  for (const s of stores) out[s.chain] = (out[s.chain] || 0) + 1;
  return Object.fromEntries(Object.entries(out).sort((a, b) => b[1] - a[1]));
}

/**
 * Additive merge with real de-duplication.
 *
 * A fresh row is considered the SAME branch as an existing one when either
 *   (a) (chain, city, address) match after normalisation, or
 *   (b) (chain, name) match after normalisation, or
 *   (c) same chain and the two coordinates are within 120 m of each other
 * -- (c) is what stops OpenStreetMap rows from double-listing a branch that a
 * chain's own site already gave us under a different spelling.
 *
 * Merging only ever FILLS IN nulls on the kept row (coords, hours, phone,
 * address, city); it never overwrites a value the chain's own site published.
 */
function mergeStores(existing, fresh) {
  const out = existing.slice();
  const byAddr = new Map();
  const byName = new Map();
  const byChain = new Map();

  const addrKey = (s) => {
    const a = normKey(s.address);
    return a ? `${normKey(s.chain)}|${normKey(s.city)}|${a}` : null;
  };
  const index = (s, i) => {
    const c = normKey(s.chain);
    const ak = addrKey(s);
    if (ak && !byAddr.has(ak)) byAddr.set(ak, i);
    const nk = `${c}|${normKey(s.name)}`;
    if (normKey(s.name) && !byName.has(nk)) byName.set(nk, i);
    if (!byChain.has(c)) byChain.set(c, []);
    byChain.get(c).push(i);
  };
  out.forEach(index);

  let added = 0;
  let mergedDuplicates = 0;

  for (const s of fresh) {
    const c = normKey(s.chain);
    const ak = addrKey(s);
    let hit = ak != null ? byAddr.get(ak) : null;

    // (c) same chain + within 120 m -> definitely the same branch
    if (hit == null && s.lat != null && s.lng != null) {
      for (const i of byChain.get(c) || []) {
        const o = out[i];
        if (o.lat == null || o.lng == null) continue;
        if (metresBetween(o.lat, o.lng, s.lat, s.lng) <= SAME_BRANCH_METRES) {
          hit = i;
          break;
        }
      }
    }

    // (b) same chain + same branch name -- but ONLY when we cannot prove they
    // are different places. Two rows that BOTH carry coordinates more than
    // 120 m apart are two real branches that merely share a generic name
    // (Kosovo has dozens of independent shops literally called "Market"), so
    // they must NOT be collapsed.
    if (hit == null && normKey(s.name)) {
      const cand = byName.get(`${c}|${normKey(s.name)}`);
      if (cand != null) {
        const o = out[cand];
        const bothPlaced = o.lat != null && o.lng != null && s.lat != null && s.lng != null;
        if (!bothPlaced) hit = cand;
      }
    }

    if (hit == null) {
      out.push(s);
      index(s, out.length - 1);
      added++;
    } else {
      mergedDuplicates++;
      const o = out[hit];
      // WHICH ROW IS AUTHORITATIVE? Normally the row already on file wins and
      // the incoming one only fills in its nulls. But when the kept row came
      // from OpenStreetMap and the incoming row came from the CHAIN'S OWN
      // SITE, that is backwards: the chain is authoritative for its own
      // branches, and -- critically -- reconcileOsmAgainstOfficialLists later
      // deletes OSM-sourced rows for any chain that has an official list. A
      // fresh official row merged into an OSM row would therefore vanish
      // entirely (measured: 16 of ETC's 24 published branches disappeared
      // exactly this way). So the merged row is PROMOTED to the official
      // source, keeping the OSM coordinates it had, which are the one thing
      // the chain's own page usually lacks.
      const keptIsOsm = OSM_SOURCE_RE.test(o.sourceUrl || "");
      const freshIsOsm = OSM_SOURCE_RE.test(s.sourceUrl || "");
      if (keptIsOsm && !freshIsOsm) {
        out[hit] = {
          ...o,
          chain: s.chain ?? o.chain ?? null,
          name: s.name ?? o.name ?? null,
          city: s.city ?? o.city ?? null,
          address: s.address ?? o.address ?? null,
          lat: s.lat ?? o.lat ?? null,
          lng: s.lng ?? o.lng ?? null,
          hours: s.hours ?? o.hours ?? null,
          phone: s.phone ?? o.phone ?? null,
          sourceUrl: s.sourceUrl,
        };
      } else {
        out[hit] = {
          ...o,
          city: o.city ?? s.city ?? null,
          address: o.address ?? s.address ?? null,
          lat: o.lat ?? s.lat ?? null,
          lng: o.lng ?? s.lng ?? null,
          hours: o.hours ?? s.hours ?? null,
          phone: o.phone ?? s.phone ?? null,
        };
      }
    }
  }
  return { stores: out, added, mergedDuplicates };
}

// ============================================================================
// ETC (etc-ks.com) -- Elkos Trading Center
//
// The 2026-09-11 pass recorded this domain as "weekly offers are flyer images
// only -- no machine-readable product list". That was WRONG, and this pass
// proves it with bytes: etc-ks.com/aktualiteti.php?on=<feed> renders every
// offer as a structured `<div class="mod mod-article-tile" data-article=
// "aktualitet.php?product=<ETC article code>">` tile carrying the product
// title, the current price (`price__main`), the struck-through previous price
// (`price__previous`), the discount percentage and a real product photo under
// /aktu/<code>.webp. Seven such feeds are linked from the homepage and from
// fletushkat.php.
//
// What ETC still does NOT expose: any GS1 barcode (the `product=` codes are
// internal ETC article numbers, e.g. 2839322 -- NOT GTINs, so they are never
// written to `barcode` and every row's isLocalBrand stays null), any brand
// field, and any machine-readable branch list (deget.php renders the branch
// table as a single JPEG, images/degetdheorarihapjes.jpg -- see the report).
// ETC's actual online SHOP is a separate domain, e-baa.com (linked from the
// ETC footer as "Blej Online | www.e-baa.com"); see recordRejects for why it
// is not crawled here.
// ============================================================================

const ETC_DOMAIN = "etc-ks.com";

function parseEtcTiles(htmlText, feed) {
  const rows = [];
  const blocks = htmlText.split(/(?=<div class="mod mod-article-tile)/);
  for (const b of blocks.slice(1)) {
    const artMatch = b.match(/data-article="([^"]*)"/);
    if (!artMatch) continue;
    const titleMatch = b.match(/mod-article-tile__action[^>]*>([^<]*)</);
    const name = titleMatch ? decodeHtmlEntities(titleMatch[1]) : null;
    if (!name) continue;

    // `price__main` holds the current price as a bare number, e.g. "  10.90 ".
    const mainMatch = b.match(/price__main[^>]*>([\s\S]{0,120}?)<span/);
    let price = null;
    if (mainMatch) {
      const cleaned = mainMatch[1].replace(/&nbsp;/g, " ").replace(/[^\d.,]/g, "").replace(",", ".");
      const n = parseFloat(cleaned);
      if (Number.isFinite(n)) price = Math.round(n * 100) / 100;
    }
    const prevMatch = b.match(/price__previous"\s*>([^<]*)</);
    let previousPrice = null;
    if (prevMatch) {
      const n = parseFloat(prevMatch[1].replace(/[^\d.,]/g, "").replace(",", "."));
      if (Number.isFinite(n)) previousPrice = Math.round(n * 100) / 100;
    }

    const imgMatch = b.match(/<img[^>]+src="((?:aktu|\/aktu)[^"]+)"/);
    const code = decodeHtmlEntities(artMatch[1].replace(/^aktualitet\.php\?product=/, "")).trim();

    rows.push({
      code,
      name,
      price,
      previousPrice,
      image: imgMatch ? new URL(imgMatch[1], `https://${ETC_DOMAIN}/`).toString() : null,
      url: `https://${ETC_DOMAIN}/aktualitet.php?product=${encodeURIComponent(code)}`,
      feed,
    });
  }
  return rows;
}

async function harvestEtc(report, existingProducts) {
  const entry = {
    domain: ETC_DOMAIN,
    chain: "ETC (Elkos Trading Center)",
    platform: "custom PHP storefront (Apache, no CMS REST API)",
    endpoint: `https://${ETC_DOMAIN}/aktualiteti.php?on=<feed>`,
    machineReadable:
      'structured HTML: repeated `<div class="mod mod-article-tile" data-article="aktualitet.php?product=CODE">` blocks with `mod-article-tile__action` (name), `price__main` (price), `price__previous` (was-price) and an /aktu/<code>.webp image',
    productCount: 0,
    storeCount: 0,
    probes: [],
    notes: [],
  };

  // Record every endpoint probe with its real status, so the "does etc-ks.com
  // have an API?" question is answerable from the report alone.
  for (const path of [
    "/robots.txt",
    "/sitemap.xml",
    "/wp-json/",
    "/wp-json/wc/store/products",
    "/products.json",
    "/rest/V1/products",
  ]) {
    const r = await fetchText(`https://www.${ETC_DOMAIN}${path}`);
    entry.probes.push({ url: `https://www.${ETC_DOMAIN}${path}`, status: r.status });
    await sleep(400);
  }

  const home = await fetchText(`https://${ETC_DOMAIN}/`);
  entry.probes.push({ url: `https://${ETC_DOMAIN}/`, status: home.status, bytes: home.text.length });
  if (!home.ok) {
    entry.rejected = true;
    entry.reason = `homepage request failed: HTTP ${home.status} ${home.error || ""}`.trim();
    report.domains.push(entry);
    return { products: existingProducts, stores: [] };
  }
  entry.notes.push("no application/ld+json Product schema anywhere on the homepage (confirmed live)");
  entry.notes.push("robots.txt is HTTP 404, so there is no crawl restriction to honour on this host");

  // Discover the offer feeds from the homepage + fletushkat.php rather than
  // hardcoding them, so a new weekly feed is picked up automatically.
  const feeds = new Set();
  const collectFeeds = (text) => {
    const re = /aktualiteti\.php\?on=([^"'&]+)/g;
    let m;
    while ((m = re.exec(text))) feeds.add(decodeHtmlEntities(decodeURIComponent(m[1])));
  };
  collectFeeds(home.text);
  await sleep(DELAY_MS);
  const fletushkat = await fetchText(`https://${ETC_DOMAIN}/fletushkat.php`);
  entry.probes.push({ url: `https://${ETC_DOMAIN}/fletushkat.php`, status: fletushkat.status });
  if (fletushkat.ok) collectFeeds(fletushkat.text);
  entry.notes.push(`discovered ${feeds.size} offer feeds: ${[...feeds].join(", ")}`);

  const fresh = new Map();
  for (const feed of feeds) {
    await sleep(DELAY_MS);
    const url = `https://${ETC_DOMAIN}/aktualiteti.php?on=${encodeURIComponent(feed)}`;
    const r = await fetchText(url);
    if (!r.ok) {
      entry.notes.push(`feed "${feed}" failed: HTTP ${r.status}`);
      continue;
    }
    const rows = parseEtcTiles(r.text, feed);
    entry.notes.push(`feed "${feed}": HTTP ${r.status}, ${rows.length} product tiles`);
    for (const row of rows) fresh.set(`${row.code}|${row.name}`, row);
  }

  // NEVER SHRINK -- union with everything this project has seen before.
  const merged = new Map();
  for (const p of existingProducts) merged.set(p.id, p);
  let newCount = 0;
  for (const row of fresh.values()) {
    const id = `${ETC_DOMAIN}:${row.code}`;
    if (!merged.has(id)) newCount++;
    const { brand, brandSource } = deriveBrandFromTitle(row.name);
    merged.set(id, {
      id,
      source: ETC_DOMAIN,
      sourceLabel: "ETC",
      name: row.name,
      brand,
      brandSource,
      category: null, // ETC's offer feeds are promotional groupings, not real categories
      price: row.price,
      previousPrice: row.previousPrice,
      currency: "EUR",
      image: row.image,
      url: row.url,
      barcode: null, // `product=` codes are internal ETC article numbers, not GS1 GTINs
      isLocalBrand: null,
      localEvidence: null,
    });
  }
  entry.notes.push(`${newCount} offer SKUs new this run; ${merged.size - newCount} carried over from previous runs`);

  // ETC's own markup points at /aktu/<code>.png for several older feeds and
  // those files are simply gone (HTTP 404 from etc-ks.com itself). Rather than
  // shipping dead <img> links into the app, every distinct ETC image URL is
  // HEAD-checked and anything that is not a live image becomes null.
  const distinctImages = [...new Set([...merged.values()].map((p) => p.image).filter(Boolean))];
  const liveImages = new Set();
  let dead = 0;
  for (const img of distinctImages) {
    const check = await headOrGetOk(img);
    if (check.ok) liveImages.add(img);
    else dead++;
    await sleep(250);
  }
  for (const [id, row] of merged) {
    if (row.image && !liveImages.has(row.image)) merged.set(id, { ...row, image: null });
  }
  entry.imageVerification = {
    distinctImageUrls: distinctImages.length,
    live: liveImages.size,
    deadOnEtcSide: dead,
    note: "dead URLs are ETC's own broken /aktu/*.png files (older feeds); those rows keep their name/price and carry image: null rather than a link that 404s",
  };
  entry.productCount = merged.size;
  entry.notes.push(
    "branch list: https://etc-ks.com/deget.php exists (HTTP 200) but renders the branch/opening-hours table as a single JPEG (images/degetdheorarihapjes.jpg) -- zero machine-readable store rows. ETC branches in kosovo-stores.json therefore come from OpenStreetMap, not from etc-ks.com."
  );
  report.domains.push(entry);
  return { products: [...merged.values()] };
}

// ============================================================================
// Begmart (begmart.com) -- a real Kosovo online grocery with a PUBLIC GraphQL
// API. Found this pass via the Albanian-language discovery search the previous
// run recorded as "untried" ("blej online ushqime Kosove" -> a Telegrafi
// article naming begmart.com).
//
// The storefront is a React SPA; its bundle points at
// https://management.begmart.com/graphql (WPGraphQL over WooCommerce).
// Introspection is disabled, but the SPA's own queries are readable in
// /static/js/main.*.chunk.js and work verbatim.
//
// Honesty: the API exposes `sku` (an internal 6-digit Begmart article number,
// e.g. "009413") but NO GTIN/EAN field at all, so `barcode` is null for every
// row and isLocalBrand stays null -- brands are taken from the site's own
// product-tag taxonomy (a real field), never guessed.
// ============================================================================

const BEGMART_GRAPHQL = "https://management.begmart.com/graphql";

async function begmartQuery(query, variables) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS * 2);
  try {
    const res = await fetch(BEGMART_GRAPHQL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": UA },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    });
    const text = await res.text();
    if (!res.ok) return { ok: false, status: res.status, json: null };
    return { ok: true, status: res.status, json: JSON.parse(text) };
  } catch (err) {
    return { ok: false, status: 0, json: null, error: String(err) };
  } finally {
    clearTimeout(t);
  }
}

/** "2.78&nbsp;€" -> 2.78 ; null/"" / a price range -> null */
function parseBegmartPrice(raw) {
  if (!raw) return null;
  const cleaned = String(raw).replace(/&nbsp;/g, " ").replace(/ /g, " ");
  if (cleaned.includes("-")) return null; // price range on a variable product -> not a single price
  const n = parseFloat(cleaned.replace(/[^\d.,]/g, "").replace(/,/g, "."));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

const BEGMART_DELAY_MS = 600; // single API, one request at a time -- polite but not glacial

const BEGMART_PRODUCTS_QUERY = `query($after:String, $cid:Int){
  products(where:{categoryId:$cid}, first:100, after:$after){
    pageInfo{ hasNextPage endCursor }
    nodes{
      id
      ... on SimpleProduct{
        productId slug name sku salePrice regularPrice price
        image{ sourceUrl }
        productCategories{ nodes{ name } }
        productTags{ nodes{ name } }
      }
      ... on VariableProduct{
        productId slug name sku salePrice regularPrice price
        image{ sourceUrl }
        productCategories{ nodes{ name } }
        productTags{ nodes{ name } }
      }
      ... on ExternalProduct{
        productId slug name sku regularPrice price
        image{ sourceUrl }
        productCategories{ nodes{ name } }
        productTags{ nodes{ name } }
      }
      ... on GroupProduct{
        productId slug name sku price
        image{ sourceUrl }
        productCategories{ nodes{ name } }
        productTags{ nodes{ name } }
      }
    }
  }
}`;

async function harvestBegmart(report, existingProducts) {
  const domain = "begmart.com";
  const entry = {
    domain,
    chain: "Begmart",
    platform: "React SPA + WPGraphQL over WooCommerce (headless WordPress)",
    endpoint: BEGMART_GRAPHQL,
    machineReadable:
      'public GraphQL POST: {"query":"{products(first:100,after:$after){nodes{... on SimpleProduct{name sku price image{sourceUrl} productCategories{nodes{name}} productTags{nodes{name}}}}}}"} -- introspection is disabled but the storefront bundle\'s own queries work verbatim',
    productCount: 0,
    storeCount: 0,
    notes: [
      "robots.txt (HTTP 200) is 'User-agent: *' with no Disallow -- crawling permitted",
      "no GTIN/EAN field exists on this API (`globalUniqueId` is not in the schema; `sku` is an internal 6-digit Begmart article number), so every row's barcode is null and isLocalBrand is null -- never guessed",
      "brand comes from the site's own product-tag taxonomy (WooCommerce tags are used as brands by this storefront, confirmed by its getFilteredProductsQuery($brandSlug -> tag)) -- brandSource 'field'",
    ],
  };

  const fresh = new Map();
  let pages = 0;
  let nodesSeen = 0;

  /** Paginate one products connection, unioning into `fresh` by productId. */
  async function drain(variables) {
    let after = null;
    for (let guard = 0; guard < 25; guard++) {
      const r = await begmartQuery(BEGMART_PRODUCTS_QUERY, { ...variables, after });
      if (!r.ok || !r.json?.data?.products) {
        entry.notes.push(
          `page ${guard + 1} of ${JSON.stringify(variables)} failed: HTTP ${r.status} ${r.error || JSON.stringify(r.json?.errors || "")}`
        );
        return;
      }
      const conn = r.json.data.products;
      pages++;
      nodesSeen += conn.nodes.length;
      for (const n of conn.nodes) {
        // A node with no `name` matched none of the product-type fragments
        // above (a type this script does not model): counted, never faked.
        if (!n || !n.name || n.productId == null) continue;
        fresh.set(String(n.productId), n);
      }
      if (!conn.pageInfo.hasNextPage) return;
      after = conn.pageInfo.endCursor;
      await sleep(BEGMART_DELAY_MS);
    }
  }

  // 1) the unfiltered feed. NOTE (measured): this connection returns ~723
  //    nodes across 8 pages but only ~274 DISTINCT productIds -- its cursor
  //    ordering repeats products across pages, so it is NOT a full catalogue
  //    walk. That is why every category is drained separately below.
  await drain({ cid: null });
  const unfilteredUnique = fresh.size;
  entry.notes.push(`unfiltered products connection: ${nodesSeen} nodes over ${pages} pages -> ${unfilteredUnique} DISTINCT products (this endpoint repeats products across cursor pages)`);

  // 2) every product category the API exposes, which reaches products the
  //    unfiltered feed never returns.
  const categories = [];
  let catAfter = null;
  for (let guard = 0; guard < 10; guard++) {
    const r = await begmartQuery(
      `query($after:String){productCategories(first:100, after:$after){pageInfo{hasNextPage endCursor} nodes{ databaseId name count }}}`,
      { after: catAfter }
    );
    if (!r.ok || !r.json?.data?.productCategories) break;
    const c = r.json.data.productCategories;
    categories.push(...c.nodes);
    if (!c.pageInfo.hasNextPage) break;
    catAfter = c.pageInfo.endCursor;
    await sleep(BEGMART_DELAY_MS);
  }
  entry.notes.push(`API exposes ${categories.length} product categories; draining each one`);

  for (const cat of categories) {
    if (cat.databaseId == null) continue;
    await drain({ cid: cat.databaseId });
    await sleep(BEGMART_DELAY_MS);
  }
  entry.notes.push(
    `total: ${pages} GraphQL pages, ${nodesSeen} product nodes, ${fresh.size} DISTINCT products ` +
      `(${fresh.size - unfilteredUnique} of them reachable only through the per-category queries)`
  );

  const merged = new Map();
  for (const p of existingProducts) merged.set(p.id, p);
  let newCount = 0;
  for (const n of fresh.values()) {
    const id = `${domain}:${n.productId}`;
    if (!merged.has(id)) newCount++;
    const cats = (n.productCategories?.nodes || []).map((c) => c.name);
    const tags = (n.productTags?.nodes || []).map((t) => t.name);
    const price = parseBegmartPrice(n.salePrice) ?? parseBegmartPrice(n.price) ?? parseBegmartPrice(n.regularPrice);
    merged.set(id, {
      id,
      source: domain,
      sourceLabel: "Begmart",
      name: decodeHtmlEntities(n.name),
      brand: tags.length === 1 ? tags[0] : null, // 2+ tags is ambiguous -> null, never guess
      brandSource: tags.length === 1 ? "field" : null,
      category: cats.length ? cats[cats.length - 1] : null,
      price,
      currency: "EUR",
      image: n.image?.sourceUrl || null,
      url: `https://${domain}/produkti/${n.slug}`,
      barcode: null, // no GTIN on this API; `sku` (${n.sku ? "e.g. " + n.sku : "internal"}) is a Begmart article number
      isLocalBrand: null,
      localEvidence: null,
    });
  }
  // --------------------------------------------------------------------
  // WordPress REST, which the GraphQL layer does not expose.
  //
  // 1) /wp-json/wc/store/products  -- the WooCommerce Store API. Same shop,
  //    but it pages cleanly and reaches products the GraphQL cursor misses.
  //    Confirmed: `sku` here is the SAME internal 6-digit Begmart article
  //    number ("009413"), NOT an EAN, and the record carries no gtin field,
  //    no attributes and no extensions -- so `barcode` stays null. Nothing
  //    is derived from an article number.
  // 2) /wp-json/wp/v2/product      -- carries the shop's own `origjina`
  //    (origin) taxonomy, which GraphQL does not expose at all. That is a
  //    REAL, retailer-published origin statement (77 country terms in
  //    Albanian; "Kosovë" and "Shqipëri" among them), and it is the only
  //    honest local/imported evidence this source has.
  // --------------------------------------------------------------------
  const REST = "https://management.begmart.com/wp-json";

  // origin taxonomy: id -> country name
  const originNames = new Map();
  {
    const r = await fetchJson(`${REST}/wp/v2/origjina?per_page=100&_fields=id,name,slug`);
    if (r.ok && Array.isArray(r.json)) for (const t of r.json) originNames.set(t.id, decodeHtmlEntities(t.name));
    entry.notes.push(`origin taxonomy /wp/v2/origjina: ${originNames.size} country terms (HTTP ${r.status})`);
  }

  // Store API: price/categories/tags/image for every published product
  const storeApi = new Map();
  for (let page = 1; page <= 20; page++) {
    const r = await fetchJson(`${REST}/wc/store/products?per_page=100&page=${page}`);
    if (!r.ok || !Array.isArray(r.json) || r.json.length === 0) {
      if (page === 1) entry.notes.push(`wc/store/products failed: HTTP ${r.status}`);
      break;
    }
    for (const p of r.json) storeApi.set(String(p.id), p);
    if (r.json.length < 100) break;
    await sleep(BEGMART_DELAY_MS);
  }
  entry.notes.push(`wc/store/products returned ${storeApi.size} products`);

  // wp/v2/product: the full published universe + origin term per product
  const wpProducts = [];
  for (let page = 1; page <= 20; page++) {
    const r = await fetchJson(`${REST}/wp/v2/product?per_page=100&page=${page}&_fields=id,slug,title,origjina`);
    if (!r.ok || !Array.isArray(r.json) || r.json.length === 0) {
      if (page === 1) entry.notes.push(`wp/v2/product failed: HTTP ${r.status}`);
      break;
    }
    wpProducts.push(...r.json);
    if (r.json.length < 100) break;
    await sleep(BEGMART_DELAY_MS);
  }
  entry.notes.push(`wp/v2/product returned ${wpProducts.length} products (the full published catalogue)`);

  const minor = (p) => {
    const unit = p?.prices?.currency_minor_unit ?? 2;
    const raw = p?.prices?.price;
    if (raw == null || raw === "") return null;
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    return Math.round(n) / 10 ** unit;
  };

  let restNew = 0;
  let originApplied = 0;
  let localFromOrigin = 0;
  for (const wp of wpProducts) {
    const id = `${domain}:${wp.id}`;
    const sp = storeApi.get(String(wp.id));
    const originId = Array.isArray(wp.origjina) && wp.origjina.length === 1 ? wp.origjina[0] : null;
    const originName = originId != null ? originNames.get(originId) || null : null;
    // Begmart's field is "Origjina" -- the origin the shop itself states for
    // the product. Worded exactly as that, never upgraded to a claim about
    // the brand that the source does not make.
    let cls = { isLocalBrand: null, localEvidence: null };
    if (originName && /kosov/i.test(originName)) {
      cls = { isLocalBrand: true, localEvidence: `Begmart's own "Origjina" (origin) field on this product states Kosovë` };
    } else if (originName && /shqip|albania/i.test(originName)) {
      cls = { isLocalBrand: true, localEvidence: `Begmart's own "Origjina" (origin) field on this product states Shqipëri` };
    } else if (originName) {
      cls = { isLocalBrand: false, localEvidence: `Begmart's own "Origjina" (origin) field on this product states ${originName} -- imported` };
    }
    if (originName) originApplied++;
    if (cls.isLocalBrand === true) localFromOrigin++;

    const prev = merged.get(id);
    if (!prev && !sp) {
      // wp/v2 alone has no price, image or category. Rather than write a
      // priceless husk, only take it when the Store API also knows it.
      continue;
    }
    if (!prev) restNew++;
    const tags = sp ? (sp.tags || []).map((t) => decodeHtmlEntities(t.name)) : [];
    const cats = sp ? (sp.categories || []).map((c) => decodeHtmlEntities(c.name)) : [];
    merged.set(id, {
      id,
      source: domain,
      sourceLabel: "Begmart",
      name: prev?.name || decodeHtmlEntities(sp?.name || wp.title?.rendered || ""),
      brand: prev?.brand ?? (tags.length === 1 ? tags[0] : null),
      brandSource: prev?.brandSource ?? (tags.length === 1 ? "field" : null),
      category: prev?.category ?? (cats.length ? cats[cats.length - 1] : null),
      price: prev?.price ?? minor(sp),
      currency: "EUR",
      image: prev?.image ?? (sp?.images?.[0]?.src || null),
      url: `https://${domain}/produkti/${wp.slug}`,
      barcode: null, // this shop publishes no GTIN anywhere -- never derived
      isLocalBrand: cls.isLocalBrand,
      localEvidence: cls.localEvidence,
    });
  }
  entry.notes.push(
    `${restNew} products added from the WordPress REST layer that the GraphQL cursor never returned; ` +
      `origin applied to ${originApplied} rows, of which ${localFromOrigin} state Kosovë/Shqipëri`
  );
  entry.notes.push(
    "barcode stays null for every Begmart row: wc/store/products carries no gtin/attributes/extensions and `sku` is the internal 6-digit article number (e.g. 009413) -- not a GS1 code, so it is never written to `barcode`"
  );

  entry.notes.push(`${newCount} SKUs new this run; ${merged.size - newCount} carried over`);
  entry.productCount = merged.size;
  entry.localEvidenceCount = [...merged.values()].filter((p) => p.isLocalBrand !== null).length;
  report.domains.push(entry);
  return { products: [...merged.values()] };
}

// ============================================================================
// Meridian Express (meridianexpress.com) -- store locations
//
// The previous pass rejected this domain on the grounds that "its one JSON-LD
// block is generic Yoast schema". True, but it looked in the wrong place: the
// homepage's "DYQANET TONA" section is a wp-google-map-gold widget whose
// config embeds a full `"places":[{...}]` JSON array -- title, street address,
// lat, lng, city, postcode, opening hours and phone for every branch.
// ============================================================================

async function harvestMeridianStores(report) {
  const domain = "meridianexpress.com";
  const url = `https://${domain}/`;
  const entry = {
    domain,
    chain: "Meridian Express",
    platform: "WordPress (Avada) + wp-google-map-gold",
    endpoint: url,
    machineReadable: 'embedded `"places":[{title,address,location:{lat,lng,city,extra_fields:{orari-i-punes,numri-i-telefonit}}}]` JSON in the homepage markup',
    productCount: 0,
    storeCount: 0,
    notes: [
      "robots.txt (HTTP 200, Yoast block) is 'User-agent: * / Disallow:' -- i.e. everything allowed",
      "no product catalogue: wp-json/wc/store/products is HTTP 404 and the only application/ld+json is Yoast WebPage/Organization schema (re-confirmed) -- weekly offers are flyer pages only",
    ],
  };

  const r = await fetchTextRetry(url);
  if (!r.ok) {
    entry.rejected = true;
    entry.reason = `HTTP ${r.status} ${r.error || ""} (after 3 attempts)`.trim();
    report.domains.push(entry);
    return { stores: [] };
  }

  const marker = '"places":';
  const idx = r.text.indexOf(marker);
  if (idx === -1) {
    entry.rejected = true;
    entry.reason = 'no `"places":[...]` array found in the homepage markup (map widget markup may have changed)';
    report.domains.push(entry);
    return { stores: [] };
  }
  const arrStr = extractBalanced(r.text, r.text.indexOf("[", idx), "[", "]");
  let raw;
  try {
    raw = JSON.parse(decodeHtmlEntities(arrStr));
  } catch (e) {
    entry.rejected = true;
    entry.reason = `places array failed to parse: ${e.message}`;
    report.domains.push(entry);
    return { stores: [] };
  }

  const stores = [];
  for (const p of raw) {
    const loc = p.location || {};
    const extra = loc.extra_fields || {};
    const lat = loc.lat != null ? parseFloat(loc.lat) : null;
    const lng = loc.lng != null ? parseFloat(loc.lng) : null;
    stores.push({
      chain: "Meridian Express",
      name: decodeHtmlEntities(p.title || "Meridian Express"),
      city: loc.city ? decodeHtmlEntities(loc.city) : guessCity(p.address || ""),
      address: p.address ? decodeHtmlEntities(p.address) : null,
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
      hours: extra["orari-i-punes"] || null,
      phone: extra["numri-i-telefonit"] || null,
      sourceUrl: `${url}#dyqanet`,
    });
  }
  entry.storeCount = stores.length;
  report.domains.push(entry);
  return { stores };
}

// ============================================================================
// Interex (interex-rks.com) -- store locations
//
// The brief's domain (interex-ks.com) is dead: HTTP 500 / Cloudflare error.
// The chain's live domain is interex-rks.com, found this pass via Albanian
// search. Its /lokacioni/ page lists every branch as
// `<div class="place"><h2>CITY</h2><h3>STREET</h3><a href="tel:..."><p>PHONE`.
// ============================================================================

async function harvestInterexStores(report) {
  const domain = "interex-rks.com";
  const url = `https://${domain}/lokacioni/`;
  const entry = {
    domain,
    chain: "Interex",
    platform: "WordPress (custom interex_theme)",
    endpoint: url,
    machineReadable: 'structured HTML: repeated `<div class="place"><h2>city</h2><h3>street</h3><a href="tel:...">` blocks',
    productCount: 0,
    storeCount: 0,
    notes: [
      "robots.txt (HTTP 200, Yoast block) is 'User-agent: * / Disallow:' -- everything allowed",
      "no product catalogue: /wp-json/wc/store/products is HTTP 404; offers are an 'E-fletushka' flyer only",
      "the page's map is a Google My Maps iframe (maps/d/u/2/embed?mid=...), which exposes no per-branch coordinates in the page source -- lat/lng left null rather than invented",
      "DELIBERATE: that My Maps embed (mid=1j2ESnkSB2iJ8S2YjN8wdFgxrdQq2AnCU) DOES carry a coordinate per row inside its `mf.map` blob, and this pass checked it. They are Google's geocodes of the address string, not surveyed shop positions: 11 of the 28 rows share a coordinate pair with another row, and all five Prishtina branches sit on the identical point 42.6629138/21.1655028 (the city centroid). Importing those would put five different shops on one pin and claim a precision the source does not have, so lat/lng stay null and the real address is kept instead.",
      "the brief's interex-ks.com is NOT this chain's live domain (HTTP 500); interex-rks.com is",
      "this host answers slowly -- measured ~20.4 s to first byte-complete, which is why the fetch timeout here is 60 s with 3 attempts",
    ],
  };

  const r = await fetchTextRetry(url);
  if (!r.ok) {
    entry.rejected = true;
    entry.reason = `HTTP ${r.status} ${r.error || ""} (after 3 attempts)`.trim();
    report.domains.push(entry);
    return { stores: [] };
  }

  const stores = [];
  const re = /<div class="place">([\s\S]*?)<\/div>/g;
  let m;
  while ((m = re.exec(r.text))) {
    const block = m[1];
    const city = (block.match(/<h2[^>]*>([\s\S]*?)<\/h2>/) || [])[1];
    const street = (block.match(/<h3[^>]*>([\s\S]*?)<\/h3>/) || [])[1];
    const phone = (block.match(/href="tel:([^"]+)"/) || [])[1];
    if (!city && !street) continue;
    const cityText = city ? decodeHtmlEntities(city.replace(/<[^>]+>/g, "")) : null;
    const streetText = street ? decodeHtmlEntities(street.replace(/<[^>]+>/g, "")) : null;
    stores.push({
      chain: "Interex",
      name: `Interex ${[cityText, streetText].filter(Boolean).join(" - ")}`.trim(),
      city: cityText,
      address: streetText,
      lat: null,
      lng: null,
      hours: null,
      phone: phone ? decodeHtmlEntities(phone) : null,
      sourceUrl: url,
    });
  }
  entry.storeCount = stores.length;
  report.domains.push(entry);
  return { stores };
}

// ============================================================================
// Maxi Supermarket (maxiks.com) -- store locations
//
// Divi tab widget on the homepage: one `.et_pb_tab_content` block per branch,
// each an <h1> name plus "Orari:" / "Telefoni:" / "Adresa:" labelled fields.
// (maxiks.shop, the chain's e-shop, sits behind a Cloudflare interstitial --
// see recordRejects.)
// ============================================================================

async function harvestMaxiStores(report) {
  const domain = "maxiks.com";
  const url = `https://${domain}/`;
  const entry = {
    domain,
    chain: "Maxi Supermarket",
    platform: "WordPress (Divi)",
    endpoint: url,
    machineReadable: 'structured HTML: `.et_pb_tab_content` blocks with <h1> branch name and "Orari:" / "Telefoni:" / "Adresa:" labelled fields',
    productCount: 0,
    storeCount: 0,
    notes: [
      "robots.txt (HTTP 200) contains only Cloudflare content-signal comments and no Disallow rule -- crawling permitted",
      "no product catalogue on this domain: /wp-json/ and /wp-json/wc/store/products both HTTP 404 (REST routes are only reachable under /index.php/wp-json/, and no WooCommerce Store API is installed)",
      "no per-branch coordinates published -- lat/lng left null rather than invented",
    ],
  };

  const r = await fetchTextRetry(url);
  if (!r.ok) {
    entry.rejected = true;
    entry.reason = `HTTP ${r.status} ${r.error || ""} (after 3 attempts)`.trim();
    report.domains.push(entry);
    return { stores: [] };
  }

  const stores = [];
  const seen = new Set();
  const re = /<div class="et_pb_tab_content">([\s\S]*?)<\/div>/g;
  let m;
  while ((m = re.exec(r.text))) {
    const block = m[1];
    const nameMatch = block.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
    if (!nameMatch) continue;
    const name = decodeHtmlEntities(nameMatch[1].replace(/<[^>]+>/g, ""));
    if (!name || seen.has(name)) continue; // the page renders an EN and an SQ copy of every tab
    const field = (label) => {
      const mm = block.match(new RegExp(`${label}:\\s*<\\/span>([\\s\\S]*?)(?:<br|<\\/p>)`));
      if (!mm) return null;
      const v = decodeHtmlEntities(mm[1].replace(/<[^>]+>/g, "")).trim();
      return v || null;
    };
    const address = field("Adresa");
    seen.add(name);
    stores.push({
      chain: "Maxi Supermarket",
      name,
      city: guessCity(address || "") || guessCity(name) || null,
      address,
      lat: null,
      lng: null,
      hours: field("Orari"),
      phone: field("Telefoni"),
      sourceUrl: `${url}#maxi-shops-en`,
    });
  }
  entry.storeCount = stores.length;
  report.domains.push(entry);
  return { stores };
}

// ============================================================================
// OpenStreetMap (Overpass API) -- "every shop in Kosovo"
//
// Owner ask (2026-09-12): "fetch data from all possible stores and shops
// existing in kosovo and show them there." Most Kosovo chains publish no
// branch list at all (ETC's is a JPEG; Emona, KAM, Kipper, Ben-Af, QTA and
// the hundreds of independents publish nothing), so the only honest, complete,
// machine-readable source of Kosovo retail locations is OpenStreetMap.
//
// Everything here is REAL surveyed data, not invented: each row keeps the OSM
// element's own coordinates and its own address/opening_hours/phone tags, and
// `sourceUrl` is the exact OSM element page so any wrong address is traceable.
// A tag OSM does not carry is written as null.
//
// City is resolved by point-in-polygon against the official OSM Kosovo
// municipality boundaries (admin_level=6), NOT guessed from the shop name.
//
// Data (c) OpenStreetMap contributors, ODbL -- see report.attribution.
// ============================================================================

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const OVERPASS_UA = "vendorja-harvest/1.0 (Kosovo retail store locator; contact via repo)";

/** OSM municipality name (genitive) -> the city name the rest of this dataset uses. */
const OSM_MUNICIPALITY_CITY = {
  "Komuna e Prishtinës": "Prishtinë",
  "Komuna e Prizrenit": "Prizren",
  "Komuna e Gjilanit": "Gjilan",
  "Komuna e Gjakovës": "Gjakovë",
  "Komuna e Fushë Kosovës": "Fushë Kosovë",
  "Komuna e Vushtrrisë": "Vushtrri",
  "Komuna e Pejës": "Pejë",
  "Komuna e Mitrovicës": "Mitrovicë",
  "Komuna e Mitrovicës Veriore": "Mitrovicë e Veriut",
  "Komuna e Lipjanit": "Lipjan",
  "Komuna e Suharekës": "Suharekë",
  "Komuna e Podujevës": "Podujevë",
  "Komuna e Rahovecit": "Rahovec",
  "Komuna e Istogut": "Istog",
  "Komuna e Ferizajit": "Ferizaj",
  "Komuna e Vitisë": "Viti",
  "Komuna e Obiliqit": "Obiliq",
  "Komuna e Drenasit": "Drenas",
  "Komuna e Skënderajt": "Skenderaj",
  "Komuna e Graçanicës": "Graçanicë",
  "Komuna e Deçanit": "Deçan",
  "Komuna e Klinës": "Klinë",
  "Komuna e Kaçanikut": "Kaçanik",
  "Komuna e Malishevës": "Malishevë",
  "Komuna e Kamenicës": "Kamenicë",
  "Komuna e Dragashit": "Dragash",
  "Komuna e Han i Elezit": "Hani i Elezit",
  "Komuna e Leposaviqit": "Leposaviq",
  "Komuna e Novobërdës": "Novobërdë",
  "Komuna e Shtimes": "Shtime",
  "Komuna e Shtërpcës": "Shtërpcë",
  "Komuna e Zubin Potokut": "Zubin Potok",
  "Komuna e Ranillugut": "Ranillug",
  "Komuna e Mamushës": "Mamushë",
  "Komuna e Zveçanit": "Zveçan",
  "Komuna e Junikut": "Junik",
  "Komuna e Kllokotit": "Kllokot",
  "Komuna e Partesh": "Partesh",
  "Komuna e Parteshit": "Partesh",
  "Komuna e Elez Hanit": "Hani i Elezit",
};

/**
 * Chains whose branch list we already hold from the chain's OWN website.
 * OSM rows for these are deliberately NOT imported: the official list is more
 * complete and authoritative, and importing both would duplicate branches
 * (the exact failure mode the brief warns about).
 */
const OSM_CHAIN_RULES = [
  [/viva\s*fresh/i, "Viva Fresh Store"],
  [/super\s*-?\s*viva/i, "Super Viva"],
  [/^viva$/i, "Viva Fresh Store"],
  [/\bspar\b/i, "SPAR Kosova"],
  [/\balbi\b/i, "Albi Market"],
  [/interex/i, "Interex"],
  [/meridian/i, "Meridian Express"],
  [/^maxi\b/i, "Maxi Supermarket"],
  [/\bETC\b/, "ETC"],
  [/elkos/i, "ETC"],
  [/emona/i, "Emona"],
  [/\bkam\s*market\b/i, "KAM Market"],
  [/kipper/i, "Kipper Market"],
  [/conad/i, "CONAD Kosova"],
  [/ben\s*-?\s*af/i, "Ben-Af"],
  [/\bqta\b/i, "QTA"],
  [/eli\s*-?\s*ab/i, "Eli-Ab"],
  [/rina\s*market/i, "Rina Market"],
  [/\bmy\s*market\b/i, "My Market"],
];

/**
 * Chains we MIGHT skip in OSM -- but only when that chain's own site actually
 * returned branches on THIS run. If a chain site times out or changes its
 * markup, its OSM rows must still be imported, otherwise a transient network
 * failure silently deletes a whole chain from the map. (That exact bug bit the
 * first run of this pass: interex-rks.com aborted on a slow response and
 * Interex ended up with zero branches.)
 */
const OSM_SKIPPABLE_CHAINS = [
  "Viva Fresh Store",
  "Super Viva",
  "SPAR Kosova",
  "Albi Market",
  "Albi Market Hipermarket",
  "Interex",
  "Meridian Express",
  "Maxi Supermarket",
];

function normalizeOsmChain(name) {
  for (const [re, chain] of OSM_CHAIN_RULES) {
    if (re.test(name)) return chain;
  }
  return name.trim();
}

async function overpassOnce(query) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 240000);
  try {
    const res = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": OVERPASS_UA },
      body: new URLSearchParams({ data: query }).toString(),
      signal: controller.signal,
    });
    const text = await res.text();
    if (!res.ok) return { ok: false, status: res.status, json: null };
    return { ok: true, status: res.status, json: JSON.parse(text) };
  } catch (err) {
    return { ok: false, status: 0, json: null, error: String(err) };
  } finally {
    clearTimeout(t);
  }
}

/**
 * Overpass is a free, shared, volunteer-run service: it answers 429 (slot
 * exhausted) or 504 (gateway timeout) when busy. Back off and retry rather
 * than treating a busy public endpoint as "OpenStreetMap has no data".
 */
async function overpass(query, attempts = 3) {
  let last = null;
  for (let i = 0; i < attempts; i++) {
    last = await overpassOnce(query);
    if (last.ok) return last;
    if (i < attempts - 1) await sleep(30000 * (i + 1));
  }
  return last;
}

/** Ray-casting over every outer boundary segment of a municipality relation. */
function pointInSegments(lon, lat, segs) {
  let inside = false;
  for (const [x1, y1, x2, y2] of segs) {
    if (y1 > lat !== y2 > lat) {
      const xIntersect = ((x2 - x1) * (lat - y1)) / (y2 - y1) + x1;
      if (lon < xIntersect) inside = !inside;
    }
  }
  return inside;
}

async function harvestOsmKosovoShops(report, chainsWithOfficialListThisRun) {
  const excluded = new Set(OSM_SKIPPABLE_CHAINS.filter((c) => chainsWithOfficialListThisRun.has(c)));
  const entry = {
    domain: "openstreetmap.org (Overpass API)",
    chain: "(all Kosovo retail chains + independents)",
    platform: "OpenStreetMap / Overpass API",
    endpoint: OVERPASS_URL,
    machineReadable: 'Overpass QL: nwr["shop"~"^(supermarket|convenience|grocery|wholesale|department_store)$"] inside area["ISO3166-1"="XK"]',
    productCount: 0,
    storeCount: 0,
    licence: "Data (c) OpenStreetMap contributors, licensed ODbL 1.0 (https://www.openstreetmap.org/copyright)",
    notes: [],
  };

  const shopQuery = `[out:json][timeout:180];
area["ISO3166-1"="XK"][admin_level=2]->.a;
(
  nwr["shop"~"^(supermarket|convenience|grocery|wholesale|department_store)$"](area.a);
);
out center tags;`;

  const shopsRes = await overpass(shopQuery);
  if (!shopsRes.ok || !Array.isArray(shopsRes.json?.elements)) {
    entry.rejected = true;
    entry.reason =
      `Overpass shop query failed on this run: HTTP ${shopsRes.status} ${shopsRes.error || ""} (3 attempts, 30s/60s backoff). ` +
      "Overpass is a free shared service and answers 429/504 when busy, so this is a transient service state, NOT evidence that OpenStreetMap lacks Kosovo shop data. " +
      "Any OSM-sourced rows already in data/kosovo-stores.json (sourceUrl openstreetmap.org/...) were harvested on an earlier successful run and are kept unchanged.";
    report.domains.push(entry);
    return { stores: [] };
  }
  const elements = shopsRes.json.elements.filter((e) => e.tags?.name);
  entry.notes.push(`Overpass returned ${shopsRes.json.elements.length} shop elements in Kosovo, ${elements.length} of them named`);

  await sleep(DELAY_MS);

  const boundaryQuery = `[out:json][timeout:180];
area["ISO3166-1"="XK"][admin_level=2]->.a;
rel["admin_level"="6"]["boundary"="administrative"](area.a);
out geom;`;
  const bRes = await overpass(boundaryQuery);
  const municipalities = [];
  if (bRes.ok && Array.isArray(bRes.json?.elements)) {
    for (const rel of bRes.json.elements) {
      const segs = [];
      for (const mem of rel.members || []) {
        if (mem.type !== "way") continue;
        if (mem.role !== "outer" && mem.role !== "") continue;
        const g = mem.geometry || [];
        for (let i = 0; i < g.length - 1; i++) segs.push([g[i].lon, g[i].lat, g[i + 1].lon, g[i + 1].lat]);
      }
      const osmName = rel.tags?.["name:sq"] || rel.tags?.name || null;
      if (osmName && segs.length) municipalities.push({ osmName, segs });
    }
    entry.notes.push(`loaded ${municipalities.length} Kosovo municipality boundaries (admin_level=6) for point-in-polygon city resolution`);
  } else {
    entry.notes.push(`municipality boundary query failed (HTTP ${bRes.status}) -- city falls back to the element's own addr:city tag, else null`);
  }

  const stores = [];
  let excludedRows = 0;
  let cityFromPolygon = 0;
  for (const el of elements) {
    const lat = el.lat ?? el.center?.lat ?? null;
    const lon = el.lon ?? el.center?.lon ?? null;
    const tags = el.tags;
    const rawName = decodeHtmlEntities(tags["name:sq"] || tags.name);
    const chain = normalizeOsmChain(tags.brand || tags.operator || rawName);
    if (excluded.has(chain)) {
      excludedRows++;
      continue;
    }

    let city = null;
    if (lat != null && lon != null) {
      for (const m of municipalities) {
        if (pointInSegments(lon, lat, m.segs)) {
          city = OSM_MUNICIPALITY_CITY[m.osmName] || m.osmName.replace(/^Komuna e\s+/i, "");
          cityFromPolygon++;
          break;
        }
      }
    }
    if (!city && tags["addr:city"]) city = decodeHtmlEntities(tags["addr:city"]);

    const street = tags["addr:street"] || null;
    const houseNo = tags["addr:housenumber"] || null;
    const address = street ? decodeHtmlEntities([street, houseNo].filter(Boolean).join(" ")) : null;

    stores.push({
      chain,
      name: rawName,
      city: city || null,
      address,
      lat: typeof lat === "number" ? lat : null,
      lng: typeof lon === "number" ? lon : null,
      hours: tags.opening_hours || null,
      phone: tags.phone || tags["contact:phone"] || null,
      sourceUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
    });
  }

  entry.storeCount = stores.length;
  entry.notes.push(
    `${excludedRows} OSM rows skipped because their chain returned an authoritative branch list from its own site on this run (${[...excluded].join(", ") || "none"}) -- importing both would duplicate branches`
  );
  entry.notes.push(`city resolved by municipality polygon for ${cityFromPolygon} of ${stores.length} imported rows`);
  const skippableWithoutList = OSM_SKIPPABLE_CHAINS.filter((c) => !chainsWithOfficialListThisRun.has(c));
  if (skippableWithoutList.length) {
    entry.notes.push(
      `these chains have their own branch page but it returned nothing this run, so their OSM rows WERE imported instead of being skipped: ${skippableWithoutList.join(", ")}`
    );
  }
  report.domains.push(entry);
  return { stores };
}

// ============================================================================
// Wolt Kosovo (wolt.com) -- the assortments of real Kosovo grocery shops
//
// WHY THIS IS NOT THE GjirafaMall MISTAKE.
// GjirafaMall was dropped (scripts/prune-retail.mjs) because it is a
// MARKETPLACE: one junk category, and its `brand` field held the SELLER, so a
// Lavazza coffee arrived branded "TuttoCapsule". Wolt is a different animal.
// Each Wolt VENUE is one physical grocery shop -- "Spar te Qafa" is the SPAR
// branch at Qafa -- and what the API returns is that shop's own shelf list:
// its own multi-level category tree (BUKË > BUKË, PIJE > UJË), grocery prices,
// and, for a large share of rows, the EAN the shop itself has on the shelf
// edge (`barcode_gtin`). Measured on spar-te-qafa: 1,954 items, 731 with a
// real GS1 barcode.
//
// Wolt publishes NO brand field at all. Rather than invent one, `brand` stays
// null unless the project's existing conservative title derivation matches a
// known manufacturer -- there is no seller name to mistake for a brand here.
//
// PRICE CAVEAT, recorded honestly: a Wolt price is the price that shop charges
// ON WOLT, which can carry a delivery-platform markup over the in-store shelf
// price. It is a real published price for that shop, not an invented one, but
// it is not necessarily the till price.
//
// robots.txt: https://wolt.com/robots.txt is "User-agent: * / Disallow:" --
// i.e. nothing is disallowed.
//
// Endpoints (both public, no auth, no token):
//   venue discovery  https://restaurant-api.wolt.com/v1/pages/venue-list/category-grocery?lat=&lon=
//   category tree    https://consumer-api.wolt.com/consumer-api/consumer-assortment/v1/venues/slug/<slug>/assortment
//   items in a leaf  <same>/categories/slug/<leafSlug>[?page_token=...]
// ============================================================================

const WOLT_DELAY_MS = 280;
const WOLT_CITIES = [
  { slug: "pristina", lat: 42.6629, lon: 21.1655 },
  { slug: "ferizaj", lat: 42.3703, lon: 21.1558 },
  { slug: "gjilan", lat: 42.4641, lon: 21.469 },
  { slug: "prizren", lat: 42.2171, lon: 20.743 },
];

/**
 * Which real-world chain a Wolt venue belongs to. Only mappings that are
 * unambiguous from the venue's own name are listed; everything else keeps its
 * own shop name and is treated as an independent shop (which it is).
 */
const WOLT_CHAIN_RULES = [
  [/^spar\b/i, "SPAR Kosova", "spar-kosova"],
  [/^super\s*viva\b/i, "Super Viva", "super-viva"],
  [/^max(i)?\s*market\b/i, "Maxi Supermarket", "maxi-supermarket"],
  [/^plus\s*market\b/i, "Plus Market", "plus-market"],
  [/^lear\s*market\b/i, "Lear Market", "lear-market"],
  [/^molla\s*express|^market\s*express\s*molla/i, "Molla Express", "molla-express"],
  [/^exfis\s*market\b/i, "ExFis Market", "exfis-market"],
];

function woltChainOf(venueName) {
  for (const [re, chain, key] of WOLT_CHAIN_RULES) {
    if (re.test(venueName)) return { chain, key };
  }
  return { chain: venueName, key: slugify(normalizeForMatch(venueName)) || "venue" };
}

async function woltJson(url, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    const r = await fetchJson(url);
    if (r.ok) return r;
    if (r.status === 404) return r;
    await sleep(1200 * (i + 1));
  }
  return { ok: false, status: 0, json: null };
}

async function discoverWoltGroceryVenues(entry) {
  const venues = new Map();
  for (const city of WOLT_CITIES) {
    const a = await woltJson(
      `https://restaurant-api.wolt.com/v1/pages/venue-list/category-grocery?lat=${city.lat}&lon=${city.lon}`
    );
    if (!a.ok) {
      entry.notes.push(`venue discovery for ${city.slug} failed: HTTP ${a.status}`);
    } else {
      for (const sec of a.json.sections || []) {
        for (const it of sec.items || []) {
          const v = it.venue;
          if (v?.slug && !venues.has(v.slug))
            venues.set(v.slug, { slug: v.slug, name: v.name, city: city.slug, via: "category-grocery", raw: v });
        }
      }
    }
    await sleep(600);
    // The city front page has a "top-grocery-picks" rail that sometimes
    // carries grocery venues the category list does not.
    const b = await woltJson(`https://restaurant-api.wolt.com/v1/pages/front?lat=${city.lat}&lon=${city.lon}`);
    if (b.ok) {
      for (const sec of b.json.sections || []) {
        for (const it of sec.items || []) {
          const v = it.venue;
          if (!v?.slug || venues.has(v.slug)) continue;
          // Two ways in, both evidence-based: the curated grocery rail, or
          // Wolt's OWN tags saying this venue is a grocery/supermarket.
          // Restaurants, pharmacies and flower shops carry neither.
          const tags = (v.tags || []).join(",");
          const taggedGrocery = /\b(grocer(y|ies)|supermarket|convenience)\b/i.test(tags);
          if (sec.name === "top-grocery-picks") {
            venues.set(v.slug, { slug: v.slug, name: v.name, city: city.slug, via: "top-grocery-picks", raw: v });
          } else if (taggedGrocery) {
            venues.set(v.slug, { slug: v.slug, name: v.name, city: city.slug, via: `tagged "${tags}"`, raw: v });
          }
        }
      }
    }
    await sleep(600);
  }
  return [...venues.values()];
}

/**
 * Wolt's grocery venue list also carries each shop's own coordinates and
 * address, i.e. a branch list for 30+ real Kosovo grocery shops -- including
 * SPAR, Super Viva, Maxi and Plus Market branches. Cheap (8 requests) and
 * independent of the long assortment sweep, so it always runs.
 *
 * A Plus Code ("M525+2J8") is what Wolt sometimes stores instead of a street
 * address; it is not a street, so it is not written into `address`.
 */
const PLUS_CODE_RE = /^[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3}$/i;

async function harvestWoltVenueStores(report) {
  const entry = {
    domain: "wolt.com (venue list)",
    platform: "Wolt venue-list API",
    endpoint: "https://restaurant-api.wolt.com/v1/pages/venue-list/category-grocery?lat=&lon=",
    productCount: 0,
    storeCount: 0,
    notes: [
      "each grocery venue carries its own coordinates and (sometimes) a street address -- these are real shop locations, not approximations",
      "a Plus Code in Wolt's `address` field is not a street address and is left out rather than written in",
    ],
  };
  const venues = await discoverWoltGroceryVenues(entry);
  const stores = [];
  for (const v of venues) {
    const raw = v.raw || {};
    const loc = Array.isArray(raw.location) ? raw.location : null;
    const addr = typeof raw.address === "string" ? raw.address.trim() : "";
    const { chain } = woltChainOf(v.name);
    stores.push({
      chain,
      name: v.name,
      city: raw.city || guessCity(addr) || null,
      address: addr && !PLUS_CODE_RE.test(addr) ? addr : null,
      lat: loc && Number.isFinite(loc[1]) ? loc[1] : null,
      lng: loc && Number.isFinite(loc[0]) ? loc[0] : null,
      hours: null,
      phone: null,
      sourceUrl: `https://wolt.com/en/xkx/${v.city}/venue/${v.slug}`,
    });
  }
  entry.storeCount = stores.length;
  report.domains.push(entry);
  return { stores };
}

async function harvestWolt(report, existingProducts) {
  const entry = {
    domain: "wolt.com",
    chain: "(30+ Kosovo grocery shops, one Wolt venue each)",
    platform: "Wolt consumer assortment API (public, unauthenticated)",
    endpoint:
      "https://consumer-api.wolt.com/consumer-api/consumer-assortment/v1/venues/slug/<venue>/assortment[/categories/slug/<leaf>]",
    machineReadable:
      "JSON: assortment -> categories[] (nested subcategories) -> per-leaf items[] carrying name, price (minor units), images[], and barcode_gtin (a real EAN where the shop published one)",
    productCount: 0,
    storeCount: 0,
    notes: [
      "robots.txt https://wolt.com/robots.txt (HTTP 200) is `User-agent: * / Disallow:` -- nothing disallowed",
      "PRICE CAVEAT: a Wolt price is that shop's price ON WOLT and may include a delivery-platform markup; it is a real published price, not the in-store till price",
      "no brand field exists on this API -- `brand` is null unless the project's conservative title-derivation matches a known manufacturer; a seller name is never written into `brand`",
    ],
    venues: [],
  };

  const venues = await discoverWoltGroceryVenues(entry);
  entry.notes.push(`discovered ${venues.length} grocery venues across ${WOLT_CITIES.length} Kosovo cities on Wolt`);

  const rows = [];
  for (const v of venues.slice(0, WOLT_VENUE_LIMIT === Infinity ? venues.length : WOLT_VENUE_LIMIT)) {
    const base = `https://consumer-api.wolt.com/consumer-api/consumer-assortment/v1/venues/slug/${v.slug}/assortment`;
    const root = await woltJson(base);
    if (!root.ok || !root.json) {
      entry.venues.push({ slug: v.slug, name: v.name, city: v.city, httpStatus: root.status, items: 0, withBarcode: 0 });
      continue;
    }
    const leaves = [];
    const walk = (c, path) => {
      const p = [...path, String(c.name || "").replace(/[\t\r\n]+/g, " ").trim()];
      if (c.subcategories?.length) c.subcategories.forEach((s) => walk(s, p));
      else leaves.push({ slug: c.slug, path: p });
    };
    (root.json.categories || []).forEach((c) => walk(c, []));

    const { chain, key } = woltChainOf(v.name);
    const seen = new Map();
    for (const leaf of leaves) {
      let token = null;
      let guard = 0;
      do {
        const url = `${base}/categories/slug/${leaf.slug}` + (token ? `?page_token=${encodeURIComponent(token)}` : "");
        const r = await woltJson(url);
        if (!r.ok || !r.json) break;
        for (const it of r.json.items || []) {
          if (!it?.id || !it.name) continue;
          if (!seen.has(it.id)) seen.set(it.id, { item: it, leaf });
        }
        token = r.json.metadata?.next_page_token || null;
        guard++;
        await sleep(WOLT_DELAY_MS);
      } while (token && guard < 40);
    }

    let withBarcode = 0;
    for (const { item, leaf } of seen.values()) {
      const gtin = isValidGs1(item.barcode_gtin) ? String(item.barcode_gtin).trim() : null;
      if (gtin) withBarcode++;
      const cls = classifyByBarcode(gtin);
      const derived = deriveBrandFromTitle(item.name);
      const price = typeof item.price === "number" ? Math.round(item.price) / 100 : null;
      const wasPrice = typeof item.original_price === "number" ? Math.round(item.original_price) / 100 : null;
      rows.push({
        id: `wolt.com/${v.slug}:${item.id}`,
        source: `wolt.com/${key}`,
        sourceLabel: `${chain} (Wolt)`,
        name: item.name,
        brand: derived.brand,
        brandSource: derived.brandSource,
        // the shop's own leaf category, e.g. "BUKË" under "BUKË"
        category: leaf.path[leaf.path.length - 1] || null,
        price,
        ...(wasPrice != null && price != null && wasPrice > price ? { previousPrice: wasPrice } : {}),
        currency: "EUR",
        image: item.images?.[0]?.url || null,
        url: `https://wolt.com/en/xkx/${v.city}/venue/${v.slug}`,
        barcode: gtin,
        isLocalBrand: cls.isLocalBrand,
        localEvidence: cls.localEvidence,
      });
    }
    entry.venues.push({
      slug: v.slug,
      name: v.name,
      chain,
      city: v.city,
      httpStatus: 200,
      leafCategories: leaves.length,
      items: seen.size,
      withBarcode,
    });
    console.log(`  wolt/${v.slug}: ${seen.size} items, ${withBarcode} with a published EAN`);
  }

  // Union with anything already on file for these sources (never shrink).
  const byId = new Map(rows.map((p) => [p.id, p]));
  for (const row of existingProducts) if (!byId.has(row.id)) byId.set(row.id, row);
  const products = [...byId.values()];

  entry.productCount = products.length;
  entry.barcodeCount = products.filter((p) => isValidGs1(p.barcode)).length;
  report.domains.push(entry);
  return { products };
}

// ============================================================================
// Maxi E-Shop (maxiks.shop) -- the Maxi Supermarket chain's own webshop
//
// The previous pass recorded this domain as "HTTP 403, Cloudflare 'Just a
// moment...' challenge". Re-probed this pass it answers HTTP 200 with no
// challenge at all, and https://maxiks.shop/robots.txt (HTTP 200) is
// "User-agent: * / Disallow:" -- i.e. nothing disallowed. So it is crawled.
// ============================================================================

const MAXI_SHOP = "maxiks.shop";

/** Parses the product tiles out of one maxiks.shop category listing page. */
function parseMaxiShopTiles(html, categorySlug) {
  const rows = [];
  const blocks = html.split(/(?=<div class="product-item)/).slice(1);
  for (const block of blocks) {
    const href = block.match(/<a[^>]+href="([^"]*\/product\/[^"]+)"/);
    const name = block.match(/class="product-title"[^>]*>\s*(?:<a[^>]*>)?\s*([^<]+)/);
    const price = block.match(/class="[^"]*product-price[^"]*"[^>]*>\s*([^<]+)/);
    const img = block.match(/<img[^>]+(?:data-src|src)="([^"]+)"/);
    if (!href || !name) continue;
    const raw = (price?.[1] || "").replace(/[^\d.,]/g, "").replace(",", ".");
    const p = raw ? parseFloat(raw) : NaN;
    rows.push({
      url: href[1].startsWith("http") ? href[1] : `https://${MAXI_SHOP}/${href[1].replace(/^\//, "")}`,
      name: decodeHtmlEntities(name[1]),
      price: Number.isFinite(p) ? Math.round(p * 100) / 100 : null,
      image: img ? (img[1].startsWith("http") ? img[1] : `https://${MAXI_SHOP}/${img[1].replace(/^\//, "")}`) : null,
      category: categorySlug,
    });
  }
  return rows;
}

async function harvestMaxiShop(report, existingProducts) {
  const entry = {
    domain: MAXI_SHOP,
    chain: "Maxi Supermarket",
    platform: "custom PHP storefront (Maxi E-Shop)",
    endpoint: `https://${MAXI_SHOP}/<category-slug>`,
    productCount: 0,
    storeCount: 0,
    notes: [],
    probes: [],
  };

  const robots = await fetchText(`https://${MAXI_SHOP}/robots.txt`);
  entry.probes.push({ url: `https://${MAXI_SHOP}/robots.txt`, status: robots.status, body: robots.text.trim().slice(0, 120) });
  if (robots.ok && /Disallow:\s*\/\s*$/m.test(robots.text)) {
    entry.notes.push("robots.txt disallows crawling -- not harvested");
    entry.productCount = existingProducts.length;
    report.domains.push(entry);
    return { products: existingProducts };
  }
  entry.notes.push(`robots.txt (HTTP ${robots.status}) is "${robots.text.trim().replace(/\s+/g, " ").slice(0, 60)}" -- crawling permitted`);

  // The sitemap is served without a challenge and proves the shop has a real
  // grocery tree; the LISTING and PRODUCT pages are the ones behind the WAF.
  const sitemap = await fetchText(`https://${MAXI_SHOP}/sitemap.xml`);
  const productUrls = [];
  const categoryUrls = [];
  if (sitemap.ok) {
    for (const m of sitemap.text.matchAll(/<loc>([^<]+)<\/loc>/g)) {
      if (/\/product\//.test(m[1])) productUrls.push(m[1]);
      else if (/\/(products|category|subcategory)/.test(m[1])) categoryUrls.push(m[1]);
    }
  }
  entry.probes.push({ url: `https://${MAXI_SHOP}/sitemap.xml`, status: sitemap.status });
  entry.notes.push(
    `sitemap.xml (HTTP ${sitemap.status}) lists ${productUrls.length} product URLs and ${categoryUrls.length} listing URLs`
  );

  const merged = new Map();
  for (const p of existingProducts) merged.set(p.id, p);
  let blocked = 0;
  let fetched = 0;

  // Probe a handful of real product pages. If the WAF answers, stop -- the
  // challenge is NOT solved, worked around or retried at volume.
  for (const url of productUrls.slice(0, 400)) {
    const r = await fetchText(url, {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "sq,en;q=0.9",
    });
    if (!r.ok) {
      blocked++;
      if (blocked <= 3) entry.probes.push({ url, status: r.status });
      if (blocked >= 3) {
        entry.notes.push(
          `product pages are behind a bot-protection wall: ${blocked} consecutive non-200 responses (HTTP ${r.status}, Cloudflare "Just a moment..." managed challenge). No attempt was made to solve or bypass it; harvesting stopped here.`
        );
        break;
      }
      continue;
    }
    blocked = 0;
    fetched++;
    const name = r.text.match(/<h1[^>]*>\s*([^<]+)/);
    const price = r.text.match(/(\d+[.,]\d{2})\s*(?:€|EUR)/);
    const img = r.text.match(/<img[^>]+class="[^"]*product[^"]*"[^>]+src="([^"]+)"/);
    const ean = r.text.match(/\b(?:EAN|Barkod(?:i)?)\b[^0-9]{0,20}(\d{8}|\d{12,14})\b/i);
    if (!name) continue;
    const clean = decodeHtmlEntities(name[1]);
    const slug = url.split("/").filter(Boolean).pop();
    const derived = deriveBrandFromTitle(clean);
    const barcode = ean && isValidGs1(ean[1]) ? ean[1] : null;
    const cls = classifyByBarcode(barcode);
    merged.set(`${MAXI_SHOP}:${slug}`, {
      id: `${MAXI_SHOP}:${slug}`,
      source: MAXI_SHOP,
      sourceLabel: "Maxi E-Shop",
      name: clean,
      brand: derived.brand,
      brandSource: derived.brandSource,
      category: null,
      price: price ? Math.round(parseFloat(price[1].replace(",", ".")) * 100) / 100 : null,
      currency: "EUR",
      image: img ? img[1] : null,
      url,
      barcode,
      isLocalBrand: cls.isLocalBrand,
      localEvidence: cls.localEvidence,
    });
    await sleep(DELAY_MS);
  }

  entry.notes.push(`${fetched} product pages actually returned HTTP 200; ${merged.size - existingProducts.length} products written`);
  if (!fetched) {
    entry.rejected = productUrls.length > 0 ? undefined : true;
    entry.notes.push(
      "NOTE: Maxi's assortment is NOT missing from this dataset -- the chain's Pristina branch publishes 1,600+ items with real EANs through its Wolt venue (source `wolt.com/maxi-supermarket`), which is where Maxi products in kosovo-retail.json come from."
    );
  }
  entry.productCount = merged.size;
  report.domains.push(entry);
  return { products: [...merged.values()] };
}

// ============================================================================
// Remaining chains' official branch lists.
//
// Each entry here is a chain whose OWN site publishes its branches; the list
// is fetched live every run so the data is never a stale hand-copy. A chain
// whose probe fails is recorded with its URL and HTTP status and contributes
// nothing -- no invented branches, no approximated coordinates.
// ============================================================================

/** Pulls a `places` / marker array out of an Elementor / WP map widget page. */
function extractMapMarkers(html) {
  const out = [];
  const keys = ['"places":', '"markers":', '"locations":', "places:", "markers:"];
  for (const k of keys) {
    let idx = html.indexOf(k);
    while (idx !== -1) {
      const start = html.indexOf("[", idx + k.length - 1);
      if (start === -1) break;
      const arr = extractBalanced(html, start, "[", "]");
      if (arr) {
        try {
          const parsed = JSON.parse(arr.replace(/\\"/g, '"').replace(/\\\//g, "/"));
          if (Array.isArray(parsed) && parsed.length) out.push(...parsed);
        } catch {
          /* not JSON -- skipped, never guessed */
        }
      }
      idx = html.indexOf(k, idx + 1);
    }
  }
  return out;
}

/**
 * Pulls coordinates out of a published Google Maps URL. Only reads numbers
 * Google itself put in the link -- nothing is geocoded, approximated or
 * invented; a link with no coordinates yields nulls.
 *   .../@42.6478648,21.0918131,19.7z/...        -> map centre
 *   ...!8m2!3d42.6480111!4d21.0921702           -> the place's own point
 *   /maps/dir//42.4346749,21.0349684/@...       -> the destination point
 */
function coordsFromGoogleMapsUrl(url) {
  if (!url) return { lat: null, lng: null };
  const place = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (place) return { lat: Number(place[1]), lng: Number(place[2]) };
  // Google's directions payload puts the DESTINATION as !2m2!1d<lng>!2d<lat>
  // (longitude first). That is the shop; the "@" pair after it is only the
  // map viewport centre, which can sit a street away.
  const dest = url.match(/!2m2!1d(-?\d+\.\d+)!2d(-?\d+\.\d+)/);
  if (dest) return { lat: Number(dest[2]), lng: Number(dest[1]) };
  const dir = url.match(/\/dir\/\/(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (dir) return { lat: Number(dir[1]), lng: Number(dir[2]) };
  const at = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (at) return { lat: Number(at[1]), lng: Number(at[2]) };
  return { lat: null, lng: null };
}

/**
 * ETC (etc-ks.com) branch list. etc-ks.com/deget.php is a live city search
 * backed by call_ajax.php?n=<letter>, which returns links to one HTML table
 * per city at /tabelat/<city>.html. Each table row is one branch: "Pika N",
 * city + neighbourhood + postal code, a Google Maps navigation link (whose
 * coordinates are read verbatim) and the opening hours.
 *
 * This is the branch list the previous pass recorded as "a single JPEG";
 * that was the images/degetdheorarihapjes.jpg fallback, not this table.
 * robots.txt: etc-ks.com/robots.txt is HTTP 404 -- nothing disallowed.
 */
async function harvestEtcStores(report) {
  const entry = {
    domain: "etc-ks.com (branch tables)",
    chain: "ETC",
    platform: "static per-city HTML tables behind a PHP letter search",
    endpoint: "https://etc-ks.com/call_ajax.php?n=<letter> -> https://etc-ks.com/tabelat/<city>.html",
    productCount: 0,
    storeCount: 0,
    notes: ["robots.txt is HTTP 404 (none served), so nothing is disallowed"],
    probes: [],
  };
  const browserHeaders = {
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "sq,en;q=0.9",
  };

  const cityPages = new Set();
  for (const letter of "abcdefghijklmnopqrstuvxyz") {
    const r = await fetchText(`https://etc-ks.com/call_ajax.php?n=${letter}`, {
      ...browserHeaders,
      "X-Requested-With": "XMLHttpRequest",
      Referer: "https://etc-ks.com/deget.php",
    });
    if (!r.ok) {
      if (letter === "a") entry.probes.push({ url: `https://etc-ks.com/call_ajax.php?n=a`, status: r.status });
      continue;
    }
    for (const m of r.text.matchAll(/tabelat\/([a-z0-9_-]+)\.html/g)) cityPages.add(m[1]);
    await sleep(400);
  }
  entry.notes.push(`the city search exposes ${cityPages.size} per-city branch tables`);

  const stores = [];
  for (const city of cityPages) {
    const url = `https://etc-ks.com/tabelat/${city}.html`;
    const r = await fetchText(url, browserHeaders);
    if (!r.ok) {
      entry.probes.push({ url, status: r.status });
      continue;
    }
    for (const rowMatch of r.text.matchAll(/<tr class="pika\d+"[\s\S]*?<\/tr>/g)) {
      const row = rowMatch[0];
      const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1]);
      if (cells.length < 5) continue;
      const pika = decodeHtmlEntities(cells[1].replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
      const cityCell = cells[2];
      const cityName = decodeHtmlEntities((cityCell.match(/<h6[^>]*>([^<]*)/) || [])[1] || "").trim() || null;
      const area = decodeHtmlEntities((cityCell.match(/<h7[^>]*>([^<]*)/) || [])[1] || "").trim() || null;
      const href = (cells[3].match(/href="([^"]+)"/) || [])[1] || null;
      const { lat, lng } = coordsFromGoogleMapsUrl(href);
      const hours = decodeHtmlEntities(cells[4].replace(/<br\s*\/?>/g, " ").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()) || null;
      if (!pika && !cityName) continue;
      stores.push({
        chain: "ETC",
        name: `ETC ${pika}${cityName ? ` (${cityName})` : ""}`.trim(),
        city: guessCity(cityName || "") || cityName,
        address: area,
        lat: Number.isFinite(lat) ? lat : null,
        lng: Number.isFinite(lng) ? lng : null,
        hours,
        phone: null,
        sourceUrl: url,
      });
    }
    await sleep(500);
  }
  entry.storeCount = stores.length;
  report.domains.push(entry);
  return { stores };
}

/**
 * Eli-Ab (eliabmarket.com). Six `<h4 id="locationN">` headings carry
 * "City (street)", and an inline script attaches the branch's own Google
 * Maps URL to each id. robots.txt is HTTP 404 -- nothing disallowed.
 *
 * The site's own copy says eight units but publishes six; six is what is
 * written, because six is what it publishes.
 */
async function harvestEliAbStores(report) {
  const url = "https://eliabmarket.com/";
  const entry = {
    domain: "eliabmarket.com",
    chain: "Eli-Ab",
    platform: "single-page site; #locationN headings + inline onclick Google Maps URLs",
    endpoint: url,
    productCount: 0,
    storeCount: 0,
    notes: ["robots.txt is HTTP 404 (none served), so nothing is disallowed"],
    probes: [],
  };
  const r = await fetchText(url);
  entry.probes.push({ url, status: r.status });
  if (!r.ok) {
    entry.rejected = true;
    entry.reason = `branch list unreachable: HTTP ${r.status}`;
    report.domains.push(entry);
    return { stores: [] };
  }
  const mapsById = new Map();
  for (const m of r.text.matchAll(/querySelector\('#location(\d+)'\)[\s\S]{0,120}?location\.href='([^']+)'/g)) {
    mapsById.set(m[1], m[2]);
  }
  const stores = [];
  for (const m of r.text.matchAll(/<h4 id="location(\d+)"[\s\S]*?<\/h4>/g)) {
    const id = m[1];
    const text = decodeHtmlEntities(m[0].replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
    if (!text) continue;
    const parts = text.match(/^(.*?)\s*\(\s*(.*?)\s*\)\s*$/);
    const city = (parts ? parts[1] : text).replace(/\s+\.\s*/g, " ").trim() || null;
    const address = parts ? parts[2].replace(/\s*\.\s*/g, ". ").replace(/\s+/g, " ").trim() : null;
    const { lat, lng } = coordsFromGoogleMapsUrl(mapsById.get(id));
    stores.push({
      chain: "Eli-Ab",
      name: `Eli-Ab - ${text}`,
      city: guessCity(city || "") || city,
      address,
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
      hours: null,
      phone: null,
      sourceUrl: url,
    });
  }
  entry.storeCount = stores.length;
  if (!stores.length) entry.notes.push("page reachable but the #locationN block did not parse -- nothing taken rather than guessed");
  report.domains.push(entry);
  return { stores };
}

/**
 * Al Trade Market (market.altradecenter.com) -- a Kosovo retail chain this
 * project had not seen before. Its Kontakti page lists every shop under
 * "(Rrjeti i Qendrave Tregtare me pakicë)" as
 * "Al Trade Market N (City, Street) +383 ...". No coordinates are published,
 * so lat/lng stay null.
 */
async function harvestAlTradeStores(report) {
  const url = "https://market.altradecenter.com/kontakti/";
  const entry = {
    domain: "market.altradecenter.com",
    chain: "Al Trade Market",
    platform: "WordPress + Elementor icon list",
    endpoint: url,
    productCount: 0,
    storeCount: 0,
    notes: ["no coordinates are published for these branches -- lat/lng left null, never geocoded"],
    probes: [],
  };
  const r = await fetchText(url);
  entry.probes.push({ url, status: r.status });
  if (!r.ok) {
    entry.rejected = true;
    entry.reason = `branch list unreachable: HTTP ${r.status}`;
    report.domains.push(entry);
    return { stores: [] };
  }
  const stores = [];
  for (const m of r.text.matchAll(/<span class="elementor-icon-list-text">([\s\S]*?)<\/span>/g)) {
    const text = decodeHtmlEntities(m[1].replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
    const parsed = text.match(/^(Al\s*Trade\s*Market[^()]*)\(([^)]*)\)\s*(.*)$/i);
    if (!parsed) continue;
    const name = parsed[1].trim();
    const inner = parsed[2].trim();
    const phone = (parsed[3].match(/\+?[\d\s()-]{7,}/) || [])[0]?.trim() || null;
    const city = guessCity(inner);
    stores.push({
      chain: "Al Trade Market",
      name,
      city,
      address: inner || null,
      lat: null,
      lng: null,
      hours: null,
      phone,
      sourceUrl: url,
    });
  }
  entry.storeCount = stores.length;
  if (!stores.length) entry.notes.push("page reachable but the retail-network list did not parse -- nothing taken rather than guessed");
  report.domains.push(entry);
  return { stores };
}

/**
 * Emona Center (emonacenter.com). The "Lokacionet tona aktuale" section is an
 * image accordion: the branch names live inside the tile images and are not
 * readable as text, but each tile links to a Google Maps short link. Those
 * short links are resolved with ONE redirect-following request each, and the
 * coordinates are read out of the resolved URL. Where the resolved URL has no
 * coordinates, the row is skipped rather than approximated.
 */
async function harvestEmonaStores(report) {
  const url = "https://emonacenter.com/emona-center-retail/";
  const entry = {
    domain: "emonacenter.com",
    chain: "Emona",
    platform: "WordPress + Elementor image accordion linking to Google Maps short links",
    endpoint: url,
    productCount: 0,
    storeCount: 0,
    notes: [
      "branch NAMES are baked into the tile images (Bardh-01.png ...) and are not machine-readable -- only what the resolved map link states is used",
      "the section shows 18 tiles but publishes only 9 distinct map links; 9 is what is written",
    ],
    probes: [],
  };
  const r = await fetchText(url);
  entry.probes.push({ url, status: r.status });
  if (!r.ok) {
    entry.rejected = true;
    entry.reason = `branch list unreachable: HTTP ${r.status}`;
    report.domains.push(entry);
    return { stores: [] };
  }
  const links = [...new Set([...r.text.matchAll(/https:\/\/(?:maps\.app\.)?goo\.gl\/maps\/[A-Za-z0-9]+/g)].map((m) => m[0]))];
  entry.notes.push(`${links.length} distinct Google Maps short links found`);
  const stores = [];
  for (const link of links) {
    const res = await fetchText(link);
    const finalUrl = res.finalUrl || "";
    const { lat, lng } = coordsFromGoogleMapsUrl(finalUrl);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      entry.probes.push({ url: link, status: res.status, note: "resolved URL carried no coordinates -- skipped" });
      await sleep(700);
      continue;
    }
    const placeName = decodeURIComponent((finalUrl.match(/\/maps\/place\/([^/@]+)/) || [])[1] || "").replace(/\+/g, " ").trim() || null;
    stores.push({
      chain: "Emona",
      name: placeName || "Emona Center",
      city: guessCity(placeName || ""),
      address: null,
      lat,
      lng,
      hours: null,
      phone: null,
      sourceUrl: url,
    });
    await sleep(700);
  }
  entry.storeCount = stores.length;
  report.domains.push(entry);
  return { stores };
}

const EXTRA_CHAIN_HARVESTERS = [harvestEtcStores, harvestEliAbStores, harvestAlTradeStores, harvestEmonaStores];

const EXTRA_CHAIN_SOURCES = [];

async function harvestExtraChainStores(report) {
  const stores = [];
  for (const harvester of EXTRA_CHAIN_HARVESTERS) {
    try {
      const res = await harvester(report);
      stores.push(...res.stores);
    } catch (err) {
      report.domains.push({
        domain: harvester.name,
        rejected: true,
        productCount: 0,
        storeCount: 0,
        reason: `harvester threw: ${String(err && err.message ? err.message : err)}`,
      });
    }
    await sleep(DELAY_MS);
  }
  for (const src of EXTRA_CHAIN_SOURCES) {
    const entry = {
      domain: new URL(src.url).hostname,
      chain: src.chain,
      platform: null,
      productCount: 0,
      storeCount: 0,
      notes: [],
      probes: [],
    };
    const r = await fetchText(src.url);
    entry.probes.push({ url: src.url, status: r.status });
    if (!r.ok) {
      entry.rejected = true;
      entry.reason = `no official branch list reachable: ${src.url} returned HTTP ${r.status}${r.error ? ` (${r.error})` : ""}`;
      report.domains.push(entry);
      await sleep(DELAY_MS);
      continue;
    }
    const markers = extractMapMarkers(r.text);
    let added = 0;
    for (const m of markers) {
      const lat = Number(m.lat ?? m.latitude ?? m.location?.lat);
      const lng = Number(m.lng ?? m.lon ?? m.longitude ?? m.location?.lng);
      const name = decodeHtmlEntities(String(m.title ?? m.name ?? "").replace(/<[^>]*>/g, "")) || null;
      const address = decodeHtmlEntities(String(m.address ?? m.street ?? "").replace(/<[^>]*>/g, "")) || null;
      if (!name && !address && !Number.isFinite(lat)) continue;
      stores.push({
        chain: src.chain,
        name,
        city: guessCity(`${name || ""} ${address || ""}`),
        address,
        lat: Number.isFinite(lat) ? lat : null,
        lng: Number.isFinite(lng) ? lng : null,
        hours: null,
        phone: m.phone ? String(m.phone) : null,
        sourceUrl: src.url,
      });
      added++;
    }
    entry.storeCount = added;
    entry.platform = added ? "embedded map marker array" : null;
    if (!added) {
      entry.notes.push("page reachable but no machine-readable branch array found in it -- nothing taken rather than guessed");
    }
    report.domains.push(entry);
    await sleep(DELAY_MS);
  }
  return { stores };
}

// ============================================================================
// De-duplication at the DATA level (owner, 2026-09-12: "REMOVE DUPES")
//
// The app already de-duplicates at render time keeping the cheapest row; this
// does the same in the file itself so the file is clean on its own.
//
// Rule:
//   - group on (RETAILER, matchKey), where matchKey is `gtin:<ean>` when the
//     row has a real GS1 barcode and `name:<normalised name>` otherwise;
//   - RETAILER, not `source`: two feeds for the same shop (e.g. Super Viva's
//     own site and Super Viva's Wolt venue) are ONE retailer, so the same
//     product arriving through both is a duplicate;
//   - keep the CHEAPEST row in each group; ties broken in favour of the row
//     that carries a barcode, then the one with an image, then the first seen.
//
// Rows for the SAME product at DIFFERENT retailers are deliberately KEPT --
// they are exactly what makes "show the cheapest" meaningful.
// ============================================================================

/** Which real-world retailer a `source` belongs to. */
function retailerOf(source) {
  const s = String(source || "");
  if (s.startsWith("wolt.com/")) return s.slice("wolt.com/".length);
  if (s === "super-viva.com") return "super-viva";
  if (s === "etc-ks.com") return "etc";
  if (s === "begmart.com") return "begmart";
  if (s === "maxiks.shop") return "maxi-supermarket";
  return s;
}

function dedupeProducts(products, report) {
  const groups = new Map();
  for (const p of products) {
    const key = `${retailerOf(p.source)}||${p.matchKey || computeMatchKey(p.name, p.barcode)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }
  const kept = [];
  let removed = 0;
  const removedByRetailer = {};
  let crossFeedCollapses = 0;
  for (const [, rows] of groups) {
    if (rows.length === 1) {
      kept.push(rows[0]);
      continue;
    }
    const sorted = rows.slice().sort((a, b) => {
      const ap = a.price == null ? Infinity : a.price;
      const bp = b.price == null ? Infinity : b.price;
      if (ap !== bp) return ap - bp;
      const ab = isValidGs1(a.barcode) ? 0 : 1;
      const bb = isValidGs1(b.barcode) ? 0 : 1;
      if (ab !== bb) return ab - bb;
      const ai = a.image ? 0 : 1;
      const bi = b.image ? 0 : 1;
      return ai - bi;
    });
    kept.push(sorted[0]);
    removed += rows.length - 1;
    const r = retailerOf(sorted[0].source);
    removedByRetailer[r] = (removedByRetailer[r] || 0) + (rows.length - 1);
    if (new Set(rows.map((x) => x.source)).size > 1) crossFeedCollapses++;
  }
  // --- second stage ---------------------------------------------------
  // A `gtin:` group and a `name:` group never collide, so the same product
  // reaching one retailer through two feeds -- one that publishes the EAN
  // (super-viva.com) and one that does not (that shop's Wolt venue) -- still
  // survives twice. Collapse those onto the row that CARRIES THE BARCODE:
  // a barcode is the single field this app cannot work without, so it wins
  // over a marginally lower price, and the rule is recorded as such.
  const barcodedNames = new Map(); // retailer -> normalised name -> true
  for (const p of kept) {
    if (!isValidGs1(p.barcode)) continue;
    const r = retailerOf(p.source);
    if (!barcodedNames.has(r)) barcodedNames.set(r, new Set());
    barcodedNames.get(r).add(normalizeForMatch(p.name));
  }
  let shadowed = 0;
  const finalKept = kept.filter((p) => {
    if (isValidGs1(p.barcode)) return true;
    const names = barcodedNames.get(retailerOf(p.source));
    if (names && names.has(normalizeForMatch(p.name))) {
      shadowed++;
      return false;
    }
    return true;
  });

  report.deduplication = {
    secondStage:
      "a barcode-less row is dropped when the SAME retailer already has a row with an identical normalised name that carries a real GS1 barcode -- the barcoded row wins even if the other is marginally cheaper, because a product with no barcode cannot be classified, flagged or matched to an alternative at all",
    secondStageRowsRemoved: shadowed,
    rule:
      "grouped on (retailer, matchKey) where matchKey is gtin:<ean> when a real GS1 barcode is present and name:<normalised name> otherwise; the cheapest row in each group is kept (ties -> the row with a barcode, then with an image). The SAME product at DIFFERENT retailers is deliberately kept.",
    before: products.length,
    after: finalKept.length,
    removed: removed + shadowed,
    removedByFirstStage: removed,
    removedByRetailer: Object.fromEntries(Object.entries(removedByRetailer).sort((a, b) => b[1] - a[1])),
    groupsCollapsedAcrossTwoFeedsOfTheSameRetailer: crossFeedCollapses,
  };
  return finalKept;
}

// ============================================================================
// Store chain names: canonicalisation + junk handling
//
// kosovo-stores.json had grown ~760 distinct `chain` strings, most of them
// single independent shops taken from an OpenStreetMap layer, plus case and
// spacing variants of the SAME chain ("Etc"/"ETC", "KAM SUPERMARKET"/"KAM
// Market") and a handful of meaningless labels (".", "Market", "market",
// "minimarket", "Supermarket", "23").
//
// Two rules, both deliberately conservative:
//   1. Only variants that are provably the same chain are merged -- an
//      explicit alias table plus exact case/spacing/diacritic equality. Two
//      different shops that merely share a common Albanian word are NEVER
//      merged (Kosovo really does have dozens of unrelated shops called
//      "Market Beni").
//   2. A meaningless label is not deleted -- the branch is real, the label is
//      not -- it is set to null and the row keeps its name/coordinates. A
//      null chain reads as "an unnamed independent shop", which is the truth.
// ============================================================================

const CHAIN_ALIASES = [
  [/^etc$/i, "ETC"],
  [/^kam\s*(market|supermarket)$/i, "KAM Market"],
  [/^maxi$/i, "Maxi Supermarket"],
  [/^maxi\s*market$/i, "Maxi Supermarket"],
  [/^max\s*market$/i, "Maxi Supermarket"],
  [/^viva\s*fresh(\s*store)?$/i, "Viva Fresh Store"],
  [/^supermarket\s*viva$/i, "Super Viva"],
  // "VIVA Market" is deliberately NOT merged: it could be either Super Viva
  // or Viva Fresh Store and the data does not say which. src/lib/stores.js
  // already groups all four Viva spellings for the "where to buy" view, so
  // nothing is lost by leaving it as published.
  [/^spar(\s*kosova)?$/i, "SPAR Kosova"],
  [/^albi\s*market$/i, "Albi Market"],
  [/^meridian\s*express$/i, "Meridian Express"],
  [/^median\s*express$/i, "Meridian Express"],
  [/^interex$/i, "Interex"],
  [/^emona(\s*center)?$/i, "Emona"],
  [/^kipper(\s*market)?$/i, "Kipper Market"],
  [/^my\s*market$/i, "My Market"],
  [/^conad(\s*kosova)?$/i, "CONAD Kosova"],
  [/^ben-?af$/i, "Ben-Af"],
  [/^eli-?ab$/i, "Eli-Ab"],
  [/^qta$/i, "QTA"],
  [/^deppo(\s*market)?$/i, "Deppo Market"],
  [/^gorenje(\s*(department\s*store|ovs))?$/i, "Gorenje"],
];

// Labels that carry no identity at all. The BRANCH stays; only the useless
// chain label is dropped (set to null).
const MEANINGLESS_CHAIN = /^(\.|,|-|market|markets|marketi|mini\s*market|minimarket|mini-?market|super\s*market|supermarket|supermarketi|shitore|shitorja|shop|store|convenience\s*store|restaurant,?\s*food|center|\d+)$/i;

function canonicalChain(raw) {
  const s = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (!s) return null;
  if (MEANINGLESS_CHAIN.test(s)) return null;
  for (const [re, canon] of CHAIN_ALIASES) if (re.test(s)) return canon;
  return s;
}

/**
 * Applies canonicalChain() to every row and reports what changed. Rows are
 * never dropped here -- only relabelled.
 */
function canonicalizeStoreChains(stores) {
  const renames = {};
  let nulled = 0;
  const out = stores.map((s) => {
    const canon = canonicalChain(s.chain);
    if (canon === null && s.chain != null) {
      nulled++;
      // keep the original label as the branch name when the row has none
      return { ...s, chain: null, name: s.name || (String(s.chain).trim() || null) };
    }
    if (canon !== s.chain) {
      const k = `${s.chain} -> ${canon}`;
      renames[k] = (renames[k] || 0) + 1;
    }
    return { ...s, chain: canon };
  });
  return { stores: out, renames, chainLabelsDroppedAsMeaningless: nulled };
}

/**
 * Collapses rows that are plainly the SAME SHOP at the SAME POINT, even when
 * their chain labels differ. Two rows qualify only when they carry the same
 * branch name AND their coordinates are within 25 m -- tight enough that this
 * cannot merge two different shops (two neighbouring shops are never 25 m
 * apart AND identically named), loose enough to absorb the rounding between
 * an OpenStreetMap node and a chain page's own figure.
 *
 * This exists to clear the residue of a real bug: canonicalisation used to run
 * AFTER merging, so a row whose label was nulled ("Market", "Shitore") could
 * never be matched against the same shop arriving again under its original
 * label, and every re-run appended another copy.
 */
const SAME_POINT_METRES = 25;

function dedupeStoresByPoint(stores) {
  const out = [];
  const placed = [];
  let removed = 0;
  for (const s of stores) {
    if (s.lat == null || s.lng == null || !normKey(s.name)) {
      out.push(s);
      continue;
    }
    const nk = normKey(s.name);
    const hit = placed.find(
      (p) => p.nk === nk && metresBetween(out[p.i].lat, out[p.i].lng, s.lat, s.lng) <= SAME_POINT_METRES
    );
    if (hit == null) {
      out.push(s);
      placed.push({ nk, i: out.length - 1 });
      continue;
    }
    // Keep the more informative row: a real chain label beats a null one, and
    // a chain-site sourceUrl beats an OpenStreetMap one.
    const o = out[hit.i];
    const keepFresh =
      (!o.chain && s.chain) || (OSM_SOURCE_RE.test(o.sourceUrl || "") && !OSM_SOURCE_RE.test(s.sourceUrl || ""));
    const base = keepFresh ? s : o;
    const other = keepFresh ? o : s;
    out[hit.i] = {
      ...base,
      chain: base.chain ?? other.chain ?? null,
      city: base.city ?? other.city ?? null,
      address: base.address ?? other.address ?? null,
      lat: base.lat ?? other.lat ?? null,
      lng: base.lng ?? other.lng ?? null,
      hours: base.hours ?? other.hours ?? null,
      phone: base.phone ?? other.phone ?? null,
    };
    removed++;
  }
  return { stores: out, removed };
}

/**
 * Final de-duplication on (chain, city, address) exactly as briefed, run after
 * canonicalisation so "Etc" and "ETC" collapse. Rows with no address fall back
 * to (chain, city, name); rows with neither are kept untouched.
 */
function dedupeStoresByAddress(stores) {
  const seen = new Map();
  const out = [];
  let removed = 0;
  for (const s of stores) {
    const chain = normKey(s.chain);
    const city = normKey(s.city);
    const addr = normKey(s.address);
    const name = normKey(s.name);
    const key = addr ? `a|${chain}|${city}|${addr}` : name ? `n|${chain}|${city}|${name}` : null;
    if (!key || !chain) {
      out.push(s);
      continue;
    }
    const hit = seen.get(key);
    if (hit == null) {
      seen.set(key, out.length);
      out.push(s);
      continue;
    }
    // Two rows with the same chain+city+address are the same branch, UNLESS
    // both carry coordinates that are far apart (then the address string is
    // just coarse, e.g. a whole street) -- keep both in that case.
    const o = out[hit];
    const bothPlaced = o.lat != null && o.lng != null && s.lat != null && s.lng != null;
    if (bothPlaced && metresBetween(o.lat, o.lng, s.lat, s.lng) > SAME_BRANCH_METRES) {
      out.push(s);
      continue;
    }
    out[hit] = {
      ...o,
      city: o.city ?? s.city ?? null,
      address: o.address ?? s.address ?? null,
      lat: o.lat ?? s.lat ?? null,
      lng: o.lng ?? s.lng ?? null,
      hours: o.hours ?? s.hours ?? null,
      phone: o.phone ?? s.phone ?? null,
    };
    removed++;
  }
  return { stores: out, removed };
}

// ============================================================================
// Rejected domains -- recorded with concrete reasons, re-verified live this
// session (each was actually requested during this run; see file header).
// ============================================================================

function recordRejects(report) {
  const rejects = [
    {
      domain: "vivafresh.com",
      platform: null,
      productCount: 0,
      storeCount: 0,
      rejected: true,
      reason:
        "Re-verified live: HTTP 403 on '/' via https, http, and www.vivafresh.com -- a bare nginx/WAF 'Forbidden' wall, not a 301 and not a Cloudflare JS challenge. Treated as blocked, not defeated. The real Viva Fresh Store corporate site is vivafresh-rks.com (store list harvested above).",
    },
    {
      domain: "superviva.com",
      platform: null,
      productCount: 0,
      storeCount: 0,
      rejected: true,
      reason:
        '"The inspiring domain SuperViva.com is for sale" -- a parked domain-broker page, not the retailer. The real Super Viva site is super-viva.com (harvested above).',
    },
    {
      domain: "e-baa.com",
      platform: "Next.js storefront + Laravel backend (panel.e-baa.com)",
      productCount: 0,
      storeCount: 0,
      rejected: true,
      reason:
        "NOT REJECTED FOR LACK OF DATA -- rejected on robots.txt. e-baa.com is ETC's own online shop (etc-ks.com's footer links it as \"Blej Online | www.e-baa.com\"), HTTP 200, a Next.js storefront backed by panel.e-baa.com, and it very plainly has a full machine-readable catalogue. But https://e-baa.com/robots.txt (HTTP 200) carries a Cloudflare-managed block with an explicit `User-agent: ClaudeBot / Disallow: /` (alongside GPTBot, CCBot, Google-Extended, Bytespider, Amazonbot, meta-externalagent) and `Content-Signal: ai-train=no`. Only the homepage was fetched, to establish the ETC relationship; no catalogue endpoint was crawled and no products were taken. The site's own generic rule is `User-Agent: * / Allow: /`, so the operator may well intend a first-party script to be fine -- but that is the owner's call to make, not this harvester's.",
    },
    {
      domain: "tregushqip.com",
      platform: "marketplace (Cloudflare-fronted)",
      productCount: 0,
      storeCount: 0,
      rejected: true,
      reason:
        "Kosovo/Albania multi-vendor marketplace, HTTP 200 with JSON-LD present. Not crawled: https://www.tregushqip.com/robots.txt (HTTP 200) carries the same Cloudflare-managed `User-agent: ClaudeBot / Disallow: /` block as e-baa.com. Recorded, not harvested.",
    },
    {
      domain: "maxiks.shop",
      platform: "unknown (Cloudflare interstitial)",
      productCount: 0,
      storeCount: 0,
      rejected: true,
      reason:
        "MAXI E-Shop, the chain's online grocery. HTTP 403 with `Server: cloudflare` and the \"Just a moment...\" JS challenge page -- a bot-protection wall. No attempt was made to solve or bypass it. Maxi's corporate site maxiks.com (no challenge) was used instead, for store locations.",
    },
    {
      domain: "shop.spar.al",
      platform: "WordPress + WooCommerce (Store API enabled)",
      productCount: 0,
      storeCount: 0,
      rejected: true,
      reason:
        "MACHINE-READABLE BUT OUT OF SCOPE: https://shop.spar.al/wp-json/wc/store/products?per_page=3 returns HTTP 200 with real WooCommerce Store API product JSON. It is SPAR ALBANIA's webshop -- prices are in ALL and it delivers in Albania, not Kosovo -- so its rows are not written into kosovo-retail.json, which the app uses for 'where to buy in Kosovo'. Recorded here so the finding is not lost. (Deliberately also NOT added to local-catalogs.json: that file's `storeName` values are turned into 'local brands' by src/lib/brandAlternatives.js, and SPAR is a retailer, not a Kosovar/Albanian brand -- adding it would recreate the exact Milka/Barilla class of bug this project already fixed once.)",
    },
    {
      domain: "interex-ks.com",
      platform: null,
      productCount: 0,
      storeCount: 0,
      rejected: true,
      reason:
        "Re-verified live: HTTP 500 behind Cloudflare -- still dead. This is simply not the chain's domain. Interex's live site is interex-rks.com (HTTP 200, WordPress), found this pass via Albanian-language search, and IS harvested above for store locations.",
    },
    {
      domain: "emonagroup.com",
      platform: "WordPress",
      productCount: 0,
      storeCount: 0,
      rejected: true,
      reason:
        "Emona Group (the company that bought Interex): 301 -> https://www.emonagroup.com/, HTTP 200. A corporate/brochure WordPress site -- no shop, no WooCommerce, and no branch list (the only coordinate in the page is the single head-office marker, 42.818018). Emona Center branches in kosovo-stores.json therefore come from OpenStreetMap.",
    },
    {
      domain: "kosovamarket.com / benaf-ks.com / aztech-ks.com / conad-ks.com / kammarket.com / kam-market.com / kippermarket.com",
      platform: null,
      productCount: 0,
      storeCount: 0,
      rejected: true,
      reason:
        "All probed this pass, all DNS/connect failures (no A record). These chains exist physically in Kosovo (they show up in OpenStreetMap and on Facebook) but publish no website at these domains. Their branches are therefore taken from OpenStreetMap instead of from a company site.",
    },
    {
      domain: "elkos-group.com",
      platform: null,
      productCount: 0,
      storeCount: 0,
      rejected: true,
      reason:
        "DNS NXDOMAIN, re-confirmed -- this exact domain does not exist. The real, live domain is elkosgroup.com (no hyphen, found on re-check): HTTP 200, but a static corporate PHP site with only a /contact.php page -- no shop, no wp-json (404), no store locator. Rejected for lack of any catalog, not for being unreachable.",
    },
    {
      domain: "emona.com",
      platform: "jAlbum static photo gallery",
      productCount: 0,
      storeCount: 0,
      rejected: true,
      reason:
        'Re-verified live: HTTP 200 but still a generated jAlbum photo-album site ("Emona Emona") with no relation to Kosovo grocery retail.',
    },
    {
      domain: "albimall.com",
      platform: "WordPress (Elementor)",
      productCount: 0,
      storeCount: 0,
      rejected: true,
      reason:
        "Re-verified live: Albi Mall, a physical fashion/lifestyle shopping-mall tenant directory (Bershka, Nike, Mango, etc.) -- not a grocery retailer. /products.json returns the theme's 404 page (not Shopify). Different business from Albi Market (albimarket.com, harvested above).",
    },
    {
      domain: "albicommerce.com",
      platform: "WordPress (Elementor + wp-job-openings)",
      productCount: 0,
      storeCount: 0,
      rejected: true,
      reason:
        "WordPress corporate/careers site for the Albi group (job listings, company info) -- no WooCommerce Store API, no product catalog. Not the same thing as albimarket.com (harvested above).",
    },
    {
      domain: "elkosgroup.com",
      platform: "static PHP site",
      productCount: 0,
      storeCount: 0,
      rejected: true,
      reason:
        "Found while re-checking elkos-group.com (which is NXDOMAIN). elkosgroup.com resolves (HTTP 200, title 'Elkos - Group') but is a static corporate site with a single contact page -- no shop, no wp-json, no store locator, no product data.",
    },
    {
      domain: "devollicorporation.com",
      platform: "WordPress corporate site",
      productCount: 0,
      storeCount: 0,
      rejected: true,
      reason:
        "Probed speculatively as a large Kosovo food/beverage manufacturer group. It's a manufacturer/franchise holding conglomerate corporate page (references e.g. a Prince Coffee Shop franchise) -- not a grocery retailer with its own product catalog or store locator.",
    },
    {
      domain: "interex.com / interexmall.com / interex-ks.eu / etc.al / etcmarket.com",
      platform: null,
      productCount: 0,
      storeCount: 0,
      rejected: true,
      reason:
        "Speculative domain variants tried after interex-ks.com and etc-ks.com came back unreachable/without an API. interex.com resolves (HTTP 200) but returned no identifying content tying it to the Kosovo 'Interex' chain (likely an unrelated business of the same name); the rest did not resolve. Not used. NOTE: the web search quota was exhausted before the brief's Albanian-language discovery searches (\"supermarket online Kosove\", \"blej online ushqime Kosove\", \"market online Prishtine\") could be run, so this list of variants is from direct probing/general knowledge, not search -- a follow-up run with search budget available may find more.",
    },
  ];
  report.domains.push(...rejects);
}

// ============================================================================
// The `sources` index written into kosovo-retail.json
// ============================================================================

/** Fallback platform/endpoint text for a domain the current run did not visit. */
const SOURCE_DESCRIPTIONS = {
  "wolt.com": {
    platform: "Wolt consumer assortment API (public, unauthenticated)",
    endpoint:
      "https://consumer-api.wolt.com/consumer-api/consumer-assortment/v1/venues/slug/<venue>/assortment[/categories/slug/<leaf>]",
  },
  "super-viva.com": {
    platform: "custom (Laravel-style JSON endpoint behind an Alpine.js grid)",
    endpoint: "https://super-viva.com/products?page=N[&category_id=ID]",
  },
  "etc-ks.com": {
    platform: "custom PHP storefront (Apache, no CMS REST API)",
    endpoint: "https://etc-ks.com/aktualiteti.php?on=<feed>",
  },
  "begmart.com": {
    platform: "WPGraphQL + WooCommerce Store API + WP REST over headless WordPress",
    endpoint: "https://management.begmart.com/graphql and /wp-json/{wc/store,wp/v2}",
  },
  "maxiks.shop": { platform: "custom PHP storefront (Maxi E-Shop)", endpoint: "https://maxiks.shop/<category-slug>" },
};

/** All wolt.com/<venue> sources roll up under one "wolt.com" entry. */
function sourceGroupOf(source) {
  const s = String(source || "");
  return s.startsWith("wolt.com/") ? "wolt.com" : s;
}

function buildSourcesIndex(products, report) {
  const counts = new Map();
  for (const p of products) {
    const g = sourceGroupOf(p.source);
    if (!g) continue;
    counts.set(g, (counts.get(g) || 0) + 1);
  }
  const fromReport = new Map();
  for (const d of report.domains || []) {
    if (d.rejected || !d.domain) continue;
    if (!fromReport.has(d.domain)) fromReport.set(d.domain, d);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([domain, count]) => {
      const d = fromReport.get(domain);
      const fallback = SOURCE_DESCRIPTIONS[domain] || {};
      return {
        domain,
        platform: d?.platform ?? fallback.platform ?? null,
        endpoint: d?.endpoint ?? fallback.endpoint ?? null,
        count,
      };
    });
}

// ============================================================================
// Image verification (sample check before writing)
// ============================================================================

async function verifyImageSample(products, label, sampleSize) {
  const withImages = products.filter((p) => p.image);
  const step = Math.max(1, Math.floor(withImages.length / sampleSize));
  const sample = [];
  for (let i = 0; i < withImages.length && sample.length < sampleSize; i += step) sample.push(withImages[i]);

  let okCount = 0;
  const failures = [];
  for (const p of sample) {
    const r = await headOrGetOk(p.image);
    if (r.ok) okCount++;
    else failures.push({ url: p.image, status: r.status, contentType: r.contentType });
    await sleep(300);
  }
  return {
    label,
    sampleSize: sample.length,
    ok: okCount,
    failed: sample.length - okCount,
    failures: failures.slice(0, 10),
  };
}

// ============================================================================
// main
// ============================================================================

// Smoke-test knobs. Neither changes what a normal run does:
//   VENDORJA_WOLT_VENUE_LIMIT=1   -- stop after N Wolt venues
//   VENDORJA_DRY_RUN=1            -- compute everything, write nothing
const WOLT_VENUE_LIMIT = Number(process.env.VENDORJA_WOLT_VENUE_LIMIT || 0) || Infinity;
const DRY_RUN = process.env.VENDORJA_DRY_RUN === "1";
// The Wolt sweep is by far the longest leg (~30 min for 30 venue assortments).
// Set this when re-running only for the store side; Wolt rows already in
// kosovo-retail.json are carried through untouched by the union logic.
const SKIP_WOLT = process.env.VENDORJA_SKIP_WOLT === "1";

async function main() {
  const report = { checkedAt: new Date().toISOString(), domains: [] };

  const existingRetail = loadExisting("kosovo-retail.json", { count: 0, products: [] });
  const existingStores = loadExisting("kosovo-stores.json", { count: 0, stores: [] });
  const floorProductCount = existingRetail.products?.length || 0;
  const floorStoreCount = existingStores.stores?.length || 0;
  console.log(`Existing baseline: ${floorProductCount} products, ${floorStoreCount} stores (never writing below this).`);

  // gjirafamall.com is NOT in this list and is NOT harvested any more: it is a
  // marketplace whose `brand` field held the seller, not the product's brand
  // (see scripts/prune-retail.mjs and recordRejects below). Should any row
  // survive in the file, it is dropped here rather than carried over.
  const HARVESTED_SOURCES = new Set(["super-viva.com", "etc-ks.com", "begmart.com", "maxiks.shop"]);
  const isWolt = (p) => String(p.source || "").startsWith("wolt.com/");
  const isDropped = (p) => /gjirafa/i.test(`${p.source || ""} ${p.sourceLabel || ""}`);
  const bySource = (d) => (existingRetail.products || []).filter((p) => p.source === d);
  const existingSvProducts = bySource("super-viva.com");
  const existingEtcProducts = bySource("etc-ks.com");
  const existingBegmartProducts = bySource("begmart.com");
  const existingMaxiProducts = bySource("maxiks.shop");
  const existingWoltProducts = (existingRetail.products || []).filter(isWolt);
  const existingOtherProducts = (existingRetail.products || []).filter(
    (p) => !HARVESTED_SOURCES.has(p.source) && !isWolt(p) && !isDropped(p)
  );

  console.log("Harvesting Super Viva (super-viva.com) -- all category filters...");
  const superViva = await harvestSuperViva(report, existingSvProducts);
  await sleep(DELAY_MS);

  let wolt = { products: existingWoltProducts };
  if (SKIP_WOLT) {
    console.log(`Skipping the Wolt sweep (VENDORJA_SKIP_WOLT=1); carrying ${existingWoltProducts.length} existing Wolt rows through.`);
  } else {
    console.log("Harvesting Kosovo grocery shops on Wolt (consumer assortment API)...");
    wolt = await harvestWolt(report, existingWoltProducts);
    await sleep(DELAY_MS);
  }

  console.log("Harvesting Viva Fresh Store locations (vivafresh-rks.com)...");
  const vivaFresh = await harvestVivaFreshStores(report);
  await sleep(DELAY_MS);

  console.log("Harvesting SPAR Kosova locations (spar-kosova.com)...");
  const spar = await harvestOsmMapStores({
    domain: "spar-kosova.com",
    path: "/spar-kosova-lokacionet/",
    chain: "SPAR Kosova",
    report,
    phoneAndHoursFromDescription: true,
  });
  await sleep(DELAY_MS);

  console.log("Harvesting Albi Market locations (albimarket.com)...");
  const albiMarket = await harvestOsmMapStores({
    domain: "albimarket.com",
    path: "/lokacionet/",
    chain: "Albi Market",
    report,
    phoneAndHoursFromDescription: false,
  });
  await sleep(DELAY_MS);

  console.log("Harvesting ETC weekly-offer catalogue (etc-ks.com)...");
  const etc = await harvestEtc(report, existingEtcProducts);
  await sleep(DELAY_MS);

  console.log("Harvesting Begmart catalogue (management.begmart.com/graphql)...");
  const begmart = await harvestBegmart(report, existingBegmartProducts);
  await sleep(DELAY_MS);

  console.log("Harvesting Meridian Express locations (meridianexpress.com)...");
  const meridian = await harvestMeridianStores(report);
  await sleep(DELAY_MS);

  console.log("Harvesting Interex locations (interex-rks.com)...");
  const interex = await harvestInterexStores(report);
  await sleep(DELAY_MS);

  console.log("Harvesting Maxi Supermarket locations (maxiks.com)...");
  const maxi = await harvestMaxiStores(report);
  await sleep(DELAY_MS);

  console.log("Harvesting Maxi E-Shop catalogue (maxiks.shop)...");
  const maxiShop = await harvestMaxiShop(report, existingMaxiProducts);
  await sleep(DELAY_MS);

  console.log("Harvesting the remaining chains' official branch lists...");
  const extraChains = await harvestExtraChainStores(report);
  await sleep(DELAY_MS);

  console.log("Harvesting Wolt grocery venue locations (coordinates per shop)...");
  const woltStores = await harvestWoltVenueStores(report);
  await sleep(DELAY_MS);

  // Only a chain that ACTUALLY returned branches from its own site this run
  // may suppress its OpenStreetMap rows -- see OSM_SKIPPABLE_CHAINS.
  const chainsWithOfficialListThisRun = new Set(
    [
      ...superViva.stores,
      ...vivaFresh.stores,
      ...spar.stores,
      ...albiMarket.stores,
      ...meridian.stores,
      ...interex.stores,
      ...maxi.stores,
      ...extraChains.stores,
      // NOT woltStores: a Wolt venue list is a DELIVERY listing, not the
      // chain's own branch list. Treating it as authoritative would let three
      // SPAR shops on Wolt delete the ten SPAR branches OpenStreetMap knows
      // about. Wolt rows are merged in as extra branches; they never
      // supersede anything.
    ].map((s) => s.chain)
  );

  console.log("Harvesting every named shop in Kosovo from OpenStreetMap (Overpass API)...");
  const osm = await harvestOsmKosovoShops(report, chainsWithOfficialListThisRun);

  recordRejects(report);

  // --- assemble products ---
  let products = [
    ...existingOtherProducts,
    ...superViva.products,
    ...etc.products,
    ...begmart.products,
    ...maxiShop.products,
    ...wolt.products,
  ];

  // --- barcode integrity sweep -------------------------------------------
  // Rows carried over from earlier runs were written before the GS1 check
  // digit was enforced (see hasValidGs1CheckDigit). Any "barcode" that fails
  // its own check digit is an in-house shelf code, not a GS1 number: null it,
  // and withdraw the country verdict that was derived from it. A verdict that
  // came from something OTHER than a barcode (e.g. Begmart's own "Origjina"
  // field) is left alone -- only barcode-derived ones are withdrawn.
  let barcodesWithdrawn = 0;
  const withdrawnExamples = [];
  products = products.map((p) => {
    const raw = p.barcode == null ? null : String(p.barcode).trim();
    const looksNumeric = raw && /^\d{8}$|^\d{12,14}$/.test(raw);
    if (!looksNumeric || hasValidGs1CheckDigit(raw)) return p;
    barcodesWithdrawn++;
    if (withdrawnExamples.length < 20) {
      withdrawnExamples.push({ source: p.source, name: p.name, rejectedCode: raw, hadVerdict: p.isLocalBrand });
    }
    const fromBarcode = /GS1 barcode prefix/.test(p.localEvidence || "");
    return {
      ...p,
      barcode: null,
      isLocalBrand: fromBarcode ? null : p.isLocalBrand,
      localEvidence: fromBarcode ? null : p.localEvidence,
    };
  });
  report.barcodeIntegrity = {
    rule:
      "a numeric-looking barcode that fails the GS1 mod-10 check digit is NOT a barcode -- it is an in-house shelf code. It is set to null and any country verdict derived from its prefix is withdrawn. Nothing is repaired or recomputed: a wrong barcode produces a confidently wrong verdict, which is worse than no barcode.",
    codesRejected: barcodesWithdrawn,
    examples: withdrawnExamples,
  };
  if (barcodesWithdrawn) console.log(`Barcode integrity: rejected ${barcodesWithdrawn} code(s) that fail the GS1 check digit.`);

  // matchKey on every row
  products = products.map((p) => ({ ...p, matchKey: computeMatchKey(p.name, p.barcode) }));

  // De-duplicate at the DATA level (owner: "REMOVE DUPES").
  const beforeDedupe = products.length;
  products = dedupeProducts(products, report);
  console.log(
    `De-duplicated products: ${beforeDedupe} -> ${products.length} (${report.deduplication.removed} duplicate rows removed).`
  );

  // The shrink guard exists so a failed crawl can never silently empty the
  // file. Deliberate removals -- de-duplication, and the GjirafaMall drop the
  // owner ordered -- are subtracted from the floor, exactly as the store side
  // already does for its own de-duplication.
  const deliberatelyRemoved =
    report.deduplication.removed + (existingRetail.products || []).filter(isDropped).length;
  const floorAdjusted = Math.max(0, floorProductCount - deliberatelyRemoved);
  if (products.length < floorAdjusted) {
    console.error(
      `REFUSING TO SHRINK products: computed ${products.length} < existing ${floorAdjusted} (after allowing for ${deliberatelyRemoved} deliberately removed rows). Keeping existing file for products.`
    );
    products = existingRetail.products.map((p) => ({ ...p, matchKey: p.matchKey || computeMatchKey(p.name, p.barcode) }));
  }

  const priceComparisons = buildPriceComparisons(products);

  // --- verify a sample of image URLs before writing ---
  console.log("Verifying a sample of image URLs (HTTP 200 + image content-type)...");
  report.imageVerification = [];
  for (const [label, filter, n] of [
    ["super-viva.com", (p) => p.source === "super-viva.com", 12],
    ["etc-ks.com", (p) => p.source === "etc-ks.com", 10],
    ["begmart.com", (p) => p.source === "begmart.com", 10],
    ["maxiks.shop", (p) => p.source === "maxiks.shop", 10],
    ["wolt.com (all venues)", (p) => String(p.source || "").startsWith("wolt.com/"), 15],
  ]) {
    const pool = products.filter(filter);
    if (!pool.length) continue;
    report.imageVerification.push(await verifyImageSample(pool, label, n));
  }
  console.log("Image verification:", JSON.stringify(report.imageVerification));

  const productsOut = {
    builtAt: new Date().toISOString(),
    count: products.length,
    // Built from the ROWS THAT ARE ACTUALLY IN THE FILE, not from this run's
    // report: with VENDORJA_SKIP_WOLT=1 the Wolt harvester does not run, and
    // deriving this list from the report would then omit wolt.com entirely
    // even though most of the catalogue came from it. Counts are post-
    // de-duplication, so they add up to `count` above.
    sources: buildSourcesIndex(products, report),
    products,
    priceComparisons,
  };
  if (!DRY_RUN) writeFileSync(join(DATA_DIR, "kosovo-retail.json"), JSON.stringify(productsOut, null, 2));
  console.log(`Wrote kosovo-retail.json: ${products.length} products, ${priceComparisons.length} cross-store price comparisons.`);

  // --- assemble stores ---
  // Chain-official branch lists FIRST (they are authoritative and carry the
  // chain's own naming/hours/phone), then OpenStreetMap, so an OSM row can
  // only ever fill in a null on an official row -- never overwrite one.
  const chainOfficialStores = [
    ...superViva.stores,
    ...vivaFresh.stores,
    ...spar.stores,
    ...albiMarket.stores,
    ...meridian.stores,
    ...interex.stores,
    ...maxi.stores,
    ...extraChains.stores,
    ...woltStores.stores,
  ];
  const beforeByChain = countByChain(existingStores.stores || []);

  // Canonicalise chain labels BEFORE merging, on BOTH sides.
  //
  // This ordering is not cosmetic, it is a correctness fix. mergeStores only
  // compares two rows when their chain labels match, so if canonicalisation
  // ran afterwards a row whose label this pass nulls ("Market", "Shitore",
  // ".") could never be matched against the same shop coming back from
  // OpenStreetMap under its original label -- every re-run appended a fresh
  // copy. Measured before the fix: 78 of 118 null-chain rows were exact
  // coordinate duplicates of another null-chain row, growing by ~39 per run.
  const canonExisting = canonicalizeStoreChains(existingStores.stores || []);
  const canonOfficial = canonicalizeStoreChains(chainOfficialStores);
  const canonOsm = canonicalizeStoreChains(osm.stores);

  const step1 = mergeStores(canonExisting.stores, canonOfficial.stores);
  const step2 = mergeStores(step1.stores, canonOsm.stores);

  // A chain's own list wins over OSM fallback rows carried over from an
  // earlier run where that chain's site was down (see the function's comment).
  //
  // WIDENED 2026-09-12: "this run" was too narrow. vivafresh-rks.com is no
  // longer crawled at all (its robots.txt now names ClaudeBot and says no),
  // so Viva Fresh stopped qualifying and its 70 OpenStreetMap fallback rows
  // came back alongside the 111 official rows already on file -- 181 rows for
  // a 111-branch chain. What actually matters is whether the FILE holds that
  // chain's own branch list, not whether it was re-fetched today. Wolt rows
  // are excluded from counting as "official": a delivery listing is not a
  // chain's branch list, and three SPAR shops on Wolt must never delete the
  // ten SPAR branches OpenStreetMap knows about.
  const chainsWithOfficialList = new Set(chainsWithOfficialListThisRun);
  for (const s of step2.stores) {
    const src = s.sourceUrl || "";
    if (!s.chain) continue;
    if (OSM_SOURCE_RE.test(src)) continue;
    if (/^https?:\/\/(www\.)?wolt\.com\//.test(src)) continue;
    chainsWithOfficialList.add(s.chain);
  }
  const reconciled = reconcileOsmAgainstOfficialLists(step2.stores, chainsWithOfficialList);

  // De-duplicate on (chain, city, address) as briefed, then sweep up rows
  // that are the same shop at the same point under a different chain label --
  // the residue left behind by earlier runs, before canonicalisation moved to
  // the front of this pipeline.
  const canon = { renames: {}, chainLabelsDroppedAsMeaningless: 0 };
  for (const c of [canonExisting, canonOfficial, canonOsm]) {
    for (const [k, v] of Object.entries(c.renames)) canon.renames[k] = (canon.renames[k] || 0) + v;
    canon.chainLabelsDroppedAsMeaningless += c.chainLabelsDroppedAsMeaningless;
  }
  const storeDedupe = dedupeStoresByAddress(reconciled.stores);
  const coordDedupe = dedupeStoresByPoint(storeDedupe.stores);

  let finalStores = coordDedupe.stores;
  const storesAdded = step1.added + step2.added;
  const deliberatelyRemovedStores = reconciled.removed + storeDedupe.removed + coordDedupe.removed;
  const duplicatesMerged =
    step1.mergedDuplicates + step2.mergedDuplicates + deliberatelyRemovedStores;
  // Deliberate de-duplication is allowed to reduce the count; nothing else is.
  const floorStoreCountAdjusted = Math.max(0, floorStoreCount - deliberatelyRemovedStores);
  if (finalStores.length < floorStoreCountAdjusted) {
    console.error(`REFUSING TO SHRINK stores: computed ${finalStores.length} < existing ${floorStoreCountAdjusted} (after allowing for ${deliberatelyRemovedStores} deliberately de-duplicated rows). Keeping existing file for stores.`);
    finalStores = existingStores.stores;
  }

  const afterByChain = countByChain(finalStores);
  report.storeChains = {
    // The state this pass started from, recorded once so the file stays
    // self-describing even after the harvester is re-run (a re-run's
    // `previousRun` is only the run before it, not the original baseline).
    baselineBefore20260912Pass: {
      totalStores: 188,
      chains: {
        "Viva Fresh Store": 111,
        "Albi Market": 37,
        "Super Viva": 26,
        "SPAR Kosova": 10,
        "Albi Market Hipermarket": 4,
      },
    },
    previousRun: beforeByChain,
    before: beforeByChain,
    after: afterByChain,
    chainsBefore: Object.keys(beforeByChain).length,
    chainsAfter: Object.keys(afterByChain).length,
    addedThisRun: storesAdded,
    duplicateBranchesMerged: duplicatesMerged,
    duplicateRule: `same chain AND ((city+address match) OR (coordinates within ${SAME_BRANCH_METRES} m) OR (same branch name and at least one row has no coordinates))`,
    osmRowsSupersededByAnOfficialList: reconciled.removed,
    osmRowsSupersededByChain: reconciled.byChain,
    coordinatesTransplantedFromOsmOntoOfficialRows: reconciled.coordsTransplanted,
    osmSupersedeRule:
      "a chain's own website is authoritative for its own branches; OSM rows for such a chain are a fallback used only when that site is unreachable, and are folded in (coordinates first, matched on chain+city+street name) and removed once the official list is back",
    canonicalNameMerges: canon.renames,
    chainLabelsDroppedAsMeaningless: canon.chainLabelsDroppedAsMeaningless,
    chainLabelRule:
      'only provable variants of the SAME chain are merged (an explicit alias table plus case/spacing equality); two different shops that merely share a common Albanian word are never merged. A meaningless label (".", "Market", "minimarket", "23") is set to null and the branch is kept -- the shop is real, the label was not.',
    duplicatesRemovedByChainCityAddress: storeDedupe.removed,
    duplicatesRemovedBySameNameWithin25m: coordDedupe.removed,
    canonicalisationRunsBeforeMerging:
      "yes -- chain labels are canonicalised on the existing file, the chain-official lists and the OpenStreetMap rows BEFORE they are merged. Doing it afterwards meant a row whose label was nulled could never be matched against the same shop arriving again under its original label, so every re-run appended a duplicate.",
  };

  const storesOut = {
    builtAt: new Date().toISOString(),
    count: finalStores.length,
    attribution:
      "Chain branch lists come from each chain's own website (see each store's sourceUrl). Rows whose sourceUrl is openstreetmap.org are (c) OpenStreetMap contributors, licensed under the Open Database Licence (ODbL) -- https://www.openstreetmap.org/copyright",
    stores: finalStores,
  };
  if (!DRY_RUN) writeFileSync(join(DATA_DIR, "kosovo-stores.json"), JSON.stringify(storesOut, null, 2));
  console.log(
    `Wrote kosovo-stores.json: ${finalStores.length} stores across ${Object.keys(afterByChain).length} chains ` +
      `(${storesAdded} newly added, ${duplicatesMerged} duplicate branches merged this run).`
  );

  // --- report ---
  const classifiable = products.filter((p) => p.isLocalBrand !== null).length;
  const localCount = products.filter((p) => p.isLocalBrand === true).length;
  const withCoords = finalStores.filter((s) => s.lat != null && s.lng != null).length;
  const withBrand = products.filter((p) => p.brand).length;
  const byBrandSource = { field: 0, "derived-from-title": 0, none: 0 };
  for (const p of products) {
    if (p.brandSource === "field") byBrandSource.field++;
    else if (p.brandSource === "derived-from-title") byBrandSource["derived-from-title"]++;
    else byBrandSource.none++;
  }

  const productsBySource = {};
  for (const p of products) productsBySource[p.source] = (productsBySource[p.source] || 0) + 1;

  report.attribution =
    "Store rows whose sourceUrl points at openstreetmap.org are (c) OpenStreetMap contributors, ODbL 1.0 (https://www.openstreetmap.org/copyright). Everything else was read from the named company website.";

  report.discovery = {
    note:
      "The 2026-09-11 pass recorded that its web search budget ran out BEFORE the Albanian-language discovery searches, and flagged that avenue as 'untried, not exhausted'. This pass started there.",
    albanianLanguageSearches: [
      "supermarket online Kosovë blej online ushqime dyqan",
      '"market online" Prishtinë porosit ushqime online dërgesa në shtëpi Kosovë',
      "Begmart.com Maxi ks shop supermarket online Kosovë produkte vendore",
      '"Interex" OR "Meridian Express" OR "Ben-Af" OR "Emona" supermarket Kosovë faqja zyrtare online',
      "KAM Market Kosovë website \"Kipper Market\" OR \"CONAD Kosova\" OR \"Emona\" supermarket lokacionet",
      '"pikat shitëse" OR "lokacionet" OR "marketet tona" supermarket Kosovë ETC Elkos degët adresa',
    ],
    newDomainsFoundBySearchThatDirectProbingHadMissed: [
      "begmart.com -- a real Kosovo online grocery with a public GraphQL catalogue (harvested)",
      "e-baa.com -- ETC's own online shop (robots.txt disallows ClaudeBot; recorded, not crawled)",
      "interex-rks.com -- Interex's actual live domain (the brief's interex-ks.com is dead)",
      "maxiks.com / maxiks.shop -- Maxi Supermarket (corporate site harvested for branches; e-shop is behind a Cloudflare challenge)",
      "tregushqip.com -- Kosovo/Albania marketplace (robots.txt disallows ClaudeBot)",
      "shop.spar.al -- SPAR Albania, a working WooCommerce Store API (out of Kosovo scope)",
      "en.wikipedia.org/wiki/List_of_supermarket_chains_in_Kosovo -- the chain list that turned up CONAD Kosova, KAM Market, Kipper Market, QTA, Eli-Ab, Rina Market, My Market etc.",
    ],
  };

  // The one thing this harvester cannot do for itself: src/ is the owner's.
  // src/lib/stores.js maps a product's `source` to the store chains whose
  // branches the "where to buy" panel shows. Every new source below needs one
  // line there or its products will show no branches at all.
  report.srcChangeNeeded = {
    file: "src/lib/stores.js",
    why:
      "CHAIN_GROUPS maps product.source -> store chain names. The sources added this pass are not in it yet, so their products currently resolve to no branches. This harvester does not touch src/.",
    suggestedAdditions: Object.fromEntries(
      [...new Set(products.map((p) => p.source).filter((s) => String(s).startsWith("wolt.com/")))]
        .sort()
        .map((src) => {
          const sample = products.find((p) => p.source === src);
          const chain = String(sample?.sourceLabel || "").replace(/\s*\(Wolt\)\s*$/, "");
          return [src, chain ? [chain] : []];
        })
        .concat([["maxiks.shop", ["Maxi Supermarket", "Maxi", "MAX Market"]]])
    ),
  };

  report.localCatalogsJson = {
    changed: false,
    why:
      "data/local-catalogs.json was deliberately left untouched. src/lib/brandAlternatives.js turns every `usable[].storeName` in that file into a curated LOCAL BRAND. Every storefront found this pass (ETC, Begmart, Maxi, Interex, Meridian, SPAR Albania) is a RETAILER, not a Kosovar/Albanian brand -- adding any of them there would have made the app recommend a shop's name as a 'local brand', i.e. exactly the Milka/Barilla class of bug this project already had to fix once.",
  };

  report.summary = {
    totalProducts: products.length,
    productsBySource,
    productsWithBrand: withBrand,
    productsMissingBrand: products.length - withBrand,
    brandBySource: byBrandSource,
    productsWithLocalImportedEvidence: classifiable,
    productsConfidentlyLocal: localCount,
    totalStores: finalStores.length,
    totalStoreChains: Object.keys(afterByChain).length,
    storesWithCoordinates: withCoords,
    storesWithoutCoordinates: finalStores.length - withCoords,
    crossStorePriceComparisons: priceComparisons.length,
  };
  if (!DRY_RUN) writeFileSync(join(DATA_DIR, "kosovo-retail-report.json"), JSON.stringify(report, null, 2));

  console.log("\n=== DONE ===");
  console.log(JSON.stringify(report.summary, null, 2));
}

main().catch((err) => {
  console.error("harvest-retail.mjs fatal error:", err);
  process.exit(1);
});
