import { useState, useMemo, useRef } from "react";
import { useListProducts, useListCustomers, useCreateInvoice, getListInvoicesQueryKey, getGetDashboardSummaryQueryKey, getGetRecentTransactionsQueryKey, type Product } from "@workspace/api-client-react";
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

function ProductAutocomplete({
  products,
  value,
  selectedProductId,
  onInputChange,
  onSelect,
  onRequestNextRow,
  inputRef,
}: {
  products: Product[];
  value: string;
  selectedProductId: number;
  onInputChange: (value: string) => void;
  onSelect: (product: Product) => void;
  onRequestNextRow: () => void;
  inputRef: (node: HTMLInputElement | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const query = value.trim().toLowerCase();
  const canShowSuggestions = query.length >= 2;
  const selectedProduct = products.find((product) => product.id === selectedProductId);
  const suggestions = products
    .filter((product) => {
      if (!canShowSuggestions) return false;
      const name = product.name.toLowerCase();
      return name.startsWith(query) || name.includes(query);
    })
    .slice(0, 8);

  function selectProduct(product: Product) {
    onSelect(product);
    setOpen(false);
    setActiveIndex(0);
  }

  return (
    <div className="relative min-w-[260px]">
      <Input
        ref={inputRef}
        value={value}
        placeholder="Type product name..."
        autoComplete="off"
        className="h-8"
        onFocus={() => setOpen(canShowSuggestions)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onChange={(event) => {
          const nextValue = event.target.value;
          onInputChange(nextValue);
          setOpen(nextValue.trim().length >= 2);
          setActiveIndex(0);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(canShowSuggestions);
            setActiveIndex((current) => Math.min(current + 1, Math.max(suggestions.length - 1, 0)));
            return;
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((current) => Math.max(current - 1, 0));
            return;
          }
          if (event.key === "Enter") {
            event.preventDefault();
            if (open && suggestions[activeIndex]) {
              selectProduct(suggestions[activeIndex]);
              return;
            }
            onRequestNextRow();
          }
          if (event.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      <div className="mt-1 text-[11px] text-muted-foreground">
        {selectedProduct ? (
          <span>Available stock: <span className="font-semibold text-foreground">{selectedProduct.stock}</span> {selectedProduct.unit || "pcs"}</span>
        ) : (
          <span>Select a product to view available stock</span>
        )}
      </div>
      {open && canShowSuggestions && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border bg-popover shadow-md">
          {suggestions.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">No products found</div>
          ) : (
            suggestions.map((product, index) => (
              <button
                key={product.id}
                type="button"
                className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground ${index === activeIndex ? "bg-accent text-accent-foreground" : ""}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectProduct(product)}
              >
                <span className="truncate font-medium">{product.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">Stock: {product.stock} {product.unit || "pcs"}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function NewInvoice() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [customerId, setCustomerId] = useState<string>("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentMode, setPaymentMode] = useState<"cash" | "credit">("credit");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<InvoiceLineItem[]>([]);
  const [overallDiscount, setOverallDiscount] = useState("0");
  const productInputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const { data: productsData } = useListProducts({ limit: 500 });
  const { data: customersData } = useListCustomers({ limit: 500 });
  const createMutation = useCreateInvoice();

  const products = productsData?.products || [];
  const customers = customersData?.customers || [];

  function createEmptyItem(): InvoiceLineItem {
    return {
      productId: 0,
      productName: "",
      quantity: 1,
      unitPrice: 0,
      costPrice: 0,
      gstPercent: 0,
      discountPercent: 0,
    };
  }

  function focusProductInput(index: number) {
    setTimeout(() => productInputRefs.current[index]?.focus(), 0);
  }

  function addItem(afterIndex?: number) {
    if (products.length === 0) return;
    const insertAt = typeof afterIndex === "number" ? afterIndex + 1 : items.length;
    const updated = [...items];
    updated.splice(insertAt, 0, createEmptyItem());
    setItems(updated);
    focusProductInput(insertAt);
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
    } else if (field === "productName") {
      updated[index] = {
        ...updated[index],
        productId: 0,
        productName: String(value),
        unitPrice: 0,
        costPrice: 0,
        gstPercent: 0,
      };
    } else {
      (updated[index] as Record<string, unknown>)[field] = typeof value === "string" ? parseFloat(value) || 0 : value;
    }
    setItems(updated);
  }

  function selectProduct(index: number, product: Product) {
    const updated = [...items];
    updated[index] = {
      ...updated[index],
      productId: product.id,
      productName: product.name,
      unitPrice: product.sellingPrice,
      costPrice: product.costPrice,
      gstPercent: product.gstPercent,
    };
    setItems(updated);
  }

  function handleRowEnter(event: React.KeyboardEvent<HTMLInputElement>, index: number) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    addItem(index);
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
    if (items.some((item) => !item.productId)) {
      toast({ title: "Error", description: "Select a product for every item row", variant: "destructive" });
      return;
    }

    try {
      const result = await createMutation.mutateAsync({
        data: {
          customerId: customerId ? parseInt(customerId) : undefined,
          date,
          paymentMode,
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

      <div className="grid md:grid-cols-4 gap-4">
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
          <Label>Payment Mode</Label>
          <Select value={paymentMode} onValueChange={(v) => setPaymentMode(v as "cash" | "credit")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="credit">Credit</SelectItem>
            </SelectContent>
          </Select>
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
                        <ProductAutocomplete
                          products={products}
                          value={item.productName}
                          selectedProductId={item.productId}
                          onInputChange={(value) => updateItem(index, "productName", value)}
                          onSelect={(product) => selectProduct(index, product)}
                          onRequestNextRow={() => addItem(index)}
                          inputRef={(node) => {
                            productInputRefs.current[index] = node;
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Input type="number" min="1" value={item.quantity} onKeyDown={(e) => handleRowEnter(e, index)} onChange={(e) => updateItem(index, "quantity", e.target.value)} className="w-16 h-8 text-right" />
                      </TableCell>
                      <TableCell>
                        <Input type="number" step="0.01" value={item.unitPrice} onKeyDown={(e) => handleRowEnter(e, index)} onChange={(e) => updateItem(index, "unitPrice", e.target.value)} className="w-24 h-8 text-right" />
                      </TableCell>
                      <TableCell>
                        <Input type="number" step="0.01" value={item.discountPercent} onKeyDown={(e) => handleRowEnter(e, index)} onChange={(e) => updateItem(index, "discountPercent", e.target.value)} className="w-16 h-8 text-right" />
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
