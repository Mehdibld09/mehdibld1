// @ts-nocheck
import express from "express";
import { db, usersTable, siteSettingsTable, premiumCodesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { getSetting, getAllXpSettings } from "../lib/settings";
import {
  getAllCodes,
  createCodesBatch,
  findCode,
  recordCodeRedemption,
  deactivateCodeById,
  deleteCodeById,
  formatDurationLabel,
} from "../lib/premiumCodesStore";

const router = express.Router();

const BASIC_COLORS = ["#ef4444","#f97316","#eab308","#22c55e","#3b82f6","#8b5cf6","#ec4899","#06b6d4","#ffffff","#94a3b8","rainbow","fire","ocean","galaxy","neon","gold"];
const PRO_ONLY_COLORS = ["rainbow","fire","ocean","galaxy","neon","gold"];
const VALID_BADGE_TYPES = ["gold","star","vip","crown","fire","shield","diamond","bolt"];

function isActivePremium(user: any): boolean {
  if (!user.premiumTier) return false;
  if (!user.premiumExpiresAt) return false;
  return new Date(user.premiumExpiresAt) > new Date();
}

// GET /premium/pricing — public
router.get("/pricing", async (_req, res) => {
  const settings = await getAllXpSettings();
  const [urlRow] = await db.select({ value: siteSettingsTable.value }).from(siteSettingsTable).where(eq(siteSettingsTable.key, "pro_contact_url")).limit(1);
  res.json({
    premiumPointsPrice: settings.premium_points_price,
    premiumUsdCents: settings.premium_usd_cents,
    proUsdCents: settings.pro_usd_cents,
    discountPercent: settings.premium_discount_percent,
    basicColors: BASIC_COLORS,
    proContactUrl: urlRow?.value ?? "/messages",
  });
});

// PUT /premium/contact-url — admin only
router.put("/contact-url", requireAdmin, async (req, res) => {
  const { url } = req.body as { url: string };
  if (!url) { res.status(400).json({ error: "url required" }); return; }
  const existing = await db.select().from(siteSettingsTable).where(eq(siteSettingsTable.key, "pro_contact_url")).limit(1);
  if (existing.length > 0) {
    await db.update(siteSettingsTable).set({ value: url }).where(eq(siteSettingsTable.key, "pro_contact_url"));
  } else {
    await db.insert(siteSettingsTable).values({ key: "pro_contact_url", value: url });
  }
  res.json({ message: "Updated" });
});

// GET /premium/status — auth
router.get("/status", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const [user] = await db
    .select({
      premiumTier: usersTable.premiumTier,
      premiumExpiresAt: usersTable.premiumExpiresAt,
      nameColor: usersTable.nameColor,
      badgeType: usersTable.badgeType,
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const active = isActivePremium(user);
  res.json({
    tier: active ? user.premiumTier : null,
    expiresAt: active ? user.premiumExpiresAt : null,
    nameColor: active ? user.nameColor : null,
    badgeType: active ? user.badgeType : null,
    isActive: active,
  });
});

// POST /premium/buy-points — buy premium tier with points
router.post("/buy-points", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const price = await getSetting("premium_points_price");

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  // Pro users cannot buy-down to premium with points
  if (isActivePremium(user) && user.premiumTier === "pro") {
    res.status(400).json({ error: "You already have an active Pro subscription." });
    return;
  }

  if (user.points < price) {
    res.status(400).json({ error: `Not enough points. You need ${price} points.` });
    return;
  }

  // Always start fresh from now — never stack on an existing subscription
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await db.update(usersTable).set({
    points: user.points - price,
    premiumTier: "premium",
    premiumExpiresAt: expiresAt,
  }).where(eq(usersTable.id, userId));

  res.json({ message: "Premium activated!", expiresAt });
});

// POST /premium/grant — admin grant premium or pro to a user
router.post("/grant", requireAdmin, async (req, res) => {
  const { userId, tier, days, durationHours } = req.body as {
    userId: number;
    tier: "premium" | "pro";
    days?: number;
    durationHours?: number;
  };
  if (!userId || !tier) { res.status(400).json({ error: "userId and tier required" }); return; }
  const totalHours = durationHours ? Math.max(1, Number(durationHours)) : (days ?? 30) * 24;
  const duration = totalHours * 60 * 60 * 1000;
  const expiresAt = new Date(Date.now() + duration);

  await db.update(usersTable).set({ premiumTier: tier, premiumExpiresAt: expiresAt })
    .where(eq(usersTable.id, userId));
  res.json({ message: `Granted ${tier} to user ${userId}`, expiresAt });
});

// POST /premium/revoke — admin revoke premium
router.post("/revoke", requireAdmin, async (req, res) => {
  const { userId } = req.body as { userId: number };
  if (!userId) { res.status(400).json({ error: "userId required" }); return; }
  await db.update(usersTable).set({ premiumTier: null, premiumExpiresAt: null })
    .where(eq(usersTable.id, userId));
  res.json({ message: "Revoked premium" });
});

// PATCH /premium/preferences — update name color and badge for premium/pro users
router.patch("/preferences", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const { nameColor, badgeType } = req.body as { nameColor?: string | null; badgeType?: string | null };

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  if (!isActivePremium(user)) {
    res.status(403).json({ error: "Premium subscription required" });
    return;
  }

  const updates: Record<string, any> = {};

  if (nameColor !== undefined) {
    if (nameColor === null) {
      updates.nameColor = null;
    } else {
      if (!BASIC_COLORS.includes(nameColor)) {
        res.status(400).json({ error: "Invalid color" });
        return;
      }
      // Animated colors require any active premium (not just pro)
      updates.nameColor = nameColor;
    }
  }

  if (badgeType !== undefined) {
    if (badgeType === null) {
      updates.badgeType = null;
    } else if (VALID_BADGE_TYPES.includes(badgeType)) {
      const isProOnly = !["gold", "star"].includes(badgeType);
      if (isProOnly && user.premiumTier !== "pro") {
        res.status(403).json({ error: `${badgeType} badge requires Pro subscription` });
        return;
      }
      updates.badgeType = badgeType;
    } else {
      res.status(400).json({ error: "Invalid badge type" });
      return;
    }
  }

  await db.update(usersTable).set(updates).where(eq(usersTable.id, userId));
  res.json({ message: "Preferences updated" });
});

