import React, { useEffect, useState } from "react";

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

import "./ReferralHistory.css";

/* -------------------------------------------------
   Convert status into a safe CSS class
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
   Friendly status display
------------------------------------------------- */
function getFriendlyStatus(value) {
  const status = normalizeStatus(value);

  const statusMap = {
    pending: "Pending Verification",
    submitted: "Submitted",
    under_review: "Under Review",
    verified: "Verified",
    accepted: "Accepted",
    approved: "Approved",
    paid: "Paid",
    completed: "Completed",
    rejected: "Rejected",
  };

  return (
    statusMap[status] ||
    status
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
}

/* -------------------------------------------------
   Display status badge
------------------------------------------------- */
function StatusBadge({ value }) {
  const status = normalizeStatus(value);

  return (
    <span className={`status-badge ${status}`}>
      {getFriendlyStatus(status)}
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
   Get reward from all possible Firestore fields
------------------------------------------------- */
function getReferralReward(referral) {
  const possibleRewardValues = [
    referral.paymentAmount,
    referral.rewardAmount,
    referral.rewardEarned,
    referral.referralReward,
    referral.earnings,
    referral.amount,
    referral.reward,
  ];

  const rewardValue = possibleRewardValues.find(
    (value) =>
      value !== undefined &&
      value !== null &&
      value !== ""
  );

  const numericReward = Number(
    String(rewardValue ?? 0)
      .replace(/₹/g, "")
      .replace(/,/g, "")
  );

  if (!Number.isFinite(numericReward)) {
    return 0;
  }

  return numericReward;
}

/* -------------------------------------------------
   Get provider name
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
   Convert technical rejection reasons into
   friendly user-facing messages
------------------------------------------------- */
function getFriendlyRejectionReason(reason) {
  const originalReason = String(reason || "").trim();

  if (!originalReason) {
    return "Your referral could not be approved. Please contact VELZO support for more details.";
  }

  const normalizedReason = originalReason
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");

  const reasonMap = {
    phone_already_exists:
      "This phone number is already registered with VELZO. Please refer a different provider.",

    invalid_information:
      "The information provided for this provider is invalid. Please check the details and try again.",

    invalid_info:
      "The information provided for this provider is invalid. Please check the details and try again.",

    invalid_data:
      "The provider information could not be verified. Please check the submitted details.",

    duplicate_referral:
      "This provider has already been referred to VELZO.",

    provider_already_registered:
      "This provider is already registered with VELZO.",

    provider_not_found:
      "The provider details could not be verified.",

    incomplete_information:
      "Some required provider information is missing. Please check the details and try again.",

    invalid_phone:
      "The provider phone number is invalid. Please submit a valid phone number.",

    invalid_upi:
      "The payment number or UPI ID could not be verified.",

    no_consent:
      "Provider consent was not confirmed. Please obtain the provider's consent before referring.",

    fake_details:
      "The submitted provider details could not be verified.",

    not_eligible:
      "This provider does not currently meet the referral eligibility requirements.",
  };

  if (reasonMap[normalizedReason]) {
    return reasonMap[normalizedReason];
  }

  /*
   * If admin entered a normal sentence such as:
   * "Provider details are invalid"
   * display it directly.
   */
  return originalReason;
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
          collection(db, "referrals")
        );

        unsubscribeReferrals = onSnapshot(
          referralsQuery,
          (snapshot) => {
            const data = snapshot.docs
              .map((document) => ({
                id: document.id,
                ...document.data(),
              }))
              .filter((referral) =>
                referralBelongsToUser(referral, user)
              )
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

                  if (value?.seconds) {
                    return value.seconds * 1000;
                  }

                  if (value instanceof Date) {
                    return value.getTime();
                  }

                  const parsedDate = new Date(value);

                  return Number.isNaN(parsedDate.getTime())
                    ? 0
                    : parsedDate.getTime();
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

            const providerName =
              getProviderName(referral);

            const phone =
              getProviderPhone(referral);

            const unionId =
              getUnionId(referral);

            const status = normalizeStatus(
              referral.status ||
                referral.paymentStatus ||
                "pending"
            );

            const isRejected = status === "rejected";

            const rejectionReason =
              getFriendlyRejectionReason(
                referral.rejectionReason ||
                  referral.rejectReason ||
                  referral.rejectedReason ||
                  referral.reason
              );

            return (
              <div
                className={`history-card ${
                  isRejected ? "rejected-card" : ""
                }`}
                key={referral.id}
              >
                {/* CARD HEADER */}
                <div className="history-top">
                  <div>
                    <span className="small-label">
                      PROVIDER
                    </span>

                    <h2>{providerName}</h2>
                  </div>

                  <StatusBadge value={status} />
                </div>

                {/* DETAILS */}
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

                {/* FRIENDLY REJECTION REASON */}
                {isRejected && (
                  <div className="rejection-reason-box">
                    <div className="rejection-reason-title">
                      Rejection Reason
                    </div>

                    <p>{rejectionReason}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}