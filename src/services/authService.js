// src/services/authService.js

import {
  browserLocalPersistence,
  browserSessionPersistence,
  onAuthStateChanged,
  setPersistence,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore";

import {
  auth,
  db,
} from "../firebase/firebaseConfig";

/* =====================================================
   STORAGE KEYS
===================================================== */

const USER_STORAGE_KEY = "velzoUser";
const ADMIN_STORAGE_KEY = "velzoAdminSession";

/* =====================================================
   BASIC HELPERS
===================================================== */

/**
 * Convert any value into a safe string.
 */
function safeString(value) {
  return String(value ?? "").trim();
}

/**
 * Normalize email.
 */
export function normalizeEmail(email) {
  return safeString(email).toLowerCase();
}

/**
 * Validate email.
 */
export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    normalizeEmail(email)
  );
}

/**
 * Get only digits.
 */
export function getDigitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

/**
 * Normalize Indian phone number.
 */
export function normalizePhone(value) {
  const digits = getDigitsOnly(value);

  return digits.slice(-10);
}

/**
 * Validate Indian phone number.
 */
export function isValidIndianPhone(value) {
  return /^[6-9]\d{9}$/.test(
    normalizePhone(value)
  );
}

/* =====================================================
   ROLE HELPERS
===================================================== */

/**
 * Normalize role values.
 *
 * Admin
 * admin
 * referral_admin
 * referral admin
 */
export function normalizeRole(role) {
  return safeString(role)
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/\s+/g, "-");
}

/**
 * Check admin role.
 */
export function isAdminRole(role) {
  const normalizedRole = normalizeRole(role);

  return [
    "admin",
    "referral-admin",
    "referraladmin",
    "super-admin",
    "superadmin",
  ].includes(normalizedRole);
}

/**
 * Check disabled account.
 */
export function isAccountDisabled(userData = {}) {
  const status = normalizeRole(userData.status);

  return (
    userData.isActive === false ||
    status === "disabled" ||
    status === "blocked" ||
    status === "suspended"
  );
}

/* =====================================================
   SAFE PROFILE HELPERS
===================================================== */

/**
 * Never store sensitive data in browser storage.
 */
function removeSensitiveFields(profile = {}) {
  const safeProfile = {
    ...profile,
  };

  delete safeProfile.password;
  delete safeProfile.passwordHash;
  delete safeProfile.token;
  delete safeProfile.accessToken;
  delete safeProfile.refreshToken;

  return safeProfile;
}

/**
 * Create one standard profile object.
 */
function createSafeUserProfile(
  userData = {},
  documentId = "",
  firebaseUser = null
) {
  const firebaseUid = firebaseUser?.uid || "";

  const firebaseEmail = normalizeEmail(
    firebaseUser?.email || ""
  );

  const phone =
    userData.phone ||
    userData.phoneNumber ||
    "";

  const email = normalizeEmail(
    userData.email ||
      firebaseEmail ||
      ""
  );

  const name =
    userData.name ||
    userData.fullName ||
    userData.displayName ||
    firebaseUser?.displayName ||
    "Administrator";

  const role =
    userData.role ||
    "user";

  return removeSensitiveFields({
    id: documentId || "",

    uid:
      firebaseUid ||
      userData.uid ||
      "",

    name,

    fullName:
      userData.fullName ||
      name,

    displayName:
      userData.displayName ||
      name,

    email,

    phone,

    phoneNumber:
      userData.phoneNumber ||
      phone,

    role,

    isAdmin: isAdminRole(role),

    isActive:
      userData.isActive !== false,

    status:
      userData.status ||
      "active",

    photoURL:
      userData.photoURL ||
      userData.photoUrl ||
      userData.profilePhoto ||
      userData.profileImage ||
      userData.profileImageUrl ||
      firebaseUser?.photoURL ||
      "",

    profilePhoto:
      userData.profilePhoto ||
      userData.profileImage ||
      userData.profileImageUrl ||
      userData.photoURL ||
      "",

    referralHubEnabled:
      userData.referralHubEnabled !== false,
  });
}

/* =====================================================
   SESSION STORAGE HELPERS
===================================================== */

