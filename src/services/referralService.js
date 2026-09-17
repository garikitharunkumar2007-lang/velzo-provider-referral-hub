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

const PROVIDER_MASTER_COLLECTIONS = [
  "tadepalligudem_mechanics",
  "tanuku_plumbers",
  "tanuku_mechanics",
  "union_master_list",
  "verifiedProviders",
];

function cleanText(value) {
  return String(value ?? "").trim();
}

function normalizePhoneNumber(value) {
  let phone = cleanText(value).replace(/\D/g, "");

  if (phone.startsWith("91") && phone.length === 12) {
    phone = phone.substring(2);
  }

  if (phone.startsWith("0") && phone.length === 11) {
    phone = phone.substring(1);
  }

  return phone;
}

function normalizeUnionId(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[-_]/g, "");
}

function normalizeCollectionName(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/\s+/g, "");
}

function getReferralRef(referralId) {
  const id = cleanText(referralId);

  if (!id) {
    throw new Error("Referral ID is required.");
  }

  return doc(db, "referrals", id);
}

function getFirstValue(data, keys) {
  for (const key of keys) {
    const value = data?.[key];

    if (
      value !== undefined &&
      value !== null &&
      cleanText(value) !== ""
    ) {
      return value;
    }
  }

  return "";
}

function getProviderPhone(data) {
  return normalizePhoneNumber(
    getFirstValue(data, [
      "phone",
      "phoneNumber",
      "providerPhone",
      "mobile",
      "mobileNumber",
      "contactNumber",
      "contactPhone",
      "whatsappNumber",
      "whatsappPhone",
    ])
  );
}

function getProviderUnionId(data) {
  return normalizeUnionId(
    getFirstValue(data, [
      "unionId",
      "unionID",
      "union_id",
      "unionLabourId",
      "unionLaborId",
      "labourId",
      "laborId",
      "memberId",
      "membershipId",
      "workerId",
    ])
  );
}

function getProviderName(data) {
  return cleanText(
    getFirstValue(data, [
      "providerName",
      "fullName",
      "name",
      "providerFullName",
      "displayName",
    ])
  );
}

function getProviderAddress(data) {
  return cleanText(
    getFirstValue(data, [
      "address",
      "providerAddress",
      "fullAddress",
      "location",
    ])
  );
}

function getProviderService(data) {
  return cleanText(
    getFirstValue(data, [
      "service",
      "role",
      "serviceType",
      "category",
      "profession",
    ])
  );
}

async function readCollectionSafely(collectionName) {
  const snapshot = await getDocs(
    collection(db, collectionName)
  );

  return snapshot.docs.map((item) => ({
    id: item.id,
    collectionName,
    ...item.data(),
  }));
}

export async function checkProviderExists({
  phone = "",
  unionId = "",
} = {}) {
  const normalizedPhone = normalizePhoneNumber(phone);
  const normalizedUnionId = normalizeUnionId(unionId);

  if (!normalizedPhone && !normalizedUnionId) {
    return {
      isDuplicate: false,
      matchedBy: [],
      existingProvider: null,
      checkedCollections: PROVIDER_MASTER_COLLECTIONS,
    };
  }

  const collectionResults = await Promise.all(
    PROVIDER_MASTER_COLLECTIONS.map(async (collectionName) => {
      try {
        return await readCollectionSafely(collectionName);
      } catch (error) {
        console.error(
          `Unable to read collection "${collectionName}":`,
          error
        );

        throw new Error(
          `Unable to check provider records in "${collectionName}".`
        );
      }
    })
  );

  const allProviders = collectionResults.flat();

  for (const provider of allProviders) {
    const providerPhone = getProviderPhone(provider);
    const providerUnionId = getProviderUnionId(provider);

    const phoneMatched =
      Boolean(normalizedPhone) &&
      Boolean(providerPhone) &&
      providerPhone === normalizedPhone;

    const unionIdMatched =
      Boolean(normalizedUnionId) &&
      Boolean(providerUnionId) &&
      providerUnionId === normalizedUnionId;

    if (phoneMatched || unionIdMatched) {
      return {
        isDuplicate: true,
        matchedBy: [
          ...(phoneMatched ? ["phone"] : []),
          ...(unionIdMatched ? ["unionId"] : []),
        ],
        existingProvider: {
          id: provider.id,
          collectionName: provider.collectionName,
          providerName: getProviderName(provider),
          phone: providerPhone,
          unionId: providerUnionId,
          address: getProviderAddress(provider),
          service: getProviderService(provider),
          rawData: provider,
        },
        checkedCollections: PROVIDER_MASTER_COLLECTIONS,
      };
    }
  }

  return {
    isDuplicate: false,
    matchedBy: [],
    existingProvider: null,
    checkedCollections: PROVIDER_MASTER_COLLECTIONS,
  };
}

