//
// build-seo.mjs — generates vendorja's crawlable surface into dist/.
//
// RUN: automatically, from the `vendorja-seo` plugin in vite.config.js, at
// the end of `vite build`. Also runnable on its own with `node
// scripts/build-seo.mjs` once a build exists.
//
// ------------------------------------------------------------------ WHY
// vendorja is a client-rendered SPA with, before this script, exactly one
// indexable URL. Its home screen needs ~1.5 MB of compressed JSON before it
// can say anything, and `vercel.json` rewrote every unknown path to the home
// screen with HTTP 200 — a soft 404 on an unbounded number of URLs.
//
// This script writes two things:
//
//   1. STANDALONE CONTENT PAGES (/marka, /vendore, /barkodi, /kategoria,
//      /produkt). Plain HTML, inline CSS, no JavaScript, no data fetch.
//      Every fact on them is read out of data/*.json and every verdict is
//      computed by src/lib/gs1.js + src/lib/boycott.js — the same modules
//      the running app uses, so a static page cannot disagree with a scan.
//
//   2. PER-ROUTE SPA SHELLS (/skano, /eksploro, /pse, /historiku, /pyetje,
//      /b/*). These are copies of the built index.html with their own
//      <title>, description, canonical and JSON-LD. The React bundle still
//      boots and the router still reads window.location.pathname, so the
//      app behaves exactly as before — it just no longer serves one set of
//      metadata for every screen.
//
// ------------------------------------------------- WHAT IT REFUSES TO DO
// * No page is generated from a record the data marks as unverified. The
//   brand-alternatives entries with verifiedSerbian:false are the file's own
//   honest category gaps ("Rice sold from Serbia (no verified Serbian rice
//   brand …)"), and a page headlined with one of those would be the exact
//   thin doorway page this project must never publish. They are listed, as
//   gaps, on /marka instead.
// * No page states a price without the date it was harvested.
// * No structured data field is emitted unless the underlying value exists.
//   In particular Product/offers is NOT emitted: the prices come from a
//   dated catalogue harvest, and a rich result is not the place to assert a
//   price we cannot keep current.
// * THERE IS NO /en/produkt TREE, and that is a decision, not an omission.
//   Measured 2026-09-18 over the 5,517 generated product pages:
//     - a product <title> is 77.9% byte-identical across the two languages
//       (product name + barcode); only a ~12-character verdict suffix
//       ("GS1 Itali" -> "GS1 Italy") would change, because product names are
//       real Kosovo till-strings and are NOT translated — "Milk Vita 1L" is
//       an invented product, "Qumesht Vita 1L" is a fact;
//     - the whole corpus draws on 912 distinct prose segments, of which 60
//       cover 93.9% of every sentence rendered; 98 appear on one page only;
//     - the mean product page carries 113.8 words inside <main>;
//     - of the 182 pages worth the most (a GS1-Serbia verdict), 110 have no
//       verified local alternative to show, and the other 72 restate nine
//       /en/marka pages that already exist in English.
//   So the English surface would be ~5,500 URLs, +88% of the crawlable site,
//   carrying an untranslated Albanian h1 and a rotation of sixty sentences.
//   The English reader's actual questions — is this brand Serbian, what does
//   this prefix mean, which local brands exist — are already answered by the
//   346 pages under /en. What the audit gap really needed was hreflang on the
//   62 paginated category pages that DO exist on both sides, and a build that
//   refuses to claim a counterpart it did not write. Both are below.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { SITE, slugify, CSS } from './seo/html.mjs';
import { verifyPairs, stripAlternates, removeFences } from './seo/hreflang.mjs';
import {
  loadRepoData,
  loadLibs,
  buildBrands,
  buildLocalBrands,
  buildProducts,
  buildCategories,
  prefixSlug,
} from './seo/model.mjs';
import {
  makeCopy,
  brandPage,
  brandsIndex,
  localBrandPage,
  localBrandsIndex,
  prefixPage,
  prefixIndex,
  productPage,
  categoryPage,
  categoriesIndex,
  productIndexPage,
  enHome,
  notFoundPage,
} from './seo/pages.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const PER_PAGE = 120;
// An escape hatch for a deploy that must stay small; unset means "all".
const MAX_PRODUCTS = Number(process.env.VENDORJA_SEO_MAX_PRODUCTS || 0) || Infinity;

