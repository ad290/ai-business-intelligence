import { NotFoundError } from "./errors.js";

/**
 * Use as the company filter in Prisma `where` clauses for tenant-owned data.
 * Always pass `companyId` from `req.tenant` / `req.auth`, never from the client.
 */
export function whereCompanyScoped(companyId: string): { companyId: string } {
  return { companyId };
}

/**
 * Ensures a resource belongs to the authenticated tenant. Returns 404 on mismatch
 * so another tenant cannot confirm that a foreign resource ID exists (IDOR hardening).
 */
export function assertSameCompany(
  resourceCompanyId: string,
  tenantCompanyId: string
): void {
  if (resourceCompanyId !== tenantCompanyId) {
    throw new NotFoundError("Resource not found");
  }
}

/**
 * Validates a client-supplied company id (URL param, query, body) against the tenant.
 * The tenant company id from the JWT remains authoritative.
 */
export function assertRequestedCompanyMatchesTenant(
  requestedCompanyId: string,
  tenantCompanyId: string
): void {
  assertSameCompany(requestedCompanyId, tenantCompanyId);
}