export async function checkProviderPhoneExists(phone) {
  return checkProviderExists({ phone });
}

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
  phoneNumber = "",
  mobile = "",

  address = "",
  role = "",
  service = "",

  unionId = "",
  unionLabourId = "",
  unionLaborId = "",
  labourId = "",
  laborId = "",

  upiNumber = "",
  paymentNumber = "",

  consent = false,
}) {
  const referralOwnerId = cleanText(
    referrerId || referrerUid || referrerUserId
  );

  const cleanProviderName = cleanText(
    providerName || fullName
  );

  const rawPhone = cleanText(
    phone ||
      providerPhone ||
      phoneNumber ||
      mobile
  );

  const cleanPhone = normalizePhoneNumber(rawPhone);

  const cleanAddress = cleanText(address);

  const cleanRole = cleanText(
    role || service
  );

  const cleanUnionId = cleanText(
    unionId ||
      unionLabourId ||
      unionLaborId ||
      labourId ||
      laborId
  );

  const cleanUpiNumber = cleanText(
    upiNumber || paymentNumber
  );

  if (!referralOwnerId) {
    throw new Error("Referral owner ID is missing.");
  }

  if (!cleanProviderName) {
    throw new Error("Provider name is required.");
  }

  if (
    cleanPhone.length !== 10 ||
    !/^[6-9]\d{9}$/.test(cleanPhone)
  ) {
    throw new Error(
      "Please enter a valid 10-digit Indian phone number."
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
      "UPI ID or payment number is required."
    );
  }

  if (consent !== true) {
    throw new Error(
      "Provider consent is required."
    );
  }

  let duplicateResult;

  try {
    duplicateResult = await checkProviderExists({
      phone: cleanPhone,
      unionId: cleanUnionId,
    });
  } catch (error) {
    console.error(
      "Provider duplicate verification failed:",
      error
    );

    throw new Error(
      error?.message ||
        "Unable to verify provider records. Please try again."
    );
  }

  const isDuplicate = duplicateResult.isDuplicate;
  const existingProvider =
    duplicateResult.existingProvider;

  const matchedBy = duplicateResult.matchedBy || [];

  const existingProviderName =
    existingProvider?.providerName ||
    "Existing provider";

  const existingProviderCollection =
    existingProvider?.collectionName || "";

  const existingProviderId =
    existingProvider?.id || "";

  const duplicateReason =
    "This provider already exists in VELZO provider records.";

  const initialStatus = isDuplicate
    ? "rejected"
    : "pending";

  const initialVerificationStatus = isDuplicate
    ? "rejected"
    : "pending";

  const initialAdminStatus = isDuplicate
    ? "rejected"
    : "pending";

  const initialOnboardingStatus = isDuplicate
    ? "rejected"
    : "pending";

  const referralData = {
    referrerId: referralOwnerId,
    referrerUid: referralOwnerId,
    referrerUserId: referralOwnerId,

    referrerEmail: cleanText(referrerEmail),
    referrerName: cleanText(referrerName),
    referrerPhone: cleanText(referrerPhone),

    providerName: cleanProviderName,
    fullName: cleanProviderName,

    phone: cleanPhone,
    providerPhone: cleanPhone,
    phoneNumber: cleanPhone,
    mobile: cleanPhone,

    address: cleanAddress,

    role: cleanRole,
    service: cleanRole,

    unionId: cleanUnionId,
    unionLabourId: cleanUnionId,
    unionLaborId: cleanUnionId,

    upiNumber: cleanUpiNumber,
    paymentNumber: cleanUpiNumber,

    consent: true,
    consentAt: serverTimestamp(),

    source: "website",

    status: initialStatus,
    currentStatus: initialStatus,
    verificationStatus: initialVerificationStatus,
    adminStatus: initialAdminStatus,
    onboardingStatus: initialOnboardingStatus,

    duplicateChecked: true,
    duplicateCheckedAt: serverTimestamp(),

    isDuplicateProvider: isDuplicate,
    duplicateMatchedBy: matchedBy,

    matchedCollection: existingProviderCollection || null,
    matchedDocumentId: existingProviderId || null,

    duplicateProviderId: existingProviderId || null,
    duplicateProviderName: isDuplicate
      ? existingProviderName
      : "",
    duplicateProviderPhone: isDuplicate
      ? existingProvider?.phone || cleanPhone
      : "",
    duplicateProviderUnionId: isDuplicate
      ? existingProvider?.unionId || cleanUnionId
      : "",
    duplicateProviderCollection: isDuplicate
      ? existingProviderCollection
      : "",

    checkedCollections:
      PROVIDER_MASTER_COLLECTIONS,

    rejectionReason: isDuplicate
      ? duplicateReason
      : "",

    rejectionReasons: isDuplicate
      ? [
          "Duplicate provider record",
          ...matchedBy.map(
            (item) =>
              `Matched by ${item}`
          ),
          duplicateReason,
          `Existing provider: ${existingProviderName}`,
          `Matched collection: ${existingProviderCollection}`,
          `Matched document ID: ${existingProviderId}`,
        ]
      : [],

    reward: 0,
    rewardAmount: 0,
    rewardEarned: 0,
    referralReward: 0,
    paymentAmount: 0,

    rewardStatus: "not_earned",
    paymentStatus: "not_paid",

    createdAt: serverTimestamp(),
    submittedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),

    verifiedAt: null,
    approvedAt: null,
    rejectedAt: isDuplicate
      ? serverTimestamp()
      : null,
    paidAt: null,
  };

  const referralDocument = await addDoc(
    referralsCollection,
    referralData
  );

  return {
    id: referralDocument.id,
    referralId: referralDocument.id,

    status: initialStatus,
    currentStatus: initialStatus,
    verificationStatus: initialVerificationStatus,
    adminStatus: initialAdminStatus,

    isDuplicateProvider: isDuplicate,
    duplicateChecked: true,
    matchedBy,

    existingProvider:
      existingProvider || null,

    message: isDuplicate
      ? "Referral rejected because this provider already exists in VELZO provider records."
      : "Referral submitted successfully and is pending verification.",
  };
}

