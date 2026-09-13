import React from "react";

export default function EmptyState({
  title = "No records found",
  message = "There is no data available at the moment.",
  actionLabel,
  onAction,
}) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">📭</div>

      <h3>{title}</h3>

      <p>{message}</p>

      {actionLabel && onAction && (
        <button
          type="button"
          className="primary-button"
          onClick={onAction}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}