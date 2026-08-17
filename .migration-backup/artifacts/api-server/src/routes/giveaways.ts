// @ts-nocheck
import express from "express";
import { db, giveawaysTable, giveawayEntriesTable, usersTable } from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";

const router = express.Router();

router.get("/", async (req, res) => {
  const userId = req.session?.userId;
  const giveaways = await db.select().from(giveawaysTable).orderBy(desc(giveawaysTable.createdAt));

  let enteredIds = new Set<number>();
  if (userId) {
    const entries = await db
      .select({ giveawayId: giveawayEntriesTable.giveawayId })
      .from(giveawayEntriesTable)
      .where(eq(giveawayEntriesTable.userId, userId));
    enteredIds = new Set(entries.map((e) => e.giveawayId));
  }

  res.json(giveaways.map((g) => ({ ...g, userHasEntered: enteredIds.has(g.id) })));
});

router.post("/", requireAdmin, async (req, res) => {
  const { title, description, prize, taskDescription, taskLink, taskCode, maxEntries, endDate, autoApprove } = req.body;
  if (!title || !description || !prize || !taskDescription || !endDate) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const [giveaway] = await db
    .insert(giveawaysTable)
    .values({
      createdBy: req.session.userId!,
      title,
      description,
      prize,
      taskDescription,
      taskLink: taskLink ?? null,
      taskCode: taskCode ?? null,
      maxEntries: maxEntries ?? 100,
      endDate: new Date(endDate),
      autoApprove: !!autoApprove,
    })
    .returning();

  res.status(201).json({ ...giveaway, userHasEntered: false });
});

router.get("/:giveawayId", async (req, res) => {
  const giveawayId = parseInt(req.params.giveawayId, 10);
  const userId = req.session?.userId;

  const [giveaway] = await db.select().from(giveawaysTable).where(eq(giveawaysTable.id, giveawayId)).limit(1);
  if (!giveaway) {
    res.status(404).json({ error: "Giveaway not found" });
    return;
  }

  let userHasEntered = false;
  if (userId) {
    const [entry] = await db.select().from(giveawayEntriesTable)
      .where(and(eq(giveawayEntriesTable.giveawayId, giveawayId), eq(giveawayEntriesTable.userId, userId)))
      .limit(1);
    userHasEntered = !!entry;
  }

  res.json({ ...giveaway, userHasEntered });
});

router.delete("/:giveawayId", requireAdmin, async (req, res) => {
  const giveawayId = parseInt(req.params.giveawayId, 10);
  await db.delete(giveawaysTable).where(eq(giveawaysTable.id, giveawayId));
  res.json({ message: "Giveaway deleted" });
});

router.post("/:giveawayId/enter", requireAuth, async (req, res) => {
  const giveawayId = parseInt(req.params.giveawayId, 10);
  const userId = req.session.userId!;
  const { taskProof, code } = req.body as { taskProof?: string; code?: string };

  // Check banned
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (user?.isBanned) {
    res.status(403).json({ error: "Banned users cannot enter giveaways" });
    return;
  }

  const [giveaway] = await db.select().from(giveawaysTable).where(eq(giveawaysTable.id, giveawayId)).limit(1);
  if (!giveaway || !giveaway.isActive) {
    res.status(400).json({ error: "Giveaway is not active" });
    return;
  }
  if (new Date() > giveaway.endDate) {
    res.status(400).json({ error: "Giveaway has ended" });
    return;
  }
  if (giveaway.entriesCount >= giveaway.maxEntries) {
    res.status(400).json({ error: "Giveaway is full" });
    return;
  }

  // Code verification
  const codeProvided = code && code.trim();
  const codeCorrect = codeProvided && giveaway.taskCode && codeProvided === giveaway.taskCode.trim();

  if (giveaway.taskCode) {
    if (!codeCorrect) {
      res.status(400).json({ error: "Incorrect code. Complete the task and enter the correct code." });
      return;
    }
  }

  const [existing] = await db.select().from(giveawayEntriesTable)
    .where(and(eq(giveawayEntriesTable.giveawayId, giveawayId), eq(giveawayEntriesTable.userId, userId)))
    .limit(1);
  if (existing) {
    res.status(400).json({ error: "Already entered this giveaway" });
    return;
  }

  // IP deduplication
  const ip = (req.headers["x-forwarded-for"] as string || req.socket?.remoteAddress || "unknown").split(",")[0].trim();

  if (ip !== "unknown") {
    const sameIpUsers = await db
      .select({ id: usersTable.id, createdAt: usersTable.createdAt })
      .from(usersTable)
      .where(eq(usersTable.registrationIp, ip));

    if (sameIpUsers.length > 1) {
      const earliest = sameIpUsers.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];
      if (earliest.id !== userId) {
        res.status(403).json({ error: "Only one entry per IP address is allowed. Your account is not the first registered from this IP." });
        return;
      }
    }
  }

  // Auto-approve if: giveaway has autoApprove flag, OR if a code was correctly provided
  const shouldAutoApprove = giveaway.autoApprove || (!!giveaway.taskCode && codeCorrect);

  await db.insert(giveawayEntriesTable).values({
    giveawayId,
    userId,
    taskProof: taskProof ?? null,
    ipAddress: ip,
    isApproved: shouldAutoApprove,
    isRejected: false,
  });
  await db.update(giveawaysTable).set({ entriesCount: sql`${giveawaysTable.entriesCount} + 1` }).where(eq(giveawaysTable.id, giveawayId));

  res.json({ message: "Entered successfully", autoApproved: shouldAutoApprove });
});

