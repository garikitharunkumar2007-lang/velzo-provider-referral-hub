// src/pages/Earnings.jsx

import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  collection,
  onSnapshot,
  query,
} from "firebase/firestore";

import { db } from "../firebase/firebaseConfig";

import "./Earnings.css";

/* =====================================================
   READ CURRENT VELZO USER
===================================================== */

function getStoredUser() {
  const storageKeys = [
    "velzoUser",
    "currentUser",
    "user",
  ];

  for (const key of storageKeys) {
    try {
      const localValue =
        localStorage.getItem(key);

      if (localValue) {
        const parsedValue =
          JSON.parse(localValue);

        if (
          parsedValue &&
          typeof parsedValue === "object"
        ) {
          return parsedValue;
        }
      }
    } catch (error) {
      console.warn(
        `Unable to read localStorage key: ${key}`,
        error
      );
    }

    try {
      const sessionValue =
        sessionStorage.getItem(key);

      if (sessionValue) {
        const parsedValue =
          JSON.parse(sessionValue);

        if (
          parsedValue &&
          typeof parsedValue === "object"
        ) {
          return parsedValue;
        }
      }
    } catch (error) {
      console.warn(
        `Unable to read sessionStorage key: ${key}`,
        error
      );
    }
  }

  return {};
}

/* =====================================================
   NORMALIZE VALUE
===================================================== */

function normalizeValue(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[-_\s]/g, "");
}

/* =====================================================
   NORMALIZE PHONE
===================================================== */

function normalizePhone(value) {
  const digits = String(value ?? "")
    .replace(/\D/g, "");

  if (digits.length > 10) {
    return digits.slice(-10);
  }

  return digits;
}

/* =====================================================
   GET CURRENT USER IDENTITIES
===================================================== */

function getCurrentUserIdentities() {
  const storedUser = getStoredUser();

  const values = [
    storedUser.uid,
    storedUser.id,
    storedUser.userId,
    storedUser.referrerId,
    storedUser.referrerUid,
    storedUser.phone,
    storedUser.phoneNumber,
    storedUser.mobile,
    storedUser.mobileNumber,
    storedUser.email,
  ];

  const identities = [];

  values.forEach((value) => {
    if (
      value !== undefined &&
      value !== null &&
      String(value).trim() !== ""
    ) {
      identities.push(
        normalizeValue(value)
      );

      const phone =
        normalizePhone(value);

      if (phone) {
        identities.push(
          normalizeValue(phone)
        );
      }
    }
  });

  return [...new Set(identities)];
}

/* =====================================================
   GET REFERRAL OWNER IDENTITIES
===================================================== */

function getReferralOwnerIdentities(
  referral
) {
  const values = [
    referral.referrerId,
    referral.referrerUid,
    referral.referrerUserId,

    referral.referredBy,
    referral.referredById,
    referral.referredByUid,

    referral.createdBy,
    referral.createdById,
    referral.createdByUid,

    referral.ownerId,
    referral.ownerUid,

    referral.userId,
    referral.uid,

    referral.referrerPhone,
    referral.referrerPhoneNumber,
    referral.referrerMobile,

    referral.userPhone,
    referral.userPhoneNumber,
    referral.userMobile,

    referral.email,
    referral.referrerEmail,
  ];

  const identities = [];

  values.forEach((value) => {
    if (
      value !== undefined &&
      value !== null &&
      String(value).trim() !== ""
    ) {
      identities.push(
        normalizeValue(value)
      );

      const phone =
        normalizePhone(value);

      if (phone) {
        identities.push(
          normalizeValue(phone)
        );
      }
    }
  });

  return [...new Set(identities)];
}

/* =====================================================
   CHECK ONE USER ONLY
===================================================== */

function belongsToCurrentUser(
  referral,
  currentUserIdentities
) {
  if (
    !referral ||
    currentUserIdentities.length === 0
  ) {
    return false;
  }

  const ownerIdentities =
    getReferralOwnerIdentities(referral);

  return ownerIdentities.some((ownerId) =>
    currentUserIdentities.includes(ownerId)
  );
}

