import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";

import { db } from "../firebase/firebaseConfig";
import { useAuth } from "../hooks/useAuth";

import "./Complaints.css";

const INITIAL_FORM = {
  subject: "",
  category: "",
  description: "",
  priority: "normal",
};

const COMPLAINT_CATEGORIES = [
  {
    value: "referral",
    label: "Referral Issue",
  },
  {
    value: "payment",
    label: "Payment Issue",
  },
  {
    value: "account",
    label: "Account Issue",
  },
  {
    value: "technical",
    label: "Technical Problem",
  },
  {
    value: "provider",
    label: "Provider Related",
  },
  {
    value: "other",
    label: "Other",
  },
];

const normalizeStatus = (status) => {
  if (!status) {
    return "open";
  }

  return String(status)
    .trim()
    .toLowerCase()
    .replaceAll("-", "_")
    .replaceAll(" ", "_");
};

const getDateValue = (timestamp) => {
  if (!timestamp) {
    return null;
  }

  if (typeof timestamp.toDate === "function") {
    return timestamp.toDate();
  }

  if (timestamp.seconds) {
    return new Date(timestamp.seconds * 1000);
  }

  const date = new Date(timestamp);

  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDate = (timestamp) => {
  const date = getDateValue(timestamp);

  if (!date) {
    return "Recently";
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const getStatusLabel = (status) => {
  switch (normalizeStatus(status)) {
    case "resolved":
      return "Resolved";

    case "closed":
      return "Closed";

    case "in_progress":
      return "In Progress";

    case "under_review":
      return "Under Review";

    case "rejected":
      return "Rejected";

    default:
      return "Open";
  }
};

const getStatusClass = (status) => {
  switch (normalizeStatus(status)) {
    case "resolved":
    case "closed":
      return "complaint-status resolved";

    case "in_progress":
    case "under_review":
      return "complaint-status progress";

    case "rejected":
      return "complaint-status rejected";

    default:
      return "complaint-status open";
  }
};

const getPriorityClass = (priority) => {
  switch (String(priority).toLowerCase()) {
    case "high":
      return "complaint-priority high";

    case "urgent":
      return "complaint-priority urgent";

    case "low":
      return "complaint-priority low";

    default:
      return "complaint-priority normal";
  }
};

function Complaints() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [formData, setFormData] = useState(INITIAL_FORM);
  const [complaints, setComplaints] = useState([]);

  const [loadingComplaints, setLoadingComplaints] =
    useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const userId =
    user?.uid ||
    user?.id ||
    "";

  const userPhone =
    user?.phone ||
    user?.phoneNumber ||
    "";

  const userName =
    user?.displayName ||
    user?.name ||
    user?.fullName ||
    "VELZO User";

  const userEmail = user?.email || "";

  const userIdentifier = useMemo(() => {
    return userId || userPhone || userEmail;
  }, [userId, userPhone, userEmail]);

  useEffect(() => {
    if (authLoading) {
      return undefined;
    }

    if (!userIdentifier) {
      setComplaints([]);
      setLoadingComplaints(false);

      return undefined;
    }

    setLoadingComplaints(true);
    setError("");

    const complaintsQuery = query(
      collection(db, "complaints"),
      where("userId", "==", userIdentifier),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      complaintsQuery,
      (snapshot) => {
        const complaintList = snapshot.docs.map(
          (documentSnapshot) => ({
            id: documentSnapshot.id,
            ...documentSnapshot.data(),
          })
        );

        setComplaints(complaintList);
        setLoadingComplaints(false);
      },
      (snapshotError) => {
        console.error(
          "Unable to load complaints:",
          snapshotError
        );

        /*
         * If Firestore requires an index, the complaints
         * can still be displayed after the index is created.
         */
        if (
          snapshotError?.code === "failed-precondition"
        ) {
          setError(
            "Firestore index is required for complaints. Please create the index in Firebase Console."
          );
        } else if (
          snapshotError?.code === "permission-denied"
        ) {
          setError(
            "You do not have permission to view complaints."
          );
        } else {
          setError(
            "Unable to load your complaints. Please try again."
          );
        }

        setLoadingComplaints(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [authLoading, userIdentifier]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((previousForm) => ({
      ...previousForm,
      [name]: value,
    }));

    setError("");
    setSuccess("");
  };

  const validateForm = () => {
    if (!formData.subject.trim()) {
      return "Please enter a complaint subject.";
    }

    if (formData.subject.trim().length < 5) {
      return "Complaint subject must contain at least 5 characters.";
    }

    if (!formData.category) {
      return "Please select a complaint category.";
    }

    if (!formData.description.trim()) {
      return "Please describe your complaint.";
    }

    if (formData.description.trim().length < 15) {
      return "Complaint description must contain at least 15 characters.";
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

    if (!userIdentifier) {
      setError(
        "Unable to identify your account. Please login again."
      );

      return;
    }

    try {
      setSubmitting(true);

      const complaintPayload = {
        userId: userIdentifier,
        userUid: userId || "",
        userName,
        userPhone,
        userEmail,

        subject: formData.subject.trim(),
        category: formData.category,
        description: formData.description.trim(),
        priority: formData.priority,

        status: "open",
        adminReply: "",
        resolvedAt: null,

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const complaintReference = await addDoc(
        collection(db, "complaints"),
        complaintPayload
      );

      console.log(
        "Complaint submitted:",
        complaintReference.id
      );

      setFormData({ ...INITIAL_FORM });

      setSuccess(
        "Your complaint has been submitted successfully. Our admin team will review it soon."
      );
    } catch (submissionError) {
      console.error(
        "Unable to submit complaint:",
        submissionError
      );

      if (
        submissionError?.code === "permission-denied"
      ) {
        setError(
          "Complaint submission was blocked by Firestore security rules."
        );
      } else {
        setError(
          submissionError?.message ||
            "Unable to submit your complaint. Please try again."
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="complaints-page">
      <header className="complaints-header">
        <button
          type="button"
          className="complaints-back-button"
          onClick={() => navigate("/dashboard")}
          aria-label="Back to dashboard"
        >
          ←
        </button>

        <div>
          <span className="complaints-eyebrow">
            VELZO SUPPORT CENTER
          </span>

          <h1>Complaint Box</h1>

          <p>
            Report an issue and track your complaint status.
          </p>
        </div>
      </header>

      <main className="complaints-container">
        <section className="complaints-intro-card">
          <div className="complaints-intro-icon">
            ⚠
          </div>

          <div>
            <h2>How can we help you?</h2>

            <p>
              Submit your complaint with clear details.
              Our admin team will review it and update
              the status.
            </p>
          </div>
        </section>

        <section className="complaint-form-card">
          <div className="complaints-section-heading">
            <span className="complaints-eyebrow">
              NEW COMPLAINT
            </span>

            <h2>Submit a Complaint</h2>

            <p>
              All fields marked with * are required.
            </p>
          </div>

          <form
            className="complaint-form"
            onSubmit={handleSubmit}
            noValidate
          >
            <div className="complaint-form-grid">
              <div className="complaint-field full-width">
                <label htmlFor="subject">
                  Complaint Subject <span>*</span>
                </label>

                <input
                  id="subject"
                  name="subject"
                  type="text"
                  placeholder="Enter complaint subject"
                  value={formData.subject}
                  onChange={handleChange}
                  maxLength={120}
                  required
                />
              </div>

              <div className="complaint-field">
                <label htmlFor="category">
                  Category <span>*</span>
                </label>

                <select
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  required
                >
                  <option value="">
                    Select category
                  </option>

                  {COMPLAINT_CATEGORIES.map(
                    (category) => (
                      <option
                        key={category.value}
                        value={category.value}
                      >
                        {category.label}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div className="complaint-field">
                <label htmlFor="priority">
                  Priority
                </label>

                <select
                  id="priority"
                  name="priority"
                  value={formData.priority}
                  onChange={handleChange}
                >
                  <option value="low">
                    Low
                  </option>

                  <option value="normal">
                    Normal
                  </option>

                  <option value="high">
                    High
                  </option>

                  <option value="urgent">
                    Urgent
                  </option>
                </select>
              </div>

              <div className="complaint-field full-width">
                <label htmlFor="description">
                  Complaint Description <span>*</span>
                </label>

                <textarea
                  id="description"
                  name="description"
                  rows={6}
                  placeholder="Explain your issue clearly..."
                  value={formData.description}
                  onChange={handleChange}
                  maxLength={1500}
                  required
                />

                <small>
                  {formData.description.length}/1500
                  characters
                </small>
              </div>
            </div>

            {error && (
              <div
                className="complaint-message error"
                role="alert"
              >
                {error}
              </div>
            )}

            {success && (
              <div
                className="complaint-message success"
                role="status"
              >
                ✓ {success}
              </div>
            )}

            <div className="complaint-form-actions">
              <button
                type="button"
                className="complaint-secondary-button"
                onClick={() => navigate("/dashboard")}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="complaint-submit-button"
                disabled={submitting}
              >
                {submitting
                  ? "Submitting..."
                  : "Submit Complaint"}

                {!submitting && (
                  <span aria-hidden="true">
                    →
                  </span>
                )}
              </button>
            </div>
          </form>
        </section>

        <section className="complaints-history-section">
          <div className="complaints-section-heading">
            <span className="complaints-eyebrow">
              SUPPORT HISTORY
            </span>

            <h2>My Complaints</h2>

            <p>
              View the complaints submitted from your account.
            </p>
          </div>

          {loadingComplaints ? (
            <div className="complaints-empty-card">
              <div className="complaints-loader">
                ⟳
              </div>

              <h3>Loading complaints...</h3>

              <p>
                Please wait while we fetch your support history.
              </p>
            </div>
          ) : complaints.length === 0 ? (
            <div className="complaints-empty-card">
              <div className="complaints-empty-icon">
                ✓
              </div>

              <h3>No complaints submitted</h3>

              <p>
                Your submitted complaints will appear here.
              </p>
            </div>
          ) : (
            <div className="complaints-list">
              {complaints.map((complaint) => (
                <article
                  className="complaint-history-card"
                  key={complaint.id}
                >
                  <div className="complaint-history-top">
                    <div>
                      <span className="complaint-reference">
                        Complaint ID: {complaint.id.slice(0, 8)}
                      </span>

                      <h3>
                        {complaint.subject}
                      </h3>
                    </div>

                    <span
                      className={getStatusClass(
                        complaint.status
                      )}
                    >
                      {getStatusLabel(
                        complaint.status
                      )}
                    </span>
                  </div>

                  <div className="complaint-history-meta">
                    <span>
                      Category:{" "}
                      <strong>
                        {complaint.category || "Other"}
                      </strong>
                    </span>

                    <span
                      className={getPriorityClass(
                        complaint.priority
                      )}
                    >
                      Priority:{" "}
                      {complaint.priority || "Normal"}
                    </span>

                    <span>
                      {formatDate(
                        complaint.createdAt
                      )}
                    </span>
                  </div>

                  <p className="complaint-history-description">
                    {complaint.description}
                  </p>

                  {complaint.adminReply && (
                    <div className="admin-reply-box">
                      <strong>
                        Admin Response
                      </strong>

                      <p>
                        {complaint.adminReply}
                      </p>
                    </div>
                  )}

                  {complaint.resolvedAt && (
                    <div className="complaint-resolved-note">
                      Resolved on{" "}
                      {formatDate(
                        complaint.resolvedAt
                      )}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default Complaints;