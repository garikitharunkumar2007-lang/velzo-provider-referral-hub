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

import {
  db,
  storage,
} from "../../firebase/firebaseConfig";

import "./AdminReferralDetails.css";

/* -------------------------------------------------
   Date formatter
------------------------------------------------- */
function formatDate(value) {
  if (!value) {
    return "—";
  }

  try {
    let date;

    if (typeof value?.toDate === "function") {
      date = value.toDate();
    } else if (value?.seconds) {
      date = new Date(value.seconds * 1000);
    } else {
      date = new Date(value);
    }

    if (!date || Number.isNaN(date.getTime())) {
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

/* -------------------------------------------------
   Currency formatter
------------------------------------------------- */
function formatCurrency(value) {
  const amount = Number(value ?? 0);

  return `₹${
    Number.isFinite(amount)
      ? amount.toLocaleString("en-IN")
      : "0"
  }`;
}

/* -------------------------------------------------
   Status badge
------------------------------------------------- */
function StatusBadge({ value }) {
  const status = String(value || "pending")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");

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
   Detail row
------------------------------------------------- */
function DetailRow({ label, value }) {
  return (
    <div className="detail-row">
      <span>{label}</span>
      <strong>{value || "—"}</strong>
    </div>
  );
}

/* -------------------------------------------------
   Get current reward amount
------------------------------------------------- */
function getReferralReward(referral) {
  const values = [
    referral.paymentAmount,
    referral.rewardAmount,
    referral.rewardEarned,
    referral.referralReward,
    referral.earnings,
    referral.reward,
    referral.amount,
  ];

  for (const value of values) {
    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      const amount = Number(
        String(value)
          .replace(/₹/g, "")
          .replace(/,/g, "")
      );

      if (Number.isFinite(amount)) {
        return amount;
      }
    }
  }

  return 0;
}

/* -------------------------------------------------
   Admin Referral Details
------------------------------------------------- */
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

  /* -------------------------------------------------
     Load referral
  ------------------------------------------------- */
  async function loadReferral() {
    if (!referralId) {
      setError("Referral ID is missing.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const referralReference = doc(
        db,
        "referrals",
        referralId
      );

      const snapshot = await getDoc(
        referralReference
      );

      if (!snapshot.exists()) {
        setError("Referral not found.");
        setReferral(null);
        return;
      }

      const data = {
        id: snapshot.id,
        ...snapshot.data(),
      };

      setReferral(data);

      const existingAmount =
        data.paymentAmount ??
        data.rewardAmount ??
        data.rewardEarned ??
        data.referralReward ??
        data.reward ??
        "";

      setPaymentAmount(
        existingAmount === 0
          ? ""
          : String(existingAmount)
      );
    } catch (err) {
      console.error(
        "Load referral error:",
        err
      );

      setError(
        err?.message ||
          "Unable to load referral."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReferral();
  }, [referralId]);

  /* -------------------------------------------------
     Payment file validation
  ------------------------------------------------- */
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
      setError(
        "Payment proof image must be below 5 MB."
      );
      event.target.value = "";
      return;
    }

    setError("");
    setPaymentFile(file);
    setPaymentPreview(
      URL.createObjectURL(file)
    );
  }

  /* -------------------------------------------------
     Validate admin action
  ------------------------------------------------- */
  function validateAdminAccessAction() {
    if (!referral) {
      setError(
        "Referral details are unavailable."
      );
      return false;
    }

    const status = String(
      referral.status || ""
    ).toLowerCase();

    const paymentStatus = String(
      referral.paymentStatus || ""
    ).toLowerCase();

    if (
      status === "rejected" ||
      status === "paid" ||
      paymentStatus === "completed"
    ) {
      setError(
        "This referral has already been completed."
      );
      return false;
    }

    return true;
  }

  /* -------------------------------------------------
     Open reject box
  ------------------------------------------------- */
  function openRejectBox() {
    if (!validateAdminAccessAction()) {
      return;
    }

    setError("");
    setSuccess("");
    setShowPaymentBox(false);
    setShowRejectBox(true);
  }

  /* -------------------------------------------------
     Open payment box
  ------------------------------------------------- */
  function openPaymentBox() {
    if (!validateAdminAccessAction()) {
      return;
    }

    setError("");
    setSuccess("");
    setShowRejectBox(false);
    setShowPaymentBox(true);
  }

  /* -------------------------------------------------
     Reject referral
  ------------------------------------------------- */
  async function rejectReferral() {
    const reason = rejectReason.trim();

    if (!reason) {
      setError(
        "Please enter the rejection reason."
      );
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

          // Rejected referrals must not show earnings
          reward: 0,
          rewardAmount: 0,
          rewardEarned: 0,
          referralReward: 0,
          paymentAmount: 0,

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
        reward: 0,
        rewardAmount: 0,
        rewardEarned: 0,
        referralReward: 0,
        paymentAmount: 0,
      }));

      setShowRejectBox(false);
      setRejectReason("");

      setSuccess(
        "Referral rejected successfully."
      );
    } catch (err) {
      console.error(
        "Reject referral error:",
        err
      );

      setError(
        err?.message ||
          "Unable to reject referral."
      );
    } finally {
      setActionLoading(false);
    }
  }

  /* -------------------------------------------------
     Accept referral
  ------------------------------------------------- */
  async function acceptReferral() {
    if (!validateAdminAccessAction()) {
      return;
    }

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
      console.error(
        "Accept referral error:",
        err
      );

      setError(
        err?.message ||
          "Unable to accept referral."
      );
    } finally {
      setActionLoading(false);
    }
  }

  /* -------------------------------------------------
     Complete payment
  ------------------------------------------------- */
  async function completePayment() {
    if (!referral) {
      return;
    }

    const amount = Number(paymentAmount);

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      setError(
        "Please enter a valid payment amount."
      );
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
        `Confirm payment of ₹${amount} to the referrer?`
      )
    ) {
      return;
    }

    try {
      setActionLoading(true);
      setError("");
      setSuccess("");

      const fileExtension =
        paymentFile.name
          .split(".")
          .pop()
          ?.toLowerCase() || "jpg";

      const filePath =
        `referral-payments/${referralId}/` +
        `payment-proof-${Date.now()}.${fileExtension}`;

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

      const paymentProofUrl =
        await getDownloadURL(
          paymentStorageReference
        );

      /*
       * IMPORTANT:
       * Save the same amount in reward fields and
       * paymentAmount. This fixes ₹0 in Referral History.
       */
      const paymentUpdate = {
        status: "paid",

        rewardStatus: "paid",

        paymentStatus: "completed",

        reward: amount,
        rewardAmount: amount,
        rewardEarned: amount,
        referralReward: amount,

        paymentAmount: amount,

        paymentMethod: "UPI",

        paymentProofUrl,

        paymentProofPath: filePath,

        paidAt: serverTimestamp(),

        updatedAt: serverTimestamp(),
      };

      await updateDoc(
        doc(db, "referrals", referralId),
        paymentUpdate
      );

      setReferral((previous) => ({
        ...previous,

        status: "paid",

        rewardStatus: "paid",

        paymentStatus: "completed",

        reward: amount,
        rewardAmount: amount,
        rewardEarned: amount,
        referralReward: amount,

        paymentAmount: amount,

        paymentMethod: "UPI",

        paymentProofUrl,

        paymentProofPath: filePath,
      }));

      setShowPaymentBox(false);
      setPaymentFile(null);
      setPaymentPreview("");
      setPaymentAmount(String(amount));

      setSuccess(
        "Payment completed and proof uploaded successfully."
      );
    } catch (err) {
      console.error(
        "Complete payment error:",
        err
      );

      setError(
        err?.message ||
          "Unable to complete payment. Please try again."
      );
    } finally {
      setActionLoading(false);
    }
  }

  /* -------------------------------------------------
     Loading state
  ------------------------------------------------- */
  if (loading) {
    return (
      <div className="admin-details-page">
        <div className="admin-details-loading">
          Loading referral details...
        </div>
      </div>
    );
  }

  /* -------------------------------------------------
     Error state
  ------------------------------------------------- */
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
    String(referral.status).toLowerCase() ===
    "rejected";

  const isPaid =
    String(referral.status).toLowerCase() ===
      "paid" ||
    String(referral.paymentStatus).toLowerCase() ===
      "completed";

  const isAccepted =
    String(referral.status).toLowerCase() ===
    "accepted";

  const reward = getReferralReward(referral);

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

        <StatusBadge
          value={
            referral.status ||
            referral.paymentStatus
          }
        />
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
            label="UPI / Payment Number"
            value={referral.upiNumber}
          />

          <DetailRow
            label="Referral Submitted"
            value={formatDate(
              referral.createdAt
            )}
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
            value={
              referral.unionId ||
              "Not provided"
            }
          />

          <DetailRow
            label="Address"
            value={referral.address}
          />
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

          <DetailRow
            label="Reward Amount"
            value={formatCurrency(reward)}
          />

          <DetailRow
            label="Accepted At"
            value={formatDate(
              referral.acceptedAt
            )}
          />

          <DetailRow
            label="Paid At"
            value={formatDate(
              referral.paidAt
            )}
          />

          {isRejected &&
            referral.rejectionReason && (
              <div className="rejection-message">
                <strong>
                  Rejection Reason:
                </strong>

                <p>
                  {referral.rejectionReason}
                </p>
              </div>
            )}

          {isPaid &&
            referral.paymentProofUrl && (
              <div className="payment-proof-link">
                <a
                  href={referral.paymentProofUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  View Payment Proof
                </a>
              </div>
            )}
        </section>
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

          {isAccepted && !showPaymentBox && (
            <button
              className="approve-action"
              disabled={actionLoading}
              onClick={openPaymentBox}
            >
              Complete Payment
            </button>
          )}

          {showRejectBox && (
            <div className="action-box rejection-box">
              <h3>Reject Referral</h3>

              <p>
                Enter the reason why this referral
                is being rejected.
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
              <h3>
                Complete Referral Payment
              </h3>

              <p>
                Upload the payment completed
                screenshot after sending the reward.
              </p>

              <div className="form-group">
                <label htmlFor="payment-amount">
                  Payment Amount ₹
                </label>

                <input
                  id="payment-amount"
                  type="number"
                  min="1"
                  step="1"
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
                  onChange={
                    handlePaymentFileChange
                  }
                  disabled={actionLoading}
                />
              </div>

              {paymentPreview && (
                <div className="payment-proof-preview">
                  <h3>Selected Proof</h3>

                  <img
                    src={paymentPreview}
                    alt="Selected payment proof"
                  />
                </div>
              )}

              <div className="action-buttons">
                <button
                  className="approve-action"
                  disabled={actionLoading}
                  onClick={completePayment}
                >
                  {actionLoading
                    ? "Uploading..."
                    : "Confirm Payment"}
                </button>

                <button
                  className="secondary-action"
                  disabled={actionLoading}
                  onClick={() =>
                    setShowPaymentBox(false)
                  }
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {isPaid && (
        <section className="payment-success-message">
          <strong>
            ✓ Payment Completed
          </strong>

          <p>
            Reward paid:{" "}
            <strong>
              {formatCurrency(reward)}
            </strong>
          </p>

          {referral.paymentProofUrl && (
            <a
              href={referral.paymentProofUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open Full Payment Proof
            </a>
          )}
        </section>
      )}
    </div>
  );
}