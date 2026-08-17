import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),        // recipient
  type: text("type").notNull(),                // e.g. "comment_like"
  actorUsername: text("actor_username").notNull(),
  message: text("message").notNull(),
  linkUrl: text("link_url"),                   // optional deep-link
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
