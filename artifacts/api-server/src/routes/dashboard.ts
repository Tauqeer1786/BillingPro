import { Router, type IRouter } from "express";
import { sql, desc, and, gte, lte, eq } from "drizzle-orm";
import { db, invoicesTable, invoiceItemsTable, productsTable, customersTable } from "@workspace/db";
import {
  GetDashboardSummaryQueryParams,
  GetRecentTransactionsQueryParams,
  GetTopProductsQueryParams,
  GetTopCustomersQueryParams,
  GetMonthlySalesQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function getFinancialYearDates(fy?: string, fyStartMonth = 4): { startDate: string; endDate: string; label: string } {
  const startMonth = Math.max(1, Math.min(12, fyStartMonth));
  const pad = (n: number) => String(n).padStart(2, "0");

  let startYear: number;
  if (fy) {
    startYear = parseInt(fy.split("-")[0]) || new Date().getFullYear();
  } else {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    startYear = currentMonth >= startMonth ? now.getFullYear() : now.getFullYear() - 1;
  }

  if (startMonth === 1) {
    return {
      startDate: `${startYear}-01-01`,
      endDate: `${startYear}-12-31`,
      label: String(startYear),
    };
  }

  const endMonth = startMonth - 1;
  const endYear = startYear + 1;
  const lastDay = new Date(endYear, endMonth, 0).getDate();
  return {
    startDate: `${startYear}-${pad(startMonth)}-01`,
    endDate: `${endYear}-${pad(endMonth)}-${lastDay}`,
    label: `${startYear}-${endYear}`,
  };
}

router.get("/dashboard/summary", async (req, res): Promise<void> => {
  const params = GetDashboardSummaryQueryParams.safeParse(req.query);
  const fy = params.success ? params.data.financialYear : undefined;
  const fyStartMonth = params.success ? (params.data.fyStartMonth ?? 4) : 4;
  const { startDate, endDate, label } = getFinancialYearDates(fy, fyStartMonth);

  const fyCondition = and(
    gte(invoicesTable.date, startDate),
    lte(invoicesTable.date, endDate)
  );

  const [salesData] = await db.select({
    totalSales: sql<number>`coalesce(sum(${invoicesTable.grandTotal}), 0)`,
    totalProfit: sql<number>`coalesce(sum(${invoicesTable.totalProfit}), 0)`,
    totalGst: sql<number>`coalesce(sum(${invoicesTable.totalGst}), 0)`,
    totalOutstanding: sql<number>`coalesce(sum(case when ${invoicesTable.paymentStatus} = 'unpaid' then ${invoicesTable.grandTotal} else 0 end), 0)`,
    totalInvoices: sql<number>`count(*)`,
  }).from(invoicesTable).where(fyCondition);

  const [customerCount] = await db.select({ count: sql<number>`count(*)` }).from(customersTable);
  const [productCount] = await db.select({ count: sql<number>`count(*)` }).from(productsTable);

  res.json({
    totalSales: Number(salesData.totalSales),
    totalProfit: Number(salesData.totalProfit),
    totalGst: Number(salesData.totalGst),
    totalOutstanding: Number(salesData.totalOutstanding),
    totalInvoices: Number(salesData.totalInvoices),
    totalCustomers: Number(customerCount.count),
    totalProducts: Number(productCount.count),
    financialYear: label,
  });
});

router.get("/dashboard/recent-transactions", async (req, res): Promise<void> => {
  const params = GetRecentTransactionsQueryParams.safeParse(req.query);
  const limit = params.success ? params.data.limit || 10 : 10;

  const invoices = await db.select({
    id: invoicesTable.id,
    invoiceNumber: invoicesTable.invoiceNumber,
    customerId: invoicesTable.customerId,
    date: invoicesTable.date,
    paymentStatus: invoicesTable.paymentStatus,
    grandTotal: invoicesTable.grandTotal,
    totalProfit: invoicesTable.totalProfit,
    createdAt: invoicesTable.createdAt,
  }).from(invoicesTable)
    .orderBy(desc(invoicesTable.createdAt))
    .limit(limit);

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

  res.json(invoices.map(i => ({
    id: i.id,
    invoiceNumber: i.invoiceNumber,
    customerName: i.customerId ? customerNames[i.customerId] || "" : "Walk-in",
    date: i.date,
    paymentStatus: i.paymentStatus,
    grandTotal: i.grandTotal,
    outstandingAmount: i.paymentStatus === "unpaid" ? i.grandTotal : 0,
    totalProfit: i.totalProfit,
    itemCount: 0,
    createdAt: i.createdAt instanceof Date ? i.createdAt.toISOString() : String(i.createdAt),
  })));
});

router.get("/dashboard/top-products", async (req, res): Promise<void> => {
  const params = GetTopProductsQueryParams.safeParse(req.query);
  const fy = params.success ? params.data.financialYear : undefined;
  const fyStartMonth = params.success ? (params.data.fyStartMonth ?? 4) : 4;
  const limit = params.success ? params.data.limit || 5 : 5;
  const { startDate, endDate } = getFinancialYearDates(fy, fyStartMonth);

  const results = await db.select({
    productId: invoiceItemsTable.productId,
    productName: invoiceItemsTable.productName,
    totalQuantity: sql<number>`sum(${invoiceItemsTable.quantity})`,
    totalRevenue: sql<number>`sum(${invoiceItemsTable.totalAmount})`,
    totalProfit: sql<number>`sum(${invoiceItemsTable.profit})`,
  }).from(invoiceItemsTable)
    .innerJoin(invoicesTable, eq(invoiceItemsTable.invoiceId, invoicesTable.id))
    .where(and(
      gte(invoicesTable.date, startDate),
      lte(invoicesTable.date, endDate)
    ))
    .groupBy(invoiceItemsTable.productId, invoiceItemsTable.productName)
    .orderBy(sql`sum(${invoiceItemsTable.totalAmount}) desc`)
    .limit(limit);

  res.json(results.map(r => ({
    productId: r.productId,
    productName: r.productName,
    totalQuantity: Number(r.totalQuantity),
    totalRevenue: Number(r.totalRevenue),
    totalProfit: Number(r.totalProfit),
  })));
});

router.get("/dashboard/top-customers", async (req, res): Promise<void> => {
  const params = GetTopCustomersQueryParams.safeParse(req.query);
  const fy = params.success ? params.data.financialYear : undefined;
  const fyStartMonth = params.success ? (params.data.fyStartMonth ?? 4) : 4;
  const limit = params.success ? params.data.limit || 5 : 5;
  const { startDate, endDate } = getFinancialYearDates(fy, fyStartMonth);

  const results = await db.select({
    customerId: invoicesTable.customerId,
    totalPurchases: sql<number>`sum(${invoicesTable.grandTotal})`,
    invoiceCount: sql<number>`count(*)`,
  }).from(invoicesTable)
    .where(and(
      gte(invoicesTable.date, startDate),
      lte(invoicesTable.date, endDate),
      sql`${invoicesTable.customerId} is not null`
    ))
    .groupBy(invoicesTable.customerId)
    .orderBy(sql`sum(${invoicesTable.grandTotal}) desc`)
    .limit(limit);

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
  })));
});

