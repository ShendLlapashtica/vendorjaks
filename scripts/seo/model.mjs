// Builds the derived model the static SEO pages are rendered from.
//
// EVERY fact here comes out of data/*.json, and every VERDICT here is
// computed by the same src/lib modules the running app uses. Nothing is
// re-implemented, so a generated page can never contradict a live scan.
//
// The one trick: dataLoader.js fetches '/data/*.json' over HTTP because it
// normally runs in a browser. At build time we point a `fetch` shim at the
// repo's own data/ directory, which means the build reads the files through
// exactly the same normalisation the app does — including its shape
// defences and its GjirafaMall source block.

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { slugify } from './html.mjs';

/** Installs the data/ fetch shim and loads every dataset through src/lib/dataLoader.js. */
export async function loadRepoData(repoRoot) {
  const dataDir = path.join(repoRoot, 'data');
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const href = String(url);
    if (href.startsWith('/data/')) {
      const file = path.join(dataDir, href.slice('/data/'.length));
      if (!file.startsWith(dataDir) || !fs.existsSync(file)) {
        return { ok: false, status: 404, json: async () => null };
      }
      const text = fs.readFileSync(file, 'utf8');
      return { ok: true, status: 200, json: async () => JSON.parse(text) };
    }
    if (typeof realFetch === 'function') return realFetch(url, init);
    return { ok: false, status: 599, json: async () => null };
  };

  const loaderUrl = pathToFileURL(path.join(repoRoot, 'src', 'lib', 'dataLoader.js')).href;
  const { loadAllData } = await import(loaderUrl);
  const data = await loadAllData();
  globalThis.fetch = realFetch;
  return data;
}

export async function loadLibs(repoRoot) {
  const url = (p) => pathToFileURL(path.join(repoRoot, 'src', 'lib', p)).href;
  const i18n = pathToFileURL(path.join(repoRoot, 'src', 'i18n', 'dictionary.js')).href;
  const [gs1, boycott, retailCategories, format, dictionary] = await Promise.all([
    import(url('gs1.js')),
    import(url('boycott.js')),
    import(url('retailCategories.js')),
    import(url('format.js')),
    import(i18n),
  ]);
  return { gs1, boycott, retailCategories, format, dict: dictionary.dictionary };
}

const pad3 = (n) => String(n).padStart(3, '0');

/** '860' or '800-839' — the same notation data/gs1-prefixes.json uses. */
export function prefixSlug(range) {
  return range.min === range.max ? pad3(range.min) : `${pad3(range.min)}-${pad3(range.max)}`;
}

/**
 * Serbian-brand records: the union of the boycott table (which carries
 * ownership evidence) and brand-alternatives.json (which carries the
 * sourced local replacements).
 *
 * brand-alternatives entries with `verifiedSerbian !== true` are the file's
 * own honest placeholders — "Cleaning products - see gaps", "Rice sold from
 * Serbia (no verified Serbian rice brand …)". They are category gaps, not
 * brands, and a page headlined "Is 'Cleaning products - see gaps' Serbian?"
 * would be exactly the thin doorway page this project must not publish.
 * They are dropped here and surfaced on the /marka index as known gaps.
 */
/**
 * brand-alternatives.json spells a brand the way a shopper says it, with a
 * clarifier in brackets: "Bambi (Plazma)", "Štark (Bananica / Krem banana)",
 * "Imlek (djathë)". findBoycottByBrand compares WHOLE tokens on purpose, so
 * the bracketed spelling never matches the boycott table's "Bambi" and the
 * build would otherwise publish /marka/bambi and /marka/bambi-plazma as two
 * near-identical pages. This feeds it the parts instead of the whole.
 */
function boycottHitForEntryName(name, data, findBoycottByBrand) {
  const raw = String(name || '');
  const head = raw.split('(')[0].trim();
  const inner = (raw.match(/\(([^)]*)\)/) || [])[1] || '';
  const candidates = [raw, head, ...inner.split(/[/,]/).map((s) => s.trim())].filter(Boolean);
  for (const c of candidates) {
    const hit = findBoycottByBrand(c, data.boycott);
    if (hit) return hit;
  }
  return null;
}

/** "Swisslion-Takovo (biscuits, wafers)" -> "Swisslion-Takovo" for the page title. */
function headName(name) {
  const head = String(name || '').split('(')[0].trim();
  return head.length >= 2 ? head : String(name || '').trim();
}

export function buildBrands(data, libs) {
  const { findBoycottByBrand } = libs.boycott;
  const byKey = new Map();

  const ensure = (name, seedSlug) => {
    const slug = seedSlug || slugify(name);
    if (!byKey.has(slug)) {
      byKey.set(slug, {
        slug,
        name,
        company: null,
        country: null,
        category: null,
        evidence: null,
        sourceUrl: null,
        aliases: [],
        entries: [],
        inBoycottTable: false,
      });
    }
    return byKey.get(slug);
  };

  for (const b of data.boycott.brands) {
    const rec = ensure(b.brand);
    rec.company = b.company || rec.company;
    rec.country = b.country || rec.country;
    rec.category = b.category || rec.category;
    rec.evidence = b.evidence || rec.evidence;
    rec.sourceUrl = b.sourceUrl || rec.sourceUrl;
    rec.aliases = Array.isArray(b.aliases) ? b.aliases : [];
    rec.inBoycottTable = true;
  }

  const gaps = [];
  for (const entry of data.brandAlternatives.entries) {
    if (entry.verifiedSerbian !== true) {
      gaps.push(entry);
      continue;
    }
    // Attach the entry to the boycott brand it describes, when the boycott
    // table knows it — that is what merges "Imlek" and "Imlek (djathë)" onto
    // one page instead of publishing two near-identical ones.
    const matched = boycottHitForEntryName(entry.serbianBrand, data, findBoycottByBrand);
    const rec = matched ? ensure(matched.brand) : ensure(headName(entry.serbianBrand));
    if (!rec.company && entry.serbianCompany) rec.company = entry.serbianCompany;
    if (!rec.sourceUrl && entry.sourceUrl) rec.sourceUrl = entry.sourceUrl;
    if (!rec.category && entry.category) rec.category = entry.category;
    rec.entries.push(entry);
  }

  const brands = [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name, 'sq'));
  return { brands, gaps };
}

