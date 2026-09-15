// src/services/referralService.js

import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "../firebase/firebaseConfig";

const referralsCollection = collection(db, "referrals");

function cleanText(value) {
  return String(value || "").trim();
}

/**
 * Get referral document reference.
 */
export function getReferralRef(referralId) {
  const cleanReferralId = cleanText(referralId);

  if (!cleanReferralId) {
    throw new Error("Referral ID is required.");
  }

  return doc(db, "referrals", cleanReferralId);
}

/**
 * Create a referral.
 */
export async function createReferral({
  referrerId = "",
  referrerUserId = "",
  referrerUid = "",
  referrerName = "",
  referrerPhone = "",
  referrerEmail = "",

  providerName = "",
  fullName = "",
  phone = "",
  address = "",
  role = "",
  unionId = "",
  upiNumber = "",
  consent = false,
}) {
  const cleanReferrerId = cleanText(referrerId);
  const cleanReferrerUserId = cleanText(
    referrerUserId || referrerId
  );
  const cleanReferrerUid = cleanText(referrerUid);

  const cleanReferrerName = cleanText(referrerName);
  const cleanReferrerPhone = cleanText(referrerPhone);
  const cleanReferrerEmail = cleanText(referrerEmail);

  const cleanProviderName = cleanText(
    providerName || fullName
  );
  const cleanPhone = cleanText(phone);
  const cleanAddress = cleanText(address);
  const cleanRole = cleanText(role);
  const cleanUnionId = cleanText(unionId);
  const cleanUpiNumber = cleanText(upiNumber);

  if (!cleanReferrerId) {
    throw new Error(
      "Your account identity is missing. Please login again."
    );
  }

  if (!cleanProviderName) {
    throw new Error("Provider name is required.");
  }

  if (!/^\d{10}$/.test(cleanPhone)) {
    throw new Error(
      "Provider phone number must contain 10 digits."
    );
  }

  if (!cleanAddress) {
    throw new Error("Provider address is required.");
  }

  if (!cleanRole) {
    throw new Error("Provider role is required.");
  }

  if (!cleanUpiNumber) {
    throw new Error(
      "PhonePe, Google Pay number or UPI ID is required."
    );
  }

  if (!consent) {
    throw new Error(
      "Provider consent is required before submission."
    );
  }

  const referralData = {
    // Stable ownership fields
    referrerId: cleanReferrerId,
    referrerUserId: cleanReferrerUserId,
    referrerUid: cleanReferrerUid,

    referrerName: cleanReferrerName,
    referrerPhone: cleanReferrerPhone,
    referrerEmail: cleanReferrerEmail,

    // Provider details
    providerName: cleanProviderName,
    fullName: cleanProviderName,
    phone: cleanPhone,
    providerPhone: cleanPhone,
    address: cleanAddress,
    role: cleanRole,
    unionId: cleanUnionId,
    upiNumber: cleanUpiNumber,

    // Consent
    consent: true,
    consentAt: serverTimestamp(),

    // Status
    status: "pending",
    verificationStatus: "pending",
    adminStatus: "pending",
    onboardingStatus: "pending",

    // Reward
    reward: 0,
    rewardStatus: "not_earned",
    paymentStatus: "not_paid",

    // Verification data
    matchedCollection: null,
    matchedDocumentId: null,
    rejectionReason: [],

    // Timestamps
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    verifiedAt: null,
    approvedAt: null,
    rejectedAt: null,
    paidAt: null,
  };

  const createdDocument = await addDoc(
    referralsCollection,
    referralData
  );

  return createdDocument.id;
}

/**
 * Get one referral.
 */
export async function getReferralById(referralId) {
  const snapshot = await getDoc(
    getReferralRef(referralId)
  );

  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
}

/**
 * Admin-only function.
 *
 * Use this only from admin pages protected by role checks.
 */
export async function getAllReferrals() {
  const referralsQuery = query(
    referralsCollection,
    orderBy("createdAt", "desc")
  );

  const snapshot = await getDocs(referralsQuery);

  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  }));
}

/**
 * Get only referrals belonging to one referrer.
 */
export async function getReferralsByReferrerId(
  referrerId
) {
  const cleanReferrerId = cleanText(referrerId);

  if (!cleanReferrerId) {
    throw new Error("Referrer ID is required.");
  }

  const referralsQuery = query(
    referralsCollection,
    where("referrerId", "==", cleanReferrerId),
    orderBy("createdAt", "desc")
  );

  const snapshot = await getDocs(referralsQuery);

  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  }));
}

