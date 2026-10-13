/**
 * AuthContext.tsx
 *
 * Holds the API token in React state (mirrored in storage by token.ts),
 * provides login()/logout(), and wires the global 401 handling: any 401 from
 * a protected call clears the token, which makes the router guard redirect
 * to #/login.
 *
 * login() validates a candidate token against /api/auth/check BEFORE storing
 * it, so a wrong token never touches storage.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiFetch, setUnauthorizedHandler } from '../api/client';
import { clearToken, getToken, setToken } from './token';

interface AuthContextValue {
  token: string | null;
  login: (token: string, remember: boolean) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => getToken());

  // Global 401 handling: drop the token; RequireAuth then routes to /login.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearToken();
      setTokenState(null);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const login = useCallback(async (candidate: string, remember: boolean) => {
    // Validate first: send the candidate explicitly, not any stored token.
    // Throws ApiError (401 = invalid token) or NetworkError on failure.
    await apiFetch<{ ok: boolean }>('/auth/check', {
      skipAuth: true,
      headers: { Authorization: `Bearer ${candidate}` },
    });
    setToken(candidate, remember);
    setTokenState(candidate);
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setTokenState(null);
  }, []);

  const value = useMemo(() => ({ token, login, logout }), [token, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
