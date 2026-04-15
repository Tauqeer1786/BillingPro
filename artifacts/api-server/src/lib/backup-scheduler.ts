import path from "path";
import { mkdir, writeFile, readdir, unlink, stat } from "fs/promises";
import { db, productsTable, customersTable, invoicesTable, invoiceItemsTable, DB_PATH } from "@workspace/db";
import { asc } from "drizzle-orm";
import { logger } from "./logger";

const BACKUP_DIR = process.env.BACKUP_DIR || path.join(path.dirname(DB_PATH), "backups");
const BACKUP_INTERVAL_HOURS = Number(process.env.BACKUP_INTERVAL_HOURS ?? 24);
const BACKUP_MAX_COUNT = Number(process.env.BACKUP_MAX_COUNT ?? 10);

export { BACKUP_DIR };

export async function ensureBackupDir(): Promise<void> {
  await mkdir(BACKUP_DIR, { recursive: true });
}

export async function performBackup(): Promise<string> {
  await ensureBackupDir();

  const [products, customers, invoices, invoiceItems] = await Promise.all([
    db.select().from(productsTable).orderBy(asc(productsTable.id)),
    db.select().from(customersTable).orderBy(asc(customersTable.id)),
    db.select().from(invoicesTable).orderBy(asc(invoicesTable.id)),
    db.select().from(invoiceItemsTable).orderBy(asc(invoiceItemsTable.id)),
  ]);

  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `backup-${timestamp}.json`;
  const filepath = path.join(BACKUP_DIR, filename);

  const payload = {
    version: "1.0",
    exportedAt: now.toISOString(),
    autoBackup: true,
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
      createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : String(c.createdAt),
    })),
    invoices: invoices.map(i => ({
      id: i.id,
      invoiceNumber: i.invoiceNumber,
      customerId: i.customerId,
      date: i.date,
      paymentStatus: i.paymentStatus,
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
  };

  await writeFile(filepath, JSON.stringify(payload, null, 2), "utf-8");

  await pruneOldBackups();

  logger.info({ filename, products: products.length, customers: customers.length, invoices: invoices.length }, "Auto-backup created");

  return filename;
}

async function pruneOldBackups(): Promise<void> {
  try {
    const files = await readdir(BACKUP_DIR);
    const backupFiles = files.filter(f => f.startsWith("backup-") && f.endsWith(".json"));

    if (backupFiles.length <= BACKUP_MAX_COUNT) return;

    const filesWithStats = await Promise.all(
      backupFiles.map(async f => {
        const s = await stat(path.join(BACKUP_DIR, f));
        return { name: f, mtime: s.mtime };
      })
    );

    filesWithStats.sort((a, b) => a.mtime.getTime() - b.mtime.getTime());

    const toDelete = filesWithStats.slice(0, filesWithStats.length - BACKUP_MAX_COUNT);
    for (const f of toDelete) {
      await unlink(path.join(BACKUP_DIR, f.name));
      logger.info({ filename: f.name }, "Pruned old auto-backup");
    }
  } catch (err) {
    logger.warn({ err }, "Failed to prune old backups");
  }
}

export async function listBackups(): Promise<Array<{ filename: string; createdAt: string; sizeBytes: number }>> {
  try {
    await ensureBackupDir();
    const files = await readdir(BACKUP_DIR);
    const backupFiles = files.filter(f => f.startsWith("backup-") && f.endsWith(".json"));

    const filesWithStats = await Promise.all(
      backupFiles.map(async f => {
        const s = await stat(path.join(BACKUP_DIR, f));
        return { filename: f, createdAt: s.mtime.toISOString(), sizeBytes: s.size };
      })
    );

    return filesWithStats.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

let schedulerTimer: ReturnType<typeof setInterval> | null = null;

export function startBackupScheduler(): void {
  if (BACKUP_INTERVAL_HOURS <= 0) {
    logger.info("Auto-backup scheduler disabled (BACKUP_INTERVAL_HOURS=0)");
    return;
  }

  const intervalMs = BACKUP_INTERVAL_HOURS * 60 * 60 * 1000;

  performBackup().catch(err => logger.warn({ err }, "Initial auto-backup failed"));

  schedulerTimer = setInterval(() => {
    performBackup().catch(err => logger.error({ err }, "Scheduled auto-backup failed"));
  }, intervalMs);

  logger.info({ intervalHours: BACKUP_INTERVAL_HOURS, maxBackups: BACKUP_MAX_COUNT, backupDir: BACKUP_DIR }, "Auto-backup scheduler started");
}

export function stopBackupScheduler(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}
