import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import LoadingState from "../../components/LoadingState";
import EmptyState from "../../components/EmptyState";
import StatusBadge from "../../components/StatusBadge";

import { getCollection } from "../../firebase/firestoreConverters";

/* -------------------------------------------------
   Format currency safely
------------------------------------------------- */
function formatCurrency(value) {
  const numericValue = Number(
    String(value ?? 0)
      .replace(/₹/g, "")
      .replace(/,/g, "")
  );

  return `₹${
    Number.isNaN(numericValue)
      ? "0"
      : numericValue.toLocaleString("en-IN")
  }`;
}

/* -------------------------------------------------
   Format date safely
------------------------------------------------- */
function formatDate(value) {
  if (!value) {
    return "—";
  }

  try {
    const date = value?.toDate
      ? value.toDate()
      : value?.seconds
      ? new Date(value.seconds * 1000)
      : new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "—";
    }

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

/* -------------------------------------------------
   Normalize status
------------------------------------------------- */
function normalizeStatus(value) {
  return String(value || "pending")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");
}

/* -------------------------------------------------
   Convert amount safely
------------------------------------------------- */
function getAmount(referral) {
  const possibleValues = [
    referral.paymentAmount,
    referral.reward,
    referral.rewardAmount,
    referral.amount,
    referral.earnings,
    referral.rewardEarned,
    referral.referralReward,
    referral.referralAmount,
  ];

  for (const value of possibleValues) {
    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      const numericValue = Number(
        String(value)
          .replace(/₹/g, "")
          .replace(/,/g, "")
      );

      if (!Number.isNaN(numericValue)) {
        return numericValue;
      }
    }
  }

  return 0;
}

/* -------------------------------------------------
   Get payment status
------------------------------------------------- */
function getPaymentStatus(referral) {
  return (
    referral.paymentStatus ||
    referral.rewardStatus ||
    (normalizeStatus(referral.status) === "paid"
      ? "completed"
      : "not_paid")
  );
}

/* -------------------------------------------------
   Check whether referral contains payment data
------------------------------------------------- */
function hasPaymentInformation(referral) {
  return [
    referral.paymentStatus,
    referral.paymentAmount,
    referral.paymentProofUrl,
    referral.paymentId,
    referral.rewardStatus,
    referral.reward,
    referral.rewardAmount,
    referral.amount,
    referral.earnings,
    referral.rewardEarned,
    referral.referralReward,
  ].some(
    (value) =>
      value !== undefined &&
      value !== null &&
      value !== ""
  );
}

/* -------------------------------------------------
   Admin Payments
------------------------------------------------- */
export default function AdminPayments() {
  const [payments, setPayments] = useState([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadPayments() {
    try {
      setLoading(true);
      setError("");

      const referrals = await getCollection("referrals");

      const referralPayments = referrals
        .filter((referral) =>
          hasPaymentInformation(referral)
        )
        .map((referral) => ({
          ...referral,

          paymentId:
            referral.paymentId ||
            `REF-PAY-${referral.id}`,

          paymentStatus: getPaymentStatus(referral),

          paymentAmount: getAmount(referral),

          paymentMethod:
            referral.paymentMethod ||
            referral.method ||
            "UPI",

          paidAt:
            referral.paidAt ||
            referral.paymentDate ||
            referral.completedAt ||
            null,
        }));

      setPayments(referralPayments);
    } catch (err) {
      console.error(
        "Failed to load referral payments:",
        err
      );

      setError(
        "Unable to load referral payments."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPayments();
  }, []);

  const filteredPayments = useMemo(() => {
    const searchText = search
      .trim()
      .toLowerCase();

    return payments.filter((payment) => {
      const paymentStatus = normalizeStatus(
        payment.paymentStatus
      );

      const matchesStatus =
        statusFilter === "all" ||
        paymentStatus ===
          normalizeStatus(statusFilter);

      if (!matchesStatus) {
        return false;
      }

      if (!searchText) {
        return true;
      }

      const searchableText = [
        payment.id,
        payment.paymentId,
        payment.referrerId,
        payment.referrerName,
        payment.referrerPhone,
        payment.providerId,
        payment.providerName,
        payment.providerPhone,
        payment.phone,
        payment.paymentMethod,
        payment.paymentStatus,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(searchText);
    });
  }, [payments, search, statusFilter]);

  if (loading) {
    return (
      <LoadingState message="Loading referral payments..." />
    );
  }

  return (
    <section className="page-container">
      <div className="page-content">
        <div className="page-header">
          <div>
            <h1>Referral Payments</h1>

            <p>
              View referral rewards, payment status and
              payment proofs.
            </p>
          </div>

          <button
            type="button"
            className="secondary-button"
            onClick={loadPayments}
          >
            ↻ Refresh
          </button>
        </div>

        {error && (
          <div
            className="alert alert-danger"
            role="alert"
          >
            {error}
          </div>
        )}

        <div className="filters-bar">
          <input
            type="search"
            className="search-input"
            placeholder="Search referrer, provider, referral ID..."
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />

          <select
            className="filter-select"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value)
            }
          >
            <option value="all">
              All Payment Statuses
            </option>

            <option value="not_paid">
              Not Paid
            </option>

            <option value="pending">
              Pending
            </option>

            <option value="processing">
              Processing
            </option>

            <option value="completed">
              Completed
            </option>

            <option value="paid">
              Paid
            </option>

            <option value="failed">
              Failed
            </option>
          </select>
        </div>

        {filteredPayments.length === 0 ? (
          <EmptyState
            title="No referral payments found"
            message={
              search || statusFilter !== "all"
                ? "Try changing your search or filter."
                : "Referral payments will appear here."
            }
            icon="💸"
          />
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Payment ID</th>
                  <th>Referrer</th>
                  <th>Provider</th>
                  <th>Referral ID</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th>Paid Date</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredPayments.map((payment) => {
                  const paymentStatus =
                    payment.paymentStatus ||
                    "not_paid";

                  return (
                    <tr key={payment.id}>
                      <td>
                        <span className="table-id">
                          {payment.paymentId}
                        </span>
                      </td>

                      <td>
                        <div>
                          <strong>
                            {payment.referrerName ||
                              "Unknown Referrer"}
                          </strong>
                        </div>

                        <small>
                          {payment.referrerPhone ||
                            "Phone unavailable"}
                        </small>
                      </td>

                      <td>
                        <div>
                          <strong>
                            {payment.providerName ||
                              payment.referredProviderName ||
                              "Unknown Provider"}
                          </strong>
                        </div>

                        <small>
                          {payment.providerPhone ||
                            payment.referredProviderPhone ||
                            payment.phone ||
                            "Phone unavailable"}
                        </small>
                      </td>

                      <td>
                        <span className="table-id">
                          {payment.id}
                        </span>
                      </td>

                      <td>
                        {formatCurrency(
                          payment.paymentAmount
                        )}
                      </td>

                      <td>
                        {payment.paymentMethod}
                      </td>

                      <td>
                        <StatusBadge
                          status={paymentStatus}
                        />
                      </td>

                      <td>
                        {formatDate(payment.paidAt)}
                      </td>

                      <td>
                        <Link
                          to={`/admin/payments/${encodeURIComponent(
                            payment.id
                          )}`}
                          className="primary-button"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}