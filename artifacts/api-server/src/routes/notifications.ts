// @ts-nocheck
import express from "express";
import { db, notificationsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = express.Router();

// GET /api/notifications — latest 30 for current user
router.get("/", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const rows = await db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, userId))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(30);
  res.json(rows);
});

// GET /api/notifications/unread/count
router.get("/unread/count", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const rows = await db
    .select()
    .from(notificationsTable)
    .where(and(eq(notificationsTable.userId, userId), eq(notificationsTable.isRead, false)));
  res.json({ count: rows.length });
});

// POST /api/notifications/read-all
router.post("/read-all", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(eq(notificationsTable.userId, userId));
  res.json({ ok: true });
});

export default router;
