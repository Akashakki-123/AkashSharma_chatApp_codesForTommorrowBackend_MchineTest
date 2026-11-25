import "dotenv/config";
import { createServer } from "http";
import app from "./app.js";
import { disconnectDB } from "./src/api/v1/config/db.js";

const server = createServer(app);
const port = process.env.PORT || process.env.APPID || 8000;

try {
  server.listen(port, () => {
    console.log(`Backend running on port ${port}`);
  });

  server.on("error", (err: Error) => {
    console.error(err);
  });

  const shutdown = async (): Promise<void> => {
    await disconnectDB();
    server.close(() => {
      process.exit(0);
    });
  };

  process.on("SIGINT", () => {
    void shutdown();
  });

  process.on("SIGTERM", () => {
    void shutdown();
  });
} catch (error) {
  console.error(error);
}
