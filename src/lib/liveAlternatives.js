// REAL-TIME alternative discovery, for categories nobody curated.
//
// Owner, 2026-09-12: "alternatives must be found real-time if random ajvar
// show kosovo one if oil if flour all must work real time not just ones we
// prepare for".
//
// The curated map (data/brand-alternatives.json) is the strongest source but
// it will never cover everything — it holds ~22 pairings. This lane answers
// the rest by searching the KOSOVO RETAIL CATALOGUE the app already ships:
// 1,695 products actually on sale in Super Viva, ETC and Begmart. Measured
// coverage for the owner's own examples: ajvar 4 rows, vaj 59, djathë 59,
// miell 3, kafe 60, biskota 55, salca 44, mjaltë 48.
//
// WHAT THIS LANE CLAIMS, AND WHAT IT DOES NOT.
// Only 49 of those rows carry `isLocalBrand === true`, so for most of them
// we cannot honestly say "Kosovar brand". What we CAN say, and what is
// genuinely useful to someone standing in a shop, is: this is the same kind
// of product, it is on sale in Kosovo, and it is NOT Serbian-registered or
// Serbian-owned. That is a weaker claim than the curated pairings and it is
// labelled differently in the UI — `confidence: 'shelf'` rather than
// 'reported'. Inflating it to "vendore" would repeat the exact bug that once
// made this app recommend Milka and Barilla as local alternatives.
//
// THE EXCLUSION IS THE POINT: every candidate is run through the same
// classifier and boycott table as the scanned product, so a Serbian-issued
// or Serbian-owned item can never be offered as the alternative to another.

import { classifyBarcode, VERDICT } from './gs1.js';
import { findBoycottByCode, findBoycottByBrand } from './boycott.js';
import { categoryFamilyOf } from './categoryFamily.js';
import { isSameBrand } from './matcher.js';
import { canonicalCategory } from './retailCategories.js';

