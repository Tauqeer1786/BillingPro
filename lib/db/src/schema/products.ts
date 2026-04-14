import { sqliteTable, integer, text, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const productsTable = sqliteTable("products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  costPrice: real("cost_price").notNull(),
  marginPercent: real("margin_percent").notNull(),
  sellingPrice: real("selling_price").notNull(),
  gstPercent: real("gst_percent").notNull(),
  stock: integer("stock").notNull().default(0),
  hsn: text("hsn"),
  unit: text("unit").default("pcs"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const insertProductSchema = createInsertSchema(productsTable).omit({ id: true, createdAt: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;
