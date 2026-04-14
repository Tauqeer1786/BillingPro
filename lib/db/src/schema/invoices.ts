import { pgTable, serial, text, integer, doublePrecision, timestamp } from "drizzle-orm/pg-core";
import { customersTable } from "./customers";
import { productsTable } from "./products";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const invoicesTable = pgTable("invoices", {
  id: serial("id").primaryKey(),
  invoiceNumber: text("invoice_number").notNull().unique(),
  customerId: integer("customer_id").references(() => customersTable.id, { onDelete: "set null" }),
  date: text("date").notNull(),
  subtotal: doublePrecision("subtotal").notNull().default(0),
  totalGst: doublePrecision("total_gst").notNull().default(0),
  totalDiscount: doublePrecision("total_discount").notNull().default(0),
  grandTotal: doublePrecision("grand_total").notNull().default(0),
  totalProfit: doublePrecision("total_profit").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const invoiceItemsTable = pgTable("invoice_items", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").notNull().references(() => invoicesTable.id, { onDelete: "cascade" }),
  productId: integer("product_id").notNull().references(() => productsTable.id),
  productName: text("product_name").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: doublePrecision("unit_price").notNull(),
  costPrice: doublePrecision("cost_price").notNull().default(0),
  gstPercent: doublePrecision("gst_percent").notNull(),
  gstAmount: doublePrecision("gst_amount").notNull(),
  discountPercent: doublePrecision("discount_percent").default(0),
  discountAmount: doublePrecision("discount_amount").default(0),
  totalAmount: doublePrecision("total_amount").notNull(),
  profit: doublePrecision("profit").default(0),
});

export const insertInvoiceSchema = createInsertSchema(invoicesTable).omit({ id: true, createdAt: true });
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoicesTable.$inferSelect;

export const insertInvoiceItemSchema = createInsertSchema(invoiceItemsTable).omit({ id: true });
export type InsertInvoiceItem = z.infer<typeof insertInvoiceItemSchema>;
export type InvoiceItem = typeof invoiceItemsTable.$inferSelect;
