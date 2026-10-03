// A LOCAL ALTERNATIVE SHOWN RIGHT NEXT TO THE SERBIAN PRODUCT.
//
// Owner, 2026-09-14: "for every serb product show to the side directly a
// vendorja product that is local no going inside needed" and "straight
// alternative for everything".
//
// Everywhere else in the app, resolving an alternative is async (it can reach
// Open Food Facts and the shelf lane). That is right for a scan and wrong for
// a catalogue list: 40 rows cannot each fire a network request, and the answer
// has to be on screen at the same instant the row is. So this is the
// SYNCHRONOUS, local-data-only slice of the same resolution.
//
// MEASURED, and why there are two lanes. With the brand lane alone, only
// **4 of 347** flagged catalogue rows got an alternative. Two reasons, both
// visible in the data:
//   · Most retail rows have no `brand` at all — the harvest often carries only
//     a name ("(no brand) | Patatina", 9 rows; "(no brand) | Chips", 8; and so
//     on). A brand-keyed lookup can never answer those.
//   · Where there IS a brand it is often the wrong product: 47 rows are
//     `Jaffa | Pije` — Jaffa Champion soft drinks — while the curated Jaffa
//     entry is biscuits. The category gate correctly refuses to answer a drink
//     with a biscuit, so the row got nothing.
// Hence lane 2: infer the product FAMILY from the row's own Albanian category
// and name, and answer from a curated entry in that same family.
//
// WHAT THIS DOES NOT DO. It never falls back to the shelf lane
// (kosovo-retail rows that are merely "on sale in Kosovo"): those come back
// with blank brand names, which is useless in a 200px strip, and it is the
// weaker claim. And it never crosses families — a Serbian oil is answered
// with an oil or with nothing.

import { pickEntryForScan } from './brandAlternatives.js';
import { categoryFamilyOf, categoryFamiliesOf } from './categoryFamily.js';

// Albanian/English shelf words -> product family. The retail catalogue is
// written by four different retailers in mixed language and case, so this
// matches STEMS, not whole labels ("Patatina", "Qipsa", "Corn Chips" and
// "Chips" all have to land on crisps).
//
// Order matters: the first family whose stem appears wins, so the narrow
// ones come first (birrë before pije, kafe before pije).
const FAMILY_STEMS = [
  ['beers', ['birr', 'beer', 'pivo']],
  ['wines-spirits', ['verë', 'vere', 'raki', 'wine', 'vodka', 'whisky', 'liker']],
  ['coffee-tea', ['kafe', 'coffee', 'çaj', 'caj', ' tea', 'nescafe']],
  ['waters', ['ujë', 'uje', 'water', 'voda']],
  ['juices-soft-drinks', ['lëng', 'leng', 'juice', 'nektar', 'gazuar', 'cola', 'ice tea', 'energy', 'pije', 'drink']],
  ['milk-yogurt', ['qumësht', 'qumesht', 'jogurt', 'yogurt', 'kos ', 'ajran', 'dhallë', 'dhalle', 'milk', 'bylmet', 'ajkë', 'ajke']],
  ['cheese', ['djath', 'kaçkavall', 'kackavall', 'cheese', 'gjizë', 'gjize']],
  ['meat-charcuterie', ['mish', 'sallam', 'suxhuk', 'proshut', 'pershut', 'virshll', 'pate', 'meat', 'salami']],
  ['fish-seafood', ['peshk', 'tun', 'sardel', 'fish', 'tuna']],
  ['eggs', ['vezë', 'veze', 'egg']],
  ['oils-fats', ['vaj', 'yndyrn', 'margarin', 'gjalp', ' oil', 'olive']],
  ['flour-pasta-rice', ['miell', 'makarona', 'oriz', 'pasta', 'flour', 'spageta', 'brum']],
  ['bread', ['bukë', 'buke', 'bread', 'toast', 'simit', 'furra']],
  ['crisps-savoury-snacks', ['çips', 'cips', 'chips', 'patatina', 'qipsa', 'flips', 'krisp', 'sticks', 'popcorn', 'kokoshka', 'snack', 'njelmët', 'njelmet', 'kripur']],
  ['biscuits-sweet-bakery', ['biskot', 'keks', 'napolitan', 'vafer', 'wafer', 'torte', 'tortin', 'kek', 'biscuit', 'cracker']],
  ['chocolate-confectionery', ['çokollat', 'cokollat', 'qokollad', 'bonbon', 'karamel', 'chocolate', 'candy', 'praline', 'gumm', 'ëmbël', 'embel', 'ëmbla', 'embla', 'sweet']],
  ['sauces-condiments', ['salc', 'ketchup', 'keçap', 'kecap', 'majonez', 'senf', 'mustard', 'uthull', 'ajvar', 'turshi']],
  ['preserves-jams-honey', ['reçel', 'recel', 'mjalt', 'marmelat', 'jam', 'honey']],
  ['spices-seasonings', ['erëza', 'ereza', 'krip', 'piper', 'spice', 'salt']],
  ['breakfast-cereals', ['cornflakes', 'muesli', 'drithëra', 'cereal']],
  ['cleaning', ['detergjent', 'pastrim', 'deterxhent', 'zbardhues', 'clean', 'laundry']],
  ['personal-care', ['shampo', 'sapun', 'higjien', 'higjen', 'hixhien', 'kozmetik', 'pastë dhëmb', 'soap', 'shower']],
];

