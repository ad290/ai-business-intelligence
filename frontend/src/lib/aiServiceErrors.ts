import { ApiError } from "../api/client";

export function formatAiServiceError(
  err: unknown,
  fallbackMessage: string
): string {
  if (err instanceof ApiError) {
    if (err.status === 502 || err.status === 503) {
      const code = err.body.code;
      if (code === "ANALYTICS_UNAVAILABLE") {
        return `${err.message} Start the analytics service, then try again.`;
      }
      if (code === "OPENROUTER_UNAVAILABLE") {
        return `${err.message} Set OPENROUTER_API_KEY in the backend .env and restart the API.`;
      }
      return `${err.message} Check that required local services are running.`;
    }
    return err.message;
  }

  return fallbackMessage;
}
