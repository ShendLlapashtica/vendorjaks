// Canonical Albanian shelf categories for the Explore page.
//
// The harvested catalogue carries 102 distinct `category` strings across
// four retailers, in mixed case and mixed language, with the same shelf
// spelled several ways. Owner, 2026-09-12: "pije jo alkoolike pije are same
// one label both as pije" — so `Pije`, `PIJE JO ALKOOLIKE` and `QAJ/KAFE`
// were all showing as separate headings for what a shopper reads as drinks.
//
// This maps every raw label onto one canonical Albanian category, and puts
// each canonical category on a shelf SIDE:
//   left  = esenciale, the things you need to live — peshk, mish, miell,
//           bukë, suxhuk, pemë, perime, bylmet, vezë, vaj (owner's list).
//   right = hygiene, cosmetics, household, and everything non-food.
//
// A label we cannot place keeps its own name and goes RIGHT, because
// asserting that an unknown thing is food would be a guess.

const RULES = [
  // --- LEFT: essentials -------------------------------------------------
  // `^pije` (not `^pije$`) so "Pije të gazuara" and "PIJE JO ALKOOLIKE"
  // land on the same shelf as plain "Pije" — the owner's point exactly.
  ['Pije', 'left', [/^pije/i, /pije jo alkoolike/i, /pije alkoolike/i, /qaj.?kafe/i, /^qaj/i, /kafe/i, /lengje|leng /i, /gazuar/i, /uje|ujë/i, /birr/i, /verë|vere/i]],
  ['Peshk', 'left', [/peshk/i, /deti/i, /tuna|sardin/i]],
  ['Mish', 'left', [/mish/i, /sallam/i, /suxhuk/i, /pate/i, /shpeze|shpezë/i, /virshll|virshl/i, /proshut/i, /pershut/i]],
  ['Bylmet', 'left', [/bylmet/i, /qumësht|qumesht/i, /djath/i, /jogurt|kos\b/i]],
  ['Miell & brumë', 'left', [/miell/i, /brumi|brumit/i, /makarona|pasta/i, /oriz/i]],
  ['Bukë', 'left', [/^buk/i, /buke|bukë/i, /furra/i]],
  ['Pemë & perime', 'left', [/pemet|pemë|peme/i, /perime/i, /frut/i, /patate/i, /ullinj/i, /sallat/i]],
  ['Vezë', 'left', [/vez[ëe]/i]],
  ['Vaj & yndyrna', 'left', [/vaj/i, /yndyrn/i, /margarin/i]],
  // "QOKOLLADAT" is spelled with a d in the catalogue — match the stem.
  ['Ëmbëlsira', 'left', [/[ëe]mb[ëe]lsir/i, /biskota/i, /qokoll|çokoll|cokoll/i, /torte|tortin/i, /puding/i, /akullore/i, /wafer|vafer/i, /bonbon/i]],
  ['Snack', 'left', [/snack/i, /çips|cips|chips/i, /kikirik|arra/i]],
  ['Salca & erëza', 'left', [/sal[cç]/i, /^sos/i, /ketchup|keçap|kecap/i, /majonez/i, /senf|mustard/i, /uthull/i, /ajvar/i, /er[ëe]za/i, /krip[ëe]/i]],
  ['Konserva', 'left', [/konzerv|konserv/i, /tegllarin/i, /ngrira/i, /marmelat|re[çc]el/i]],
  ['Ushqime', 'left', [/ushqime/i, /esenciale/i, /vegan/i, /pa gluten/i, /erëza|ereza|spec/i, /mjalt/i, /reçel|recel/i]],
  ['Ushqim për bebe', 'left', [/beb[ei]/i, /infant/i]],
  // Remaining food shelves the retailers spell their own way.
  ['Ushqime', 'left', [/turshi/i, /pekmez/i, /krepa/i, /tortilla/i, /panxhar/i, /g[ëe]shtenj/i, /k[ëe]purdh/i, /sup[ëe]/i, /melmes/i, /bakery/i, /delikates/i, /freskt|fresket/i, /protein/i, /bazike/i]],

  // --- English + brand-as-category labels -------------------------------
  // The Wolt harvest is partly English and sometimes files a BRAND as a
  // category ("Milka", "Kinder", "Redbull", "Haribo"). Left unmapped each
  // became its own filter chip, so "Alcoholic Drinks", "ALCOHOLIC DRINKS",
  // "Alkool", "Alkohol", "Spirits", "Wine", "Vera" and "Beer" were eight
  // separate filters for one shelf. Matching is case-insensitive
  // throughout, so only the stems are listed here.
  ['Pije', 'left', [/alcohol/i, /alkool|alkohol/i, /spirit/i, /^wine/i, /^vera$/i, /^ver[ëe]$/i, /^beer/i, /juice/i, /^water$/i, /soft drink/i, /coca ?cola|fanta|redbull|red bull/i, /^tea$/i, /çaj i ftoht|caj i ftoht|ice ?tea/i, /nes ?& ?cafe|^coffe/i]],
  ['Ëmbëlsira', 'left', [/chocolate/i, /^cakes?$/i, /praline/i, /candy|gum[’']?s|gummy|jelly|mint[’']?s/i, /milka|kinder|nutella/i, /^kek$/i, /desert|dessert/i, /^embela$/i, /t[ëe] [ëe]mbla/i, /keksa?$/i, /biscuit|crackers?|crakers?|bruschette/i, /preparate p[ëe]r tort/i, /^krem(ore)?$/i]],
  ['Snack', 'left', [/nuts/i, /qipsa/i, /t[ëe] kripura/i, /noodles/i, /tadim/i]],
  ['Miell & brumë', 'left', [/cereals?/i, /brum[ëe]ra/i, /home cook/i, /instant/i]],
  ['Bukë', 'left', [/croissants?/i]],
  ['Bylmet', 'left', [/kashkavall/i]],
  ['Salca & erëza', 'left', [/melm[ëe]sa/i]],
  ['Ushqime', 'left', [/dietale/i, /produkte?t? baz/i, /programi i ngrir/i, /^produktet$/i]],

  ['Higjienë', 'right', [/deodorant/i, /wipes|paper towel/i, /hair ?& ?body|kujdes per floke|kujdes p[ëe]r flok/i, /pelena/i, /kujdes personal/i, /^her$/i, /^unisex$/i]],
  ['Pastrim', 'right', [/dishwash/i, /glass ?& ?floor/i, /detergjent/i]],
  ['Duhan & vape', 'right', [/snus/i, /shisha/i, /geekbar|maxpod|velo|elfbar/i]],
  ['Teknikë', 'right', [/phone accessor/i]],

  // --- Spellings the 2026-09-12 harvest added ----------------------------
  // The catalogue grew from 2,442 to ~19,600 rows and from ~100 to 619 raw
  // category strings. 334 of them fell through to "keep the retailer's own
  // wording", which put 10,300 products behind their own one-off filter
  // chip. These are the biggest of those, mapped onto the shelves that
  // already exist rather than inventing new ones.
  ['Ushqime', 'left', [/ushqimore/i, /ushqim i bluar/i, /shporta baz/i, /t[ëe] fresk[ëe]ta/i, /frigorifer/i, /t[ëe] ngrira/i, /bazike/i, /^food$/i, /grocer/i]],
  ['Ëmbëlsira', 'left', [/produkte t[ëe] [ëe]mbla/i, /njëmëlta|njemelta|njelmeta/i, /programi i [ëe]mb[ëe]l/i, /haribo/i, /orbit/i, /karamel/i, /d[ëe]shir[ëe]/i, /sweet/i]],
  ['Snack', 'left', [/patatina/i, /programi i kriposur/i, /krisp/i, /pop ?corn/i, /salty/i]],
  ['Bukë', 'left', [/kroasant/i, /pasticeri|pastiçeri/i, /simit/i]],
  ['Pije', 'left', [/alkolike|alkoolike/i, /^drinks?$/i, /l[ëe]ngje/i, /energji|energy/i, /soda/i]],

  // --- RIGHT: hygiene, household, non-food ------------------------------
  ['Higjienë', 'right', [/higjena|higjiena|higjene/i, /kujdesi personal/i, /^care$/i]],
  ['Duhan & vape', 'right', [/vape/i, /duhan/i, /cigare/i, /tobacco/i]],
  ['Auto', 'right', [/auto ?& ?aksesor/i, /^auto/i, /veturë|vetur[ea]/i]],
  ['Bar & kafiteri', 'right', [/^bars?$/i, /kafiteri/i]],

  ['Higjienë', 'right', [/higjien|hixhien/i, /trupore/i, /shampo|sapun/i, /pasta dhëmb|dhemb/i, /letra/i]],
  ['Kozmetikë', 'right', [/kozmetik/i, /parfum/i, /meshkuj/i, /femra/i, /mire mbajtje|mirë mbajtje|mirmbajtje/i]],
  ['Pastrim', 'right', [/deterxhent|deterdzhent/i, /pastrim/i, /amviser/i, /larje/i]],
  ['Librari', 'right', [/librari/i, /shkolla|zyre/i]],
  ['Teknikë', 'right', [/teknik/i, /elektro/i, /pajisje/i]],
  ['Shtëpi', 'right', [/shtepi|shtëpi/i, /kuzhin/i, /enë|ene\b/i]],
];

