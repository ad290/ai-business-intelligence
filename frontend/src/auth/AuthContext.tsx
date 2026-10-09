import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  bootstrapSession,
  loginRequest,
  logoutRequest,
  registerRequest,
  type LoginPayload,
  type RegisterPayload,
} from "../api/auth";
import { clearAccessToken } from "../api/tokenStore";
import type { AuthStatus, Company, MeResponse } from "../types/auth";
import { ApiError } from "../api/client";

export type AuthContextValue = {
  user: MeResponse["user"] | null;
  company: Company | null;
  status: AuthStatus;
  isAuthenticated: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<MeResponse | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const restored = await bootstrapSession();
      if (cancelled) {
        return;
      }

      setSession(restored);
      setStatus(restored ? "authenticated" : "unauthenticated");
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (payload: LoginPayload) => {
    const { session: loggedIn } = await loginRequest(payload);
    setSession(loggedIn);
    setStatus("authenticated");
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    await registerRequest(payload);
    const { session: loggedIn } = await loginRequest({
      email: payload.email,
      password: payload.password,
    });
    setSession(loggedIn);
    setStatus("authenticated");
  }, []);

  const logout = useCallback(async () => {
    await logoutRequest();
    clearAccessToken();
    setSession(null);
    setStatus("unauthenticated");
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      company: session?.company ?? null,
      status,
      isAuthenticated: status === "authenticated" && session !== null,
      login,
      register,
      logout,
    }),
    [session, status, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

export function getAuthErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.body.message ?? "Request failed";
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Something went wrong";
}
