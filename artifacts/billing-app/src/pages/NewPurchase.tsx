import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, ArrowLeft, ShoppingCart, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProductOption {
  id: number;
  name: string;
  costPrice: number;
  stock: number;
}

interface PurchaseSummary {
  id: number;
  supplierName: string;
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

function usePastSuppliers(): string[] {
  const { data } = useQuery<{ purchases: PurchaseSummary[] }>({
    queryKey: ["purchases-suppliers"],
    queryFn: () => customFetch("/api/purchases?limit=200"),
  });
  if (!data?.purchases) return [];
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const p of data.purchases) {
    const key = p.supplierName.trim().toLowerCase();
    if (!seen.has(key)) { seen.add(key); unique.push(p.supplierName.trim()); }
  }
  return unique;
}

function emptyItem(): PurchaseItem {
  return { key: crypto.randomUUID(), productId: null, productName: "", quantity: "", costPrice: "" };
}

interface FixedDropdownPos { top: number; left: number; width: number }

interface SupplierAutocompleteProps {
  value: string;
  suppliers: string[];
  onChange: (v: string) => void;
}

function SupplierAutocomplete({ value, suppliers, onChange }: SupplierAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [pos, setPos] = useState<FixedDropdownPos | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = value.length >= 2
    ? suppliers.filter(s => s.toLowerCase().includes(value.toLowerCase())).slice(0, 8)
    : [];

  function recalcPos() {
    if (inputRef.current) {
      const r = inputRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left, width: r.width });
    }
  }

  useEffect(() => {
    setActiveIdx(-1);
    if (value.length >= 2 && suggestions.length > 0) {
      recalcPos();
      setOpen(true);
    } else {
      setOpen(false);
    }
  }, [value, suggestions.length]);

  useEffect(() => {
    if (!open) return;
    function close() { setOpen(false); }
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => { window.removeEventListener("scroll", close, true); window.removeEventListener("resize", close); };
  }, [open]);

  function select(s: string) { onChange(s); setOpen(false); }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && activeIdx >= 0) { e.preventDefault(); select(suggestions[activeIdx]); }
    else if (e.key === "Escape") setOpen(false);
  }

  return (
    <>
      <Input
        ref={inputRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => value.length >= 2 && suggestions.length > 0 && (recalcPos(), setOpen(true))}
        placeholder="e.g. Rahul Enterprises"
        autoComplete="off"
        required
      />
      {open && pos && suggestions.length > 0 && (
        <ul
          style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
          className="bg-popover border border-border rounded-md shadow-lg overflow-hidden max-h-48 overflow-y-auto text-sm"
        >
          {suggestions.map((s, idx) => (
            <li
              key={s}
              className={cn(
                "px-3 py-2 cursor-pointer select-none",
                idx === activeIdx ? "bg-accent text-accent-foreground" : "hover:bg-muted"
              )}
              onMouseDown={e => { e.preventDefault(); select(s); }}
              onMouseEnter={() => setActiveIdx(idx)}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

interface ProductAutocompleteProps {
  value: string;
  productId: number | null;
  products: ProductOption[];
  onChange: (name: string, product?: ProductOption | null) => void;
  onTab?: () => void;
}

function ProductAutocomplete({ value, productId, products, onChange, onTab }: ProductAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [pos, setPos] = useState<FixedDropdownPos | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = value.length >= 2
    ? products.filter(p => p.name.toLowerCase().includes(value.toLowerCase())).slice(0, 8)
    : [];

  function recalcPos() {
    if (inputRef.current) {
      const r = inputRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 280) });
    }
  }

  useEffect(() => {
    setActiveIdx(-1);
    if (value.length >= 2 && suggestions.length > 0) {
      recalcPos();
      setOpen(true);
    } else {
      setOpen(false);
    }
  }, [value, suggestions.length]);

  useEffect(() => {
    if (!open) return;
    function close() { setOpen(false); }
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => { window.removeEventListener("scroll", close, true); window.removeEventListener("resize", close); };
  }, [open]);

  function selectProduct(product: ProductOption) {
    onChange(product.name, product);
    setOpen(false);
    setActiveIdx(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (open && suggestions.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, suggestions.length - 1)); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); return; }
      if (e.key === "Enter" && activeIdx >= 0) { e.preventDefault(); selectProduct(suggestions[activeIdx]); return; }
      if (e.key === "Escape") { setOpen(false); return; }
    }
    if (e.key === "Tab" && onTab) { setOpen(false); onTab(); }
  }

  return (
    <>
      <div className="relative w-full">
        <Input
          ref={inputRef}
          value={value}
          onChange={e => onChange(e.target.value, null)}
          onKeyDown={handleKeyDown}
          onFocus={() => value.length >= 2 && suggestions.length > 0 && (recalcPos(), setOpen(true))}
          placeholder="Type product name..."
          className={cn("h-8 text-sm pr-7", productId && "border-green-400 dark:border-green-600")}
          autoComplete="off"
        />
        {productId && (
          <Link2 className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-green-500 pointer-events-none" />
        )}
      </div>
      {open && pos && suggestions.length > 0 && (
        <ul
          style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
          className="bg-popover border border-border rounded-md shadow-lg overflow-hidden max-h-56 overflow-y-auto text-sm"
        >
          {suggestions.map((p, idx) => (
            <li
              key={p.id}
              className={cn(
                "flex items-center justify-between gap-2 px-3 py-2 cursor-pointer select-none",
                idx === activeIdx ? "bg-accent text-accent-foreground" : "hover:bg-muted"
              )}
              onMouseDown={e => { e.preventDefault(); selectProduct(p); }}
              onMouseEnter={() => setActiveIdx(idx)}
            >
              <span className="font-medium truncate">{p.name}</span>
              <div className="flex items-center gap-2 shrink-0 text-xs text-muted-foreground">
                <span>₹{p.costPrice.toLocaleString("en-IN")}</span>
                <Badge variant={p.stock > 0 ? "secondary" : "outline"} className="text-xs h-4 px-1">
                  Stock: {p.stock}
                </Badge>
              </div>
            </li>
          ))}
          {!products.some(p => p.name.toLowerCase() === value.toLowerCase()) && (
            <li className="px-3 py-2 text-xs text-muted-foreground italic border-t">
              Keep typing to add "{value}" as a new product
            </li>
          )}
        </ul>
      )}
    </>
  );
}

