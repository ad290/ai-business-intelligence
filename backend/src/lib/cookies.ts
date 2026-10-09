import type { CookieOptions } from "express";
import { config } from "../config/env.js";

export function getRefreshTokenCookieOptions(expiresAt: Date): CookieOptions {
  const maxAge = Math.max(0, expiresAt.getTime() - Date.now());

  const options: CookieOptions = {
    httpOnly: config.cookies.httpOnly,
    secure: config.cookies.secure,
    sameSite: config.cookies.sameSite,
    path: config.cookies.path,
    maxAge,
    expires: expiresAt,
  };

  if (config.cookies.domain) {
    options.domain = config.cookies.domain;
  }

  return options;
}

export function getClearRefreshTokenCookieOptions(): CookieOptions {
  const options: CookieOptions = {
    httpOnly: config.cookies.httpOnly,
    secure: config.cookies.secure,
    sameSite: config.cookies.sameSite,
    path: config.cookies.path,
    maxAge: 0,
  };

  if (config.cookies.domain) {
    options.domain = config.cookies.domain;
  }

  return options;
}
