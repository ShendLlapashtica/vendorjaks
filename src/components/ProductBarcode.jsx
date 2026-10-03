import { useLanguage } from '../i18n/LanguageContext.jsx';
import { isPlausibleBarcode } from '../lib/gs1.js';

// THE BARCODE, ON EVERY PRODUCT SURFACE.
//
// Owner, 2026-09-16: "show always barcode for it".
//
// The barcode is the app's evidence for the entire verdict. Everything the
// origin screen says is derived from these digits, so a shopper has to be
// able to read them off the screen and compare them with the number printed
// on the pack in their hand. A verdict whose evidence is hidden is an
// assertion, not a check.
//
// ABSENCE IS THE MOST IMPORTANT CAVEAT ON THE SCREEN, so it is stated, never
// hidden. Only 41.5% of data/kosovo-retail.json rows carry a barcode; the
// other 58.5% get "pa barkod" in the same slot, in the same place, with a
// title explaining that the origin verdict is correspondingly weaker.
// Rendering nothing would let a shopper assume the app had checked.
//
// A THIRD CASE, added after the UJE DEA bug (2026-09-16): some retailer
// exports put an internal SKU in the `barcode` field — "VIVA000003663",
// "P0241", "PLU-601". Those are shown verbatim (they are what the shop
// published) but marked as not-a-barcode, because they name no GS1 office
// and the app must not imply they were checked against one.
//
// Digits use var(--mono); it is the convention for digit strings here.
export default function ProductBarcode({ product, className = '', size = 'sm' }) {
  const { t } = useLanguage();
  const raw = product?.code || product?.barcode || null;
  const value = raw ? String(raw).trim() : '';

  if (!value) {
    return (
      <span
        className={`vj-barcode is-${size} is-absent ${className}`.trim()}
        title={t('barcodeNoneNote')}
        aria-label={t('barcodeNoneWhy')}
      >
        <span className="vj-barcode-label">{t('barcodeLabel')}</span>
        <span className="vj-barcode-value">{t('barcodeNone')}</span>
      </span>
    );
  }

  // Not a GTIN — a shelf/PLU/SKU string. Shown, but never dressed up as
  // evidence of an origin.
  const usable = isPlausibleBarcode(value);

  return (
    <span
      className={`vj-barcode is-${size} ${usable ? 'is-gtin' : 'is-sku'} ${className}`.trim()}
      title={usable ? t('barcodeCheckPack') : t('barcodeNoneNote')}
    >
      <span className="vj-barcode-label">{t('barcodeLabel')}</span>
      <span className="vj-barcode-value">{value}</span>
      {!usable && <span className="vj-barcode-skunote">{t('barcodeNone')}</span>}
    </span>
  );
}
