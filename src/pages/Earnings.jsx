import React, { useEffect, useMemo, useState } from "react";

import {
  collection,
  onSnapshot,
  query,
} from "firebase/firestore";

import { getAuth, onAuthStateChanged } from "firebase/auth";

import { db } from "../firebase/firebaseConfig";

import "./Earnings.css";

/* -------------------------------------------------
   Normalize text/status values
------------------------------------------------- */
function normalizeStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

/* -------------------------------------------------
   Convert Firebase Timestamp / Date / String
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
  if (!referral) {
    return 0;
  }

  const possibleValues = [
    referral.paymentAmount,
    referral.rewardAmount,
    referral.rewardEarned,
    referral.referralReward,
    referral.earnings,
    referral.amount,
    referral.reward,
  ];

  const validValue = possibleValues.find(
    (value) =>
      value !== undefined &&
      value !== null &&
      value !== ""
  );

  const numericValue = Number(validValue);

  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return numericValue;
}

/* -------------------------------------------------
   Get current-user ownership value
------------------------------------------------- */
function getReferralOwnerValues(referral) {
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
   Check whether referral belongs to current user
------------------------------------------------- */
function belongsToCurrentUser(referral, currentUser) {
  if (!referral || !currentUser) {
    return false;
  }

  const currentUid = String(currentUser.uid || "")
    .trim();

  const currentEmail = String(
    currentUser.email || ""
  )
    .trim()
    .toLowerCase();

  const ownerValues = getReferralOwnerValues(
    referral
  );

  const ownerEmails = [
    referral.referrerEmail,
    referral.referredByEmail,
    referral.createdByEmail,
    referral.userEmail,
    referral.email,
  ]
    .filter(
      (value) =>
        value !== undefined &&
        value !== null &&
        value !== ""
    )
    .map((value) =>
      String(value).trim().toLowerCase()
    );

  const uidMatches =
    currentUid &&
    ownerValues.includes(currentUid);

  const emailMatches =
    currentEmail &&
    ownerEmails.includes(currentEmail);

  return Boolean(uidMatches || emailMatches);
}

/* -------------------------------------------------
   Check rejected/failed/cancelled referral
------------------------------------------------- */
function isRejectedReferral(referral) {
  const statuses = [
    referral.status,
    referral.referralStatus,
    referral.paymentStatus,
    referral.rewardStatus,
    referral.adminStatus,
  ].map(normalizeStatus);

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
   Check whether referral is successfully earned
------------------------------------------------- */
function isEarnedReferral(referral) {
  if (!referral) {
    return false;
  }

  /*
   * Rejected referrals must always be excluded,
   * even if another field incorrectly says successful
   * or contains a reward amount.
   */
  if (isRejectedReferral(referral)) {
    return false;
  }

  const paymentStatus = normalizeStatus(
    referral.paymentStatus
  );

  const rewardStatus = normalizeStatus(
    referral.rewardStatus
  );

  const referralStatus = normalizeStatus(
    referral.status
  );

  const adminStatus = normalizeStatus(
    referral.adminStatus
  );

  const reward = getReferralReward(referral);

  if (reward <= 0) {
    return false;
  }

  const paymentCompleted =
    paymentStatus === "completed" ||
    paymentStatus === "complete" ||
    paymentStatus === "paid";

  const rewardPaid =
    rewardStatus === "earned" ||
    rewardStatus === "paid" ||
    rewardStatus === "completed";

  const referralSuccessful =
    referralStatus === "successful" ||
    referralStatus === "success" ||
    referralStatus === "approved" ||
    referralStatus === "paid" ||
    referralStatus === "completed";

  const adminApproved =
    adminStatus === "approved" ||
    adminStatus === "accepted" ||
    adminStatus === "successful" ||
    adminStatus === "paid";

  return Boolean(
    paymentCompleted ||
      rewardPaid ||
      referralSuccessful ||
      adminApproved
  );
}

/* -------------------------------------------------
   Get provider name
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
   Get provider phone
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
   Get Union / Labour ID
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
   Get referral created / paid time
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
  const [currentUser, setCurrentUser] = useState(null);

  /* -------------------------------------------------
     Get currently logged-in website user
  ------------------------------------------------- */
  useEffect(() => {
    const auth = getAuth();

    const unsubscribeAuth = onAuthStateChanged(
      auth,
      (user) => {
        setCurrentUser(user);
      }
    );

    return () => {
      unsubscribeAuth();
    };
  }, []);

  /* -------------------------------------------------
     Load only current user's earnings
  ------------------------------------------------- */
  useEffect(() => {
    if (!currentUser) {
      setReferrals([]);
      setLoading(false);
      setErrorMessage(
        "Please login to view your earnings."
      );
      return;
    }

    setLoading(true);
    setErrorMessage("");

    const earningsQuery = query(
      collection(db, "referrals")
    );

    const unsubscribeReferrals = onSnapshot(
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
           * IMPORTANT:
           * First filter by the logged-in user.
           * Other users' referrals are never included.
           */
          const currentUserReferrals =
            allReferrals.filter((referral) =>
              belongsToCurrentUser(
                referral,
                currentUser
              )
            );

          /*
           * Then include only valid earned referrals.
           * Rejected referrals are excluded even if
           * they contain rewardAmount/paymentAmount.
           */
          const earnedReferrals =
            currentUserReferrals
              .filter((referral) =>
                isEarnedReferral(referral)
              )
              .sort(
                (firstReferral, secondReferral) =>
                  getCreatedTime(secondReferral) -
                  getCreatedTime(firstReferral)
              );

          console.log(
            "Current logged-in user:",
            currentUser.uid
          );

          console.log(
            "All referrals:",
            allReferrals
          );

          console.log(
            "Current user's referrals:",
            currentUserReferrals
          );

          console.log(
            "Current user's earned referrals:",
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
      unsubscribeReferrals();
    };
  }, [currentUser]);

  /* -------------------------------------------------
     Total earned amount
  ------------------------------------------------- */
  const totalEarned = useMemo(() => {
    return referrals.reduce(
      (total, referral) =>
        total + getReferralReward(referral),
      0
    );
  }, [referrals]);

  /* -------------------------------------------------
     Count ₹4 referrals
  ------------------------------------------------- */
  const fourRupee = useMemo(() => {
    return referrals.filter(
      (referral) =>
        getReferralReward(referral) === 4
    ).length;
  }, [referrals]);

  /* -------------------------------------------------
     Count ₹3 referrals
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

      {/* Error message */}
      {errorMessage && (
        <div className="empty-state error-state">
          {errorMessage}
        </div>
      )}

      {/* Earnings summary */}
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