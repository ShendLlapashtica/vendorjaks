// Page builders. Each returns { path, html, priority, changefreq } and is
// rendered by ../seo/html.mjs.
//
// COPY POLICY. Albanian is the primary language and the app already owns a
// voice, so wherever a sentence already exists in src/i18n/dictionary.js it
// is reused verbatim (see `d()` below) rather than re-written here. Strings
// that had no equivalent in the app are collected in NEW_SQ so they can be
// reviewed in one place by a native speaker.

import { renderPage, breadcrumbLd, esc, slugify, displayCase, clamp, sourceLine, SITE } from './html.mjs';
import { prefixSlug } from './model.mjs';

// Strings written for these pages because the app had no equivalent.
// A native speaker should review this block and nothing else.
const NEW_SQ = {
  isSerbianQ: 'A është {brand} markë serbe?',
  isSerbianYes: 'Po. {brand} është markë serbe.',
  ownedByLabel: 'kompania',
  whyListed: 'pse është në listë',
  sourceNoteLang: 'Shënimi i burimit, i pandryshuar (në anglisht):',
  brandShort: 'markat serbe',
  localShort: 'markat vendore',
  prefixShort: 'prefikset',
  catShort: 'kategoritë',
  productShort: 'produktet',
  brandDesc: 'Po. {brand} është markë serbe — {company}. Shiko alternativat vendore nga Kosova dhe Shqipëria.',
  brandDescNoAlt: 'Po. {brand} është markë serbe — {company}. Burimi dhe shpjegimi te faqja.',
  localDesc: '{brand} — {company}. Markë vendore nga {country}, me burimin që e vërteton prodhimin vendor.',
  brandsIndexH1: 'Markat serbe që shiten në Kosovë',
  brandsIndexLede:
    'Lista e markave për të cilat kemi dokumentuar pronësi ose seli në Serbi, secila me burimin e vet. Për secilën tregojmë alternativën vendore kur e kemi të verifikuar.',
  gapsHeading: 'kategori pa markë të vetme të verifikuar',
  gapsNote:
    'Për këto kategori nuk kemi arritur të verifikojmë një markë të vetme dominuese serbe, prandaj nuk kemi hapur faqe për to. Alternativat vendore në të njëjtën kategori i gjen te faqet e kategorive.',
  localIndexH1: 'Markat vendore nga Kosova dhe Shqipëria',
  localIndexLede:
    'Prodhues të dokumentuar nga Kosova dhe Shqipëria, secili me burimin që e vërteton se prodhimi është vendor. Këto janë markat që Vendorja sugjeron si zëvendësim.',
  replacesHeading: 'zëvendëson',
  sameProducerHeading: 'nga i njëjti prodhues',
  prefixIndexH1: 'Prefikset e barkodit GS1 sipas shtetit',
  prefixIndexLede:
    'Tri shifrat e para të një barkodi tregojnë te cila organizatë GS1 është regjistruar numri. Kjo është tabela e plotë e prefikseve, ashtu siç e përdor vetë aplikacioni.',
  prefixH1: 'Prefiksi {prefix} — {country}',
  prefixMeansSerbia:
    'Një barkod që fillon me {prefix} është regjistruar te GS1 Serbi. Ky është rasti ku Vendorja tregon alternativën vendore.',
  prefixMeansLocal: 'Një barkod që fillon me {prefix} është regjistruar te GS1 {country}.',
  prefixMeansOther:
    'Një barkod që fillon me {prefix} është regjistruar te GS1 {country}. Nuk është regjistruar në Serbi.',
  prefixExamples: 'produkte me këtë prefiks në katalogun e Kosovës',
  prefixNeighbours: 'prefikset fqinjë',
  prefixAll: 'tabela e plotë e prefikseve',
  productH1Suffix: 'barkodi {code}',
  pricesHeading: 'çmimet e regjistruara',
  pricesAsOf: 'Çmimet janë marrë nga katalogët online të dyqaneve më {date} dhe mund të kenë ndryshuar.',
  catIndexH1: 'Kategoritë e produkteve',
  catIndexLede:
    'Produktet e katalogut të Kosovës, të ndara sipas rafteve. Në secilën kategori produktet e regjistruara në GS1 Serbi vijnë të parat, me alternativat vendore për to.',
  catH1: '{label} — çka është serbe dhe çka vendore',
  catSerbianHeading: 'produkte të regjistruara në GS1 Serbi',
  catRestHeading: 'produktet e tjera në këtë kategori',
  productIndexH1: 'Të gjitha produktet',
  productIndexLede: 'Çdo produkt me barkod në katalogun e dyqaneve të Kosovës, me verdiktin e barkodit të tij.',
  page: 'faqja {n}',
  next: 'faqja tjetër',
  prev: 'faqja e mëparshme',
  openInApp: 'hape në aplikacion',
  scanCta: 'skano një produkt',
  notFoundH1: 'Kjo faqe nuk ekziston',
  notFoundBody: 'Lidhja që ke ndjekur nuk të çon askund. Provo njërën nga këto:',
  countOf: '{n} produkte',
  brandCount: '{n} marka',
};