/**
 * @param {string|null} raw the catalogue's own category string
 * @returns {{label: string, side: 'left'|'right'}}
 */
export function canonicalCategory(raw) {
  const placed = placeCategory(raw);
  return FOLD_INTO_OTHER.has(placed.label) ? { label: 'Të tjera', side: 'right' } : placed;
}

function placeCategory(raw) {
  const value = String(raw || '').trim();
  if (!value) return { label: 'Të tjera', side: 'right' };

  for (const [label, side, patterns] of RULES) {
    for (const re of patterns) {
      if (re.test(value)) return { label, side };
    }
  }
  // Promotional/merchandising labels are not product categories. Folding
  // them into one bucket stops each becoming its own filter chip.
  if (/^(new|të reja|te reja|promo|aksion|ofert[ëe]|sale|top|popular|në fokus|ne fokus|të rekomanduara|te rekomanduara)$/i.test(value)) {
    return { label: 'Të tjera', side: 'right' };
  }

  // Unplaced: keep the retailer's own wording, but do not claim it is food.
  return { label: value, side: 'right' };
}

/**
 * Non-grocery shelf furniture that folds into one "Të tjera" chip.
 * Owner, 2026-09-13: "make less filter clades".
 *
 * Folded on the LABEL, not the raw string — a first attempt tested the raw
 * retailer wording and missed every label that the RULES above had already
 * produced, so Duhan & vape, Teknikë, Librari, Auto and Bar & kafiteri all
 * survived as their own chips.
 *
 * Higjienë, Pastrim, Kozmetikë and Shtëpi are NOT folded: they are real
 * household shelves a shopper does filter by. This only removes stationery,
 * car and phone accessories, the cafe counter and tobacco.
 */
