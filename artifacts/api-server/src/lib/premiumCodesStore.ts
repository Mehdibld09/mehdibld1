import fs from "node:fs";
import path from "node:path";
import crypto from "crypto";
import { db, pool, premiumCodesTable, siteSettingsTable } from "@workspace/db";
import { eq, or, desc } from "drizzle-orm";

export interface StoredCode {
  id: number;
  code: string;
  tier: "premium" | "pro";
  days: number;
  durationHours: number;
  durationLabel: string;
  maxUses: number;
  usesCount: number;
  isActive: boolean;
  isActivated: boolean;
  usedByUsername?: string | null;
  usedByUserId?: number | null;
  activatedAt?: string | null;
  createdAt: string;
}

const DATA_DIR = path.resolve(process.cwd(), "data");
const CODES_FILE = path.join(DATA_DIR, "premium-codes.json");
const DB_SETTINGS_KEY = "premium_vip_keys_db";

function ensureDirectoryExists() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (err) {
    console.warn("[premiumCodesStore] Error creating data dir:", err);
  }
}

export function loadCodesFromFile(): StoredCode[] {
  try {
    ensureDirectoryExists();
    if (fs.existsSync(CODES_FILE)) {
      const content = fs.readFileSync(CODES_FILE, "utf-8");
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return parsed.map((c) => ({
          ...c,
          isActivated: Boolean(c.isActivated || (c.usesCount || c.uses_count || 0) > 0),
          isActive: c.isActive !== false && c.is_active !== false,
        }));
      }
    }
  } catch (err) {
    console.warn("[premiumCodesStore] Error reading codes file:", err);
  }
  return [];
}

export function saveCodesToFile(codes: StoredCode[]): void {
  try {
    ensureDirectoryExists();
    fs.writeFileSync(CODES_FILE, JSON.stringify(codes, null, 2), "utf-8");
  } catch (err) {
    console.warn("[premiumCodesStore] Error writing codes file:", err);
  }
}

let dbTableEnsured = false;

