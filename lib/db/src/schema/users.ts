import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

export const usersTable = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["master", "admin", "salesman"] }).notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  createdBy: integer("created_by"),
});

export const salesmanPermissionsTable = sqliteTable("salesman_permissions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  canBill: integer("can_bill", { mode: "boolean" }).notNull().default(true),
  canViewReports: integer("can_view_reports", { mode: "boolean" }).notNull().default(false),
  canEditInvoices: integer("can_edit_invoices", { mode: "boolean" }).notNull().default(false),
  canAccessInventory: integer("can_access_inventory", { mode: "boolean" }).notNull().default(false),
});

export const businessSettingsTable = sqliteTable("business_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull().default(""),
  isLocked: integer("is_locked", { mode: "boolean" }).notNull().default(false),
});

export type User = typeof usersTable.$inferSelect;
export type InsertUser = typeof usersTable.$inferInsert;
export type SalesmanPermissions = typeof salesmanPermissionsTable.$inferSelect;
export type BusinessSettings = typeof businessSettingsTable.$inferSelect;
