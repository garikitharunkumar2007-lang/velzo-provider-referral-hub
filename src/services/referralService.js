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

const referralsCollection =
  collection(db, "referrals");

function cleanText(value) {
  return String(value ?? "").trim();
}

function getReferralRef(referralId) {
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
  const referralOwnerId =
    cleanText(
      referrerId ||
        referrerUid ||
        referrerUserId
    );

  const cleanProviderName =
    cleanText(providerName);

  const cleanPhone =
    cleanText(phone);

  const cleanAddress =
    cleanText(address);

  const cleanRole =
    cleanText(role);

  const cleanUnionId =
    cleanText(unionId);

  const cleanUpiNumber =
    cleanText(upiNumber);

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

  if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
    throw new Error(
      "Please enter a valid 10-digit phone number."
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

  const referralData = {
    referrerId: referralOwnerId,
    referrerUid: referralOwnerId,
    referrerUserId: referralOwnerId,

    referrerEmail:
      cleanText(referrerEmail),

    referrerName:
      cleanText(referrerName),

    referrerPhone:
      cleanText(referrerPhone),

    providerName:
      cleanProviderName,

    fullName:
      cleanProviderName,

    phone:
      cleanPhone,

    address:
      cleanAddress,

    role:
      cleanRole,

    unionId:
      cleanUnionId,

    upiNumber:
      cleanUpiNumber,

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

    rejectionReason: "",
    rejectionReasons: [],

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),

    verifiedAt: null,
    approvedAt: null,
    rejectedAt: null,
    paidAt: null,
  };

  const referralDocument =
    await addDoc(
      referralsCollection,
      referralData
    );

  return referralDocument.id;
}

export async function submitReferral(
  referralData
) {
  return createReferral(
    referralData
  );
}

export async function getReferralById(
  referralId
) {
  const snapshot =
    await getDoc(
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

  const snapshot =
    await getDocs(
      referralsQuery
    );

  return snapshot.docs.map(
    (item) => ({
      id: item.id,
      ...item.data(),
    })
  );
}

export async function getReferralsByReferrerId(
  referrerId
) {
  const ownerId =
    cleanText(referrerId);

  if (!ownerId) {
    return [];
  }

  const referralsQuery = query(
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
    .map((item) => ({
      id: item.id,
      ...item.data(),
    }))
    .sort((a, b) => {
      const first =
        a.createdAt?.seconds || 0;

      const second =
        b.createdAt?.seconds || 0;

      return second - first;
    });
}

export async function updateReferralStatus(
  referralId,
  status,
  extraData = {}
) {
  const referralRef =
    getReferralRef(referralId);

  await updateDoc(
    referralRef,
    {
      status,
      ...extraData,
      updatedAt: serverTimestamp(),
    }
  );
}