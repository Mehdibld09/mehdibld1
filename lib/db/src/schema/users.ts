import { pgTable, text, serial, timestamp, boolean, integer, index } from "drizzle-orm/pg-core";
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
  lastLoginIp: text("last_login_ip"),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  premiumTier: text("premium_tier"),
  premiumExpiresAt: timestamp("premium_expires_at", { withTimezone: true }),
  nameColor: text("name_color"),
  badgeType: text("badge_type"),
  twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
  twoFactorCode: text("two_factor_code"),
  twoFactorCodeExpiresAt: timestamp("two_factor_code_expires_at", { withTimezone: true }),
  emailVerified: boolean("email_verified").notNull().default(false),
  emailVerificationToken: text("email_verification_token"),
  emailVerificationExpiresAt: timestamp("email_verification_expires_at", { withTimezone: true }),
}, (t) => [
  // Leaderboard sort: ORDER BY xp DESC WHERE isBanned = false
  index("users_xp_idx").on(t.xp),
  // Ban check on login / vote / like
  index("users_is_banned_idx").on(t.isBanned),
]);

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
