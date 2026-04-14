import { Router, type IRouter } from "express";
import { eq, like, sql, desc } from "drizzle-orm";
import { db, customersTable, invoicesTable, invoiceItemsTable } from "@workspace/db";
import {
  ListCustomersQueryParams,
  CreateCustomerBody,
  GetCustomerParams,
  UpdateCustomerParams,
  UpdateCustomerBody,
  DeleteCustomerParams,
  GetCustomerPurchasesParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/customers", async (req, res): Promise<void> => {
  const params = ListCustomersQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { search, page = 1, limit = 50 } = params.data;
  const offset = (page - 1) * limit;

  let query = db.select().from(customersTable);
  let countQuery = db.select({ count: sql<number>`count(*)` }).from(customersTable);

  if (search) {
    const searchCondition = like(customersTable.name, `%${search}%`);
    query = query.where(searchCondition) as typeof query;
    countQuery = countQuery.where(searchCondition) as typeof countQuery;
  }

  const [customers, [{ count: total }]] = await Promise.all([
    query.orderBy(desc(customersTable.createdAt)).limit(limit).offset(offset),
    countQuery,
  ]);

  const customerIds = customers.map(c => c.id);
  let purchaseTotals: Record<number, number> = {};
  if (customerIds.length > 0) {
    const totals = await db.select({
      customerId: invoicesTable.customerId,
      total: sql<number>`coalesce(sum(${invoicesTable.grandTotal}), 0)`,
    }).from(invoicesTable)
      .where(sql`${invoicesTable.customerId} in ${customerIds}`)
      .groupBy(invoicesTable.customerId);
    for (const t of totals) {
      if (t.customerId != null) purchaseTotals[t.customerId] = Number(t.total);
    }
  }

  res.json({
    customers: customers.map(c => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      address: c.address,
      gstin: c.gstin,
      totalPurchases: purchaseTotals[c.id] || 0,
      createdAt: c.createdAt.toISOString(),
    })),
    total: Number(total),
    page,
    limit,
  });
});

router.post("/customers", async (req, res): Promise<void> => {
  const parsed = CreateCustomerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [customer] = await db.insert(customersTable).values(parsed.data).returning();
  res.status(201).json({
    ...customer,
    totalPurchases: 0,
    createdAt: customer.createdAt.toISOString(),
  });
});

router.get("/customers/:id", async (req, res): Promise<void> => {
  const params = GetCustomerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, params.data.id));
  if (!customer) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }

  const invoices = await db.select({
    id: invoicesTable.id,
    invoiceNumber: invoicesTable.invoiceNumber,
    date: invoicesTable.date,
    grandTotal: invoicesTable.grandTotal,
    totalProfit: invoicesTable.totalProfit,
    createdAt: invoicesTable.createdAt,
  }).from(invoicesTable)
    .where(eq(invoicesTable.customerId, params.data.id))
    .orderBy(desc(invoicesTable.createdAt));

  const itemCounts = await db.select({
    invoiceId: invoiceItemsTable.invoiceId,
    count: sql<number>`count(*)`,
  }).from(invoiceItemsTable)
    .where(sql`${invoiceItemsTable.invoiceId} in ${invoices.map(i => i.id).length > 0 ? invoices.map(i => i.id) : [0]}`)
    .groupBy(invoiceItemsTable.invoiceId);

  const countMap: Record<number, number> = {};
  for (const ic of itemCounts) {
    countMap[ic.invoiceId] = Number(ic.count);
  }

  const totalPurchases = invoices.reduce((sum, i) => sum + i.grandTotal, 0);

  res.json({
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    address: customer.address,
    gstin: customer.gstin,
    totalPurchases,
    createdAt: customer.createdAt.toISOString(),
    invoices: invoices.map(i => ({
      id: i.id,
      invoiceNumber: i.invoiceNumber,
      customerName: customer.name,
      date: i.date,
      grandTotal: i.grandTotal,
      totalProfit: i.totalProfit,
      itemCount: countMap[i.id] || 0,
      createdAt: i.createdAt.toISOString(),
    })),
  });
});

router.put("/customers/:id", async (req, res): Promise<void> => {
  const params = UpdateCustomerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateCustomerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [customer] = await db.update(customersTable)
    .set(parsed.data)
    .where(eq(customersTable.id, params.data.id))
    .returning();

  if (!customer) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }

  res.json({
    ...customer,
    totalPurchases: 0,
    createdAt: customer.createdAt.toISOString(),
  });
});

router.delete("/customers/:id", async (req, res): Promise<void> => {
  const params = DeleteCustomerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [customer] = await db.delete(customersTable)
    .where(eq(customersTable.id, params.data.id))
    .returning();

  if (!customer) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }

  res.json({ success: true, message: "Customer deleted" });
});

router.get("/customers/:id/purchases", async (req, res): Promise<void> => {
  const params = GetCustomerPurchasesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const invoices = await db.select({
    id: invoicesTable.id,
    invoiceNumber: invoicesTable.invoiceNumber,
    date: invoicesTable.date,
    grandTotal: invoicesTable.grandTotal,
    totalProfit: invoicesTable.totalProfit,
    createdAt: invoicesTable.createdAt,
  }).from(invoicesTable)
    .where(eq(invoicesTable.customerId, params.data.id))
    .orderBy(desc(invoicesTable.createdAt));

  const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, params.data.id));

  res.json(invoices.map(i => ({
    id: i.id,
    invoiceNumber: i.invoiceNumber,
    customerName: customer?.name || "",
    date: i.date,
    grandTotal: i.grandTotal,
    totalProfit: i.totalProfit,
    itemCount: 0,
    createdAt: i.createdAt.toISOString(),
  })));
});

export default router;
