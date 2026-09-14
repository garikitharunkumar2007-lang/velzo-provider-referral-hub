// src/pages/admin/AdminReferralDetails.jsx

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import {
  getDownloadURL,
  ref as storageRef,
  uploadBytes,
} from "firebase/storage";

import { db, storage } from "../../firebase/firebaseConfig";
import "./AdminReferralDetails.css";

const REFERRALS = "referrals";
const VERIFIED_PROVIDERS = "verifiedProviders";

const text = (value) =>
  value === undefined || value === null ? "" : String(value).trim();

const first = (...values) => values.find((value) => text(value) !== "") ?? "";

function normalizePhone(value) {
  const digits = text(value).replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

function providerPhoneOf(referral) {
  return first(
    referral?.providerPhone,
    referral?.providerPhoneNumber,
    referral?.referredProviderPhone,
    referral?.referredProviderMobile,
    referral?.phoneNumber,
    referral?.phone,
    referral?.mobileNumber,
    referral?.mobile,
    referral?.provider?.phone,
    referral?.provider?.phoneNumber,
    referral?.provider?.mobile
  );
}

function providerNameOf(referral) {
  return first(
    referral?.providerName,
    referral?.referredProviderName,
    referral?.providerFullName,
    referral?.fullName,
    referral?.name,
    referral?.provider?.name,
    referral?.provider?.fullName,
    "Provider unavailable"
  );
}

function providerRoleOf(referral) {
  return first(
    referral?.serviceType,
    referral?.service,
    referral?.role,
    referral?.providerRole,
    referral?.provider?.role,
    "—"
  );
}

function providerUnionIdOf(referral) {
  return first(
    referral?.unionLabourId,
    referral?.unionId,
    referral?.unionID,
    referral?.labourId,
    referral?.labourID,
    referral?.laborId,
    referral?.unionNumber,
    referral?.provider?.unionId
  );
}

function providerAddressOf(referral) {
  return first(
    referral?.providerAddress,
    referral?.address,
    referral?.provider?.address,
    "—"
  );
}

function statusOf(referral) {
  return text(
    referral?.status ||
      referral?.currentStatus ||
      referral?.adminStatus ||
      "pending"
  ).toLowerCase().replace(/[_-]/g, " ");
}

function formatDate(value) {
  if (!value) return "—";
  try {
    const date =
      typeof value?.toDate === "function"
        ? value.toDate()
        : new Date(value);
    return Number.isNaN(date.getTime())
      ? "—"
      : date.toLocaleString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        });
  } catch {
    return "—";
  }
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });
}

function getReward(referral) {
  const stored = first(
    referral?.rewardAmount,
    referral?.paymentAmount,
    referral?.rewardEarned,
    referral?.referralReward,
    referral?.reward
  );
  const amount = Number(stored);
  if (Number.isFinite(amount) && amount > 0) return amount;
  return providerUnionIdOf(referral) ? 4 : 3;
}

function statusClass(value) {
  const status = statusOf({ status: value });
  if (["paid", "successful", "verified", "approved", "completed"].includes(status)) {
    return "status-success";
  }
  if (["rejected", "declined", "failed", "cancelled", "canceled"].includes(status)) {
    return "status-danger";
  }
  return "status-pending";
}

