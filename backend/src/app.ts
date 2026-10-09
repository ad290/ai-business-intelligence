import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { config } from "./config/env.js";
import authRouter from "./routes/auth.routes.js";
import companyRouter from "./routes/company.routes.js";
import aiRouter from "./routes/ai.routes.js";
import datasetRouter from "./routes/dataset.routes.js";
import documentRouter from "./routes/document.routes.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { securityHeaders } from "./middleware/securityHeaders.js";

/** Express application (routes and middleware only; no HTTP listen or workers). */
export function createApp(): express.Express {
  const app = express();

  app.disable("x-powered-by");

  if (config.isProduction) {
    app.set("trust proxy", 1);
  }

  app.use(securityHeaders);
  app.use(
    cors({
      origin: config.frontendUrl,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  );
  app.use(express.json({ limit: "32kb" }));
  app.use(cookieParser());

  app.get("/", (_req, res) => {
    res.json({
      message: "AI Business Intelligence API is running",
    });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/company", companyRouter);
  app.use("/api/datasets", datasetRouter);
  app.use("/api/documents", documentRouter);
  app.use("/ai", aiRouter);
  app.use("/api/ai", aiRouter);
  app.use(errorHandler);

  return app;
}
