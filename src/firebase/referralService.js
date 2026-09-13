import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";

import { getAuth } from "firebase/auth";

import { db } from "./firebaseConfig";

export async function submitReferral({
  fullName,
  phone,
  address,
  role,
  unionId,
  upiNumber,
  consent,
}) {
  const auth = getAuth();
  const currentUser = auth.currentUser;

  if (!currentUser) {
    throw new Error(
      "Your session has expired. Please login again."
    );
  }

  const cleanName = String(fullName || "").trim();
  const cleanPhone = String(phone || "")
    .replace(/\D/g, "")
    .trim();

  const cleanAddress = String(address || "").trim();
  const cleanRole = String(role || "").trim();
  const cleanUnionId = String(unionId || "").trim();
  const cleanUpiNumber = String(upiNumber || "").trim();

  if (!cleanName) {
    throw new Error("Provider full name is required.");
  }

  if (!/^\d{10}$/.test(cleanPhone)) {
    throw new Error(
      "Please enter a valid 10-digit provider phone number."
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

  if (consent !== true) {
    throw new Error(
      "Provider consent is required before submitting the referral."
    );
  }

  /*
   * Resolve the actual logged-in referrer.
   *
   * The Firebase Auth UID is authoritative.
   * The profile name is loaded from users/{phone}.
   */

  const authEmail = currentUser.email || "";

  const phoneFromAuth = authEmail
    .replace("@velzo.com", "")
    .replace(/\D/g, "");

  let referrerName = "VELZO User";
  let referrerPhone = phoneFromAuth;

  if (phoneFromAuth) {
    const userRef = doc(db, "users", phoneFromAuth);
    const userSnapshot = await getDoc(userRef);

    if (userSnapshot.exists()) {
      const userData = userSnapshot.data();

      referrerName =
        String(userData.name || "").trim() ||
        currentUser.displayName ||
        "VELZO User";

      referrerPhone =
        String(userData.phone || "").trim() ||
        phoneFromAuth;
    } else {
      referrerName =
        currentUser.displayName ||
        "VELZO User";
    }
  }

  const referralData = {
    // Actual logged-in referrer
    referrerId: currentUser.uid,
    referrerName,
    referrerPhone,

    // Provider details
    providerName: cleanName,
    phone: cleanPhone,
    address: cleanAddress,
    role: cleanRole,
    unionId: cleanUnionId,

    // Reward payment destination
    upiNumber: cleanUpiNumber,

    // Consent
    consent: true,
    consentGivenByUid: currentUser.uid,
    consentRecordedAt: serverTimestamp(),

    // Verification workflow
    status: "pending",
    verificationStatus: "pending",
    adminStatus: "pending",
    onboardingStatus: "pending",

    // Reward workflow
    reward: 0,
    rewardStatus: "not_earned",
    paymentStatus: "not_paid",

    // Audit timestamps
    createdAt: serverTimestamp(),
    verifiedAt: null,
    approvedAt: null,
    rejectedAt: null,
    onboardingCompletedAt: null,
    rewardPaidAt: null,

    // Verification result fields
    rejectionReason: [],
    matchedCollection: null,
    matchedMasterId: null,

    // Audit information
    submittedByUid: currentUser.uid,
  };

  try {
    const referralReference = await addDoc(
      collection(db, "referrals"),
      referralData
    );

    return referralReference.id;
  } catch (error) {
    console.error(
      "Referral Firestore write failed:",
      error
    );

    throw new Error(
      "Referral could not be submitted. Please try again."
    );
  }
}