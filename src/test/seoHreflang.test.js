// hreflang, as a test.
//
// A wrong `<link rel="alternate">` is not a cosmetic problem: Google reports
// a dangling or one-way alternate as an error and discards the pair, so the
// page gets the cost and none of the benefit. The rules are small enough to
// pin down exactly, which is what this file does — and then, when a build
// happens to be present, it re-checks the real dist/ against the same rules
// instead of trusting the build's own report.

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  alternateSet,
  alternateBlock,
  stripAlternates,
  verifyPairs,
  HREFLANG_OPEN,
  HREFLANG_CLOSE,
} from '../../scripts/seo/hreflang.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SITE = 'https://vendorja.com';

describe('alternateSet', () => {
  it('emits nothing when the page has no counterpart', () => {
    expect(alternateSet({ path: '/produkt/123', lang: 'sq', altPath: null })).toEqual([]);
    expect(alternateSet({ path: '/produkt/123', lang: 'sq' })).toEqual([]);
  });

  it('is self-referential — the page names itself under its own language', () => {
    const sq = alternateSet({ path: '/marka/bambi', lang: 'sq', altPath: '/en/marka/bambi' });
    expect(sq.find((a) => a.hreflang === 'sq').href).toBe('/marka/bambi');
    const en = alternateSet({ path: '/en/marka/bambi', lang: 'en', altPath: '/marka/bambi' });
    expect(en.find((a) => a.hreflang === 'en').href).toBe('/en/marka/bambi');
  });

  it('gives both sides of a pair the identical set — that is what makes it bidirectional', () => {
    const a = alternateSet({ path: '/kategoria/pije', lang: 'sq', altPath: '/en/kategoria/pije' });
    const b = alternateSet({ path: '/en/kategoria/pije', lang: 'en', altPath: '/kategoria/pije' });
    expect(a).toEqual(b);
  });

  it('points x-default at the Albanian page, never at the translation', () => {
    for (const p of [
      { path: '/vendore/x', lang: 'sq', altPath: '/en/vendore/x' },
      { path: '/en/vendore/x', lang: 'en', altPath: '/vendore/x' },
    ]) {
      expect(alternateSet(p).find((a) => a.hreflang === 'x-default').href).toBe('/vendore/x');
    }
  });

  it('uses only sq, en and x-default', () => {
    const set = alternateSet({ path: '/', lang: 'sq', altPath: '/en' });
    expect(set.map((a) => a.hreflang).sort()).toEqual(['en', 'sq', 'x-default']);
  });
});

describe('alternateBlock / stripAlternates', () => {
  const page = { path: '/marka/bambi', lang: 'sq', altPath: '/en/marka/bambi' };

  it('renders absolute URLs inside the fence', () => {
    const html = alternateBlock(page, SITE);
    expect(html).toContain(`href="${SITE}/marka/bambi"`);
    expect(html).toContain(`href="${SITE}/en/marka/bambi"`);
    expect(html.startsWith(HREFLANG_OPEN)).toBe(true);
    expect(html.endsWith(HREFLANG_CLOSE)).toBe(true);
  });

  it('renders nothing at all when there is no counterpart', () => {
    expect(alternateBlock({ path: '/produkt/1', lang: 'sq', altPath: null }, SITE)).toBe('');
  });

  it('strips the whole block and leaves the rest of the head untouched', () => {
    const doc = `<head>\n    <title>x</title>\n    ${alternateBlock(page, SITE)}\n    <meta name="robots" content="index" />\n  </head>`;
    const out = stripAlternates(doc);
    expect(out).not.toMatch(/hreflang/);
    expect(out).toContain('<title>x</title>');
    expect(out).toContain('<meta name="robots" content="index" />');
  });

  it('is a no-op on a page that never had a block', () => {
    const doc = '<head><title>x</title></head>';
    expect(stripAlternates(doc)).toBe(doc);
    expect(stripAlternates(stripAlternates(doc))).toBe(doc);
  });
});

