import { pgTable, serial, timestamp, integer, text, index, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const likesTable = pgTable("likes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  targetType: text("target_type").notNull(), // 'account' | 'comment'
  targetId: integer("target_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  // Most frequent lookup: "has this user liked this specific target?" — 3-column composite covers it exactly
  uniqueIndex("likes_user_type_target_idx").on(t.userId, t.targetType, t.targetId),
  // Batch lookup used in the accounts list: "which of these accountIds has the user liked?"
  index("likes_user_type_idx").on(t.userId, t.targetType),
]);

export type Like = typeof likesTable.$inferSelect;
