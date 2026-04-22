import { sqliteTable, integer, text, real } from "drizzle-orm/sqlite-core";
import { invoicesTable } from "./invoices";

export const invoicePaymentsTable = sqliteTable("invoice_payments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  invoiceId: integer("invoice_id").notNull().references(() => invoicesTable.id, { onDelete: "cascade" }),
  paymentDate: text("payment_date").notNull(),
  amount: real("amount").notNull(),
  paymentMode: text("payment_mode").notNull().default("cash"),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export type InvoicePayment = typeof invoicePaymentsTable.$inferSelect;
