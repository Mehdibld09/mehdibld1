// @ts-nocheck
import express from "express";
import { db, usersTable, accountsTable, reportsTable, commentsTable } from "@workspace/db";
import { eq, desc, sql, and, inArray, isNotNull } from "drizzle-orm";
import { requireAdmin, requireModOrAdmin } from "../middlewares/auth";
import { sendBotMessage } from "../lib/adminBot";
import { getSetting } from "../lib/settings";

function addXp(userId: number, amount: number) {
  return db
    .update(usersTable)
    .set({
      xp: sql`${usersTable.xp} + ${amount}`,
      level: sql`FLOOR((${usersTable.xp} + ${amount}) / 100) + 1`,
    })
    .where(eq(usersTable.id, userId));
}

const router = express.Router();

// --- Users ---
router.get("/users", requireModOrAdmin, async (req, res) => {
  const page = parseInt(String(req.query.page ?? "1"), 10);
  const limit = 50;
  const offset = (page - 1) * limit;

  const users = await db
    .select({
      id: usersTable.id,
      username: usersTable.username,
      avatarUrl: usersTable.avatarUrl,
      points: usersTable.points,
      xp: usersTable.xp,
      level: usersTable.level,
      badgeName: usersTable.badgeName,
      isAdmin: usersTable.isAdmin,
      isModerator: usersTable.isModerator,
      isBanned: usersTable.isBanned,
      banReason: usersTable.banReason,
      banExpiresAt: usersTable.banExpiresAt,
      createdAt: usersTable.createdAt,
      premiumTier: usersTable.premiumTier,
      premiumExpiresAt: usersTable.premiumExpiresAt,
    })
    .from(usersTable)
    .orderBy(desc(usersTable.createdAt))
    .limit(limit)
    .offset(offset);

  res.json(users);
});

// Timed ban with reason — POST body: { durationHours?: number, reason?: string }
router.post("/users/:userId/ban", requireModOrAdmin, async (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  const { durationHours, reason } = req.body as { durationHours?: number; reason?: string };

  // Moderators cannot ban other moderators or admins
  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (!req.session.isAdmin && (target.isAdmin || target.isModerator)) {
    res.status(403).json({ error: "Moderators cannot ban admins or other moderators" });
    return;
  }

  const banExpiresAt = durationHours
    ? new Date(Date.now() + durationHours * 60 * 60 * 1000)
    : null;

  await db.update(usersTable)
    .set({ isBanned: true, banReason: reason ?? null, banExpiresAt })
    .where(eq(usersTable.id, userId));
  res.json({ message: "User banned" });
});

router.delete("/users/:userId/ban", requireModOrAdmin, async (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  await db.update(usersTable)
    .set({ isBanned: false, banReason: null, banExpiresAt: null })
    .where(eq(usersTable.id, userId));
  res.json({ message: "User unbanned" });
});

// Promote / demote moderator — admin only
router.post("/users/:userId/moderator", requireAdmin, async (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  const { promote } = req.body as { promote: boolean };
  await db.update(usersTable).set({ isModerator: !!promote }).where(eq(usersTable.id, userId));
  res.json({ message: promote ? "User promoted to moderator" : "Moderator role removed" });
});

// Give / remove points — admin only
router.post("/users/:userId/points", requireAdmin, async (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  const { delta } = req.body as { delta: number };
  if (typeof delta !== "number") {
    res.status(400).json({ error: "delta must be a number" });
    return;
  }
  await db.update(usersTable)
    .set({ points: sql`GREATEST(${usersTable.points} + ${delta}, 0)` })
    .where(eq(usersTable.id, userId));
  res.json({ message: `Points adjusted by ${delta}` });
});

// --- Pending Account Reviews ---
router.get("/pending-accounts", requireModOrAdmin, async (req, res) => {
  const accounts = await db
    .select({
      id: accountsTable.id,
      userId: accountsTable.userId,
      title: accountsTable.title,
      description: accountsTable.description,
      games: accountsTable.games,
      pointsCost: accountsTable.pointsCost,
      status: accountsTable.status,
      reviewNote: accountsTable.reviewNote,
      createdAt: accountsTable.createdAt,
      steamUsername: accountsTable.steamUsername,
      steamPassword: accountsTable.steamPassword,
      posterUsername: usersTable.username,
      posterAvatarUrl: usersTable.avatarUrl,
    })
    .from(accountsTable)
    .leftJoin(usersTable, eq(accountsTable.userId, usersTable.id))
    .where(eq(accountsTable.status, "pending"))
    .orderBy(desc(accountsTable.createdAt));
  res.json(accounts);
});

