import { defineConfig } from "vite";
import path from "path";

const DEBUG_ENABLED = process.env.DEBUG === "true";

if (DEBUG_ENABLED) {
  console.debug("[FluxMod:vite]", {
    mode: process.env.NODE_ENV,
    port: 3000,
  });
}

export default defineConfig({
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
    host: "localhost",
    port: 3000,
  },
});
