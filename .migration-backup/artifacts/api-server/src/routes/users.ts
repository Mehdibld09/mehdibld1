// @ts-nocheck
import express from "express";
import { db, usersTable, accountsTable, likesTable } from "@workspace/db";
import { eq, desc, sql, ne } from "drizzle-orm";

const router = express.Router();

router.get("/leaderboard/rank", async (req, res) => {
  const userId = req.session?.userId;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }
  const [me] = await db.select({ xp: usersTable.xp }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!me) { res.status(404).json({ error: "User not found" }); return; }
  const [{ rank }] = await db
    .select({ rank: sql<number>`count(*) + 1` })
    .from(usersTable)
    .where(sql`${usersTable.xp} > ${me.xp} AND ${usersTable.isBanned} = false AND ${usersTable.email} != 'adminbot@system.internal'`);
  res.json({ rank: Number(rank), xp: me.xp });
});

router.get("/leaderboard", async (req, res) => {
  const limit = Math.min(parseInt(String(req.query.limit ?? "20"), 10), 100);

  const users = await db
    .select({
      id: usersTable.id,
      username: usersTable.username,
      displayName: usersTable.displayName,
      avatarUrl: usersTable.avatarUrl,
      points: usersTable.points,
      xp: usersTable.xp,
      level: usersTable.level,
      badgeName: usersTable.badgeName,
      isAdmin: usersTable.isAdmin,
      isModerator: usersTable.isModerator,
      isBanned: usersTable.isBanned,
      createdAt: usersTable.createdAt,
      premiumTier: usersTable.premiumTier,
      premiumExpiresAt: usersTable.premiumExpiresAt,
      nameColor: usersTable.nameColor,
      badgeType: usersTable.badgeType,
    })
    .from(usersTable)
    .where(sql`${usersTable.isBanned} = false AND ${usersTable.email} != 'adminbot@system.internal'`)
    .orderBy(desc(usersTable.xp))
    .limit(limit);

  const now = new Date();
  res.json(users.map((u) => {
    const active = u.premiumTier && u.premiumExpiresAt && new Date(u.premiumExpiresAt) > now;
    return {
      ...u,
      nameColor: active ? u.nameColor : null,
      badgeType: active ? u.badgeType : null,
      premiumTier: active ? u.premiumTier : null,
    };
  }));
});

router.get("/:userId", async (req, res) => {
  const userId = parseInt(req.params.userId, 10);

  const [user] = await db
    .select({
      id: usersTable.id,
      username: usersTable.username,
      displayName: usersTable.displayName,
      avatarUrl: usersTable.avatarUrl,
      points: usersTable.points,
      xp: usersTable.xp,
      level: usersTable.level,
      badgeName: usersTable.badgeName,
      isBanned: usersTable.isBanned,
      isAdmin: usersTable.isAdmin,
      isModerator: usersTable.isModerator,
      createdAt: usersTable.createdAt,
      premiumTier: usersTable.premiumTier,
      premiumExpiresAt: usersTable.premiumExpiresAt,
      nameColor: usersTable.nameColor,
      badgeType: usersTable.badgeType,
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const [{ totalAccounts }] = await db
    .select({ totalAccounts: sql<number>`count(*)` })
    .from(accountsTable)
    .where(eq(accountsTable.userId, userId));

  const [{ totalLikesReceived }] = await db
    .select({ totalLikesReceived: sql<number>`count(*)` })
    .from(likesTable)
    .leftJoin(accountsTable, eq(likesTable.targetId, accountsTable.id))
    .where(eq(accountsTable.userId, userId));

  const now = new Date();
  const premiumActive = user.premiumTier && user.premiumExpiresAt && new Date(user.premiumExpiresAt) > now;

  res.json({
    ...user,
    nameColor: premiumActive ? user.nameColor : null,
    badgeType: premiumActive ? user.badgeType : null,
    premiumTier: premiumActive ? user.premiumTier : null,
    totalAccounts: Number(totalAccounts),
    totalLikesReceived: Number(totalLikesReceived),
  });
});

router.get("/:userId/accounts", async (req, res) => {
  const userId = parseInt(req.params.userId, 10);

  const accounts = await db
    .select({
      id: accountsTable.id,
      userId: accountsTable.userId,
      title: accountsTable.title,
      description: accountsTable.description,
      games: accountsTable.games,
      pointsCost: accountsTable.pointsCost,
      isAvailable: accountsTable.isAvailable,
      likesCount: accountsTable.likesCount,
      claimsCount: accountsTable.claimsCount,
      createdAt: accountsTable.createdAt,
      posterUsername: usersTable.username,
      posterAvatarUrl: usersTable.avatarUrl,
    })
    .from(accountsTable)
    .leftJoin(usersTable, eq(accountsTable.userId, usersTable.id))
    .where(eq(accountsTable.userId, userId))
    .orderBy(desc(accountsTable.createdAt));

  res.json(
    accounts.map((a) => ({
      ...a,
      username: a.posterUsername ?? "",
      userHasLiked: false,
    })),
  );
});

export default router;
