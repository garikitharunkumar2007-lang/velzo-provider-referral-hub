import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  collection,
  onSnapshot,
  query,
  updateDoc,
  doc,
  where,
} from "firebase/firestore";

import {
  useAuth,
} from "../hooks/useAuth";

import {
  db,
} from "../firebase/firebaseConfig";

import "./Notifications.css";

/* =====================================================
   CONSTANTS
===================================================== */

const NOTIFICATIONS_COLLECTION = "notifications";

/* =====================================================
   NORMALIZE VALUE
===================================================== */

function normalizeValue(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/_/g, "-");
}

/* =====================================================
   DATE HELPER
===================================================== */

function getNotificationDate(notification) {
  const value =
    notification?.createdAt ||
    notification?.updatedAt ||
    notification?.timestamp;

  if (!value) {
    return null;
  }

  try {
    if (typeof value.toDate === "function") {
      return value.toDate();
    }

    if (value?.seconds) {
      return new Date(value.seconds * 1000);
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return date;
  } catch {
    return null;
  }
}

function formatNotificationDate(notification) {
  const date = getNotificationDate(notification);

  if (!date) {
    return "Just now";
  }

  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/* =====================================================
   NOTIFICATION TYPE
===================================================== */

function getNotificationType(notification) {
  return normalizeValue(
    notification?.type ||
      notification?.notificationType ||
      "general"
  );
}

/* =====================================================
   FRIENDLY REJECTION REASON
===================================================== */

function getFriendlyRejectionReason(reason) {
  const originalReason = String(
    reason || ""
  ).trim();

  if (!originalReason) {
    return "Your referral could not be approved. Please contact VELZO support for more details.";
  }

  const normalizedReason = originalReason
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");

  const reasonMap = {
    phone_already_exists:
      "This phone number is already registered with VELZO. Please refer a different provider.",

    invalid_information:
      "The information provided for this provider is invalid. Please check the details and try again.",

    invalid_info:
      "The information provided for this provider is invalid. Please check the details and try again.",

    invalid_data:
      "The provider information could not be verified. Please check the submitted details.",

    duplicate_referral:
      "This provider has already been referred to VELZO.",

    provider_already_registered:
      "This provider is already registered with VELZO.",

    incomplete_information:
      "Some required provider information is missing. Please check the details and try again.",

    invalid_phone:
      "The provider phone number is invalid. Please submit a valid phone number.",

    provider_not_found:
      "The provider details could not be verified.",

    not_eligible:
      "This provider does not currently meet the referral eligibility requirements.",
  };

  return (
    reasonMap[normalizedReason] ||
    originalReason
  );
}

/* =====================================================
   FRIENDLY MESSAGE
===================================================== */

function getFriendlyMessage(notification) {
  const rawMessage = String(
    notification?.message ||
      notification?.body ||
      notification?.description ||
      "You have a new update from VELZO."
  );

  const type = getNotificationType(notification);

  if (
    type === "referral-rejected" ||
    type === "referral_rejected"
  ) {
    const reason =
      notification?.rejectionReason ||
      notification?.reason ||
      rawMessage
        .replace(
          /^your referral was rejected because:\s*/i,
          ""
        )
        .trim();

    return `Your referral was rejected because: ${getFriendlyRejectionReason(
      reason
    )}`;
  }

  if (
    type === "referral-accepted" ||
    type === "referral_accepted" ||
    type === "referral-approved" ||
    type === "referral_approved"
  ) {
    return (
      notification?.message ||
      "Good news! Your referred provider has been accepted by VELZO."
    );
  }

  if (
    type === "payment-completed" ||
    type === "payment_completed" ||
    type === "payment-paid" ||
    type === "payment_paid"
  ) {
    return (
      notification?.message ||
      "Your referral reward payment has been completed."
    );
  }

  return rawMessage;
}

/* =====================================================
   NOTIFICATION TITLE
===================================================== */

function getFriendlyTitle(notification) {
  const type = getNotificationType(notification);

  if (
    type === "referral-rejected" ||
    type === "referral_rejected"
  ) {
    return "Referral Rejected";
  }

  if (
    type === "referral-accepted" ||
    type === "referral_accepted"
  ) {
    return "Referral Accepted";
  }

  if (
    type === "referral-approved" ||
    type === "referral_approved"
  ) {
    return "Referral Approved";
  }

  if (
    type === "payment-completed" ||
    type === "payment_completed"
  ) {
    return "Payment Completed";
  }

  if (
    type === "payment-paid" ||
    type === "payment_paid"
  ) {
    return "Payment Paid";
  }

  return (
    notification?.title ||
    notification?.heading ||
    "VELZO Notification"
  );
}

/* =====================================================
   NOTIFICATION ICON
===================================================== */

function getNotificationIcon(notification) {
  const type = getNotificationType(notification);

  if (
    type.includes("rejected") ||
    type.includes("error")
  ) {
    return "❌";
  }

  if (
    type.includes("accepted") ||
    type.includes("approved") ||
    type.includes("success")
  ) {
    return "✅";
  }

  if (
    type.includes("payment") ||
    type.includes("reward")
  ) {
    return "💰";
  }

  if (
    type.includes("complaint") ||
    type.includes("warning")
  ) {
    return "⚠️";
  }

  return "🔔";
}

/* =====================================================
   READ STATUS
===================================================== */

function isRead(notification) {
  return (
    notification?.read === true ||
    notification?.isRead === true ||
    notification?.status === "read"
  );
}

/* =====================================================
   CHECK USER NOTIFICATION
===================================================== */

function isNotificationForUser(
  notification,
  user
) {
  if (!notification || !user) {
    return false;
  }

  const userId =
    user.uid ||
    user.id ||
    user.userId ||
    "";

  const targetUserId =
    notification.targetUserId ||
    notification.userId ||
    notification.recipientId ||
    notification.recipientUID ||
    notification.referrerId ||
    "";

  const targetRole = normalizeValue(
    notification.targetRole ||
      notification.audience ||
      ""
  );

  const isForCurrentUser =
    Boolean(userId) &&
    String(targetUserId) === String(userId);

  const isForAllUsers =
    targetRole === "all" ||
    notification.audience === "all";

  return (
    isForCurrentUser ||
    isForAllUsers
  );
}

/* =====================================================
   COMPONENT
===================================================== */

export default function Notifications() {
  const { user } = useAuth();

  const [notifications, setNotifications] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [filter, setFilter] =
    useState("all");

  const [markingId, setMarkingId] =
    useState("");

  const [markingAll, setMarkingAll] =
    useState(false);

  /* =================================================
     REAL-TIME FIRESTORE LISTENER
  ================================================= */

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setLoading(false);
      return undefined;
    }

    const userId =
      user.uid ||
      user.id ||
      user.userId ||
      "";

    if (!userId) {
      setNotifications([]);
      setLoading(false);
      setError(
        "Unable to identify your account."
      );
      return undefined;
    }

    setLoading(true);
    setError("");

    const notificationsQuery = query(
      collection(
        db,
        NOTIFICATIONS_COLLECTION
      ),
      where(
        "targetUserId",
        "==",
        userId
      )
    );

    const unsubscribe = onSnapshot(
      notificationsQuery,
      (snapshot) => {
        const notificationList =
          snapshot.docs
            .map((documentSnapshot) => ({
              id: documentSnapshot.id,
              ...documentSnapshot.data(),
            }))
            .sort((first, second) => {
              const firstDate =
                getNotificationDate(first)?.getTime() ||
                0;

              const secondDate =
                getNotificationDate(second)?.getTime() ||
                0;

              return secondDate - firstDate;
            });

        setNotifications(notificationList);
        setLoading(false);
      },
      (snapshotError) => {
        console.error(
          "Notification listener error:",
          snapshotError
        );

        setLoading(false);

        if (
          snapshotError?.code ===
          "permission-denied"
        ) {
          setError(
            "You do not have permission to view notifications."
          );
        } else {
          setError(
            "Unable to load notifications. Please try again."
          );
        }
      }
    );

    return () => unsubscribe();
  }, [user]);

  /* =================================================
     UNREAD COUNT
  ================================================= */

  const unreadCount = useMemo(() => {
    return notifications.filter(
      (notification) => !isRead(notification)
    ).length;
  }, [notifications]);

  /* =================================================
     FILTERED NOTIFICATIONS
  ================================================= */

  const filteredNotifications = useMemo(() => {
    if (filter === "unread") {
      return notifications.filter(
        (notification) => !isRead(notification)
      );
    }

    if (filter === "read") {
      return notifications.filter(
        (notification) => isRead(notification)
      );
    }

    return notifications;
  }, [notifications, filter]);

  /* =================================================
     MARK ONE AS READ
  ================================================= */

  async function markAsRead(notification) {
    const notificationId =
      notification?.id ||
      notification?.notificationId ||
      notification?.documentId;

    if (
      !notificationId ||
      isRead(notification)
    ) {
      return;
    }

    try {
      setMarkingId(notificationId);
      setError("");

      await updateDoc(
        doc(
          db,
          NOTIFICATIONS_COLLECTION,
          notificationId
        ),
        {
          read: true,
          isRead: true,
          status: "read",
          readAt: new Date(),
        }
      );
    } catch (readError) {
      console.error(
        "Failed to mark notification as read:",
        readError
      );

      setError(
        "Unable to update notification status."
      );
    } finally {
      setMarkingId("");
    }
  }

  /* =================================================
     MARK ALL AS READ
  ================================================= */

  async function markAllAsRead() {
    const unreadNotifications =
      notifications.filter(
        (notification) => !isRead(notification)
      );

    if (
      unreadNotifications.length === 0
    ) {
      return;
    }

    try {
      setMarkingAll(true);
      setError("");

      await Promise.all(
        unreadNotifications.map(
          (notification) => {
            const notificationId =
              notification.id ||
              notification.notificationId ||
              notification.documentId;

            if (!notificationId) {
              return null;
            }

            return updateDoc(
              doc(
                db,
                NOTIFICATIONS_COLLECTION,
                notificationId
              ),
              {
                read: true,
                isRead: true,
                status: "read",
                readAt: new Date(),
              }
            );
          }
        )
      );
    } catch (markAllError) {
      console.error(
        "Failed to mark all notifications as read:",
        markAllError
      );

      setError(
        "Unable to mark all notifications as read."
      );
    } finally {
      setMarkingAll(false);
    }
  }

  /* =================================================
     LOADING SCREEN
  ================================================= */

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

  /* =================================================
     PAGE
  ================================================= */

  return (
    <main className="notifications-page">
      <section className="notifications-container">
        <div className="notifications-header">
          <div>
            <p className="notifications-eyebrow">
              VELZO UPDATES
            </p>

            <h1 className="notifications-title">
              Notifications

              {unreadCount > 0 && (
                <span className="notifications-count">
                  {unreadCount}
                </span>
              )}
            </h1>

            <p className="notifications-subtitle">
              Stay updated with your referrals,
              rewards and account activity.
            </p>
          </div>

          <button
            type="button"
            className="notifications-refresh-button"
            onClick={() => {
              window.location.reload();
            }}
          >
            ↻ Refresh
          </button>
        </div>

        {error && (
          <div
            className="notifications-error"
            role="alert"
          >
            {error}
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
            disabled={
              markingAll ||
              unreadCount === 0
            }
          >
            {markingAll
              ? "Updating..."
              : "Mark all as read"}
          </button>
        </div>

        {filteredNotifications.length === 0 ? (
          <div className="notifications-empty">
            <div className="notifications-empty-icon">
              🔔
            </div>

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
            {filteredNotifications.map(
              (notification) => {
                const notificationId =
                  notification.id;

                const read =
                  isRead(notification);

                const notificationType =
                  getNotificationType(
                    notification
                  );

                return (
                  <article
                    key={notificationId}
                    className={
                      read
                        ? "notification-card read"
                        : "notification-card unread"
                    }
                    onClick={() =>
                      markAsRead(notification)
                    }
                  >
                    <div
                      className={`notification-icon ${notificationType}`}
                      aria-hidden="true"
                    >
                      {getNotificationIcon(
                        notification
                      )}
                    </div>

                    <div className="notification-content">
                      <div className="notification-top-row">
                        <h3 className="notification-title-text">
                          {getFriendlyTitle(
                            notification
                          )}
                        </h3>

                        {!read && (
                          <span className="notification-unread-dot" />
                        )}
                      </div>

                      <p className="notification-message">
                        {getFriendlyMessage(
                          notification
                        )}
                      </p>

                      <div className="notification-bottom-row">
                        <span className="notification-date">
                          {formatNotificationDate(
                            notification
                          )}
                        </span>

                        {!read && (
                          <button
                            type="button"
                            className="notification-read-button"
                            disabled={
                              markingId ===
                              notificationId
                            }
                            onClick={(event) => {
                              event.stopPropagation();

                              markAsRead(
                                notification
                              );
                            }}
                          >
                            {markingId ===
                            notificationId
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
              }
            )}
          </div>
        )}
      </section>
    </main>
  );
}