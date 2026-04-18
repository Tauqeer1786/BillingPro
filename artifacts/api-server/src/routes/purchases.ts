import { Router, type IRouter } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { db, purchasesTable, purchaseItemsTable, productsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/purchases", async (req, res): Promise<void> => {
  const page = parseInt(String(req.query.page || "1"));
  const limit = parseInt(String(req.query.limit || "20"));
  const offset = (page - 1) * limit;

  const [purchases, [{ total }]] = await Promise.all([
    db.select().from(purchasesTable)
      .orderBy(desc(purchasesTable.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: sql<number>`count(*)` }).from(purchasesTable),
  ]);

  const purchaseIds = purchases.map(p => p.id);
  let itemsByPurchase: Record<number, typeof purchaseItemsTable.$inferSelect[]> = {};
  if (purchaseIds.length > 0) {
    const allItems = await db.select().from(purchaseItemsTable)
      .where(sql`${purchaseItemsTable.purchaseId} in (${sql.join(purchaseIds.map(id => sql`${id}`), sql`, `)})`);
    for (const item of allItems) {
      if (!itemsByPurchase[item.purchaseId]) itemsByPurchase[item.purchaseId] = [];
      itemsByPurchase[item.purchaseId].push(item);
    }
  }

  res.json({
    purchases: purchases.map(p => ({
      id: p.id,
      supplierName: p.supplierName,
      date: p.date,
      notes: p.notes,
      totalAmount: p.totalAmount,
      itemCount: (itemsByPurchase[p.id] || []).length,
      createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : String(p.createdAt),
    })),
    total: Number(total),
    page,
    limit,
  });
});

router.get("/purchases/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [purchase] = await db.select().from(purchasesTable).where(eq(purchasesTable.id, id));
  if (!purchase) { res.status(404).json({ error: "Purchase not found" }); return; }

  const items = await db.select().from(purchaseItemsTable)
    .where(eq(purchaseItemsTable.purchaseId, id));

  res.json({
    ...purchase,
    createdAt: purchase.createdAt instanceof Date ? purchase.createdAt.toISOString() : String(purchase.createdAt),
    items: items.map(i => ({
      id: i.id,
      productId: i.productId,
      productName: i.productName,
      quantity: i.quantity,
      costPrice: i.costPrice,
      totalCost: i.totalCost,
    })),
  });
});

router.post("/purchases", async (req, res): Promise<void> => {
  const { supplierName, date, notes, items } = req.body as {
    supplierName: string;
    date: string;
    notes?: string;
    items: Array<{
      productId?: number;
      productName: string;
      quantity: number;
      costPrice: number;
    }>;
  };

  if (!supplierName || !date || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "supplierName, date, and items are required" });
    return;
  }

  const filledItems = items.filter(i => i.productName && i.quantity > 0 && i.costPrice >= 0);
  if (filledItems.length === 0) {
    res.status(400).json({ error: "At least one valid item is required" });
    return;
  }

  const totalAmount = filledItems.reduce((sum, i) => sum + i.quantity * i.costPrice, 0);

  const [purchase] = await db.insert(purchasesTable).values({
    supplierName,
    date,
    notes: notes || null,
    totalAmount,
  }).returning();

  for (const item of filledItems) {
    await db.insert(purchaseItemsTable).values({
      purchaseId: purchase.id,
      productId: item.productId || null,
      productName: item.productName,
      quantity: item.quantity,
      costPrice: item.costPrice,
      totalCost: item.quantity * item.costPrice,
    });

    if (item.productId) {
      await db.update(productsTable)
        .set({ stock: sql`${productsTable.stock} + ${item.quantity}` })
        .where(eq(productsTable.id, item.productId));
    }
  }

  res.status(201).json({
    id: purchase.id,
    supplierName: purchase.supplierName,
    date: purchase.date,
    totalAmount: purchase.totalAmount,
    itemCount: filledItems.length,
  });
});

router.delete("/purchases/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const items = await db.select().from(purchaseItemsTable)
    .where(eq(purchaseItemsTable.purchaseId, id));

  for (const item of items) {
    if (item.productId) {
      await db.update(productsTable)
        .set({ stock: sql`max(0, ${productsTable.stock} - ${item.quantity})` })
        .where(eq(productsTable.id, item.productId));
    }
  }

  await db.delete(purchaseItemsTable).where(eq(purchaseItemsTable.purchaseId, id));
  await db.delete(purchasesTable).where(eq(purchasesTable.id, id));

  res.json({ success: true });
});

export default router;
