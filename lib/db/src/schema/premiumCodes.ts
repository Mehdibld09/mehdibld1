import { pgTable, text, serial, timestamp, boolean, integer } from "drizzle-orm/pg-core";

export const premiumCodesTable = pgTable("premium_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  tier: text("tier").notNull().default("premium"),
  days: integer("days").notNull().default(30),
  maxUses: integer("max_uses").notNull().default(1),
  usesCount: integer("uses_count").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PremiumCode = typeof premiumCodesTable.$inferSelect;
