import { useState } from "react";
import { useListProducts, useCreateProduct, useUpdateProduct, useDeleteProduct, getListProductsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Search, PackagePlus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface ProductForm {
  name: string;
  alias: string;
  costPrice: string;
  marginPercent: string;
  gstPercent: string;
  stock: string;
  hsn: string;
  unit: string;
}

const emptyForm: ProductForm = { name: "", alias: "", costPrice: "", marginPercent: "", gstPercent: "18", stock: "0", hsn: "", unit: "pcs" };

export function Products() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useListProducts({ search: search || undefined });
  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();
  const deleteMutation = useDeleteProduct();

  const sellingPrice = form.costPrice && form.marginPercent
    ? (parseFloat(form.costPrice) * (1 + parseFloat(form.marginPercent) / 100)).toFixed(2)
    : "0.00";

  function openCreate() {
    setForm(emptyForm);
    setEditingId(null);
    setDialogOpen(true);
  }

  function openEdit(product: NonNullable<typeof data>["products"][0]) {
    setForm({
      name: product.name,
      alias: product.alias || "",
      costPrice: String(product.costPrice),
      marginPercent: String(product.marginPercent),
      gstPercent: String(product.gstPercent),
      stock: String(product.stock),
      hsn: product.hsn || "",
      unit: product.unit || "pcs",
    });
    setEditingId(product.id);
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      name: form.name,
      alias: form.alias.trim() || undefined,
      costPrice: parseFloat(form.costPrice),
      marginPercent: parseFloat(form.marginPercent),
      gstPercent: parseFloat(form.gstPercent),
      stock: parseInt(form.stock),
      hsn: form.hsn || undefined,
      unit: form.unit || "pcs",
    };

    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, data: payload });
        toast({ title: "Product updated" });
      } else {
        await createMutation.mutateAsync({ data: payload });
        toast({ title: "Product created" });
      }
      queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
      setDialogOpen(false);
    } catch {
      toast({ title: "Error", description: "Failed to save product", variant: "destructive" });
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Are you sure you want to delete this product?")) return;
    try {
      await deleteMutation.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
      toast({ title: "Product deleted" });
    } catch {
      toast({ title: "Error", description: "Failed to delete product", variant: "destructive" });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Products</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/products/bulk-add")}>
            <PackagePlus className="w-4 h-4 mr-2" />Bulk Add
          </Button>
          <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" />Add Product</Button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Alias</TableHead>
                <TableHead className="text-right">Cost Price</TableHead>
                <TableHead className="text-right">Margin %</TableHead>
                <TableHead className="text-right">Selling Price</TableHead>
                <TableHead className="text-right">GST %</TableHead>
                <TableHead className="text-right">Stock</TableHead>
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
              ) : data?.products.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No products found. Add your first product to get started.</TableCell></TableRow>
              ) : (
                data?.products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm font-mono">{product.alias || "—"}</TableCell>
                    <TableCell className="text-right">{formatCurrency(product.costPrice)}</TableCell>
                    <TableCell className="text-right">{product.marginPercent}%</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(product.sellingPrice)}</TableCell>
                    <TableCell className="text-right">{product.gstPercent}%</TableCell>
                    <TableCell className="text-right">{product.stock}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(product)}><Pencil className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(product.id)} className="text-destructive"><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Product" : "Add Product"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Product Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <Label>Alias <span className="text-muted-foreground font-normal text-xs">(short code for quick typing)</span></Label>
              <Input
                value={form.alias}
                onChange={(e) => setForm({ ...form, alias: e.target.value })}
                placeholder="e.g. samsung-tv, wd40, hp-ink"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Cost Price</Label>
                <Input type="number" step="0.01" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} required />
              </div>
              <div>
                <Label>Margin %</Label>
                <Input type="number" step="0.01" value={form.marginPercent} onChange={(e) => setForm({ ...form, marginPercent: e.target.value })} required />
              </div>
            </div>
            <div className="p-3 bg-muted rounded-md">
              <span className="text-sm text-muted-foreground">Selling Price: </span>
              <span className="font-semibold">{formatCurrency(parseFloat(sellingPrice) || 0)}</span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>GST %</Label>
                <Input type="number" step="0.01" value={form.gstPercent} onChange={(e) => setForm({ ...form, gstPercent: e.target.value })} required />
              </div>
              <div>
                <Label>Stock</Label>
                <Input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} required />
              </div>
              <div>
                <Label>Unit</Label>
                <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>HSN Code</Label>
              <Input value={form.hsn} onChange={(e) => setForm({ ...form, hsn: e.target.value })} placeholder="Optional" />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit">{editingId ? "Update" : "Create"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
