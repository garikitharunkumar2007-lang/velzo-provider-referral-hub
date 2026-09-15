// src/utils/referralIdentity.js

/**
 * Normalize Indian phone number to the last 10 digits.
 */
export function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  return digits.slice(-10);
}

/**
 * Get a stable VELZO referral owner ID.
 *
 * Priority:
 * 1. Firestore profile document ID
 * 2. Explicit user ID
 * 3. Phone number
 *
 * Do not use anonymous Firebase UID as the primary referral owner ID.
 */
export function getReferralOwnerId(user) {
  if (!user) {
    return "";
  }

  const candidates = [
    user.id,
    user.userId,
    user.profile?.id,
    user.userData?.id,
    user.phone,
    user.phoneNumber,
    user.profile?.phone,
    user.profile?.phoneNumber,
    user.userData?.phone,
    user.userData?.phoneNumber,
  ];

  for (const candidate of candidates) {
    const value = String(candidate || "").trim();

    if (!value) {
      continue;
    }

    const normalizedPhone = normalizePhone(value);

    if (normalizedPhone.length === 10) {
      return normalizedPhone;
    }

    return value;
  }

  return "";
}

/**
 * Get all identity values supported by old and new records.
 */
export function getReferralOwnerIdentityValues(user) {
  if (!user) {
    return [];
  }

  const values = [
    getReferralOwnerId(user),
    user.uid,
    user.id,
    user.userId,
    user.phone,
    user.phoneNumber,
    user.profile?.id,
    user.profile?.phone,
    user.userData?.id,
    user.userData?.phone,
  ];

  return [
    ...new Set(
      values
        .filter(Boolean)
        .map((value) => String(value).trim())
        .filter(Boolean)
    ),
  ];
}

/**
 * Build referrer fields for every newly created referral.
 *
 * referrerId is the stable primary owner ID.
 * referrerUid is retained only for compatibility.
 */
export function getReferralOwnerDetails(user) {
  const ownerId = getReferralOwnerId(user);

  if (!ownerId) {
    throw new Error(
      "Your VELZO account identity could not be detected. Please logout and login again."
    );
  }

  return {
    referrerId: ownerId,
    referrerUserId: ownerId,
    referrerUid: user?.uid || "",
    referrerName:
      user?.name ||
      user?.displayName ||
      user?.fullName ||
      "",
    referrerPhone:
      user?.phone ||
      user?.phoneNumber ||
      user?.profile?.phone ||
      user?.profile?.phoneNumber ||
      "",
    referrerEmail: user?.email || "",
  };
}