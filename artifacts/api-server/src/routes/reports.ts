// @ts-nocheck
import express from "express";
import { db, reportsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireModOrAdmin } from "../middlewares/auth";
import { sendBotMessage } from "../lib/adminBot";

const router = express.Router();

router.post("/", requireAuth, async (req, res) => {
  const { targetType, targetId, reason, details } = req.body as {
    targetType: string;
    targetId: number;
    reason: string;
    details?: string;
  };

  if (!targetType || !targetId || !reason) {
    res.status(400).json({ error: "targetType, targetId, and reason are required" });
    return;
  }

  const [report] = await db
    .insert(reportsTable)
    .values({
      reporterId: req.session.userId!,
      targetType,
      targetId,
      reason,
      details: details ?? null,
    })
    .returning();

  res.status(201).json(report);
});

router.patch("/:id/action", requireModOrAdmin, async (req, res) => {
  const reportId = parseInt(req.params.id, 10);

  const [report] = await db
    .update(reportsTable)
    .set({ isActioned: true, isDismissed: true })
    .where(eq(reportsTable.id, reportId))
    .returning();

  if (!report) {
    res.status(404).json({ error: "Report not found" });
    return;
  }

  if (report.reporterId) {
    await sendBotMessage(
      report.reporterId,
      `✅ Your report (#${report.id}) has been **reviewed and actioned** by our moderation team. Thank you for helping keep the community safe.`,
    ).catch(() => {});
  }

  res.json({ ok: true });
});

export default router;
