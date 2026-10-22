import { createContext, useContext } from "react";
import type { UserDto } from "@campushub/shared";

export const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

export interface AuthState {
  user: UserDto | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string, user: UserDto) => void;
  logout: (expired?: boolean | unknown) => void;
  updateUser: (user: UserDto) => void;
}

// The provider lives in AuthProvider.tsx so this file exports no components
export const AuthContext = createContext<AuthState | undefined>(undefined);

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
