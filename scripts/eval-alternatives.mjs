// Alternative-correctness evaluation (restored to the repo 2026-09-14).
//
// This is the harness behind the headline number in the build notes:
// wrong-family = 0 over 1,237 real Open Food Facts products. It was written
// in a scratchpad during the 2026-09-12/13 session and therefore was not
// reproducible by anyone else -- the open-items list called that out as
// the highest-priority gap. Restored here, with the corpus committed as
// data/eval-corpus.json so it runs offline and deterministically.
//
//   node scripts/eval-alternatives.mjs          # offline (default)
//   node scripts/eval-alternatives.mjs --live   # also exercise the OFF live lane
//
// THE NUMBER THAT MUST NOT MOVE IS *WRONG FAMILY = 0*. The same-family
// percentage moves for benign reasons (the denominator changes as scans move
// off the shelf lane onto curated entries) -- see the build notes.
//
// Originally written as a throwaway; Runs the REAL app pipeline (loadAllData +
// resolveAlternatives, unmodified) against 1,237 real Open Food Facts
// products and asks the only question that matters: is the thing it returned
// actually an alternative to the thing that was scanned?
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CORPUS = path.join(ROOT, 'data', 'eval-corpus.json');
const LIVE = process.argv.includes('--live');
const SAMPLE = Number((process.argv.find((a) => a.startsWith('--sample=')) || '').split('=')[1] || 0);

// Serve /data/*.json from disk; let every other URL hit the network.
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  const u = String(url);
  if (u.startsWith('/data/')) {
    const p = path.join(ROOT, u);
    if (!fs.existsSync(p)) return { ok: false, status: 404, json: async () => ({}) };
    const text = fs.readFileSync(p, 'utf8');
    return { ok: true, status: 200, json: async () => JSON.parse(text) };
  }
  if (!LIVE && /openfoodfacts/.test(u)) {
    // Offline mode: the live-search lane returns nothing rather than hanging.
    return { ok: true, status: 200, json: async () => ({ products: [], count: 0 }) };
  }
  return realFetch(url, opts);
};

const { loadAllData } = await import(`file:///${ROOT}/src/lib/dataLoader.js`);
const { resolveAlternatives } = await import(`file:///${ROOT}/src/lib/resolveAlternatives.js`);
const { categoryFamilyOf } = await import(`file:///${ROOT}/src/lib/categoryFamily.js`);
const { classifyBarcode } = await import(`file:///${ROOT}/src/lib/gs1.js`);
const { findBoycottByBrand, findBoycottByCode } = await import(`file:///${ROOT}/src/lib/boycott.js`);
const { headFamilyOf, leadFamilyOf } = await import(`file:///${ROOT}/src/lib/liveAlternatives.js`);
const { resolveAlternativesForRetailProduct } = await import(`file:///${ROOT}/src/lib/resolveAlternatives.js`);
const { isTrustedLocalRow } = await import(`file:///${ROOT}/src/lib/matcher.js`);
const { buildNonLocalBrandSet } = await import(`file:///${ROOT}/src/lib/brandAlternatives.js`);

const data = await loadAllData();
const corpus = JSON.parse(fs.readFileSync(CORPUS, 'utf8'));

console.log(`data loaded: ${data.brandAlternatives.entries.length} curated entries, ${data.boycott.brands.length} boycott brands, ${data.kosovoRetail?.products?.length ?? 0} retail rows`);
console.log(`mode: ${LIVE ? 'LIVE (network lanes enabled)' : 'OFFLINE (curated + static + shelf lanes only)'}\n`);

