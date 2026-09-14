import React, { useEffect, useState } from "react";

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

import "./ReferralHistory.css";

/* -------------------------------------------------
   Convert any status into a safe CSS class
------------------------------------------------- */
function normalizeStatus(value) {
  const status = String(value || "pending")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

  return status || "pending";
}

/* -------------------------------------------------
   Display status badge
------------------------------------------------- */
function StatusBadge({ value }) {
  const status = normalizeStatus(value);

  const displayStatus = status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

  return (
    <span className={`status-badge ${status}`}>
      {displayStatus}
    </span>
  );
}

/* -------------------------------------------------
   Safely format Firebase Timestamp / Date / String
------------------------------------------------- */
function formatDate(value) {
  if (!value) {
    return "—";
  }

  try {
    let date;

    if (typeof value?.toDate === "function") {
      date = value.toDate();
    } else if (value instanceof Date) {
      date = value;
    } else if (typeof value === "string") {
      date = new Date(value);
    } else if (typeof value === "number") {
      date = new Date(value);
    } else if (value?.seconds) {
      date = new Date(value.seconds * 1000);
    }

    if (!date || Number.isNaN(date.getTime())) {
      return "—";
    }

    return date.toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch (error) {
    console.error("Date formatting error:", error);
    return "—";
  }
}

/* -------------------------------------------------
   Get reward from all possible Firestore field names
------------------------------------------------- */
function getReferralReward(referral) {
  const possibleRewardValues = [
    referral.reward,
    referral.rewardAmount,
    referral.amount,
    referral.earnings,
    referral.rewardEarned,
    referral.referralReward,
  ];

  const rewardValue = possibleRewardValues.find(
    (value) =>
      value !== undefined &&
      value !== null &&
      value !== ""
  );

  const numericReward = Number(rewardValue);

  if (Number.isNaN(numericReward)) {
    return 0;
  }

  return numericReward;
}

/* -------------------------------------------------
   Get provider name from possible field names
------------------------------------------------- */
function getProviderName(referral) {
  return (
    referral.providerName ||
    referral.name ||
    referral.provider?.name ||
    referral.fullName ||
    "—"
  );
}

/* -------------------------------------------------
   Get phone from possible field names
------------------------------------------------- */
function getProviderPhone(referral) {
  return (
    referral.phone ||
    referral.phoneNumber ||
    referral.mobile ||
    referral.mobileNumber ||
    "—"
  );
}

/* -------------------------------------------------
   Get Union / Labour ID from possible field names
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
   Referral History Component
------------------------------------------------- */
export default function ReferralHistory() {
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const auth = getAuth();

    let unsubscribeReferrals = null;

    const unsubscribeAuth = onAuthStateChanged(
      auth,
      (user) => {
        // User is not logged in
        if (!user) {
          setReferrals([]);
          setLoading(false);
          setErrorMessage("Please login to view referral history.");

          if (unsubscribeReferrals) {
            unsubscribeReferrals();
            unsubscribeReferrals = null;
          }

          return;
        }

        setLoading(true);
        setErrorMessage("");

        const referralsQuery = query(
          collection(db, "referrals"),
          where("referrerId", "==", user.uid)
        );

        unsubscribeReferrals = onSnapshot(
          referralsQuery,
          (snapshot) => {
            const data = snapshot.docs
              .map((document) => {
                const referralData = document.data();

                return {
                  id: document.id,
                  ...referralData,
                };
              })
              .sort((a, b) => {
                const aTime =
                  a.createdAt?.toMillis?.() ||
                  (a.createdAt?.seconds
                    ? a.createdAt.seconds * 1000
                    : new Date(a.createdAt || 0).getTime()) ||
                  0;

                const bTime =
                  b.createdAt?.toMillis?.() ||
                  (b.createdAt?.seconds
                    ? b.createdAt.seconds * 1000
                    : new Date(b.createdAt || 0).getTime()) ||
                  0;

                return bTime - aTime;
              });

            setReferrals(data);
            setLoading(false);
          },
          (error) => {
            console.error(
              "Error loading referral history:",
              error
            );

            setReferrals([]);
            setLoading(false);
            setErrorMessage(
              "Unable to load referral history. Please try again."
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

  return (
    <div className="history-page">
      <div className="page-heading">
        <p className="eyebrow">VELZO</p>

        <h1>Referral History</h1>

        <p>Track the providers you have referred.</p>
      </div>

      {loading ? (
        <div className="empty-state">
          Loading referral history...
        </div>
      ) : errorMessage ? (
        <div className="empty-state">
          {errorMessage}
        </div>
      ) : referrals.length === 0 ? (
        <div className="empty-state">
          You haven't submitted any referrals yet.
        </div>
      ) : (
        <div className="history-list">
          {referrals.map((referral) => {
            const reward = getReferralReward(referral);
            const providerName = getProviderName(referral);
            const phone = getProviderPhone(referral);
            const unionId = getUnionId(referral);

            return (
              <div
                className="history-card"
                key={referral.id}
              >
                <div className="history-top">
                  <div>
                    <span className="small-label">
                      PROVIDER
                    </span>

                    <h2>{providerName}</h2>
                  </div>

                  <StatusBadge value={referral.status} />
                </div>

                <div className="history-details">
                  <div>
                    <span>Phone</span>

                    <strong>{phone}</strong>
                  </div>

                  <div>
                    <span>Union / Labour ID</span>

                    <strong>{unionId}</strong>
                  </div>

                  <div>
                    <span>Reward</span>

                    <strong>
                      ₹{reward.toLocaleString("en-IN")}
                    </strong>
                  </div>

                  <div>
                    <span>Date</span>

                    <strong>
                      {formatDate(referral.createdAt)}
                    </strong>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}