router.get("/:giveawayId/entries", requireAdmin, async (req, res) => {
  const giveawayId = parseInt(req.params.giveawayId, 10);
  const entries = await db
    .select({
      id: giveawayEntriesTable.id,
      giveawayId: giveawayEntriesTable.giveawayId,
      userId: giveawayEntriesTable.userId,
      taskProof: giveawayEntriesTable.taskProof,
      ipAddress: giveawayEntriesTable.ipAddress,
      isApproved: giveawayEntriesTable.isApproved,
      isRejected: giveawayEntriesTable.isRejected,
      createdAt: giveawayEntriesTable.createdAt,
      username: usersTable.username,
    })
    .from(giveawayEntriesTable)
    .leftJoin(usersTable, eq(giveawayEntriesTable.userId, usersTable.id))
    .where(eq(giveawayEntriesTable.giveawayId, giveawayId));
  res.json(entries);
});

// Approve an entry
router.patch("/:giveawayId/entries/:entryId/approve", requireAdmin, async (req, res) => {
  const entryId = parseInt(req.params.entryId, 10);
  await db.update(giveawayEntriesTable)
    .set({ isApproved: true, isRejected: false })
    .where(eq(giveawayEntriesTable.id, entryId));
  res.json({ ok: true });
});

// Reject an entry
router.patch("/:giveawayId/entries/:entryId/reject", requireAdmin, async (req, res) => {
  const entryId = parseInt(req.params.entryId, 10);
  await db.update(giveawayEntriesTable)
    .set({ isApproved: false, isRejected: true })
    .where(eq(giveawayEntriesTable.id, entryId));
  res.json({ ok: true });
});

router.post("/:giveawayId/draw", requireAdmin, async (req, res) => {
  const giveawayId = parseInt(req.params.giveawayId, 10);

  // Fetch giveaway to check autoApprove
  const [giveaway] = await db.select().from(giveawaysTable).where(eq(giveawaysTable.id, giveawayId)).limit(1);

  // Draw only from approved, non-banned entries
  const baseCondition = and(
    eq(giveawayEntriesTable.giveawayId, giveawayId),
    eq(usersTable.isBanned, false),
  );
  const entries = await db
    .select({ userId: giveawayEntriesTable.userId, username: usersTable.username })
    .from(giveawayEntriesTable)
    .innerJoin(usersTable, eq(giveawayEntriesTable.userId, usersTable.id))
    .where(
      giveaway?.autoApprove
        ? baseCondition
        : and(baseCondition, eq(giveawayEntriesTable.isApproved, true))
    );

  if (entries.length === 0) {
    res.status(400).json({ error: "No approved entries to draw from" });
    return;
  }

  const winner = entries[Math.floor(Math.random() * entries.length)];
  await db.update(giveawaysTable)
    .set({ winnerUserId: winner.userId, winnerUsername: winner.username, isActive: false })
    .where(eq(giveawaysTable.id, giveawayId));

  res.json({ message: "Winner drawn", winnerUserId: winner.userId, winnerUsername: winner.username });
});

export default router;
