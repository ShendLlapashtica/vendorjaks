import { useLanguage } from '../i18n/LanguageContext.jsx';
import { resolveProductSize } from '../lib/productSize.js';

// The exact product, not just its name.
//
// Owner, 2026-09-12: "show the exact product when scanned not just the name
// the exact product name what flavouor chips how many mg and all specs".
//
// Everything here comes from Open Food Facts via lib/offApi.js. Verified
// against barcode 8606014409017, which really does return:
//   product_name  "Chipsy classic"
//   generic_name  "Slani krompirov čips"   <- the flavour/type line
//   quantity      "43 g"    serving_size "30 g"
//   ingredients   "krompir, palmino ulje, so (max. 3.5%), ..."
//   packaging     "en:Plastic, 90 C/PP"    nutriscore "e"
//   nutriments    energy-kj 2248, fat 34.6, salt 1.5, ...
//
// ABSENT IS ABSENT. A missing field is omitted entirely — never shown as a
// dash, a zero, or an "unknown" that a shopper could misread as measured.
// Open Food Facts is crowd-sourced and incomplete, and the app's whole
// credibility rests on not dressing up a gap as data.
const NUTRITION_LABEL = {
  energyKj: 'nutEnergyKj',
  energyKcal: 'nutEnergyKcal',
  fat: 'nutFat',
  saturatedFat: 'nutSaturatedFat',
  carbohydrates: 'nutCarbohydrates',
  sugars: 'nutSugars',
  fiber: 'nutFiber',
  proteins: 'nutProteins',
  salt: 'nutSalt',
  sodium: 'nutSodium',
};

// Sub-gram values are clearer in mg — the owner explicitly asked for "how
// many mg". 0.6 g of sodium reads better as 600 mg.
function formatAmount(value, unit) {
  if (unit === 'g' && value > 0 && value < 1) {
    return `${Math.round(value * 1000)} mg`;
  }
  const rounded = Number.isInteger(value) ? value : Math.round(value * 100) / 100;
  return `${rounded} ${unit}`;
}

function Row({ label, value }) {
  if (!value) return null;
  return (
    <div className="vj-spec-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

// The ONE exception to "absent is absent" below.
//
// Owner, 2026-09-16: "leave nothing undocumented like a random product
// without a history name or grams or price". Net weight is the field the
// owner named, so unlike every other row it is never allowed to vanish: it
// either states a figure or states, in words, that we do not have one.
// `title` carries the audit trail when the figure was parsed out of the
// product's own name rather than read from a field.
function WeightRow({ label, size, unknownLabel, byWeightLabel, byWeightNote, piecesLabel, provenanceLabel }) {
  if (!size) {
    return (
      <div className="vj-spec-row is-unknown">
        <dt>{label}</dt>
        <dd className="is-unknown">{unknownLabel}</dd>
      </div>
    );
  }
  if (size.kind === 'byWeight') {
    return (
      <div className="vj-spec-row">
        <dt>{label}</dt>
        <dd title={byWeightNote}>{byWeightLabel}</dd>
      </div>
    );
  }
  const text = size.kind === 'pieces' ? piecesLabel : size.text;
  const provenance =
    size.source === 'parsed-from-product-name' && size.raw ? `${provenanceLabel}: "${size.raw}"` : undefined;
  return (
    <div className="vj-spec-row">
      <dt>{label}</dt>
      <dd title={provenance}>{text}</dd>
    </div>
  );
}

export default function ProductSpecs({ product, fallbackName, fallbackQuantity }) {
  const { t } = useLanguage();

  const name = product?.name || fallbackName || null;
  // One resolver for the whole app: an explicit `quantity` field wins, then
  // the pack size parsed out of the product's own title. See
  // src/lib/productSize.js for why there is only one of these.
  const size = resolveProductSize({
    name: product?.name || fallbackName || null,
    quantity: product?.quantity || fallbackQuantity || null,
  });
  const quantity = size?.text || null;
  const hasAnySpec =
    product &&
    (product.genericName ||
      quantity ||
      product.servingSize ||
      product.ingredients ||
      product.allergens ||
      product.packaging ||
      product.nutriscore ||
      product.novaGroup ||
      (product.nutrition && product.nutrition.length > 0));

  const weightRow = (
    <WeightRow
      label={t('specsNetWeight')}
      size={size}
      unknownLabel={t('sizeUnknown')}
      byWeightLabel={t('soldByWeight')}
      byWeightNote={t('soldByWeightNote')}
      piecesLabel={size?.kind === 'pieces' ? t('piecesLabel', { count: size.count }) : null}
      provenanceLabel={t('sizeFromName')}
    />
  );

  if (!hasAnySpec) {
    // Even with no Open Food Facts record at all, the product still has a
    // name and may still have a parseable pack size in that name. The old
    // version of this branch printed neither, so a scan of an unknown
    // barcode showed one apologetic sentence and nothing identifying the
    // thing in the user's hand.
    return (
      <section className="vj-specs is-empty" aria-label={t('specsTitle')}>
        <h3 className="vj-specs-title">{t('specsTitle')}</h3>
        <p className="vj-specs-name">{name || t('unknownProductName')}</p>
        <dl className="vj-spec-list">{weightRow}</dl>
        <p className="vj-specs-unavailable">{t('specsUnavailable')}</p>
      </section>
    );
  }

  return (
    <section className="vj-specs" aria-label={t('specsTitle')}>
      <h3 className="vj-specs-title">{t('specsTitle')}</h3>

      {/* Never conditional: a spec sheet with no name on it is exactly the
          "random product" the owner objected to. */}
      <p className="vj-specs-name">{name || t('unknownProductName')}</p>

      <dl className="vj-spec-list">
        {/* The flavour/type line — "Slani krompirov čips" answers the
            owner's "what flavour chips". */}
        <Row label={t('specsFlavour')} value={product.genericName} />
        {weightRow}
        <Row label={t('specsServing')} value={product.servingSize} />
        <Row label={t('specsPackaging')} value={product.packaging} />
        <Row label={t('specsNutriscore')} value={product.nutriscore ? product.nutriscore.toUpperCase() : null} />
        <Row label={t('specsNova')} value={product.novaGroup ? String(product.novaGroup) : null} />
        <Row label={t('specsAllergens')} value={product.allergens} />
      </dl>

      {product.nutrition?.length > 0 && (
        <>
          <h4 className="vj-specs-subtitle">{t('specsNutritionTitle')}</h4>
          <dl className="vj-spec-list is-nutrition">
            {product.nutrition.map((row) => (
              <Row key={row.id} label={t(NUTRITION_LABEL[row.id] || row.id)} value={formatAmount(row.value, row.unit)} />
            ))}
          </dl>
        </>
      )}

      {product.ingredients && (
        <div className="vj-specs-ingredients">
          <h4 className="vj-specs-subtitle">{t('specsIngredients')}</h4>
          {/* Printed in the language the producer printed it in — not
              translated, because a mistranslated allergen is dangerous. */}
          <p>{product.ingredients}</p>
        </div>
      )}
    </section>
  );
}
