import type { AuthenticatedUser } from "./auth.js";
import type { TenantContext } from "./tenant.js";

declare module "express-serve-static-core" {
  interface Request {
    /** Set by `authenticate` middleware after a valid access JWT is verified. */
    auth?: AuthenticatedUser;
    /** Set by `attachTenantContext` from `req.auth` (trusted tenant scope). */
    tenant?: TenantContext;
  }
}
