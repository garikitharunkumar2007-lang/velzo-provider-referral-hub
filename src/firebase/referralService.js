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

import {
  checkProviderPhoneExists,
  normalizePhoneNumber,
} from "../firebase/verifiedProviderService";

const referralsCollection =
  collection(
    db,
    "referrals"
  );

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function cleanText(value) {
  return String(
    value ?? ""
  ).trim();
}

function getReferralRef(
  referralId
) {
  if (!referralId) {
    throw new Error(
      "Referral ID is required."
    );
  }

  return doc(
    db,
    "referrals",
    referralId
  );
}

/*
|--------------------------------------------------------------------------
| Create referral
|--------------------------------------------------------------------------
*/

export async function createReferral({
  referrerId = "",
  referrerUid = "",
  referrerUserId = "",
  referrerEmail = "",
  referrerName = "",
  referrerPhone = "",

  providerName = "",
  fullName = "",
  phone = "",
  providerPhone = "",

  address = "",
  role = "",
  unionId = "",
  unionLabourId = "",

  upiNumber = "",
  paymentNumber = "",

  consent = false,
}) {
  const referralOwnerId =
    cleanText(
      referrerId ||
        referrerUid ||
        referrerUserId
    );

  const cleanProviderName =
    cleanText(
      providerName ||
        fullName
    );

  const rawPhone =
    cleanText(
      phone ||
        providerPhone
    );

  const cleanPhone =
    normalizePhoneNumber(
      rawPhone
    );

  const cleanAddress =
    cleanText(
      address
    );

  const cleanRole =
    cleanText(
      role
    );

  const cleanUnionId =
    cleanText(
      unionId ||
        unionLabourId
    );

  const cleanUpiNumber =
    cleanText(
      upiNumber ||
        paymentNumber
    );

  /*
  |--------------------------------------------------------------------------
  | Form validation
  |--------------------------------------------------------------------------
  */

  if (!referralOwnerId) {
    throw new Error(
      "Referral owner ID is missing."
    );
  }

  if (!cleanProviderName) {
    throw new Error(
      "Provider name is required."
    );
  }

  if (
    cleanPhone.length !== 10 ||
    !/^[6-9]\d{9}$/.test(
      cleanPhone
    )
  ) {
    throw new Error(
      "Please enter a valid 10-digit Indian phone number."
    );
  }

  if (!cleanAddress) {
    throw new Error(
      "Provider address is required."
    );
  }

  if (!cleanRole) {
    throw new Error(
      "Provider role is required."
    );
  }

  if (!cleanUpiNumber) {
    throw new Error(
      "UPI ID or payment number is required."
    );
  }

  if (!consent) {
    throw new Error(
      "Provider consent is required."
    );
  }

  /*
  |--------------------------------------------------------------------------
  | IMPORTANT DUPLICATE CHECK
  |--------------------------------------------------------------------------
  |
  | Checks:
  |
  | 1. tadepalligudem_mechanics
  | 2. tanuku_plumbers
  | 3. tanuku_mechanics
  | 4. union_master_list
  | 5. verifiedProviders
  |
  | This happens BEFORE addDoc().
  |--------------------------------------------------------------------------
  */

  let duplicateResult;

  try {
    duplicateResult =
      await checkProviderPhoneExists(
        cleanPhone
      );
  } catch (error) {
    console.error(
      "Provider duplicate check failed:",
      error
    );

    throw new Error(
      "Unable to verify this provider phone number. Please try again."
    );
  }

  const isDuplicate =
    duplicateResult.isDuplicate;

  const existingProvider =
    duplicateResult.existingProvider;

  const existingProviderName =
    existingProvider?.providerName ||
    existingProvider?.fullName ||
    existingProvider?.name ||
    "Existing provider";

  const existingProviderCollection =
    existingProvider?.collectionName ||
    "";

  const existingProviderId =
    existingProvider?.id ||
    "";

  const duplicateReason =
    "This provider mobile number already exists in VELZO provider records.";

  /*
  |--------------------------------------------------------------------------
  | Status decision
  |--------------------------------------------------------------------------
  */

  const initialStatus =
    isDuplicate
      ? "rejected"
      : "pending";

  const initialVerificationStatus =
    isDuplicate
      ? "rejected"
      : "pending";

  const initialAdminStatus =
    isDuplicate
      ? "rejected"
      : "pending";

  const initialOnboardingStatus =
    isDuplicate
      ? "rejected"
      : "pending";

  /*
  |--------------------------------------------------------------------------
  | Referral document
  |--------------------------------------------------------------------------
  */

  const referralData = {
    referrerId:
      referralOwnerId,

    referrerUid:
      referralOwnerId,

    referrerUserId:
      referralOwnerId,

    referrerEmail:
      cleanText(
        referrerEmail
      ),

    referrerName:
      cleanText(
        referrerName
      ),

    referrerPhone:
      cleanText(
        referrerPhone
      ),

    providerName:
      cleanProviderName,

    fullName:
      cleanProviderName,

    phone:
      cleanPhone,

    providerPhone:
      cleanPhone,

    phoneNumber:
      cleanPhone,

    mobile:
      cleanPhone,

    address:
      cleanAddress,

    role:
      cleanRole,

    service:
      cleanRole,

    unionId:
      cleanUnionId,

    unionLabourId:
      cleanUnionId,

    upiNumber:
      cleanUpiNumber,

    paymentNumber:
      cleanUpiNumber,

    consent: true,

    consentAt:
      serverTimestamp(),

    source:
      "website",

    /*
    |--------------------------------------------------------------------------
    | Required status fields
    |--------------------------------------------------------------------------
    */

    status:
      initialStatus,

    currentStatus:
      initialStatus,

    verificationStatus:
      initialVerificationStatus,

    adminStatus:
      initialAdminStatus,

    onboardingStatus:
      initialOnboardingStatus,

    /*
    |--------------------------------------------------------------------------
    | Duplicate metadata
    |--------------------------------------------------------------------------
    */

    duplicateChecked:
      true,

    duplicateCheckedAt:
      serverTimestamp(),

    isDuplicateProvider:
      isDuplicate,

    matchedCollection:
      existingProviderCollection ||
      null,

    matchedDocumentId:
      existingProviderId ||
      null,

    duplicateProviderId:
      existingProviderId ||
      null,

    duplicateProviderName:
      isDuplicate
        ? existingProviderName
        : "",

    duplicateProviderPhone:
      isDuplicate
        ? cleanPhone
        : "",

    duplicateProviderCollection:
      isDuplicate
        ? existingProviderCollection
        : "",

    rejectionReason:
      isDuplicate
        ? duplicateReason
        : "",

    rejectionReasons:
      isDuplicate
        ? [
            "Duplicate mobile number",
            duplicateReason,
            `Existing provider: ${existingProviderName}`,
            `Matched collection: ${existingProviderCollection}`,
          ]
        : [],

    /*
    |--------------------------------------------------------------------------
    | Reward fields
    |--------------------------------------------------------------------------
    */

    reward:
      0,

    rewardAmount:
      0,

    rewardEarned:
      0,

    referralReward:
      0,

    paymentAmount:
      0,

    rewardStatus:
      "not_earned",

    paymentStatus:
      "not_paid",

    /*
    |--------------------------------------------------------------------------
    | Timestamps
    |--------------------------------------------------------------------------
    */

    createdAt:
      serverTimestamp(),

    submittedAt:
      serverTimestamp(),

    updatedAt:
      serverTimestamp(),

    verifiedAt:
      null,

    approvedAt:
      null,

    rejectedAt:
      isDuplicate
        ? serverTimestamp()
        : null,

    paidAt:
      null,
  };

  /*
  |--------------------------------------------------------------------------
  | Always save the referral with the correct status
  |--------------------------------------------------------------------------
  */

  const referralDocument =
    await addDoc(
      referralsCollection,
      referralData
    );

  return {
    referralId:
      referralDocument.id,

    id:
      referralDocument.id,

    status:
      initialStatus,

    currentStatus:
      initialStatus,

    verificationStatus:
      initialVerificationStatus,

    adminStatus:
      initialAdminStatus,

    isDuplicateProvider:
      isDuplicate,

    duplicateChecked:
      true,

    existingProvider:
      existingProvider || null,

    message:
      isDuplicate
        ? "Referral rejected because this provider mobile number already exists."
        : "Referral submitted successfully and is pending verification.",
  };
}