const NEW_EN = {
  isSerbianQ: 'Is {brand} a Serbian brand?',
  isSerbianYes: 'Yes. {brand} is a Serbian brand.',
  ownedByLabel: 'company',
  whyListed: 'why it is listed',
  sourceNoteLang: '',
  brandShort: 'serbian brands',
  localShort: 'local brands',
  prefixShort: 'gs1 prefixes',
  catShort: 'categories',
  productShort: 'products',
  brandDesc: 'Yes. {brand} is a Serbian brand — {company}. See the documented Kosovar and Albanian alternatives.',
  brandDescNoAlt: 'Yes. {brand} is a Serbian brand — {company}. Source and explanation on the page.',
  localDesc: '{brand} — {company}. A documented local brand from {country}, with the source that establishes local production.',
  brandsIndexH1: 'Serbian brands sold in Kosovo',
  brandsIndexLede:
    'Every brand we can document as Serbian-owned or Serbian-seated, each with its source. Where a local replacement is verified, it is shown on the brand page.',
  gapsHeading: 'categories with no single verified brand',
  gapsNote:
    'For these categories we could not verify one dominant Serbian brand, so no brand page exists for them. Local alternatives in the same category are on the category pages.',
  localIndexH1: 'Local brands from Kosovo and Albania',
  localIndexLede:
    'Documented producers in Kosovo and Albania, each with the source that establishes local production. These are the brands Vendorja offers as replacements.',
  replacesHeading: 'replaces',
  sameProducerHeading: 'from the same producer',
  prefixIndexH1: 'GS1 barcode prefixes by country',
  prefixIndexLede:
    'The first three digits of a barcode identify which GS1 organisation issued the number. This is the full prefix table, exactly as the app uses it.',
  prefixH1: 'Barcode prefix {prefix} — {country}',
  prefixMeansSerbia:
    'A barcode starting with {prefix} was registered with GS1 Serbia. This is the case where Vendorja shows a local alternative.',
  prefixMeansLocal: 'A barcode starting with {prefix} was registered with GS1 {country}.',
  prefixMeansOther: 'A barcode starting with {prefix} was registered with GS1 {country}. It is not registered in Serbia.',
  prefixExamples: 'products with this prefix in the Kosovo catalogue',
  prefixNeighbours: 'neighbouring prefixes',
  prefixAll: 'the full prefix table',
  productH1Suffix: 'barcode {code}',
  pricesHeading: 'recorded prices',
  pricesAsOf: 'Prices were taken from the shops’ own online catalogues on {date} and may have changed since.',
  catIndexH1: 'Product categories',
  catIndexLede:
    'The Kosovo retail catalogue, split by shelf. In each category the GS1-Serbia-registered products come first, with the local alternatives to them.',
  catH1: '{label} — what is Serbian and what is local',
  catSerbianHeading: 'products registered with GS1 Serbia',
  catRestHeading: 'other products in this category',
  productIndexH1: 'All products',
  productIndexLede: 'Every barcoded product in the Kosovo shop catalogue, with the verdict for its barcode.',
  page: 'page {n}',
  next: 'next page',
  prev: 'previous page',
  openInApp: 'open in the app',
  scanCta: 'scan a product',
  notFoundH1: 'This page does not exist',
  notFoundBody: 'The link you followed does not lead anywhere. Try one of these:',
  countOf: '{n} products',
  brandCount: '{n} brands',
};

export function makeCopy(dict) {
  return (lang) => {
    const app = dict[lang] || dict.sq;
    const extra = lang === 'en' ? NEW_EN : NEW_SQ;
    return (key, vars) => {
      let s = extra[key] ?? app[key] ?? key;
      if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
      return s;
    };
  };
}

const COUNTRY_WORD = {
  sq: { kosovo: 'Kosovë', albania: 'Shqipëri', serbia: 'Serbi' },
  en: { kosovo: 'Kosovo', albania: 'Albania', serbia: 'Serbia' },
};

const P = {
  marka: (lang) => (lang === 'sq' ? '/marka' : '/en/marka'),
  vendore: (lang) => (lang === 'sq' ? '/vendore' : '/en/vendore'),
  barkodi: (lang) => (lang === 'sq' ? '/barkodi' : '/en/barkodi'),
  kategoria: (lang) => (lang === 'sq' ? '/kategoria' : '/en/kategoria'),
  produkt: () => '/produkt',
  home: (lang) => (lang === 'sq' ? '/' : '/en'),
};

const HOME_LABEL = { sq: 'ballina', en: 'home' };

// ---------------------------------------------------------------------------
// shared fragments
// ---------------------------------------------------------------------------

function ctaRow(t, lang) {
  return `<p style="margin-top:22px">
        <a class="cta" href="/skano">${esc(t('scanCta'))}</a>
        <a class="cta ghost" href="/eksploro">${esc(t('exploreTitle'))}</a>
      </p>`;
}

/**
 * The evidence notes in data/boycott-brands.json and
 * data/brand-alternatives.json are written in English. They are quoted
 * verbatim rather than machine-translated — this project's whole value is
 * that it does not restate a source in words the source did not use — so on
 * an Albanian page they are labelled and marked up as English.
 */
function evidenceBlock(text, t, lang) {
  if (!text) return '';
  if (lang === 'en') return `<p>${esc(text)}</p>`;
  return `<p class="src">${esc(t('sourceNoteLang'))}</p>
      <p lang="en">${esc(text)}</p>`;
}

/** The GS1 caveat. Always the app's own wording — never a paraphrase. */
function caveat(t) {
  return `<p class="note">${esc(t('honestyExplainerBody'))}</p>`;
}

function verdictBox(kind, word, lines) {
  return `<div class="verdict ${kind}">
        <span class="vword">${esc(word)}</span>
        ${lines.filter(Boolean).join('\n        ')}
      </div>`;
}

/** One local-alternative card. Renders only the fields the record actually has. */
function altCard(alt, t, lang, localSlugs) {
  const country = COUNTRY_WORD[lang][alt.country] || alt.country || '';
  const href = localSlugs?.has(slugify(alt.brand)) ? `${P.vendore(lang)}/${slugify(alt.brand)}` : null;
  const title = href ? `<a href="${esc(href)}">${esc(alt.brand)}</a>` : esc(alt.brand);
  const pairing =
    alt.pairingEvidence === 'reported'
      ? `<span class="tag">${esc(t('reportedPairing'))}</span>`
      : `<span class="tag" title="${esc(t('categoryMatchNotice'))}">${esc(t('choiceFallbackHeading'))}</span>`;
  return `<div class="card">
          ${alt.image ? `<img class="thumb" src="${esc(alt.image)}" alt="${esc(alt.brand)}" loading="lazy" decoding="async" width="320" height="240" />` : ''}
          <h3>${title}</h3>
          ${alt.company ? `<p class="note">${esc(t('producerCountryLine', { company: alt.company, country }))}</p>` : ''}
          ${alt.evidence ? `<p>${esc(alt.evidence)}</p>` : ''}
          ${pairing}
          ${sourceLine(alt.sourceUrl, t('sourceLink'))}
          ${sourceLine(alt.pairingUrl, t('reportedPairing'))}
        </div>`;
}

/**
 * Which Serbian brand's alternatives belong on this product's page.
 *
 * Most Wolt-harvested rows have `brand: null` — the brand is only in the
 * shop's title ("Plazma Keks 48*150 Bambi"). So after the app's own two
 * lookups (exact barcode, then the `brand` field) fail, the title's WHOLE
 * WORDS are offered to the same alias matcher. Two deliberate limits keep
 * that honest:
 *   - it runs ONLY on a product already judged Serbian by the barcode or by
 *     the boycott table, so it can never create a verdict; and
 *   - what it selects is the ALTERNATIVES list, never the ownership claim
 *     in the verdict box, which stays sourced to the prefix or to an exact
 *     boycott record.
 */
