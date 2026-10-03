// Which of the three flag treatments a country gets.
//
// Owner, 2026-09-12: "if it's a non recognizer . list them as mos-njohes and
// their flag becomes gray (slovakia, greece, romania). if serbia its red
// like light red opacitated flag — strong must not buy, almost dangerous
// looking flag."
//
// THE LEVELS ARE NOT INTERCHANGEABLE, and that is the point of this module
// existing separately rather than being an inline ternary:
//
//   'danger'  RED   — a boycott target. The strongest claim the app makes.
//   'muted'   GREY  — "mos-njohës": the country does not recognise Kosovo's
//                     independence. A real, sourced political fact worth
//                     surfacing — but NOT a call to boycott. Spain, Greece,
//                     Cyprus, Romania and Slovakia are EU members in this
//                     category; treating them as boycott targets would be
//                     the app overstating its own case.
//   'normal'        — full colour.
//
// Recognition data comes from data/country-stance.json. When that file is
// missing or a country is absent from it, the tone falls back to 'normal' —
// NEVER to 'muted'. Greying a flag is an accusation; an accusation must
// come from evidence, not from missing evidence.

import { VERDICT } from './gs1.js';

/**
 * @param {object} classify - result of classifyBarcode() (+ any boycott override)
 * @param {object|null} countryStance - loaded country-stance table
 * @returns {'danger'|'muted'|'normal'}
 */
export function flagToneFor(classify, countryStance) {
  if (!classify) return 'normal';
  // 2026-09-12: the owner first asked for a red 'danger' wash on Serbia,
  // then pointed at a black-and-white Serbian flag and said "this is the
  // serbian flag you will be showing". Latest instruction wins; the
  // 'danger' tone and SerbiaDanger SVG are kept so this is a one-word
  // change back if that was not the intent.
  if (classify.verdict === VERDICT.SERBIAN) return 'muted';
  if (isNonRecogniser(classify.iso, countryStance)) return 'muted';
  return 'normal';
}

/**
 * True ONLY when the dataset positively records that this country does not
 * recognise Kosovo. Unknown is not the same as "no" — see the note above.
 */
export function isNonRecogniser(iso, countryStance) {
  const code = String(iso || '').toUpperCase();
  if (!code) return false;
  const record = countryStance?.byIso?.get?.(code) ?? countryStance?.byIso?.[code];
  if (!record) return false;
  return record.recognisesKosovo === false;
}

/** The inverse, used where the UI wants to say something positive. */
export function isRecogniser(iso, countryStance) {
  const code = String(iso || '').toUpperCase();
  if (!code) return false;
  const record = countryStance?.byIso?.get?.(code) ?? countryStance?.byIso?.[code];
  return record?.recognisesKosovo === true;
}

// ---------------------------------------------------------------------------
// ONE STANCE, COMPUTED ONCE, USED BY EVERY SURFACE
// ---------------------------------------------------------------------------
//
// Owner, 2026-09-16: "serb products and mos-njohese products always black
// white no exception".
//
// "No exception" is only achievable if every screen asks the SAME function.
// Before this, /eksploro computed `isFlagged` inline, ProductFlag computed
// its own classify, and the detail page computed a third — so a row and the
// page it opened could disagree, and a new screen had nothing to call.
//
// This is that function. It returns everything a surface needs to render the
// judgement: the class flags for the black-and-white rule, the flag tone, and
// the split-origin facts.

import { classifyBarcode } from './gs1.js';
import { findBoycottByCode, findBoycottByBrand, applyBoycott , findBoycottInTitle, findBrandHomonym } from './boycott.js';
import { findVerifiedOrigin, resolveOrigin, COUNTRY_CODE_NAMES } from './productOrigins.js';

export function productCode(product) {
  return product?.code || product?.barcode || null;
}

