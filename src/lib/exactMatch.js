// THE EXACT GATE — the single arbiter for the /alternativa screen.
//
// Owner, 2026-09-17, verbatim:
//
//   "no something close always exact find. EXACT find . no yogurt for cheese
//    or milk . or waffle to biscuit match , always always X to X match 1:1
//    must be 100% . IF NO MATCH FOUND> make it and people can look products
//    up and propose alternatives"
//
// He has now reported this same class of defect FOUR times — milk for
// yogurt, pocket tissues for a food supplement, Nestlé as a "local" brand,
// and a cocoa spread for peanut butter — and every one of them was reported
// clean by `WRONG FAMILY = 0`. So this file does not try to be clever. It
// is a filter that throws away everything it cannot prove, and the number
// it is measured on is not coverage.
//
// THREE RULES, and they are stricter than anywhere else in the app.
//
//  1. ONLY SAME-FAMILY. The loose resolution tiers — `shelf`,
//     `local-brands`, `static-pool`, `live`, and the raw-category
//     `catalog-category-fallback` — never appear here, whatever they
//     return. `catalog-category-fallback` matches the retailer's own
//     free-text shelf string, and a shelf is a bucket: it is the tier that
//     answered `Margarin VITAL 250 GR` with sugar, flour, coffee and rice,
//     because all five sit on a shelf one retailer calls "SHPORTA BAZE".
//
//  2. `family undetermined` IS NOT A MATCH. If either side's family cannot
//     be established, there is no exact match — there is a gap, and the gap
//     is rendered as a first-class state with a propose action. This is the
//     opposite of matcher.js#familyCompatible, which deliberately lets an
//     untagged candidate through on the strength of a shared specific tag.
//     That softness is right for a scan result; it is wrong here.
//
//  3. AMBIGUOUS EVIDENCE IS UNDETERMINED. A shelf label or a title that
//     names two different purchases names neither. See freeTextFamiliesOf()
//     in categoryFamily.js and titleFamiliesOf() in liveAlternatives.js.
//
// Coverage FALLS under these rules, by a lot, and that is the intended
// outcome: "no exact match yet, propose one" is a true sentence and a wafer
// offered for a biscuit is not.

import { categoryFamiliesOf, freeTextFamiliesOf } from './categoryFamily.js';
import {
  leadFamilyOf,
  titleFamiliesOf,
  retailIdentity,
  dedupeKeyFor,
} from './liveAlternatives.js';
import { isTrustedLocalRow, isSameBrand } from './matcher.js';
import {
  buildNonLocalBrandSet,
  findEntriesByBrand,
  findEntriesByCategoryKey,
  entryToItems,
} from './brandAlternatives.js';
import { productStance } from './flagTone.js';
import { identityFamilyOf } from './productIdentity.js';

/** How many alternatives one row may show. */
export const EXACT_LIMIT = 6;

/**
 * The resolution tiers whose answers are eligible to be shown here at all.
 *
 * Deliberately an ALLOW-list, not a deny-list: a tier added to
 * resolveAlternatives.js tomorrow must be reviewed against the aisle test
 * before it can reach this screen, rather than arriving silently.
 */
export const EXACT_SOURCES = Object.freeze(
  new Set(['brand-match', 'brand-category-match', 'catalog-family-fallback'])
);

/** Why a candidate was refused — surfaced by the eval harness, not the UI. */
export const REJECT = Object.freeze({
  LOOSE_SOURCE: 'loose-source',
  SCANNED_UNDETERMINED: 'scanned-family-undetermined',
  CANDIDATE_UNDETERMINED: 'candidate-family-undetermined',
  DIFFERENT_FAMILY: 'different-family',
  ENTRY_SPANS_FAMILIES: 'curated-entry-spans-several-families',
  SAME_BRAND: 'same-brand-as-the-serbian-product',
  NOT_RENDERABLE: 'nothing-renderable',
});

