import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
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

function ReferProvider() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [formData, setFormData] = useState(INITIAL_FORM_DATA);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;

    setFormData((previousData) => ({
      ...previousData,
      [name]: type === "checkbox" ? checked : value,
    }));

    setError("");
    setSuccess("");
  };

  const handlePhoneChange = (event) => {
    const numericValue = event.target.value.replace(/\D/g, "");

    if (numericValue.length <= 10) {
      setFormData((previousData) => ({
        ...previousData,
        phone: numericValue,
      }));
    }

    setError("");
    setSuccess("");
  };

  const validateForm = () => {
    const fullName = formData.fullName.trim();
    const phone = formData.phone.trim();
    const address = formData.address.trim();
    const unionId = formData.unionId.trim();
    const upiNumber = formData.upiNumber.trim();

    if (!fullName) {
      return "Please enter the provider's full name.";
    }

    if (fullName.length < 3) {
      return "Provider's name must contain at least 3 characters.";
    }

    if (!/^\d{10}$/.test(phone)) {
      return "Please enter a valid 10-digit phone number.";
    }

    if (!address) {
      return "Please enter the provider's address or village.";
    }

    if (address.length < 3) {
      return "Please enter a valid provider address or village.";
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

    return null;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (submitting) {
      return;
    }

    setError("");
    setSuccess("");

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setSubmitting(true);

      const referrerId =
        user?.uid ||
        user?.id ||
        user?.userId ||
        user?.phone ||
        user?.phoneNumber ||
        user?.profile?.id ||
        user?.userData?.id ||
        "";

      if (!referrerId) {
        throw new Error(
          "Your user identity is not available. Please logout and login again."
        );
      }

      const referralPayload = {
        referrerId,
        referrerUid: user?.uid || "",
        referrerUserId: user?.id || user?.userId || "",
        referrerName:
          user?.displayName ||
          user?.name ||
          user?.fullName ||
          "",
        referrerPhone:
          user?.phoneNumber || user?.phone || "",
        referrerEmail: user?.email || "",

        providerName: formData.fullName.trim(),
        fullName: formData.fullName.trim(),

        phone: formData.phone.trim(),
        address: formData.address.trim(),
        role: formData.role,
        unionId: formData.unionId.trim(),

        upiNumber: formData.upiNumber.trim(),

        consent: formData.consent,

        status: "pending",
      };

      const referralId = await submitReferral(referralPayload);

      console.log("Referral created successfully:", referralId);

      setSuccess(
        "Provider referral submitted successfully. It is now waiting for verification."
      );

      setFormData({ ...INITIAL_FORM_DATA });
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

  return (
    <div className="referral-page">
      {/* HEADER */}
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

      {/* MAIN CONTENT */}
      <main className="referral-container">
        {/* INFORMATION CARD */}
        <section className="referral-intro">
          <div className="intro-icon" aria-hidden="true">
            ＋
          </div>

          <div>
            <h2>Provider Information</h2>

            <p>
              Enter the provider's details carefully. Our team
              will verify the information before approving the
              referral.
            </p>
          </div>
        </section>

        {/* FORM CARD */}
        <section className="referral-form-card">
          <form onSubmit={handleSubmit} noValidate>
            {/* FULL NAME */}
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

            {/* PHONE NUMBER */}
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

            {/* ADDRESS */}
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

            {/* PROVIDER ROLE */}
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

                {PROVIDER_ROLES.map((providerRole) => (
                  <option
                    key={providerRole.value}
                    value={providerRole.value}
                  >
                    {providerRole.label}
                  </option>
                ))}
              </select>
            </div>

            {/* UNION / LABOUR ID */}
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
                Providing a valid Union / Labour ID may qualify
                the successful referral for the ₹4 reward.
              </small>
            </div>

            {/* UPI / PAYMENT DETAILS */}
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
                This will be used only for referral reward
                payment after successful admin approval.
              </small>
            </div>

            {/* CONSENT */}
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
                I confirm that the provider has given consent
                to be referred to VELZO.
              </label>
            </div>

            {/* ERROR MESSAGE */}
            {error && (
              <div
                className="referral-error"
                role="alert"
                aria-live="assertive"
              >
                {error}
              </div>
            )}

            {/* SUCCESS MESSAGE */}
            {success && (
              <div
                className="referral-success"
                role="status"
                aria-live="polite"
              >
                ✓ {success}
              </div>
            )}

            {/* SUBMIT BUTTON */}
            <button
              type="submit"
              className="referral-submit"
              disabled={submitting}
            >
              {submitting ? "Submitting..." : "Submit Referral"}

              {!submitting && (
                <span aria-hidden="true">→</span>
              )}
            </button>
          </form>
        </section>

        {/* REWARD INFORMATION */}
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