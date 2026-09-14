import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import LoadingState from "../../components/LoadingState";
import EmptyState from "../../components/EmptyState";
import StatusBadge from "../../components/StatusBadge";

import { getCollection } from "../../firebase/firestoreConverters";

/* -------------------------------------------------
   Format currency
------------------------------------------------- */
function formatCurrency(value) {
  const amount = Number(value || 0);

  return `₹${amount.toLocaleString("en-IN")}`;
}

/* -------------------------------------------------
   Convert Firebase Timestamp / Date / String
------------------------------------------------- */
function getDateValue(value) {
  if (!value) {
    return null;
  }

  try {
    if (typeof value?.toDate === "function") {
      return value.toDate();
    }

    if (value instanceof Date) {
      return value;
    }

    if (typeof value === "object" && value.seconds) {
      return new Date(value.seconds * 1000);
    }

    if (typeof value === "number") {
      return new Date(value);
    }

    if (typeof value === "string") {
      return new Date(value);
    }

    return null;
  } catch {
    return null;
  }
}

/* -------------------------------------------------
   Format date
------------------------------------------------- */
function formatDate(value) {
  const date = getDateValue(value);

  if (!date || Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/* -------------------------------------------------
   Normalize status
------------------------------------------------- */
function normalizeStatus(value) {
  return String(value || "pending")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

/* -------------------------------------------------
   Get payment amount from all possible fields
------------------------------------------------- */
function getPaymentAmount(referral) {
  const possibleValues = [
    referral.paymentAmount,
    referral.rewardAmount,
    referral.rewardEarned,
    referral.referralReward,
    referral.earnings,
    referral.amount,
    referral.reward,
  ];

  const validValue = possibleValues.find(
    (value) =>
      value !== undefined &&
      value !== null &&
      value !== ""
  );

  const numericValue = Number(validValue);

  return Number.isNaN(numericValue)
    ? 0
    : numericValue;
}

/* -------------------------------------------------
   Get payment status

   Firebase currently has:
   paymentStatus: completed
   status: paid
   rewardStatus: paid
------------------------------------------------- */
function getPaymentStatus(referral) {
  const paymentStatus = normalizeStatus(
    referral.paymentStatus
  );

  const status = normalizeStatus(
    referral.status
  );

  const rewardStatus = normalizeStatus(
    referral.rewardStatus
  );

  if (
    paymentStatus === "completed" ||
    paymentStatus === "complete" ||
    paymentStatus === "paid"
  ) {
    return "completed";
  }

  if (
    status === "paid" ||
    status === "payment_completed"
  ) {
    return "completed";
  }

  if (
    rewardStatus === "paid" ||
    rewardStatus === "earned" ||
    rewardStatus === "completed"
  ) {
    return "completed";
  }

  if (paymentStatus) {
    return paymentStatus;
  }

  return "not_paid";
}

/* -------------------------------------------------
   Get payment date
------------------------------------------------- */
function getPaymentDate(referral) {
  return (
    referral.paidAt ||
    referral.paymentCompletedAt ||
    referral.rewardPaidAt ||
    referral.updatedAt ||
    null
  );
}

/* -------------------------------------------------
   Check whether document is payment-related
------------------------------------------------- */
function isPaymentRecord(referral) {
  return Boolean(
    referral.paymentStatus ||
      referral.paymentAmount !== undefined ||
      referral.paymentProofUrl ||
      referral.paymentProofPath ||
      referral.paymentProof ||
      referral.rewardStatus ||
      referral.reward !== undefined ||
      referral.paidAt
  );
}

/* -------------------------------------------------
   Admin Payments Component
------------------------------------------------- */
export default function AdminPayments() {
  const [payments, setPayments] = useState([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("all");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* -------------------------------------------------
     Load referral payments
  ------------------------------------------------- */
  async function loadPayments() {
    try {
      setLoading(true);
      setError("");

      const referrals = await getCollection(
        "referrals"
      );

      const referralPayments = referrals
        .filter((referral) =>
          isPaymentRecord(referral)
        )
        .map((referral) => {
          const paymentAmount =
            getPaymentAmount(referral);

          const paymentStatus =
            getPaymentStatus(referral);

          return {
            ...referral,

            paymentId:
              referral.paymentId ||
              `REF-PAY-${referral.id}`,

            paymentStatus,

            paymentAmount,

            paymentDate:
              getPaymentDate(referral),
          };
        });

      setPayments(referralPayments);
    } catch (error) {
      console.error(
        "Failed to load referral payments:",
        error
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

  /* -------------------------------------------------
     Filter payments
  ------------------------------------------------- */
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
        payment.status,
        payment.rewardStatus,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(
        searchText
      );
    });
  }, [
    payments,
    search,
    statusFilter,
  ]);

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
              View referral rewards, payment status
              and payment proofs.
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

            <option value="failed">
              Failed
            </option>
          </select>
        </div>

        {filteredPayments.length === 0 ? (
          <EmptyState
            title="No referral payments found"
            message={
              search ||
              statusFilter !== "all"
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
                  const paymentId =
                    payment.paymentId ||
                    payment.id;

                  const amount =
                    getPaymentAmount(payment);

                  const paymentStatus =
                    getPaymentStatus(payment);

                  return (
                    <tr key={payment.id}>
                      <td>
                        <span className="table-id">
                          {paymentId}
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
                              payment.name ||
                              "Unknown Provider"}
                          </strong>
                        </div>

                        <small>
                          {payment.providerPhone ||
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
                        {formatCurrency(amount)}
                      </td>

                      <td>
                        {payment.paymentMethod ||
                          "UPI"}
                      </td>

                      <td>
                        <StatusBadge
                          status={paymentStatus}
                        />
                      </td>

                      <td>
                        {formatDate(
                          payment.paymentDate
                        )}
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