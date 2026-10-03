#!/usr/bin/env node
/**
 * xapi-crawl.mjs — source-wrapping crawler for Kosovo retail + Kosovar producers.
 *
 * WHY THIS EXISTS
 * ---------------
 * The owner's ask (2026-09-16): "find using xapi always for everything hire him
 * to fetch data that is close always / xapi is a weapon waiting to be used for
 * crawling alternative finding".
 *
 * Xapi (the owner's own Cloudflare Worker, https://xapi.prishtina-online.workers.dev)
 * really does source-wrapping, but its two halves split like this:
 *
 *   - POST /admin/recon  — PUBLIC, no token, per-IP rate-limited 20/60s.
 *     Probes a URL server-side and returns an honest verdict: is there a JSON
 *     API, embedded page data, an anti-bot wall, or nothing? THIS is the part
 *     we can drive from this repo, and this script drives it: every source is
 *     reconned by Xapi before a single product page is fetched, and the verdict
 *     is written into the output file as provenance.
 *
 *   - POST /admin/wrap   — needs the full ADMIN_TOKEN, and even with it, it
 *     scrapes exactly ONE endpoint into ONE <=5MB R2 snapshot. It does not
 *     paginate, does not follow a sitemap, and does not walk a product list.
 *     A 1,600-product grocery catalogue is not a single-snapshot source.
 *     So the *crawl* is here, in this script, and Xapi is the gate in front
 *     of it. See docs/XAPI-SOURCING.md for the full, measured account.
 *
 * HONESTY GATES (non-negotiable)
 * -------------------------------------------------------
 *  1. robots.txt is obeyed. A Disallow is recorded and the URL is not fetched.
 *     We never route around a block.
 *  2. "Sold in Kosovo" is NEVER "made by a Kosovar brand". isLocalBrand:true
 *     only when either
 *       (a) the row's OWN barcode is a check-digit-valid GTIN whose GS1 prefix
 *           is 381 / 390 / 530 (data/gs1-prefixes.json is the authority), or
 *       (b) the row comes from a Kosovar PRODUCER's own website, where the
 *           company states its own manufacturing address in Kosovo. That is a
 *           curated, source-cited claim, and the citation is written into
 *           localEvidence on every single row.
 *     Everything else is isLocalBrand:false (barcode present, foreign prefix)
 *     or null (no usable barcode) — never "probably".
 *  3. Barcodes are validated. Maxi's HTML exposes Excel-mangled barcodes like
 *     "#7.90E+12"; those are DROPPED, not stored. A barcode must be 8/12/13/14
 *     digits with a correct GTIN check digit to count as evidence.
 *  4. Prices carry their real currency or they are null. 64.5% of the existing
 *     catalogue had to be deleted because Albanian Lek was stored as EUR. This
 *     script only writes a price when the source itself states the currency
 *     symbol, and it runs a plausibility band per source. bukabakery.com's
 *     WooCommerce API reports every price as "0" in GBP — those are written as
 *     price:null, currency:null, priceNote explaining why.
 *  5. Kosovo only. Every source here is a Kosovo-registered company with a
 *     Kosovo address; no Albanian venues.
 *
 * USAGE
 *   node scripts/xapi-crawl.mjs --recon-only          # just the Xapi verdicts
 *   node scripts/xapi-crawl.mjs --sources=buka,eurofood,amg
 *   node scripts/xapi-crawl.mjs                       # all sources, full crawl
 *   node scripts/xapi-crawl.mjs --limit=20            # cap products per source
 *   node scripts/xapi-crawl.mjs --out=data/foo.json
 *
 * Flags: --sources=a,b  --limit=N  --out=PATH  --recon-only  --no-recon
 *        --concurrency=N (default 3)  --delay=MS (default 500, per worker)
 *
 * Output: data/kosovo-retail-xapi.json — a NEW file. It is deliberately NOT
 * merged into data/kosovo-retail.json; the merge command is in
 * docs/XAPI-SOURCING.md and is a separate, reviewable step.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");

const XAPI_RECON = "https://xapi.prishtina-online.workers.dev/admin/recon";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/140.0.0.0 Safari/537.36 (+vendorja.com product-origin crawler; contact via vendorja.com)";

// ─────────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flag = (name, dflt = null) => {
  const hit = argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return dflt;
  const eq = hit.indexOf("=");
  return eq === -1 ? true : hit.slice(eq + 1);
};
const OPTS = {
  sources: flag("sources") ? String(flag("sources")).split(",").map((s) => s.trim()).filter(Boolean) : null,
  limit: flag("limit") ? Number(flag("limit")) : Infinity,
  out: String(flag("out", "data/kosovo-retail-xapi.json")),
  reconOnly: flag("recon-only") === true,
  noRecon: flag("no-recon") === true,
  concurrency: Number(flag("concurrency", 3)),
  delay: Number(flag("delay", 500)),
};

const log = (...a) => console.log(...a);
const warn = (...a) => console.log("  [!]", ...a);

// ─────────────────────────────────────────────────────────────────────────────
// GS1 — the only barcode authority this script trusts
// ─────────────────────────────────────────────────────────────────────────────
const GS1 = JSON.parse(fs.readFileSync(path.join(REPO, "data/gs1-prefixes.json"), "utf8"));
const GS1_PREFIXES = GS1.prefixes;

/** Expand "381" / "400-440" into a numeric [lo,hi] test on the first 3 digits. */
function gs1Lookup(barcode) {
  const p3 = Number(barcode.slice(0, 3));
  for (const row of GS1_PREFIXES) {
    const m = String(row.range).match(/^(\d{3})(?:-(\d{3}))?$/);
    if (!m) continue;
    const lo = Number(m[1]);
    const hi = m[2] ? Number(m[2]) : lo;
    if (p3 >= lo && p3 <= hi) return row;
  }
  return null;
}

/** GTIN-8/12/13/14 check digit. A barcode that fails this is not evidence. */
function validGtin(raw) {
  const d = String(raw ?? "").replace(/\D/g, "");
  if (![8, 12, 13, 14].includes(d.length)) return null;
  const digits = d.split("").map(Number);
  const check = digits.pop();
  let sum = 0;
  // Weights alternate 3,1 from the rightmost body digit leftwards.
  for (let i = digits.length - 1, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) sum += digits[i] * w;
  return (10 - (sum % 10)) % 10 === check ? d : null;
}

