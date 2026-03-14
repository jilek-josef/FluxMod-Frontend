import { apiCall, debugLog, getBackendUrl } from "./api.js";
import { showLoggedOut } from "./auth.js";
import { isDevMode } from "./dev-mode.js";

// DEBUG
console.log('[FluxMod] landing.js loading, isDevMode:', isDevMode());

const backendUrl = getBackendUrl();
debugLog("landing", "Landing module initialized", { backendUrl });

async function renderProtectedGuilds() {
  debugLog("landing", "Loading protected guild count");
  const countElement = document.getElementById("protected-guilds-count");
  if (!countElement) {
    debugLog("landing", "No protected guild count element found");
    return;
  }

  // In dev mode, show mock count
  if (isDevMode()) {
    debugLog("landing", "Developer mode - showing mock guild count");
    countElement.textContent = "2";
    return;
  }

  try {
    const response = await apiCall(backendUrl, "/api/public/stats");
    const stats = await response.json();
    const count = Number.isFinite(stats?.protected_guilds)
      ? stats.protected_guilds
      : 0;
    debugLog("landing", "Protected guild stats loaded", { count, stats });
    countElement.textContent = String(count);
  } catch (error) {
    debugLog("landing", "Failed to load protected guild stats", { error });
    countElement.textContent = "0";
    console.error(error);
  }
}

async function checkLandingAuth() {
  debugLog("landing", "Checking landing auth status");
  const statusSection = document.getElementById("status");

  // In dev mode, redirect to dashboard immediately
  if (isDevMode()) {
    debugLog("landing", "Developer mode enabled - redirecting to dashboard");
    window.location.href = "./dashboard.html";
    return;
  }

  try {
    const meResponse = await apiCall(backendUrl, "/api/me");

    if (meResponse.status === 401) {
      debugLog("landing", "User is unauthenticated on landing");
      showLoggedOut(backendUrl);
      statusSection.innerHTML =
        '<p class="muted">Not signed in — click login to continue.</p>';
      return;
    }

    debugLog("landing", "User authenticated, redirecting to dashboard.html");
    window.location.href = "./dashboard.html";
  } catch (error) {
    debugLog("landing", "Landing auth check failed", { error });
    showLoggedOut(backendUrl);
    statusSection.innerHTML = `<p class="muted">Error: ${error.message}</p>`;
    console.error(error);
  }
}

checkLandingAuth();
renderProtectedGuilds();