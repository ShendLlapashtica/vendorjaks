#!/usr/bin/env node
/**
 * verify-dataset.mjs
 *
 * Sanity-checks data/local-products.json against reality (not just against
 * itself), because a JSON file that merely looks well-formed can still be
 * full of dead image links or duplicate rows that would silently break the
 * "show a local alternative" UX. This script:
 *
 *   1. Samples 25 random local products and HEAD-checks:
 *        - the product's image URL is actually reachable
 *        - the product's Open Food Facts page (world.openfoodfacts.org
 *          /product/<code>) is actually reachable
 *      and reports the % reachable for each, rather than assuming a 200
 *      response just because the URL was recorded at harvest time --
 *      OFF images can be re-processed/removed after the fact.
 *
 *   2. Confirms 0 duplicate `code` values across the whole file (dedupe
 *      correctness), not just in the sample.
 *
 *   3. Confirms every product has at least one category tag (an
 *      uncategorised "alternative" cannot be matched to anything a
 *      shopper scanned, so it would be silently useless in the app).
 *
 *   4. Prints per-country counts.
 *
 * Run with: node scripts/verify-dataset.mjs
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const SAMPLE_SIZE = 25;
const MAX_RETRIES = 4;
const BASE_DELAY_MS = 1000;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** HEAD-check a URL with retry/backoff (network is flaky; a single 503
 * should not be reported as "dead" when it might just be transient). */
async function isReachable(url) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      let res = await fetch(url, {
        method: "HEAD",
        headers: { "User-Agent": USER_AGENT },
        redirect: "follow",
      });
      // Some hosts (incl. OFF product pages) don't support HEAD cleanly;
      // fall back to a ranged GET so we don't misreport a working page
      // as dead just because HEAD isn't implemented for it.
      if (res.status === 405 || res.status === 501) {
        res = await fetch(url, {
          method: "GET",
          headers: { "User-Agent": USER_AGENT, Range: "bytes=0-1023" },
          redirect: "follow",
        });
      }
      if (res.ok || res.status === 206) return true;
      if (res.status >= 500 && attempt < MAX_RETRIES) {
        await sleep(BASE_DELAY_MS * attempt);
        continue;
      }
      return false;
    } catch {
      if (attempt < MAX_RETRIES) {
        await sleep(BASE_DELAY_MS * attempt);
        continue;
      }
      return false;
    }
  }
  return false;
}

function sampleN(arr, n) {
  const copy = arr.slice();
  const out = [];
  for (let i = 0; i < n && copy.length > 0; i++) {
    const idx = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
}

async function main() {
  const raw = await readFile(path.join(DATA_DIR, "local-products.json"), "utf8");
  const data = JSON.parse(raw);
  const products = data.products;

  console.log(`Loaded ${products.length} products from local-products.json (builtAt ${data.builtAt})`);

  // ---- 1. duplicate code check (over the FULL file, not just the sample) ----
  const codeCounts = new Map();
  for (const p of products) {
    codeCounts.set(p.code, (codeCounts.get(p.code) || 0) + 1);
  }
  const duplicates = Array.from(codeCounts.entries()).filter(([, n]) => n > 1);
  console.log(`\n=== Duplicate code check ===`);
  console.log(`Duplicate codes found: ${duplicates.length}`);
  if (duplicates.length > 0) {
    console.log("Examples:", duplicates.slice(0, 5));
  }

  // ---- 2. category tag presence check (over the FULL file) ----
  const noCategory = products.filter((p) => !Array.isArray(p.categoriesTags) || p.categoriesTags.length === 0);
  console.log(`\n=== Category tag presence check ===`);
  console.log(`Products with 0 category tags: ${noCategory.length} / ${products.length}`);
  if (noCategory.length > 0) {
    console.log("Examples (code):", noCategory.slice(0, 5).map((p) => p.code));
  }

  // ---- 3. per-country counts ----
  const byCountry = new Map();
  for (const p of products) {
    byCountry.set(p.country, (byCountry.get(p.country) || 0) + 1);
  }
  console.log(`\n=== Per-country counts ===`);
  for (const [country, count] of byCountry.entries()) {
    console.log(`${country}: ${count}`);
  }

  // ---- 4. sample reachability check ----
  const sample = sampleN(products, Math.min(SAMPLE_SIZE, products.length));
  console.log(`\n=== Reachability check on ${sample.length} random sampled products ===`);

  let imageReachable = 0;
  let pageReachable = 0;
  const imageFailures = [];
  const pageFailures = [];

  for (const p of sample) {
    const offPageUrl = `https://world.openfoodfacts.org/product/${p.code}`;
    const [imgOk, pageOk] = await Promise.all([
      isReachable(p.image),
      isReachable(offPageUrl),
    ]);
    if (imgOk) imageReachable++;
    else imageFailures.push({ code: p.code, url: p.image });
    if (pageOk) pageReachable++;
    else pageFailures.push({ code: p.code, url: offPageUrl });
    console.log(
      `  ${p.code} | image ${imgOk ? "OK" : "FAIL"} | OFF page ${pageOk ? "OK" : "FAIL"} | ${p.name}`
    );
  }

  const imagePct = ((imageReachable / sample.length) * 100).toFixed(1);
  const pagePct = ((pageReachable / sample.length) * 100).toFixed(1);

  console.log(`\n=== Reachability summary ===`);
  console.log(`Images reachable: ${imageReachable}/${sample.length} (${imagePct}%)`);
  console.log(`OFF pages reachable: ${pageReachable}/${sample.length} (${pagePct}%)`);
  if (imageFailures.length) console.log("Image failures:", imageFailures);
  if (pageFailures.length) console.log("Page failures:", pageFailures);

  console.log(`\n=== Overall verdict ===`);
  console.log(`Duplicates: ${duplicates.length === 0 ? "PASS (0 duplicates)" : "FAIL"}`);
  console.log(
    `Category coverage: ${noCategory.length === 0 ? "PASS (all products have >=1 tag)" : `WARN (${noCategory.length} products with no tags)`}`
  );
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