/* =====================================================
   NORMALIZE STATUS
===================================================== */

function normalizeStatus(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

/* =====================================================
   GET REWARD AMOUNT

   IMPORTANT:
   reward = 3 is supported.
===================================================== */

function getReferralReward(referral) {
  const possibleValues = [
    referral.reward,
    referral.rewardAmount,
    referral.rewardEarned,
    referral.referralReward,
    referral.paymentAmount,
    referral.earnings,
    referral.amount,
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
          .trim()
      );

      if (
        Number.isFinite(numericValue) &&
        numericValue > 0
      ) {
        return numericValue;
      }
    }
  }

  return 0;
}

/* =====================================================
   CHECK REJECTED REFERRAL
===================================================== */

function isRejectedReferral(referral) {
  const statuses = [
    referral.status,
    referral.referralStatus,
    referral.paymentStatus,
    referral.rewardStatus,
    referral.adminStatus,
  ].map(normalizeStatus);

  const rejectedStatuses = [
    "rejected",
    "declined",
    "failed",
    "cancelled",
    "canceled",
    "duplicate",
    "already_exists",
    "provider_exists",
    "not_eligible",
  ];

  return statuses.some((status) =>
    rejectedStatuses.includes(status)
  );
}

/* =====================================================
   CHECK SUCCESSFUL / PAID REFERRAL
===================================================== */

function isEarnedReferral(referral) {
  if (!referral) {
    return false;
  }

  if (isRejectedReferral(referral)) {
    return false;
  }

  const reward =
    getReferralReward(referral);

  if (reward <= 0) {
    return false;
  }

  const status = normalizeStatus(
    referral.status
  );

  const referralStatus =
    normalizeStatus(
      referral.referralStatus
    );

  const paymentStatus =
    normalizeStatus(
      referral.paymentStatus
    );

  const rewardStatus =
    normalizeStatus(
      referral.rewardStatus
    );

  const adminStatus =
    normalizeStatus(
      referral.adminStatus
    );

  const paymentCompleted =
    paymentStatus === "paid" ||
    paymentStatus === "completed" ||
    paymentStatus === "complete" ||
    paymentStatus === "successful" ||
    paymentStatus === "success";

  const rewardPaid =
    rewardStatus === "paid" ||
    rewardStatus === "earned" ||
    rewardStatus === "completed" ||
    rewardStatus === "successful";

  const referralPaid =
    status === "paid" ||
    status === "successful" ||
    status === "success" ||
    status === "completed" ||
    status === "payment_completed" ||
    referralStatus === "paid" ||
    referralStatus === "successful" ||
    referralStatus === "completed";

  const adminApproved =
    adminStatus === "approved" ||
    adminStatus === "accepted" ||
    adminStatus === "successful" ||
    adminStatus === "paid";

  return Boolean(
    paymentCompleted ||
      rewardPaid ||
      referralPaid ||
      adminApproved
  );
}

/* =====================================================
   CONVERT FIREBASE DATE
===================================================== */

function getDateValue(value) {
  if (!value) {
    return null;
  }

  try {
    if (
      typeof value.toDate === "function"
    ) {
      return value.toDate();
    }

    if (
      typeof value === "object" &&
      typeof value.seconds === "number"
    ) {
      return new Date(
        value.seconds * 1000
      );
    }

    if (value instanceof Date) {
      return value;
    }

    if (typeof value === "number") {
      return new Date(value);
    }

    if (typeof value === "string") {
      const date = new Date(value);

      return Number.isNaN(date.getTime())
        ? null
        : date;
    }

    return null;
  } catch (error) {
    console.error(
      "Date conversion error:",
      error
    );

    return null;
  }
}

/* =====================================================
   GET REFERRAL DATE
===================================================== */

