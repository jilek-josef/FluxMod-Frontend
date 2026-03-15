import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getMe, getGuilds, logout as apiLogout, getLoginUrl } from "@/utils/api";
import { isDevMode, getMockUser } from "@/utils/devMode";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [botGuilds, setBotGuilds] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const refreshUser = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (isDevMode()) {
        const mockUser = getMockUser();
        setUser(mockUser);
        setBotGuilds(mockUser.guilds);
        return;
      }

      const userData = await getMe();
      if (userData) {
        setUser(userData);
        try {
          const guildsData = await getGuilds();
          setBotGuilds(guildsData || []);
        } catch {
          setBotGuilds([]);
        }
      } else {
        setUser(null);
        setBotGuilds([]);
      }
    } catch (err) {
      setError(err.message);
      setUser(null);
      setBotGuilds([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(() => {
    if (isDevMode()) {
      window.location.reload();
      return;
    }
    window.location.href = getLoginUrl();
  }, []);

  const handleLogout = useCallback(async () => {
    await apiLogout();
    setUser(null);
    setBotGuilds([]);
    window.location.href = "/";
  }, []);

  const isAuthenticated = Boolean(user);
  const isDev = isDevMode();

  const value = {
    user,
    botGuilds,
    isLoading,
    isAuthenticated,
    isDev,
    error,
    login,
    logout: handleLogout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
