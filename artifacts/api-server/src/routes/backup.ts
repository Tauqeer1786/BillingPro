import { Router, type IRouter } from "express";
import { db, productsTable, customersTable, invoicesTable, invoiceItemsTable } from "@workspace/db";
import { sql, asc } from "drizzle-orm";
import path from "path";
import { readFile, unlink } from "fs/promises";
import { performBackup, listBackups, BACKUP_DIR } from "../lib/backup-scheduler";

const router: IRouter = Router();

router.get("/backup/export", async (_req, res): Promise<void> => {
  const [products, customers, invoices, invoiceItems] = await Promise.all([
    db.select().from(productsTable).orderBy(asc(productsTable.id)),
    db.select().from(customersTable).orderBy(asc(customersTable.id)),
    db.select().from(invoicesTable).orderBy(asc(invoicesTable.id)),
    db.select().from(invoiceItemsTable).orderBy(asc(invoiceItemsTable.id)),
  ]);

  res.json({
    version: "1.0",
    exportedAt: new Date().toISOString(),
    products: products.map(p => ({
      id: p.id,
      name: p.name,
      costPrice: p.costPrice,
      marginPercent: p.marginPercent,
      sellingPrice: p.sellingPrice,
      gstPercent: p.gstPercent,
      stock: p.stock,
      hsn: p.hsn,
      unit: p.unit,
      createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : String(p.createdAt),
    })),
    customers: customers.map(c => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      address: c.address,
      gstin: c.gstin,
      totalPurchases: 0,
      createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : String(c.createdAt),
    })),
    invoices: invoices.map(i => ({
      id: i.id,
      invoiceNumber: i.invoiceNumber,
      customerId: i.customerId,
      customerName: "",
      date: i.date,
      paymentStatus: i.paymentStatus,
      items: [],
      subtotal: i.subtotal,
      totalGst: i.totalGst,
      totalDiscount: i.totalDiscount,
      grandTotal: i.grandTotal,
      totalProfit: i.totalProfit,
      notes: i.notes,
      createdAt: i.createdAt instanceof Date ? i.createdAt.toISOString() : String(i.createdAt),
    })),
    invoiceItems: invoiceItems.map(i => ({
      id: i.id,
      invoiceId: i.invoiceId,
      productId: i.productId,
      productName: i.productName,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      costPrice: i.costPrice,
      gstPercent: i.gstPercent,
      gstAmount: i.gstAmount,
      discountPercent: i.discountPercent,
      discountAmount: i.discountAmount,
      totalAmount: i.totalAmount,
      profit: i.profit,
    })),
  });
});

