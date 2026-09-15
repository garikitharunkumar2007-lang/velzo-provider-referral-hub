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
  where,
} from "firebase/firestore";

import {
  getAuth,
  onAuthStateChanged,
} from "firebase/auth";

import { db } from "../firebase/firebaseConfig";

import "./Earnings.css";

/* =====================================================
   NORMALIZE STATUS
===================================================== */

function normalizeStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[-_\s]+/g, "_");
}

/* =====================================================
   GET REWARD AMOUNT
===================================================== */

function getReferralReward(referral) {
  const rewardValues = [
    referral.reward,
    referral.rewardAmount,
    referral.rewardEarned,
    referral.referralReward,
    referral.paymentAmount,
  ];

  for (const value of rewardValues) {
    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      const amount = Number(value);

      if (
        Number.isFinite(amount) &&
        amount > 0
      ) {
        return amount;
      }
    }
  }

  return 0;
}

/* =====================================================
   CHECK PAID REFERRAL
===================================================== */

function isEarnedReferral(referral) {
  const reward = getReferralReward(referral);

  if (reward <= 0) {
    return false;
  }

  const status = normalizeStatus(
    referral.status
  );

  const rewardStatus = normalizeStatus(
    referral.rewardStatus
  );

  const paymentStatus = normalizeStatus(
    referral.paymentStatus
  );

  const rejected =
    status === "rejected" ||
    status === "declined" ||
    status === "cancelled" ||
    status === "canceled" ||
    rewardStatus === "rejected" ||
    paymentStatus === "failed" ||
    paymentStatus === "not_paid";

  if (rejected) {
    return false;
  }

  return (
    status === "paid" ||
    status === "successful" ||
    status === "success" ||
    status === "completed" ||
    status === "payment_completed" ||
    rewardStatus === "paid" ||
    rewardStatus === "earned" ||
    rewardStatus === "completed" ||
    paymentStatus === "paid" ||
    paymentStatus === "completed" ||
    paymentStatus === "complete"
  );
}

/* =====================================================
   CONVERT FIREBASE DATE
===================================================== */

function getDateValue(value) {
  if (!value) {
    return null;
  }

  if (
    typeof value.toDate === "function"
  ) {
    return value.toDate();
  }

  if (
    typeof value === "object" &&
    typeof value.seconds === "number"
  ) {
    return new Date(value.seconds * 1000);
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "string") {
    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? null
      : date;
  }

  if (typeof value === "number") {
    return new Date(value);
  }

  return null;
}

/* =====================================================
   GET REFERRAL DATE
===================================================== */

function getReferralDate(referral) {
  return (
    referral.paidAt ||
    referral.rewardPaidAt ||
    referral.updatedAt ||
    referral.createdAt ||
    referral.submittedAt ||
    null
  );
}

/* =====================================================
   SORT REFERRALS
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
  const date = getDateValue(value);

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
    referral.provider?.name ||
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
    referral.unionId ||
    referral.unionID ||
    referral.labourId ||
    referral.labourID ||
    referral.unionLabourId ||
    referral.unionLabourID ||
    "Not provided"
  );
}

/* =====================================================
   EARNINGS COMPONENT
===================================================== */

export default function Earnings() {
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const auth = getAuth();

    let unsubscribeReferrals = null;

    const unsubscribeAuth =
      onAuthStateChanged(
        auth,
        (user) => {
          if (unsubscribeReferrals) {
            unsubscribeReferrals();
            unsubscribeReferrals = null;
          }

          if (!user) {
            setReferrals([]);
            setLoading(false);
            setErrorMessage(
              "Please login to view your earnings."
            );
            return;
          }

          setLoading(true);
          setErrorMessage("");

          /*
           * IMPORTANT:
           * Only this logged-in user's referrals
           * are loaded from Firestore.
           */
          const earningsQuery = query(
            collection(db, "referrals"),
            where(
              "referrerId",
              "==",
              user.uid
            )
          );

          unsubscribeReferrals =
            onSnapshot(
              earningsQuery,
              (snapshot) => {
                try {
                  const earnedReferrals =
                    snapshot.docs
                      .map(
                        (documentSnapshot) => ({
                          id: documentSnapshot.id,
                          ...documentSnapshot.data(),
                        })
                      )
                      .filter(
                        (referral) =>
                          isEarnedReferral(
                            referral
                          )
                      )
                      .sort(
                        (
                          firstReferral,
                          secondReferral
                        ) =>
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
                  "Unable to load earnings data."
                );
              }
            );
        }
      );

    return () => {
      unsubscribeAuth();

      if (unsubscribeReferrals) {
        unsubscribeReferrals();
      }
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
          Your rewards from successful provider
          referrals.
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
          EARNINGS SUMMARY
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
          <div className="empty-state">
            <p>
              No earned rewards yet.
            </p>

            <small>
              Successful provider referral rewards
              will appear here.
            </small>
          </div>
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