function serbianBrandForProduct(p, ctx) {
  if (p.classify.verdict !== 'SERBIAN') return null;
  if (p.classify.boycott) {
    const direct = ctx.brandBySlug.get(slugify(p.classify.boycott.brand));
    if (direct) return direct;
  }
  const words = String(p.name || '')
    .split(/[^\p{L}\p{N}&]+/u)
    .filter(Boolean)
    .join(',');
  const hit = ctx.findBoycottByBrand(words, ctx.boycottTable);
  return hit ? ctx.brandBySlug.get(slugify(hit.brand)) || null : null;
}

function productRow(p, lang, t) {
  const name = displayCase(p.name);
  const tag = p.isSerbian
    ? `<span class="tag rs">${esc(t('exploreFlaggedBadge'))}</span>`
    : p.classify.verdict === 'LOCAL'
    ? `<span class="tag loc">${esc(t('badgeVendore'))}</span>`
    : '';
  const price =
    p.priceLow != null
      ? p.priceLow === p.priceHigh
        ? `${p.priceLow.toFixed(2)} ${p.currency}`
        : `${p.priceLow.toFixed(2)}–${p.priceHigh.toFixed(2)} ${p.currency}`
      : '';
  return `<li><a href="/produkt/${esc(p.code)}">${esc(name)}</a> ${tag}${price ? `<span class="note"> · ${esc(price)}</span>` : ''}</li>`;
}

// ---------------------------------------------------------------------------
// /marka — Serbian brand pages
// ---------------------------------------------------------------------------

export function brandPage(brand, ctx, lang) {
  const t = ctx.copy(lang);
  const path = `${P.marka(lang)}/${brand.slug}`;
  const altPath = lang === 'sq' ? `/en/marka/${brand.slug}` : `/marka/${brand.slug}`;
  const crumbs = [
    [P.home(lang), HOME_LABEL[lang]],
    [P.marka(lang), t('brandShort')],
    [path, brand.name],
  ];

  const parts = [];
  parts.push(
    verdictBox('no', t('bojkoto'), [
      `<p><strong>${esc(t('isSerbianYes', { brand: brand.name }))}</strong></p>`,
      brand.company ? `<p>${esc(t('ownedByLabel'))}: ${esc(brand.company)}</p>` : '',
    ])
  );

  if (brand.evidence) {
    parts.push(`<h2>${esc(t('whyListed'))}</h2>`, evidenceBlock(brand.evidence, t, lang));
  }
  parts.push(sourceLine(brand.sourceUrl, t('sourceLink')));

  // Alternatives, grouped by the category the pairing was made in.
  const alts = [];
  for (const entry of brand.entries) {
    for (const alt of entry.alternatives || []) alts.push(alt);
  }
  parts.push(`<h2>${esc(t('alternativesTitle'))}</h2>`);
  if (alts.length) {
    parts.push(`<p>${esc(t('alternativesSubtitleSerbian'))}</p>`);
    parts.push(`<div class="grid">${alts.map((a) => altCard(a, t, lang, ctx.localSlugs)).join('')}</div>`);
  } else {
    parts.push(`<p>${esc(t('choiceNoAlternatives'))}</p>`);
  }

  // Products in the catalogue carrying this brand — real rows, or nothing.
  const own = ctx.products.filter((p) => p.boycott && p.boycott.brand === brand.name).slice(0, 24);
  if (own.length) {
    parts.push(`<h2>${esc(t('listedAtIntro'))}</h2>`);
    parts.push(`<ul class="plain">${own.map((p) => productRow(p, lang, t)).join('')}</ul>`);
  }

  parts.push(`<h2>${esc(t('honestyExplainerTitle'))}</h2>`, caveat(t), ctaRow(t, lang));

  // Built from structured fields, never from the English evidence note: a
  // Serbian-language snippet under an Albanian title reads as a broken page.
  const companyShort = (brand.company || '').split(',')[0].trim().replace(/[.\s]+$/, '');
  const description = clamp(
    t(alts.length ? 'brandDesc' : 'brandDescNoAlt', { brand: brand.name, company: companyShort })
  );

  return {
    path,
    lang,
    altPath,
    priority: 0.9,
    html: renderPage({
      cssHref: ctx.cssHref,
      lang,
      path,
      altPath,
      title: `${t('isSerbianQ', { brand: brand.name })} | Vendorja`,
      description,
      h1: t('isSerbianQ', { brand: brand.name }),
      crumbs,
      body: parts.filter(Boolean).join('\n      '),
      jsonLd: [
        breadcrumbLd(crumbs),
        {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: t('isSerbianQ', { brand: brand.name }),
          url: SITE + path,
          inLanguage: lang,
          about: {
            '@type': 'Brand',
            name: brand.name,
            ...(brand.company ? { manufacturer: { '@type': 'Organization', name: brand.company } } : {}),
          },
          ...(alts.length
            ? {
                mainEntity: {
                  '@type': 'ItemList',
                  name: t('alternativesTitle'),
                  itemListElement: alts.map((a, i) => ({
                    '@type': 'ListItem',
                    position: i + 1,
                    item: {
                      '@type': 'Brand',
                      name: a.brand,
                      ...(a.company ? { manufacturer: { '@type': 'Organization', name: a.company } } : {}),
                    },
                  })),
                },
              }
            : {}),
        },
      ],
    }),
  };
}

