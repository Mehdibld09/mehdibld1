// @ts-nocheck
import express from "express";
import { db, accountsTable, usersTable, likesTable, accountVotesTable, commentsTable, accountClaimsTable } from "@workspace/db";
import { eq, desc, and, sql, inArray, isNull } from "drizzle-orm";
import { CreateAccountBody } from "@workspace/api-zod";
import { requireAuth, requireModOrAdmin } from "../middlewares/auth";
import { checkSteamCredentials } from "../lib/steamChecker";
import { filterContent } from "../lib/contentFilter";
import { getSetting } from "../lib/settings";

const router = express.Router();

function addXp(userId: number, amount: number) {
  return db
    .update(usersTable)
    .set({
      xp: sql`${usersTable.xp} + ${amount}`,
      level: sql`FLOOR((${usersTable.xp} + ${amount}) / 100) + 1`,
    })
    .where(eq(usersTable.id, userId));
}

router.post("/verify-credentials", requireAuth, async (req, res) => {
  const { steamUsername, steamPassword } = req.body;
  if (!steamUsername || !steamPassword) {
    res.status(400).json({ error: "steamUsername and steamPassword are required" });
    return;
  }
  const result = await checkSteamCredentials(steamUsername, steamPassword);
  // Detect 2FA: Steam says credentials are valid but 2FA blocks unattended login
  if (result.status === "valid" && result.message.includes("2FA")) {
    res.json({ ...result, status: "2fa" });
    return;
  }
  res.json(result);
});

router.get("/games", async (_req, res) => {
  const rows = await db
    .select({ games: accountsTable.games })
    .from(accountsTable)
    .where(eq(accountsTable.isAvailable, true));
  const counts: Record<string, number> = {};
  for (const row of rows) {
    for (const game of row.games ?? []) {
      counts[game] = (counts[game] ?? 0) + 1;
    }
  }
  const result = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([game, count]) => ({ game, count }));
  res.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
  res.json(result);
});

