// Small display-formatting helpers shared by the catalog grid and product
// detail screen.

/** Formats a numeric price with its currency, e.g. formatPrice(1.5, 'EUR') -> "1.50 EUR". */
export function formatPrice(price, currency) {
  if (typeof price !== 'number' || !Number.isFinite(price)) return null;
  const amount = price.toFixed(2);
  return currency ? `${amount} ${currency}` : amount;
}
