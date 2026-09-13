import React from "react";

export default function ConfirmDialog({
  open,
  title = "Confirm Action",
  message = "Are you sure you want to continue?",
  confirmText = "Confirm",
  cancelText = "Cancel",
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="dialog-overlay">
      <div className="confirm-dialog">
        <div className="confirm-dialog-icon">
          {danger ? "⚠️" : "❔"}
        </div>

        <h3>{title}</h3>

        <p>{message}</p>

        <div className="confirm-dialog-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelText}
          </button>

          <button
            type="button"
            className={danger ? "danger-button" : "primary-button"}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Please wait..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}