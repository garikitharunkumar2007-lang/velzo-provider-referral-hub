import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  createUserWithEmailAndPassword,
} from "firebase/auth";

import {
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";

import { auth, db } from "../firebase/firebaseConfig";

function Register() {
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [consent, setConsent] =
    useState(false);

  const [isLoading, setIsLoading] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const normalizePhone = (value) => {
    return value.replace(/\D/g, "").slice(0, 10);
  };

  const handlePhoneChange = (event) => {
    setPhone(normalizePhone(event.target.value));
    setErrorMessage("");
  };

  const handleRegister = async (event) => {
    event.preventDefault();

    setErrorMessage("");

    const cleanName = fullName.trim();
    const cleanPhone = normalizePhone(phone);

    if (cleanName.length < 2) {
      setErrorMessage(
        "Please enter your full name."
      );
      return;
    }

    if (!/^\d{10}$/.test(cleanPhone)) {
      setErrorMessage(
        "Please enter a valid 10-digit phone number."
      );
      return;
    }

    if (password.length < 6) {
      setErrorMessage(
        "Password must contain at least 6 characters."
      );
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage(
        "Passwords do not match."
      );
      return;
    }

    if (!consent) {
      setErrorMessage(
        "Please accept the VELZO referral program terms."
      );
      return;
    }

    try {
      setIsLoading(true);

      /*
       * SAME AUTHENTICATION FORMAT AS ANDROID VELZO APP
       *
       * Android:
       * "$phoneNumber@velzo.com"
       */
      const email = `${cleanPhone}@velzo.com`;

      /*
       * First check whether a VELZO profile already exists.
       *
       * This helps prevent accidentally overwriting
       * an existing users/{phone} document.
       */
      const existingUserRef = doc(
        db,
        "users",
        cleanPhone
      );

      const existingUserSnapshot =
        await getDoc(existingUserRef);

      if (existingUserSnapshot.exists()) {
        setErrorMessage(
          "An account already exists with this phone number. Please sign in instead."
        );
        return;
      }

      /*
       * Create Firebase Authentication account.
       */
      const userCredential =
        await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );

      const firebaseUser =
        userCredential.user;

      /*
       * Create the SAME users/{phone} document
       * structure used by the Android app.
       *
       * We intentionally DO NOT store the password.
       */
      const userData = {
        uid: firebaseUser.uid,
        name: cleanName,
        phone: cleanPhone,

        /*
         * Normal VELZO app user.
         *
         * Referral ability is not a separate role.
         */
        role: "user",

        createdAt: Date.now(),

        /*
         * Referral Hub account indicator.
         * This is informational only.
         */
        referralHubEnabled: true,
      };

      await setDoc(
        existingUserRef,
        userData
      );

      /*
       * Registration successful.
       *
       * Firebase has already signed the user in.
       */
      navigate("/dashboard");

    } catch (error) {
      console.error(
        "VELZO registration error:",
        error
      );

      let message =
        "Unable to create your account. Please try again.";

      if (
        error.code ===
        "auth/email-already-in-use"
      ) {
        message =
          "An account already exists with this phone number. Please sign in.";
      } else if (
        error.code ===
        "auth/weak-password"
      ) {
        message =
          "Your password is too weak. Please choose a stronger password.";
      } else if (
        error.code ===
        "auth/network-request-failed"
      ) {
        message =
          "Network error. Please check your internet connection.";
      } else if (
        error.code ===
        "auth/invalid-email"
      ) {
        message =
          "The phone number format is invalid.";
      }

      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-page">

      <div className="auth-glow auth-glow-one"></div>
      <div className="auth-glow auth-glow-two"></div>

      <div className="auth-card register-card">

        {/* BRAND */}
        <div className="auth-brand">

          <div className="auth-logo">
            V
          </div>

          <div>
            <h1>VELZO</h1>
            <span>
              Provider Referral Hub
            </span>
          </div>

        </div>

        {/* HEADING */}
        <div className="auth-heading">

          <span>
            JOIN VELZO
          </span>

          <h2>
            Create your VELZO account
          </h2>

          <p>
            Use your VELZO account to access the
            app and refer genuine service providers.
          </p>

        </div>

        {/* ERROR */}
        {errorMessage && (
          <div className="auth-message auth-error">
            {errorMessage}
          </div>
        )}

        <form
          className="auth-form"
          onSubmit={handleRegister}
        >

          {/* FULL NAME */}
          <div className="form-group">

            <label htmlFor="fullName">
              Full Name
            </label>

            <input
              id="fullName"
              type="text"
              autoComplete="name"
              placeholder="Enter your full name"
              value={fullName}
              onChange={(event) => {
                setFullName(event.target.value);
                setErrorMessage("");
              }}
              required
            />

          </div>

          {/* PHONE */}
          <div className="form-group">

            <label htmlFor="registerPhone">
              Phone Number
            </label>

            <div className="input-wrapper">

              <span className="input-prefix">
                +91
              </span>

              <input
                id="registerPhone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                placeholder="Enter your 10-digit phone number"
                value={phone}
                onChange={handlePhoneChange}
                maxLength={10}
                required
              />

            </div>

          </div>

          {/* PASSWORD */}
          <div className="form-group">

            <label htmlFor="registerPassword">
              Create Password
            </label>

            <div className="input-wrapper password-wrapper">

              <input
                id="registerPassword"
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                autoComplete="new-password"
                placeholder="Create a strong password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setErrorMessage("");
                }}
                required
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() =>
                  setShowPassword(
                    (previous) => !previous
                  )
                }
              >
                {showPassword
                  ? "Hide"
                  : "Show"}
              </button>

            </div>

          </div>

          {/* CONFIRM PASSWORD */}
          <div className="form-group">

            <label htmlFor="confirmPassword">
              Confirm Password
            </label>

            <div className="input-wrapper password-wrapper">

              <input
                id="confirmPassword"
                type={
                  showConfirmPassword
                    ? "text"
                    : "password"
                }
                autoComplete="new-password"
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(
                    event.target.value
                  );
                  setErrorMessage("");
                }}
                required
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() =>
                  setShowConfirmPassword(
                    (previous) => !previous
                  )
                }
              >
                {showConfirmPassword
                  ? "Hide"
                  : "Show"}
              </button>

            </div>

          </div>

          {/* CONSENT */}
          <label className="consent-option">

            <input
              type="checkbox"
              checked={consent}
              onChange={(event) =>
                setConsent(
                  event.target.checked
                )
              }
            />

            <span>
              I agree to the VELZO referral program
              terms and confirm that I will refer
              genuine providers with their consent.
            </span>

          </label>

          {/* SUBMIT */}
          <button
            type="submit"
            className="auth-submit"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="auth-spinner"></span>
                Creating account...
              </>
            ) : (
              <>
                Create VELZO Account
                <span>→</span>
              </>
            )}
          </button>

        </form>

        {/* LOGIN */}
        <div className="auth-register">

          <span>
            Already have an account?
          </span>

          <Link to="/login">
            Sign in
          </Link>

        </div>

        {/* FOOTER */}
        <div className="auth-footer">

          <span>
            VELZO
          </span>

          <p>
            Building a stronger local service network.
          </p>

        </div>

      </div>

    </div>
  );
}

export default Register;