const FOLD_INTO_OTHER = new Set(['Librari', 'Auto', 'Teknikë', 'Bar & kafiteri', 'Duhan & vape', 'Other', 'Fini', 'Produktet e sola']);

/**
 * Sort order for the filter chips and the shelf headings.
 *
 * Owner, 2026-09-13: "te gjitha ushqimi (primary foods goods at start not
 * detergents)". Sorting purely by product count put Higjienë fifth and
 * Duhan & vape ninth — above Bylmet, Mish, Bukë and Vaj. This is a grocery
 * app: the staples come first, then the rest of the food, then everything
 * that is not food.
 */
const PRIMARY_ORDER = [
  'Bylmet',
  'Mish',
  'Peshk',
  'Bukë',
  'Pemë & perime',
  'Vezë',
  'Miell & brumë',
  'Vaj & yndyrna',
  'Pije',
  'Ushqime',
  'Salca & erëza',
  'Konserva',
  'Ëmbëlsira',
  'Snack',
  'Ushqim për bebe',
];

/** Lower sorts first. Primary foods, then other food, then non-food. */
export function categoryRank(label, side) {
  const i = PRIMARY_ORDER.indexOf(label);
  if (i !== -1) return i;
  if (side === 'left') return 100;
  if (label === 'Të tjera') return 900;
  return 500;
}

