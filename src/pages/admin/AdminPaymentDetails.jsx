import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import LoadingState from "../../components/LoadingState";
import StatusBadge from "../../components/StatusBadge";

import {
  getDocument,
  updateDocument,
} from "../../firebase/firestoreConverters";

function formatCurrency(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

function formatDate(value) {
  if (!value) return "—";

  try {
    const date = value?.toDate
      ? value.toDate()
      : new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "—";
    }

    return date.toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

function DetailItem({ label, value }) {
  return (
    <div className="detail-item">
      <span className="detail-label">
        {label}
      </span>

      <strong>
        {value || "Not provided"}
      </strong>
    </div>
  );
}

export default function AdminPaymentDetails() {
  const { paymentId } = useParams();
  const navigate = useNavigate();

  const [payment, setPayment] = useState(null);
  const [selectedStatus, setSelectedStatus] =
    useState("not_paid");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadPayment() {
      try {
        setLoading(true);
        setError("");

        const decodedPaymentId = decodeURIComponent(
          paymentId || ""
        );

        /*
         * Payment records are referral documents.
         * The URL contains the referral document ID.
         */
        const record = await getDocument(
          "referrals",
          decodedPaymentId
        );

        if (!record) {
          if (mounted) {
            setError("Referral payment not found.");
          }

          return;
        }

        if (mounted) {
          setPayment(record);

          setSelectedStatus(
            record.paymentStatus ||
              "not_paid"
          );
        }
      } catch (err) {
        console.error(
          "Failed to load referral payment:",
          err
        );

        if (mounted) {
          setError(
            "Unable to load referral payment details."
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadPayment();

    return () => {
      mounted = false;
    };
  }, [paymentId]);

  async function handleStatusUpdate(event) {
    event.preventDefault();

    if (!payment?.id) {
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const updateData = {
        paymentStatus: selectedStatus,
        updatedAt: new Date(),
      };

      if (selectedStatus === "completed") {
        updateData.status = "paid";
        updateData.rewardStatus = "paid";
        updateData.paidAt = new Date();
      }

      await updateDocument(
        "referrals",
        payment.id,
        updateData
      );

      setPayment((current) => ({
        ...current,
        ...updateData,
      }));

      setSuccess(
        "Referral payment status updated successfully."
      );
    } catch (err) {
      console.error(
        "Failed to update referral payment:",
        err
      );

      setError(
        "Unable to update referral payment status."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <LoadingState message="Loading referral payment details..." />
    );
  }

  if (error && !payment) {
    return (
      <section className="page-container">
        <div className="page-content">
          <div className="alert alert-danger">
            {error}
          </div>

          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              navigate("/admin/payments")
            }
          >
            Back to Referral Payments
          </button>
        </div>
      </section>
    );
  }

  if (!payment) {
    return null;
  }

  const paymentAmount =
    payment.paymentAmount ??
    payment.reward ??
    0;

  const paymentStatus =
    payment.paymentStatus ||
    "not_paid";

  return (
    <section className="page-container">
      <div className="page-content">
        <div className="page-header">
          <div>
            <Link
              to="/admin/payments"
              className="back-link"
            >
              ← Back to Referral Payments
            </Link>

            <h1>Referral Payment Details</h1>

            <p>
              Referral ID:{" "}
              <strong>{payment.id}</strong>
            </p>
          </div>

          <StatusBadge
            status={paymentStatus}
          />
        </div>

        {error && (
          <div className="alert alert-danger">
            {error}
          </div>
        )}

        {success && (
          <div className="alert alert-success">
            {success}
          </div>
        )}

        <div className="details-card">
          <div className="details-card-header">
            <h2>Referral Information</h2>
          </div>

          <div className="details-grid">
            <DetailItem
              label="Referral ID"
              value={payment.id}
            />

            <DetailItem
              label="Referral Status"
              value={payment.status}
            />

            <DetailItem
              label="Referral Created"
              value={formatDate(
                payment.createdAt
              )}
            />

            <DetailItem
              label="Accepted At"
              value={formatDate(
                payment.acceptedAt
              )}
            />

            <DetailItem
              label="Rejected At"
              value={formatDate(
                payment.rejectedAt
              )}
            />

            <DetailItem
              label="Paid At"
              value={formatDate(
                payment.paidAt
              )}
            />
          </div>
        </div>

        <div className="details-card">
          <div className="details-card-header">
            <h2>Referrer Details</h2>
          </div>

          <div className="details-grid">
            <DetailItem
              label="Referrer Name"
              value={payment.referrerName}
            />

            <DetailItem
              label="Referrer ID"
              value={payment.referrerId}
            />

            <DetailItem
              label="Referrer Phone"
              value={
                payment.referrerPhone ||
                payment.referrerMobile
              }
            />

            <DetailItem
              label="Referrer UPI ID"
              value={
                payment.referrerUpiId ||
                payment.upiId
              }
            />
          </div>
        </div>

        <div className="details-card">
          <div className="details-card-header">
            <h2>Provider Details</h2>
          </div>

          <div className="details-grid">
            <DetailItem
              label="Provider Name"
              value={payment.providerName}
            />

            <DetailItem
              label="Provider ID"
              value={payment.providerId}
            />

            <DetailItem
              label="Provider Phone"
              value={
                payment.providerPhone ||
                payment.phone
              }
            />

            <DetailItem
              label="Service / Role"
              value={
                payment.serviceType ||
                payment.role
              }
            />

            <DetailItem
              label="Union / Labour ID"
              value={payment.unionId}
            />

            <DetailItem
              label="Address"
              value={payment.address}
            />
          </div>
        </div>

        <div className="details-card">
          <div className="details-card-header">
            <h2>Payment Information</h2>
          </div>

          <div className="details-grid">
            <DetailItem
              label="Reward Amount"
              value={formatCurrency(
                payment.reward
              )}
            />

            <DetailItem
              label="Payment Amount"
              value={formatCurrency(
                paymentAmount
              )}
            />

            <DetailItem
              label="Payment Method"
              value={
                payment.paymentMethod ||
                "UPI"
              }
            />

            <DetailItem
              label="Payment Status"
              value={paymentStatus}
            />

            <DetailItem
              label="Payment ID"
              value={
                payment.paymentId ||
                `REF-PAY-${payment.id}`
              }
            />
          </div>
        </div>

        {payment.rejectionReason && (
          <div className="details-card">
            <div className="details-card-header">
              <h2>Rejection Reason</h2>
            </div>

            <p>
              {payment.rejectionReason}
            </p>
          </div>
        )}

        {payment.paymentProofUrl && (
          <div className="details-card">
            <div className="details-card-header">
              <h2>Payment Completed Proof</h2>
            </div>

            <div className="payment-proof-container">
              <img
                src={payment.paymentProofUrl}
                alt="Referral payment completed proof"
                className="payment-proof-image"
              />

              <a
                href={payment.paymentProofUrl}
                target="_blank"
                rel="noreferrer"
                className="secondary-button"
              >
                Open Full Payment Proof
              </a>
            </div>
          </div>
        )}

        <form
          className="details-card"
          onSubmit={handleStatusUpdate}
        >
          <div className="details-card-header">
            <h2>Update Referral Payment Status</h2>
          </div>

          <div className="form-group">
            <label htmlFor="referral-payment-status">
              Payment Status
            </label>

            <select
              id="referral-payment-status"
              className="form-input"
              value={selectedStatus}
              onChange={(event) =>
                setSelectedStatus(
                  event.target.value
                )
              }
              disabled={saving}
            >
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

          <button
            type="submit"
            className="primary-button"
            disabled={saving}
          >
            {saving
              ? "Saving..."
              : "Save Payment Status"}
          </button>
        </form>
      </div>
    </section>
  );
}