/**
 * Get referrals by status.
 *
 * Admin use only.
 */
export async function getReferralsByStatus(status) {
  const cleanStatus = cleanText(status);

  if (!cleanStatus) {
    throw new Error("Referral status is required.");
  }

  const referralsQuery = query(
    referralsCollection,
    where("status", "==", cleanStatus),
    orderBy("createdAt", "desc")
  );

  const snapshot = await getDocs(referralsQuery);

  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  }));
}

/**
 * Get referrals by admin status.
 *
 * Admin use only.
 */
export async function getReferralsByAdminStatus(
  adminStatus
) {
  const cleanStatus = cleanText(adminStatus);

  if (!cleanStatus) {
    throw new Error(
      "Referral admin status is required."
    );
  }

  const referralsQuery = query(
    referralsCollection,
    where("adminStatus", "==", cleanStatus),
    orderBy("createdAt", "desc")
  );

  const snapshot = await getDocs(referralsQuery);

  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  }));
}

/**
 * Update admin status.
 *
 * This should ideally be moved to a protected Cloud Function.
 */
export async function updateReferralAdminStatus(
  referralId,
  adminStatus,
  rejectionReason = []
) {
  const cleanReferralId = cleanText(referralId);
  const cleanStatus = cleanText(adminStatus);

  if (!cleanReferralId) {
    throw new Error("Referral ID is required.");
  }

  if (!cleanStatus) {
    throw new Error(
      "Referral admin status is required."
    );
  }

  const updates = {
    adminStatus: cleanStatus,
    updatedAt: serverTimestamp(),
  };

  if (cleanStatus === "approved") {
    updates.approvedAt = serverTimestamp();
  }

  if (cleanStatus === "rejected") {
    updates.rejectedAt = serverTimestamp();
    updates.rejectionReason = Array.isArray(
      rejectionReason
    )
      ? rejectionReason
      : [cleanText(rejectionReason)];
  }

  await updateDoc(
    getReferralRef(cleanReferralId),
    updates
  );

  return {
    success: true,
    message:
      "Referral admin status updated successfully.",
  };
}

/**
 * Update onboarding status.
 */
export async function updateReferralOnboardingStatus(
  referralId,
  onboardingStatus
) {
  const cleanReferralId = cleanText(referralId);
  const cleanStatus = cleanText(onboardingStatus);

  if (!cleanReferralId) {
    throw new Error("Referral ID is required.");
  }

  if (!cleanStatus) {
    throw new Error(
      "Onboarding status is required."
    );
  }

  await updateDoc(
    getReferralRef(cleanReferralId),
    {
      onboardingStatus: cleanStatus,
      updatedAt: serverTimestamp(),
    }
  );

  return {
    success: true,
    message:
      "Referral onboarding status updated successfully.",
  };
}

/**
 * Admin statistics.
 */
export async function getReferralStats() {
  const snapshot = await getDocs(
    referralsCollection
  );

  const referrals = snapshot.docs.map((item) =>
    item.data()
  );

  return {
    totalReferrals: referrals.length,

    pendingReferrals: referrals.filter(
      (item) => item.status === "pending"
    ).length,

    approvedReferrals: referrals.filter(
      (item) => item.adminStatus === "approved"
    ).length,

    rejectedReferrals: referrals.filter(
      (item) => item.adminStatus === "rejected"
    ).length,

    verifiedReferrals: referrals.filter(
      (item) =>
        item.verificationStatus === "verified"
    ).length,

    completedOnboarding: referrals.filter(
      (item) =>
        item.onboardingStatus === "completed"
    ).length,

    totalRewards: referrals.reduce(
      (total, item) =>
        total + Number(item.reward || 0),
      0
    ),

    paidRewards: referrals
      .filter(
        (item) => item.paymentStatus === "paid"
      )
      .reduce(
        (total, item) =>
          total + Number(item.reward || 0),
        0
      ),
  };
}

export default {
  getReferralRef,
  createReferral,
  getReferralById,
  getAllReferrals,
  getReferralsByReferrerId,
  getReferralsByStatus,
  getReferralsByAdminStatus,
  updateReferralAdminStatus,
  updateReferralOnboardingStatus,
  getReferralStats,
};