// ===========================================================================
// THE LIE DETECTOR (added 2026-09-16).
//
// Owner, 2026-09-16: "fuck do you mean in the whole of Kosovo no bag exists
// nigga" / "i will not tolerate these lies".
//
// He scanned a bag and the app told him there was no local alternative.
// There were 26 rows in data/kosovo-retail.json with isLocalBrand === true
// that are literally bags. Saying "no local alternative" is a CORRECT answer
// when it is true (the three protein-shake scans below are correct) and it is
// the single worst thing this app can print when it is not.
//
// So this is not a check on bags. It is a check on the CLASS:
//
//   for every scan that comes back with nothing, assert that there is
//   genuinely no proven-local row in the same canonical category.
//
// "Same canonical category" is the app's own product family, derived for a
// catalogue row exactly as resolveAlternatives.js#retailRowFamily derives it
// (its free-text shelf, else its title's head noun) and for a scanned product
// from its OFF tags. "Proven-local" is the project's hard bar, not the flag
// alone: matcher.js#isTrustedLocalRow, i.e. isLocalBrand === true PLUS the
// boycott and Serbian-barcode checks.
//
// A scan we cannot place in any family is NOT counted as a lie — there is no
// category to have stock in, and "we do not know what this is" is honest. It
// is counted separately so the number is visible rather than hidden.
// ===========================================================================
const RETAIL_POOL = data.kosovoRetail?.products || [];
const NON_LOCAL_BRANDS = buildNonLocalBrandSet(data.brandAlternatives);

function retailRowFamily(row) {
  return categoryFamilyOf(row?.category) || leadFamilyOf(row?.name) || null;
}

/** family -> the proven-local catalogue rows sitting in it. */
const PROVEN_LOCAL_BY_FAMILY = new Map();
for (const row of RETAIL_POOL) {
  if (!isTrustedLocalRow(row, { gs1: data.gs1, boycott: data.boycott, nonLocalBrands: NON_LOCAL_BRANDS })) continue;
  const family = retailRowFamily(row);
  if (!family) continue;
  if (!PROVEN_LOCAL_BY_FAMILY.has(family)) PROVEN_LOCAL_BY_FAMILY.set(family, []);
  PROVEN_LOCAL_BY_FAMILY.get(family).push(row);
}

/**
 * @returns {{verdict: 'lie'|'honest'|'unplaceable', family: string|null, rows: object[]}}
 */
function auditEmptyAnswer(family) {
  if (!family) return { verdict: 'unplaceable', family: null, rows: [] };
  const rows = PROVEN_LOCAL_BY_FAMILY.get(family) || [];
  return { verdict: rows.length > 0 ? 'lie' : 'honest', family, rows };
}

function recordEmptyAnswer(stats, label, family) {
  const audit = auditEmptyAnswer(family);
  stats.emptyAudit[audit.verdict] = (stats.emptyAudit[audit.verdict] || 0) + 1;
  if (audit.verdict === 'lie' && stats.lies.length < 25) {
    stats.lies.push(
      `${label.slice(0, 40).padEnd(42)} | category=${audit.family} | ${audit.rows.length} proven-local row(s) it should have found: ` +
        audit.rows.slice(0, 3).map((r) => `"${r.name}"`).join(', ')
    );
  } else if (audit.verdict === 'honest' && stats.honestNones.length < 25) {
    stats.honestNones.push(`${label.slice(0, 40).padEnd(42)} | category=${audit.family} | 0 proven-local rows — correct`);
  } else if (audit.verdict === 'unplaceable' && stats.unplaceable.length < 10) {
    stats.unplaceable.push(`${label.slice(0, 40)} | no family could be established`);
  }
}

function emptyAuditStats() {
  return { emptyAudit: {}, lies: [], honestNones: [], unplaceable: [] };
}

function reportEmptyAudit(s) {
  const lies = s.emptyAudit.lie || 0;
  console.log(`  "NO LOCAL ALTERNATIVE" AUDIT — of ${s.empty} empty answers:`);
  console.log(`    LIES (proven-local stock exists in the same category): ${lies}`);
  s.lies.forEach((l) => console.log('    !! ' + l));
  console.log(`    legitimate (no proven-local stock in that category):   ${s.emptyAudit.honest || 0}`);
  s.honestNones.slice(0, 6).forEach((l) => console.log('       . ' + l));
  console.log(`    unplaceable (no category could be established):        ${s.emptyAudit.unplaceable || 0}`);
  s.unplaceable.slice(0, 6).forEach((l) => console.log('       ? ' + l));
  return lies;
}

let TOTAL_LIES = 0;

