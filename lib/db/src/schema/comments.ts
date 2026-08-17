import { pgTable, text, serial, timestamp, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { accountsTable } from "./accounts";

export const commentsTable = pgTable("comments", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull().references(() => accountsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  parentId: integer("parent_id"),
  content: text("content").notNull(),
  likesCount: integer("likes_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  // Loading all comments for an account page
  index("comments_account_id_idx").on(t.accountId),
  // "Has this user commented on this account?" check used for claim unlock
  index("comments_user_account_idx").on(t.userId, t.accountId),
]);

export const insertCommentSchema = createInsertSchema(commentsTable).omit({
  id: true,
  likesCount: true,
  createdAt: true,
});
export type InsertComment = z.infer<typeof insertCommentSchema>;
export type Comment = typeof commentsTable.$inferSelect;
