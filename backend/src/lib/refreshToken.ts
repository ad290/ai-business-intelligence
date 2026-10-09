import { createHash } from "node:crypto";
import jwt from "jsonwebtoken";

/** SHA-256 hash of the opaque refresh token JWT — never store plaintext. */
export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function getRefreshTokenExpiry(refreshTokenJwt: string): Date {
  const decoded = jwt.decode(refreshTokenJwt);

  if (
    decoded === null ||
    typeof decoded === "string" ||
    typeof decoded.exp !== "number"
  ) {
    throw new Error("Refresh token is missing an expiration claim");
  }

  return new Date(decoded.exp * 1000);
}
