import { pgTable, text, serial, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const accountsTable = pgTable("accounts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull(),
  games: text("games").array().notNull().default([]),
  pointsCost: integer("points_cost").notNull().default(0),
  steamUsername: text("steam_username").notNull(),
  steamPassword: text("steam_password").notNull(),
  isAvailable: boolean("is_available").notNull().default(true),
  likesCount: integer("likes_count").notNull().default(0),
  claimsCount: integer("claims_count").notNull().default(0),
  workingVotes: integer("working_votes").notNull().default(0),
  notWorkingVotes: integer("not_working_votes").notNull().default(0),
  viewCount: integer("view_count").notNull().default(0),
  unlockMethod: text("unlock_method").notNull().default("login"),
  status: text("status").notNull().default("approved"),
  reviewNote: text("review_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
  healthFailCount: integer("health_fail_count").notNull().default(0),
  lastCheckStatus: text("last_check_status"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  deletedByUserId: integer("deleted_by_user_id"),
  deletedReason: text("deleted_reason"),
});

export const insertAccountSchema = createInsertSchema(accountsTable).omit({
  id: true,
  isAvailable: true,
  likesCount: true,
  claimsCount: true,
  workingVotes: true,
  notWorkingVotes: true,
  viewCount: true,
  createdAt: true,
});
export type InsertAccount = z.infer<typeof insertAccountSchema>;
export type Account = typeof accountsTable.$inferSelect;
