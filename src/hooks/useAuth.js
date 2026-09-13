// src/hooks/useAuth.js

import { useContext } from "react";

import { AuthContext } from "../context/AuthContext";

/**
 * Custom authentication hook.
 *
 * Usage:
 *
 * import useAuth from "../hooks/useAuth";
 *
 * or:
 *
 * import { useAuth } from "../hooks/useAuth";
 */
function useAuth() {
  const context = useContext(AuthContext);

  if (context === null || context === undefined) {
    throw new Error(
      "useAuth must be used inside AuthProvider. " +
        "Wrap your application with <AuthProvider>."
    );
  }

  return context;
}

export { useAuth };

export default useAuth;