export function brandsIndex(ctx, lang) {
  const t = ctx.copy(lang);
  const path = P.marka(lang);
  const altPath = lang === 'sq' ? '/en/marka' : '/marka';
  const crumbs = [
    [P.home(lang), HOME_LABEL[lang]],
    [path, t('brandsIndexH1')],
  ];

  const rows = ctx.brands
    .map(
      (b) =>
        `<li><a href="${esc(P.marka(lang))}/${esc(b.slug)}">${esc(b.name)}</a>${
          b.company ? `<span class="note"> — ${esc(b.company.split(',')[0])}</span>` : ''
        }</li>`
    )
    .join('');

  const gapRows = ctx.gaps
    .map((g) => `<li>${esc(g.serbianBrand)}</li>`)
    .join('');

  const body = [
    `<p class="lede">${esc(t('brandsIndexLede'))}</p>`,
    `<p class="note">${esc(t('brandCount', { n: ctx.brands.length }))}</p>`,
    `<ul class="plain">${rows}</ul>`,
    `<h2>${esc(t('gapsHeading'))}</h2>`,
    `<p class="note">${esc(t('gapsNote'))}</p>`,
    `<ul class="plain">${gapRows}</ul>`,
    `<h2>${esc(t('honestyExplainerTitle'))}</h2>`,
    caveat(t),
    ctaRow(t, lang),
  ].join('\n      ');

  return {
    path,
    lang,
    altPath,
    priority: 0.9,
    html: renderPage({
      cssHref: ctx.cssHref,
      lang,
      path,
      altPath,
      title: `${t('brandsIndexH1')} | Vendorja`,
      description: clamp(t('brandsIndexLede')),
      h1: t('brandsIndexH1'),
      crumbs,
      body,
      jsonLd: [
        breadcrumbLd(crumbs),
        {
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: t('brandsIndexH1'),
          numberOfItems: ctx.brands.length,
          itemListElement: ctx.brands.map((b, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: b.name,
            url: SITE + P.marka(lang) + '/' + b.slug,
          })),
        },
      ],
    }),
  };
}

// ---------------------------------------------------------------------------
// /vendore — local replacement brands
// ---------------------------------------------------------------------------

export function localBrandPage(rec, ctx, lang) {
  const t = ctx.copy(lang);
  const path = `${P.vendore(lang)}/${rec.slug}`;
  const altPath = lang === 'sq' ? `/en/vendore/${rec.slug}` : `/vendore/${rec.slug}`;
  const country = COUNTRY_WORD[lang][rec.country] || rec.country || '';
  const crumbs = [
    [P.home(lang), HOME_LABEL[lang]],
    [P.vendore(lang), t('localShort')],
    [path, rec.brand],
  ];

  const parts = [];
  parts.push(
    verdictBox('yes', country ? `${t('badgeVendore')} · ${country}` : t('badgeVendore'), [
      rec.company ? `<p><strong>${esc(t('producerCompanyLine', { company: rec.company }))}</strong></p>` : '',
      rec.evidence ? evidenceBlock(rec.evidence, t, lang) : '',
    ])
  );
  parts.push(sourceLine(rec.sourceUrl, t('sourceLink')));

  if (rec.image) {
    parts.push(
      `<p><img class="thumb" style="max-width:380px" src="${esc(rec.image)}" alt="${esc(rec.brand)}" loading="lazy" decoding="async" width="380" height="285" /></p>`,
      rec.imageCredit ? `<p class="src">${esc(rec.imageCredit)}</p>` : ''
    );
  }

  if (rec.replaces.length) {
    parts.push(`<h2>${esc(t('replacesHeading'))}</h2>`);
    parts.push(
      `<ul class="plain">${rec.replaces
        .map((r) => {
          const b = ctx.brandBySerbianEntry.get(r.brand);
          const label = b ? `<a href="${esc(P.marka(lang))}/${esc(b.slug)}">${esc(r.brand)}</a>` : esc(r.brand);
          const tag =
            r.pairing === 'reported'
              ? `<span class="tag">${esc(t('reportedPairing'))}</span>`
              : `<span class="tag">${esc(t('categoryMatchNotice'))}</span>`;
          return `<li>${label} ${tag}${sourceLine(r.pairingUrl, t('sourceLink'))}</li>`;
        })
        .join('')}</ul>`
    );
  }

  const siblings = ctx.localBrands.filter((x) => x.slug !== rec.slug && x.company && x.company === rec.company);
  if (siblings.length) {
    parts.push(`<h2>${esc(t('sameProducerHeading'))}</h2>`);
    parts.push(
      `<ul class="plain">${siblings
        .map((s) => `<li><a href="${esc(P.vendore(lang))}/${esc(s.slug)}">${esc(s.brand)}</a></li>`)
        .join('')}</ul>`
    );
  }

  parts.push(caveat(t), ctaRow(t, lang));

  return {
    path,
    lang,
    altPath,
    priority: 0.7,
    html: renderPage({
      cssHref: ctx.cssHref,
      lang,
      path,
      altPath,
      title: `${rec.brand}${country ? ` — ${country}` : ''} | Vendorja`,
      description: clamp(
        t('localDesc', {
          brand: rec.brand,
          company: (rec.company || '').split(',')[0].trim().replace(/[.\s]+$/, ''),
          country,
        })
      ),
      h1: rec.brand,
      crumbs,
      body: parts.filter(Boolean).join('\n      '),
      jsonLd: [
        breadcrumbLd(crumbs),
        {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: rec.brand,
          url: SITE + path,
          inLanguage: lang,
          about: {
            '@type': 'Brand',
            name: rec.brand,
            ...(rec.company ? { manufacturer: { '@type': 'Organization', name: rec.company } } : {}),
          },
        },
      ],
    }),
  };
}

export function localBrandsIndex(ctx, lang) {
  const t = ctx.copy(lang);
  const path = P.vendore(lang);
  const altPath = lang === 'sq' ? '/en/vendore' : '/vendore';
  const crumbs = [
    [P.home(lang), HOME_LABEL[lang]],
    [path, t('localIndexH1')],
  ];

  const group = (code) =>
    ctx.localBrands
      .filter((r) => r.country === code)
      .map(
        (r) =>
          `<li><a href="${esc(P.vendore(lang))}/${esc(r.slug)}">${esc(r.brand)}</a>${
            r.company ? `<span class="note"> — ${esc(r.company.split(',')[0])}</span>` : ''
          }</li>`
      )
      .join('');

  const body = [
    `<p class="lede">${esc(t('localIndexLede'))}</p>`,
    `<h2>${esc(COUNTRY_WORD[lang].kosovo)}</h2>`,
    `<ul class="plain">${group('kosovo')}</ul>`,
    `<h2>${esc(COUNTRY_WORD[lang].albania)}</h2>`,
    `<ul class="plain">${group('albania')}</ul>`,
    `<p class="note">${esc(t('allAltFoot'))}</p>`,
    ctaRow(t, lang),
  ].join('\n      ');

  return {
    path,
    lang,
    altPath,
    priority: 0.8,
    html: renderPage({
      cssHref: ctx.cssHref,
      lang,
      path,
      altPath,
      title: `${t('localIndexH1')} | Vendorja`,
      description: clamp(t('localIndexLede')),
      h1: t('localIndexH1'),
      crumbs,
      body,
      jsonLd: [breadcrumbLd(crumbs)],
    }),
  };
}