router.get("/", async (req, res) => {
  const page = parseInt(String(req.query.page ?? "1"), 10);
  const limit = Math.min(parseInt(String(req.query.limit ?? "50"), 10), 100);
  const offset = (page - 1) * limit;
  const game = req.query.game as string | undefined;
  const search = String(req.query.search ?? "").trim();
  const sort = (req.query.sort as string) ?? "recent";
  const userId = req.session?.userId;

  const conditions = [eq(accountsTable.isAvailable, true), isNull(accountsTable.deletedAt)];
  if (game) conditions.push(sql`${game} = ANY(${accountsTable.games})`);
  if (search) {
    const like = `%${search.toLowerCase()}%`;
    conditions.push(sql`(
      LOWER(${accountsTable.title}) LIKE ${like}
      OR LOWER(${accountsTable.description}) LIKE ${like}
      OR EXISTS (SELECT 1 FROM unnest(${accountsTable.games}) g WHERE LOWER(g) LIKE ${like})
    )`);
  }

  // Run the page query and total count in parallel
  const [accounts, [{ count }]] = await Promise.all([
    db
      .select({
        id: accountsTable.id,
        userId: accountsTable.userId,
        title: accountsTable.title,
        description: accountsTable.description,
        games: accountsTable.games,
        pointsCost: accountsTable.pointsCost,
        isAvailable: accountsTable.isAvailable,
        likesCount: accountsTable.likesCount,
        viewCount: accountsTable.viewCount,
        claimsCount: accountsTable.claimsCount,
        workingVotes: accountsTable.workingVotes,
        notWorkingVotes: accountsTable.notWorkingVotes,
        createdAt: accountsTable.createdAt,
        posterUsername: usersTable.username,
        posterAvatarUrl: usersTable.avatarUrl,
        posterIsModerator: usersTable.isModerator,
        posterIsAdmin: usersTable.isAdmin,
        posterPremiumTier: usersTable.premiumTier,
        posterPremiumExpiresAt: usersTable.premiumExpiresAt,
        posterNameColor: usersTable.nameColor,
        posterBadgeType: usersTable.badgeType,
        isPinned: accountsTable.isPinned,
      })
      .from(accountsTable)
      .leftJoin(usersTable, eq(accountsTable.userId, usersTable.id))
      .where(and(...conditions))
      .orderBy(desc(accountsTable.isPinned), sort === "popular" ? desc(accountsTable.likesCount) : desc(accountsTable.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(accountsTable)
      .where(and(...conditions)),
  ]);

  let likedIds = new Set<number>();
  let myVotes = new Map<number, string>();
  if (userId && accounts.length > 0) {
    const accountIds = accounts.map((a) => a.id);
    // Run likes and votes lookups in parallel
    const [liked, votes] = await Promise.all([
      db
        .select({ targetId: likesTable.targetId })
        .from(likesTable)
        .where(and(eq(likesTable.userId, userId), eq(likesTable.targetType, "account"), inArray(likesTable.targetId, accountIds))),
      db
        .select({ accountId: accountVotesTable.accountId, vote: accountVotesTable.vote })
        .from(accountVotesTable)
        .where(and(eq(accountVotesTable.userId, userId), inArray(accountVotesTable.accountId, accountIds))),
    ]);
    likedIds = new Set(liked.map((l) => l.targetId));
    myVotes = new Map(votes.map((v) => [v.accountId, v.vote]));
  }

  const now = new Date();
  const result = accounts.map((a) => {
    const isPremiumActive = a.posterPremiumTier && a.posterPremiumExpiresAt && new Date(a.posterPremiumExpiresAt as any) > now;
    return {
      ...a,
      username: a.posterUsername ?? "",
      userHasLiked: likedIds.has(a.id),
      myVote: myVotes.get(a.id) ?? null,
      posterNameColor: isPremiumActive ? a.posterNameColor : null,
      posterBadgeType: isPremiumActive ? a.posterBadgeType : null,
    };
  });

  res.json({ accounts: result, total: Number(count), page, limit });
});

// GET /check-credentials?username=xxx&password=yyy — checks if the exact username+password combo is already listed
router.get("/check-credentials", requireAuth, async (req, res) => {
  const username = String(req.query.username ?? "").trim();
  const password = String(req.query.password ?? "").trim();
  if (!username || !password) {
    res.json({ exists: false });
    return;
  }
  const [existing] = await db
    .select({ id: accountsTable.id })
    .from(accountsTable)
    .where(and(eq(accountsTable.steamUsername, username), eq(accountsTable.steamPassword, password)))
    .limit(1);
  res.json({ exists: !!existing });
});

router.post("/", requireAuth, async (req, res) => {
  const parsed = CreateAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const userId = req.session.userId!;
  const { title, description, games, pointsCost, steamUsername, steamPassword, unlockMethod } = parsed.data as typeof parsed.data & { unlockMethod?: string };
  const safeUnlockMethod = ["login", "like", "comment"].includes(unlockMethod ?? "") ? (unlockMethod as "login" | "like" | "comment") : "login";

  const existingAccount = await db
    .select({ id: accountsTable.id })
    .from(accountsTable)
    .where(and(eq(accountsTable.steamUsername, steamUsername), eq(accountsTable.steamPassword, steamPassword)))
    .limit(1);

  if (existingAccount.length > 0) {
    res.status(409).json({ error: "This exact Steam account (same username and password) has already been listed." });
    return;
  }

  const [filteredTitle, filteredDescription] = await Promise.all([
    filterContent(title),
    filterContent(description ?? ""),
  ]);

  // Family share accounts (checker returned 0 games) go into pending review
  const isFamilyShare = !!(req.body as any).isFamilyShare;
  const status = isFamilyShare ? "pending" : "approved";
  const isAvailable = !isFamilyShare;

  const isAdmin = req.session.isAdmin;
  const customButtonEnabled = isAdmin && !!(req.body as any).customButtonEnabled;
  const customButtonLabel = customButtonEnabled ? String((req.body as any).customButtonLabel ?? "").trim() || null : null;
  const customButtonUrl = customButtonEnabled ? String((req.body as any).customButtonUrl ?? "").trim() || null : null;

  const [account] = await db
    .insert(accountsTable)
    .values({ userId, title: filteredTitle, description: filteredDescription, games, pointsCost, steamUsername, steamPassword, unlockMethod: safeUnlockMethod, status, isAvailable, customButtonEnabled, customButtonLabel, customButtonUrl })
    .returning();

  // Only award XP and points immediately for instantly published accounts
  if (!isFamilyShare) {
    const [xp, pts] = await Promise.all([
      getSetting("xp_upload_account"),
      getSetting("points_upload_account"),
    ]);
    await addXp(userId, xp);
    if (pts > 0) {
      await db.update(usersTable)
        .set({ points: sql`${usersTable.points} + ${pts}` })
        .where(eq(usersTable.id, userId));
    }
  }

  const [user] = await db.select({ username: usersTable.username, avatarUrl: usersTable.avatarUrl, isAdmin: usersTable.isAdmin, isModerator: usersTable.isModerator })
    .from(usersTable).where(eq(usersTable.id, userId));

  res.status(201).json({
    ...account,
    username: user?.username ?? "",
    posterUsername: user?.username ?? "",
    posterAvatarUrl: user?.avatarUrl ?? null,
    posterIsAdmin: user?.isAdmin ?? false,
    posterIsModerator: user?.isModerator ?? false,
    userHasLiked: false,
    myVote: null,
    pendingReview: isFamilyShare,
  });
});

router.get("/:accountId", async (req, res) => {
  const accountId = parseInt(req.params.accountId, 10);
  const userId = req.session?.userId;

  const [account] = await db
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
      workingVotes: accountsTable.workingVotes,
      notWorkingVotes: accountsTable.notWorkingVotes,
      viewCount: accountsTable.viewCount,
      unlockMethod: accountsTable.unlockMethod,
      createdAt: accountsTable.createdAt,
      posterUsername: usersTable.username,
      posterAvatarUrl: usersTable.avatarUrl,
      posterIsAdmin: usersTable.isAdmin,
      posterIsModerator: usersTable.isModerator,
      posterPremiumTier: usersTable.premiumTier,
      posterPremiumExpiresAt: usersTable.premiumExpiresAt,
      posterNameColor: usersTable.nameColor,
      posterBadgeType: usersTable.badgeType,
      lastCheckedAt: accountsTable.lastCheckedAt,
      lastCheckStatus: accountsTable.lastCheckStatus,
      healthFailCount: accountsTable.healthFailCount,
      isPinned: accountsTable.isPinned,
      customButtonEnabled: accountsTable.customButtonEnabled,
      customButtonLabel: accountsTable.customButtonLabel,
      customButtonUrl: accountsTable.customButtonUrl,
    })
    .from(accountsTable)
    .leftJoin(usersTable, eq(accountsTable.userId, usersTable.id))
    .where(and(eq(accountsTable.id, accountId), isNull(accountsTable.deletedAt)))
    .limit(1);

  if (!account) {
    res.status(404).json({ error: "Account not found" });
    return;
  }

  // Increment view count once per session (fire-and-forget)
  const viewedKey = `viewed_${accountId}`;
  if (!req.session[viewedKey]) {
    req.session[viewedKey] = true;
    db.update(accountsTable)
      .set({ viewCount: sql`${accountsTable.viewCount} + 1` })
      .where(eq(accountsTable.id, accountId))
      .catch(() => {});
  }

  let userHasLiked = false;
  let myVote: string | null = null;
  let userHasCommented = false;
  let myClaim: { steamUsername: string; steamPassword: string } | null = null;

  if (userId) {
    // All four user-specific lookups are independent — run them in parallel
    const [likeRows, voteRows, commentRows, claimRows] = await Promise.all([
      db.select({ id: likesTable.id }).from(likesTable)
        .where(and(eq(likesTable.userId, userId), eq(likesTable.targetType, "account"), eq(likesTable.targetId, accountId)))
        .limit(1),
      db.select({ vote: accountVotesTable.vote }).from(accountVotesTable)
        .where(and(eq(accountVotesTable.userId, userId), eq(accountVotesTable.accountId, accountId)))
        .limit(1),
      db.select({ id: commentsTable.id }).from(commentsTable)
        .where(and(eq(commentsTable.userId, userId), eq(commentsTable.accountId, accountId)))
        .limit(1),
      db.select().from(accountClaimsTable)
        .where(and(eq(accountClaimsTable.userId, userId), eq(accountClaimsTable.accountId, accountId)))
        .limit(1),
    ]);
    userHasLiked = likeRows.length > 0;
    myVote = voteRows[0]?.vote ?? null;
    userHasCommented = commentRows.length > 0;
    if (claimRows[0]) {
      myClaim = { steamUsername: claimRows[0].steamUsername ?? "", steamPassword: claimRows[0].steamPassword ?? "" };
    }
  }

  res.json({ ...account, username: account.posterUsername ?? "", userHasLiked, myVote, userHasCommented, myClaim });
});

