import { API_BASE_URL } from "../config";
import type { ApiErrorBody } from "../types/auth";
import { refreshAccessToken } from "./refreshSession";
import { clearAccessToken, getAccessToken } from "./tokenStore";

export class ApiError extends Error {
  readonly status: number;
  readonly body: ApiErrorBody;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message ?? "Request failed");
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

type ApiFetchOptions = RequestInit & {
  /** Skip automatic refresh retry on 401 (e.g. during bootstrap). */
  skipAuthRetry?: boolean;
};

async function parseErrorBody(response: Response): Promise<ApiErrorBody> {
  try {
    return (await response.json()) as ApiErrorBody;
  } catch {
    return { message: response.statusText };
  }
}

export async function apiFetch(
  path: string,
  options: ApiFetchOptions = {}
): Promise<Response> {
  const { skipAuthRetry = false, ...fetchOptions } = options;
  const headers = new Headers(fetchOptions.headers);

  if (
    fetchOptions.body !== undefined &&
    !headers.has("Content-Type") &&
    !(fetchOptions.body instanceof FormData)
  ) {
    headers.set("Content-Type", "application/json");
  }

  const token = getAccessToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const url = `${API_BASE_URL}${path}`;
  let response = await fetch(url, {
    ...fetchOptions,
    headers,
    credentials: "include",
  });

  const isAuthRoute =
    path.startsWith("/api/auth/login") ||
    path.startsWith("/api/auth/register") ||
    path.startsWith("/api/auth/refresh");

  if (response.status === 401 && !skipAuthRetry && !isAuthRoute) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers.set("Authorization", `Bearer ${newToken}`);
      response = await fetch(url, {
        ...fetchOptions,
        headers,
        credentials: "include",
      });
    } else {
      clearAccessToken();
    }
  }

  return response;
}

export async function apiJson<T>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const response = await apiFetch(path, options);

  if (!response.ok) {
    throw new ApiError(response.status, await parseErrorBody(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