// Albanian/English search stems per product family. These are what turn a
// scanned product's family into words that match a Kosovo shelf label.
const FAMILY_TERMS = {
  // Kept in step with categoryFamily.js's FAMILY_RULES. After the
  // 2026-09-16 split (owner: "dont recommend milk for yogurt") each of
  // these is one aisle purchase, so the search stems are narrower too:
  // 'qumesht' no longer pulls yogurt and 'vaj' no longer pulls butter.
  'cooking-oil': ['vaj luledielli', 'vaj ulliri', 'vaj', 'oil'],
  butter: ['gjalp', 'margarin', 'maslac', 'butter'],
  'nut-butter': ['gjalpë kikiriku', 'gjalpe kikiriku', 'peanut butter', 'krem kikiriku'],
  // 'eurocrem' with a C: the only spelling on the 6 catalogue rows that
  // carry it. See the twin entry in categoryFamily.js.
  'chocolate-spread': ['çokokrem', 'cokokrem', 'krem kakao', 'eurokrem', 'eurocrem', 'krem çokollate'],
  // 'qips' widened from 'qipsa' 2026-09-17: the catalogue writes both
  // ("Qips Vipa 130G Classic" and the "Qipsa" shelf), and the shorter
  // stem reaches both. Checked — only 'qips' and 'qipsa' begin with it.
  crisps: ['çips', 'cips', 'chips', 'patatina', 'patatin', 'qips'],
  // 'shkopinj' — Albanian for STICKS, added 2026-09-17. `Trik Shkopinjë
  // 95g` is Banini's salty stick snack; one retailer files it under
  // "Crackers", which the family map reads as `biscuits`, so /alternativa
  // offered a pack of tea biscuits (Minella, Biskota Camel) for a bag of
  // salted sticks. With the word here the title says savoury-snacks, the
  // shelf says biscuits, the two witnesses disagree and exactMatch.js
  // returns "no exact match yet" — which is the true answer.
  'savoury-snacks': ['flips', 'sticks', 'shkopinj', 'krisp', 'kokoshka', 'popcorn', 'stix'],
  biscuits: ['biskot', 'keks', 'petit'],
  wafers: ['napolitan', 'vafer', 'waffle', 'wafer'],
  // 'kolac' / 'brownie' / 'croisant' added 2026-09-17. The list held only
  // three words, so the whole baked-pastry aisle fell through to whatever
  // else its title mentioned: `Kolac Brownie Cokollate 75G` (a brownie) and
  // `Belino Mini Croisant Çokollatë 185G` (a chocolate croissant) both
  // resolved to CHOCOLATE, and /alternativa answered the brownie with a bar
  // of cooking chocolate and the croissant. categoryFamily.js's own rules
  // already list 'cake', 'croissant', 'brownie' and 'doughnut' — this is
  // the same divergence between the two taxonomies as 'biskot'.
  // 'cake' / 'cakes' added 2026-09-17 — categoryFamily.js's FAMILY_RULES
  // has carried 'cake' since the split and this list never did, so a title
  // that says the word in English ("Eurofood Jaffa Cakes Orange 125g",
  // "Tops JAFFA CAKES 150 GR", "Jaffa Cakes") could not be placed by its
  // own words at all. Checked against every catalogue word the stem
  // prefixes: cakes(118), cake(107), cakebar(11), cakee(1) — all of them
  // cake. It cannot reach inside "cheesecake", because a stem has to begin
  // a word (see termHitIndex).
  'cakes-pastry': ['torte', 'tortin', 'muffin', 'kolac', 'kolaç', 'brownie', 'croissant', 'croisant', 'kroasan', 'cake'],
  chocolate: ['çokollat', 'cokollat', 'qokollad'],
  candy: ['bombon', 'bonbon', 'karamel', 'praline', 'llokum'],
  'ice-cream': ['akullore'],
  juices: ['leng', 'lëng', 'juice', 'nektar'],
  'soft-drinks': ['gazuar', 'cola', 'fanta', 'sprite', 'ice tea', 'schweppes'],
  'energy-drinks': ['energji', 'energy'],
  waters: ['ujë', 'uje', 'water'],
  beers: ['birr', 'beer'],
  wine: ['verë', 'vere', 'wine'],
  spirits: ['raki', 'vodka', 'whisky', 'liker', 'konjak'],
  coffee: ['kafe', 'coffee', 'nescafe', 'espresso'],
  tea: ['çaj', 'caj', 'tea'],
  milk: ['qumësht', 'qumesht', 'milk'],
  yogurt: ['jogurt', 'kos ', 'kosi', 'ajran', 'dhallë', 'dhalle'],
  cream: ['ajkë', 'ajke', 'pavlak', 'kajmak'],
  'milk-pudding': ['puding'],
  cheese: ['djath', 'kaçkavall', 'kackavall', 'gjiz', 'cheese'],
  flour: ['miell', 'flour'],
  pasta: ['makarona', 'spageta', 'fide', 'pasta'],
  rice: ['oriz', 'rice'],
  bread: ['buk', 'bread', 'toast', 'simit'],
  'breakfast-cereals': ['cornflakes', 'muesli', 'drithëra', 'corn flakes'],
  charcuterie: ['sallam', 'suxhuk', 'proshut', 'pershut', 'virshll', 'parizer'],
  'meat-fresh': ['mish', 'pule', 'viçi', 'vici', 'qengji'],
  'fish-seafood': ['peshk', 'tun', 'sardel'],
  eggs: ['vezë', 'veze', 'egg'],
  'fresh-fruit': ['fruta', 'mollë', 'molle', 'banane', 'portokall'],
  'fresh-vegetables': ['perime', 'patate', 'domate', 'qepë', 'qepe', 'tranguj'],
  jams: ['reçel', 'recel', 'marmelat'],
  honey: ['mjalt'],
  // 'keqap' — the commonest of the three Albanian spellings (94 rows, 4 of
  // them proven-local) and the one that was missing. See the twin entry in
  // categoryFamily.js for the measurement and for the crisp-flavour trap
  // it makes live.
  'ketchup-tomato-sauces': ['ketchup', 'keçap', 'kecap', 'keqap', 'salc'],
  'ajvar-pickles': ['ajvar', 'turshi', 'pinxhur'],
  'mayonnaise-dressings': ['majonez'],
  mustard: ['senf', 'mustard'],
  vinegar: ['uthull'],
  salt: ['krip'],
  'spices-seasonings': ['erëza', 'ereza', 'piper', 'melmes'],
  'baby-food': ['bebe', 'foshnje'],
  'nuts-seeds': ['arra', 'kikirik', 'lajthi', 'fara', 'bajame'],
  legumes: ['fasule', 'thjerrëza', 'qiqra', 'bizele'],
  cleaning: ['detergjent', 'deterxhent', 'zbardhues', 'enëlarëse', 'pastrim', 'pastrues', 'cleaner'],
  // Split out of `cleaning` 2026-09-17 — see categoryFamily.js. A fabric
  // softener is not a surface cleaner and must not be answered with one.
  'fabric-softener': ['zbutës', 'zbutes', 'omekshivac', 'softener'],
  // Split out of `cleaning` 2026-09-17 — see categoryFamily.js. Compound
  // phrases only: a bare 'detergjent' does not say what it cleans.
  'surface-cleaner': [
    'i xhamave', 'të xhamave', 'te xhamave', 'për xhama', 'per xhama', 'xhamash',
    'për pllaka', 'per pllaka', 'për dysheme', 'per dysheme',
    'për enë', 'per ene', 'enëlarëse', 'enelarese',
    'glass cleaner', 'floor cleaner', 'parquet cleaner', 'laminate cleaner',
    'surface cleaner', 'toilet cleaner', 'pastrues sipërfaqesh', 'pastrues siperfaqesh',
  ],
  // Cleaning TOOLS, not cleaning liquids — see categoryFamily.js.
  'cleaning-tools': ['shpuz', 'sfungjer', 'fshesë', 'fshese', 'leckë', 'lecke'],
  // Split out of `cheese` 2026-09-17 — see categoryFamily.js. The word has
  // to be here as well as there: every tofu row is titled "Tofu Djath Soye
  // …", so without it the title says CHEESE ('djath') and the exact gate
  // went on offering soy tofu for a tub of curd. One term only: 'tofu' is
  // unambiguous, and searching for tofu when the scan IS tofu is the right
  // behaviour, not a stretch.
  tofu: ['tofu'],
  'personal-care': ['shampo', 'sapun', 'pastë dhëmb', 'dush', 'deodorant'],
  // BIN BAGS AND FREEZER BAGS (added 2026-09-16) — the owner's bag.
  //
  // Only COMPOUND phrases and the unambiguous rubbish words. A bare 'qese'
  // (bag) is deliberately absent: "ULLINJE TE GJELBERT NE QESE COOP 170GR"
  // is a jar of olives sold in a bag, and a bare stem would have made
  // headFamilyOf() call it a bin liner — the same class of accident as
  // 'vaj' inside "vajza". Measured: these phrases reach all 26 rows in the
  // catalogue that carry isLocalBrand === true and are actually bags.
  'household-bags': [
    'qese per mbeturina', 'qese mbeturinash', 'qese plehrash',
    'thase per mbeturina', 'thase mbeturinash', 'thase mbuturinash',
    'thas mbeturinash', 'garbage bag', 'bin bag', 'trash bag',
    'qese frizi', 'qese per friz', 'qese per ngrirje',
    'mbeturinash', 'plehrash',
  ],
  // PAPER GOODS, split out of `personal-care` 2026-09-17 — see
  // categoryFamily.js. Both have real proven-local stock (Bora, Vela,
  // Bona, Panda), so these stems are what reaches it. Compound phrases
  // only: a bare 'leter' is Albanian for paper and is in baking
  // parchment, wet wipes and writing pads alike.
  'toilet-paper': ['letër toaleti', 'leter toaleti', 'letër tualeti', 'leter tualeti', 'toilet paper'],
  'kitchen-towel': ['letër kuzhine', 'leter kuzhine', 'kitchen towel', 'kitchen paper'],
  // SCHOOL AND STATIONERY, added 2026-09-17 — see categoryFamily.js for
  // the row counts and for the 'canta' near-miss that was refused. Each
  // stem occurs in exactly one catalogue word. None of the three has any
  // proven-local stock, so these will not produce an answer today; they
  // are here because leadFamilyOf()/titleFamiliesOf() read THIS list, and
  // without them the 43 school-aisle rows on /alternativa cannot even be
  // named. `supplements` and `tofu` below are the same idea.
  'school-bags': ['cante', 'çante', 'çantë', 'school bag', 'backpack'],
  'pencil-cases': ['fotrolle', 'pencil case'],
  'vacuum-flasks': ['termos', 'thermos'],
  'soups-ready-meals': ['supë', 'supe', 'supa'],
  'dried-fruits': ['rrush i thatë', 'rrush i thate', 'fruta të thata'],
  // `supplements` has NO terms on purpose. Knowing a product is a protein
  // shake is worth having (it stops it being scored "family undetermined"),
  // but the Kosovo grocery catalogue has no supplement shelf to answer it
  // from, and inventing one is how a biscuit gets offered for an oil.
  //
  // Present as an EMPTY LIST rather than simply absent (2026-09-17), so
  // "deliberately has no search stems" and "somebody forgot this family"
  // stop looking identical. src/test/taxonomy.test.js asserts that this
  // object and categoryFamily.js's FAMILY_RULES name exactly the same set
  // of families — the two have now drifted apart four times ('biskot',
  // 'vaj', 'keçap', 'kripos'), every time producing a real wrong answer,
  // and that test is worth more than any single family in either file.
  supplements: [],
};

/**
 * Every family this file knows search stems for — including the ones whose
 * list is deliberately empty. Exported for the taxonomy sync test.
 */
export const FAMILY_TERM_IDS = new Set(Object.keys(FAMILY_TERMS));

