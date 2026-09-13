import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import LoadingState from "../../components/LoadingState";

import {
  getCollection,
  updateDocument,
  deleteDocument,
} from "../../firebase/firestoreConverters";

import "./AdminNotifications.css";

/* =========================================================
   HELPERS
========================================================= */

function normalizeValue(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");
}

function formatDate(value) {
  if (!value) {
    return "Just now";
  }

  try {
    const date = value?.toDate
      ? value.toDate()
      : new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "Just now";
    }

    return date.toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "Just now";
  }
}

function getNotificationType(notification) {
  return normalizeValue(
    notification?.type ||
      notification?.notificationType ||
      "general"
  );
}

function getNotificationStatus(notification) {
  const status = normalizeValue(
    notification?.status ||
      notification?.readStatus ||
      ""
  );

  if (status === "read" || status === "seen") {
    return "read";
  }

  return "unread";
}

function getNotificationTypeLabel(notification) {
  const type = getNotificationType(notification);

  const labels = {
    "referral-submitted": "New Referral",
    "new-referral": "New Referral",
    "referral-pending": "Pending Referral",

    "referral-approved": "Referral Approved",
    "referral-accepted": "Referral Accepted",

    "referral-rejected": "Referral Rejected",

    "complaint-submitted": "New Complaint",
    "new-complaint": "New Complaint",
    "complaint-pending": "Pending Complaint",

    "payment-completed": "Payment Completed",
    "payment-paid": "Payment Paid",

    general: "General",
    announcement: "Announcement",
    alert: "Alert",
    update: "App Update",
  };

  return labels[type] || "Notification";
}

function getNotificationIcon(notification) {
  const type = getNotificationType(notification);

  if (
    type.includes("referral-submitted") ||
    type.includes("new-referral") ||
    type.includes("referral-pending")
  ) {
    return "🤝";
  }

  if (
    type.includes("complaint") ||
    type.includes("issue")
  ) {
    return "⚠️";
  }

  if (
    type.includes("payment") ||
    type.includes("paid")
  ) {
    return "💰";
  }

  if (
    type.includes("approved") ||
    type.includes("accepted") ||
    type.includes("success")
  ) {
    return "✅";
  }

  if (type.includes("rejected")) {
    return "❌";
  }

  if (
    type.includes("alert") ||
    type.includes("warning")
  ) {
    return "🚨";
  }

  if (type.includes("update")) {
    return "🔄";
  }

  return "🔔";
}

function getNotificationRoute(notification) {
  const type = getNotificationType(notification);

  const relatedId =
    notification?.relatedId ||
    notification?.referralId ||
    notification?.complaintId ||
    notification?.paymentId;

  const relatedCollection = normalizeValue(
    notification?.relatedCollection
  );

  if (!relatedId) {
    return "";
  }

  if (
    relatedCollection === "referrals" ||
    type.includes("referral")
  ) {
    return `/admin/referrals/${relatedId}`;
  }

  if (
    relatedCollection === "complaints" ||
    type.includes("complaint")
  ) {
    return `/admin/complaints/${relatedId}`;
  }

  if (
    relatedCollection === "payments" ||
    type.includes("payment")
  ) {
    return `/admin/payments/${relatedId}`;
  }

  return "";
}

/* =========================================================
   COMPONENT
========================================================= */

