import React, { useEffect, useMemo, useState } from "react";

import {
  collection,
  onSnapshot,
  query,
} from "firebase/firestore";

import {
  getAuth,
  onAuthStateChanged,
} from "firebase/auth";

import { db } from "../firebase/firebaseConfig";
import { referralBelongsToUser } from "../utils/referralIdentity";

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
   Convert Firebase Timestamp / Date / String
------------------------------------------------- */
function getDateValue(value) {
  if (!value) {
    return null;
  }

  try {
    if (typeof value?.toDate === "function") {
      return value.toDate();
    }

    if (value instanceof Date) {
      return value;
    }

    if (typeof value === "object" && value.seconds) {
      return new Date(value.seconds * 1000);
    }

    if (typeof value === "number") {
      return new Date(value);
    }

    if (typeof value === "string") {
      return new Date(value);
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
   Get reward amount from all possible fields

   Important:
   Firebase currently contains:
   reward: 0
   paymentAmount: 4

   Therefore paymentAmount must be checked
   before reward.
------------------------------------------------- */
function getReferralReward(referral) {
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

  if (Number.isNaN(numericValue)) {
    return 0;
  }

  return numericValue;
}

/* -------------------------------------------------
   Check whether referral reward is successfully earned
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

  const paymentAmount = getReferralReward(referral);

  const isPaymentCompleted =
    paymentStatus === "completed" ||
    paymentStatus === "complete" ||
    paymentStatus === "paid";

  const isRewardPaid =
    rewardStatus === "earned" ||
    rewardStatus === "paid" ||
    rewardStatus === "completed";

  const isReferralPaid =
    referralStatus === "paid" ||
    referralStatus === "payment_completed";

  /*
   * A referral is counted only when:
   * 1. Payment is completed/paid
   * OR
   * 2. Reward is earned/paid
   * OR
   * 3. Referral status is paid
   *
   * Reward amount must be greater than zero.
   */
  return (
    paymentAmount > 0 &&
    (isPaymentCompleted ||
      isRewardPaid ||
      isReferralPaid)
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
   Sort referrals by created date
------------------------------------------------- */
function getCreatedTime(referral) {
  const date =
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
         * Do not filter rewardStatus in Firestore.
         *
         * Existing documents use different values:
         * rewardStatus: paid
         * rewardStatus: earned
         * status: paid
         * paymentStatus: completed
         *
         * So we load the user's referrals and safely
         * identify earned records in JavaScript.
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
                (a, b) =>
                  getCreatedTime(b) -
                  getCreatedTime(a)
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
     Calculate total earned
  ------------------------------------------------- */
  const totalEarned = useMemo(() => {
    return referrals.reduce(
      (sum, referral) =>
        sum + getReferralReward(referral),
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