// THE SHELF A FAMILY BELONGS ON (added 2026-09-16).
//
// The food/non-food side check below is too coarse. Measured on the eval
// corpus, these got through it:
//
//   scanned a Serbian MUSTARD (sauces-condiments)
//     -> "Senfter Speck 100Gr", a cured ham. The stem 'senf' starts the
//        word "Senfter", and cured ham is on the food side, so nothing
//        stopped it.
//   scanned PEANUT BUTTER (oils-fats)
//     -> "Kikirik Pa Vaj 110Gr" — Albanian for peanuts *without oil*. The
//        stem 'vaj' matched inside a negation.
//
// The retail catalogue already knows what shelf each row sits on
// (retailCategories.canonicalCategory), so a family that disagrees with a
// SPECIFIC shelf is vetoed. `Ushqime`, `Konserva` and `Të tjera` are the
// catalogue's own catch-alls — they carry no information, so they never
// veto anything; only a shelf that positively says something else does.
const FAMILY_SHELVES = {
  'cooking-oil': ['Vaj & yndyrna'],
  butter: ['Vaj & yndyrna', 'Bylmet'],
  'nut-butter': ['Snack', 'Ëmbëlsira'],
  'chocolate-spread': ['Ëmbëlsira'],
  crisps: ['Snack'],
  'savoury-snacks': ['Snack'],
  biscuits: ['Ëmbëlsira'],
  wafers: ['Ëmbëlsira'],
  'cakes-pastry': ['Ëmbëlsira'],
  chocolate: ['Ëmbëlsira'],
  candy: ['Ëmbëlsira'],
  'ice-cream': ['Ëmbëlsira'],
  juices: ['Pije'],
  'soft-drinks': ['Pije'],
  'energy-drinks': ['Pije'],
  waters: ['Pije'],
  beers: ['Pije'],
  wine: ['Pije'],
  spirits: ['Pije'],
  coffee: ['Pije'],
  tea: ['Pije'],
  milk: ['Bylmet'],
  yogurt: ['Bylmet'],
  cream: ['Bylmet'],
  'milk-pudding': ['Bylmet', 'Ëmbëlsira'],
  cheese: ['Bylmet'],
  flour: ['Miell & brumë'],
  pasta: ['Miell & brumë'],
  rice: ['Miell & brumë'],
  bread: ['Bukë', 'Miell & brumë'],
  'breakfast-cereals': ['Miell & brumë'],
  charcuterie: ['Mish'],
  'meat-fresh': ['Mish'],
  'fish-seafood': ['Peshk'],
  eggs: ['Vezë'],
  'fresh-fruit': ['Pemë & perime'],
  'fresh-vegetables': ['Pemë & perime'],
  jams: ['Salca & erëza'],
  honey: ['Salca & erëza'],
  'ketchup-tomato-sauces': ['Salca & erëza'],
  'ajvar-pickles': ['Salca & erëza'],
  'mayonnaise-dressings': ['Salca & erëza'],
  mustard: ['Salca & erëza'],
  vinegar: ['Salca & erëza'],
  salt: ['Salca & erëza'],
  'spices-seasonings': ['Salca & erëza'],
  'baby-food': ['Ushqim për bebe'],
  'nuts-seeds': ['Snack'],
  legumes: ['Pemë & perime'],
  'dried-fruits': ['Snack', 'Pemë & perime'],
  // The household shelves all three of these sit on in the real catalogue.
  // Measured 2026-09-16 over the 31,975 loaded rows: proven-local non-food
  // stock is Higjienë 111, Shtëpi 60, Pastrim 37 — and bin bags are filed
  // across all three by different retailers, so pinning cleaning to
  // 'Pastrim' alone was vetoing real answers.
  cleaning: ['Pastrim', 'Shtëpi'],
  'fabric-softener': ['Pastrim', 'Shtëpi'],
  'surface-cleaner': ['Pastrim', 'Shtëpi', 'Higjienë'],
  'cleaning-tools': ['Pastrim', 'Shtëpi'],
  'personal-care': ['Higjienë', 'Shtëpi'],
  'household-bags': ['Pastrim', 'Shtëpi', 'Higjienë'],
  // Measured over the loaded rows: the proven-local toilet roll and
  // kitchen towel sit under Higjienë, Shtëpi and Pastrim depending on the
  // retailer, exactly like the bags above — pinning either to one shelf
  // would veto real answers.
  'toilet-paper': ['Higjienë', 'Shtëpi', 'Pastrim'],
  'kitchen-towel': ['Higjienë', 'Shtëpi', 'Pastrim'],
  // The school aisle has NO canonical shelf: every row of it is filed
  // under the retailer's own untranslated "LIBRARI", which
  // canonicalCategory cannot place, so the shelf check treats it as no
  // information rather than as evidence against. Left out deliberately —
  // an invented expectation here would veto the only rows there are.
};

/** Shelf labels that are catch-alls and therefore never evidence against a match. */
const UNINFORMATIVE_SHELVES = new Set(['Ushqime', 'Konserva', 'Të tjera']);

/**
 * Every label `canonicalCategory()` can PRODUCE. Anything else it returns is
 * the retailer's own untranslated wording, kept verbatim because the map
 * could not place it (see retailCategories.js#placeCategory).
 *
 * WHY THIS MATTERS (added 2026-09-16). Kosovo's bin bags are filed under
 * "Garbage Bags", "THAS MBETURINASH", "Qese Plehrash" and "Aksesore
 * Kuzhine" — four raw strings, none of them in the canonical map. The shelf
 * check below compared those verbatim strings against FAMILY_SHELVES and
 * vetoed every one, so a bag family could never be answered even once it
 * existed. An unmapped retailer string is not evidence AGAINST a family; it
 * is no evidence at all, exactly like the catch-alls above.
 *
 * This can only ever loosen the NON-FOOD side: placeCategory puts every
 * unplaced label on the RIGHT, and a food family is already blocked from
 * right-side rows by the side gate in findShelfAlternatives.
 */
const CANONICAL_SHELVES = new Set([
  'Pije', 'Peshk', 'Mish', 'Bylmet', 'Miell & brumë', 'Bukë', 'Pemë & perime',
  'Vezë', 'Vaj & yndyrna', 'Ëmbëlsira', 'Snack', 'Salca & erëza', 'Konserva',
  'Ushqime', 'Ushqim për bebe', 'Higjienë', 'Pastrim', 'Kozmetikë', 'Shtëpi',
  'Të tjera',
]);

/** False when the candidate's own shelf positively contradicts the family. */
function shelfAgreesWithFamily(family, rawCategory) {
  const expected = FAMILY_SHELVES[family];
  if (!expected) return true; // no expectation recorded — do not invent one
  const { label } = canonicalCategory(rawCategory);
  if (UNINFORMATIVE_SHELVES.has(label)) return true;
  if (!CANONICAL_SHELVES.has(label)) return true; // unmapped retailer wording — no information
  return expected.includes(label);
}

