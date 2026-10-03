/**
 * THE THIRD WITNESS: what a NAMED product actually is.
 *
 * Owner, 2026-09-19: "gjeji me shume alternativa".
 *
 * WHY THIS FILE EXISTS. exactFamilyOf() weighs two witnesses — the
 * retailer's shelf label and the product's own title — and refuses to
 * answer when neither speaks. Measured over the 294 Serbian products on
 * /alternativa, 97 of them could not be identified at all, and reading
 * the list showed the two witnesses failing in the same way over and
 * over:
 *
 *   Clipsy Sweet Chilli          shelf "CHIPS & FLIPS"   title: a brand
 *   Smoki Stark 130gr            shelf "Ushqimore"       title: a brand
 *   Gud Kikirik 40Gr             shelf "Njelmeta"        title: brand + kikirik
 *   Marbo Chipsy Cut Salted      shelf "Ice Tea"         title: a brand
 *
 * The shelf is either a catch-all ("Ushqimore" = groceries), a compound
 * that names two purchases at once, or simply wrong — a bag of crisps
 * filed under Ice Tea. And the title is a BRAND, so leadFamilyOf(), which
 * only trusts the first word of an Albanian retail title, has nothing to
 * read. `Gud Kikirik` is the clearest case: the title literally says
 * peanut, but "Gud" comes first, so the head-noun rule never sees it.
 *
 * WHAT THIS ADDS, AND WHY IT IS NOT A LOOSENING. A shelf label is a
 * guess about a product. A product's identity is a FACT about it:
 * Smoki is Štark's extruded peanut puff, Chipsy is Marbo's potato crisp.
 * That is stronger evidence than either existing witness, not weaker.
 * But it is only as good as the curation, so the rule is deliberately
 * one-directional:
 *
 *   THIS TABLE IS CONSULTED ONLY WHEN exactFamilyOf() WOULD RETURN NULL.
 *
 * It can never overturn a family the two witnesses already agreed on, so
 * no answer that is right today can be changed by anything written here.
 * The only thing an entry can do is turn "we don't know what this is"
 * into an answer. A test asserts this direction, and a second test
 * asserts that no entry CONTRADICTS a family the witnesses do resolve —
 * a contradiction means either the entry or the taxonomy is wrong, and
 * both are worth failing a build over.
 *
 * WHAT IS DELIBERATELY ABSENT. Identifying a product is not the same as
 * having a local replacement for it, and this file refuses to blur the
 * two. Munchmallow, Jaffa Cakes, Jaffa Sandwich, Pionir's honey hearts
 * and Isleri are all identified with certainty and all left OUT, because
 * the nearest local family with stock is `cakes-pastry` and every row in
 * it is a Belino croissant. A chocolate-coated marshmallow teacake
 * answered with a cream croissant is exactly the waffle-for-a-biscuit
 * swap the screen exists to refuse. They stay open cases; they are
 * listed at the bottom of this file so the next person does not have to
 * rediscover them.
 *
 * EVERY ENTRY CARRIES ITS OWN JUSTIFICATION. `note` says what the
 * product is; `localExample` names a row that is actually in the Kosovo
 * catalogue today, so "this family has an answer" is a checked claim and
 * not an assumption. If the catalogue stops carrying it, the test that
 * reads these names says so.
 */

/**
 * @typedef {Object} Identity
 * @property {RegExp} re           matched against the folded, lowercased title
 * @property {string} family       a family id from categoryFamily.js
 * @property {string} note         what the product is, and who makes it
 * @property {string} localExample a Kosovo-catalogue row this family answers with
 */

