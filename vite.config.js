import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const isGitHubPages = mode === "github-pages";

  return {
    plugins: [react()],

    // Vercel deployment uses root path.
    // GitHub Pages uses repository path.
    base: isGitHubPages
      ? "/velzo-provider-referral-hub/"
      : "/",

    build: {
      outDir: "dist",
      emptyOutDir: true,
    },

    server: {
      host: "0.0.0.0",
      port: 5173,
    },
  };
});