import "dotenv/config";
import express, { Express, static as expressStatic, urlencoded, json } from "express";
import cors from "cors";
import compression from "compression";
import morgan from "morgan";
import version1Api from "./src/api/v1/index.js";
import { connectDB } from "./src/api/v1/config/db.js";
import { globalRateLimiter } from "./src/api/v1/middlewares/rateLimit.middleware.js";
import {
  errorHandler,
  notFoundHandler,
} from "./src/api/v1/middlewares/error.middleware.js";

const app: Express = express();

app.use(morgan("dev"));
app.use(cors());
app.use("/static", expressStatic("static"));
app.use(urlencoded({ extended: false }));
app.use(json());
app.use(compression());
app.use(globalRateLimiter);

connectDB().catch((err: unknown) => {
  console.error("Failed to connect to DB in app startup:", err);
});

app.use("/v1", version1Api);
app.use("/", version1Api);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