// ---------------------------------------------------------------------------
// THE HEAD NOUN DECIDES WHAT A PRODUCT IS (added 2026-09-16).
//
// After the family split, scanning "Puter od kikirikija" (peanut butter,
// family `nut-butter`) returned "Biskota Gjalpe Kikiriku 150G" — a BISCUIT
// with a peanut-butter filling. The stem matched, the shelf agreed, and a
// shopper would not accept the swap. Same shape as the owner's 2026-09-14
// complaint: "you keep recommending ... waffles as a biscuit alternative".
//
// Albanian retail titles lead with the head noun: "Biskota Gjalpë Kikiriku"
// is a biscuit, "Happy Swing gjalpë kikiriku" is peanut butter. So: find the
// EARLIEST family stem in the title (longest wins a tie) and treat that
// family as what the product actually is. If it disagrees with the family
// being searched for, the candidate is out.
//
// A title in which no stem appears at all says nothing and is not vetoed —
// the shelf label already vouched for it.
// ---------------------------------------------------------------------------
const HEAD_TERMS = Object.entries(FAMILY_TERMS)
  .flatMap(([family, terms]) => terms.map((term) => ({ family, term: term.trim() })))
  .filter((t) => t.term.length >= 3);

// STEMS THAT ARE THE START OF A DIFFERENT WORD (added 2026-09-16).
//
// Requiring a stem to BEGIN a word kills "vaj" inside "vajza" only if the
// stem is checked at the left edge AND the right. It was only checked on the
// left, so the very collision the code comments warn about was still live:
//
//   "Gete për vajza"        (leggings)     -> cooking-oil   ("vajza" = girls)
//   "Lodër set bukurie"     (beauty toy)   -> bread         ("bukuri" = beauty)
//   "Butterfly All Cotton"  (sanitary pads)-> butter        (a brand name)
//
// All three were found by the lie detector in scripts/eval-alternatives.mjs.
// A blanket "the stem must be a whole word" rule is not available: 'biskot',
// 'djath', 'buk', 'mjalt' and 'çokollat' are deliberately stems of inflected
// Albanian words. So the traps are named, one per measured collision.
// Each entry below was produced by listing, for every stem, the catalogue
// words it is a prefix of (8,283 distinct words over 31,975 rows) and
// keeping the ones that are a DIFFERENT kind of product. The row counts are
// from that sweep, so none of these is hypothetical.
const STEM_TRAPS = new Map([
  ['vaj', /^vajz/], // vajza / vajzave — girls
  ['buk', /^bukur/], // bukuri / bukurie — beauty (3 rows)
  ['butter', /^butterfl/], // Butterfly, a hygiene brand (7 rows)
  ['caj', /^cajnik/], // çajnik — a teapot, not tea
  ['water', /^watermelo/], // watermelon — a fruit, not water (144 rows)
  ['supe', /^super/], // superior / superaktiv — not soup (61 rows)
  ['leng', /^lengsh/], // i lëngshëm = liquid, as in liquid detergent (20 rows)
  ['torte', /^tortell/], // tortellini — pasta, not cake (8 rows)
  ['krip', /^kripos/], // të kriposur = salted snacks, not salt (6 rows)
  ['nektar', /^nektarin/], // nektarina — a nectarine (7 rows)
  ['arra', /^arrab/], // arrabbiata — a pasta sauce, not nuts (13 rows)
  ['cheese', /^cheesecake/], // a cake (3 rows)
  ['cola', /^colazione/], // Italian for breakfast (3 rows)
  ['kosi', /^kosil/], // Kosili, a brand — not kos/yogurt (24 rows)
  // 'milka' added 2026-09-17, measured, not anticipated. Milka is a
  // chocolate/biscuit brand, and it leads the title of every row it is on,
  // so leadFamilyOf() — which trusts the FIRST word of an Albanian retail
  // title as the head noun — called `Milka Biskote Çoko Jaffa Portokall
  // 147G` MILK. resolveAlternativesForRetailProduct then answered that pack
  // of biscuits with six cartons of UHT milk (Qumesht Vita, Drena, Vidas…),
  // and the eval harness scored it same-family because both sides agreed on
  // the wrong answer. This is the owner's "dont recommend milk for X" class
  // reappearing through a misclassification rather than through a loose
  // match. 8 catalogue rows carry the word.
  ['milk', /^milk(yway|a)/], // MilkyWay and Milka — both chocolate, not milk
  ['fanta', /^fantast/], // "Fantastic", not the drink
  ['bread', /^breadstick/], // a savoury snack
]);

/**
 * Index of the first place `term` begins a word in `hay`, or -1.
 * Both ends are checked: the left so the stem starts a word, the right
 * against STEM_TRAPS so it is not the head of a different word.
 */
function termHitIndex(hay, term) {
  const trap = STEM_TRAPS.get(term);
  let at = hay.indexOf(term);
  while (at !== -1) {
    if (!/[a-z0-9]/.test(hay[at - 1] || ' ')) {
      if (!trap) return at;
      // Take the rest of the word and ask whether it is the trapped one.
      const rest = hay.slice(at).match(/^[a-z0-9]+/)?.[0] || term;
      if (!trap.test(rest)) return at;
    }
    at = hay.indexOf(term, at + 1);
  }
  return -1;
}

function headFamilyAt(name, mustLeadTitle) {
  const hay = ` ${normalise(name)} `;
  let best = null;
  for (const { family, term } of HEAD_TERMS) {
    const t = normalise(term);
    const at = termHitIndex(hay, t);
    if (at === -1) continue;
    if (mustLeadTitle && at !== 1) continue; // index 1 == start of the title (hay is space-padded)
    if (best === null || at < best.at || (at === best.at && t.length > best.len)) {
      best = { family, at, len: t.length };
    }
  }
  return best ? best.family : null;
}

export function headFamilyOf(name) {
  return headFamilyAt(name, false);
}

/**
 * THE FAMILY A TITLE *LEADS* WITH (added 2026-09-16).
 *
 * headFamilyOf() answers "does this title mention something of family X?",
 * which is the right question when VETOING a candidate the shelf already
 * vouched for. It is the wrong question when the title is the ONLY evidence
 * of what a product is, because a mention is not a head noun:
 *
 *   "Aparat per Kafe"   is a coffee MACHINE, not coffee
 *   "Set Gota Çaji"     is tea GLASSES, not tea
 *   "Tepsi për muffins" is a muffin TIN, not a muffin
 *
 * Albanian retail titles lead with the head noun — the premise the HEAD_TERMS
 * block above already rests on — so when the title has to carry the whole
 * judgement, the stem must be the first word of it. "Qese për mbeturina",
 * "Djath kaçkavall kg" and "Miell 5kg" all still place; the three above stop
 * pretending to be groceries.
 */
export function leadFamilyOf(name) {
  return headFamilyAt(name, true);
}

