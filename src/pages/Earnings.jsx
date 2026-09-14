import React, { useEffect, useMemo, useState } from "react";

import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";

import {
  getAuth,
  onAuthStateChanged,
} from "firebase/auth";

import { db } from "../firebase/firebaseConfig";

import "./Earnings.css";

/* -------------------------------------------------
   Normalize status values
------------------------------------------------- */
function normalizeStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

/* -------------------------------------------------
   Check whether referral belongs to logged-in user
------------------------------------------------- */
function referralBelongsToUser(referral, user) {
  if (!referral || !user) {
    return false;
  }

  const userId = String(user.uid || "").trim();

  const possibleReferrerIds = [
    referral.referrerId,
    referral.referrerUID,
    referral.referrerUid,
    referral.userId,
    referral.createdBy,
    referral.ownerId,
    referral.referrer?.uid,
    referral.user?.uid,
  ]
    .filter(Boolean)
    .map((value) => String(value).trim());

  return possibleReferrerIds.includes(userId);
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

   Firebase may contain:
   reward: 0
   paymentAmount: 4

   Therefore paymentAmount is checked first.
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
   Check whether referral is successfully earned
------------------------------------------------- */
function isEarnedReferral(referral) {
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

  const paymentCompleted =
    paymentStatus === "completed" ||
    paymentStatus === "complete" ||
    paymentStatus === "paid";

  const rewardPaid =
    rewardStatus === "earned" ||
    rewardStatus === "paid" ||
    rewardStatus === "completed";

  const referralPaid =
    referralStatus === "paid" ||
    referralStatus === "payment_completed" ||
    referralStatus === "successful";

  const adminApproved =
    adminStatus === "approved" ||
    adminStatus === "accepted" ||
    adminStatus === "successful";

  return (
    reward > 0 &&
    (
      paymentCompleted ||
      rewardPaid ||
      referralPaid ||
      adminApproved
    )
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
    "Not provided"
  );
}

/* -------------------------------------------------
   Get referral created time
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

  useEffect(() => {
    const auth = getAuth();

    let unsubscribeReferrals = null;

    const unsubscribeAuth = onAuthStateChanged(
      auth,
      (user) => {
        if (unsubscribeReferrals) {
          unsubscribeReferrals();
          unsubscribeReferrals = null;
        }

        if (!user) {
          setReferrals([]);
          setLoading(false);
          setErrorMessage(
            "Please login to view your earnings."
          );
          return;
        }

        setLoading(true);
        setErrorMessage("");

        /*
         * Load referrals using the logged-in user's UID.
         */
        const earningsQuery = query(
          collection(db, "referrals"),
          where("referrerId", "==", user.uid)
        );

        unsubscribeReferrals = onSnapshot(
          earningsQuery,
          (snapshot) => {
            const allReferrals = snapshot.docs
              .map((document) => ({
                id: document.id,
                ...document.data(),
              }))
              .filter((referral) =>
                referralBelongsToUser(referral, user)
              );

            const earnedReferrals = allReferrals
              .filter((referral) =>
                isEarnedReferral(referral)
              )
              .sort(
                (firstReferral, secondReferral) =>
                  getCreatedTime(secondReferral) -
                  getCreatedTime(firstReferral)
              );

            setReferrals(earnedReferrals);
            setLoading(false);
          },
          (error) => {
            console.error(
              "Error loading earnings:",
              error
            );

            setReferrals([]);
            setLoading(false);
            setErrorMessage(
              "Unable to load earnings. Please try again."
            );
          }
        );
      }
    );

    return () => {
      unsubscribeAuth();

      if (unsubscribeReferrals) {
        unsubscribeReferrals();
      }
    };
  }, []);

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
      <div className="page-heading">
        <p className="eyebrow">VELZO</p>

        <h1>Earnings</h1>

        <p>
          Your rewards from successful provider
          referrals.
        </p>
      </div>

      {errorMessage && (
        <div className="empty-state">
          {errorMessage}
        </div>
      )}

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

      <div className="earnings-list">
        <h2>Reward History</h2>

        {loading ? (
          <p>Loading...</p>
        ) : referrals.length === 0 ? (
          <p>No earned rewards yet.</p>
        ) : (
          referrals.map((referral) => {
            const reward =
              getReferralReward(referral);

            return (
              <div
                className="earning-row"
                key={referral.id}
              >
                <div>
                  <strong>
                    {getProviderName(referral)}
                  </strong>

                  <span>
                    Successful referral
                  </span>

                  <small>
                    {formatDate(
                      referral.paidAt ||
                        referral.rewardPaidAt ||
                        referral.updatedAt ||
                        referral.createdAt
                    )}
                  </small>

                  <small>
                    Phone: {getProviderPhone(referral)}
                  </small>

                  <small>
                    Union / Labour ID:{" "}
                    {getUnionId(referral)}
                  </small>
                </div>

                <strong>
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