// Edit account (owner / admin / mod)
router.patch("/:accountId", requireAuth, async (req, res) => {
  const accountId = parseInt(req.params.accountId, 10);
  const userId = req.session.userId!;
  const isAdmin = req.session.isAdmin;
  const isModerator = req.session.isModerator;

  const [account] = await db.select().from(accountsTable).where(eq(accountsTable.id, accountId)).limit(1);
  if (!account) {
    res.status(404).json({ error: "Account not found" });
    return;
  }
  if (account.userId !== userId && !isAdmin && !isModerator) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const { title, description, games, pointsCost, isPinned, customButtonEnabled, customButtonLabel, customButtonUrl } = req.body as {
    title?: string;
    description?: string;
    games?: string[];
    pointsCost?: number;
    isPinned?: boolean;
    customButtonEnabled?: boolean;
    customButtonLabel?: string;
    customButtonUrl?: string;
  };

  const updates: Partial<typeof account> = {};
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (games !== undefined) updates.games = games;
  if (pointsCost !== undefined) updates.pointsCost = pointsCost;
  // Admin-only fields
  if (isAdmin) {
    if (isPinned !== undefined) updates.isPinned = isPinned;
    if (customButtonEnabled !== undefined) updates.customButtonEnabled = customButtonEnabled;
    if (customButtonLabel !== undefined) updates.customButtonLabel = customButtonLabel;
    if (customButtonUrl !== undefined) updates.customButtonUrl = customButtonUrl;
  }

  const [updated] = await db.update(accountsTable).set(updates).where(eq(accountsTable.id, accountId)).returning();
  res.json(updated);
});

