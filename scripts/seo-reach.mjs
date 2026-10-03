import fs from 'node:fs';
import path from 'node:path';

// Can a crawler actually REACH every generated page? This is usually the
// biggest real SEO factor and the most neglected: an orphaned page with a
// perfect title and perfect schema still does not get indexed, because
// nothing links to it.
const pages = new Set();
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) {
      if (!/^(assets|data|flags|alternatives|memorial)$/.test(e.name)) walk(f);
    } else if (e.name.endsWith('.html')) {
      pages.add(f.split(path.sep).join('/').replace(/^dist\//, '').replace(/\.html$/, ''));
    }
  }
})('dist');

// Every internal href, normalised the way vercel.json's cleanUrls rewrite
// will resolve it.
const linkedFrom = new Map();
for (const p of pages) {
  const h = fs.readFileSync(path.join('dist', `${p}.html`), 'utf8');
  for (const m of h.matchAll(/href="(\/[^"#?]*)"/g)) {
    let t = m[1].replace(/^\//, '').replace(/\/$/, '');
    if (t === '') t = 'index';
    if (!linkedFrom.has(t)) linkedFrom.set(t, new Set());
    linkedFrom.get(t).add(p);
  }
}

const orphans = [...pages].filter((p) => p !== 'index' && !(linkedFrom.get(p)?.size > 0));
const bySection = {};
for (const o of orphans) {
  const k = o.includes('/') ? o.split('/')[0] : '(root)';
  bySection[k] = (bySection[k] || 0) + 1;
}

// Also: is every page in a sitemap? A sitemap is the fallback discovery
// path when internal linking is thin.
const sitemapUrls = new Set();
for (const f of fs.readdirSync('dist')) {
  if (!/^sitemap.*\.xml$/.test(f)) continue;
  const x = fs.readFileSync(path.join('dist', f), 'utf8');
  for (const m of x.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    sitemapUrls.add(
      m[1].replace(/^https?:\/\/[^/]+\//, '').replace(/\/$/, '') || 'index'
    );
  }
}
const notInSitemap = [...pages].filter((p) => !sitemapUrls.has(p));

console.log('pages:', pages.size);
console.log('ORPHANED (no internal link anywhere):', orphans.length);
console.log('   by section:', JSON.stringify(bySection));
orphans.slice(0, 6).forEach((o) => console.log('   e.g.', o));
console.log('sitemap URLs:', sitemapUrls.size);
console.log('pages NOT in any sitemap:', notInSitemap.length);
notInSitemap.slice(0, 6).forEach((o) => console.log('   e.g.', o));

// Inbound-link distribution: a page with one inbound link from a deep
// paginated index is technically reachable and practically invisible.
const counts = [...pages].map((p) => linkedFrom.get(p)?.size || 0).sort((a, b) => a - b);
const at = (q) => counts[Math.floor(counts.length * q)];
console.log('inbound links per page — min', counts[0], 'p10', at(0.1), 'median', at(0.5), 'p90', at(0.9), 'max', counts[counts.length - 1]);
console.log('pages with exactly ONE inbound link:', counts.filter((c) => c === 1).length);
