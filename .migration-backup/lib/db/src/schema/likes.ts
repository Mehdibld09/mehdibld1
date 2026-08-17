import { pgTable, serial, timestamp, integer, text } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const likesTable = pgTable("likes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  targetType: text("target_type").notNull(), // 'account' | 'comment'
  targetId: integer("target_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Like = typeof likesTable.$inferSelect;
