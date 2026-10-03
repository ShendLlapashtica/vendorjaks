// THE SHOPPER-FACING NAME OF A PRODUCT FAMILY.
//
// Family ids are internal (`ketchup-tomato-sauces`, `fabric-softener`) and a
// shopper must never read one. Any family missing from this map falls back
// to its id, which is ugly but never blank — and src/test/taxonomy.test.js
// fails the build rather than let that ship.
//
// Lives in its own module rather than inside AlternativaScreen.jsx because
// the taxonomy test has to import it, and importing a React component pulls
// in a stylesheet and a language context that the test has no use for.
// Kept out of i18n/dictionary.js on purpose: that file is kept
// under a "targeted key edits only" rule, and
// 57 families x 2 languages is not a targeted edit.
export const FAMILY_LABELS = {
  'nut-butter': { sq: 'gjalpë kikiriku', en: 'peanut butter' },
  'chocolate-spread': { sq: 'krem çokollate', en: 'chocolate spread' },
  milk: { sq: 'qumësht', en: 'milk' },
  yogurt: { sq: 'jogurt / kos', en: 'yogurt' },
  cheese: { sq: 'djathë', en: 'cheese' },
  tofu: { sq: 'tofu', en: 'tofu' },
  cream: { sq: 'ajkë', en: 'cream' },
  butter: { sq: 'gjalpë / margarinë', en: 'butter / margarine' },
  'ice-cream': { sq: 'akullore', en: 'ice cream' },
  'milk-pudding': { sq: 'puding', en: 'pudding' },
  'cooking-oil': { sq: 'vaj gatimi', en: 'cooking oil' },
  crisps: { sq: 'çips', en: 'crisps' },
  'savoury-snacks': { sq: 'flips e ushqime të njelmëta', en: 'savoury snacks' },
  biscuits: { sq: 'biskota', en: 'biscuits' },
  wafers: { sq: 'napolitanke / vafer', en: 'wafers' },
  'cakes-pastry': { sq: 'ëmbëlsira të pjekura', en: 'cakes & pastry' },
  chocolate: { sq: 'çokollatë', en: 'chocolate' },
  candy: { sq: 'karamele e bonbone', en: 'sweets' },
  juices: { sq: 'lëngje', en: 'juice' },
  'soft-drinks': { sq: 'pije të gazuara', en: 'soft drinks' },
  'energy-drinks': { sq: 'pije energjike', en: 'energy drinks' },
  waters: { sq: 'ujë', en: 'water' },
  beers: { sq: 'birrë', en: 'beer' },
  wine: { sq: 'verë', en: 'wine' },
  spirits: { sq: 'pije të forta', en: 'spirits' },
  coffee: { sq: 'kafe', en: 'coffee' },
  tea: { sq: 'çaj', en: 'tea' },
  pasta: { sq: 'makarona', en: 'pasta' },
  rice: { sq: 'oriz', en: 'rice' },
  flour: { sq: 'miell', en: 'flour' },
  bread: { sq: 'bukë', en: 'bread' },
  'breakfast-cereals': { sq: 'drithëra mëngjesi', en: 'breakfast cereals' },
  charcuterie: { sq: 'sallam e proshutë', en: 'charcuterie' },
  'meat-fresh': { sq: 'mish i freskët', en: 'fresh meat' },
  'fish-seafood': { sq: 'peshk', en: 'fish' },
  eggs: { sq: 'vezë', en: 'eggs' },
  mustard: { sq: 'senf', en: 'mustard' },
  vinegar: { sq: 'uthull', en: 'vinegar' },
  'mayonnaise-dressings': { sq: 'majonezë', en: 'mayonnaise' },
  'ajvar-pickles': { sq: 'ajvar e turshi', en: 'ajvar & pickles' },
  'ketchup-tomato-sauces': { sq: 'keçap e salcë domatesh', en: 'ketchup & tomato sauce' },
  'fresh-vegetables': { sq: 'perime', en: 'vegetables' },
  'fresh-fruit': { sq: 'pemë', en: 'fruit' },
  jams: { sq: 'reçel', en: 'jam' },
  honey: { sq: 'mjaltë', en: 'honey' },
  salt: { sq: 'kripë', en: 'salt' },
  'spices-seasonings': { sq: 'erëza', en: 'spices' },
  'baby-food': { sq: 'ushqim për bebe', en: 'baby food' },
  'nuts-seeds': { sq: 'arra e fara', en: 'nuts & seeds' },
  legumes: { sq: 'bishtajore', en: 'legumes' },
  'soups-ready-meals': { sq: 'supa', en: 'soups' },
  'dried-fruits': { sq: 'fruta të thata', en: 'dried fruit' },
  supplements: { sq: 'suplemente', en: 'supplements' },
  cleaning: { sq: 'pastrim', en: 'cleaning' },
  'fabric-softener': { sq: 'zbutës rrobash', en: 'fabric softener' },
  'surface-cleaner': { sq: 'pastrues sipërfaqesh', en: 'surface cleaner' },
  'cleaning-tools': { sq: 'vegla pastrimi', en: 'cleaning tools' },
  'personal-care': { sq: 'higjienë personale', en: 'personal care' },
  'household-bags': { sq: 'qese shtëpiake', en: 'household bags' },
  // Added with the 2026-09-17 family sweep.
  'toilet-paper': { sq: 'letër toaleti', en: 'toilet paper' },
  'kitchen-towel': { sq: 'letër kuzhine', en: 'kitchen towel' },
  'school-bags': { sq: 'çantë shkolle', en: 'school bag' },
  'pencil-cases': { sq: 'fotrollë', en: 'pencil case' },
  'vacuum-flasks': { sq: 'termos', en: 'vacuum flask' },
};

/** The shopper-facing name of a family, or null when there is no family. */
export function familyLabel(family, lang) {
  if (!family) return null;
  return FAMILY_LABELS[family]?.[lang] || FAMILY_LABELS[family]?.sq || family;
}
