// src/pages/ReferProvider.jsx

import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";

import { createReferral } from "../services/referralService";

import {
  getReferralOwnerDetails,
} from "../utils/referralIdentity";

import "./ReferProvider.css";

const INITIAL_FORM_DATA = {
  fullName: "",
  phone: "",
  address: "",
  role: "",
  unionId: "",
  upiNumber: "",
  consent: false,
};

const PROVIDER_ROLES = [
  { value: "electrician", label: "Electrician" },
  { value: "plumber", label: "Plumber" },
  { value: "mechanic", label: "Mechanic" },
  { value: "ac_technician", label: "AC Technician" },
  { value: "carpenter", label: "Carpenter" },
  { value: "painter", label: "Painter" },
  { value: "welder", label: "Welder" },
  { value: "cleaner", label: "Cleaner" },
  { value: "other", label: "Other" },
];

function ReferProvider() {
  const navigate = useNavigate();

  const {
    user,
    loading: authLoading,
    isAuthenticated,
  } = useAuth();

  const [formData, setFormData] = useState(
    INITIAL_FORM_DATA
  );

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (event) => {
    const {
      name,
      value,
      type,
      checked,
    } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]:
        type === "checkbox" ? checked : value,
    }));

    setError("");
    setSuccess("");
  };

  const handlePhoneChange = (event) => {
    const numericValue = event.target.value
      .replace(/\D/g, "")
      .slice(0, 10);

    setFormData((previous) => ({
      ...previous,
      phone: numericValue,
    }));

    setError("");
    setSuccess("");
  };

  const validateForm = () => {
    const fullName = formData.fullName.trim();
    const phone = formData.phone.trim();
    const address = formData.address.trim();
    const upiNumber = formData.upiNumber.trim();

    if (!fullName) {
      return "Please enter the provider's full name.";
    }

    if (fullName.length < 3) {
      return "Provider name must contain at least 3 characters.";
    }

    if (!/^\d{10}$/.test(phone)) {
      return "Please enter a valid 10-digit phone number.";
    }

    if (!address || address.length < 3) {
      return "Please enter a valid provider address or village.";
    }

    if (!formData.role) {
      return "Please select the provider role.";
    }

    if (!upiNumber || upiNumber.length < 3) {
      return "Please enter a valid payment number or UPI ID.";
    }

    if (!formData.consent) {
      return "Please confirm that the provider has given consent.";
    }

    return "";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (submitting || authLoading) {
      return;
    }

    setError("");
    setSuccess("");

    if (!isAuthenticated || !user) {
      setError(
        "Your session has expired. Please login again."
      );
      return;
    }

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setSubmitting(true);

      const ownerDetails =
        getReferralOwnerDetails(user);

      const referralId = await createReferral({
        ...ownerDetails,

        providerName: formData.fullName.trim(),
        fullName: formData.fullName.trim(),
        phone: formData.phone.trim(),
        address: formData.address.trim(),
        role: formData.role,
        unionId: formData.unionId.trim(),
        upiNumber: formData.upiNumber.trim(),
        consent: true,
      });

      console.log(
        "Referral created successfully:",
        referralId
      );

      setSuccess(
        "Provider referral submitted successfully. It is waiting for verification."
      );

      setFormData({
        ...INITIAL_FORM_DATA,
      });
    } catch (submissionError) {
      console.error(
        "Referral submission failed:",
        submissionError
      );

      setError(
        submissionError?.message ||
          "Unable to submit the referral. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="referral-page">
        <main className="referral-container">
          <div className="empty-state">
            Checking your VELZO account...
          </div>
        </main>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="referral-page">
        <main className="referral-container">
          <div className="empty-state">
            <h2>Please login first</h2>

            <p>
              You must be logged in to refer a provider.
            </p>

            <button
              type="button"
              className="referral-submit"
              onClick={() => navigate("/login")}
            >
              Go to Login →
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="referral-page">
      <header className="referral-header">
        <button
          type="button"
          className="back-button"
          onClick={() => navigate("/dashboard")}
          aria-label="Back to dashboard"
        >
          ←
        </button>

        <div>
          <span className="eyebrow">
            VELZO PROVIDER REFERRAL HUB
          </span>

          <h1>Refer a Provider</h1>

          <p>
            Help a genuine skilled provider join VELZO.
          </p>
        </div>
      </header>

      <main className="referral-container">
        <section className="referral-intro">
          <div className="intro-icon" aria-hidden="true">
            ＋
          </div>

          <div>
            <h2>Provider Information</h2>

            <p>
              Enter the provider's details carefully.
              Our team will verify the information
              before approving the referral.
            </p>
          </div>
        </section>

        <section className="referral-form-card">
          <form onSubmit={handleSubmit} noValidate>
            <div className="referral-field">
              <label htmlFor="fullName">
                Full Name <span>*</span>
              </label>

              <input
                id="fullName"
                name="fullName"
                type="text"
                placeholder="Enter provider's full name"
                value={formData.fullName}
                onChange={handleChange}
                autoComplete="name"
                maxLength={100}
                required
              />
            </div>

            <div className="referral-field">
              <label htmlFor="phone">
                Phone Number <span>*</span>
              </label>

              <div className="phone-input">
                <span aria-hidden="true">+91</span>

                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="Enter 10-digit phone number"
                  value={formData.phone}
                  onChange={handlePhoneChange}
                  autoComplete="tel-national"
                  required
                />
              </div>
            </div>

            <div className="referral-field">
              <label htmlFor="address">
                Address / Village <span>*</span>
              </label>

              <textarea
                id="address"
                name="address"
                rows={3}
                placeholder="Enter provider's address or village"
                value={formData.address}
                onChange={handleChange}
                maxLength={500}
                required
              />
            </div>

            <div className="referral-field">
              <label htmlFor="role">
                Provider Role <span>*</span>
              </label>

              <select
                id="role"
                name="role"
                value={formData.role}
                onChange={handleChange}
                required
              >
                <option value="">
                  Select provider role
                </option>

                {PROVIDER_ROLES.map((item) => (
                  <option
                    key={item.value}
                    value={item.value}
                  >
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="referral-field">
              <label htmlFor="unionId">
                Union / Labour ID
              </label>

              <input
                id="unionId"
                name="unionId"
                type="text"
                placeholder="Enter ID if available"
                value={formData.unionId}
                onChange={handleChange}
                maxLength={100}
              />

              <small>
                A valid Union / Labour ID may qualify
                the successful referral for the ₹4 reward.
              </small>
            </div>

            <div className="referral-field">
              <label htmlFor="upiNumber">
                PhonePe / Google Pay Number or UPI ID{" "}
                <span>*</span>
              </label>

              <input
                id="upiNumber"
                name="upiNumber"
                type="text"
                value={formData.upiNumber}
                onChange={handleChange}
                placeholder="Enter mobile number or UPI ID"
                maxLength={50}
                autoComplete="off"
                required
              />

              <small>
                Used only for referral reward payment
                after successful approval.
              </small>
            </div>

            <div className="consent-box">
              <input
                id="consent"
                name="consent"
                type="checkbox"
                checked={formData.consent}
                onChange={handleChange}
                required
              />

              <label htmlFor="consent">
                I confirm that the provider has given
                consent to be referred to VELZO.
              </label>
            </div>

            {error && (
              <div
                className="referral-error"
                role="alert"
                aria-live="assertive"
              >
                {error}
              </div>
            )}

            {success && (
              <div
                className="referral-success"
                role="status"
                aria-live="polite"
              >
                ✓ {success}
              </div>
            )}

            <button
              type="submit"
              className="referral-submit"
              disabled={submitting || authLoading}
            >
              {submitting
                ? "Submitting..."
                : "Submit Referral"}

              {!submitting && (
                <span aria-hidden="true">→</span>
              )}
            </button>
          </form>
        </section>

        <section className="referral-reward-info">
          <div className="reward-info-item">
            <strong>₹4</strong>

            <div>
              <h3>With Union / Labour ID</h3>
              <p>
                After successful verification and onboarding.
              </p>
            </div>
          </div>

          <div className="reward-info-item">
            <strong>₹3</strong>

            <div>
              <h3>Without Union / Labour ID</h3>
              <p>
                After successful verification and onboarding.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default ReferProvider;