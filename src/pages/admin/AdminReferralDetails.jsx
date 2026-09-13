import React, { useEffect, useState } from "react";

import {
  useNavigate,
  useParams,
} from "react-router-dom";

import {
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import {
  getDownloadURL,
  ref as storageRef,
  uploadBytes,
} from "firebase/storage";

import { db, storage } from "../../firebase/firebaseConfig";

import "./AdminReferralDetails.css";

function formatDate(value) {
  if (!value) return "—";

  try {
    const date = value?.toDate
      ? value.toDate()
      : new Date(value);

    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

function formatCurrency(value) {
  const amount = Number(value || 0);

  return amount.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });
}

function StatusBadge({ value }) {
  const status = String(value || "pending")
    .toLowerCase()
    .replace(/\s+/g, "_");

  return (
    <span className={`status-badge ${status}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="detail-row">
      <span>{label}</span>
      <strong>{value || "—"}</strong>
    </div>
  );
}

export default function AdminReferralDetails() {
  const { referralId } = useParams();
  const navigate = useNavigate();

  const [referral, setReferral] = useState(null);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [rejectReason, setRejectReason] = useState("");
  const [showRejectBox, setShowRejectBox] = useState(false);

  const [showPaymentBox, setShowPaymentBox] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentFile, setPaymentFile] = useState(null);
  const [paymentPreview, setPaymentPreview] = useState("");

  async function loadReferral() {
    try {
      setLoading(true);
      setError("");

      const referralReference = doc(
        db,
        "referrals",
        referralId
      );

      const snapshot = await getDoc(referralReference);

      if (!snapshot.exists()) {
        setError("Referral not found.");
        return;
      }

      const data = {
        id: snapshot.id,
        ...snapshot.data(),
      };

      setReferral(data);

      setPaymentAmount(
        data.paymentAmount ||
          data.reward ||
          0
      );
    } catch (err) {
      console.error("Load referral error:", err);

      setError(
        err.message || "Unable to load referral."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (referralId) {
      loadReferral();
    }
  }, [referralId]);

  function handlePaymentFileChange(event) {
    const file = event.target.files?.[0];

    if (!file) {
      setPaymentFile(null);
      setPaymentPreview("");
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Please upload only an image file.");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Payment proof image must be below 5 MB.");
      event.target.value = "";
      return;
    }

    setError("");
    setPaymentFile(file);
    setPaymentPreview(URL.createObjectURL(file));
  }

  function validateAdminAccessAction() {
    if (!referral) {
      setError("Referral details are unavailable.");
      return false;
    }

    if (
      referral.status === "rejected" ||
      referral.status === "paid"
    ) {
      setError("This referral has already been completed.");
      return false;
    }

    return true;
  }

  function openRejectBox() {
    if (!validateAdminAccessAction()) return;

    setSuccess("");
    setError("");
    setShowPaymentBox(false);
    setShowRejectBox(true);
  }

  function openPaymentBox() {
    if (!validateAdminAccessAction()) return;

    setSuccess("");
    setError("");
    setShowRejectBox(false);
    setShowPaymentBox(true);
  }

  async function rejectReferral() {
    const reason = rejectReason.trim();

    if (!reason) {
      setError("Please enter the rejection reason.");
      return;
    }

    if (
      !window.confirm(
        "Are you sure you want to reject this referral?"
      )
    ) {
      return;
    }

    try {
      setActionLoading(true);
      setError("");
      setSuccess("");

      await updateDoc(
        doc(db, "referrals", referralId),
        {
          status: "rejected",
          rejectionReason: reason,
          rewardStatus: "rejected",
          paymentStatus: "not_paid",
          rejectedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      );

      setReferral((previous) => ({
        ...previous,
        status: "rejected",
        rejectionReason: reason,
        rewardStatus: "rejected",
        paymentStatus: "not_paid",
      }));

      setShowRejectBox(false);
      setRejectReason("");

      setSuccess("Referral rejected successfully.");
    } catch (err) {
      console.error("Reject referral error:", err);

      setError(
        err.message || "Unable to reject referral."
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function acceptReferral() {
    if (!validateAdminAccessAction()) return;

    if (
      !window.confirm(
        "Accept this referral and continue to payment?"
      )
    ) {
      return;
    }

    try {
      setActionLoading(true);
      setError("");
      setSuccess("");

      await updateDoc(
        doc(db, "referrals", referralId),
        {
          status: "accepted",
          rewardStatus: "approved",
          paymentStatus: "pending",
          acceptedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      );

      setReferral((previous) => ({
        ...previous,
        status: "accepted",
        rewardStatus: "approved",
        paymentStatus: "pending",
      }));

      setShowPaymentBox(true);

      setSuccess(
        "Referral accepted. Complete the payment below."
      );
    } catch (err) {
      console.error("Accept referral error:", err);

      setError(
        err.message || "Unable to accept referral."
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function completePayment() {
    if (!referral) return;

    const amount = Number(paymentAmount);

    if (!amount || amount <= 0) {
      setError("Please enter a valid payment amount.");
      return;
    }

    if (!paymentFile) {
      setError(
        "Please upload the payment completed screenshot/photo."
      );
      return;
    }

    if (
      !window.confirm(
        "Confirm that the referral payment has been completed?"
      )
    ) {
      return;
    }

    try {
      setActionLoading(true);
      setError("");
      setSuccess("");

      const fileExtension =
        paymentFile.name.split(".").pop() || "jpg";

      const filePath = `referral-payments/${referralId}/payment-proof-${Date.now()}.${fileExtension}`;

      const paymentStorageReference = storageRef(
        storage,
        filePath
      );

      await uploadBytes(
        paymentStorageReference,
        paymentFile,
        {
          contentType: paymentFile.type,
        }
      );

      const paymentProofUrl = await getDownloadURL(
        paymentStorageReference
      );

      await updateDoc(
        doc(db, "referrals", referralId),
        {
          status: "paid",
          rewardStatus: "paid",
          paymentStatus: "completed",
          paymentAmount: amount,
          paymentMethod: "UPI",
          paymentProofUrl,
          paymentProofPath: filePath,
          paidAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      );

      setReferral((previous) => ({
        ...previous,
        status: "paid",
        rewardStatus: "paid",
        paymentStatus: "completed",
        paymentAmount: amount,
        paymentMethod: "UPI",
        paymentProofUrl,
        paymentProofPath: filePath,
      }));

      setShowPaymentBox(false);
      setPaymentFile(null);
      setPaymentPreview("");

      setSuccess(
        "Payment completed and proof uploaded successfully."
      );
    } catch (err) {
      console.error("Complete payment error:", err);

      setError(
        err.message ||
          "Unable to complete payment. Please try again."
      );
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="admin-details-page">
        <div className="admin-details-loading">
          Loading referral details...
        </div>
      </div>
    );
  }

  if (error && !referral) {
    return (
      <div className="admin-details-page">
        <div className="admin-details-error">
          {error}
        </div>

        <button
          className="back-button"
          onClick={() =>
            navigate("/admin/referrals")
          }
        >
          Back to Referrals
        </button>
      </div>
    );
  }

  if (!referral) {
    return null;
  }

  const isRejected =
    referral.status === "rejected";

  const isPaid =
    referral.status === "paid" ||
    referral.paymentStatus === "completed";

  const isAccepted =
    referral.status === "accepted";

  return (
    <div className="admin-details-page">
      <div className="admin-details-header">
        <div>
          <button
            className="back-button"
            onClick={() =>
              navigate("/admin/referrals")
            }
          >
            ← Back to Referrals
          </button>

          <h1>Referral Details</h1>

          <p>
            Referral ID:{" "}
            <strong>{referral.id}</strong>
          </p>
        </div>

        <StatusBadge value={referral.status} />
      </div>

      {error && (
        <div className="admin-alert error">
          {error}
        </div>
      )}

      {success && (
        <div className="admin-alert success">
          {success}
        </div>
      )}

      <div className="details-grid">
        <section className="detail-card">
          <div className="card-label">
            REFERRER DETAILS
          </div>

          <h2>
            {referral.referrerName || "—"}
          </h2>

          <DetailRow
            label="Referrer ID"
            value={referral.referrerId}
          />

          <DetailRow
            label="Referrer Phone"
            value={
              referral.referrerPhone ||
              referral.referrerMobile
            }
          />

          <DetailRow
            label="Referral Submitted"
            value={formatDate(referral.createdAt)}
          />
        </section>

        <section className="detail-card">
          <div className="card-label">
            PROVIDER DETAILS
          </div>

          <h2>
            {referral.providerName || "—"}
          </h2>

          <DetailRow
            label="Provider ID"
            value={referral.providerId}
          />

          <DetailRow
            label="Phone Number"
            value={
              referral.providerPhone ||
              referral.phone
            }
          />

          <DetailRow
            label="Service / Role"
            value={
              referral.serviceType ||
              referral.role
            }
          />

          <DetailRow
            label="Union / Labour ID"
            value={referral.unionId}
          />

          <div className="detail-row vertical">
            <span>Address</span>
            <strong>
              {referral.address || "—"}
            </strong>
          </div>
        </section>

        <section className="detail-card">
          <div className="card-label">
            REFERRAL STATUS
          </div>

          <DetailRow
            label="Current Status"
            value={
              <StatusBadge
                value={referral.status}
              />
            }
          />

          <DetailRow
            label="Reward Status"
            value={
              <StatusBadge
                value={referral.rewardStatus}
              />
            }
          />

          <DetailRow
            label="Payment Status"
            value={
              <StatusBadge
                value={referral.paymentStatus}
              />
            }
          />
        </section>

        <section className="detail-card reward-card">
          <div className="card-label">
            REWARD DETAILS
          </div>

          <div className="reward-amount">
            {formatCurrency(
              referral.paymentAmount ||
                referral.reward ||
                0
            )}
          </div>

          <DetailRow
            label="Reward Amount"
            value={formatCurrency(
              referral.reward || 0
            )}
          />

          <DetailRow
            label="Payment Amount"
            value={formatCurrency(
              referral.paymentAmount ||
                referral.reward ||
                0
            )}
          />

          <DetailRow
            label="Payment Method"
            value={
              referral.paymentMethod ||
              "Not paid"
            }
          />
        </section>

        {isRejected && (
          <section className="detail-card rejection-card">
            <div className="card-label">
              REJECTION DETAILS
            </div>

            <h3>Reason for Rejection</h3>

            <p>
              {referral.rejectionReason ||
                "No rejection reason provided."}
            </p>

            <DetailRow
              label="Rejected At"
              value={formatDate(
                referral.rejectedAt
              )}
            />
          </section>
        )}

        {isPaid && (
          <section className="detail-card payment-proof-card">
            <div className="card-label">
              PAYMENT COMPLETED
            </div>

            <DetailRow
              label="Paid At"
              value={formatDate(
                referral.paidAt
              )}
            />

            <DetailRow
              label="Payment Amount"
              value={formatCurrency(
                referral.paymentAmount ||
                  referral.reward ||
                  0
              )}
            />

            {referral.paymentProofUrl && (
              <div className="payment-proof-preview">
                <h3>Payment Proof</h3>

                <img
                  src={referral.paymentProofUrl}
                  alt="Payment proof"
                />

                <a
                  href={referral.paymentProofUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary"
                >
                  Open Full Proof
                </a>
              </div>
            )}
          </section>
        )}
      </div>

      {!isRejected && !isPaid && (
        <section className="admin-actions">
          <h2>Admin Action</h2>

          {!isAccepted && (
            <div className="action-buttons">
              <button
                className="approve-action"
                disabled={actionLoading}
                onClick={acceptReferral}
              >
                {actionLoading
                  ? "Processing..."
                  : "Accept Referral"}
              </button>

              <button
                className="danger-action"
                disabled={actionLoading}
                onClick={openRejectBox}
              >
                Reject Referral
              </button>
            </div>
          )}

          {showRejectBox && (
            <div className="action-box rejection-box">
              <h3>Reject Referral</h3>

              <p>
                Enter the reason why this referral is
                being rejected.
              </p>

              <textarea
                value={rejectReason}
                onChange={(event) =>
                  setRejectReason(
                    event.target.value
                  )
                }
                placeholder="Enter rejection reason..."
                rows={5}
                disabled={actionLoading}
              />

              <div className="action-buttons">
                <button
                  className="danger-action"
                  disabled={actionLoading}
                  onClick={rejectReferral}
                >
                  {actionLoading
                    ? "Rejecting..."
                    : "Confirm Rejection"}
                </button>

                <button
                  className="secondary-action"
                  disabled={actionLoading}
                  onClick={() =>
                    setShowRejectBox(false)
                  }
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {(isAccepted || showPaymentBox) && (
            <div className="action-box payment-box">
              <h3>Complete Referral Payment</h3>

              <p>
                Upload the payment completed screenshot
                after sending the reward to the referrer.
              </p>

              <div className="form-group">
                <label htmlFor="payment-amount">
                  Payment Amount ₹
                </label>

                <input
                  id="payment-amount"
                  type="number"
                  min="1"
                  value={paymentAmount}
                  onChange={(event) =>
                    setPaymentAmount(
                      event.target.value
                    )
                  }
                  disabled={actionLoading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="payment-proof">
                  Payment Completed Photo
                </label>

                <input
                  id="payment-proof"
                  type="file"
                  accept="image/*"
                  onChange={handlePaymentFileChange}
                  disabled={actionLoading}
                />
              </div>

              {paymentPreview && (
                <div className="payment-preview">
                  <p>Selected Payment Proof:</p>

                  <img
                    src={paymentPreview}
                    alt="Selected payment proof"
                  />
                </div>
              )}

              <button
                className="approve-action"
                disabled={actionLoading}
                onClick={completePayment}
              >
                {actionLoading
                  ? "Uploading Payment Proof..."
                  : "Payment Completed"}
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}