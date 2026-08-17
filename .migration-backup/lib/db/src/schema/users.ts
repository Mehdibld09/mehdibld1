import { pgTable, text, serial, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  displayName: text("display_name"),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  avatarUrl: text("avatar_url"),
  points: integer("points").notNull().default(100),
  xp: integer("xp").notNull().default(0),
  level: integer("level").notNull().default(1),
  badgeName: text("badge_name"),
  isAdmin: boolean("is_admin").notNull().default(false),
  isModerator: boolean("is_moderator").notNull().default(false),
  isBanned: boolean("is_banned").notNull().default(false),
  banReason: text("ban_reason"),
  banExpiresAt: timestamp("ban_expires_at", { withTimezone: true }),
  registrationIp: text("registration_ip"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  premiumTier: text("premium_tier"),
  premiumExpiresAt: timestamp("premium_expires_at", { withTimezone: true }),
  nameColor: text("name_color"),
  badgeType: text("badge_type"),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  points: true,
  xp: true,
  level: true,
  badgeName: true,
  isAdmin: true,
  isModerator: true,
  isBanned: true,
  banReason: true,
  banExpiresAt: true,
  registrationIp: true,
  createdAt: true,
  premiumTier: true,
  premiumExpiresAt: true,
  nameColor: true,
  badgeType: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
