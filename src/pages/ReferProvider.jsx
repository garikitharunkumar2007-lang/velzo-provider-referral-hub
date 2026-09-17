import { useState } from "react";
import { useNavigate } from "react-router-dom";

// Use the correct path according to your project structure.
import { submitReferral } from "../services/referralService";

import "./ReferProvider.css";

/* -------------------------------------------------
   Initial form data
------------------------------------------------- */
const INITIAL_FORM_DATA = {
  fullName: "",
  phone: "",
  address: "",
  role: "",
  unionId: "",
  upiNumber: "",
  consent: false,
};

/* -------------------------------------------------
   Provider roles
------------------------------------------------- */
const PROVIDER_ROLES = [
  {
    value: "electrician",
    label: "Electrician",
  },
  {
    value: "plumber",
    label: "Plumber",
  },
  {
    value: "mechanic",
    label: "Mechanic",
  },
  {
    value: "ac_technician",
    label: "AC Technician",
  },
  {
    value: "carpenter",
    label: "Carpenter",
  },
  {
    value: "painter",
    label: "Painter",
  },
  {
    value: "welder",
    label: "Welder",
  },
  {
    value: "cleaner",
    label: "Cleaner",
  },
  {
    value: "other",
    label: "Other",
  },
];

/* -------------------------------------------------
   Guest referral owner
------------------------------------------------- */
const GUEST_STORAGE_KEY = "velzoGuestReferralOwner";

function createGuestId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `guest_${crypto.randomUUID()}`;
  }

  return `guest_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2)}`;
}

function getGuestOwnerId() {
  try {
    let ownerId = localStorage.getItem(
      GUEST_STORAGE_KEY
    );

    if (!ownerId) {
      ownerId = createGuestId();

      localStorage.setItem(
        GUEST_STORAGE_KEY,
        ownerId
      );
    }

    return ownerId;
  } catch (error) {
    console.error(
      "Guest owner ID error:",
      error
    );

    return "guest_fallback";
  }
}

/* -------------------------------------------------
   Refer Provider Component
------------------------------------------------- */
export default function ReferProvider() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState(
    INITIAL_FORM_DATA
  );

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  /* -------------------------------------------------
     Handle normal inputs
  ------------------------------------------------- */
  function handleChange(event) {
    const {
      name,
      value,
      type,
      checked,
    } = event.target;

    setFormData((previousData) => ({
      ...previousData,
      [name]:
        type === "checkbox"
          ? checked
          : value,
    }));

    setError("");
    setSuccess("");
  }

  /* -------------------------------------------------
     Handle phone number
  ------------------------------------------------- */
  function handlePhoneChange(event) {
    const value = event.target.value
      .replace(/\D/g, "")
      .slice(0, 10);

    setFormData((previousData) => ({
      ...previousData,
      phone: value,
    }));

    setError("");
    setSuccess("");
  }

  /* -------------------------------------------------
     Validate form
  ------------------------------------------------- */
  function validateForm() {
    const fullName =
      formData.fullName.trim();

    const phone =
      formData.phone.trim();

    const address =
      formData.address.trim();

    const upiNumber =
      formData.upiNumber.trim();

    if (!fullName) {
      return "Please enter the provider's full name.";
    }

    if (fullName.length < 3) {
      return "Provider name must contain at least 3 characters.";
    }

    if (!/^[6-9]\d{9}$/.test(phone)) {
      return "Please enter a valid 10-digit Indian phone number.";
    }

    if (!address) {
      return "Please enter the provider's address or village.";
    }

    if (address.length < 3) {
      return "Please enter a valid provider address.";
    }

    if (!formData.role) {
      return "Please select the provider role.";
    }

    if (!upiNumber) {
      return "Please enter a PhonePe, Google Pay number or UPI ID.";
    }

    if (upiNumber.length < 3) {
      return "Please enter a valid payment number or UPI ID.";
    }

    if (!formData.consent) {
      return "Please confirm that the provider has given consent.";
    }

    return "";
  }

  /* -------------------------------------------------
     Submit referral
  ------------------------------------------------- */
  async function handleSubmit(event) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    setError("");
    setSuccess("");

    const validationError =
      validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setSubmitting(true);

      const guestOwnerId =
        getGuestOwnerId();

      const cleanFullName =
        formData.fullName.trim();

      const cleanPhone =
        formData.phone.trim();

      const cleanAddress =
        formData.address.trim();

      const cleanUnionId =
        formData.unionId.trim();

      const cleanUpiNumber =
        formData.upiNumber.trim();

      const referralPayload = {
        /* Guest referrer details */
        referrerId: guestOwnerId,
        referrerUid: guestOwnerId,
        referrerUserId: guestOwnerId,

        referrerName: "Velzo User",
        referrerPhone: "",
        referrerEmail: "",

        /* Provider details */
        providerName: cleanFullName,
        fullName: cleanFullName,
        phone: cleanPhone,
        providerPhone: cleanPhone,

        address: cleanAddress,
        role: formData.role,

        unionId: cleanUnionId,
        unionLabourId: cleanUnionId,

        upiNumber: cleanUpiNumber,
        paymentNumber: cleanUpiNumber,

        /* Consent and status */
        consent: Boolean(formData.consent),
        status: "pending",
        paymentStatus: "pending",
        rewardStatus: "pending",

        /* Helpful metadata */
        source: "website",
        submittedAt: new Date(),
      };
     const submissionResult =
      await submitReferral(
    referralPayload
  );

