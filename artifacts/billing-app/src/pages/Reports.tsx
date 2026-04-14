import { useState } from "react";
import {
  useListFinancialYears,
  useGetSalesReport,
  useGetGstReport,
  useGetProfitReport,
  useGetProductWiseReport,
  useGetCustomerWiseReport,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/format";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

export function Reports() {
  const now = new Date();
  const currentFYStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const defaultFY = `${currentFYStart}-${currentFYStart + 1}`;

  const [startDate, setStartDate] = useState(`${currentFYStart}-04-01`);
  const [endDate, setEndDate] = useState(`${currentFYStart + 1}-03-31`);
  const [groupBy, setGroupBy] = useState<"daily" | "monthly" | "yearly">("monthly");
  const [selectedFY, setSelectedFY] = useState(defaultFY);
  const [showProfit, setShowProfit] = useState(false);

  const { data: financialYears } = useListFinancialYears();
  const { data: salesReport } = useGetSalesReport({ startDate, endDate, groupBy });
  const { data: gstReport } = useGetGstReport({ financialYear: selectedFY });
  const { data: profitReport } = useGetProfitReport({ startDate, endDate, groupBy });
  const { data: productWise } = useGetProductWiseReport({ startDate, endDate });
  const { data: customerWise } = useGetCustomerWiseReport({ startDate, endDate });

  function handleFYChange(fy: string) {
    setSelectedFY(fy);
    const [start] = fy.split("-").map(Number);
    setStartDate(`${start}-04-01`);
    setEndDate(`${start + 1}-03-31`);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch id="show-profit" checked={showProfit} onCheckedChange={setShowProfit} />
            <Label htmlFor="show-profit" className="text-sm">Show Profit</Label>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <label className="text-sm font-medium text-muted-foreground">Financial Year</label>
          <Select value={selectedFY} onValueChange={handleFYChange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {financialYears?.map((fy) => (
                <SelectItem key={fy.label} value={fy.label}>{fy.label}</SelectItem>
              ))}
              {(!financialYears || financialYears.length === 0) && (
                <SelectItem value={defaultFY}>{defaultFY}</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground">From</label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40" />
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground">To</label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40" />
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground">Group By</label>
          <Select value={groupBy} onValueChange={(v) => setGroupBy(v as "daily" | "monthly" | "yearly")}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="sales">
        <TabsList>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="gst">GST</TabsTrigger>
          {showProfit && <TabsTrigger value="profit">Profit</TabsTrigger>}
          <TabsTrigger value="products">Product-wise</TabsTrigger>
          <TabsTrigger value="customers">Customer-wise</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="space-y-4">
          {salesReport && (
            <>
              <div className="grid grid-cols-3 gap-4">
                <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Sales</p><p className="text-2xl font-bold">{formatCurrency(salesReport.totalSales)}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total GST</p><p className="text-2xl font-bold">{formatCurrency(salesReport.totalGst)}</p></CardContent></Card>
                {showProfit && <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Profit</p><p className="text-2xl font-bold text-emerald-600">{formatCurrency(salesReport.totalProfit || 0)}</p></CardContent></Card>}
              </div>
              {salesReport.entries.length > 0 && (
                <Card>
                  <CardContent className="p-4">
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={salesReport.entries}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="period" fontSize={12} />
                        <YAxis fontSize={12} />
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                        <Legend />
                        <Bar dataKey="sales" name="Sales" fill="#6366f1" radius={[4, 4, 0, 0]} />
                        {showProfit && <Bar dataKey="profit" name="Profit" fill="#10b981" radius={[4, 4, 0, 0]} />}
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Period</TableHead>
                        <TableHead className="text-right">Sales</TableHead>
                        <TableHead className="text-right">GST</TableHead>
                        {showProfit && <TableHead className="text-right">Profit</TableHead>}
                        <TableHead className="text-right">Invoices</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {salesReport.entries.map((entry) => (
                        <TableRow key={entry.period}>
                          <TableCell>{entry.period}</TableCell>
                          <TableCell className="text-right">{formatCurrency(entry.sales)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(entry.gst)}</TableCell>
                          {showProfit && <TableCell className="text-right text-emerald-600">{formatCurrency(entry.profit || 0)}</TableCell>}
                          <TableCell className="text-right">{entry.invoiceCount}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="gst" className="space-y-4">
          {gstReport && (
            <>
              <div className="grid grid-cols-4 gap-4">
                <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">CGST</p><p className="text-xl font-bold">{formatCurrency(gstReport.totalCgst)}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">SGST</p><p className="text-xl font-bold">{formatCurrency(gstReport.totalSgst)}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">IGST</p><p className="text-xl font-bold">{formatCurrency(gstReport.totalIgst)}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total GST</p><p className="text-xl font-bold">{formatCurrency(gstReport.totalGst)}</p></CardContent></Card>
              </div>
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Month</TableHead>
                        <TableHead className="text-right">Taxable Amount</TableHead>
                        <TableHead className="text-right">CGST</TableHead>
                        <TableHead className="text-right">SGST</TableHead>
                        <TableHead className="text-right">IGST</TableHead>
                        <TableHead className="text-right">Total GST</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {gstReport.entries.map((entry) => (
                        <TableRow key={entry.month}>
                          <TableCell>{entry.monthName}</TableCell>
                          <TableCell className="text-right">{formatCurrency(entry.taxableAmount || 0)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(entry.cgst)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(entry.sgst)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(entry.igst)}</TableCell>
                          <TableCell className="text-right font-semibold">{formatCurrency(entry.totalGst)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {showProfit && (
          <TabsContent value="profit" className="space-y-4">
            {profitReport && (
              <>
                <div className="grid grid-cols-4 gap-4">
                  <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Revenue</p><p className="text-xl font-bold">{formatCurrency(profitReport.totalRevenue)}</p></CardContent></Card>
                  <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Cost</p><p className="text-xl font-bold">{formatCurrency(profitReport.totalCost)}</p></CardContent></Card>
                  <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Profit</p><p className="text-xl font-bold text-emerald-600">{formatCurrency(profitReport.totalProfit)}</p></CardContent></Card>
                  <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Profit Margin</p><p className="text-xl font-bold">{profitReport.profitMargin || 0}%</p></CardContent></Card>
                </div>
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Period</TableHead>
                          <TableHead className="text-right">Revenue</TableHead>
                          <TableHead className="text-right">Cost</TableHead>
                          <TableHead className="text-right">Profit</TableHead>
                          <TableHead className="text-right">Margin</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {profitReport.entries.map((entry) => (
                          <TableRow key={entry.period}>
                            <TableCell>{entry.period}</TableCell>
                            <TableCell className="text-right">{formatCurrency(entry.revenue)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(entry.cost)}</TableCell>
                            <TableCell className="text-right text-emerald-600">{formatCurrency(entry.profit)}</TableCell>
                            <TableCell className="text-right">{entry.margin || 0}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        )}

        <TabsContent value="products" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Qty Sold</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">GST</TableHead>
                    {showProfit && <TableHead className="text-right">Profit</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productWise && productWise.length > 0 ? productWise.map((p) => (
                    <TableRow key={p.productId}>
                      <TableCell className="font-medium">{p.productName}</TableCell>
                      <TableCell className="text-right">{p.totalQuantity}</TableCell>
                      <TableCell className="text-right">{formatCurrency(p.totalRevenue)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(p.totalGst || 0)}</TableCell>
                      {showProfit && <TableCell className="text-right text-emerald-600">{formatCurrency(p.totalProfit)}</TableCell>}
                    </TableRow>
                  )) : (
                    <TableRow><TableCell colSpan={showProfit ? 5 : 4} className="text-center py-8 text-muted-foreground">No data for selected period.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customers" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Invoices</TableHead>
                    <TableHead className="text-right">Total Purchases</TableHead>
                    <TableHead>Last Purchase</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customerWise && customerWise.length > 0 ? customerWise.map((c) => (
                    <TableRow key={c.customerId}>
                      <TableCell className="font-medium">{c.customerName}</TableCell>
                      <TableCell className="text-right">{c.invoiceCount}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(c.totalPurchases)}</TableCell>
                      <TableCell>{c.lastPurchaseDate || "-"}</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No data for selected period.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
