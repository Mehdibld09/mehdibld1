// @ts-nocheck
import express from "express";
import { db, siteSettingsTable, footerLinksTable, adsTable } from "@workspace/db";
import { eq, asc, and } from "drizzle-orm";
import { requireAdmin } from "../middlewares/auth";
import { invalidateWordCache } from "../lib/contentFilter";
import { XP_DEFAULTS, XpSettingKey, getAllXpSettings } from "../lib/settings";

const router = express.Router();

const CONTACT_KEYS = ["contact_email", "contact_phone", "contact_address", "contact_discord", "contact_twitter"] as const;

// GET /site-settings — public, returns contact info + footer links + banned words
router.get("/", async (_req, res) => {
  const [settings, links] = await Promise.all([
    db.select().from(siteSettingsTable),
    db.select().from(footerLinksTable).orderBy(asc(footerLinksTable.sortOrder), asc(footerLinksTable.id)),
  ]);

  const contact: Record<string, string> = {};
  for (const key of CONTACT_KEYS) {
    const row = settings.find((s) => s.key === key);
    contact[key] = row?.value ?? "";
  }

  const bannedWordsRow = settings.find((s) => s.key === "banned_words");
  const bannedWords: string[] = bannedWordsRow ? JSON.parse(bannedWordsRow.value || "[]") : [];

  res.json({ contact, footerLinks: links, bannedWords });
});

// GET /site-settings/banned-words — admin only, returns full list
router.get("/banned-words", requireAdmin, async (_req, res) => {
  const [row] = await db.select().from(siteSettingsTable).where(eq(siteSettingsTable.key, "banned_words"));
  const words: string[] = row ? JSON.parse(row.value || "[]") : [];
  res.json(words);
});

// POST /site-settings/banned-words — admin only, add a word
router.post("/banned-words", requireAdmin, async (req, res) => {
  const { word } = req.body as { word: string };
  if (!word?.trim()) {
    res.status(400).json({ error: "word is required" });
    return;
  }
  const clean = word.trim().toLowerCase();
  const [row] = await db.select().from(siteSettingsTable).where(eq(siteSettingsTable.key, "banned_words"));
  const words: string[] = row ? JSON.parse(row.value || "[]") : [];
  if (!words.includes(clean)) {
    words.push(clean);
    await db
      .insert(siteSettingsTable)
      .values({ key: "banned_words", value: JSON.stringify(words), updatedAt: new Date() })
      .onConflictDoUpdate({ target: siteSettingsTable.key, set: { value: JSON.stringify(words), updatedAt: new Date() } });
    invalidateWordCache();
  }
  res.json(words);
});

// DELETE /site-settings/banned-words/:word — admin only, remove a word
router.delete("/banned-words/:word", requireAdmin, async (req, res) => {
  const word = decodeURIComponent(req.params.word).toLowerCase();
  const [row] = await db.select().from(siteSettingsTable).where(eq(siteSettingsTable.key, "banned_words"));
  const words: string[] = row ? JSON.parse(row.value || "[]") : [];
  const updated = words.filter((w) => w !== word);
  await db
    .insert(siteSettingsTable)
    .values({ key: "banned_words", value: JSON.stringify(updated), updatedAt: new Date() })
    .onConflictDoUpdate({ target: siteSettingsTable.key, set: { value: JSON.stringify(updated), updatedAt: new Date() } });
  invalidateWordCache();
  res.json(updated);
});

// PUT /site-settings/contact — admin only, update contact info
router.put("/contact", requireAdmin, async (req, res) => {
  const updates = req.body as Partial<Record<typeof CONTACT_KEYS[number], string>>;

  for (const key of CONTACT_KEYS) {
    if (key in updates) {
      const value = String(updates[key] ?? "");
      await db
        .insert(siteSettingsTable)
        .values({ key, value, updatedAt: new Date() })
        .onConflictDoUpdate({ target: siteSettingsTable.key, set: { value, updatedAt: new Date() } });
    }
  }

  res.json({ message: "Contact info updated" });
});

// POST /site-settings/footer-links — admin only, add a footer link
router.post("/footer-links", requireAdmin, async (req, res) => {
  const { label, url, sortOrder } = req.body as { label: string; url: string; sortOrder?: number };
  if (!label?.trim() || !url?.trim()) {
    res.status(400).json({ error: "label and url are required" });
    return;
  }
  const [link] = await db
    .insert(footerLinksTable)
    .values({ label: label.trim(), url: url.trim(), sortOrder: sortOrder ?? 0 })
    .returning();
  res.json(link);
});

// DELETE /site-settings/footer-links/:id — admin only
router.delete("/footer-links/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  await db.delete(footerLinksTable).where(eq(footerLinksTable.id, id));
  res.json({ message: "Footer link removed" });
});

// GET /site-settings/xp-points — admin only, returns all XP/points reward settings
router.get("/xp-points", requireAdmin, async (_req, res) => {
  const settings = await getAllXpSettings();
  res.json(settings);
});

