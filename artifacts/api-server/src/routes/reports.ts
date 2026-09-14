// @ts-nocheck
import express from "express";
import { db, reportsTable, usersTable, notificationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireModOrAdmin } from "../middlewares/auth";

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

  const [reporter] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.id, report.reporterId))
    .limit(1);

  if (reporter) {
    await db.insert(notificationsTable).values({
      userId: reporter.id,
      type: "admin_update",
      actorUsername: "Admin",
      message: `✅ Your report (#${report.id}) has been reviewed and actioned by our moderation team. Thank you for helping keep the community safe.`,
      linkUrl: null,
      isRead: false,
    });
  }

  res.json({ ok: true });
});

export default router;