/**
 * The family of ONE product, established strictly, or null.
 *
 * Two independent witnesses — the retailer's shelf label and the product's
 * own title — and they must not contradict each other:
 *
 *   both agree              -> that family
 *   only one speaks         -> that family
 *   they disagree           -> null (undetermined)
 *   either one is ambiguous -> that witness is silent
 *
 * The disagreement rule is not theoretical. `Milka Biskote Çoko Jaffa
 * Portokall 147G` is shelved under "BISKOTA" and its title begins with the
 * stem 'milk'; before the two fixes that ship alongside this file it
 * resolved to MILK and the app answered a pack of biscuits with six cartons
 * of UHT milk. With both fixes the witnesses agree on `biscuits`; without
 * either of them, they disagree and this returns null — which is also a
 * safe answer. The gate does not depend on any single fix being right.
 *
 * @param {{name?: string|null, category?: string|null}|null} row
 * @returns {string|null}
 */
export function exactFamilyOf(row) {
  const witnessed = witnessFamilyOf(row);
  if (witnessed) return witnessed;
  // LAST RESORT, AND ONLY EVER ADDITIVE. The two witnesses said nothing
  // usable, so a documented product identity is allowed to speak. It
  // cannot reach this line when they DID agree, so no answer that is
  // right today can be changed by the identity table — see the header of
  // productIdentity.js, and the two tests that pin that direction.
  return identityFamilyOf(row);
}

/** The original two-witness rule, unchanged, exported for the tests. */
export function witnessFamilyOf(row) {
  if (!row) return null;
  const catFamilies = collapseNarrower(freeTextFamiliesOf(row.category));
  const fromCategory = singleFamily(catFamilies);
  const { lead, mentioned } = titleEvidence(row.name);

  if (fromCategory) {
    // The head noun outranks the shelf: a title that says what the thing is
    // is better evidence than the aisle it was stacked in.
    if (lead) return lead === fromCategory ? fromCategory : null;
    // No head noun. The shelf stands unless the title positively names
    // OTHER kinds of thing and not this one — `Trik Shkopinjë Kikirik 110g`
    // is filed under "Crackers" while its own title says sticks and
    // peanuts, so the two witnesses contradict each other even though
    // neither is on its own decisive. An ambiguous title that DOES include
    // the shelf's family corroborates it: `Vipa Ketchup Chips 30g` on the
    // "Chips" shelf is crisps.
    if (mentioned.size === 0) return fromCategory;
    return mentioned.has(fromCategory) ? fromCategory : null;
  }

  // A COMPOUND SHELF LABEL IS WEAK EVIDENCE, NOT NO EVIDENCE
  // (added 2026-09-17; every clause below is a measured row, and the
  // first draft of this rule was wrong in the way the second half fixes).
  //
  // A shelf naming two purchases cannot say which one this is — rule 3
  // stands. But the code was discarding it entirely, and it can still say
  // which purchases it does NOT contain.
  //
  // `Clipsy Dini Keqap 30G` is the row that made this necessary: a bag of
  // ketchup-FLAVOURED crisps on the "Njelmeta" shelf, which honestly
  // names {crisps, savoury-snacks}. Its title mentions only ketchup. With
  // the shelf discarded, that lone mention won, and the screen would have
  // offered a bottle of Replay Ketchup as the exact 1:1 replacement for a
  // packet of crisps.
  //
  // THE ORDER IS THE WHOLE RULE, and it ranks the three signals by how
  // much they have already been wrong:
  //
  //  1. A MENTION THE SHELF CORROBORATES wins outright. Two independent
  //     witnesses intersecting in exactly one family is the strongest
  //     evidence there is — `Vipa Chips Ketchup 40 Gr` on "Njelmeta" is
  //     crisps, and `Milk Kefir Jogurt Me Fruta Mali 160G` on "JOGURT ME
  //     FRUTA" is a YOGURT, not the milk its first word claims.
  //
  //  2. Otherwise the HEAD NOUN wins, even though the shelf does not list
  //     it. A compound aisle label is the least reliable string the
  //     catalogue has, and it must not be allowed to veto the app's
  //     strongest signal: 40 charcuterie rows sit under "PRODUKTE TË
  //     FTOHTA NGA MISHI & PESHKU" (which names meat and fish, not cured
  //     meat), four bags of salt under "Ereza & Salca", and nine bags of
  //     crisps, flips and pumpkin seeds under "BISKOTA ME KRIP". A
  //     stricter first draft of this rule refused all 53 of them.
  //
  //  3. A BARE MENTION the shelf does not list loses. This is the whole
  //     point: it is the ketchup-on-a-crisp-packet case, and a mention is
  //     exactly the signal that has produced this bug four times.
  if (catFamilies.size > 1) {
    const corroborated = [...mentioned].filter((f) => catFamilies.has(f));
    if (corroborated.length === 1) return corroborated[0];
    if (corroborated.length > 1) return null; // the shelf allows both; nothing chooses
    return lead || null;
  }

  if (lead) return lead;
  return singleFamily(mentioned);
}

