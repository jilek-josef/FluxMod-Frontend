import { apiCall, debugLog, getBackendUrl } from "./api.js";
import { showLoggedIn, showLoggedOut, showDevMode } from "./auth.js";
import { isDevMode, getMockUser } from "./dev-mode.js";

const backendUrl = getBackendUrl();
debugLog("nav-auth", "Navigation auth module initialized", { backendUrl });

async function hydrateNavAuth() {
  debugLog("nav-auth", "Hydrating navbar auth state");
  
  // Check for dev mode
  if (isDevMode()) {
    debugLog("nav-auth", "Developer mode enabled - using mock user");
    const user = getMockUser();
    showDevMode(user, () => {
      debugLog("nav-auth", "Logout clicked (dev mode - no-op)");
      // In dev mode, logout just reloads the page
      window.location.reload();
    });
    return;
  }
  
  try {
    const meResponse = await apiCall(backendUrl, "/api/me");

    if (meResponse.status === 401) {
      debugLog("nav-auth", "Navbar user is unauthenticated");
      showLoggedOut(backendUrl);
      return;
    }

    const user = await meResponse.json();
    debugLog("nav-auth", "Navbar user authenticated", {
      userId: user?.id,
      username: user?.username,
    });
    showLoggedIn(user, async () => {
      debugLog("nav-auth", "Navbar logout triggered");
      await apiCall(backendUrl, "/logout");
      window.location.reload();
    });
  } catch (error) {
    debugLog("nav-auth", "Failed to hydrate navbar auth", { error });
    console.error(error);
    showLoggedOut(backendUrl);
  }
}

hydrateNavAuth();