/**
 * Maxi names most product photos after the product's GTIN
 * (".../storage/2019/05/7322540037272.png", ".../storage/a0i6GEMq8008110002015.jpg").
 * Read ONLY the basename — the /2019/05/ date folders in the path are not
 * barcodes — take the digit runs in it, and accept one only if it is a
 * check-digit-valid GTIN. Longest run first, so a 13-digit GTIN wins over a
 * stray 8-digit substring.
 */
function gtinFromFilename(imageUrl) {
  let base;
  try { base = decodeURIComponent(new URL(imageUrl).pathname.split("/").pop() || ""); } catch { return null; }
  base = base.replace(/\.[a-z0-9]+$/i, "");
  const runs = (base.match(/\d{8,14}/g) || []).sort((a, b) => b.length - a.length);
  for (const r of runs) {
    const v = validGtin(r);
    if (v) return v;
  }
  return null;
}

/** Normalise to 13 digits for prefix reading (UPC-A 12 -> leading 0). */
function gtin13(d) {
  return d.length === 13 ? d : d.length === 12 ? "0" + d : d.length === 14 ? d.slice(1) : d;
}

/**
 * Gate 2, in code. Returns {isLocalBrand, localEvidence} for a barcode-bearing
 * row. Never returns true on anything but a valid GTIN with a local prefix.
 */
function localityFromBarcode(rawBarcode, sourceLabel) {
  const gtin = validGtin(rawBarcode);
  if (!gtin) {
    return {
      barcode: null,
      isLocalBrand: null,
      localEvidence:
        rawBarcode == null || rawBarcode === ""
          ? `no barcode published by ${sourceLabel} — origin of manufacture unknown`
          : `barcode as published by ${sourceLabel} (${String(rawBarcode).slice(0, 24)}) is not a valid GTIN (bad length or check digit) — rejected, not used as evidence`,
    };
  }
  const b13 = gtin13(gtin);
  const row = gs1Lookup(b13);
  if (!row) {
    return {
      barcode: gtin,
      isLocalBrand: null,
      localEvidence: `GS1 prefix ${b13.slice(0, 3)} on barcode ${gtin} is not in data/gs1-prefixes.json — origin undetermined`,
    };
  }
  if (row.isLocal) {
    return {
      barcode: gtin,
      isLocalBrand: true,
      localEvidence: `GS1 barcode prefix ${b13.slice(0, 3)} on barcode ${gtin} is ${row.country} (${row.note}) — the number was issued to a ${row.country} member company`,
    };
  }
  return {
    barcode: gtin,
    isLocalBrand: false,
    localEvidence: `GS1 barcode prefix ${b13.slice(0, 3)} on barcode ${gtin} is ${row.country}, not Kosovo (381/390) or Albania (530) — imported`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Polite HTTP: per-host serialisation of the delay, retries, timeout
// ─────────────────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const stats = { requests: 0, bytes: 0, errors: 0, robotsBlocked: 0 };

async function httpGet(url, { accept = "text/html,application/xhtml+xml,*/*", timeout = 30000, retries = 2 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeout);
    try {
      const res = await fetch(url, {
        redirect: "follow",
        headers: { "user-agent": UA, accept, "accept-language": "sq,en;q=0.8" },
        signal: ctl.signal,
      });
      clearTimeout(t);
      const text = await res.text();
      stats.requests++;
      stats.bytes += text.length;
      if (res.status === 429 || res.status >= 500) {
        if (attempt < retries) {
          await sleep(2000 * (attempt + 1));
          continue;
        }
      }
      return { ok: res.ok, status: res.status, text, finalUrl: res.url, headers: res.headers };
    } catch (err) {
      clearTimeout(t);
      if (attempt < retries) {
        await sleep(1500 * (attempt + 1));
        continue;
      }
      stats.errors++;
      return { ok: false, status: 0, text: "", finalUrl: url, error: String(err?.cause?.code || err?.name || err) };
    }
  }
  return { ok: false, status: 0, text: "", finalUrl: url, error: "unreachable" };
}

// ─────────────────────────────────────────────────────────────────────────────
// robots.txt — obeyed, never routed around
// ─────────────────────────────────────────────────────────────────────────────
const robotsCache = new Map();

async function robotsFor(origin) {
  if (robotsCache.has(origin)) return robotsCache.get(origin);
  const res = await httpGet(origin + "/robots.txt", { accept: "text/plain", retries: 1 });
  const rules = { allow: [], disallow: [], fetched: res.ok, status: res.status, sitemaps: [] };
  if (res.ok && /^\s*(user-agent|allow|disallow|sitemap)/im.test(res.text)) {
    let inStar = false;
    for (const rawLine of res.text.split(/\r?\n/)) {
      const line = rawLine.replace(/#.*$/, "").trim();
      if (!line) continue;
      const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
      if (!m) continue;
      const key = m[1].toLowerCase();
      const val = m[2].trim();
      if (key === "sitemap") { rules.sitemaps.push(val); continue; }
      if (key === "user-agent") { inStar = val === "*"; continue; }
      if (!inStar) continue;
      if (key === "allow" && val) rules.allow.push(val);
      if (key === "disallow" && val) rules.disallow.push(val);
    }
  }
  robotsCache.set(origin, rules);
  return rules;
}

/** Google-style: longest matching pattern wins; Allow beats Disallow on a tie. */
function patternMatches(pattern, pathAndQuery) {
  const esc = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  let rx = esc.replace(/\*/g, ".*");
  let anchorEnd = false;
  if (rx.endsWith("$")) { rx = rx.slice(0, -1); anchorEnd = true; }
  const re = new RegExp("^" + rx + (anchorEnd ? "$" : ""));
  return re.test(pathAndQuery) ? pattern.replace(/\*/g, "").length : -1;
}

async function robotsAllows(url) {
  const u = new URL(url);
  const rules = await robotsFor(u.origin);
  const pq = u.pathname + (u.search || "");
  let bestAllow = -1, bestDisallow = -1;
  for (const p of rules.allow) bestAllow = Math.max(bestAllow, patternMatches(p, pq));
  for (const p of rules.disallow) bestDisallow = Math.max(bestDisallow, patternMatches(p, pq));
  if (bestDisallow === -1) return { allowed: true, rule: null };
  if (bestAllow >= bestDisallow) return { allowed: true, rule: null };
  return { allowed: false, rule: rules.disallow.find((p) => patternMatches(p, pq) === bestDisallow) ?? "(disallow)" };
}

async function politeGet(url, opts) {
  const verdict = await robotsAllows(url);
  if (!verdict.allowed) {
    stats.robotsBlocked++;
    return { ok: false, status: -1, text: "", robotsBlocked: true, rule: verdict.rule, finalUrl: url };
  }
  return httpGet(url, opts);
}

// ─────────────────────────────────────────────────────────────────────────────
// Xapi — the recon gate. This is the "hire Xapi" half.
// ─────────────────────────────────────────────────────────────────────────────
async function xapiRecon(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 120000);
  try {
    const res = await fetch(XAPI_RECON, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url }),
      signal: ctl.signal,
    });
    clearTimeout(t);
    const j = await res.json();
    return {
      url,
      httpStatus: res.status,
      verdict: j.verdict ?? null,
      confidence: j.confidence ?? null,
      rootKind: j.root?.kind ?? null,
      framework: j.framework ?? null,
      signals: j.signals ?? null,
      probedEndpoints: (j.probedEndpoints ?? []).map((e) => ({ url: e.url, shape: e.shape, reachability: e.reachability?.kind })),
      summary: j.summary ?? null,
    };
  } catch (err) {
    clearTimeout(t);
    return { url, httpStatus: 0, verdict: null, error: String(err?.cause?.code || err?.name || err) };
  }
}

