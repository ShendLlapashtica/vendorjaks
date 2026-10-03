// CATEGORY SAFETY GATE — "if its sunflower seed oil you must not show a
// kosovar cookie" (owner, 2026-09-12).
//
// THE BUG THIS FIXES. Open Food Facts' categories_tags are a hierarchy that
// runs general -> specific, e.g. for a bag of Chipsy:
//
//   en:plant-based-foods-and-beverages, en:plant-based-foods,
//   en:snacks, en:cereals-and-potatoes
//
// matcher.js walked EVERY one of those tags looking for local products in
// the same category. But `en:plant-based-foods-and-beverages` is shared by
// sunflower oil, biscuits, juice, flour and crisps alike — so a general tag
// would happily return a Kosovar cookie as the "alternative" to a Serbian
// cooking oil. Same for `en:snacks`, which covers both crisps and biscuits.
//
// TWO GUARDS, both required:
//
//   1. GENERIC_TAGS — aisle-level tags that must NEVER, on their own,
//      justify a match. They are real tags and stay in the data; they are
//      simply not evidence that two products are substitutes.
//
//   2. FAMILIES — a coarse product family derived from the specific tags.
//      A candidate may only be offered if it lands in the SAME family as
//      the scanned product. This catches the cases a tag-overlap test
//      misses, e.g. two products sharing only `en:fats` where one is butter
//      and the other is engine-grade rapeseed oil.
//
// When neither guard can place a product, the honest answer is "no
// alternative found", NOT a loosely-related one. Showing nothing costs the
// user nothing; showing a cookie for an oil costs the app its credibility.

/** Aisle-level tags that are never sufficient evidence of substitutability. */
export const GENERIC_TAGS = new Set([
  'en:plant-based-foods-and-beverages',
  'en:plant-based-foods',
  'en:foods',
  'en:groceries',
  'en:snacks',
  'en:beverages',
  'en:non-alcoholic-beverages',
  'en:alcoholic-beverages',
  'en:dairies',
  'en:meats',
  'en:meat-and-meat-products',
  'en:seafood',
  'en:cereals-and-potatoes',
  'en:cereals-and-their-products',
  'en:fats',
  'en:fats-and-oils',
  'en:condiments',
  'en:sauces',
  'en:desserts',
  'en:frozen-foods',
  'en:canned-foods',
  'en:spreads',
  'en:breakfasts',
  'en:meals',
  'en:sweeteners',
  'en:sweet-snacks',
  'en:salty-snacks',
  'en:farming-products',
  'en:fermented-foods',
  'en:fermented-milk-products',
  'en:legumes-and-their-products',
  'en:fruits-and-vegetables-based-foods',
  'en:vegetables-based-foods',
  'en:fruits-based-foods',
  'en:cleaning-products',
  'en:personal-care-products',
  'en:non-food-products',
  // ADDED 2026-09-16, measured. These are aisle-level tags that were NOT on
  // the list, so `isMatchableTag` still treated them as specific enough to
  // justify a match on their own — the exact hole the list exists to close.
  // `en:vegetable-based-foods-and-beverages` is carried by ajvar, frozen
  // broccoli and vegetable oil alike; `en:beverages-and-beverages-
  // preparations` by water, juice and instant cappuccino. Found by listing
  // every non-generic tag on the 69 eval-corpus products the family map
  // could not place (scripts/eval-alternatives.mjs).
  'en:vegetable-based-foods-and-beverages',
  'en:fruit-based-foods-and-beverages',
  'en:fruit-based-foods',
  'en:fruit-based-beverages',
  'en:beverages-and-beverages-preparations',
  'en:beverage-preparations',
  'en:plant-based-beverages',
  'en:dried-products',
  'en:dried-products-to-be-rehydrated',
  'en:dried-plant-based-foods',
  'en:frozen-plant-based-foods',
  'en:meats-and-their-products',
  'en:prepared-meats',
  'en:variety-packs',
  'en:snacks-variety-packs',
  'en:dried-meals',
  'en:instant-food',
  // `en:vegetables` / `en:fruits` are the aisle, not the product: lentils,
  // cucumbers, tomatoes and frozen peas all carry them. Measured by the
  // harness's independent family check — a Serbian jar of gherkins
  // ("Kornisoni", en:cucumbers) was answered with a bag of green lentils
  // ("Thjerrëza Jeshile"), matched through `en:vegetables` in the static
  // category index.
  'en:vegetables',
  'en:fruits',
]);

export function isGenericTag(tag) {
  return GENERIC_TAGS.has(String(tag || '').toLowerCase().trim());
}

