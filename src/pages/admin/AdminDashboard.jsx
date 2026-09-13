import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import LoadingState from "../../components/LoadingState";
import EmptyState from "../../components/EmptyState";

import { getCollection } from "../../firebase/firestoreConverters";

import "./AdminDashboard.css";

export default function AdminDashboard() {
  const [referrals, setReferrals] = useState([]);
  const [payments, setPayments] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadReferralDashboard() {
      try {
        setLoading(true);
        setError("");

        const [referralRecords, paymentRecords] =
          await Promise.all([
            getCollection("referrals"),
            getCollection("payments"),
          ]);

        if (!mounted) return;

        setReferrals(
          Array.isArray(referralRecords)
            ? referralRecords
            : []
        );

        setPayments(
          Array.isArray(paymentRecords)
            ? paymentRecords
            : []
        );
      } catch (err) {
        console.error(
          "Failed to load referral dashboard:",
          err
        );

        if (mounted) {
          setError(
            "Unable to load referral dashboard statistics."
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadReferralDashboard();

    return () => {
      mounted = false;
    };
  }, []);

  const dashboardStats = useMemo(() => {
    const getStatus = (record) =>
      String(
        record?.status ||
          record?.referralStatus ||
          record?.paymentStatus ||
          ""
      )
        .trim()
        .toLowerCase()
        .replace(/[\s_]+/g, "-");

    const getAmount = (record) => {
      const amount =
        record?.amount ??
        record?.rewardAmount ??
        record?.commission ??
        record?.earning ??
        record?.referralAmount ??
        record?.totalAmount ??
        0;

      const numericAmount = Number(amount);

      return Number.isFinite(numericAmount)
        ? numericAmount
        : 0;
    };

    const pendingReferrals = referrals.filter((referral) =>
      [
        "pending",
        "submitted",
        "under-review",
        "waiting",
      ].includes(getStatus(referral))
    );

    const approvedReferrals = referrals.filter((referral) =>
      [
        "approved",
        "accepted",
        "verified",
        "confirmed",
      ].includes(getStatus(referral))
    );

    const completedReferrals = referrals.filter((referral) =>
      [
        "completed",
        "success",
        "successful",
        "converted",
        "provider-joined",
      ].includes(getStatus(referral))
    );

    const paidPayments = payments.filter((payment) =>
      [
        "paid",
        "completed",
        "success",
        "successful",
        "done",
      ].includes(getStatus(payment))
    );

    const pendingPayments = payments.filter((payment) =>
      [
        "pending",
        "processing",
        "initiated",
        "waiting",
      ].includes(getStatus(payment))
    );

    const totalReferralEarnings = referrals.reduce(
      (total, referral) => total + getAmount(referral),
      0
    );

    const totalPaidAmount = paidPayments.reduce(
      (total, payment) => total + getAmount(payment),
      0
    );

    const totalPendingAmount = pendingPayments.reduce(
      (total, payment) => total + getAmount(payment),
      0
    );

    return {
      totalReferrals: referrals.length,
      pendingReferrals: pendingReferrals.length,
      approvedReferrals: approvedReferrals.length,
      completedReferrals: completedReferrals.length,
      totalPayments: payments.length,
      paidPayments: paidPayments.length,
      pendingPayments: pendingPayments.length,
      totalReferralEarnings,
      totalPaidAmount,
      totalPendingAmount,
    };
  }, [referrals, payments]);

  const formatCurrency = (amount) => {
    return `₹${Number(amount || 0).toLocaleString("en-IN")}`;
  };

  const statCards = [
    {
      title: "Total Referrals",
      value: dashboardStats.totalReferrals,
      subtitle: "All provider referrals",
      icon: "🤝",
      link: "/admin/referrals",
      className: "",
    },
    {
      title: "Pending Referrals",
      value: dashboardStats.pendingReferrals,
      subtitle: "Waiting for verification",
      icon: "⏳",
      link: "/admin/referrals",
      className: "",
    },
    {
      title: "Approved Referrals",
      value: dashboardStats.approvedReferrals,
      subtitle: "Verified referrals",
      icon: "✅",
      link: "/admin/referrals",
      className: "",
    },
    {
      title: "Completed Referrals",
      value: dashboardStats.completedReferrals,
      subtitle: "Successful provider referrals",
      icon: "🎉",
      link: "/admin/referrals",
      className: "",
    },
    {
      title: "Total Earnings",
      value: formatCurrency(
        dashboardStats.totalReferralEarnings
      ),
      subtitle: "Referral reward value",
      icon: "💰",
      link: "/admin/referrals",
      className: "admin-earnings-card",
    },
    {
      title: "Total Payments",
      value: dashboardStats.totalPayments,
      subtitle: "Referral payment records",
      icon: "💳",
      link: "/admin/payments",
      className: "",
    },
    {
      title: "Paid Rewards",
      value: formatCurrency(
        dashboardStats.totalPaidAmount
      ),
      subtitle: "Successfully paid referrals",
      icon: "🏦",
      link: "/admin/payments",
      className: "admin-earnings-card",
    },
    {
      title: "Pending Payments",
      value: formatCurrency(
        dashboardStats.totalPendingAmount
      ),
      subtitle: "Rewards waiting for payment",
      icon: "🕒",
      link: "/admin/payments",
      className: "admin-earnings-card",
    },
    {
      title: "Payment Records",
      value: dashboardStats.paidPayments,
      subtitle: "Completed payment transactions",
      icon: "🧾",
      link: "/admin/payments",
      className: "",
    },
  ];

  if (loading) {
    return (
      <LoadingState message="Loading referral dashboard..." />
    );
  }

  return (
    <section className="admin-dashboard-page">
      <div className="admin-dashboard-header">
        <div>
          <span className="admin-eyebrow">
            VELZO ADMIN
          </span>

          <h1>Referral Dashboard</h1>

          <p>
            Manage provider referrals, rewards and referral
            payments from one place.
          </p>
        </div>

        <Link
          to="/admin/referrals"
          className="admin-refresh-btn"
        >
          View Referrals
        </Link>
      </div>

      {error && (
        <div
          className="admin-alert admin-alert-danger"
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="admin-stat-grid">
        {statCards.map((card) => (
          <Link
            to={card.link}
            className={`admin-stat-card ${card.className}`}
            key={card.title}
          >
            <div className="admin-stat-icon">
              {card.icon}
            </div>

            <div className="admin-stat-content">
              <span>{card.title}</span>
              <strong>{card.value}</strong>
              <small>{card.subtitle}</small>
            </div>
          </Link>
        ))}
      </div>

      <section className="admin-section">
        <div className="admin-section-heading">
          <div>
            <h2>Quick Actions</h2>
            <p>
              Manage important referral operations.
            </p>
          </div>
        </div>

        <div className="admin-quick-grid">
          <Link
            to="/admin/referrals"
            className="admin-quick-card"
          >
            <span className="quick-icon">🤝</span>

            <div>
              <strong>Manage Referrals</strong>
              <p>
                Review and verify provider referrals.
              </p>
            </div>

            <span className="quick-arrow">→</span>
          </Link>

          <Link
            to="/admin/payments"
            className="admin-quick-card"
          >
            <span className="quick-icon">💳</span>

            <div>
              <strong>Manage Payments</strong>
              <p>
                Review rewards and payment records.
              </p>
            </div>

            <span className="quick-arrow">→</span>
          </Link>

          <Link
            to="/admin/complaints"
            className="admin-quick-card"
          >
            <span className="quick-icon">🛠️</span>

            <div>
              <strong>View Complaints</strong>
              <p>
                Check and resolve user complaints.
              </p>
            </div>

            <span className="quick-arrow">→</span>
          </Link>

          <Link
            to="/admin/notifications"
            className="admin-quick-card"
          >
            <span className="quick-icon">🔔</span>

            <div>
              <strong>Notifications</strong>
              <p>
                View system alerts and updates.
              </p>
            </div>

            <span className="quick-arrow">→</span>
          </Link>
        </div>
      </section>

      {referrals.length === 0 && payments.length === 0 && (
        <EmptyState
          title="No referral data yet"
          message="Referral statistics will appear here when users start referring service providers."
          icon="📊"
        />
      )}
    </section>
  );
}