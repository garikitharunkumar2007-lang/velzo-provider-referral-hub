/**
 * Convert Firebase Timestamp, Date, string or number
 * into a JavaScript Date object.
 */
export function toDate(value) {
  if (!value) {
    return null;
  }

  // Firebase Timestamp
  if (typeof value?.toDate === "function") {
    return value.toDate();
  }

  // JavaScript Date
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  // Firestore timestamp-like object
  if (
    typeof value === "object" &&
    typeof value.seconds === "number"
  ) {
    return new Date(
      value.seconds * 1000 +
        Math.floor((value.nanoseconds || 0) / 1000000)
    );
  }

  // String or number
  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate;
}

/**
 * Format date into Indian date format.
 *
 * Example:
 * 12/09/2026
 */
export function formatDate(value, fallback = "—") {
  const date = toDate(value);

  if (!date) {
    return fallback;
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

/**
 * Format date and time.
 *
 * Example:
 * 12/09/2026, 10:30 AM
 */
export function formatDateTime(value, fallback = "—") {
  const date = toDate(value);

  if (!date) {
    return fallback;
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

/**
 * Format only time.
 *
 * Example:
 * 10:30 AM
 */
export function formatTime(value, fallback = "—") {
  const date = toDate(value);

  if (!date) {
    return fallback;
  }

  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

/**
 * Format date in readable form.
 *
 * Example:
 * 12 September 2026
 */
export function formatReadableDate(
  value,
  fallback = "—"
) {
  const date = toDate(value);

  if (!date) {
    return fallback;
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/**
 * Show relative time.
 *
 * Example:
 * Just now
 * 5 minutes ago
 * 2 hours ago
 * 3 days ago
 */
export function formatRelativeTime(
  value,
  fallback = "—"
) {
  const date = toDate(value);

  if (!date) {
    return fallback;
  }

  const now = new Date();
  const differenceInSeconds = Math.floor(
    (now.getTime() - date.getTime()) / 1000
  );

  if (differenceInSeconds < 0) {
    return "Just now";
  }

  if (differenceInSeconds < 60) {
    return "Just now";
  }

  const minutes = Math.floor(
    differenceInSeconds / 60
  );

  if (minutes < 60) {
    return `${minutes} minute${
      minutes === 1 ? "" : "s"
    } ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours} hour${
      hours === 1 ? "" : "s"
    } ago`;
  }

  const days = Math.floor(hours / 24);

  if (days < 7) {
    return `${days} day${
      days === 1 ? "" : "s"
    } ago`;
  }

  return formatDate(value, fallback);
}

export default formatDate;