import { createContext, useCallback, useContext, useState, useEffect, type ReactNode } from "react";
import type { UserDto } from "@campushub/shared";

export const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

interface AuthState {
  user: UserDto | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string, user: UserDto) => void;
  logout: (expired?: boolean | unknown) => void;
  updateUser: (user: UserDto) => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    const lastActive = localStorage.getItem("campushub_last_active");
    if (lastActive && Date.now() - Number(lastActive) > INACTIVITY_TIMEOUT_MS) {
      localStorage.removeItem("campushub_token");
      localStorage.removeItem("campushub_user");
      localStorage.removeItem("campushub_last_active");
      return null;
    }
    return localStorage.getItem("campushub_token");
  });
  const [user, setUser] = useState<UserDto | null>(() => {
    const lastActive = localStorage.getItem("campushub_last_active");
    if (lastActive && Date.now() - Number(lastActive) > INACTIVITY_TIMEOUT_MS) {
      return null;
    }
    const stored = localStorage.getItem("campushub_user");
    return stored ? JSON.parse(stored) : null;
  });

  const isAuthenticated = !!token && !!user;

  function login(newToken: string, newUser: UserDto) {
    const now = Date.now().toString();
    localStorage.setItem("campushub_token", newToken);
    localStorage.setItem("campushub_user", JSON.stringify(newUser));
    localStorage.setItem("campushub_last_active", now);
    setToken(newToken);
    setUser(newUser);
  }

  function logout(expired?: boolean | unknown) {
    const isExpired = expired === true;
    localStorage.removeItem("campushub_token");
    localStorage.removeItem("campushub_user");
    localStorage.removeItem("campushub_last_active");
    setToken(null);
    setUser(null);
    if (isExpired && typeof window !== "undefined" && window.location.pathname !== "/login") {
      try {
        window.location.href = "/login?expired=true";
      } catch {
        // Ignored in test environments without full location navigation support
      }
    }
  }

  const updateUser = useCallback((updatedUser: UserDto) => {
    localStorage.setItem("campushub_user", JSON.stringify(updatedUser));
    setUser(updatedUser);
  }, []);

  useEffect(() => {
    if (token && !user) {
      logout();
    }
  }, [token, user]);

  // Track user activity and automatically log out after 10 minutes of inactivity
  useEffect(() => {
    if (!isAuthenticated) return;

    let lastRecorded = Date.now();

    function recordActivity() {
      const now = Date.now();
      // Throttle localStorage updates to at most once every 10 seconds
      if (now - lastRecorded > 10_000) {
        lastRecorded = now;
        localStorage.setItem("campushub_last_active", now.toString());
      }
    }

    const events = ["mousedown", "keydown", "scroll", "touchstart"];
    events.forEach((evt) => window.addEventListener(evt, recordActivity, { passive: true }));

    const interval = setInterval(() => {
      const storedLastActive = localStorage.getItem("campushub_last_active");
      const lastActiveTime = storedLastActive ? Number(storedLastActive) : lastRecorded;
      if (Date.now() - lastActiveTime >= INACTIVITY_TIMEOUT_MS) {
        logout(true);
      }
    }, 10_000);

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, recordActivity));
      clearInterval(interval);
    };
  }, [isAuthenticated]);

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
