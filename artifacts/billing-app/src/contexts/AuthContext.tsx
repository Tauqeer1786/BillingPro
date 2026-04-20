import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { setAuthTokenGetter } from "@workspace/api-client-react";

export interface SalesmanPermissions {
  id: number;
  userId: number;
  canBill: boolean;
  canViewReports: boolean;
  canEditInvoices: boolean;
  canAccessInventory: boolean;
}

export interface AuthUser {
  id: number;
  username: string;
  role: "master" | "admin" | "salesman";
  permissions: SalesmanPermissions | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  can: (permission: keyof SalesmanPermissions) => boolean;
  isMaster: boolean;
  isAdmin: boolean;
  isSalesman: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = "billingpro_token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [isLoading, setIsLoading] = useState(true);

  const storeToken = useCallback((t: string | null) => {
    setToken(t);
    if (t) {
      localStorage.setItem(TOKEN_KEY, t);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
    setAuthTokenGetter(t ? () => t : null);
  }, []);

  const refreshUser = useCallback(async () => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (!storedToken) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${storedToken}` },
      });
      if (!res.ok) {
        storeToken(null);
        setUser(null);
      } else {
        const data = await res.json();
        setUser(data);
        storeToken(storedToken);
      }
    } catch {
      storeToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [storeToken]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(async (username: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Login failed");
    }
    const data = await res.json();
    storeToken(data.token);
    setUser(data.user);
  }, [storeToken]);

  const logout = useCallback(() => {
    storeToken(null);
    setUser(null);
  }, [storeToken]);

  const can = useCallback((permission: keyof SalesmanPermissions): boolean => {
    if (!user) return false;
    if (user.role === "master" || user.role === "admin") return true;
    if (!user.permissions) return false;
    const val = user.permissions[permission];
    return typeof val === "boolean" ? val : false;
  }, [user]);

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isLoading,
      login,
      logout,
      refreshUser,
      can,
      isMaster: user?.role === "master",
      isAdmin: user?.role === "admin",
      isSalesman: user?.role === "salesman",
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
