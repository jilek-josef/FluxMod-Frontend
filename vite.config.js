import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const DEBUG_ENABLED = process.env.DEBUG === "true";

if (DEBUG_ENABLED) {
  console.debug("[FluxMod:vite]", {
    mode: process.env.NODE_ENV,
    port: 3000,
  });
}

// Determine host - allow override via env, default to localhost for security
// In Docker, we need 0.0.0.0 to accept external connections
const host = process.env.VITE_HOST || "localhost";
const port = parseInt(process.env.VITE_PORT || "3000", 10);

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        terms: path.resolve(__dirname, "pages/terms.html"),
        privacy: path.resolve(__dirname, "pages/privacy.html"),
        contributors: path.resolve(__dirname, "pages/contributors.html"),
        dashboard: path.resolve(__dirname, "pages/dashboard.html"),
        guildDashboard: path.resolve(__dirname, "pages/guild-dashboard.html"),
        ruleEditor: path.resolve(__dirname, "pages/rule-editor.html"),
        status: path.resolve(__dirname, "pages/status.html"),
      },
    },
  },
  server: {
    host,
    port,
    strictPort: true,
    watch: {
      usePolling: true,
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
