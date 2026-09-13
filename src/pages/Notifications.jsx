import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import {
  getCollection,
  updateDocument,
} from "../firebase/firestoreConverters";
import "./Notifications.css";

const NOTIFICATIONS_COLLECTION = "notifications";

function getNotificationDate(notification) {
  const value =
    notification.createdAt ||
    notification.timestamp ||
    notification.date ||
    notification.updatedAt;

  if (!value) return null;

  if (typeof value?.toDate === "function") {
    return value.toDate();
  }

  if (value?.seconds) {
    return new Date(value.seconds * 1000);
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function formatNotificationDate(notification) {
  const date = getNotificationDate(notification);

  if (!date) {
    return "Recently";
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getNotificationType(notification) {
  const type = String(
    notification.type ||
      notification.category ||
      notification.notificationType ||
      "general"
  ).toLowerCase();

  if (
    type.includes("payment") ||
    type.includes("earning") ||
    type.includes("reward")
  ) {
    return "payment";
  }

  if (
    type.includes("referral") ||
    type.includes("provider") ||
    type.includes("verification")
  ) {
    return "referral";
  }

  if (
    type.includes("complaint") ||
    type.includes("support") ||
    type.includes("issue")
  ) {
    return "complaint";
  }

  if (
    type.includes("success") ||
    type.includes("approved") ||
    type.includes("accepted")
  ) {
    return "success";
  }

  if (
    type.includes("warning") ||
    type.includes("rejected") ||
    type.includes("failed")
  ) {
    return "warning";
  }

  return "general";
}

function getNotificationIcon(type) {
  switch (type) {
    case "payment":
      return "₹";

    case "referral":
      return "🤝";

    case "complaint":
      return "🛠️";

    case "success":
      return "✓";

    case "warning":
      return "!";

    default:
      return "🔔";
  }
}

function isNotificationForUser(notification, user) {
  if (!user) return false;

  const currentUserId = user.uid || user.id || "";
  const currentUserPhone =
    user.phoneNumber || user.phone || user.mobile || "";

  const notificationUserId =
    notification.userId ||
    notification.uid ||
    notification.recipientId ||
    notification.receiverId ||
    notification.createdFor;

  const notificationPhone =
    notification.phoneNumber ||
    notification.phone ||
    notification.mobile ||
    notification.recipientPhone;

  /*
   * If the notification has no receiver information,
   * do not display it to every user.
   */
  if (!notificationUserId && !notificationPhone) {
    return false;
  }

  if (
    notificationUserId &&
    currentUserId &&
    String(notificationUserId) === String(currentUserId)
  ) {
    return true;
  }

  if (
    notificationPhone &&
    currentUserPhone &&
    String(notificationPhone) === String(currentUserPhone)
  ) {
    return true;
  }

  return false;
}

function isRead(notification) {
  return (
    notification.read === true ||
    notification.isRead === true ||
    notification.status === "read"
  );
}

export default function Notifications() {
  const { user } = useAuth();

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [markingId, setMarkingId] = useState("");
  const [markingAll, setMarkingAll] = useState(false);

  const loadNotifications = async () => {
    if (!user) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await getCollection(NOTIFICATIONS_COLLECTION);

      const notificationList = Array.isArray(response)
        ? response
        : response?.data || response?.items || [];

      const userNotifications = notificationList
        .filter((notification) =>
          isNotificationForUser(notification, user)
        )
        .sort((first, second) => {
          const firstDate = getNotificationDate(first)?.getTime() || 0;
          const secondDate = getNotificationDate(second)?.getTime() || 0;

          return secondDate - firstDate;
        });

      setNotifications(userNotifications);
    } catch (loadError) {
      console.error("Failed to load notifications:", loadError);
      setError(
        "Unable to load notifications. Please check your connection and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [user]);

  const unreadCount = useMemo(() => {
    return notifications.filter((notification) => !isRead(notification))
      .length;
  }, [notifications]);

  const filteredNotifications = useMemo(() => {
    if (filter === "unread") {
      return notifications.filter((notification) => !isRead(notification));
    }

    if (filter === "read") {
      return notifications.filter((notification) => isRead(notification));
    }

    return notifications;
  }, [notifications, filter]);

  const markAsRead = async (notification) => {
    const notificationId =
      notification.id ||
      notification.notificationId ||
      notification.documentId;

    if (!notificationId || isRead(notification)) {
      return;
    }

    try {
      setMarkingId(notificationId);

      await updateDocument(NOTIFICATIONS_COLLECTION, notificationId, {
        read: true,
        isRead: true,
        status: "read",
        readAt: new Date(),
      });

      setNotifications((currentNotifications) =>
        currentNotifications.map((item) => {
          const itemId =
            item.id ||
            item.notificationId ||
            item.documentId;

          if (String(itemId) === String(notificationId)) {
            return {
              ...item,
              read: true,
              isRead: true,
              status: "read",
            };
          }

          return item;
        })
      );
    } catch (readError) {
      console.error("Failed to mark notification as read:", readError);
      setError("Unable to update notification status.");
    } finally {
      setMarkingId("");
    }
  };

  const markAllAsRead = async () => {
    const unreadNotifications = notifications.filter(
      (notification) => !isRead(notification)
    );

    if (unreadNotifications.length === 0) {
      return;
    }

    try {
      setMarkingAll(true);
      setError("");

      await Promise.all(
        unreadNotifications.map(async (notification) => {
          const notificationId =
            notification.id ||
            notification.notificationId ||
            notification.documentId;

          if (!notificationId) return;

          return updateDocument(NOTIFICATIONS_COLLECTION, notificationId, {
            read: true,
            isRead: true,
            status: "read",
            readAt: new Date(),
          });
        })
      );

      setNotifications((currentNotifications) =>
        currentNotifications.map((notification) => ({
          ...notification,
          read: true,
          isRead: true,
          status: "read",
        }))
      );
    } catch (markAllError) {
      console.error(
        "Failed to mark all notifications as read:",
        markAllError
      );

      setError("Unable to mark all notifications as read.");
    } finally {
      setMarkingAll(false);
    }
  };

  const deleteNotificationLocally = (notificationId) => {
    setNotifications((currentNotifications) =>
      currentNotifications.filter((notification) => {
        const itemId =
          notification.id ||
          notification.notificationId ||
          notification.documentId;

        return String(itemId) !== String(notificationId);
      })
    );
  };

  if (loading) {
    return (
      <main className="notifications-page">
        <section className="notifications-container">
          <div className="notifications-loading">
            <div className="notifications-spinner" />
            <p>Loading notifications...</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="notifications-page">
      <section className="notifications-container">
        <div className="notifications-header">
          <div>
            <p className="notifications-eyebrow">VELZO UPDATES</p>

            <h1 className="notifications-title">
              Notifications
              {unreadCount > 0 && (
                <span className="notifications-count">
                  {unreadCount}
                </span>
              )}
            </h1>

            <p className="notifications-subtitle">
              Stay updated with your referrals, rewards and account activity.
            </p>
          </div>

          <button
            type="button"
            className="notifications-refresh-button"
            onClick={loadNotifications}
            disabled={loading}
          >
            ↻ Refresh
          </button>
        </div>

        {error && (
          <div className="notifications-error" role="alert">
            <span>{error}</span>

            <button
              type="button"
              onClick={() => setError("")}
              aria-label="Close error"
            >
              ×
            </button>
          </div>
        )}

        <div className="notifications-toolbar">
          <div className="notifications-filters">
            <button
              type="button"
              className={
                filter === "all"
                  ? "notification-filter active"
                  : "notification-filter"
              }
              onClick={() => setFilter("all")}
            >
              All
              <span>{notifications.length}</span>
            </button>

            <button
              type="button"
              className={
                filter === "unread"
                  ? "notification-filter active"
                  : "notification-filter"
              }
              onClick={() => setFilter("unread")}
            >
              Unread
              <span>{unreadCount}</span>
            </button>

            <button
              type="button"
              className={
                filter === "read"
                  ? "notification-filter active"
                  : "notification-filter"
              }
              onClick={() => setFilter("read")}
            >
              Read
            </button>
          </div>

          <button
            type="button"
            className="mark-all-button"
            onClick={markAllAsRead}
            disabled={markingAll || unreadCount === 0}
          >
            {markingAll ? "Updating..." : "Mark all as read"}
          </button>
        </div>

        {filteredNotifications.length === 0 ? (
          <div className="notifications-empty">
            <div className="notifications-empty-icon">🔔</div>

            <h2>
              {filter === "unread"
                ? "You're all caught up!"
                : "No notifications yet"}
            </h2>

            <p>
              {filter === "unread"
                ? "You have no unread notifications."
                : "New referral updates, payment details and account alerts will appear here."}
            </p>
          </div>
        ) : (
          <div className="notifications-list">
            {filteredNotifications.map((notification, index) => {
              const notificationId =
                notification.id ||
                notification.notificationId ||
                notification.documentId ||
                `notification-${index}`;

              const notificationType = getNotificationType(
                notification
              );

              const read = isRead(notification);

              const title =
                notification.title ||
                notification.heading ||
                notification.subject ||
                "Velzo Notification";

              const message =
                notification.message ||
                notification.body ||
                notification.description ||
                notification.text ||
                "You have a new update from Velzo.";

              return (
                <article
                  key={notificationId}
                  className={
                    read
                      ? "notification-card read"
                      : "notification-card unread"
                  }
                  onClick={() => markAsRead(notification)}
                >
                  <div
                    className={`notification-icon ${notificationType}`}
                    aria-hidden="true"
                  >
                    {getNotificationIcon(notificationType)}
                  </div>

                  <div className="notification-content">
                    <div className="notification-top-row">
                      <h3 className="notification-title-text">
                        {title}
                      </h3>

                      {!read && (
                        <span className="notification-unread-dot" />
                      )}
                    </div>

                    <p className="notification-message">{message}</p>

                    <div className="notification-bottom-row">
                      <span className="notification-date">
                        {formatNotificationDate(notification)}
                      </span>

                      {!read && (
                        <button
                          type="button"
                          className="notification-read-button"
                          disabled={markingId === notificationId}
                          onClick={(event) => {
                            event.stopPropagation();
                            markAsRead(notification);
                          }}
                        >
                          {markingId === notificationId
                            ? "Updating..."
                            : "Mark as read"}
                        </button>
                      )}

                      {read && (
                        <span className="notification-read-label">
                          ✓ Read
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}