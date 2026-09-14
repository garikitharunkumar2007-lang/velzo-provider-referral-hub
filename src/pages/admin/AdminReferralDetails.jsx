import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";

import { db, storage } from "../../firebase/firebaseConfig";
import "./AdminReferralDetails.css";

const REWARD_WITH_UNION_ID = 4;
const REWARD_WITHOUT_UNION_ID = 3;

function getValue(...values) {
  for (const value of values) {
    if (
      value !== undefined &&
      value !== null &&
      String(value).trim() !== ""
    ) {
      return value;
    }
  }

  return "—";
}

function getText(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function getTimestampDate(value) {
  if (!value) return null;

  if (typeof value?.toDate === "function") {
    return value.toDate();
  }

  if (value instanceof Date) {
    return value;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function formatDate(value) {
  const date = getTimestampDate(value);

  if (!date) return "—";

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function normalizeStatus(value) {
  return getText(value)
    .toLowerCase()
    .replace(/[_-]/g, " ")
    .trim();
}

function getStatusClass(value) {
  const status = normalizeStatus(value);

  if (
    [
      "approved",
      "accepted",
      "verified",
      "successful",
      "completed",
      "paid",
      "success",
    ].includes(status)
  ) {
    return "status-success";
  }

  if (
    [
      "rejected",
      "declined",
      "failed",
      "cancelled",
      "canceled",
    ].includes(status)
  ) {
    return "status-danger";
  }

  return "status-pending";
}

function StatusBadge({ value }) {
  const displayValue = getValue(value);

  return (
    <span className={`status-badge ${getStatusClass(displayValue)}`}>
      {String(displayValue)}
    </span>
  );
}

function DetailRow({ label, value, highlight = false }) {
  return (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      <span className={`detail-value ${highlight ? "highlight-value" : ""}`}>
        {getValue(value)}
      </span>
    </div>
  );
}

export default function AdminReferralDetails() {
  const { referralId } = useParams();
  const navigate = useNavigate();

  const [referral, setReferral] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectBox, setShowRejectBox] = useState(false);

  const [paymentProof, setPaymentProof] = useState(null);
  const [paymentProofPreview, setPaymentProofPreview] = useState("");
  const [showPaymentBox, setShowPaymentBox] = useState(false);

  const [message, setMessage] = useState({
    type: "",
    text: "",
  });

  useEffect(() => {
    let mounted = true;

    async function loadReferral() {
      if (!referralId) {
        setMessage({
          type: "error",
          text: "Referral ID is missing.",
        });
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        const referralRef = doc(db, "referrals", referralId);
        const referralSnap = await getDoc(referralRef);

        if (!referralSnap.exists()) {
          if (mounted) {
            setMessage({
              type: "error",
              text: "Referral not found.",
            });
          }

          return;
        }

        if (mounted) {
          setReferral({
            id: referralSnap.id,
            ...referralSnap.data(),
          });
        }
      } catch (error) {
        console.error("Error loading referral:", error);

        if (mounted) {
          setMessage({
            type: "error",
            text: "Unable to load referral details.",
          });
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadReferral();

    return () => {
      mounted = false;
    };
  }, [referralId]);

  useEffect(() => {
    if (!paymentProof) {
      setPaymentProofPreview("");
      return;
    }

    const previewUrl = URL.createObjectURL(paymentProof);
    setPaymentProofPreview(previewUrl);

    return () => URL.revokeObjectURL(previewUrl);
  }, [paymentProof]);

  const providerName = useMemo(
    () =>
      getValue(
        referral?.providerName,
        referral?.provider?.name,
        referral?.name,
        referral?.referredProviderName
      ),
    [referral]
  );

  const providerPhone = useMemo(
    () =>
      getValue(
        referral?.providerPhone,
        referral?.phoneNumber,
        referral?.phone,
        referral?.provider?.phone
      ),
    [referral]
  );

  const providerAddress = useMemo(
    () =>
      getValue(
        referral?.address,
        referral?.providerAddress,
        referral?.location,
        referral?.provider?.address
      ),
    [referral]
  );

  const providerRole = useMemo(
    () =>
      getValue(
        referral?.role,
        referral?.service,
        referral?.serviceType,
        referral?.providerRole,
        referral?.provider?.role
      ),
    [referral]
  );

  const unionLabourId = useMemo(
    () =>
      getValue(
        referral?.unionLabourId,
        referral?.unionId,
        referral?.labourId,
        referral?.unionLabourID,
        referral?.unionNumber,
        referral?.labourNumber
      ),
    [referral]
  );

  const hasUnionLabourId = useMemo(() => {
    const id = getText(unionLabourId);

    return id !== "" && id !== "—" && id.toLowerCase() !== "not provided";
  }, [unionLabourId]);

  const automaticReward = hasUnionLabourId
    ? REWARD_WITH_UNION_ID
    : REWARD_WITHOUT_UNION_ID;

  const currentStatus = getValue(
    referral?.status,
    referral?.currentStatus,
    referral?.paymentStatus
  );

  const adminStatus = getValue(referral?.adminStatus, "pending");

  const verificationStatus = getValue(
    referral?.verificationStatus,
    "pending"
  );

  const onboardingStatus = getValue(
    referral?.onboardingStatus,
    "pending"
  );

  const rewardStatus = getValue(
    referral?.rewardStatus,
    "not_earned"
  );

  const paymentStatus = getValue(
    referral?.paymentStatus,
    "not_paid"
  );

  const isRejected =
    normalizeStatus(currentStatus) === "rejected" ||
    normalizeStatus(adminStatus) === "rejected";

  const isPaid =
    normalizeStatus(paymentStatus) === "completed" ||
    normalizeStatus(paymentStatus) === "paid" ||
    normalizeStatus(currentStatus) === "paid" ||
    normalizeStatus(currentStatus) === "successful";

  const isApproved =
    normalizeStatus(adminStatus) === "approved" ||
    normalizeStatus(currentStatus) === "accepted" ||
    normalizeStatus(currentStatus) === "approved";

  function showMessage(type, text) {
    setMessage({ type, text });
  }

  async function reloadReferral() {
    const referralRef = doc(db, "referrals", referralId);
    const referralSnap = await getDoc(referralRef);

    if (referralSnap.exists()) {
      setReferral({
        id: referralSnap.id,
        ...referralSnap.data(),
      });
    }
  }

  async function handleApproveReferral() {
    if (!referralId || actionLoading) return;

    try {
      setActionLoading(true);
      setMessage({ type: "", text: "" });

      const referralRef = doc(db, "referrals", referralId);

      await updateDoc(referralRef, {
        status: "accepted",
        adminStatus: "approved",
        verificationStatus: "verified",
        rewardStatus: "approved",
        rejectionReason: "",
        rejectionReasons: [],
        acceptedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await reloadReferral();

      showMessage(
        "success",
        "Referral approved successfully. You can now complete the payment."
      );
    } catch (error) {
      console.error("Approve referral error:", error);

      showMessage(
        "error",
        "Unable to approve referral. Please try again."
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRejectReferral() {
    if (!referralId || actionLoading) return;

    const reason = rejectionReason.trim();

    if (!reason) {
      showMessage("error", "Please enter a rejection reason.");
      return;
    }

    try {
      setActionLoading(true);
      setMessage({ type: "", text: "" });

      const referralRef = doc(db, "referrals", referralId);

      await updateDoc(referralRef, {
        status: "rejected",
        adminStatus: "rejected",
        verificationStatus: "rejected",
        rewardStatus: "rejected",
        paymentStatus: "not_paid",
        rejectionReason: reason,
        rejectionReasons: [reason],
        rejectedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await reloadReferral();

      setShowRejectBox(false);
      setRejectionReason("");

      showMessage("success", "Referral rejected successfully.");
    } catch (error) {
      console.error("Reject referral error:", error);

      showMessage(
        "error",
        "Unable to reject referral. Please try again."
      );
    } finally {
      setActionLoading(false);
    }
  }

  function handlePaymentProofChange(event) {
    const file = event.target.files?.[0];

    if (!file) {
      setPaymentProof(null);
      return;
    }

    if (!file.type.startsWith("image/")) {
      showMessage("error", "Please upload an image file as payment proof.");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showMessage("error", "Payment proof must be below 5 MB.");
      event.target.value = "";
      return;
    }

    setPaymentProof(file);
    setMessage({ type: "", text: "" });
  }

  async function handleCompletePayment() {
    if (!referralId || actionLoading) return;

    if (isRejected) {
      showMessage(
        "error",
        "Rejected referrals cannot be marked as paid."
      );
      return;
    }

    if (!isApproved) {
      showMessage(
        "error",
        "Please approve the referral before completing payment."
      );
      return;
    }

    if (!paymentProof) {
      showMessage(
        "error",
        "Please upload the payment completed photo."
      );
      return;
    }

    try {
      setActionLoading(true);
      setMessage({ type: "", text: "" });

      const proofPath = `paymentProofs/${referralId}/${Date.now()}-${paymentProof.name}`;
      const proofStorageRef = storageRef(storage, proofPath);

      await uploadBytes(proofStorageRef, paymentProof);
      const paymentProofUrl = await getDownloadURL(proofStorageRef);

      const referralRef = doc(db, "referrals", referralId);

      await updateDoc(referralRef, {
        status: "paid",
        currentStatus: "paid",
        adminStatus: "approved",
        verificationStatus: "verified",
        onboardingStatus: "completed",
        rewardStatus: "paid",
        paymentStatus: "completed",

        reward: automaticReward,
        rewardAmount: automaticReward,
        rewardEarned: automaticReward,
        referralReward: automaticReward,
        paymentAmount: automaticReward,

        paymentProofUrl,
        paymentProofPath: proofPath,
        paidAt: serverTimestamp(),
        paymentCompletedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const verifiedProviderRef = doc(
        db,
        "verifiedProviders",
        referralId
      );

      await setDoc(
        verifiedProviderRef,
        {
          referralId,

          providerName:
            getText(providerName) === "—" ? "" : providerName,

          unionLabourId:
            getText(unionLabourId) === "—" ? "" : unionLabourId,

          phoneNumber:
            getText(providerPhone) === "—" ? "" : providerPhone,

          address:
            getText(providerAddress) === "—" ? "" : providerAddress,

          role:
            getText(providerRole) === "—" ? "" : providerRole,

          service:
            getText(providerRole) === "—" ? "" : providerRole,

          rewardAmount: automaticReward,
          paymentStatus: "completed",
          verificationStatus: "verified",
          onboardingStatus: "completed",

          referrerId: getValue(
            referral?.referrerId,
            referral?.referrerUid,
            referral?.userId
          ),

          referrerName: getValue(
            referral?.referrerName,
            referral?.referrerDisplayName,
            referral?.submittedByName
          ),

          referrerPhone: getValue(
            referral?.referrerPhone,
            referral?.referrerPhoneNumber
          ),

          paymentProofUrl,
          paymentProofPath: proofPath,

          createdAt: referral?.createdAt || serverTimestamp(),
          verifiedAt: serverTimestamp(),
          paidAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      await reloadReferral();

      setShowPaymentBox(false);
      setPaymentProof(null);
      setPaymentProofPreview("");

      showMessage(
        "success",
        `Payment completed successfully. ₹${automaticReward} saved and provider added to verifiedProviders.`
      );
    } catch (error) {
      console.error("Complete payment error:", error);

      showMessage(
        "error",
        "Payment update failed. Please check Firebase Storage and try again."
      );
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="admin-details-page referral-details-page">
        <div className="details-loading-card">
          <div className="loading-spinner" />
          <p>Loading referral details...</p>
        </div>
      </div>
    );
  }

  if (!referral) {
    return (
      <div className="admin-details-page referral-details-page">
        <div className="details-empty-card">
          <h2>Referral not found</h2>
          <p>The requested referral does not exist.</p>

          <button
            className="secondary-action"
            onClick={() => navigate("/admin/referrals")}
          >
            Back to Referrals
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-details-page referral-details-page">
      <div className="admin-details-header">
        <div>
          <button
            className="back-button"
            onClick={() => navigate("/admin/referrals")}
          >
            ← Back to Referrals
          </button>

          <p className="page-eyebrow">VELZO ADMIN</p>
          <h1>Referral Details</h1>

          <p className="referral-id">
            Referral ID:
            <strong>{referralId}</strong>
          </p>
        </div>

        <StatusBadge value={currentStatus} />
      </div>

      {message.text && (
        <div className={`admin-alert ${message.type}`}>
          {message.text}
        </div>
      )}

      <section className="details-grid">
        <div className="details-card">
          <div className="card-heading">
            <span className="card-icon">👤</span>
            <div>
              <h2>Referrer Details</h2>
              <p>Person who submitted this referral</p>
            </div>
          </div>

          <div className="details-list">
            <DetailRow
              label="Referrer Name"
              value={getValue(
                referral.referrerName,
                referral.submittedByName,
                referral.referrer
              )}
            />

            <DetailRow
              label="Referrer ID"
              value={getValue(
                referral.referrerId,
                referral.referrerUid,
                referral.userId
              )}
            />

            <DetailRow
              label="Referrer Phone"
              value={getValue(
                referral.referrerPhone,
                referral.referrerPhoneNumber
              )}
            />

            <DetailRow
              label="UPI / Payment Number"
              value={getValue(
                referral.upiNumber,
                referral.paymentNumber,
                referral.upi,
                referral.referrerUpi
              )}
            />

            <DetailRow
              label="Referral Submitted"
              value={formatDate(
                referral.createdAt || referral.submittedAt
              )}
            />
          </div>
        </div>

        <div className="details-card">
          <div className="card-heading">
            <span className="card-icon">🧑‍🔧</span>
            <div>
              <h2>Provider Details</h2>
              <p>Referred service provider information</p>
            </div>
          </div>

          <div className="details-list">
            <DetailRow
              label="Provider Name"
              value={providerName}
              highlight
            />

            <DetailRow
              label="Provider ID"
              value={getValue(
                referral.providerId,
                referral.providerUid,
                referral.providerUserId
              )}
            />

            <DetailRow
              label="Phone Number"
              value={providerPhone}
            />

            <DetailRow
              label="Service / Role"
              value={providerRole}
            />

            <DetailRow
              label="Union / Labour ID"
              value={unionLabourId}
              highlight={hasUnionLabourId}
            />

            <DetailRow
              label="Address"
              value={providerAddress}
            />
          </div>
        </div>
      </section>

      <section className="status-card">
        <div className="card-heading">
          <span className="card-icon">📊</span>
          <div>
            <h2>Referral Status</h2>
            <p>Current referral progress</p>
          </div>
        </div>

        <div className="status-list">
          <div className="status-row">
            <span>Current Status</span>
            <StatusBadge value={currentStatus} />
          </div>

          <div className="status-row">
            <span>Admin Status</span>
            <StatusBadge value={adminStatus} />
          </div>

          <div className="status-row">
            <span>Verification Status</span>
            <StatusBadge value={verificationStatus} />
          </div>

          <div className="status-row">
            <span>Onboarding Status</span>
            <StatusBadge value={onboardingStatus} />
          </div>

          <div className="status-row">
            <span>Reward Status</span>
            <StatusBadge value={rewardStatus} />
          </div>

          <div className="status-row">
            <span>Payment Status</span>
            <StatusBadge value={paymentStatus} />
          </div>

          <div className="status-row reward-row">
            <span>Reward Amount</span>
            <strong>₹{automaticReward}</strong>
          </div>

          <div className="status-row">
            <span>Accepted At</span>
            <strong>{formatDate(referral.acceptedAt)}</strong>
          </div>

          <div className="status-row">
            <span>Verified At</span>
            <strong>{formatDate(referral.verifiedAt)}</strong>
          </div>

          <div className="status-row">
            <span>Paid At</span>
            <strong>
              {formatDate(referral.paidAt || referral.paymentCompletedAt)}
            </strong>
          </div>
        </div>
      </section>

      {referral.paymentProofUrl && (
        <section className="proof-card">
          <div className="card-heading">
            <span className="card-icon">🧾</span>
            <div>
              <h2>Payment Proof</h2>
              <p>Uploaded payment completion proof</p>
            </div>
          </div>

          <img
            src={referral.paymentProofUrl}
            alt="Payment proof"
            className="existing-proof-image"
          />

          <a
            href={referral.paymentProofUrl}
            target="_blank"
            rel="noreferrer"
            className="proof-link"
          >
            Open Payment Proof
          </a>
        </section>
      )}

      <section className="admin-actions">
        <div className="card-heading">
          <span className="card-icon">⚙️</span>
          <div>
            <h2>Admin Actions</h2>
            <p>Manage approval, rejection and payment</p>
          </div>
        </div>

        {isRejected && (
          <div className="action-notice rejected-notice">
            This referral has been rejected.
          </div>
        )}

        {isPaid && (
          <div className="action-notice paid-notice">
            Payment completed. This provider is saved in the verified
            provider registry.
          </div>
        )}

        {!isRejected && !isPaid && (
          <div className="action-buttons">
            {!isApproved && (
              <button
                className="approve-action"
                onClick={handleApproveReferral}
                disabled={actionLoading}
              >
                {actionLoading ? "Processing..." : "Approve Referral"}
              </button>
            )}

            <button
              className="danger-action"
              onClick={() => setShowRejectBox((previous) => !previous)}
              disabled={actionLoading}
            >
              Reject Referral
            </button>

            {isApproved && (
              <button
                className="payment-action"
                onClick={() => setShowPaymentBox((previous) => !previous)}
                disabled={actionLoading}
              >
                Complete Payment
              </button>
            )}
          </div>
        )}

        {showRejectBox && !isRejected && (
          <div className="action-box rejection-box">
            <h3>Reject Referral</h3>

            <p>
              Please provide a clear reason for rejecting this referral.
            </p>

            <label htmlFor="rejectionReason">
              Rejection Reason
            </label>

            <textarea
              id="rejectionReason"
              rows="4"
              value={rejectionReason}
              onChange={(event) =>
                setRejectionReason(event.target.value)
              }
              placeholder="Enter rejection reason..."
              disabled={actionLoading}
            />

            <div className="action-buttons">
              <button
                className="danger-action"
                onClick={handleRejectReferral}
                disabled={actionLoading}
              >
                {actionLoading ? "Rejecting..." : "Confirm Rejection"}
              </button>

              <button
                className="secondary-action"
                onClick={() => {
                  setShowRejectBox(false);
                  setRejectionReason("");
                }}
                disabled={actionLoading}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {showPaymentBox && isApproved && !isPaid && !isRejected && (
          <div className="action-box payment-box">
            <div className="payment-header">
              <div>
                <h3>Complete Referral Payment</h3>
                <p>
                  The reward amount is calculated automatically.
                </p>
              </div>

              <div className="automatic-reward">
                ₹{automaticReward}
              </div>
            </div>

            <div className="reward-explanation">
              {hasUnionLabourId ? (
                <>
                  <span className="reward-check">✓</span>
                  Union / Labour ID found — reward fixed at{" "}
                  <strong>₹4</strong>
                </>
              ) : (
                <>
                  <span className="reward-check">✓</span>
                  No Union / Labour ID — reward fixed at{" "}
                  <strong>₹3</strong>
                </>
              )}
            </div>

            <div className="payment-summary">
              <span>Automatic Payment Amount</span>
              <strong>₹{automaticReward}</strong>
            </div>

            <div className="form-group">
              <label htmlFor="paymentProof">
                Payment Completed Photo
              </label>

              <input
                id="paymentProof"
                type="file"
                accept="image/*"
                onChange={handlePaymentProofChange}
                disabled={actionLoading}
              />

              <small>
                Upload the payment screenshot or completed payment photo.
                Maximum size: 5 MB.
              </small>
            </div>

            {paymentProofPreview && (
              <div className="payment-preview">
                <p>Selected Payment Proof</p>

                <img
                  src={paymentProofPreview}
                  alt="Selected payment proof preview"
                />
              </div>
            )}

            <div className="action-buttons">
              <button
                className="payment-action"
                onClick={handleCompletePayment}
                disabled={actionLoading}
              >
                {actionLoading
                  ? "Saving Payment..."
                  : `Confirm ₹${automaticReward} Payment`}
              </button>

              <button
                className="secondary-action"
                onClick={() => {
                  setShowPaymentBox(false);
                  setPaymentProof(null);
                  setPaymentProofPreview("");
                }}
                disabled={actionLoading}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}