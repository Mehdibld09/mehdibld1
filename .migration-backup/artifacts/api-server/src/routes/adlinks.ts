// @ts-nocheck
import express from "express";
import { db, adLinksTable, adLinkRedemptionsTable, usersTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { CreateAdLinkBody } from "@workspace/api-zod";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { randomBytes } from "crypto";
import { getSetting } from "../lib/settings";

const router = express.Router();

router.get("/", requireAdmin, async (_req, res) => {
  const links = await db
    .select()
    .from(adLinksTable)
    .orderBy(sql`${adLinksTable.createdAt} DESC`);
  res.json(links);
});

router.post("/", requireAdmin, async (req, res) => {
  const parsed = CreateAdLinkBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const code = randomBytes(8).toString("hex");
  const [link] = await db
    .insert(adLinksTable)
    .values({ ...parsed.data, code })
    .returning();

  res.status(201).json(link);
});

router.get("/:code/redeem", requireAuth, async (req, res) => {
  const code = req.params.code;
  const userId = req.session.userId!;

  const [link] = await db
    .select()
    .from(adLinksTable)
    .where(and(eq(adLinksTable.code, code), eq(adLinksTable.isActive, true)))
    .limit(1);

  if (!link) {
    res.status(404).json({ error: "Ad link not found or expired" });
    return;
  }

  if (link.usesCount >= link.maxUses) {
    res.status(400).json({ error: "This ad link has reached its usage limit" });
    return;
  }

  // Atomically insert the redemption record. The DB-level unique constraint on
  // (ad_link_id, user_id) guarantees only one redemption per user per link even
  // under concurrent requests — no SELECT-then-INSERT race condition.
  let inserted;
  try {
    [inserted] = await db
      .insert(adLinkRedemptionsTable)
      .values({ adLinkId: link.id, userId })
      .returning({ id: adLinkRedemptionsTable.id });
  } catch (e: any) {
    if (e?.code === "23505") {
      res.status(400).json({ error: "You have already redeemed this link" });
      return;
    }
    throw e;
  }

  if (!inserted) {
    res.status(400).json({ error: "You have already redeemed this link" });
    return;
  }

  await db
    .update(adLinksTable)
    .set({ usesCount: sql`${adLinksTable.usesCount} + 1` })
    .where(eq(adLinksTable.id, link.id));

  const xpAdlink = await getSetting("xp_redeem_adlink");
  const [updatedUser] = await db
    .update(usersTable)
    .set({
      points: sql`${usersTable.points} + ${link.pointsReward}`,
      xp: sql`${usersTable.xp} + ${xpAdlink}`,
      level: sql`FLOOR((${usersTable.xp} + ${xpAdlink}) / 100) + 1`,
    })
    .where(eq(usersTable.id, userId))
    .returning({ points: usersTable.points });

  res.json({
    pointsEarned: link.pointsReward,
    newTotal: updatedUser?.points ?? 0,
    xpEarned: xpAdlink,
  });
});

router.delete("/:adLinkId", requireAdmin, async (req, res) => {
  const adLinkId = parseInt(req.params.adLinkId, 10);
  await db.delete(adLinksTable).where(eq(adLinksTable.id, adLinkId));
  res.json({ message: "Ad link deleted" });
});

export default router;
