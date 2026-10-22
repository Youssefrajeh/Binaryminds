import { useCallback, useState, useEffect, type ReactNode } from "react";
import type { UserDto } from "@campushub/shared";
import { AuthContext, INACTIVITY_TIMEOUT_MS } from "./AuthContext";

function clearStoredSession() {
  localStorage.removeItem("campushub_token");
  localStorage.removeItem("campushub_user");
  localStorage.removeItem("campushub_last_active");
}

/** Restores the saved session, dropping it if it went idle or is missing its user */
function readStoredSession(): { token: string | null; user: UserDto | null } {
  const lastActive = localStorage.getItem("campushub_last_active");
  if (lastActive && Date.now() - Number(lastActive) > INACTIVITY_TIMEOUT_MS) {
    clearStoredSession();
    return { token: null, user: null };
  }
  const token = localStorage.getItem("campushub_token");
  const stored = localStorage.getItem("campushub_user");
  const user: UserDto | null = stored ? JSON.parse(stored) : null;
  if (token && !user) {
    clearStoredSession();
    return { token: null, user: null };
  }
  return { token, user };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(readStoredSession);
  const [token, setToken] = useState<string | null>(initial.token);
  const [user, setUser] = useState<UserDto | null>(initial.user);

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
    clearStoredSession();
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