// Family -> the substrings that place a product in it. Order matters: the
// first family whose pattern matches wins, so put the narrow, easily
// confused ones first (oils before fats, crisps before snacks).
const FAMILY_RULES = [
  // THE BUCKETS WERE TOO COARSE (split 2026-09-16).
  //
  // Owner, 2026-09-16: "and dont recommend milk for yogurt".
  //
  // He was right, and the family map was laundering it. The bucket was
  // literally named `milk-yogurt`, so a yogurt answered with a carton of
  // milk scored as "same product family" and the headline WRONG FAMILY = 0
  // never saw it. Same for `oils-fats` (cooking oil / butter / peanut
  // butter), `biscuits-sweet-bakery` (biscuits / wafers / cake),
  // `crisps-savoury-snacks`, `juices-soft-drinks`, `flour-pasta-rice`,
  // `meat-charcuterie`, `preserves-jams-honey`, `coffee-tea`,
  // `wines-spirits`, `sauces-condiments` and `fresh-produce`.
  //
  // The test is not "same bucket" but "would a shopper in the aisle accept
  // this swap?". The granularity below is the one data/brand-alternatives.json
  // already curates against (milk, yogurt, cream, coffee, tea, flour, pasta,
  // rice, cooking-oil, butter, ketchup, mayonnaise, jam, honey, wine…) and
  // the one inlineAlternative.js's KIND_TAGS already had to invent privately
  // for the same reason — so this brings the resolver, the curated map and
  // the evaluation harness onto ONE taxonomy instead of three.
  //
  // ORDER MATTERS: the first family whose pattern matches wins, so the
  // narrow, easily-confused entries come first. Several families appear
  // twice for that reason (a narrow spelling early, the general one later).

  // `en:peanut-butters` contains both 'peanut' and 'butter'; it is neither a
  // bag of peanuts nor a pack of butter, and this must be settled first.
  // Cocoa spread is NOT peanut butter. They were one family until the
  // curated-entry family fallback matched a Serbian peanut butter ("Puter
  // od kikirikija") with Pi&Ki Çokokrem, a chocolate spread — a swap no
  // shopper accepts. `hazelnut-spread` stays with cocoa, where Eurokrem
  // and Nutella live.
  // 'eurocrem' with a C — the spelling the catalogue actually uses, on all
  // 6 rows it has (Takovo Eurocrem Block 50/90g, Eurocrem Bllok 90Gr).
  // 'eurokrem' with a K was here and matches none of them, so every one of
  // them had no family at all. Measured: the stem appears in exactly one
  // word, 'eurocrem', and in nothing else in 33,039 rows.
  ['chocolate-spread', ['chocolate-spread', 'cocoa-spread', 'hazelnut-spread', 'cokokrem', 'eurokrem', 'eurocrem']],
  ['nut-butter', ['peanut-butter', 'nut-butter', 'almond-butter']],
  // Chocolate milk is a milk drink; milk chocolate is a chocolate bar.
  ['milk', ['chocolate-milk', 'milk-drink', 'dairy-drink']],
  ['ice-cream', ['ice-cream', 'frozen-dessert', 'sorbet', 'akullore']],
  // TOFU IS NOT CHEESE — SPLIT 2026-09-17, measured on /alternativa.
  //
  // Every tofu row in the catalogue is titled "Tofu Djath Soye ..." — soy
  // "cheese" — so the word `djath` put it in the CHEESE family, and the
  // exact-match screen offered `Tofu Djath Soye Natyral 200Gr` as the 1:1
  // replacement for `Sirnik Maje Djathi 500G`, a curd cheese. Owner's
  // standing test: would a shopper holding this accept that exact thing?
  // Nobody swaps dairy curd for soy tofu.
  //
  // It gets its own family rather than being deleted, so the app knows what
  // it is; like `supplements` it is deliberately given no shelf search
  // terms, because knowing a product is tofu is enough to stop pretending
  // some Kosovar cheese replaces it. MUST precede `cheese`.
  ['tofu', ['tofu']],
  ['cheese', ['cheese', 'feta', 'kashkaval', 'mozzarella', 'curd', 'djath', 'gjiz']],
  ['cream', ['sour-cream', 'whipping-cream', 'creme-fraiche', 'kajmak', 'pavlaka', 'smetana', 'ajke']],
  ['butter', ['butter', 'margarine', 'ghee', 'gjalp', 'maslac']],
  // 'vaj' — Albanian for oil, and the divergence that the 2026-09-17
  // ambiguous-shelf rule exposed. liveAlternatives.js's FAMILY_TERMS has
  // had it since the split; this list never did, so the shelf
  // "Miell, Vaj & Sheqer , Kripë" resolved to {flour, salt} — naming
  // everything on it EXCEPT the oil — and seven bottles of sunflower and
  // olive oil were refused because their own titles said cooking-oil and
  // their shelf, as read, did not.
  //
  // Measured before adding: only four distinct categories in 33,039 rows
  // contain the stem (VAJ, "Miell, Vaj & Sheqer , Kripë", "Bulmet / Vaj
  // krem", "Vajra & Uthull") and all four are the oil aisle. The famous
  // collision is in product TITLES, not categories — "Gete për vajza"
  // (girls' leggings), "FLETORE ... VAJZA" — and this list is only ever
  // asked about a category or an OFF tag. The VAJZ trap below is belt and
  // braces for the day that stops being true.
  ['cooking-oil', ['sunflower-oil', 'olive-oil', 'vegetable-oil', 'rapeseed-oil', 'corn-oil', 'frying-oil', 'lard', 'shortening', 'oil', 'vaj']],
  // Savoury snacks before crisps: `en:corn-chips` is a Smoki-style flip,
  // not a potato crisp, and the curated map keeps 'corn-flips' separate.
  //
  // 'njelmet' — "të njelmëta", Albanian for THE SALTY ONES, and it is an
  // AISLE, not a purchase. Added to BOTH families on purpose (2026-09-17):
  // the two retailer categories that use it ("Njelmeta" 67 rows,
  // "Ushqimore / Të njelmëta" 48) hold crisps and extruded flips side by
  // side, so the shelf honestly names a SET of two purchases and
  // freeTextFamiliesOf must report both. exactMatch.js then lets the set
  // bound the title rather than discarding the shelf — see the
  // ambiguous-shelf branch of exactFamilyOf(). Without it, `Clipsy Dini
  // Keqap 30G` (a bag of ketchup-FLAVOURED crisps on the Njelmeta shelf)
  // had no shelf witness at all and the 'keqap' added below would have
  // made the app answer a bag of crisps with a bottle of ketchup.
  //
  // It is deliberately NOT a search stem in liveAlternatives.js: as a
  // CATEGORY the word is the salty aisle, but inside a TITLE it is an
  // adjective on something else ("Shkopinjë Të Njelmët" = salty STICKS,
  // all 14 catalogue titles that carry it), and reading it as a family
  // there would make every one of those sticks ambiguous.
  ['savoury-snacks', ['corn-chip', 'extruded', 'popcorn', 'pretzel', 'nachos', 'rice-cake', 'savoury-snack', 'salty-snack', 'appetizer', 'flips', 'njelmet', 'kripos', 'stiks']],
  // 'qips' and 'patatin' are the two commonest Albanian spellings of
  // "crisps" in this catalogue and neither was here, although
  // liveAlternatives.js's FAMILY_TERMS has carried 'qipsa' and 'patatina'
  // all along — the same divergence as 'biskot' and 'vaj'. Measured:
  // 'qips' appears in exactly one category ("Qipsa", 43 rows) and 52
  // titles, 'patatin' in one category ("Patatina", 62 rows) and 16
  // titles, and every one of them is a bag of crisps. 'qips' rather than
  // 'qipsa' so it also reaches "Qips Vipa 130G Classic".
  ['crisps', ['crisp', 'chips-and-fries', 'chips', 'potato-chip', 'tortilla-chip', 'cips', 'qips', 'patatin', 'njelmet']],
  ['wafers', ['wafer', 'napolitan']],
  // 'pastr' WAS HERE AND IT WAS WRONG (fixed 2026-09-16). It is a prefix of
  // the Albanian "pastrim"/"pastrues" — CLEANING — so every catalogue shelf
  // called "Aksesore Pastrimi", "PASTRIM" or "DETERXHENTE ... PER PASTRIM"
  // resolved to the CAKE family. Measured consequences: five proven-local
  // bin-bag rows were filed as cakes-pastry, and shelfSideFor() put the
  // whole cleaning aisle in Explore's "things you need to live" column.
  // Found by the lie detector in scripts/eval-alternatives.mjs, which
  // reported "Tepsi për muffins -> cakes-pastry -> THASE PER MBETURINA".
  ['cakes-pastry', ['cake', 'pastry', 'pastries', 'brownie', 'croissant', 'doughnut', 'muffin', 'torte']],
  // 'biskot' — the ALBANIAN spelling, and it was simply missing (added
  // 2026-09-17). Measured: the retail catalogue files Serbian biscuits under
  // shelves literally called "BISKOTA", "Biskota të ëmbla" and "BISKOTA TE
  // EMBELA", none of which contain the English 'biscuit', so
  // categoryFamilyOf() returned null for every one of them and the family
  // then fell through to the product title. For `Milka Biskote Çoko Jaffa
  // Portokall 147G` the title's first word is "Milka", the stem 'milk'
  // starts it, and the row resolved to the MILK family — so a pack of
  // biscuits was answered with six cartons of UHT milk. See the matching
  // STEM_TRAPS entry in liveAlternatives.js: both halves were needed.
  // liveAlternatives.js's FAMILY_TERMS already spelled it 'biskot'; this
  // file did not, which is exactly the kind of divergence between the two
  // taxonomies the 2026-09-16 split set out to end.
  ['biscuits', ['biscuit', 'biskot', 'cookie', 'cracker', 'keks', 'petit-beurre']],
  ['candy', ['candy', 'candies', 'sweets', 'bonbon', 'praline', 'nougat', 'chewing-gum', 'gums', 'lollipop', 'marshmallow', 'jelly-bean', 'turkish-delight']],
  ['chocolate', ['chocolate', 'cocoa-bar']],
  ['energy-drinks', ['energy-drink']],
  // `sr:Sok` / `sr:Сок` and Albanian `Lengje` are juice, not fizzy drinks.
  ['juices', ['juice', 'nectar', 'nektar', 'sok', 'сок', 'leng']],
  ['soft-drinks', ['soda', 'sodas', 'soft-drink', 'cola', 'lemonade', 'iced-tea', 'ice-tea', 'carbonated-drink', 'syrup-for-drink', 'syrup', 'gazuar']],
  ['waters', ['water', 'mineral-water', 'spring-water', 'sparkling-water', 'agua', 'aguas', 'uje']],
  ['beers', ['beer', 'lager', 'ale', 'pilsner', 'birr']],
  ['wine', ['wine', 'prosecco', 'champagne', 'vere']],
  ['spirits', ['rakia', 'raki', 'brandy', 'vodka', 'whisky', 'whiskey', 'gin', 'rum', 'liqueur', 'liker']],
  // COFFEE BEFORE TEA — the fold made the order load-bearing (measured).
  // Kosovo and Albanian shops shelve coffee, tea and cocoa together, and the
  // category string says so: "KAFE, ÇAJ, KAKAO". Before the diacritic fold
  // `çaj` could not match the ASCII pattern 'caj', so 'kafe' won and the
  // shelf resolved to coffee. After the fold 'caj' matched first and 283
  // rows — Nescafe 3in1, Prince Caffe Devolli, every instant coffee on that
  // shelf — became TEA. A shopper scanning a jar of Nescafe would have been
  // offered tea.
  //
  // Neither family is derivable from a compound aisle label, so the tie is
  // broken the way the shelf actually skews and the way this file already
  // behaved: coffee wins when a token names both. A token naming only tea
  // ("ÇAJ CEYLON DHE ÇAJ FILTËR", "Çaj Fruta Mali") is untouched, because it
  // contains no 'kafe'.
  ['coffee', ['coffee', 'espresso', 'kafe']],
  ['tea', ['tea', 'herbal-tea', 'infusion', 'caj']],
  // 'kos i' — DRINKING YOGURT, added with the fold. `Kos i lëngshëm` is
  // literally "liquid yogurt"; before the lengsh trap it resolved to JUICE
  // (57 rows, alongside `Sapun i lëngshëm` — liquid SOAP), and after the trap
  // it resolved to nothing at all, which silently dropped two proven-local
  // Kosovar/Albanian drinking yogurts (Erzeni, Lufra) out of reach of a
  // yogurt scan. Bare 'kos' is NOT admissible here and must not be added:
  // it is the first three letters of "Kosova", so it would file anything
  // named after the country as yogurt. 'kos i' only ever begins the phrase.
  ['yogurt', ['yogurt', 'yoghurt', 'kefir', 'ayran', 'jogurt', 'kos i']],
  // General milk comes AFTER chocolate/cheese/cream/butter so their
  // compound spellings win.
  ['milk', ['milk', 'uht-milk', 'milchprodukte', 'milchnachspeisen', 'milchreisbrei', 'qumesht', 'mleko']],
  ['milk-pudding', ['pudding', 'milk-rice', 'flan']],
  ['pasta', ['pasta', 'spaghetti', 'macaroni', 'noodle', 'couscous', 'makarona']],
  ['rice', ['rice', 'oriz']],
  ['flour', ['flour', 'semolina', 'miell', 'baking-mix']],
  ['bread', ['bread', 'baguette', 'toast', 'bun', 'roll', 'pita', 'lavash', 'buke']],
  ['breakfast-cereals', ['breakfast-cereal', 'muesli', 'granola', 'cornflake', 'corn-flake', 'oat-flake', 'oatmeal', 'porridge', 'kasa', 'kaša']],
  ['charcuterie', ['sausage', 'salami', 'ham', 'bacon', 'pate', 'charcuterie', 'cured-meat', 'prosciutto', 'frankfurter', 'virsl', 'suhomesnato', 'sallam', 'suxhuk']],
  ['meat-fresh', ['poultry', 'poultri', 'turkey', 'beef', 'pork', 'chicken', 'mince', 'veal', 'lamb', 'mish']],
  ['fish-seafood', ['fish', 'tuna', 'sardine', 'anchov', 'salmon', 'seafood', 'shrimp', 'peshk']],
  ['eggs', ['egg', 'veze']],
  // MUST precede the produce families: `en:tomato-sauces` matched 'tomato'
  // there and resolved to produce, so a Serbian ketchup was being
  // classified as fruit and veg. A sauce that mentions a vegetable is
  // still a sauce.
  ['mustard', ['mustard', 'senf']],
  ['vinegar', ['vinegar', 'uthull']],
  ['mayonnaise-dressings', ['mayonnaise', 'dressing', 'dip', 'dips', 'guacamole', 'majonez']],
  ['ajvar-pickles', ['ajvar', 'pickle', 'relish', 'turshi', 'pinxhur']],
  // 'keqap' — the third Albanian spelling of ketchup and the commonest one
  // in this catalogue: 94 rows carry it against 'keçap'/'kecap', and four
  // of those 94 are PROVEN-LOCAL (Euro Food, Eurofood). Missing it meant a
  // Serbian `Keqap Polimark 500G` and a Kosovar `KEQAP EURO FOOD 730GR`
  // were both unplaceable while sitting in the same aisle. Only one word
  // in the catalogue begins with it, so it is unambiguous as a stem — but
  // see the crisp-flavour trap noted on 'njelmet' above: ketchup is also
  // the commonest FLAVOUR word on a bag of crisps.
  // All three Albanian spellings. 'keçap'/'kecap' were in
  // liveAlternatives.js's FAMILY_TERMS and never here, so the shelf
  // "KEÇAP DHE MAJONEZË" named only the mayonnaise and five bottles of
  // ketchup on it — Heinz, Eurofood — were filed as MAYONNAISE.
  ['ketchup-tomato-sauces', ['ketchup', 'keqap', 'kecap', 'tomato-sauce', 'passata', 'puree', 'sauce', 'sauces', 'salc']],
  ['fresh-vegetables', ['fresh-vegetable', 'frozen-vegetable', 'vegetables', 'salad', 'potato', 'tomato', 'onion', 'cucumber', 'broccoli', 'carrot', 'perime', 'aubergine']],
  ['fresh-fruit', ['fresh-fruit', 'fruit-and-vegetable', 'apple', 'pear', 'banana', 'plum', 'peach', 'fruta']],
  // HONEY BEFORE JAMS — the same compound-aisle problem, same cause.
  // "Mjaltë & Reçel" is one shelf for honey and jam. `reçel` could not match
  // 'recel' before the fold, so 'mjalt' won and the shelf was honey; after
  // the fold 'recel' matched first and 183 rows of honey (Ambrosoli Miele
  // Millefiori in three sizes, and so on) became jam. Honey wins when a token
  // names both. A jar whose own NAME says "Reçel" is still jam, because
  // categoryFamilyOf reads the product name before the category.
  ['honey', ['honey', 'mjalt']],
  ['jams', ['jam', 'marmalade', 'preserve', 'compote', 'conserve', 'recel', 'marmelat']],
  // 'kripe', not 'krip'. matchesPattern is a prefix match that checks the
  // character BEFORE a word and never after it, so the bare stem 'krip'
  // also matched "kriposur" = SALTED, and the shelf "PROGRAMI I KRIPOSUR"
  // (170 rows of crisps and flips) resolved to SALT. Albanian separates
  // them cleanly: kripë is the noun, kriposur is the adjective.
  // This is the fourth time today a stem has matched inside a longer word
  // (vaj/vajza, milk/MILKA, leng/lëngshëm, krip/kriposur) — the shape to
  // watch for is a short stem with no suffix guard.
  ['salt', ['salt', 'kripe', 'kripa']],
  ['spices-seasonings', ['spice', 'seasoning', 'pepper', 'herb', 'bouillon', 'stock-cube', 'ereza']],
  ['baby-food', ['baby', 'infant', 'follow-on']],
  // THE BAG (added 2026-09-16). Owner: "fuck do you mean in the whole of
  // Kosovo no bag exists". He was right to be angry. The catalogue ships 26
  // rows with `isLocalBrand === true` that are literally bin bags and
  // freezer bags -- Strong/Pako/Plast House/NeaPack/Limpo Garbage Bags,
  // "Thase Per Mbeturina", "Qese Frizi" -- and the resolver had no family
  // for any of them, so a bag scan could never be answered with a bag.
  //
  // `bag` on its own is NOT a pattern here: `en:tea-bags` is tea, not a bin
  // liner. Only compounds, plus the two Albanian words that only ever mean
  // rubbish ("mbeturina", "plehra").
  ['household-bags', [
    'garbage-bag', 'garbage bag', 'bin-bag', 'bin bag', 'bin-liner', 'bin liner',
    'trash-bag', 'trash bag', 'rubbish-bag', 'refuse-sack', 'waste-bag',
    'plastic-bag', 'freezer-bag', 'food-bag', 'sandwich-bag',
    'mbeturinash', 'mbeturina', 'mbuturinash', 'plehrash', 'plehra',
  ]],
  // 'detergjent' is the Albanian spelling and it was simply missing, which is
  // why 576 rows of liquid detergent had NO family at all and were free to be
  // captured by the juice pattern (see FOLD_TRAPS). Unambiguous: nothing
  // edible is called a detergjent. `shelfSideFor`'s free-text regex already
  // knew the word; the family map did not.
  // FABRIC SOFTENER IS NOT A CLEANER — SPLIT 2026-09-17, measured.
  //
  // `DUEL ZBUTESE SOFT LOTUES` is a fabric softener. `cleaning` also holds
  // window spray, floor cleaner and washing-up liquid, so /alternativa
  // offered `Elax Detergjent I Xhamave 750 Ml` — glass cleaner — as its
  // exact 1:1 replacement. You do not put window spray in a washing
  // machine. `zbutes` is the Albanian word and is unambiguous: nothing else
  // in 33,039 catalogue rows is called a zbutës.
  //
  // MUST precede `cleaning`, whose 'softener' pattern would otherwise win.
  // KNOWN-OPEN, and deliberately not fixed here: `cleaning` is still coarse
  // in the same way — washing-up liquid, glass spray and floor cleaner are
  // three different purchases in one family. No Serbian product in the
  // catalogue currently lands in any of them, so splitting them would be
  // unmeasured guesswork; this one was measured.
  ['fabric-softener', ['fabric-softener', 'fabric softener', 'softener', 'zbutes', 'omeksivac', 'omeksivaca']],
  // SURFACE AND DISH CLEANERS, split out of `cleaning` for the same reason
  // (2026-09-17, measured). `Duel detergjent gel universal 2.45L` and
  // `Duel Detergjent i Ngurte Soft Lotus 2.7kg` are LAUNDRY detergents, and
  // /alternativa answered both with `Elax Detergjent I Xhamave` (window
  // spray), `Elax Detergjent Per Ene Lemon` (washing-up liquid) and `Elax
  // Detergjent Per Pllaka` (floor cleaner) — 12 pairs, every one of them a
  // swap that would ruin a wash load. The Albanian retail names say exactly
  // what each one cleans, so only those COMPOUND phrases are patterns here;
  // a bare 'detergjent' stays in `cleaning`, where it means "we know it is
  // a cleaning product and no more than that".
  //
  // A SPONGE IS NOT A DETERGENT, so `cleaning-tools` comes first: `Shpuz
  // Per Ene 4Pcs` is a four-pack of washing-up SPONGES, and the phrase
  // 'per ene' below would otherwise make it a bottle of washing-up liquid.
  ['cleaning-tools', ['shpuz', 'sfungjer', 'sfungjere', 'fshese', 'fshesa', 'leck']],
  ['surface-cleaner', [
    'i xhamave', 'te xhamave', 'per xhama', 'xhamash', 'per pllaka', 'per dysheme',
    'per ene', 'enelarese', 'dishwash',
    // The catalogue names half this shelf in English, so both spellings of
    // every compound: 'glass-cleaner' never matched `Plus Glass Cleaner
    // 750ml` because the pattern is hyphenated and the title is not.
    'glass-cleaner', 'glass cleaner', 'floor-cleaner', 'floor cleaner',
    'parquet cleaner', 'laminate cleaner', 'surface-cleaner',
    'surface cleaner', 'pastrues siperfaqesh', 'toilet cleaner',
  ]],
  ['cleaning', ['detergent', 'detergjent', 'cleaner', 'bleach', 'laundry']],
  // PAPER IS NOT PERSONAL CARE — SPLIT OUT 2026-09-17, measured.
  //
  // `personal-care` held 'toilet-paper' next to 'shampoo', 'deodorant' and
  // 'razor'. Nobody swaps a shampoo for a nine-pack of toilet roll, so as
  // an exact 1:1 family it was never usable — and in practice it never
  // fired anyway, because the catalogue writes these in Albanian and
  // neither Albanian phrase was here. Both of these are real families with
  // REAL PROVEN-LOCAL STOCK, which is why they are worth splitting rather
  // than just recording as gaps:
  //
  //   'leter toaleti'  55 rows, 12 proven-local (Bora, Vela, Rose)
  //   'leter kuzhine'  63 rows, 10 proven-local (Bona, Panda, Bora)
  //
  // and the Serbian side of the same aisle — Perfex De Luxe toilet roll,
  // Perfex kitchen towel — had no family at all. Compound phrases only: a
  // bare 'leter' is Albanian for paper and is in everything from baking
  // parchment to a paper napkin to "letër e lagur" (a wet wipe).
  //
  // MUST precede `personal-care`, whose 'toilet-paper' pattern would
  // otherwise win on the English-tagged rows; that pattern moves here.
  ['toilet-paper', [
    'toilet-paper', 'toilet-papers', 'toilet paper', 'leter toaleti', 'letra toaleti',
    'leter tualeti', 'letra tualeti', 'leter higjienike',
  ]],
  ['kitchen-towel', [
    'leter kuzhine', 'letra kuzhine', 'flete leter kuzhine',
    'kitchen-towel', 'kitchen towel', 'kitchen paper', 'kitchen paper towel', 'paper-towel', 'paper towel',
  ]],
  // SCHOOL AND STATIONERY (added 2026-09-17). One Kosovo retailer files an
  // entire school-supplies aisle under "LIBRARI" — 156 rows, of which 49
  // are Serbian-registered and were the single largest block of products
  // /alternativa could not name at all. They are three separate purchases
  // and get three separate families, because a shopper holding a backpack
  // does not accept a pencil case:
  //
  //   'cante'     30 rows — çantë, a school bag        (19 Serbian)
  //   'fotrolle'  17 rows — a pencil case              (17 Serbian)
  //   'termos'    11 rows — a vacuum flask             ( 7 Serbian)
  //
  // Each stem was checked against every word in the catalogue it prefixes:
  // 'cante' occurs only as "cante", 'fotrolle' only as "fotrolle",
  // 'termos' only as "termos". The near-miss that was REFUSED is 'canta' —
  // it would match "Cantabile Apple Ade", a soft drink.
  //
  // NONE OF THE THREE HAS ANY PROVEN-LOCAL STOCK (0 rows each over 2,967
  // proven-local rows), so what these families buy is honesty, not
  // coverage: the screen moves from "we cannot tell what this is" to "this
  // is a school bag and we know of no Kosovar one", which is a true
  // sentence and a thing a shopper can act on.
  ['school-bags', ['cante', 'school-bag', 'school bag', 'backpack', 'schoolbag']],
  ['pencil-cases', ['fotrolle', 'fotroll', 'pencil-case', 'pencil case']],
  ['vacuum-flasks', ['termos', 'thermos', 'vacuum-flask', 'vacuum flask']],
  ['personal-care', ['shampoo', 'soap', 'toothpaste', 'deodorant', 'shower-gel', 'lotion', 'razor', 'diaper', 'nappy', 'tissue', 'napkin', 'sanitary']],
  ['nuts-seeds', ['nut', 'almond', 'walnut', 'peanut', 'hazelnut', 'seed', 'pistachio', 'sunflower-seed', 'kikirik', 'arra']],
  ['legumes', ['bean', 'lentil', 'chickpea', 'pea', 'fasule']],
  ['soups-ready-meals', ['soup', 'broth', 'supa', 'supe', 'stew']],
  ['dried-fruits', ['dried-fruit', 'raisin', 'dried-goji', 'grozde', 'grožđe', 'грожђе', 'dried-apricot', 'prune']],
  // Not food in the grocery sense and deliberately given no shelf search
  // terms in liveAlternatives.js: knowing a protein shake IS a supplement is
  // enough to stop pretending some Kosovar biscuit replaces it.
  ['supplements', ['dietary-supplement', 'bodybuilding-supplement', 'protein-shake', 'protein-bar', 'spirulina', 'supplement']],
];