/** Stable key for de-duplicating catalogue rows. */
/** One normaliser for BOTH halves of the key. The old code folded the name
 *  and left the brand raw, which is most of why duplicates survived. */
function normKeyPart(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function productDedupeKey(p) {
  if (p?.barcode) return `b:${String(p.barcode).replace(/\D/g, '')}`;
  // BRAND IS NORMALISED THE SAME WAY AS THE NAME.
  // Owner, 2026-09-17: "10 times same product try to remove dupes".
  // Measured: one Coca-Cola 2L produced FIVE different keys —
  //   n:coca cola 2l|coca cola   (brand written with a space)
  //   n:coca cola 2l|coca-cola   (brand written with a hyphen)
  //   n:coca cola 2l|            (brand null, as it is on 93% of rows)
  //   b:5449000000286            (one GTIN)
  //   b:5000112562200            (a second GTIN for the same drink)
  // The name was lower-cased and stripped of punctuation; the brand was
  // only lower-cased and trimmed. So "Coca Cola" and "Coca-Cola" were two
  // products, and a row with no brand was a third.
  return `n:${normKeyPart(p?.name)}|${normKeyPart(p?.brand)}`;
}

/**
 * De-duplicates a catalogue, keeping the CHEAPEST row for each product.
 *
 * The same item appears across several retailers (and sometimes twice
 * within one), so the list was showing repeats at different prices. Owner,
 * 2026-09-12: "REMOVE DUPES, show cheapest". Where a duplicate is kept, the
 * retailers it was also found at are recorded on `alsoAt` so the cheaper
 * listing does not silently erase the others.
 */
export function dedupeCheapest(products) {
  const byKey = new Map();
  for (const p of products || []) {
    const key = productDedupeKey(p);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...p, alsoAt: [] });
      continue;
    }
    const price = typeof p.price === 'number' ? p.price : Infinity;
    const kept = typeof existing.price === 'number' ? existing.price : Infinity;
    if (price < kept) {
      const alsoAt = [...new Set([...(existing.alsoAt || []), existing.sourceLabel || existing.source].filter(Boolean))];
      byKey.set(key, { ...p, alsoAt });
    } else {
      const label = p.sourceLabel || p.source;
      if (label && !existing.alsoAt.includes(label)) existing.alsoAt.push(label);
    }
  }
  return collapseSameProduct([...byKey.values()]);
}

/**
 * SECOND PASS — merge rows that are the same product under different keys.
 *
 * Owner, 2026-09-17: "10 times same product try to remove dupes".
 * Normalising the brand (see productDedupeKey) only recovered 27 rows,
 * because the remaining splits are not spelling:
 *   · `brand` is NULL on 93% of retail rows, so an unbranded listing of
 *     "Coca Cola 2l" keyed separately from a branded one;
 *   · one product legitimately carries TWO different GTINs across
 *     retailers (5449000000286 and 5000112562200 are both Coca-Cola 2L),
 *     and a barcode key can never merge those.
 *
 * THE GUARD IS THE WHOLE POINT. Rows merge only when the normalised name
 * is identical AND at most ONE distinct non-empty brand appears in the
 * group. So an unbranded row folds into its branded twin, and two GTINs
 * for one drink collapse — but "Jogurt 500g" from two different producers
 * never merges, because the brands disagree. The name carries the size in
 * this catalogue ("coca cola 2l"), so a 2L never merges with a 1.25L.
 * Anything refused is left exactly as it was; a visible duplicate is a
 * cosmetic fault, while merging two different products is a wrong answer.
 */
