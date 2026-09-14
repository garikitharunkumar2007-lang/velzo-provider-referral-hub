import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import {
  getDownloadURL,
  ref as storageRef,
  uploadBytes,
} from "firebase/storage";

import { db, storage } from "../../firebase/firebaseConfig";

import "./AdminReferralDetails.css";

/* =====================================================
   HELPERS
===================================================== */

function formatDate(value) {
  if (!value) return "—";

  try {
    let date;

    if (typeof value?.toDate === "function") {
      date = value.toDate();
    } else if (value?.seconds) {
      date = new Date(value.seconds * 1000);
    } else {
      date = new Date(value);
    }

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

  return `₹${
    Number.isFinite(amount)
      ? amount.toLocaleString("en-IN")
      : "0"
  }`;
}

function cleanStatus(value) {
  return String(value || "pending")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");
}

function displayStatus(value) {
  return cleanStatus(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function StatusBadge({ value }) {
  const status = cleanStatus(value);

  return (
    <span className={`status-badge ${status}`}>
      {displayStatus(value)}
    </span>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="detail-row">
      <span>{label}</span>

      <strong>
        {value !== undefined &&
        value !== null &&
        value !== ""
          ? value
          : "—"}
      </strong>
    </div>
  );
}

function getUnionId(referral) {
  return String(
    referral?.unionId ||
      referral?.labourId ||
      referral?.laborId ||
      referral?.unionNumber ||
      ""
  ).trim();
}

function getProviderPhone(referral) {
  return (
    referral?.providerPhone ||
    referral?.phoneNumber ||
    referral?.phone ||
    ""
  );
}

function getProviderName(referral) {
  return (
    referral?.providerName ||
    referral?.fullName ||
    referral?.name ||
    ""
  );
}

function getProviderAddress(referral) {
  return (
    referral?.address ||
    referral?.providerAddress ||
    ""
  );
}

function getProviderRole(referral) {
  return (
    referral?.serviceType ||
    referral?.role ||
    referral?.providerRole ||
    ""
  );
}

/*
  Union ID present:
  ₹4

  Union ID absent:
  ₹3
*/
function calculateReferralReward(referral) {
  return getUnionId(referral) ? 4 : 3;
}

function getStoredReward(referral) {
  const values = [
    referral?.paymentAmount,
    referral?.rewardAmount,
    referral?.rewardEarned,
    referral?.referralReward,
    referral?.earnings,
    referral?.reward,
  ];

  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") {
      const amount = Number(
        String(value)
          .replace(/₹/g, "")
          .replace(/,/g, "")
      );

      if (Number.isFinite(amount) && amount > 0) {
        return amount;
      }
    }
  }

  return calculateReferralReward(referral);
}

/* =====================================================
   COMPONENT
===================================================== */

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

  const [paymentFile, setPaymentFile] = useState(null);
  const [paymentPreview, setPaymentPreview] = useState("");

  const automaticReward = useMemo(() => {
    return calculateReferralReward(referral);
  }, [referral]);

  /* =====================================================
     LOAD REFERRAL
  ===================================================== */

  async function loadReferral() {
    if (!referralId) {
      setError("Referral ID is missing.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const referralRef = doc(db, "referrals", referralId);
      const snapshot = await getDoc(referralRef);

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

      const status = cleanStatus(data.status);
      const paymentStatus = cleanStatus(data.paymentStatus);

      if (
        status === "accepted" &&
        paymentStatus !== "completed"
      ) {
        setShowPaymentBox(true);
      }
    } catch (err) {
      console.error("Load referral error:", err);
      setError(err?.message || "Unable to load referral.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReferral();
  }, [referralId]);

  /* =====================================================
     PAYMENT FILE
===================================================== */

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

    if (paymentPreview) {
      URL.revokeObjectURL(paymentPreview);
    }

    setPaymentPreview(URL.createObjectURL(file));
  }

  /* =====================================================
     STATUS FLAGS
===================================================== */

  const currentStatus = cleanStatus(referral?.status);
  const paymentStatus = cleanStatus(referral?.paymentStatus);

  const isRejected = currentStatus === "rejected";

  const isPaid =
    currentStatus === "paid" ||
    currentStatus === "successful" ||
    paymentStatus === "completed";

  const isAccepted =
    currentStatus === "accepted" ||
    referral?.adminStatus === "approved";

  const displayedReward = isPaid
    ? getStoredReward(referral)
    : automaticReward;

  /* =====================================================
     VALIDATION
===================================================== */

  function validateAction() {
    if (!referral) {
      setError("Referral details are unavailable.");
      return false;
    }

    if (isRejected || isPaid) {
      setError("This referral has already been completed.");
      return false;
    }

    return true;
  }

  /* =====================================================
     ACCEPT REFERRAL
===================================================== */

  async function acceptReferral() {
    if (!validateAction()) return;

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

      await updateDoc(doc(db, "referrals", referralId), {
        status: "accepted",
        adminStatus: "approved",
        verificationStatus: "verified",
        rewardStatus: "approved",
        paymentStatus: "pending",
        acceptedAt: serverTimestamp(),
        approvedAt: serverTimestamp(),
        verifiedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setReferral((previous) => ({
        ...previous,
        status: "accepted",
        adminStatus: "approved",
        verificationStatus: "verified",
        rewardStatus: "approved",
        paymentStatus: "pending",
      }));

      setShowPaymentBox(true);

      setSuccess(
        `Referral accepted. Automatic reward is ${formatCurrency(
          automaticReward
        )}.`
      );
    } catch (err) {
      console.error("Accept referral error:", err);
      setError(err?.message || "Unable to accept referral.");
    } finally {
      setActionLoading(false);
    }
  }

  /* =====================================================
     REJECT REFERRAL
===================================================== */

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

      await updateDoc(doc(db, "referrals", referralId), {
        status: "rejected",
        adminStatus: "rejected",
        verificationStatus: "rejected",
        onboardingStatus: "not_started",
        rejectionReason: reason,
        rewardStatus: "rejected",
        paymentStatus: "not_paid",
        reward: 0,
        rewardAmount: 0,
        rewardEarned: 0,
        referralReward: 0,
        paymentAmount: 0,
        rejectedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setReferral((previous) => ({
        ...previous,
        status: "rejected",
        adminStatus: "rejected",
        verificationStatus: "rejected",
        onboardingStatus: "not_started",
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
      setSuccess("Referral rejected successfully.");
    } catch (err) {
      console.error("Reject referral error:", err);
      setError(err?.message || "Unable to reject referral.");
    } finally {
      setActionLoading(false);
    }
  }

  /* =====================================================
     SAVE VERIFIED PROVIDER
===================================================== */

  async function saveVerifiedProvider(
    amount,
    paymentProofUrl,
    paymentProofPath
  ) {
    const providerRef = doc(
      db,
      "verifiedProviders",
      referralId
    );

    const providerName = getProviderName(referral);
    const providerPhone = getProviderPhone(referral);
    const unionId = getUnionId(referral);
    const address = getProviderAddress(referral);
    const role = getProviderRole(referral);

    await setDoc(
      providerRef,
      {
        referralId,

        providerName,
        providerPhone,
        phone: providerPhone,

        unionId: unionId || null,

        address,
        role,
        serviceType: role,

        referrerId: referral.referrerId || "",
        referrerName: referral.referrerName || "",
        referrerPhone:
          referral.referrerPhone ||
          referral.referrerMobile ||
          "",

        upiNumber: referral.upiNumber || "",

        rewardAmount: amount,
        paymentAmount: amount,

        paymentStatus: "completed",
        verificationStatus: "verified",
        onboardingStatus: "completed",
        providerStatus: "verified",

        paymentProofUrl,
        paymentProofPath,

        source: "referral_payment",

        provider: {
          name: providerName,
          unionId: unionId || null,
          phone: providerPhone,
          address,
          role,
        },

        verifiedAt: serverTimestamp(),
        addedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  /* =====================================================
     COMPLETE PAYMENT
===================================================== */

  async function completePayment() {
    if (!referral) return;

    if (!paymentFile) {
      setError(
        "Please upload the payment completed screenshot/photo."
      );
      return;
    }

    if (
      !window.confirm(
        `Confirm automatic payment of ${formatCurrency(
          automaticReward
        )} to the referrer?`
      )
    ) {
      return;
    }

    try {
      setActionLoading(true);
      setError("");
      setSuccess("");

      const extension =
        paymentFile.name.split(".").pop()?.toLowerCase() || "jpg";

      const filePath =
        `referral-payments/${referralId}/` +
        `payment-proof-${Date.now()}.${extension}`;

      const paymentRef = storageRef(storage, filePath);

      await uploadBytes(paymentRef, paymentFile, {
        contentType: paymentFile.type,
      });

      const paymentProofUrl = await getDownloadURL(paymentRef);

      const paymentUpdate = {
        status: "paid",
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

        paymentMethod: "UPI",
        paymentProofUrl,
        paymentProofPath: filePath,

        paidAt: serverTimestamp(),
        verifiedAt: serverTimestamp(),
        approvedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await updateDoc(
        doc(db, "referrals", referralId),
        paymentUpdate
      );

      await saveVerifiedProvider(
        automaticReward,
        paymentProofUrl,
        filePath
      );

      setReferral((previous) => ({
        ...previous,
        ...paymentUpdate,
        reward: automaticReward,
        rewardAmount: automaticReward,
        rewardEarned: automaticReward,
        referralReward: automaticReward,
        paymentAmount: automaticReward,
        status: "paid",
        paymentStatus: "completed",
      }));

      setShowPaymentBox(false);
      setPaymentFile(null);
      setPaymentPreview("");

      setSuccess(
        `Payment completed successfully. ${formatCurrency(
          automaticReward
        )} saved in verifiedProviders.`
      );
    } catch (err) {
      console.error("Complete payment error:", err);
      setError(
        err?.message ||
          "Unable to complete payment. Please try again."
      );
    } finally {
      setActionLoading(false);
    }
  }

  /* =====================================================
     LOADING / ERROR
===================================================== */

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
        <div className="admin-alert error">{error}</div>

        <button
          className="back-button"
          onClick={() => navigate("/admin/referrals")}
        >
          ← Back to Referrals
        </button>
      </div>
    );
  }

  if (!referral) return null;

  /* =====================================================
     UI
===================================================== */

  return (
    <div className="admin-details-page">
      <div className="admin-details-header">
        <div className="header-left">
          <button
            className="back-button"
            onClick={() => navigate("/admin/referrals")}
          >
            ← Back to Referrals
          </button>

          <h1>Referral Details</h1>

          <p>
            Referral ID: <strong>{referral.id}</strong>
          </p>
        </div>

        <StatusBadge
          value={isPaid ? "paid" : referral.status}
        />
      </div>

      {error && <div className="admin-alert error">{error}</div>}

      {success && (
        <div className="admin-alert success">{success}</div>
      )}

      <div className="details-grid">
        <section className="detail-card">
          <div className="card-label">REFERRER DETAILS</div>

          <h2>{referral.referrerName || "—"}</h2>

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
            value={formatDate(referral.createdAt)}
          />
        </section>

        <section className="detail-card">
          <div className="card-label">PROVIDER DETAILS</div>

          <h2>{getProviderName(referral) || "—"}</h2>

          <DetailRow
            label="Provider ID"
            value={referral.providerId}
          />

          <DetailRow
            label="Phone Number"
            value={getProviderPhone(referral)}
          />

          <DetailRow
            label="Service / Role"
            value={getProviderRole(referral)}
          />

          <DetailRow
            label="Union / Labour ID"
            value={getUnionId(referral) || "Not provided"}
          />

          <DetailRow
            label="Address"
            value={getProviderAddress(referral)}
          />
        </section>

        <section className="detail-card">
          <div className="card-label">REFERRAL STATUS</div>

          <DetailRow
            label="Current Status"
            value={
              <StatusBadge
                value={isPaid ? "paid" : referral.status}
              />
            }
          />

          <DetailRow
            label="Admin Status"
            value={<StatusBadge value={referral.adminStatus} />}
          />

          <DetailRow
            label="Verification Status"
            value={
              <StatusBadge
                value={
                  isPaid
                    ? "verified"
                    : referral.verificationStatus
                }
              />
            }
          />

          <DetailRow
            label="Onboarding Status"
            value={
              <StatusBadge
                value={
                  isPaid
                    ? "completed"
                    : referral.onboardingStatus
                }
              />
            }
          />

          <DetailRow
            label="Reward Status"
            value={
              <StatusBadge
                value={
                  isPaid ? "paid" : referral.rewardStatus
                }
              />
            }
          />

          <DetailRow
            label="Payment Status"
            value={
              <StatusBadge
                value={
                  isPaid ? "completed" : referral.paymentStatus
                }
              />
            }
          />

          <DetailRow
            label="Reward Amount"
            value={formatCurrency(displayedReward)}
          />

          <DetailRow
            label="Accepted At"
            value={formatDate(referral.acceptedAt)}
          />

          <DetailRow
            label="Verified At"
            value={formatDate(referral.verifiedAt)}
          />

          <DetailRow
            label="Paid At"
            value={formatDate(referral.paidAt)}
          />

          {isRejected && referral.rejectionReason && (
            <div className="rejection-message">
              <strong>Rejection Reason</strong>
              <p>{referral.rejectionReason}</p>
            </div>
          )}

          {isPaid && referral.paymentProofUrl && (
            <a
              className="proof-link"
              href={referral.paymentProofUrl}
              target="_blank"
              rel="noreferrer"
            >
              View Payment Proof
            </a>
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
                onClick={() => {
                  setError("");
                  setSuccess("");
                  setShowRejectBox(true);
                  setShowPaymentBox(false);
                }}
              >
                Reject Referral
              </button>
            </div>
          )}

          {isAccepted && !showPaymentBox && (
            <button
              className="approve-action"
              disabled={actionLoading}
              onClick={() => setShowPaymentBox(true)}
            >
              Complete Payment
            </button>
          )}

          {showRejectBox && (
            <div className="action-box rejection-box">
              <h3>Reject Referral</h3>

              <p>
                Enter the reason why this referral is being rejected.
              </p>

              <textarea
                value={rejectReason}
                onChange={(event) =>
                  setRejectReason(event.target.value)
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
                  onClick={() => setShowRejectBox(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {showPaymentBox && (
            <div className="action-box payment-box">
              <div className="payment-heading">
                <div>
                  <h3>Complete Referral Payment</h3>
                  <p>
                    Send the automatic reward and upload payment proof.
                  </p>
                </div>

                <div className="automatic-reward">
                  {formatCurrency(automaticReward)}
                </div>
              </div>

              <div className="reward-rule">
                {getUnionId(referral) ? (
                  <>
                    ✓ Union / Labour ID found — reward fixed at{" "}
                    <strong>₹4</strong>
                  </>
                ) : (
                  <>
                    ✓ No Union / Labour ID — reward fixed at{" "}
                    <strong>₹3</strong>
                  </>
                )}
              </div>

              <div className="form-group">
                <label>Automatic Payment Amount</label>

                <input
                  type="text"
                  value={formatCurrency(automaticReward)}
                  readOnly
                  disabled
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
                    : `Confirm ${formatCurrency(
                        automaticReward
                      )} Payment`}
                </button>

                <button
                  className="secondary-action"
                  disabled={actionLoading}
                  onClick={() => setShowPaymentBox(false)}
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
          <strong>✓ Payment Completed Successfully</strong>

          <p>
            Reward paid:{" "}
            <strong>{formatCurrency(displayedReward)}</strong>
          </p>

          <p>
            Provider saved in:
            <br />
            <strong>
              verifiedProviders/{referralId}
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