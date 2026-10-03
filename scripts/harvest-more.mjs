#!/usr/bin/env node
/**
 * harvest-more.mjs  --  market data, 2026-09-14
 *
 * Goal: more data from more stores and more places, not just one, with the
 * full name and grams on every product.
 *
 * A SECOND harvester that runs alongside scripts/harvest-retail.mjs. It does
 * not replace it and does not touch any of its code paths; it reads the same
 * data/kosovo-retail.json, merges additively, and writes it back. Re-runnable.
 *
 * Writes ONLY:
 *   data/kosovo-retail.json        (products, merged additively -- never shrinks)
 *   data/kosovo-retail-report.json (adds a `harvestMore` section; nothing else
 *                                   in that file is touched)
 *
 * ---------------------------------------------------------------------------
 * WHAT IT ADDS, AND WHY
 * ---------------------------------------------------------------------------
 *
 * 1. WOLT KOSOVO, SWEPT PROPERLY (was 4 cities, now 28).
 *    harvest-retail.mjs discovers Wolt grocery venues from four coordinate
 *    pairs -- Prishtina, Ferizaj, Gjilan, Prizren. Every one of Kosovo's 38
 *    municipalities was re-probed for this pass. Twenty-four of them return
 *    no grocery venue at all (Wolt does not operate there), but Fushë Kosovë
 *    does, and the four cities that were already covered return venues the
 *    old four-point sweep had not reached. 45 distinct grocery venues are now
 *    discovered where the previous pass found 35.
 *
 * 2. WOLT ALBANIA -- A WHOLE COUNTRY THAT WAS NEVER ASKED.
 *    The brief names "Kosovo/Albania grocery retailers". The same public,
 *    unauthenticated Wolt assortment API serves Albania, where it carries the
 *    shelf lists of Conad Albania, SPAR Albania, Big Market and ~60 other
 *    shops across Tirana, Durrës, Vlorë, Shkodër, Elbasan, Fier and Sarandë.
 *    Measured on live samples before committing to it: Conad Tirana publishes
 *    a real EAN on 379 of 390 items (97%), Bao Bao on 111 of 145 (77%).
 *    That matters twice over for this app: barcodes are what let it judge
 *    origin at all, and an Albanian shelf is where GS1-prefix-530 (Albanian)
 *    products actually live -- the alternatives the app exists to recommend.
 *
 *    Albanian rows are marked, not hidden: `country: "AL"`, a source of
 *    `wolt.com/al/<venue>` and a sourceLabel that names the city. Kosovo rows
 *    get `country: "XK"`. See report.harvestMore.srcChangeNeeded -- the app's
 *    loader (src/lib/dataLoader.js normalizeRetailProduct) whitelists fields,
 *    so it currently DROPS `country` and `quantity`; that is a src change for
 *    a later pass, not something this script makes.
 *
 * 3. CONAD ALBANIA'S OWN SITE (www.conadalbania.al).
 *    WordPress REST, `/wp-json/wp/v2/product`, 217 products, robots.txt
 *    disallows only /wp-admin/. It publishes a product NAME and a product
 *    PHOTO and nothing else -- no price, no GTIN, no category taxonomy (the
 *    `product` post type declares `taxonomies: []`). Those rows are written
 *    with price null rather than a guessed price.
 *
 * 4. `quantity` ON EVERY ROW THAT HAS ONE -- the owner's "gram everything".
 *    Two honest sources, in this order:
 *      a. Wolt's own `unit_info` field, when it carries a mass/volume ("170 g").
 *         `unit_info: "1 pc"` is a piece count, not a weight, and is not used
 *         as a weight -- measured live, big-market-garden files "Buke
 *         Integrale 400Gr" as "1 pc".
 *      b. The pack size written in the product's own NAME ("DJATH DELE KORAB
 *         800 G" -> "800 g"). This is derivation from source text, the same
 *         thing `brandSource: "derived-from-title"` already does, and it is
 *         labelled as such on every row: `quantitySource`.
 *    Nothing is inferred from a category, a price-per-kilo, or a photo. A
 *    product whose name carries no size gets `quantity: null`.
 *
 * ---------------------------------------------------------------------------
 * HARD RULES THIS SCRIPT KEEPS (same as harvest-retail.mjs)
 * ---------------------------------------------------------------------------
 *  - robots.txt is fetched and honoured for every domain, every run. A domain
 *    that disallows is recorded in the report and not crawled.
 *  - Identifying User-Agent, a delay between every request, no bot-protection
 *    bypass of any kind.
 *  - NOTHING IS INVENTED. Every field comes from bytes a site returned.
 *    `barcode` is written only when the value passes the GS1 mod-10 check
 *    digit; `isLocalBrand` stays null unless a valid barcode prefix says
 *    otherwise. Missing is better than guessed.
 *  - NEVER SHRINK: existing rows are merged by id and kept.
 *
 * Usage:
 *   node scripts/harvest-more.mjs                   # everything
 *   VENDORJA_ONLY=quantity node scripts/harvest-more.mjs
 *   VENDORJA_ONLY=wolt-xk,wolt-al,conad-al,quantity node scripts/harvest-more.mjs
 *   VENDORJA_DRY_RUN=1 node scripts/harvest-more.mjs # compute, write nothing
 *   VENDORJA_VENUE_LIMIT=3 node scripts/harvest-more.mjs
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
mkdirSync(DATA_DIR, { recursive: true });

const UA = "Mozilla/5.0 (compatible; VendorjaBot/1.0; +https://github.com/vendorja) Node/harvest-more.mjs";
const REQUEST_DELAY_MS = 300; // polite: ~3 req/s to one host, single-threaded
const DOMAIN_DELAY_MS = 1500;
const FETCH_TIMEOUT_MS = 25000;

const DRY_RUN = process.env.VENDORJA_DRY_RUN === "1";
const VENUE_LIMIT = process.env.VENDORJA_VENUE_LIMIT ? Number(process.env.VENDORJA_VENUE_LIMIT) : Infinity;
const ONLY = (process.env.VENDORJA_ONLY || "").split(",").map((s) => s.trim()).filter(Boolean);
const wants = (task) => ONLY.length === 0 || ONLY.includes(task);
// Flush the merged catalogue to disk every N venues so a long sweep that is
// interrupted still leaves every venue it did finish on file.
const FLUSH_EVERY_VENUES = 10;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Atomic write: other processes read data/kosovo-retail.json while this script
 * runs, and this script checkpoints mid-sweep. Writing to a temp file in the
 * same directory and renaming makes a reader see either the whole old file or
 * the whole new one, never a half-written one.
 */
function writeJsonAtomic(filePath, value) {
  const tmp = `${filePath}.tmp-${process.pid}`;
  writeFileSync(tmp, JSON.stringify(value, null, 2));
  renameSync(tmp, filePath);
}

// ============================================================================
// Shared primitives.
//
// These are deliberate COPIES of the equivalents in harvest-retail.mjs rather
// than an import: that file is a 4,000-line script with a top-level main()
// that runs on import and exports nothing, and refactoring it to export would
// risk a harvester other work depends on. The copies are pure functions with
// no state, and they must stay behaviourally identical -- in particular
// `normalizeForMatch` and `computeMatchKey`, because the two scripts
// de-duplicate the same file.
// ============================================================================

