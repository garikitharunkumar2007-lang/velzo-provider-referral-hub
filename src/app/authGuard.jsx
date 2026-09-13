import {
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";

function readStorage(key) {
  try {
    const localValue =
      localStorage.getItem(key);

    if (localValue) {
      return localValue;
    }

    const sessionValue =
      sessionStorage.getItem(key);

    return sessionValue;
  } catch (error) {
    console.error(
      "Storage read error:",
      error
    );

    return null;
  }
}

function getAdminSession() {
  const sessionValue =
    readStorage("velzoAdminSession");

  if (!sessionValue) {
    return null;
  }

  try {
    return JSON.parse(sessionValue);
  } catch (error) {
    console.error(
      "Invalid admin session:",
      error
    );

    return null;
  }
}

function isAdminSessionValid() {
  const adminSession =
    getAdminSession();

  if (!adminSession) {
    return false;
  }

  const role =
    String(
      adminSession.role ||
        adminSession.userRole ||
        ""
    )
      .trim()
      .toLowerCase()
      .replace(/_/g, "-")
      .replace(/\s+/g, "-");

  const allowedAdminRoles = [
    "admin",
    "referral-admin",
    "referraladmin",
    "super-admin",
    "superadmin",
  ];

  return (
    adminSession.isAdmin === true ||
    allowedAdminRoles.includes(role)
  );
}

export function AdminGuard() {
  const location = useLocation();

  const isAdmin =
    isAdminSessionValid();

  if (!isAdmin) {
    return (
      <Navigate
        to="/admin/login"
        replace
        state={{
          from: location.pathname,
        }}
      />
    );
  }

  return <Outlet />;
}