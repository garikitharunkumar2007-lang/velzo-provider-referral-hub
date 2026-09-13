import {
  createContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  onAuthStateChanged,
  signOut,
} from "firebase/auth";

import {
  doc,
  getDoc,
} from "firebase/firestore";

import {
  auth,
  db,
} from "../firebase/firebaseConfig";

export const AuthContext = createContext(null);

/* =========================================
   ROLE HELPERS
========================================= */

function normalizeRole(role) {
  return String(role || "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]/g, "-");
}

function getAdminRoles() {
  return [
    "admin",
    "referral-admin",
    "referraladmin",
    "super-admin",
    "superadmin",
  ];
}

/* =========================================
   SESSION HELPERS
========================================= */

function getStoredSession() {
  try {
    const localSession =
      localStorage.getItem("velzoUser");

    const sessionStorageSession =
      sessionStorage.getItem("velzoUser");

    const storedSession =
      localSession || sessionStorageSession;

    if (!storedSession) {
      return null;
    }

    return JSON.parse(storedSession);
  } catch (error) {
    console.error(
      "Failed to read VELZO session:",
      error
    );

    return null;
  }
}

function getUserDocumentId(firebaseUser) {
  if (!firebaseUser) {
    return null;
  }

  const storedSession = getStoredSession();

  const possiblePhoneValues = [
    storedSession?.phone,
    storedSession?.phoneNumber,
    firebaseUser.phoneNumber,
  ];

  const phoneValue = possiblePhoneValues.find(
    (value) => value !== undefined && value !== null
  );

  if (!phoneValue) {
    return null;
  }

  const cleanedPhone = String(phoneValue).replace(
    /\D/g,
    ""
  );

  if (!cleanedPhone) {
    return null;
  }

  return cleanedPhone.slice(-10);
}

/* =========================================
   FIRESTORE PROFILE
========================================= */

async function getUserProfile(firebaseUser) {
  if (!firebaseUser) {
    return null;
  }

  const userDocumentId =
    getUserDocumentId(firebaseUser);

  if (!userDocumentId) {
    console.warn(
      "VELZO user document ID could not be determined."
    );

    return null;
  }

  try {
    const userRef = doc(
      db,
      "users",
      userDocumentId
    );

    const userSnapshot = await getDoc(userRef);

    if (!userSnapshot.exists()) {
      console.warn(
        "VELZO user profile not found:",
        userDocumentId
      );

      return null;
    }

    return {
      id: userSnapshot.id,
      ...userSnapshot.data(),
    };
  } catch (error) {
    console.error(
      "Failed to load VELZO user profile:",
      error
    );

    return null;
  }
}

/* =========================================
   AUTH PROVIDER
========================================= */

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const unsubscribe = onAuthStateChanged(
      auth,
      async (currentUser) => {
        if (!isMounted) {
          return;
        }

        /**
         * User logged out.
         */
        if (!currentUser) {
          setUser(null);
          setLoading(false);
          return;
        }

        /**
         * Wait until Firestore profile is loaded.
         */
        setLoading(true);

        try {
          const profile =
            await getUserProfile(currentUser);

          if (!isMounted) {
            return;
          }

          const storedSession =
            getStoredSession();

          const resolvedRole = normalizeRole(
            profile?.role ||
              profile?.userRole ||
              storedSession?.role ||
              storedSession?.userRole ||
              ""
          );

          const resolvedPhone =
            profile?.phone ||
            profile?.phoneNumber ||
            storedSession?.phone ||
            storedSession?.phoneNumber ||
            currentUser.phoneNumber ||
            "";

          const resolvedName =
            profile?.name ||
            profile?.displayName ||
            storedSession?.name ||
            currentUser.displayName ||
            "";

          const mergedUser = {
            /**
             * Firebase Authentication fields
             */
            ...currentUser,

            /**
             * Firestore profile fields
             */
            ...profile,

            /**
             * Stable identity fields
             */
            uid: currentUser.uid,

            email:
              currentUser.email ||
              profile?.email ||
              storedSession?.email ||
              null,

            phone:
              resolvedPhone,

            phoneNumber:
              currentUser.phoneNumber ||
              resolvedPhone ||
              null,

            name:
              resolvedName,

            displayName:
              currentUser.displayName ||
              resolvedName ||
              "",

            /**
             * Normalized role
             */
            role: resolvedRole,

            /**
             * Easy access to profile data
             */
            profile: profile || {},

            userData: profile || {},
          };

          setUser(mergedUser);
        } catch (error) {
          console.error(
            "Failed to initialize VELZO user:",
            error
          );

          /**
           * Preserve Firebase login even if
           * Firestore profile loading fails.
           */
          if (isMounted) {
            const storedSession =
              getStoredSession();

            setUser({
              ...currentUser,

              phone:
                storedSession?.phone ||
                storedSession?.phoneNumber ||
                currentUser.phoneNumber ||
                "",

              name:
                storedSession?.name ||
                currentUser.displayName ||
                "",

              role: normalizeRole(
                storedSession?.role ||
                  storedSession?.userRole ||
                  ""
              ),

              profile: {},
              userData: {},
            });
          }
        } finally {
          if (isMounted) {
            setLoading(false);
          }
        }
      },
      (error) => {
        console.error(
          "Authentication state error:",
          error
        );

        if (isMounted) {
          setUser(null);
          setLoading(false);
        }
      }
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  /* =========================================
     LOGOUT
  ========================================= */

  async function logout() {
    try {
      await signOut(auth);

      localStorage.removeItem("velzoUser");

      sessionStorage.removeItem("velzoUser");

      setUser(null);
    } catch (error) {
      console.error(
        "VELZO logout failed:",
        error
      );

      throw error;
    }
  }

  /* =========================================
     ROLE VALUES
  ========================================= */

  const userRole = normalizeRole(
    user?.role ||
      user?.userRole ||
      user?.profile?.role ||
      user?.userData?.role ||
      ""
  );

  const adminRoles = getAdminRoles();

  const isAdmin = adminRoles.includes(
    userRole
  );

  const isProvider =
    userRole === "provider" ||
    userRole === "service-provider" ||
    userRole === "serviceprovider";

  const isNormalUser =
    !isAdmin && !isProvider;

  /* =========================================
     CONTEXT VALUE
  ========================================= */

  const value = useMemo(
    () => ({
      user,

      loading,

      logout,

      isAuthenticated: Boolean(user),

      userRole,

      isAdmin,

      isProvider,

      isNormalUser,
    }),
    [
      user,
      loading,
      userRole,
      isAdmin,
      isProvider,
      isNormalUser,
    ]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}