/** Xapi's own list of verdicts it will mint a wrapped API for. */
const XAPI_MINTABLE = ["reverse-engineerable-api", "reverse-engineerable-embedded", "cors-only-proxy-legit"];
/** Xapi's hard refusals. We refuse them too — a block is a block. */
const XAPI_REFUSED = ["blocked-do-not-build", "auth-required"];

// ─────────────────────────────────────────────────────────────────────────────
// Small HTML helpers (no dependency — this repo ships no cheerio)
// ─────────────────────────────────────────────────────────────────────────────
const decodeEntities = (s) =>
  String(s ?? "")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

const clean = (s) => decodeEntities(s).replace(/\s+/g, " ").trim();
const stripTags = (s) => clean(String(s ?? "").replace(/<[^>]+>/g, " "));

/** Pull "400G", "1.5L", "280g", "5 Kg" out of a product title. Keeps the raw. */
function parseQuantity(name) {
  if (!name) return { quantity: null, quantitySource: null };
  const m = String(name).match(
    /(\d+(?:[.,]\d+)?)\s*(kg|gr?|ml|cl|l|lit|litra|copë|cope|pcs|x\d+)\b/i,
  );
  if (!m) return { quantity: null, quantitySource: null };
  const num = m[1].replace(",", ".");
  let unit = m[2].toLowerCase();
  if (unit === "gr") unit = "g";
  if (unit === "lit" || unit === "litra") unit = "l";
  return { quantity: `${num}${unit}`, quantitySource: `parsed from product name: "${name}"` };
}

// ─────────────────────────────────────────────────────────────────────────────
// SOURCE ADAPTERS
// Every adapter returns { rows, notes }. Every row is already gated.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 1. maxiks.shop — Maxi Supermarket, a real Kosovo chain (19 retail points in
 *    Prishtina, 3 open 24h; maxiks.com). Custom PHP storefront (PHP 8.3,
 *    Laravel-style routes), robots.txt is "Disallow:" i.e. everything allowed.
 *
 *    The wrap: GET /search/suggest with NO query returns the WHOLE catalogue as
 *    HTML product cards (name + price + product URL) in one request — the
 *    site's own type-ahead endpoint, unfiltered. That is the index. Each
 *    /product/<slug> page then carries item_id, the € price in a hidden input,
 *    category/subcategory/childcategory, the gallery image and "Barkodi:".
 *
 *    Currency: the page ships <input id="set_currency" value="€">. We read it
 *    and refuse to write a price if it is not €.
 *    Barcodes: many are Excel-mangled ("#7.90E+12") and are dropped. Where the
 *    gallery image filename is itself a valid GTIN (Maxi names product photos
 *    after the barcode) that is used as a SECOND, separately-labelled source.
 */
