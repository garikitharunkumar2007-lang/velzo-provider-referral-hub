import React, { useEffect, useMemo, useState } from "react";

import {
  collection,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";

import { useNavigate } from "react-router-dom";

import { db } from "../../firebase/firebaseConfig";

import "./AdminReferrals.css";

/* =====================================================
   HELPERS
===================================================== */

function StatusBadge({ value }) {
  const status = String(value || "pending").toLowerCase();

  return (
    <span className={`status-badge ${status}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function formatDate(timestamp) {
  if (!timestamp) {
    return "—";
  }

  try {
    if (typeof timestamp.toDate === "function") {
      return timestamp.toDate().toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      });
    }

    return new Date(timestamp).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

/*
 * Important:
 * Firestore old records may contain:
 * reward: 0
 * paymentAmount: 4
 *
 * Therefore paymentAmount must be checked before reward.
 */
function getReferralReward(referral) {
  const possibleAmounts = [
    referral?.paymentAmount,
    referral?.rewardAmount,
    referral?.rewardEarned,
    referral?.referralReward,
    referral?.amount,
    referral?.earnings,
    referral?.reward,
  ];

  const validAmount = possibleAmounts.find((amount) => {
    return (
      amount !== undefined &&
      amount !== null &&
      amount !== "" &&
      Number(amount) > 0
    );
  });

  return Number(validAmount || 0);
}

/*
 * Normalize all old and new referral statuses.
 */
function getReferralStage(referral) {
  const status = String(referral?.status || "").toLowerCase();
  const paymentStatus = String(
    referral?.paymentStatus || ""
  ).toLowerCase();

  const rewardStatus = String(
    referral?.rewardStatus || ""
  ).toLowerCase();

  const onboardingStatus = String(
    referral?.onboardingStatus || ""
  ).toLowerCase();

  if (
    status === "rejected" ||
    paymentStatus === "rejected" ||
    rewardStatus === "rejected"
  ) {
    return "rejected";
  }

  if (
    status === "paid" ||
    status === "successful" ||
    status === "completed" ||
    paymentStatus === "completed" ||
    paymentStatus === "paid" ||
    rewardStatus === "paid" ||
    rewardStatus === "earned"
  ) {
    return "successful";
  }

  if (
    status === "accepted" ||
    status === "approved" ||
    onboardingStatus === "accepted" ||
    onboardingStatus === "approved"
  ) {
    return "accepted";
  }

  return "pending";
}

/* =====================================================
   COMPONENT
===================================================== */

export default function AdminReferrals() {
  const navigate = useNavigate();

  const [referrals, setReferrals] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const referralsQuery = query(
      collection(db, "referrals"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      referralsQuery,
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }));

        setReferrals(data);
        setLoading(false);
        setError("");
      },
      (snapshotError) => {
        console.error(
          "Admin referrals loading error:",
          snapshotError
        );

        setError(
          "Unable to load referrals. Please refresh the page."
        );

        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const filteredReferrals = useMemo(() => {
    return referrals.filter((referral) => {
      if (filter === "all") {
        return true;
      }

      return getReferralStage(referral) === filter;
    });
  }, [referrals, filter]);

  const pendingCount = referrals.filter((item) => {
    const stage = getReferralStage(item);

    return stage === "pending" || stage === "accepted";
  }).length;

  const successfulCount = referrals.filter((item) => {
    return getReferralStage(item) === "successful";
  }).length;

  const rejectedCount = referrals.filter((item) => {
    return getReferralStage(item) === "rejected";
  }).length;

  return (
    <div className="admin-referrals-page">
      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="admin-page-header">
        <div>
          <p className="eyebrow">VELZO ADMIN</p>

          <h1>Referral Management</h1>

          <p>
            Review, verify and approve provider referrals.
          </p>
        </div>

        <div className="referral-stats">
          <div>
            <strong>{pendingCount}</strong>
            <span>Pending</span>
          </div>

          <div>
            <strong>{successfulCount}</strong>
            <span>Successful</span>
          </div>

          <div>
            <strong>{rejectedCount}</strong>
            <span>Rejected</span>
          </div>
        </div>
      </div>

      {/* =====================================================
          FILTER BAR
      ===================================================== */}

      <div className="filter-bar">
        {[
          {
            value: "all",
            label: "All",
          },
          {
            value: "pending",
            label: "Pending",
          },
          {
            value: "successful",
            label: "Successful",
          },
          {
            value: "rejected",
            label: "Rejected",
          },
        ].map((item) => (
          <button
            key={item.value}
            type="button"
            className={
              filter === item.value ? "active" : ""
            }
            onClick={() => setFilter(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* =====================================================
          ERROR
      ===================================================== */}

      {error && (
        <div className="empty-state">
          {error}
        </div>
      )}

      {/* =====================================================
          LOADING
      ===================================================== */}

      {loading ? (
        <div className="empty-state">
          Loading referrals...
        </div>
      ) : filteredReferrals.length === 0 ? (
        <div className="empty-state">
          No referrals found.
        </div>
      ) : (
        <div className="referrals-table-wrapper">
          <table className="referrals-table">
            <thead>
              <tr>
                <th>Referrer</th>
                <th>Provider</th>
                <th>Phone</th>
                <th>Union ID</th>
                <th>Verification</th>
                <th>Onboarding</th>
                <th>Reward</th>
                <th>Date</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredReferrals.map((referral) => {
                const reward = getReferralReward(referral);
                const stage = getReferralStage(referral);

                return (
                  <tr key={referral.id}>
                    {/* REFERRER */}
                    <td>
                      <strong>
                        {referral.referrerName || "—"}
                      </strong>

                      <small>
                        {referral.referrerId || "—"}
                      </small>
                    </td>

                    {/* PROVIDER */}
                    <td>
                      <strong>
                        {referral.providerName ||
                          referral.fullName ||
                          "—"}
                      </strong>

                      <small>
                        {referral.role || "—"}
                      </small>
                    </td>

                    {/* PHONE */}
                    <td>
                      {referral.phone || "—"}
                    </td>

                    {/* UNION ID */}
                    <td>
                      {referral.unionId || "—"}
                    </td>

                    {/* VERIFICATION */}
                    <td>
                      <StatusBadge
                        value={
                          referral.verificationStatus ||
                          referral.status
                        }
                      />
                    </td>

                    {/* ONBOARDING */}
                    <td>
                      <StatusBadge
                        value={
                          referral.onboardingStatus ||
                          referral.status
                        }
                      />
                    </td>

                    {/* REWARD */}
                    <td>
                      ₹{reward}
                    </td>

                    {/* DATE */}
                    <td>
                      {formatDate(referral.createdAt)}
                    </td>

                    {/* ACTION */}
                    <td>
                      <button
                        type="button"
                        className="view-button"
                        onClick={() =>
                          navigate(
                            `/admin/referrals/${referral.id}`
                          )
                        }
                      >
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}