// ---------------------------------------------------------------------------
// SPA shells
// ---------------------------------------------------------------------------

/** Routes the hand-rolled router in src/lib/router.js actually understands. */
const SPA_ROUTES = [
  {
    file: 'skano.html',
    path: '/skano',
    key: 'scannerTitle',
    titleSq: 'Skano barkodin — Vendorja',
    descSq:
      'Drejtoje kamerën te barkodi i produktit. Vendorja të thotë menjëherë ku është regjistruar barkodi dhe, nëse është serb, cila është alternativa vendore.',
    index: true,
  },
  {
    file: 'eksploro.html',
    path: '/eksploro',
    titleSq: 'Eksploro produktet e supermarketeve të Kosovës — Vendorja',
    descSq:
      'Kërko produkte nga katalogët e supermarketeve të Kosovës: çka është e regjistruar në GS1 Serbi, çka është vendore, dhe ku ta blesh.',
    index: true,
  },
  {
    // /alternativa — added 2026-09-17 with the exact-match screen. Without
    // its own shell here, vercel.json's `/:path -> /:path.html` rewrite has
    // nothing to serve and the route 404s in production even though the
    // SPA route exists. See src/components/AlternativaScreen.jsx.
    file: 'alternativa.html',
    path: '/alternativa',
    titleSq: 'Alternativa — zëvendësimi i saktë vendor për produktet serbe',
    descSq:
      'Vetëm produktet serbe, dhe për secilin zëvendësimi i saktë kosovar ose shqiptar i të njëjtit lloj produkti. Aty ku nuk njohim një të tillë, e themi hapur dhe mund ta propozosh ti.',
    index: true,
  },
  {
    file: 'pse.html',
    path: '/pse',
    titleSq: 'Pse — arsyet pas Vendorja',
    descSq:
      'Pse ka rëndësi se ku shkojnë paratë e blerjeve tona: shifrat e tregtisë, taksat dhe shpenzimet ushtarake, secila me burimin e vet.',
    index: true,
  },
  {
    file: 'historiku.html',
    path: '/historiku',
    titleSq: 'Skanimet e fundit — Vendorja',
    descSq: 'Produktet që ke skanuar së fundi, të ruajtura vetëm në pajisjen tënde.',
    // Personal, device-local and empty for anyone who has not scanned:
    // nothing here can be indexed usefully.
    index: false,
  },
  {
    file: 'pyetje.html',
    path: '/pyetje',
    titleSq: 'Pyetje që i bën gjithkush për barkodet — Vendorja',
    descSq:
      'A ka mollë barkod? Prefiksi nuk është serb — a është produkti i pastër? Përgjigjet për barkodet, prefikset GS1 dhe pronësinë e markave.',
    index: true,
    faq: true,
  },
  {
    file: 'b.html',
    path: '/b',
    titleSq: 'Rezultati i skanimit — Vendorja',
    descSq: 'Verdikti i barkodit që sapo skanove, me alternativën vendore kur produkti është serb.',
    // /b/<code> is client-rendered and needs the full dataset before it can
    // say anything. /produkt/<code> is the same verdict as static HTML, so
    // that is what belongs in the index; the header in vercel.json adds
    // `X-Robots-Tag: noindex, follow` for the whole /b/ space.
    index: false,
  },
];

function replaceTag(html, pattern, replacement) {
  return pattern.test(html) ? html.replace(pattern, replacement) : html;
}

