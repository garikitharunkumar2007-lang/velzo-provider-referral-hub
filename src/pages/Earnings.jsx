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

/* =====================================================
   NORMALIZE TEXT
===================================================== */

function normalizeStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ");
}

/* =====================================================
   CONVERT FIREBASE DATE
===================================================== */

function getDateValue(value) {
  if (!value) {
    return null;
  }

  try {
    if (
      typeof value === "object" &&
      typeof value.toDate === "function"
    ) {
      return value.toDate();
    }

    if (
      typeof value === "object" &&
      typeof value.seconds === "number"
    ) {
      return new Date(value.seconds * 1000);
    }

    if (value instanceof Date) {
      return value;
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

/* =====================================================
   FORMAT DATE
===================================================== */

function formatDate(value) {
  const date = getDateValue(value);

  if (!date) {
    return "—";
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/* =====================================================
   GET REWARD AMOUNT

   Positive reward values are preferred.
   This prevents reward: 0 from hiding
   rewardAmount/paymentAmount: 3.
===================================================== */

function getReferralReward(referral) {
  if (!referral) {
    return 0;
  }

  const possibleValues = [
    referral.rewardAmount,
    referral.rewardEarned,
    referral.referralReward,
    referral.earnings,
    referral.amount,
    referral.reward,
    referral.paymentAmount,
  ];

  const numericValues = possibleValues
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (numericValues.length === 0) {
    return 0;
  }

  return numericValues[0];
}

/* =====================================================
   CHECK EARNED / PAID REFERRAL
===================================================== */

function isEarnedReferral(referral) {
  if (!referral) {
    return false;
  }

  const reward = getReferralReward(referral);

  if (reward <= 0) {
    return false;
  }

  const status = normalizeStatus(referral.status);

  const paymentStatus = normalizeStatus(
    referral.paymentStatus
  );

  const rewardStatus = normalizeStatus(
    referral.rewardStatus
  );

  const verificationStatus = normalizeStatus(
    referral.verificationStatus
  );

  const adminStatus = normalizeStatus(
    referral.adminStatus
  );

  const rejected =
    status === "rejected" ||
    status === "declined" ||
    status === "cancelled" ||
    status === "canceled" ||
    paymentStatus === "rejected" ||
    paymentStatus === "failed";

  if (rejected) {
    return false;
  }

  const paidByStatus =
    status === "paid" ||
    status === "successful" ||
    status === "success" ||
    status === "completed" ||
    status === "payment completed";

  const paidByPaymentStatus =
    paymentStatus === "paid" ||
    paymentStatus === "completed" ||
    paymentStatus === "complete" ||
    paymentStatus === "success" ||
    paymentStatus === "successful";

  const paidByRewardStatus =
    rewardStatus === "paid" ||
    rewardStatus === "earned" ||
    rewardStatus === "completed";

  const approvedByAdmin =
    adminStatus === "approved" ||
    adminStatus === "accepted" ||
    adminStatus === "successful" ||
    adminStatus === "paid";

  const verified =
    verificationStatus === "verified" ||
    verificationStatus === "completed";

  return (
    paidByStatus ||
    paidByPaymentStatus ||
    paidByRewardStatus ||
    approvedByAdmin ||
    verified
  );
}

/* =====================================================
   GET PROVIDER NAME
===================================================== */

function getProviderName(referral) {
  return (
    referral.providerName ||
    referral.provider?.name ||
    referral.provider?.fullName ||
    referral.name ||
    referral.fullName ||
    "Provider"
  );
}

/* =====================================================
   GET PROVIDER PHONE
===================================================== */

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

/* =====================================================
   GET UNION / LABOUR ID
===================================================== */

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

/* =====================================================
   GET REFERRAL DATE
===================================================== */

function getCreatedTime(referral) {
  const date =
    getDateValue(referral.paidAt) ||
    getDateValue(referral.rewardPaidAt) ||
    getDateValue(referral.updatedAt) ||
    getDateValue(referral.createdAt) ||
    getDateValue(referral.submittedAt);

  return date ? date.getTime() : 0;
}

/* =====================================================
   CHECK WHETHER REFERRAL BELONGS TO USER
===================================================== */

function referralBelongsToUser(referral, user) {
  if (!referral || !user) {
    return false;
  }

  const currentUserIds = [
    user.uid,
    user.id,
    user.userId,
  ]
    .filter(Boolean)
    .map(String);

  const referralUserIds = [
    referral.referrerId,
    referral.referrerUid,
    referral.referrerUserId,
    referral.referredBy,
    referral.userId,
    referral.uid,
  ]
    .filter(Boolean)
    .map(String);

  return referralUserIds.some((referralUserId) =>
    currentUserIds.includes(referralUserId)
  );
}

/* =====================================================
   EARNINGS COMPONENT
===================================================== */

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
          setErrorMessage("");
          return;
        }

        setLoading(true);
        setErrorMessage("");

        /*
         * Load only referrals created by
         * the currently logged-in website user.
         */
        const earningsQuery = query(
          collection(db, "referrals"),
          where("referrerId", "==", user.uid)
        );

        unsubscribeReferrals = onSnapshot(
          earningsQuery,
          (snapshot) => {
            try {
              const userReferrals = snapshot.docs
                .map((documentSnapshot) => ({
                  id: documentSnapshot.id,
                  ...documentSnapshot.data(),
                }))
                .filter((referral) =>
                  referralBelongsToUser(referral, user)
                )
                .filter((referral) =>
                  isEarnedReferral(referral)
                )
                .sort(
                  (firstReferral, secondReferral) =>
                    getCreatedTime(secondReferral) -
                    getCreatedTime(firstReferral)
                );

              setReferrals(userReferrals);
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
              "Unable to load earnings data. Please try again."
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

  /* =====================================================
     TOTAL EARNED
  ===================================================== */

  const totalEarned = useMemo(() => {
    return referrals.reduce(
      (total, referral) =>
        total + getReferralReward(referral),
      0
    );
  }, [referrals]);

  /* =====================================================
     ₹4 REFERRALS
  ===================================================== */

  const fourRupee = useMemo(() => {
    return referrals.filter(
      (referral) =>
        getReferralReward(referral) === 4
    ).length;
  }, [referrals]);

  /* =====================================================
     ₹3 REFERRALS
  ===================================================== */

  const threeRupee = useMemo(() => {
    return referrals.filter(
      (referral) =>
        getReferralReward(referral) === 3
    ).length;
  }, [referrals]);

  return (
    <div className="earnings-page">
      {/* PAGE HEADING */}

      <div className="page-heading">
        <p className="eyebrow">VELZO</p>

        <h1>Earnings</h1>

        <p>
          Your rewards from successful provider
          referrals.
        </p>
      </div>

      {/* ERROR MESSAGE */}

      {errorMessage && (
        <div className="empty-state error-state">
          {errorMessage}
        </div>
      )}

      {/* TOTAL EARNED */}

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

      {/* EARNINGS SUMMARY */}

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

      {/* REWARD HISTORY */}

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