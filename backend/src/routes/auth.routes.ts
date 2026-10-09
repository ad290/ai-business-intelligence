import { Router } from "express";
import { login, logout, me, refresh, register } from "../controllers/auth.controller.js";
import {
  loginRateLimiter,
  refreshRateLimiter,
  registerRateLimiter,
} from "../middleware/authRateLimit.js";
import { authenticate } from "../middleware/authenticate.js";

const authRouter = Router();

authRouter.get("/me", authenticate, me);
authRouter.post("/register", registerRateLimiter, register);
authRouter.post("/login", loginRateLimiter, login);
authRouter.post("/refresh", refreshRateLimiter, refresh);
authRouter.post("/logout", logout);

export default authRouter;
