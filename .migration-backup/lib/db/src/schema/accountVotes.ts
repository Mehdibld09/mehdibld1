import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { accountsTable } from "./accounts";

export const accountVotesTable = pgTable("account_votes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  accountId: integer("account_id").notNull().references(() => accountsTable.id, { onDelete: "cascade" }),
  vote: text("vote").notNull(), // "working" | "not_working"
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AccountVote = typeof accountVotesTable.$inferSelect;