function singleFamily(set) {
  return set && set.size === 1 ? [...set][0] : null;
}

/**
 * A FLAVOUR IS NOT A PRODUCT (measured 2026-09-17).
 *
 * `Jaffa Molle 0.25L` is APPLE JUICE. Its title mentions no juice word, so
 * the only family anything could find in it was `fresh-fruit`, from the
 * flavour "mollë" — and the catalogue's proven-local `fresh-fruit` rows
 * include `Krem Banane 17Gr`, a banana-cream sweet placed there by exactly
 * the same accident. The screen offered a banana cream for a carton of
 * apple juice, and both sides scored "same family".
 *
 * Fruit, vegetable and honey words are the flavour vocabulary of half the
 * catalogue, so for these families a passing MENTION is worthless: they may
 * be established only from the title's head noun ("Molle Kg", "Mjaltë
 * Bletësh 500g") or from an unambiguous shelf label. Every other family
 * keeps the mention rule, because "BYLMETI JOGURT 3,2%" is genuinely a
 * yogurt and leads with a brand.
 */
// UPDATED 2026-09-18. Owner: "why a parfume being shown as a lajthi
// alternative". NUTS ARE FLAVOUR VOCABULARY TOO, and this is the same
// defect one family over.
// `lajthi` (hazelnut) is listed under `nuts-seeds`, so a passing mention
// placed the product there. Measured: `Nutella Krem Lajthi 400G` — a
// chocolate SPREAD — resolved to `nuts-seeds`, and so did
// `QOKOLLATE KANDIT 230GR LAJTHI`, a chocolate BAR. Once a bag of roasted
// hazelnuts and a jar of chocolate spread share a family, the screen will
// offer either for the other, and anything else whose name happens to
// carry a nut word — a shower gel with almond, a perfume with hazelnut —
// lands in the same bucket the moment it enters the catalogue.
// So nuts join the flavour rule: establishable from a head noun
// ("Lajthia të pjekura", "Arra 200g") or an unambiguous shelf, never from
// a mention. `chocolate-spread` is added for the mirror reason — "çoko"
// is the other half of the same title.
const FLAVOUR_ONLY_FAMILIES = new Set([
  'fresh-fruit',
  'fresh-vegetables',
  'honey',
  'nuts-seeds',
  // 'dried-fruits' was added here too and had to come straight back out.
  // It is established by a SHELF ("Fruta të thata"), not by a head noun, so
  // making it head-noun-only stopped that shelf resolving at all and the
  // rows fell through to `fresh-fruit` — re-creating the exact "bag of
  // spicy peanuts labelled pemë" defect fixed the day before. Nuts needed
  // the rule because `lajthi` is a flavour word; dried fruit does not,
  // because its shelf names it outright. Added on a guess, removed on a
  // measurement.
]);

