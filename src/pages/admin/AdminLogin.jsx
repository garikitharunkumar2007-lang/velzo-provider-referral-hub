// src/pages/admin/AdminLogin.jsx

import { useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  loginAdmin,
  getAuthErrorMessage,
} from "../../services/authService";

import "./AdminLogin.css";

export default function AdminLogin() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const cleanEmail =
        email.trim().toLowerCase();

      if (!cleanEmail) {
        throw new Error(
          "Please enter your admin email address."
        );
      }

      const emailPattern =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!emailPattern.test(cleanEmail)) {
        throw new Error(
          "Please enter a valid admin email address."
        );
      }

      if (!password.trim()) {
        throw new Error(
          "Please enter your admin password."
        );
      }

      /*
       * Firebase admin authentication:
       *
       * 1. Sign in using Firebase Email + Password
       * 2. Find the matching Firestore user profile
       * 3. Verify role === "admin"
       * 4. Save admin session
       */
      const result = await loginAdmin(
        cleanEmail,
        password
      );

      if (
        !result?.success ||
        !result?.isAdmin
      ) {
        throw new Error(
          "You do not have admin permissions."
        );
      }

      navigate("/admin/dashboard", {
        replace: true,
      });
    } catch (loginError) {
      console.error(
        "Firebase admin login error:",
        loginError
      );

      setError(
        getAuthErrorMessage(loginError)
      );
    } finally {
      setLoading(false);
    }
  }

  function handleBackToDashboard() {
    navigate("/dashboard", {
      replace: true,
    });
  }

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        {/* LOGO */}

        <div className="admin-login-logo">
          V
        </div>

        {/* HEADING */}

        <div className="admin-login-heading">
          <span>
            VELZO ADMIN PORTAL
          </span>

          <h1>
            Admin Login
          </h1>

          <p>
            Sign in to manage the VELZO
            Provider Referral Hub.
          </p>
        </div>

        {/* ERROR */}

        {error && (
          <div
            className="admin-login-error"
            role="alert"
          >
            {error}
          </div>
        )}

        {/* LOGIN FORM */}

        <form
          className="admin-login-form"
          onSubmit={handleSubmit}
        >
          {/* EMAIL */}

          <div className="admin-form-group">
            <label htmlFor="admin-email">
              Email Address
            </label>

            <div className="admin-input-wrapper">
              <span aria-hidden="true">
                ✉️
              </span>

              <input
                id="admin-email"
                type="email"
                autoComplete="username"
                placeholder="Enter admin email address"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                disabled={loading}
                required
              />
            </div>
          </div>

          {/* PASSWORD */}

          <div className="admin-form-group">
            <label htmlFor="admin-password">
              Password
            </label>

            <div className="admin-input-wrapper">
              <span aria-hidden="true">
                🔒
              </span>

              <input
                id="admin-password"
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                autoComplete="current-password"
                placeholder="Enter admin password"
                value={password}
                onChange={(event) =>
                  setPassword(
                    event.target.value
                  )
                }
                disabled={loading}
                required
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() =>
                  setShowPassword(
                    (previous) =>
                      !previous
                  )
                }
                aria-label={
                  showPassword
                    ? "Hide password"
                    : "Show password"
                }
                disabled={loading}
              >
                {showPassword
                  ? "🙈"
                  : "👁️"}
              </button>
            </div>
          </div>

          {/* LOGIN BUTTON */}

          <button
            type="submit"
            className="admin-login-submit"
            disabled={loading}
          >
            {loading
              ? "Verifying..."
              : "Login to Admin Dashboard →"}
          </button>
        </form>

        {/* BACK BUTTON */}

        <button
          type="button"
          className="back-to-dashboard"
          onClick={handleBackToDashboard}
          disabled={loading}
        >
          ← Back to User Dashboard
        </button>

        {/* FOOTER */}

        <div className="admin-login-footer">
          <span>
            VELZO Provider Referral Hub
          </span>

          <span>
            Authorized administrators only
          </span>
        </div>
      </div>
    </div>
  );
}