/** @type {Identity[]} */
export const PRODUCT_IDENTITIES = [
  // ---- MARBO FOODS (Serbia) — crisps and extruded snacks -------------
  // Marbo's two crisp lines. Both appear in the catalogue under their own
  // name, under "Marbo <name>", and misspelt as Clipsy; all three reach
  // the same product. The shelves these sit on include "Ice Tea",
  // "Juices", "Energy Drinks" and "Sweets & Bakery", which is why the
  // shelf witness cannot be trusted for them at all.
  {
    re: /\bcl?hipsy\b|\bclipsy\b/,
    family: 'crisps',
    note: 'Chipsy / Clipsy — Marbo Foods (Serbia) potato crisps',
    localExample: 'Vipa Chips Ketchup 40 Gr',
  },
  {
    re: /\bdoritos\b/,
    family: 'crisps',
    note: 'Doritos — corn tortilla chips, produced for the region by Marbo Foods (Serbia)',
    localExample: 'Vipa Classic Salt Chips 30g',
  },

  // ---- ŠTARK / BANINI / PIONIR — extruded peanut snacks --------------
  // Smoki is the archetype: an extruded peanut puff. Kosovo's answer is
  // not a near-miss, it is the same product — Vipa Flips and Skoki Flips
  // are both extruded peanut puffs on Kosovo shelves today.
  {
    re: /\bsmoki\b/,
    family: 'savoury-snacks',
    note: 'Smoki — Štark (Serbia) extruded peanut puff',
    localExample: 'Skoki Flips 22Gr',
  },
  {
    // No trailing \b after `shkopinj`: the catalogue spells it
    // "Shkopinjë", which folds to "shkopinje", and a closing boundary
    // made the stem match nothing at all.
    re: /\btrik\b.*\b(shkopinj|mix\b)/,
    family: 'savoury-snacks',
    note: 'Trik — Banini (Serbia) salted sticks / grissini snack mix',
    localExample: 'Vipa Hot Dog Stick 40G',
  },
  {
    re: /\b(shtapiq|shtapiqi|stapici|štapići)\b/,
    family: 'savoury-snacks',
    note: 'štapići — salted stick snack; the word itself is the product, and it is the head noun the brand hides',
    localExample: 'Vipa Hot Dog Stick 40G',
  },
  {
    re: /\bpardon\b.*\b(kikirik|kikiriki)\b/,
    family: 'savoury-snacks',
    note: 'Pardon — coated peanut snack',
    localExample: 'Vipa Flips Grill 16Gr',
  },

  // ---- PEANUTS, where the title says so and the brand hides it -------
  // `Gud Kikirik 40Gr` is the row that motivated the whole file. kikirik
  // is Albanian for peanut, the stem is already in the lexicon, and the
  // title uses it — but leadFamilyOf() only reads the FIRST word, which
  // is the brand. This is not new knowledge, it is the existing lexicon
  // reaching a title it could not previously parse.
  {
    re: /\bgud\b.*\b(kikirik|kikiriki|peanut)\b/,
    family: 'nuts-seeds',
    note: 'Gud — fried salted peanuts; the title names the product in Albanian, after the brand',
    localExample: 'Kikirik Me Varse 40Gr',
  },

  // ---- BAMBI (Serbia) ------------------------------------------------
  {
    re: /\bplazma\b/,
    family: 'biscuits',
    note: 'Plazma — Bambi (Serbia) plain sweet tea biscuit',
    localExample: 'Minella Biscuit 150G',
  },
  {
    re: /\bsl\b.*\bchoco\s*biscuit\b/,
    family: 'biscuits',
    note: 'Swisslion choco-coated biscuit bar',
    localExample: 'Biskota Camel 450Gr',
  },

  // ---- STORE-CUPBOARD, one product each ------------------------------
  {
    re: /\bveget\b/,
    family: 'spices-seasonings',
    note: 'Veget — universal savoury seasoning mix (the Moravka line is the Serbian one)',
    localExample: 'Extra Melmesa 250G',
  },
  {
    re: /\bpolimark\b.*\bsenf\b/,
    family: 'mustard',
    note: 'Polimark (Serbia) mustard; senf is the head noun the brand hides',
    localExample: 'SENF 550 gr',
  },
  {
    re: /\bprolom\s*voda\b/,
    family: 'waters',
    note: 'Prolom Voda — Serbian bottled still mineral water',
    localExample: 'Uje Rugove 0.33L',
  },
  {
    re: /\brc\s+(cola|bitter|exotic|tropic|refresher)\b/,
    family: 'soft-drinks',
    note: 'RC — licensed soft-drink line; Kosovo has the same brand bottled locally by Fluidi in Gjilan',
    localExample: 'RC EXOTIC 0.5L',
  },
  {
    re: /\bduel\b.*\b(zbutese|zbutës|softener)\b/,
    family: 'fabric-softener',
    note: 'Duel fabric softener. Only the SOFTENER is here — Duel also sells washing powder and universal gel, and Kosovo has no proven-local stock in those families, so offering a softener for a detergent would be the wrong purchase.',
    localExample: 'Fresh Zbutes Rose 1L',
  },
];