export default function AdminNotifications() {
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [selectedNotification, setSelectedNotification] =
    useState(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  /* =====================================================
     LOAD NOTIFICATIONS
  ===================================================== */

  async function loadNotifications() {
    try {
      setLoading(true);
      setError("");

      const records = await getCollection("notifications");

      const sortedRecords = [...(records || [])].sort(
        (first, second) => {
          const firstDate = first.createdAt?.toDate
            ? first.createdAt.toDate()
            : new Date(first.createdAt || 0);

          const secondDate = second.createdAt?.toDate
            ? second.createdAt.toDate()
            : new Date(second.createdAt || 0);

          return secondDate - firstDate;
        }
      );

      setNotifications(sortedRecords);
    } catch (err) {
      console.error(
        "Failed to load admin notifications:",
        err
      );

      setError(
        "Unable to load notifications. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNotifications();
  }, []);

  /* =====================================================
     MARK ONE AS READ
  ===================================================== */

  async function markAsRead(notification) {
    if (!notification?.id) {
      return;
    }

    if (
      getNotificationStatus(notification) === "read"
    ) {
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const readAt = new Date();

      await updateDocument(
        "notifications",
        notification.id,
        {
          status: "read",
          readStatus: "read",
          readAt,
        }
      );

      setNotifications((previous) =>
        previous.map((item) =>
          item.id === notification.id
            ? {
                ...item,
                status: "read",
                readStatus: "read",
                readAt,
              }
            : item
        )
      );
    } catch (err) {
      console.error(
        "Failed to mark notification as read:",
        err
      );

      setError(
        "Unable to update notification status."
      );
    } finally {
      setSaving(false);
    }
  }

  /* =====================================================
     MARK ALL AS READ
  ===================================================== */

  async function markAllAsRead() {
    const unreadNotifications = notifications.filter(
      (notification) =>
        getNotificationStatus(notification) === "unread"
    );

    if (unreadNotifications.length === 0) {
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const readAt = new Date();

      await Promise.all(
        unreadNotifications
          .filter((notification) => notification.id)
          .map((notification) =>
            updateDocument(
              "notifications",
              notification.id,
              {
                status: "read",
                readStatus: "read",
                readAt,
              }
            )
          )
      );

      setNotifications((previous) =>
        previous.map((notification) => ({
          ...notification,
          status: "read",
          readStatus: "read",
          readAt: notification.readAt || readAt,
        }))
      );

      setSuccess("All notifications marked as read.");
    } catch (err) {
      console.error(
        "Failed to mark all notifications as read:",
        err
      );

      setError(
        "Unable to mark all notifications as read."
      );
    } finally {
      setSaving(false);
    }
  }

  /* =====================================================
     DELETE NOTIFICATION
  ===================================================== */

  async function deleteNotification(notification) {
    if (!notification?.id) {
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to delete this notification?"
    );

    if (!confirmed) {
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      await deleteDocument(
        "notifications",
        notification.id
      );

      setNotifications((previous) =>
        previous.filter(
          (item) => item.id !== notification.id
        )
      );

      if (
        selectedNotification?.id === notification.id
      ) {
        setSelectedNotification(null);
      }

      setSuccess("Notification deleted successfully.");
    } catch (err) {
      console.error(
        "Failed to delete notification:",
        err
      );

      setError(
        "Unable to delete notification."
      );
    } finally {
      setSaving(false);
    }
  }

  /* =====================================================
     OPEN NOTIFICATION
  ===================================================== */

  async function openNotification(notification) {
    await markAsRead(notification);

    const route = getNotificationRoute(notification);

    if (route) {
      navigate(route);
      return;
    }

    setSelectedNotification(notification);
  }

  /* =====================================================
     FILTERS
  ===================================================== */

  const unreadCount = useMemo(() => {
    return notifications.filter(
      (notification) =>
        getNotificationStatus(notification) === "unread"
    ).length;
  }, [notifications]);

  const readCount = notifications.length - unreadCount;

  const filteredNotifications = useMemo(() => {
    const query = search.trim().toLowerCase();

    return notifications.filter((notification) => {
      const title = String(
        notification.title || ""
      ).toLowerCase();

      const message = String(
        notification.message || ""
      ).toLowerCase();

      const type = getNotificationType(notification);

      const matchesSearch =
        !query ||
        title.includes(query) ||
        message.includes(query) ||
        type.includes(query);

      const matchesType =
        typeFilter === "all" ||
        type === typeFilter;

      const matchesStatus =
        statusFilter === "all" ||
        getNotificationStatus(notification) ===
          statusFilter;

      return (
        matchesSearch &&
        matchesType &&
        matchesStatus
      );
    });
  }, [
    notifications,
    search,
    typeFilter,
    statusFilter,
  ]);

  /* =====================================================
     LOADING
  ===================================================== */

  if (loading) {
    return (
      <div className="admin-notifications-loading-page">
        <LoadingState message="Loading notifications..." />
      </div>
    );
  }

  /* =====================================================
     UI
  ===================================================== */

  return (
    <section className="admin-notifications-page">
      {/* HEADER */}

      <div className="admin-notifications-header">
        <div>
          <span className="admin-notifications-eyebrow">
            SYSTEM ALERTS
          </span>

          <h1>
            Notifications

            {unreadCount > 0 && (
              <span className="admin-notifications-count">
                {unreadCount}
              </span>
            )}
          </h1>

          <p>
            View new referrals, complaints, payments and
            other referral system alerts.
          </p>
        </div>

        <div className="admin-notifications-header-actions">
          <button
            type="button"
            className="admin-notifications-button secondary"
            onClick={loadNotifications}
            disabled={loading || saving}
          >
            ↻ Refresh
          </button>

          <button
            type="button"
            className="admin-notifications-button primary"
            onClick={markAllAsRead}
            disabled={saving || unreadCount === 0}
          >
            ✓ Mark All as Read
          </button>
        </div>
      </div>

      {/* ALERTS */}

      {error && (
        <div
          className="admin-notifications-alert error"
          role="alert"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          className="admin-notifications-alert success"
          role="status"
        >
          {success}
        </div>
      )}

      {/* STATS */}

      <div className="admin-notifications-stats">
        <div className="admin-notifications-stat-card">
          <span className="admin-notifications-stat-icon">
            🔔
          </span>

          <div>
            <span className="admin-notifications-stat-label">
              Total Notifications
            </span>

            <strong>{notifications.length}</strong>
          </div>
        </div>

        <div className="admin-notifications-stat-card unread">
          <span className="admin-notifications-stat-icon">
            📩
          </span>

          <div>
            <span className="admin-notifications-stat-label">
              Unread
            </span>

            <strong>{unreadCount}</strong>
          </div>
        </div>

        <div className="admin-notifications-stat-card read">
          <span className="admin-notifications-stat-icon">
            ✓
          </span>

          <div>
            <span className="admin-notifications-stat-label">
              Read
            </span>

            <strong>{readCount}</strong>
          </div>
        </div>
      </div>

      {/* MAIN CARD */}

      <div className="admin-notifications-card">
        <div className="admin-notifications-card-header">
          <div>
            <h2>All Notifications</h2>

            <p>
              {filteredNotifications.length} notification
              {filteredNotifications.length !== 1
                ? "s"
                : ""}{" "}
              found
            </p>
          </div>
        </div>

        {/* FILTERS */}

        <div className="admin-notifications-filters">
          <div className="admin-notifications-search-wrapper">
            <span>⌕</span>

            <input
              type="search"
              className="admin-notifications-search"
              placeholder="Search notifications..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />
          </div>

          <select
            className="admin-notifications-select"
            value={typeFilter}
            onChange={(event) =>
              setTypeFilter(event.target.value)
            }
          >
            <option value="all">
              All Notification Types
            </option>

            <option value="referral-submitted">
              New Referrals
            </option>

            <option value="referral-approved">
              Approved Referrals
            </option>

            <option value="referral-rejected">
              Rejected Referrals
            </option>

            <option value="complaint-submitted">
              Complaints
            </option>

            <option value="payment-completed">
              Payments
            </option>

            <option value="general">
              General
            </option>
          </select>

          <select
            className="admin-notifications-select"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value)
            }
          >
            <option value="all">All Statuses</option>
            <option value="unread">Unread</option>
            <option value="read">Read</option>
          </select>
        </div>

        {/* LIST */}

        {filteredNotifications.length === 0 ? (
          <div className="admin-notifications-empty">
            <div className="admin-notifications-empty-icon">
              🔔
            </div>

            <h3>No notifications found</h3>

            <p>
              New referral and complaint alerts will appear
              here automatically.
            </p>

            {(search ||
              typeFilter !== "all" ||
              statusFilter !== "all") && (
              <button
                type="button"
                className="admin-notifications-button secondary"
                onClick={() => {
                  setSearch("");
                  setTypeFilter("all");
                  setStatusFilter("all");
                }}
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="admin-notifications-list">
            {filteredNotifications.map((notification) => {
              const status =
                getNotificationStatus(notification);

              const route =
                getNotificationRoute(notification);

              return (
                <article
                  key={notification.id}
                  className={`admin-notification-item ${
                    status === "unread"
                      ? "unread"
                      : "read"
                  }`}
                >
                  <div className="admin-notification-icon">
                    {getNotificationIcon(notification)}
                  </div>

                  <div className="admin-notification-content">
                    <div className="admin-notification-top">
                      <h3>
                        {notification.title ||
                          getNotificationTypeLabel(
                            notification
                          )}
                      </h3>

                      <span
                        className={`admin-notification-status ${status}`}
                      >
                        {status === "unread"
                          ? "Unread"
                          : "Read"}
                      </span>
                    </div>

                    <p className="admin-notification-message">
                      {notification.message ||
                        "You have a new notification."}
                    </p>

                    <div className="admin-notification-meta">
                      <span>
                        {getNotificationTypeLabel(
                          notification
                        )}
                      </span>

                      <span>
                        {formatDate(
                          notification.createdAt
                        )}
                      </span>
                    </div>

                    <div className="admin-notification-actions">
                      <button
                        type="button"
                        className="admin-notification-action primary"
                        onClick={() =>
                          openNotification(notification)
                        }
                        disabled={saving}
                      >
                        {route
                          ? "Open Details →"
                          : "View Notification"}
                      </button>

                      {status === "unread" && (
                        <button
                          type="button"
                          className="admin-notification-action"
                          onClick={() =>
                            markAsRead(notification)
                          }
                          disabled={saving}
                        >
                          Mark as Read
                        </button>
                      )}

                      <button
                        type="button"
                        className="admin-notification-action danger"
                        onClick={() =>
                          deleteNotification(notification)
                        }
                        disabled={saving}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* DETAIL MODAL */}

      {selectedNotification && (
        <div
          className="admin-notification-modal-backdrop"
          role="presentation"
          onClick={() =>
            setSelectedNotification(null)
          }
        >
          <div
            className="admin-notification-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="notification-modal-title"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="admin-notification-modal-header">
              <h2 id="notification-modal-title">
                {selectedNotification.title ||
                  "Notification"}
              </h2>

              <button
                type="button"
                className="admin-notification-modal-close"
                onClick={() =>
                  setSelectedNotification(null)
                }
                aria-label="Close notification"
              >
                ×
              </button>
            </div>

            <div className="admin-notification-modal-body">
              <p>
                {selectedNotification.message ||
                  "You have a new notification."}
              </p>

              <div className="admin-notification-modal-meta">
                <span>
                  Type:{" "}
                  {getNotificationTypeLabel(
                    selectedNotification
                  )}
                </span>

                <span>
                  Date:{" "}
                  {formatDate(
                    selectedNotification.createdAt
                  )}
                </span>
              </div>
            </div>

            <div className="admin-notification-modal-footer">
              <button
                type="button"
                className="admin-notifications-button secondary"
                onClick={() =>
                  setSelectedNotification(null)
                }
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}