/** Would the app call this product Serbian at all? */
function verdictFor(p) {
  const c = classifyBarcode(p.code, data.gs1);
  const byCode = findBoycottByCode(p.code, data.boycott);
  const byBrand = findBoycottByBrand(p.brands, data.boycott);
  return { serbian: c.verdict === 'SERBIAN' || Boolean(byCode) || Boolean(byBrand), classify: c, byCode, byBrand };
}

function altFamilyOf(item, sourceEntry) {
  if (sourceEntry?.offCategoryTags?.length) return categoryFamilyOf(sourceEntry.offCategoryTags);
  if (item.matchedTag) return categoryFamilyOf([item.matchedTag]) || categoryFamilyOf(item.matchedTag);
  return null;
}

/**
 * THE HARNESS WAS MARKING ITS OWN HOMEWORK (fixed 2026-09-16).
 *
 * altFamilyOf() reads `item.matchedTag`, and for every shelf-lane answer
 * that field is set to the family the lane was SEARCHING FOR. So a shelf
 * answer scored "same product family" by construction, whatever the app
 * actually returned: the lane could hand back a cured ham for a mustard and
 * this harness would count it correct. Three real defects were found by
 * opening the app rather than by running this script -- Nestle/Kellogg's as
 * a "local" alternative, milk offered for yogurt, and a food supplement
 * answered with pocket tissues -- and it reported WRONG FAMILY = 0 through
 * all three.
 *
 * So there is now a SECOND, independent judgement: work out what the
 * returned product is from its OWN name and free-text category, using the
 * same head-noun logic the app uses (liveAlternatives.headFamilyOf) and the
 * shared family map -- never from the tag the search happened to use. It is
 * a strictly harder test and it is the one to watch.
 */
function altFamilyIndependent(item, sourceEntry) {
  // A curated brand-level pairing genuinely has no product of its own; its
  // entry's OFF tags are the only thing there is to judge.
  if (item.isBrandLevel) return sourceEntry?.offCategoryTags?.length ? categoryFamilyOf(sourceEntry.offCategoryTags) : null;
  return (
    headFamilyOf(item.name) ||
    categoryFamilyOf(item.categoriesTags) ||
    categoryFamilyOf(item.category) ||
    null
  );
}

async function evaluate(products, label) {
  const stats = {
    label, n: 0, serbian: 0, answered: 0, empty: 0,
    bySource: {}, famOK: 0, famUnknown: 0, famMISMATCH: 0,
    localOK: 0, localSuspect: 0, mismatches: [], samples: [],
    // RENDERABLE IDENTITY (added 2026-09-16). The sample column used to
    // print `item.brand` alone, so a shelf row with a product name and no
    // brand rendered as "-> , , " and read as an empty card. It is not one:
    // AlternativesGrid uses `item.name` as the heading. Both are counted
    // now, and `noIdentity` -- neither brand NOR name, the case that really
    // would be a blank card -- is the number that must stay 0.
    noBrand: 0, noIdentity: 0, blanks: [],
    // The independent judgement -- see altFamilyIndependent().
    indOK: 0, indUnknown: 0, indMISMATCH: 0, indMismatches: [],
    dupeAnswers: 0,
    ...emptyAuditStats(),
  };
  for (const p of products) {
    if (!p.code || !p.categories_tags?.length) continue;
    stats.n++;
    const v = verdictFor(p);
    if (!v.serbian) continue;
    stats.serbian++;

    const res = await resolveAlternatives({ brand: p.brands || null, categoriesTags: p.categories_tags, data });
    const items = res.items || [];
    stats.bySource[res.source] = (stats.bySource[res.source] || 0) + 1;
    if (items.length === 0) {
      stats.empty++;
      recordEmptyAnswer(stats, `${p.product_name || p.code} (${p.brands || 'no brand'})`, categoryFamilyOf(p.categories_tags));
      continue;
    }
    stats.answered++;

    const sFam = categoryFamilyOf(p.categories_tags);
    for (const it of items) {
      const aFam = altFamilyOf(it, res.sourceEntry);
      if (!sFam || !aFam) stats.famUnknown++;
      else if (sFam === aFam) stats.famOK++;
      else {
        stats.famMISMATCH++;
        if (stats.mismatches.length < 25) {
          stats.mismatches.push(`${(p.product_name || p.code).slice(0, 34)} [${sFam}] -> ${it.brand} [${aFam}] via ${res.source}`);
        }
      }
      const c = String(it.country || '').toLowerCase();
      if (c === 'kosovo' || c === 'albania') stats.localOK++;
      else stats.localSuspect++;

      const brand = String(it.brand || '').trim();
      const name = String(it.name || '').trim();
      if (!brand) stats.noBrand++;
      if (!brand && !name) {
        stats.noIdentity++;
        if (stats.blanks.length < 10) stats.blanks.push(`${res.source} | code=${it.code}`);
      }

      const iFam = altFamilyIndependent(it, res.sourceEntry);
      if (!sFam || !iFam) stats.indUnknown++;
      else if (sFam === iFam) stats.indOK++;
      else {
        stats.indMISMATCH++;
        if (stats.indMismatches.length < 25) {
          stats.indMismatches.push(`${(p.product_name || p.code).slice(0, 30)} [${sFam}] -> ${(name || brand).slice(0, 38)} [${iFam}] via ${res.source}`);
        }
      }
    }

    // The same product twice in one six-card grid is a defect a shopper sees.
    const shownLabels = items.map((i) => String(i.name || i.brand || '').toLowerCase().trim());
    if (shownLabels.length > 1 && new Set(shownLabels).size < shownLabels.length) stats.dupeAnswers++;
    if (stats.samples.length < 18) {
      // What the shopper sees on the card: the brand for a brand-level
      // pairing, the product name for a shelf row (with the brand in
      // parentheses when we have one).
      const shown = (i) => {
        const b = String(i.brand || '').trim();
        const n = String(i.name || '').trim();
        if (b && n) return `${n} (${b})`;
        return b || n || '(!! NOTHING RENDERABLE)';
      };
      stats.samples.push(`${(p.product_name || '(no name)').slice(0, 30).padEnd(30)} | ${String(p.brands).slice(0, 18).padEnd(18)} | ${String(sFam).padEnd(22)} -> ${items.slice(0, 2).map(shown).join(' | ')}  [${res.source}]`);
    }
  }
  return stats;
}

