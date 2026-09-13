import React, {
  useEffect,
  useState,
} from "react";

import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";

import {
  getAuth,
} from "firebase/auth";

import { db } from "../firebase/firebaseConfig";

import "./ReferralHistory.css";

function StatusBadge({
  value,
}) {
  const status =
    String(value || "pending")
      .toLowerCase();

  return (
    <span
      className={`status-badge ${status}`}
    >
      {status.replace(
        /_/g,
        " "
      )}
    </span>
  );
}

function formatDate(timestamp) {
  if (!timestamp) {
    return "—";
  }

  try {
    return timestamp
      .toDate()
      .toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      });
  } catch {
    return "—";
  }
}

export default function ReferralHistory() {
  const [referrals, setReferrals] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    const auth =
      getAuth();

    const user =
      auth.currentUser;

    if (!user) {
      setLoading(false);
      return;
    }

    const referralsQuery =
      query(
        collection(
          db,
          "referrals"
        ),
        where(
          "referrerId",
          "==",
          user.uid
        )
      );

    const unsubscribe =
      onSnapshot(
        referralsQuery,
        (snapshot) => {
          const data =
            snapshot.docs
              .map(
                (doc) => ({
                  id: doc.id,
                  ...doc.data(),
                })
              )
              .sort(
                (a, b) => {
                  const aTime =
                    a.createdAt
                      ?.toMillis?.() ||
                    0;

                  const bTime =
                    b.createdAt
                      ?.toMillis?.() ||
                    0;

                  return (
                    bTime -
                    aTime
                  );
                }
              );

          setReferrals(data);
          setLoading(false);
        },
        (error) => {
          console.error(
            error
          );

          setLoading(false);
        }
      );

    return unsubscribe;
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
          Track the providers you have referred.
        </p>
      </div>

      {loading ? (
        <div className="empty-state">
          Loading...
        </div>
      ) : referrals.length ===
        0 ? (
        <div className="empty-state">
          You haven't submitted any referrals yet.
        </div>
      ) : (
        <div className="history-list">
          {referrals.map(
            (referral) => (
              <div
                className="history-card"
                key={
                  referral.id
                }
              >
                <div className="history-top">
                  <div>
                    <span className="small-label">
                      PROVIDER
                    </span>

                    <h2>
                      {referral.providerName ||
                        "—"}
                    </h2>
                  </div>

                  <StatusBadge
                    value={
                      referral.status
                    }
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
                      {referral.reward ||
                        0}
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
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}