/**
 * Local (Kosovo/Albania) replacement brands, collected from every
 * alternatives list. One record per brand, carrying the Serbian brands it
 * is offered against.
 */
export function buildLocalBrands(data) {
  const byKey = new Map();
  for (const entry of data.brandAlternatives.entries) {
    for (const alt of entry.alternatives || []) {
      if (!alt.brand) continue;
      const slug = slugify(alt.brand);
      if (!byKey.has(slug)) {
        byKey.set(slug, {
          slug,
          brand: alt.brand,
          company: alt.company || null,
          country: alt.country || null,
          sourceUrl: alt.sourceUrl || null,
          evidence: alt.evidence || null,
          image: alt.image || null,
          imageSource: alt.imageSource || null,
          imageCredit: alt.imageCredit || null,
          replaces: [],
          categories: new Set(),
        });
      }
      const rec = byKey.get(slug);
      if (!rec.evidence && alt.evidence) rec.evidence = alt.evidence;
      if (!rec.image && alt.image) {
        rec.image = alt.image;
        rec.imageSource = alt.imageSource || null;
        rec.imageCredit = alt.imageCredit || null;
      }
      if (entry.verifiedSerbian === true) {
        rec.replaces.push({ brand: entry.serbianBrand, pairing: alt.pairingEvidence, pairingUrl: alt.pairingUrl });
      }
      if (entry.category) rec.categories.add(entry.category);
    }
  }
  return [...byKey.values()]
    .map((r) => ({ ...r, categories: [...r.categories] }))
    .sort((a, b) => a.brand.localeCompare(b.brand, 'sq'));
}

/**
 * One record per distinct barcode in the Kosovo retail catalogue, merging
 * every shop that lists it (that merge is the reason a product page can
 * honestly show more than one price for the same item).
 */
export function buildProducts(data, libs) {
  const { classifyBarcode, VERDICT } = libs.gs1;
  const { findBoycottByCode, findBoycottByBrand, applyBoycott } = libs.boycott;
  const { canonicalCategory } = libs.retailCategories;

  const byCode = new Map();
  for (const p of data.kosovoRetail.products) {
    const code = String(p.barcode || '').replace(/\D/g, '');
    if (!(code.length === 8 || code.length === 12 || code.length === 13)) continue;
    if (!p.name || String(p.name).trim().length < 3) continue;
    if (!byCode.has(code)) byCode.set(code, { code, rows: [] });
    byCode.get(code).rows.push(p);
  }

  const products = [];
  for (const rec of byCode.values()) {
    // The longest name is the most descriptive of the shop spellings, and
    // is a real string from the catalogue rather than a synthesised one.
    const rows = rec.rows.slice().sort((a, b) => String(b.name).length - String(a.name).length);
    const primary = rows[0];
    const brand = rows.find((r) => r.brand)?.brand || null;
    const image = rows.find((r) => r.image && /^https?:\/\//i.test(r.image))?.image || null;

    // Same order as ExploreScreen.jsx: exact barcode first, brand second.
    const hit = findBoycottByCode(rec.code, data.boycott) || findBoycottByBrand(brand, data.boycott);
    const classify = applyBoycott(classifyBarcode(rec.code, data.gs1), hit);

    const priced = rows.filter((r) => typeof r.price === 'number' && r.price > 0);
    const prices = priced.map((r) => r.price).sort((a, b) => a - b);

    const cat = canonicalCategory(primary.category);

    products.push({
      code: rec.code,
      name: primary.name,
      brand,
      image,
      rows,
      classify,
      boycott: classify.boycott || null,
      isLocalBrand: rows.some((r) => r.isLocalBrand === true)
        ? true
        : rows.every((r) => r.isLocalBrand === false)
        ? false
        : null,
      localEvidence: rows.find((r) => r.localEvidence)?.localEvidence || null,
      category: cat?.label || null,
      categorySide: cat?.side || null,
      rawCategory: primary.category || null,
      priceLow: prices[0] ?? null,
      priceHigh: prices[prices.length - 1] ?? null,
      currency: priced[0]?.currency || 'EUR',
      isSerbian: classify.verdict === VERDICT.SERBIAN,
    });
  }

  products.sort((a, b) => a.code.localeCompare(b.code));
  return products;
}

/** Category hubs, keyed by the app's own canonical Albanian shelf labels. */
export function buildCategories(products) {
  const byKey = new Map();
  for (const p of products) {
    if (!p.category) continue;
    const slug = slugify(p.category);
    if (!byKey.has(slug)) byKey.set(slug, { slug, label: p.category, side: p.categorySide, products: [] });
    byKey.get(slug).products.push(p);
  }
  return [...byKey.values()]
    .map((c) => ({
      ...c,
      products: c.products.sort((a, b) => Number(b.isSerbian) - Number(a.isSerbian) || a.name.localeCompare(b.name, 'sq')),
      serbianCount: c.products.filter((p) => p.isSerbian).length,
    }))
    .filter((c) => c.products.length >= 20)
    .sort((a, b) => b.products.length - a.products.length);
}