/**
 * @param {object|null} product  a catalogue row, history entry or alternative
 * @param {object|null} data     the loaded data bundle
 * @returns {{
 *   code: string|null,
 *   classify: object|null,
 *   boycott: object|null,
 *   origin: object|null,
 *   split: object|null,
 *   flagged: boolean,
 *   nonRecogniser: boolean,
 *   tone: 'normal'|'muted'|'danger',
 *   splitOrigin: boolean,
 * }}
 */
export function productStance(product, data) {
  const code = productCode(product);
  const base = code && data?.gs1 ? classifyBarcode(code, data.gs1) : null;

  // Same two lanes as the verdict screen: exact barcode first (local,
  // synchronous), then the brand string.
  // Three lanes, strongest first: the exact barcode, then the brand column,
  // then the PRODUCT TITLE. The third exists because `brand` is null on 93%
  // of retail rows — 48 Bambi Plazma rows shipped with no flag at all while
  // Bambi sat in the boycott table with "plazma" as an alias. See
  // findBoycottInTitle() for why detecting beats deleting.
  const rawBoycott =
    (code ? findBoycottByCode(code, data?.boycott) : null) ||
    findBoycottByBrand(product?.brand, data?.boycott) ||
    findBoycottInTitle(product?.name, data?.boycott) ||
    null;

  // MISIDENTIFICATION IS NOT THE SAME THING AS "MADE ELSEWHERE".
  //
  // The one-way rule below says a curated boycott hit beats an origin
  // override, and it still does: a Serbian brand does not get cleared by
  // being produced abroad. But that rule assumes the hit identified the
  // right company. When two producers share a name — Jaffa Crvenka's
  // biscuits and Fluidi's Jaffa Champion juice — a name-based hit can be
  // pointing at the wrong one, and the honest repair belongs in the
  // IDENTIFICATION, not in the verdict precedence. See findBrandHomonym().
  const homonym = findBrandHomonym(rawBoycott, product);
  const boycott = homonym ? null : rawBoycott;

  let classify = base ? applyBoycott(base, boycott) : null;

  // When the name was the other producer's, the origin lookup has to ask
  // about the other producer too — otherwise a barcode-less Jaffa Champion
  // row would clear the boycott and then resolve its country through the
  // Serbian biscuit entry, which is the same mistake one step later.
  const origin = findVerifiedOrigin(
    { code, brand: homonym ? homonym.otherBrand : product?.brand },
    data?.productOrigins
  );
  const split = resolveOrigin(classify, origin);

  // THE ONE CASE WHERE AN 860 PREFIX DOES NOT MEAN "SERBIAN PRODUCT".
  //
  // boycott.js documents that its own override is one-way — "Nothing here
  // can clear an 860-prefixed product" — and that stays true: a curated
  // boycott hit always wins below.
  //
  // What clears it here is a different and stronger kind of evidence: a
  // VERIFIED, SOURCE-CITED production location in data/product-origins.json
  // that is not Serbia. That is not a hunch about a factory, it is a fetched
  // and quoted source recorded in product-origins-SOURCES.md. The Bimilk
  // yogurt is made in Bitola by a dairy that has stood there since 1952; the
  // app does not get to call it Serbian because Imlek registered its number.
  //
  // The Serbian REGISTRATION and the Serbian OWNERSHIP are not discarded —
  // they move to their own lines (see resolveOrigin) and are shown.
  //
  // A VERIFIED FACTORY ALSO MOVES THE FLAG WHEN THERE WAS NOTHING TO CLEAR.
  // Jaffa Champion's 0.25L is registered on 530 (GS1 Albania), so its prefix
  // verdict was already LOCAL and the clearing branch never ran — and the
  // scan screen drew an Albanian flag while /eksploro, which reads
  // `split.displayIso`, drew a Kosovar one. Same product, two screens, two
  // countries, which is the exact failure this module was written to end.
  //
  // `!boycott` guards BOTH, and that is load-bearing rather than tidy. With
  // the flag moving independently of the verdict, a product whose boycott
  // hit stands would have rendered a greyed MACEDONIAN flag over JO E JONA —
  // the app accusing the wrong country out loud. When the boycott wins, it
  // wins whole: verdict and flag stay Serbian together.
  //
  // `manufactureIso !== 'RS'` keeps this path one-way in the other sense
  // too: it can move a flag off Serbia, never onto it. Upgrading a product
  // TO Serbian is boycott.js's job and needs a curated entry, not an
  // inference from a production address.
  const splitApplies =
    !boycott && split.manufactureVerified && split.divergent && split.manufactureIso !== 'RS';
  const clearedBySource = splitApplies && classify?.verdict === VERDICT.SERBIAN;

  if (splitApplies) {
    // THE FLAG FOLLOWS MANUFACTURE. resolveOrigin() has said so in a comment
    // since the Bimilk fix — "the flag drawn on a product answers 'where
    // does this come from', so it follows MANUFACTURE when manufacture is
    // verified" — but only the surfaces that read `stance.stanceIso` were
    // honouring it. The three result screens read `classify.iso`, so
    // /b/8601500111207 dropped the boycott and then drew a Serbian flag
    // over a Macedonian yogurt, and /b/8600101990242 drew one over a
    // Kosovar juice. Half a correction reads as a correction that failed.
    //
    // So the manufacture country is written onto `classify` itself, and
    // the registration is not deleted — it keeps `prefix` and
    // `isSerbiaPrefix` (so "prefiksi 860" still renders, and every test
    // that asserts the prefix really is Serbian still passes) and gains
    // three explicit `registration*` fields of its own.
    //
    // A VERIFIED KOSOVAR OR ALBANIAN FACTORY IS `LOCAL`, not merely "not
    // Serbian". That is the whole of the owner's 2026-09-18 instruction: a
    // Fluidi bottle is not a foreign product a shopper should shrug at, it
    // is the local one the app is trying to point them to. The claim is not
    // "sold in Kosovo" — it is a source-cited production location, which is
    // the strongest evidence this app accepts for anything.
    const localMade = split.manufactureIso === 'XK' || split.manufactureIso === 'AL';
    const name = COUNTRY_CODE_NAMES[split.manufactureIso];
    classify = {
      ...classify,
      // The VERDICT only moves when there was a Serbian verdict to move. A
      // product that was already LOCAL or OTHER keeps it and just gets the
      // right flag — the guard above is about geography, not about guilt.
      verdict: clearedBySource ? (localMade ? VERDICT.LOCAL : VERDICT.OTHER) : classify.verdict,
      splitOrigin: true,
      registrationIso: classify.iso,
      registrationCountry: classify.country,
      registrationCountrySq: classify.countrySq,
      iso: split.manufactureIso,
      country: name?.en || classify.country,
      countrySq: name?.sq || classify.countrySq,
    };
  }

  const flagged = classify?.verdict === VERDICT.SERBIAN || Boolean(boycott);

  // The mos-njohës test runs on the country the flag actually shows — where
  // the thing is from — not on a registration office somewhere else.
  // THE BOYCOTT TABLE IS ALSO AN ORIGIN SOURCE, and it is the last one
  // standing when a row has no barcode.
  // Owner, 2026-09-16: "products that are understandably serbian but have no
  // barcode or flag remove them completely" — and, on the general rule:
  // "think of this as a whole . and dont let this edge case cmoe around".
  // 22 of the 48 Bambi Plazma rows have no barcode at all, so there was no
  // prefix to derive a country from and they rendered flagless. But a
  // boycott entry is not a guess: Bambi's row cites the company's own
  // contact page and its seat in Požarevac, PIB 100436827. That IS the
  // origin evidence, so it supplies the flag rather than leaving a Serbian
  // product looking unattributed. Removal was the owner's instruction, but
  // a flagged product is strictly better than a deleted one — this app
  // exists to make Serbian products visible, and deleting them hides them.
  // The residue his rule really targets — Serbian-identified AND still no
  // flag — is zero after this, by construction.
  const boycottIso = boycott && /serb/i.test(String(boycott.country || '')) ? 'RS' : null;
  const stanceIso = split.displayIso || classify?.iso || boycottIso || null;
  const nonRecogniser = !flagged && isNonRecogniser(stanceIso, data?.countryStance);

  return {
    code,
    classify,
    boycott,
    // The withdrawn hit is kept, not swallowed: a surface that wants to
    // explain why a product a shopper expects to see flagged is not flagged
    // has the reason and its source to hand.
    homonym,
    origin,
    split,
    flagged,
    nonRecogniser,
    // Mirror of split.serbianOwned — "this one is ours", said only when the
    // ownership country is sourced. See resolveOrigin().
    locallyOwned: split?.locallyOwned === true,
    // What the flag should show, including the boycott-derived fallback.
    stanceIso,
    tone: flagged || nonRecogniser ? 'muted' : 'normal',
    splitOrigin: Boolean(clearedBySource || split.divergent),
  };
}