// GET /premium/codes — admin list all codes
router.get("/codes", requireAdmin, async (_req, res) => {
  const codes = await getAllCodes();
  res.json(codes);
});

// POST /premium/generate-code — admin generate single or multiple codes
router.post("/generate-code", requireAdmin, async (req, res) => {
  const {
    tier = "premium",
    days = 30,
    durationHours,
    durationLabel,
    maxUses = 1,
    count = 1,
    prefix,
  } = req.body as {
    tier?: string;
    days?: number;
    durationHours?: number;
    durationLabel?: string;
    maxUses?: number;
    count?: number;
    prefix?: string;
  };

  if (!["premium", "pro"].includes(tier)) {
    res.status(400).json({ error: "Invalid tier" });
    return;
  }

  const generatedList = await createCodesBatch({
    tier: tier as "premium" | "pro",
    days: Number(days) || 30,
    durationHours: durationHours ? Number(durationHours) : undefined,
    durationLabel,
    maxUses: Number(maxUses) || 1,
    count: Number(count) || 1,
    prefix,
  });

  if (generatedList.length === 1) {
    res.json({
      ...generatedList[0],
      codes: generatedList,
      count: 1,
    });
  } else {
    res.json({
      codes: generatedList,
      count: generatedList.length,
      message: `Successfully generated ${generatedList.length} ${tier === "pro" ? "Pro VIP" : "VIP"} keys!`,
    });
  }
});

// POST /premium/generate-batch — admin generate batch of multiple codes
router.post("/generate-batch", requireAdmin, async (req, res) => {
  const {
    tier = "premium",
    days = 30,
    durationHours,
    durationLabel,
    maxUses = 1,
    count = 10,
    prefix,
  } = req.body as {
    tier?: string;
    days?: number;
    durationHours?: number;
    durationLabel?: string;
    maxUses?: number;
    count?: number;
    prefix?: string;
  };

  if (!["premium", "pro"].includes(tier)) {
    res.status(400).json({ error: "Invalid tier" });
    return;
  }

  const generatedList = await createCodesBatch({
    tier: tier as "premium" | "pro",
    days: Number(days) || 30,
    durationHours: durationHours ? Number(durationHours) : undefined,
    durationLabel,
    maxUses: Number(maxUses) || 1,
    count: Number(count) || 1,
    prefix,
  });

  res.json({
    codes: generatedList,
    count: generatedList.length,
    message: `Successfully generated ${generatedList.length} ${tier === "pro" ? "Pro VIP" : "VIP"} keys!`,
  });
});

// DELETE /premium/codes/:id — admin deactivate a code
router.delete("/codes/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await deactivateCodeById(id);
  res.json({ message: "Code deactivated" });
});

// POST /premium/codes/:id/delete — admin permanently delete a code
router.post("/codes/:id/delete", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await deleteCodeById(id);
  res.json({ message: "Code deleted" });
});

// POST /premium/redeem — user redeem a code
router.post("/redeem", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const { code } = req.body as { code: string };
  if (!code || typeof code !== "string") { res.status(400).json({ error: "Code required" }); return; }

  const sanitized = code.toUpperCase().trim();
  const premCode = await findCode(sanitized);

  if (!premCode) { res.status(404).json({ error: "Invalid or unknown code" }); return; }
  if (!premCode.isActive) { res.status(400).json({ error: "This code is no longer active" }); return; }
  if (premCode.usesCount >= premCode.maxUses) { res.status(400).json({ error: "This code has already been fully redeemed" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const durationMs = (premCode.durationHours && premCode.durationHours > 0)
    ? premCode.durationHours * 60 * 60 * 1000
    : (premCode.days || 30) * 24 * 60 * 60 * 1000;

  const userHasActivePro = isActivePremium(user) && user.premiumTier === "pro";
  const newTier = premCode.tier === "pro" ? "pro" : (userHasActivePro ? "pro" : "premium");

  // If user has active subscription of same tier, extend cleanly
  const hasActiveSameTier = isActivePremium(user) && user.premiumTier === newTier && user.premiumExpiresAt;
  const baseTime = hasActiveSameTier ? new Date(user.premiumExpiresAt).getTime() : Date.now();
  const expiresAt = new Date(baseTime + durationMs);

  await db.update(usersTable).set({ premiumTier: newTier, premiumExpiresAt: expiresAt }).where(eq(usersTable.id, userId));
  await recordCodeRedemption(premCode.id);

  const durationText = premCode.durationLabel || formatDurationLabel(premCode.durationHours || premCode.days * 24);
  res.json({
    message: `🎉 ${newTier === "pro" ? "Pro VIP" : "VIP"} activated for ${durationText}!`,
    tier: newTier,
    expiresAt,
  });
});

export default router;
