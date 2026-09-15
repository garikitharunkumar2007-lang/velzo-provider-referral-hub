import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  collection,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";

import { db } from "../firebase/firebaseConfig";
import { useAuth } from "../hooks/useAuth";

import "./Dashboard.css";

/* =====================================================
   CONSTANTS
===================================================== */

const SUCCESS_STATUSES = [
  "verified",
  "successful",
  "approved",
  "accepted",
  "completed",
  "paid",
];

/* =====================================================
   HELPERS
===================================================== */

function normalizeStatus(value) {
  if (!value) {
    return "pending";
  }

  return String(value)
    .trim()
    .toLowerCase()
    .replaceAll("-", "_")
    .replaceAll(" ", "_");
}

function getTimestampDate(timestamp) {
  if (!timestamp) {
    return null;
  }

  if (
    typeof timestamp.toDate === "function"
  ) {
    return timestamp.toDate();
  }

  if (
    typeof timestamp === "object" &&
    timestamp.seconds
  ) {
    return new Date(
      timestamp.seconds * 1000
    );
  }

  const date = new Date(timestamp);

  return Number.isNaN(date.getTime())
    ? null
    : date;
}

function formatDateTime(timestamp) {
  const date =
    getTimestampDate(timestamp);

  if (!date) {
    return "—";
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function getStatusText(status) {
  switch (normalizeStatus(status)) {
    case "verified":
      return "Verified";

    case "successful":
      return "Successful";

    case "approved":
      return "Approved";

    case "accepted":
      return "Accepted";

    case "completed":
      return "Completed";

    case "paid":
      return "Paid";

    case "rejected":
      return "Rejected";

    case "under_review":
      return "Under Review";

    case "submitted":
      return "Submitted";

    case "verification_pending":
      return "Verification Pending";

    default:
      return "Pending";
  }
}

function getStatusClass(status) {
  const normalizedStatus =
    normalizeStatus(status);

  if (
    SUCCESS_STATUSES.includes(
      normalizedStatus
    )
  ) {
    return "status-badge status-success";
  }

  if (
    normalizedStatus === "rejected"
  ) {
    return "status-badge status-rejected";
  }

  return "status-badge status-pending";
}

function getStoredUser() {
  try {
    const localUser =
      localStorage.getItem("velzoUser");

    if (localUser) {
      return JSON.parse(localUser);
    }
  } catch (error) {
    console.warn(
      "Unable to read local user:",
      error
    );
  }

  try {
    const sessionUser =
      sessionStorage.getItem("velzoUser");

    if (sessionUser) {
      return JSON.parse(sessionUser);
    }
  } catch (error) {
    console.warn(
      "Unable to read session user:",
      error
    );
  }

  return {};
}

function normalizeIdentity(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function normalizePhone(value) {
  return String(value ?? "")
    .replace(/\D/g, "")
    .replace(/^91/, "")
    .replace(/^0/, "");
}

function hasSuccessfulPayment(referral) {
  const status = normalizeStatus(referral.status);
  const paymentStatus = normalizeStatus(referral.paymentStatus);
  const rewardStatus = normalizeStatus(referral.rewardStatus);

  return (
    status === "paid" ||
    status === "successful" ||
    status === "completed" ||
    paymentStatus === "paid" ||
    paymentStatus === "completed" ||
    rewardStatus === "paid"
  );
}

function getRewardAmount(referral) {
  const values = [
    referral.reward,
    referral.rewardAmount,
    referral.rewardEarned,
    referral.referralReward,
    referral.paymentAmount,
    referral.earnings,
    referral.amount,
  ];

  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") {
      const amount = Number(String(value).replace(/₹/g, "").replace(/,/g, ""));
      if (Number.isFinite(amount)) {
        return amount;
      }
    }
  }

  return 0;
}

/* =====================================================
   DASHBOARD
===================================================== */

function Dashboard() {
  const navigate = useNavigate();

  const {
    user,
    loading: authLoading,
  } = useAuth();

  const [darkMode, setDarkMode] =
    useState(true);

  const [referrals, setReferrals] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const storedUser = useMemo(
    () => getStoredUser(),
    []
  );

  /*
   * We use both useAuth() and localStorage
   * so the dashboard can open directly
   * from the mobile app referral link.
   */
  const currentUser = {
    ...storedUser,
    ...(user || {}),
  };

  const userId =
    currentUser.uid ||
    currentUser.id ||
    currentUser.userId ||
    "";

  const userIdentityValues = [
    currentUser.uid,
    currentUser.id,
    currentUser.userId,
    currentUser.email,
    currentUser.phoneNumber,
    currentUser.phone,
    currentUser.mobile,
  ].filter(Boolean);

  const userIdentitySet = new Set(
    userIdentityValues.map(normalizeIdentity)
  );

  const userPhoneSet = new Set(
    userIdentityValues
      .map(normalizePhone)
      .filter((value) => value.length >= 10)
  );

  const userName =
    currentUser.displayName ||
    currentUser.name ||
    currentUser.fullName ||
    currentUser.phoneNumber ||
    currentUser.phone ||
    currentUser.email?.split("@")[0] ||
    "VELZO User";

  const userInitial =
    String(userName)
      .trim()
      .charAt(0)
      .toUpperCase() || "V";

  /* ===================================================
     NAVIGATION
  =================================================== */

  function goTo(path) {
    if (!path) {
      return;
    }

    navigate(path);
  }

  /* ===================================================
     THEME
  =================================================== */

  useEffect(() => {
    document.documentElement.setAttribute(
      "data-theme",
      darkMode ? "dark" : "light"
    );
  }, [darkMode]);

  /* ===================================================
     LOAD REFERRALS
  =================================================== */

  useEffect(() => {
    /*
     * Do not redirect to login here.
     *
     * Normal users can open the dashboard
     * directly from the mobile app.
     */

    setLoading(true);
    setError("");

    let referralsQuery;

    try {
      referralsQuery = query(
        collection(db, "referrals"),
        orderBy("createdAt", "desc")
      );
    } catch (queryError) {
      console.error(
        "Failed to prepare referrals query:",
        queryError
      );

      setError(
        "Unable to prepare referral data."
      );

      setLoading(false);

      return undefined;
    }

    const unsubscribe = onSnapshot(
      referralsQuery,
      (snapshot) => {
        const referralList =
          snapshot.docs
            .map((documentSnapshot) => {
              const data =
                documentSnapshot.data() || {};

              const provider =
                data.provider || {};

              const referrer =
                data.referrer || {};

              const providerName =
                data.providerName ||
                data.fullName ||
                data.name ||
                provider.fullName ||
                provider.name ||
                provider.displayName ||
                "Unknown Provider";

              const phone =
                data.phone ||
                data.phoneNumber ||
                provider.phone ||
                provider.phoneNumber ||
                "—";

              const unionId =
                data.unionId ||
                data.labourId ||
                data.laborId ||
                data.unionNumber ||
                provider.unionId ||
                provider.labourId ||
                provider.laborId ||
                "—";

              const address =
                data.address ||
                provider.address ||
                "—";

              const referrerId =
                data.referrerId ||
                data.referredBy ||
                data.referrerUid ||
                referrer.id ||
                referrer.uid ||
                "";

              const referrerName =
                data.referrerName ||
                referrer.name ||
                referrer.fullName ||
                "Unknown Referrer";

              const referrerPhone =
                data.referrerPhone ||
                data.referrerMobile ||
                data.referrerPhoneNumber ||
                referrer.phone ||
                referrer.phoneNumber ||
                "";

              const paymentStatus =
                normalizeStatus(
                  data.paymentStatus ||
                    "not_paid"
                );

              const status =
                hasSuccessfulPayment({
                  ...data,
                  paymentStatus,
                })
                  ? "paid"
                  : normalizeStatus(
                      data.status ||
                        data.verificationStatus ||
                        data.rewardStatus ||
                        "pending"
                    );

              const reward =
                getRewardAmount(data);

              return {
                id: documentSnapshot.id,

                referrerId,

                referrerName,

                referrerPhone,

                providerName,

                phone,

                unionId,

                address,

                status,

                createdAt:
                  data.createdAt || null,

                reward,

                paymentStatus,

                paymentProofUrl:
                  data.paymentProofUrl ||
                  data.paymentProof ||
                  "",

                rejectionReason:
                  data.rejectionReason ||
                  data.rejectionMessage ||
                  "",
              };
            })
            .filter((referral) => {
              /*
               * If a user ID is available,
               * show only that user's referrals.
               *
               * If the mobile app has not supplied
               * an ID yet, keep the data visible
               * instead of redirecting to login.
               */
              if (userIdentitySet.size === 0) {
                return true;
              }

              const referralIdentityValues = [
                referral.referrerId,
                referral.referrerPhone,
              ].filter(Boolean);

              if (referralIdentityValues.length === 0) {
                return true;
              }

              const idMatch = referralIdentityValues.some((value) =>
                userIdentitySet.has(normalizeIdentity(value))
              );

              const phoneMatch = referralIdentityValues.some((value) => {
                const normalized = normalizePhone(value);
                return normalized.length >= 10 && userPhoneSet.has(normalized);
              });

              return idMatch || phoneMatch;
            });

        setReferrals(referralList);
        setLoading(false);
      },
      (snapshotError) => {
        console.error(
          "Unable to load referrals:",
          snapshotError
        );

        if (
          snapshotError?.code ===
          "failed-precondition"
        ) {
          setError(
            "Firestore index is required. Please create the suggested index in Firebase Console."
          );
        } else if (
          snapshotError?.code ===
          "permission-denied"
        ) {
          setError(
            "Access denied. Please check Firestore security rules."
          );
        } else {
          setError(
            "Unable to load referral data."
          );
        }

        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [userId]);

  /* ===================================================
     STATISTICS
  =================================================== */

  const statistics = useMemo(() => {
    const totalReferrals =
      referrals.length;

    const pendingReferrals =
      referrals.filter((referral) =>
        [
          "pending",
          "submitted",
          "under_review",
          "verification_pending",
        ].includes(
          normalizeStatus(
            referral.status
          )
        )
      ).length;

    const successfulReferrals =
      referrals.filter((referral) =>
        hasSuccessfulPayment(referral)
      ).length;

    const rejectedReferrals =
      referrals.filter(
        (referral) =>
          normalizeStatus(
            referral.status
          ) === "rejected"
      ).length;

    const totalEarned =
      referrals.reduce(
        (total, referral) => {
          const status =
            normalizeStatus(
              referral.status
            );

          const paymentStatus =
            normalizeStatus(
              referral.paymentStatus
            );

          const isSuccessful =
            hasSuccessfulPayment(referral);

          if (isSuccessful) {
            return total + getRewardAmount(referral);
          }

          return total;
        },
        0
      );

    return {
      totalReferrals,
      pendingReferrals,
      successfulReferrals,
      rejectedReferrals,
      totalEarned,
    };
  }, [referrals]);

  /* ===================================================
     LOADING
  =================================================== */

  if (authLoading) {
    return (
      <div className="dashboard-loading-screen">
        <div className="loading-spinner">
          ⟳
        </div>

        <h3>
          Loading your dashboard...
        </h3>
      </div>
    );
  }

  /* ===================================================
     UI
  =================================================== */

  return (
    <div
      className={`dashboard-shell ${
        darkMode
          ? "dark-mode"
          : "light-mode"
      }`}
    >
      {/* =================================================
          SIDEBAR
      ================================================= */}

      <aside className="sidebar">
        {/* BRAND */}

        <div className="brand">
          <div className="brand-logo">
            <img
              src="/velzo-logo.png"
              alt="VELZO Logo"
            />
          </div>

          <div className="brand-text">
            <h2>VELZO</h2>

            <span>
              Provider Referral Hub
            </span>
          </div>
        </div>

        {/* MAIN NAVIGATION */}

        <nav
          className="sidebar-nav"
          aria-label="User navigation"
        >
          <button
            type="button"
            className="nav-item active"
            onClick={() =>
              goTo("/dashboard")
            }
          >
            <span className="nav-icon">
              ⌂
            </span>

            <span>
              Dashboard
            </span>
          </button>

          <button
            type="button"
            className="nav-item"
            onClick={() =>
              goTo("/refer-provider")
            }
          >
            <span className="nav-icon">
              ＋
            </span>

            <span>
              Refer Provider
            </span>
          </button>

          <button
            type="button"
            className="nav-item"
            onClick={() =>
              goTo("/referral-history")
            }
          >
            <span className="nav-icon">
              ▣
            </span>

            <span>
              Referral History
            </span>
          </button>

          <button
            type="button"
            className="nav-item"
            onClick={() =>
              goTo("/earnings")
            }
          >
            <span className="nav-icon">
              ₹
            </span>

            <span>
              Earnings
            </span>
          </button>

          <button
            type="button"
            className="nav-item"
            onClick={() =>
              goTo("/complaints")
            }
          >
            <span className="nav-icon">
              ⚠
            </span>

            <span>
              Complaint Box
            </span>
          </button>

          <button
            type="button"
            className="nav-item"
            onClick={() =>
              goTo("/notifications")
            }
          >
            <span className="nav-icon">
              🔔
            </span>

            <span>
              Notifications
            </span>
          </button>
        </nav>

        {/* SIDEBAR BOTTOM */}

        <div className="sidebar-bottom">
          {/* ADMIN LOGIN BUTTON */}

          <button
            type="button"
            className="nav-item admin-login-nav-item"
            onClick={() =>
              goTo("/admin/login")
            }
            title="Open Admin Login"
          >
            <span className="nav-icon">
              🔐
            </span>

            <span>
              Admin Login
            </span>
          </button>

          {/* PROFILE */}

          <button
            type="button"
            className="nav-item"
            onClick={() =>
              goTo("/profile")
            }
          >
            <span className="nav-icon">
              ⚙
            </span>

            <span>
              Profile Settings
            </span>
          </button>

          {/* FOOTER */}

          <div className="sidebar-footer">
            <strong>
              VELZO Referral Hub
            </strong>

            <span>
              v1.0
            </span>
          </div>
        </div>
      </aside>

      {/* =================================================
          MAIN CONTENT
      ================================================= */}

      <main className="main-content">
        {/* HEADER */}

        <header className="top-header">
          <div className="welcome">
            <span className="eyebrow">
              VELZO PROVIDER REFERRAL HUB
            </span>

            <h1>
              Welcome back, {userName} 👋
            </h1>

            <p>
              Track your referrals,
              complaints and earnings.
            </p>
          </div>

          <div className="header-actions">
            <button
              type="button"
              className="icon-button"
              onClick={() =>
                setDarkMode(
                  (previous) =>
                    !previous
                )
              }
              title="Toggle theme"
            >
              {darkMode ? "☀" : "☾"}
            </button>

            <button
              type="button"
              className="icon-button"
              onClick={() =>
                goTo("/notifications")
              }
              title="Notifications"
            >
              🔔
            </button>

            <button
              type="button"
              className="profile-button"
              onClick={() =>
                goTo("/profile")
              }
            >
              <div className="profile-avatar">
                {userInitial}
              </div>

              <div className="profile-info">
                <strong>
                  {userName}
                </strong>

                <span>
                  Referrer
                </span>
              </div>
            </button>
          </div>
        </header>

        <div className="dashboard-content">
          {/* HERO */}

          <section className="hero-card">
            <div className="hero-content">
              <span className="eyebrow">
                REFERRER PROGRAM
              </span>

              <h2>
                Help skilled providers
                <br />
                join VELZO.
              </h2>

              <p>
                Refer genuine local service
                providers and earn rewards
                after successful verification
                and onboarding.
              </p>

              <button
                type="button"
                className="primary-button"
                onClick={() =>
                  goTo("/refer-provider")
                }
              >
                ＋ Refer a Provider
              </button>
            </div>

            <div className="hero-decoration">
              <div className="hero-logo">
                V
              </div>
            </div>
          </section>

          {/* STATISTICS */}

          <section className="activity-section">
            <span className="eyebrow">
              YOUR ACTIVITY
            </span>

            <h2>
              Referral Overview
            </h2>

            <div className="stats-grid">
              <div className="stat-card">
                <span className="stat-icon">
                  🤝
                </span>

                <div>
                  <p>
                    Total Referrals
                  </p>

                  <h3>
                    {statistics.totalReferrals}
                  </h3>
                </div>
              </div>

              <div className="stat-card">
                <span className="stat-icon">
                  ⏳
                </span>

                <div>
                  <p>
                    Pending
                  </p>

                  <h3>
                    {statistics.pendingReferrals}
                  </h3>
                </div>
              </div>

              <div className="stat-card">
                <span className="stat-icon">
                  ✅
                </span>

                <div>
                  <p>
                    Successful
                  </p>

                  <h3>
                    {statistics.successfulReferrals}
                  </h3>
                </div>
              </div>

              <div className="stat-card">
                <span className="stat-icon">
                  ₹
                </span>

                <div>
                  <p>
                    Total Earned
                  </p>

                  <h3>
                    ₹
                    {statistics.totalEarned}
                  </h3>
                </div>
              </div>
            </div>
          </section>

          {/* ERROR */}

          {error && (
            <div
              className="dashboard-error"
              role="alert"
            >
              {error}
            </div>
          )}

          {/* REFERRALS */}

          <section className="referrals-section">
            <div className="section-heading">
              <div>
                <span className="eyebrow">
                  RECENT ACTIVITY
                </span>

                <h2>
                  Your Referrals
                </h2>
              </div>

              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  goTo("/referral-history")
                }
              >
                View All →
              </button>
            </div>

            {loading ? (
              <div className="empty-state">
                <div className="loading-spinner">
                  ⟳
                </div>

                <p>
                  Loading referrals...
                </p>
              </div>
            ) : referrals.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">
                  🤝
                </div>

                <h3>
                  No referrals yet
                </h3>

                <p>
                  Start referring service
                  providers to earn rewards.
                </p>

                <button
                  type="button"
                  className="primary-button"
                  onClick={() =>
                    goTo("/refer-provider")
                  }
                >
                  ＋ Refer a Provider
                </button>
              </div>
            ) : (
              <div className="referrals-container">
                {referrals
                  .slice(0, 6)
                  .map((referral) => (
                    <article
                      className="referral-card"
                      key={referral.id}
                    >
                      <div className="referral-card-top">
                        <div>
                          <h3>
                            {referral.providerName}
                          </h3>

                          <p>
                            {referral.phone}
                          </p>
                        </div>

                        <span
                          className={getStatusClass(
                            referral.status
                          )}
                        >
                          {getStatusText(
                            referral.status
                          )}
                        </span>
                      </div>

                      <div className="referral-details-grid">
                        <div>
                          <span>
                            Union / Labour ID
                          </span>

                          <strong>
                            {referral.unionId}
                          </strong>
                        </div>

                        <div>
                          <span>
                            Referred On
                          </span>

                          <strong>
                            {formatDateTime(
                              referral.createdAt
                            )}
                          </strong>
                        </div>

                        <div>
                          <span>
                            Reward
                          </span>

                          <strong>
                            ₹
                            {referral.reward}
                          </strong>
                        </div>
                      </div>

                      {referral.address !==
                        "—" && (
                        <p className="referral-address">
                          📍{" "}
                          {referral.address}
                        </p>
                      )}

                      {referral.rejectionReason && (
                        <p className="referral-rejection">
                          Reason:{" "}
                          {
                            referral.rejectionReason
                          }
                        </p>
                      )}
                    </article>
                  ))}
              </div>
            )}
          </section>

          {/* QUICK ACTIONS */}

          <section className="quick-actions">
            <button
              type="button"
              className="quick-action-card"
              onClick={() =>
                goTo("/refer-provider")
              }
            >
              <span className="quick-action-icon">
                ＋
              </span>

              <div>
                <h3>
                  Refer a Provider
                </h3>

                <p>
                  Add a new service provider
                </p>
              </div>

              <span className="arrow">
                →
              </span>
            </button>

            <button
              type="button"
              className="quick-action-card"
              onClick={() =>
                goTo("/earnings")
              }
            >
              <span className="quick-action-icon">
                ₹
              </span>

              <div>
                <h3>
                  View Earnings
                </h3>

                <p>
                  Track your referral rewards
                </p>
              </div>

              <span className="arrow">
                →
              </span>
            </button>
          </section>

          {/* REWARD PROGRAM */}

          <section className="program-card">
            <div className="program-header">
              <div>
                <span className="eyebrow">
                  REWARD PROGRAM
                </span>

                <h2>
                  Earn for every successful
                  provider
                </h2>
              </div>

              <div className="program-badge">
                VELZO
              </div>
            </div>

            <div className="reward-grid">
              <div className="reward-item">
                <div className="reward-amount">
                  ₹4
                </div>

                <div>
                  <strong>
                    With Union / Labour ID
                  </strong>

                  <p>
                    Earn after successful
                    verification and
                    onboarding.
                  </p>
                </div>
              </div>

              <div className="reward-item">
                <div className="reward-amount">
                  ₹3
                </div>

                <div>
                  <strong>
                    Without Union / Labour ID
                  </strong>

                  <p>
                    Earn after successful
                    verification and
                    onboarding.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

export default Dashboard;