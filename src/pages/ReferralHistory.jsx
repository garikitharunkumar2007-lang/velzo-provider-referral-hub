import {
  useEffect,
  useState,
} from "react";

import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";

import { db } from "../firebase/firebaseConfig";

import StatusBadge from "../components/StatusBadge";

import "./ReferralHistory.css";

const GUEST_STORAGE_KEY =
  "velzoGuestReferralOwner";

function createGuestId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `guest_${crypto.randomUUID()}`;
  }

  return `guest_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2)}`;
}

function getGuestOwnerId() {
  try {
    let ownerId = localStorage.getItem(
      GUEST_STORAGE_KEY
    );

    if (!ownerId) {
      ownerId = createGuestId();

      localStorage.setItem(
        GUEST_STORAGE_KEY,
        ownerId
      );
    }

    return ownerId;
  } catch (error) {
    console.error(
      "Guest history owner error:",
      error
    );

    return "guest_fallback";
  }
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  try {
    let date;

    if (
      typeof value.toDate === "function"
    ) {
      date = value.toDate();
    } else if (
      value.seconds
    ) {
      date = new Date(
        value.seconds * 1000
      );
    } else {
      date = new Date(value);
    }

    if (
      !date ||
      Number.isNaN(date.getTime())
    ) {
      return "—";
    }

    return date.toLocaleString(
      "en-IN",
      {
        dateStyle: "medium",
        timeStyle: "short",
      }
    );
  } catch {
    return "—";
  }
}

function getReward(referral) {
  const possibleValues = [
    referral.paymentAmount,
    referral.rewardAmount,
    referral.rewardEarned,
    referral.referralReward,
    referral.reward,
    referral.earnings,
  ];

  const value =
    possibleValues.find(
      (item) =>
        item !== undefined &&
        item !== null &&
        item !== ""
    ) || 0;

  const numberValue = Number(
    String(value)
      .replace(/₹/g, "")
      .replace(/,/g, "")
  );

  return Number.isFinite(numberValue)
    ? numberValue
    : 0;
}

function getStatus(referral) {
  return (
    referral.status ||
    referral.verificationStatus ||
    referral.adminStatus ||
    "pending"
  );
}

export default function ReferralHistory() {
  const [referrals, setReferrals] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    const ownerId =
      getGuestOwnerId();

    const referralsQuery = query(
      collection(db, "referrals"),
      where(
        "referrerId",
        "==",
        ownerId
      )
    );

    const unsubscribe =
      onSnapshot(
        referralsQuery,
        (snapshot) => {
          const data =
            snapshot.docs
              .map((item) => ({
                id: item.id,
                ...item.data(),
              }))
              .sort((a, b) => {
                const first =
                  a.createdAt?.seconds ||
                  0;

                const second =
                  b.createdAt?.seconds ||
                  0;

                return second - first;
              });

          setReferrals(data);
          setLoading(false);
          setError("");
        },
        (snapshotError) => {
          console.error(
            "Referral history error:",
            snapshotError
          );

          setError(
            "Unable to load referral history."
          );

          setLoading(false);
        }
      );

    return () => unsubscribe();
  }, []);

  return (
    <div className="history-page">
      <div className="page-heading">
        <p className="eyebrow">
          VELZO
        </p>

        <h1>
          Referral History
        </h1>

        <p>
          Track the providers you referred.
        </p>
      </div>

      {loading && (
        <div className="empty-state">
          Loading referral history...
        </div>
      )}

      {!loading && error && (
        <div className="empty-state">
          {error}
        </div>
      )}

      {!loading &&
        !error &&
        referrals.length === 0 && (
          <div className="empty-state">
            You haven't submitted any referrals yet.
          </div>
        )}

      {!loading &&
        !error &&
        referrals.length > 0 && (
          <div className="history-list">
            {referrals.map((referral) => {
              const status =
                getStatus(referral);

              const reward =
                getReward(referral);

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

                      <h2>
                        {referral.providerName ||
                          referral.fullName ||
                          "—"}
                      </h2>
                    </div>

                    <StatusBadge
                      value={status}
                    />
                  </div>

                  <div className="history-details">
                    <div>
                      <span>
                        Phone
                      </span>

                      <strong>
                        {referral.phone ||
                          "—"}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Union / Labour ID
                      </span>

                      <strong>
                        {referral.unionId ||
                          "Not provided"}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Reward
                      </span>

                      <strong>
                        ₹
                        {reward.toLocaleString(
                          "en-IN"
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Date
                      </span>

                      <strong>
                        {formatDate(
                          referral.createdAt
                        )}
                      </strong>
                    </div>
                  </div>

                  {status === "rejected" && (
                    <div className="rejection-reason-box">
                      <strong>
                        Rejection Reason
                      </strong>

                      <p>
                        {referral.rejectionReason ||
                          "Referral was rejected."}
                      </p>
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