// ---------------------------------------------------------------------------
// /barkodi — GS1 prefix reference
// ---------------------------------------------------------------------------

export function prefixPage(range, ctx, lang) {
  const t = ctx.copy(lang);
  const slug = prefixSlug(range);
  const path = `${P.barkodi(lang)}/${slug}`;
  const altPath = lang === 'sq' ? `/en/barkodi/${slug}` : `/barkodi/${slug}`;
  const country = lang === 'sq' ? range.countrySq || range.country : range.country;
  const crumbs = [
    [P.home(lang), HOME_LABEL[lang]],
    [P.barkodi(lang), t('prefixShort')],
    [path, `${t('prefixLabel', { prefix: slug })}`],
  ];

  const parts = [];
  if (range.isSerbia) {
    parts.push(
      verdictBox('no', t('bojkoto'), [`<p>${esc(t('prefixMeansSerbia', { prefix: slug, country }))}</p>`])
    );
  } else if (range.isLocal) {
    parts.push(
      verdictBox('yes', t('badgeVendore'), [`<p>${esc(t('prefixMeansLocal', { prefix: slug, country }))}</p>`])
    );
  } else if (range.kind === 'country') {
    parts.push(
      verdictBox('grey', t('resultForeignWord'), [`<p>${esc(t('prefixMeansOther', { prefix: slug, country }))}</p>`])
    );
  } else {
    const wordKey = {
      restricted: 'notCountryRestrictedWord',
      coupon: 'notCountryCouponWord',
      isbn: 'notCountryIsbnWord',
      issn: 'notCountryIssnWord',
      refund: 'notCountryRefundWord',
      office: 'notCountryOfficeWord',
      unassigned: 'notCountryUnassignedWord',
    }[range.kind];
    const bodyKey = {
      restricted: 'notCountryRestrictedBody',
      coupon: 'notCountryCouponBody',
      isbn: 'notCountryIsbnBody',
      issn: 'notCountryIssnBody',
      refund: 'notCountryRefundBody',
      office: 'notCountryOfficeBody',
      unassigned: 'notCountryUnassignedBody',
    }[range.kind];
    parts.push(
      verdictBox('grey', wordKey ? t(wordKey) : range.kind, [bodyKey ? `<p>${esc(t(bodyKey))}</p>` : ''])
    );
  }

  if (range.note) parts.push(`<p>${esc(range.note)}</p>`);
  parts.push(`<p class="note">${esc(t('issuedBy', { prefix: slug, country }))}</p>`);

  const examples = ctx.productsByPrefixSlug.get(slug) || [];
  if (examples.length) {
    parts.push(`<h2>${esc(t('prefixExamples'))}</h2>`);
    parts.push(`<ul class="plain">${examples.slice(0, 20).map((p) => productRow(p, lang, t)).join('')}</ul>`);
    parts.push(`<p class="note">${esc(t('countOf', { n: examples.length }))}</p>`);
  }

  const idx = ctx.ranges.indexOf(range);
  const near = [ctx.ranges[idx - 1], ctx.ranges[idx + 1]].filter(Boolean);
  if (near.length) {
    parts.push(`<h2>${esc(t('prefixNeighbours'))}</h2>`);
    parts.push(
      `<ul class="plain">${near
        .map((r) => {
          const s = prefixSlug(r);
          const c = lang === 'sq' ? r.countrySq || r.country : r.country;
          return `<li><a href="${esc(P.barkodi(lang))}/${esc(s)}">${esc(t('prefixLabel', { prefix: s }))} — ${esc(c)}</a></li>`;
        })
        .join('')}</ul>`
    );
  }
  parts.push(`<p><a href="${esc(P.barkodi(lang))}">${esc(t('prefixAll'))}</a></p>`);
  parts.push(caveat(t), ctaRow(t, lang));

  const h1 = t('prefixH1', { prefix: slug, country });
  return {
    path,
    lang,
    altPath,
    priority: range.isSerbia || range.isLocal ? 0.8 : 0.5,
    html: renderPage({
      cssHref: ctx.cssHref,
      lang,
      path,
      altPath,
      title: `${h1} | Vendorja`,
      description: clamp(
        range.isSerbia
          ? t('prefixMeansSerbia', { prefix: slug, country })
          : range.isLocal
          ? t('prefixMeansLocal', { prefix: slug, country })
          : range.kind === 'country'
          ? t('prefixMeansOther', { prefix: slug, country })
          : `${t('prefixLabel', { prefix: slug })} — ${country}`
      ),
      h1,
      crumbs,
      body: parts.filter(Boolean).join('\n      '),
      jsonLd: [breadcrumbLd(crumbs)],
    }),
  };
}

export function prefixIndex(ctx, lang) {
  const t = ctx.copy(lang);
  const path = P.barkodi(lang);
  const altPath = lang === 'sq' ? '/en/barkodi' : '/barkodi';
  const crumbs = [
    [P.home(lang), HOME_LABEL[lang]],
    [path, t('prefixIndexH1')],
  ];

  const rows = ctx.ranges
    .map((r) => {
      const s = prefixSlug(r);
      const c = lang === 'sq' ? r.countrySq || r.country : r.country;
      const n = (ctx.productsByPrefixSlug.get(s) || []).length;
      return `<tr><td><a href="${esc(P.barkodi(lang))}/${esc(s)}">${esc(s)}</a></td><td>${esc(c)}</td><td>${esc(r.kind)}</td><td>${n || ''}</td></tr>`;
    })
    .join('');

  const body = [
    `<p class="lede">${esc(t('prefixIndexLede'))}</p>`,
    `<div class="scroll"><table><thead><tr><th>${esc(lang === 'sq' ? 'prefiksi' : 'prefix')}</th><th>${esc(
      lang === 'sq' ? 'shteti ose lloji' : 'country or kind'
    )}</th><th>${esc(lang === 'sq' ? 'kategoria' : 'kind')}</th><th>${esc(
      lang === 'sq' ? 'produkte' : 'products'
    )}</th></tr></thead><tbody>${rows}</tbody></table></div>`,
    `<h2>${esc(t('honestyExplainerTitle'))}</h2>`,
    caveat(t),
    ctaRow(t, lang),
  ].join('\n      ');

  return {
    path,
    lang,
    altPath,
    priority: 0.8,
    html: renderPage({
      cssHref: ctx.cssHref,
      lang,
      path,
      altPath,
      title: `${t('prefixIndexH1')} | Vendorja`,
      description: clamp(t('prefixIndexLede')),
      h1: t('prefixIndexH1'),
      crumbs,
      body,
      jsonLd: [breadcrumbLd(crumbs)],
    }),
  };
}