/**
 * Save normal user session.
 *
 * Only one storage location is used.
 */
export function saveUserSession(
  userProfile,
  rememberMe = false
) {
  const safeProfile =
    removeSensitiveFields(userProfile);

  localStorage.removeItem(USER_STORAGE_KEY);
  sessionStorage.removeItem(USER_STORAGE_KEY);

  const storage = rememberMe
    ? localStorage
    : sessionStorage;

  storage.setItem(
    USER_STORAGE_KEY,
    JSON.stringify(safeProfile)
  );

  return safeProfile;
}

/**
 * Save admin session.
 *
 * Admin profile is also saved into velzoUser
 * because some old parts of the project may read it.
 */
export function saveAdminSession(
  adminProfile,
  rememberMe = true
) {
  const safeProfile =
    removeSensitiveFields({
      ...adminProfile,
      isAdmin: true,
      role: adminProfile.role || "admin",
    });

  /*
   * Clear previous account data first.
   */
  clearUserSession();
  clearAdminSession();

  const storage = rememberMe
    ? localStorage
    : sessionStorage;

  /*
   * Save admin-specific session.
   */
  storage.setItem(
    ADMIN_STORAGE_KEY,
    JSON.stringify(safeProfile)
  );

  /*
   * Save common session for compatibility.
   */
  storage.setItem(
    USER_STORAGE_KEY,
    JSON.stringify(safeProfile)
  );

  return safeProfile;
}

/**
 * Read normal user session.
 */
export function readStoredUser() {
  const storedUser =
    localStorage.getItem(USER_STORAGE_KEY) ||
    sessionStorage.getItem(USER_STORAGE_KEY);

  if (!storedUser) {
    return null;
  }

  try {
    const parsedUser =
      JSON.parse(storedUser);

    if (
      !parsedUser ||
      typeof parsedUser !== "object"
    ) {
      return null;
    }

    return parsedUser;
  } catch (error) {
    console.error(
      "Unable to read stored user session:",
      error
    );

    return null;
  }
}

/**
 * Read admin session.
 */
export function readStoredAdmin() {
  const storedAdmin =
    localStorage.getItem(ADMIN_STORAGE_KEY) ||
    sessionStorage.getItem(ADMIN_STORAGE_KEY);

  if (!storedAdmin) {
    return null;
  }

  try {
    const parsedAdmin =
      JSON.parse(storedAdmin);

    if (
      !parsedAdmin ||
      typeof parsedAdmin !== "object"
    ) {
      return null;
    }

    return parsedAdmin;
  } catch (error) {
    console.error(
      "Unable to read stored admin session:",
      error
    );

    return null;
  }
}

/**
 * Clear normal user session.
 */
export function clearUserSession() {
  localStorage.removeItem(USER_STORAGE_KEY);
  sessionStorage.removeItem(USER_STORAGE_KEY);

  localStorage.removeItem("currentUser");
  sessionStorage.removeItem("currentUser");
}

/**
 * Clear admin session.
 */
export function clearAdminSession() {
  localStorage.removeItem(ADMIN_STORAGE_KEY);
  sessionStorage.removeItem(ADMIN_STORAGE_KEY);
}

/**
 * Clear every VELZO session.
 */
export function clearAllSessions() {
  clearUserSession();
  clearAdminSession();

  localStorage.removeItem("velzo_admin");
  sessionStorage.removeItem("velzo_admin");
}

/* =====================================================
   FIRESTORE PROFILE SEARCH
===================================================== */

/**
 * Find user by document ID / phone number.
 */
