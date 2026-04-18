import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, ArrowLeft, ShoppingCart } from "lucide-react";

interface ProductOption {
  id: number;
  name: string;
  costPrice: number;
  stock: number;
}

interface PurchaseItem {
  key: string;
  productId: number | null;
  productName: string;
  quantity: string;
  costPrice: string;
}

function useProducts() {
  return useQuery<{ products: ProductOption[] }>({
    queryKey: ["products-all"],
    queryFn: () => customFetch("/api/products?limit=500"),
  });
}

function emptyItem(): PurchaseItem {
  return { key: crypto.randomUUID(), productId: null, productName: "", quantity: "", costPrice: "" };
}

export function NewPurchase() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: productsData } = useProducts();
  const products = productsData?.products || [];

  const today = new Date().toISOString().split("T")[0];
  const [supplierName, setSupplierName] = useState("");
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<PurchaseItem[]>([emptyItem(), emptyItem(), emptyItem()]);

  const createMutation = useMutation({
    mutationFn: (body: object) => customFetch("/api/purchases", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["products-all"] });
    },
  });

  function updateItem(key: string, field: Partial<PurchaseItem>) {
    setItems(prev => prev.map(i => i.key === key ? { ...i, ...field } : i));
  }

  function handleProductSelect(key: string, productId: string) {
    if (productId === "__manual__") {
      updateItem(key, { productId: null, productName: "", costPrice: "" });
      return;
    }
    const pid = parseInt(productId);
    const product = products.find(p => p.id === pid);
    if (product) {
      updateItem(key, { productId: product.id, productName: product.name, costPrice: String(product.costPrice) });
    }
  }

  function addRow() {
    setItems(prev => [...prev, emptyItem()]);
  }

  function removeRow(key: string) {
    setItems(prev => prev.length > 1 ? prev.filter(i => i.key !== key) : prev);
  }

  const filledItems = items.filter(i => i.productName.trim() && Number(i.quantity) > 0);
  const totalAmount = filledItems.reduce((sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.costPrice) || 0), 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!supplierName.trim()) {
      toast({ title: "Supplier name is required", variant: "destructive" }); return;
    }
    if (!date) {
      toast({ title: "Date is required", variant: "destructive" }); return;
    }
    if (filledItems.length === 0) {
      toast({ title: "Add at least one item", variant: "destructive" }); return;
    }

    const invalidItem = filledItems.find(i => !i.quantity || Number(i.quantity) <= 0);
    if (invalidItem) {
      toast({ title: "All items must have a quantity > 0", variant: "destructive" }); return;
    }

    try {
      await createMutation.mutateAsync({
        supplierName: supplierName.trim(),
        date,
        notes: notes.trim() || undefined,
        items: filledItems.map(i => ({
          productId: i.productId || undefined,
          productName: i.productName.trim(),
          quantity: Number(i.quantity),
          costPrice: Number(i.costPrice) || 0,
        })),
      });
      toast({ title: "Purchase recorded", description: `${filledItems.length} item(s) added to stock.` });
      navigate("/purchases");
    } catch {
      toast({ title: "Failed to save purchase", variant: "destructive" });
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/purchases")}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">New Purchase</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" />
              Purchase Details
            </CardTitle>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Supplier Name <span className="text-destructive">*</span></Label>
              <Input
                value={supplierName}
                onChange={e => setSupplierName(e.target.value)}
                placeholder="e.g. Rahul Enterprises"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Purchase Date <span className="text-destructive">*</span></Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} required />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Notes (optional)</Label>
              <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Invoice #INV-2025, cash payment, etc." />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Items Purchased</CardTitle>
            <p className="text-sm text-muted-foreground">Select from inventory products to auto-update stock, or type a new product name.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left pb-2 font-medium text-muted-foreground w-1/2">Product</th>
                    <th className="text-right pb-2 font-medium text-muted-foreground w-24">Qty</th>
                    <th className="text-right pb-2 font-medium text-muted-foreground w-28">Cost Price (₹)</th>
                    <th className="text-right pb-2 font-medium text-muted-foreground w-24">Total</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((item, idx) => (
                    <tr key={item.key}>
                      <td className="py-2 pr-3">
                        <div className="flex flex-col gap-1">
                          <Select
                            value={item.productId ? String(item.productId) : "__manual__"}
                            onValueChange={v => handleProductSelect(item.key, v)}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Select product..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__manual__">— Type manually —</SelectItem>
                              {products.map(p => (
                                <SelectItem key={p.id} value={String(p.id)}>
                                  {p.name} (Stock: {p.stock})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {!item.productId && (
                            <Input
                              className="h-7 text-xs"
                              placeholder="Product name..."
                              value={item.productName}
                              onChange={e => updateItem(item.key, { productName: e.target.value })}
                            />
                          )}
                        </div>
                      </td>
                      <td className="py-2 pr-3">
                        <Input
                          type="number"
                          min="1"
                          className="h-8 text-right text-sm"
                          placeholder="0"
                          value={item.quantity}
                          onChange={e => updateItem(item.key, { quantity: e.target.value })}
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          className="h-8 text-right text-sm"
                          placeholder="0.00"
                          value={item.costPrice}
                          onChange={e => updateItem(item.key, { costPrice: e.target.value })}
                        />
                      </td>
                      <td className="py-2 pr-3 text-right font-medium tabular-nums">
                        {item.quantity && item.costPrice
                          ? `₹${(Number(item.quantity) * Number(item.costPrice)).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                          : "—"}
                      </td>
                      <td className="py-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => removeRow(item.key)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Button type="button" variant="outline" size="sm" onClick={addRow}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Row
            </Button>

            {filledItems.length > 0 && (
              <div className="border-t pt-3 flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{filledItems.length} item(s) · Stock will be updated automatically</span>
                <span className="font-bold text-lg">₹{totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? "Saving..." : "Save Purchase"}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate("/purchases")}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
