// @ts-nocheck
import express from "express";
import { autoDrawExpiredGiveaways } from "../lib/giveawayScheduler";
import { runHealthChecks } from "../lib/accountHealthChecker";
import { logger } from "../lib/logger";

const router = express.Router();

/**
 * POST /api/cron/tick
 * Lightweight endpoint for an external cron (e.g. cron-job.org) to call.
 * Runs giveaway auto-draw every time it's hit; health checks run at most
 * once per 4 days (guarded inside runHealthChecks).
 *
 * Secure it with a shared secret: set CRON_SECRET in Vercel env vars and
 * send it as the Authorization header from your cron service.
 */
router.post("/cron/tick", async (req, res) => {
  const secret = process.env["CRON_SECRET"];
  if (secret) {
    const auth = req.headers["authorization"] ?? "";
    if (auth !== `Bearer ${secret}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  try {
    await autoDrawExpiredGiveaways();
    res.json({ ok: true, ran: ["giveaway"] });
  } catch (e) {
    logger.error({ err: e }, "Cron tick failed");
    res.status(500).json({ ok: false, error: String(e) });
  }
});

export default router;