export function collapseSameProduct(rows, { report = null } = {}) {
  const groups = new Map();
  for (const row of rows || []) {
    const name = normKeyPart(row?.name);
    if (!name) continue;
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(row);
  }

  const out = [];
  let merged = 0;
  let refused = 0;
  for (const [, group] of groups) {
    if (group.length === 1) {
      out.push(group[0]);
      continue;
    }
    const brands = new Set(group.map((r) => normKeyPart(r.brand)).filter(Boolean));
    if (brands.size > 1) {
      // Two real, different producers share a product name. Keep both.
      refused += group.length;
      out.push(...group);
      continue;
    }
    // One product. Keep the cheapest row, and carry every shop it was seen
    // in onto it so "also at" stays truthful rather than being discarded.
    const cheapest = group.reduce((a, b) => {
      const pa = typeof a.price === 'number' ? a.price : Infinity;
      const pb = typeof b.price === 'number' ? b.price : Infinity;
      return pb < pa ? b : a;
    });
    const alsoAt = [
      ...new Set(
        group
          .flatMap((r) => [...(r.alsoAt || []), r.sourceLabel || r.source])
          .filter(Boolean)
          .filter((l) => l !== (cheapest.sourceLabel || cheapest.source))
      ),
    ];
    // Prefer a row that actually has a barcode and a brand for the identity,
    // even when a cheaper listing has neither — the evidence matters more
    // than which shop was cheapest.
    const withCode = group.find((r) => r.barcode) || cheapest;
    const withBrand = group.find((r) => r.brand) || cheapest;
    // isLocalBrand IS MERGED CONSERVATIVELY, NEVER OPTIMISTICALLY.
    // Measured before this existed: 24 groups disagree, including
    //   "coca cola zero 1.25l" -> true / false
    //   "fanta orange 1.25l"   -> true / false
    // Taking the cheapest row's value would have inherited `true` and
    // badged COCA-COLA AS VENDORE — the exact class of false local claim
    // that had to be fixed for Velo and Jaffa today. So: `true` survives
    // only if every row that has an opinion says true; a single `false`
    // wins; otherwise it degrades to null, which renders as "not proven".
    const opinions = group.map((r) => r.isLocalBrand).filter((v) => v === true || v === false);
    const isLocalBrand = opinions.length === 0 ? null : opinions.every((v) => v === true) ? true : false;
    // And the evidence string must follow the value it justifies, or a row
    // would carry "GS1 prefix 390 (Kosovo)" next to isLocalBrand: false.
    const evidenceSource =
      isLocalBrand === null
        ? null
        : group.find((r) => r.isLocalBrand === isLocalBrand && r.localEvidence) || null;

    // CATEGORY: prefer the most specific shelf, not the cheapest row's.
    // 834 groups disagree — the same cheese is "bylmet" at one retailer and
    // the catch-all "të freskëta" at another. Taking the cheapest row's
    // category can strand a product on a shelf that resolves to no family,
    // which would silently shrink /alternativa's exact matches. Longest
    // label is a crude but measurable proxy for specificity, and it never
    // invents a category the data does not hold.
    const category =
      group
        .map((r) => r.category)
        .filter(Boolean)
        .sort((a, b) => String(b).length - String(a).length)[0] || cheapest.category || null;

    out.push({
      ...cheapest,
      barcode: cheapest.barcode || withCode.barcode || null,
      brand: cheapest.brand || withBrand.brand || null,
      image: cheapest.image || group.find((r) => r.image)?.image || null,
      quantity: cheapest.quantity || group.find((r) => r.quantity)?.quantity || null,
      category,
      isLocalBrand,
      localEvidence: evidenceSource ? evidenceSource.localEvidence : null,
      alsoAt,
    });
    merged += group.length - 1;
  }
  if (report) {
    report.merged = merged;
    report.refusedRows = refused;
  }
  return out;
}