if (
  submissionResult?.isDuplicateProvider ||
  submissionResult?.status ===
    "rejected"
) {
  setSuccess(
    "Referral rejected. This provider's mobile number already exists in VELZO records."
  );
} else {
  setSuccess(
    "Provider referral submitted successfully. It is waiting for verification."
  );
}

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
          "Unable to submit referral. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="referral-page">
      {/* -------------------------------------------------
         Header
      ------------------------------------------------- */}
      <header className="referral-header">
        <button
          type="button"
          className="back-button"
          onClick={() =>
            navigate("/dashboard")
          }
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

      {/* -------------------------------------------------
         Main content
      ------------------------------------------------- */}
      <main className="referral-container">
        {/* Intro section */}
        <section className="referral-intro">
          <div
            className="intro-icon"
            aria-hidden="true"
          >
            ＋
          </div>

          <div>
            <h2>Provider Information</h2>

            <p>
              Enter the provider details carefully.
              All information will be verified before approval.
            </p>
          </div>
        </section>

        {/* Form card */}
        <section className="referral-form-card">
          <form
            onSubmit={handleSubmit}
            noValidate
          >
            {/* Full name */}
            <div className="referral-field">
              <label htmlFor="fullName">
                Provider Full Name{" "}
                <span>*</span>
              </label>

              <input
                id="fullName"
                name="fullName"
                type="text"
                value={formData.fullName}
                onChange={handleChange}
                placeholder="Enter provider full name"
                autoComplete="name"
                maxLength={100}
                required
              />
            </div>

            {/* Phone number */}
            <div className="referral-field">
              <label htmlFor="phone">
                Provider Phone Number{" "}
                <span>*</span>
              </label>

              <div className="phone-input">
                <span aria-hidden="true">
                  +91
                </span>

                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  inputMode="numeric"
                  value={formData.phone}
                  onChange={handlePhoneChange}
                  placeholder="10-digit phone number"
                  maxLength={10}
                  autoComplete="tel"
                  required
                />
              </div>

              <small>
                Enter a valid 10-digit Indian mobile number.
              </small>
            </div>

            {/* Address */}
            <div className="referral-field">
              <label htmlFor="address">
                Address / Village{" "}
                <span>*</span>
              </label>

              <textarea
                id="address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="Enter provider address or village"
                rows={4}
                maxLength={300}
                required
              />

              <small>
                Mention the provider's village, town or locality.
              </small>
            </div>

            {/* Provider role */}
            <div className="referral-field">
              <label htmlFor="role">
                Provider Role{" "}
                <span>*</span>
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

            {/* Union ID */}
            <div className="referral-field">
              <label htmlFor="unionId">
                Union / Labour ID
              </label>

              <input
                id="unionId"
                name="unionId"
                type="text"
                value={formData.unionId}
                onChange={handleChange}
                placeholder="Optional"
                maxLength={80}
              />

              <small>
                Provide this only if the provider has a Union or Labour ID.
              </small>
            </div>

            {/* UPI / payment details */}
            <div className="referral-field">
              <label htmlFor="upiNumber">
                PhonePe / Google Pay / UPI{" "}
                <span>*</span>
              </label>

              <input
                id="upiNumber"
                name="upiNumber"
                type="text"
                value={formData.upiNumber}
                onChange={handleChange}
                placeholder="Enter payment number or UPI ID"
                maxLength={120}
                autoComplete="off"
                required
              />

              <small>
                Used for referral reward processing after verification.
              </small>
            </div>

            {/* Consent */}
            <div className="consent-box">
              <input
                id="consent"
                type="checkbox"
                name="consent"
                checked={formData.consent}
                onChange={handleChange}
                required
              />

              <label htmlFor="consent">
                Provider has given consent to be referred
                to VELZO. I confirm that the details
                entered above are correct.
              </label>
            </div>

            {/* Error message */}
            {error && (
              <div
                className="referral-error"
                role="alert"
              >
                {error}
              </div>
            )}

            {/* Success message */}
            {success && (
              <div
                className="referral-success"
                role="status"
              >
                {success}
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              className="referral-submit"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <span aria-hidden="true">
                    ⏳
                  </span>
                  Submitting...
                </>
              ) : (
                <>
                  <span aria-hidden="true">
                    ✓
                  </span>
                  Submit Referral
                </>
              )}
            </button>
          </form>
        </section>

        {/* Reward information */}
        <section className="referral-reward-info">
          <div className="reward-info-item">
            <strong>₹4</strong>

            <div>
              <h3>With Union / Labour ID</h3>

              <p>
                Earn ₹4 after the referred provider is
                verified and successfully approved.
              </p>
            </div>
          </div>

          <div className="reward-info-item">
            <strong>₹3</strong>

            <div>
              <h3>Without Union / Labour ID</h3>

              <p>
                Earn ₹3 after the referred provider is
                verified and successfully approved.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}