// @ts-nocheck
import express from "express";
import { db, usersTable, siteSettingsTable, premiumCodesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { getSetting, getAllXpSettings } from "../lib/settings";

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
  const { userId, tier, days } = req.body as { userId: number; tier: "premium" | "pro"; days?: number };
  if (!userId || !tier) { res.status(400).json({ error: "userId and tier required" }); return; }
  const duration = (days ?? 30) * 24 * 60 * 60 * 1000;
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
  const rows = await db.execute(sql.raw(`SELECT id, code, tier, days, max_uses, uses_count, is_active, created_at FROM premium_codes ORDER BY created_at DESC LIMIT 200`));
  res.json(rows.rows);
});

// POST /premium/generate-code — admin generate a code
router.post("/generate-code", requireAdmin, async (req, res) => {
  const { tier = "premium", days = 30, maxUses = 1 } = req.body as { tier?: string; days?: number; maxUses?: number };
  if (!["premium", "pro"].includes(tier)) { res.status(400).json({ error: "Invalid tier" }); return; }
  const seg = () => Math.random().toString(36).substring(2, 6).toUpperCase();
  const code = `${seg()}-${seg()}-${seg()}`;
  const rows = await db.execute(sql.raw(`INSERT INTO premium_codes (code, tier, days, max_uses) VALUES ('${code}', '${tier}', ${Number(days)}, ${Number(maxUses)}) RETURNING id, code, tier, days, max_uses, uses_count, is_active, created_at`));
  res.json(rows.rows[0]);
});

// DELETE /premium/codes/:id — admin deactivate a code
router.delete("/codes/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  await db.execute(sql.raw(`UPDATE premium_codes SET is_active = false WHERE id = ${id}`));
  res.json({ message: "Code deactivated" });
});

// POST /premium/redeem — user redeem a code
router.post("/redeem", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const { code } = req.body as { code: string };
  if (!code || typeof code !== "string") { res.status(400).json({ error: "Code required" }); return; }

  const sanitized = code.toUpperCase().trim();
  // Use parameterized ORM query — no string interpolation, no SQL injection risk
  const [premCode] = await db
    .select()
    .from(premiumCodesTable)
    .where(eq(premiumCodesTable.code, sanitized))
    .limit(1);

  if (!premCode) { res.status(404).json({ error: "Invalid or unknown code" }); return; }
  if (!premCode.isActive) { res.status(400).json({ error: "This code is no longer active" }); return; }
  if (premCode.usesCount >= premCode.maxUses) { res.status(400).json({ error: "This code has already been fully redeemed" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const duration = premCode.days * 24 * 60 * 60 * 1000;
  // Only preserve Pro if the user currently has an *active* Pro subscription.
  // An expired premiumTier="pro" must not silently upgrade a Premium code redeem.
  const userHasActivePro = isActivePremium(user) && user.premiumTier === "pro";
  const newTier = premCode.tier === "pro" ? "pro" : (userHasActivePro ? "pro" : "premium");

  // Redeem codes always start fresh from now — never stack on existing subscription.
  const expiresAt = new Date(Date.now() + duration);
  const newUsesCount = premCode.usesCount + 1;
  await db.update(usersTable).set({ premiumTier: newTier, premiumExpiresAt: expiresAt }).where(eq(usersTable.id, userId));
  await db.update(premiumCodesTable)
    .set({
      usesCount: sql`${premiumCodesTable.usesCount} + 1`,
      isActive: newUsesCount >= premCode.maxUses ? false : premCode.isActive,
    })
    .where(eq(premiumCodesTable.id, premCode.id));

  res.json({ message: `${newTier === "pro" ? "Pro" : "Premium"} activated for ${premCode.days} days!`, tier: newTier, expiresAt });
});

export default router;
