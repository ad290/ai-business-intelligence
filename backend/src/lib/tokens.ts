import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";
import { config } from "../config/env.js";

export const TokenType = {
  Access: "access",
  Refresh: "refresh",
} as const;

export type TokenTypeValue = (typeof TokenType)[keyof typeof TokenType];

export type TokenErrorCode = "INVALID" | "EXPIRED" | "WRONG_TYPE";

export class TokenError extends Error {
  readonly code: TokenErrorCode;

  constructor(message: string, code: TokenErrorCode) {
    super(message);
    this.name = "TokenError";
    this.code = code;
  }
}

/** Claims used when issuing an access token. */
export type AccessTokenClaims = {
  userId: string;
  companyId: string;
};

/** Verified access token payload (minimal identity for API auth). */
export type AccessTokenPayload = AccessTokenClaims & {
  tokenType: typeof TokenType.Access;
};

/** Claims used when issuing a refresh token. */
export type RefreshTokenClaims = {
  userId: string;
  /** Unique token/session id (`jti`); ties to a RefreshToken row for rotation/revocation. */
  tokenId: string;
  familyId: string;
};

/** Verified refresh token payload (no PII beyond user id). */
export type RefreshTokenPayload = {
  userId: string;
  tokenId: string;
  familyId: string;
  tokenType: typeof TokenType.Refresh;
};

function toAccessPayload(decoded: JwtPayload): AccessTokenPayload {
  if (decoded.tokenType !== TokenType.Access) {
    throw new TokenError("Token is not an access token", "WRONG_TYPE");
  }
  if (typeof decoded.sub !== "string" || decoded.sub.length === 0) {
    throw new TokenError("Invalid access token", "INVALID");
  }
  if (typeof decoded.companyId !== "string" || decoded.companyId.length === 0) {
    throw new TokenError("Invalid access token", "INVALID");
  }

  return {
    userId: decoded.sub,
    companyId: decoded.companyId,
    tokenType: TokenType.Access,
  };
}

function toRefreshPayload(decoded: JwtPayload): RefreshTokenPayload {
  if (decoded.tokenType !== TokenType.Refresh) {
    throw new TokenError("Token is not a refresh token", "WRONG_TYPE");
  }
  if (typeof decoded.sub !== "string" || decoded.sub.length === 0) {
    throw new TokenError("Invalid refresh token", "INVALID");
  }
  if (typeof decoded.jti !== "string" || decoded.jti.length === 0) {
    throw new TokenError("Invalid refresh token", "INVALID");
  }
  if (typeof decoded.familyId !== "string" || decoded.familyId.length === 0) {
    throw new TokenError("Invalid refresh token", "INVALID");
  }

  return {
    userId: decoded.sub,
    tokenId: decoded.jti,
    familyId: decoded.familyId,
    tokenType: TokenType.Refresh,
  };
}

function verifyWithSecret(
  token: string,
  secret: string,
  expectedType: TokenTypeValue
): JwtPayload {
  if (typeof token !== "string" || token.length === 0) {
    throw new TokenError("Invalid token", "INVALID");
  }

  try {
    const decoded = jwt.verify(token, secret);
    if (typeof decoded === "string" || decoded === null) {
      throw new TokenError("Invalid token", "INVALID");
    }

    if (decoded.tokenType !== expectedType) {
      throw new TokenError(
        expectedType === TokenType.Access
          ? "Token is not an access token"
          : "Token is not a refresh token",
        "WRONG_TYPE"
      );
    }

    return decoded;
  } catch (error) {
    if (error instanceof TokenError) {
      throw error;
    }
    if (error instanceof jwt.TokenExpiredError) {
      throw new TokenError("Token expired", "EXPIRED");
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new TokenError("Invalid token", "INVALID");
    }
    throw error;
  }
}

const accessSignOptions: SignOptions = {
  expiresIn: config.accessToken.expiresIn as SignOptions["expiresIn"],
};

const refreshSignOptions: SignOptions = {
  expiresIn: config.refreshToken.expiresIn as SignOptions["expiresIn"],
};

/** Issue a short-lived access JWT for API authentication. */
export function signAccessToken(claims: AccessTokenClaims): string {
  return jwt.sign(
    {
      sub: claims.userId,
      companyId: claims.companyId,
      tokenType: TokenType.Access,
    },
    config.accessToken.secret,
    accessSignOptions
  );
}

/** Verify an access JWT and return typed identity claims. */
export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = verifyWithSecret(
    token,
    config.accessToken.secret,
    TokenType.Access
  );
  return toAccessPayload(decoded);
}

/** Issue a long-lived refresh JWT (paired with a hashed row in RefreshToken). */
export function signRefreshToken(claims: RefreshTokenClaims): string {
  return jwt.sign(
    {
      sub: claims.userId,
      jti: claims.tokenId,
      familyId: claims.familyId,
      tokenType: TokenType.Refresh,
    },
    config.refreshToken.secret,
    refreshSignOptions
  );
}

/** Verify a refresh JWT and return session identifiers for rotation/revocation. */
export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const decoded = verifyWithSecret(
    token,
    config.refreshToken.secret,
    TokenType.Refresh
  );
  return toRefreshPayload(decoded);
}