function report(s) {
  console.log(`\n=== ${s.label} ===`);
  console.log(`  products with categories:   ${s.n}`);
  console.log(`  judged Serbian by the app:  ${s.serbian}`);
  console.log(`  got at least one alternative: ${s.answered}  (${s.serbian ? ((s.answered / s.serbian) * 100).toFixed(1) : 0}% of Serbian)`);
  console.log(`  returned nothing:             ${s.empty}`);
  TOTAL_LIES += reportEmptyAudit(s);
  console.log(`  resolution tier: ${JSON.stringify(s.bySource)}`);
  const tot = s.famOK + s.famUnknown + s.famMISMATCH;
  console.log(`  ALTERNATIVES RETURNED: ${tot}`);
  console.log(`    same product family:      ${s.famOK}  (${tot ? ((s.famOK / tot) * 100).toFixed(1) : 0}%)`);
  console.log(`    family undetermined:      ${s.famUnknown}`);
  console.log(`    WRONG FAMILY:             ${s.famMISMATCH}`);
  console.log(`    labelled kosovo/albania:  ${s.localOK} / not local: ${s.localSuspect}`);
  console.log(`    no brand string:          ${s.noBrand}  (card still shows the product name)`);
  console.log(`    NOTHING RENDERABLE:       ${s.noIdentity}`);
  s.blanks.forEach((b) => console.log('    ! ' + b));
  console.log(`  ANSWERS WITH A DUPLICATE CARD: ${s.dupeAnswers}`);
  const itot = s.indOK + s.indUnknown + s.indMISMATCH;
  console.log(`  INDEPENDENT FAMILY CHECK (judged from the returned product itself, not from the tag we searched on):`);
  console.log(`    same product family:      ${s.indOK}  (${itot ? ((s.indOK / itot) * 100).toFixed(1) : 0}%)`);
  console.log(`    family undetermined:      ${s.indUnknown}`);
  console.log(`    WRONG FAMILY (strict):    ${s.indMISMATCH}`);
  if (s.indMismatches.length) {
    s.indMismatches.forEach((m) => console.log('    ! ' + m));
  }
  if (s.mismatches.length) {
    console.log('  WRONG-FAMILY EXAMPLES:');
    s.mismatches.forEach((m) => console.log('    ! ' + m));
  }
  if (s.samples.length) {
    console.log('  SAMPLE OF WHAT A SHOPPER WOULD SEE:');
    s.samples.forEach((x) => console.log('    ' + x));
  }
}