/**
 * EVERY family a product TITLE mentions — the title-side ambiguity detector.
 *
 * `headFamilyOf` returns the earliest mention and `leadFamilyOf` the one
 * that begins the title. Both answer with a single family, which is what a
 * shelf search needs. /alternativa needs the opposite question: is this
 * title unambiguous at all? Measured on rows the resolver really returns:
 *
 *   "Vipa Ketchup Chips 30g"  -> {ketchup-tomato-sauces, crisps}
 *   "Grata Qumesht Kafe 1L"   -> {milk, coffee}
 *   "BYLMETI JOGURT 3,2%"     -> {yogurt}                 (single — usable)
 *
 * The first two are real products, and each is genuinely one thing — but
 * their titles do not say which, and src/lib/exactMatch.js will not offer a
 * swap it cannot name. See freeTextFamiliesOf() in categoryFamily.js for
 * the category-side twin.
 *
 * @param {string|null} name
 * @returns {Set<string>}
 */
export function titleFamiliesOf(name) {
  const hay = ` ${normalise(name)} `;
  const found = new Set();
  for (const { family, term } of HEAD_TERMS) {
    if (found.has(family)) continue;
    if (termHitIndex(hay, normalise(term)) !== -1) found.add(family);
  }
  return found;
}

/** False when the title's own head noun says this is a different kind of thing. */
function headNounAgrees(family, name) {
  const head = headFamilyOf(name);
  if (!head) return true; // nothing claimed — the shelf label already vouched
  return head === family;
}

// Families that describe something you eat or drink. A food family must
// never match a non-food shelf.
export const FOOD_FAMILIES = new Set([
  'cooking-oil','butter','nut-butter','chocolate-spread','crisps','savoury-snacks','biscuits','wafers',
  'cakes-pastry','chocolate','candy','ice-cream','juices','soft-drinks','energy-drinks',
  'waters','beers','wine','spirits','coffee','tea','milk','yogurt','cream','milk-pudding',
  'cheese','flour','pasta','rice','bread','breakfast-cereals','charcuterie','meat-fresh',
  'fish-seafood','eggs','fresh-fruit','fresh-vegetables','jams','honey',
  'ketchup-tomato-sauces','ajvar-pickles','mayonnaise-dressings','mustard','vinegar',
  'salt','spices-seasonings','baby-food','nuts-seeds','legumes','soups-ready-meals',
  'dried-fruits','tofu',
]);

/**
 * Whole-word-ish match.
 *
 * A raw `includes()` on a short Albanian stem is dangerous: "vaj" (oil) is
 * inside "VAJZA" (girls), which is how a sunflower-oil scan came back with
 * MAR-MAR school notebooks from the LIBRARI shelf. Requiring the term to
 * begin a word kills that whole class of accident.
 */
function matchesTerm(haystack, term) {
  // Shares termHitIndex with headFamilyOf, so the STEM_TRAPS above apply to
  // the SEARCH as well as to the veto: a 'vaj' search can no longer reach a
  // row whose only "match" is the word "vajza".
  return termHitIndex(String(haystack || ''), term) !== -1;
}

// A product's OWN most-specific tag beats its family when choosing search
// terms. `en:ketchup` and `en:ajvar` share the sauces-condiments family, so
// a family-only lookup answered a ketchup scan with ajvar simply because
// 'ajvar' happened to be first in the family's term list.
const TAG_TERMS = {
  'en:ketchup': ['ketchup', 'keçap', 'kecap'],
  'en:ajvar': ['ajvar'],
  'en:mayonnaises': ['majonez'],
  'en:mustards': ['senf', 'mustard'],
  'en:vinegars': ['uthull'],
  'en:sunflower-oils': ['vaj luledielli', 'vaj'],
  'en:olive-oils': ['vaj ulliri', 'olive'],
  'en:honeys': ['mjalt'],
  'en:jams': ['reçel', 'marmelat'],
  'en:yogurts': ['jogurt', 'kos'],
  'en:milks': ['qumësht', 'qumesht'],
  'en:cheeses': ['djath', 'kaçkavall'],
  'en:butters': ['gjalp'],
  'en:coffees': ['kafe'],
  'en:teas': ['çaj', 'caj'],
  'en:beers': ['birr'],
  'en:waters': ['ujë', 'uje'],
  'en:fruit-juices': ['lëng', 'leng', 'nektar'],
  'en:biscuits': ['biskot', 'keks'],
  'en:crisps': ['çips', 'cips', 'chips'],
  'en:chocolates': ['çokollat', 'cokollat'],
  'en:flours': ['miell'],
  'en:pastas': ['makarona', 'pasta'],
  'en:rices': ['oriz'],
  'en:breads': ['buk'],
  'en:eggs': ['vezë', 'veze'],
};

/** Terms from the most specific tag the product actually carries. */
function termsFromTags(categoriesTags) {
  const tags = Array.isArray(categoriesTags) ? [...categoriesTags].reverse() : [];
  for (const tag of tags) {
    const hit = TAG_TERMS[String(tag || '').toLowerCase()];
    if (hit) return hit;
  }
  return null;
}

function normalise(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[çc]/g, 'c')
    .replace(/[ëe]/g, 'e')
    .trim();
}

// ---------------------------------------------------------------------------
// RENDERABLE IDENTITY (added 2026-09-16)
//
// THE MEASUREMENT. data/kosovo-retail.json fills `brand` on 7.0% of rows and
// `name` on 100%. Over the eval corpus, 281 of 567 returned alternatives
// (49.6%) came back with `brand: null` — which is what the harness's sample
// column rendered as "-> , , " and what made the shelf and local-brands
// tiers look like they were emitting empty cards.
//
// WHAT IS AND IS NOT TRUE. Zero of those 281 had an empty `name`, and
// AlternativesGrid renders `item.name` as the card heading for a
// product-level item, so the app was showing the product title with no brand
// subtitle — not a blank card. The harness was under-reporting; that is
// fixed in scripts/eval-alternatives.mjs, which now prints the identity a
// shopper actually sees.
//
// WHAT IS STILL WORTH FIXING, and is fixed here:
//   1. Recover the brand where the evidence is already in the dataset. The
//      catalogue supplies 141 distinct brand strings on the rows that do
//      carry one; when exactly one of those appears as whole words inside an
//      untitled row's name, that is a derivation, not a guess. Two matches
//      is ambiguous and yields null — the same discipline
//      scripts/harvest-retail.mjs already applies as
//      `brandSource: "derived-from-title"`.
//   2. Refuse outright to emit a candidate with NO renderable identity at
//      all (no brand, no derivable brand, no name). A suppressed row is
//      better than a blank row. Today that case is 0 rows; the guard exists
//      so a future harvest cannot reintroduce it silently.
// ---------------------------------------------------------------------------

