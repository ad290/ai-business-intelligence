import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  ACCESS_TOKEN_SECRET: z
    .string()
    .min(32, "ACCESS_TOKEN_SECRET must be at least 32 characters"),
  REFRESH_TOKEN_SECRET: z
    .string()
    .min(32, "REFRESH_TOKEN_SECRET must be at least 32 characters"),

  ACCESS_TOKEN_EXPIRES_IN: z.string().min(1, "ACCESS_TOKEN_EXPIRES_IN is required"),
  REFRESH_TOKEN_EXPIRES_IN: z.string().min(1, "REFRESH_TOKEN_EXPIRES_IN is required"),

  FRONTEND_URL: z.string().url("FRONTEND_URL must be a valid URL"),

  PORT: z.coerce.number().int().positive().default(5001),

  ANALYTICS_SERVICE_URL: z
    .string()
    .url("ANALYTICS_SERVICE_URL must be a valid URL")
    .default("http://localhost:8000"),

  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  REFRESH_TOKEN_COOKIE_NAME: z.string().min(1).default("refresh_token"),
  COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]).default("lax"),
  COOKIE_PATH: z.string().min(1).default("/"),
  COOKIE_DOMAIN: z.string().optional(),
  COOKIE_SECURE: z
    .enum(["true", "false"])
    .optional(),

  OPENROUTER_API_KEY: z.string().min(1).optional(),
  OPENROUTER_MODEL: z.string().min(1).optional(),

  REDIS_URL: z
    .string()
    .min(1, "REDIS_URL is required")
    .default("redis://127.0.0.1:6379"),
});

export type AppConfig = {
  databaseUrl: string;
  redisUrl: string;
  port: number;
  nodeEnv: "development" | "production" | "test";
  isProduction: boolean;
  frontendUrl: string;
  analyticsServiceUrl: string;
  openRouter: {
    apiKey?: string;
    model: string;
  };
  accessToken: {
    secret: string;
    expiresIn: string;
  };
  refreshToken: {
    secret: string;
    expiresIn: string;
  };
  cookies: {
    refreshTokenName: string;
    httpOnly: true;
    secure: boolean;
    sameSite: "lax" | "strict" | "none";
    path: string;
    domain?: string;
  };
};

function parseEnv(): AppConfig {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error("Environment configuration is invalid:");
    for (const issue of result.error.issues) {
      const path = issue.path.length > 0 ? issue.path.join(".") : "environment";
      console.error(`  - ${path}: ${issue.message}`);
    }
    process.exit(1);
  }

  const env = result.data;
  const isProduction = env.NODE_ENV === "production";
  const cookieSecure =
    env.COOKIE_SECURE !== undefined
      ? env.COOKIE_SECURE === "true"
      : isProduction;

  return {
    databaseUrl: env.DATABASE_URL,
    redisUrl: env.REDIS_URL,
    port: env.PORT,
    nodeEnv: env.NODE_ENV,
    isProduction,
    frontendUrl: env.FRONTEND_URL,
    analyticsServiceUrl: env.ANALYTICS_SERVICE_URL,
    openRouter: {
      apiKey: env.OPENROUTER_API_KEY,
      model: env.OPENROUTER_MODEL ?? "nex-agi/nex-n2.5-mini:free",
    },
    accessToken: {
      secret: env.ACCESS_TOKEN_SECRET,
      expiresIn: env.ACCESS_TOKEN_EXPIRES_IN,
    },
    refreshToken: {
      secret: env.REFRESH_TOKEN_SECRET,
      expiresIn: env.REFRESH_TOKEN_EXPIRES_IN,
    },
    cookies: {
      refreshTokenName: env.REFRESH_TOKEN_COOKIE_NAME,
      httpOnly: true,
      secure: cookieSecure,
      sameSite: env.COOKIE_SAME_SITE,
      path: env.COOKIE_PATH,
      domain: env.COOKIE_DOMAIN,
    },
  };
}

/** Validated application configuration (loaded once at startup). */
export const config: AppConfig = parseEnv();