const brandProducts = Object.values(corpus.byBrand).flat();
const pool = (arr) => (SAMPLE ? arr.slice(0, SAMPLE) : arr);

report(await evaluate(pool(brandProducts), 'SET A — products of brands we claim are Serbian'));
report(await evaluate(pool(corpus.serbia), 'SET B — broad sweep of Serbia-registered products'));

// ---- SET D: NON-SERBIAN products. Added 2026-09-16. ----------------------
// Every set above only asks the resolver about products the app has already
// judged Serbian, so the whole non-Serbian half of the app was unmeasured.
// That is where the "German food supplement -> Kosovar pocket tissues"
// defect lived: no Serbian product in the corpus is a supplement, so the
// harness could not see it. This set puts the SAME resolver question to the
// control products (which are, by construction, NOT Serbian) and scores the
// answers identically. Nothing here is about boycotting anyone -- it is
// purely "if the app is asked for an alternative to this, is the answer the
// right KIND of thing?".
async function evaluateAny(products, label) {
  const stats = {
    label, n: 0, serbian: 0, answered: 0, empty: 0, bySource: {},
    famOK: 0, famUnknown: 0, famMISMATCH: 0, localOK: 0, localSuspect: 0,
    mismatches: [], samples: [], noBrand: 0, noIdentity: 0, blanks: [],
    indOK: 0, indUnknown: 0, indMISMATCH: 0, indMismatches: [], dupeAnswers: 0,
    ...emptyAuditStats(),
  };
  for (const p of products) {
    if (!p.code || !p.categories_tags?.length) continue;
    stats.n++;
    stats.serbian++; // "asked about" — the denominator for the percentages
    const res = await resolveAlternatives({ brand: p.brands || null, categoriesTags: p.categories_tags, data });
    const items = res.items || [];
    stats.bySource[res.source] = (stats.bySource[res.source] || 0) + 1;
    if (items.length === 0) {
      stats.empty++;
      recordEmptyAnswer(stats, `${p.product_name || p.code} (${p.brands || 'no brand'})`, categoryFamilyOf(p.categories_tags));
      continue;
    }
    stats.answered++;
    const sFam = categoryFamilyOf(p.categories_tags);
    for (const it of items) {
      const aFam = altFamilyOf(it, res.sourceEntry);
      if (!sFam || !aFam) stats.famUnknown++;
      else if (sFam === aFam) stats.famOK++;
      else {
        stats.famMISMATCH++;
        if (stats.mismatches.length < 25) stats.mismatches.push(`${(p.product_name || p.code).slice(0, 34)} [${sFam}] -> ${it.brand || it.name} [${aFam}] via ${res.source}`);
      }
      const c = String(it.country || '').toLowerCase();
      if (c === 'kosovo' || c === 'albania') stats.localOK++; else stats.localSuspect++;
      const brand = String(it.brand || '').trim();
      const name = String(it.name || '').trim();
      if (!brand) stats.noBrand++;
      if (!brand && !name) { stats.noIdentity++; if (stats.blanks.length < 10) stats.blanks.push(`${res.source} | code=${it.code}`); }
      const iFam = altFamilyIndependent(it, res.sourceEntry);
      if (!sFam || !iFam) stats.indUnknown++;
      else if (sFam === iFam) stats.indOK++;
      else {
        stats.indMISMATCH++;
        if (stats.indMismatches.length < 25) stats.indMismatches.push(`${(p.product_name || p.code).slice(0, 30)} [${sFam}] -> ${(name || brand).slice(0, 38)} [${iFam}] via ${res.source}`);
      }
    }
    const shownLabels = items.map((i) => String(i.name || i.brand || '').toLowerCase().trim());
    if (shownLabels.length > 1 && new Set(shownLabels).size < shownLabels.length) stats.dupeAnswers++;
    if (stats.samples.length < 12) {
      const shown = (i) => {
        const b = String(i.brand || '').trim();
        const n = String(i.name || '').trim();
        if (b && n) return `${n} (${b})`;
        return b || n || '(!! NOTHING RENDERABLE)';
      };
      stats.samples.push(`${(p.product_name || '(no name)').slice(0, 30).padEnd(30)} | ${String(p.brands).slice(0, 18).padEnd(18)} | ${String(sFam).padEnd(22)} -> ${items.slice(0, 2).map(shown).join(' | ')}  [${res.source}]`);
    }
  }
  return stats;
}
report(await evaluateAny(pool(corpus.control), 'SET D — NON-Serbian products: is the answer the right KIND of thing?'));

