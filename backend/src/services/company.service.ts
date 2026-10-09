import { Prisma } from "@prisma/client";
import { NotFoundError } from "../lib/errors.js";
import { assertRequestedCompanyMatchesTenant } from "../lib/tenantScope.js";
import { prisma } from "../lib/prisma.js";

const companyPublicSelect = {
  id: true,
  name: true,
  createdAt: true,
} satisfies Prisma.CompanySelect;

export type CompanyPublic = Prisma.CompanyGetPayload<{
  select: typeof companyPublicSelect;
}>;

/**
 * Loads a company only when it matches the authenticated tenant's companyId.
 * A foreign `requestedCompanyId` cannot access another tenant's row.
 */
export async function getCompanyForTenant(
  requestedCompanyId: string,
  tenantCompanyId: string
): Promise<CompanyPublic> {
  assertRequestedCompanyMatchesTenant(requestedCompanyId, tenantCompanyId);

  const company = await prisma.company.findFirst({
    where: { id: tenantCompanyId },
    select: companyPublicSelect,
  });

  if (!company) {
    throw new NotFoundError("Company not found");
  }

  return company;
}