/**
 * The two class names the BLACK AND WHITE rule in App.css keys off.
 * Returns '' when the product is neither — so a caller can always
 * interpolate it unconditionally and no screen can forget the rule.
 */
export function stanceClass(stance, { flaggedClass = 'is-flagged', nonRecogClass = 'is-nonrecog' } = {}) {
  if (!stance) return '';
  if (stance.flagged) return ` ${flaggedClass}`;
  if (stance.nonRecogniser) return ` ${nonRecogClass}`;
  return '';
}

// ---------------------------------------------------------------------------
// "SOLD IN KOSOVO" IS NOT "MADE BY A KOSOVAR BRAND"
// ---------------------------------------------------------------------------
//
// The project's central honesty rule, and it was inverted on the
// alternatives cards. Every badge did:
//
//     const kosovo = isKosovoCountry(item.country);
//     kosovo ? 🇽🇰 "vendore" : 🇦🇱 "shqiptare"
//
// A two-branch ternary over a THREE-state fact. Every shelf-tier candidate
// carries `country: null` by design — it means "same kind of product, on
// sale in Kosovo, not Serbian", which is explicitly not a claim about who
// made it — and each one fell into the else branch and was badged Albanian
// with an Albanian flag. Measured on the current eval: 45 items claimed an
// Albanian producer that nothing in the data says is Albanian.
//
// The resolver now carries `isLocalClaim: boolean` for exactly
// this. The badge keys off that, and the three states are:
//
//   'kosovo'  — proven local, Kosovo    -> 🇽🇰 flag, "vendore"
//   'albania' — proven local, Albania   -> 🇦🇱 flag, "shqiptare"
//   'none'    — no origin claim at all  -> NO FLAG, and wording that says
//               only what is true: it is on the shelf in Kosovo.
//
// The owner asked for "alternativa vendore show always a miniflag if KS or
// Albanian . and more better pronounced". The other half of "always show a
// flag when it IS local" is never show one when it is not — a flag is a
// factual claim, and this one had no fact behind it.
//
// `isLocalClaim` is read strictly as `=== true`: undefined and false are
// both "not proven local", never "probably fine".

import { isKosovoCountry } from './matcher.js';

/**
 * @param {object|null} item an alternative from the resolver
 * @returns {{ kind: 'kosovo'|'albania'|'none', iso: string|null, labelKey: string, claimed: boolean }}
 */
export function localClaimBadge(item) {
  if (item?.isLocalClaim !== true) {
    return { kind: 'none', iso: null, labelKey: 'badgeSoldInKosovo', claimed: false };
  }
  return isKosovoCountry(item.country)
    ? { kind: 'kosovo', iso: 'XK', labelKey: 'badgeKosovar', claimed: true }
    : { kind: 'albania', iso: 'AL', labelKey: 'badgeShqiptar', claimed: true };
}
