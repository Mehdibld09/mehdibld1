import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;

let poolInstance: pg.Pool;
let dbInstance: ReturnType<typeof drizzle<typeof schema>>;

if (!databaseUrl) {
  console.warn("[AI Studio] No DATABASE_URL provided — using mock DB");
  poolInstance = {
    query: async (queryTextOrConfig: any, values?: any[]) => {
      const text = typeof queryTextOrConfig === 'string' ? queryTextOrConfig : queryTextOrConfig.text;
      if (text && text.toUpperCase().includes('COUNT(')) {
        return { rows: [{ count: 0, value: 0 }] };
      }
      return { rows: [] };
    },
    connect: async () => ({
      query: async (q: any, v: any) => poolInstance.query(q, v),
      release: () => {}
    }),
    on: () => {},
    end: async () => {},
  } as any;

  dbInstance = drizzle(poolInstance, { schema });
} else {
  const isSupabaseDatabase = (() => {
    try {
      const hostname = new URL(databaseUrl).hostname;
      return hostname.endsWith(".supabase.co") || hostname.endsWith(".pooler.supabase.com");
    } catch {
      return false;
    }
  })();

  poolInstance = new Pool({
    connectionString: databaseUrl,
    max: process.env.VERCEL ? 1 : 2,
    idleTimeoutMillis: process.env.VERCEL ? 5_000 : 10_000,
    connectionTimeoutMillis: 8_000,
    keepAlive: true,
    ...(isSupabaseDatabase
      ? { ssl: { rejectUnauthorized: false } }
      : {}),
  });

  poolInstance.on("error", (err) => {
    console.warn("[DB] Pool warning:", err?.message || err);
  });

  dbInstance = drizzle(poolInstance, { schema });
}

export const pool = poolInstance;
export const db = dbInstance;

export * from "./schema";