// ---------------------------------------------------------------------------
// /produkt — one page per barcode (Albanian only; see build-seo.mjs)
// ---------------------------------------------------------------------------

export function productPage(p, ctx) {
  const lang = 'sq';
  const t = ctx.copy(lang);
  const path = `/produkt/${p.code}`;
  const name = displayCase(p.name);
  const crumbs = [
    ['/', HOME_LABEL.sq],
    ['/produkt', t('productShort')],
    [path, name],
  ];

  const c = p.classify;
  const prefixSlugStr = ctx.prefixSlugForCode.get(p.code) || null;
  const parts = [];

  if (c.verdict === 'SERBIAN') {
    parts.push(
      verdictBox('no', t('bojkoto'), [
        c.boycott
          ? `<p><strong>${esc(c.boycott.brand)}</strong> — ${esc(c.boycott.company || '')}</p>`
          : `<p>${esc(t('issuedBy', { prefix: c.prefix, country: c.countrySq || c.country }))}</p>`,
        c.issuerDiffersFromOwner
          ? `<p>${esc(t('boycottIssuerDiffers', { issuer: c.countrySq || c.country, company: c.boycott?.company || '' }))}</p>`
          : '',
        c.boycott?.evidence ? evidenceBlock(c.boycott.evidence, t, lang) : '',
      ])
    );
    if (c.boycott?.sourceUrl) parts.push(sourceLine(c.boycott.sourceUrl, t('sourceLink')));
  } else if (c.verdict === 'LOCAL') {
    parts.push(
      verdictBox('yes', t('resultVendoreWord'), [
        `<p>${esc(t('issuedBy', { prefix: c.prefix, country: c.countrySq || c.country }))}</p>`,
        `<p>${esc(t('verdictOtherNote'))}</p>`,
      ])
    );
  } else if (c.verdict === 'OTHER') {
    parts.push(
      verdictBox('grey', t('resultForeignWord'), [
        `<p>${esc(t('resultRegisteredNote', { country: c.countrySq || c.country }))}</p>`,
      ])
    );
  } else {
    const key =
      c.kind === 'restricted'
        ? ['notCountryRestrictedWord', 'notCountryRestrictedBody']
        : c.kind === 'coupon'
        ? ['notCountryCouponWord', 'notCountryCouponBody']
        : c.kind === 'isbn'
        ? ['notCountryIsbnWord', 'notCountryIsbnBody']
        : c.verdict === 'UNASSIGNED'
        ? ['notCountryUnassignedWord', 'notCountryUnassignedBody']
        : ['notCountryUnknownWord', 'notCountryUnknownBody'];
    parts.push(verdictBox('grey', t(key[0]), [`<p>${esc(t(key[1]))}</p>`]));
  }

  // Facts panel — only fields the catalogue actually carries.
  const facts = [
    [t('codeLabel'), p.code],
    [t('prefixLabel', { prefix: '' }).trim() || 'prefiksi', prefixSlugStr ? `<a href="/barkodi/${esc(prefixSlugStr)}">${esc(c.prefix)}</a>` : c.prefix],
    p.brand ? [lang === 'sq' ? 'marka' : 'brand', esc(p.brand)] : null,
    // Only link the hub when one was actually generated: shelves with a
    // handful of products get no page, and a link to a 404 is worse than no
    // link at all.
    p.category
      ? [
          lang === 'sq' ? 'kategoria' : 'category',
          ctx.categorySlugs.has(slugify(p.category))
            ? `<a href="/kategoria/${esc(slugify(p.category))}">${esc(p.category)}</a>`
            : esc(p.category),
        ]
      : null,
  ].filter(Boolean);
  parts.push(
    `<div class="scroll"><table><tbody>${facts
      .map(([k, v]) => `<tr><th>${esc(k)}</th><td>${v}</td></tr>`)
      .join('')}</tbody></table></div>`
  );

  // isLocalBrand is true | false | null and ONLY `true` may show the badge.
  if (p.isLocalBrand === true && p.localEvidence) {
    parts.push(`<p><span class="tag loc">${esc(t('badgeVendore'))}</span> ${esc(p.localEvidence)}</p>`);
  }

  if (p.image) {
    parts.push(
      `<p><img class="thumb" style="max-width:380px" src="${esc(p.image)}" alt="${esc(name)}" loading="lazy" decoding="async" width="380" height="285" referrerpolicy="no-referrer" /></p>`
    );
  }

  // Prices, always dated — a harvested price is a fact about a moment.
  const priced = p.rows.filter((r) => typeof r.price === 'number' && r.price > 0);
  if (priced.length) {
    parts.push(`<h2>${esc(t('pricesHeading'))}</h2>`);
    parts.push(
      `<div class="scroll"><table><thead><tr><th>${esc(lang === 'sq' ? 'dyqani' : 'shop')}</th><th>${esc(
        lang === 'sq' ? 'çmimi' : 'price'
      )}</th></tr></thead><tbody>${priced
        .map(
          (r) =>
            `<tr><td>${
              r.url && /^https?:\/\//i.test(r.url)
                ? `<a href="${esc(r.url)}" rel="nofollow noopener">${esc(r.sourceLabel || r.source)}</a>`
                : esc(r.sourceLabel || r.source || '')
            }</td><td>${esc(r.price.toFixed(2))} ${esc(r.currency || 'EUR')}</td></tr>`
        )
        .join('')}</tbody></table></div>`
    );
    if (ctx.retailBuiltAt) parts.push(`<p class="note">${esc(t('pricesAsOf', { date: ctx.retailBuiltAt }))}</p>`);
  }

  // Alternatives, only for a Serbian verdict and only from the curated table.
  if (c.verdict === 'SERBIAN') {
    const brand = serbianBrandForProduct(p, ctx);
    const alts = brand ? brand.entries.flatMap((e) => e.alternatives || []) : [];
    parts.push(`<h2>${esc(t('alternativesTitle'))}</h2>`);
    if (alts.length) {
      parts.push(`<p>${esc(t('alternativesSubtitleSerbian'))}</p>`);
      parts.push(`<div class="grid">${alts.slice(0, 6).map((a) => altCard(a, t, lang, ctx.localSlugs)).join('')}</div>`);
      parts.push(`<p><a href="/marka/${esc(brand.slug)}">${esc(t('isSerbianQ', { brand: brand.name }))}</a></p>`);
    } else {
      parts.push(`<p>${esc(t('choiceNoAlternatives'))}</p>`);
      if (p.category && ctx.categorySlugs.has(slugify(p.category))) {
        parts.push(`<p><a href="/kategoria/${esc(slugify(p.category))}">${esc(p.category)}</a></p>`);
      }
    }
  }

  parts.push(
    `<p style="margin-top:22px"><a class="cta" href="/b/${esc(p.code)}">${esc(t('openInApp'))}</a><a class="cta ghost" href="/skano">${esc(
      t('scanCta')
    )}</a></p>`
  );
  parts.push(caveat(t));

  const verdictWord =
    c.verdict === 'SERBIAN'
      ? 'produkt serb'
      : c.verdict === 'LOCAL'
      ? 'produkt vendor'
      : c.verdict === 'OTHER'
      ? `GS1 ${c.countrySq || c.country}`
      : 'barkod jo-produkti';

  // Product titles must survive a ~65-character result snippet, and the
  // barcode plus the verdict word already take about 25 of them.
  const shortName = name.length > 38 ? name.slice(0, 37).trim().replace(/[\s,\-–—]+$/, '') + '…' : name;
  const description = clamp(
    c.verdict === 'SERBIAN'
      ? `${name} (${p.code}) është regjistruar si produkt serb. ${
          c.boycott?.company ? c.boycott.company + '. ' : ''
        }Shiko alternativat vendore nga Kosova dhe Shqipëria.`
      : `${name} — barkodi ${p.code}, ${t('issuedBy', { prefix: c.prefix, country: c.countrySq || c.country })}.`
  );

  return {
    path,
    lang,
    altPath: null,
    priority: c.verdict === 'SERBIAN' ? 0.8 : 0.4,
    html: renderPage({
      cssHref: ctx.cssHref,
      lang,
      path,
      title: `${shortName} ${p.code} — ${verdictWord}`,
      description,
      h1: name,
      crumbs,
      body: parts.filter(Boolean).join('\n      '),
      jsonLd: [
        breadcrumbLd(crumbs),
        {
          '@context': 'https://schema.org',
          '@type': 'Product',
          name,
          ...(p.code.length === 13 ? { gtin13: p.code } : p.code.length === 8 ? { gtin8: p.code } : { gtin: p.code }),
          ...(p.brand ? { brand: { '@type': 'Brand', name: p.brand } } : {}),
          ...(p.image ? { image: p.image } : {}),
          ...(p.category ? { category: p.category } : {}),
          url: SITE + path,
        },
      ],
    }),
  };
}

