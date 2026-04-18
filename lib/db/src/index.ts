import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import * as schema from "./schema";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DB_PATH = process.env.DB_PATH || path.resolve(__dirname, "../../../billing.db");

const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });

export function initializeDb() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      cost_price REAL NOT NULL,
      margin_percent REAL NOT NULL,
      selling_price REAL NOT NULL,
      gst_percent REAL NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0,
      hsn TEXT,
      unit TEXT DEFAULT 'pcs',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      address TEXT,
      gstin TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT NOT NULL UNIQUE,
      customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
      date TEXT NOT NULL,
      payment_status TEXT NOT NULL DEFAULT 'unpaid',
      subtotal REAL NOT NULL DEFAULT 0,
      total_gst REAL NOT NULL DEFAULT 0,
      total_discount REAL NOT NULL DEFAULT 0,
      grand_total REAL NOT NULL DEFAULT 0,
      total_profit REAL NOT NULL DEFAULT 0,
      notes TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      cost_price REAL NOT NULL DEFAULT 0,
      gst_percent REAL NOT NULL,
      gst_amount REAL NOT NULL,
      discount_percent REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      total_amount REAL NOT NULL,
      profit REAL DEFAULT 0
    );
  `);

  const invoiceColumns = sqlite.prepare("PRAGMA table_info(invoices)").all() as Array<{ name: string }>;
  if (!invoiceColumns.some(column => column.name === "payment_status")) {
    sqlite.exec("ALTER TABLE invoices ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'unpaid'");
  }
  if (!invoiceColumns.some(column => column.name === "payment_mode")) {
    sqlite.exec("ALTER TABLE invoices ADD COLUMN payment_mode TEXT NOT NULL DEFAULT 'credit'");
  }
  if (!invoiceColumns.some(column => column.name === "amount_paid")) {
    sqlite.exec("ALTER TABLE invoices ADD COLUMN amount_paid REAL NOT NULL DEFAULT 0");
  }

  sqlite.exec(`
    UPDATE invoices
    SET amount_paid = grand_total
    WHERE payment_status = 'paid' AND amount_paid = 0 AND grand_total > 0
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_name TEXT NOT NULL,
      date TEXT NOT NULL,
      notes TEXT,
      total_amount REAL NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS purchase_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      cost_price REAL NOT NULL,
      total_cost REAL NOT NULL
    );
  `);
}

export * from "./schema";
