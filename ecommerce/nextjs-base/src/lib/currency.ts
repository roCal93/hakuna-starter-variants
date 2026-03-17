const DEFAULT_LOCALE = "fr-FR";
const DEFAULT_CURRENCY = "EUR";

/**
 * Format a price (in euros, not cents) for display.
 * e.g. formatPrice(29.99) → "29,99 €"
 */
export function formatPrice(
  amount: number,
  currency = DEFAULT_CURRENCY,
  locale = DEFAULT_LOCALE
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Convert a euro amount to cents for Stripe.
 * e.g. toCents(29.99) → 2999
 */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

/**
 * Convert cents back to a decimal euro amount.
 * e.g. fromCents(2999) → 29.99
 */
export function fromCents(cents: number): number {
  return cents / 100;
}