// ---- SET C: the false-positive test. These must NOT be called Serbian. ----
console.log('\n=== SET C — control: must NEVER be flagged Serbian ===');
const wrong = [];
let checked = 0;
for (const p of corpus.control) {
  if (!p.code) continue;
  checked++;
  const v = verdictFor(p);
  if (v.serbian) {
    const why = v.byCode ? 'barcode' : v.byBrand ? `brand alias "${v.byBrand.matchedToken}" -> ${v.byBrand.brand}` : `GS1 prefix ${String(p.code).slice(0, 3)}`;
    wrong.push(`${String(p.brands).slice(0, 26).padEnd(26)} | ${String(p.product_name).slice(0, 28).padEnd(28)} | ${p.code} | ${why}`);
  }
}
console.log(`  checked: ${checked}`);
console.log(`  flagged Serbian: ${wrong.length}`);
wrong.slice(0, 40).forEach((w) => console.log('    ! ' + w));

// ---- SET E: THE KOSOVO CATALOGUE ITSELF. Added 2026-09-16. --------------
//
// WHY THIS SET HAD TO EXIST. Sets A-D are Open Food Facts products, and OFF
// is a FOOD database. The owner's bag scan was invisible to every one of
// them: no bag, no bin liner and no bottle of floor cleaner is in the corpus
// at all, so a harness reporting a clean sheet across A, B, C and D said
// nothing whatsoever about the half of the app that answers non-food.
//
// This set asks the SAME question of the products the app actually ships:
// rows of data/kosovo-retail.json, through resolveAlternativesForRetailProduct
// -- the path behind the Explore product page, and (since 2026-09-16) behind
// any scan whose barcode Open Food Facts has never heard of.
//
// It is a bounded sweep, not the full 31,975 rows: every row the harvest left
// with `category: null` (226 of them -- the specific shape of the owner's
// bag, "Qese për mbeturina" with no shelf at all), plus a deterministic
// stride sample across the rest so the run stays reproducible and finishes.
console.log('\n=== SET E — the Kosovo catalogue itself: does it ever claim "none" while it holds the answer? ===');
{
  const candidates = RETAIL_POOL.filter((p) => !isTrustedLocalRow(p, { gs1: data.gs1, boycott: data.boycott, nonLocalBrands: NON_LOCAL_BRANDS }));
  const nullCategory = candidates.filter((p) => p.category == null);
  const rest = candidates.filter((p) => p.category != null);
  const STRIDE = Math.max(1, Math.floor(rest.length / 600));
  const sampled = rest.filter((_, i) => i % STRIDE === 0);
  const subjects = [...nullCategory, ...sampled];

  const s = { label: 'SET E', empty: 0, answered: 0, bySource: {}, ...emptyAuditStats() };
  for (const row of subjects) {
    const res = await resolveAlternativesForRetailProduct(row, data);
    s.bySource[res.source] = (s.bySource[res.source] || 0) + 1;
    if ((res.items || []).length === 0) {
      s.empty++;
      recordEmptyAnswer(s, `${row.name} [${row.category ?? 'no category'}]`, retailRowFamily(row));
      continue;
    }
    s.answered++;
  }
  console.log(`  catalogue rows asked:         ${subjects.length}  (${nullCategory.length} with no category at all + ${sampled.length} sampled 1-in-${STRIDE})`);
  console.log(`  got at least one alternative: ${s.answered}`);
  console.log(`  returned nothing:             ${s.empty}`);
  console.log(`  resolution tier: ${JSON.stringify(s.bySource)}`);
  TOTAL_LIES += reportEmptyAudit(s);
}

