export type Company = {
  id: string;
  name: string;
};

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  companyId: string;
};

export type MeResponse = {
  user: AuthUser;
  company: Company;
};

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export type ApiErrorBody = {
  code?: string;
  message?: string;
  errors?: { field: string; message: string }[];
};
