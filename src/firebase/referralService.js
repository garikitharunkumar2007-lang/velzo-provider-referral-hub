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

/* =====================================================
   REFERRALS COLLECTION
===================================================== */

const referralsCollection = collection(db, "referrals");

/* =====================================================
   HELPERS
===================================================== */

function cleanText(value) {
  return String(value ?? "").trim();
}

function getRewardValue(referral) {
  const possibleValues = [
    referral.paymentAmount,
    referral.rewardAmount,
    referral.rewardEarned,
    referral.referralReward,
    referral.earnings,
    referral.amount,
    referral.reward,
  ];

  const value = possibleValues.find(
    (item) =>
      item !== undefined &&
      item !== null &&
      item !== ""
  );

  const numberValue = Number(value);

  return Number.isFinite(numberValue)
    ? numberValue
    : 0;
}

/* =====================================================
   GET REFERRAL DOCUMENT REFERENCE
===================================================== */

export function getReferralRef(referralId) {
  if (!referralId) {
    throw new Error("Referral ID is required.");
  }

  return doc(db, "referrals", referralId);
}

/* =====================================================
   CREATE REFERRAL
===================================================== */

export async function createReferral({
  referrerId = "",
  referrerUid = "",
  referrerUserId = "",
  referrerEmail = "",
  referrerName = "",
  referrerPhone = "",
  providerName = "",
  phone = "",
  address = "",
  role = "",
  unionId = "",
  upiNumber = "",
  consent = false,
}) {
  const cleanReferrerId = cleanText(referrerId);
  const cleanReferrerName = cleanText(referrerName);
  const cleanReferrerPhone = cleanText(referrerPhone);

  const cleanProviderName = cleanText(providerName);
  const cleanPhone = cleanText(phone);
  const cleanAddress = cleanText(address);
  const cleanRole = cleanText(role);
  const cleanUnionId = cleanText(unionId);
  const cleanUpiNumber = cleanText(upiNumber);

  if (!cleanReferrerId) {
    throw new Error("Referrer ID is required.");
  }

  if (!cleanProviderName) {
    throw new Error("Provider name is required.");
  }

  if (!cleanPhone) {
    throw new Error(
      "Provider phone number is required."
    );
  }

  if (!cleanAddress) {
    throw new Error("Provider address is required.");
  }

  if (!cleanUpiNumber) {
    throw new Error(
      "UPI ID or payment number is required."
    );
  }

  if (!consent) {
    throw new Error(
      "Please confirm provider consent before submitting."
    );
  }

  const referralData = {
    referrerId: cleanReferrerId,
    referrerUid: cleanText(referrerUid),
    referrerUserId: cleanText(referrerUserId),
    referrerEmail: cleanText(referrerEmail),
    referrerName: cleanReferrerName,
    referrerPhone: cleanReferrerPhone,

    providerName: cleanProviderName,
    phone: cleanPhone,
    address: cleanAddress,
    role: cleanRole,
    unionId: cleanUnionId,
    upiNumber: cleanUpiNumber,

    consent: true,
    consentAt: serverTimestamp(),

    status: "pending",
    verificationStatus: "pending",
    adminStatus: "pending",
    onboardingStatus: "pending",

    reward: 0,
    rewardAmount: 0,
    rewardEarned: 0,
    referralReward: 0,
    paymentAmount: 0,

    rewardStatus: "not_earned",
    paymentStatus: "not_paid",

    matchedCollection: null,
    matchedDocumentId: null,

    rejectionReason: "",
    rejectionReasons: [],

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),

    verifiedAt: null,
    approvedAt: null,
    rejectedAt: null,
    paidAt: null,
  };

  const referralDocument = await addDoc(
    referralsCollection,
    referralData
  );

  return referralDocument.id;
}

/* =====================================================
   SUBMIT REFERRAL
   Compatibility function for ReferProvider.jsx

   Your ReferProvider.jsx imports submitReferral.
   Internally it uses createReferral.
===================================================== */

export async function submitReferral(referralData) {
  return createReferral(referralData);
}

/* =====================================================
   GET REFERRAL BY ID
===================================================== */

export async function getReferralById(referralId) {
  const referralSnapshot = await getDoc(
    getReferralRef(referralId)
  );

  if (!referralSnapshot.exists()) {
    return null;
  }

  return {
    id: referralSnapshot.id,
    ...referralSnapshot.data(),
  };
}

/* =====================================================
   GET ALL REFERRALS
===================================================== */

export async function getAllReferrals() {
  const referralsQuery = query(
    referralsCollection,
    orderBy("createdAt", "desc")
  );

  const snapshot = await getDocs(referralsQuery);

  return snapshot.docs.map((referralDocument) => ({
    id: referralDocument.id,
    ...referralDocument.data(),
  }));
}

/* =====================================================
   GET REFERRALS BY REFERRER ID
===================================================== */

