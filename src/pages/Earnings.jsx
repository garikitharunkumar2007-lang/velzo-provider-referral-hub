import React, { useEffect, useMemo, useState } from "react";

import {
  collection,
  onSnapshot,
  query,
} from "firebase/firestore";

import { db } from "../firebase/firebaseConfig";

import "./Earnings.css";

/* -------------------------------------------------
   USER-SPECIFIC SETTINGS
------------------------------------------------- */

/*
 * The website must store the current user's ID in
 * localStorage using one of these keys:
 *
 * velzoUserId
 * userId
 * providerId
 * referrerId
 *
 * Example:
 *
 * localStorage.setItem("velzoUserId", "YOUR_USER_ID");
 */
function getCurrentUserId() {
  const possibleKeys = [
    "velzoUserId",
    "userId",
    "providerId",
    "referrerId",
  ];

  for (const key of possibleKeys) {
    const value = localStorage.getItem(key);

    if (value && value.trim() !== "") {
      return value.trim();
    }
  }

  return "";
}

/* -------------------------------------------------
   Normalize values
------------------------------------------------- */
function normalizeValue(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

/* -------------------------------------------------
   Convert Firebase date values
------------------------------------------------- */
function getDateValue(value) {
  if (!value) {
    return null;
  }

  try {
    if (typeof value.toDate === "function") {
      return value.toDate();
    }

    if (value instanceof Date) {
      return value;
    }

    if (
      typeof value === "object" &&
      value.seconds !== undefined
    ) {
      return new Date(Number(value.seconds) * 1000);
    }

    if (typeof value === "number") {
      return new Date(value);
    }

    if (typeof value === "string") {
      const date = new Date(value);

      return Number.isNaN(date.getTime())
        ? null
        : date;
    }

    return null;
  } catch (error) {
    console.error("Date conversion error:", error);
    return null;
  }
}

/* -------------------------------------------------
   Format date
------------------------------------------------- */
function formatDate(value) {
  const date = getDateValue(value);

  if (!date || Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/* -------------------------------------------------
   Get reward amount
------------------------------------------------- */
function getReferralReward(referral) {
  const possibleValues = [
    referral.rewardAmount,
    referral.rewardEarned,
    referral.referralReward,
    referral.paymentAmount,
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

  const reward = Number(value);

  return Number.isFinite(reward) ? reward : 0;
}

/* -------------------------------------------------
   Get all possible owner IDs
------------------------------------------------- */
function getOwnerIds(referral) {
  return [
    referral.referrerUid,
    referral.referrerId,
    referral.referrerUserId,
    referral.referredByUid,
    referral.referredById,
    referral.createdBy,
    referral.createdByUid,
    referral.userId,
    referral.uid,
    referral.ownerId,
  ]
    .filter(
      (value) =>
        value !== undefined &&
        value !== null &&
        value !== ""
    )
    .map((value) => String(value).trim());
}

/* -------------------------------------------------
   Check whether referral belongs to one user
------------------------------------------------- */
function belongsToOneUser(referral, userId) {
  if (!userId) {
    return false;
  }

  const ownerIds = getOwnerIds(referral);

  return ownerIds.includes(String(userId).trim());
}

/* -------------------------------------------------
   Check rejected referral
------------------------------------------------- */
function isRejectedReferral(referral) {
  const statuses = [
    referral.status,
    referral.referralStatus,
    referral.paymentStatus,
    referral.rewardStatus,
    referral.adminStatus,
  ].map(normalizeValue);

  const rejectedStatuses = [
    "rejected",
    "declined",
    "failed",
    "cancelled",
    "canceled",
    "duplicate",
    "already_exists",
    "provider_exists",
    "not_eligible",
  ];

  return statuses.some((status) =>
    rejectedStatuses.includes(status)
  );
}

/* -------------------------------------------------
   Check successful earned referral
------------------------------------------------- */
function isEarnedReferral(referral) {
  if (!referral) {
    return false;
  }

  /*
   * Rejected referrals are always excluded,
   * even if they contain ₹3 or ₹4.
   */
  if (isRejectedReferral(referral)) {
    return false;
  }

  const reward = getReferralReward(referral);

  if (reward <= 0) {
    return false;
  }

  const paymentStatus = normalizeValue(
    referral.paymentStatus
  );

  const rewardStatus = normalizeValue(
    referral.rewardStatus
  );

  const referralStatus = normalizeValue(
    referral.status
  );

  const adminStatus = normalizeValue(
    referral.adminStatus
  );

  const isPaymentCompleted =
    paymentStatus === "completed" ||
    paymentStatus === "complete" ||
    paymentStatus === "paid";

  const isRewardPaid =
    rewardStatus === "earned" ||
    rewardStatus === "paid" ||
    rewardStatus === "completed";

  const isReferralSuccessful =
    referralStatus === "successful" ||
    referralStatus === "success" ||
    referralStatus === "approved" ||
    referralStatus === "paid" ||
    referralStatus === "completed";

  const isAdminApproved =
    adminStatus === "approved" ||
    adminStatus === "accepted" ||
    adminStatus === "successful" ||
    adminStatus === "paid";

  return Boolean(
    isPaymentCompleted ||
      isRewardPaid ||
      isReferralSuccessful ||
      isAdminApproved
  );
}

/* -------------------------------------------------
   Provider name
------------------------------------------------- */
function getProviderName(referral) {
  return (
    referral.providerName ||
    referral.provider?.name ||
    referral.name ||
    referral.fullName ||
    "Provider"
  );
}

/* -------------------------------------------------
   Provider phone
------------------------------------------------- */
function getProviderPhone(referral) {
  return (
    referral.providerPhone ||
    referral.phone ||
    referral.phoneNumber ||
    referral.mobile ||
    referral.mobileNumber ||
    "—"
  );
}

/* -------------------------------------------------
   Union / Labour ID
------------------------------------------------- */
function getUnionId(referral) {
  return (
    referral.unionId ||
    referral.unionID ||
    referral.labourId ||
    referral.labourID ||
    referral.unionLabourId ||
    referral.unionLabourID ||
    "Not provided"
  );
}

/* -------------------------------------------------
   Date sorting
------------------------------------------------- */
function getCreatedTime(referral) {
  const date =
    getDateValue(referral.paidAt) ||
    getDateValue(referral.rewardPaidAt) ||
    getDateValue(referral.createdAt) ||
    getDateValue(referral.submittedAt) ||
    getDateValue(referral.updatedAt);

  return date ? date.getTime() : 0;
}

/* -------------------------------------------------
   Earnings Component
------------------------------------------------- */
export default function Earnings() {
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  /* -------------------------------------------------
     Load only one user's earnings
  ------------------------------------------------- */
  useEffect(() => {
    const currentUserId = getCurrentUserId();

    if (!currentUserId) {
      setReferrals([]);
      setLoading(false);
      setErrorMessage("");
      return;
    }

    setLoading(true);
    setErrorMessage("");

    const earningsQuery = query(
      collection(db, "referrals")
    );

    const unsubscribe = onSnapshot(
      earningsQuery,
      (snapshot) => {
        try {
          const allReferrals = snapshot.docs.map(
            (document) => ({
              id: document.id,
              ...document.data(),
            })
          );

          /*
           * First filter by ONE user only.
           * Other users' referrals are ignored.
           */
          const oneUserReferrals =
            allReferrals.filter((referral) =>
              belongsToOneUser(
                referral,
                currentUserId
              )
            );

          /*
           * Then remove rejected referrals and
           * include only successful earned referrals.
           */
          const earnedReferrals =
            oneUserReferrals
              .filter((referral) =>
                isEarnedReferral(referral)
              )
              .sort(
                (firstReferral, secondReferral) =>
                  getCreatedTime(secondReferral) -
                  getCreatedTime(firstReferral)
              );

          console.log(
            "Current earnings user ID:",
            currentUserId
          );

          console.log(
            "Current user's referrals:",
            oneUserReferrals
          );

          console.log(
            "Current user's valid earnings:",
            earnedReferrals
          );

          setReferrals(earnedReferrals);
          setLoading(false);
          setErrorMessage("");
        } catch (error) {
          console.error(
            "Error processing earnings:",
            error
          );

          setReferrals([]);
          setLoading(false);
          setErrorMessage(
            "Unable to process earnings data."
          );
        }
      },
      (error) => {
        console.error(
          "Error loading earnings:",
          error
        );

        setReferrals([]);
        setLoading(false);
        setErrorMessage(
          "Unable to load earnings data. Please try again later."
        );
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  /* -------------------------------------------------
     Total earned
  ------------------------------------------------- */
  const totalEarned = useMemo(() => {
    return referrals.reduce(
      (total, referral) =>
        total + getReferralReward(referral),
      0
    );
  }, [referrals]);

  /* -------------------------------------------------
     ₹4 referrals
  ------------------------------------------------- */
  const fourRupee = useMemo(() => {
    return referrals.filter(
      (referral) =>
        getReferralReward(referral) === 4
    ).length;
  }, [referrals]);

  /* -------------------------------------------------
     ₹3 referrals
  ------------------------------------------------- */
  const threeRupee = useMemo(() => {
    return referrals.filter(
      (referral) =>
        getReferralReward(referral) === 3
    ).length;
  }, [referrals]);

  return (
    <div className="earnings-page">
      {/* Page heading */}
      <div className="page-heading">
        <p className="eyebrow">VELZO</p>

        <h1>Earnings</h1>

        <p>
          Your rewards from successful provider
          referrals.
        </p>
      </div>

      {/* Firebase error only */}
      {errorMessage && (
        <div className="empty-state error-state">
          {errorMessage}
        </div>
      )}

      {/* Total earnings */}
      <div className="earnings-hero">
        <span>TOTAL EARNED</span>

        <strong>
          ₹{totalEarned.toLocaleString("en-IN")}
        </strong>

        <small>
          From {referrals.length} successful referral
          {referrals.length !== 1 ? "s" : ""}
        </small>
      </div>

      {/* Earnings cards */}
      <div className="earnings-grid">
        <div className="earning-card">
          <span>₹4 REFERRALS</span>

          <strong>{fourRupee}</strong>

          <small>
            With Union / Labour ID
          </small>
        </div>

        <div className="earning-card">
          <span>₹3 REFERRALS</span>

          <strong>{threeRupee}</strong>

          <small>
            Without Union / Labour ID
          </small>
        </div>

        <div className="earning-card">
          <span>SUCCESSFUL</span>

          <strong>{referrals.length}</strong>

          <small>
            Paid referrals
          </small>
        </div>
      </div>

      {/* Reward history */}
      <div className="earnings-list">
        <h2>Reward History</h2>

        {loading ? (
          <p>Loading earnings...</p>
        ) : referrals.length === 0 ? (
          <div className="empty-state">
            <p>No earned rewards yet.</p>

            <small>
              Successful provider referral rewards
              will appear here.
            </small>
          </div>
        ) : (
          referrals.map((referral) => {
            const reward =
              getReferralReward(referral);

            const referralDate =
              referral.paidAt ||
              referral.rewardPaidAt ||
              referral.updatedAt ||
              referral.createdAt ||
              referral.submittedAt;

            return (
              <div
                className="earning-row"
                key={referral.id}
              >
                <div className="earning-details">
                  <strong>
                    {getProviderName(referral)}
                  </strong>

                  <span>
                    Successful referral
                  </span>

                  <small>
                    Date: {formatDate(referralDate)}
                  </small>

                  <small>
                    Phone: {getProviderPhone(referral)}
                  </small>

                  <small>
                    Union / Labour ID:{" "}
                    {getUnionId(referral)}
                  </small>
                </div>

                <strong className="earning-amount">
                  +₹{reward.toLocaleString("en-IN")}
                </strong>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}