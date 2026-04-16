import { useState } from "react";
import { useListCustomers, useCreateCustomer, useUpdateCustomer, useDeleteCustomer, getListCustomersQueryKey, useGetCustomer, getGetCustomerQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Search, Eye, X, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";

interface CustomerForm {
  name: string;
  phone: string;
  email: string;
  address: string;
  gstin: string;
}

const emptyForm: CustomerForm = { name: "", phone: "", email: "", address: "", gstin: "" };

export function Customers() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useListCustomers({ search: search || undefined });
  const { data: customerDetail } = useGetCustomer(detailId!, { query: { enabled: !!detailId, queryKey: getGetCustomerQueryKey(detailId!) } });
  const createMutation = useCreateCustomer();
  const updateMutation = useUpdateCustomer();
  const deleteMutation = useDeleteCustomer();

  function openCreate() {
    setForm(emptyForm);
    setEditingId(null);
    setDialogOpen(true);
  }

  function openEdit(customer: NonNullable<typeof data>["customers"][0]) {
    setForm({
      name: customer.name,
      phone: customer.phone || "",
      email: customer.email || "",
      address: customer.address || "",
      gstin: customer.gstin || "",
    });
    setEditingId(customer.id);
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      name: form.name,
      phone: form.phone || undefined,
      email: form.email || undefined,
      address: form.address || undefined,
      gstin: form.gstin || undefined,
    };

    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, data: payload });
        toast({ title: "Customer updated" });
      } else {
        await createMutation.mutateAsync({ data: payload });
        toast({ title: "Customer added" });
      }
      queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() });
      setDialogOpen(false);
    } catch {
      toast({ title: "Error", description: "Failed to save customer", variant: "destructive" });
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Are you sure you want to delete this customer?")) return;
    try {
      await deleteMutation.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() });
      toast({ title: "Customer deleted" });
    } catch {
      toast({ title: "Error", description: "Failed to delete customer", variant: "destructive" });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
        <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" />Add Customer</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search customers..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {detailId && customerDetail ? (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">{customerDetail.name}</h2>
              <Button variant="ghost" size="sm" onClick={() => setDetailId(null)}><X className="w-4 h-4" /></Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 text-sm">
              {customerDetail.phone && <div><span className="text-muted-foreground">Phone:</span> {customerDetail.phone}</div>}
              {customerDetail.email && <div><span className="text-muted-foreground">Email:</span> {customerDetail.email}</div>}
              {customerDetail.gstin && <div><span className="text-muted-foreground">GSTIN:</span> {customerDetail.gstin}</div>}
              <div><span className="text-muted-foreground">Total Purchases:</span> {formatCurrency(customerDetail.totalPurchases || 0)}</div>
            </div>
            {customerDetail.address && <div className="text-sm mb-4"><span className="text-muted-foreground">Address:</span> {customerDetail.address}</div>}
            <h3 className="font-semibold mb-3">Purchase History</h3>
            {customerDetail.invoices && customerDetail.invoices.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customerDetail.invoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono text-sm">{inv.invoiceNumber}</TableCell>
                      <TableCell>{formatDate(inv.date)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(inv.grandTotal)}</TableCell>
                      <TableCell>
                        <Link href={`/invoices/${inv.id}`}>
                          <Button variant="ghost" size="sm" title="View Invoice">
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">No purchases yet.</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>GSTIN</TableHead>
                  <TableHead className="text-right">Total Purchases</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 5 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : data?.customers.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No customers found. Add your first customer.</TableCell></TableRow>
                ) : (
                  data?.customers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium">{customer.name}</TableCell>
                      <TableCell>{customer.phone || "-"}</TableCell>
                      <TableCell className="font-mono text-sm">{customer.gstin || "-"}</TableCell>
                      <TableCell className="text-right">{formatCurrency(customer.totalPurchases || 0)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setDetailId(customer.id)}><Eye className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => openEdit(customer)}><Pencil className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(customer.id)} className="text-destructive"><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Customer" : "Add Customer"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Optional" />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Optional" />
              </div>
            </div>
            <div>
              <Label>GSTIN</Label>
              <Input value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} placeholder="Optional" />
            </div>
            <div>
              <Label>Address</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Optional" />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit">{editingId ? "Update" : "Add"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
