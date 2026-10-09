import { Router } from "express";
import { getCompany } from "../controllers/company.controller.js";
import { authenticate } from "../middleware/authenticate.js";
import { attachTenantContext } from "../middleware/tenantContext.js";

const companyRouter = Router();

companyRouter.get(
  "/:companyId",
  authenticate,
  attachTenantContext,
  getCompany
);

export default companyRouter;
