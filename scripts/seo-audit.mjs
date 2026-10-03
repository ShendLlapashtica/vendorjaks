// Audits the generated surface in dist/.
//
// The hreflang section deliberately does NOT read dist/seo-hreflang.json,
// the report the build writes about itself. It re-parses the tags out of the
// finished HTML and re-checks them against the files on disk, because a
// build marking its own homework catches nothing. The two numbers agreeing
// is the signal.
//
// "WITHOUT hreflang" is not a defect count. A page may only declare an
// alternate that exists; /produkt/* has no English counterpart by decision
// (see the header of scripts/build-seo.mjs), so silence there is the
// correct output and is reported separately from the things that are wrong.

import fs from 'node:fs';
import path from 'node:path';

const SITE = 'https://vendorja.com';

const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) {
      if (!/^(assets|data|flags|alternatives|memorial)$/.test(e.name)) walk(f);
    } else if (e.name.endsWith('.html')) files.push(f);
  }
})('dist');

const rel = (f) => f.split(path.sep).join('/').replace(/^dist\//, '');

/** A site URL -> the dist-relative .html that serves it under cleanUrls. */
function toFile(href) {
  if (!href.startsWith(SITE)) return null;
  const p = href.slice(SITE.length).replace(/\/$/, '');
  return p === '' ? 'index.html' : `${p.replace(/^\//, '')}.html`;
}

const withH = [];
const without = [];
const types = {};
const thin = [];
const titles = new Map();
const descs = new Map();
const noCanonical = [];
const alts = new Map(); // dist-relative html -> [{hreflang, href, file}]
const langOf = new Map();

for (const f of files) {
  const h = fs.readFileSync(f, 'utf8');
  const r = rel(f);

  langOf.set(r, (h.match(/<html lang="([^"]+)"/) || [])[1] || null);

  const found = [...h.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"\s*\/?>/g)].map((m) => ({
    hreflang: m[1],
    href: m[2],
    file: toFile(m[2]),
  }));
  if (found.length) {
    alts.set(r, found);
    withH.push(r);
  } else {
    without.push(r);
  }

  for (const m of h.matchAll(/"@type"\s*:\s*"([^"]+)"/g)) types[m[1]] = (types[m[1]] || 0) + 1;

  const title = (h.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
  const desc = (h.match(/<meta name="description" content="([\s\S]*?)"\s*\/?>/) || [])[1] || '';
  if (title) titles.set(title, (titles.get(title) || 0) + 1);
  if (desc) descs.set(desc, (descs.get(desc) || 0) + 1);
  if (!/<link rel="canonical"/.test(h)) noCanonical.push(r);

  const text = h
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.split(' ').length < 120) thin.push(r);
}

const present = new Set(files.map(rel));

// --- hreflang correctness ---------------------------------------------------
const dangling = [];
const noSelf = [];
const noXDefault = [];
const oneWay = [];
const badLang = [];
const VALID = new Set(['sq', 'en', 'x-default']);

for (const [page, list] of alts) {
  for (const a of list) {
    if (!VALID.has(a.hreflang)) badLang.push(`${page} -> ${a.hreflang}`);
    if (!a.file || !present.has(a.file)) dangling.push(`${page} -> ${a.href}`);
  }
  if (!list.some((a) => a.hreflang === 'x-default')) noXDefault.push(page);

  // Self-reference: the page must appear in its own alternate set under its
  // own language. Google discards a set that does not include the page it
  // is on.
  const lang = langOf.get(page);
  if (!list.some((a) => a.hreflang === lang && a.file === page)) noSelf.push(page);

  // Reciprocity: the other-language target must name this page back.
  for (const a of list) {
    if (a.hreflang === 'x-default' || a.file === page) continue;
    const back = alts.get(a.file);
    if (!back || !back.some((b) => b.file === page)) oneWay.push(`${page} -> ${a.file}`);
  }
}

const pairs = [...alts].filter(([p, l]) => l.some((a) => a.file !== p)).length / 2;

console.log('=== hreflang ===');
console.log('pages declaring an alternate:', withH.length, `(${pairs} reciprocal pairs)`);
const fail = (label, list) => {
  console.log(`  ${label}:`, list.length);
  list.slice(0, 5).forEach((x) => console.log('     ', x));
};
fail('dangling (target file not generated)', dangling);
fail('one-way (target does not point back)', oneWay);
fail('missing self-reference', noSelf);
fail('missing x-default', noXDefault);
fail('unexpected hreflang value', badLang);

console.log('pages with NO alternate:', without.length);
const groups = {};
for (const f of without) {
  const k = f.includes('/') ? f.split('/')[0] : '(root)';
  groups[k] = (groups[k] || 0) + 1;
}
console.log('   by section:', JSON.stringify(groups));
console.log('   (a page may only name a counterpart that exists — /produkt has no');
console.log('    English tree by decision; see the header of scripts/build-seo.mjs)');

if (fs.existsSync('dist/seo-hreflang.json')) {
  const r = JSON.parse(fs.readFileSync('dist/seo-hreflang.json', 'utf8'));
  const agree = r.declared === withH.length && r.pairs === pairs;
  console.log(`   build reported ${r.declared} declared / ${r.pairs} pairs —`, agree ? 'AGREES with this parse' : 'DISAGREES');
}

// --- everything else --------------------------------------------------------
const dupTitles = [...titles].filter(([, c]) => c > 1);
const dupDescs = [...descs].filter(([, c]) => c > 1);
console.log('\n=== uniqueness ===');
console.log('pages:', files.length);
console.log('duplicate titles:', dupTitles.length, dupTitles.slice(0, 3).map(([t, c]) => `${c}× ${t.slice(0, 60)}`).join(' | '));
console.log('duplicate descriptions:', dupDescs.length, dupDescs.slice(0, 3).map(([t, c]) => `${c}× ${t.slice(0, 60)}`).join(' | '));
console.log('missing canonical:', noCanonical.length, noCanonical.slice(0, 5).join(' '));

console.log('\n=== content ===');
console.log('JSON-LD @types:', JSON.stringify(types));
console.log('THIN pages:', thin.length);
thin.forEach((f) => console.log('   ', f));

if (dangling.length || oneWay.length || noSelf.length || noXDefault.length || badLang.length) process.exitCode = 1;