/**
 * IDENTIFIED WITH CERTAINTY, DELIBERATELY NOT MATCHED.
 *
 * Exported so the gap is documented in code rather than in a comment
 * nobody reads, and so a future pass can turn these into answers the day
 * a Kosovar producer appears in the catalogue. Every one of these is an
 * OPEN CASE on /alternativa, which is the honest place for them.
 */
export const IDENTIFIED_BUT_UNANSWERABLE = [
  { name: 'Munchmallow', what: 'Crvenka (Serbia) chocolate-coated marshmallow teacake', why: 'nearest local family with stock is cakes-pastry, whose every row is a Belino croissant' },
  { name: 'Jaffa Cakes / Sandwich / Tops / Fruti', what: 'Jaffa Crvenka (Serbia) sponge-and-jelly cake', why: 'same: no Kosovar sponge-and-jelly cake in the catalogue' },
  { name: 'Pionir Zemer / Minjon / Negro', what: 'Pionir (Serbia) honey hearts and small iced cakes', why: 'no Kosovar equivalent on any tracked shelf' },
  { name: 'Isleri', what: 'sweet biscuit-and-nut confection', why: 'identity confident, exact local counterpart not established' },
  { name: 'Krem Dijamant (gatimi / mengjesi)', what: 'vegetable-fat cooking and breakfast cream', why: 'the only local cream is Abi dairy schmand — a different purchase, not a 1:1' },
  { name: 'Faculet Letre', what: 'facial tissues', why: 'local stock is kitchen towel and toilet paper; neither is a facial tissue' },
  { name: 'Pambuk 50G', what: 'cotton wool', why: 'personal-care has stock but nothing in the same purchase' },
  { name: 'OSH / MSK stationery (bags, pencil cases, flasks, tempera)', what: 'school and stationery lines', why: 'no proven-local stock in any of these families — 43 rows, the largest single gap' },
];

const DIACRITICS = /[̀-ͯ]/g;

function fold(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .toLowerCase();
}

/**
 * The family of a NAMED product, or null.
 *
 * Deliberately returns null rather than guessing: a title that matches no
 * entry is not identified, and "not identified" is a true statement the
 * screen already knows how to render.
 *
 * @param {{name?: string|null}|string|null} row
 * @returns {string|null}
 */
export function identityFamilyOf(row) {
  const name = typeof row === 'string' ? row : row?.name;
  if (!name) return null;
  const folded = fold(name);
  if (!folded) return null;
  let found = null;
  for (const entry of PRODUCT_IDENTITIES) {
    if (!entry.re.test(folded)) continue;
    // Two entries claiming one title in DIFFERENT families means the
    // table contradicts itself. Refuse rather than let source order pick
    // a winner — a silent tie-break is how a wrong answer survives.
    if (found && found !== entry.family) return null;
    found = entry.family;
  }
  return found;
}

/**
 * The entry that explains an identification, for the UI and for tests.
 * @param {{name?: string|null}|string|null} row
 * @returns {Identity|null}
 */
export function identityEntryOf(row) {
  const name = typeof row === 'string' ? row : row?.name;
  if (!name) return null;
  const folded = fold(name);
  return PRODUCT_IDENTITIES.find((e) => e.re.test(folded)) || null;
}