export async function submitReferral(referralData) {
  return createReferral(referralData);
}

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

export async function getAllReferrals() {
  const referralsQuery = query(
    referralsCollection,
    orderBy("createdAt", "desc")
  );

  const snapshot = await getDocs(
    referralsQuery
  );

  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  }));
}

export async function getReferralsByReferrerId(
  referrerId
) {
  const ownerId = cleanText(referrerId);

  if (!ownerId) {
    return [];
  }

  const referralsQuery = query(
    referralsCollection,
    where("referrerId", "==", ownerId)
  );

  const snapshot = await getDocs(
    referralsQuery
  );

  return snapshot.docs
    .map((item) => ({
      id: item.id,
      ...item.data(),
    }))
    .sort((first, second) => {
      const firstTime =
        first.createdAt?.seconds || 0;

      const secondTime =
        second.createdAt?.seconds || 0;

      return secondTime - firstTime;
    });
}

export async function getReferralsByStatus(status) {
  const cleanStatus = cleanText(status);

  if (!cleanStatus) {
    return [];
  }

  const referralsQuery = query(
    referralsCollection,
    where("status", "==", cleanStatus)
  );

  const snapshot = await getDocs(
    referralsQuery
  );

  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  }));
}

export async function updateReferralStatus(
  referralId,
  status,
  extraData = {}
) {
  const cleanStatus = cleanText(status);

  if (!cleanText(referralId)) {
    throw new Error("Referral ID is required.");
  }

  if (!cleanStatus) {
    throw new Error("Referral status is required.");
  }

  const updates = {
    status: cleanStatus,
    currentStatus: cleanStatus,
    updatedAt: serverTimestamp(),
    ...extraData,
  };

  if (cleanStatus === "rejected") {
    updates.verificationStatus = "rejected";
    updates.adminStatus = "rejected";
    updates.rejectedAt = serverTimestamp();
  }

  if (
    cleanStatus === "approved" ||
    cleanStatus === "successful"
  ) {
    updates.verificationStatus = "verified";
    updates.adminStatus = "approved";
    updates.approvedAt = serverTimestamp();
  }

  await updateDoc(
    getReferralRef(referralId),
    updates
  );

  return {
    success: true,
    status: cleanStatus,
  };
}

export {
  cleanText,
  normalizePhoneNumber,
  normalizeUnionId,
  PROVIDER_MASTER_COLLECTIONS,
};

export default {
  createReferral,
  submitReferral,
  checkProviderExists,
  checkProviderPhoneExists,
  getReferralById,
  getAllReferrals,
  getReferralsByReferrerId,
  getReferralsByStatus,
  updateReferralStatus,
};