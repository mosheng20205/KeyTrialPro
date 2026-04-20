import { createContext, useContext, useState, type ReactNode } from "react";
import type { AdminSession } from "../types";

interface AuthContextValue {
  token: string | null;
  admin: AdminSession | null;
  login: (email: string, password: string) => Promise<{ requiresMfa: boolean; challengeToken?: string }>;
  verifyMfa: (code: string, challengeToken: string) => Promise<void>;
  updateAdmin: (admin: AdminSession) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = "ktp_token";
const ADMIN_KEY = "ktp_admin";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [admin, setAdmin] = useState<AdminSession | null>(() => {
    const stored = localStorage.getItem(ADMIN_KEY);
    return stored ? (JSON.parse(stored) as AdminSession) : null;
  });

  const persistSession = (nextToken: string, nextAdmin: AdminSession) => {
    setToken(nextToken);
    setAdmin(nextAdmin);
    localStorage.setItem(TOKEN_KEY, nextToken);
    localStorage.setItem(ADMIN_KEY, JSON.stringify(nextAdmin));
  };

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

    const data = payload.data as {
      requiresMfa?: boolean;
      challengeToken?: string;
      token?: string;
      admin?: AdminSession;
    };

    if (data.requiresMfa) {
      return { requiresMfa: true, challengeToken: data.challengeToken };
    }

    if (!data.token || !data.admin) {
      throw new Error("登录响应缺少管理员会话数据。");
    }

    persistSession(data.token, data.admin);
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

    const data = payload.data as { token?: string; admin?: AdminSession };
    if (!data.token || !data.admin) {
      throw new Error("MFA 验证响应缺少管理员会话数据。");
    }

    persistSession(data.token, data.admin);
  };

  const updateAdmin = (nextAdmin: AdminSession) => {
    setAdmin(nextAdmin);
    localStorage.setItem(ADMIN_KEY, JSON.stringify(nextAdmin));
  };

  const logout = () => {
    setToken(null);
    setAdmin(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ADMIN_KEY);
  };

  return (
    <AuthContext.Provider value={{ token, admin, login, verifyMfa, updateAdmin, logout, isAuthenticated: token !== null }}>
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
