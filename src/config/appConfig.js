// src/config/appConfig.js

export const APP_CONFIG = {
  // ================================
  // APP INFORMATION
  // ================================

  appName: "VELZO",

  adminPortalName: "VELZO Admin Portal",

  firebaseProjectId: "helpmate-3cb4f",

  currency: "INR",

  currencySymbol: "₹",

  velzoCharge: 10,

  // ================================
  // REFERRAL REWARDS
  // ================================

  referralRewards: {
    withUnionId: 4,

    withoutUnionId: 3,

    pending: 0,
  },

  // ================================
  // REFERRAL STATUSES
  // ================================

  referralStatuses: {
    pending: "pending",

    verified: "verified",

    approved: "approved",

    rejected: "rejected",

    successful: "successful",

    paid: "paid",
  },

  // ================================
  // PAYMENT STATUSES
  // ================================

  paymentStatuses: {
    pending: "pending",

    processing: "processing",

    paid: "paid",

    completed: "completed",

    failed: "failed",

    cancelled: "cancelled",

    notPaid: "not_paid",
  },

  // ================================
  // BOOKING STATUSES
  // ================================

  bookingStatuses: {
    pending: "pending",

    accepted: "accepted",

    assigned: "assigned",

    inProgress: "in_progress",

    completed: "completed",

    cancelled: "cancelled",

    rejected: "rejected",
  },

  // ================================
  // COMPLAINT STATUSES
  // ================================

  complaintStatuses: {
    open: "open",

    underReview: "under_review",

    resolved: "resolved",

    rejected: "rejected",

    closed: "closed",
  },

  // ================================
  // MASTER COLLECTIONS
  // ================================

  masterCollections: [
    // Tanuku Mechanics
    "tanuku_mechanics",

    // Tanuku Plumbers
    "tanuku_plumbers",

    // Existing Collections
    "tadepalligudem_mechanics",

    "union_master_list",

    "verifiedProviders",
  ],

  // ================================
  // FIRESTORE COLLECTIONS
  // ================================

  firestoreCollections: {
    users: "users",

    providers: "providers",

    bookings: "bookings",

    payments: "payments",

    complaints: "complaints",

    referrals: "referrals",

    verifiedProviders: "verifiedProviders",

    notifications: "notifications",

    settings: "settings",

    // Tanuku Collections
    tanukuMechanics: "tanuku_mechanics",

    tanukuPlumbers: "tanuku_plumbers",
  },

  // ================================
  // ADMIN ROUTES
  // ================================

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