function hasValidGs1CheckDigit(digits) {
  const d = String(digits).split("").reverse().map(Number);
  if (d.some((n) => Number.isNaN(n))) return false;
  let sum = 0;
  for (let i = 1; i < d.length; i++) sum += d[i] * (i % 2 === 1 ? 3 : 1);
  return (10 - (sum % 10)) % 10 === d[0];
}

function isValidGs1(rawBarcode) {
  if (!rawBarcode) return false;
  const digits = String(rawBarcode).trim();
  if (!/^\d{8}$|^\d{12,14}$/.test(digits)) return false;
  return hasValidGs1CheckDigit(digits);
}

function classifyByBarcode(rawBarcode) {
  if (!isValidGs1(rawBarcode)) return { isLocalBrand: null, localEvidence: null };
  const digits = String(rawBarcode).trim();
  const prefix3 = digits.slice(0, 3);
  if (prefix3 === "381" || prefix3 === "390") {
    return { isLocalBrand: true, localEvidence: `GS1 barcode prefix ${prefix3} (Kosovo) on barcode ${digits}` };
  }
  if (prefix3 === "530") {
    return { isLocalBrand: true, localEvidence: `GS1 barcode prefix 530 (Albania) on barcode ${digits}` };
  }
  return {
    isLocalBrand: false,
    localEvidence: `GS1 barcode prefix ${prefix3} on barcode ${digits} does not match Kosovo (381/390) or Albania (530) -- imported`,
  };
}