/**
 * "ME X" IS AN INGREDIENT, NOT THE PRODUCT (measured 2026-09-17).
 *
 * Albanian retail titles name what is IN a thing inline: `Pionir Zemer Me
 * Mjalte 150G` is a honey-flavoured gingerbread heart, `Qaj Kamomil Me
 * Mjalt Mega 20G` is a chamomile-and-honey TEA — and the screen offered the
 * tea as the exact swap for the gingerbread, because both titles mention
 * honey and nothing else placeable. categoryFamily.js already carries the
 * same idea as FOLD_TRAPS for category strings ("me qumësht", "dhe vezë");
 * this is the title-side version, generalised to any word after me/dhe/në.
 */
const INGREDIENT_MODIFIER = /\b(me|dhe|ne|në)\s+[\p{L}]+/giu;

/**
 * The title's family. The HEAD NOUN wins when there is one — Albanian
 * retail titles lead with what the thing is ("Qumesht Vita 1L", "Biskota
 * Camel 450Gr") — and a title that only MENTIONS one family is accepted
 * too, because plenty of real rows lead with a brand ("BYLMETI JOGURT
 * 3,2%"). A title mentioning two families and leading with neither says
 * nothing: "Vipa Ketchup Chips 30g" is crisps, but its own words do not
 * settle that, so it is not offered as an exact swap — its shelf label is.
 */
/**
 * A SPLIT FAMILY AND ITS PARENT ARE NOT TWO ANSWERS (2026-09-17).
 *
 * `Koral Detergjent Per Xhama Blue 750ml` names two families at once —
 * 'detergjent' is `cleaning`, 'per xhama' is `surface-cleaner` — and the
 * ambiguity rule would call that undetermined, or worse let the broad
 * reading win and put a window spray back in the same bucket as a laundry
 * detergent. They do not disagree: one is the aisle and the other is the
 * purchase, and this screen is about the purchase. So when both are
 * present, the narrower one is the answer and the parent is discarded.
 *
 * Only for families genuinely split out of another, never for two families
 * that merely sit near each other — `tofu` and `cheese` are NOT here,
 * because tofu is not a kind of cheese.
 */
const NARROWER_THAN = new Map([
  ['surface-cleaner', 'cleaning'],
  ['fabric-softener', 'cleaning'],
]);

function collapseNarrower(families) {
  for (const [narrow, parent] of NARROWER_THAN) {
    if (families.has(narrow)) families.delete(parent);
  }
  return families;
}

function titleEvidence(name) {
  const lead = leadFamilyOf(name);
  const stripped = String(name || '').replace(INGREDIENT_MODIFIER, ' ');
  const mentioned = new Set();
  for (const family of titleFamiliesOf(stripped)) {
    if (FLAVOUR_ONLY_FAMILIES.has(family)) continue;
    mentioned.add(family);
  }
  collapseNarrower(mentioned);
  // A lead noun that is only the parent of something the title also names
  // is the aisle word, not the head noun: "Detergjent Për Xhama" leads with
  // `cleaning` and means `surface-cleaner`.
  const effectiveLead = lead && !mentioned.has(lead) && [...NARROWER_THAN.values()].includes(lead) ? null : lead;
  return { lead: effectiveLead, mentioned };
}

/**
 * A curated brand-map entry's family, but only when the entry is about
 * exactly ONE kind of thing.
 *
 * The map is per-purchase and this is why it can be trusted here: Imlek has
 * five separate entries (milk, yogurt, cream, cheese, butter), each with
 * its own sourced alternatives, so "Vita (jogurt)" for a Serbian yogurt is
 * a documented pairing rather than a guess. An entry that spans several
 * families — the `fresh-produce` one is tagged potatoes + vegetables +
 * fruits — is not specific enough to answer 1:1 and is refused.
 */
function entryFamily(entry) {
  return singleFamily(categoryFamiliesOf(entry?.offCategoryTags));
}

