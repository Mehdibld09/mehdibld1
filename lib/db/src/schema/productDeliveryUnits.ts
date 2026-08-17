import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { productsTable } from "./products";
import { usersTable } from "./users";

export const productDeliveryUnitsTable = pgTable("product_delivery_units", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  isDelivered: boolean("is_delivered").notNull().default(false),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ProductDeliveryUnit = typeof productDeliveryUnitsTable.$inferSelect;
