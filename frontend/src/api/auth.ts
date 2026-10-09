import { apiJson } from "./client";
import { refreshAccessToken } from "./refreshSession";
import { clearAccessToken, setAccessToken } from "./tokenStore";
import type { MeResponse } from "../types/auth";

export type LoginPayload = {
  email: string;
  password: string;
};

export type RegisterPayload = {
  name: string;
  email: string;
  password: string;
  companyName: string;
};

export async function loginRequest(
  payload: LoginPayload
): Promise<{ accessToken: string; session: MeResponse }> {
  const result = await apiJson<{ accessToken: string }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
    skipAuthRetry: true,
  });

  setAccessToken(result.accessToken);
  const session = await fetchCurrentUser();
  return { accessToken: result.accessToken, session };
}

export async function registerRequest(payload: RegisterPayload): Promise<void> {
  await apiJson("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
    skipAuthRetry: true,
  });
}

export async function logoutRequest(): Promise<void> {
  try {
    await apiJson("/api/auth/logout", {
      method: "POST",
      skipAuthRetry: true,
    });
  } finally {
    clearAccessToken();
  }
}

export async function fetchCurrentUser(): Promise<MeResponse> {
  return apiJson<MeResponse>("/api/auth/me");
}

/** Refresh cookie session, then load the current user. */
export async function bootstrapSession(): Promise<MeResponse | null> {
  const token = await refreshAccessToken();
  if (!token) {
    return null;
  }

  try {
    return await fetchCurrentUser();
  } catch {
    clearAccessToken();
    return null;
  }
}