export async function findUserByPhone(phone) {
  const cleanPhone =
    normalizePhone(phone);

  if (!cleanPhone) {
    return {
      exists: false,
      id: null,
      userData: null,
    };
  }

  const phoneVariants = [
    cleanPhone,
    `+91${cleanPhone}`,
    `91${cleanPhone}`,
  ];

  /*
   * First search document IDs.
   */
  for (const phoneVariant of phoneVariants) {
    try {
      const userReference = doc(
        db,
        "users",
        phoneVariant
      );

      const userSnapshot =
        await getDoc(userReference);

      if (userSnapshot.exists()) {
        return {
          exists: true,
          id: userSnapshot.id,
          userData: userSnapshot.data() || {},
        };
      }
    } catch (error) {
      console.warn(
        `Unable to read users/${phoneVariant}:`,
        error
      );
    }
  }

  /*
   * Then search phone fields.
   */
  const phoneFields = [
    "phone",
    "phoneNumber",
    "mobile",
    "mobileNumber",
  ];

  for (const fieldName of phoneFields) {
    for (const phoneVariant of phoneVariants) {
      try {
        const usersQuery = query(
          collection(db, "users"),
          where(fieldName, "==", phoneVariant),
          limit(1)
        );

        const snapshot =
          await getDocs(usersQuery);

        if (!snapshot.empty) {
          const userDocument =
            snapshot.docs[0];

          return {
            exists: true,
            id: userDocument.id,
            userData: userDocument.data() || {},
          };
        }
      } catch (error) {
        console.warn(
          `Unable to search ${fieldName}:`,
          error
        );
      }
    }
  }

  return {
    exists: false,
    id: null,
    userData: null,
  };
}

/**
 * Find profile by Firebase UID.
 */
export async function getUserProfileByUid(uid) {
  const cleanUid = safeString(uid);

  if (!cleanUid) {
    return null;
  }

  try {
    const usersQuery = query(
      collection(db, "users"),
      where("uid", "==", cleanUid),
      limit(1)
    );

    const snapshot =
      await getDocs(usersQuery);

    if (snapshot.empty) {
      return null;
    }

    const userDocument =
      snapshot.docs[0];

    return {
      id: userDocument.id,
      ...userDocument.data(),
    };
  } catch (error) {
    console.error(
      "Unable to find profile by Firebase UID:",
      error
    );

    return null;
  }
}

/**
 * Find profile by email.
 */
export async function getUserProfileByEmail(email) {
  const cleanEmail =
    normalizeEmail(email);

  if (!cleanEmail) {
    return null;
  }

  try {
    const usersQuery = query(
      collection(db, "users"),
      where("email", "==", cleanEmail),
      limit(1)
    );

    const snapshot =
      await getDocs(usersQuery);

    if (snapshot.empty) {
      return null;
    }

    const userDocument =
      snapshot.docs[0];

    return {
      id: userDocument.id,
      ...userDocument.data(),
    };
  } catch (error) {
    console.error(
      "Unable to find profile by email:",
      error
    );

    return null;
  }
}

/**
 * Find profile from either:
 *
 * 1. UID
 * 2. Email
 */
export async function findProfileForFirebaseUser(
  firebaseUser
) {
  if (!firebaseUser) {
    return null;
  }

  /*
   * UID is the safest lookup.
   */
  let profile =
    await getUserProfileByUid(
      firebaseUser.uid
    );

  if (profile) {
    return profile;
  }

  /*
   * Email fallback.
   */
  if (firebaseUser.email) {
    profile =
      await getUserProfileByEmail(
        firebaseUser.email
      );
  }

  return profile;
}

/* =====================================================
   NORMAL USER VERIFICATION
===================================================== */

/**
 * Verify normal user exists in Firestore.
 */
export async function verifyUserRegistered(phone) {
  const result =
    await findUserByPhone(phone);

  if (!result.exists) {
    const error = new Error(
      "No VELZO account found with this mobile number. Please create an account in the VELZO mobile app first."
    );

    error.code = "USER_NOT_FOUND";

    throw error;
  }

  const userData =
    result.userData || {};

  if (isAccountDisabled(userData)) {
    const error = new Error(
      "Your VELZO account is disabled. Please contact VELZO support."
    );

    error.code = "USER_ACCOUNT_DISABLED";

    throw error;
  }

  return result;
}

/* =====================================================
   NORMAL USER FIREBASE SESSION
===================================================== */

/**
 * Normal users use anonymous Firebase session.
 */
export async function createFirebaseSession() {
  if (auth.currentUser) {
    return auth.currentUser;
  }

  const anonymousResult =
    await signInAnonymously(auth);

  return anonymousResult.user;
}

