import rateLimit from "express-rate-limit";

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

function createAuthRateLimiter(max: number) {
  return rateLimit({
    windowMs: FIFTEEN_MINUTES_MS,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        code: "RATE_LIMIT_EXCEEDED",
        message: "Too many requests, please try again later",
      });
    },
  });
}

/** Stricter limit for account creation. */
export const registerRateLimiter = createAuthRateLimiter(10);

/** Limits credential guessing on login. */
export const loginRateLimiter = createAuthRateLimiter(20);

/** Allows normal refresh rotation while blocking abuse. */
export const refreshRateLimiter = createAuthRateLimiter(60);
