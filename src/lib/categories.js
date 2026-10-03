// Fixed category picker shown when Open Food Facts can't identify the
// scanned product (404/503/network failure). Without OFF's categories_tags
// we can't do a tag-based match, so the user picks a category directly; we
// use `key` to filter brand-alternatives.json entries (by their `category`
// field) and `offTag` as a best-effort stand-in categories_tags for the
// static-pool / live-search lanes.
export const CATEGORY_OPTIONS = [
  { key: 'biscuits', offTag: 'en:biscuits', sq: 'Biskota', en: 'Biscuits' },
  { key: 'chips', offTag: 'en:crisps', sq: 'Patatina', en: 'Chips' },
  { key: 'juice', offTag: 'en:fruit-juices', sq: 'Lëng frutash', en: 'Juice' },
  { key: 'water', offTag: 'en:waters', sq: 'Ujë', en: 'Water' },
  { key: 'beer', offTag: 'en:beers', sq: 'Birrë', en: 'Beer' },
  { key: 'dairy', offTag: 'en:dairies', sq: 'Bulmet', en: 'Dairy' },
  { key: 'coffee', offTag: 'en:coffees', sq: 'Kafe', en: 'Coffee' },
  { key: 'oil', offTag: 'en:oils', sq: 'Vaj', en: 'Oil' },
  { key: 'cleaning', offTag: 'en:cleaning-products', sq: 'Pastrim', en: 'Cleaning' },
  { key: 'personal-care', offTag: 'en:personal-care-products', sq: 'Kujdes personal', en: 'Personal care' },
];
