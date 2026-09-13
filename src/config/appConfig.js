// src/config/appConfig.js

export const APP_CONFIG = {
  appName: "VELZO",

  adminPortalName: "VELZO Admin Portal",

  firebaseProjectId: "helpmate-3cb4f",

  currency: "INR",

  currencySymbol: "₹",

  velzoCharge: 10,

  referralRewards: {
    withUnionId: 4,
    withoutUnionId: 3,
    pending: 0,
  },

  referralStatuses: {
    pending: "pending",
    verified: "verified",
    approved: "approved",
    rejected: "rejected",
    successful: "successful",
  },

  paymentStatuses: {
    pending: "pending",
    processing: "processing",
    paid: "paid",
    failed: "failed",
    cancelled: "cancelled",
  },

  bookingStatuses: {
    pending: "pending",
    accepted: "accepted",
    assigned: "assigned",
    inProgress: "in_progress",
    completed: "completed",
    cancelled: "cancelled",
    rejected: "rejected",
  },

  complaintStatuses: {
    open: "open",
    underReview: "under_review",
    resolved: "resolved",
    rejected: "rejected",
    closed: "closed",
  },

  masterCollections: [
    "tadepalliguedem_mechanics",
    "union_master_list",
  ],

  firestoreCollections: {
    users: "users",
    providers: "providers",
    bookings: "bookings",
    payments: "payments",
    complaints: "complaints",
    referrals: "referrals",
    notifications: "notifications",
    settings: "settings",
  },

  adminRoutes: {
    dashboard: "/admin/dashboard",
    users: "/admin/users",
    providers: "/admin/providers",
    bookings: "/admin/bookings",
    payments: "/admin/payments",
    complaints: "/admin/complaints",
    referrals: "/admin/referrals",
    rewards: "/admin/rewards",
    reports: "/admin/reports",
    notifications: "/admin/notifications",
    settings: "/admin/settings",
    profile: "/admin/profile",
  },
};

export default APP_CONFIG;