import React from "react";

function normalizeStatus(status) {
  return String(status || "unknown")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function getStatusLabel(status) {
  const labels = {
    pending: "Pending",
    submitted: "Submitted",
    under_review: "Under Review",
    approved: "Approved",
    accepted: "Accepted",
    rejected: "Rejected",
    completed: "Completed",
    paid: "Paid",
    processing: "Processing",
    failed: "Failed",
    not_paid: "Not Paid",
    pending_payment: "Pending Payment",
    resolved: "Resolved",
    open: "Open",
    closed: "Closed",
    cancelled: "Cancelled",
    active: "Active",
    inactive: "Inactive",
    unknown: "Unknown",
  };

  return labels[normalizeStatus(status)] || String(status || "Unknown");
}

export default function StatusBadge({
  status,
  value,
  className = "",
}) {
  const finalStatus = status ?? value ?? "unknown";
  const normalizedStatus = normalizeStatus(finalStatus);

  return (
    <span
      className={`status-badge status-${normalizedStatus} ${className}`}
    >
      {getStatusLabel(finalStatus)}
    </span>
  );
}