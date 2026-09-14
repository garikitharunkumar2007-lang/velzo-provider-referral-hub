import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";

import "./styles/global.css";
import "./styles/admin.css";
import "./styles/responsive.css";

// Vercel runs the app at the root domain.
// GitHub Pages requires the repository path.
const isGitHubPages = window.location.hostname.endsWith("github.io");

const routerBasename = isGitHubPages
  ? "/velzo-provider-referral-hub"
  : "/";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter basename={routerBasename}>
      <ThemeProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);