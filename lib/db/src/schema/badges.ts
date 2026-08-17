import { pgTable, text, serial, integer } from "drizzle-orm/pg-core";

export const badgesTable = pgTable("badges", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description").notNull(),
  xpThreshold: integer("xp_threshold").notNull(),
  iconUrl: text("icon_url"),
});

export type Badge = typeof badgesTable.$inferSelect;
