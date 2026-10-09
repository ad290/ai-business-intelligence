import type { Request, Response, NextFunction } from "express";
import { requireTenantContext } from "../middleware/tenantContext.js";
import { getCompanyForTenant } from "../services/company.service.js";

/**
 * Example tenant-scoped route: `companyId` in the URL is checked against the JWT tenant.
 * Requesting another company's id returns 404, not the other tenant's data.
 */
export async function getCompany(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const tenant = requireTenantContext(req);
    const { companyId } = req.params;

    if (typeof companyId !== "string" || companyId.length === 0) {
      res.status(400).json({
        code: "VALIDATION_ERROR",
        message: "Company id is required",
      });
      return;
    }

    const company = await getCompanyForTenant(companyId, tenant.companyId);

    res.status(200).json({
      company,
      tenant: {
        userId: tenant.userId,
        companyId: tenant.companyId,
      },
    });
  } catch (error) {
    next(error);
  }
}