router.get("/dashboard/monthly-sales", async (req, res): Promise<void> => {
  const params = GetMonthlySalesQueryParams.safeParse(req.query);
  const fy = params.success ? params.data.financialYear : undefined;
  const fyStartMonth = params.success ? (params.data.fyStartMonth ?? 4) : 4;
  const { startDate, endDate } = getFinancialYearDates(fy, fyStartMonth);

  const months = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];

  const results = await db.select({
    month: sql<number>`CAST(strftime('%m', ${invoicesTable.date}) AS INTEGER)`,
    year: sql<number>`CAST(strftime('%Y', ${invoicesTable.date}) AS INTEGER)`,
    totalSales: sql<number>`sum(${invoicesTable.grandTotal})`,
    totalProfit: sql<number>`sum(${invoicesTable.totalProfit})`,
    totalGst: sql<number>`sum(${invoicesTable.totalGst})`,
    invoiceCount: sql<number>`count(*)`,
  }).from(invoicesTable)
    .where(and(
      gte(invoicesTable.date, startDate),
      lte(invoicesTable.date, endDate)
    ))
    .groupBy(
      sql`strftime('%Y', ${invoicesTable.date})`,
      sql`strftime('%m', ${invoicesTable.date})`
    )
    .orderBy(
      sql`strftime('%Y', ${invoicesTable.date})`,
      sql`strftime('%m', ${invoicesTable.date})`
    );

  res.json(results.map(r => ({
    month: Number(r.month),
    year: Number(r.year),
    monthName: months[Number(r.month) - 1],
    totalSales: Number(r.totalSales),
    totalProfit: Number(r.totalProfit),
    totalGst: Number(r.totalGst),
    invoiceCount: Number(r.invoiceCount),
  })));
});

export default router;
