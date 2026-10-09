import { API_BASE_URL } from "../config";
import { clearAccessToken, setAccessToken } from "./tokenStore";

let refreshInFlight: Promise<string | null> | null = null;

/**
 * Exchanges the HTTP-only refresh cookie for a new access token.
 * Deduplicates concurrent refresh calls.
 */
export function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        clearAccessToken();
        return null;
      }

      const data = (await response.json()) as { accessToken?: string };

      if (!data.accessToken) {
        clearAccessToken();
        return null;
      }

      setAccessToken(data.accessToken);
      return data.accessToken;
    } catch {
      clearAccessToken();
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}