function getReferralDate(referral) {
  return (
    referral.paidAt ||
    referral.rewardPaidAt ||
    referral.paymentCompletedAt ||
    referral.updatedAt ||
    referral.createdAt ||
    referral.submittedAt ||
    null
  );
}

/* =====================================================
   SORT DATE
===================================================== */

function getCreatedTime(referral) {
  const date = getDateValue(
    getReferralDate(referral)
  );

  return date
    ? date.getTime()
    : 0;
}

/* =====================================================
   FORMAT DATE
===================================================== */

function formatDate(value) {
  const date =
    getDateValue(value);

  if (!date) {
    return "—";
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/* =====================================================
   GET PROVIDER NAME
===================================================== */

function getProviderName(referral) {
  return (
    referral.providerName ||
    referral.referredProviderName ||
    referral.providerFullName ||
    referral.provider?.name ||
    referral.provider?.fullName ||
    referral.referredProvider?.name ||
    referral.referredProvider?.fullName ||
    referral.providerDetails?.name ||
    referral.providerDetails?.fullName ||
    referral.serviceProviderName ||
    referral.name ||
    referral.fullName ||
    "Provider"
  );
}

/* =====================================================
   GET PROVIDER PHONE
===================================================== */

function getProviderPhone(referral) {
  return (
    referral.providerPhone ||
    referral.providerPhoneNumber ||
    referral.referredProviderPhone ||
    referral.referredProviderMobile ||
    referral.provider?.phone ||
    referral.provider?.phoneNumber ||
    referral.provider?.mobile ||
    referral.phone ||
    referral.phoneNumber ||
    referral.mobile ||
    referral.mobileNumber ||
    "—"
  );
}

/* =====================================================
   GET UNION / LABOUR ID
===================================================== */

function getUnionId(referral) {
  return (
    referral.providerUnionId ||
    referral.providerUnionID ||
    referral.referredProviderUnionId ||
    referral.referredProviderUnionID ||
    referral.unionId ||
    referral.unionID ||
    referral.labourId ||
    referral.labourID ||
    referral.unionLabourId ||
    referral.unionLabourID ||
    referral.provider?.unionId ||
    referral.provider?.unionID ||
    "Not provided"
  );
}

/* =====================================================
   EARNINGS COMPONENT
===================================================== */

export default function Earnings() {
  const [
    referrals,
    setReferrals,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  useEffect(() => {
    const currentUserIdentities =
      getCurrentUserIdentities();

    if (
      currentUserIdentities.length === 0
    ) {
      setReferrals([]);
      setLoading(false);
      setErrorMessage("");
      return;
    }

    setLoading(true);
    setErrorMessage("");

    /*
     * Read the referrals collection.
     *
     * Data is filtered below for the current
     * Velzo user only.
     */
    const referralsQuery = query(
      collection(db, "referrals")
    );

    const unsubscribe =
      onSnapshot(
        referralsQuery,
        (snapshot) => {
          try {
            const allReferrals =
              snapshot.docs.map(
                (documentSnapshot) => ({
                  id: documentSnapshot.id,
                  ...documentSnapshot.data(),
                })
              );

            /*
             * STEP 1:
             * Keep only the current user's referrals.
             */
            const currentUserReferrals =
              allReferrals.filter(
                (referral) =>
                  belongsToCurrentUser(
                    referral,
                    currentUserIdentities
                  )
              );

            /*
             * STEP 2:
             * Keep only paid/earned referrals.
             */
            const earnedReferrals =
              currentUserReferrals
                .filter((referral) =>
                  isEarnedReferral(referral)
                )
                .sort(
                  (firstReferral, secondReferral) =>
                    getCreatedTime(
                      secondReferral
                    ) -
                    getCreatedTime(
                      firstReferral
                    )
                );

            setReferrals(
              earnedReferrals
            );

            setLoading(false);
            setErrorMessage("");
          } catch (error) {
            console.error(
              "Error processing earnings:",
              error
            );

            setReferrals([]);
            setLoading(false);
            setErrorMessage(
              "Unable to process earnings data."
            );
          }
        },
        (error) => {
          console.error(
            "Error loading earnings:",
            error
          );

          setReferrals([]);
          setLoading(false);
          setErrorMessage(
            "Unable to load earnings data. Please try again."
          );
        }
      );

    return () => {
      unsubscribe();
    };
  }, []);

  /* =====================================================
     TOTAL EARNED
  ===================================================== */

  const totalEarned = useMemo(() => {
    return referrals.reduce(
      (total, referral) =>
        total +
        getReferralReward(referral),
      0
    );
  }, [referrals]);

  /* =====================================================
     ₹4 REFERRALS
  ===================================================== */

  const fourRupee = useMemo(() => {
    return referrals.filter(
      (referral) =>
        getReferralReward(referral) === 4
    ).length;
  }, [referrals]);

  /* =====================================================
     ₹3 REFERRALS
  ===================================================== */

  const threeRupee = useMemo(() => {
    return referrals.filter(
      (referral) =>
        getReferralReward(referral) === 3
    ).length;
  }, [referrals]);

  return (
    <div className="earnings-page">
      {/* =================================================
          PAGE HEADING
      ================================================= */}

      <div className="page-heading">
        <p className="eyebrow">
          VELZO
        </p>

        <h1>
          Earnings
        </h1>

        <p>
          Your rewards from successful provider referrals.
        </p>
      </div>

      {/* =================================================
          ERROR MESSAGE
      ================================================= */}

      {errorMessage && (
        <div className="empty-state error-state">
          {errorMessage}
        </div>
      )}

      {/* =================================================
          TOTAL EARNED
      ================================================= */}

      <div className="earnings-hero">
        <span>
          TOTAL EARNED
        </span>

        <strong>
          ₹{totalEarned.toLocaleString("en-IN")}
        </strong>

        <small>
          From {referrals.length} successful referral
          {referrals.length !== 1
            ? "s"
            : ""}
        </small>
      </div>

      {/* =================================================
          SUMMARY CARDS
      ================================================= */}

      <div className="earnings-grid">
        <div className="earning-card">
          <span>
            ₹4 REFERRALS
          </span>

          <strong>
            {fourRupee}
          </strong>

          <small>
            With Union / Labour ID
          </small>
        </div>

        <div className="earning-card">
          <span>
            ₹3 REFERRALS
          </span>

          <strong>
            {threeRupee}
          </strong>

          <small>
            Without Union / Labour ID
          </small>
        </div>

        <div className="earning-card">
          <span>
            SUCCESSFUL
          </span>

          <strong>
            {referrals.length}
          </strong>

          <small>
            Paid referrals
          </small>
        </div>
      </div>

      {/* =================================================
          REWARD HISTORY
      ================================================= */}

      <div className="earnings-list">
        <h2>
          Reward History
        </h2>

        {loading ? (
          <p>
            Loading earnings...
          </p>
        ) : referrals.length === 0 ? (
          <p>
            No earned rewards yet.
          </p>
        ) : (
          referrals.map((referral) => {
            const reward =
              getReferralReward(referral);

            return (
              <div
                className="earning-row"
                key={referral.id}
              >
                <div>
                  <strong>
                    {getProviderName(
                      referral
                    )}
                  </strong>

                  <span>
                    Successful referral
                  </span>

                  <small>
                    Phone:{" "}
                    {getProviderPhone(
                      referral
                    )}
                  </small>

                  <small>
                    Union / Labour ID:{" "}
                    {getUnionId(
                      referral
                    )}
                  </small>

                  <small>
                    Date:{" "}
                    {formatDate(
                      getReferralDate(
                        referral
                      )
                    )}
                  </small>
                </div>

                <strong>
                  +₹{reward.toLocaleString("en-IN")}
                </strong>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}