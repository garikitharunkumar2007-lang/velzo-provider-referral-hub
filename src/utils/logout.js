import { signOut } from "firebase/auth";
import { auth } from "../firebase/firebaseConfig";

/**
 * Sign out the currently logged-in VELZO user.
 */
export async function logout() {
  try {
    await signOut(auth);

    // Clear only VELZO-related local storage data.
    localStorage.removeItem("velzo_user");
    localStorage.removeItem("velzo_admin");
    sessionStorage.clear();

    return {
      success: true,
      message: "Logged out successfully.",
    };
  } catch (error) {
    console.error("Logout failed:", error);

    throw new Error(
      error?.message || "Unable to logout. Please try again."
    );
  }
}

export default logout;