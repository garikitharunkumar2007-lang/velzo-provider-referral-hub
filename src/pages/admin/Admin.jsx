import React, { useMemo } from "react";
import {
  Navigate,
  Outlet,
} from "react-router-dom";

import AdminLayout from "../../components/AdminLayout";

function getStoredAdminSession() {
  try {
    const storedSession =
      localStorage.getItem("velzoAdminSession") ||
      sessionStorage.getItem("velzoAdminSession");

    if (!storedSession) {
      return null;
    }

    const parsedSession = JSON.parse(storedSession);

    if (
      !parsedSession ||
      typeof parsedSession !== "object"
    ) {
      return null;
    }

    const isAdmin =
      parsedSession.role === "admin" ||
      parsedSession.userRole === "admin" ||
      parsedSession.isAdmin === true ||
      parsedSession.user?.role === "admin" ||
      parsedSession.profile?.role === "admin";

    if (!isAdmin) {
      return null;
    }

    return parsedSession;
  } catch (error) {
    console.error(
      "Unable to read admin session:",
      error
    );

    return null;
  }
}

function getAdminProfile(adminSession) {
  if (!adminSession) {
    return null;
  }

  /*
   * Some login implementations save profile data
   * inside "profile" or "user".
   */

  const sessionProfile =
    adminSession.profile ||
    adminSession.user ||
    adminSession;

  return {
    uid:
      sessionProfile.uid ||
      adminSession.uid ||
      "",

    name:
      sessionProfile.name ||
      sessionProfile.fullName ||
      sessionProfile.displayName ||
      adminSession.name ||
      adminSession.fullName ||
      adminSession.displayName ||
      "Administrator",

    email:
      sessionProfile.email ||
      adminSession.email ||
      "",

    phone:
      sessionProfile.phone ||
      sessionProfile.phoneNumber ||
      adminSession.phone ||
      adminSession.phoneNumber ||
      "",

    role:
      sessionProfile.role ||
      sessionProfile.userRole ||
      adminSession.role ||
      adminSession.userRole ||
      "Administrator",

    photoURL:
      sessionProfile.photoURL ||
      sessionProfile.photoUrl ||
      sessionProfile.profileImage ||
      sessionProfile.profileImageUrl ||
      adminSession.photoURL ||
      adminSession.photoUrl ||
      "",

    isActive:
      sessionProfile.isActive ??
      adminSession.isActive ??
      true,
  };
}

export default function Admin() {
  const adminSession = getStoredAdminSession();

  const adminProfile = useMemo(() => {
    return getAdminProfile(adminSession);
  }, [adminSession]);

  if (!adminSession || !adminProfile) {
    return (
      <Navigate
        to="/admin/login"
        replace
      />
    );
  }

  return (
    <AdminLayout
      adminProfile={adminProfile}
    >
      <Outlet />
    </AdminLayout>
  );
}