router.post("/accounts/:accountId/approve", requireModOrAdmin, async (req, res) => {
  const accountId = parseInt(req.params.accountId, 10);
  const { games } = req.body as { games?: string[] };

  const [account] = await db
    .select({ id: accountsTable.id, userId: accountsTable.userId, status: accountsTable.status, title: accountsTable.title })
    .from(accountsTable)
    .where(eq(accountsTable.id, accountId))
    .limit(1);

  if (!account) {
    res.status(404).json({ error: "Account not found" });
    return;
  }
  if (account.status !== "pending") {
    res.status(400).json({ error: "Account is not pending review" });
    return;
  }

  const updates: Record<string, unknown> = { status: "approved", isAvailable: true, reviewNote: null };
  if (games && Array.isArray(games)) updates.games = games;

  await db.update(accountsTable).set(updates).where(eq(accountsTable.id, accountId));
  const [xpUpload, ptsUpload] = await Promise.all([
    getSetting("xp_upload_account"),
    getSetting("points_upload_account"),
  ]);
  await addXp(account.userId, xpUpload);
  if (ptsUpload > 0) {
    await db.update(usersTable)
      .set({ points: sql`${usersTable.points} + ${ptsUpload}` })
      .where(eq(usersTable.id, account.userId));
  }

  await sendBotMessage(
    account.userId,
    `✅ Your listing **${account.title}** has been approved and is now live! You've earned ${xpUpload} XP${ptsUpload > 0 ? ` and ${ptsUpload} points` : ""}.`,
  ).catch(() => {});

  res.json({ message: "Account approved and published" });
});

router.post("/accounts/:accountId/reject", requireModOrAdmin, async (req, res) => {
  const accountId = parseInt(req.params.accountId, 10);
  const { note } = req.body as { note?: string };

  const [account] = await db
    .select({ id: accountsTable.id, status: accountsTable.status, userId: accountsTable.userId, title: accountsTable.title })
    .from(accountsTable)
    .where(eq(accountsTable.id, accountId))
    .limit(1);

  if (!account) {
    res.status(404).json({ error: "Account not found" });
    return;
  }

  await db.update(accountsTable)
    .set({ status: "rejected", reviewNote: note ?? null })
    .where(eq(accountsTable.id, accountId));

  const reason = note?.trim() ? ` Reason: ${note.trim()}` : "";
  await sendBotMessage(
    account.userId,
    `❌ Your listing **${account.title}** was not approved.${reason} You can edit and resubmit it.`,
  ).catch(() => {});

  res.json({ message: "Account rejected" });
});

// --- Reports ---
router.get("/reports", requireModOrAdmin, async (req, res) => {
  const reports = await db
    .select({
      id: reportsTable.id,
      reporterId: reportsTable.reporterId,
      targetType: reportsTable.targetType,
      targetId: reportsTable.targetId,
      reason: reportsTable.reason,
      details: reportsTable.details,
      isDismissed: reportsTable.isDismissed,
      isActioned: reportsTable.isActioned,
      createdAt: reportsTable.createdAt,
      reporterUsername: usersTable.username,
    })
    .from(reportsTable)
    .leftJoin(usersTable, eq(reportsTable.reporterId, usersTable.id))
    .orderBy(desc(reportsTable.createdAt));

  // Enrich comment reports with comment content and author info
  const commentTargetIds = reports
    .filter((r) => r.targetType === "comment")
    .map((r) => r.targetId);

  let commentMap: Record<number, { content: string; authorId: number; authorUsername: string }> = {};
  if (commentTargetIds.length > 0) {
    const comments = await db
      .select({
        id: commentsTable.id,
        content: commentsTable.content,
        authorId: commentsTable.userId,
        authorUsername: usersTable.username,
      })
      .from(commentsTable)
      .leftJoin(usersTable, eq(commentsTable.userId, usersTable.id))
      .where(inArray(commentsTable.id, commentTargetIds));

    for (const c of comments) {
      commentMap[c.id] = {
        content: c.content,
        authorId: c.authorId,
        authorUsername: c.authorUsername ?? "",
      };
    }
  }

  const enriched = reports.map((r) => ({
    ...r,
    commentContent: r.targetType === "comment" ? (commentMap[r.targetId]?.content ?? null) : null,
    commentAuthorId: r.targetType === "comment" ? (commentMap[r.targetId]?.authorId ?? null) : null,
    commentAuthorUsername: r.targetType === "comment" ? (commentMap[r.targetId]?.authorUsername ?? null) : null,
  }));

  res.json(enriched);
});

router.patch("/reports/:reportId/dismiss", requireModOrAdmin, async (req, res) => {
  const reportId = parseInt(req.params.reportId, 10);
  await db.update(reportsTable).set({ isDismissed: true }).where(eq(reportsTable.id, reportId));
  res.json({ message: "Report dismissed" });
});

// Delete a comment (used when actioning a comment report with "delete content")
router.delete("/comments/:commentId", requireModOrAdmin, async (req, res) => {
  const commentId = parseInt(req.params.commentId, 10);
  await db.delete(commentsTable).where(eq(commentsTable.id, commentId));
  res.json({ ok: true });
});

