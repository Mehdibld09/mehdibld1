import { db, siteSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export const XP_DEFAULTS = {
  xp_upload_account: 50,
  points_upload_account: 50,
  xp_redeem_adlink: 20,
  xp_post_comment: 10,
  xp_like_comment: 5,
  xp_like_account: 5,
  points_registration: 100,
  premium_points_price: 500,
  premium_usd_cents: 999,
  pro_usd_cents: 1999,
  premium_discount_percent: 0,
} as const;

export type XpSettingKey = keyof typeof XP_DEFAULTS;

export async function getSetting(key: XpSettingKey): Promise<number> {
  const [row] = await db
    .select({ value: siteSettingsTable.value })
    .from(siteSettingsTable)
    .where(eq(siteSettingsTable.key, key))
    .limit(1);
  if (!row) return XP_DEFAULTS[key];
  const parsed = parseInt(row.value, 10);
  return isNaN(parsed) ? XP_DEFAULTS[key] : parsed;
}

export async function getAllXpSettings(): Promise<typeof XP_DEFAULTS> {
  const rows = await db
    .select()
    .from(siteSettingsTable);

  const result = { ...XP_DEFAULTS };
  for (const row of rows) {
    if (row.key in XP_DEFAULTS) {
      const parsed = parseInt(row.value, 10);
      if (!isNaN(parsed)) {
        (result as any)[row.key] = parsed;
      }
    }
  }
  return result;
}
