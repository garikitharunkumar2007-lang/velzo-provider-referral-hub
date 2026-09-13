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

import {
  db,
} from "../firebase/firebaseConfig";

const referralsCollection = collection(
  db,
  "referrals"
);

/**
 * Get referral document reference.
 */
export function getReferralRef(referralId) {
  if (!referralId) {
    throw new Error("Referral ID is required.");
  }

  return doc(db, "referrals", referralId);
}

/**
 * Create a referral.
 *
 * Note:
 * Referral verification and reward approval must be
 * performed by secure backend Cloud Functions.
 */
export async function createReferral({
  referrerId = "",
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
  const cleanProviderName = String(
    providerName
  ).trim();

  const cleanPhone = String(phone).trim();

  const cleanAddress = String(address).trim();

  const cleanRole = String(role).trim();

  const cleanUnionId = String(unionId).trim();

  const cleanUpiNumber = String(
    upiNumber
  ).trim();

  if (!referrerId) {
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
    referrerId,
    referrerName,
    referrerPhone,

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
    rewardStatus: "not_earned",
    paymentStatus: "not_paid",

    matchedCollection: null,
    matchedDocumentId: null,
    rejectionReason: [],

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

/**
 * Get referral by ID.
 */
export async function getReferralById(
  referralId
) {
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

/**
 * Get all referrals.
 */
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

/**
 * Get referrals submitted by a user.
 */
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

/**
 * Get referrals by status.
 */
export async function getReferralsByStatus(
  status
) {
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

/**
 * Get referrals by admin status.
 */
export async function getReferralsByAdminStatus(
  adminStatus
) {
  if (!adminStatus) {
    throw new Error(
      "Admin referral status is required."
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

/**
 * Update referral admin status.
 *
 * This function should eventually be called through
 * a protected Cloud Function for production security.
 */
export async function updateReferralAdminStatus(
  referralId,
  adminStatus,
  rejectionReason = []
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
    updates.approvedAt = serverTimestamp();
  }

  if (adminStatus === "rejected") {
    updates.rejectedAt = serverTimestamp();
    updates.rejectionReason =
      Array.isArray(rejectionReason)
        ? rejectionReason
        : [String(rejectionReason)];
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

/**
 * Update referral onboarding status.
 */
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

/**
 * Get referral statistics.
 */
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
        total + Number(referral.reward || 0),
      0
    ),

    paidRewards: referrals
      .filter(
        (referral) =>
          referral.paymentStatus === "paid"
      )
      .reduce(
        (total, referral) =>
          total + Number(referral.reward || 0),
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