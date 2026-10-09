import type { Request, Response, NextFunction } from "express";
import { config } from "../config/env.js";
import {
  getClearRefreshTokenCookieOptions,
  getRefreshTokenCookieOptions,
} from "../lib/cookies.js";
import { UnauthorizedError } from "../lib/errors.js";
import {
  getCurrentUser,
  loginUser,
  logoutSession,
  refreshSession,
  registerUser,
} from "../services/auth.service.js";
import {
  parseLoginInput,
  parseRegisterInput,
} from "../validation/auth.schemas.js";

export async function register(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const input = parseRegisterInput(req.body);
    const result = await registerUser(input);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function login(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const input = parseLoginInput(req.body);
    const result = await loginUser(input, {
      userAgent: req.get("user-agent"),
      ipAddress: req.ip,
    });

    res.cookie(
      config.cookies.refreshTokenName,
      result.refreshToken,
      getRefreshTokenCookieOptions(result.refreshExpiresAt)
    );

    res.status(200).json({
      accessToken: result.accessToken,
      user: result.user,
    });
  } catch (error) {
    next(error);
  }
}

export async function refresh(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const refreshToken = req.cookies[config.cookies.refreshTokenName];

  if (typeof refreshToken !== "string" || refreshToken.length === 0) {
    res.clearCookie(
      config.cookies.refreshTokenName,
      getClearRefreshTokenCookieOptions()
    );
    next(new UnauthorizedError("Invalid or expired refresh token"));
    return;
  }

  try {
    const result = await refreshSession(refreshToken, {
      userAgent: req.get("user-agent"),
      ipAddress: req.ip,
    });

    res.cookie(
      config.cookies.refreshTokenName,
      result.refreshToken,
      getRefreshTokenCookieOptions(result.refreshExpiresAt)
    );

    res.status(200).json({
      accessToken: result.accessToken,
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      res.clearCookie(
        config.cookies.refreshTokenName,
        getClearRefreshTokenCookieOptions()
      );
    }
    next(error);
  }
}

export async function me(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (req.auth === undefined) {
      next(new UnauthorizedError("Authentication required"));
      return;
    }

    const profile = await getCurrentUser(req.auth.userId, req.auth.companyId);
    res.status(200).json(profile);
  } catch (error) {
    next(error);
  }
}

export async function logout(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const refreshToken = req.cookies[config.cookies.refreshTokenName];

    if (typeof refreshToken === "string" && refreshToken.length > 0) {
      await logoutSession(refreshToken);
    }

    res.clearCookie(
      config.cookies.refreshTokenName,
      getClearRefreshTokenCookieOptions()
    );

    res.status(200).json({
      message: "Logged out successfully",
    });
  } catch (error) {
    next(error);
  }
}
