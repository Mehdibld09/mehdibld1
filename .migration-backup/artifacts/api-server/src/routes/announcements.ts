// @ts-nocheck
import express from "express";
import { db, announcementsTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAdmin } from "../middlewares/auth";

const router = express.Router();

// GET all announcements (public)
router.get("/", async (req, res) => {
  const rows = await db
    .select({
      id: announcementsTable.id,
      title: announcementsTable.title,
      description: announcementsTable.description,
      pinned: announcementsTable.pinned,
      isPopup: announcementsTable.isPopup,
      popupButtons: announcementsTable.popupButtons,
      authorId: announcementsTable.authorId,
      createdAt: announcementsTable.createdAt,
      authorUsername: usersTable.username,
    })
    .from(announcementsTable)
    .leftJoin(usersTable, eq(announcementsTable.authorId, usersTable.id))
    .orderBy(desc(announcementsTable.pinned), desc(announcementsTable.createdAt));

  const result = rows.map((r) => ({
    ...r,
    popupButtons: (() => { try { return JSON.parse(r.popupButtons || "[]"); } catch { return []; } })(),
  }));
  res.json(result);
});

// POST create announcement (admin only)
router.post("/", requireAdmin, async (req, res) => {
  const { title, description, pinned, isPopup, popupButtons } = req.body;
  if (!title || typeof title !== "string" || title.trim().length === 0) {
    res.status(400).json({ error: "Title is required" });
    return;
  }
  if (!description || typeof description !== "string" || description.trim().length === 0) {
    res.status(400).json({ error: "Description is required" });
    return;
  }
  const buttonsJson = JSON.stringify(Array.isArray(popupButtons) ? popupButtons : []);
  const [row] = await db
    .insert(announcementsTable)
    .values({
      title: title.trim(),
      description: description.trim(),
      pinned: pinned !== false,
      isPopup: isPopup === true,
      popupButtons: buttonsJson,
      authorId: req.session.userId!,
    })
    .returning();
  res.status(201).json({ ...row, popupButtons: JSON.parse(row.popupButtons || "[]") });
});

// PATCH update announcement (admin only)
router.patch("/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { title, description, pinned, isPopup, popupButtons } = req.body;
  const updates: Record<string, unknown> = {};
  if (title !== undefined) updates.title = String(title).trim();
  if (description !== undefined) updates.description = String(description).trim();
  if (pinned !== undefined) updates.pinned = Boolean(pinned);
  if (isPopup !== undefined) updates.isPopup = Boolean(isPopup);
  if (popupButtons !== undefined) updates.popupButtons = JSON.stringify(Array.isArray(popupButtons) ? popupButtons : []);
  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "Nothing to update" });
    return;
  }
  const [row] = await db
    .update(announcementsTable)
    .set(updates)
    .where(eq(announcementsTable.id, id))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...row, popupButtons: (() => { try { return JSON.parse(row.popupButtons || "[]"); } catch { return []; } })() });
});

// DELETE announcement (admin only)
router.delete("/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  await db.delete(announcementsTable).where(eq(announcementsTable.id, id));
  res.json({ message: "Deleted" });
});

export default router;
