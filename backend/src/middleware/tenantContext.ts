import type { Request, Response, NextFunction } from "express";
import { UnauthorizedError } from "../lib/errors.js";
import type { TenantContext } from "../types/tenant.js";

/**
 * Builds `req.tenant` from `req.auth`. Run after `authenticate`.
 * Tenant scope always comes from the verified access token.
 */
export function attachTenantContext(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (req.auth === undefined) {
    next(new UnauthorizedError("Authentication required"));
    return;
  }

  req.tenant = {
    userId: req.auth.userId,
    companyId: req.auth.companyId,
  };

  next();
}

/** Read tenant context in handlers (after `attachTenantContext`). */
export function requireTenantContext(req: Request): TenantContext {
  if (req.tenant === undefined) {
    throw new UnauthorizedError("Authentication required");
  }

  return req.tenant;
}
