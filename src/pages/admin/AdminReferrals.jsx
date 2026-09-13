import React, {
  useEffect,
  useState,
} from "react";

import {
  collection,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";

import {
  useNavigate,
} from "react-router-dom";

import { db } from "../../firebase/firebaseConfig";

import "./AdminReferrals.css";

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

export default function AdminReferrals() {
  const navigate =
    useNavigate();

  const [referrals, setReferrals] =
    useState([]);

  const [filter, setFilter] =
    useState("all");

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    const referralsQuery =
      query(
        collection(
          db,
          "referrals"
        ),
        orderBy(
          "createdAt",
          "desc"
        )
      );

    const unsubscribe =
      onSnapshot(
        referralsQuery,
        (snapshot) => {
          const data =
            snapshot.docs.map(
              (item) => ({
                id: item.id,
                ...item.data(),
              })
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

  const filteredReferrals =
    referrals.filter(
      (referral) => {
        if (
          filter ===
          "all"
        ) {
          return true;
        }

        return (
          referral.status ===
          filter
        );
      }
    );

  const pending =
    referrals.filter(
      (item) =>
        item.status ===
        "pending"
    ).length;

  const successful =
    referrals.filter(
      (item) =>
        item.status ===
        "successful"
    ).length;

  const rejected =
    referrals.filter(
      (item) =>
        item.status ===
        "rejected"
    ).length;

  return (
    <div className="admin-referrals-page">
      <div className="admin-page-header">
        <div>
          <p className="eyebrow">
            VELZO ADMIN
          </p>

          <h1>
            Referral Management
          </h1>

          <p>
            Review, verify and approve provider referrals.
          </p>
        </div>

        <div className="referral-stats">
          <div>
            <strong>
              {pending}
            </strong>
            <span>
              Pending
            </span>
          </div>

          <div>
            <strong>
              {successful}
            </strong>
            <span>
              Successful
            </span>
          </div>

          <div>
            <strong>
              {rejected}
            </strong>
            <span>
              Rejected
            </span>
          </div>
        </div>
      </div>

      <div className="filter-bar">
        {[
          "all",
          "pending",
          "successful",
          "rejected",
        ].map(
          (item) => (
            <button
              key={item}
              className={
                filter === item
                  ? "active"
                  : ""
              }
              onClick={() =>
                setFilter(
                  item
                )
              }
            >
              {item ===
              "all"
                ? "All"
                : item
                    .charAt(0)
                    .toUpperCase() +
                  item.slice(1)}
            </button>
          )
        )}
      </div>

      {loading ? (
        <div className="empty-state">
          Loading referrals...
        </div>
      ) : filteredReferrals.length ===
        0 ? (
        <div className="empty-state">
          No referrals found.
        </div>
      ) : (
        <div className="referrals-table-wrapper">
          <table className="referrals-table">
            <thead>
              <tr>
                <th>
                  Referrer
                </th>

                <th>
                  Provider
                </th>

                <th>
                  Phone
                </th>

                <th>
                  Union ID
                </th>

                <th>
                  Verification
                </th>

                <th>
                  Onboarding
                </th>

                <th>
                  Reward
                </th>

                <th>
                  Date
                </th>

                <th>
                  Action
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredReferrals.map(
                (
                  referral
                ) => (
                  <tr
                    key={
                      referral.id
                    }
                  >
                    <td>
                      <strong>
                        {referral.referrerName ||
                          "—"}
                      </strong>

                      <small>
                        {referral.referrerId ||
                          "—"}
                      </small>
                    </td>

                    <td>
                      <strong>
                        {referral.providerName ||
                          "—"}
                      </strong>

                      <small>
                        {referral.role ||
                          "—"}
                      </small>
                    </td>

                    <td>
                      {referral.phone ||
                        "—"}
                    </td>

                    <td>
                      {referral.unionId ||
                        "—"}
                    </td>

                    <td>
                      <StatusBadge
                        value={
                          referral.verificationStatus
                        }
                      />
                    </td>

                    <td>
                      <StatusBadge
                        value={
                          referral.onboardingStatus
                        }
                      />
                    </td>

                    <td>
                      ₹
                      {referral.reward ||
                        0}
                    </td>

                    <td>
                      {formatDate(
                        referral.createdAt
                      )}
                    </td>

                    <td>
                      <button
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
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}