router.delete("/:accountId", requireAuth, async (req, res) => {
  const accountId = parseInt(req.params.accountId, 10);
  const userId = req.session.userId!;
  const isAdmin = req.session.isAdmin;
  const isModerator = req.session.isModerator;

  const [account] = await db.select().from(accountsTable).where(eq(accountsTable.id, accountId)).limit(1);
  if (!account) {
    res.status(404).json({ error: "Account not found" });
    return;
  }
  if (account.userId !== userId && !isAdmin && !isModerator) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const reason = String((req.body as any)?.reason ?? "").trim() || null;
  await db.update(accountsTable)
    .set({ deletedAt: new Date(), deletedByUserId: userId, deletedReason: reason, isAvailable: false })
    .where(eq(accountsTable.id, accountId));
  res.json({ message: "Account deleted" });
});

router.post("/:accountId/claim", requireAuth, async (req, res) => {
  const accountId = parseInt(req.params.accountId, 10);
  const userId = req.session.userId!;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  if (user.isBanned) {
    res.status(403).json({ error: "Your account is banned" });
    return;
  }

  const [account] = await db.select().from(accountsTable).where(eq(accountsTable.id, accountId)).limit(1);
  if (!account || !account.isAvailable) {
    res.status(400).json({ error: "Account not available" });
    return;
  }
  if (user.points < account.pointsCost) {
    res.status(400).json({ error: "Not enough points" });
    return;
  }

  // Pro users bypass unlock-method restrictions
  const isProActive =
    user.premiumTier === "pro" &&
    user.premiumExpiresAt !== null &&
    new Date(user.premiumExpiresAt) > new Date();

  // Enforce unlock method (skipped for pro users)
  if (!isProActive) {
    const unlockMethod = account.unlockMethod ?? "login";
    if (unlockMethod === "like") {
      const [like] = await db.select().from(likesTable)
        .where(and(eq(likesTable.userId, userId), eq(likesTable.targetType, "account"), eq(likesTable.targetId, accountId)))
        .limit(1);
      if (!like) {
        res.status(403).json({ error: "You must like this post before claiming." });
        return;
      }
    } else if (unlockMethod === "comment") {
      const [comment] = await db.select({ id: commentsTable.id }).from(commentsTable)
        .where(and(eq(commentsTable.userId, userId), eq(commentsTable.accountId, accountId)))
        .limit(1);
      if (!comment) {
        res.status(403).json({ error: "You must leave a comment before claiming." });
        return;
      }
    }
  }

  // If user already claimed this account before, just return their stored credentials
  const [existingClaim] = await db.select().from(accountClaimsTable)
    .where(and(eq(accountClaimsTable.userId, userId), eq(accountClaimsTable.accountId, accountId)))
    .limit(1);
  if (existingClaim) {
    res.json({ steamUsername: existingClaim.steamUsername, steamPassword: existingClaim.steamPassword, pointsSpent: 0 });
    return;
  }

  // Deduct from claimer and credit poster in parallel — independent rows
  await Promise.all([
    db.update(usersTable).set({ points: sql`${usersTable.points} - ${account.pointsCost}` }).where(eq(usersTable.id, userId)),
    db.update(usersTable).set({ points: sql`${usersTable.points} + ${account.pointsCost}` }).where(eq(usersTable.id, account.userId)),
  ]);

  if (account.pointsCost > 0) {
    await db.update(accountsTable).set({ isAvailable: false, claimsCount: sql`${accountsTable.claimsCount} + 1` }).where(eq(accountsTable.id, accountId));
  } else {
    await db.update(accountsTable).set({ claimsCount: sql`${accountsTable.claimsCount} + 1` }).where(eq(accountsTable.id, accountId));
  }

  // Persist the claim so credentials survive page refreshes
  await db.insert(accountClaimsTable).values({
    accountId,
    userId,
    steamUsername: account.steamUsername,
    steamPassword: account.steamPassword,
    pointsSpent: account.pointsCost,
  });

  res.json({ steamUsername: account.steamUsername, steamPassword: account.steamPassword, pointsSpent: account.pointsCost });
});

