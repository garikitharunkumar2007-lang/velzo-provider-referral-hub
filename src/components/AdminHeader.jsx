import React, { useEffect, useRef, useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../context/ThemeContext";

import "./AdminHeader.css";

function getStoredAdminSession() {
  try {
    const storedSession =
      localStorage.getItem("velzoAdminSession") ||
      sessionStorage.getItem("velzoAdminSession");

    if (!storedSession) {
      return null;
    }

    const session = JSON.parse(storedSession);

    if (!session || typeof session !== "object") {
      return null;
    }

    const isAdmin =
      session.role === "admin" ||
      session.userRole === "admin" ||
      session.isAdmin === true;

    if (!isAdmin) {
      return null;
    }

    return session;
  } catch (error) {
    console.error(
      "Unable to read stored admin session:",
      error
    );

    return null;
  }
}

function getAdminValue(...values) {
  return values.find((value) => {
    return (
      value !== undefined &&
      value !== null &&
      String(value).trim() !== ""
    );
  });
}

export default function AdminHeader({
  onMenuClick,
  title = "Admin Dashboard",
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const [adminSession, setAdminSession] = useState(() => {
    return getStoredAdminSession();
  });

  const profileMenuRef = useRef(null);

  const isDarkMode = theme === "dark";

  /*
   * Read the currently logged-in admin session.
   * Do not load the first document from adminProfiles.
   */
  useEffect(() => {
    const refreshAdminSession = () => {
      setAdminSession(getStoredAdminSession());
    };

    refreshAdminSession();

    window.addEventListener(
      "velzo-admin-session-updated",
      refreshAdminSession
    );

    window.addEventListener(
      "storage",
      refreshAdminSession
    );

    return () => {
      window.removeEventListener(
        "velzo-admin-session-updated",
        refreshAdminSession
      );

      window.removeEventListener(
        "storage",
        refreshAdminSession
      );
    };
  }, []);

  /*
   * Close profile menu when clicking outside.
   */
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target)
      ) {
        setShowProfileMenu(false);
      }
    };

    document.addEventListener(
      "mousedown",
      handleOutsideClick
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );
    };
  }, []);

  /*
   * Refresh header after profile update.
   */
  useEffect(() => {
    const handleProfileUpdated = () => {
      setAdminSession(getStoredAdminSession());
    };

    window.addEventListener(
      "velzo-admin-profile-updated",
      handleProfileUpdated
    );

    return () => {
      window.removeEventListener(
        "velzo-admin-profile-updated",
        handleProfileUpdated
      );
    };
  }, []);

  /*
   * Current logged-in admin details.
   *
   * Priority:
   * 1. Stored admin session
   * 2. Firebase user
   * 3. Safe fallback
   */
  const userName = getAdminValue(
    adminSession?.name,
    adminSession?.fullName,
    adminSession?.displayName,
    user?.displayName,
    user?.name,
    user?.fullName,
    "Administrator"
  );

  const userEmail = getAdminValue(
    adminSession?.email,
    user?.email,
    ""
  );

  const userPhone = getAdminValue(
    adminSession?.phone,
    adminSession?.phoneNumber,
    user?.phoneNumber,
    user?.phone,
    ""
  );

  const profilePhoto = getAdminValue(
    adminSession?.photoURL,
    adminSession?.photoUrl,
    adminSession?.profileImage,
    adminSession?.profileImageUrl,
    user?.photoURL,
    user?.photoUrl,
    ""
  );

  const rawRole = getAdminValue(
    adminSession?.role,
    adminSession?.userRole,
    user?.role,
    "admin"
  );

  const userRole =
    String(rawRole).toLowerCase() === "admin"
      ? "Administrator"
      : rawRole;

  const userInitial =
    String(userName)
      .trim()
      .charAt(0)
      .toUpperCase() || "A";

  const renderAvatar = (large = false) => {
    const avatarClass = large
      ? "admin-avatar large"
      : "admin-avatar";

    if (profilePhoto) {
      return (
        <img
          src={profilePhoto}
          alt={`${userName} profile`}
          className={`${avatarClass} admin-avatar-image`}
          onError={(event) => {
            event.currentTarget.style.display = "none";

            const fallback =
              event.currentTarget.parentElement?.querySelector(
                ".admin-avatar-fallback"
              );

            if (fallback) {
              fallback.style.display = "inline-flex";
            }
          }}
        />
      );
    }

    return (
      <span
        className={`${avatarClass} admin-avatar-fallback`}
      >
        {userInitial}
      </span>
    );
  };

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      setShowProfileMenu(false);

      if (typeof logout === "function") {
        await logout();
      }

      localStorage.removeItem("velzoAdminSession");
      sessionStorage.removeItem("velzoAdminSession");

      navigate("/admin/login", {
        replace: true,
      });
    } catch (error) {
      console.error("Admin logout failed:", error);
    } finally {
      setLoggingOut(false);
    }
  };

  const isActive = (path) => {
    return (
      location.pathname === path ||
      location.pathname.startsWith(`${path}/`)
    );
  };

  return (
    <header className="admin-header">
      <div className="admin-header-left">
        <button
          type="button"
          className="admin-header-menu-button"
          onClick={onMenuClick}
          aria-label="Open admin menu"
          title="Open menu"
        >
          <span />
          <span />
          <span />
        </button>

        <div className="admin-header-heading">
          <h1>{title}</h1>

          <p>
            Manage your Velzo referral platform
          </p>
        </div>
      </div>

      <div className="admin-header-right">
        <button
          type="button"
          className="admin-theme-toggle"
          onClick={toggleTheme}
          aria-label={
            isDarkMode
              ? "Switch to light mode"
              : "Switch to dark mode"
          }
          title={
            isDarkMode
              ? "Switch to light mode"
              : "Switch to dark mode"
          }
        >
          {isDarkMode ? "☀️" : "🌙"}
        </button>

        <Link
          to="/admin/notifications"
          className={
            isActive("/admin/notifications")
              ? "admin-header-icon-link active"
              : "admin-header-icon-link"
          }
          aria-label="Admin notifications"
          title="Notifications"
        >
          🔔
        </Link>

        <div
          className="admin-profile-wrapper"
          ref={profileMenuRef}
        >
          <button
            type="button"
            className="admin-profile-button"
            onClick={() => {
              setShowProfileMenu(
                (currentValue) => !currentValue
              );
            }}
            aria-expanded={showProfileMenu}
            aria-haspopup="menu"
          >
            {renderAvatar()}

            <span className="admin-profile-info">
              <strong>{userName}</strong>
              <small>{userRole}</small>
            </span>

            <span className="admin-profile-arrow">
              {showProfileMenu ? "⌃" : "⌄"}
            </span>
          </button>

          {showProfileMenu && (
            <div
              className="admin-profile-menu"
              role="menu"
            >
              <div className="admin-profile-menu-user">
                {renderAvatar(true)}

                <div className="admin-profile-menu-user-details">
                  <strong>{userName}</strong>

                  {userEmail && (
                    <small>{userEmail}</small>
                  )}

                  {!userEmail && userPhone && (
                    <small>{userPhone}</small>
                  )}
                </div>
              </div>

              <div className="admin-profile-menu-divider" />

              <Link
                to="/admin/profile"
                className="admin-profile-menu-item"
                role="menuitem"
                onClick={() => {
                  setShowProfileMenu(false);
                }}
              >
                <span className="admin-menu-item-icon">
                  👤
                </span>

                <span>My Profile</span>
              </Link>

              <Link
                to="/admin/notifications"
                className="admin-profile-menu-item"
                role="menuitem"
                onClick={() => {
                  setShowProfileMenu(false);
                }}
              >
                <span className="admin-menu-item-icon">
                  🔔
                </span>

                <span>Notifications</span>
              </Link>

              <button
                type="button"
                className="admin-profile-menu-item logout"
                role="menuitem"
                onClick={handleLogout}
                disabled={loggingOut}
              >
                <span className="admin-menu-item-icon">
                  🚪
                </span>

                <span>
                  {loggingOut
                    ? "Logging out..."
                    : "Logout"}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}