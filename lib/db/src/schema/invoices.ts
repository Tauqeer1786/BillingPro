import { sqliteTable, integer, text, real } from "drizzle-orm/sqlite-core";
import { customersTable } from "./customers";
import { productsTable } from "./products";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const invoicesTable = sqliteTable("invoices", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  invoiceNumber: text("invoice_number").notNull().unique(),
  customerId: integer("customer_id").references(() => customersTable.id, { onDelete: "set null" }),
  date: text("date").notNull(),
  paymentStatus: text("payment_status", { enum: ["paid", "unpaid"] }).notNull().default("unpaid"),
  paymentMode: text("payment_mode", { enum: ["cash", "credit"] }).notNull().default("credit"),
  subtotal: real("subtotal").notNull().default(0),
  totalGst: real("total_gst").notNull().default(0),
  totalDiscount: real("total_discount").notNull().default(0),
  grandTotal: real("grand_total").notNull().default(0),
  amountPaid: real("amount_paid").notNull().default(0),
  totalProfit: real("total_profit").notNull().default(0),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const invoiceItemsTable = sqliteTable("invoice_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  invoiceId: integer("invoice_id").notNull().references(() => invoicesTable.id, { onDelete: "cascade" }),
  productId: integer("product_id").notNull().references(() => productsTable.id),
  productName: text("product_name").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: real("unit_price").notNull(),
  costPrice: real("cost_price").notNull().default(0),
  gstPercent: real("gst_percent").notNull(),
  gstAmount: real("gst_amount").notNull(),
  discountPercent: real("discount_percent").default(0),
  discountAmount: real("discount_amount").default(0),
  totalAmount: real("total_amount").notNull(),
  profit: real("profit").default(0),
});

export const insertInvoiceSchema = createInsertSchema(invoicesTable).omit({ id: true, createdAt: true });
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoicesTable.$inferSelect;

export const insertInvoiceItemSchema = createInsertSchema(invoiceItemsTable).omit({ id: true });
export type InsertInvoiceItem = z.infer<typeof insertInvoiceItemSchema>;
export type InvoiceItem = typeof invoiceItemsTable.$inferSelect;