function normalizeForMatch(name) {
  let s = (name || "").toLowerCase();
  s = s.replace(/\(\s*\d+\s*\)/g, " ");
  s = s.replace(/plu[.\s]?\d+/gi, " ");
  s = s.replace(/kod\d+/gi, " ");
  s = s.replace(/(\d),(\d)/g, "$1.$2");
  s = s.replace(/(\d)\s+(kg|gr|g|ml|l|cm)\b/gi, "$1$2");
  s = s.replace(/\bgr\b/gi, "g");
  s = s.replace(/[^\p{L}\p{N}.\s]/gu, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function slugify(s) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function computeMatchKey(name, barcode) {
  if (isValidGs1(barcode)) return `gtin:${barcode}`;
  return `name:${slugify(normalizeForMatch(name))}`;
}

// Brand derivation from the title -- same conservative dictionary rule as
// harvest-retail.mjs: whole-token match only, exactly one match or null.
const TOKEN_BRANDS = {
  AHMAD: "Ahmad Tea", NIVEA: "Nivea", FAIRY: "Fairy", NESTLE: "Nestlé", SELPAK: "Selpak",
  PERSIL: "Persil", LENOR: "Lenor", MAGGI: "Maggi", MONINI: "Monini", DIVELLA: "Divella",
  SCOTTI: "Scotti", IMLEK: "Imlek", BIMILK: "Bimilk", NIVA: "Niva", ARGETA: "Argeta",
  KOESTLIN: "Koestlin", ULKER: "Ülker", PFANNER: "Pfanner", CERTO: "Certo", MERIX: "Merix",
  WATEX: "Watex", PALOMA: "Paloma", BRAVO: "Bravo", JAFFA: "Jaffa", ZITO: "Zito",
  CEDROB: "Cedrob", COOP: "Coop", STOBI: "Stobi", ELSEVE: "L'Oréal Elseve", LOREAL: "L'Oréal",
  MILAN: "Milan", KORAL: "Koral", OREX: "Orex", LEONI: "Leoni", COOPAVEL: "Coopavel",
  BAVARIA: "Bavaria", ORNEL: "Ornel", GALLA: "Galla", PEJA: "Peja", ELKOS: "Elkos",
  DELI: "Deli", "PEARL&BEAUTY": "Pearl & Beauty", ZVIJEZDA: "Zvijezda", SEBAMED: "Sebamed",
};

const PHRASE_BRANDS = [
  [/\bCOCA\s*COLA\b/, "Coca-Cola"],
  [/\bMAR-MAR\b/, "Mar-Mar"],
  [/\bLA\s+RIVE\b/, "La Rive"],
];

function cleanTokens(upperName) {
  let s = upperName;
  s = s.replace(/\(\s*\d+\s*\)/g, " ");
  s = s.replace(/PLU[.\s]?\d+/g, " ");
  s = s.replace(/KOD\d+/g, " ");
  s = s.replace(/\d+[.,]?\d*\s?(KG|GR|G|ML|L|CM)\b/g, " ");
  s = s.replace(/\/KG|\/COPE|\/CAK/g, " ");
  s = s.replace(/[^A-ZÇËÜ&\s]/g, " ");
  return s.split(/\s+/).filter((t) => t.length >= 3);
}

function deriveBrandFromTitle(name) {
  if (!name) return { brand: null, brandSource: null };
  const upper = name.toUpperCase();
  const matches = new Set();
  for (const [re, brand] of PHRASE_BRANDS) if (re.test(upper)) matches.add(brand);
  for (const tok of cleanTokens(upper)) if (TOKEN_BRANDS[tok]) matches.add(TOKEN_BRANDS[tok]);
  if (matches.size === 1) return { brand: [...matches][0], brandSource: "derived-from-title" };
  return { brand: null, brandSource: null };
}

function decodeHtmlEntities(s) {
  if (!s) return s;
  return String(s)
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .trim();
}

// ============================================================================
// Quantity ("gram everything") -- see the header for the honesty rules.
// ============================================================================

const UNIT_ALT = "(?:kgs?|kg|grams?|gr|g|mg|mls?|ml|cl|litra|liter|ltr|lt|l)";

// "3x65gr", "4 x 62,5 g", "20*1,5g"
const RE_MULTI = new RegExp(
  String.raw`(?<![\d.,])(\d{1,3})\s*[xX×*]\s*(\d+(?:[.,]\d+)?)\s*(` + UNIT_ALT + String.raw`)(?![a-zA-Z])`,
  "i"
);
// "1.5LX6", "0,33L x 24" -- the same pack written the other way round
const RE_MULTI_REV = new RegExp(
  String.raw`(?<![\d.,])(\d+(?:[.,]\d+)?)\s*(` + UNIT_ALT + String.raw`)\s*[xX×*/]\s*(\d{1,3})(?![\d.,])`,
  "i"
);
// "500g", "1.5 L", "400 ML", "2,5kg"
const RE_SINGLE = new RegExp(
  String.raw`(?<![\d.,\-/])(\d+(?:[.,]\d+)?)\s*(` + UNIT_ALT + String.raw`)(?![a-zA-ZçëÇË])`,
  "i"
);
// Piece counts the shelves actually use: "94 COPE" (Albanian for pieces),
// "50PCS", "100 LARJE" (washes) is a dose count and is deliberately NOT read
// as a quantity.
const RE_PIECES = /(?<![\d.,])(\d{1,4})\s*(cope|copë|cop|pcs|pc|ks)\b/i;

function normUnit(raw) {
  const u = String(raw).toLowerCase();
  if (u === "kg" || u === "kgs") return "kg";
  if (u === "mg") return "mg";
  if (u === "g" || u === "gr" || u.startsWith("gram")) return "g";
  if (u === "ml" || u === "mls") return "ml";
  if (u === "cl") return "cl";
  if (u === "l" || u === "lt" || u === "ltr" || u === "litra" || u === "liter") return "L";
  return null;
}

const toNum = (s) => {
  const v = parseFloat(String(s).replace(",", "."));
  return Number.isFinite(v) ? v : null;
};
const fmtNum = (v) => String(Math.round(v * 1000) / 1000);

/**
 * The pack size written in a product's own name. Returns a display string
 * ("500 g", "3 x 65 g", "94 copë") or null. Never guesses: a name with no
 * size in it returns null.
 */
function parseQuantityFromName(name) {
  if (!name) return null;
  const s = String(name);

  let m = s.match(RE_MULTI);
  if (m) {
    const u = normUnit(m[3]);
    const q = toNum(m[2]);
    const n = parseInt(m[1], 10);
    if (u && q != null && q > 0 && n > 0 && n <= 200) return `${n} x ${fmtNum(q)} ${u}`;
  }

  m = s.match(RE_MULTI_REV);
  if (m) {
    const u = normUnit(m[2]);
    const q = toNum(m[1]);
    const n = parseInt(m[3], 10);
    if (u && q != null && q > 0 && n > 1 && n <= 200) return `${n} x ${fmtNum(q)} ${u}`;
  }

  m = s.match(RE_SINGLE);
  if (m) {
    const u = normUnit(m[2]);
    const q = toNum(m[1]);
    if (u && q != null && q > 0 && q < 100000) return `${fmtNum(q)} ${u}`;
  }

  m = s.match(RE_PIECES);
  if (m) {
    const n = parseInt(m[1], 10);
    if (n > 0 && n <= 5000) return `${n} copë`;
  }
  return null;
}

/**
 * Wolt's own `unit_info`, but only when it states a MASS or VOLUME.
 * "1 pc" / "4 pcs" is a piece count the platform fills in for anything
 * unweighed, and it contradicts the name often enough ("Buke Integrale
 * 400Gr" filed as "1 pc") that it must not be treated as a weight.
 */
function quantityFromUnitInfo(unitInfo) {
  if (!unitInfo || typeof unitInfo !== "string") return null;
  const m = unitInfo.trim().match(new RegExp(String.raw`^(\d+(?:[.,]\d+)?)\s*(` + UNIT_ALT + String.raw`)$`, "i"));
  if (!m) return null;
  const u = normUnit(m[2]);
  const q = toNum(m[1]);
  if (!u || q == null || q <= 0) return null;
  return `${fmtNum(q)} ${u}`;
}

/** {quantity, quantitySource} for one row, preferring a real source field. */
function resolveQuantity(name, unitInfo, unitInfoLabel) {
  const fromField = quantityFromUnitInfo(unitInfo);
  if (fromField) return { quantity: fromField, quantitySource: unitInfoLabel };
  const fromName = parseQuantityFromName(name);
  if (fromName) return { quantity: fromName, quantitySource: "parsed-from-product-name" };
  return { quantity: null, quantitySource: null };
}

// ============================================================================
// HTTP
// ============================================================================

async function fetchText(url, extraHeaders = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,application/json,*/*", ...extraHeaders },
      signal: controller.signal,
      redirect: "follow",
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text, headers: res.headers, url: res.url };
  } catch (err) {
    return { ok: false, status: 0, text: "", error: String(err?.message || err), headers: null, url };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url, extraHeaders = {}) {
  const r = await fetchText(url, { Accept: "application/json", ...extraHeaders });
  if (!r.ok) return { ok: false, status: r.status, json: null, error: r.error, headers: r.headers };
  try {
    return { ok: true, status: r.status, json: JSON.parse(r.text), headers: r.headers };
  } catch (err) {
    return { ok: false, status: r.status, json: null, error: `bad JSON: ${err.message}`, headers: r.headers };
  }
}

async function jsonRetry(url, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    const r = await fetchJson(url);
    if (r.ok) return r;
    if (r.status === 404) return r;
    await sleep(1200 * (i + 1));
  }
  return { ok: false, status: 0, json: null };
}

/**
 * Fetches robots.txt and answers, for OUR user-agent, whether `path` is
 * crawlable. Conservative by design: a group that names ClaudeBot, VendorjaBot
 * or * with a matching Disallow blocks us; an unreachable robots.txt for a
 * host that is otherwise up is treated as "no rules published" only when it
 * returns 404 (the documented meaning), never when it errors.
 */
async function robotsVerdict(origin, path = "/") {
  const r = await fetchText(`${origin}/robots.txt`);
  if (r.status === 404) {
    return { allowed: true, status: 404, reason: "robots.txt 404 -- no rules published, crawling permitted by default", body: "" };
  }
  if (!r.ok) {
    return { allowed: false, status: r.status, reason: `robots.txt could not be read (HTTP ${r.status}${r.error ? ", " + r.error : ""}) -- not crawled`, body: "" };
  }
  const body = r.text;
  // Parse into agent groups.
  const groups = [];
  let current = null;
  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const field = m[1].toLowerCase();
    const value = m[2].trim();
    if (field === "user-agent") {
      if (!current || current.rules.length) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
    } else if (current && (field === "disallow" || field === "allow")) {
      current.rules.push({ type: field, path: value });
    }
  }
  const mine = ["claudebot", "vendorjabot", "*"];
  const applicable = groups.filter((g) => g.agents.some((a) => mine.includes(a)));
  // A named-agent group wins over the wildcard group.
  const named = applicable.filter((g) => g.agents.some((a) => a !== "*"));
  const chosen = named.length ? named : applicable;
  let bestRule = null;
  for (const g of chosen) {
    for (const rule of g.rules) {
      if (rule.type === "disallow" && rule.path === "") continue; // "Disallow:" = allow all
      if (!rule.path) continue;
      if (path.startsWith(rule.path)) {
        if (!bestRule || rule.path.length > bestRule.path.length) bestRule = rule;
      }
    }
  }
  if (bestRule && bestRule.type === "disallow") {
    return {
      allowed: false,
      status: 200,
      reason: `robots.txt disallows ${bestRule.path} for our user-agent -- not crawled`,
      body: body.slice(0, 400),
    };
  }
  return {
    allowed: true,
    status: 200,
    reason: bestRule ? `robots.txt explicitly allows ${bestRule.path}` : "robots.txt publishes no Disallow matching this path",
    body: body.slice(0, 400),
  };
}

// ============================================================================
// Wolt -- venue discovery and assortment sweep
//
// robots.txt on wolt.com is "User-agent: * / Disallow:" (verified every run
// below). The two endpoints are public and unauthenticated:
//   venue discovery  https://restaurant-api.wolt.com/v1/pages/venue-list/category-grocery?lat=&lon=
//   assortment tree  https://consumer-api.wolt.com/consumer-api/consumer-assortment/v1/venues/slug/<slug>/assortment
//   items in a leaf  <same>/categories/slug/<leafSlug>[?page_token=...]
//
// PRICE CAVEAT, recorded honestly and unchanged from harvest-retail.mjs: a
// Wolt price is that shop's price ON WOLT and may carry a delivery-platform
// markup over the till price. It is a real published price, not an invented
// one, but it is not necessarily the in-store price.
// ============================================================================

const WOLT_VENUE_API = "https://restaurant-api.wolt.com/v1/pages";
const WOLT_ASSORTMENT_API = "https://consumer-api.wolt.com/consumer-api/consumer-assortment/v1/venues/slug";

// Every Kosovo municipality seat. Twenty-four of these return no grocery venue
// (Wolt does not operate there); they are probed anyway so the report can say
// so from measurement rather than assumption.
const KOSOVO_CITIES = [
  ["pristina", "Prishtinë", 42.6629, 21.1655], ["ferizaj", "Ferizaj", 42.3703, 21.1558],
  ["gjilan", "Gjilan", 42.4641, 21.469], ["prizren", "Prizren", 42.2171, 20.743],
  ["peja", "Pejë", 42.6593, 20.2887], ["mitrovica", "Mitrovicë", 42.8914, 20.866],
  ["gjakova", "Gjakovë", 42.3803, 20.4308], ["vushtrri", "Vushtrri", 42.8231, 20.9675],
  ["podujeva", "Podujevë", 42.9106, 21.1933], ["fushe-kosove", "Fushë Kosovë", 42.6367, 21.0972],
  ["suhareka", "Suharekë", 42.3586, 20.8256], ["rahovec", "Rahovec", 42.3994, 20.6547],
  ["malisheva", "Malishevë", 42.4828, 20.7458], ["skenderaj", "Skenderaj", 42.7469, 20.7892],
  ["drenas", "Drenas", 42.6256, 20.8964], ["lipjan", "Lipjan", 42.5239, 21.1256],
  ["kamenica", "Kamenicë", 42.5789, 21.5756], ["viti", "Viti", 42.3208, 21.3575],
  ["istog", "Istog", 42.7806, 20.4881], ["klina", "Klinë", 42.6217, 20.5772],
  ["decan", "Deçan", 42.5406, 20.2883], ["obiliq", "Obiliq", 42.6869, 21.0703],
  ["shtime", "Shtime", 42.4331, 21.0397], ["dragash", "Dragash", 42.0619, 20.6531],
  ["gracanica", "Graçanicë", 42.5989, 21.1919], ["hani-i-elezit", "Hani i Elezit", 42.1519, 21.2969],
  ["junik", "Junik", 42.4767, 20.2775], ["mamusha", "Mamushë", 42.3272, 20.7222],
];

const ALBANIA_CITIES = [
  ["tirana", "Tiranë", 41.3275, 19.8187], ["durres", "Durrës", 41.3231, 19.4414],
  ["vlore", "Vlorë", 40.4661, 19.4914], ["shkoder", "Shkodër", 42.0693, 19.5033],
  ["elbasan", "Elbasan", 41.1125, 20.0822], ["fier", "Fier", 40.7239, 19.5567],
  ["korce", "Korçë", 40.6186, 20.7808], ["berat", "Berat", 40.7058, 19.9522],
  ["lushnje", "Lushnjë", 40.9419, 19.705], ["pogradec", "Pogradec", 40.9025, 20.6525],
  ["sarande", "Sarandë", 39.8756, 20.0053], ["kavaje", "Kavajë", 41.1856, 19.5569],
  ["lezhe", "Lezhë", 41.7836, 19.6436], ["gjirokaster", "Gjirokastër", 40.0758, 20.1389],
];

// Same rules as harvest-retail.mjs so a venue keeps the SAME `source` value
// across both harvesters -- otherwise a re-run would file the same shop twice.
const WOLT_CHAIN_RULES = [
  [/^spar\b/i, "SPAR Kosova", "spar-kosova"],
  [/^super\s*viva\b/i, "Super Viva", "super-viva"],
  [/^max(i)?\s*market\b/i, "Maxi Supermarket", "maxi-supermarket"],
  [/^plus\s*market\b/i, "Plus Market", "plus-market"],
  [/^lear\s*market\b/i, "Lear Market", "lear-market"],
  [/^molla\s*express|^market\s*express\s*molla/i, "Molla Express", "molla-express"],
  [/^exfis\s*market\b/i, "ExFis Market", "exfis-market"],
];

// Albania has its own chains; the Kosovo rules must not be applied there
// (an Albanian "Spar Vlore" is SPAR Albania, a different company's franchise).
const WOLT_CHAIN_RULES_AL = [
  [/^conad\b/i, "Conad Albania", "conad-albania"],
  [/^spar\b/i, "SPAR Albania", "spar-albania"],
  [/^big\s*market\b/i, "Big Market", "big-market"],
  [/^baronesha\b/i, "Baronesha", "baronesha"],
];

function woltChainOf(venueName, region) {
  const rules = region === "al" ? WOLT_CHAIN_RULES_AL : WOLT_CHAIN_RULES;
  for (const [re, chain, key] of rules) if (re.test(venueName)) return { chain, key };
  return { chain: venueName, key: slugify(normalizeForMatch(venueName)) || "venue" };
}

async function discoverWoltVenues(cities, entry) {
  const venues = new Map();
  const perCity = [];
  for (const [slug, display, lat, lon] of cities) {
    const before = venues.size;
    const a = await jsonRetry(`${WOLT_VENUE_API}/venue-list/category-grocery?lat=${lat}&lon=${lon}`);
    if (!a.ok) {
      entry.notes.push(`venue discovery for ${slug} failed: HTTP ${a.status}`);
    } else {
      for (const sec of a.json.sections || []) {
        for (const it of sec.items || []) {
          const v = it.venue;
          if (v?.slug && !venues.has(v.slug)) {
            venues.set(v.slug, { slug: v.slug, name: v.name, citySlug: slug, cityName: display, via: "category-grocery", raw: v });
          }
        }
      }
    }
    await sleep(REQUEST_DELAY_MS * 2);
    const b = await jsonRetry(`${WOLT_VENUE_API}/front?lat=${lat}&lon=${lon}`);
    if (b.ok) {
      for (const sec of b.json.sections || []) {
        for (const it of sec.items || []) {
          const v = it.venue;
          if (!v?.slug || venues.has(v.slug)) continue;
          // Same two evidence-based ways in as harvest-retail.mjs: the curated
          // grocery rail, or Wolt's OWN tags saying this venue is a grocery.
          const tags = (v.tags || []).join(",");
          const taggedGrocery = /\b(grocer(y|ies)|supermarket|convenience)\b/i.test(tags);
          if (sec.name === "top-grocery-picks") {
            venues.set(v.slug, { slug: v.slug, name: v.name, citySlug: slug, cityName: display, via: "top-grocery-picks", raw: v });
          } else if (taggedGrocery) {
            venues.set(v.slug, { slug: v.slug, name: v.name, citySlug: slug, cityName: display, via: `tagged "${tags}"`, raw: v });
          }
        }
      }
    }
    perCity.push({ city: slug, newVenues: venues.size - before });
    await sleep(REQUEST_DELAY_MS * 2);
  }
  entry.cityProbe = perCity;
  entry.citiesProbed = cities.length;
  entry.citiesWithNoGroceryVenue = perCity.filter((c) => c.newVenues === 0).length;
  return [...venues.values()];
}

/** Walks a venue's category tree down to its leaves, keeping the full path. */
function woltLeaves(categories) {
  const leaves = [];
  const walk = (c, path) => {
    const p = [...path, String(c.name || "").replace(/[\t\r\n]+/g, " ").trim()];
    if (c.subcategories?.length) c.subcategories.forEach((s) => walk(s, p));
    else leaves.push({ slug: c.slug, path: p });
  };
  (categories || []).forEach((c) => walk(c, []));
  return leaves;
}

/**
 * Sweeps one Wolt region. `onVenueRows` is called after each venue so the
 * caller can checkpoint a long run to disk.
 */
async function harvestWoltRegion({ region, countryCode, countryPath, cities, label, entry, onVenueRows }) {
  const venues = await discoverWoltVenues(cities, entry);
  entry.notes.push(`discovered ${venues.length} grocery venues across ${cities.length} ${label} cities on Wolt`);
  entry.venues = [];

  const all = [];
  const list = VENUE_LIMIT === Infinity ? venues : venues.slice(0, VENUE_LIMIT);
  let done = 0;
  for (const v of list) {
    const base = `${WOLT_ASSORTMENT_API}/${v.slug}/assortment`;
    const root = await jsonRetry(base);
    if (!root.ok || !root.json) {
      entry.venues.push({ slug: v.slug, name: v.name, city: v.citySlug, httpStatus: root.status, items: 0, withBarcode: 0 });
      continue;
    }
    const leaves = woltLeaves(root.json.categories);
    const { chain, key } = woltChainOf(v.name, region);
    const venueCity = typeof v.raw?.city === "string" && v.raw.city.trim() ? v.raw.city.trim() : v.cityName;
    const venueUrl = `https://wolt.com/en/${countryPath}/${v.citySlug}/venue/${v.slug}`;
    const sourceId = region === "al" ? `wolt.com/al/${key}` : `wolt.com/${key}`;
    const sourceLabel = region === "al" ? `${chain}, ${venueCity} (Wolt Shqipëri)` : `${chain} (Wolt)`;

    const seen = new Map();
    for (const leaf of leaves) {
      let token = null;
      let guard = 0;
      do {
        const url = `${base}/categories/slug/${leaf.slug}` + (token ? `?page_token=${encodeURIComponent(token)}` : "");
        const r = await jsonRetry(url);
        if (!r.ok || !r.json) break;
        for (const it of r.json.items || []) {
          if (!it?.id || !it.name) continue;
          if (!seen.has(it.id)) seen.set(it.id, { item: it, leaf });
        }
        token = r.json.metadata?.next_page_token || null;
        guard++;
        await sleep(REQUEST_DELAY_MS);
      } while (token && guard < 40);
    }

    const rows = [];
    let withBarcode = 0;
    let withQuantity = 0;
    let quantityFromField = 0;
    for (const { item, leaf } of seen.values()) {
      const gtin = isValidGs1(item.barcode_gtin) ? String(item.barcode_gtin).trim() : null;
      if (gtin) withBarcode++;
      const cls = classifyByBarcode(gtin);
      const derived = deriveBrandFromTitle(item.name);
      const price = typeof item.price === "number" ? Math.round(item.price) / 100 : null;
      const wasPrice = typeof item.original_price === "number" ? Math.round(item.original_price) / 100 : null;
      const q = resolveQuantity(item.name, item.unit_info, "wolt `unit_info` field");
      if (q.quantity) withQuantity++;
      if (q.quantitySource === "wolt `unit_info` field") quantityFromField++;
      rows.push({
        id: `wolt.com/${v.slug}:${item.id}`,
        source: sourceId,
        sourceLabel,
        name: item.name,
        brand: derived.brand,
        brandSource: derived.brandSource,
        category: leaf.path[leaf.path.length - 1] || null,
        price,
        ...(wasPrice != null && price != null && wasPrice > price ? { previousPrice: wasPrice } : {}),
        currency: "EUR",
        image: item.images?.[0]?.url || null,
        url: venueUrl,
        barcode: gtin,
        isLocalBrand: cls.isLocalBrand,
        localEvidence: cls.localEvidence,
        quantity: q.quantity,
        quantitySource: q.quantitySource,
        country: countryCode,
        countrySource: `the shop this row was read from is a ${label} grocery venue on Wolt`,
      });
    }
    entry.venues.push({
      slug: v.slug,
      name: v.name,
      chain,
      city: v.citySlug,
      httpStatus: 200,
      leafCategories: leaves.length,
      items: seen.size,
      withBarcode,
      withQuantity,
      quantityFromUnitInfoField: quantityFromField,
    });
    console.log(
      `  wolt[${region}]/${v.slug}: ${seen.size} items, ${withBarcode} with a published EAN, ${withQuantity} with a size`
    );
    all.push(...rows);
    done++;
    if (onVenueRows && done % FLUSH_EVERY_VENUES === 0) await onVenueRows(all.slice());
  }
  entry.productCount = all.length;
  entry.barcodeCount = all.filter((p) => isValidGs1(p.barcode)).length;
  return all;
}

// ============================================================================
// Conad Albania (www.conadalbania.al) -- WordPress REST
//
// What it publishes: a product name and a product photo. What it does NOT
// publish, verified: no price anywhere in the REST payload, no GTIN, and the
// `product` post type declares `"taxonomies": []` so there is no category to
// read either. Those rows are written honestly incomplete rather than padded.
// ============================================================================

const CONAD_ORIGIN = "https://www.conadalbania.al";

async function harvestConadAlbania(entry) {
  const robots = await robotsVerdict(CONAD_ORIGIN, "/wp-json/");
  entry.robots = { status: robots.status, allowed: robots.allowed, reason: robots.reason, excerpt: robots.body };
  if (!robots.allowed) {
    entry.notes.push(robots.reason);
    entry.productCount = 0;
    return [];
  }

  const rows = [];
  let page = 1;
  let totalPages = 1;
  const seen = new Set();
  while (page <= totalPages && page <= 30) {
    const url = `${CONAD_ORIGIN}/wp-json/wp/v2/product?per_page=100&page=${page}&_embed=wp:featuredmedia`;
    const r = await fetchJson(url);
    if (!r.ok || !Array.isArray(r.json)) {
      entry.notes.push(`page ${page}: HTTP ${r.status}${r.error ? " " + r.error : ""} -- stopped here`);
      break;
    }
    if (page === 1) {
      const tp = Number(r.headers?.get?.("x-wp-totalpages"));
      const tt = Number(r.headers?.get?.("x-wp-total"));
      if (Number.isFinite(tp) && tp > 0) totalPages = tp;
      entry.sitePublishes = { totalProducts: Number.isFinite(tt) ? tt : null, totalPages };
    }
    for (const p of r.json) {
      const name = decodeHtmlEntities(p?.title?.rendered || "");
      if (!name || seen.has(p.id)) continue;
      seen.add(p.id);
      const image = p?._embedded?.["wp:featuredmedia"]?.[0]?.source_url || null;
      const derived = deriveBrandFromTitle(name);
      const q = resolveQuantity(name, null, null);
      rows.push({
        id: `conadalbania.al:${p.id}`,
        source: "conadalbania.al",
        sourceLabel: "Conad Albania",
        name,
        brand: derived.brand,
        brandSource: derived.brandSource,
        // The site declares no taxonomy on its product type -- there is no
        // category to read, so none is written.
        category: null,
        price: null,
        currency: null,
        image,
        url: p.link || `${CONAD_ORIGIN}/produkt/${p.slug}/`,
        // No GTIN is published anywhere on this site.
        barcode: null,
        isLocalBrand: null,
        localEvidence: null,
        quantity: q.quantity,
        quantitySource: q.quantitySource,
        country: "AL",
        countrySource: "conadalbania.al is the Albanian Conad franchise's own site",
      });
    }
    page++;
    await sleep(REQUEST_DELAY_MS * 2);
  }
  entry.productCount = rows.length;
  entry.notes.push(
    "publishes NO price, NO GTIN and NO category taxonomy (`product` post type declares taxonomies: []) -- those fields are written null rather than guessed"
  );
  console.log(`  conadalbania.al: ${rows.length} products (name + photo only)`);
  return rows;
}

// ============================================================================
// Merge / de-duplicate / write
// ============================================================================

function loadJson(filename, fallback) {
  const p = join(DATA_DIR, filename);
  if (!existsSync(p)) return fallback;
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return fallback;
  }
}

function retailerOf(source) {
  const s = String(source || "");
  if (s.startsWith("wolt.com/")) return s.slice("wolt.com/".length);
  if (s === "super-viva.com") return "super-viva";
  if (s === "etc-ks.com") return "etc";
  if (s === "begmart.com") return "begmart";
  if (s === "maxiks.shop") return "maxi-supermarket";
  return s;
}

function sourceGroupOf(source) {
  const s = String(source || "");
  if (s.startsWith("wolt.com/al/")) return "wolt.com (Albania)";
  if (s.startsWith("wolt.com/")) return "wolt.com";
  return s;
}

/**
 * Same two-stage rule as harvest-retail.mjs dedupeProducts(), reimplemented
 * here so both harvesters leave the file in the same shape:
 *   stage 1: group on (retailer, matchKey); keep the cheapest, ties broken by
 *            "has a barcode", then "has an image", then "has a quantity".
 *   stage 2: drop a barcode-less row when the SAME retailer already has a row
 *            with an identical normalised name that DOES carry a barcode.
 * The same product at DIFFERENT retailers is deliberately kept -- that is what
 * the cross-store price comparison is built from.
 */
function dedupeProducts(products) {
  const groups = new Map();
  for (const p of products) {
    const key = `${retailerOf(p.source)}||${p.matchKey || computeMatchKey(p.name, p.barcode)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }
  const kept = [];
  let removedStage1 = 0;
  for (const rows of groups.values()) {
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
      if (ai !== bi) return ai - bi;
      return (a.quantity ? 0 : 1) - (b.quantity ? 0 : 1);
    });
    kept.push(sorted[0]);
    removedStage1 += rows.length - 1;
  }
  const barcodedNames = new Map();
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
  return {
    products: finalKept,
    stats: { before: products.length, after: finalKept.length, removedStage1, removedStage2: shadowed, removed: removedStage1 + shadowed },
  };
}

/** Cross-store price comparisons, same rule as harvest-retail.mjs. */
function buildPriceComparisons(products) {
  const groups = new Map();
  for (const p of products) {
    if (p.price == null) continue;
    const key = p.matchKey || computeMatchKey(p.name, p.barcode);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }
  const out = [];
  for (const [key, rows] of groups) {
    const sources = new Set(rows.map((r) => r.source));
    if (sources.size < 2) continue;
    const offers = rows
      .map((r) => ({ source: r.source, sourceLabel: r.sourceLabel, price: r.price, currency: r.currency, url: r.url }))
      .sort((a, b) => a.price - b.price);
    out.push({
      matchKey: key,
      name: rows[0].name,
      barcode: rows[0].barcode || null,
      quantity: rows.find((r) => r.quantity)?.quantity || null,
      cheapest: offers[0],
      offers,
    });
  }
  return out;
}

function buildSourcesIndex(products, domainEntries) {
  const counts = new Map();
  for (const p of products) {
    const g = sourceGroupOf(p.source);
    if (!g) continue;
    counts.set(g, (counts.get(g) || 0) + 1);
  }
  const byDomain = new Map((domainEntries || []).map((d) => [d.domain, d]));
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([domain, count]) => {
      const d = byDomain.get(domain);
      return { domain, platform: d?.platform ?? null, endpoint: d?.endpoint ?? null, count };
    });
}

function coverage(products) {
  const n = products.length || 1;
  const withBarcode = products.filter((p) => p.barcode && String(p.barcode).trim()).length;
  const withValidGs1 = products.filter((p) => isValidGs1(p.barcode)).length;
  const withQuantity = products.filter((p) => p.quantity && String(p.quantity).trim()).length;
  const withBrand = products.filter((p) => p.brand && String(p.brand).trim()).length;
  const withImage = products.filter((p) => p.image).length;
  const withPrice = products.filter((p) => typeof p.price === "number").length;
  const withCategory = products.filter((p) => p.category && String(p.category).trim()).length;
  const pct = (v) => Number(((100 * v) / n).toFixed(2));
  return {
    rows: products.length,
    barcode: withBarcode, barcodePct: pct(withBarcode),
    validGs1: withValidGs1, validGs1Pct: pct(withValidGs1),
    quantity: withQuantity, quantityPct: pct(withQuantity),
    brand: withBrand, brandPct: pct(withBrand),
    image: withImage, imagePct: pct(withImage),
    price: withPrice, pricePct: pct(withPrice),
    category: withCategory, categoryPct: pct(withCategory),
  };
}

/**
 * Backfills `quantity` (and `country` for the rows already on file, every one
 * of which came from a Kosovo retailer) without touching any other field.
 */
function backfillRows(products) {
  let quantityAdded = 0;
  let countryAdded = 0;
  const out = products.map((p) => {
    const next = { ...p };
    if (!next.quantity) {
      const q = resolveQuantity(next.name, null, null);
      if (q.quantity) {
        next.quantity = q.quantity;
        next.quantitySource = q.quantitySource;
        quantityAdded++;
      } else if (next.quantity === undefined) {
        next.quantity = null;
        next.quantitySource = null;
      }
    }
    if (!next.country) {
      // Every source already in the file is a Kosovo retailer or a Kosovo
      // shop's Wolt venue. Albanian rows written by this script already carry
      // country: "AL" and never reach this branch.
      next.country = "XK";
      next.countrySource = "every retailer already in this catalogue is a Kosovo shop";
      countryAdded++;
    }
    return next;
  });
  return { products: out, quantityAdded, countryAdded };
}

/**
 * The barcode-integrity sweep harvest-retail.mjs applies, repeated here so a
 * row this script writes can never introduce a code that fails its own check
 * digit (and so rows written by earlier passes get the same treatment).
 */
function barcodeIntegritySweep(products) {
  let withdrawn = 0;
  const examples = [];
  const out = products.map((p) => {
    const raw = p.barcode == null ? null : String(p.barcode).trim();
    const looksNumeric = raw && /^\d{8}$|^\d{12,14}$/.test(raw);
    if (!looksNumeric || hasValidGs1CheckDigit(raw)) return p;
    withdrawn++;
    if (examples.length < 20) examples.push({ source: p.source, name: p.name, rejectedCode: raw });
    const fromBarcode = /GS1 barcode prefix/.test(p.localEvidence || "");
    return { ...p, barcode: null, isLocalBrand: fromBarcode ? null : p.isLocalBrand, localEvidence: fromBarcode ? null : p.localEvidence };
  });
  return { products: out, withdrawn, examples };
}

// ============================================================================
// main
// ============================================================================

async function main() {
  const startedAt = new Date().toISOString();
  const existingFile = loadJson("kosovo-retail.json", { count: 0, products: [], priceComparisons: [] });
  const existingProducts = Array.isArray(existingFile.products) ? existingFile.products : [];
  const before = coverage(existingProducts);
  console.log(
    `Baseline: ${before.rows} rows | barcode ${before.barcodePct}% | quantity ${before.quantityPct}% | brand ${before.brandPct}%`
  );

  const report = {
    startedAt,
    script: "scripts/harvest-more.mjs",
    owner: "market data harvest",
    before,
    domains: [],
    rejected: [],
  };

  // Every id already on file, so a checkpoint flush can merge safely.
  const merged = new Map(existingProducts.map((p) => [p.id, p]));
  const freshIds = new Set();

  const flush = async (rows) => {
    for (const r of rows) {
      merged.set(r.id, r);
      freshIds.add(r.id);
    }
    if (DRY_RUN) return;
    // A checkpoint write is the same merge the final write does, minus the
    // report, so an interrupted sweep still leaves every finished venue on file.
    const snapshot = [...merged.values()].map((p) => ({ ...p, matchKey: p.matchKey || computeMatchKey(p.name, p.barcode) }));
    writeJsonAtomic(join(DATA_DIR, "kosovo-retail.json"), {
      ...existingFile,
      builtAt: new Date().toISOString(),
      count: snapshot.length,
      products: snapshot,
      priceComparisons: existingFile.priceComparisons || [],
    });
    console.log(`  [checkpoint] ${snapshot.length} rows on file`);
  };

  // --- Wolt robots.txt, checked once and honoured for both regions --------
  let woltAllowed = false;
  if (wants("wolt-xk") || wants("wolt-al")) {
    const v = await robotsVerdict("https://wolt.com", "/");
    woltAllowed = v.allowed;
    report.woltRobots = { status: v.status, allowed: v.allowed, reason: v.reason, excerpt: v.body };
    console.log(`wolt.com robots.txt: HTTP ${v.status} -- ${v.reason}`);
    if (!v.allowed) report.rejected.push({ domain: "wolt.com", reason: v.reason });
  }

  // --- 1. Wolt Kosovo, all 28 municipality seats -------------------------
  if (wants("wolt-xk") && woltAllowed) {
    const entry = {
      domain: "wolt.com",
      region: "Kosovo",
      platform: "Wolt consumer assortment API (public, unauthenticated)",
      endpoint: `${WOLT_ASSORTMENT_API}/<venue>/assortment[/categories/slug/<leaf>]`,
      notes: [
        "robots.txt https://wolt.com/robots.txt is `User-agent: * / Disallow:` -- nothing disallowed",
        "PRICE CAVEAT: a Wolt price is that shop's price ON WOLT and may include a delivery-platform markup",
        "widened from the 4 cities harvest-retail.mjs probes to all 28 Kosovo municipality seats",
      ],
    };
    console.log("Sweeping Wolt Kosovo (28 municipality seats)...");
    const rows = await harvestWoltRegion({
      region: "xk", countryCode: "XK", countryPath: "xkx", cities: KOSOVO_CITIES, label: "Kosovo", entry, onVenueRows: flush,
    });
    await flush(rows);
    report.domains.push(entry);
    await sleep(DOMAIN_DELAY_MS);
  }

  // --- 2. Wolt Albania ----------------------------------------------------
  if (wants("wolt-al") && woltAllowed) {
    const entry = {
      domain: "wolt.com (Albania)",
      region: "Albania",
      platform: "Wolt consumer assortment API (public, unauthenticated)",
      endpoint: `${WOLT_ASSORTMENT_API}/<venue>/assortment[/categories/slug/<leaf>]`,
      notes: [
        "the brief asks for Kosovo/Albania retailers; this is the Albanian half, never harvested before",
        "rows carry country: \"AL\", source wolt.com/al/<venue> and a sourceLabel naming the city -- they are marked, not blended in",
        "PRICE CAVEAT: as Kosovo -- a Wolt price may include a delivery-platform markup",
      ],
    };
    console.log("Sweeping Wolt Albania (14 cities)...");
    const rows = await harvestWoltRegion({
      region: "al", countryCode: "AL", countryPath: "alb", cities: ALBANIA_CITIES, label: "Albania", entry, onVenueRows: flush,
    });
    await flush(rows);
    report.domains.push(entry);
    await sleep(DOMAIN_DELAY_MS);
  }

  // --- 3. Conad Albania ---------------------------------------------------
  if (wants("conad-al")) {
    const entry = {
      domain: "conadalbania.al",
      chain: "Conad Albania",
      platform: "WordPress REST (wp/v2)",
      endpoint: `${CONAD_ORIGIN}/wp-json/wp/v2/product?per_page=100&page=N&_embed=wp:featuredmedia`,
      notes: [],
    };
    console.log("Harvesting Conad Albania (conadalbania.al WordPress REST)...");
    const rows = await harvestConadAlbania(entry);
    await flush(rows);
    report.domains.push(entry);
    await sleep(DOMAIN_DELAY_MS);
  }

  // --- 4. quantity + country backfill over the WHOLE file -----------------
  let products = [...merged.values()];
  if (wants("quantity")) {
    const bf = backfillRows(products);
    products = bf.products;
    report.backfill = {
      rule:
        "`quantity` is read from the source's own unit field when that field states a mass or volume, otherwise from the pack size written in the product's own name; `quantitySource` records which. A name with no size in it stays null -- nothing is inferred from category, price-per-kilo or photo.",
      quantityAdded: bf.quantityAdded,
      countryAdded: bf.countryAdded,
    };
    console.log(`Backfill: quantity on ${bf.quantityAdded} rows, country on ${bf.countryAdded} rows.`);
  }

  // --- 5. integrity, matchKey, dedupe ------------------------------------
  const integrity = barcodeIntegritySweep(products);
  products = integrity.products;
  report.barcodeIntegrity = {
    rule:
      "a numeric-looking barcode that fails the GS1 mod-10 check digit is not a barcode -- it is nulled and any verdict derived from its prefix is withdrawn",
    codesRejected: integrity.withdrawn,
    examples: integrity.examples,
  };

  products = products.map((p) => ({ ...p, matchKey: computeMatchKey(p.name, p.barcode) }));

  const dd = dedupeProducts(products);
  report.deduplication = {
    rule:
      "stage 1 groups on (retailer, matchKey) -- gtin:<ean> where a valid GS1 barcode exists, name:<normalised name> otherwise -- and keeps the cheapest row, ties broken by barcode, then image, then quantity. Stage 2 drops a barcode-less row when the same retailer already has an identically-named row that carries a barcode. The same product at DIFFERENT retailers is deliberately kept.",
    ...dd.stats,
  };
  products = dd.products;
  console.log(`De-duplicated: ${dd.stats.before} -> ${dd.stats.after} (${dd.stats.removed} removed).`);

  // --- 6. never shrink ----------------------------------------------------
  const floor = Math.max(0, existingProducts.length - dd.stats.removed);
  if (products.length < floor) {
    console.error(`REFUSING TO SHRINK: ${products.length} < ${floor}. Keeping the existing file.`);
    report.refusedToShrink = { computed: products.length, floor };
    products = existingProducts.map((p) => ({ ...p, matchKey: p.matchKey || computeMatchKey(p.name, p.barcode) }));
  }

  const after = coverage(products);
  report.after = after;
  report.rowsWrittenByThisRun = products.filter((p) => freshIds.has(p.id)).length;
  report.rowsAddedThisRun = Math.max(0, products.length - existingProducts.length);
  report.finishedAt = new Date().toISOString();

  // --- 7. sources the brief named, and what happened to each --------------
  report.sourcesInvestigated = SOURCES_INVESTIGATED;
  report.srcChangeNeeded = [
    "src/lib/dataLoader.js normalizeRetailProduct() rebuilds each row from a fixed field whitelist, so the new `quantity`, `quantitySource`, `country` and `countrySource` fields are dropped at load time and never reach the UI. Adding them to that whitelist is a src change and belongs to a later pass -- this script does not make it. Until then the fields sit in data/kosovo-retail.json unused.",
    "Albanian rows (source `wolt.com/al/*`, `conadalbania.al`, country `AL`) are in the catalogue the Explore screen renders. If Albanian shelves should be filtered out of the Kosovo 'where to buy' view, that filter belongs in src, keyed on `country`.",
  ];

  const productsOut = {
    ...existingFile,
    builtAt: new Date().toISOString(),
    count: products.length,
    sources: buildSourcesIndex(products, report.domains),
    products,
    priceComparisons: buildPriceComparisons(products),
  };

  if (!DRY_RUN) {
    writeJsonAtomic(join(DATA_DIR, "kosovo-retail.json"), productsOut);
    const fullReport = loadJson("kosovo-retail-report.json", {});
    fullReport.harvestMore = report;
    writeJsonAtomic(join(DATA_DIR, "kosovo-retail-report.json"), fullReport);
  }

  console.log("");
  console.log(`rows      ${before.rows} -> ${after.rows}`);
  console.log(`barcode   ${before.barcodePct}% -> ${after.barcodePct}%  (${before.barcode} -> ${after.barcode})`);
  console.log(`quantity  ${before.quantityPct}% -> ${after.quantityPct}%  (${before.quantity} -> ${after.quantity})`);
  console.log(`brand     ${before.brandPct}% -> ${after.brandPct}%  (${before.brand} -> ${after.brand})`);
  console.log(`image     ${before.imagePct}% -> ${after.imagePct}%`);
  console.log(DRY_RUN ? "(dry run -- nothing written)" : "Wrote data/kosovo-retail.json and data/kosovo-retail-report.json");
}

// Every domain looked at for this pass, and the measured reason for the
// verdict. Rejections are recorded, not silently dropped -- several of these
// are the brief's own candidate list.
const SOURCES_INVESTIGATED = [
  { domain: "wolt.com (Kosovo)", verdict: "harvested", robots: "HTTP 200, `User-agent: * / Disallow:` -- nothing disallowed", finding: "45 grocery venues across 28 probed Kosovo municipality seats; harvest-retail.mjs probed only 4 cities and found 35" },
  { domain: "wolt.com (Albania)", verdict: "harvested", robots: "HTTP 200, `User-agent: * / Disallow:` -- nothing disallowed", finding: "64 grocery venues across 14 Albanian cities incl. Conad Albania, SPAR Albania and Big Market; sampled barcode rate 77-97%" },
  { domain: "conadalbania.al", verdict: "harvested", robots: "HTTP 200, disallows only /wp-admin/ -- /wp-json/ permitted", finding: "WordPress REST wp/v2/product, 217 products, name + photo only: no price, no GTIN, no category taxonomy" },
  { domain: "glovoapp.com", verdict: "rejected", robots: "HTTP 200, `User-agent: * / Disallow: /` -- crawling of the whole site disallowed", finding: "the brief named Glovo Kosovo storefronts; robots.txt forbids it, so it is not crawled" },
  { domain: "albimall.com", verdict: "rejected", robots: "HTTP 200, `Disallow: /` for all agents", finding: "the brief named Albi Mall; robots.txt forbids the whole site" },
  { domain: "vivafresh-rks.com", verdict: "rejected (unchanged)", robots: "robots.txt names ClaudeBot and disallows /", finding: "the brief named Viva Fresh; already recorded as a deliberate skip by harvest-retail.mjs and left that way" },
  { domain: "e-baa.com", verdict: "rejected (unchanged)", robots: "robots.txt explicitly disallows ClaudeBot", finding: "ETC's actual webshop; already a recorded deliberate skip" },
  { domain: "delta.al", verdict: "rejected", robots: "HTTP 200, permitted", finding: "WooCommerce Store API is live (421 products) but the shop sells furniture -- 'Letto Bianco', 'Paveminto' -- and every price returns 0. Not a grocer, not harvested" },
  { domain: "shpresa.al", verdict: "rejected", robots: "HTTP 200, permitted", finding: "WooCommerce Store API is live but the shop is 'Shpresa AL Computers' -- electronics, not groceries" },
  { domain: "ecomarket.al", verdict: "rejected", robots: "HTTP 200, permitted", finding: "WordPress with no product post type and no WooCommerce Store API (wp-json/wc/store/products -> 404): no machine-readable catalogue" },
  { domain: "bigmarket.al", verdict: "rejected for products", robots: "HTTP 200, permitted", finding: "sitemap.xml lists 243 URLs but they are branches (/markets/N), recipes and offer pages -- no per-product URLs, no product API. Its shelves ARE reachable, through its Wolt venues, which this pass harvests" },
  { domain: "spar.al", verdict: "rejected for products", robots: "HTTP 200, permitted", finding: "brochure site: no product feed, no wp-json product type, no sitemap product URLs. SPAR Albania shelves are reachable through its Wolt venues instead" },
  { domain: "market.al / shporta.al / mermer.al", verdict: "rejected", robots: "market.al 200; shporta.al robots 404; mermer.al HTTP 503", finding: "no machine-readable product catalogue found on any of them" },
  { domain: "emarket.al / shopper.al / vivafresh.al / iceberg-ks.com / kosovamarket.com / superviva.al / viva-fresh.com / onlinemarket.al / beefood.al / birra-peja.com / frutex.al / agrokoop.al", verdict: "rejected", robots: "n/a", finding: "DNS does not resolve / connection fails -- these domains are not live" },
  { domain: "emonacenter.com / albimarket.com / meridianexpress.com / interex-rks.com / eliabmarket.com", verdict: "no products (branch lists already harvested)", robots: "permitted where reachable", finding: "WordPress brochure sites with no product post type; harvest-retail.mjs already takes their branch lists into kosovo-stores.json" },
];

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
