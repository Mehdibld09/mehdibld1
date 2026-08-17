import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";

export const ipBansTable = pgTable("ip_bans", {
  id: serial("id").primaryKey(),
  ip: text("ip").notNull().unique(),
  reason: text("reason"),
  bannedByUserId: integer("banned_by_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type IpBan = typeof ipBansTable.$inferSelect;
