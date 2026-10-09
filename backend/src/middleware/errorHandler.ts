import type { ErrorRequestHandler } from "express";
import { Prisma } from "@prisma/client";
import { config } from "../config/env.js";
import { AppError } from "../lib/errors.js";
import { AuthValidationError } from "../validation/auth.schemas.js";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AuthValidationError) {
    res.status(400).json({
      code: "VALIDATION_ERROR",
      message: "Request validation failed",
      errors: err.errors,
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      code: err.code,
      message: err.message,
    });
    return;
  }

  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2002"
  ) {
    res.status(409).json({
      code: "CONFLICT",
      message: "An account with this email already exists",
    });
    return;
  }

  if (err instanceof Error) {
    if (config.isProduction) {
      console.error("Unhandled error:", err.message);
    } else {
      console.error("Unhandled error:", err);
    }
  } else {
    console.error("Unhandled error:", err);
  }

  res.status(500).json({
    code: "INTERNAL_SERVER_ERROR",
    message: "Something went wrong",
  });
};