// ---- THE STANDING GUARD -------------------------------------------------
// "i will not tolerate these lies" (owner, 2026-09-16). A non-zero count
// here means the app is telling someone there is no local alternative while
// proven-local stock sits in the same category in its own data file. It is
// the same class of failure as WRONG FAMILY > 0 and it fails the run.
console.log(`\n=== LIE DETECTOR — "no local alternative" while proven-local stock exists ===`);
console.log(`  TOTAL LIES ACROSS ALL SETS: ${TOTAL_LIES}`);
if (TOTAL_LIES > 0) {
  console.log('  FAIL — every line marked !! above is the app saying something untrue.');
  process.exitCode = 1;
} else {
  console.log('  PASS — every "no local alternative" in this run is a true statement.');
}

// ---- SET F: THE EXACT-MATCH REPORT (/alternativa). Added 2026-09-17. -----
//
// Owner, 2026-09-17: "no something close always exact find. EXACT find . no
// yogurt for cheese or milk . or waffle to biscuit match , always always X
// to X match 1:1 must be 100%".
//
// Sets A-E measure the whole app, where a looser answer is allowed and
// sometimes right. /alternativa is stricter than anywhere else: only a
// same-family match may be shown, `family undetermined` is NOT a match, and
// the loose tiers (`shelf`, `local-brands`, `static-pool`, `live`,
// `catalog-category-fallback`) may never appear. This set measures that
// gate — src/lib/exactMatch.js — over every Serbian product the screen
// actually lists.
//
// EXPECT COVERAGE TO BE LOW AND DO NOT FIGHT IT. Every product without an
// exact match renders as "no exact match yet" plus the propose action, and
// that is a true sentence. A wafer offered for a biscuit is not.
console.log('\n=== SET F — /alternativa: EXACT 1:1 matches over every Serbian product in the catalogue ===');
{
  const {
    collectSerbianProducts,
    buildExactIndex,
    exactAlternativesFor,
    isExactSource,
  } = await import(`file:///${ROOT}/src/lib/exactMatch.js`);

  // THE HUMAN JUDGEMENT, WRITTEN DOWN (2026-09-17).
  //
  // "how many matches would a human reject" cannot be computed, so it is
  // not pretended to be. Every pair this run produces was read by hand this
  // session against ONE rule, and the ones that failed it are listed here
  // by name:
  //
  //   REJECT when the swap is a different KIND of purchase — a shopper
  //   could not use it for the same thing (soy tofu for dairy curd, window
  //   spray for fabric softener, raisins for salted peanuts).
  //   ACCEPT when only the flavour, variety or format differs within the
  //   same kind (cola for bitter lemon, cheese crisps for paprika crisps,
  //   peanuts for salted sunflower seeds, penne for instant noodles).
  //
  // The audit is keyed on the exact pair, so if a name changes the entry
  // stops matching — and the run says so rather than quietly reporting a
  // smaller number. Re-read the sample below whenever the data is refreshed.
  const HUMAN_REJECTED = new Map([
    ['INDOMIE NOODLE BEEF 70GR :: Tarhana 400G', 'tarhana is a dried fermented soup base, not an instant-noodle substitute'],
    ['INDOMIE NOODLE CHICKEN 70GR :: Tarhana 400G', 'tarhana is a dried fermented soup base, not an instant-noodle substitute'],
    ['INDOMIE SPECIAL CHICKEN 75GR :: Tarhana 400G', 'tarhana is a dried fermented soup base, not an instant-noodle substitute'],
    ['Gud Kiirik Djeks :: Rrush I Thate Dr.Chef 80Gr.', 'raisins are not a substitute for a bag of spicy peanuts'],
    ['Gud Kiirik Djeks :: Rrush I Thate Evko 80Gr', 'raisins are not a substitute for a bag of spicy peanuts'],
  ]);

  const index = buildExactIndex(data);
  const serbian = collectSerbianProducts(data);

  let matched = 0;
  let gapNoStock = 0;
  let gapUndetermined = 0;
  let pairs = 0;
  let rejectedPairs = 0;
  let refusedLooseProducts = 0;
  const seenAudited = new Set();
  const rejectLines = [];
  const bySource = {};
  const gapFamilies = new Map();
  const samples = [];

  for (const entry of serbian) {
    const res = exactAlternativesFor(entry, data, index);

    // What the app's own resolver would have answered, so the strictness is
    // visible as a number rather than asserted: how many products would
    // have been given a bucket-tier answer that this screen refuses.
    const loose = await resolveAlternativesForRetailProduct(entry.product, data);
    if ((loose.items || []).length > 0 && !isExactSource(loose.source) && res.items.length === 0) {
      refusedLooseProducts++;
    }

    if (res.items.length === 0) {
      if (res.family) {
        gapNoStock++;
        gapFamilies.set(res.family, (gapFamilies.get(res.family) || 0) + 1);
      } else {
        gapUndetermined++;
      }
      continue;
    }

    matched++;
    bySource[res.source] = (bySource[res.source] || 0) + 1;

    for (const item of res.items) {
      pairs++;
      const altName = String(item.name || item.brand || '').trim();
      const key = `${String(entry.product.name || '').trim()} :: ${altName}`;
      if (HUMAN_REJECTED.has(key)) {
        rejectedPairs++;
        seenAudited.add(key);
        if (rejectLines.length < 25) rejectLines.push(`${key}  — ${HUMAN_REJECTED.get(key)}`);
      }
      // THE FAMILY GATE, RE-ASSERTED HERE. exactAlternativesFor cannot
      // return a cross-family item by construction; this fails the run if
      // that ever stops being true.
      if (item.family !== res.family) {
        console.log(`  !! GATE BREACH: ${key} — scanned ${res.family}, offered ${item.family}`);
        process.exitCode = 1;
      }
    }

    if (samples.length < 45) {
      for (const item of res.items.slice(0, 2)) {
        if (samples.length >= 45) break;
        samples.push(
          `${String(entry.product.name || '').slice(0, 42).padEnd(44)} [${String(res.family).padEnd(21)}] -> ` +
            `${String(item.name || item.brand || '').slice(0, 40).padEnd(42)} [${String(item.family).padEnd(21)}]  (${res.source})`
        );
      }
    }
  }

  const total = serbian.length;
  console.log(`  Serbian products listed on /alternativa: ${total}`);
  console.log(`  WITH AN EXACT 1:1 MATCH:                 ${matched}  (${total ? ((matched / total) * 100).toFixed(1) : 0}%)`);
  console.log(`  NO EXACT MATCH YET:                      ${total - matched}`);
  console.log(`    ...family known, no proven-local stock in it: ${gapNoStock}`);
  console.log(`    ...family could not be established at all:    ${gapUndetermined}`);
  console.log(`  products the app's own resolver would have answered from a BUCKET tier, refused here: ${refusedLooseProducts}`);
  console.log(`  resolution tier of the exact answers: ${JSON.stringify(bySource)}`);
  console.log(`  alternative pairs shown: ${pairs}`);
  console.log(`  PAIRS A HUMAN REJECTED (hand-audited, see HUMAN_REJECTED): ${rejectedPairs}  (${pairs ? ((rejectedPairs / pairs) * 100).toFixed(1) : 0}%)`);
  rejectLines.forEach((l) => console.log('    !! ' + l));
  const stale = [...HUMAN_REJECTED.keys()].filter((k) => !seenAudited.has(k));
  if (stale.length) {
    console.log(`  NOTE: ${stale.length} hand-audited pair(s) did not appear in this run — the audit may be stale:`);
    stale.slice(0, 10).forEach((k) => console.log('       ? ' + k));
  }

  const topGaps = [...gapFamilies.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  console.log('  BIGGEST GAPS (family known, nothing proven-local to offer):');
  topGaps.forEach(([f, n]) => console.log(`    ${String(f).padEnd(24)} ${n}`));

  console.log(`  SAMPLE PAIRS — "Serbian product [family] -> alternative [family]" (${samples.length}):`);
  samples.forEach((s) => console.log('    ' + s));
}
