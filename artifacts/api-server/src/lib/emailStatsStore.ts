import fs from "node:fs";
import path from "node:path";
import { db, siteSettingsTable, emailLogsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

export type EmailPurpose = "2fa_login" | "verify_email" | "password_reset" | "smtp_test" | "other";

export interface EmailLogEntry {
  id: string;
  timestamp: string;
  recipient: string; // masked for privacy
  subject: string;
  purpose: EmailPurpose;
  status: "success" | "failed";
  durationMs: number;
  messageId?: string;
  error?: string;
  provider?: string;
}

export interface EmailStatsSummary {
  totalSent: number;
  totalSuccess: number;
  totalFailed: number;
  successRate: number; // 0 to 100
  avgDurationMs: number;
  lastSentAt: string | null;
  byPurpose: Record<EmailPurpose, { total: number; success: number; failed: number }>;
  recentLogs: EmailLogEntry[];
}

const DATA_DIR = path.resolve(process.cwd(), "data");
const STATS_FILE = path.join(DATA_DIR, "email-stats.json");

function ensureDataDir(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (e) {
    console.error("[EmailStats] Failed to create data dir:", e);
  }
}

export function getDefaultStats(): EmailStatsSummary {
  return {
    totalSent: 0,
    totalSuccess: 0,
    totalFailed: 0,
    successRate: 100,
    avgDurationMs: 0,
    lastSentAt: null,
    byPurpose: {
      "2fa_login": { total: 0, success: 0, failed: 0 },
      "verify_email": { total: 0, success: 0, failed: 0 },
      "password_reset": { total: 0, success: 0, failed: 0 },
      "smtp_test": { total: 0, success: 0, failed: 0 },
      "other": { total: 0, success: 0, failed: 0 },
    },
    recentLogs: [],
  };
}

let inMemoryStats: EmailStatsSummary | null = null;

export function loadStatsFromFile(): EmailStatsSummary | null {
  try {
    if (fs.existsSync(STATS_FILE)) {
      const raw = fs.readFileSync(STATS_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.totalSent === "number") {
        return {
          ...getDefaultStats(),
          ...parsed,
          byPurpose: {
            ...getDefaultStats().byPurpose,
            ...(parsed.byPurpose || {}),
          },
          recentLogs: Array.isArray(parsed.recentLogs) ? parsed.recentLogs : [],
        };
      }
    }
  } catch (e) {
    console.warn("[EmailStats] Failed to read email-stats.json:", e);
  }
  return null;
}

export function persistStatsToFile(stats: EmailStatsSummary): void {
  try {
    ensureDataDir();
    fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2), "utf-8");
  } catch (e) {
    console.error("[EmailStats] Failed to persist email-stats.json:", e);
  }
}

export function maskEmail(email: string): string {
  if (!email || !email.includes("@")) return email || "unknown";
  const [user, domain] = email.split("@");
  if (user.length <= 2) {
    return `${user[0]}*@${domain}`;
  }
  return `${user[0]}***${user[user.length - 1]}@${domain}`;
}

export function getEmailStats(): EmailStatsSummary {
  if (inMemoryStats) return inMemoryStats;

  const fileData = loadStatsFromFile();
  if (fileData) {
    inMemoryStats = fileData;
    return inMemoryStats;
  }

  inMemoryStats = getDefaultStats();
  return inMemoryStats;
}

/**
 * Async version that ensures stats are synced with the database
 */
