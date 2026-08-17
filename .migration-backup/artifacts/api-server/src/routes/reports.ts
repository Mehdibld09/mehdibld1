// @ts-nocheck
import express from "express";
import { db, reportsTable, usersTable, messagesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";

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

router.patch("/:id/action", requireAdmin, async (req, res) => {
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
    const [admin] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.isAdmin, true))
      .limit(1);

    const senderId = admin?.id;
    if (senderId) {
      await db.insert(messagesTable).values({
        senderId,
        receiverId: reporter.id,
        content: `✅ Your report (#${report.id}) has been **reviewed and actioned** by our moderation team. Thank you for helping keep the community safe.`,
      });
    }
  }

  res.json({ ok: true });
});

export default router;
