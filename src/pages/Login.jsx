import { useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  browserLocalPersistence,
  browserSessionPersistence,
  setPersistence,
} from "firebase/auth";

import { auth } from "../firebase/firebaseConfig";

import {
  loginUser,
  getAuthErrorMessage,
  isValidIndianPhone,
  normalizePhone,
} from "../services/authService";

import "./Login.css";

export default function Login() {
  const navigate = useNavigate();

  const [phone, setPhone] = useState("");
  const [rememberMe, setRememberMe] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(event) {
    event.preventDefault();

    setError("");

    const cleanPhone = normalizePhone(phone);

    if (!isValidIndianPhone(cleanPhone)) {
      setError(
        "Please enter a valid 10-digit phone number."
      );

      return;
    }

    try {
      setLoading(true);

      /*
      Firebase persistence
      */

      await setPersistence(
        auth,
        rememberMe
          ? browserLocalPersistence
          : browserSessionPersistence
      );

      /*
      Verify mobile app account and login
      */

      const user = await loginUser({
        phone: cleanPhone,
      });

      /*
      Save safe user information
      */

      const userData = {
        ...user,
        phone: cleanPhone,
      };

      if (rememberMe) {
        localStorage.setItem(
          "velzoUser",
          JSON.stringify(userData)
        );

        sessionStorage.removeItem("velzoUser");
      } else {
        sessionStorage.setItem(
          "velzoUser",
          JSON.stringify(userData)
        );

        localStorage.removeItem("velzoUser");
      }

      /*
      Navigate to dashboard
      */

      if (user?.isAdmin === true) {
        navigate("/admin", {
          replace: true,
        });
      } else {
        navigate("/dashboard", {
          replace: true,
        });
      }
    } catch (loginError) {
      console.error(
        "VELZO login error:",
        loginError
      );

      setError(
        getAuthErrorMessage(loginError)
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-container">
        <section className="auth-card">
          <header className="auth-header">
            <div className="auth-logo">V</div>

            <h1>Welcome Back</h1>

            <p className="auth-subtitle">
              Verify your VELZO mobile app account
            </p>
          </header>

          {error && (
            <div className="auth-alert auth-alert-error">
              {error}
            </div>
          )}

          <form
            className="auth-form"
            onSubmit={handleLogin}
          >
            <div className="form-group">
              <label htmlFor="phone">
                Phone Number
              </label>

              <div className="input-wrapper">
                <span className="input-icon">
                  📱
                </span>

                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="Enter 10-digit phone number"
                  value={phone}
                  maxLength={10}
                  onChange={(event) => {
                    const value =
                      event.target.value
                        .replace(/\D/g, "")
                        .slice(0, 10);

                    setPhone(value);
                    setError("");
                  }}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="auth-options">
              <label className="remember-option">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) =>
                    setRememberMe(
                      event.target.checked
                    )
                  }
                  disabled={loading}
                />

                <span>Remember me</span>
              </label>

              <span className="secure-login-text">
                Account verification
              </span>
            </div>

            <button
              type="submit"
              className="auth-submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="auth-spinner" />
                  <span>Verifying account...</span>
                </>
              ) : (
                <>
                  <span>Refer Login</span>
                  <span>→</span>
                </>
              )}
            </button>
          </form>

          <div className="auth-divider">
            <span>VELZO MOBILE APP USERS</span>
          </div>

          <p className="auth-mobile-note">
            Only users who already registered in the
            VELZO mobile application can access this
            referral hub.
          </p>

          <div className="auth-register-box">
            <p className="auth-footer-text">
              Don't have a VELZO account?
            </p>

            <p className="auth-footer-text">
              Please register through the VELZO mobile
              application first.
            </p>
          </div>
        </section>

        <p className="auth-footer">
          © {new Date().getFullYear()} VELZO.
          All rights reserved.
        </p>
      </div>
    </main>
  );
}