/* =====================================================
   NORMAL USER LOGIN
===================================================== */

/**
 * Normal user login.
 */
export async function loginNormalUser(
  phone,
  rememberMe = false
) {
  const verificationResult =
    await verifyUserRegistered(phone);

  const firebaseUser =
    await createFirebaseSession();

  const safeUserProfile =
    createSafeUserProfile(
      verificationResult.userData,
      verificationResult.id,
      firebaseUser
    );

  const savedUser =
    saveUserSession(
      {
        ...safeUserProfile,

        phone:
          safeUserProfile.phone ||
          normalizePhone(phone),

        role:
          safeUserProfile.role ||
          "user",

        isAdmin: false,

        loginType:
          "anonymous",
      },
      rememberMe
    );

  return {
    success: true,
    mode: "user",
    exists: true,
    isAdmin: false,
    user: savedUser,
    firebaseUser,
  };
}

/* =====================================================
   ADMIN LOGIN
===================================================== */

/**
 * Admin login using real Firebase email/password.
 *
 * Flow:
 *
 * 1. Validate email/password
 * 2. Firebase email/password authentication
 * 3. Get Firebase UID
 * 4. Find Firestore profile by UID
 * 5. Fallback to email search
 * 6. Verify admin role
 * 7. Verify account status
 * 8. Clear old sessions
 * 9. Save current admin profile
 */
export async function loginAdmin(
  email,
  password,
  rememberMe = true
) {
  const cleanEmail =
    normalizeEmail(email);

  const cleanPassword =
    String(password || "");

  /*
   * Validate email.
   */
  if (!cleanEmail) {
    const error = new Error(
      "Please enter your admin email address."
    );

    error.code = "auth/missing-email";

    throw error;
  }

  if (!isValidEmail(cleanEmail)) {
    const error = new Error(
      "Please enter a valid admin email address."
    );

    error.code = "auth/invalid-email";

    throw error;
  }

  /*
   * Validate password.
   */
  if (!cleanPassword.trim()) {
    const error = new Error(
      "Please enter your admin password."
    );

    error.code = "auth/missing-password";

    throw error;
  }

  let loginResult;

  try {
    /*
     * Remember me:
     *
     * true  = local persistence
     * false = browser session persistence
     */
    await setPersistence(
      auth,
      rememberMe
        ? browserLocalPersistence
        : browserSessionPersistence
    );

    /*
     * Firebase actual email/password login.
     */
    loginResult =
      await signInWithEmailAndPassword(
        auth,
        cleanEmail,
        cleanPassword
      );
  } catch (error) {
    console.error(
      "Firebase admin authentication failed:",
      error
    );

    throw error;
  }

  const firebaseUser =
    loginResult.user;

  /*
   * Find Firestore profile.
   */
  const profileResult =
    await findProfileForFirebaseUser(
      firebaseUser
    );

  /*
   * Profile is mandatory.
   */
  if (!profileResult) {
    await signOut(auth);
    clearAllSessions();

    const error = new Error(
      "Admin profile was not found in the VELZO database. Please add a Firestore users profile with this email or Firebase UID."
    );

    error.code = "ADMIN_NOT_FOUND";

    throw error;
  }

  const userData =
    profileResult;

  const role =
    userData.role || "user";

  /*
   * Verify admin role.
   */
  if (!isAdminRole(role)) {
    await signOut(auth);
    clearAllSessions();

    const error = new Error(
      "Access denied. This account does not have admin permissions."
    );

    error.code = "ADMIN_ROLE_REQUIRED";

    throw error;
  }

  /*
   * Verify account status.
   */
  if (isAccountDisabled(userData)) {
    await signOut(auth);
    clearAllSessions();

    const error = new Error(
      "This admin account is disabled. Please contact support."
    );

    error.code = "ADMIN_ACCOUNT_DISABLED";

    throw error;
  }

  /*
   * Create current admin profile.
   */
  const adminProfile =
    createSafeUserProfile(
      {
        ...userData,

        /*
         * Always use the actual Firebase email.
         */
        email:
          firebaseUser.email ||
          cleanEmail,

        /*
         * Always use the actual Firebase UID.
         */
        uid:
          firebaseUser.uid,

        role,
      },
      profileResult.id || "",
      firebaseUser
    );

  /*
   * Save only current admin data.
   */
  const savedAdmin =
    saveAdminSession(
      {
        ...adminProfile,

        uid:
          firebaseUser.uid,

        email:
          firebaseUser.email ||
          cleanEmail,

        adminEmail:
          firebaseUser.email ||
          cleanEmail,

        firebaseEmail:
          firebaseUser.email ||
          cleanEmail,

        role,

        isAdmin: true,

        loginType:
          "firebase-email-password",

        loginTime:
          new Date().toISOString(),
      },
      rememberMe
    );

  return {
    success: true,
    mode: "admin",
    exists: true,
    isAdmin: true,
    admin: savedAdmin,
    user: savedAdmin,
    firebaseUser,
  };
}

