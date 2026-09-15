import {
  createContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export const AuthContext = createContext(null);

const GUEST_STORAGE_KEY = "velzoGuestReferralOwner";

function createGuestId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `guest_${crypto.randomUUID()}`;
  }

  return `guest_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2)}`;
}

function getGuestId() {
  try {
    let guestId = localStorage.getItem(
      GUEST_STORAGE_KEY
    );

    if (!guestId) {
      guestId = createGuestId();

      localStorage.setItem(
        GUEST_STORAGE_KEY,
        guestId
      );
    }

    return guestId;
  } catch (error) {
    console.error(
      "Unable to create guest identity:",
      error
    );

    return "guest_fallback";
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const guestId = getGuestId();

    const guestUser = {
      uid: guestId,
      id: guestId,
      userId: guestId,

      name: "Velzo User",
      fullName: "Velzo User",
      displayName: "Velzo User",

      phone: "",
      phoneNumber: "",
      email: "",

      role: "provider",

      isAnonymous: true,
      isGuest: true,

      profile: {},
      userData: {},
    };

    setUser(guestUser);
    setLoading(false);
  }, []);

  function logout() {
    /*
     * Website has no user login.
     *
     * We do not clear guest ID because clearing it
     * would create a new referral history owner.
     */
    setUser(null);
  }

  const value = useMemo(
    () => ({
      user,
      loading,

      /*
       * Kept for compatibility with existing components.
       */
      isAuthenticated: true,
      isGuest: true,

      logout,
    }),
    [user, loading]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}