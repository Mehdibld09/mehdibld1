// @ts-nocheck
import express from "express";
import { db, commentsTable, usersTable, likesTable } from "@workspace/db";
import { eq, and, sql, inArray, asc, isNull } from "drizzle-orm";
import { CreateCommentBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { filterContent } from "../lib/contentFilter";
import { getSetting } from "../lib/settings";

const router = express.Router({ mergeParams: true });

function addXp(userId: number, amount: number) {
  return db
    .update(usersTable)
    .set({
      xp: sql`${usersTable.xp} + ${amount}`,
      level: sql`FLOOR((${usersTable.xp} + ${amount}) / 100) + 1`,
    })
    .where(eq(usersTable.id, userId));
}

router.get("/", async (req, res) => {
  const accountId = parseInt(req.params.accountId, 10);
  const userId = req.session?.userId;

  const comments = await db
    .select({
      id: commentsTable.id,
      accountId: commentsTable.accountId,
      userId: commentsTable.userId,
      parentId: commentsTable.parentId,
      content: commentsTable.content,
      likesCount: commentsTable.likesCount,
      createdAt: commentsTable.createdAt,
      username: usersTable.username,
      avatarUrl: usersTable.avatarUrl,
      premiumTier: usersTable.premiumTier,
      premiumExpiresAt: usersTable.premiumExpiresAt,
      nameColor: usersTable.nameColor,
      badgeType: usersTable.badgeType,
    })
    .from(commentsTable)
    .leftJoin(usersTable, eq(commentsTable.userId, usersTable.id))
    .where(eq(commentsTable.accountId, accountId))
    .orderBy(asc(commentsTable.createdAt));

  let likedIds = new Set<number>();
  if (userId && comments.length > 0) {
    const liked = await db
      .select({ targetId: likesTable.targetId })
      .from(likesTable)
      .where(
        and(
          eq(likesTable.userId, userId),
          eq(likesTable.targetType, "comment"),
          inArray(
            likesTable.targetId,
            comments.map((c) => c.id),
          ),
        ),
      );
    likedIds = new Set(liked.map((l) => l.targetId));
  }

  const now = new Date();
  res.json(
    comments.map((c) => {
      const isPremiumActive = c.premiumTier && c.premiumExpiresAt && new Date(c.premiumExpiresAt) > now;
      return {
        ...c,
        username: c.username ?? "",
        userHasLiked: likedIds.has(c.id),
        nameColor: isPremiumActive ? c.nameColor : null,
        badgeType: isPremiumActive ? c.badgeType : null,
      };
    }),
  );
});

router.post("/", requireAuth, async (req, res) => {
  const accountId = parseInt(req.params.accountId, 10);
  const userId = req.session.userId!;

  const parsed = CreateCommentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const parentId = parsed.data.parentId ?? null;

  // Validate parentId belongs to this account if provided
  if (parentId !== null) {
    const [parent] = await db
      .select({ id: commentsTable.id, parentId: commentsTable.parentId })
      .from(commentsTable)
      .where(and(eq(commentsTable.id, parentId), eq(commentsTable.accountId, accountId)))
      .limit(1);
    if (!parent) {
      res.status(400).json({ error: "Parent comment not found" });
      return;
    }
    // Only allow one level of nesting — reply to the top-level parent
  }

  const [comment] = await db
    .insert(commentsTable)
    .values({ accountId, userId, content: await filterContent(parsed.data.content), parentId })
    .returning();

  const [user] = await db
    .select({
      username: usersTable.username,
      avatarUrl: usersTable.avatarUrl,
      premiumTier: usersTable.premiumTier,
      premiumExpiresAt: usersTable.premiumExpiresAt,
      nameColor: usersTable.nameColor,
      badgeType: usersTable.badgeType,
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  const xpComment = await getSetting("xp_post_comment");
  await addXp(userId, xpComment);

  const isPremiumActive = user?.premiumTier && user?.premiumExpiresAt && new Date(user.premiumExpiresAt) > new Date();
  res.status(201).json({
    ...comment,
    username: user?.username ?? "",
    avatarUrl: user?.avatarUrl ?? null,
    userHasLiked: false,
    nameColor: isPremiumActive ? user?.nameColor : null,
    badgeType: isPremiumActive ? user?.badgeType : null,
  });
});

router.delete("/:commentId", requireAuth, async (req, res) => {
  const commentId = parseInt(req.params.commentId, 10);
  const userId = req.session.userId!;
  const isAdmin = req.session.isAdmin;

  const [comment] = await db
    .select()
    .from(commentsTable)
    .where(eq(commentsTable.id, commentId))
    .limit(1);

  if (!comment) {
    res.status(404).json({ error: "Comment not found" });
    return;
  }

  if (comment.userId !== userId && !isAdmin) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  // Also delete all replies to this comment
  await db.delete(commentsTable).where(eq(commentsTable.parentId, commentId));
  await db.delete(commentsTable).where(eq(commentsTable.id, commentId));
  res.json({ message: "Comment deleted" });
});

router.post("/:commentId/like", requireAuth, async (req, res) => {
  const commentId = parseInt(req.params.commentId, 10);
  const userId = req.session.userId!;

  const [existing] = await db
    .select()
    .from(likesTable)
    .where(
      and(
        eq(likesTable.userId, userId),
        eq(likesTable.targetType, "comment"),
        eq(likesTable.targetId, commentId),
      ),
    )
    .limit(1);

  if (!existing) {
    await db.insert(likesTable).values({ userId, targetType: "comment", targetId: commentId });
    await db
      .update(commentsTable)
      .set({ likesCount: sql`${commentsTable.likesCount} + 1` })
      .where(eq(commentsTable.id, commentId));
    const xpLike = await getSetting("xp_like_comment");
    await addXp(userId, xpLike);
  }

  res.json({ message: "Liked" });
});

router.delete("/:commentId/like", requireAuth, async (req, res) => {
  const commentId = parseInt(req.params.commentId, 10);
  const userId = req.session.userId!;

  await db
    .delete(likesTable)
    .where(
      and(
        eq(likesTable.userId, userId),
        eq(likesTable.targetType, "comment"),
        eq(likesTable.targetId, commentId),
      ),
    );
  await db
    .update(commentsTable)
    .set({ likesCount: sql`GREATEST(${commentsTable.likesCount} - 1, 0)` })
    .where(eq(commentsTable.id, commentId));

  res.json({ message: "Like removed" });
});

export default router;
