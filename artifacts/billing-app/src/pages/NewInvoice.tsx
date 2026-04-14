import { useState, useMemo } from "react";
import { useListProducts, useListCustomers, useCreateInvoice, getListInvoicesQueryKey, getGetDashboardSummaryQueryKey, getGetRecentTransactionsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import { Link, useLocation } from "wouter";

interface InvoiceLineItem {
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  costPrice: number;
  gstPercent: number;
  discountPercent: number;
}

export function NewInvoice() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [customerId, setCustomerId] = useState<string>("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<InvoiceLineItem[]>([]);
  const [overallDiscount, setOverallDiscount] = useState("0");

  const { data: productsData } = useListProducts({ limit: 500 });
  const { data: customersData } = useListCustomers({ limit: 500 });
  const createMutation = useCreateInvoice();

  const products = productsData?.products || [];
  const customers = customersData?.customers || [];

  function addItem() {
    if (products.length === 0) return;
    const p = products[0];
    setItems([...items, {
      productId: p.id,
      productName: p.name,
      quantity: 1,
      unitPrice: p.sellingPrice,
      costPrice: p.costPrice,
      gstPercent: p.gstPercent,
      discountPercent: 0,
    }]);
  }

  function updateItem(index: number, field: string, value: string | number) {
    const updated = [...items];
    if (field === "productId") {
      const p = products.find(pr => pr.id === Number(value));
      if (p) {
        updated[index] = {
          ...updated[index],
          productId: p.id,
          productName: p.name,
          unitPrice: p.sellingPrice,
          costPrice: p.costPrice,
          gstPercent: p.gstPercent,
        };
      }
    } else {
      (updated[index] as Record<string, unknown>)[field] = typeof value === "string" ? parseFloat(value) || 0 : value;
    }
    setItems(updated);
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  const totals = useMemo(() => {
    let subtotal = 0;
    let totalGst = 0;
    let totalDiscount = 0;
    let totalProfit = 0;

    for (const item of items) {
      const baseAmount = item.unitPrice * item.quantity;
      const itemDiscount = baseAmount * (item.discountPercent / 100);
      const afterDiscount = baseAmount - itemDiscount;
      const gst = afterDiscount * (item.gstPercent / 100);

      subtotal += afterDiscount;
      totalGst += gst;
      totalDiscount += itemDiscount;
      totalProfit += (item.unitPrice - item.costPrice) * item.quantity - itemDiscount;
    }

    const overallDiscountAmount = subtotal * (parseFloat(overallDiscount) || 0) / 100;
    totalDiscount += overallDiscountAmount;
    subtotal -= overallDiscountAmount;

    const grandTotal = subtotal + totalGst;

    return { subtotal, totalGst, totalDiscount, grandTotal, totalProfit };
  }, [items, overallDiscount]);

  async function handleSubmit() {
    if (items.length === 0) {
      toast({ title: "Error", description: "Add at least one item", variant: "destructive" });
      return;
    }

    try {
      const result = await createMutation.mutateAsync({
        data: {
          customerId: customerId ? parseInt(customerId) : undefined,
          date,
          items: items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discountPercent: item.discountPercent,
          })),
          notes: notes || undefined,
          overallDiscountPercent: parseFloat(overallDiscount) || 0,
        },
      });

      queryClient.invalidateQueries({ queryKey: getListInvoicesQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetRecentTransactionsQueryKey() });
      toast({ title: "Invoice created", description: `Invoice ${result.invoiceNumber} created successfully` });
      setLocation(`/invoices/${result.id}`);
    } catch {
      toast({ title: "Error", description: "Failed to create invoice", variant: "destructive" });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/invoices">
          <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">New Invoice</h1>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div>
          <Label>Customer</Label>
          <Select value={customerId} onValueChange={setCustomerId}>
            <SelectTrigger>
              <SelectValue placeholder="Walk-in customer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Walk-in customer</SelectItem>
              {customers.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <Label>Overall Discount %</Label>
          <Input type="number" step="0.01" value={overallDiscount} onChange={(e) => setOverallDiscount(e.target.value)} />
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Line Items</CardTitle>
            <Button size="sm" onClick={addItem} disabled={products.length === 0}>
              <Plus className="w-4 h-4 mr-1" />Add Item
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[30%]">Product</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Disc %</TableHead>
                <TableHead className="text-right">GST %</TableHead>
                <TableHead className="text-right">GST Amt</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No items added. Click "Add Item" to start.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item, index) => {
                  const baseAmount = item.unitPrice * item.quantity;
                  const discount = baseAmount * (item.discountPercent / 100);
                  const afterDiscount = baseAmount - discount;
                  const gstAmount = afterDiscount * (item.gstPercent / 100);
                  const lineTotal = afterDiscount + gstAmount;

                  return (
                    <TableRow key={index}>
                      <TableCell>
                        <Select value={String(item.productId)} onValueChange={(v) => updateItem(index, "productId", v)}>
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {products.map((p) => (
                              <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input type="number" min="1" value={item.quantity} onChange={(e) => updateItem(index, "quantity", e.target.value)} className="w-16 h-8 text-right" />
                      </TableCell>
                      <TableCell>
                        <Input type="number" step="0.01" value={item.unitPrice} onChange={(e) => updateItem(index, "unitPrice", e.target.value)} className="w-24 h-8 text-right" />
                      </TableCell>
                      <TableCell>
                        <Input type="number" step="0.01" value={item.discountPercent} onChange={(e) => updateItem(index, "discountPercent", e.target.value)} className="w-16 h-8 text-right" />
                      </TableCell>
                      <TableCell className="text-right text-sm">{item.gstPercent}%</TableCell>
                      <TableCell className="text-right text-sm">{formatCurrency(gstAmount)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(lineTotal)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => removeItem(index)} className="text-destructive h-8 w-8 p-0"><Trash2 className="w-4 h-4" /></Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <Label>Notes</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes..." rows={3} />
        </div>
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">GST</span>
              <span>{formatCurrency(totals.totalGst)}</span>
            </div>
            {totals.totalDiscount > 0 && (
              <div className="flex justify-between text-sm text-destructive">
                <span>Discount</span>
                <span>-{formatCurrency(totals.totalDiscount)}</span>
              </div>
            )}
            <div className="border-t pt-2 flex justify-between font-bold text-lg">
              <span>Grand Total</span>
              <span>{formatCurrency(totals.grandTotal)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button size="lg" onClick={handleSubmit} disabled={items.length === 0 || createMutation.isPending}>
          {createMutation.isPending ? "Creating..." : "Create Invoice"}
        </Button>
      </div>
    </div>
  );
}
