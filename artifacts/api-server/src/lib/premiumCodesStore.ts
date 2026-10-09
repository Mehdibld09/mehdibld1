import fs from "node:fs";
import path from "node:path";
import crypto from "crypto";
import { db, premiumCodesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

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
  createdAt: string;
}

const DATA_DIR = path.resolve(process.cwd(), "data");
const CODES_FILE = path.join(DATA_DIR, "premium-codes.json");

function ensureDirectoryExists() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadCodesFromFile(): StoredCode[] {
  try {
    ensureDirectoryExists();
    if (fs.existsSync(CODES_FILE)) {
      const content = fs.readFileSync(CODES_FILE, "utf-8");
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return parsed;
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

export function generateRandomCode(prefix?: string): string {
  // Generate clean 4-character blocks without confusing characters
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

export async function getAllCodes(): Promise<StoredCode[]> {
  const fileCodes = loadCodesFromFile();

  if (process.env.DATABASE_URL) {
    try {
      const dbRows = await db
        .select()
        .from(premiumCodesTable)
        .orderBy(desc(premiumCodesTable.createdAt))
        .limit(500);

      if (dbRows && dbRows.length > 0) {
        const mergedMap = new Map<string, StoredCode>();
        // Add file codes first
        for (const c of fileCodes) {
          mergedMap.set(c.code.toUpperCase(), c);
        }
        // DB rows take precedence
        for (const r of dbRows) {
          const durationHours = (r as any).durationHours || (r.days * 24);
          const durationLabel = (r as any).durationLabel || formatDurationLabel(durationHours);
          mergedMap.set(r.code.toUpperCase(), {
            id: r.id,
            code: r.code,
            tier: r.tier as "premium" | "pro",
            days: r.days,
            durationHours,
            durationLabel,
            maxUses: r.maxUses,
            usesCount: r.usesCount,
            isActive: r.isActive,
            createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
          });
        }
        const result = Array.from(mergedMap.values()).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        saveCodesToFile(result);
        return result;
      }
    } catch (e: any) {
      console.warn("[premiumCodesStore] DB query warning:", e?.message);
    }
  }

  return fileCodes.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
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
      createdAt: new Date().toISOString(),
    };

    if (process.env.DATABASE_URL) {
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
    }

    newCodes.push(newCodeObj);
  }

  const updatedList = [...newCodes, ...existingCodes];
  saveCodesToFile(updatedList);

  return newCodes;
}

export async function findCode(codeStr: string): Promise<StoredCode | null> {
  const sanitized = codeStr.trim().toUpperCase();
  const all = await getAllCodes();
  const found = all.find((c) => c.code.toUpperCase() === sanitized);
  return found || null;
}

export async function recordCodeRedemption(codeId: number): Promise<StoredCode | null> {
  const all = await getAllCodes();
  const idx = all.findIndex((c) => c.id === codeId);
  if (idx === -1) return null;

  const codeObj = all[idx];
  codeObj.usesCount += 1;
  if (codeObj.usesCount >= codeObj.maxUses) {
    codeObj.isActive = false;
  }

  all[idx] = codeObj;
  saveCodesToFile(all);

  if (process.env.DATABASE_URL) {
    try {
      await db
        .update(premiumCodesTable)
        .set({
          usesCount: codeObj.usesCount,
          isActive: codeObj.isActive,
        })
        .where(eq(premiumCodesTable.id, codeId));
    } catch (e: any) {
      console.warn("[premiumCodesStore] DB update warning:", e?.message);
    }
  }

  return codeObj;
}

export async function deactivateCodeById(codeId: number): Promise<boolean> {
  const all = await getAllCodes();
  const idx = all.findIndex((c) => c.id === codeId);
  if (idx === -1) return false;

  all[idx].isActive = false;
  saveCodesToFile(all);

  if (process.env.DATABASE_URL) {
    try {
      await db
        .update(premiumCodesTable)
        .set({ isActive: false })
        .where(eq(premiumCodesTable.id, codeId));
    } catch (e: any) {
      console.warn("[premiumCodesStore] DB deactivate warning:", e?.message);
    }
  }

  return true;
}

export async function deleteCodeById(codeId: number): Promise<boolean> {
  const all = await getAllCodes();
  const filtered = all.filter((c) => c.id !== codeId);
  if (filtered.length === all.length) return false;

  saveCodesToFile(filtered);

  if (process.env.DATABASE_URL) {
    try {
      await db
        .delete(premiumCodesTable)
        .where(eq(premiumCodesTable.id, codeId));
    } catch (e: any) {
      console.warn("[premiumCodesStore] DB delete warning:", e?.message);
    }
  }

  return true;
}

export async function clearAllCodes(): Promise<boolean> {
  saveCodesToFile([]);

  if (process.env.DATABASE_URL) {
    try {
      await db.delete(premiumCodesTable);
    } catch (e: any) {
      console.warn("[premiumCodesStore] DB delete all warning:", e?.message);
    }
  }

  return true;
}