// ---------------------------------------------------------------------------
// listing pages
// ---------------------------------------------------------------------------

function pager(basePath, page, total, t) {
  if (total <= 1) return '';
  const href = (n) => (n === 1 ? basePath : `${basePath}/faqja-${n}`);
  const bits = [];
  if (page > 1) bits.push(`<a href="${esc(href(page - 1))}">← ${esc(t('prev'))}</a>`);
  bits.push(`<span class="note">${esc(t('page', { n: page }))} / ${total}</span>`);
  if (page < total) bits.push(`<a href="${esc(href(page + 1))}">${esc(t('next'))} →</a>`);
  return `<nav class="pager">${bits.join('')}</nav>`;
}

export function categoryPage(cat, ctx, lang, page, perPage) {
  const t = ctx.copy(lang);
  const base = `${P.kategoria(lang)}/${cat.slug}`;
  const path = page === 1 ? base : `${base}/faqja-${page}`;
  // The two language trees paginate from the SAME product list with the same
  // page size, so page N exists on both sides for every shelf — which is why
  // page 2 may point at page 2 rather than being left without a counterpart
  // (Google's rule for paginated sets: alternate to the equivalent page, not
  // to page 1). "May", not "does": build-seo drops any pair whose counterpart
  // was not actually written, so a future change to PER_PAGE on one side
  // cannot quietly turn this into a dangling claim.
  const altBase = lang === 'sq' ? `/en/kategoria/${cat.slug}` : `/kategoria/${cat.slug}`;
  const altPath = page === 1 ? altBase : `${altBase}/faqja-${page}`;
  const total = Math.max(1, Math.ceil(cat.products.length / perPage));
  const slice = cat.products.slice((page - 1) * perPage, page * perPage);
  const serbian = slice.filter((p) => p.isSerbian);
  const rest = slice.filter((p) => !p.isSerbian);
  const crumbs = [
    [P.home(lang), HOME_LABEL[lang]],
    [P.kategoria(lang), t('catShort')],
    [base, cat.label],
  ];

  const parts = [`<p class="lede">${esc(t('countOf', { n: cat.products.length }))}</p>`];
  if (serbian.length) {
    parts.push(`<h2>${esc(t('catSerbianHeading'))}</h2>`);
    parts.push(`<ul class="plain">${serbian.map((p) => productRow(p, lang, t)).join('')}</ul>`);
  }
  if (rest.length) {
    parts.push(`<h2>${esc(t('catRestHeading'))}</h2>`);
    parts.push(`<ul class="plain">${rest.map((p) => productRow(p, lang, t)).join('')}</ul>`);
  }
  parts.push(pager(base, page, total, t));
  parts.push(`<p><a href="${esc(P.kategoria(lang))}">${esc(t('catIndexH1'))}</a></p>`);
  parts.push(caveat(t), ctaRow(t, lang));

  const h1 = page === 1 ? t('catH1', { label: cat.label }) : `${cat.label} — ${t('page', { n: page })}`;
  return {
    path,
    lang,
    altPath,
    priority: page === 1 ? 0.7 : 0.3,
    html: renderPage({
      cssHref: ctx.cssHref,
      lang,
      path,
      altPath,
      title: `${h1} | Vendorja`,
      description: clamp(
        `${cat.label}: ${t('countOf', { n: cat.products.length })}, ${cat.serbianCount} ${
          lang === 'sq' ? 'të regjistruara në GS1 Serbi' : 'registered with GS1 Serbia'
        }.${page > 1 ? ` ${t('page', { n: page })}/${total}.` : ''}`
      ),
      h1,
      crumbs,
      body: parts.filter(Boolean).join('\n      '),
      jsonLd: [breadcrumbLd(crumbs)],
      robots: page === 1 ? undefined : 'index, follow',
    }),
  };
}