router.post("/backup/import", async (req, res): Promise<void> => {
  const data = req.body;
  if (!data || !data.version) {
    res.status(400).json({ success: false, message: "Invalid backup file" });
    return;
  }

  try {
    db.transaction((tx) => {
      tx.delete(invoiceItemsTable).run();
      tx.delete(invoicesTable).run();
      tx.delete(customersTable).run();
      tx.delete(productsTable).run();

      if (data.products?.length > 0) {
        for (const p of data.products) {
          tx.insert(productsTable).values({
            id: p.id,
            name: p.name,
            costPrice: p.costPrice,
            marginPercent: p.marginPercent,
            sellingPrice: p.sellingPrice,
            gstPercent: p.gstPercent,
            stock: p.stock ?? 0,
            hsn: p.hsn || null,
            unit: p.unit || "pcs",
          } as typeof productsTable.$inferInsert).run();
        }
      }

      if (data.customers?.length > 0) {
        for (const c of data.customers) {
          tx.insert(customersTable).values({
            id: c.id,
            name: c.name,
            phone: c.phone || null,
            email: c.email || null,
            address: c.address || null,
            gstin: c.gstin || null,
          } as typeof customersTable.$inferInsert).run();
        }
      }

      if (data.invoices?.length > 0) {
        for (const inv of data.invoices) {
          tx.insert(invoicesTable).values({
            id: inv.id,
            invoiceNumber: inv.invoiceNumber,
            customerId: inv.customerId || null,
            date: inv.date,
            paymentStatus: inv.paymentStatus === "paid" ? "paid" : "unpaid",
            subtotal: inv.subtotal,
            totalGst: inv.totalGst,
            totalDiscount: inv.totalDiscount,
            grandTotal: inv.grandTotal,
            totalProfit: inv.totalProfit || 0,
            notes: inv.notes || null,
          } as typeof invoicesTable.$inferInsert).run();
        }
      }

      if (data.invoiceItems?.length > 0) {
        for (const item of data.invoiceItems) {
          tx.insert(invoiceItemsTable).values({
            id: item.id,
            invoiceId: item.invoiceId,
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            costPrice: item.costPrice || 0,
            gstPercent: item.gstPercent,
            gstAmount: item.gstAmount,
            discountPercent: item.discountPercent || 0,
            discountAmount: item.discountAmount || 0,
            totalAmount: item.totalAmount,
            profit: item.profit || 0,
          } as typeof invoiceItemsTable.$inferInsert).run();
        }
      }
    });

    const maxProductId = data.products?.length > 0 ? Math.max(...data.products.map((p: any) => p.id ?? 0)) : 0;
    const maxCustomerId = data.customers?.length > 0 ? Math.max(...data.customers.map((c: any) => c.id ?? 0)) : 0;
    const maxInvoiceId = data.invoices?.length > 0 ? Math.max(...data.invoices.map((i: any) => i.id ?? 0)) : 0;
    const maxInvoiceItemId = data.invoiceItems?.length > 0 ? Math.max(...data.invoiceItems.map((i: any) => i.id ?? 0)) : 0;

    if (maxProductId > 0) db.run(sql`INSERT OR REPLACE INTO sqlite_sequence(name, seq) VALUES('products', ${maxProductId})`);
    if (maxCustomerId > 0) db.run(sql`INSERT OR REPLACE INTO sqlite_sequence(name, seq) VALUES('customers', ${maxCustomerId})`);
    if (maxInvoiceId > 0) db.run(sql`INSERT OR REPLACE INTO sqlite_sequence(name, seq) VALUES('invoices', ${maxInvoiceId})`);
    if (maxInvoiceItemId > 0) db.run(sql`INSERT OR REPLACE INTO sqlite_sequence(name, seq) VALUES('invoice_items', ${maxInvoiceItemId})`);

    res.json({
      success: true,
      message: "Database imported successfully",
      imported: {
        products: data.products?.length ?? 0,
        customers: data.customers?.length ?? 0,
        invoices: data.invoices?.length ?? 0,
        invoiceItems: data.invoiceItems?.length ?? 0,
      },
    });
  } catch (error) {
    req.log.error({ error }, "Import failed");
    res.status(500).json({ success: false, message: "Import failed", error: String(error) });
  }
});

router.get("/backup/auto-backups", async (_req, res): Promise<void> => {
  const backups = await listBackups();
  res.json({
    backups,
    backupDir: BACKUP_DIR,
  });
});

router.post("/backup/auto-backups/trigger", async (_req, res): Promise<void> => {
  try {
    const filename = await performBackup();
    res.json({ success: true, filename, message: "Backup created successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Backup failed" });
  }
});

router.get("/backup/auto-backups/:filename", async (req, res): Promise<void> => {
  const { filename } = req.params;
  if (!filename.startsWith("backup-") || !filename.endsWith(".json") || filename.includes("..")) {
    res.status(400).json({ error: "Invalid filename" });
    return;
  }

  try {
    const filepath = path.join(BACKUP_DIR, filename);
    const content = await readFile(filepath, "utf-8");
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(content);
  } catch {
    res.status(404).json({ error: "Backup file not found" });
  }
});

router.delete("/backup/auto-backups/:filename", async (req, res): Promise<void> => {
  const { filename } = req.params;
  if (!filename.startsWith("backup-") || !filename.endsWith(".json") || filename.includes("..")) {
    res.status(400).json({ error: "Invalid filename" });
    return;
  }

  try {
    const filepath = path.join(BACKUP_DIR, filename);
    await unlink(filepath);
    res.json({ success: true, message: "Backup deleted" });
  } catch {
    res.status(404).json({ error: "Backup file not found" });
  }
});

export default router;
