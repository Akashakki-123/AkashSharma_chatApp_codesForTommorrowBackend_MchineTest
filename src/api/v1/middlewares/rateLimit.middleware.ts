import rateLimit from "express-rate-limit";
import { Request, Response } from "express";
import { tooManyRequests } from "../helpers/response.helper.js";
import {
  authRateLimitExceededMessage,
  rateLimitExceededMessage,
} from "../constants/messageConstants.js";

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

const DEFAULT_WINDOW_MS = parsePositiveInt(
  process.env.RATE_LIMIT_WINDOW_MS,
  15 * 60 * 1000
);
const GLOBAL_MAX_REQUESTS = parsePositiveInt(
  process.env.RATE_LIMIT_MAX_REQUESTS,
  100
);
const AUTH_MAX_REQUESTS = parsePositiveInt(
  process.env.AUTH_RATE_LIMIT_MAX_REQUESTS,
  15
);

export const globalRateLimiter = rateLimit({
  windowMs: DEFAULT_WINDOW_MS,
  limit: GLOBAL_MAX_REQUESTS,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: (_req: Request, res: Response): void => {
    tooManyRequests(res, rateLimitExceededMessage);
  },
});

export const authRateLimiter = rateLimit({
  windowMs: DEFAULT_WINDOW_MS,
  limit: AUTH_MAX_REQUESTS,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: (_req: Request, res: Response): void => {
    tooManyRequests(res, authRateLimitExceededMessage);
  },
});