export async function getReferralsByReferrerId(
  referrerId
) {
  if (!referrerId) {
    throw new Error("Referrer ID is required.");
  }

  const referralsQuery = query(
    referralsCollection,
    where("referrerId", "==", referrerId),
    orderBy("createdAt", "desc")
  );

  const snapshot = await getDocs(referralsQuery);

  return snapshot.docs.map((referralDocument) => ({
    id: referralDocument.id,
    ...referralDocument.data(),
  }));
}

/* =====================================================
   GET REFERRALS BY STATUS
===================================================== */

export async function getReferralsByStatus(status) {
  if (!status) {
    throw new Error("Referral status is required.");
  }

  const referralsQuery = query(
    referralsCollection,
    where("status", "==", status),
    orderBy("createdAt", "desc")
  );

  const snapshot = await getDocs(referralsQuery);

  return snapshot.docs.map((referralDocument) => ({
    id: referralDocument.id,
    ...referralDocument.data(),
  }));
}

/* =====================================================
   GET REFERRALS BY ADMIN STATUS
===================================================== */

export async function getReferralsByAdminStatus(
  adminStatus
) {
  if (!adminStatus) {
    throw new Error(
      "Referral admin status is required."
    );
  }

  const referralsQuery = query(
    referralsCollection,
    where("adminStatus", "==", adminStatus),
    orderBy("createdAt", "desc")
  );

  const snapshot = await getDocs(referralsQuery);

  return snapshot.docs.map((referralDocument) => ({
    id: referralDocument.id,
    ...referralDocument.data(),
  }));
}

/* =====================================================
   UPDATE REFERRAL ADMIN STATUS
===================================================== */

export async function updateReferralAdminStatus(
  referralId,
  adminStatus,
  rejectionReason = ""
) {
  if (!referralId) {
    throw new Error("Referral ID is required.");
  }

  if (!adminStatus) {
    throw new Error(
      "Referral admin status is required."
    );
  }

  const updates = {
    adminStatus,
    updatedAt: serverTimestamp(),
  };

  if (adminStatus === "approved") {
    updates.status = "successful";
    updates.verificationStatus = "verified";
    updates.approvedAt = serverTimestamp();
  }

  if (adminStatus === "rejected") {
    const reasonText = Array.isArray(rejectionReason)
      ? rejectionReason
          .map((item) => cleanText(item))
          .filter(Boolean)
          .join(", ")
      : cleanText(rejectionReason);

    updates.status = "rejected";
    updates.verificationStatus = "rejected";
    updates.rejectedAt = serverTimestamp();

    updates.rejectionReason = reasonText;
    updates.rejectionReasons = reasonText
      ? [reasonText]
      : [];
  }

  await updateDoc(
    getReferralRef(referralId),
    updates
  );

  return {
    success: true,
    message:
      "Referral admin status updated successfully.",
  };
}

/* =====================================================
   UPDATE ONBOARDING STATUS
===================================================== */

export async function updateReferralOnboardingStatus(
  referralId,
  onboardingStatus
) {
  if (!referralId) {
    throw new Error("Referral ID is required.");
  }

  if (!onboardingStatus) {
    throw new Error(
      "Onboarding status is required."
    );
  }

  await updateDoc(
    getReferralRef(referralId),
    {
      onboardingStatus,
      updatedAt: serverTimestamp(),
    }
  );

  return {
    success: true,
    message:
      "Referral onboarding status updated successfully.",
  };
}

/* =====================================================
   GET REFERRAL STATISTICS
===================================================== */

export async function getReferralStats() {
  const snapshot = await getDocs(
    referralsCollection
  );

  const referrals = snapshot.docs.map(
    (referralDocument) =>
      referralDocument.data()
  );

  return {
    totalReferrals: referrals.length,

    pendingReferrals: referrals.filter(
      (referral) =>
        referral.status === "pending"
    ).length,

    approvedReferrals: referrals.filter(
      (referral) =>
        referral.adminStatus === "approved"
    ).length,

    rejectedReferrals: referrals.filter(
      (referral) =>
        referral.adminStatus === "rejected"
    ).length,

    verifiedReferrals: referrals.filter(
      (referral) =>
        referral.verificationStatus === "verified"
    ).length,

    completedOnboarding: referrals.filter(
      (referral) =>
        referral.onboardingStatus === "completed"
    ).length,

    totalRewards: referrals.reduce(
      (total, referral) =>
        total + getRewardValue(referral),
      0
    ),

    paidRewards: referrals
      .filter(
        (referral) =>
          referral.paymentStatus === "completed" ||
          referral.paymentStatus === "paid" ||
          referral.status === "paid"
      )
      .reduce(
        (total, referral) =>
          total + getRewardValue(referral),
        0
      ),
  };
}

/* =====================================================
   DEFAULT EXPORT
===================================================== */

export default {
  getReferralRef,
  createReferral,
  submitReferral,
  getReferralById,
  getAllReferrals,
  getReferralsByReferrerId,
  getReferralsByStatus,
  getReferralsByAdminStatus,
  updateReferralAdminStatus,
  updateReferralOnboardingStatus,
  getReferralStats,
};