const VOCAB_CACHE = new WeakMap();

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Distinct brand strings the catalogue itself supplies, longest first. */
function brandVocabulary(pool) {
  if (!Array.isArray(pool) || pool.length === 0) return [];
  const cached = VOCAB_CACHE.get(pool);
  if (cached) return cached;
  const byKey = new Map();
  for (const p of pool) {
    const raw = String(p?.brand || '').trim();
    if (raw.length < 3) continue; // a one- or two-letter token is not evidence
    const key = raw.toLowerCase();
    if (!byKey.has(key)) byKey.set(key, raw);
  }
  const vocab = [...byKey.entries()]
    .map(([key, brand]) => ({ key, brand, re: new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(key)}([^\\p{L}\\p{N}]|$)`, 'u') }))
    .sort((a, b) => b.key.length - a.key.length);
  VOCAB_CACHE.set(pool, vocab);
  return vocab;
}

/** Exactly one catalogue brand appearing as whole words in the title, or null. */
function brandFromTitle(name, pool) {
  const hay = String(name || '').toLowerCase();
  if (hay.length < 3) return null;
  let found = null;
  for (const v of brandVocabulary(pool)) {
    if (!v.re.test(hay)) continue;
    if (found && found.key !== v.key) {
      // Longest-first means a longer brand containing a shorter one (e.g.
      // "coca cola" vs "cola") is seen first; anything genuinely different
      // after that is real ambiguity, so we decline rather than guess.
      if (!found.key.includes(v.key)) return null;
      continue;
    }
    found = found || v;
  }
  return found ? found.brand : null;
}

/**
 * ONE CARD PER PRODUCT (added 2026-09-16).
 *
 * The catalogue holds the same SKU once per store: "Kikirik Pa Vaj 110Gr"
 * appears under molla-express, super-viva and big-market with the same
 * barcode and three different row ids. Measured on the eval corpus, 32 of
 * the 41 shelf answers handed the shopper the same product two or three
 * times inside one six-card grid — e.g. peanut butter answered with
 * ["kikirik pa vaj", "kikirik pa vaj", "kikirik pa vaj", "vaj santeoil",
 * "vaj santeoil", "vaj fellini"]: six cards, three products.
 *
 * Keyed on the title a shopper reads (and the barcode when there is one),
 * because the row id differs per store by construction.
 */
export function dedupeKeyFor(row) {
  const bc = String(row?.barcode || '').replace(/\D/g, '');
  if (bc.length >= 8) return `gtin:${bc}`;
  const name = normalise(row?.name)
    .replace(/\(\s*\d+\s*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return name ? `name:${name}` : `id:${row?.id || ''}`;
}

/** Keeps the first occurrence of each distinct product, order preserved. */
function dedupeProducts(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = item.__dedupeKey || dedupeKeyFor(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/**
 * What this row can honestly be shown as.
 * @returns {{brand: string|null, brandSource: string|null, name: string|null}|null}
 *   null means the row has nothing renderable and must not be offered.
 */
export function retailIdentity(row, pool) {
  const name = String(row?.name || '').trim() || null;
  const own = String(row?.brand || '').trim();
  if (own) return { brand: own, brandSource: row?.brandSource || 'catalog', name };
  const derived = name ? brandFromTitle(name, pool) : null;
  if (derived) return { brand: derived, brandSource: 'derived-from-title', name };
  if (name) return { brand: null, brandSource: null, name };
  return null;
}

/**
 * Is this catalogue row safe to offer as an alternative?
 * It must not be Serbian-issued, Serbian-owned, or the same brand as the
 * product being replaced.
 */
function isSafeCandidate(candidate, { gs1, boycott, excludeBrand }) {
  if (excludeBrand && isSameBrand(candidate.brand, excludeBrand)) return false;

  const code = candidate.barcode || candidate.code || null;
  if (code) {
    const verdict = classifyBarcode(code, gs1)?.verdict;
    if (verdict === VERDICT.SERBIAN) return false;
    if (findBoycottByCode(code, boycott)) return false;
  }
  if (candidate.brand && findBoycottByBrand(candidate.brand, boycott)) return false;
  return true;
}

/**
 * Find alternatives on the Kosovo shelf for a scanned product.
 *
 * @param {object} opts
 * @param {string[]} opts.categoriesTags  scanned product's OFF tags
 * @param {string|null} opts.categoryText free-text category, when there are no tags
 * @param {string|null} opts.brand        scanned brand, excluded from results
 * @param {string|null} opts.name         scanned product's own title, used to
 *   place it when it carries no usable category at all
 * @param {object} opts.data              loaded dataset
 * @param {number} [opts.limit]
 * @param {(row: object) => boolean} [opts.accept] extra per-row filter
 * @returns {{items: Array, source: string, family: string|null}}
 */
export function findShelfAlternatives({ categoriesTags, categoryText, brand, name = null, data, limit = 6, accept = null }) {
  // THE TITLE IS EVIDENCE WHEN THERE IS NO CATEGORY (added 2026-09-16).
  //
  // 226 of the 31,975 loaded catalogue rows carry `category: null` — among
  // them "Qese për mbeturina", the owner's bag. With no tags and no
  // free-text shelf there was nothing to place them by, so they resolved to
  // no family and got no answer, while 26 proven-local bags sat in the same
  // file. The product's own title says what it is, and headFamilyOf() is
  // the same head-noun reading the lane already trusts to VETO candidates —
  // so it is trustworthy enough to place the scanned item too.
  const family = categoryFamilyOf(categoriesTags) || categoryFamilyOf(categoryText) || leadFamilyOf(name);
  // Specific tag first, family second — then the family terms as a widening
  // fallback so a narrow tag with no shelf match still finds its neighbours.
  const specific = termsFromTags(categoriesTags);
  const familyTerms = family ? FAMILY_TERMS[family] || [] : [];
  const terms = specific ? [...specific, ...familyTerms.filter((t) => !specific.includes(t))] : familyTerms;

  // No family means we cannot tell what kind of product this is, and a
  // guess here is exactly how an oil gets answered with a biscuit.
  if (terms.length === 0) return { items: [], source: 'none', family };

  const pool = data?.kosovoRetail?.products || [];
  const normalisedTerms = terms.map(normalise);

  const scored = [];
  for (const p of pool) {
    if (accept && !accept(p)) continue;
    const nameHay = normalise(`${p.name || ''} ${p.brand || ''}`);
    const hay = `${nameHay} ${normalise(p.category)}`;
    // Which term matched matters: FAMILY_TERMS is ordered most-specific
    // first, so an "ajvar" hit must outrank a generic "salc" hit when the
    // scanned product is itself an ajvar. Without this the shelf lane
    // answered a Serbian ajvar with ketchup.
    const termRank = normalisedTerms.findIndex((term) => matchesTerm(hay, term));
    if (termRank === -1) continue;
    // A hit in the product's own NAME beats a hit in the shelf label. The
    // catalogue files marmalade under "Salca", so an ajvar scan was being
    // answered with jam purely because the shelf name matched.
    const nameHit = normalisedTerms.some((term) => matchesTerm(nameHay, term)) ? 0 : 1;
    // Structural guard: a food family may only be answered from a food
    // shelf. This is what stops "vaj" reaching the LIBRARI (stationery)
    // aisle even when a word there happens to start with those letters.
    if (FOOD_FAMILIES.has(family) && canonicalCategory(p.category).side !== 'left') continue;
    if (!FOOD_FAMILIES.has(family) && canonicalCategory(p.category).side === 'left') continue;
    // ... and the finer shelf check: a mustard is not answered with cured
    // ham just because both are food. See FAMILY_SHELVES above.
    if (!shelfAgreesWithFamily(family, p.category)) continue;
    // ... and the title's own head noun: "Biskota Gjalpë Kikiriku" is a
    // biscuit, not peanut butter. See HEAD_TERMS above.
    if (!headNounAgrees(family, p.name)) continue;
    if (!isSafeCandidate(p, { gs1: data?.gs1, boycott: data?.boycott, excludeBrand: brand })) continue;
    // A candidate a shopper cannot read is not an answer. See the
    // RENDERABLE IDENTITY block above.
    const identity = retailIdentity(p, pool);
    if (!identity) continue;
    // A brand recovered from the title can turn out to be the scanned brand
    // itself — re-run the exclusion on the resolved identity, not the raw
    // (usually empty) field.
    if (brand && identity.brand && isSameBrand(identity.brand, brand)) continue;

    scored.push({
      isBrandLevel: false,
      code: p.barcode || p.id,
      name: identity.name,
      brand: identity.brand,
      brandSource: identity.brandSource,
      company: null,
      image: p.image || null,
      // `isLocalBrand === true` is the ONLY thing that earns the "vendore"
      // label. Everything else is honestly "on the shelf in Kosovo".
      country: p.isLocalBrand === true ? 'kosovo' : null,
      confidence: p.isLocalBrand === true ? 'local-brand' : 'shelf',
      pairingEvidence: p.isLocalBrand === true ? 'catalog' : 'shelf',
      // ONE UNAMBIGUOUS FLAG FOR THE UI (added 2026-09-16).
      // AlternativesGrid does `kosovo = isKosovoCountry(item.country)` and
      // then renders the ALBANIAN flag and "Shqiptar" for everything else —
      // so a shelf row with country: null (an import that merely sits on a
      // Kosovo shelf, e.g. Nestlé cornflakes) is badged as an Albanian
      // alternative. `country: null` was always meant to read "we are not
      // claiming this is local"; this makes that unmissable rather than
      // something a falsy check can invert.
      isLocalClaim: p.isLocalBrand === true,
      price: p.price ?? null,
      currency: p.currency ?? null,
      source: p.source || null,
      sourceLabel: p.sourceLabel || null,
      url: p.url || null,
      matchedTag: family,
      termRank,
      nameHit,
      live: true,
      __dedupeKey: dedupeKeyFor(p),
    });
  }

  // Verified local brands first, then cheapest — a shopper wants the local
  // one, and failing that the cheap one.
  scored.sort((a, b) => {
    // 1. matched in the product's own name, 2. A VERIFIED LOCAL BRAND,
    // 3. the closest kind of product, 4. cheapest.
    //
    // Local moved ahead of termRank on 2026-09-16. Every candidate here has
    // already passed the family gate, the shelf check and the head-noun
    // check, so they are all the same kind of thing; ordering an import
    // ahead of a Kosovar product because its term sat one slot earlier in
    // the family's stem list is backwards for an app whose entire purpose
    // is finding the local one. Measured: it moves real local products into
    // the six cards a shopper actually sees.
    if (a.nameHit !== b.nameHit) return a.nameHit - b.nameHit;
    const aLocal = a.confidence === 'local-brand' ? 0 : 1;
    const bLocal = b.confidence === 'local-brand' ? 0 : 1;
    if (aLocal !== bLocal) return aLocal - bLocal;
    if (a.termRank !== b.termRank) return a.termRank - b.termRank;
    const ap = typeof a.price === 'number' ? a.price : Infinity;
    const bp = typeof b.price === 'number' ? b.price : Infinity;
    return ap - bp;
  });

  // One card per product: the same SKU is in the catalogue once per store.
  const unique = dedupeProducts(scored).map(({ __dedupeKey, ...item }) => item);
  return { items: unique.slice(0, limit), source: unique.length > 0 ? 'shelf' : 'none', family };
}

/**
 * A cascade that returns the strongest answer it can, and NOTHING when it
 * has none.
 *
 * Owner, 2026-09-12: "everything must be alternative findable NO
 * EXCEPTION!!!"
 *
 * That sits in real tension with the other standing rule — "if its
 * sunflower seed oil you must not show a kosovar cookie" — and the way to
 * honour both is to be exact about WHAT each tier is claiming. Each tier is
 * weaker than the one above it and says so:
 *
 *   1. family      — same product family. A real replacement.
 *   2. name-tokens — shares a meaningful word with the scanned product
 *                    (catches families the tag map has no rule for).
 *   3. category    — same free-text shelf as the scanned item.
 *
 * TIER 4 WAS DELETED 2026-09-18 AND IS NOT COMING BACK. See the comment at
 * the bottom of this function for the measurement that killed it: it was
 * input-independent — the same six cheapest proven-local rows for every
 * scan that reached it — so it carried no information about the product in
 * the shopper's hand, and no UI wording can fix a constant.
 *
 * NOTE, MEASURED 2026-09-18: tiers 2 and 3 are currently UNREACHABLE from
 * the app. Both call sites in resolveAlternatives.js (lines 114 and 142)
 * pass `name: null, categoryText: null`, so `meaningfulTokens(null)` is
 * empty and `categoryText` is falsy. They are kept because they are
 * input-dependent and honest in principle, and they come alive the moment a
 * caller threads the scanned product's name through — which is a change to
 * resolveAlternatives' signature and to App.jsx, i.e. another lane.
 */
const STOPWORDS = new Set([
  'me','dhe','per','për','nga','the','and','for','with','gr','kg','ml','cl','ltr','l','g','x','pak','copë','cope','i','e','te','të','ne','në',
]);

function meaningfulTokens(text) {
  return normalise(text)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
}

export function findAnyAlternative({ categoriesTags, categoryText, brand, name, data, limit = 6 }) {
  // Tier 1 — same family.
  const byFamily = findShelfAlternatives({ categoriesTags, categoryText, brand, name, data, limit });
  if (byFamily.items.length > 0) return { ...byFamily, tier: 'family' };

  // TIERS 2-4 ONLY FIRE WHEN THE FAMILY IS GENUINELY UNKNOWN (gate added
  // 2026-09-16). Reported from the live app: scanning a German "Food
  // Supplement" (/b/4001234567890) returned "Faculeta Xhepi Rose" — pocket
  // tissues. The shelf tier had correctly declined (`supplements` has no
  // search stems, because no Kosovo grocery shelf sells supplements), and
  // this tier then handed over the cheapest Kosovar-branded thing in the
  // catalogue, which happened to be paper hankies. The tier's own docstring
  // says it is for when no category could be established — but it was being
  // reached whenever the FAMILY-SPECIFIC search came back empty, which is a
  // completely different situation and one where we DO know the answer:
  // there is no local alternative.
  //
  // Owner: "if none say there is none that is local" —
  // and the hard rules: saying "no local alternative found" is a CORRECT
  // answer. So a known family with nothing in it returns nothing, and tiers
  // 2 (name tokens) and 3 (free-text shelf) are skipped too: they are
  // deliberately loose and exist only for families the map cannot place.
  const scannedFamily = byFamily.family;
  if (scannedFamily) {
    return { items: [], source: 'none', family: scannedFamily, tier: 'none-in-family' };
  }


  const pool = data?.kosovoRetail?.products || [];
  const guard = { gs1: data?.gs1, boycott: data?.boycott, excludeBrand: brand };

  // Same renderable-identity rule as the family tier: derive the brand from
  // the title where the catalogue's own vocabulary supports it, and never
  // emit a row with nothing on it. `shape` is only ever called on rows that
  // passed `hasIdentity`.
  const hasIdentity = (p) => retailIdentity(p, pool) !== null;
  const shape = (p, tier) => {
    const identity = retailIdentity(p, pool);
    return {
    isBrandLevel: false,
    code: p.barcode || p.id,
    name: identity?.name ?? p.name,
    brand: identity?.brand ?? null,
    brandSource: identity?.brandSource ?? null,
    company: null,
    image: p.image || null,
    country: p.isLocalBrand === true ? 'kosovo' : null,
    confidence: p.isLocalBrand === true ? 'local-brand' : tier,
    pairingEvidence: p.isLocalBrand === true ? 'catalog' : tier,
    isLocalClaim: p.isLocalBrand === true,
    price: p.price ?? null,
    currency: p.currency ?? null,
    source: p.source || null,
    sourceLabel: p.sourceLabel || null,
    url: p.url || null,
    matchedTag: null,
    live: true,
    __dedupeKey: dedupeKeyFor(p),
    };
  };

  const finish = (items) => dedupeProducts(items).map(({ __dedupeKey, ...item }) => item);

  const cheapestFirst = (a, b) => {
    const aLocal = a.confidence === 'local-brand' ? 0 : 1;
    const bLocal = b.confidence === 'local-brand' ? 0 : 1;
    if (aLocal !== bLocal) return aLocal - bLocal;
    return (typeof a.price === 'number' ? a.price : Infinity) - (typeof b.price === 'number' ? b.price : Infinity);
  };

  // Tier 2 — shares a real WORD with the scanned product's name.
  //
  // "a real word" is literal, and it was not before (fixed 2026-09-18).
  // This was `hay.includes(tk)` — a raw substring test — and the tier is
  // currently unreachable (see the note on this function), so the harness
  // could never see what it did. Probed directly:
  //
  //   findAnyAlternative({ name: 'Pesto alla Genovese', ... })
  //     -> Sallam Viqi Dinamika 300Gr | Sallame Viqi Koral 250Gr | ...
  //
  // Salami for pesto, because the token "alla" is a substring of "sallam".
  // Exactly the "something adjacent because we have nothing precise"
  // failure that tier 4 was deleted for, waiting behind an unused door.
  // Matching whole words kills it while leaving the real hits intact
  // ('Moj prvi flips' -> Vipa/Skoki Flips; 'Štapići punjeni kikirikem' ->
  // Pardon Shtapiq Kikirik).
  const tokens = meaningfulTokens(name);
  if (tokens.length > 0) {
    const hits = pool
      .filter((p) => {
        const words = new Set(normalise(`${p.name || ''} ${p.category || ''}`).split(/[^a-z0-9]+/));
        return tokens.some((tk) => words.has(tk));
      })
      .filter((p) => isSafeCandidate(p, guard))
      .filter(hasIdentity)
      .map((p) => shape(p, 'name-match'))
      .sort(cheapestFirst);
    const unique = finish(hits);
    if (unique.length > 0) return { items: unique.slice(0, limit), source: 'shelf', family: null, tier: 'name' };
  }

  // Tier 3 — same free-text shelf.
  if (categoryText) {
    const target = normalise(categoryText);
    const hits = pool
      .filter((p) => normalise(p.category) === target)
      .filter((p) => isSafeCandidate(p, guard))
      .filter(hasIdentity)
      .map((p) => shape(p, 'category-match'))
      .sort(cheapestFirst);
    const unique = finish(hits);
    if (unique.length > 0) return { items: unique.slice(0, limit), source: 'shelf', family: null, tier: 'category' };
  }

  // ===================================================================
  // TIER 4 — DELETED 2026-09-18. THE LAST DISHONEST LANE.
  //
  // What stood here: "nothing about the category could be established, so
  // show verified Kosovar brands, explicitly NOT as a replacement for this
  // product. The tier name is carried through so the UI can say exactly
  // that."
  //
  // Both halves of that defence were false, and both were measured before
  // the code was removed:
  //
  // 1. THE OUTPUT DID NOT DEPEND ON THE INPUT. The tier filtered the whole
  //    catalogue to `isLocalBrand === true`, sorted by price, and took the
  //    first six. The scan was never consulted. So all 39 scans that
  //    reached it across the eval corpus (Set A 2, Set B 17, Set D 20) got
  //    the byte-identical six cards:
  //
  //      Faculeta Xhepi Rose | Vipa Flips Grill 16Gr | Vipa Flips Ketchup
  //      16Gr | Vipa Flips Pizza 16Gr | Skoki Flips 22Gr | Vipa Flips
  //      Sticks 20Gr
  //
  //    Pocket tissues and corn puffs, offered for Pesto alla Genovese, an
  //    avocado, Argeta pâté, Vegeta seasoning, ajvar, chewing gum and a
  //    beer. AISLE TEST (house rule 8): 0 of 39 pass. This is
  //    the SAME defect as "Food Supplement -> Faculeta Xhepi Rose" that was
  //    fixed on 2026-09-16 one gate higher up — the same row, even.
  //
  // 2. THE UI NEVER SAID IT WAS NOT A MATCH. `grep -rn "local-brands"
  //    src/components` returns nothing: no component reads
  //    `alternatives.source` at all (App.jsx stores it, nobody renders it).
  //    Worse, `shape()` sets `isLocalClaim: true` on these rows, so
  //    AlternativesGrid gave them the green Kosovar `vendore` badge under
  //    the same heading as a documented brand pairing.
  //
  // "A gap is an honest answer" — house rule: 'saying "no local
  // alternative found" is a CORRECT answer'. It costs 39 answers across the
  // corpus and buys back the last place where the app showed a shopper
  // something adjacent because it had nothing precise.
  //
  // This is NOT a lie by the harness's own lie detector, and that is not a
  // coincidence: every scan that reached this tier has `family === null`
  // (the gate above returns early for any known family), so there is no
  // category in which proven-local stock could be sitting unoffered. The
  // lie detector scores all 39 `unplaceable`. TOTAL LIES stays 0.
  // ===================================================================
  return { items: [], source: 'none', family: null, tier: 'no-family' };
}