/*
|--------------------------------------------------------------------------
| Submit referral
|--------------------------------------------------------------------------
*/

export async function submitReferral(
  referralData
) {
  return createReferral(
    referralData
  );
}

/*
|--------------------------------------------------------------------------
| Read one referral
|--------------------------------------------------------------------------
*/

export async function getReferralById(
  referralId
) {
  const snapshot =
    await getDoc(
      getReferralRef(
        referralId
      )
    );

  if (
    !snapshot.exists()
  ) {
    return null;
  }

  return {
    id:
      snapshot.id,

    ...snapshot.data(),
  };
}

/*
|--------------------------------------------------------------------------
| Read all referrals
|--------------------------------------------------------------------------
*/

export async function getAllReferrals() {
  const referralsQuery =
    query(
      referralsCollection,
      orderBy(
        "createdAt",
        "desc"
      )
    );

  const snapshot =
    await getDocs(
      referralsQuery
    );

  return snapshot.docs.map(
    (item) => ({
      id:
        item.id,

      ...item.data(),
    })
  );
}

/*
|--------------------------------------------------------------------------
| Read referrals by referrer
|--------------------------------------------------------------------------
*/

export async function getReferralsByReferrerId(
  referrerId
) {
  const ownerId =
    cleanText(
      referrerId
    );

  if (!ownerId) {
    return [];
  }

  const referralsQuery =
    query(
      referralsCollection,
      where(
        "referrerId",
        "==",
        ownerId
      )
    );

  const snapshot =
    await getDocs(
      referralsQuery
    );

  return snapshot.docs
    .map(
      (item) => ({
        id:
          item.id,

        ...item.data(),
      })
    )
    .sort(
      (first, second) => {
        const firstTime =
          first.createdAt?.seconds ||
          0;

        const secondTime =
          second.createdAt?.seconds ||
          0;

        return (
          secondTime -
          firstTime
        );
      }
    );
}

