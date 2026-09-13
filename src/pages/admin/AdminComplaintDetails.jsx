import { useEffect, useState } from "react";
import {
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { useNavigate, useParams } from "react-router-dom";

import { db } from "../../firebase/firebaseConfig";

function formatDate(value) {
  if (!value) return "—";

  try {
    const date = value?.toDate
      ? value.toDate()
      : value instanceof Date
        ? value
        : new Date(value);

    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

function getStatusLabel(status) {
  const labels = {
    open: "Open",
    pending: "Pending",
    in_progress: "In Progress",
    resolved: "Resolved",
    closed: "Closed",
    rejected: "Rejected",
  };

  return labels[status] || status || "Unknown";
}

function getStatusClass(status) {
  const value = String(status || "")
    .toLowerCase()
    .replace(/\s+/g, "_");

  if (value === "resolved" || value === "closed") {
    return "status-badge status-success";
  }

  if (value === "in_progress") {
    return "status-badge status-info";
  }

  if (value === "rejected") {
    return "status-badge status-danger";
  }

  return "status-badge status-warning";
}

function getPriorityClass(priority) {
  const value = String(priority || "").toLowerCase();

  if (value === "urgent") {
    return "status-badge status-danger";
  }

  if (value === "high") {
    return "status-badge status-warning";
  }

  if (value === "low") {
    return "status-badge status-success";
  }

  return "status-badge status-info";
}

export default function AdminComplaintDetails() {
  const navigate = useNavigate();
  const { complaintId } = useParams();

  const [complaint, setComplaint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [status, setStatus] = useState("open");
  const [priority, setPriority] = useState("normal");
  const [adminReply, setAdminReply] = useState("");

  async function loadComplaint() {
    try {
      setLoading(true);
      setError("");

      if (!complaintId) {
        setError("Complaint ID is missing.");
        return;
      }

      const complaintReference = doc(
        db,
        "complaints",
        complaintId
      );

      const complaintSnapshot = await getDoc(
        complaintReference
      );

      if (!complaintSnapshot.exists()) {
        setError("Complaint not found.");
        return;
      }

      const complaintData = {
        id: complaintSnapshot.id,
        ...complaintSnapshot.data(),
      };

      setComplaint(complaintData);
      setStatus(complaintData.status || "open");
      setPriority(complaintData.priority || "normal");
      setAdminReply(complaintData.adminReply || "");
    } catch (err) {
      console.error("Failed to load complaint:", err);
      setError(
        "Unable to load complaint. Please check Firebase permissions."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadComplaint();
  }, [complaintId]);

  async function handleSave(event) {
    event.preventDefault();

    if (!complaintId) {
      setError("Complaint ID is missing.");
      return;
    }

    if (!status) {
      setError("Please select a complaint status.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const updateData = {
        status,
        priority,
        adminReply: adminReply.trim(),
        updatedAt: serverTimestamp(),
      };

      if (status === "resolved" || status === "closed") {
        updateData.resolvedAt = serverTimestamp();
      } else {
        updateData.resolvedAt = null;
      }

      await updateDoc(
        doc(db, "complaints", complaintId),
        updateData
      );

      setComplaint((previous) => ({
        ...previous,
        status,
        priority,
        adminReply: adminReply.trim(),
      }));

      setSuccess("Complaint updated successfully.");
    } catch (err) {
      console.error("Failed to update complaint:", err);
      setError(
        "Unable to update complaint. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleQuickStatusChange(nextStatus) {
    if (!complaintId) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const updateData = {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      };

      if (
        nextStatus === "resolved" ||
        nextStatus === "closed"
      ) {
        updateData.resolvedAt = serverTimestamp();
      } else {
        updateData.resolvedAt = null;
      }

      await updateDoc(
        doc(db, "complaints", complaintId),
        updateData
      );

      setStatus(nextStatus);

      setComplaint((previous) => ({
        ...previous,
        status: nextStatus,
      }));

      setSuccess(
        `Complaint marked as ${getStatusLabel(nextStatus)}.`
      );
    } catch (err) {
      console.error(
        "Failed to change complaint status:",
        err
      );

      setError("Unable to change complaint status.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="admin-page">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading complaint details...</p>
        </div>
      </div>
    );
  }

  if (!complaint) {
    return (
      <div className="admin-page">
        <div className="admin-page-header">
          <div>
            <h1>Complaint Not Found</h1>
            <p>The requested complaint could not be found.</p>
          </div>
        </div>

        {error && (
          <div className="alert alert-error">
            {error}
          </div>
        )}

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => navigate("/admin/complaints")}
        >
          Back to Complaints
        </button>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate("/admin/complaints")}
          >
            ← Back to Complaints
          </button>

          <div style={{ marginTop: "16px" }}>
            <span className="eyebrow">SUPPORT TICKET</span>

            <h1>
              {complaint.subject || "Complaint Details"}
            </h1>

            <p>
              Complaint ID: {complaint.id}
            </p>
          </div>
        </div>

        <div className="admin-header-actions">
          <span
            className={getStatusClass(complaint.status)}
          >
            {getStatusLabel(complaint.status)}
          </span>

          <span
            className={getPriorityClass(complaint.priority)}
          >
            {complaint.priority || "Normal"}
          </span>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          {success}
        </div>
      )}

      <div className="details-grid">
        <div className="details-card">
          <div className="details-card-header">
            <h2>Complaint Information</h2>
          </div>

          <div className="details-card-body">
            <div className="detail-row">
              <span className="detail-label">
                Complaint ID
              </span>

              <span className="detail-value">
                {complaint.id}
              </span>
            </div>

            <div className="detail-row">
              <span className="detail-label">
                Category
              </span>

              <span className="detail-value">
                {complaint.category || "General"}
              </span>
            </div>

            <div className="detail-row">
              <span className="detail-label">
                Created At
              </span>

              <span className="detail-value">
                {formatDate(complaint.createdAt)}
              </span>
            </div>

            <div className="detail-row">
              <span className="detail-label">
                Last Updated
              </span>

              <span className="detail-value">
                {formatDate(complaint.updatedAt)}
              </span>
            </div>

            <div className="detail-row">
              <span className="detail-label">
                Resolved At
              </span>

              <span className="detail-value">
                {formatDate(complaint.resolvedAt)}
              </span>
            </div>
          </div>
        </div>

        <div className="details-card">
          <div className="details-card-header">
            <h2>User Information</h2>
          </div>

          <div className="details-card-body">
            <div className="detail-row">
              <span className="detail-label">
                Name
              </span>

              <span className="detail-value">
                {complaint.userName ||
                  complaint.name ||
                  "Unknown User"}
              </span>
            </div>

            <div className="detail-row">
              <span className="detail-label">
                Phone
              </span>

              <span className="detail-value">
                {complaint.userPhone ||
                  complaint.phone ||
                  "Not available"}
              </span>
            </div>

            <div className="detail-row">
              <span className="detail-label">
                User ID
              </span>

              <span className="detail-value">
                {complaint.userId || "Not available"}
              </span>
            </div>

            <div className="detail-row">
              <span className="detail-label">
                Booking ID
              </span>

              <span className="detail-value">
                {complaint.bookingId || "Not related"}
              </span>
            </div>
          </div>
        </div>

        <div className="details-card">
          <div className="details-card-header">
            <h2>Provider Information</h2>
          </div>

          <div className="details-card-body">
            <div className="detail-row">
              <span className="detail-label">
                Provider Name
              </span>

              <span className="detail-value">
                {complaint.providerName || "Not available"}
              </span>
            </div>

            <div className="detail-row">
              <span className="detail-label">
                Provider Phone
              </span>

              <span className="detail-value">
                {complaint.providerPhone || "Not available"}
              </span>
            </div>

            <div className="detail-row">
              <span className="detail-label">
                Provider ID
              </span>

              <span className="detail-value">
                {complaint.providerId || "Not available"}
              </span>
            </div>
          </div>
        </div>

        <div className="details-card">
          <div className="details-card-header">
            <h2>Complaint Description</h2>
          </div>

          <div className="details-card-body">
            <p className="details-description">
              {complaint.description ||
                "No description was provided."}
            </p>
          </div>
        </div>
      </div>

      <div className="details-card">
        <div className="details-card-header">
          <h2>Manage Complaint</h2>
          <p>
            Update the complaint status, priority and admin reply.
          </p>
        </div>

        <div className="details-card-body">
          <div className="quick-actions">
            <button
              type="button"
              className="btn btn-warning"
              disabled={saving}
              onClick={() =>
                handleQuickStatusChange("in_progress")
              }
            >
              Mark In Progress
            </button>

            <button
              type="button"
              className="btn btn-success"
              disabled={saving}
              onClick={() =>
                handleQuickStatusChange("resolved")
              }
            >
              Mark Resolved
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              disabled={saving}
              onClick={() =>
                handleQuickStatusChange("closed")
              }
            >
              Close Complaint
            </button>
          </div>

          <form onSubmit={handleSave}>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="complaint-status">
                  Status
                </label>

                <select
                  id="complaint-status"
                  className="form-select"
                  value={status}
                  onChange={(event) =>
                    setStatus(event.target.value)
                  }
                  disabled={saving}
                >
                  <option value="open">Open</option>
                  <option value="pending">Pending</option>
                  <option value="in_progress">
                    In Progress
                  </option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="complaint-priority">
                  Priority
                </label>

                <select
                  id="complaint-priority"
                  className="form-select"
                  value={priority}
                  onChange={(event) =>
                    setPriority(event.target.value)
                  }
                  disabled={saving}
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="admin-reply">
                Admin Reply
              </label>

              <textarea
                id="admin-reply"
                className="form-textarea"
                rows="6"
                placeholder="Write a response to the user..."
                value={adminReply}
                onChange={(event) =>
                  setAdminReply(event.target.value)
                }
                disabled={saving}
              />
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={saving}
                onClick={() =>
                  navigate("/admin/complaints")
                }
              >
                Cancel
              </button>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : "Save Complaint Changes"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}