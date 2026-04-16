import { Router, type IRouter } from "express";
import { sql, and, gte, lte, eq } from "drizzle-orm";
import { db, invoicesTable, invoiceItemsTable, customersTable } from "@workspace/db";
import {
  GetSalesReportQueryParams,
  GetGstReportQueryParams,
  GetProfitReportQueryParams,
  GetProductWiseReportQueryParams,
  GetCustomerWiseReportQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

function getFinancialYearDates(fy: string): { startDate: string; endDate: string } {
  const [startYear] = fy.split("-").map(Number);
  return {
    startDate: `${startYear}-04-01`,
    endDate: `${startYear + 1}-03-31`,
  };
}

router.get("/reports/sales", async (req, res): Promise<void> => {
  const params = GetSalesReportQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { startDate, endDate, groupBy = "monthly" } = params.data;
  const condition = and(gte(invoicesTable.date, startDate), lte(invoicesTable.date, endDate));

  let periodExpr: ReturnType<typeof sql>;
  let orderExpr: ReturnType<typeof sql>;
  if (groupBy === "daily") {
    periodExpr = sql`${invoicesTable.date}`;
    orderExpr = sql`${invoicesTable.date}`;
  } else if (groupBy === "yearly") {
    periodExpr = sql`strftime('%Y', ${invoicesTable.date})`;
    orderExpr = sql`strftime('%Y', ${invoicesTable.date})`;
  } else {
    periodExpr = sql`strftime('%Y-%m', ${invoicesTable.date})`;
    orderExpr = sql`strftime('%Y-%m', ${invoicesTable.date})`;
  }

  const results = await db.select({
    period: periodExpr.as("period"),
    sales: sql<number>`sum(${invoicesTable.grandTotal})`,
    gst: sql<number>`sum(${invoicesTable.totalGst})`,
    profit: sql<number>`sum(${invoicesTable.totalProfit})`,
    invoiceCount: sql<number>`count(*)`,
  }).from(invoicesTable)
    .where(condition)
    .groupBy(periodExpr)
    .orderBy(orderExpr);

  const [totals] = await db.select({
    totalSales: sql<number>`coalesce(sum(${invoicesTable.grandTotal}), 0)`,
    totalGst: sql<number>`coalesce(sum(${invoicesTable.totalGst}), 0)`,
    totalProfit: sql<number>`coalesce(sum(${invoicesTable.totalProfit}), 0)`,
  }).from(invoicesTable).where(condition);

  res.json({
    entries: results.map(r => ({
      period: String(r.period),
      sales: Number(r.sales),
      gst: Number(r.gst),
      profit: Number(r.profit),
      invoiceCount: Number(r.invoiceCount),
    })),
    totalSales: Number(totals.totalSales),
    totalGst: Number(totals.totalGst),
    totalProfit: Number(totals.totalProfit),
  });
});

router.get("/reports/gst", async (req, res): Promise<void> => {
  const params = GetGstReportQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { startDate, endDate } = getFinancialYearDates(params.data.financialYear);
  const condition = and(gte(invoicesTable.date, startDate), lte(invoicesTable.date, endDate));

  const results = await db.select({
    month: sql<number>`CAST(strftime('%m', ${invoicesTable.date}) AS INTEGER)`,
    totalGst: sql<number>`sum(${invoicesTable.totalGst})`,
    taxableAmount: sql<number>`sum(${invoicesTable.subtotal})`,
  }).from(invoicesTable)
    .where(condition)
    .groupBy(sql`strftime('%m', ${invoicesTable.date})`)
    .orderBy(sql`strftime('%m', ${invoicesTable.date})`);

  const [totals] = await db.select({
    totalGst: sql<number>`coalesce(sum(${invoicesTable.totalGst}), 0)`,
  }).from(invoicesTable).where(condition);

  const totalGst = Number(totals.totalGst);

  res.json({
    entries: results.map(r => {
      const gst = Number(r.totalGst);
      const cgst = gst / 2;
      const sgst = gst / 2;
      return {
        month: Number(r.month),
        monthName: MONTH_NAMES[Number(r.month) - 1],
        cgst: Math.round(cgst * 100) / 100,
        sgst: Math.round(sgst * 100) / 100,
        igst: 0,
        totalGst: Math.round(gst * 100) / 100,
        taxableAmount: Number(r.taxableAmount),
      };
    }),
    totalCgst: Math.round(totalGst / 2 * 100) / 100,
    totalSgst: Math.round(totalGst / 2 * 100) / 100,
    totalIgst: 0,
    totalGst: Math.round(totalGst * 100) / 100,
    financialYear: params.data.financialYear,
  });
});

router.get("/reports/profit", async (req, res): Promise<void> => {
  const params = GetProfitReportQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { startDate, endDate, groupBy = "monthly" } = params.data;
  const condition = and(gte(invoicesTable.date, startDate), lte(invoicesTable.date, endDate));

  let periodExpr: ReturnType<typeof sql>;
  if (groupBy === "daily") {
    periodExpr = sql`${invoicesTable.date}`;
  } else if (groupBy === "yearly") {
    periodExpr = sql`strftime('%Y', ${invoicesTable.date})`;
  } else {
    periodExpr = sql`strftime('%Y-%m', ${invoicesTable.date})`;
  }

  const results = await db.select({
    period: periodExpr.as("period"),
    revenue: sql<number>`sum(${invoicesTable.grandTotal})`,
    profit: sql<number>`sum(${invoicesTable.totalProfit})`,
  }).from(invoicesTable)
    .where(condition)
    .groupBy(periodExpr)
    .orderBy(periodExpr);

  const [totals] = await db.select({
    totalRevenue: sql<number>`coalesce(sum(${invoicesTable.grandTotal}), 0)`,
    totalProfit: sql<number>`coalesce(sum(${invoicesTable.totalProfit}), 0)`,
  }).from(invoicesTable).where(condition);

  const totalRevenue = Number(totals.totalRevenue);
  const totalProfit = Number(totals.totalProfit);
  const totalCost = totalRevenue - totalProfit;

  res.json({
    entries: results.map(r => {
      const rev = Number(r.revenue);
      const prof = Number(r.profit);
      const cost = rev - prof;
      return {
        period: String(r.period),
        revenue: rev,
        cost,
        profit: prof,
        margin: rev > 0 ? Math.round(prof / rev * 10000) / 100 : 0,
      };
    }),
    totalRevenue,
    totalCost,
    totalProfit,
    profitMargin: totalRevenue > 0 ? Math.round(totalProfit / totalRevenue * 10000) / 100 : 0,
  });
});

router.get("/reports/product-wise", async (req, res): Promise<void> => {
  const params = GetProductWiseReportQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { startDate, endDate } = params.data;

  const results = await db.select({
    productId: invoiceItemsTable.productId,
    productName: invoiceItemsTable.productName,
    totalQuantity: sql<number>`sum(${invoiceItemsTable.quantity})`,
    totalRevenue: sql<number>`sum(${invoiceItemsTable.totalAmount})`,
    totalCost: sql<number>`sum(${invoiceItemsTable.costPrice} * ${invoiceItemsTable.quantity})`,
    totalProfit: sql<number>`sum(${invoiceItemsTable.profit})`,
    totalGst: sql<number>`sum(${invoiceItemsTable.gstAmount})`,
  }).from(invoiceItemsTable)
    .innerJoin(invoicesTable, eq(invoiceItemsTable.invoiceId, invoicesTable.id))
    .where(and(
      gte(invoicesTable.date, startDate),
      lte(invoicesTable.date, endDate)
    ))
    .groupBy(invoiceItemsTable.productId, invoiceItemsTable.productName)
    .orderBy(sql`sum(${invoiceItemsTable.totalAmount}) desc`);

  res.json(results.map(r => ({
    productId: r.productId,
    productName: r.productName,
    totalQuantity: Number(r.totalQuantity),
    totalRevenue: Number(r.totalRevenue),
    totalCost: Number(r.totalCost),
    totalProfit: Number(r.totalProfit),
    totalGst: Number(r.totalGst),
  })));
});

router.get("/reports/customer-wise", async (req, res): Promise<void> => {
  const params = GetCustomerWiseReportQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { startDate, endDate } = params.data;

  const results = await db.select({
    customerId: invoicesTable.customerId,
    totalPurchases: sql<number>`sum(${invoicesTable.grandTotal})`,
    invoiceCount: sql<number>`count(*)`,
    lastPurchaseDate: sql<string>`max(${invoicesTable.date})`,
  }).from(invoicesTable)
    .where(and(
      gte(invoicesTable.date, startDate),
      lte(invoicesTable.date, endDate),
      sql`${invoicesTable.customerId} is not null`
    ))
    .groupBy(invoicesTable.customerId)
    .orderBy(sql`sum(${invoicesTable.grandTotal}) desc`);

  const customerIds = results.filter(r => r.customerId).map(r => r.customerId!);
  let customerNames: Record<number, string> = {};
  if (customerIds.length > 0) {
    const customers = await db.select({ id: customersTable.id, name: customersTable.name })
      .from(customersTable)
      .where(sql`${customersTable.id} in ${customerIds}`);
    for (const c of customers) {
      customerNames[c.id] = c.name;
    }
  }

  res.json(results.map(r => ({
    customerId: r.customerId || 0,
    customerName: r.customerId ? customerNames[r.customerId] || "" : "",
    totalPurchases: Number(r.totalPurchases),
    invoiceCount: Number(r.invoiceCount),
    lastPurchaseDate: r.lastPurchaseDate,
  })));
});

router.get("/reports/sales-register", async (req, res): Promise<void> => {
  const startDate = String(req.query.startDate || "");
  const endDate = String(req.query.endDate || "");

  if (!startDate || !endDate) {
    res.status(400).json({ error: "startDate and endDate are required" });
    return;
  }

  const condition = and(gte(invoicesTable.date, startDate), lte(invoicesTable.date, endDate));

  const invoices = await db.select({
    id: invoicesTable.id,
    invoiceNumber: invoicesTable.invoiceNumber,
    date: invoicesTable.date,
    customerId: invoicesTable.customerId,
    grandTotal: invoicesTable.grandTotal,
    paymentMode: invoicesTable.paymentMode,
  }).from(invoicesTable)
    .where(condition)
    .orderBy(invoicesTable.date, invoicesTable.id);

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

  let totalCash = 0;
  let totalCredit = 0;
  let cashCount = 0;
  let creditCount = 0;

  const entries = invoices.map(inv => {
    const amount = Number(inv.grandTotal);
    const isCash = inv.paymentMode === "cash";
    if (isCash) { totalCash += amount; cashCount++; }
    else { totalCredit += amount; creditCount++; }
    return {
      invoiceNumber: inv.invoiceNumber,
      date: inv.date,
      partyName: inv.customerId ? customerNames[inv.customerId] || "Walk-in" : "Walk-in",
      cashAmount: isCash ? amount : 0,
      creditAmount: isCash ? 0 : amount,
    };
  });

  res.json({
    entries,
    totalCash: Math.round(totalCash * 100) / 100,
    totalCredit: Math.round(totalCredit * 100) / 100,
    grandTotal: Math.round((totalCash + totalCredit) * 100) / 100,
    cashCount,
    creditCount,
  });
});

export default router;
