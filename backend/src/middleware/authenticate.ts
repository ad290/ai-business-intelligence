import type { Request, Response, NextFunction } from "express";
import { UnauthorizedError } from "../lib/errors.js";
import { TokenError, verifyAccessToken } from "../lib/tokens.js";

const BEARER_PREFIX = "Bearer ";

function extractBearerToken(authorizationHeader: string | undefined): string | null {
  if (authorizationHeader === undefined) {
    return null;
  }

  if (!authorizationHeader.startsWith(BEARER_PREFIX)) {
    return null;
  }

  const token = authorizationHeader.slice(BEARER_PREFIX.length).trim();
  return token.length > 0 ? token : null;
}

/**
 * Verifies the access JWT from `Authorization: Bearer <token>` and attaches
 * `req.auth` ({ userId, companyId }). Identity is taken only from the token.
 */
export function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const token = extractBearerToken(req.headers.authorization);

  if (token === null) {
    next(new UnauthorizedError("Authentication required"));
    return;
  }

  try {
    const payload = verifyAccessToken(token);

    req.auth = {
      userId: payload.userId,
      companyId: payload.companyId,
    };

    next();
  } catch (error) {
    if (error instanceof TokenError) {
      next(new UnauthorizedError("Invalid or expired access token"));
      return;
    }

    next(error);
  }
}
