import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { pool } from "@workspace/db";

const router: IRouter = Router();

router.get("/healthz", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    const data = HealthCheckResponse.parse({ status: "ok" });
    res.json(data);
  } catch (err: any) {
    const code = typeof err?.code === "string" ? err.code : "";
    const category =
      code === "28P01"
        ? "authentication_failed"
        : code === "ENOTFOUND" || code === "EAI_AGAIN"
          ? "host_not_found"
          : code === "ETIMEDOUT" || code === "ENETUNREACH"
            ? "connection_timeout"
            : code === "ECONNREFUSED" || code === "ECONNRESET"
              ? "connection_refused"
              : code === "08001" || code === "08003" || code === "08004" || code === "08006"
                ? "postgres_connection_failed"
                : "database_error";

    res.status(503).json({
      status: "degraded",
      database: "unavailable",
      category,
    });
  }
});

export default router;
