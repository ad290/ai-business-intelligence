const apiUrl = import.meta.env.VITE_API_URL;

if (!apiUrl || typeof apiUrl !== "string") {
  throw new Error("VITE_API_URL is not configured");
}

export const API_BASE_URL = apiUrl.replace(/\/$/, "");
