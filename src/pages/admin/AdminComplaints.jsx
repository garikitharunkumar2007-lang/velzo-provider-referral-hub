import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  getDocs,
  orderBy,
  query,
} from "firebase/firestore";

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

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
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

function getPriorityLabel(priority) {
  const labels = {
    low: "Low",
    normal: "Normal",
    high: "High",
    urgent: "Urgent",
  };

  return labels[priority] || priority || "Normal";
}

function getStatusClass(status) {
  const value = normalizeText(status).replace(/\s+/g, "_");

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
  const value = normalizeText(priority);

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

export default function AdminComplaints() {
  const navigate = useNavigate();

  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  async function loadComplaints() {
    try {
      setLoading(true);
      setError("");

      const complaintsQuery = query(
        collection(db, "complaints"),
        orderBy("createdAt", "desc")
      );

      const snapshot = await getDocs(complaintsQuery);

      const complaintData = snapshot.docs.map((documentSnapshot) => ({
        id: documentSnapshot.id,
        ...documentSnapshot.data(),
      }));

      setComplaints(complaintData);
    } catch (err) {
      console.error("Failed to load complaints:", err);

      /*
       * If createdAt ordering fails because some old documents
       * do not contain createdAt, load the collection without orderBy.
       */
      try {
        const fallbackSnapshot = await getDocs(
          collection(db, "complaints")
        );

        const fallbackData = fallbackSnapshot.docs.map(
          (documentSnapshot) => ({
            id: documentSnapshot.id,
            ...documentSnapshot.data(),
          })
        );

        fallbackData.sort((first, second) => {
          const firstDate = first.createdAt?.toDate
            ? first.createdAt.toDate()
            : new Date(first.createdAt || 0);

          const secondDate = second.createdAt?.toDate
            ? second.createdAt.toDate()
            : new Date(second.createdAt || 0);

          return secondDate - firstDate;
        });

        setComplaints(fallbackData);
      } catch (fallbackError) {
        console.error(
          "Fallback complaint loading failed:",
          fallbackError
        );

        setError(
          "Unable to load complaints. Please check Firebase permissions."
        );
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadComplaints();
  }, []);

  const categoryOptions = useMemo(() => {
    const categories = complaints
      .map((complaint) => complaint.category)
      .filter(Boolean)
      .map((category) => String(category).trim());

    return [...new Set(categories)].sort((first, second) =>
      first.localeCompare(second)
    );
  }, [complaints]);

  const filteredComplaints = useMemo(() => {
    const queryText = normalizeText(search);

    return complaints.filter((complaint) => {
      const searchableText = [
        complaint.id,
        complaint.subject,
        complaint.description,
        complaint.category,
        complaint.userName,
        complaint.userPhone,
        complaint.providerName,
        complaint.providerPhone,
        complaint.bookingId,
        complaint.userId,
        complaint.providerId,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !queryText || searchableText.includes(queryText);

      const matchesStatus =
        statusFilter === "all" ||
        normalizeText(complaint.status) === normalizeText(statusFilter);

      const matchesPriority =
        priorityFilter === "all" ||
        normalizeText(complaint.priority) ===
          normalizeText(priorityFilter);

      const matchesCategory =
        categoryFilter === "all" ||
        normalizeText(complaint.category) ===
          normalizeText(categoryFilter);

      return (
        matchesSearch &&
        matchesStatus &&
        matchesPriority &&
        matchesCategory
      );
    });
  }, [
    complaints,
    search,
    statusFilter,
    priorityFilter,
    categoryFilter,
  ]);

  const summary = useMemo(() => {
    return {
      total: complaints.length,
      open: complaints.filter((complaint) =>
        ["open", "pending"].includes(normalizeText(complaint.status))
      ).length,
      inProgress: complaints.filter(
        (complaint) =>
          normalizeText(complaint.status) === "in_progress"
      ).length,
      resolved: complaints.filter((complaint) =>
        ["resolved", "closed"].includes(
          normalizeText(complaint.status)
        )
      ).length,
      urgent: complaints.filter(
        (complaint) =>
          normalizeText(complaint.priority) === "urgent"
      ).length,
    };
  }, [complaints]);

  if (loading) {
    return (
      <div className="admin-page">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading complaints...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <span className="eyebrow">CUSTOMER SUPPORT</span>
          <h1>Complaints</h1>
          <p>
            Review user complaints and manage support resolutions.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={loadComplaints}
        >
          ↻ Refresh
        </button>
      </div>

      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Complaints</div>
          <div className="stat-value">{summary.total}</div>
          <div className="stat-description">
            All submitted complaints
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Open</div>
          <div className="stat-value">{summary.open}</div>
          <div className="stat-description">
            Waiting for action
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">In Progress</div>
          <div className="stat-value">{summary.inProgress}</div>
          <div className="stat-description">
            Currently being handled
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Resolved</div>
          <div className="stat-value">{summary.resolved}</div>
          <div className="stat-description">
            Completed complaints
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Urgent</div>
          <div className="stat-value">{summary.urgent}</div>
          <div className="stat-description">
            High-priority attention needed
          </div>
        </div>
      </div>

      <div className="admin-toolbar">
        <input
          type="search"
          className="form-input"
          placeholder="Search complaints, users, providers..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <select
          className="form-select"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="all">All Statuses</option>
          <option value="open">Open</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
          <option value="rejected">Rejected</option>
        </select>

        <select
          className="form-select"
          value={priorityFilter}
          onChange={(event) => setPriorityFilter(event.target.value)}
        >
          <option value="all">All Priorities</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="normal">Normal</option>
          <option value="low">Low</option>
        </select>

        <select
          className="form-select"
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
        >
          <option value="all">All Categories</option>

          {categoryOptions.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </div>

      <div className="admin-section">
        <div className="admin-section-header">
          <div>
            <h2>Complaint Records</h2>
            <p>
              Showing {filteredComplaints.length} of{" "}
              {complaints.length} complaints
            </p>
          </div>
        </div>

        {filteredComplaints.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">✓</div>
            <h3>No complaints found</h3>
            <p>
              There are no complaints matching the selected filters.
            </p>
          </div>
        ) : (
          <div className="table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Complaint</th>
                  <th>User</th>
                  <th>Category</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredComplaints.map((complaint) => (
                  <tr key={complaint.id}>
                    <td>
                      <div className="table-primary">
                        {complaint.subject || "Untitled Complaint"}
                      </div>

                      <div className="table-secondary">
                        ID: {complaint.id}
                      </div>
                    </td>

                    <td>
                      <div className="table-primary">
                        {complaint.userName ||
                          complaint.name ||
                          "Unknown User"}
                      </div>

                      <div className="table-secondary">
                        {complaint.userPhone ||
                          complaint.phone ||
                          "Phone unavailable"}
                      </div>
                    </td>

                    <td>
                      {complaint.category || "General"}
                    </td>

                    <td>
                      <span
                        className={getPriorityClass(
                          complaint.priority
                        )}
                      >
                        {getPriorityLabel(complaint.priority)}
                      </span>
                    </td>

                    <td>
                      <span
                        className={getStatusClass(
                          complaint.status
                        )}
                      >
                        {getStatusLabel(complaint.status)}
                      </span>
                    </td>

                    <td>
                      {formatDate(complaint.createdAt)}
                    </td>

                    <td>
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={() =>
                          navigate(
                            `/admin/complaints/${complaint.id}`
                          )
                        }
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}