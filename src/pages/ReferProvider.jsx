import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { submitReferral } from "../firebase/referralService";

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

const GUEST_STORAGE_KEY =
  "velzoGuestReferralOwner";

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

export default function ReferProvider() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState(
    INITIAL_FORM_DATA
  );

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
      return "Please enter a valid 10-digit phone number.";
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

      const referralPayload = {
        referrerId: guestOwnerId,
        referrerUid: guestOwnerId,
        referrerUserId: guestOwnerId,

        referrerName: "Website User",
        referrerPhone: "",
        referrerEmail: "",

        providerName:
          formData.fullName.trim(),

        fullName:
          formData.fullName.trim(),

        phone:
          formData.phone.trim(),

        address:
          formData.address.trim(),

        role:
          formData.role,

        unionId:
          formData.unionId.trim(),

        upiNumber:
          formData.upiNumber.trim(),

        consent:
          formData.consent,

        status: "pending",
      };

      await submitReferral(
        referralPayload
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
          "Unable to submit referral. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="referral-page">
      <header className="referral-header">
        <button
          type="button"
          className="back-button"
          onClick={() =>
            navigate("/dashboard")
          }
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
            </p>
          </div>
        </section>

        <form
          className="referral-form"
          onSubmit={handleSubmit}
        >
          <label htmlFor="fullName">
            Provider Full Name
          </label>

          <input
            id="fullName"
            name="fullName"
            type="text"
            value={formData.fullName}
            onChange={handleChange}
            placeholder="Enter provider full name"
            required
          />

          <label htmlFor="phone">
            Provider Phone Number
          </label>

          <input
            id="phone"
            name="phone"
            type="tel"
            inputMode="numeric"
            value={formData.phone}
            onChange={handlePhoneChange}
            placeholder="10-digit phone number"
            maxLength={10}
            required
          />

          <label htmlFor="address">
            Address / Village
          </label>

          <textarea
            id="address"
            name="address"
            value={formData.address}
            onChange={handleChange}
            placeholder="Enter provider address or village"
            rows={3}
            required
          />

          <label htmlFor="role">
            Provider Role
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
          />

          <label htmlFor="upiNumber">
            PhonePe / Google Pay / UPI
          </label>

          <input
            id="upiNumber"
            name="upiNumber"
            type="text"
            value={formData.upiNumber}
            onChange={handleChange}
            placeholder="Enter payment number or UPI ID"
            required
          />

          <label className="consent-row">
            <input
              type="checkbox"
              name="consent"
              checked={formData.consent}
              onChange={handleChange}
            />

            <span>
              Provider has given consent to be referred
              to VELZO.
            </span>
          </label>

          {error && (
            <div className="form-error">
              {error}
            </div>
          )}

          {success && (
            <div className="form-success">
              {success}
            </div>
          )}

          <button
            type="submit"
            className="submit-button"
            disabled={submitting}
          >
            {submitting
              ? "Submitting..."
              : "Submit Referral"}
          </button>
        </form>
      </main>
    </div>
  );
}