export async function getEmailStatsAsync(): Promise<EmailStatsSummary> {
  // Try loading from database site_settings table first
  try {
    const rows = await db
      .select()
      .from(siteSettingsTable)
      .where(eq(siteSettingsTable.key, "email_delivery_stats"));

    if (rows && rows.length > 0 && rows[0]?.value) {
      const parsed = JSON.parse(rows[0].value);
      if (parsed && typeof parsed.totalSent === "number") {
        inMemoryStats = {
          ...getDefaultStats(),
          ...parsed,
          byPurpose: {
            ...getDefaultStats().byPurpose,
            ...(parsed.byPurpose || {}),
          },
          recentLogs: Array.isArray(parsed.recentLogs) ? parsed.recentLogs : [],
        };
        // Keep file synced
        persistStatsToFile(inMemoryStats);
        return inMemoryStats;
      }
    }
  } catch (dbErr: any) {
    // DB might not be configured or table empty, proceed to file/memory
  }

  return getEmailStats();
}

export async function recordEmailEvent(entry: {
  recipient: string;
  subject: string;
  purpose: EmailPurpose;
  status: "success" | "failed";
  durationMs: number;
  messageId?: string;
  error?: string;
  provider?: string;
}): Promise<void> {
  const stats = getEmailStats();
  const p = entry.purpose || "other";

  stats.totalSent += 1;
  if (entry.status === "success") {
    stats.totalSuccess += 1;
  } else {
    stats.totalFailed += 1;
  }

  stats.successRate = stats.totalSent > 0 ? Math.round((stats.totalSuccess / stats.totalSent) * 1000) / 10 : 100;

  // Moving average for latency
  if (stats.totalSent === 1) {
    stats.avgDurationMs = Math.round(entry.durationMs);
  } else {
    stats.avgDurationMs = Math.round((stats.avgDurationMs * (stats.totalSent - 1) + entry.durationMs) / stats.totalSent);
  }

  stats.lastSentAt = new Date().toISOString();

  // Purpose stats
  if (!stats.byPurpose[p]) {
    stats.byPurpose[p] = { total: 0, success: 0, failed: 0 };
  }
  stats.byPurpose[p].total += 1;
  if (entry.status === "success") {
    stats.byPurpose[p].success += 1;
  } else {
    stats.byPurpose[p].failed += 1;
  }

  const masked = maskEmail(entry.recipient);
  const logItem: EmailLogEntry = {
    id: `em_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: stats.lastSentAt,
    recipient: masked,
    subject: entry.subject,
    purpose: p,
    status: entry.status,
    durationMs: entry.durationMs,
    messageId: entry.messageId,
    error: entry.error,
    provider: entry.provider,
  };

  stats.recentLogs = [logItem, ...(stats.recentLogs || [])].slice(0, 100);

  inMemoryStats = stats;
  // 1. Persist to file immediately
  persistStatsToFile(stats);

  // 2. Persist to DB site_settings table (key-value storage)
  try {
    await db
      .insert(siteSettingsTable)
      .values({
        key: "email_delivery_stats",
        value: JSON.stringify(stats),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: siteSettingsTable.key,
        set: { value: JSON.stringify(stats), updatedAt: new Date() },
      });
  } catch (dbErr: any) {
    // Non-fatal if DB is offline or mock
  }

  // 3. Persist individual log entry to emailLogsTable in DB
  try {
    await db.insert(emailLogsTable).values({
      recipient: masked,
      subject: entry.subject,
      purpose: p,
      status: entry.status,
      durationMs: Math.round(entry.durationMs),
      messageId: entry.messageId || null,
      error: entry.error || null,
      provider: entry.provider || null,
      createdAt: new Date(),
    });
  } catch (dbErr: any) {
    // Non-fatal if DB is offline or mock
  }
}

export async function resetEmailStats(): Promise<EmailStatsSummary> {
  inMemoryStats = getDefaultStats();
  persistStatsToFile(inMemoryStats);

  try {
    await db
      .insert(siteSettingsTable)
      .values({
        key: "email_delivery_stats",
        value: JSON.stringify(inMemoryStats),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: siteSettingsTable.key,
        set: { value: JSON.stringify(inMemoryStats), updatedAt: new Date() },
      });
  } catch (dbErr: any) {
    // Non-fatal
  }

  return inMemoryStats;
}
