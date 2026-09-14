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
   Normalize status
------------------------------------------------- */
function normalizeStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

/* -------------------------------------------------
   Check whether a referral is earned
-------------------------------------------------
   Supported examples:

   status: "paid"
   status: "earned"
   status: "successful"
   status: "approved"

   rewardStatus: "earned"
   rewardStatus: "paid"
------------------------------------------------- */
function isEarnedReferral(referral) {
  const status = normalizeStatus(referral.status);
  const rewardStatus = normalizeStatus(referral.rewardStatus);

  const earnedStatuses = [
    "paid",
    "earned",
    "successful",
    "approved",
    "completed",
  ];

  return (
    earnedStatuses.includes(status) ||
    earnedStatuses.includes(rewardStatus)
  );
}

/* -------------------------------------------------
   Get reward amount from possible Firestore fields
------------------------------------------------- */
function getReferralReward(referral) {
  const possibleValues = [
    referral.reward,
    referral.rewardAmount,
    referral.amount,
    referral.earnings,
    referral.rewardEarned,
    referral.referralReward,
  ];

  const existingValue = possibleValues.find(
    (value) =>
      value !== undefined &&
      value !== null &&
      value !== ""
  );

  const numericValue = Number(existingValue);

  return Number.isFinite(numericValue)
    ? numericValue
    : 0;
}

/* -------------------------------------------------
   Get provider name safely
------------------------------------------------- */
function getProviderName(referral) {
  return (
    referral.providerName ||
    referral.name ||
    referral.fullName ||
    referral.provider?.name ||
    "Provider"
  );
}

/* -------------------------------------------------
   Get referral date for sorting
------------------------------------------------- */
function getDateValue(value) {
  if (!value) {
    return 0;
  }

  try {
    if (typeof value?.toMillis === "function") {
      return value.toMillis();
    }

    if (value?.seconds) {
      return value.seconds * 1000;
    }

    if (value instanceof Date) {
      return value.getTime();
    }

    const date = new Date(value).getTime();

    return Number.isFinite(date) ? date : 0;
  } catch {
    return 0;
  }
}

/* -------------------------------------------------
   Format reward amount
------------------------------------------------- */
function formatMoney(value) {
  return Number(value || 0).toLocaleString("en-IN");
}

/* -------------------------------------------------
   Earnings Component
------------------------------------------------- */
export default function Earnings() {
  const [allReferrals, setAllReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const auth = getAuth();

    let unsubscribeReferrals = null;

    const unsubscribeAuth = onAuthStateChanged(
      auth,
      (user) => {
        if (!user) {
          setAllReferrals([]);
          setLoading(false);
          setErrorMessage(
            "Please login to view your earnings."
          );

          if (unsubscribeReferrals) {
            unsubscribeReferrals();
            unsubscribeReferrals = null;
          }

          return;
        }

        setLoading(true);
        setErrorMessage("");

        /*
          Only one Firestore where condition is used.
          This avoids rewardStatus mismatch and
          unnecessary composite-index problems.
        */
        const earningsQuery = query(
          collection(db, "referrals"),
          where("referrerId", "==", user.uid)
        );

        unsubscribeReferrals = onSnapshot(
          earningsQuery,
          (snapshot) => {
            const referralData = snapshot.docs
              .map((document) => ({
                id: document.id,
                ...document.data(),
              }))
              .sort(
                (a, b) =>
                  getDateValue(b.createdAt) -
                  getDateValue(a.createdAt)
              );

            setAllReferrals(referralData);
            setLoading(false);
          },
          (error) => {
            console.error(
              "Error loading earnings:",
              error
            );

            setAllReferrals([]);
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

  /*
    Only paid/earned/successful/approved referrals
    are included in earnings.
  */
  const earnedReferrals = useMemo(() => {
    return allReferrals.filter(isEarnedReferral);
  }, [allReferrals]);

  /* -------------------------------------------------
     Total earned amount
  ------------------------------------------------- */
  const totalEarned = useMemo(() => {
    return earnedReferrals.reduce(
      (sum, referral) =>
        sum + getReferralReward(referral),
      0
    );
  }, [earnedReferrals]);

  /* -------------------------------------------------
     ₹4 referrals
  ------------------------------------------------- */
  const fourRupee = useMemo(() => {
    return earnedReferrals.filter(
      (referral) =>
        getReferralReward(referral) === 4
    ).length;
  }, [earnedReferrals]);

  /* -------------------------------------------------
     ₹3 referrals
  ------------------------------------------------- */
  const threeRupee = useMemo(() => {
    return earnedReferrals.filter(
      (referral) =>
        getReferralReward(referral) === 3
    ).length;
  }, [earnedReferrals]);

  return (
    <div className="earnings-page">
      <div className="page-heading">
        <p className="eyebrow">
          VELZO
        </p>

        <h1>
          Earnings
        </h1>

        <p>
          Your rewards from successful provider referrals.
        </p>
      </div>

      <div className="earnings-hero">
        <span>
          TOTAL EARNED
        </span>

        <strong>
          ₹{formatMoney(totalEarned)}
        </strong>

        <small>
          From {earnedReferrals.length} successful referral
          {earnedReferrals.length !== 1
            ? "s"
            : ""}
        </small>
      </div>

      <div className="earnings-grid">
        <div className="earning-card">
          <span>
            ₹4 REFERRALS
          </span>

          <strong>
            {fourRupee}
          </strong>

          <small>
            With Union / Labour ID
          </small>
        </div>

        <div className="earning-card">
          <span>
            ₹3 REFERRALS
          </span>

          <strong>
            {threeRupee}
          </strong>

          <small>
            Without Union / Labour ID
          </small>
        </div>

        <div className="earning-card">
          <span>
            SUCCESSFUL
          </span>

          <strong>
            {earnedReferrals.length}
          </strong>

          <small>
            Approved referrals
          </small>
        </div>
      </div>

      <div className="earnings-list">
        <h2>
          Reward History
        </h2>

        {loading ? (
          <p>
            Loading...
          </p>
        ) : errorMessage ? (
          <p>
            {errorMessage}
          </p>
        ) : earnedReferrals.length === 0 ? (
          <p>
            No earned rewards yet.
          </p>
        ) : (
          earnedReferrals.map((referral) => {
            const reward = getReferralReward(
              referral
            );

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
                </div>

                <strong>
                  +₹{formatMoney(reward)}
                </strong>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}