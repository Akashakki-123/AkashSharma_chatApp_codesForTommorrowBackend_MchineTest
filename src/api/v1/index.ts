import { Router, Request, Response } from "express";
import prisma from "./config/db.js";
import { firebaseEnabled } from "./config/firebase.js";
import { sendResponse, success } from "./helpers/response.helper.js";
import {
  healthCheckFailedMessage,
  healthCheckPassedMessage,
} from "./constants/messageConstants.js";
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import chatRoutes from "./routes/chat.routes.js";

const router = Router();

router.get("/health", async (_req: Request, res: Response): Promise<Response> => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return success(res, healthCheckPassedMessage, {
      status: "up",
      database: "up",
      firebase: firebaseEnabled ? "configured" : "not_configured",
      version: "1.0.0",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return sendResponse(res, 503, false, healthCheckFailedMessage, message, {
      status: "down",
      database: "down",
      firebase: firebaseEnabled ? "configured" : "not_configured",
      version: "1.0.0",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  }
});

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/user", userRoutes);
router.use("/chat", chatRoutes);

export default router;
