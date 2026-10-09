import { z } from "zod";

const SENSITIVE_FIELDS = new Set(["password"]);

const emailSchema = z
  .string({ error: "Email is required" })
  .trim()
  .min(1, "Email is required")
  .transform((value) => value.toLowerCase())
  .pipe(z.email("Invalid email address"));

const passwordSchema = z
  .string({ error: "Password is required" })
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be at most 128 characters")
  .refine((value) => /[a-zA-Z]/.test(value) && /\d/.test(value), {
    message: "Password must include at least one letter and one number",
  });

const personNameSchema = z
  .string({ error: "Name is required" })
  .trim()
  .min(1, "Name is required")
  .max(100, "Name must be at most 100 characters");

const companyNameSchema = z
  .string({ error: "Company name is required" })
  .trim()
  .min(1, "Company name is required")
  .max(200, "Company name must be at most 200 characters");

export const registerSchema = z.object({
  name: personNameSchema,
  email: emailSchema,
  password: passwordSchema,
  companyName: companyNameSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string({ error: "Password is required" })
    .min(1, "Password is required"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export type AuthFieldError = {
  field: string;
  message: string;
};

/** Maps Zod issues to API-safe field errors (never includes password values). */
export function formatAuthValidationErrors(
  error: z.ZodError
): AuthFieldError[] {
  return error.issues.map((issue) => {
    const field =
      issue.path.length > 0 ? issue.path.map(String).join(".") : "body";
    const topLevelField = issue.path[0];

    if (
      typeof topLevelField === "string" &&
      SENSITIVE_FIELDS.has(topLevelField)
    ) {
      return {
        field,
        message: issue.message || "Invalid password",
      };
    }

    return {
      field,
      message: issue.message,
    };
  });
}

export class AuthValidationError extends Error {
  readonly errors: AuthFieldError[];

  constructor(errors: AuthFieldError[]) {
    super("Validation failed");
    this.name = "AuthValidationError";
    this.errors = errors;
  }
}

export function parseRegisterInput(body: unknown): RegisterInput {
  const result = registerSchema.safeParse(body);
  if (!result.success) {
    throw new AuthValidationError(formatAuthValidationErrors(result.error));
  }
  return result.data;
}

export function parseLoginInput(body: unknown): LoginInput {
  const result = loginSchema.safeParse(body);
  if (!result.success) {
    throw new AuthValidationError(formatAuthValidationErrors(result.error));
  }
  return result.data;
}
