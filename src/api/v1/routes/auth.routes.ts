import { Router } from "express";
import { login, signup } from "../controllers/auth.controller.js";
import { authRateLimiter } from "../middlewares/rateLimit.middleware.js";

const authRoutes = Router();

authRoutes.post("/signup", authRateLimiter, signup);
authRoutes.post("/login", authRateLimiter, login);

export default authRoutes;