export async function ensureDbTableExists(): Promise<void> {
  if (dbTableEnsured) return;
  if (!process.env.DATABASE_URL) {
    dbTableEnsured = true;
    return;
  }
  try {
    if (pool && typeof pool.query === "function") {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS premium_codes (
          id SERIAL PRIMARY KEY,
          code TEXT NOT NULL UNIQUE,
          tier TEXT NOT NULL DEFAULT 'premium',
          days INTEGER NOT NULL DEFAULT 30,
          duration_hours INTEGER,
          duration_label TEXT,
          max_uses INTEGER NOT NULL DEFAULT 1,
          uses_count INTEGER NOT NULL DEFAULT 0,
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          used_by_username TEXT,
          used_by_user_id INTEGER,
          activated_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        );
        ALTER TABLE premium_codes ADD COLUMN IF NOT EXISTS duration_hours INTEGER;
        ALTER TABLE premium_codes ADD COLUMN IF NOT EXISTS duration_label TEXT;
        ALTER TABLE premium_codes ADD COLUMN IF NOT EXISTS used_by_username TEXT;
        ALTER TABLE premium_codes ADD COLUMN IF NOT EXISTS used_by_user_id INTEGER;
        ALTER TABLE premium_codes ADD COLUMN IF NOT EXISTS activated_at TIMESTAMP WITH TIME ZONE;
      `);
    }
    dbTableEnsured = true;
  } catch (err: any) {
    console.warn("[premiumCodesStore] ensureDbTableExists warning:", err?.message || err);
  }
}

export function generateRandomCode(prefix?: string): string {
  // Generate clean 4-character blocks without ambiguous characters
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const getBlock = (len = 4) => {
    let res = "";
    const bytes = crypto.randomBytes(len);
    for (let i = 0; i < len; i++) {
      res += alphabet[bytes[i] % alphabet.length];
    }
    return res;
  };

  const block1 = getBlock(4);
  const block2 = getBlock(4);
  const block3 = getBlock(4);

  if (prefix && prefix.trim()) {
    const cleanPrefix = prefix.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    return `${cleanPrefix}-${block1}-${block2}`;
  }

  return `${block1}-${block2}-${block3}`;
}

export function formatDurationLabel(durationHours: number): string {
  if (durationHours >= 87600) return "Lifetime";
  if (durationHours % 8760 === 0 && durationHours >= 8760) {
    const years = durationHours / 8760;
    return `${years} Year${years > 1 ? "s" : ""}`;
  }
  if (durationHours % 720 === 0 && durationHours >= 720) {
    const months = durationHours / 720;
    return `${months} Month${months > 1 ? "s" : ""}`;
  }
  if (durationHours % 168 === 0 && durationHours >= 168) {
    const weeks = durationHours / 168;
    return `${weeks} Week${weeks > 1 ? "s" : ""}`;
  }
  if (durationHours % 24 === 0 && durationHours >= 24) {
    const days = durationHours / 24;
    return `${days} Day${days > 1 ? "s" : ""}`;
  }
  return `${durationHours} Hour${durationHours > 1 ? "s" : ""}`;
}

/**
 * Syncs in-memory / file codes into DB siteSettings table as multi-tier persistence backup
 */
async function syncCodesToSiteSettings(codes: StoredCode[]): Promise<void> {
  try {
    const jsonStr = JSON.stringify(codes);
    await db
      .insert(siteSettingsTable)
      .values({ key: DB_SETTINGS_KEY, value: jsonStr, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: siteSettingsTable.key,
        set: { value: jsonStr, updatedAt: new Date() },
      });
  } catch (_) {
    // Non-critical background sync
  }
}

/**
 * Gets all keys directly from the database, reconciling with file cache & siteSettings
 */
export async function getAllCodes(): Promise<StoredCode[]> {
  await ensureDbTableExists();

  const fileCodes = loadCodesFromFile();
  let dbCodes: StoredCode[] = [];

  try {
    const dbRows = await db
      .select()
      .from(premiumCodesTable)
      .orderBy(desc(premiumCodesTable.createdAt))
      .limit(2000);

    if (Array.isArray(dbRows) && dbRows.length > 0) {
      dbCodes = dbRows.map((r: any) => {
        const durationHours = r.durationHours || (r.days * 24);
        const durationLabel = r.durationLabel || formatDurationLabel(durationHours);
        const usesCount = r.usesCount ?? 0;
        const isActivated = usesCount > 0;
        return {
          id: r.id,
          code: r.code,
          tier: r.tier as "premium" | "pro",
          days: r.days,
          durationHours,
          durationLabel,
          maxUses: r.maxUses ?? 1,
          usesCount,
          isActive: r.isActive ?? true,
          isActivated,
          usedByUsername: r.usedByUsername || null,
          usedByUserId: r.usedByUserId || null,
          activatedAt: r.activatedAt ? new Date(r.activatedAt).toISOString() : null,
          createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
        };
      });
    }
  } catch (e: any) {
    console.warn("[premiumCodesStore] DB query warning:", e?.message);
  }

  // If DB was empty or unavailable, check site_settings backup
  if (dbCodes.length === 0) {
    try {
      const [settingRow] = await db
        .select()
        .from(siteSettingsTable)
        .where(eq(siteSettingsTable.key, DB_SETTINGS_KEY))
        .limit(1);

      if (settingRow && settingRow.value) {
        const parsed = JSON.parse(settingRow.value);
        if (Array.isArray(parsed) && parsed.length > 0) {
          dbCodes = parsed.map((c: any) => ({
            ...c,
            isActivated: Boolean(c.isActivated || (c.usesCount || 0) > 0),
            isActive: c.isActive !== false,
          }));
        }
      }
    } catch (_) {}
  }

  // Merge database records with file cache
  const mergedMap = new Map<string, StoredCode>();

  // Add file codes first
  for (const c of fileCodes) {
    mergedMap.set(c.code.toUpperCase(), c);
  }

  // Database rows take precedence
  for (const c of dbCodes) {
    mergedMap.set(c.code.toUpperCase(), c);
  }

  const result = Array.from(mergedMap.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Keep local file cache and siteSettings in sync
  if (result.length > 0) {
    saveCodesToFile(result);
    syncCodesToSiteSettings(result);
  }

  return result;
}

export interface CreateCodesParams {
  tier: "premium" | "pro";
  durationHours?: number;
  days?: number;
  durationLabel?: string;
  maxUses?: number;
  count?: number;
  prefix?: string;
}

export async function createCodesBatch(params: CreateCodesParams): Promise<StoredCode[]> {
  await ensureDbTableExists();

  const tier = params.tier === "pro" ? "pro" : "premium";
  const count = Math.min(500, Math.max(1, Math.floor(Number(params.count || 1))));
  const maxUses = Math.max(1, Math.floor(Number(params.maxUses || 1)));

  let durationHours = params.durationHours ? Math.max(1, Math.floor(Number(params.durationHours))) : 0;
  let days = params.days ? Math.max(1, Math.floor(Number(params.days))) : 30;

  if (durationHours > 0) {
    days = Math.max(1, Math.ceil(durationHours / 24));
  } else {
    durationHours = days * 24;
  }

  const durationLabel = params.durationLabel || formatDurationLabel(durationHours);

  const existingCodes = await getAllCodes();
  const existingSet = new Set(existingCodes.map((c) => c.code.toUpperCase()));

  const newCodes: StoredCode[] = [];
  let nextId = existingCodes.reduce((max, c) => Math.max(max, c.id || 0), 0) + 1;

  for (let i = 0; i < count; i++) {
    let generated = "";
    let attempts = 0;
    do {
      generated = generateRandomCode(params.prefix);
      attempts++;
    } while (existingSet.has(generated.toUpperCase()) && attempts < 100);

    existingSet.add(generated.toUpperCase());

    const newCodeObj: StoredCode = {
      id: nextId++,
      code: generated,
      tier,
      days,
      durationHours,
      durationLabel,
      maxUses,
      usesCount: 0,
      isActive: true,
      isActivated: false,
      usedByUsername: null,
      usedByUserId: null,
      activatedAt: null,
      createdAt: new Date().toISOString(),
    };

    try {
      const [inserted] = await db
        .insert(premiumCodesTable)
        .values({
          code: newCodeObj.code,
          tier: newCodeObj.tier,
          days: newCodeObj.days,
          durationHours: newCodeObj.durationHours,
          durationLabel: newCodeObj.durationLabel,
          maxUses: newCodeObj.maxUses,
          usesCount: 0,
          isActive: true,
        } as any)
        .returning();
      if (inserted?.id) {
        newCodeObj.id = inserted.id;
      }
    } catch (e: any) {
      console.warn("[premiumCodesStore] DB insert warning:", e?.message);
    }

    newCodes.push(newCodeObj);
  }

  const updatedList = [...newCodes, ...existingCodes];
  saveCodesToFile(updatedList);
  syncCodesToSiteSettings(updatedList);

  return newCodes;
}

export async function findCode(codeStr: string): Promise<StoredCode | null> {
  const sanitized = codeStr.trim().toUpperCase();

  try {
    const [row] = await db
      .select()
      .from(premiumCodesTable)
      .where(eq(premiumCodesTable.code, sanitized))
      .limit(1);

    if (row) {
      const durationHours = (row as any).durationHours || (row.days * 24);
      const durationLabel = (row as any).durationLabel || formatDurationLabel(durationHours);
      return {
        id: row.id,
        code: row.code,
        tier: row.tier as "premium" | "pro",
        days: row.days,
        durationHours,
        durationLabel,
        maxUses: row.maxUses,
        usesCount: row.usesCount,
        isActive: row.isActive,
        isActivated: (row.usesCount || 0) > 0,
        usedByUsername: (row as any).usedByUsername || null,
        usedByUserId: (row as any).usedByUserId || null,
        activatedAt: (row as any).activatedAt ? new Date((row as any).activatedAt).toISOString() : null,
        createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
      };
    }
  } catch (e: any) {
    console.warn("[premiumCodesStore] DB find warning:", e?.message);
  }

  const all = await getAllCodes();
  return all.find((c) => c.code.toUpperCase() === sanitized) || null;
}

export async function recordCodeRedemption(
  codeId: number,
  userInfo?: { id?: number; username?: string }
): Promise<StoredCode | null> {
  const all = await getAllCodes();
  const idx = all.findIndex((c) => c.id === codeId);
  if (idx === -1) return null;

  const codeObj = all[idx];
  codeObj.usesCount += 1;
  codeObj.isActivated = true;
  codeObj.activatedAt = new Date().toISOString();
  if (userInfo?.username) codeObj.usedByUsername = userInfo.username;
  if (userInfo?.id) codeObj.usedByUserId = userInfo.id;

  if (codeObj.usesCount >= codeObj.maxUses) {
    codeObj.isActive = false;
  }

  all[idx] = codeObj;
  saveCodesToFile(all);
  syncCodesToSiteSettings(all);

  try {
    await db
      .update(premiumCodesTable)
      .set({
        usesCount: codeObj.usesCount,
        isActive: codeObj.isActive,
        usedByUsername: codeObj.usedByUsername ?? null,
        usedByUserId: codeObj.usedByUserId ?? null,
        activatedAt: new Date(),
      } as any)
      .where(or(eq(premiumCodesTable.id, codeId), eq(premiumCodesTable.code, codeObj.code)));
  } catch (e: any) {
    console.warn("[premiumCodesStore] DB update warning:", e?.message);
  }

  return codeObj;
}

export async function deactivateCodeById(codeId: number): Promise<boolean> {
  const all = await getAllCodes();
  const idx = all.findIndex((c) => c.id === codeId);
  if (idx === -1) return false;

  const codeObj = all[idx];
  codeObj.isActive = false;
  all[idx] = codeObj;
  saveCodesToFile(all);
  syncCodesToSiteSettings(all);

  try {
    await db
      .update(premiumCodesTable)
      .set({ isActive: false })
      .where(or(eq(premiumCodesTable.id, codeId), eq(premiumCodesTable.code, codeObj.code)));
  } catch (e: any) {
    console.warn("[premiumCodesStore] DB deactivate warning:", e?.message);
  }

  return true;
}

export async function reactivateCodeById(codeId: number): Promise<boolean> {
  const all = await getAllCodes();
  const idx = all.findIndex((c) => c.id === codeId);
  if (idx === -1) return false;

  const codeObj = all[idx];
  codeObj.isActive = true;
  all[idx] = codeObj;
  saveCodesToFile(all);
  syncCodesToSiteSettings(all);

  try {
    await db
      .update(premiumCodesTable)
      .set({ isActive: true })
      .where(or(eq(premiumCodesTable.id, codeId), eq(premiumCodesTable.code, codeObj.code)));
  } catch (e: any) {
    console.warn("[premiumCodesStore] DB reactivate warning:", e?.message);
  }

  return true;
}

export async function deleteCodeById(codeId: number): Promise<boolean> {
  const all = await getAllCodes();
  const target = all.find((c) => c.id === codeId);
  const filtered = all.filter((c) => c.id !== codeId);
  if (filtered.length === all.length) return false;

  saveCodesToFile(filtered);
  syncCodesToSiteSettings(filtered);

  try {
    if (target?.code) {
      await db
        .delete(premiumCodesTable)
        .where(or(eq(premiumCodesTable.id, codeId), eq(premiumCodesTable.code, target.code)));
    } else {
      await db
        .delete(premiumCodesTable)
        .where(eq(premiumCodesTable.id, codeId));
    }
  } catch (e: any) {
    console.warn("[premiumCodesStore] DB delete warning:", e?.message);
  }

  return true;
}

export async function clearAllCodes(): Promise<boolean> {
  saveCodesToFile([]);
  syncCodesToSiteSettings([]);

  try {
    await db.delete(premiumCodesTable);
  } catch (e: any) {
    console.warn("[premiumCodesStore] DB delete all warning:", e?.message);
  }

  return true;
}
