import React from "react";

export default function StatCard({
  title,
  value,
  icon = "📊",
  description,
  trend,
  className = "",
}) {
  return (
    <div className={`stat-card ${className}`}>
      <div className="stat-card-top">
        <div className="stat-card-icon">{icon}</div>

        {trend && <span className="stat-card-trend">{trend}</span>}
      </div>

      <div className="stat-card-content">
        <p className="stat-card-title">{title}</p>

        <h3 className="stat-card-value">{value}</h3>

        {description && (
          <small className="stat-card-description">
            {description}
          </small>
        )}
      </div>
    </div>
  );
}