function buildShell(baseHtml, route, dict) {
  let html = baseHtml;
  const title = route.titleSq;
  const desc = route.descSq;
  const canonical = SITE + route.path;

  html = replaceTag(html, /<title>[\s\S]*?<\/title>/, `<title>${title}</title>`);
  html = replaceTag(html, /<meta name="description" content="[\s\S]*?"\s*\/?>/, `<meta name="description" content="${desc}" />`);
  html = replaceTag(html, /<meta property="og:title" content="[\s\S]*?"\s*\/?>/, `<meta property="og:title" content="${title}" />`);
  html = replaceTag(
    html,
    /<meta\s+property="og:description"\s+content="[\s\S]*?"\s*\/?>/,
    `<meta property="og:description" content="${desc}" />`
  );
  html = replaceTag(html, /<meta name="twitter:title" content="[\s\S]*?"\s*\/?>/, `<meta name="twitter:title" content="${title}" />`);
  html = replaceTag(
    html,
    /<meta\s+name="twitter:description"\s+content="[\s\S]*?"\s*\/?>/,
    `<meta name="twitter:description" content="${desc}" />`
  );

  const ld = [];
  if (route.faq) {
    const sq = dict.sq;
    const qa = [];
    for (let i = 1; i <= 6; i += 1) {
      if (sq[`faqQ${i}`] && sq[`faqA${i}`]) qa.push([sq[`faqQ${i}`], sq[`faqA${i}`]]);
    }
    if (qa.length) {
      ld.push({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        inLanguage: 'sq',
        mainEntity: qa.map(([q, a]) => ({
          '@type': 'Question',
          name: q,
          acceptedAnswer: { '@type': 'Answer', text: a },
        })),
      });
    }
  }

  const head = [
    `<link rel="canonical" href="${canonical}" />`,
    `<meta property="og:url" content="${canonical}" />`,
    route.index
      ? `<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />`
      : `<meta name="robots" content="noindex, follow" />`,
    ...ld.map((x) => `<script type="application/ld+json">${JSON.stringify(x).replace(/</g, '\\u003c')}</script>`),
  ].join('\n    ');

  html = html.replace('</head>', `  ${head}\n  </head>`);
  html = html.replace(
    '<div id="root"></div>',
    `<div id="root"></div>\n    ${noscriptBlock(route, dict)}`
  );
  return html;
}

/**
 * Real content for a browser (or a crawler) with no JavaScript. It is not a
 * cloaking device: it says the same thing the rendered app says, and it
 * disappears the moment JavaScript runs, which is exactly what <noscript>
 * is for. Its main job is to leave a crawlable link out of every SPA route
 * into the static pages.
 */
function noscriptBlock(route, dict) {
  const sq = dict.sq;
  const links = [
    ['/marka', 'markat serbe'],
    ['/vendore', 'markat vendore'],
    ['/kategoria', 'kategoritë'],
    ['/barkodi', 'prefikset e barkodit'],
    ['/produkt', 'të gjitha produktet'],
  ];
  const faq =
    route.faq
      ? '<dl>' +
        Array.from({ length: 6 }, (_, i) => i + 1)
          .filter((i) => sq[`faqQ${i}`])
          .map((i) => `<dt><strong>${sq[`faqQ${i}`]}</strong></dt><dd>${sq[`faqA${i}`]}</dd>`)
          .join('') +
        '</dl>'
      : '';
  return `<noscript>
      <div style="max-width:820px;margin:0 auto;padding:24px 20px;font:16px/1.6 system-ui,sans-serif">
        <p><strong>vendorja</strong> — ${sq.mottoMain}</p>
        ${faq}
        <p>${sq.footerNote}</p>
        <ul>${links.map(([h, l]) => `<li><a href="${h}">${l}</a></li>`).join('')}</ul>
      </div>
    </noscript>`;
}

/** The home document gets site-wide structured data and a self-canonical. */
function decorateHome(baseHtml, dict) {
  const org = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Vendorja',
    url: SITE,
    logo: `${SITE}/logo-wordmark-red.png`,
    description:
      'Vendorja skanon barkodin e një produkti dhe tregon te cila organizatë GS1 është regjistruar; nëse është serb, tregon alternativën vendore nga Kosova dhe Shqipëria.',
  };
  // NOTE: no WebSite/SearchAction. A sitelinks search box must point at a
  // URL that really runs a search, and /eksploro keeps its query in React
  // state rather than in the URL — there is no such URL to name yet.
  const website = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Vendorja',
    url: SITE,
    inLanguage: 'sq',
  };
  const head = [
    `<link rel="canonical" href="${SITE}/" />`,
    `<meta property="og:url" content="${SITE}/" />`,
    `<link rel="alternate" hreflang="sq" href="${SITE}/" />`,
    `<link rel="alternate" hreflang="en" href="${SITE}/en" />`,
    `<link rel="alternate" hreflang="x-default" href="${SITE}/" />`,
    `<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />`,
    `<script type="application/ld+json">${JSON.stringify(org).replace(/</g, '\\u003c')}</script>`,
    `<script type="application/ld+json">${JSON.stringify(website).replace(/</g, '\\u003c')}</script>`,
  ].join('\n    ');
  return baseHtml.replace('</head>', `  ${head}\n  </head>`);
}