// PRODUCT KIND -> the SPECIFIC OFF tags that mean that exact thing.
//
// Owner, 2026-09-14: "you keep recommending cheese as a milk alternative,
// waffles as a biscuit alternative this is absolutely horrendous".
//
// He is right, and family matching is why. categoryFamily.js deliberately
// groups coarsely so the SCAN gate can never cross aisles -- but its groups
// are too coarse to choose WITHIN an aisle: `milk-yogurt` holds milk, yogurt,
// kefir, cream and sour cream; `biscuits-sweet-bakery` holds biscuits,
// wafers, crackers and cakes. Picking "the first entry in the family" is how
// a carton of milk got answered with a tub of cheese.
//
// So before falling back to the family, resolve the row to a KIND and look
// for a curated entry carrying that kind's own tag. Milk is answered with
// milk, a biscuit with a biscuit, and if no curated entry sells that exact
// kind the row shows NOTHING rather than something adjacent.
const KIND_TAGS = [
  ['milk', ['en:milks', 'en:uht-milks'], ['qumesht', 'qum\u00ebsht', 'milk', 'mleko']],
  ['yogurt', ['en:yogurts'], ['jogurt', 'yogurt', 'kos ', 'kosi']],
  ['cream', ['en:sour-creams', 'en:creams'], ['ajk\u00eb', 'ajke', 'pavlak', 'kajmak', 'smetana']],
  ['cheese', ['en:cheeses'], ['djath', 'ka\u00e7kavall', 'kackavall', 'cheese', 'gjiz', 'sir ']],
  ['butter', ['en:butters'], ['gjalp', 'butter', 'maslac']],
  ['biscuit', ['en:biscuits'], ['biskot', 'keks', 'biscuit', 'cookie', 'petit']],
  ['wafer', ['en:wafers'], ['vafer', 'wafer', 'napolitan']],
  ['cake', ['en:cakes'], ['torte', 'tortin', 'cake', 'muffin']],
  ['chocolate', ['en:chocolates'], ['\u00e7okollat', 'cokollat', 'qokollad', 'chocolate']],
  ['chocolate-spread', ['en:chocolate-spreads'], ['eurokrem', 'cocoa cream', 'cokokrem', '\u00e7okokrem', 'krem kakao']],
  ['candy', ['en:candies', 'en:bonbons'], ['bonbon', 'karamel', 'candy', 'gumm', 'praline']],
  ['crisps', ['en:crisps', 'en:potato-crisps'], ['\u00e7ips', 'cips', 'chips', 'patatina', 'qipsa']],
  ['flips', ['en:corn-chips'], ['flips', 'smoki', 'sticks', 'stix']],
  ['popcorn', ['en:popcorn'], ['popcorn', 'kokoshka']],
  ['juice', ['en:fruit-juices', 'en:fruit-nectars'], ['l\u00ebng', 'leng', 'juice', 'nektar']],
  ['soft-drink', ['en:sodas', 'en:soft-drinks'], ['gazuar', 'cola', 'fanta', 'sprite', 'ice tea', 'schweppes']],
  ['energy-drink', ['en:energy-drinks'], ['energy', 'energji', 'red bull', 'guarana']],
  ['water', ['en:waters', 'en:mineral-waters'], ['uj\u00eb', 'uje', 'water', 'voda']],
  ['beer', ['en:beers'], ['birr', 'beer', 'pivo']],
  ['coffee', ['en:coffees', 'en:ground-coffees'], ['kafe', 'coffee', 'nescafe', 'espresso']],
  ['tea', ['en:teas', 'en:herbal-teas'], ['\u00e7aj', 'caj ', ' tea']],
  ['oil', ['en:sunflower-oils', 'en:vegetable-oils', 'en:olive-oils'], ['vaj', ' oil', 'ulje', 'olive']],
  ['flour', ['en:flours', 'en:wheat-flours'], ['miell', 'flour', 'brashno']],
  ['pasta', ['en:pastas', 'en:dry-pastas'], ['makarona', 'pasta', 'spageta', 'fide', 'testenin']],
  ['rice', ['en:rices'], ['oriz', 'rice']],
  ['bread', ['en:breads'], ['buk\u00eb', 'buke', 'bread', 'toast', 'simit']],
  ['sausage', ['en:sausages', 'en:salami', 'en:cured-sausages'], ['sallam', 'suxhuk', 'virshll', 'salami', 'kobasic', 'proshut']],
  ['ketchup', ['en:ketchup'], ['ke\u00e7ap', 'kecap', 'ketchup']],
  ['mayonnaise', ['en:mayonnaises'], ['majonez', 'mayonn']],
  ['ajvar', ['en:ajvar', 'en:pickles'], ['ajvar', 'turshi', 'pinxhur']],
  ['jam', ['en:jams', 'en:compotes'], ['re\u00e7el', 'recel', 'marmelat', 'jam ']],
  ['honey', ['en:honeys'], ['mjalt', 'honey']],
  ['salt', ['en:salts'], ['krip', 'salt']],
  ['spice', ['en:spices', 'en:spice-blends'], ['er\u00ebza', 'ereza', 'piper', 'spice', 'spec i kuq']],
  ['egg', ['en:eggs'], ['vez\u00eb', 'veze', 'egg']],
  ['detergent', ['en:laundry-detergents'], ['detergjent', 'deterxhent', 'zbardhues', 'laundry']],
  ['soap', ['en:soaps', 'en:shower-gels'], ['sapun', 'soap', 'shampo', 'shower']],
  ['toilet-paper', ['en:toilet-papers'], ['let\u00ebr higjien', 'leter higjien', 'toilet paper']],
];

