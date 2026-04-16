import { useState } from "react";
import { customFetch, useListInvoices } from "@workspace/api-client-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import { Plus, Eye } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";

export function Invoices() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState<"all" | "paid" | "unpaid">("all");
  const queryClient = useQueryClient();

  const { data, isLoading } = useListInvoices({
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    status: status === "all" ? undefined : status,
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, paymentStatus }: { id: number; paymentStatus: "paid" | "unpaid" }) =>
      customFetch(`/api/invoices/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentStatus }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });

  const filteredTotal = data?.invoices.reduce((sum, invoice) => sum + invoice.grandTotal, 0) ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
        <Link href="/invoices/new">
          <Button><Plus className="w-4 h-4 mr-2" />New Invoice</Button>
        </Link>
      </div>

      <div className="flex gap-4 items-end">
        <div>
          <label className="text-sm font-medium text-muted-foreground">From</label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40" />
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground">To</label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40" />
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground">Status</label>
          <Select value={status} onValueChange={(value) => setStatus(value as "all" | "paid" | "unpaid")}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All invoices</SelectItem>
              <SelectItem value="unpaid">Due / Unpaid</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {(startDate || endDate || status !== "all") && (
          <Button variant="ghost" size="sm" onClick={() => { setStartDate(""); setEndDate(""); setStatus("all"); }}>Clear</Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Outstanding Due</p>
            <p className="text-2xl font-bold text-orange-600">{formatCurrency(data?.outstandingTotal ?? 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Filtered Invoice Value</p>
            <p className="text-2xl font-bold">{formatCurrency(filteredTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Invoices Shown</p>
            <p className="text-2xl font-bold">{data?.invoices.length ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Due</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : data?.invoices.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No invoices found. Create your first invoice.</TableCell></TableRow>
              ) : (
                data?.invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-sm">{inv.invoiceNumber}</TableCell>
                    <TableCell>{formatDate(inv.date)}</TableCell>
                    <TableCell>{inv.customerName || "Walk-in"}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant={inv.paymentStatus === "paid" ? "secondary" : "destructive"}>
                          {inv.paymentStatus === "paid" ? "Paid" : "Due / Unpaid"}
                        </Badge>
                        {inv.paymentMode && (
                          <Badge variant="outline" className="text-xs capitalize">
                            {inv.paymentMode}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{inv.itemCount}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(inv.grandTotal)}</TableCell>
                    <TableCell className="text-right font-semibold text-orange-600">{formatCurrency(inv.outstandingAmount)}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={updateStatus.isPending}
                        onClick={() => updateStatus.mutate({ id: inv.id, paymentStatus: inv.paymentStatus === "paid" ? "unpaid" : "paid" })}
                      >
                        Mark {inv.paymentStatus === "paid" ? "Unpaid" : "Paid"}
                      </Button>
                      <Link href={`/invoices/${inv.id}`}>
                        <Button variant="ghost" size="sm"><Eye className="w-4 h-4" /></Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
