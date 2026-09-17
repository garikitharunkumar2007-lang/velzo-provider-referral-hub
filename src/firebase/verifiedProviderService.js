// src/firebase/verifiedProviderService.js

import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { db } from "./firebaseConfig";
import APP_CONFIG from "../config/appConfig";

const REFERRALS_COLLECTION =
  APP_CONFIG.firestoreCollections.referrals;

const PROVIDER_CHECK_COLLECTIONS = [
  "tadepalligudem_mechanics",
  "tanuku_plumbers",
  "tanuku_mechanics",
  "union_master_list",
  "verifiedProviders",
];

const PHONE_FIELD_NAMES = [
  "phone",
  "phoneNumber",
  "providerPhone",
  "providerMobile",
  "mobile",
  "mobileNumber",
  "mobileNo",
  "phoneNo",
  "contactNumber",
  "contactPhone",
  "whatsappNumber",
  "whatsapp",
];

export function normalizePhoneNumber(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  const digits = String(value).replace(
    /\D/g,
    ""
  );

  if (digits.length >= 10) {
    return digits.slice(-10);
  }

  return digits;
}

function getPossiblePhoneValues(
  data
) {
  if (
    !data ||
    typeof data !== "object"
  ) {
    return [];
  }

  const values = [];

  for (const fieldName of PHONE_FIELD_NAMES) {
    if (
      data[fieldName] !== undefined &&
      data[fieldName] !== null
    ) {
      values.push(data[fieldName]);
    }
  }

  for (const value of Object.values(data)) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      values.push(
        ...getPossiblePhoneValues(value)
      );
    }
  }

  return values;
}

function documentContainsPhone(
  documentData,
  normalizedPhone
) {
  const phoneValues =
    getPossiblePhoneValues(
      documentData
    );

  return phoneValues.some(
    (value) =>
      normalizePhoneNumber(value) ===
      normalizedPhone
  );
}

async function findPhoneInCollection(
  collectionName,
  normalizedPhone
) {
  const collectionReference =
    collection(
      db,
      collectionName
    );

  const snapshot =
    await getDocs(
      collectionReference
    );

  for (const providerDocument of snapshot.docs) {
    const providerData =
      providerDocument.data();

    if (
      documentContainsPhone(
        providerData,
        normalizedPhone
      )
    ) {
      return {
        id: providerDocument.id,
        collectionName,
        ...providerData,
      };
    }
  }

  return null;
}

/**
 * Checks all required provider collections:
 *
 * 1. tadepalligudem_mechanics
 * 2. tanuku_plumbers
 * 3. tanuku_mechanics
 * 4. union_master_list
 * 5. verifiedProviders
 */
export async function findVerifiedProviderByPhone(
  phoneNumber
) {
  const normalizedPhone =
    normalizePhoneNumber(
      phoneNumber
    );

  if (
    normalizedPhone.length !== 10
  ) {
    return null;
  }

  for (const collectionName of PROVIDER_CHECK_COLLECTIONS) {
    const existingProvider =
      await findPhoneInCollection(
        collectionName,
        normalizedPhone
      );

    if (existingProvider) {
      return existingProvider;
    }
  }

  return null;
}

export async function checkProviderPhoneExists(
  phoneNumber
) {
  const existingProvider =
    await findVerifiedProviderByPhone(
      phoneNumber
    );

  return {
    isDuplicate:
      Boolean(existingProvider),
    existingProvider,
  };
}

export async function rejectDuplicateReferral({
  referralId,
  providerPhone,
}) {
  if (!referralId) {
    throw new Error(
      "Referral ID is required."
    );
  }

  const existingProvider =
    await findVerifiedProviderByPhone(
      providerPhone
    );

  if (!existingProvider) {
    return {
      isDuplicate: false,
      existingProvider: null,
    };
  }

  const referralReference =
    doc(
      db,
      REFERRALS_COLLECTION,
      referralId
    );

  const providerName =
    existingProvider.providerName ||
    existingProvider.fullName ||
    existingProvider.name ||
    "Existing provider";

  const normalizedPhone =
    normalizePhoneNumber(
      providerPhone
    );

  await updateDoc(
    referralReference,
    {
      status: "rejected",
      currentStatus: "rejected",
      verificationStatus: "rejected",
      adminStatus: "rejected",
      onboardingStatus: "rejected",

      rewardStatus: "not_earned",
      paymentStatus: "not_paid",

      rejectionReason:
        "This mobile number already exists in VELZO provider records.",

      rejectionReasons: [
        "Duplicate mobile number",
        `Existing provider: ${providerName}`,
      ],

      matchedCollection:
        existingProvider.collectionName,

      matchedDocumentId:
        existingProvider.id,

      duplicateProviderId:
        existingProvider.id,

      duplicateProviderName:
        providerName,

      duplicateProviderPhone:
        normalizedPhone,

      duplicateProviderCollection:
        existingProvider.collectionName,

      isDuplicateProvider: true,
      duplicateChecked: true,
      duplicateCheckedAt:
        serverTimestamp(),

      updatedAt:
        serverTimestamp(),
    }
  );

  return {
    isDuplicate: true,
    existingProvider: {
      id: existingProvider.id,
      name: providerName,
      phoneNumber: normalizedPhone,
      collectionName:
        existingProvider.collectionName,
    },
  };
}

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

  return checkProviderPhoneExists(
    providerPhone
  );
}