import { sqliteTable, integer, text, real } from "drizzle-orm/sqlite-core";

export const purchasesTable = sqliteTable("purchases", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  supplierName: text("supplier_name").notNull(),
  date: text("date").notNull(),
  notes: text("notes"),
  totalAmount: real("total_amount").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const purchaseItemsTable = sqliteTable("purchase_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  purchaseId: integer("purchase_id").notNull(),
  productId: integer("product_id"),
  productName: text("product_name").notNull(),
  quantity: integer("quantity").notNull(),
  costPrice: real("cost_price").notNull(),
  totalCost: real("total_cost").notNull(),
});
