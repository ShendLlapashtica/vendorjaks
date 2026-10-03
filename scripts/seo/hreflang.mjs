// hreflang — one place that decides what a page may declare, and one place
// that proves the declaration true.
//
// WHY THIS IS ITS OWN MODULE
// A `<link rel="alternate" hreflang="en">` is a factual claim: "there is an
// English version of this page, and it is at this URL". Google reports a
// wrong one as an error in Search Console, and the two ways to get it wrong
// are both easy to ship by accident:
//
//   1. DANGLING — declaring an alternate for a page that was never
//      generated. Symmetry between two language trees LOOKS obvious right
//      up to the first shelf that paginates differently, and the builder
//      that computes `/en/...` from `/...` by string substitution has no
//      way to notice.
//   2. ONE-WAY — page A points at B and B does not point back. Google
//      discards an unconfirmed pair entirely, so a one-way declaration buys
//      nothing and costs a warning.
//
// So nothing here trusts a builder's word. `alternateSet` produces the
// claim, and `verifyPairs` is handed the FULL list of pages that were
// actually written and re-derives whether each claim survives. build-seo
// strips the ones that do not, before anything reaches dist/.

/** The set of alternates a page may declare, or [] when it has no counterpart. */
export function alternateSet({ path, lang, altPath }) {
  if (!altPath) return [];
  const sq = lang === 'sq' ? path : altPath;
  const en = lang === 'sq' ? altPath : path;
  // Albanian is x-default: the site is for shoppers in Kosovo, and a reader
  // whose locale matches neither should land on the primary version rather
  // than on a translation of it.
  return [
    { hreflang: 'sq', href: sq },
    { hreflang: 'en', href: en },
    { hreflang: 'x-default', href: sq },
  ];
}

// The block is fenced by comments so build-seo can remove a rejected claim
// from finished HTML exactly, without a regex that has to understand <head>.
export const HREFLANG_OPEN = '<!--hreflang-->';
export const HREFLANG_CLOSE = '<!--/hreflang-->';

/** The fenced `<link rel="alternate">` block for one page, or '' if it has none. */
export function alternateBlock(page, site, esc = (s) => s) {
  const set = alternateSet(page);
  if (!set.length) return '';
  return (
    HREFLANG_OPEN +
    '\n    ' +
    set.map((a) => `<link rel="alternate" hreflang="${a.hreflang}" href="${esc(site + a.href)}" />`).join('\n    ') +
    '\n    ' +
    HREFLANG_CLOSE
  );
}

/** Removes a fenced alternates block from rendered HTML. Idempotent. */
export function stripAlternates(html) {
  const open = html.indexOf(HREFLANG_OPEN);
  if (open === -1) return html;
  const close = html.indexOf(HREFLANG_CLOSE, open);
  if (close === -1) return html;
  const end = close + HREFLANG_CLOSE.length;
  // Also swallow the leading indent and the trailing newline the block sat on.
  let start = open;
  while (start > 0 && (html[start - 1] === ' ' || html[start - 1] === '\t')) start -= 1;
  let stop = end;
  if (html[stop] === '\n') stop += 1;
  return html.slice(0, start) + html.slice(stop);
}

/**
 * Drops the fence comments once verification is done. The fence is a build
 * device; the deployed page keeps the three links and none of the scaffolding.
 */
export function removeFences(html) {
  return html.replace(new RegExp(`[ \\t]*${HREFLANG_OPEN}\\r?\\n|[ \\t]*${HREFLANG_CLOSE}\\r?\\n`, 'g'), '');
}

/**
 * Re-derives every hreflang claim against the pages that actually exist.
 *
 * @param {Array<{path:string,lang:string,altPath?:string|null}>} pages
 * @returns {{declared:string[],pairs:number,dangling:object[],nonReciprocal:object[],sameLang:object[]}}
 */
export function verifyPairs(pages) {
  const byPath = new Map();
  for (const p of pages) {
    if (byPath.has(p.path)) throw new Error(`hreflang: two pages generated for ${p.path}`);
    byPath.set(p.path, p);
  }

  const declared = [];
  const dangling = [];
  const nonReciprocal = [];
  const sameLang = [];

  for (const p of pages) {
    if (!p.altPath) continue;
    declared.push(p.path);
    const target = byPath.get(p.altPath);
    if (!target) {
      dangling.push({ path: p.path, altPath: p.altPath });
      continue;
    }
    if (target.lang === p.lang) {
      sameLang.push({ path: p.path, altPath: p.altPath, lang: p.lang });
      continue;
    }
    if (target.altPath !== p.path) {
      nonReciprocal.push({ path: p.path, altPath: p.altPath, backLink: target.altPath || null });
    }
  }

  const bad = new Set([...dangling, ...nonReciprocal, ...sameLang].map((x) => x.path));
  return {
    declared,
    pairs: (declared.length - bad.size) / 2,
    dangling,
    nonReciprocal,
    sameLang,
    rejected: bad,
  };
}