/*
|--------------------------------------------------------------------------
| Read referrals by status
|--------------------------------------------------------------------------
*/

export async function getReferralsByStatus(
  status
) {
  const cleanStatus =
    cleanText(
      status
    );

  if (!cleanStatus) {
    return [];
  }

  const referralsQuery =
    query(
      referralsCollection,
      where(
        "status",
        "==",
        cleanStatus
      )
    );

  const snapshot =
    await getDocs(
      referralsQuery
    );

  return snapshot.docs.map(
    (item) => ({
      id:
        item.id,

      ...item.data(),
    })
  );
}

/*
|--------------------------------------------------------------------------
| Update referral status
|--------------------------------------------------------------------------
*/

export async function updateReferralStatus(
  referralId,
  status,
  extraData = {}
) {
  if (!referralId) {
    throw new Error(
      "Referral ID is required."
    );
  }

  if (!status) {
    throw new Error(
      "Referral status is required."
    );
  }

  const cleanStatus =
    cleanText(
      status
    );

  const updates = {
    status:
      cleanStatus,

    currentStatus:
      cleanStatus,

    updatedAt:
      serverTimestamp(),

    ...extraData,
  };

  if (
    cleanStatus ===
    "rejected"
  ) {
    updates.verificationStatus =
      "rejected";

    updates.adminStatus =
      "rejected";

    updates.rejectedAt =
      serverTimestamp();
  }

  if (
    cleanStatus ===
    "approved" ||
    cleanStatus ===
    "successful"
  ) {
    updates.verificationStatus =
      "verified";

    updates.adminStatus =
      "approved";

    updates.approvedAt =
      serverTimestamp();
  }

  await updateDoc(
    getReferralRef(
      referralId
    ),
    updates
  );

  return {
    success:
      true,

    status:
      cleanStatus,
  };
}

export default {
  createReferral,
  submitReferral,
  getReferralById,
  getAllReferrals,
  getReferralsByReferrerId,
  getReferralsByStatus,
  updateReferralStatus,
};