describe('verifyPairs', () => {
  const ok = [
    { path: '/', lang: 'sq', altPath: '/en' },
    { path: '/en', lang: 'en', altPath: '/' },
    { path: '/produkt/1', lang: 'sq', altPath: null },
  ];

  it('accepts a reciprocal pair and ignores pages with no counterpart', () => {
    const r = verifyPairs(ok);
    expect(r.dangling).toEqual([]);
    expect(r.nonReciprocal).toEqual([]);
    expect(r.sameLang).toEqual([]);
    expect(r.pairs).toBe(1);
    expect(r.rejected.size).toBe(0);
  });

  it('rejects a claim whose counterpart was never generated', () => {
    // The real failure mode: one language tree paginates to page 7 and the
    // other stops at 6, so /kategoria/x/faqja-7 names a page that is not there.
    const r = verifyPairs([
      { path: '/kategoria/x/faqja-7', lang: 'sq', altPath: '/en/kategoria/x/faqja-7' },
    ]);
    expect(r.dangling).toHaveLength(1);
    expect(r.rejected.has('/kategoria/x/faqja-7')).toBe(true);
  });

  it('rejects a one-way declaration', () => {
    const r = verifyPairs([
      { path: '/a', lang: 'sq', altPath: '/en/a' },
      { path: '/en/a', lang: 'en', altPath: null },
    ]);
    expect(r.nonReciprocal).toHaveLength(1);
    expect(r.rejected.has('/a')).toBe(true);
  });

  it('rejects an alternate that is not actually another language', () => {
    const r = verifyPairs([
      { path: '/a', lang: 'sq', altPath: '/b' },
      { path: '/b', lang: 'sq', altPath: '/a' },
    ]);
    expect(r.sameLang).toHaveLength(2);
  });

  it('refuses two pages generated at the same path', () => {
    expect(() => verifyPairs([{ path: '/a', lang: 'sq' }, { path: '/a', lang: 'en' }])).toThrow(/two pages/);
  });
});

