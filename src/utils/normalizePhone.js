/**
 * Normalize Indian phone numbers into 10-digit format.
 *
 * Supported inputs:
 * 9876543210
 * +919876543210
 * 919876543210
 * 09876543210
 * "98765 43210"
 * "98765-43210"
 */

export function normalizePhone(value) {
  if (value === null || value === undefined) {
    return "";
  }

  let phone = String(value).trim();

  // Remove spaces, hyphens, brackets and other symbols.
  phone = phone.replace(/\D/g, "");

  // Remove India's country code.
  if (phone.startsWith("91") && phone.length === 12) {
    phone = phone.substring(2);
  }

  // Remove leading zero.
  if (phone.startsWith("0") && phone.length === 11) {
    phone = phone.substring(1);
  }

  return phone;
}

/**
 * Validate Indian mobile number.
 */
export function isValidIndianPhone(value) {
  const phone = normalizePhone(value);

  // Indian mobile numbers generally start with 6, 7, 8 or 9.
  return /^[6-9]\d{9}$/.test(phone);
}

/**
 * Convert a phone number into the VELZO synthetic email format.
 *
 * Example:
 * 9876543210 -> 9876543210@velzo.com
 */
export function phoneToVelzoEmail(value) {
  const phone = normalizePhone(value);

  if (!isValidIndianPhone(phone)) {
    throw new Error("Please enter a valid Indian mobile number.");
  }

  return `${phone}@velzo.com`;
}

/**
 * Format a phone number for display.
 *
 * Example:
 * 9876543210 -> +91 98765 43210
 */
export function formatIndianPhone(value) {
  const phone = normalizePhone(value);

  if (!isValidIndianPhone(phone)) {
    return phone;
  }

  return `+91 ${phone.substring(0, 5)} ${phone.substring(5)}`;
}

/**
 * Mask phone number for privacy.
 *
 * Example:
 * 9876543210 -> 98765XXXXX
 */
export function maskPhone(value) {
  const phone = normalizePhone(value);

  if (!phone) {
    return "";
  }

  if (phone.length <= 4) {
    return phone;
  }

  return `${phone.substring(0, 5)}XXXXX`;
}

export default normalizePhone;