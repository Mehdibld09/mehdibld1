// @ts-nocheck
import app from "./app";
import { logger } from "./lib/logger";
import { startHealthCheckScheduler } from "./lib/accountHealthChecker";
import { startGiveawayScheduler } from "./lib/giveawayScheduler";
import { getOrCreateAdminBot } from "./lib/adminBot";

const rawPort = process.env["PORT"] || "3000";
const port = Number(rawPort);

app.listen(port, "0.0.0.0", (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  // Skip background timers on Vercel — they prevent functions from idling
  // and burn Fluid Active CPU. Use the /api/cron/tick endpoint + external
  // cron (e.g. cron-job.org) to trigger these instead.
  if (!process.env["VERCEL"]) {
    startHealthCheckScheduler();
    startGiveawayScheduler();
  }
  getOrCreateAdminBot().catch((e) => logger.error({ err: e }, "Failed to init Admin Bot"));
});
