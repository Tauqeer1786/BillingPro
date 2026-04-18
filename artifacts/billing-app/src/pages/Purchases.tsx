import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDate } from "@/lib/format";
import { Plus, ShoppingCart, Trash2, Eye } from "lucide-react";

interface PurchaseSummary {
  id: number;
  supplierName: string;
  date: string;
  notes: string | null;
  totalAmount: number;
  itemCount: number;
  createdAt: string;
}

interface PurchaseDetail extends PurchaseSummary {
  items: Array<{
    id: number;
    productId: number | null;
    productName: string;
    quantity: number;
    costPrice: number;
    totalCost: number;
  }>;
}

function usePurchases(page: number) {
  return useQuery<{ purchases: PurchaseSummary[]; total: number }>({
    queryKey: ["purchases", page],
    queryFn: () => customFetch(`/api/purchases?page=${page}&limit=20`),
  });
}

function usePurchaseDetail(id: number | null) {
  return useQuery<PurchaseDetail>({
    queryKey: ["purchase", id],
    queryFn: () => customFetch(`/api/purchases/${id}`),
    enabled: id !== null,
  });
}

function useDeletePurchase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => customFetch(`/api/purchases/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["purchases"] }),
  });
}

export function Purchases() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [page] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data, isLoading } = usePurchases(page);
  const { data: detail } = usePurchaseDetail(selectedId);
  const deleteMutation = useDeletePurchase();

  async function handleDelete(id: number, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Delete this purchase? Stock will be reversed for linked products.")) return;
    try {
      await deleteMutation.mutateAsync(id);
      if (selectedId === id) setSelectedId(null);
      toast({ title: "Purchase deleted", description: "Stock has been reversed." });
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Purchases</h1>
          <p className="text-muted-foreground text-sm mt-1">Stock-in entries from suppliers</p>
        </div>
        <Button onClick={() => navigate("/purchases/new")}>
          <Plus className="w-4 h-4 mr-2" />
          New Purchase
        </Button>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        <div className={selectedId ? "lg:col-span-3" : "lg:col-span-5"}>
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-8 text-center text-muted-foreground">Loading...</div>
              ) : !data?.purchases?.length ? (
                <div className="flex flex-col items-center py-16 gap-4 text-muted-foreground">
                  <ShoppingCart className="w-12 h-12 opacity-30" />
                  <div className="text-center">
                    <p className="font-medium">No purchases yet</p>
                    <p className="text-sm">Record supplier purchases to automatically increase stock.</p>
                  </div>
                  <Button onClick={() => navigate("/purchases/new")}>
                    <Plus className="w-4 h-4 mr-2" />
                    New Purchase
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Items</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.purchases.map(p => (
                      <TableRow
                        key={p.id}
                        className={`cursor-pointer hover:bg-muted/50 ${selectedId === p.id ? "bg-muted" : ""}`}
                        onClick={() => setSelectedId(prev => prev === p.id ? null : p.id)}
                      >
                        <TableCell>
                          <div className="font-medium">{p.supplierName}</div>
                          {p.notes && <div className="text-xs text-muted-foreground truncate max-w-48">{p.notes}</div>}
                        </TableCell>
                        <TableCell>{formatDate(p.date)}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary">{p.itemCount} item{p.itemCount !== 1 ? "s" : ""}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(p.totalAmount)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 justify-end">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={e => { e.stopPropagation(); setSelectedId(p.id); }}>
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={e => handleDelete(p.id, e)}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {selectedId && detail && (
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Purchase #{detail.id}</CardTitle>
                <CardDescription>
                  <span className="font-medium">{detail.supplierName}</span> · {formatDate(detail.date)}
                </CardDescription>
                {detail.notes && <p className="text-sm text-muted-foreground mt-1">{detail.notes}</p>}
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.items.map(item => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium text-sm">
                          {item.productName}
                          {item.productId && <span className="text-xs text-muted-foreground block">Linked to inventory</span>}
                        </TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.costPrice)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(item.totalCost)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="border-t px-4 py-3 flex justify-between items-center">
                  <span className="font-medium text-sm">Total</span>
                  <span className="font-bold">{formatCurrency(detail.totalAmount)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
