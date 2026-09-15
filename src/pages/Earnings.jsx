import React, { useEffect, useMemo, useState } from "react";

import {
  collection,
  onSnapshot,
  query,
} from "firebase/firestore";

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
    referralStatus === "successful" ||
    referralStatus === "completed";

  const adminApproved =
    adminStatus === "approved" ||
    adminStatus === "accepted" ||
    adminStatus === "successful" ||
    adminStatus === "paid";

  /*
   * A referral is counted only when:
   * 1. Reward amount is greater than zero
   * 2. Any accepted success/payment status is present
   */
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

  /* -------------------------------------------------
     Load earnings without website login
  ------------------------------------------------- */
  useEffect(() => {
    setLoading(true);
    setErrorMessage("");

    /*
     * No Firebase Auth required here.
     *
     * This reads the referrals collection directly.
     */
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
      {/* Page heading */}
      <div className="page-heading">
        <p className="eyebrow">VELZO</p>

        <h1>Earnings</h1>

        <p>
          Your rewards from successful provider
          referrals.
        </p>
      </div>

      {/* Error message only when Firebase fails */}
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