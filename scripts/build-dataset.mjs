#!/usr/bin/env node
/**
 * build-dataset.mjs
 *
 * Builds Vendorja's DATA layer from Open Food Facts (OFF):
 *   - data/local-products.json  : the pool of Kosovo/Albania-country-tagged
 *                                  products usable as "local alternatives"
 *   - data/category-index.json  : inverted index category-tag -> local codes
 *
 * WHY things are done this way
 * -----------------------------
 * 1. PAGINATION: OFF's /api/v2/search caps page_size at 100. Kosovo has
 *    ~327 matches and Albania ~1102, so both need many pages. We page until
 *    we've walked page_count (from the API's own response) or hit an empty
 *    page, whichever comes first -- never assume a fixed page count.
 *
 * 2. RETRY WITH BACKOFF: OFF is intermittently flaky -- observed HTTP 503
 *    "Page temporarily unavailable" responses that clear up on retry within
 *    a few seconds. A single failed request must NOT abort the harvest or
 *    silently truncate the dataset, so every request is retried with
 *    exponential backoff (and jitter) before we give up on that page.
 *
 * 3. DROPPING ROWS WITHOUT product_name OR image: the whole point of
 *    local-products.json is to be shown to a shopper as a visual
 *    alternative ("here's a local yogurt instead"). A row with no name or
 *    no photo cannot be rendered as a real alternative in the UI, so it is
 *    worse than useless in this dataset -- it would look like a broken
 *    tile. We drop it here, once, rather than making every UI consumer
 *    defend against nulls.
 *
 * 4. DEDUPE BY code: a product can carry both the "kosovo" and "albania"
 *    OFF country tags (imported into both marketplaces), so harvesting both
 *    country queries can yield the same barcode twice. We keep the first
 *    occurrence and record whichever country we saw first.
 *
 * 5. HONESTY: this script does NOT infer or claim manufacturing origin. It
 *    only records what OFF itself reports (its countries_tags reflect where
 *    the product is SOLD/labelled, per OFF's own data model) plus the GS1
 *    prefix parsed from the barcode, which per GS1's own documentation
 *    identifies the issuing GS1 member organisation, not country of origin.
 *
 * Re-run any time with:  node scripts/build-dataset.mjs
 */

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const PAGE_SIZE = 100;
const MAX_RETRIES = 8;
const BASE_DELAY_MS = 1500;
const MAX_DELAY_MS = 10000; // cap backoff so one bad page can't stall the run for minutes

const FIELDS = [
  "code",
  "product_name",
  "brands",
  "categories_tags",
  "countries_tags",
  "image_front_small_url",
  "quantity",
].join(",");

const COUNTRIES = ["kosovo", "albania"];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch a URL with exponential backoff + jitter retry. OFF returns HTML
 * (not JSON) on its "temporarily unavailable" 503 page, so we validate the
 * response is actually parseable JSON before accepting it -- a 200 with an
 * HTML body would otherwise poison the dataset.
 */
async function fetchJsonWithRetry(url, { retries = MAX_RETRIES } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "application/json",
        },
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const text = await res.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error("non-JSON response (likely a 503 HTML fallback page)");
      }
      return json;
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        const backoff = Math.min(BASE_DELAY_MS * 2 ** (attempt - 1), MAX_DELAY_MS);
        const jitter = Math.floor(Math.random() * 500);
        const delay = backoff + jitter;
        console.warn(
          `  [retry ${attempt}/${retries}] ${url} -> ${err.message}; waiting ${delay}ms`
        );
        await sleep(delay);
      }
    }
  }
  throw new Error(`Failed after ${retries} attempts: ${url}\nLast error: ${lastErr}`);
}

async function harvestCountry(country) {
  const products = [];
  let page = 1;
  // NOTE: OFF's /api/v2/search response field named "page_count" is
  // misleading -- empirically it reports the number of items IN THIS PAGE,
  // not the total number of pages available (e.g. page_size=100 returns
  // page_count=100 on a full page, page_count=27 on the last, partial one).
  // The real total-pages bound has to be derived from `count` (the total
  // matching product count, reported once and consistent across pages)
  // divided by our requested page_size. We compute it after page 1.
  let totalPages = null;
  const urlsUsed = [];
  const skippedPages = [];

  do {
    const url = `https://world.openfoodfacts.org/api/v2/search?countries_tags_en=${country}&fields=${FIELDS}&page_size=${PAGE_SIZE}&page=${page}`;
    urlsUsed.push(url);
    console.log(`Fetching ${country} page ${page}${totalPages ? `/${totalPages}` : ""}...`);

    let json;
    try {
      json = await fetchJsonWithRetry(url);
    } catch (err) {
      // A page that stays 503 after every retry must not sink the whole
      // harvest -- skip it, note it honestly in the final report, and keep
      // going so we still get every other page's real data.
      console.warn(`  SKIPPING ${country} page ${page} after exhausting retries: ${err.message}`);
      skippedPages.push(page);
      page++;
      if (totalPages && page > totalPages) break;
      await sleep(500);
      continue;
    }

    if (totalPages === null) {
      const totalCount = Number(json.count) || 0;
      totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
    }

    const batch = Array.isArray(json.products) ? json.products : [];
    console.log(`  got ${batch.length} products (reported count=${json.count})`);
    if (batch.length === 0) break;
    products.push(...batch);
    page++;

    // Be polite to a free, shared, no-auth API.
    await sleep(300);
  } while (page <= totalPages);

  return { products, urlsUsed, skippedPages, totalPages };
}

