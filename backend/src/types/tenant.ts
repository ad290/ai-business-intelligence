/** Tenant context derived from the verified access token — never from the client body. */
export type TenantContext = {
  userId: string;
  companyId: string;
};
