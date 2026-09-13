import React, { useState } from "react";
import { NavLink } from "react-router-dom";

const menuItems = [
  {
    label: "Dashboard",
    path: "/admin/dashboard",
    icon: "🏠",
  },
  {
    label: "Referrals",
    path: "/admin/referrals",
    icon: "🤝",
  },
  {
    label: "Payments",
    path: "/admin/payments",
    icon: "💳",
  },
  {
    label: "Complaints",
    path: "/admin/complaints",
    icon: "⚠️",
  },
  {
    label: "Notifications",
    path: "/admin/notifications",
    icon: "🔔",
  },
];

export default function MobileMenu() {
  const [open, setOpen] = useState(false);

  return (
    <div className="mobile-menu-wrapper">
      <button
        type="button"
        className="mobile-menu-toggle"
        onClick={() => setOpen((previous) => !previous)}
        aria-label="Toggle menu"
      >
        {open ? "✕" : "☰"}
      </button>

      {open && (
        <div className="mobile-menu-panel">
          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `mobile-menu-link ${isActive ? "active" : ""}`
              }
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}