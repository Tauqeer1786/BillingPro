import { Router, type IRouter } from "express";
import { eq, desc, sql, and, gte, lte } from "drizzle-orm";
import { db, invoicesTable, invoiceItemsTable, productsTable, customersTable } from "@workspace/db";
import {
  ListInvoicesQueryParams,
  CreateInvoiceBody,
  GetInvoiceParams,
  DeleteInvoiceParams,
  UpdateInvoiceStatusBody,
  UpdateInvoiceStatusParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

export function formatInvoiceNumber(num: number): string {
  return String(num).padStart(3, "0");
}

async function generateInvoiceNumber(): Promise<string> {
  let candidate: string;
  let attempts = 0;

  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(invoicesTable);
  let nextNum = Number(count) + 1;

  while (true) {
    candidate = formatInvoiceNumber(nextNum);
    const existing = await db
      .select({ id: invoicesTable.id })
      .from(invoicesTable)
      .where(eq(invoicesTable.invoiceNumber, candidate))
      .limit(1);
    if (existing.length === 0) break;
    nextNum++;
    if (++attempts > 1000) throw new Error("Could not generate unique invoice number");
  }

  return candidate;
}

router.get("/invoices", async (req, res): Promise<void> => {
  const params = ListInvoicesQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { customerId, startDate, endDate, status, page = 1, limit = 50 } = params.data;
  const offset = (page - 1) * limit;

  const conditions = [];
  if (customerId) conditions.push(eq(invoicesTable.customerId, customerId));
  if (startDate) conditions.push(gte(invoicesTable.date, startDate));
  if (endDate) conditions.push(lte(invoicesTable.date, endDate));
  if (status) conditions.push(eq(invoicesTable.paymentStatus, status));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const outstandingConditions = [...conditions.filter(condition => condition !== undefined), eq(invoicesTable.paymentStatus, "unpaid" as const)];
  const outstandingWhereClause = outstandingConditions.length > 0 ? and(...outstandingConditions) : undefined;

  const [invoices, [{ count: total }], [outstanding]] = await Promise.all([
    db.select({
      id: invoicesTable.id,
      invoiceNumber: invoicesTable.invoiceNumber,
      customerId: invoicesTable.customerId,
      date: invoicesTable.date,
      paymentStatus: invoicesTable.paymentStatus,
      paymentMode: invoicesTable.paymentMode,
      grandTotal: invoicesTable.grandTotal,
      totalProfit: invoicesTable.totalProfit,
      createdAt: invoicesTable.createdAt,
    }).from(invoicesTable)
      .where(whereClause)
      .orderBy(desc(invoicesTable.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(invoicesTable).where(whereClause),
    db.select({ total: sql<number>`coalesce(sum(${invoicesTable.grandTotal}), 0)` }).from(invoicesTable).where(outstandingWhereClause),
  ]);

  const invoiceIds = invoices.map(i => i.id);
  let itemCounts: Record<number, number> = {};
  if (invoiceIds.length > 0) {
    const counts = await db.select({
      invoiceId: invoiceItemsTable.invoiceId,
      count: sql<number>`count(*)`,
    }).from(invoiceItemsTable)
      .where(sql`${invoiceItemsTable.invoiceId} in ${invoiceIds}`)
      .groupBy(invoiceItemsTable.invoiceId);
    for (const c of counts) {
      itemCounts[c.invoiceId] = Number(c.count);
    }
  }

  const customerIds = [...new Set(invoices.filter(i => i.customerId).map(i => i.customerId!))];
  let customerNames: Record<number, string> = {};
  if (customerIds.length > 0) {
    const customers = await db.select({ id: customersTable.id, name: customersTable.name })
      .from(customersTable)
      .where(sql`${customersTable.id} in ${customerIds}`);
    for (const c of customers) {
      customerNames[c.id] = c.name;
    }
  }

  res.json({
    invoices: invoices.map(i => ({
      id: i.id,
      invoiceNumber: i.invoiceNumber,
      customerName: i.customerId ? customerNames[i.customerId] || "" : "",
      date: i.date,
      paymentStatus: i.paymentStatus,
      paymentMode: i.paymentMode,
      grandTotal: i.grandTotal,
      outstandingAmount: Math.max(0, i.grandTotal - (i.amountPaid || 0)),
      amountPaid: i.amountPaid || 0,
      totalProfit: i.totalProfit,
      itemCount: itemCounts[i.id] || 0,
      createdAt: i.createdAt.toISOString(),
    })),
    total: Number(total),
    outstandingTotal: Number(outstanding.total),
    page,
    limit,
  });
});

router.post("/invoices", async (req, res): Promise<void> => {
  const parsed = CreateInvoiceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { customerId, date, items, notes, overallDiscountPercent = 0, paymentMode = "credit", amountPaid = 0 } = parsed.data;

  const productIds = items.map(i => i.productId);
  const products = await db.select().from(productsTable)
    .where(sql`${productsTable.id} in ${productIds}`);

  const productMap: Record<number, typeof products[0]> = {};
  for (const p of products) {
    productMap[p.id] = p;
  }

  const invoiceNumber = await generateInvoiceNumber();

  let subtotal = 0;
  let totalGst = 0;
  let totalDiscount = 0;
  let totalProfit = 0;

  const processedItems = items.map(item => {
    const product = productMap[item.productId];
    if (!product) throw new Error(`Product ${item.productId} not found`);

    const itemDiscountPercent = item.discountPercent || 0;
    const baseAmount = item.unitPrice * item.quantity;
    const discountAmount = baseAmount * (itemDiscountPercent / 100);
    const afterDiscount = baseAmount - discountAmount;
    const gstAmount = afterDiscount * (product.gstPercent / 100);
    const totalAmount = afterDiscount + gstAmount;
    const profit = (item.unitPrice - product.costPrice) * item.quantity - discountAmount;

    subtotal += afterDiscount;
    totalGst += gstAmount;
    totalDiscount += discountAmount;
    totalProfit += profit;

    return {
      productId: item.productId,
      productName: product.name,
      quantity: item.quantity,
      unitPrice: Math.round(item.unitPrice * 100) / 100,
      costPrice: product.costPrice,
      gstPercent: product.gstPercent,
      gstAmount: Math.round(gstAmount * 100) / 100,
      discountPercent: itemDiscountPercent,
      discountAmount: Math.round(discountAmount * 100) / 100,
      totalAmount: Math.round(totalAmount * 100) / 100,
      profit: Math.round(profit * 100) / 100,
    };
  });

  if (overallDiscountPercent > 0) {
    const overallDiscount = subtotal * (overallDiscountPercent / 100);
    totalDiscount += overallDiscount;
    subtotal -= overallDiscount;
    totalGst = subtotal * (processedItems.reduce((sum, i) => sum + i.gstPercent * i.quantity, 0) / processedItems.reduce((sum, i) => sum + i.quantity, 0)) / 100;
  }

  const grandTotal = subtotal + totalGst;

  const roundedGrandTotal = Math.round(grandTotal * 100) / 100;
  const roundedAmountPaid = Math.min(Math.round((amountPaid || 0) * 100) / 100, roundedGrandTotal);
  const autoPaymentStatus: "paid" | "unpaid" = roundedAmountPaid >= roundedGrandTotal ? "paid" : "unpaid";

  const [invoice] = await db.insert(invoicesTable).values({
    invoiceNumber,
    customerId: customerId || null,
    date,
    paymentMode: paymentMode as "cash" | "credit",
    paymentStatus: autoPaymentStatus,
    subtotal: Math.round(subtotal * 100) / 100,
    totalGst: Math.round(totalGst * 100) / 100,
    totalDiscount: Math.round(totalDiscount * 100) / 100,
    grandTotal: roundedGrandTotal,
    amountPaid: roundedAmountPaid,
    totalProfit: Math.round(totalProfit * 100) / 100,
    notes: notes || null,
  }).returning();

  const insertedItems = await db.insert(invoiceItemsTable).values(
    processedItems.map(item => ({
      ...item,
      invoiceId: invoice.id,
    }))
  ).returning();

  for (const item of processedItems) {
    await db.update(productsTable)
      .set({ stock: sql`${productsTable.stock} - ${item.quantity}` })
      .where(eq(productsTable.id, item.productId));
  }

  let customerName = "";
  if (customerId) {
    const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, customerId));
    if (customer) customerName = customer.name;
  }

  res.status(201).json({
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    customerId: invoice.customerId,
    customerName,
    date: invoice.date,
    paymentStatus: invoice.paymentStatus,
    paymentMode: invoice.paymentMode,
    items: insertedItems.map(i => ({
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
    subtotal: invoice.subtotal,
    totalGst: invoice.totalGst,
    totalDiscount: invoice.totalDiscount,
    grandTotal: invoice.grandTotal,
    amountPaid: invoice.amountPaid || 0,
    outstandingAmount: Math.max(0, invoice.grandTotal - (invoice.amountPaid || 0)),
    totalProfit: invoice.totalProfit,
    notes: invoice.notes,
    createdAt: invoice.createdAt.toISOString(),
  });
});

router.get("/invoices/:id", async (req, res): Promise<void> => {
  const params = GetInvoiceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [invoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, params.data.id));
  if (!invoice) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }

  const items = await db.select().from(invoiceItemsTable).where(eq(invoiceItemsTable.invoiceId, invoice.id));

  let customerName = "";
  let customerPhone: string | null = null;
  let customerEmail: string | null = null;
  let customerAddress: string | null = null;
  let customerGstin: string | null = null;
  if (invoice.customerId) {
    const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, invoice.customerId));
    if (customer) {
      customerName = customer.name;
      customerPhone = customer.phone || null;
      customerEmail = customer.email || null;
      customerAddress = customer.address || null;
      customerGstin = customer.gstin || null;
    }
  }

  res.json({
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    customerId: invoice.customerId,
    customerName,
    customerPhone,
    customerEmail,
    customerAddress,
    customerGstin,
    date: invoice.date,
    paymentStatus: invoice.paymentStatus,
    paymentMode: invoice.paymentMode,
    items: items.map(i => ({
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
    subtotal: invoice.subtotal,
    totalGst: invoice.totalGst,
    totalDiscount: invoice.totalDiscount,
    grandTotal: invoice.grandTotal,
    amountPaid: invoice.amountPaid || 0,
    outstandingAmount: Math.max(0, invoice.grandTotal - (invoice.amountPaid || 0)),
    totalProfit: invoice.totalProfit,
    notes: invoice.notes,
    createdAt: invoice.createdAt.toISOString(),
  });
});

router.patch("/invoices/:id/status", async (req, res): Promise<void> => {
  const params = UpdateInvoiceStatusParams.safeParse(req.params);
  const parsed = UpdateInvoiceStatusBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [invoice] = await db.update(invoicesTable)
    .set({ paymentStatus: parsed.data.paymentStatus })
    .where(eq(invoicesTable.id, params.data.id))
    .returning();

  if (!invoice) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }

  res.json({
    id: invoice.id,
    paymentStatus: invoice.paymentStatus,
    amountPaid: invoice.amountPaid || 0,
    outstandingAmount: Math.max(0, invoice.grandTotal - (invoice.amountPaid || 0)),
  });
});

router.delete("/invoices/:id", async (req, res): Promise<void> => {
  const params = DeleteInvoiceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const items = await db.select().from(invoiceItemsTable).where(eq(invoiceItemsTable.invoiceId, params.data.id));
  for (const item of items) {
    await db.update(productsTable)
      .set({ stock: sql`${productsTable.stock} + ${item.quantity}` })
      .where(eq(productsTable.id, item.productId));
  }

  const [invoice] = await db.delete(invoicesTable)
    .where(eq(invoicesTable.id, params.data.id))
    .returning();

  if (!invoice) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }

  res.json({ success: true, message: "Invoice deleted" });
});

export default router;