// ---------------------------------------------------------------------------
// sitemaps
// ---------------------------------------------------------------------------

function sitemapXml(entries, lastmod) {
  const urls = entries
    .map(
      (e) =>
        `  <url><loc>${SITE}${e.path === '/' ? '/' : e.path}</loc>` +
        (lastmod ? `<lastmod>${lastmod}</lastmod>` : '') +
        (e.priority ? `<priority>${e.priority.toFixed(1)}</priority>` : '') +
        `</url>`
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function sitemapIndexXml(files, lastmod) {
  const items = files
    .map((f) => `  <sitemap><loc>${SITE}/${f}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</sitemap>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</sitemapindex>\n`;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

function writePage(dist, page) {
  // '/marka' -> dist/marka.html, '/marka/bambi' -> dist/marka/bambi.html.
  // Served without the extension by `cleanUrls: true` in vercel.json.
  const rel = page.path === '/' ? 'index.html' : `${page.path.replace(/^\//, '')}.html`;
  const file = path.join(dist, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, page.html, 'utf8');
}

export async function generateSeo({ dist = path.join(ROOT, 'dist'), quiet = false } = {}) {
  const log = quiet ? () => {} : (...a) => console.log('[vendorja:seo]', ...a);

  if (!fs.existsSync(path.join(dist, 'index.html'))) {
    console.warn('[vendorja:seo] dist/index.html not found — run `vite build` first. Skipping.');
    return null;
  }

  const data = await loadRepoData(ROOT);
  const libs = await loadLibs(ROOT);
  const copy = makeCopy(libs.dict);

  const { brands, gaps } = buildBrands(data, libs);
  const localBrands = buildLocalBrands(data);
  const allProducts = buildProducts(data, libs);
  const products = allProducts.slice(0, MAX_PRODUCTS === Infinity ? allProducts.length : MAX_PRODUCTS);
  const categories = buildCategories(products).filter((c) => c.label !== 'Të tjera');

  // Index structures the page builders need.
  const ranges = [...data.gs1.ranges].sort((a, b) => a.min - b.min);
  const productsByPrefixSlug = new Map();
  const prefixSlugForCode = new Map();
  for (const p of products) {
    const r = ranges.find((x) => Number(p.classify.prefix) >= x.min && Number(p.classify.prefix) <= x.max);
    if (!r) continue;
    const s = prefixSlug(r);
    prefixSlugForCode.set(p.code, s);
    if (!productsByPrefixSlug.has(s)) productsByPrefixSlug.set(s, []);
    productsByPrefixSlug.get(s).push(p);
  }
  // Serbian-verdict products first, so a prefix page's examples lead with
  // the ones the app exists to flag.
  for (const list of productsByPrefixSlug.values()) {
    list.sort((a, b) => Number(b.isSerbian) - Number(a.isSerbian) || a.name.localeCompare(b.name, 'sq'));
  }

  // One stylesheet for all of them, fingerprinted so it can be cached
  // forever (see the /seo.css header rule in vercel.json).
  const cssHash = crypto.createHash('sha1').update(CSS).digest('hex').slice(0, 8);
  fs.writeFileSync(path.join(dist, 'seo.css'), CSS, 'utf8');

  const brandBySlug = new Map(brands.map((b) => [b.slug, b]));
  const brandBySerbianEntry = new Map();
  for (const b of brands) for (const e of b.entries) brandBySerbianEntry.set(e.serbianBrand, b);
  const localSlugs = new Set(localBrands.map((l) => l.slug));

  const ctx = {
    cssHref: `/seo.css?v=${cssHash}`,
    copy,
    brands,
    gaps,
    localBrands,
    localSlugs,
    products,
    categories,
    categorySlugs: new Set(categories.map((c) => c.slug)),
    ranges,
    productsByPrefixSlug,
    prefixSlugForCode,
    brandBySlug,
    brandBySerbianEntry,
    findBoycottByBrand: libs.boycott.findBoycottByBrand,
    boycottTable: data.boycott,
    retailBuiltAt: (data.kosovoRetail.builtAt || '').slice(0, 10) || null,
  };

  const pages = [];

  for (const lang of ['sq', 'en']) {
    pages.push(brandsIndex(ctx, lang));
    for (const b of brands) pages.push(brandPage(b, ctx, lang));
    pages.push(localBrandsIndex(ctx, lang));
    for (const l of localBrands) pages.push(localBrandPage(l, ctx, lang));
    pages.push(prefixIndex(ctx, lang));
    for (const r of ranges) pages.push(prefixPage(r, ctx, lang));
    pages.push(categoriesIndex(ctx, lang));
    for (const c of categories) {
      const total = Math.max(1, Math.ceil(c.products.length / PER_PAGE));
      for (let i = 1; i <= total; i += 1) pages.push(categoryPage(c, ctx, lang, i, PER_PAGE));
    }
  }

  pages.push(enHome(ctx));

  const productIndexTotal = Math.max(1, Math.ceil(products.length / PER_PAGE));
  for (let i = 1; i <= productIndexTotal; i += 1) pages.push(productIndexPage(ctx, i, PER_PAGE));
  for (const p of products) pages.push(productPage(p, ctx));

  pages.push(notFoundPage(ctx));

  // --- hreflang: prove every claim before it is written -------------------
  //
  // A page builder ASSERTS a counterpart ("the English version of
  // /kategoria/pije/faqja-2 is /en/kategoria/pije/faqja-2"). It has no way
  // to know whether that page was generated — symmetry between the two
  // language trees is an assumption, and the whole point of a hreflang bug
  // is that the assumption was true when it was written. So the claim is
  // re-derived here, against the list of pages that actually exist, and any
  // claim that does not survive is stripped out of the finished HTML rather
  // than shipped and reported back by Search Console.
  //
  // The SPA shells are in the existence set too: /en's counterpart is the
  // React home at dist/index.html, which is decorated by decorateHome()
  // below rather than built by a page builder.
  const shellEntries = [
    { path: '/', lang: 'sq', altPath: '/en' },
    ...SPA_ROUTES.map((r) => ({ path: r.path, lang: 'sq', altPath: null })),
  ];
  const hreflang = verifyPairs([
    ...shellEntries,
    ...pages.map((p) => ({ path: p.path, lang: p.lang, altPath: p.altPath ?? null })),
  ]);
  if (hreflang.rejected.has('/') || hreflang.rejected.has('/en')) {
    // decorateHome writes the home pair by hand; if it ever stops matching
    // enHome the site's two most important URLs disagree about each other.
    throw new Error('[vendorja:seo] the / ↔ /en hreflang pair is broken — decorateHome and enHome disagree');
  }
  let stripped = 0;
  for (const page of pages) {
    if (page.altPath && hreflang.rejected.has(page.path)) {
      page.html = stripAlternates(page.html);
      page.altPath = null;
      stripped += 1;
    }
    page.html = removeFences(page.html);
  }
  for (const [label, list] of [
    ['dangling (counterpart never generated)', hreflang.dangling],
    ['one-way (counterpart does not point back)', hreflang.nonReciprocal],
    ['same-language (alternate is not a translation)', hreflang.sameLang],
  ]) {
    if (!list.length) continue;
    console.warn(`[vendorja:seo] hreflang REJECTED — ${label}: ${list.length}`);
    for (const x of list.slice(0, 5)) console.warn('   ', x.path, '->', x.altPath);
  }

  for (const page of pages) writePage(dist, page);

  // --- SPA shells ----------------------------------------------------------
  const baseHtml = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
  fs.writeFileSync(path.join(dist, 'index.html'), decorateHome(baseHtml, libs.dict), 'utf8');
  for (const route of SPA_ROUTES) {
    fs.writeFileSync(path.join(dist, route.file), buildShell(baseHtml, route, libs.dict), 'utf8');
  }

  // --- sitemaps ------------------------------------------------------------
  const lastmod = new Date().toISOString().slice(0, 10);
  const indexable = pages.filter((p) => !p.skipSitemap);
  const spaEntries = [
    { path: '/', priority: 1.0 },
    ...SPA_ROUTES.filter((r) => r.index).map((r) => ({ path: r.path, priority: 0.8 })),
  ];

  const groups = {
    'sitemap-faqe.xml': [
      ...spaEntries,
      ...indexable.filter((p) => /^\/(en\/)?(marka|vendore|barkodi|kategoria|produkt)$/.test(p.path) || p.path === '/en'),
    ],
    'sitemap-marka.xml': indexable.filter((p) => /^\/(en\/)?(marka|vendore)\/./.test(p.path)),
    'sitemap-barkodi.xml': indexable.filter((p) => /^\/(en\/)?(barkodi|kategoria)\/./.test(p.path)),
    'sitemap-produkt.xml': indexable.filter((p) => /^\/produkt\/./.test(p.path)),
  };

  for (const [file, entries] of Object.entries(groups)) {
    fs.writeFileSync(path.join(dist, file), sitemapXml(entries, lastmod), 'utf8');
  }
  fs.writeFileSync(path.join(dist, 'sitemap.xml'), sitemapIndexXml(Object.keys(groups), lastmod), 'utf8');

  const summary = {
    pages: pages.length,
    brands: brands.length,
    localBrands: localBrands.length,
    prefixes: ranges.length,
    categories: categories.length,
    products: products.length,
    serbianProducts: products.filter((p) => p.isSerbian).length,
    spaShells: SPA_ROUTES.length,
    sitemapUrls: Object.values(groups).reduce((a, g) => a + g.length, 0),
    hreflangPages: pages.filter((p) => p.altPath).length + 1, // +1: dist/index.html
    hreflangPairs: hreflang.pairs,
    hreflangStripped: stripped,
  };

  // A machine-readable record of what was claimed and what survived, so
  // `npm run seo-audit` can report hreflang CORRECTNESS rather than just
  // counting the pages that happen to carry the tag.
  fs.writeFileSync(
    path.join(dist, 'seo-hreflang.json'),
    JSON.stringify(
      {
        builtAt: new Date().toISOString(),
        pairs: hreflang.pairs,
        declared: summary.hreflangPages,
        rejected: { dangling: hreflang.dangling, nonReciprocal: hreflang.nonReciprocal, sameLang: hreflang.sameLang },
        // Pages with no counterpart, and therefore correctly silent. Grouped
        // so the audit can say WHY a page has no hreflang instead of listing
        // 5,500 filenames as if they were all the same defect.
        noCounterpart: pages
          .filter((p) => !p.altPath && !p.skipSitemap)
          .reduce((acc, p) => {
            const k = p.path.split('/')[1] || '(root)';
            acc[k] = (acc[k] || 0) + 1;
            return acc;
          }, {}),
      },
      null,
      2
    ),
    'utf8'
  );

  log(
    `${summary.pages} static pages · ${summary.brands} serbian brands · ${summary.localBrands} local brands · ` +
      `${summary.prefixes} gs1 prefixes · ${summary.categories} categories · ${summary.products} products ` +
      `(${summary.serbianProducts} serbian) · ${summary.sitemapUrls} sitemap urls · ` +
      `${summary.hreflangPairs} hreflang pairs (${summary.hreflangStripped} claims rejected)`
  );
  return summary;
}

// CLI
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  generateSeo().then(
    (s) => {
      if (!s) process.exitCode = 1;
    },
    (err) => {
      console.error('[vendorja:seo] FAILED:', err);
      process.exitCode = 1;
    }
  );
}