const maxi = {
  key: "maxi",
  source: "maxiks.shop",
  sourceLabel: "Maxi Supermarket (e-shop)",
  reconUrl: "https://maxiks.shop/",
  country: "XK",
  kind: "retailer",
  note: "Kosovo supermarket chain, 19 retail points in Prishtina (maxiks.com). Retail listing only — sold-in-Kosovo, which proves nothing about who made it.",
  // A Kosovo grocery basket: nothing in it should cost 500 EUR, and a 0.00
  // is a missing price, not a free product.
  priceBand: [0.05, 400],

  async crawl({ limit }) {
    const notes = [];
    const idx = await politeGet("https://maxiks.shop/search/suggest");
    if (idx.robotsBlocked) { notes.push(`robots.txt Disallow (${idx.rule}) on /search/suggest — not fetched`); return { rows: [], notes }; }
    if (!idx.ok) { notes.push(`index /search/suggest returned ${idx.status} ${idx.error ?? ""}`); return { rows: [], notes }; }

    const slugs = [...new Set([...idx.text.matchAll(/href="https:\/\/maxiks\.shop\/product\/([A-Za-z0-9._%+-]+)"/g)].map((m) => m[1]))];
    notes.push(`index: GET /search/suggest (no query) returned the full catalogue in one response — ${slugs.length} distinct product URLs, ${idx.text.length} bytes`);
    const take = slugs.slice(0, Number.isFinite(limit) ? limit : slugs.length);

    const rows = [];
    let mangled = 0, fromImage = 0, priceRejected = 0;
    await runPool(take, OPTS.concurrency, async (slug) => {
      const url = `https://maxiks.shop/product/${slug}`;
      const res = await politeGet(url);
      if (res.robotsBlocked) { notes.push(`robots blocked ${url}`); return; }
      if (!res.ok) return;
      const h = res.text;

      const name = clean((h.match(/<h4 class="mb-2 p-title-main">([\s\S]*?)<\/h4>/) || [])[1] || "");
      if (!name) return;

      const itemId = (h.match(/id="item_id"\s+value="(\d+)"/) || [])[1] || null;
      const currencySym = clean((h.match(/value="([^"]*)"\s+id="set_currency"/) || [])[1] || "");
      const priceRaw = (h.match(/id="demo_price"\s+value="([\d.,]+)"/) || [])[1] || null;

      let price = null, currency = null, priceNote = null;
      const n = priceRaw ? Number(String(priceRaw).replace(",", ".")) : NaN;
      if (currencySym !== "€") {
        priceNote = `source currency indicator was "${currencySym}", not EUR — price withheld rather than guessed`;
        priceRejected++;
      } else if (!Number.isFinite(n) || n < maxi.priceBand[0] || n > maxi.priceBand[1]) {
        priceNote = `published price "${priceRaw}" is outside the plausibility band ${maxi.priceBand[0]}–${maxi.priceBand[1]} EUR for a Kosovo grocery item — withheld`;
        priceRejected++;
      } else {
        price = Number(n.toFixed(2));
        currency = "EUR";
      }

      const catBlock = (h.match(/Kategoria:<\/span>([\s\S]{0,700}?)<\/div>/) || [])[1] || "";
      const cats = [...catBlock.matchAll(/<a href="https:\/\/maxiks\.shop\/products\?\w+=[^"]*">([\s\S]*?)<\/a>/g)]
        .map((m) => clean(m[1]))
        .filter(Boolean);
      const category = cats.join(" / ") || null;

      const image =
        (h.match(/<div class="product-details-slider owl-carousel"[\s\S]{0,400}?<img src="([^"]+)"/) || [])[1] || null;

      // Two independent barcode candidates, kept apart on purpose.
      const printed = clean((h.match(/Barkodi:<\/span>\s*#?([^<]*)</) || [])[1] || "");
      let gate = localityFromBarcode(printed, maxi.sourceLabel);
      let barcodeSource = printed ? "printed on the product page (Barkodi field)" : null;
      if (/E\+\d/i.test(printed)) mangled++;

      if (!gate.barcode && image) {
        const v = gtinFromFilename(image);
        if (v) {
          gate = localityFromBarcode(v, maxi.sourceLabel);
          gate.localEvidence += "; barcode taken from the product photo's filename, which Maxi names after the GTIN — check digit verified";
          barcodeSource = "derived from the product image filename (Maxi names photos after the GTIN); check digit verified";
          fromImage++;
        }
      }

      const q = parseQuantity(name);
      rows.push({
        id: `maxiks.shop:${itemId ?? slug}`,
        source: maxi.source,
        sourceLabel: maxi.sourceLabel,
        name,
        brand: null,
        category,
        price,
        currency,
        image,
        url,
        barcode: gate.barcode,
        isLocalBrand: gate.isLocalBrand,
        localEvidence: gate.localEvidence,
        quantity: q.quantity,
        quantitySource: q.quantitySource,
        ...(priceNote ? { priceNote } : {}),
        ...(barcodeSource ? { barcodeSource } : {}),
        brandSource: null,
        matchKey: gate.barcode ? `gtin:${gate.barcode}` : null,
        sourceKind: "retailer",
        crawledAt: new Date().toISOString(),
      });
    });

    notes.push(`${mangled} product pages published an Excel-mangled barcode (scientific notation) — dropped, never stored`);
    notes.push(`${fromImage} barcodes recovered from the product photo filename and check-digit verified`);
    notes.push(`${priceRejected} prices withheld (wrong currency indicator or outside the plausibility band)`);
    return { rows, notes };
  },
};

/**
 * 2. bukabakery.com — Buka Bakery, Kosovo bread/pastry producer (founded 2012,
 *    100+ employees, 16 locations, 15 of them inside the Meridian Express
 *    store network). WordPress + WooCommerce, and the WooCommerce Store API
 *    (/wp-json/wc/store/v1/products) is open and public — a textbook
 *    "reverse-engineerable-api" source.
 *
 *    PRICES: the store publishes every product at "0" with currency_code GBP
 *    (an unconfigured WooCommerce). Writing that as "0.00 EUR" would be exactly
 *    the bug that cost this project 64.5% of its catalogue. So: price null,
 *    currency null, priceNote spelling out why.
 *
 *    LOCALITY: producer-own-site evidence (gate 2b). Buka is a Kosovar bakery
 *    and the products on its own site are its own production.
 */
function wooProducer(cfg) {
  return {
    ...cfg,
    kind: "producer",
    country: "XK",
    async crawl({ limit }) {
      const notes = [];
      const rows = [];
      const origin = new URL(cfg.reconUrl).origin;
      let page = 1;
      const perPage = 100;
      let zeroPriced = 0;
      let reportedCurrency = null;
      for (;;) {
        const url = `${origin}/wp-json/wc/store/v1/products?per_page=${perPage}&page=${page}`;
        const res = await politeGet(url, { accept: "application/json" });
        if (res.robotsBlocked) { notes.push(`robots.txt Disallow (${res.rule}) on ${url} — not fetched`); break; }
        if (!res.ok) { notes.push(`${url} -> ${res.status} ${res.error ?? ""}`); break; }
        let batch;
        try { batch = JSON.parse(res.text); } catch { notes.push(`${url} did not return JSON`); break; }
        if (!Array.isArray(batch) || batch.length === 0) break;

        for (const p of batch) {
          const name = clean(p.name);
          if (!name) continue;
          const sku = p.sku ? String(p.sku).trim() : "";
          const gate = localityFromBarcode(sku, cfg.sourceLabel);

          // Producer-own-site evidence covers an ABSENT barcode. It never
          // overrides a barcode that says foreign — that stays false.
          let isLocalBrand = gate.isLocalBrand;
          let localEvidence = gate.localEvidence;
          if (isLocalBrand !== false) {
            isLocalBrand = true;
            localEvidence =
              cfg.producerEvidence +
              (gate.barcode
                ? `; its own barcode ${gate.barcode} agrees (${gate.localEvidence})`
                : `. No barcode is published on the product page, so the locality claim rests on the producer citation alone, not on a GS1 prefix`);
          }

          // PRICE. These producer stores are catalogues: WooCommerce is
          // installed but unpriced, so every product comes back at "0".
          // A "0" is a missing price, not a free product, and writing it as
          // EUR would be the Lek-as-EUR bug in a new coat.
          const cur = p.prices?.currency_code ?? null;
          const rawPrice = p.prices?.price ?? null;
          reportedCurrency = cur;
          const minor = Number(p.prices?.currency_minor_unit ?? 2);
          const numeric = rawPrice == null ? NaN : Number(rawPrice) / Math.pow(10, minor);
          let price = null, currency = null, priceNote = null;
          if (!Number.isFinite(numeric) || numeric <= 0) {
            zeroPriced++;
            priceNote =
              `${cfg.source}'s WooCommerce publishes price "${rawPrice}" in ${cur} — an unpriced catalogue store, ` +
              `not a real Kosovo price. Writing it as EUR would repeat the Lek-as-EUR bug, so the price is withheld.`;
          } else if (cur !== "EUR") {
            priceNote = `${cfg.source} reports its price in ${cur}, not EUR — withheld rather than converted or mislabelled.`;
          } else {
            price = Number(numeric.toFixed(2));
            currency = "EUR";
          }

          const q = parseQuantity(name);
          rows.push({
            id: `${cfg.source}:${p.id}`,
            source: cfg.source,
            sourceLabel: cfg.sourceLabel,
            name,
            brand: cfg.brand,
            category: (p.categories ?? []).map((c) => clean(c.name)).join(" / ") || cfg.defaultCategory,
            price,
            currency,
            ...(priceNote ? { priceNote } : {}),
            image: p.images?.[0]?.src ?? null,
            url: p.permalink ?? `${origin}/?p=${p.id}`,
            barcode: gate.barcode,
            isLocalBrand,
            localEvidence,
            quantity: q.quantity,
            quantitySource: q.quantitySource,
            brandSource: "producer's own website",
            matchKey: gate.barcode ? `gtin:${gate.barcode}` : null,
            sourceKind: "producer",
            ingredients: p.short_description ? stripTags(p.short_description) : null,
            crawledAt: new Date().toISOString(),
          });
          if (rows.length >= limit) break;
        }
        if (rows.length >= limit || batch.length < perPage) break;
        page++;
      }
      notes.push(`WooCommerce Store API ${origin}/wp-json/wc/store/v1/products, ${page} page(s), ${rows.length} products`);
      if (zeroPriced) notes.push(`${zeroPriced} prices withheld: the store reports "0" (currency_code ${reportedCurrency}) — an unpriced catalogue, not a Kosovo price`);
      return { rows, notes };
    },
  };
}

const buka = wooProducer({
  key: "buka",
  source: "bukabakery.com",
  sourceLabel: "Buka Bakery",
  reconUrl: "https://bukabakery.com/",
  brand: "Buka Bakery",
  defaultCategory: "Pjekurina / Bukë",
  producerEvidence:
    "bukabakery.com is the own website of Buka Bakery, a Kosovar bread and pastry producer (founded 2012, 16 locations in Kosovo, 15 of them inside the Meridian Express network; see https://bukabakery.com/about-us/). The products listed there are its own production, so the BRAND is Kosovar",
  note: "Kosovar bread/pastry producer. Catalogue only — the WooCommerce store publishes no prices.",
});

/**
 * 5. vipa-ks.com — Vipa Chips, the snack brand of Pestova sh.p.k, Vushtrri,
 *    Kosovo: one of the country's largest potato processors (est. 1991,
 *    re-registered 1999), selling into 8 EU countries. Potato crisps, flips,
 *    stix, popcorn and extruded snacks — the savoury-snacks family the finder
 *    has three unanswered requests for.
 *
 *    Same shape as Buka: an open WooCommerce Store API, and the same unpriced
 *    catalogue (every product "0", currency_code EUR). Prices withheld.
 */
const vipa = wooProducer({
  key: "vipa",
  source: "vipa-ks.com",
  sourceLabel: "Vipa Chips (Pestova, Vushtrri)",
  reconUrl: "https://vipa-ks.com/en/",
  brand: "Vipa",
  defaultCategory: "Snacks",
  producerEvidence:
    "vipa-ks.com is the own website of Vipa Chips, the snack brand of Pestova sh.p.k, a Kosovar potato processor in Vushtrri, Kosovo (est. 1991; see https://vipa-ks.com/en/ and https://www.potatopro.com/brands/vipa-chips). The products listed there are its own production, so the BRAND is Kosovar",
  note: "Kosovar potato-snack producer (Pestova, Vushtrri). Catalogue only — the WooCommerce store publishes no prices.",
});

/**
 * 3. euro-food.org — Eurofood sh.p.k, Rr. Turgut Ozal, Prizren / Kosova.
 *    Producer of ajvar, ketchup, mayonnaise, jams, syrups, pickles, vinegar,
 *    juices and water. Plain PHP; each products.php?category=N page renders the
 *    products as cards carrying data-product-name / -image / -weight / -shija.
 *    No robots.txt (404) — crawling is permitted by default; we still throttle.
 *
 *    No prices and no barcodes are published. Both are written as null with the
 *    reason. The WEIGHT is published, which is exactly the field the catalogue
 *    is missing everywhere else.
 */
const eurofood = {
  key: "eurofood",
  source: "euro-food.org",
  sourceLabel: "Eurofood (Prizren)",
  reconUrl: "https://www.euro-food.org/",
  country: "XK",
  kind: "producer",
  producerEvidence:
    "euro-food.org is the own website of Eurofood sh.p.k, a Kosovar food producer at Rr. Turgut Ozal, Prizren, Kosovo (address and phone +381 29 241774 published in the site footer). The products listed there are its own production, so the BRAND is Kosovar",
  categories: {
    1: "Ketchup",
    2: "Majonez",
    3: "Ajvar",
    4: "Family",
    5: "Lëngje",
    6: "Turshi",
    7: "Uthull",
    8: "Ujë",
    9: "Sirup",
    10: "Mermelatë",
  },

  async crawl({ limit }) {
    const notes = [];
    const rows = [];
    const seen = new Set();
    for (const [id, label] of Object.entries(eurofood.categories)) {
      if (rows.length >= limit) break;
      const url = `https://www.euro-food.org/products.php?category=${id}`;
      const res = await politeGet(url);
      if (res.robotsBlocked) { notes.push(`robots.txt Disallow (${res.rule}) on ${url} — not fetched`); continue; }
      if (!res.ok) { notes.push(`${url} -> ${res.status} ${res.error ?? ""}`); continue; }

      const grid = res.text.slice(res.text.indexOf('row product-grid'));
      const cards = [...grid.matchAll(/<div class="product-name"([\s\S]*?)>\s*([\s\S]*?)<\/div>/g)];
      for (const c of cards) {
        const attrs = c[1];
        const attr = (k) => clean((attrs.match(new RegExp(`data-product-${k}="([^"]*)"`)) || [])[1] || "");
        const name = attr("name") || clean(c[2]);
        if (!name) continue;
        const weight = attr("weight");
        const flavour = attr("shija");
        const img = attr("image");
        const key = `${label}|${name}|${weight}|${flavour}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const fullName = [name, weight, flavour && flavour !== "" ? `(${flavour})` : ""].filter(Boolean).join(" ").trim();
        rows.push({
          id: `euro-food.org:${slugify(key)}`,
          source: eurofood.source,
          sourceLabel: eurofood.sourceLabel,
          name: fullName,
          brand: "Eurofood",
          category: label,
          price: null,
          currency: null,
          priceNote: "euro-food.org is a producer catalogue and publishes no retail price — unknown, not guessed",
          image: img ? `https://www.euro-food.org/${img.replace(/^\/+/, "")}` : null,
          url,
          barcode: null,
          isLocalBrand: true,
          localEvidence: `${eurofood.producerEvidence}. No barcode is published on the catalogue page, so the locality claim rests on the producer citation alone, not on a GS1 prefix`,
          quantity: weight || parseQuantity(name).quantity,
          quantitySource: weight ? `published by the producer as data-product-weight on ${url}` : parseQuantity(name).quantitySource,
          brandSource: "producer's own website",
          matchKey: null,
          sourceKind: "producer",
          flavour: flavour || null,
          crawledAt: new Date().toISOString(),
        });
        if (rows.length >= limit) break;
      }
      notes.push(`category ${id} (${label}): ${cards.length} cards`);
    }
    notes.push("no robots.txt is served (404) — crawling permitted by default; still throttled");
    notes.push("no prices and no barcodes are published by this producer; both written as null with the reason");
    return { rows, notes };
  },
};

/**
 * 4. amgketchup-ks.com — AMG Foods, Ballofc, Podujevë, Kosovë 11000.
 *    "Fabrika për prodhimin dhe përpunimin e produkteve ushqimore."
 *    Ketchup, mayonnaise and SENF (mustard) plus pickles. WordPress/Elementor;
 *    the product grid on /produktet/ is plain server-rendered HTML.
 *    robots.txt allows everything except /wp-admin/.
 *
 *    This is the only source found that covers mustard, which the finder has
 *    two unanswered requests for.
 */
const amg = {
  key: "amg",
  source: "amgketchup-ks.com",
  sourceLabel: "AMG Foods (Podujevë)",
  reconUrl: "https://amgketchup-ks.com/produktet/",
  country: "XK",
  kind: "producer",
  producerEvidence:
    "amgketchup-ks.com is the own website of AMG Foods, a Kosovar food factory at Ballofc, Podujevë, Kosovë 11000 (address and phone +383 49 313 986 published on the page; the site describes itself as \"Fabrika për prodhimin dhe përpunimin e produkteve ushqimore\"). The products listed there are its own production, so the BRAND is Kosovar",

  async crawl({ limit }) {
    const notes = [];
    const rows = [];
    const url = "https://amgketchup-ks.com/produktet/";
    const res = await politeGet(url);
    if (res.robotsBlocked) { notes.push(`robots.txt Disallow (${res.rule}) on ${url} — not fetched`); return { rows, notes }; }
    if (!res.ok) { notes.push(`${url} -> ${res.status} ${res.error ?? ""}`); return { rows, notes }; }

    // Elementor renders each product as a heading (name) followed by a size and
    // an optional variant line. Walk the visible text of the products section.
    const body = res.text.replace(/<(script|style)[\s\S]*?<\/\1>/g, "");
    const startIdx = body.indexOf("PRODUKTET");
    const section = body.slice(startIdx === -1 ? 0 : startIdx);
    const tokens = section
      .replace(/<[^>]+>/g, "\n")
      .split("\n")
      .map((s) => clean(s))
      .filter(Boolean);

    const HEADINGS = new Set(["KETCHUP", "MAJONEZ", "SENF", "PRODUKTE TJERA"]);
    const SIZE = /^\d+(?:[.,]\d+)?\s*(kg|gr|g|ml|l)$/i;
    let group = null;
    const stop = tokens.findIndex((t) => /^Fabrika p/i.test(t));
    const list = stop === -1 ? tokens : tokens.slice(0, stop);

    for (let i = 0; i < list.length; i++) {
      const t = list[i];
      if (HEADINGS.has(t.toUpperCase()) && !SIZE.test(list[i + 1] ?? "")) { group = t.toUpperCase(); continue; }
      if (!group) continue;
      const size = list[i + 1];
      if (!size || !SIZE.test(size)) continue;
      const variant = list[i + 2] && !SIZE.test(list[i + 2]) && !HEADINGS.has((list[i + 2] || "").toUpperCase()) && /^I\s|^Extra$/i.test(list[i + 2]) ? list[i + 2] : null;
      const name = [t, size, variant ? `(${variant})` : ""].filter(Boolean).join(" ").trim();
      const key = slugify(name);
      if (rows.some((r) => r.id === `amgketchup-ks.com:${key}`)) continue;
      const category = group === "PRODUKTE TJERA" ? "Turshi" : group === "SENF" ? "Senf (mustard)" : group;
      rows.push({
        id: `amgketchup-ks.com:${key}`,
        source: amg.source,
        sourceLabel: amg.sourceLabel,
        name,
        brand: "AMG",
        category,
        price: null,
        currency: null,
        priceNote: "amgketchup-ks.com is a producer catalogue and publishes no retail price — unknown, not guessed",
        image: null,
        url,
        barcode: null,
        isLocalBrand: true,
        localEvidence: `${amg.producerEvidence}. No barcode is published on the catalogue page, so the locality claim rests on the producer citation alone, not on a GS1 prefix`,
        quantity: size.replace(/\s+/g, "").toLowerCase().replace(/^(\d+(?:[.,]\d+)?)gr$/, "$1g"),
        quantitySource: `published by the producer next to the product name on ${url}`,
        brandSource: "producer's own website",
        matchKey: null,
        sourceKind: "producer",
        flavour: variant,
        crawledAt: new Date().toISOString(),
      });
      if (rows.length >= limit) break;
    }
    notes.push(`${rows.length} products parsed from the /produktet/ grid (ketchup, majonez, senf, turshi)`);
    notes.push("no prices and no barcodes are published by this producer; both written as null with the reason");
    return { rows, notes };
  },
};

const SOURCES = [maxi, buka, vipa, eurofood, amg];

/**
 * Sources checked and NOT crawled. Recorded so nobody re-spends the hours,
 * and so the owner can see exactly where the wall is.
 */
const REJECTED = [
  {
    source: "online.vivafresh.shop",
    label: "Viva Fresh Store (online shop)",
    why: "robots-disallowed",
    detail:
      "Viva Fresh is Kosovo's largest retailer (110+ stores) and its online shop has ~7,400 products across 75 sitemaps. Its product pages are client-rendered Next.js with NO data in the HTML; all product data is fetched through /lib/config/proxy.php?endpoint=... (found by reading the site's own JS chunk 6217). robots.txt on that host contains 'Disallow: /lib/'. The only data path is the one the site tells crawlers to stay out of, so it is not crawled. Sitemap-listed /product?id=N pages are allowed but carry no data.",
  },
  {
    source: "gjirafamall.com",
    label: "GjirafaMall",
    why: "xapi-recon-refused",
    detail:
      "Xapi POST /admin/recon returned verdict 'blocked-do-not-build' (confidence high, root kind 'server-block'). Xapi's own honesty gate refuses this and so do we — getting through would be evasion.",
  },
  {
    source: "gertifoods.com",
    label: "Gerti Foods (Prizren, half-baked bakery)",
    why: "robots-disallowed-api",
    detail:
      "Kosovar bread producer in Prizren. robots.txt is 'Allow: /' for pages but explicitly 'Disallow: /api/'. The product data lives behind /api/, so the structured path is closed. Left for a later HTML-only pass.",
  },
  {
    source: "madein-kosova.com",
    label: "Made in Kosova (producer directory)",
    why: "unreachable",
    detail:
      "A directory of Kosovar producers with a 'Mayonnaise and ketchup' section — exactly the weak categories. DNS does not resolve from this machine (EAI_AGAIN) and Xapi recon reported root kind 'server-error'. Not crawled; worth a retry.",
  },
  {
    source: "abi-center.com",
    label: "ABI sh.p.k (Prizren)",
    why: "no-product-catalogue",
    detail:
      "Kosovar processor (took over the former PROGRES fruit-and-vegetable factory in Prizren in 2001, with ELIF 19). Xapi recon verdict 'reverse-engineerable-embedded' (WordPress with JSON-LD), but sitemap_index.xml has no product post type — a corporate site, nothing to crawl.",
  },
  {
    source: "essigroup.eu",
    label: "Essi Group",
    why: "too-few-products",
    detail:
      "Kosovar producer (Krasniqi family, est. 2014). Its products-sitemap.xml lists 5 products, all '444 Extra' tea. Real but tiny; no weak category is covered by it.",
  },
  {
    source: "elkosgroup.com / frutomania.com / rugove.com",
    label: "Elkos Group, Frutomania, Rugove",
    why: "no-product-catalogue",
    detail:
      "Xapi recon verdict 'no-obvious-data-source' on all three: reachable corporate/brochure sites with no product listing to wrap.",
  },
  {
    source: "albimarket.com / meridianexpress.com / emonagroup.com",
    label: "Albi Market, Meridian Express, Emona Group",
    why: "no-shop",
    detail:
      "Xapi recon verdict 'reverse-engineerable-embedded' (WordPress), but /wp-json/ shows no WooCommerce namespace on any of them — brochure sites for the store chains, no online catalogue. 35 / 36 / 9 physical stores respectively in data/kosovo-stores.json.",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────
function slugify(s) {
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

/** Bounded-concurrency worker pool with a per-worker politeness delay. */
async function runPool(items, concurrency, fn) {
  const queue = [...items];
  let done = 0;
  const total = items.length;
  await Promise.all(
    Array.from({ length: Math.max(1, concurrency) }, async () => {
      while (queue.length) {
        const item = queue.shift();
        try { await fn(item); } catch (e) { stats.errors++; }
        done++;
        if (done % 100 === 0) process.stdout.write(`    ...${done}/${total}\n`);
        if (OPTS.delay > 0) await sleep(OPTS.delay);
      }
    }),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  const started = Date.now();
  const chosen = OPTS.sources ? SOURCES.filter((s) => OPTS.sources.includes(s.key)) : SOURCES;
  if (chosen.length === 0) {
    console.error(`no source matched --sources=${OPTS.sources?.join(",")}; known: ${SOURCES.map((s) => s.key).join(", ")}`);
    process.exit(1);
  }

  log(`xapi-crawl — ${chosen.length} source(s), concurrency ${OPTS.concurrency}, delay ${OPTS.delay}ms`);
  log(`Xapi recon gate: ${OPTS.noRecon ? "SKIPPED (--no-recon)" : XAPI_RECON}`);

  const sourceReports = [];
  const allRows = [];

  for (const src of chosen) {
    log(`\n=== ${src.source} (${src.kind}) ===`);

    // 1. THE XAPI GATE. Nothing is fetched before Xapi has ruled on the source.
    let recon = null;
    if (!OPTS.noRecon) {
      recon = await xapiRecon(src.reconUrl);
      log(`  xapi recon: verdict=${recon.verdict} confidence=${recon.confidence} root=${recon.rootKind} framework=${recon.framework}`);
      if (recon.verdict && XAPI_REFUSED.includes(recon.verdict)) {
        warn(`Xapi refuses this source (${recon.verdict}) — not crawling. A block is a block.`);
        sourceReports.push({ ...srcMeta(src), xapiRecon: recon, crawled: false, reason: `xapi verdict ${recon.verdict}`, count: 0, notes: [] });
        continue;
      }
      // Xapi's own recon is HTML-only: it reads the served page, not the JS
      // bundles, so a client-rendered shop gets "no-obvious-data-source" even
      // when a real endpoint exists. That is a gate we log, not a veto.
      if (recon.verdict && !XAPI_MINTABLE.includes(recon.verdict)) {
        log(`  note: verdict "${recon.verdict}" is below Xapi's own mint bar; crawling anyway because the endpoint was located by reading the site's own client code, and recon only reads the served HTML`);
      }
      await sleep(3500); // stay well inside the 20 req / 60s public limit
    }

    if (OPTS.reconOnly) {
      sourceReports.push({ ...srcMeta(src), xapiRecon: recon, crawled: false, reason: "--recon-only", count: 0, notes: [] });
      continue;
    }

    // 2. robots.txt, before anything else.
    const origin = new URL(src.reconUrl).origin;
    const rb = await robotsFor(origin);
    log(`  robots.txt: ${rb.fetched ? `HTTP ${rb.status}` : "not served"} — ${rb.disallow.length} Disallow rule(s)`);

    // 3. The crawl.
    const t0 = Date.now();
    const { rows, notes } = await src.crawl({ limit: OPTS.limit });
    const ms = Date.now() - t0;
    const local = rows.filter((r) => r.isLocalBrand === true).length;
    const withBarcode = rows.filter((r) => r.barcode).length;
    const withPrice = rows.filter((r) => r.price != null).length;
    log(`  ${rows.length} rows in ${(ms / 1000).toFixed(1)}s — ${withPrice} priced, ${withBarcode} with a valid GTIN, ${local} proven local`);
    for (const n of notes) log(`    · ${n}`);

    allRows.push(...rows);
    sourceReports.push({
      ...srcMeta(src),
      xapiRecon: recon,
      crawled: true,
      count: rows.length,
      priced: withPrice,
      withValidBarcode: withBarcode,
      provenLocal: local,
      robots: { served: rb.fetched, status: rb.status, disallow: rb.disallow, sitemaps: rb.sitemaps },
      notes,
      crawlMs: ms,
    });
  }

  const out = {
    builtAt: new Date().toISOString(),
    generator: "scripts/xapi-crawl.mjs",
    purpose:
      "New Kosovo retail + Kosovar-producer rows, sourced via Xapi's public recon gate and crawled here. NOT merged into data/kosovo-retail.json — see docs/XAPI-SOURCING.md for the merge step.",
    xapi: {
      deployment: "https://xapi.prishtina-online.workers.dev",
      usedEndpoint: "POST /admin/recon (public, no token, per-IP rate-limited 20/60s)",
      notUsed:
        "POST /admin/wrap — requires the full ADMIN_TOKEN and stores one <=5MB single-endpoint R2 snapshot with no pagination, so it cannot hold a paginated grocery catalogue. See docs/XAPI-SOURCING.md.",
    },
    honestyGates: [
      "isLocalBrand:true requires either a check-digit-valid GTIN with GS1 prefix 381/390/530, or a cited Kosovar producer's own website. Every row says which, in localEvidence.",
      "Barcodes are GTIN check-digit validated; Excel-mangled values (7.90E+12) are dropped, never stored.",
      "A price is written only when the source states its currency and the value is plausible; otherwise price:null with priceNote.",
      "robots.txt is obeyed; disallowed paths are recorded in rejectedSources and not fetched.",
      "Kosovo only — every source is a Kosovo-registered company with a Kosovo address.",
    ],
    count: allRows.length,
    sources: sourceReports,
    rejectedSources: REJECTED,
    stats: { ...stats, elapsedMs: Date.now() - started },
    products: allRows,
  };

  const outPath = path.isAbsolute(OPTS.out) ? OPTS.out : path.join(REPO, OPTS.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 1));

  log(`\n=== TOTAL ===`);
  log(`  ${allRows.length} rows -> ${path.relative(REPO, outPath)}`);
  log(`  proven local: ${allRows.filter((r) => r.isLocalBrand === true).length}`);
  log(`    · by GS1 barcode prefix:  ${allRows.filter((r) => r.isLocalBrand === true && r.barcode).length}`);
  log(`    · by producer citation:   ${allRows.filter((r) => r.isLocalBrand === true && !r.barcode).length}`);
  log(`  not local (foreign GS1):    ${allRows.filter((r) => r.isLocalBrand === false).length}`);
  log(`  undetermined (null):        ${allRows.filter((r) => r.isLocalBrand == null).length}`);
  log(`  priced: ${allRows.filter((r) => r.price != null).length} · with quantity: ${allRows.filter((r) => r.quantity).length}`);
  log(`  http: ${stats.requests} requests, ${(stats.bytes / 1e6).toFixed(1)} MB, ${stats.errors} errors, ${stats.robotsBlocked} robots-blocked`);
}

function srcMeta(s) {
  return { source: s.source, sourceLabel: s.sourceLabel, kind: s.kind, country: s.country, url: s.reconUrl, note: s.note ?? null };
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
