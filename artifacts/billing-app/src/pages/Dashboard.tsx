import { useState, useMemo } from "react";
import { useGetDashboardSummary, useGetRecentTransactions, useGetTopProducts, useGetTopCustomers, useGetMonthlySales } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/format";
import { FileText, IndianRupee, Users, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Link } from "wouter";
import { useBusinessProfile } from "@/hooks/use-business-profile";

function getCurrentFyStartYear(fyStartMonth: number): number {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  return currentMonth >= fyStartMonth ? now.getFullYear() : now.getFullYear() - 1;
}

function fyLabel(startYear: number, fyStartMonth: number): string {
  if (fyStartMonth === 1) return String(startYear);
  return `${startYear}-${startYear + 1}`;
}

export function Dashboard() {
  const { profile } = useBusinessProfile();
  const fyStartMonth = profile.fyStartMonth ?? 4;

  const currentStartYear = useMemo(() => getCurrentFyStartYear(fyStartMonth), [fyStartMonth]);
  const [selectedStartYear, setSelectedStartYear] = useState<number>(currentStartYear);

  const fyOptions = useMemo(() => {
    const years: number[] = [];
    for (let i = currentStartYear - 3; i <= currentStartYear + 1; i++) {
      years.push(i);
    }
    return years.reverse();
  }, [currentStartYear]);

  const financialYear = fyLabel(selectedStartYear, fyStartMonth);

  const queryParams = { financialYear, fyStartMonth };

  const { data: summary, isLoading } = useGetDashboardSummary(queryParams);
  const { data: recentTransactions } = useGetRecentTransactions({ limit: 5 });
  const { data: topProducts } = useGetTopProducts({ ...queryParams, limit: 5 });
  const { data: topCustomers } = useGetTopCustomers({ ...queryParams, limit: 5 });
  const { data: monthlySales } = useGetMonthlySales(queryParams);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Financial Year</span>
          <Select value={String(selectedStartYear)} onValueChange={v => setSelectedStartYear(Number(v))}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {fyOptions.map(y => (
                <SelectItem key={y} value={String(y)}>FY {fyLabel(y, fyStartMonth)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary?.totalSales || 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding Due</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{formatCurrency(summary?.totalOutstanding || 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.totalInvoices || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.totalCustomers || 0}</div>
          </CardContent>
        </Card>
      </div>

      {monthlySales && monthlySales.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Monthly Sales — FY {financialYear}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlySales}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="monthName" fontSize={12} tickFormatter={(v) => v?.substring(0, 3)} />
                <YAxis fontSize={12} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Bar dataKey="totalSales" name="Sales" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top Products</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topProducts && topProducts.length > 0 ? topProducts.map((p) => (
                  <TableRow key={p.productId}>
                    <TableCell className="font-medium">{p.productName}</TableCell>
                    <TableCell className="text-right">{p.totalQuantity}</TableCell>
                    <TableCell className="text-right">{formatCurrency(p.totalRevenue)}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={3} className="text-center py-4 text-muted-foreground">No data yet</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top Customers</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Invoices</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topCustomers && topCustomers.length > 0 ? topCustomers.map((c) => (
                  <TableRow key={c.customerId}>
                    <TableCell className="font-medium">{c.customerName}</TableCell>
                    <TableCell className="text-right">{c.invoiceCount}</TableCell>
                    <TableCell className="text-right">{formatCurrency(c.totalPurchases)}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={3} className="text-center py-4 text-muted-foreground">No data yet</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentTransactions && recentTransactions.length > 0 ? recentTransactions.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <Link href={`/invoices/${t.id}`} className="font-mono text-sm text-primary hover:underline">
                      {t.invoiceNumber}
                    </Link>
                  </TableCell>
                  <TableCell>{t.customerName || "Walk-in"}</TableCell>
                  <TableCell>{formatDate(t.date)}</TableCell>
                  <TableCell>{t.paymentStatus === "paid" ? "Paid" : "Due / Unpaid"}</TableCell>
                  <TableCell className="text-right font-semibold">{formatCurrency(t.grandTotal)}</TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={5} className="text-center py-4 text-muted-foreground">No transactions yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
