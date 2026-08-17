import { pgTable, text, serial, timestamp, integer, uniqueIndex } from "drizzle-orm/pg-core";

export const accountClaimsTable = pgTable("account_claims", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull(),
  userId: integer("user_id").notNull(),
  steamUsername: text("steam_username"),
  steamPassword: text("steam_password"),
  pointsSpent: integer("points_spent").notNull().default(0),
  claimedAt: timestamp("claimed_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  // "Has this user already claimed this account?" — fired on every detail page load for logged-in users
  uniqueIndex("account_claims_user_account_idx").on(t.userId, t.accountId),
]);

export type AccountClaim = typeof accountClaimsTable.$inferSelect;
