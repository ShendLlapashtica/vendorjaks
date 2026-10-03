// Shared rendering primitives for the statically generated SEO pages.
//
// WHY THESE PAGES ARE STANDALONE (no React bundle):
// vendorja is a client-rendered SPA whose first paint depends on ~1.5 MB of
// compressed JSON. That is fine for the app itself and terrible for a
// crawler. The pages built from this module carry the SAME facts, taken from
// the SAME data files through the SAME src/lib logic, but as plain HTML with
// one shared stylesheet and no JavaScript at all. They are the crawlable,
// instantly-rendering surface; every one of them links back into the app.
//
// HONESTY RULE (inherited from the whole project): nothing in here invents a
// fact. Every sentence a page can emit is either (a) a fixed label, (b) a
// value read out of data/*.json, or (c) a conclusion computed by
// src/lib/gs1.js and src/lib/boycott.js — the exact modules the running app
// uses, so a static page can never disagree with a live scan.

import { alternateBlock } from './hreflang.mjs';

export const SITE = 'https://vendorja.com';

/** HTML-escapes text for use in element content or a double-quoted attribute. */
export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Serializes JSON-LD safely for embedding in a <script> block. */
export function jsonLdSafe(obj) {
  return JSON.stringify(obj).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
}

const TRANSLIT = {
  'ë': 'e', 'ç': 'c', 'š': 's', 'ž': 'z', 'đ': 'dj', 'ć': 'c', 'č': 'c',
  'á': 'a', 'à': 'a', 'â': 'a', 'ä': 'a', 'å': 'a', 'ã': 'a',
  'é': 'e', 'è': 'e', 'ê': 'e', 'ē': 'e',
  'í': 'i', 'ì': 'i', 'î': 'i', 'ï': 'i',
  'ó': 'o', 'ò': 'o', 'ô': 'o', 'ö': 'o', 'õ': 'o', 'ø': 'o',
  'ú': 'u', 'ù': 'u', 'û': 'u', 'ü': 'u',
  'ñ': 'n', 'ý': 'y', 'ß': 'ss',
};

/** URL slug: lowercase ASCII, Albanian/Serbian diacritics transliterated. */
export function slugify(value) {
  const lower = String(value ?? '').toLowerCase();
  let out = '';
  for (const ch of lower) out += TRANSLIT[ch] ?? ch;
  return (
    out
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'x'
  );
}

/**
 * Names in the harvested retail catalogue are shop-till strings, mostly in
 * caps ("POMFRIT 2.5KG K&K ELKOS (4)"). Only the LETTER CASE is changed for
 * display — no word is added, removed, reordered or translated — because an
 * all-caps <title> reads as spam and gets truncated badly in a result page.
 */
