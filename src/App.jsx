import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import HomePage from "./pages/HomePage";
import DashboardPage from "./pages/DashboardPage";
import GuildDashboardPage from "./pages/GuildDashboardPage";
import InfoPage from "./pages/InfoPage";
import ContributorsPage from "./pages/ContributorsPage";
import TermsPage from "./pages/TermsPage";
import PrivacyPage from "./pages/PrivacyPage";
import StatusPage from "./pages/status";
import { getBackendUrl } from "./JS/api";

function DashboardRoute({ isAuthLoading, isAuthenticated, user }) {
  if (isAuthLoading) {
    return (
      <section className="page-card">
        <p className="muted">Checking session...</p>
      </section>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <DashboardPage user={user} />;
}

function GuildDashboardRoute({ isAuthLoading, isAuthenticated, user }) {
  if (isAuthLoading) {
    return (
      <section className="page-card">
        <p className="muted">Checking session...</p>
      </section>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <GuildDashboardPage user={user} />;
}

export default function App() {
  const backendUrl = useMemo(() => getBackendUrl(), []);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [user, setUser] = useState(null);

  const fetchWithAuthFallback = useCallback(
    async (path, options = {}) => {
      const normalizedPath = path.startsWith("/") ? path : `/${path}`;
      const candidates = [];
      const isLocalPage =
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1";

      try {
        const backendOrigin = new URL(backendUrl).origin;
        if (backendOrigin !== window.location.origin) {
          candidates.push(`${backendUrl}${normalizedPath}`);
          if (isLocalPage) {
            candidates.push(normalizedPath);
          }
        } else {
          candidates.push(normalizedPath);
        }
      } catch {
        candidates.push(`${backendUrl}${normalizedPath}`);
        if (isLocalPage) {
          candidates.push(normalizedPath);
        }
      }

      let lastError;

      for (let index = 0; index < candidates.length; index += 1) {
        const url = candidates[index];

        try {
          const response = await fetch(url, {
            credentials: "include",
            ...options,
          });

          if ((response.status === 404 || response.status === 405) && index < candidates.length - 1) {
            continue;
          }

          return response;
        } catch (error) {
          lastError = error;
        }
      }

      throw lastError || new Error(`Request failed for ${normalizedPath}`);
    },
    [backendUrl]
  );

  const hydrateAuth = useCallback(async () => {
    setIsAuthLoading(true);

    try {
      const response = await fetchWithAuthFallback("/api/me");

      if (response.status === 401) {
        setUser(null);
        return;
      }

      if (!response.ok) {
        throw new Error(`Auth check failed: ${response.status}`);
      }

      const currentUser = await response.json();
      setUser(currentUser);
    } catch (error) {
      console.error(error);
      setUser(null);
    } finally {
      setIsAuthLoading(false);
    }
  }, [fetchWithAuthFallback]);

  useEffect(() => {
    hydrateAuth();
  }, [hydrateAuth]);

  const handleLogin = useCallback(() => {
    const frontendUrl = encodeURIComponent(window.location.origin);
    window.location.href = `${backendUrl}/login?frontendUrl=${frontendUrl}`;
  }, [backendUrl]);

  const handleLogout = useCallback(async () => {
    try {
      await fetchWithAuthFallback("/logout");
    } catch (error) {
      console.error(error);
    }

    setUser(null);
    window.location.href = "/";
  }, [fetchWithAuthFallback]);

  const isAuthenticated = Boolean(user);

  return (
    <AppLayout
      isAuthenticated={isAuthenticated}
      isAuthLoading={isAuthLoading}
      user={user}
      onLogin={handleLogin}
      onLogout={handleLogout}
    >
      <Routes>
        <Route
          path="/"
          element={
            <HomePage
              isAuthenticated={isAuthenticated}
              onLogin={handleLogin}
            />
          }
        />
        <Route
          path="/dashboard"
          element={
            <DashboardRoute
              isAuthLoading={isAuthLoading}
              isAuthenticated={isAuthenticated}
              user={user}
            />
          }
        />
        <Route
          path="/dashboard/guild"
          element={
            <GuildDashboardRoute
              isAuthLoading={isAuthLoading}
              isAuthenticated={isAuthenticated}
              user={user}
            />
          }
        />
        <Route path="/info" element={<InfoPage />} />
        <Route path="/contributors" element={<ContributorsPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/status" element={<StatusPage />} />
        <Route path="/status/:code" element={<StatusPage />} />
        <Route path="*" element={<Navigate to="/status?code=404" replace />} />
      </Routes>
    </AppLayout>
  );
}
