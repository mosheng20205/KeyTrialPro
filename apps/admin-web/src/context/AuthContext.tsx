import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

interface Admin {
  id: number;
  email: string;
  displayName: string;
  roleCode: string;
}

interface AuthContextValue {
  token: string | null;
  admin: Admin | null;
  login: (email: string, password: string) => Promise<{ requiresMfa: boolean; challengeToken?: string }>;
  verifyMfa: (code: string, challengeToken: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = "ktp_token";
const ADMIN_KEY = "ktp_admin";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [admin, setAdmin] = useState<Admin | null>(() => {
    const stored = localStorage.getItem(ADMIN_KEY);
    return stored ? JSON.parse(stored) : null;
  });

  const login = async (email: string, password: string): Promise<{ requiresMfa: boolean; challengeToken?: string }> => {
    const response = await fetch("/api/admin/auth/login.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const payload = await response.json();
    if (!payload.success) {
      throw new Error(payload.error?.message ?? "登录失败");
    }
    const data = payload.data;
    if (data.requiresMfa) {
      return { requiresMfa: true, challengeToken: data.challengeToken };
    }
    setToken(data.token);
    setAdmin(data.admin);
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(ADMIN_KEY, JSON.stringify(data.admin));
    return { requiresMfa: false };
  };

  const verifyMfa = async (code: string, challengeToken: string): Promise<void> => {
    const response = await fetch("/api/admin/auth/mfa_verify.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challengeToken, mfaCode: code }),
    });
    const payload = await response.json();
    if (!payload.success) {
      throw new Error(payload.error?.message ?? "MFA 验证失败");
    }
    setToken(payload.data.token);
    setAdmin(payload.data.admin);
    localStorage.setItem(TOKEN_KEY, payload.data.token);
    localStorage.setItem(ADMIN_KEY, JSON.stringify(payload.data.admin));
  };

  const logout = () => {
    setToken(null);
    setAdmin(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ADMIN_KEY);
  };

  return (
    <AuthContext.Provider value={{ token, admin, login, verifyMfa, logout, isAuthenticated: token !== null }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}