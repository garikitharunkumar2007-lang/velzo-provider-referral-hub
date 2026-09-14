import React, {
  useEffect,
  useState,
} from "react";

import {
  useNavigate,
  useParams,
} from "react-router-dom";

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

import {
  db,
  storage,
} from "../../firebase/firebaseConfig";

import "./AdminReferralDetails.css";

/* =====================================================
   DATE FORMATTER
===================================================== */

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

/* =====================================================
   CURRENCY FORMATTER
===================================================== */

function formatCurrency(value) {
  const amount = Number(value ?? 0);

  return `₹${
    Number.isFinite(amount)
      ? amount.toLocaleString("en-IN")
      : "0"
  }`;
}

/* =====================================================
   STATUS BADGE
===================================================== */

function StatusBadge({ value }) {
  const status = String(value || "pending")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");

  const displayStatus = status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );

  return (
    <span className={`status-badge ${status}`}>
      {displayStatus}
    </span>
  );
}

/* =====================================================
   DETAIL ROW
===================================================== */

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

/* =====================================================
   GET REWARD AMOUNT
===================================================== */

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

/* =====================================================
   ADMIN REFERRAL DETAILS
===================================================== */

export default function AdminReferralDetails() {
  const {
    referralId,
  } = useParams();

  const navigate = useNavigate();

  const [referral, setReferral] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [actionLoading, setActionLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [rejectReason, setRejectReason] =
    useState("");

  const [showRejectBox, setShowRejectBox] =
    useState(false);

  const [showPaymentBox, setShowPaymentBox] =
    useState(false);

  const [paymentAmount, setPaymentAmount] =
    useState("");

  const [paymentFile, setPaymentFile] =
    useState(null);

  const [paymentPreview, setPaymentPreview] =
    useState("");

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

  /* =====================================================
     PAYMENT FILE VALIDATION
  ===================================================== */

  function handlePaymentFileChange(event) {
    const file =
      event.target.files?.[0];

    if (!file) {
      setPaymentFile(null);
      setPaymentPreview("");
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError(
        "Please upload only an image file."
      );

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

  /* =====================================================
     VALIDATE ADMIN ACTION
  ===================================================== */

  function validateAdminAction() {
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
      status === "successful" ||
      paymentStatus === "completed"
    ) {
      setError(
        "This referral has already been completed."
      );

      return false;
    }

    return true;
  }

  /* =====================================================
     OPEN REJECT BOX
  ===================================================== */

  function openRejectBox() {
    if (!validateAdminAction()) {
      return;
    }

    setError("");
    setSuccess("");

    setShowPaymentBox(false);
    setShowRejectBox(true);
  }

  /* =====================================================
     OPEN PAYMENT BOX
  ===================================================== */

  function openPaymentBox() {
    if (!validateAdminAction()) {
      return;
    }

    setError("");
    setSuccess("");

    setShowRejectBox(false);
    setShowPaymentBox(true);
  }

  /* =====================================================
     REJECT REFERRAL
  ===================================================== */

  async function rejectReferral() {
    const reason =
      rejectReason.trim();

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
        }
      );

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

  /* =====================================================
     ACCEPT REFERRAL
  ===================================================== */

  async function acceptReferral() {
    if (!validateAdminAction()) {
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

          adminStatus: "approved",

          verificationStatus: "verified",

          rewardStatus: "approved",

          paymentStatus: "pending",

          acceptedAt: serverTimestamp(),

          approvedAt: serverTimestamp(),

          verifiedAt: serverTimestamp(),

          updatedAt: serverTimestamp(),
        }
      );

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

  /* =====================================================
     SAVE VERIFIED PROVIDER SEPARATELY
  ===================================================== */

  async function saveVerifiedProvider(
    amount,
    paymentProofUrl,
    paymentProofPath
  ) {
    const providerReference = doc(
      db,
      "verifiedProviders",
      referralId
    );

    const providerData = {
      referralId,

      providerName:
        referral.providerName ||
        referral.name ||
        "",

      providerPhone:
        referral.providerPhone ||
        referral.phone ||
        "",

      phone:
        referral.providerPhone ||
        referral.phone ||
        "",

      unionId:
        referral.unionId ||
        "",

      address:
        referral.address ||
        "",

      role:
        referral.serviceType ||
        referral.role ||
        "",

      serviceType:
        referral.serviceType ||
        referral.role ||
        "",

      referrerId:
        referral.referrerId ||
        "",

      referrerName:
        referral.referrerName ||
        "",

      referrerPhone:
        referral.referrerPhone ||
        "",

      upiNumber:
        referral.upiNumber ||
        "",

      rewardAmount: amount,

      paymentAmount: amount,

      paymentStatus: "completed",

      verificationStatus: "verified",

      onboardingStatus: "completed",

      providerStatus: "verified",

      paymentProofUrl:
        paymentProofUrl || "",

      paymentProofPath:
        paymentProofPath || "",

      originalReferralId:
        referralId,

      verifiedAt: serverTimestamp(),

      addedAt: serverTimestamp(),

      updatedAt: serverTimestamp(),
    };

    /*
     * setDoc with referralId prevents duplicate provider
     * documents when the same referral is processed again.
     */
    await setDoc(
      providerReference,
      providerData,
      {
        merge: true,
      }
    );
  }

  /* =====================================================
     COMPLETE PAYMENT
  ===================================================== */

  async function completePayment() {
    if (!referral) {
      return;
    }

    const amount =
      Number(paymentAmount);

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

      /* ---------------------------------------------
         UPLOAD PAYMENT PROOF
      --------------------------------------------- */

      const fileExtension =
        paymentFile.name
          .split(".")
          .pop()
          ?.toLowerCase() || "jpg";

      const filePath =
        `referral-payments/${referralId}/` +
        `payment-proof-${Date.now()}.${fileExtension}`;

      const paymentStorageReference =
        storageRef(
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

      /* ---------------------------------------------
         UPDATE ORIGINAL REFERRAL

         After payment:
         - status = paid
         - verification = verified
         - onboarding = completed
         - admin = approved
         - payment = completed
         - reward = paid amount
      --------------------------------------------- */

      const paymentUpdate = {
        status: "paid",

        adminStatus: "approved",

        verificationStatus: "verified",

        onboardingStatus: "completed",

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

        verifiedAt: serverTimestamp(),

        approvedAt: serverTimestamp(),

        updatedAt: serverTimestamp(),
      };

      await updateDoc(
        doc(db, "referrals", referralId),
        paymentUpdate
      );

      /* ---------------------------------------------
         SAVE PROVIDER IN SEPARATE COLLECTION
         
         Firestore:
         verifiedProviders/{referralId}
      --------------------------------------------- */

      await saveVerifiedProvider(
        amount,
        paymentProofUrl,
        filePath
      );

      /* ---------------------------------------------
         UPDATE SCREEN IMMEDIATELY
      --------------------------------------------- */

      setReferral((previous) => ({
        ...previous,

        status: "paid",

        adminStatus: "approved",

        verificationStatus: "verified",

        onboardingStatus: "completed",

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

      setPaymentAmount(
        String(amount)
      );

      setSuccess(
        "Payment completed. Provider saved in verifiedProviders successfully."
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

  /* =====================================================
     LOADING STATE
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

  /* =====================================================
     ERROR STATE
  ===================================================== */

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

  /* =====================================================
     STATUS FLAGS
  ===================================================== */

  const currentStatus =
    String(
      referral.status || ""
    ).toLowerCase();

  const paymentStatus =
    String(
      referral.paymentStatus || ""
    ).toLowerCase();

  const isRejected =
    currentStatus === "rejected";

  const isPaid =
    currentStatus === "paid" ||
    currentStatus === "successful" ||
    paymentStatus === "completed";

  const isAccepted =
    currentStatus === "accepted";

  const reward =
    getReferralReward(referral);

  /* =====================================================
     UI
  ===================================================== */

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

          <h1>
            Referral Details
          </h1>

          <p>
            Referral ID:{" "}
            <strong>
              {referral.id}
            </strong>
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
        {/* =================================================
            REFERRER DETAILS
        ================================================= */}

        <section className="detail-card">
          <div className="card-label">
            REFERRER DETAILS
          </div>

          <h2>
            {referral.referrerName || "—"}
          </h2>

          <DetailRow
            label="Referrer ID"
            value={
              referral.referrerId
            }
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
            value={
              referral.upiNumber
            }
          />

          <DetailRow
            label="Referral Submitted"
            value={
              formatDate(
                referral.createdAt
              )
            }
          />
        </section>

        {/* =================================================
            PROVIDER DETAILS
        ================================================= */}

        <section className="detail-card">
          <div className="card-label">
            PROVIDER DETAILS
          </div>

          <h2>
            {referral.providerName || "—"}
          </h2>

          <DetailRow
            label="Provider ID"
            value={
              referral.providerId
            }
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
            value={
              referral.address
            }
          />
        </section>

        {/* =================================================
            REFERRAL STATUS
        ================================================= */}

        <section className="detail-card">
          <div className="card-label">
            REFERRAL STATUS
          </div>

          <DetailRow
            label="Current Status"
            value={
              <StatusBadge
                value={
                  referral.status
                }
              />
            }
          />

          <DetailRow
            label="Admin Status"
            value={
              <StatusBadge
                value={
                  referral.adminStatus
                }
              />
            }
          />

          <DetailRow
            label="Verification Status"
            value={
              <StatusBadge
                value={
                  referral.verificationStatus
                }
              />
            }
          />

          <DetailRow
            label="Onboarding Status"
            value={
              <StatusBadge
                value={
                  referral.onboardingStatus
                }
              />
            }
          />

          <DetailRow
            label="Reward Status"
            value={
              <StatusBadge
                value={
                  referral.rewardStatus
                }
              />
            }
          />

          <DetailRow
            label="Payment Status"
            value={
              <StatusBadge
                value={
                  referral.paymentStatus
                }
              />
            }
          />

          <DetailRow
            label="Reward Amount"
            value={
              formatCurrency(reward)
            }
          />

          <DetailRow
            label="Accepted At"
            value={
              formatDate(
                referral.acceptedAt
              )
            }
          />

          <DetailRow
            label="Verified At"
            value={
              formatDate(
                referral.verifiedAt
              )
            }
          />

          <DetailRow
            label="Paid At"
            value={
              formatDate(
                referral.paidAt
              )
            }
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
                  href={
                    referral.paymentProofUrl
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  View Payment Proof
                </a>
              </div>
            )}
        </section>
      </div>

      {/* =================================================
          ADMIN ACTIONS
      ================================================= */}

      {!isRejected && !isPaid && (
        <section className="admin-actions">
          <h2>
            Admin Action
          </h2>

          {!isAccepted && (
            <div className="action-buttons">
              <button
                className="approve-action"
                disabled={
                  actionLoading
                }
                onClick={
                  acceptReferral
                }
              >
                {actionLoading
                  ? "Processing..."
                  : "Accept Referral"}
              </button>

              <button
                className="danger-action"
                disabled={
                  actionLoading
                }
                onClick={
                  openRejectBox
                }
              >
                Reject Referral
              </button>
            </div>
          )}

          {isAccepted &&
            !showPaymentBox && (
              <button
                className="approve-action"
                disabled={
                  actionLoading
                }
                onClick={
                  openPaymentBox
                }
              >
                Complete Payment
              </button>
            )}

          {/* =================================================
              REJECTION BOX
          ================================================= */}

          {showRejectBox && (
            <div className="action-box rejection-box">
              <h3>
                Reject Referral
              </h3>

              <p>
                Enter the reason why this
                referral is being rejected.
              </p>

              <textarea
                value={
                  rejectReason
                }
                onChange={(event) =>
                  setRejectReason(
                    event.target.value
                  )
                }
                placeholder="Enter rejection reason..."
                rows={5}
                disabled={
                  actionLoading
                }
              />

              <div className="action-buttons">
                <button
                  className="danger-action"
                  disabled={
                    actionLoading
                  }
                  onClick={
                    rejectReferral
                  }
                >
                  {actionLoading
                    ? "Rejecting..."
                    : "Confirm Rejection"}
                </button>

                <button
                  className="secondary-action"
                  disabled={
                    actionLoading
                  }
                  onClick={() =>
                    setShowRejectBox(
                      false
                    )
                  }
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* =================================================
              PAYMENT BOX
          ================================================= */}

          {(isAccepted ||
            showPaymentBox) && (
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
                  value={
                    paymentAmount
                  }
                  onChange={(event) =>
                    setPaymentAmount(
                      event.target.value
                    )
                  }
                  disabled={
                    actionLoading
                  }
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
                  disabled={
                    actionLoading
                  }
                />
              </div>

              {paymentPreview && (
                <div className="payment-proof-preview">
                  <h3>
                    Selected Proof
                  </h3>

                  <img
                    src={
                      paymentPreview
                    }
                    alt="Selected payment proof"
                  />
                </div>
              )}

              <div className="action-buttons">
                <button
                  className="approve-action"
                  disabled={
                    actionLoading
                  }
                  onClick={
                    completePayment
                  }
                >
                  {actionLoading
                    ? "Uploading..."
                    : "Confirm Payment"}
                </button>

                <button
                  className="secondary-action"
                  disabled={
                    actionLoading
                  }
                  onClick={() =>
                    setShowPaymentBox(
                      false
                    )
                  }
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* =================================================
          PAYMENT COMPLETED MESSAGE
      ================================================= */}

      {isPaid && (
        <section className="payment-success-message">
          <strong>
            ✓ Payment Completed
          </strong>

          <p>
            Reward paid:{" "}
            <strong>
              {formatCurrency(
                reward
              )}
            </strong>
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
              href={
                referral.paymentProofUrl
              }
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