function StatusBadge({ value }) {
  return (
    <span className={`status-badge ${statusClass(value)}`}>
      {text(value || "pending")
        .replace(/[_-]/g, " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase())}
    </span>
  );
}

function DetailRow({ label, value, highlight = false }) {
  return (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      <strong className={highlight ? "highlight-value" : "detail-value"}>
        {text(value) || "—"}
      </strong>
    </div>
  );
}

async function findVerifiedProviderByPhone(phone, currentReferralId) {
  const normalized = normalizePhone(phone);
  if (normalized.length !== 10) return null;

  const collectionRef = collection(db, VERIFIED_PROVIDERS);

  const fields = ["phoneNumber", "providerPhone", "phone", "mobileNumber"];
  const results = await Promise.all(
    fields.map(async (field) => {
      try {
        const snapshot = await getDocs(
          query(collectionRef, where(field, "==", normalized), limit(10))
        );
        return snapshot.docs;
      } catch (error) {
        // A missing index or field must not stop the other checks.
        console.warn(`Duplicate check failed for ${field}`, error);
        return [];
      }
    })
  );

  const duplicate = results
    .flat()
    .find((item) => item.id !== currentReferralId);

  if (!duplicate) return null;

  return {
    id: duplicate.id,
    ...duplicate.data(),
  };
}

export default function AdminReferralDetails() {
  const { referralId } = useParams();
  const navigate = useNavigate();

  const [referral, setReferral] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [duplicateProvider, setDuplicateProvider] = useState(null);
  const [duplicateChecking, setDuplicateChecking] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectBox, setShowRejectBox] = useState(false);
  const [showPaymentBox, setShowPaymentBox] = useState(false);
  const [paymentFile, setPaymentFile] = useState(null);
  const [paymentPreview, setPaymentPreview] = useState("");

  const providerName = providerNameOf(referral);
  const providerPhone = providerPhoneOf(referral);
  const unionId = providerUnionIdOf(referral);
  const providerRole = providerRoleOf(referral);
  const providerAddress = providerAddressOf(referral);
  const automaticReward = useMemo(() => getReward(referral), [referral]);

  const currentStatus = statusOf(referral);
  const isRejected = currentStatus === "rejected";
  const isPaid =
    currentStatus === "paid" ||
    text(referral?.paymentStatus).toLowerCase() === "completed" ||
    referral?.movedToVerifiedProviders === true;
  const isApproved =
    ["approved", "accepted", "verified"].includes(currentStatus) ||
    text(referral?.adminStatus).toLowerCase() === "approved";

  const loadReferral = useCallback(async () => {
    if (!referralId) {
      setError("Referral ID is missing.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");
      const snapshot = await getDoc(doc(db, REFERRALS, referralId));

      if (!snapshot.exists()) {
        setReferral(null);
        setError("Referral not found.");
        return;
      }

      setReferral({ id: snapshot.id, ...snapshot.data() });
    } catch (err) {
      console.error("Load referral error:", err);
      setError(err?.message || "Unable to load referral.");
    } finally {
      setLoading(false);
    }
  }, [referralId]);

  const checkDuplicate = useCallback(
    async (referralData) => {
      if (!referralData) return;

      try {
        setDuplicateChecking(true);
        const duplicate = await findVerifiedProviderByPhone(
          providerPhoneOf(referralData),
          referralId
        );

        setDuplicateProvider(duplicate);

        const existingStatus = statusOf(referralData);
        const alreadyPaid =
          existingStatus === "paid" ||
          text(referralData.paymentStatus).toLowerCase() === "completed" ||
          referralData.movedToVerifiedProviders === true;

        if (
          duplicate &&
          !alreadyPaid &&
          existingStatus !== "rejected" &&
          !referralData.isDuplicateProvider
        ) {
          const reason =
            "Provider already exists in verifiedProviders with the same mobile number.";

          await updateDoc(doc(db, REFERRALS, referralId), {
            status: "rejected",
            currentStatus: "rejected",
            adminStatus: "rejected",
            verificationStatus: "rejected",
            paymentStatus: "not_paid",
            rewardStatus: "rejected",
            reward: 0,
            rewardAmount: 0,
            paymentAmount: 0,
            isDuplicateProvider: true,
            duplicateProviderId: duplicate.id,
            duplicateProviderName:
              duplicate.providerName || duplicate.name || "Existing provider",
            duplicateProviderPhone:
              normalizePhone(
                duplicate.phoneNumber ||
                  duplicate.providerPhone ||
                  duplicate.phone
              ),
            rejectionReason: reason,
            rejectedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          setReferral((previous) => ({
            ...previous,
            status: "rejected",
            currentStatus: "rejected",
            adminStatus: "rejected",
            verificationStatus: "rejected",
            paymentStatus: "not_paid",
            rewardStatus: "rejected",
            reward: 0,
            rewardAmount: 0,
            paymentAmount: 0,
            isDuplicateProvider: true,
            duplicateProviderId: duplicate.id,
            rejectionReason: reason,
          }));

          setSuccess("Duplicate provider found. Referral automatically rejected.");
        }
      } catch (err) {
        console.error("Duplicate provider check error:", err);
        setError(
          "Unable to verify duplicate provider. Check Firestore permissions and phone fields."
        );
      } finally {
        setDuplicateChecking(false);
      }
    },
    [referralId]
  );

  useEffect(() => {
    loadReferral();
  }, [loadReferral]);

  useEffect(() => {
    if (referral) checkDuplicate(referral);
  }, [referral, checkDuplicate]);

  function handlePaymentFileChange(event) {
    const file = event.target.files?.[0] || null;
    setError("");
    setSuccess("");

    if (!file) {
      setPaymentFile(null);
      setPaymentPreview("");
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Please upload an image payment proof.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Payment proof must be smaller than 5 MB.");
      return;
    }

    setPaymentFile(file);
    setPaymentPreview(URL.createObjectURL(file));
  }

  async function approveReferral() {
    if (duplicateProvider) {
      setError("This provider already exists in verifiedProviders. Approval is blocked.");
      return;
    }

    try {
      setActionLoading(true);
      await updateDoc(doc(db, REFERRALS, referralId), {
        status: "approved",
        currentStatus: "approved",
        adminStatus: "approved",
        verificationStatus: "approved",
        approvedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setReferral((previous) => ({
        ...previous,
        status: "approved",
        currentStatus: "approved",
        adminStatus: "approved",
        verificationStatus: "approved",
      }));
      setSuccess("Referral approved successfully.");
    } catch (err) {
      console.error(err);
      setError(err?.message || "Unable to approve referral.");
    } finally {
      setActionLoading(false);
    }
  }

  async function rejectReferral() {
    const reason = rejectReason.trim();
    if (!reason) {
      setError("Please enter a rejection reason.");
      return;
    }

    try {
      setActionLoading(true);
      await updateDoc(doc(db, REFERRALS, referralId), {
        status: "rejected",
        currentStatus: "rejected",
        adminStatus: "rejected",
        verificationStatus: "rejected",
        paymentStatus: "not_paid",
        rewardStatus: "rejected",
        reward: 0,
        rewardAmount: 0,
        paymentAmount: 0,
        rejectionReason: reason,
        rejectedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setReferral((previous) => ({
        ...previous,
        status: "rejected",
        currentStatus: "rejected",
        adminStatus: "rejected",
        verificationStatus: "rejected",
        paymentStatus: "not_paid",
        rewardStatus: "rejected",
        reward: 0,
        rewardAmount: 0,
        paymentAmount: 0,
        rejectionReason: reason,
      }));
      setShowRejectBox(false);
      setRejectReason("");
      setSuccess("Referral rejected successfully.");
    } catch (err) {
      console.error(err);
      setError(err?.message || "Unable to reject referral.");
    } finally {
      setActionLoading(false);
    }
  }

  async function completePayment() {
    if (!referral || isRejected || isPaid || duplicateProvider) return;

    if (!isApproved) {
      setError("Approve the referral before completing payment.");
      return;
    }

    if (!paymentFile) {
      setError("Please upload the payment completed photo.");
      return;
    }

    try {
      setActionLoading(true);
      setError("");
      setSuccess("");

      // Re-check immediately before payment to prevent race-condition duplicates.
      const latestDuplicate = await findVerifiedProviderByPhone(
        providerPhone,
        referralId
      );

      if (latestDuplicate) {
        setDuplicateProvider(latestDuplicate);
        await rejectReferralForDuplicate(latestDuplicate);
        return;
      }

      const extension = paymentFile.name.split(".").pop()?.toLowerCase() || "jpg";
      const path =
        `referral-payments/${referralId}/payment-proof-${Date.now()}.${extension}`;

      const fileRef = storageRef(storage, path);
      await uploadBytes(fileRef, paymentFile, {
        contentType: paymentFile.type,
      });
      const paymentProofUrl = await getDownloadURL(fileRef);

      const referralRef = doc(db, REFERRALS, referralId);
      const verifiedRef = doc(db, VERIFIED_PROVIDERS, referralId);
      const batch = writeBatch(db);

      const verifiedProviderData = {
        referralId,
        originalReferralId: referralId,
        providerName,
        providerPhone: normalizePhone(providerPhone),
        phoneNumber: normalizePhone(providerPhone),
        phone: normalizePhone(providerPhone),
        unionLabourId: unionId,
        unionId,
        address: providerAddress,
        role: providerRole,
        service: providerRole,
        serviceType: providerRole,
        referrerId: first(referral.referrerId, referral.referrerUid, referral.userId),
        referrerName: first(referral.referrerName, referral.submittedByName),
        referrerPhone: first(referral.referrerPhone, referral.referrerPhoneNumber),
        upiNumber: first(referral.upiNumber, referral.paymentNumber, referral.upi),
        rewardAmount: automaticReward,
        paymentAmount: automaticReward,
        paymentStatus: "completed",
        verificationStatus: "verified",
        onboardingStatus: "completed",
        providerStatus: "verified",
        paymentProofUrl,
        paymentProofPath: path,
        source: "referral_payment",
        verifiedAt: serverTimestamp(),
        paidAt: serverTimestamp(),
        createdAt: referral.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      batch.update(referralRef, {
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
        paymentMethod: "UPI",
        paymentProofUrl,
        paymentProofPath: path,
        movedToVerifiedProviders: true,
        verifiedProviderId: referralId,
        providerMovedAt: serverTimestamp(),
        paidAt: serverTimestamp(),
        paymentCompletedAt: serverTimestamp(),
        verifiedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      batch.set(verifiedRef, verifiedProviderData, { merge: true });
      await batch.commit();

      setReferral((previous) => ({
        ...previous,
        status: "paid",
        currentStatus: "paid",
        paymentStatus: "completed",
        verificationStatus: "verified",
        movedToVerifiedProviders: true,
        reward: automaticReward,
        rewardAmount: automaticReward,
        paymentAmount: automaticReward,
        paymentProofUrl,
      }));
      setPaymentFile(null);
      setPaymentPreview("");
      setShowPaymentBox(false);
      setSuccess(
        `${formatCurrency(automaticReward)} paid. Provider transferred to verifiedProviders.`
      );
    } catch (err) {
      console.error("Complete payment error:", err);
      setError(
        err?.message ||
          "Payment failed. Provider was not transferred to verifiedProviders."
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function rejectReferralForDuplicate(duplicate) {
    const reason =
      "Provider already exists in verifiedProviders with the same mobile number.";

    await updateDoc(doc(db, REFERRALS, referralId), {
      status: "rejected",
      currentStatus: "rejected",
      adminStatus: "rejected",
      verificationStatus: "rejected",
      paymentStatus: "not_paid",
      rewardStatus: "rejected",
      reward: 0,
      rewardAmount: 0,
      paymentAmount: 0,
      isDuplicateProvider: true,
      duplicateProviderId: duplicate.id,
      duplicateProviderName: duplicate.providerName || duplicate.name || "",
      duplicateProviderPhone: normalizePhone(
        duplicate.phoneNumber || duplicate.providerPhone || duplicate.phone
      ),
      rejectionReason: reason,
      rejectedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    setReferral((previous) => ({
      ...previous,
      status: "rejected",
      currentStatus: "rejected",
      adminStatus: "rejected",
      verificationStatus: "rejected",
      paymentStatus: "not_paid",
      rewardStatus: "rejected",
      reward: 0,
      rewardAmount: 0,
      paymentAmount: 0,
      isDuplicateProvider: true,
      rejectionReason: reason,
    }));
    setSuccess("Duplicate provider found. Referral automatically rejected.");
  }

  if (loading) {
    return (
      <div className="admin-details-page referral-details-page">
        <div className="details-loading-card">
          <div className="loading-spinner" />
          <p>Checking referral and verified providers...</p>
        </div>
      </div>
    );
  }

  if (!referral) {
    return (
      <div className="admin-details-page referral-details-page">
        <div className="details-empty-card">
          <h2>Referral not found</h2>
          <p>{error || "The requested referral does not exist."}</p>
          <button className="secondary-action" onClick={() => navigate("/admin/referrals")}>
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
          <button className="back-button" onClick={() => navigate("/admin/referrals")}>
            ← Back to Referrals
          </button>
          <p className="page-eyebrow">VELZO ADMIN</p>
          <h1>Referral Details</h1>
          <p className="referral-id">
            Referral ID: <strong>{referralId}</strong>
          </p>
        </div>
        <StatusBadge value={currentStatus} />
      </div>

      {error && <div className="admin-alert error">{error}</div>}
      {success && <div className="admin-alert success">{success}</div>}

      {duplicateChecking && (
        <div className="admin-alert pending">
          Checking provider mobile number in verifiedProviders...
        </div>
      )}

      {duplicateProvider && (
        <div className="admin-alert error duplicate-provider-alert">
          <strong>⚠️ Duplicate provider detected</strong>
          <p>
            This mobile number already exists in <strong>verifiedProviders</strong>.
            This referral is rejected and payment is blocked.
          </p>
          <p>
            <strong>Existing provider:</strong>{" "}
            {duplicateProvider.providerName || duplicateProvider.name || "Existing provider"}
            <br />
            <strong>Mobile:</strong>{" "}
            {duplicateProvider.phoneNumber ||
              duplicateProvider.providerPhone ||
              duplicateProvider.phone ||
              providerPhone}
            <br />
            <strong>Document ID:</strong> {duplicateProvider.id}
          </p>
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
            <DetailRow label="Referrer Name" value={first(referral.referrerName, referral.submittedByName, referral.referrer)} />
            <DetailRow label="Referrer ID" value={first(referral.referrerId, referral.referrerUid, referral.userId)} />
            <DetailRow label="Referrer Phone" value={first(referral.referrerPhone, referral.referrerPhoneNumber)} />
            <DetailRow label="UPI / Payment Number" value={first(referral.upiNumber, referral.paymentNumber, referral.upi, referral.referrerUpi)} />
            <DetailRow label="Referral Submitted" value={formatDate(referral.createdAt || referral.submittedAt)} />
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
            <DetailRow label="Provider Name" value={providerName} highlight />
            <DetailRow label="Provider ID" value={first(referral.providerId, referral.providerUid, referral.providerUserId)} />
            <DetailRow label="Phone Number" value={providerPhone} />
            <DetailRow label="Service / Role" value={providerRole} />
            <DetailRow label="Union / Labour ID" value={unionId || "Not provided"} highlight={Boolean(unionId)} />
            <DetailRow label="Address" value={providerAddress} />
          </div>
        </div>
      </section>

      <section className="status-card">
        <div className="card-heading">
          <span className="card-icon">📋</span>
          <div>
            <h2>Referral Status</h2>
            <p>Current verification and payment state</p>
          </div>
        </div>
        <div className="status-list">
          <DetailRow label="Referral Status" value={currentStatus} />
          <DetailRow label="Payment Status" value={referral.paymentStatus || "pending"} />
          <DetailRow label="Reward Amount" value={formatCurrency(isRejected ? 0 : automaticReward)} highlight />
          <DetailRow label="Verified Providers" value={isPaid ? `Transferred: ${referralId}` : "Not transferred"} />
          <DetailRow label="Paid At" value={formatDate(referral.paidAt || referral.paymentCompletedAt)} />
          {referral.rejectionReason && (
            <DetailRow label="Rejection Reason" value={referral.rejectionReason} />
          )}
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
          <img src={referral.paymentProofUrl} alt="Payment proof" className="existing-proof-image" />
          <a href={referral.paymentProofUrl} target="_blank" rel="noreferrer" className="proof-link">
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
            This referral has been rejected. No payment can be completed.
          </div>
        )}

        {isPaid && (
          <div className="action-notice paid-notice">
            Payment completed. Provider is saved in verifiedProviders/{referralId}.
          </div>
        )}

        {!isRejected && !isPaid && !duplicateProvider && (
          <div className="action-buttons">
            {!isApproved && (
              <button className="approve-action" disabled={actionLoading || duplicateChecking} onClick={approveReferral}>
                {actionLoading ? "Processing..." : "Approve Referral"}
              </button>
            )}

            <button className="danger-action" disabled={actionLoading} onClick={() => setShowRejectBox((value) => !value)}>
              Reject Referral
            </button>

            {isApproved && !showPaymentBox && (
              <button className="approve-action" disabled={actionLoading} onClick={() => setShowPaymentBox(true)}>
                Complete Payment
              </button>
            )}
          </div>
        )}

        {showRejectBox && !isRejected && (
          <div className="action-box rejection-box">
            <label htmlFor="rejection-reason">Rejection reason</label>
            <textarea
              id="rejection-reason"
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              placeholder="Enter the reason for rejection..."
              rows={4}
            />
            <div className="action-buttons">
              <button className="danger-action" disabled={actionLoading} onClick={rejectReferral}>
                {actionLoading ? "Rejecting..." : "Confirm Rejection"}
              </button>
              <button className="secondary-action" onClick={() => setShowRejectBox(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {showPaymentBox && isApproved && !isRejected && !isPaid && !duplicateProvider && (
          <div className="action-box payment-box">
            <h3>Complete Referral Payment</h3>
            <p>
              Automatic reward: <strong>{formatCurrency(automaticReward)}</strong>
            </p>
            <label htmlFor="payment-proof">Payment completed photo</label>
            <input
              id="payment-proof"
              type="file"
              accept="image/*"
              onChange={handlePaymentFileChange}
              disabled={actionLoading}
            />

            {paymentPreview && (
              <div className="payment-proof-preview">
                <img src={paymentPreview} alt="Selected payment proof" />
              </div>
            )}

            <div className="action-buttons">
              <button className="approve-action" disabled={actionLoading || !paymentFile} onClick={completePayment}>
                {actionLoading ? "Uploading..." : `Confirm ${formatCurrency(automaticReward)} Payment`}
              </button>
              <button className="secondary-action" disabled={actionLoading} onClick={() => setShowPaymentBox(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
