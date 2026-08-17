import { pgTable, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { productsTable } from "./products";

export const productPurchasesTable = pgTable("product_purchases", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  quantity: integer("quantity").notNull().default(1),
  totalPrice: integer("total_price").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ProductPurchase = typeof productPurchasesTable.$inferSelect;