// Admin Dashboard stats
router.get("/dashboard", requireAdmin, async (_req, res) => {
  const now = new Date();
  const ago24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const ago7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const ago30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    [{ total: totalUsers }],
    [{ total: newUsers24h }],
    [{ total: newUsers7d }],
    [{ total: newUsers30d }],
    [{ total: bannedUsers }],
    [{ total: totalAccounts }],
    [{ total: newAccounts24h }],
    [{ total: newAccounts7d }],
    [{ total: removedAccounts }],
    [{ total: pendingAccounts }],
    [{ total: totalReports }],
    [{ total: openReports }],
    [{ total: totalClaims }],
    [{ total: totalPoints }],
  ] = await Promise.all([
    db.select({ total: sql<number>`count(*)` }).from(usersTable),
    db.select({ total: sql<number>`count(*)` }).from(usersTable).where(sql`${usersTable.createdAt} >= ${ago24h}`),
    db.select({ total: sql<number>`count(*)` }).from(usersTable).where(sql`${usersTable.createdAt} >= ${ago7d}`),
    db.select({ total: sql<number>`count(*)` }).from(usersTable).where(sql`${usersTable.createdAt} >= ${ago30d}`),
    db.select({ total: sql<number>`count(*)` }).from(usersTable).where(eq(usersTable.isBanned, true)),
    db.select({ total: sql<number>`count(*)` }).from(accountsTable),
    db.select({ total: sql<number>`count(*)` }).from(accountsTable).where(sql`${accountsTable.createdAt} >= ${ago24h}`),
    db.select({ total: sql<number>`count(*)` }).from(accountsTable).where(sql`${accountsTable.createdAt} >= ${ago7d}`),
    db.select({ total: sql<number>`count(*)` }).from(accountsTable).where(eq(accountsTable.isAvailable, false)),
    db.select({ total: sql<number>`count(*)` }).from(accountsTable).where(eq(accountsTable.status, "pending")),
    db.select({ total: sql<number>`count(*)` }).from(reportsTable),
    db.select({ total: sql<number>`count(*)` }).from(reportsTable).where(eq(reportsTable.isDismissed, false)),
    db.select({ total: sql<number>`coalesce(sum(${accountsTable.claimsCount}), 0)` }).from(accountsTable),
    db.select({ total: sql<number>`coalesce(sum(${usersTable.points}), 0)` }).from(usersTable),
  ]);

  res.json({
    users: {
      total: Number(totalUsers),
      new24h: Number(newUsers24h),
      new7d: Number(newUsers7d),
      new30d: Number(newUsers30d),
      banned: Number(bannedUsers),
    },
    accounts: {
      total: Number(totalAccounts),
      new24h: Number(newAccounts24h),
      new7d: Number(newAccounts7d),
      removed: Number(removedAccounts),
      pending: Number(pendingAccounts),
    },
    reports: {
      total: Number(totalReports),
      open: Number(openReports),
    },
    activity: {
      totalClaims: Number(totalClaims),
      pointsCirculating: Number(totalPoints),
    },
  });
});

// GET /admin/deleted-accounts — list all soft-deleted accounts (admin only)
router.get("/deleted-accounts", requireAdmin, async (req, res) => {
  const page = parseInt(String(req.query.page ?? "1"), 10);
  const limit = 50;
  const offset = (page - 1) * limit;

  const rows = await db
    .select({
      id: accountsTable.id,
      title: accountsTable.title,
      steamUsername: accountsTable.steamUsername,
      createdAt: accountsTable.createdAt,
      deletedAt: accountsTable.deletedAt,
      deletedReason: accountsTable.deletedReason,
      posterUsername: usersTable.username,
      deletedByUserId: accountsTable.deletedByUserId,
    })
    .from(accountsTable)
    .leftJoin(usersTable, eq(accountsTable.userId, usersTable.id))
    .where(isNotNull(accountsTable.deletedAt))
    .orderBy(desc(accountsTable.deletedAt))
    .limit(limit)
    .offset(offset);

  // Fetch deleter usernames separately
  const deleterIds = [...new Set(rows.map(r => r.deletedByUserId).filter(Boolean))] as number[];
  let deleters: Record<number, string> = {};
  if (deleterIds.length > 0) {
    const deleterRows = await db
      .select({ id: usersTable.id, username: usersTable.username })
      .from(usersTable)
      .where(inArray(usersTable.id, deleterIds));
    deleters = Object.fromEntries(deleterRows.map(d => [d.id, d.username]));
  }

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(accountsTable)
    .where(isNotNull(accountsTable.deletedAt));

  const result = rows.map(r => ({
    ...r,
    deletedByUsername: r.deletedByUserId ? (deleters[r.deletedByUserId] ?? `#${r.deletedByUserId}`) : "Unknown",
  }));

  res.json({ accounts: result, total: Number(count), page, limit });
});

// POST /admin/deleted-accounts/:accountId/restore — restore a soft-deleted account (admin only)
router.post("/deleted-accounts/:accountId/restore", requireAdmin, async (req, res) => {
  const accountId = parseInt(req.params.accountId, 10);
  if (isNaN(accountId)) { res.status(400).json({ error: "Invalid account id" }); return; }

  await db.update(accountsTable)
    .set({ deletedAt: null, deletedByUserId: null, deletedReason: null, isAvailable: true })
    .where(eq(accountsTable.id, accountId));

  res.json({ message: "Account restored" });
});

export default router;
