import { pgTable, text, serial, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const adLinksTable = pgTable("ad_links", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  description: text("description"),
  pointsReward: integer("points_reward").notNull().default(50),
  maxUses: integer("max_uses").notNull().default(1),
  usesCount: integer("uses_count").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const adLinkRedemptionsTable = pgTable("ad_link_redemptions", {
  id: serial("id").primaryKey(),
  adLinkId: integer("ad_link_id").notNull().references(() => adLinksTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAdLinkSchema = createInsertSchema(adLinksTable).omit({
  id: true,
  code: true,
  usesCount: true,
  isActive: true,
  createdAt: true,
});
export type InsertAdLink = z.infer<typeof insertAdLinkSchema>;
export type AdLink = typeof adLinksTable.$inferSelect;