/* =====================================================
   COMPATIBLE LOGIN FUNCTION
===================================================== */

/**
 * Supports:
 *
 * Normal user:
 * loginUser({ phone })
 *
 * Admin:
 * loginUser({
 *   email,
 *   password,
 *   isAdmin: true
 * })
 *
 * Admin:
 * loginUser(email, password, true)
 *
 * Legacy normal:
 * loginUser(phone)
 */
export async function loginUser(
  firstArgument,
  secondArgument = "",
  thirdArgument = false
) {
  /*
   * Object format.
   */
  if (
    firstArgument &&
    typeof firstArgument === "object"
  ) {
    const {
      phone,
      phoneNumber,
      email,
      password,
      isAdmin,
      rememberMe = false,
    } = firstArgument;

    /*
     * Admin object format.
     */
    if (
      isAdmin === true ||
      safeString(email) ||
      safeString(password)
    ) {
      return loginAdmin(
        email,
        password,
        rememberMe
      );
    }

    /*
     * Normal user object format.
     */
    return loginNormalUser(
      phone || phoneNumber || "",
      rememberMe
    );
  }

  /*
   * Explicit admin format:
   *
   * loginUser(email, password, true)
   */
  if (thirdArgument === true) {
    return loginAdmin(
      firstArgument,
      secondArgument,
      true
    );
  }

  /*
   * If second argument is present,
   * treat first argument as admin email.
   */
  if (safeString(secondArgument)) {
    return loginAdmin(
      firstArgument,
      secondArgument,
      true
    );
  }

  /*
   * Normal user phone login.
   */
  return loginNormalUser(
    firstArgument,
    false
  );
}

/* =====================================================
   CURRENT PROFILE
===================================================== */

/**
 * Get currently logged-in profile.
 */
export async function getCurrentUserProfile() {
  const firebaseUser =
    auth.currentUser;

  const storedAdmin =
    readStoredAdmin();

  /*
   * Admin profile first.
   */
  if (
    storedAdmin &&
    isAdminRole(storedAdmin.role)
  ) {
    return storedAdmin;
  }

  /*
   * If Firebase user exists,
   * fetch the latest Firestore profile.
   */
  if (firebaseUser) {
    const profile =
      await findProfileForFirebaseUser(
        firebaseUser
      );

    if (profile) {
      return createSafeUserProfile(
        profile,
        profile.id || "",
        firebaseUser
      );
    }

    return {
      uid: firebaseUser.uid,
      email: firebaseUser.email || "",
      name:
        firebaseUser.displayName ||
        "VELZO User",
      phone: "",
      role: "user",
      isAdmin: false,
    };
  }

  /*
   * Normal stored user fallback.
   */
  const storedUser =
    readStoredUser();

  return storedUser;
}

/* =====================================================
   CURRENT FIREBASE USER
===================================================== */

/**
 * Get Firebase authenticated user.
 */
export function getCurrentAuthUser() {
  return auth.currentUser;
}

/**
 * Subscribe to Firebase auth state.
 */
export function subscribeToAuthState(callback) {
  return onAuthStateChanged(
    auth,
    callback
  );
}

/* =====================================================
   LOGIN STATUS
===================================================== */

/**
 * Check any login status.
 */
