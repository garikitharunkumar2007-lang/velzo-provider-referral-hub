import React from "react";

export default function LoadingState({
  message = "Loading, please wait...",
}) {
  return (
    <div className="loading-state">
      <div className="loading-spinner" />

      <p>{message}</p>
    </div>
  );
}