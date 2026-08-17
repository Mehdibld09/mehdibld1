import { pgTable, text, serial, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const announcementsTable = pgTable("announcements", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  pinned: boolean("pinned").notNull().default(true),
  isPopup: boolean("is_popup").notNull().default(false),
  popupButtons: text("popup_buttons").notNull().default("[]"),
  authorId: integer("author_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Announcement = typeof announcementsTable.$inferSelect;
