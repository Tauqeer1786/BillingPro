# BillingPro - Offline Billing Application

## Overview

A professional billing web application for small businesses and shops in India. Features product management, invoicing with GST, customer tracking, profit analytics, financial year reports, and data backup/restore.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui + Recharts
- **API framework**: Express 5
- **Database**: SQLite (`better-sqlite3`) + Drizzle ORM — stored locally at `billing.db` in the workspace root
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Authentication & RBAC

The app has a full Role-Based Access Control (RBAC) system with JWT authentication.

### Roles
- **Master** (Super Admin): Full control — manages users, business settings (with lock), all reports, all data
- **Admin**: Can update phone, address, email; reset salesman passwords; assign salesman permissions
- **Salesman**: Restricted — only what their Admin has allowed (billing, reports, inventory, edit invoices)

### Default Credentials
- Username: `master` / Password: `master123` (created automatically on first launch)

### Key Auth Details
- JWT tokens stored in `localStorage`, attached via `setAuthTokenGetter` in api-client-react
- Token expiry: 7 days
- Passwords hashed with bcrypt (10 rounds)
- Business settings now DB-backed (was localStorage) — stored in `business_settings` table
- Master can lock/unlock all business settings
- Backend enforces permissions at API route level; frontend hides inaccessible UI

### New Tables
- **users**: id, username, password_hash, role, is_active, created_at, created_by
- **salesman_permissions**: per-user flags (can_bill, can_view_reports, can_edit_invoices, can_access_inventory)
- **business_settings**: key-value store for all business profile fields

### New Routes
- `POST /api/auth/login` — login (public)
- `GET /api/auth/me` — get current user
- `POST /api/auth/change-password` — change own or target user's password
- `GET/POST/PUT /api/users` — user management (master/admin)
- `DELETE /api/users/:id` — delete user (master only)
- `GET/PUT /api/business-settings` — business settings CRUD
- `POST /api/business-settings/toggle-lock` — lock/unlock settings (master only)

## Key Features

- **Dashboard**: Total sales, profit, GST, top products/customers, monthly sales chart, recent transactions
- **Product Management**: Add/edit/delete with auto-calculated selling price (cost + margin), GST %, stock tracking
- **Customer Management**: Party records with GSTIN, purchase history tracking
- **Invoicing**: Multi-item invoices, smart product autocomplete with internal-only stock visibility while creating invoices, Enter-to-add-next-row fast entry, auto GST calculation, per-item and overall discounts, dynamic pricing with manual override, paid/unpaid status tracking with outstanding due amounts, Cash/Credit payment mode selection, compact A4/A5 print sizing for 15+ invoice items, direct PDF download, and separate print action
- **Invoice Numbering**: Sequential 3/4-digit format (001, 025, 125, 1000) with zero-padding for numbers under 100. Numbers stored as formatted strings; unique and auto-incrementing.
- **Reports**: Sales (daily/monthly/yearly), GST report by financial year (CGST/SGST/IGST), profit tracking with show/hide toggle, product-wise and customer-wise reports, Sales Register (Cash/Credit) with date range filter, totals breakdown, and print support
- **Purchase Management**: Record stock-in from suppliers with supplier name, date, notes, and multi-item purchase entries. Select from existing inventory products to auto-link and increment stock, or enter custom product names manually. Purchase history list with split-panel detail view. Delete reverses stock.
- **Bulk Inventory Adder**: Excel-style table to add up to 100+ products at once. Columns: Product Name, Qty, Cost Price, Selling Price, GST%, HSN Code, Unit. Tab/Enter key navigation between cells, dynamic row addition, validation before submit, and success screen.
- **Settings**: Business profile, invoice print page size (A4/A5), financial year start month (1-12, default April), database backup (JSON export), and restore (JSON import)
- **Financial Year**: Configurable start month tracked across dashboard and all report views with FY year selector on Dashboard

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Database Schema

- **products**: id, name, cost_price, margin_percent, selling_price, gst_percent, stock, hsn, unit
- **customers**: id, name, phone, email, address, gstin
- **invoices**: id, invoice_number (3/4-digit padded format), customer_id, date, payment_status, payment_mode (cash/credit), subtotal, total_gst, total_discount, grand_total, total_profit, notes
- **invoice_items**: id, invoice_id, product_id, product_name, quantity, unit_price, cost_price, gst_percent, gst_amount, discount_percent, discount_amount, total_amount, profit

## Project Structure

- `artifacts/billing-app/` — React + Vite frontend (served at `/`)
- `artifacts/api-server/` — Express API server (served at `/api`)
- `lib/api-spec/` — OpenAPI specification
- `lib/api-client-react/` — Generated React Query hooks
- `lib/api-zod/` — Generated Zod validation schemas
- `lib/db/` — Drizzle ORM schema and database connection

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