export function isUserLoggedIn() {
  return Boolean(
    auth.currentUser ||
      readStoredUser()
  );
}

/**
 * Check admin login status.
 */
export function isAdminLoggedIn() {
  const storedAdmin =
    readStoredAdmin();

  return Boolean(
    storedAdmin &&
      isAdminRole(storedAdmin.role)
  );
}

/* =====================================================
   LOGOUT USER
===================================================== */

/**
 * Logout normal user.
 */
export async function logoutUser() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error(
      "Firebase user logout failed:",
      error
    );
  } finally {
    clearUserSession();
  }
}

/* =====================================================
   LOGOUT ADMIN
===================================================== */

/**
 * Logout admin.
 */
export async function logoutAdmin() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error(
      "Firebase admin logout failed:",
      error
    );
  } finally {
    clearAllSessions();
  }
}

/* =====================================================
   GENERAL LOGOUT
===================================================== */

/**
 * Logout every account.
 */
export async function logout() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error(
      "Firebase logout failed:",
      error
    );
  } finally {
    clearAllSessions();
  }
}

/* =====================================================
   AUTH ERROR MESSAGE
===================================================== */

/**
 * Convert Firebase errors into readable messages.
 */
export function getAuthErrorMessage(error) {
  if (!error) {
    return "Something went wrong. Please try again.";
  }

  const errorCode =
    error.code || "";

  switch (errorCode) {
    case "auth/invalid-credential":
      return "Invalid admin email or password.";

    case "auth/invalid-login-credentials":
      return "Invalid admin email or password.";

    case "auth/wrong-password":
      return "Invalid admin email or password.";

    case "auth/user-not-found":
      return "No Firebase account found with this email address.";

    case "auth/invalid-email":
      return "Please enter a valid email address.";

    case "auth/missing-email":
      return "Please enter your admin email address.";

    case "auth/missing-password":
      return "Please enter your admin password.";

    case "auth/user-disabled":
      return "This Firebase account has been disabled.";

    case "auth/email-already-in-use":
      return "This email address is already registered.";

    case "auth/weak-password":
      return "Please use a stronger password.";

    case "auth/operation-not-allowed":
      return "Email/password authentication is not enabled in Firebase.";

    case "auth/network-request-failed":
      return "Network error. Please check your internet connection.";

    case "auth/too-many-requests":
      return "Too many login attempts. Please try again later.";

    case "auth/requires-recent-login":
      return "Please login again and retry this action.";

    case "permission-denied":
      return "You do not have permission to access this data.";

    case "unauthenticated":
      return "Your session has expired. Please login again.";

    case "USER_NOT_FOUND":
      return "No VELZO account found with this mobile number.";

    case "USER_ACCOUNT_DISABLED":
      return "Your VELZO account is disabled.";

    case "ADMIN_NOT_FOUND":
      return "Admin Firestore profile was not found.";

    case "ADMIN_ROLE_REQUIRED":
      return "This account does not have admin permissions.";

    case "ADMIN_ACCOUNT_DISABLED":
      return "This admin account is disabled.";

    default:
      return (
        error.message ||
        "Unable to authenticate. Please try again."
      );
  }
}

/* =====================================================
   DEFAULT EXPORT
===================================================== */

export default {
  normalizeEmail,
  isValidEmail,

  getDigitsOnly,
  normalizePhone,
  isValidIndianPhone,

  normalizeRole,
  isAdminRole,
  isAccountDisabled,

  saveUserSession,
  saveAdminSession,

  readStoredUser,
  readStoredAdmin,

  clearUserSession,
  clearAdminSession,
  clearAllSessions,

  findUserByPhone,
  getUserProfileByUid,
  getUserProfileByEmail,
  findProfileForFirebaseUser,

  verifyUserRegistered,
  createFirebaseSession,

  loginNormalUser,
  loginAdmin,
  loginUser,

  getCurrentUserProfile,
  getCurrentAuthUser,
  subscribeToAuthState,

  isUserLoggedIn,
  isAdminLoggedIn,

  logoutUser,
  logoutAdmin,
  logout,

  getAuthErrorMessage,
};