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
    await db.delete(invoiceItemsTable);
    await db.delete(invoicesTable);
    await db.delete(customersTable);
    await db.delete(productsTable);

    let productsCount = 0;
    let customersCount = 0;
    let invoicesCount = 0;

    if (data.products?.length > 0) {
      for (const p of data.products) {
        await db.insert(productsTable).values({
          name: p.name,
          costPrice: p.costPrice,
          marginPercent: p.marginPercent,
          sellingPrice: p.sellingPrice,
          gstPercent: p.gstPercent,
          stock: p.stock,
          hsn: p.hsn || null,
          unit: p.unit || "pcs",
        });
        productsCount++;
      }
    }

    if (data.customers?.length > 0) {
      for (const c of data.customers) {
        await db.insert(customersTable).values({
          name: c.name,
          phone: c.phone || null,
          email: c.email || null,
          address: c.address || null,
          gstin: c.gstin || null,
        });
        customersCount++;
      }
    }

    if (data.invoices?.length > 0) {
      for (const inv of data.invoices) {
        await db.insert(invoicesTable).values({
          invoiceNumber: inv.invoiceNumber,
          customerId: inv.customerId || null,
          date: inv.date,
          subtotal: inv.subtotal,
          totalGst: inv.totalGst,
          totalDiscount: inv.totalDiscount,
          grandTotal: inv.grandTotal,
          totalProfit: inv.totalProfit || 0,
          notes: inv.notes || null,
        });
        invoicesCount++;
      }
    }

    if (data.invoiceItems?.length > 0) {
      for (const item of data.invoiceItems) {
        await db.insert(invoiceItemsTable).values({
          invoiceId: item.invoiceId ?? item.id,
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
        });
      }
    }

    res.json({
      success: true,
      message: "Database imported successfully",
      imported: {
        products: productsCount,
        customers: customersCount,
        invoices: invoicesCount,
      },
    });
  } catch (error) {
    req.log.error({ error }, "Import failed");
    res.status(500).json({ success: false, message: "Import failed" });
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