/**
 * The exact kind of thing this row is, or null.
 *
 * CATEGORY FIRST, NAME SECOND -- and the order is the whole point.
 * Measured bug: "Chipsy Domacinski Kajmak 60Gr" is a bag of CRISPS whose
 * flavour happens to be kajmak, so matching the name first classified it as
 * cream and offered a carton of Vita milk against it. Product names are full
 * of flavour words that name other foods ("qumesht", "kajmak", "mjalt",
 * "limon"); the shelf category is what the retailer actually filed it under.
 *
 * So: try the category alone. Only if the category places nothing -- many
 * rows carry a useless label like "USHQIMORE" -- fall back to the name.
 */
function kindForRetailRow(product, boycottCategory) {
  const category = String(product?.category || '').toLowerCase();
  // The boycott record knows what the BRAND sells ("chips-snacks" for
  // Chipsy). That beats the product name, which is where flavour words live:
  // "Chipsy Domacinski Kajmak" is a bag of crisps, and reading its name first
  // classified it as cream and offered a carton of milk.
  const fromBrand = String(boycottCategory || '').toLowerCase().replace(/-/g, ' ');
  const name = String(product?.name || '').toLowerCase();
  for (const hay of [category, fromBrand, name]) {
    if (!hay) continue;
    for (const [kind, tags, stems] of KIND_TAGS) {
      for (const stem of stems) {
        if (hay.includes(stem)) return { kind, tags };
      }
    }
  }
  return null;
}

/** First curated entry carrying one of these exact tags. */
function entryForTags(tags, entries) {
  const want = new Set(tags);
  return (
    entries.find(
      (e) => e.alternatives?.length > 0 && (e.offCategoryTags || []).some((t) => want.has(t))
    ) || null
  );
}

/** Family for a retail row, from its own category + name. */
function familyForRetailRow(product) {
  const hay = `${product?.category || ''} ${product?.name || ''}`.toLowerCase();
  for (const [family, stems] of FAMILY_STEMS) {
    for (const stem of stems) {
      if (hay.includes(stem)) return family;
    }
  }
  // Last resort: the shared OFF-taxonomy placer, which understands English
  // category words the table above may not list.
  return categoryFamilyOf(product?.category) || null;
}

/** First curated entry in a given family that actually has alternatives. */
function entryForFamily(family, entries) {
  if (!family) return null;
  return (
    entries.find(
      (e) => e.alternatives?.length > 0 && categoryFamiliesOf(e.offCategoryTags).has(family)
    ) || null
  );
}

/**
 * @param {object} product a row from kosovo-retail.json (brand, name, category…)
 * @param {object} data    the loaded app data ({ brandAlternatives, … })
 * @returns {{brand,company,image,country,evidence,via}|null}
 */
export function inlineAlternativeFor(product, data, boycottCategory = null) {
  const entries = data?.brandAlternatives?.entries;
  if (!entries?.length || !product) return null;

  // LANE 1 — the documented brand pairing, the strongest answer. Uses the
  // row's free-text Albanian category as the hint, which is what stops a
  // Štark chocolate being answered with a Štark crisp.
  let entry = product.brand
    ? pickEntryForScan(product.brand, [], entries, product.category || null)
    : null;
  let via = entry ? 'brand' : null;

  // LANE 2 — the EXACT KIND. Milk is answered with milk, a biscuit with a
  // biscuit. This is the lane that stops "cheese as a milk alternative".
  const kind = kindForRetailRow(product, boycottCategory);
  if (!entry && kind) {
    entry = entryForTags(kind.tags, entries);
    via = entry ? `kind:${kind.kind}` : null;
  }

  // LANE 3 — the coarse family, ONLY when the kind is unknown (an unlabelled
  // row in a broad aisle). Never used to override a known kind: if we know it
  // is milk and no curated entry sells milk, the honest answer is nothing.
  if (!entry && !kind) {
    entry = entryForFamily(familyForRetailRow(product), entries);
    via = entry ? 'family' : null;
  }

  const alt = entry?.alternatives?.[0];
  if (!alt) return null;

  return {
    brand: alt.brand,
    company: alt.company || null,
    image: alt.image || null,
    country: alt.country || null,
    evidence: alt.evidence || null,
    via,
  };
}