export function displayCase(name) {
  const raw = String(name ?? '').trim();
  if (!raw) return '';
  const letters = raw.replace(/[^\p{L}]/gu, '');
  if (!letters) return raw;
  const upper = (letters.match(/\p{Lu}/gu) || []).length;
  if (upper / letters.length < 0.7) return raw;
  // Albanian function words stay lowercase mid-name ("qumësht i ri", not
  // "Qumësht I Ri"), which is what a title-caser that does not know the
  // language gets wrong first.
  const SMALL = new Set(['i', 'e', 'te', 'të', 'me', 'ne', 'në', 'nga', 'dhe', 'per', 'për', 'nje', 'një', 'se', 'si', 'pa']);
  return raw
    .split(/(\s+)/)
    .map((tok, idx) => {
      if (!/\p{L}/u.test(tok)) return tok;
      // Short all-caps runs are acronyms or brand marks (K&K, ETC, UHT) —
      // lowercasing them would be a change of meaning, not of style.
      if (/^(?=.*[&.])[\p{Lu}&.]{2,6}$/u.test(tok)) return tok;
      const lower = tok.toLowerCase();
      if (idx > 0 && SMALL.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join('');
}

/** Truncates a meta description at a word boundary. */
export function clamp(text, max = 158) {
  const s = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const at = cut.lastIndexOf(' ');
  return (at > max * 0.6 ? cut.slice(0, at) : cut).replace(/[,;:.\-\s]+$/, '') + '…';
}

// A deliberately small stylesheet, shipped once as /seo.css and linked from
// every generated page.
//
// It started out inlined — one request, zero render-blocking sub-resources —
// which is the right call for a handful of pages and the wrong one for 5,800:
// at ~3.2 kB each that was ~19 MB of identical bytes in the deployment, and
// a reader who opens a second page pays for it again. Linked, it is fetched
// once and then served from cache for the whole site, and the extra request
// is same-origin, multiplexed and about a kilobyte compressed.
//
// No web font: the app's Google Fonts link costs two extra connections plus
// a FOUT that a reference page should not pay for.
export const CSS = `
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:#fff;color:#111;font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif}
a{color:#c00;text-decoration:underline;text-underline-offset:2px}
a:hover{color:#f00}
img{max-width:100%;height:auto}
.wrap{max-width:820px;margin:0 auto;padding:0 20px}
header.top{background:#FF0000;color:#fff;padding:14px 0}
header.top a{color:#fff;text-decoration:none}
.brandrow{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
.brand{font-weight:800;font-size:20px;letter-spacing:-.02em}
header.top nav{display:flex;gap:14px;flex-wrap:wrap;font-size:14px}
header.top nav a{opacity:.92}
header.top nav a:hover{opacity:1;text-decoration:underline}
main{padding:22px 0 8px}
.crumbs{font-size:13px;color:#666;margin:0 0 14px;word-break:break-word}
.crumbs a{color:#666}
h1{font-size:clamp(25px,5.2vw,38px);line-height:1.15;letter-spacing:-.02em;margin:0 0 12px}
h2{font-size:21px;line-height:1.25;letter-spacing:-.01em;margin:32px 0 10px}
h3{font-size:16px;margin:18px 0 6px}
p{margin:0 0 12px}
.lede{font-size:18px;color:#333}
.verdict{border:2px solid #111;border-radius:14px;padding:16px 18px;margin:18px 0}
.verdict.no{border-color:#FF0000;background:#fff5f5}
.verdict.yes{border-color:#0a7d34;background:#f3fbf5}
.verdict.grey{border-color:#999;background:#fafafa}
.vword{display:inline-block;font-weight:800;font-size:13px;letter-spacing:.09em;text-transform:uppercase;margin:0 0 6px}
.verdict.no .vword{color:#FF0000}
.verdict.yes .vword{color:#0a7d34}
.verdict.grey .vword{color:#666}
.verdict p:last-child{margin-bottom:0}
.note{font-size:13.5px;color:#555}
.src{font-size:13px;color:#666;word-break:break-word}
.card{border:1px solid #e3e3e3;border-radius:12px;padding:14px 16px;margin:0 0 12px;background:#fff}
.card h3{margin-top:0}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px}
.grid .card{margin:0}
.thumb{display:block;width:100%;aspect-ratio:4/3;object-fit:contain;background:#f6f6f6;border-radius:8px;margin:0 0 10px}
ul.plain{list-style:none;padding:0;margin:0}
ul.plain li{padding:8px 0;border-bottom:1px solid #eee}
ul.plain li:last-child{border-bottom:0}
.tag{display:inline-block;font-size:11.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:3px 8px;border-radius:999px;background:#f0f0f0;color:#444;margin:0 6px 6px 0}
.tag.rs{background:#FF0000;color:#fff}
.tag.loc{background:#0a7d34;color:#fff}
table{border-collapse:collapse;width:100%;font-size:14.5px}
th,td{text-align:left;padding:8px 10px;border-bottom:1px solid #eee;vertical-align:top}
th{font-weight:700;color:#444}
.scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}
.cta{display:inline-block;background:#FF0000;color:#fff;font-weight:700;padding:12px 20px;border-radius:999px;text-decoration:none;margin:6px 8px 6px 0}
.cta:hover{color:#fff;background:#d90000}
.cta.ghost{background:#111}
.cta.ghost:hover{background:#333}
.cols{columns:2 190px;column-gap:22px}
.cols a{display:block;padding:3px 0;break-inside:avoid}
footer.bot{margin:40px 0 0;border-top:1px solid #eee;padding:18px 0 40px;font-size:13.5px;color:#666}
footer.bot a{color:#666}
footer.bot nav{display:flex;gap:14px;flex-wrap:wrap;margin:0 0 10px}
.pager{display:flex;gap:10px;flex-wrap:wrap;margin:22px 0 0;font-size:14px}
@media (prefers-color-scheme:dark){
body{background:#0d0d0d;color:#ededed}
a{color:#ff6b6b}
.card,.verdict{background:#141414;border-color:#2a2a2a}
.verdict.no{background:#1c0f0f}
.verdict.yes{background:#0f1a12}
.verdict.grey{background:#161616}
.thumb{background:#1c1c1c}
th,td,ul.plain li,footer.bot{border-color:#242424}
.tag{background:#242424;color:#bbb}
.note,.src,.crumbs,.crumbs a,footer.bot,footer.bot a{color:#9a9a9a}
.lede{color:#c9c9c9}
h2,th{color:#ededed}
}`.trim();

const NAV = {
  sq: [
    ['/', 'ballina'],
    // /alternativa was ORPHANED — measured: zero internal links anywhere in
    // the 6,263-page build, because the only route to it in the app is a
    // React onClick button that no crawler can follow. It was in the
    // sitemap and nothing pointed at it, which Google treats as a strong
    // deprioritisation signal. It is the page most worth finding (359
    // Serbian products with their exact local replacements), so it now sits
    // in the nav on every generated page.
    ['/alternativa', 'alternativat'],
    ['/marka', 'markat serbe'],
    ['/vendore', 'markat vendore'],
    ['/kategoria', 'kategoritë'],
    ['/barkodi', 'prefikset'],
    ['/pse', 'pse'],
    ['/pyetje', 'pyetje'],
  ],
  // A third element is the LANGUAGE OF THE TARGET when it is not the
  // language of the page linking to it. /alternativa, /pse and /pyetje are
  // Albanian-only app screens with no English build, so on an English page
  // they are marked `hreflang="sq" lang="sq"` rather than presented as if
  // an English reader will get English. Declaring the switch is honest;
  // hiding it is the same class of error as a one-way hreflang.
  en: [
    ['/en', 'home'],
    ['/alternativa', 'alternativat', 'sq'],
    ['/en/marka', 'serbian brands'],
    ['/en/vendore', 'local brands'],
    ['/en/kategoria', 'categories'],
    ['/en/barkodi', 'gs1 prefixes'],
    ['/pse', 'pse', 'sq'],
    ['/pyetje', 'pyetje', 'sq'],
  ],
};

const FOOT = {
  sq: 'vendorja identifikon vetëm ku është regjistruar barkodi, jo domosdoshmërisht origjinën e prodhimit. kontrollo gjithmonë etiketën fizike.',
  en: 'vendorja only identifies where a barcode was registered, not necessarily where a product was made. always check the physical label.',
};

/**
 * Renders one complete standalone page.
 *
 * @param {object} o
 * @param {'sq'|'en'} o.lang
 * @param {string} o.path        canonical path, e.g. '/marka/bambi'
 * @param {string} o.title
 * @param {string} o.description
 * @param {string} o.h1
 * @param {string} o.body        pre-rendered (already escaped) HTML for <main>
 * @param {Array<[string,string]>} [o.crumbs]
 * @param {object[]} [o.jsonLd]
 * @param {string|null} [o.altPath] path of the other-language version
 */
export function renderPage(o) {
  const lang = o.lang || 'sq';
  const canonical = SITE + o.path;
  const image = o.image || SITE + '/og-image.png';
  const crumbs = o.crumbs || [];
  const nav = NAV[lang];
  const navHtml = nav
    .map(([href, label, targetLang]) => {
      const attrs = targetLang && targetLang !== lang ? ` hreflang="${esc(targetLang)}" lang="${esc(targetLang)}"` : '';
      return `<a href="${esc(href)}"${attrs}>${esc(label)}</a>`;
    })
    .join('');

  // A CLAIM, not yet a fact: build-seo re-checks every altPath against the
  // pages it actually wrote and strips this block where the counterpart
  // turns out not to exist. See scripts/seo/hreflang.mjs.
  const alternates = alternateBlock({ path: o.path, lang, altPath: o.altPath }, SITE, esc);

  const ld = (o.jsonLd || []).filter(Boolean);

  const crumbHtml = crumbs.length
    ? `<nav class="crumbs" aria-label="${lang === 'sq' ? 'shtegu' : 'breadcrumb'}">` +
      crumbs
        .map(([href, label], i) =>
          i === crumbs.length - 1 ? `<span>${esc(label)}</span>` : `<a href="${esc(href)}">${esc(label)}</a> ›`
        )
        .join(' ') +
      '</nav>'
    : '';

  return `<!doctype html>
<html lang="${lang}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>${esc(o.title)}</title>
    <meta name="description" content="${esc(o.description)}" />
    <link rel="canonical" href="${esc(canonical)}" />
    ${alternates}
    <meta name="robots" content="${esc(o.robots || 'index, follow, max-image-preview:large, max-snippet:-1')}" />
    <meta name="theme-color" content="#FF0000" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta property="og:type" content="${esc(o.ogType || 'article')}" />
    <meta property="og:site_name" content="Vendorja" />
    <meta property="og:locale" content="${lang === 'sq' ? 'sq_AL' : 'en_US'}" />
    <meta property="og:url" content="${esc(canonical)}" />
    <meta property="og:title" content="${esc(o.title)}" />
    <meta property="og:description" content="${esc(o.description)}" />
    <meta property="og:image" content="${esc(image)}" />
    <meta property="og:image:alt" content="${esc(o.imageAlt || 'Vendorja')}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(o.title)}" />
    <meta name="twitter:description" content="${esc(o.description)}" />
    <meta name="twitter:image" content="${esc(image)}" />
    <link rel="stylesheet" href="${esc(o.cssHref || '/seo.css')}" />
${ld.map((x) => `    <script type="application/ld+json">${jsonLdSafe(x)}</script>`).join('\n')}
  </head>
  <body>
    <header class="top">
      <div class="wrap brandrow">
        <a class="brand" href="${lang === 'sq' ? '/' : '/en'}">vendorja</a>
        <nav>${navHtml}</nav>
      </div>
    </header>
    <main class="wrap">
      ${crumbHtml}
      <h1>${esc(o.h1)}</h1>
${o.body}
    </main>
    <footer class="bot">
      <div class="wrap">
        <nav>${navHtml}</nav>
        <p>${esc(FOOT[lang])}</p>
      </div>
    </footer>
  </body>
</html>
`;
}

/** BreadcrumbList JSON-LD built from the same [path,label] pairs the header renders. */
export function breadcrumbLd(crumbs) {
  if (!crumbs || crumbs.length < 2) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map(([href, label], i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: label,
      item: SITE + href,
    })),
  };
}

/** A source line. Returns '' when there is no URL — never a fake citation. */
export function sourceLine(url, label) {
  if (!url || !/^https?:\/\//i.test(url)) return '';
  let host = url;
  try {
    host = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    /* fall back to the raw string */
  }
  return `<p class="src">${esc(label)}: <a href="${esc(url)}" rel="nofollow noopener">${esc(host)}</a></p>`;
}