// PUT /site-settings/xp-points — admin only, update XP/points reward settings
router.put("/xp-points", requireAdmin, async (req, res) => {
  const body = req.body as Partial<Record<XpSettingKey, number>>;
  const keys = Object.keys(XP_DEFAULTS) as XpSettingKey[];

  for (const key of keys) {
    if (key in body) {
      const raw = body[key];
      const value = typeof raw === "number" && !isNaN(raw) ? Math.max(0, Math.floor(raw)) : null;
      if (value === null) continue;
      await db
        .insert(siteSettingsTable)
        .values({ key, value: String(value), updatedAt: new Date() })
        .onConflictDoUpdate({ target: siteSettingsTable.key, set: { value: String(value), updatedAt: new Date() } });
    }
  }

  res.json({ message: "XP/points settings updated" });
});

// GET /site-settings/ticker — public
router.get("/ticker", async (_req, res) => {
  const rows = await db.select().from(siteSettingsTable);
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  res.json({
    enabled: map.ticker_enabled === "1",
    icon: map.ticker_icon ?? "",
    text: map.ticker_text ?? "",
    linkLabel: map.ticker_link_label ?? "",
    linkUrl: map.ticker_link_url ?? "",
  });
});

// PUT /site-settings/ticker — admin only
router.put("/ticker", requireAdmin, async (req, res) => {
  const { enabled, icon, text, linkLabel, linkUrl } = req.body;
  const pairs: [string, string][] = [
    ["ticker_enabled", enabled ? "1" : "0"],
    ["ticker_icon", String(icon ?? "")],
    ["ticker_text", String(text ?? "")],
    ["ticker_link_label", String(linkLabel ?? "")],
    ["ticker_link_url", String(linkUrl ?? "")],
  ];
  for (const [key, value] of pairs) {
    await db
      .insert(siteSettingsTable)
      .values({ key, value, updatedAt: new Date() })
      .onConflictDoUpdate({ target: siteSettingsTable.key, set: { value, updatedAt: new Date() } });
  }
  res.json({ message: "Ticker updated" });
});

// GET /site-settings/ads — public, returns active ads by placement
router.get("/ads", async (req, res) => {
  const { placement } = req.query as { placement?: string };
  const conditions = [eq(adsTable.active, true)];
  if (placement) conditions.push(eq(adsTable.placement, placement));
  const ads = await db
    .select()
    .from(adsTable)
    .where(and(...conditions))
    .orderBy(asc(adsTable.sortOrder), asc(adsTable.createdAt));
  res.json(ads);
});

// GET /site-settings/ads/all — admin only, returns all ads
router.get("/ads/all", requireAdmin, async (_req, res) => {
  const ads = await db
    .select()
    .from(adsTable)
    .orderBy(asc(adsTable.placement), asc(adsTable.sortOrder), asc(adsTable.createdAt));
  res.json(ads);
});

// POST /site-settings/ads — admin only, create ad
router.post("/ads", requireAdmin, async (req, res) => {
  const { placement, imageUrl, linkUrl, sortOrder } = req.body as {
    placement: string; imageUrl: string; linkUrl: string; sortOrder?: number;
  };
  if (!placement || !imageUrl?.trim() || !linkUrl?.trim()) {
    res.status(400).json({ error: "placement, imageUrl, and linkUrl are required" });
    return;
  }
  if (!["home", "browse"].includes(placement)) {
    res.status(400).json({ error: "placement must be 'home' or 'browse'" });
    return;
  }
  const [ad] = await db
    .insert(adsTable)
    .values({ placement, imageUrl: imageUrl.trim(), linkUrl: linkUrl.trim(), sortOrder: sortOrder ?? 0 })
    .returning();
  res.json(ad);
});

// PUT /site-settings/ads/:id — admin only, update ad
router.put("/ads/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { imageUrl, linkUrl, active, sortOrder, placement } = req.body as {
    imageUrl?: string; linkUrl?: string; active?: boolean; sortOrder?: number; placement?: string;
  };
  const updates: Partial<typeof adsTable.$inferInsert> = {};
  if (imageUrl !== undefined) updates.imageUrl = imageUrl.trim();
  if (linkUrl !== undefined) updates.linkUrl = linkUrl.trim();
  if (active !== undefined) updates.active = active;
  if (sortOrder !== undefined) updates.sortOrder = sortOrder;
  if (placement !== undefined) updates.placement = placement;
  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }
  const [ad] = await db.update(adsTable).set(updates).where(eq(adsTable.id, id)).returning();
  if (!ad) { res.status(404).json({ error: "Ad not found" }); return; }
  res.json(ad);
});

// DELETE /site-settings/ads/:id — admin only
router.delete("/ads/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  await db.delete(adsTable).where(eq(adsTable.id, id));
  res.json({ message: "Ad deleted" });
});

export default router;
