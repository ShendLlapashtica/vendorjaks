// Rebuilds the evaluation corpus from Open Food Facts (restored 2026-09-14).
//
//   node scripts/eval-corpus-build.mjs data/eval-corpus.json
//
// Polite by construction: 2.5s between calls, identifying User-Agent, and a
// retry with backoff because OFF answers an HTML error page (not JSON) when
// it rate-limits. Originally a throwaway; Builds a real test corpus from Open Food Facts and caches it to
// disk so the evaluation can be re-run without re-hitting the API.
//   set A: products of every brand we claim is Serbian (does the app answer?)
//   set B: a broad sweep of Serbia-registered products (860 / countries=Serbia)
//   set C: control — products that must NOT be called Serbian
import fs from 'node:fs';

const OUT = process.argv[2];
const UA = 'vendorja-dataset-eval/1.0 (kosovo alternatives QA; contact via github)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function off(params, tries = 3) {
  const url = `https://world.openfoodfacts.org/api/v2/search?${params}&fields=code,product_name,brands,categories_tags,countries_tags,quantity&page_size=100`;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      const txt = await res.text();
      if (txt.trim().startsWith('<')) throw new Error('html/ratelimit ' + res.status);
      const j = JSON.parse(txt);
      return j.products || [];
    } catch (e) {
      if (i === tries - 1) { console.error('  !', params, String(e.message).slice(0, 60)); return []; }
      await sleep(6000);
    }
  }
  return [];
}

const boycott = JSON.parse(fs.readFileSync(new URL('../data/boycott-brands.json', import.meta.url), 'utf8'));
const brands = boycott.brands.map((b) => b.brand);

const corpus = { byBrand: {}, serbia: [], control: [] };

console.log(`set A — ${brands.length} claimed-Serbian brands`);
for (const b of brands) {
  const tag = b.toLowerCase().replace(/[()]/g, '').trim().replace(/\s+/g, '-');
  const ps = await off(`brands_tags=${encodeURIComponent(tag)}`);
  corpus.byBrand[b] = ps;
  console.log(`  ${b.padEnd(24)} ${ps.length}`);
  await sleep(2500);
}

console.log('set B — Serbia-registered sweep');
for (const p of [1, 2, 3, 4, 5]) {
  const ps = await off(`countries_tags=en:serbia&page=${p}`);
  corpus.serbia.push(...ps);
  console.log(`  page ${p}: ${ps.length}`);
  await sleep(2500);
}

console.log('set C — control (must never be flagged Serbian)');
for (const q of ['countries_tags=en:kosovo', 'countries_tags=en:albania', 'brands_tags=podravka', 'brands_tags=argeta', 'brands_tags=vitaminka']) {
  const ps = await off(q);
  corpus.control.push(...ps);
  console.log(`  ${q}: ${ps.length}`);
  await sleep(2500);
}

fs.writeFileSync(OUT, JSON.stringify(corpus));
const total = Object.values(corpus.byBrand).flat().length + corpus.serbia.length + corpus.control.length;
console.log(`\ncached ${total} real products -> ${OUT}`);
