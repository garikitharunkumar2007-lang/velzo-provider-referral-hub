import {
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

// User pages
import Dashboard from "../pages/Dashboard";
import Profile from "../pages/Profile";
import Earnings from "../pages/Earnings";
import ReferProvider from "../pages/ReferProvider";
import ReferralHistory from "../pages/ReferralHistory";
import Notifications from "../pages/Notifications";
import Complaints from "../pages/Complaints";

// Admin pages
import Admin from "../pages/admin/Admin";
import AdminLogin from "../pages/admin/AdminLogin";
import AdminDashboard from "../pages/admin/AdminDashboard";
import AdminReferrals from "../pages/admin/AdminReferrals";
import AdminReferralDetails from "../pages/admin/AdminReferralDetails";
import AdminPayments from "../pages/admin/AdminPayments";
import AdminPaymentDetails from "../pages/admin/AdminPaymentDetails";
import AdminNotifications from "../pages/admin/AdminNotifications";
import AdminProfile from "../pages/admin/AdminProfile";
import AdminComplaints from "../pages/admin/AdminComplaints";
import AdminComplaintDetails from "../pages/admin/AdminComplaintDetails";

import { AdminGuard } from "./authGuard";

export default function AppRoutes() {
  return (
    <Routes>
      {/* ================= USER WEBSITE ================= */}

      <Route
        path="/"
        element={
          <Navigate
            to="/dashboard"
            replace
          />
        }
      />

      <Route
        path="/dashboard"
        element={<Dashboard />}
      />

      <Route
        path="/profile"
        element={<Profile />}
      />

      <Route
        path="/earnings"
        element={<Earnings />}
      />

      <Route
        path="/notifications"
        element={<Notifications />}
      />

      <Route
        path="/complaints"
        element={<Complaints />}
      />

      <Route
        path="/refer-provider"
        element={<ReferProvider />}
      />

      <Route
        path="/referral-history"
        element={<ReferralHistory />}
      />

      {/* Old user auth routes disabled */}
      <Route
        path="/login"
        element={
          <Navigate
            to="/dashboard"
            replace
          />
        }
      />

      <Route
        path="/register"
        element={
          <Navigate
            to="/dashboard"
            replace
          />
        }
      />

      {/* ================= ADMIN ================= */}

      <Route
        path="/admin/login"
        element={<AdminLogin />}
      />

      <Route element={<AdminGuard />}>
        <Route
          path="/admin"
          element={<Admin />}
        >
          <Route
            index
            element={
              <Navigate
                to="/admin/dashboard"
                replace
              />
            }
          />

          <Route
            path="dashboard"
            element={<AdminDashboard />}
          />

          <Route
            path="referrals"
            element={<AdminReferrals />}
          />

          <Route
            path="referrals/:referralId"
            element={<AdminReferralDetails />}
          />

          <Route
            path="payments"
            element={<AdminPayments />}
          />

          <Route
            path="payments/:paymentId"
            element={<AdminPaymentDetails />}
          />

          <Route
            path="notifications"
            element={<AdminNotifications />}
          />

          <Route
            path="complaints"
            element={<AdminComplaints />}
          />

          <Route
            path="complaints/:complaintId"
            element={<AdminComplaintDetails />}
          />

          <Route
            path="profile"
            element={<AdminProfile />}
          />
        </Route>
      </Route>

      {/* ================= FALLBACK ================= */}

      <Route
        path="*"
        element={
          <Navigate
            to="/dashboard"
            replace
          />
        }
      />
    </Routes>
  );
}