/**
 * ONE PASS OVER THE CATALOGUE, reused for every row on the screen.
 *
 * Without this the screen is unusable: resolveAlternativesForRetailProduct
 * sweeps all 33,039 rows per product, calling isTrustedLocalRow (a GS1
 * classify plus two boycott lookups) on each. For the 283 Serbian products
 * that is ~9.3 million classifications, and /eksploro has already frozen
 * once on exactly this shape of loop (2026-09-16, "eksploro not
 * working atp").
 *
 * The index is keyed by `exactFamilyOf`, the same function that judges the
 * Serbian side, so a candidate in the index has already passed the
 * independent family re-judgement by construction — there is one definition
 * of "what is this" in this file and nothing can drift from it.
 */
export function buildExactIndex(data) {
  const pool = data?.kosovoRetail?.products || [];
  const nonLocalBrands = buildNonLocalBrandSet(data?.brandAlternatives);
  const byFamily = new Map();
  const seen = new Set();

  for (const row of pool) {
    if (!isTrustedLocalRow(row, { gs1: data?.gs1, boycott: data?.boycott, nonLocalBrands })) continue;
    const family = exactFamilyOf(row);
    if (!family) continue;
    if (!retailIdentity(row, pool)) continue; // nothing a shopper could read
    const key = dedupeKeyFor(row);
    if (seen.has(key)) continue;
    seen.add(key);
    if (!byFamily.has(family)) byFamily.set(family, []);
    byFamily.get(family).push(row);
  }

  // Cheapest first, unknown price last — the project's standing "best value
  // is a rule, not a section" ordering. Rows with no price are not guessed
  // at, they simply sort after the ones we can compare.
  //
  // PHOTOGRAPHED ROWS FIRST, and only then by price (2026-09-17). Owner:
  // "always show photos for vendore options show photos for them". The
  // screen now renders a pack shot per alternative, and a row with no
  // `image` leaves an empty frame where the thing he wants people to buy
  // should be. Measured over the shipped catalogue below — only a small
  // minority of proven-local rows lack a photo — so this reorders very
  // few pairs and the cheapest photographed row is still first in almost
  // every family. It does NOT hide the unphotographed rows: they keep
  // their place behind the photographed ones and still fill the grid when
  // a family has nothing else, with the missing photo stated in words.
  for (const rows of byFamily.values()) {
    rows.sort((a, b) => (hasPhoto(b) ? 1 : 0) - (hasPhoto(a) ? 1 : 0) || priceOf(a) - priceOf(b));
  }

  return { byFamily, pool, nonLocalBrands, entries: data?.brandAlternatives?.entries || [] };
}

function priceOf(row) {
  return typeof row?.price === 'number' && Number.isFinite(row.price) ? row.price : Infinity;
}

function hasPhoto(row) {
  return Boolean(String(row?.image || '').trim());
}

/**
 * Every product on /alternativa: the Serbian ones, and only those.
 *
 * BOTH LANES, as the app flags them elsewhere — `productStance().flagged`
 * is true for a Serbian GS1 prefix OR a hit in the curated boycott table.
 * Both are needed and neither is sufficient: Chipsy registers barcode
 * 3870508000157 through Bosnia's GS1 office (prefix 387) and is caught only
 * by the table, while plenty of 860-prefixed rows carry no brand string at
 * all and are caught only by the prefix. `productStance` is also what
 * clears the Bimilk class — a source-cited non-Serbian manufacture location
 * beats the registration prefix — so this screen and the scan verdict can
 * never disagree about who is on the list.
 *
 * Deduped on the title a shopper reads: the catalogue holds the same SKU
 * once per store, so "Plazma 300g" is one row here, not four.
 */
