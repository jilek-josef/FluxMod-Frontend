/**
 * Developer Mode for local testing
 * Bypasses OAuth login by simulating an authenticated user
 * 
 * SECURITY: Only enabled via VITE_DEV_MODE environment variable at build time.
 * This cannot be triggered via URL params to prevent abuse in production.
 */

const viteDevMode = import.meta.env.VITE_DEV_MODE;
const BUILD_TIME_DEV_MODE = viteDevMode === "true";

export function isDevMode() {
  return BUILD_TIME_DEV_MODE;
}

export function getMockUser() {
  return {
    id: "dev_user_123",
    username: "DevUser",
    discriminator: "0000",
    avatar: null,
    email: "dev@localhost",
    guilds: [
      {
        id: "dev_guild_1",
        name: "Test Server 1",
        icon: null,
        owner: true,
        permissions: 2147483647,
        features: [],
      },
      {
        id: "dev_guild_2",
        name: "Test Server 2",
        icon: null,
        owner: false,
        permissions: 2147483647,
        features: [],
      },
      {
        id: "dev_guild_3",
        name: "Production Test",
        icon: null,
        owner: true,
        permissions: 2147483647,
        features: [],
      },
    ],
  };
}

export function getMockGuilds() {
  return getMockUser().guilds;
}

// Expose to console for debugging
if (typeof window !== "undefined") {
  window.isDevMode = isDevMode;
  window.getMockUser = getMockUser;
}

console.log("[FluxMod] Dev mode status:", isDevMode() ? "ENABLED" : "disabled");