/**
 * The family identifiers themselves, so `categoryFamilyOf('fresh-vegetables')`
 * answers 'fresh-vegetables'.
 *
 * WHY THIS IS NEEDED. liveAlternatives.js stamps `matchedTag: family` on
 * every shelf candidate — the value is already a family id, not an OFF tag.
 * The evaluation harness then asked `categoryFamilyOf([item.matchedTag])`
 * and got null for any family whose own name is not also one of the
 * patterns above ('fresh-vegetables', 'legumes', 'soups-ready-meals', ...), so
 * a correctly-matched shelf answer was scored "family undetermined". That
 * is not a real unknown, it is a round-trip failure.
 */
export const FAMILY_IDS = new Set(FAMILY_RULES.map(([family]) => family));

/**
 * ALBANIAN DIACRITICS — fold them, or half the local catalogue has no family.
 *
 * Reported with a repro by the Xapi-sourcing pass (docs/XAPI-SOURCING.md §7)
 * and fixed here:
 *
 *   categoryFamilyOf(["Bukë Malësie"]) -> null
 *   categoryFamilyOf(["Buke Malesie"]) -> bread
 *
 * Every FAMILY_RULES pattern is written in ASCII ('buke', 'uje', 'caj',
 * 'qumesht'), while the catalogue's own categories are spelt properly in
 * Albanian. Buka Bakery's WooCommerce category is literally `Bukë`, so its
 * 22 real breads — the only proven-local bread in the data — could not be
 * offered as an alternative to anything.
 *
 * NFD decomposes ë into e + U+0308; stripping the combining range then
 * leaves 'buke'. This is a fold for MATCHING only: nothing user-facing is
 * rewritten, and the raw category string stays in the row as evidence.
 *
 * Scope note: the fold is applied to the token being matched, not to the
 * patterns, because the patterns are already ASCII. It is deliberately NOT
 * applied in `shelfSideFor`'s free-text regex, which already spells both
 * variants ('çaj|caj') and is a different, coarser question.
 */
