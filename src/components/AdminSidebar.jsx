import React from "react";
import {
  NavLink,
  useLocation,
  useNavigate,
} from "react-router-dom";

import { useTheme } from "../context/ThemeContext";

import "./AdminSidebar.css";

export default function AdminSidebar({
  isOpen = false,
  onClose,
  adminProfile = null,
}) {
  const location = useLocation();
  const navigate = useNavigate();

  const { theme, toggleTheme } = useTheme();

  const isDarkMode = theme === "dark";

  const navigationItems = [
    {
      label: "Dashboard",
      path: "/admin/dashboard",
      icon: "📊",
    },
    {
      label: "Referrals",
      path: "/admin/referrals",
      icon: "🤝",
    },
    {
      label: "Payments",
      path: "/admin/payments",
      icon: "💳",
    },
    {
      label: "Complaints",
      path: "/admin/complaints",
      icon: "🛠️",
    },
    {
      label: "Notifications",
      path: "/admin/notifications",
      icon: "🔔",
    },
    {
      label: "Profile",
      path: "/admin/profile",
      icon: "👤",
    },
  ];

  const handleNavigation = () => {
    if (typeof onClose === "function") {
      onClose();
    }
  };

  const handleAdminLogin = () => {
    handleNavigation();

    navigate("/admin/login");
  };

  const isItemActive = (path) => {
    if (path === "/admin/dashboard") {
      return (
        location.pathname === "/admin" ||
        location.pathname === "/admin/dashboard"
      );
    }

    return (
      location.pathname === path ||
      location.pathname.startsWith(`${path}/`)
    );
  };

  const isAdminLoginActive =
    location.pathname === "/admin/login";

  /*
   * These values are available if you want to use
   * the logged-in admin details inside the sidebar.
   */

  const adminName =
    adminProfile?.name ||
    adminProfile?.fullName ||
    adminProfile?.displayName ||
    "Administrator";

  const adminRole =
    adminProfile?.role ||
    adminProfile?.userRole ||
    "admin";

  return (
    <>
      {isOpen && (
        <button
          type="button"
          className="admin-sidebar-overlay"
          onClick={onClose}
          aria-label="Close sidebar"
        />
      )}

      <aside
        className={
          isOpen
            ? "admin-sidebar open"
            : "admin-sidebar"
        }
      >
        {/* =========================================
            BRAND
        ========================================== */}

        <div className="admin-sidebar-brand">
          <div className="admin-sidebar-logo">
            V
          </div>

          <div className="admin-sidebar-brand-text">
            <h2>Velzo</h2>
            <span>Admin Panel</span>
          </div>

          <button
            type="button"
            className="admin-sidebar-close"
            onClick={onClose}
            aria-label="Close sidebar"
          >
            ×
          </button>
        </div>

        <div className="admin-sidebar-divider" />

        {/* =========================================
            ADMIN NAVIGATION
        ========================================== */}

        <nav
          className="admin-sidebar-navigation"
          aria-label="Admin navigation"
        >
          <p className="admin-sidebar-section-title">
            MAIN MENU
          </p>

          {navigationItems.map((item) => {
            const active = isItemActive(item.path);

            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={handleNavigation}
                className={
                  active
                    ? "admin-sidebar-link active"
                    : "admin-sidebar-link"
                }
              >
                <span
                  className="admin-sidebar-link-icon"
                  aria-hidden="true"
                >
                  {item.icon}
                </span>

                <span className="admin-sidebar-link-label">
                  {item.label}
                </span>

                {active && (
                  <span className="admin-sidebar-active-indicator" />
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* =========================================
            SIDEBAR BOTTOM AREA
        ========================================== */}

        <div className="admin-sidebar-bottom">
          {/* =======================================
              ADMIN LOGIN BUTTON
          ======================================== */}

          <button
            type="button"
            className={
              isAdminLoginActive
                ? "admin-sidebar-login-button active"
                : "admin-sidebar-login-button"
            }
            onClick={handleAdminLogin}
          >
            <span
              className="admin-sidebar-login-icon"
              aria-hidden="true"
            >
              🔐
            </span>

            <span className="admin-sidebar-login-label">
              Admin Login
            </span>

            <span
              className="admin-sidebar-login-arrow"
              aria-hidden="true"
            >
              →
            </span>
          </button>

          {/* =======================================
              THEME SWITCHER
          ======================================== */}

          <div className="admin-sidebar-theme-card">
            <div className="admin-sidebar-theme-icon">
              {isDarkMode ? "🌙" : "☀️"}
            </div>

            <div className="admin-sidebar-theme-content">
              <strong>
                {isDarkMode
                  ? "Dark Mode"
                  : "Light Mode"}
              </strong>

              <span>
                {isDarkMode
                  ? "Easy on your eyes"
                  : "Bright and clean"}
              </span>
            </div>

            <button
              type="button"
              className="admin-sidebar-theme-toggle"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              title="Toggle dark and light mode"
            >
              <span
                className={
                  isDarkMode
                    ? "admin-sidebar-toggle-knob dark"
                    : "admin-sidebar-toggle-knob"
                }
              />
            </button>
          </div>

          {/* =======================================
              FOOTER
          ======================================== */}

          <div className="admin-sidebar-footer">
            <span>
              © {new Date().getFullYear()} Velzo
            </span>

            <span>
              Admin Portal
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}