describe('vercel.json routing copes with a deep /en/... path', () => {
  // The SPA rewrite has to serve /en/produkt/<barcode> as
  // /en/produkt/<barcode>.html before generating such a tree is even an
  // option. Vercel's `source` is a path-to-regexp pattern; for the two rules
  // here (both of which supply their own capture group) the translation to a
  // RegExp is exact.
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
  const toRe = (source) => new RegExp('^' + source.replace(/:[A-Za-z_]\w*(\(.*\))/, '$1') + '$');

  const rewrite = (url) => {
    for (const r of cfg.rewrites) {
      const m = url.match(toRe(r.source));
      if (m) return r.destination.replace(/:[A-Za-z_]\w*(\(.*?\))?/, m[1] ?? '');
    }
    return null;
  };

  it('serves an /en/produkt/<barcode> URL from the matching .html', () => {
    expect(rewrite('/en/produkt/4006034103355')).toBe('/en/produkt/4006034103355.html');
  });

  it('already serves the deep paths the build really emits', () => {
    expect(rewrite('/en/kategoria/pije/faqja-2')).toBe('/en/kategoria/pije/faqja-2.html');
    expect(rewrite('/en/marka/bambi')).toBe('/en/marka/bambi.html');
    expect(rewrite('/produkt/4006034103355')).toBe('/produkt/4006034103355.html');
  });

  // The destination is the CLEAN url, not '/b.html', and that is not a
  // style choice — it is the fix for a live 404. Measured on production
  // before the change:
  //   /b/8600101990242  404 (Content-Disposition: filename="404")
  //   /b.html           308 -> /b
  //   /b?code=...       200
  // With cleanUrls: true, Vercel serves the page at '/b' and leaves only a
  // redirect behind at '/b.html'. A rewrite resolves its destination
  // against the FILESYSTEM, not against the redirect table, so a rewrite
  // to '/b.html' lands on nothing. Every /b/<barcode> deep link — which is
  // the URL the scanner shares — was a 404 for as long as this rule has
  // existed. The assertion below is what keeps it from coming back.
  it('sends a barcode deep link to the scanner shell at its CLEAN path', () => {
    expect(rewrite('/b/4006034103355')).toBe('/b');
    expect(rewrite('/b/4006034103355')).not.toBe('/b.html');
  });

  it('does not let a barcode under /en/produkt fall into the /b scanner shell', () => {
    expect(rewrite('/en/produkt/4006034103355')).not.toBe('/b');
    expect(rewrite('/en/produkt/4006034103355')).toBe('/en/produkt/4006034103355.html');
  });

  it('still keeps the static asset prefixes out of the rewrite', () => {
    for (const p of ['/assets/index.js', '/data/gs1-prefixes.json', '/flags/xk.svg']) {
      expect(rewrite(p)).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// The same rules, against a real build. dist/ is gitignored, so this only
// runs where one exists — it is a stronger check than the unit tests above
// and a weaker guarantee, which is why it is not the only check.
// ---------------------------------------------------------------------------
const DIST = path.join(ROOT, 'dist');
const hasBuild = fs.existsSync(path.join(DIST, 'index.html'));

describe.skipIf(!hasBuild)('the generated dist/ surface', () => {
  const files = [];
  if (hasBuild) {
    (function walk(d) {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const f = path.join(d, e.name);
        if (e.isDirectory()) {
          if (!/^(assets|data|flags|alternatives|memorial)$/.test(e.name)) walk(f);
        } else if (e.name.endsWith('.html')) files.push(f);
      }
    })(DIST);
  }
  const rel = (f) => path.relative(DIST, f).split(path.sep).join('/');
  const present = new Set(files.map(rel));
  const toFile = (href) => {
    const p = href.replace(SITE, '').replace(/\/$/, '');
    return p === '' ? 'index.html' : `${p.replace(/^\//, '')}.html`;
  };

  const parsed = new Map();
  for (const f of files) {
    const h = fs.readFileSync(f, 'utf8');
    const list = [...h.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"\s*\/?>/g)].map((m) => ({
      hreflang: m[1],
      href: m[2],
      file: toFile(m[2]),
    }));
    if (list.length) parsed.set(rel(f), { list, lang: (h.match(/<html lang="([^"]+)"/) || [])[1] || 'sq' });
  }

  it('declares an alternate on at least the whole /en tree', () => {
    expect(parsed.size).toBeGreaterThan(600);
  });

  it('never names a page that was not generated', () => {
    const bad = [];
    for (const [p, { list }] of parsed) for (const a of list) if (!present.has(a.file)) bad.push(`${p} -> ${a.href}`);
    expect(bad).toEqual([]);
  });

  it('is reciprocal in both directions', () => {
    const bad = [];
    for (const [p, { list }] of parsed) {
      for (const a of list) {
        if (a.hreflang === 'x-default' || a.file === p) continue;
        const back = parsed.get(a.file);
        if (!back || !back.list.some((b) => b.file === p)) bad.push(`${p} -> ${a.file}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('is self-referential and carries exactly one x-default', () => {
    const noSelf = [];
    const noDefault = [];
    for (const [p, { list, lang }] of parsed) {
      if (!list.some((a) => a.hreflang === lang && a.file === p)) noSelf.push(p);
      if (list.filter((a) => a.hreflang === 'x-default').length !== 1) noDefault.push(p);
    }
    expect(noSelf).toEqual([]);
    expect(noDefault).toEqual([]);
  });

  it('covers the paginated category pages on both sides', () => {
    // These were the real gap: 31 Albanian + 31 English pages that existed
    // one-for-one and declared nothing about each other.
    const paged = [...parsed.keys()].filter((p) => /^(en\/)?kategoria\/[^/]+\/faqja-\d+\.html$/.test(p));
    expect(paged.length).toBeGreaterThanOrEqual(62);
    for (const p of paged) {
      const other = p.startsWith('en/') ? p.slice(3) : `en/${p}`;
      expect(present.has(other), `${p} has no counterpart file`).toBe(true);
      expect(parsed.get(p).list.some((a) => a.file === other)).toBe(true);
    }
  });

  it('leaves /produkt silent rather than claiming an English tree that is not built', () => {
    const claimed = [...parsed.keys()].filter((p) => /^(en\/)?produkt\//.test(p));
    expect(claimed).toEqual([]);
    expect(fs.existsSync(path.join(DIST, 'en', 'produkt'))).toBe(false);
  });
});