export function collectSerbianProducts(data) {
  const pool = data?.kosovoRetail?.products || [];
  const groups = new Map();

  // DEDUPE FIRST, CLASSIFY SECOND — and this order is the difference
  // between a screen and a frozen tab. `productStance()` is a GS1 classify,
  // two boycott lookups and a product-origins lookup; running it on all
  // 33,039 rows took 1.8s in Node on this machine. The catalogue holds the
  // same SKU once per store, so grouping on the cheap string key first cuts
  // the classifications to one per distinct product. /eksploro has already
  // frozen once on exactly this shape of loop (2026-09-16).
  for (const row of pool) {
    const key = dedupeKeyFor(row);
    const kept = groups.get(key);
    if (!kept) {
      groups.set(key, { product: row, listings: 1, brands: row.brand ? [row.brand] : [] });
      continue;
    }
    // Keep the cheapest listing, and prefer one that has a photo — the same
    // product from four stores should show its best available card.
    if (priceOf(row) < priceOf(kept.product) || (!kept.product.image && row.image)) {
      kept.product = row;
    }
    // EVERY BRAND STRING THE GROUP CARRIES, and this is not bookkeeping.
    // The brand column is filled on 7% of rows, so the SAME barcode appears
    // as `brand: "Jaffa"` under one retailer and `brand: null` under
    // another. Deduping first and then classifying only the representative
    // silently dropped 36 Serbian products whose chosen row happened to be
    // the one with no brand — the boycott table catches them by brand, not
    // by prefix. A group is Serbian if ANY of its listings is.
    if (row.brand && !kept.brands.includes(row.brand)) kept.brands.push(row.brand);
    kept.listings += 1;
  }

  const out = [];
  for (const [key, { product, listings, brands }] of groups) {
    let flagged = productStance(product, data).flagged;
    if (!flagged) {
      for (const brand of brands) {
        if (brand === product.brand) continue;
        if (productStance({ ...product, brand }, data).flagged) {
          flagged = true;
          break;
        }
      }
    }
    if (!flagged) continue;
    out.push({ product, listings, family: exactFamilyOf(product), key });
  }
  return out;
}

/**
 * The exact 1:1 alternatives for one Serbian product.
 *
 * Mirrors resolveAlternativesForRetailProduct's tier ORDER — curated brand
 * pairing, curated category pairing, then same-family catalogue rows — and
 * deliberately stops there. The two tiers below it in that function
 * (`catalog-category-fallback`, then nothing) are the bucket tiers rule 1
 * excludes; see EXACT_SOURCES.
 *
 * @returns {{
 *   family: string|null,
 *   items: object[],
 *   source: string|null,
 *   rejected: {label: string, reason: string}[],
 * }}
 */
export function exactAlternativesFor(entry, data, index) {
  const product = entry?.product || entry;
  const family = entry?.family !== undefined ? entry.family : exactFamilyOf(product);
  const rejected = [];

  if (!family) {
    return { family: null, items: [], source: null, rejected: [{ label: product?.name || '', reason: REJECT.SCANNED_UNDETERMINED }] };
  }

  // (a) + (b) the curated, source-cited brand map.
  const curated = curatedItemsFor(product, family, index, rejected);
  if (curated.items.length > 0) return { family, items: curated.items, source: curated.source, rejected };

  // (c) proven-local catalogue rows in the SAME family.
  const rows = index?.byFamily?.get(family) || [];
  const items = [];
  for (const row of rows) {
    if (items.length >= EXACT_LIMIT) break;
    if (row.id === product.id || dedupeKeyFor(row) === dedupeKeyFor(product)) continue;
    if (product.brand && row.brand && isSameBrand(row.brand, product.brand)) {
      rejected.push({ label: row.name, reason: REJECT.SAME_BRAND });
      continue;
    }
    const identity = retailIdentity(row, index.pool);
    if (!identity) {
      rejected.push({ label: row.name || row.id, reason: REJECT.NOT_RENDERABLE });
      continue;
    }
    items.push({
      isBrandLevel: false,
      code: row.barcode || row.id,
      name: row.name,
      brand: identity.brand,
      image: row.image || null,
      // Gated on isTrustedLocalRow — isLocalBrand === true on the row's own
      // record, plus the boycott and Serbian-barcode checks. "kosovo" is a
      // measured label here, never "we saw it in a Kosovo shop".
      country: 'kosovo',
      isLocalClaim: true,
      live: false,
      family,
      matchedTag: family,
      price: typeof row.price === 'number' ? row.price : null,
      currency: row.currency || null,
      source: row.source || null,
      sourceLabel: row.sourceLabel || null,
      url: row.url || null,
      // The catalogue row itself, so the card can open the app's own
      // product detail instead of dead-ending. Owner, 2026-09-17: "make em
      // all clickable". Carried rather than re-looked-up by id because the
      // same SKU exists once per store and a lookup would have to guess
      // which listing this card came from.
      row,
    });
  }

  if (items.length > 0) return { family, items, source: 'catalog-family-fallback', rejected };
  return { family, items: [], source: null, rejected };
}

