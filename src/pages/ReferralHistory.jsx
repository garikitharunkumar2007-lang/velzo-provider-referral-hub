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
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");

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
    let date = null;

    if (typeof value?.toDate === "function") {
      date = value.toDate();
    } else if (value instanceof Date) {
      date = value;
    } else if (typeof value === "string") {
      date = new Date(value);
    } else if (typeof value === "number") {
      date = new Date(value);
    } else if (
      typeof value === "object" &&
      typeof value.seconds === "number"
    ) {
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
   Convert possible amount values into number
------------------------------------------------- */
function convertToNumber(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value === "string") {
    const cleanedValue = value
      .replace(/₹/g, "")
      .replace(/,/g, "")
      .trim();

    if (!cleanedValue) {
      return null;
    }

    const numericValue = Number(cleanedValue);

    return Number.isNaN(numericValue)
      ? null
      : numericValue;
  }

  const numericValue = Number(value);

  return Number.isNaN(numericValue)
    ? null
    : numericValue;
}

/* -------------------------------------------------
   Get reward from all supported Firestore fields
------------------------------------------------- */
function getReferralReward(referral) {
  const possibleRewardValues = [
    referral.reward,
    referral.rewardAmount,
    referral.paymentAmount,
    referral.amount,
    referral.earnings,
    referral.rewardEarned,
    referral.referralReward,
    referral.referralAmount,
  ];

  for (const value of possibleRewardValues) {
    const numericValue = convertToNumber(value);

    if (numericValue !== null) {
      return numericValue;
    }
  }

  return 0;
}

/* -------------------------------------------------
   Get provider name safely

   Important:
   Do not use referral.name first because it may
   contain the referrer's name.
------------------------------------------------- */
function getProviderName(referral) {
  return (
    referral.providerName ||
    referral.referredProviderName ||
    referral.providerFullName ||
    referral.provider?.name ||
    referral.provider?.fullName ||
    referral.referredProvider?.name ||
    referral.referredProvider?.fullName ||
    referral.providerDetails?.name ||
    referral.providerDetails?.fullName ||
    referral.serviceProviderName ||
    "Provider name unavailable"
  );
}

/* -------------------------------------------------
   Get provider phone safely
------------------------------------------------- */
function getProviderPhone(referral) {
  return (
    referral.providerPhone ||
    referral.providerPhoneNumber ||
    referral.referredProviderPhone ||
    referral.referredProviderMobile ||
    referral.provider?.phone ||
    referral.provider?.phoneNumber ||
    referral.provider?.mobile ||
    referral.phone ||
    referral.phoneNumber ||
    referral.mobile ||
    referral.mobileNumber ||
    "Phone unavailable"
  );
}

/* -------------------------------------------------
   Get Union / Labour ID safely
------------------------------------------------- */
function getUnionId(referral) {
  return (
    referral.providerUnionId ||
    referral.providerUnionID ||
    referral.referredProviderUnionId ||
    referral.referredProviderUnionID ||
    referral.unionId ||
    referral.unionID ||
    referral.labourId ||
    referral.labourID ||
    referral.unionLabourId ||
    referral.provider?.unionId ||
    referral.provider?.unionID ||
    "Not provided"
  );
}

/* -------------------------------------------------
   Get status from all possible fields
------------------------------------------------- */
function getReferralStatus(referral) {
  return (
    referral.status ||
    referral.referralStatus ||
    referral.paymentStatus ||
    referral.rewardStatus ||
    "pending"
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
        if (unsubscribeReferrals) {
          unsubscribeReferrals();
          unsubscribeReferrals = null;
        }

        if (!user) {
          setReferrals([]);
          setLoading(false);
          setErrorMessage(
            "Please login to view referral history."
          );

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
                const getTime = (value) => {
                  if (!value) {
                    return 0;
                  }

                  if (
                    typeof value?.toMillis === "function"
                  ) {
                    return value.toMillis();
                  }

                  if (
                    typeof value?.seconds === "number"
                  ) {
                    return value.seconds * 1000;
                  }

                  const date = new Date(value);

                  return Number.isNaN(date.getTime())
                    ? 0
                    : date.getTime();
                };

                return (
                  getTime(b.createdAt) -
                  getTime(a.createdAt)
                );
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
            const status = getReferralStatus(referral);

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

                  <StatusBadge value={status} />
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