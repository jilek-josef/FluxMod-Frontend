function isDebugEnabled() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const explicitFlag =
      localStorage.getItem("fluxmod:debug") === "true" ||
      localStorage.getItem("debug") === "true";
    return explicitFlag || Boolean(import.meta?.env?.DEV);
  } catch {
    return Boolean(import.meta?.env?.DEV);
  }
}

const DEBUG_ENABLED = isDebugEnabled();

export function debugLog(scope, ...details) {
  if (!DEBUG_ENABLED) {
    return;
  }

  console.debug(`[FluxMod:${scope}]`, ...details);
}

function isLocalHost(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function normalizeBackendUrl(url) {
  if (!url || typeof url !== "string") {
    return null;
  }

  const trimmed = url.trim().replace(/\/$/, "");
  if (!trimmed) {
    return null;
  }

  try {
    return new URL(trimmed).toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function resolveProductionBackend(origin) {
  if (!origin) {
    return null;
  }

  if (origin.includes("http://localhost:3000")) {
    return "http://localhost:8000";
  }

  try {
    const parsed = new URL(origin);
    const { hostname, protocol } = parsed;

    if (hostname === "fluxmod.app") {
      const backendHost = "api.fluxmod.app";
      return `${protocol}//${backendHost}`;
    }
  } catch {
    return origin;
  }

  return origin;
}

function isOnStatusPage() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.location.pathname.startsWith("/status");
}

export function redirectToStatus(code) {
  if (typeof window === "undefined") {
    return;
  }

  const normalized = Number.parseInt(code, 10);
  const safeCode =
    Number.isInteger(normalized) && normalized >= 100 && normalized <= 599
      ? normalized
      : 500;

  if (isOnStatusPage()) {
    debugLog("status", "Already on status page, skipping redirect", { safeCode });
    return;
  }

  debugLog("status", "Redirecting to status page", { safeCode });
  window.location.assign(`/pages/status.html?code=${safeCode}`);
}

export function getBackendUrl() {
  // Priority: window.BACKEND_URL > scoped localStorage > legacy localStorage > environment defaults
  if (typeof window === "undefined") {
    debugLog("backend", "SSR mode fallback URL selected", {
      backendUrl: "http://localhost:8000",
    });
    return "http://localhost:8000";
  }

  const { origin, hostname, protocol } = window.location;
  const storageKey = `backendUrl:${origin}`;
  const isDevHost = isLocalHost(hostname);

  const configured = normalizeBackendUrl(window.BACKEND_URL);
  if (configured) {
    debugLog("backend", "Using window.BACKEND_URL", { configured });
    localStorage.setItem(storageKey, configured);
    localStorage.setItem("backendUrl", configured);
    return configured;
  }

  const viteConfigured = normalizeBackendUrl(import.meta?.env?.VITE_BACKEND_URL);
  if (viteConfigured) {
    debugLog("backend", "Using VITE_BACKEND_URL", { viteConfigured });
    localStorage.setItem(storageKey, viteConfigured);
    localStorage.setItem("backendUrl", viteConfigured);
    return viteConfigured;
  }

  if (isDevHost) {
    const devBackendUrl = "http://localhost:8000";
    const devFrontendUrl = "http://localhost:3000";
    localStorage.setItem(storageKey, devBackendUrl);
    localStorage.setItem("backendUrl", devBackendUrl);
    localStorage.setItem("frontendUrl", devFrontendUrl);
    debugLog("backend", "Using pinned dev backend/frontend URL", {
      storageKey,
      devBackendUrl,
      devFrontendUrl,
    });
    return devBackendUrl;
  }

  const scopedSaved = normalizeBackendUrl(localStorage.getItem(storageKey));
  const legacySaved = normalizeBackendUrl(localStorage.getItem("backendUrl"));
  const existing = scopedSaved || legacySaved;

  if (existing) {
    const parsed = new URL(existing);
    const isProdPage = !isLocalHost(hostname);
    const likelyFrontendOriginInRender =
      isProdPage &&
      parsed.hostname === "fluxmod.app" &&
      (parsed.protocol === "https:" || parsed.protocol === "http:");
    const invalidForProd =
      isProdPage &&
      (isLocalHost(parsed.hostname) ||
        (protocol === "https:" && parsed.protocol !== "https:"));
    const invalidForDevHost =
      isDevHost && !isLocalHost(parsed.hostname);

    if (
      !invalidForProd &&
      !invalidForDevHost &&
      !likelyFrontendOriginInRender
    ) {
      debugLog("backend", "Using persisted backend URL", { existing });
      localStorage.setItem(storageKey, existing);
      return existing;
    }

    debugLog("backend", "Clearing invalid persisted backend URL", {
      existing,
      isProdPage,
      protocol,
      isDevHost,
      likelyFrontendOriginInRender,
    });
    localStorage.removeItem("backendUrl");
    localStorage.removeItem(storageKey);
  }

  let backendUrl = "http://localhost:8000";

  if (!isLocalHost(hostname)) {
    backendUrl = resolveProductionBackend(origin) || origin;
    debugLog("backend", "Resolved production backend URL", {
      origin,
      backendUrl,
    });
  }

  localStorage.setItem(storageKey, backendUrl);
  localStorage.setItem("backendUrl", backendUrl);
  debugLog("backend", "Persisted backend URL", { storageKey, backendUrl });
  return backendUrl;
}

export async function apiCall(backendUrl, path, options = {}) {
  let response;
  const method = options?.method || "GET";
  const requestUrl = `${backendUrl}${path}`;

  debugLog("api", "Request start", {
    method,
    url: requestUrl,
    hasBody: Boolean(options?.body),
  });

  try {
    response = await fetch(requestUrl, {
      credentials: "include",
      ...options,
    });
  } catch (error) {
    debugLog("api", "Request failed before response", {
      method,
      url: requestUrl,
      error,
    });
    redirectToStatus(503);
    throw error;
  }

  debugLog("api", "Response received", {
    method,
    url: requestUrl,
    status: response.status,
    ok: response.ok,
  });

  if (!response.ok) {
    const errorText = await response.text();
    debugLog("api", "Error response body", errorText);
    redirectToStatus(response.status);
    throw new Error(`${response.status}: ${errorText}`);
  }

  // 👇 ADD THIS
  const data = await response.clone().json().catch(() => null);
  debugLog("api", "Response JSON", data);

  return response;
}