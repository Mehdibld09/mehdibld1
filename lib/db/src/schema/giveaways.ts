import { pgTable, text, serial, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const giveawaysTable = pgTable("giveaways", {
  id: serial("id").primaryKey(),
  createdBy: integer("created_by").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull(),
  prize: text("prize").notNull(),
  taskDescription: text("task_description").notNull(),
  taskLink: text("task_link"),
  taskCode: text("task_code"),
  maxEntries: integer("max_entries").notNull().default(100),
  entriesCount: integer("entries_count").notNull().default(0),
  endDate: timestamp("end_date", { withTimezone: true }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  autoApprove: boolean("auto_approve").notNull().default(false),
  winnerUserId: integer("winner_user_id"),
  winnerUsername: text("winner_username"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const giveawayEntriesTable = pgTable("giveaway_entries", {
  id: serial("id").primaryKey(),
  giveawayId: integer("giveaway_id").notNull().references(() => giveawaysTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  taskProof: text("task_proof"),
  ipAddress: text("ip_address"),
  isApproved: boolean("is_approved").notNull().default(false),
  isRejected: boolean("is_rejected").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertGiveawaySchema = createInsertSchema(giveawaysTable).omit({
  id: true,
  createdBy: true,
  entriesCount: true,
  isActive: true,
  winnerUserId: true,
  winnerUsername: true,
  createdAt: true,
});
export type InsertGiveaway = z.infer<typeof insertGiveawaySchema>;
export type Giveaway = typeof giveawaysTable.$inferSelect;
