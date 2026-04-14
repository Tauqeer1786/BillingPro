import { pgTable, serial, text, integer, doublePrecision, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  costPrice: doublePrecision("cost_price").notNull(),
  marginPercent: doublePrecision("margin_percent").notNull(),
  sellingPrice: doublePrecision("selling_price").notNull(),
  gstPercent: doublePrecision("gst_percent").notNull(),
  stock: integer("stock").notNull().default(0),
  hsn: text("hsn"),
  unit: text("unit").default("pcs"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertProductSchema = createInsertSchema(productsTable).omit({ id: true, createdAt: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;