router.post("/:accountId/like", requireAuth, async (req, res) => {
  const accountId = parseInt(req.params.accountId, 10);
  const userId = req.session.userId!;

  const [user] = await db.select({ isBanned: usersTable.isBanned }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (user?.isBanned) {
    res.status(403).json({ error: "Banned users cannot like posts" });
    return;
  }

  const [account] = await db.select({ userId: accountsTable.userId }).from(accountsTable).where(eq(accountsTable.id, accountId)).limit(1);

  // Prevent self-likes
  if (account?.userId === userId) {
    res.status(403).json({ error: "You cannot like your own post" });
    return;
  }

  const [existing] = await db.select().from(likesTable)
    .where(and(eq(likesTable.userId, userId), eq(likesTable.targetType, "account"), eq(likesTable.targetId, accountId)))
    .limit(1);

  if (!existing) {
    await db.insert(likesTable).values({ userId, targetType: "account", targetId: accountId });
    await db.update(accountsTable).set({ likesCount: sql`${accountsTable.likesCount} + 1` }).where(eq(accountsTable.id, accountId));
    const xpLike = await getSetting("xp_like_account");
    // Only the post owner earns XP when their post is liked — likers do not earn XP
    // to prevent the like→unlike→like farming loop.
    if (account) await addXp(account.userId, xpLike);
  }

  res.json({ message: "Liked" });
});

router.delete("/:accountId/like", requireAuth, async (req, res) => {
  const accountId = parseInt(req.params.accountId, 10);
  const userId = req.session.userId!;

  await db.delete(likesTable).where(and(eq(likesTable.userId, userId), eq(likesTable.targetType, "account"), eq(likesTable.targetId, accountId)));
  await db.update(accountsTable).set({ likesCount: sql`GREATEST(${accountsTable.likesCount} - 1, 0)` }).where(eq(accountsTable.id, accountId));
  res.json({ message: "Like removed" });
});

// Working / Not working vote
router.post("/:accountId/vote", requireAuth, async (req, res) => {
  const accountId = parseInt(req.params.accountId, 10);
  const userId = req.session.userId!;
  const { vote } = req.body as { vote: "working" | "not_working" };

  if (vote !== "working" && vote !== "not_working") {
    res.status(400).json({ error: "vote must be 'working' or 'not_working'" });
    return;
  }

  const [user] = await db.select({ isBanned: usersTable.isBanned }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (user?.isBanned) {
    res.status(403).json({ error: "Banned users cannot vote" });
    return;
  }

  const [existing] = await db.select().from(accountVotesTable)
    .where(and(eq(accountVotesTable.userId, userId), eq(accountVotesTable.accountId, accountId)))
    .limit(1);

  if (existing) {
    if (existing.vote === vote) {
      // Remove vote
      await db.delete(accountVotesTable).where(and(eq(accountVotesTable.userId, userId), eq(accountVotesTable.accountId, accountId)));
      if (vote === "working") {
        await db.update(accountsTable).set({ workingVotes: sql`GREATEST(${accountsTable.workingVotes} - 1, 0)` }).where(eq(accountsTable.id, accountId));
      } else {
        await db.update(accountsTable).set({ notWorkingVotes: sql`GREATEST(${accountsTable.notWorkingVotes} - 1, 0)` }).where(eq(accountsTable.id, accountId));
      }
      res.json({ message: "Vote removed", myVote: null });
    } else {
      // Change vote
      await db.update(accountVotesTable).set({ vote }).where(and(eq(accountVotesTable.userId, userId), eq(accountVotesTable.accountId, accountId)));
      if (vote === "working") {
        await db.update(accountsTable).set({
          workingVotes: sql`${accountsTable.workingVotes} + 1`,
          notWorkingVotes: sql`GREATEST(${accountsTable.notWorkingVotes} - 1, 0)`,
        }).where(eq(accountsTable.id, accountId));
      } else {
        await db.update(accountsTable).set({
          notWorkingVotes: sql`${accountsTable.notWorkingVotes} + 1`,
          workingVotes: sql`GREATEST(${accountsTable.workingVotes} - 1, 0)`,
        }).where(eq(accountsTable.id, accountId));
      }
      res.json({ message: "Vote changed", myVote: vote });
    }
  } else {
    await db.insert(accountVotesTable).values({ userId, accountId, vote });
    if (vote === "working") {
      await db.update(accountsTable).set({ workingVotes: sql`${accountsTable.workingVotes} + 1` }).where(eq(accountsTable.id, accountId));
    } else {
      await db.update(accountsTable).set({ notWorkingVotes: sql`${accountsTable.notWorkingVotes} + 1` }).where(eq(accountsTable.id, accountId));
    }
    res.json({ message: "Vote recorded", myVote: vote });
  }
});

// POST /accounts/:accountId/check — any logged-in user: trigger a live Steam credential check
router.post("/:accountId/check", requireAuth, async (req, res) => {
  const accountId = parseInt(req.params.accountId, 10);
  if (isNaN(accountId)) { res.status(400).json({ error: "Invalid account id" }); return; }

  const [account] = await db
    .select({ id: accountsTable.id, steamUsername: accountsTable.steamUsername, steamPassword: accountsTable.steamPassword, healthFailCount: accountsTable.healthFailCount })
    .from(accountsTable)
    .where(eq(accountsTable.id, accountId))
    .limit(1);

  if (!account) { res.status(404).json({ error: "Account not found" }); return; }

  let result;
  try {
    // Use the same checker call as /verify-credentials (identical to the submit page)
    result = await checkSteamCredentials(account.steamUsername, account.steamPassword);
  } catch (e) {
    res.status(500).json({ error: "Check failed" }); return;
  }

  const now = new Date();
  let checkStatus: "live" | "dead" | "2fa" | "error" = "error";

  if (result.status === "valid") {
    const is2fa = String(result.message ?? "").includes("2FA");
    if (is2fa) {
      // 2FA accounts can't be used for sharing — flag as 2fa and soft-delete
      checkStatus = "2fa";
      const newFailCount = account.healthFailCount + 1;
      await db.update(accountsTable).set({
        healthFailCount: newFailCount,
        lastCheckedAt: now,
        lastCheckStatus: "dead",
        isAvailable: false,
        deletedAt: now,
        deletedByUserId: null,
        deletedReason: "Dead — requires 2FA",
      }).where(eq(accountsTable.id, account.id));
    } else {
      checkStatus = "live";
      await db.update(accountsTable).set({ healthFailCount: 0, lastCheckedAt: now, lastCheckStatus: "live", isAvailable: true }).where(eq(accountsTable.id, account.id));
    }
  } else if (result.status === "invalid") {
    checkStatus = "dead";
    const newFailCount = account.healthFailCount + 1;
    await db.update(accountsTable).set({
      healthFailCount: newFailCount,
      lastCheckedAt: now,
      lastCheckStatus: "dead",
      isAvailable: false,
      deletedAt: now,
      deletedByUserId: null,
      deletedReason: "Dead — invalid credentials",
    }).where(eq(accountsTable.id, account.id));
  } else {
    // error / rate_limited — update timestamp only, don't change availability
    await db.update(accountsTable).set({ lastCheckedAt: now }).where(eq(accountsTable.id, account.id));
  }

  res.json({ status: result.status, message: result.message, checkStatus, lastCheckedAt: now });
});

export default router;
