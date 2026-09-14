// src/firebase/verifiedProviderService.js

import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "./firebaseConfig";
import APP_CONFIG from "../config/appConfig";

const VERIFIED_PROVIDERS_COLLECTION =
  APP_CONFIG.firestoreCollections.verifiedProviders;

const REFERRALS_COLLECTION =
  APP_CONFIG.firestoreCollections.referrals;

/**
 * Converts any phone number format into a comparable 10-digit number.
 *
 * Examples:
 * 9494314913
 * +91 9494314913
 * +919494314913
 *
 * All become:
 * 9494314913
 */
export function normalizePhoneNumber(value) {
  if (value === null || value === undefined) {
    return "";
  }

  const digits = String(value).replace(/\D/g, "");

  if (digits.length >= 10) {
    return digits.slice(-10);
  }

  return digits;
}

/**
 * Finds an existing provider inside verifiedProviders
 * using the provider mobile number.
 */
export async function findVerifiedProviderByPhone(phoneNumber) {
  const normalizedPhone = normalizePhoneNumber(phoneNumber);

  if (!normalizedPhone || normalizedPhone.length !== 10) {
    return null;
  }

  const verifiedProvidersRef = collection(
    db,
    VERIFIED_PROVIDERS_COLLECTION
  );

  /*
   * We check both possible fields because older documents
   * may contain phoneNumber and newer documents may contain
   * providerPhone.
   */
  const phoneNumberQuery = query(
    verifiedProvidersRef,
    where("phoneNumber", "==", normalizedPhone),
    limit(1)
  );

  const providerPhoneQuery = query(
    verifiedProvidersRef,
    where("providerPhone", "==", normalizedPhone),
    limit(1)
  );

  const [phoneNumberSnapshot, providerPhoneSnapshot] =
    await Promise.all([
      getDocs(phoneNumberQuery),
      getDocs(providerPhoneQuery),
    ]);

  if (!phoneNumberSnapshot.empty) {
    const providerDoc = phoneNumberSnapshot.docs[0];

    return {
      id: providerDoc.id,
      ...providerDoc.data(),
    };
  }

  if (!providerPhoneSnapshot.empty) {
    const providerDoc = providerPhoneSnapshot.docs[0];

    return {
      id: providerDoc.id,
      ...providerDoc.data(),
    };
  }

  return null;
}

/**
 * Automatically rejects a referral when the same provider
 * already exists in verifiedProviders.
 */
export async function rejectDuplicateReferral({
  referralId,
  providerPhone,
}) {
  if (!referralId) {
    throw new Error("Referral ID is required.");
  }

  const existingProvider =
    await findVerifiedProviderByPhone(providerPhone);

  if (!existingProvider) {
    return {
      isDuplicate: false,
      existingProvider: null,
    };
  }

  const referralRef = doc(
    db,
    REFERRALS_COLLECTION,
    referralId
  );

  const existingProviderName =
    existingProvider.providerName ||
    existingProvider.name ||
    "Existing verified provider";

  const normalizedPhone = normalizePhoneNumber(providerPhone);

  await updateDoc(referralRef, {
    status: "rejected",
    currentStatus: "rejected",
    adminStatus: "rejected",
    verificationStatus: "rejected",
    paymentStatus: "not_paid",
    rewardStatus: "not_paid",

    rejectionReason:
      "This provider already exists in verifiedProviders with the same mobile number.",

    duplicateProviderId: existingProvider.id,
    duplicateProviderName: existingProviderName,
    duplicateProviderPhone: normalizedPhone,

    isDuplicateProvider: true,
    duplicateChecked: true,
    duplicateCheckedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return {
    isDuplicate: true,
    existingProvider: {
      id: existingProvider.id,
      name: existingProviderName,
      phoneNumber: normalizedPhone,
    },
  };
}

/**
 * Checks a referral without changing it.
 */
export async function checkReferralForDuplicateProvider(
  referral
) {
  if (!referral) {
    return {
      isDuplicate: false,
      existingProvider: null,
    };
  }

  const providerPhone =
    referral.providerPhone ||
    referral.phoneNumber ||
    referral.providerMobile ||
    referral.mobileNumber ||
    referral.phone ||
    "";

  const existingProvider =
    await findVerifiedProviderByPhone(providerPhone);

  return {
    isDuplicate: Boolean(existingProvider),
    existingProvider,
  };
}