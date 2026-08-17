import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/mock";
const isSupabaseDatabase = (() => {
  try {
    const hostname = new URL(databaseUrl).hostname;
    return hostname.endsWith(".supabase.co") || hostname.endsWith(".pooler.supabase.com");
  } catch {
    return false;
  }
})();

export const pool = new Pool({
  connectionString: databaseUrl,
  // Tuned for serverless (Vercel): keep a small pool so each function instance
  // doesn't open many idle connections — Postgres has a hard connection cap.
  max: process.env.VERCEL ? 1 : 2,
  idleTimeoutMillis: process.env.VERCEL ? 5_000 : 10_000,
  connectionTimeoutMillis: 8_000,
  keepAlive: true,
  // Supabase requires TLS for hosted Postgres connections. The hosted
  // certificate chain is managed by Supabase, not by this serverless bundle.
  ...(isSupabaseDatabase
    ? { ssl: { rejectUnauthorized: false } }
    : {}),
});

pool.on("error", (err) => {
  console.warn("[DB] Pool warning:", err?.message || err);
});

let dbInstance: any;
try {
  dbInstance = drizzle(pool, { schema });
} catch {
  console.warn("[AI Studio] Database not connected — using fallback");
  const noOp = {
    findMany: async () => [],
    findFirst: async () => null,
    findUnique: async () => null,
    create: async (d: any) => d?.data ?? {},
    update: async (d: any) => d?.data ?? {},
    delete: async () => ({}),
  };
  dbInstance = new Proxy({}, {
    get: (_, prop) => prop === 'query'
      ? new Proxy({}, { get: () => noOp }) : async () => [],
  });
}

export const db = dbInstance;

export * from "./schema";
