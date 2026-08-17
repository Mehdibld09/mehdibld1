import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";

export const siteSettingsTable = pgTable("site_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const footerLinksTable = pgTable("footer_links", {
  id: serial("id").primaryKey(),
  label: text("label").notNull(),
  url: text("url").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const adsTable = pgTable("ads", {
  id: serial("id").primaryKey(),
  placement: text("placement").notNull(), // 'home' | 'browse'
  imageUrl: text("image_url").notNull(),
  linkUrl: text("link_url").notNull(),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SiteSetting = typeof siteSettingsTable.$inferSelect;
export type FooterLink = typeof footerLinksTable.$inferSelect;
export type Ad = typeof adsTable.$inferSelect;