function curatedItemsFor(product, family, index, rejected) {
  const entries = index?.entries || [];

  if (product?.brand) {
    const matches = findEntriesByBrand(product.brand, entries);
    for (const entry of matches) {
      const fam = entryFamily(entry);
      if (fam === family) {
        return { items: entryToItems(entry).slice(0, EXACT_LIMIT).map((i) => ({ ...i, family })), source: 'brand-match' };
      }
      rejected.push({
        label: `${entry.serbianBrand} -> ${entry.alternatives.map((a) => a.brand).join(', ')}`,
        reason: fam ? REJECT.DIFFERENT_FAMILY : REJECT.ENTRY_SPANS_FAMILIES,
      });
    }
  }

  if (product?.category) {
    const matches = findEntriesByCategoryKey(product.category, entries);
    for (const entry of matches) {
      if (entryFamily(entry) !== family) continue;
      const items = entryToItems(entry).slice(0, EXACT_LIMIT).map((i) => ({ ...i, family }));
      if (items.length > 0) return { items, source: 'brand-category-match' };
    }
  }

  return { items: [], source: null };
}

/**
 * THE SOURCE GATE, as a reusable predicate.
 *
 * `exactAlternativesFor` only ever builds from the three allowed tiers, so
 * it cannot produce a loose answer. This exists so the evaluation harness
 * can put the SAME question to the real resolver
 * (resolveAlternativesForRetailProduct) and count how many products the app
 * would have answered from a bucket tier that this screen refuses — the
 * number that shows the strictness is doing something.
 */
export function isExactSource(source) {
  return EXACT_SOURCES.has(String(source || ''));
}

/**
 * Judge an arbitrary resolver answer by this screen's rules. Used by
 * scripts/eval-alternatives.mjs so the report measures the gate rather than
 * restating it.
 *
 * @returns {{accepted: object[], rejected: {label: string, reason: string}[]}}
 */
export function gateResolved(product, resolved) {
  const family = exactFamilyOf(product);
  const items = resolved?.items || [];
  const accepted = [];
  const rejected = [];

  if (!isExactSource(resolved?.source)) {
    for (const it of items) rejected.push({ label: it.name || it.brand || '', reason: REJECT.LOOSE_SOURCE });
    return { family, accepted, rejected };
  }
  if (!family) {
    for (const it of items) rejected.push({ label: it.name || it.brand || '', reason: REJECT.SCANNED_UNDETERMINED });
    return { family, accepted, rejected };
  }

  for (const it of items) {
    const label = it.name || it.brand || '';
    const fam = it.isBrandLevel ? entryFamily(resolved.sourceEntry) : exactFamilyOf({ name: it.name, category: it.category ?? null });
    if (!fam) {
      rejected.push({ label, reason: it.isBrandLevel ? REJECT.ENTRY_SPANS_FAMILIES : REJECT.CANDIDATE_UNDETERMINED });
      continue;
    }
    if (fam !== family) {
      rejected.push({ label: `${label} [${fam}]`, reason: REJECT.DIFFERENT_FAMILY });
      continue;
    }
    accepted.push(it);
  }
  return { family, accepted, rejected };
}