export function categoriesIndex(ctx, lang) {
  const t = ctx.copy(lang);
  const path = P.kategoria(lang);
  const altPath = lang === 'sq' ? '/en/kategoria' : '/kategoria';
  const crumbs = [
    [P.home(lang), HOME_LABEL[lang]],
    [path, t('catIndexH1')],
  ];
  const rows = ctx.categories
    .map(
      (c) =>
        `<li><a href="${esc(P.kategoria(lang))}/${esc(c.slug)}">${esc(c.label)}</a><span class="note"> — ${esc(
          t('countOf', { n: c.products.length })
        )}${c.serbianCount ? `, ${c.serbianCount} ${esc(lang === 'sq' ? 'serbe' : 'serbian')}` : ''}</span></li>`
    )
    .join('');
  const body = [
    `<p class="lede">${esc(t('catIndexLede'))}</p>`,
    `<ul class="plain">${rows}</ul>`,
    `<p><a href="/produkt">${esc(t('productIndexH1'))}</a></p>`,
    ctaRow(t, lang),
  ].join('\n      ');

  return {
    path,
    lang,
    altPath,
    priority: 0.7,
    html: renderPage({
      cssHref: ctx.cssHref,
      lang,
      path,
      altPath,
      title: `${t('catIndexH1')} | Vendorja`,
      description: clamp(t('catIndexLede')),
      h1: t('catIndexH1'),
      crumbs,
      body,
      jsonLd: [breadcrumbLd(crumbs)],
    }),
  };
}

export function productIndexPage(ctx, page, perPage) {
  const lang = 'sq';
  const t = ctx.copy(lang);
  const base = '/produkt';
  const path = page === 1 ? base : `${base}/faqja-${page}`;
  const total = Math.max(1, Math.ceil(ctx.products.length / perPage));
  const slice = ctx.products.slice((page - 1) * perPage, page * perPage);
  const crumbs = [
    ['/', HOME_LABEL.sq],
    [base, t('productIndexH1')],
  ];
  const body = [
    `<p class="lede">${esc(t('productIndexLede'))}</p>`,
    `<p class="note">${esc(t('countOf', { n: ctx.products.length }))}</p>`,
    `<ul class="plain">${slice.map((p) => productRow(p, lang, t)).join('')}</ul>`,
    pager(base, page, total, t),
    `<p><a href="/kategoria">${esc(t('catIndexH1'))}</a> · <a href="/marka">${esc(t('brandsIndexH1'))}</a></p>`,
    ctaRow(t, lang),
  ].join('\n      ');

  return {
    path,
    lang,
    altPath: null,
    priority: page === 1 ? 0.6 : 0.3,
    html: renderPage({
      cssHref: ctx.cssHref,
      lang,
      path,
      title: `${t('productIndexH1')}${page > 1 ? ` — ${t('page', { n: page })}` : ''} | Vendorja`,
      description: clamp(
        `${t('productIndexLede')}${page > 1 ? ` ${t('page', { n: page })}/${total}.` : ''}`
      ),
      h1: `${t('productIndexH1')}${page > 1 ? ` — ${t('page', { n: page })}` : ''}`,
      crumbs,
      body,
      jsonLd: [breadcrumbLd(crumbs)],
    }),
  };
}

export function enHome(ctx) {
  const lang = 'en';
  const t = ctx.copy(lang);
  const path = '/en';
  const crumbs = [['/en', 'home']];
  const body = [
    `<p class="lede">${esc(t('exploreTagline'))}</p>`,
    `<p>${esc(t('honestyExplainerBody'))}</p>`,
    `<h2>${esc(t('brandsIndexH1'))}</h2>`,
    `<p><a href="/en/marka">${esc(t('brandsIndexH1'))}</a> — ${esc(t('brandCount', { n: ctx.brands.length }))}</p>`,
    `<h2>${esc(t('localIndexH1'))}</h2>`,
    `<p><a href="/en/vendore">${esc(t('localIndexH1'))}</a> — ${esc(t('brandCount', { n: ctx.localBrands.length }))}</p>`,
    `<h2>${esc(t('prefixIndexH1'))}</h2>`,
    `<p><a href="/en/barkodi">${esc(t('prefixIndexH1'))}</a></p>`,
    `<h2>${esc(t('catIndexH1'))}</h2>`,
    `<p><a href="/en/kategoria">${esc(t('catIndexH1'))}</a> · <a href="/produkt">${esc(t('productIndexH1'))}</a></p>`,
    ctaRow(t, lang),
  ].join('\n      ');

  return {
    path,
    lang,
    altPath: '/',
    priority: 0.7,
    html: renderPage({
      cssHref: ctx.cssHref,
      lang,
      path,
      altPath: '/',
      ogType: 'website',
      title: 'Vendorja — scan a barcode, find the local alternative',
      description:
        'Scan a product barcode in Kosovo. If it is registered with GS1 Serbia or owned by a Serbian company, Vendorja shows a documented Kosovar or Albanian alternative.',
      h1: 'Vendorja — scan a barcode, find the local alternative',
      crumbs,
      body,
      jsonLd: [breadcrumbLd(crumbs)],
    }),
  };
}

export function notFoundPage(ctx) {
  const t = ctx.copy('sq');
  const body = [
    `<p class="lede">${esc(t('notFoundBody'))}</p>`,
    `<ul class="plain">
        <li><a href="/">${esc(t('backHome'))}</a></li>
        <li><a href="/marka">${esc(t('brandsIndexH1'))}</a></li>
        <li><a href="/vendore">${esc(t('localIndexH1'))}</a></li>
        <li><a href="/kategoria">${esc(t('catIndexH1'))}</a></li>
        <li><a href="/barkodi">${esc(t('prefixIndexH1'))}</a></li>
        <li><a href="/pyetje">${esc(t('faqTitle'))}</a></li>
      </ul>`,
    ctaRow(t, 'sq'),
  ].join('\n      ');
  return {
    path: '/404',
    lang: 'sq',
    altPath: null,
    skipSitemap: true,
    html: renderPage({
      cssHref: ctx.cssHref,
      lang: 'sq',
      path: '/404',
      title: `${t('notFoundH1')} | Vendorja`,
      description: t('notFoundBody'),
      h1: t('notFoundH1'),
      body,
      robots: 'noindex, follow',
    }),
  };
}

export { NEW_SQ, NEW_EN, P, COUNTRY_WORD };