export function foldDiacritics(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * THE TRAPS THE FOLD MADE NECESSARY — every one measured, not anticipated.
 *
 * Folding is not free. Measured over all 91,197 catalogue rows, the fold makes
 * 3,281 rows GAIN a family and 0 rows lose one, but it also CHANGES the family
 * of 1,211 rows, and those had to be read one group at a time rather than
 * assumed to be improvements. Most were: `Lëng frutash` stops being fresh fruit
 * and becomes juice (569), `Ujë natyral & Ujë i gazuar` stops being a soft
 * drink and becomes water (99), `Bukë me arra` becomes bread, `Sardinë` becomes
 * fish, `Verë Lambrusco` stops being fresh meat (it had matched 'lamb' inside
 * "Lambrusco"), `Bukë Hamburgeri` stops being charcuterie (it had matched 'ham'
 * inside "Hamburgeri"). Three groups got WORSE, and these are the traps for
 * them. The two aisle-order fixes are in FAMILY_RULES itself.
 *
 * 1. INGREDIENT AND PACKING MODIFIERS. Albanian names a product's ingredients
 *    inline, and after folding those ingredient words started winning against
 *    the product itself:
 *
 *      "Spar Rolls Çokolladë Me Qumësht"   -> milk   (it is a biscuit roll)
 *      "Despar Kos Me Krem Qumështi"       -> milk   (it is a YOGURT, and the
 *                                                     owner's words are
 *                                                     "dont recommend milk for
 *                                                     yogurt")
 *      "Siblou Tuna Në Ujë"                -> waters (it is tuna)
 *      "Domate të qëruara në lëng domatesh"-> juices (they are tinned tomatoes)
 *      "Despar Kaneloni Me Vezë"           -> eggs   (it is pasta)
 *      "Gjëmbak Qumështi Organik"          -> milk   (it is milk THISTLE, a herb)
 *
 *    Note the grammar, which is doing real work here: bare `qumësht` is the
 *    product ("Qumësht 1L", "Alpsko Qumësht Çokollatë" — a milk drink, and
 *    correctly milk), while `qumështi` — the definite/genitive form — is almost
 *    always a modifier ("çokollatë qumështi" = MILK chocolate, "krem qumështi" =
 *    milk cream, "gjëmbak qumështi" = MILK thistle). So `qumështi` is dropped
 *    and `qumësht` is kept.
 *
 * 2. FALSE FRIENDS THE FOLD CREATED. `Patëllxhan` (aubergine) does not contain
 *    'pate' while the ë is there; folded to `patellxhan` it does, at a word
 *    boundary, so an aubergine became charcuterie. It is rewritten to the
 *    English word instead of being dropped, so it still lands in
 *    fresh-vegetables rather than losing its family.
 *
 * Applied to the folded token only. Nothing user-facing is rewritten; the raw
 * category and name stay on the row as evidence.
 */
const FOLD_TRAPS = [
  // 1. ingredient and packing modifiers ("me"/"dhe" = with/and)
  [/\b(me|dhe) qumesht(i|it)?\b/g, ' '],
  [/\bqumeshti[a-z]*\b/g, ' '],
  [/\b(me|dhe) veze\b/g, ' '],
  [/\bne uje\b/g, ' '],
  [/\bne leng[a-z]*\b/g, ' '],

  // 3. THE WORST GAIN THE FOLD PRODUCED, and it is not a modifier at all.
  //    `lëngshëm` / `lëngshme` is the Albanian adjective LIQUID, and it folds
  //    to `lengsh`, which contains `leng` — the pattern for JUICE. Measured:
  //    643 rows carry it and 576 of them sit under the category
  //    "Detergjent të lëngshëm", LIQUID DETERGENT. Without this trap the fold
  //    files Ajax Kitchen 750Ml and Smac Sgrassatore in the juice family, so
  //    a juice scan could be answered with a bottle of degreaser. That is the
  //    "Kosovar cookie for a sunflower oil" failure this whole file exists to
  //    prevent, and it is why the fold could not simply be switched on.
  [/\blengsh[a-z]*\b/g, ' '],

  //    'kripos' is the same shape and the same omission: "të kriposur" is
  //    the adjective SALTED, not the noun salt. liveAlternatives.js has
  //    carried it as a STEM_TRAP since 2026-09-16 and this file never
  //    did, so one retailer's whole salty-snack aisle — "PROGRAMI I
  //    KRIPOSUR", 170 rows — read as the SALT family, and `Smoki Flips
  //    Pi&Ki 25Gr` was a bag of flips whose shelf claimed it was salt.
  //    Measured: exactly one category and two titles in 33,039 rows carry
  //    the stem, and none of them is salt.
  //    UPDATED 2026-09-17 — and this correction matters more than the trap.
  //    BLANKING the stem removed the shelf's wrong answer and its
  //    CONTRADICTION at the same time. With "PROGRAMI I KRIPOSUR" resolving
  //    to nothing, the title won unopposed, so `Dino Ketchup Toni 20Gr` and
  //    `Vipa Stiks Ketchup 40Gr` — two bags of ketchup-FLAVOURED snacks —
  //    were the FIRST TWO candidates in the ketchup bucket.
  //    Owner, 2026-09-17: "chips arent a ketchup alternative". Correct, and
  //    trapping a stem to silence is exactly how it happened.
  //    A trap must REPLACE a wrong reading with the right one, never with
  //    nothing: "të kriposur" is the salty-snack aisle, so it now says so.
  //    That keeps it out of `salt` AND lets the shelf contradict a flavour
  //    word in the title, which is what the two-witness rule needs.
  [/kripos[a-z]*/g, ' njelmet '],

  // 4. "FRUTA TË THATA" IS THE NUT SHELF, NOT THE FRUIT SHELF (2026-09-17).
  //    It reads as "dried fruits" and the fold makes 'fruta' match, so the
  //    whole shelf resolved to `fresh-fruit` — and the shelf's real
  //    contents are `Badem 50G` (almonds), `2U Sunflower Taco 55G`,
  //    `Miser I Pjekur 35G` (roasted corn) and `Gud Kikirik Djegës`
  //    (peanuts). /alternativa labelled a bag of spicy peanuts "pemë"
  //    (fruit). Rewritten rather than dropped, exactly like `patellxhan`
  //    below, so the rows keep a family instead of losing one — and
  //    `dried-fruits` is the family they belong to.
  [/\bfrutat? (e|te) thata\b/g, ' dried-fruit '],

  // 5. "LËNGJE FRUTASH" IS THE JUICE SHELF, NOT THE FRUIT SHELF
  //    (2026-09-17). Same shape as the trap above and the same cause: the
  //    phrase means FRUIT JUICE, but 'fruta' matches `fresh-fruit` and
  //    'leng' matches `juices`, so the shelf "Pije / Lëngje frutash"
  //    resolved to two families at once and /alternativa read it as
  //    ambiguous — no exact match for any of the 53 rows on it, six of
  //    them Serbian Jaffa cartons, while four PROVEN-LOCAL juices sat on
  //    the same shelf. Rewritten rather than dropped, so the rows land in
  //    `juices`, which is what the shelf says in Albanian.
  //
  //    The shelf is not pure — it also holds `RELAX ICE TEA 1.5L` and
  //    `SOLA ÇAJ I FTOHT` — and that is handled where it should be, by the
  //    second witness: those titles name tea, the shelf now names juice,
  //    the two disagree and exactMatch.js returns no match. Verified
  //    against the real rows, not assumed.
  [/\blengje? frutash\b/g, ' juice '],

  // 2. false friends the fold created
  //    'vajza'/'vajzave' = GIRLS, and 'vaj' = oil is now a pattern above.
  //    No category in the catalogue carries the word today, so this trap
  //    changes nothing measurable — it is here because this exact
  //    collision (a sunflower-oil scan answered with school notebooks)
  //    has already shipped once and the guard belongs next to the pattern
  //    that could bring it back.
  [/\bvajz[a-z]*\b/g, ' '],
  [/\bpatellxhan[a-z]*\b/g, ' aubergine '],
  [/\bpatlixhan[a-z]*\b/g, ' aubergine '],
];

/**
 * Tokens that describe the VESSEL, not the drink. `GJYGYMA TE ÇAJIT` is a set
 * of small teapots, shelved under "AMVISERI" (housewares); folded, `çajit`
 * becomes `cajit` and matches 'caj', so 5 rows of kitchenware entered the tea
 * family and a teapot could be offered as an alternative to a box of tea.
 * There is no kitchenware family to move them to, and inventing one to hold
 * five rows would be worse than admitting we cannot place them, so the token
 * is vetoed outright and the honest "no alternative found" stands.
 */
const TOKEN_VETOES = [/\bgjygym/];

function applyFoldTraps(t) {
  let out = t;
  for (const [re, to] of FOLD_TRAPS) out = out.replace(re, to);
  return out;
}

function familyFromToken(token) {
  const folded = foldDiacritics(String(token || '').toLowerCase()).replace(/^en:/, '').trim();
  if (!folded) return null;
  if (TOKEN_VETOES.some((re) => re.test(folded))) return null;
  const t = applyFoldTraps(folded);
  if (!t.trim()) return null;
  // A family id round-trips to itself — see FAMILY_IDS above.
  if (FAMILY_IDS.has(t)) return t;
  for (const [family, patterns] of FAMILY_RULES) {
    for (const pattern of patterns) {
      if (matchesPattern(t, pattern)) return family;
    }
  }
  return null;
}

/**
 * A pattern must match at a WORD boundary, not anywhere inside a word.
 *
 * A bare `includes()` produced two genuinely wrong families:
 *   en:shampoos      -> meat-charcuterie   ("s-HAM-poos" matched 'ham')
 *   en:toilet-papers -> oils-fats          ("t-OIL-et"   matched 'oil')
 * which would have filed shampoo and toilet paper on the FOOD shelf in
 * Explore. It is the same class of bug that once answered a sunflower-oil
 * scan with school notebooks, because "vaj" (oil) sits inside "vajza".
 *
 * OFF tags are hyphen-separated, so a word starts at the beginning of the
 * string or straight after a hyphen/space.
 */
function matchesPattern(haystack, pattern) {
  const i = haystack.indexOf(pattern);
  if (i === -1) return false;
  // Walk every occurrence; any one of them starting a word is a real match.
  let from = i;
  while (from !== -1) {
    const before = from === 0 ? '-' : haystack[from - 1];
    if (before === '-' || before === ' ' || before === ':') return true;
    from = haystack.indexOf(pattern, from + 1);
  }
  return false;
}

/**
 * Coarse product family for a set of OFF category tags (or a free-text
 * category string from the retail catalogue). Generic aisle tags are
 * ignored entirely. Returns null when nothing places the product — and a
 * null family must never be treated as "matches everything".
 *
 * @param {string[]|string|null} categories
 */
export function categoryFamilyOf(categories) {
  const list = Array.isArray(categories) ? categories : categories ? [categories] : [];
  // Most specific first: OFF orders tags general -> specific.
  const ordered = [...list].reverse();
  for (const tag of ordered) {
    if (isGenericTag(tag)) continue;
    const family = familyFromToken(tag);
    if (family) return family;
  }
  // Nothing specific matched — try the generic tags only as a last resort
  // for the few that are unambiguous on their own.
  for (const tag of ordered) {
    const t = String(tag || '').toLowerCase();
    // These three were still returning the PRE-SPLIT family names
    // ('biscuits-sweet-bakery', 'crisps-savoury-snacks', 'oils-fats') after
    // the 2026-09-16 split, so any product that reached this last resort
    // got a family id that no longer exists anywhere — no shelf terms, no
    // shelf map, no answer. Measured: 3 scans in the eval corpus (Gricko,
    // Susam, Negro) came back with nothing for exactly that reason.
    //
    // The tag really is coarse — `en:sweet-snacks` covers biscuits, cake
    // and chocolate alike — so each maps to the commonest member of its
    // aisle and nothing more is claimed than that.
    if (t.includes('sweet-snacks')) return 'biscuits';
    if (t.includes('salty-snacks')) return 'crisps';
    if (t.includes('fats-and-oils') || t === 'en:fats') return 'cooking-oil';
  }
  return null;
}

/**
 * The gate itself. Two products are substitutable only when BOTH resolve to
 * a family and those families are equal.
 *
 * Deliberately strict: an unknown family on either side returns false. The
 * alternative — treating "unknown" as "compatible" — is precisely what
 * produces a cookie for an oil.
 */
export function sameCategoryFamily(aCategories, bCategories) {
  const a = categoryFamilyOf(aCategories);
  const b = categoryFamilyOf(bCategories);
  if (!a || !b) return false;
  return a === b;
}

/**
 * Whether a tag is specific enough to justify a match on its own.
 * Used by matcher.js to skip aisle-level tags when walking the hierarchy.
 */
export function isMatchableTag(tag) {
  return Boolean(tag) && !isGenericTag(tag);
}

/**
 * Softer form of the gate, for candidates reached THROUGH a specific tag.
 *
 * collectStaticCandidates walks only non-generic tags belonging to the
 * scanned product and looks up the category index for each. So a candidate
 * it finds is already indexed under a specific category the scanned product
 * shares — the index itself is the evidence, and it is good evidence.
 *
 * Many rows in local-products.json carry NO categoriesTags of their own (a
 * known gap: only a minority of the harvested pool is tagged). Treating
 * "untagged" as "wrong family" would throw away almost the entire static
 * pool and leave real alternatives unshown — a different failure, but still
 * a failure.
 *
 * So: an unknown family is not evidence AGAINST a match, and the candidate
 * is allowed through on the strength of the specific shared tag. A KNOWN
 * family that disagrees is still a hard veto — that is the case that would
 * put a cookie against an oil, and it stays blocked.
 */
export function familyCompatible(scannedCategories, candidateCategories) {
  const candidate = categoryFamilyOf(candidateCategories);
  if (!candidate) return true; // untagged — the specific-tag index vouches for it
  const scanned = categoryFamilyOf(scannedCategories);
  if (!scanned) return true; // we cannot place the scanned product either
  return scanned === candidate;
}


// ESSENTIALS vs HOUSEHOLD — the two-column split in Explore.
//
// Owner, 2026-09-12: "elementary products that are living required to left.
// and hygiene others to right".
//
// Left  = things you eat and drink — what you actually need to live.
// Right = hygiene, cleaning and everything else.
//
// Driven by the same family rules as the alternatives gate, so the two
// never disagree about what a product is. A family we cannot place falls to
// the RIGHT-hand "other" column rather than being asserted as food.
export const ESSENTIAL_FAMILIES = new Set([
  // Kept in step with FAMILY_RULES after the 2026-09-16 split. A food
  // family missing from this set would silently move that whole shelf into
  // Explore's right-hand household column.
  'nut-butter', 'chocolate-spread', 'milk', 'ice-cream', 'cheese', 'cream', 'butter', 'cooking-oil',
  'savoury-snacks', 'crisps', 'wafers', 'cakes-pastry', 'biscuits', 'candy',
  'chocolate', 'energy-drinks', 'juices', 'soft-drinks', 'waters', 'beers',
  'wine', 'spirits', 'tea', 'coffee', 'yogurt', 'milk-pudding', 'pasta',
  'rice', 'flour', 'bread', 'breakfast-cereals', 'charcuterie', 'meat-fresh',
  'fish-seafood', 'eggs', 'mustard', 'vinegar', 'mayonnaise-dressings',
  'ajvar-pickles', 'ketchup-tomato-sauces', 'fresh-vegetables', 'fresh-fruit',
  'jams', 'honey', 'salt', 'spices-seasonings', 'baby-food', 'nuts-seeds',
  'legumes', 'soups-ready-meals', 'dried-fruits',
  // Added with the 2026-09-17 split: tofu is food, it is simply not cheese.
  'tofu',
  // 'supplements' is deliberately NOT here: a protein powder is not an
  // elementary living requirement, so it stays in the right-hand column.
]);

export const HOUSEHOLD_FAMILIES = new Set([
  'cleaning', 'fabric-softener', 'surface-cleaner', 'cleaning-tools',
  'personal-care', 'household-bags',
  // Added with the 2026-09-17 split. Paper goods and school supplies are
  // not things you eat, so they belong in Explore's right-hand column —
  // stated here rather than reached by accident through the free-text
  // fallback, which is what happened while they had no family at all.
  'toilet-paper', 'kitchen-towel',
  'school-bags', 'pencil-cases', 'vacuum-flasks',
]);

/** 'essential' | 'household' — never throws, never returns null. */
export function shelfSideFor(categories, freeTextCategory) {
  const family = categoryFamilyOf(categories) || categoryFamilyOf(freeTextCategory);
  if (family && HOUSEHOLD_FAMILIES.has(family)) return 'household';
  if (family && ESSENTIAL_FAMILIES.has(family)) return 'essential';

  // Fall back to the retail catalogue's own free-text category, which is
  // Albanian and does not go through the OFF taxonomy at all.
  // Folded like the family path, so a single ASCII spelling covers both ways
  // the catalogue writes a word. Behaviour-preserving for the patterns that
  // were already here (`çaj` already had its `caj` twin, and 'buk' is a
  // substring of "bukë" either way), and it means the words added below need
  // one spelling rather than two.
  const raw = foldDiacritics(String(freeTextCategory || '').toLowerCase());
  if (/higjien|pastrim|detergjent|sapun|shampo|kozmetik|letr|pelena|higijena|deterd/.test(raw)) {
    return 'household';
  }
  // WIDENED 2026-09-16, because the ingredient traps above exposed a hole
  // that had always been here.
  //
  // This fallback only runs when NO family could be established, and a
  // missing family falls to the household column. That was fine while
  // "Çokollatë" resolved (wrongly) to `milk` — it still landed on the food
  // shelf by accident. Once the `qumështi` trap correctly stopped calling a
  // milk chocolate "milk", about 90 rows of chocolate, caramel, biscuit and
  // egg lasagne had no family AND no word here, so they moved into Explore's
  // hygiene-and-cleaning column. A bar of Lindt is not a household product.
  //
  // Measured the other way too, and it is the bigger number: the diacritic
  // fold moves 2,097 rows from the household column to the essential one —
  // yogurt ("BYLMET", "Kos"), milk ("QUMËSHT"), crisps, cream ("AJKË"),
  // spices ("Erëza"), wine ("Verë") — all of which were in the wrong column
  // purely because their properly spelt Albanian category could not be
  // placed. Owner, 2026-09-12: "elementary products that are living required
  // to left. and hygiene others to right."
  if (/ushqim|mish|bulmet|pije|fruta|perime|buk|miell|djath|vaj|kafe|caj|embel|embl|pemet|cokollat|karamel|biskot|makaron|lasagne|oriz|qumesht|bylmet|ereza|akullore|torte|meat|dairy/.test(raw)) {
    return 'essential';
  }
  return 'household';
}


/**
 * EVERY family a tag list touches, not just the most specific one.
 *
 * `categoryFamilyOf` answers "what is this product?" and returns one
 * family — right for a scanned item, which is one thing. But a curated
 * ENTRY legitimately spans several: Imlek is tagged milks + yogurts +
 * cheeses, Swisslion biscuits + chocolates. Collapsing those to a single
 * family made the match gate both over- and under-block: an Imlek MILK
 * scan found no entry (the entry had collapsed to `cheese`), while a
 * Swisslion BISCUIT scan matched an entry labelled chocolate.
 *
 * So an entry is compared on its full set. The gate is unchanged in
 * strength — an oil still matches neither — it simply stops discarding
 * families the entry genuinely covers.
 */
export function categoryFamiliesOf(categories) {
  const list = Array.isArray(categories) ? categories : categories ? [categories] : [];
  const found = new Set();
  for (const tag of list) {
    if (isGenericTag(tag)) continue;
    const family = categoryFamilyOf([tag]);
    if (family) found.add(family);
  }
  return found;
}

/**
 * EVERY family a FREE-TEXT category string touches — the ambiguity detector.
 *
 * `categoryFamilyOf` is first-match-wins by design: "KAFE, ÇAJ, KAKAO" is
 * answered `coffee` and "Mjaltë & Reçel" is answered `honey`, because the
 * resolver has to say something and the shelf skews that way (see the
 * comments in FAMILY_RULES). That tie-break is a reasonable default for a
 * shelf search. It is NOT good enough for /alternativa, where the standing
 * rule is that only an exact 1:1 swap may be shown: a shelf label naming
 * two different purchases is not evidence of either of them.
 *
 * So this returns the full set, and src/lib/exactMatch.js treats any
 * category resolving to more than one family as UNDETERMINED — no match,
 * propose one instead. Measured examples from data/kosovo-retail.json:
 *
 *   "Ereza & Salca"      -> {spices-seasonings, ketchup-tomato-sauces}
 *   "CHOCOLATES & CAKES" -> {chocolate, cakes-pastry}
 *   "BISKOTA"            -> {biscuits}                  (single — usable)
 *
 * `Veget Moravka 250G` is the row that made this necessary: a Serbian stock
 * seasoning shelved under "Ereza & Salca", which `categoryFamilyOf` places
 * in `ketchup-tomato-sauces` purely because that rule is written first. A
 * shopper holding a tub of Veget does not accept a bottle of ketchup.
 *
 * Nothing else in the app calls this; `categoryFamilyOf` is unchanged.
 *
 * @param {string|null} text a retailer's own category string
 * @returns {Set<string>} every family the string names, possibly empty
 */
export function freeTextFamiliesOf(text) {
  const folded = foldDiacritics(String(text || '').toLowerCase()).replace(/^en:/, '').trim();
  if (!folded) return new Set();
  if (TOKEN_VETOES.some((re) => re.test(folded))) return new Set();
  const t = applyFoldTraps(folded);
  if (!t.trim()) return new Set();
  const found = new Set();
  if (FAMILY_IDS.has(t.trim())) found.add(t.trim());
  for (const [family, patterns] of FAMILY_RULES) {
    if (found.has(family)) continue;
    for (const pattern of patterns) {
      if (matchesPattern(t, pattern)) {
        found.add(family);
        break;
      }
    }
  }
  return found;
}

/** Does a scanned product's family fall inside an entry's family set? */
export function familyMatchesEntry(scannedCategories, entryCategories) {
  const scanned = categoryFamilyOf(scannedCategories);
  if (!scanned) return false;
  const entryFamilies = categoryFamiliesOf(entryCategories);
  if (entryFamilies.size === 0) return false;
  return entryFamilies.has(scanned);
}
