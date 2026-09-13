import React, { useState } from "react";
import { Outlet } from "react-router-dom";

import AdminHeader from "./AdminHeader";
import AdminSidebar from "./AdminSidebar";

import "./AdminLayout.css";

function AdminLayout({
  children,
  adminProfile = null,
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const pageContent = children || <Outlet />;

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  const toggleSidebar = () => {
    setSidebarOpen((previousState) => {
      return !previousState;
    });
  };

  return (
    <div className="admin-layout">
      <AdminSidebar
        isOpen={sidebarOpen}
        onClose={closeSidebar}
        adminProfile={adminProfile}
      />

      <div className="admin-layout-main">
        <AdminHeader
          onMenuClick={toggleSidebar}
          adminProfile={adminProfile}
        />

        <main className="admin-layout-content">
          {pageContent}
        </main>
      </div>

      {sidebarOpen && (
        <button
          type="button"
          className="admin-layout-overlay"
          aria-label="Close admin sidebar"
          onClick={closeSidebar}
        />
      )}
    </div>
  );
}

export default AdminLayout;