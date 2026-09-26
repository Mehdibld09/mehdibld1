import fs from "node:fs";
import path from "node:path";
import { db, siteSettingsTable } from "@workspace/db";

const DATA_DIR = path.resolve(process.cwd(), "data");
const SETTINGS_FILE = path.join(DATA_DIR, "site-settings.json");

function ensureDataDir(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (e) {
    console.error("[SettingsStore] Failed to create data dir:", e);
  }
}

export function loadSettingsFromFile(): Record<string, string> {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const raw = fs.readFileSync(SETTINGS_FILE, "utf-8");
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn("[SettingsStore] Could not read settings file:", e);
  }
  return {};
}

export function saveSettingsToFile(settings: Record<string, string>): void {
  try {
    ensureDataDir();
    const existing = loadSettingsFromFile();
    const merged = { ...existing, ...settings };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(merged, null, 2), "utf-8");
  } catch (e) {
    console.error("[SettingsStore] Failed to save settings file:", e);
  }
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const fileSettings = loadSettingsFromFile();
  const result: Record<string, string> = { ...fileSettings };

  try {
    const rows = await db.select().from(siteSettingsTable);
    if (Array.isArray(rows) && rows.length > 0) {
      for (const r of rows) {
        if (r && r.key) {
          result[r.key] = r.value ?? "";
        }
      }
      // Keep file cache synced with DB
      saveSettingsToFile(result);
    }
  } catch (dbErr: any) {
    console.warn("[SettingsStore] DB query failed, using file fallback:", dbErr?.message || dbErr);
  }

  // Fallback to process.env for standard SMTP variables if not already set
  if (!result.smtp_host && process.env.SMTP_HOST) result.smtp_host = process.env.SMTP_HOST;
  if (!result.smtp_port && process.env.SMTP_PORT) result.smtp_port = process.env.SMTP_PORT;
  if (!result.smtp_user && process.env.SMTP_USER) result.smtp_user = process.env.SMTP_USER;
  if (!result.smtp_pass && process.env.SMTP_PASS) result.smtp_pass = process.env.SMTP_PASS;
  if (!result.smtp_from && process.env.SMTP_FROM) result.smtp_from = process.env.SMTP_FROM;

  return result;
}

export async function saveSettings(pairs: [string, string][]): Promise<void> {
  const toSave: Record<string, string> = {};
  for (const [key, value] of pairs) {
    toSave[key] = value;
  }

  // Always save to file first for instant persistence across restarts/outages
  saveSettingsToFile(toSave);

  // Try updating DB
  try {
    for (const [key, value] of pairs) {
      await db
        .insert(siteSettingsTable)
        .values({ key, value, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: siteSettingsTable.key,
          set: { value, updatedAt: new Date() },
        });
    }
  } catch (dbErr: any) {
    console.warn("[SettingsStore] Could not persist to DB (file fallback active):", dbErr?.message || dbErr);
  }
}
