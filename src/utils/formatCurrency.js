/**
 * Format a number as Indian Rupees.
 *
 * Example:
 * formatCurrency(1000) -> ₹1,000
 * formatCurrency(1250.5) -> ₹1,250.50
 */

export function formatCurrency(
  amount,
  options = {}
) {
  const {
    showDecimals = false,
    fallback = "₹0",
  } = options;

  if (
    amount === null ||
    amount === undefined ||
    amount === "" ||
    Number.isNaN(Number(amount))
  ) {
    return fallback;
  }

  const numericAmount = Number(amount);

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(numericAmount);
}

/**
 * Format currency without the currency symbol.
 *
 * Example:
 * formatAmount(1000) -> 1,000
 */
export function formatAmount(
  amount,
  showDecimals = false
) {
  if (
    amount === null ||
    amount === undefined ||
    amount === "" ||
    Number.isNaN(Number(amount))
  ) {
    return "0";
  }

  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(Number(amount));
}

/**
 * Convert any value into a safe numeric amount.
 *
 * Example:
 * parseAmount("₹1,250") -> 1250
 */
export function parseAmount(value) {
  if (value === null || value === undefined) {
    return 0;
  }

  const cleanedValue = String(value)
    .replace(/₹/g, "")
    .replace(/,/g, "")
    .trim();

  const parsedValue = Number(cleanedValue);

  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

export default formatCurrency;