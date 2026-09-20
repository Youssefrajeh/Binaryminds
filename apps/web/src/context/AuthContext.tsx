import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { UserDto } from "@campushub/shared";

interface AuthState {
  user: UserDto | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string, user: UserDto) => void;
  logout: () => void;
  updateUser: (user: UserDto) => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem("campushub_token")
  );
  const [user, setUser] = useState<UserDto | null>(() => {
    const stored = localStorage.getItem("campushub_user");
    return stored ? JSON.parse(stored) : null;
  });

  const isAuthenticated = !!token && !!user;

  function login(newToken: string, newUser: UserDto) {
    localStorage.setItem("campushub_token", newToken);
    localStorage.setItem("campushub_user", JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  }

  function logout() {
    localStorage.removeItem("campushub_token");
    localStorage.removeItem("campushub_user");
    setToken(null);
    setUser(null);
  }

  function updateUser(updatedUser: UserDto) {
    localStorage.setItem("campushub_user", JSON.stringify(updatedUser));
    setUser(updatedUser);
  }

  useEffect(() => {
    if (token && !user) {
      logout();
    }
  }, [token, user]);

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