function firstOf(value) {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  // brands often comes as a comma-separated string, e.g. "Brand A,Brand B"
  const first = String(value).split(",")[0].trim();
  return first || null;
}

function prefixOf(code) {
  const digits = String(code).replace(/\D/g, "");
  return digits.slice(0, 3);
}

async function main() {
  await mkdir(DATA_DIR, { recursive: true });

  const sources = [];
  const byCode = new Map(); // code -> row, first-seen wins
  const dropCounts = { noName: 0, noImage: 0 };
  const rawCounts = {};
  const skippedPagesByCountry = {};

  for (const country of COUNTRIES) {
    const { products, urlsUsed, skippedPages, totalPages } = await harvestCountry(country);
    sources.push(...urlsUsed);
    rawCounts[country] = products.length;
    skippedPagesByCountry[country] = { skippedPages, totalPages };
    if (skippedPages.length > 0) {
      console.warn(
        `WARNING: ${country} had ${skippedPages.length}/${totalPages} page(s) unreachable after retries: [${skippedPages.join(", ")}]`
      );
    }

    for (const p of products) {
      const name = p.product_name ? String(p.product_name).trim() : "";
      const image = p.image_front_small_url ? String(p.image_front_small_url).trim() : "";

      if (!name) {
        dropCounts.noName++;
        continue;
      }
      if (!image) {
        dropCounts.noImage++;
        continue;
      }

      if (byCode.has(p.code)) continue; // dedupe: keep first-seen

      byCode.set(p.code, {
        code: p.code,
        name,
        brand: firstOf(p.brands),
        categoriesTags: Array.isArray(p.categories_tags) ? p.categories_tags : [],
        image,
        quantity: p.quantity ? String(p.quantity).trim() : null,
        country,
        prefix: prefixOf(p.code),
      });
    }
  }

  const productsOut = Array.from(byCode.values());

  const localProducts = {
    builtAt: new Date().toISOString(),
    count: productsOut.length,
    sources,
    // Honest accounting: raw fetched rows and drop reasons per country, plus
    // any pages that stayed unreachable after every retry (so a thin result
    // for a country is visibly explained, not silently under-counted).
    harvest: {
      rawCounts,
      dropCounts,
      skippedPagesByCountry,
    },
    products: productsOut,
  };

  await writeFile(
    path.join(DATA_DIR, "local-products.json"),
    JSON.stringify(localProducts, null, 2),
    "utf8"
  );

  // ---- category-index.json ----
  // Inverted index: OFF category tag -> local product codes carrying it.
  // OFF category tags run general -> specific (e.g. "en:dairies" is a
  // broader/ancestor tag than "en:yogurts"); OFF does not give us the tree
  // structure directly in this field, so we approximate "depth" by tag
  // length (specificity roughly correlates with a longer, more qualified
  // tag string) purely as a hint for consumers -- it is not authoritative
  // taxonomy depth, just a cheap ordering signal alongside `count`.
  const tagMap = new Map(); // tag -> Set(codes)
  for (const p of productsOut) {
    for (const tag of p.categoriesTags) {
      if (!tagMap.has(tag)) tagMap.set(tag, new Set());
      tagMap.get(tag).add(p.code);
    }
  }

  const tags = {};
  for (const [tag, codeSet] of tagMap.entries()) {
    const codes = Array.from(codeSet);
    tags[tag] = {
      count: codes.length,
      codes,
    };
  }

  const categoryIndex = {
    builtAt: new Date().toISOString(),
    tags,
  };

  await writeFile(
    path.join(DATA_DIR, "category-index.json"),
    JSON.stringify(categoryIndex, null, 2),
    "utf8"
  );

  // ---- report ----
  console.log("\n=== Build report ===");
  for (const country of COUNTRIES) {
    const { skippedPages, totalPages } = skippedPagesByCountry[country];
    console.log(
      `${country}: ${rawCounts[country]} raw rows fetched` +
        (skippedPages.length
          ? ` (WARNING: ${skippedPages.length}/${totalPages} pages unreachable: [${skippedPages.join(", ")}])`
          : ` (all ${totalPages} pages fetched)`)
    );
  }
  console.log(`Dropped (no product_name): ${dropCounts.noName}`);
  console.log(`Dropped (no image): ${dropCounts.noImage}`);
  console.log(`Final usable local products (deduped by code): ${productsOut.length}`);
  console.log(`Distinct category tags indexed: ${Object.keys(tags).length}`);
  console.log(`Wrote: ${path.join(DATA_DIR, "local-products.json")}`);
  console.log(`Wrote: ${path.join(DATA_DIR, "category-index.json")}`);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
