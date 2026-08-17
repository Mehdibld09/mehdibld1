import { pgTable, text, serial, timestamp, boolean, integer, index } from "drizzle-orm/pg-core";
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
  isPinned: boolean("is_pinned").notNull().default(false),
  customButtonEnabled: boolean("custom_button_enabled").notNull().default(false),
  customButtonLabel: text("custom_button_label"),
  customButtonUrl: text("custom_button_url"),
}, (t) => [
  // Main listing: WHERE isAvailable = true AND deletedAt IS NULL, ORDER BY createdAt DESC
  index("accounts_available_created_idx").on(t.isAvailable, t.createdAt),
  // Popularity sort
  index("accounts_available_likes_idx").on(t.isAvailable, t.likesCount),
  // Profile page: all accounts by a given user
  index("accounts_user_id_idx").on(t.userId),
  // Pending review queue
  index("accounts_status_idx").on(t.status),
  // Soft-delete listing
  index("accounts_deleted_at_idx").on(t.deletedAt),
]);

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