export function NewPurchase() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: productsData } = useProducts();
  const products = productsData?.products || [];

  const pastSuppliers = usePastSuppliers();

  const today = new Date().toISOString().split("T")[0];
  const [supplierName, setSupplierName] = useState("");
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<PurchaseItem[]>([emptyItem(), emptyItem(), emptyItem()]);

  const qtyRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const createMutation = useMutation({
    mutationFn: (body: object) =>
      customFetch("/api/purchases", {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["purchases-suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["products-all"] });
    },
  });

  function updateItem(key: string, field: Partial<PurchaseItem>) {
    setItems(prev => prev.map(i => i.key === key ? { ...i, ...field } : i));
  }

  function handleProductChange(key: string, name: string, product: ProductOption | null | undefined) {
    if (product) {
      updateItem(key, { productId: product.id, productName: product.name, costPrice: String(product.costPrice) });
    } else {
      updateItem(key, { productId: null, productName: name });
    }
  }

  function addRow() {
    setItems(prev => [...prev, emptyItem()]);
  }

  function removeRow(key: string) {
    setItems(prev => prev.length > 1 ? prev.filter(i => i.key !== key) : prev);
  }

  const filledItems = items.filter(i => i.productName.trim() && Number(i.quantity) > 0);
  const totalAmount = filledItems.reduce(
    (sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.costPrice) || 0), 0
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supplierName.trim()) { toast({ title: "Supplier name is required", variant: "destructive" }); return; }
    if (!date) { toast({ title: "Date is required", variant: "destructive" }); return; }
    if (filledItems.length === 0) { toast({ title: "Add at least one item with name and quantity", variant: "destructive" }); return; }

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
              <SupplierAutocomplete
                value={supplierName}
                suppliers={pastSuppliers}
                onChange={setSupplierName}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Purchase Date <span className="text-destructive">*</span></Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} required />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Notes (optional)</Label>
              <Input
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="e.g. Invoice #INV-2025, cash payment, etc."
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Items Purchased</CardTitle>
            <p className="text-sm text-muted-foreground">
              Type 2+ letters to search your inventory. Select a suggestion to auto-fill cost price, or keep typing to add a new product.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr className="border-b">
                  <th className="text-left pb-2 font-medium text-muted-foreground">Product</th>
                  <th className="text-right pb-2 font-medium text-muted-foreground w-24">Qty</th>
                  <th className="text-right pb-2 font-medium text-muted-foreground w-32">Cost Price (₹)</th>
                  <th className="text-right pb-2 font-medium text-muted-foreground w-28">Total</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((item) => (
                  <tr key={item.key}>
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-1.5">
                        <ProductAutocomplete
                          value={item.productName}
                          productId={item.productId}
                          products={products}
                          onChange={(name, product) => handleProductChange(item.key, name, product)}
                          onTab={() => qtyRefs.current[item.key]?.focus()}
                        />
                        {item.productId && (
                          <span className="shrink-0 text-xs text-green-600 dark:text-green-400 font-medium whitespace-nowrap">
                            Linked
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 pr-3">
                      <Input
                        ref={el => { qtyRefs.current[item.key] = el; }}
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

            <Button type="button" variant="outline" size="sm" onClick={addRow}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Row
            </Button>

            {filledItems.length > 0 && (
              <div className="border-t pt-3 flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  {filledItems.length} item(s) · {filledItems.filter(i => i.productId).length} linked to inventory
                </span>
                <span className="font-bold text-lg">
                  ₹{totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
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
