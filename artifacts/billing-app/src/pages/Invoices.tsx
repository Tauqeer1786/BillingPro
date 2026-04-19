import { useState, useMemo } from "react";
import { customFetch, useListInvoices, useDeleteInvoice, getListInvoicesQueryKey } from "@workspace/api-client-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCurrency, formatDate } from "@/lib/format";
import { Plus, Eye, Trash2, Printer, BarChart2, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useBusinessProfile, BusinessProfile } from "@/hooks/use-business-profile";

interface InvoiceItem {
  id?: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  gstPercent: number;
  discountPercent: number;
  totalAmount: number;
}

interface InvoiceFull {
  id: number;
  invoiceNumber: string;
  date: string;
  customerName: string;
  customerAddress: string;
  customerGstin: string;
  customerPhone: string;
  paymentMode: string;
  paymentStatus: string;
  grandTotal: number;
  subtotal: number;
  totalGst: number;
  totalDiscount: number;
  amountPaid: number;
  outstandingAmount: number;
  notes: string;
  items: InvoiceItem[];
}

interface SummaryRow {
  name: string;
  qty: number;
  amount: number;
}

function numberToWords(amount: number): string {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  function convertBelow1000(n: number): string {
    if (n === 0) return "";
    if (n < 20) return ones[n] + " ";
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "") + " ";
    return ones[Math.floor(n / 100)] + " Hundred " + convertBelow1000(n % 100);
  }
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  let result = "";
  if (rupees === 0) {
    result = "Zero";
  } else {
    const crore = Math.floor(rupees / 10000000);
    const lakh = Math.floor((rupees % 10000000) / 100000);
    const thousand = Math.floor((rupees % 100000) / 1000);
    const remainder = rupees % 1000;
    if (crore) result += convertBelow1000(crore) + "Crore ";
    if (lakh) result += convertBelow1000(lakh) + "Lakh ";
    if (thousand) result += convertBelow1000(thousand) + "Thousand ";
    if (remainder) result += convertBelow1000(remainder);
  }
  result = result.trim();
  if (paise > 0) result += " and " + convertBelow1000(paise).trim() + " Paise";
  return result + " Only";
}

function buildInvoiceHtmlBody(invoice: InvoiceFull, profile: BusinessProfile): string {
  const isA5 = profile.printPageSize === "A5";
  const fs = isA5 ? "7px" : "8.5px";
  const pad = isA5 ? "2px 3px" : "3px 5px";
  const cgst = invoice.totalGst / 2;
  const sgst = invoice.totalGst / 2;
  const totalQty = invoice.items.reduce((s, i) => s + i.quantity, 0);

  const itemsRows = invoice.items.map((item, idx) => {
    const cgstPct = item.gstPercent / 2;
    const sgstPct = item.gstPercent / 2;
    return `
      <tr style="background:${idx % 2 === 0 ? "#fff" : "#fafafa"}">
        <td style="border:1px solid #bbb;padding:${pad};font-size:${fs};text-align:center">${idx + 1}</td>
        <td style="border:1px solid #bbb;padding:${pad};font-size:${fs};font-weight:600">${item.productName}</td>
        <td style="border:1px solid #bbb;padding:${pad};font-size:${fs};text-align:center"></td>
        <td style="border:1px solid #bbb;padding:${pad};font-size:${fs};text-align:center">${item.quantity}</td>
        <td style="border:1px solid #bbb;padding:${pad};font-size:${fs};text-align:right">${formatCurrency(item.unitPrice)}</td>
        <td style="border:1px solid #bbb;padding:${pad};font-size:${fs};text-align:center">${item.discountPercent ? item.discountPercent + "%" : ""}</td>
        <td style="border:1px solid #bbb;padding:${pad};font-size:${fs};text-align:center">${cgstPct}%</td>
        <td style="border:1px solid #bbb;padding:${pad};font-size:${fs};text-align:center">${sgstPct}%</td>
        <td style="border:1px solid #bbb;padding:${pad};font-size:${fs};text-align:right;font-weight:700">${formatCurrency(item.totalAmount)}</td>
      </tr>`;
  }).join("");

  const gstRows = [
    ["Total Amount Before GST", formatCurrency(invoice.subtotal), false],
    ["Add: CGST", formatCurrency(cgst), false],
    ["Add: SGST", formatCurrency(sgst), false],
    ["Tax Amount GST", formatCurrency(invoice.totalGst), false],
    ...(invoice.totalDiscount > 0 ? [["Less: Discount", "-" + formatCurrency(invoice.totalDiscount), false]] : []),
    ["Net Amount", formatCurrency(invoice.grandTotal), true],
    ...(invoice.amountPaid > 0 ? [["Amount Paid", formatCurrency(invoice.amountPaid), false]] : []),
    ...(invoice.outstandingAmount > 0 ? [["Outstanding Due", formatCurrency(invoice.outstandingAmount), false]] : []),
  ] as [string, string, boolean][];

  const gstRowsHtml = gstRows.map(([label, value, bold]) => `
    <tr style="${bold ? "background:#f0f0f0" : ""}">
      <td style="border:1px solid ${bold ? "#888" : "#aaa"};padding:${isA5 ? "2px 4px" : "2px 6px"};font-size:${fs};${bold ? "font-weight:700" : ""}">${label}</td>
      <td style="border:1px solid ${bold ? "#888" : "#aaa"};padding:${isA5 ? "2px 4px" : "2px 6px"};font-size:${fs};text-align:right;${bold ? "font-weight:700" : ""}${label === "Outstanding Due" ? "color:#9a3412" : ""}">${value}</td>
    </tr>`).join("");

  return `
  <div style="border:2px solid #222;padding:${isA5 ? "8px" : "12px"}">
    <div style="border-bottom:1px solid #555;padding-bottom:6px;margin-bottom:6px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <div style="font-size:${isA5 ? "17px" : "22px"};font-weight:900;letter-spacing:0.5px">
            ${profile.name} <span style="font-size:${isA5 ? "10px" : "13px"};font-weight:600">(TAX INVOICE)</span>
          </div>
          ${profile.phone ? `<div style="font-size:${isA5 ? "11px" : "14px"};font-weight:700;margin-top:3px">${profile.phone}</div>` : ""}
        </div>
        <div style="text-align:right;font-size:${fs};line-height:1.6">
          ${profile.address ? `<div>${profile.address}</div>` : ""}
          ${profile.city ? `<div>${profile.city}</div>` : ""}
          ${profile.email ? `<div>Ph:${profile.email}</div>` : ""}
        </div>
      </div>
      ${profile.gstin ? `<div style="font-size:${fs};margin-top:4px;font-weight:600">GST NO: ${profile.gstin}</div>` : ""}
      ${profile.fssaiNumber ? `<div style="font-size:${fs};margin-top:2px;font-weight:600">FSSAI: ${profile.fssaiNumber}</div>` : ""}
    </div>

    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid #bbb;padding-bottom:5px;margin-bottom:5px">
      <div>
        <div style="font-size:${isA5 ? "11px" : "13px"};font-weight:800">${invoice.customerName || "Walk-in Customer"}</div>
        ${invoice.customerAddress ? `<div style="font-size:${fs};margin-top:2px">${invoice.customerAddress}</div>` : ""}
      </div>
      <div style="text-align:right">
        <div style="font-size:${isA5 ? "11px" : "13px"};font-weight:800">
          BILL NO: ${invoice.invoiceNumber}
          <span style="font-size:${fs};font-weight:600;margin-left:6px;color:${invoice.paymentMode === "cash" ? "#166534" : "#9a3412"}">
            (${invoice.paymentMode === "cash" ? "CASH" : "CREDIT"})
          </span>
        </div>
        <div style="font-size:${fs};margin-top:3px">DATE: ${formatDate(invoice.date)}</div>
      </div>
    </div>

    <div style="display:flex;gap:16px;font-size:${fs};border-bottom:1px solid #ccc;padding-bottom:4px;margin-bottom:6px">
      ${invoice.customerGstin ? `<div><strong>PARTY GST NO:</strong> ${invoice.customerGstin}</div>` : ""}
      ${invoice.customerPhone ? `<div><strong>PH.NO:</strong> ${invoice.customerPhone}</div>` : ""}
    </div>

    <table style="width:100%;border-collapse:collapse;margin-bottom:0">
      <thead>
        <tr>
          ${["Sr.", "Item", "HSN COD", "Qty", "Rate", "Disc%", "CGST%", "SGST%", "Amount"].map(h =>
            `<th style="border:1px solid #888;padding:${pad};text-align:center;font-size:${fs};font-weight:700;background:#f0f0f0;white-space:nowrap">${h}</th>`
          ).join("")}
        </tr>
      </thead>
      <tbody>${itemsRows}</tbody>
      <tfoot>
        <tr>
          <td colspan="3" style="border:1px solid #888;padding:${pad};font-size:${fs};background:#f5f5f5"></td>
          <td style="border:1px solid #888;padding:${pad};font-size:${fs};text-align:center;font-weight:700;background:#f5f5f5">${totalQty}</td>
          <td colspan="5" style="border:1px solid #888;padding:${pad};font-size:${fs};background:#f5f5f5"></td>
        </tr>
      </tfoot>
    </table>

    <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #ccc;padding:4px 0;margin-top:4px;font-size:${fs}">
      <div><strong>Rs.In Word:</strong> ${numberToWords(invoice.grandTotal)}</div>
      <div style="font-weight:700">Total Qty: ${totalQty}</div>
    </div>

    <div style="display:flex;gap:10px;margin-top:6px;align-items:flex-start">
      <div style="flex:1;font-size:${fs};line-height:1.7">
        ${invoice.notes ? `<div><strong>NARRATION:</strong> ${invoice.notes}</div>` : ""}
        ${profile.bankAccount ? `<div><strong>SBI A/C NO:</strong> ${profile.bankAccount}${profile.bankIfsc ? `&nbsp;&nbsp;<strong>IFSC CODE:</strong> ${profile.bankIfsc}` : ""}</div>` : ""}
        ${profile.bankName && !profile.bankAccount ? `<div><strong>Bank:</strong> ${profile.bankName}</div>` : ""}
        ${profile.gstin ? `<div style="margin-top:3px"><strong>GST NO:</strong> ${profile.gstin}</div>` : ""}
        ${profile.fssaiNumber ? `<div style="margin-top:2px"><strong>FSSAI:</strong> ${profile.fssaiNumber}</div>` : ""}
        ${profile.termsAndConditions ? `<div style="margin-top:4px;color:#555">${profile.termsAndConditions}</div>` : ""}
      </div>
      <div style="min-width:${isA5 ? "180px" : "210px"}">
        <table style="width:100%;border-collapse:collapse">
          <tbody>${gstRowsHtml}</tbody>
        </table>
      </div>
    </div>

    <div style="display:flex;justify-content:space-between;border-top:1px solid #888;margin-top:16px;padding-top:4px">
      ${["Receiver's Signature", "Seller's Authorized Signature", "Authorized Signatory"].map((label, i) => `
        <div style="text-align:center;width:32%;font-size:${fs}">
          ${i === 2 && profile.name ? `<div style="font-weight:700;margin-bottom:2px">${profile.name}</div>` : ""}
          <div style="border-top:1px solid #555;margin-top:${isA5 ? "22px" : "28px"};padding-top:3px;font-weight:600">${label}</div>
        </div>`).join("")}
    </div>
  </div>`;
}

export function Invoices() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState<"all" | "paid" | "unpaid">("all");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryData, setSummaryData] = useState<SummaryRow[]>([]);
  const [isBulkPrinting, setIsBulkPrinting] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { profile } = useBusinessProfile();

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

  const deleteInvoice = useDeleteInvoice({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListInvoicesQueryKey() });
        toast({ title: "Invoice deleted" });
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to delete invoice", variant: "destructive" });
      },
    },
  });

  function handleDelete(id: number, invoiceNumber: string) {
    if (!confirm(`Delete invoice ${invoiceNumber}? This cannot be undone.`)) return;
    deleteInvoice.mutate({ id });
  }

  const displayInvoices = useMemo(() => {
    const all = data?.invoices ?? [];
    if (!search.trim()) return all;
    const q = search.trim().toLowerCase();
    return all.filter(inv =>
      inv.invoiceNumber.toLowerCase().includes(q) ||
      (inv.customerName || "walk-in").toLowerCase().includes(q) ||
      inv.date.includes(q)
    );
  }, [data?.invoices, search]);

  const filteredTotal = displayInvoices.reduce((sum, inv) => sum + inv.grandTotal, 0);

  const allSelected = displayInvoices.length > 0 && displayInvoices.every(i => selectedIds.has(i.id));
  const someSelected = selectedIds.size > 0;

  function toggleSelect(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(displayInvoices.map(i => i.id)));
    }
  }

  async function handleBulkPrint() {
    if (!someSelected) return;
    setIsBulkPrinting(true);
    try {
      const ids = [...selectedIds];
      const fullInvoices = await Promise.all(
        ids.map(id => customFetch<InvoiceFull>(`/api/invoices/${id}`))
      );

      const isA5 = profile.printPageSize === "A5";
      const bodiesHtml = fullInvoices.map((inv, i) => {
        const isLast = i === fullInvoices.length - 1;
        return `<div style="${isLast ? "" : "page-break-after:always"};padding:${isA5 ? "8mm" : "10mm"}">${buildInvoiceHtmlBody(inv, profile)}</div>`;
      }).join("");

      const printWindow = window.open("", "_blank", "width=900,height=700");
      if (!printWindow) {
        toast({ title: "Popup blocked", description: "Allow popups to print invoices", variant: "destructive" });
        return;
      }

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Bulk Print - ${fullInvoices.length} Invoices</title>
            <meta charset="utf-8" />
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              body { font-family: Arial, sans-serif; color: #111; background: #fff; }
              @page { size: ${profile.printPageSize ?? "A4"}; margin: 0; }
            </style>
          </head>
          <body>${bodiesHtml}</body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 400);
    } catch {
      toast({ title: "Failed to fetch invoices for printing", variant: "destructive" });
    } finally {
      setIsBulkPrinting(false);
    }
  }

  async function handleGenerateSummary() {
    if (!someSelected) return;
    setIsSummarizing(true);
    try {
      const ids = [...selectedIds];
      const fullInvoices = await Promise.all(
        ids.map(id => customFetch<InvoiceFull>(`/api/invoices/${id}`))
      );

      const map = new Map<string, { qty: number; amount: number }>();
      for (const inv of fullInvoices) {
        for (const item of inv.items) {
          const existing = map.get(item.productName) ?? { qty: 0, amount: 0 };
          map.set(item.productName, {
            qty: existing.qty + item.quantity,
            amount: existing.amount + item.totalAmount,
          });
        }
      }

      const rows: SummaryRow[] = [...map.entries()]
        .map(([name, { qty, amount }]) => ({ name, qty, amount }))
        .sort((a, b) => b.qty - a.qty);

      setSummaryData(rows);
      setSummaryOpen(true);
    } catch {
      toast({ title: "Failed to generate summary", variant: "destructive" });
    } finally {
      setIsSummarizing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
        <Link href="/invoices/new">
          <Button><Plus className="w-4 h-4 mr-2" />New Invoice</Button>
        </Link>
      </div>

      <div className="flex gap-4 items-end flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search invoice #, customer, date…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 w-64"
          />
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
        {(startDate || endDate || status !== "all" || search) && (
          <Button variant="ghost" size="sm" onClick={() => { setStartDate(""); setEndDate(""); setStatus("all"); setSearch(""); }}>
            Clear
          </Button>
        )}
      </div>

      {someSelected && (
        <div className="flex items-center gap-3 p-3 bg-muted/50 border rounded-lg">
          <span className="text-sm font-medium">{selectedIds.size} invoice{selectedIds.size > 1 ? "s" : ""} selected</span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleBulkPrint}
            disabled={isBulkPrinting}
          >
            <Printer className="w-4 h-4 mr-1.5" />
            {isBulkPrinting ? "Preparing…" : "Print Selected"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerateSummary}
            disabled={isSummarizing}
          >
            <BarChart2 className="w-4 h-4 mr-1.5" />
            {isSummarizing ? "Calculating…" : "Product Summary"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
            Clear Selection
          </Button>
        </div>
      )}

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
            <p className="text-2xl font-bold">{displayInvoices.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all"
                  />
                </TableHead>
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
                    {Array.from({ length: 9 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : displayInvoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    {search ? "No invoices match your search." : "No invoices found. Create your first invoice."}
                  </TableCell>
                </TableRow>
              ) : (
                displayInvoices.map((inv) => (
                  <TableRow key={inv.id} className={selectedIds.has(inv.id) ? "bg-muted/30" : ""}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(inv.id)}
                        onCheckedChange={() => toggleSelect(inv.id)}
                        aria-label={`Select invoice ${inv.invoiceNumber}`}
                      />
                    </TableCell>
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
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
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
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          disabled={deleteInvoice.isPending}
                          onClick={() => handleDelete(inv.id, inv.invoiceNumber)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Product-wise Summary</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Across {selectedIds.size} selected invoice{selectedIds.size > 1 ? "s" : ""}
          </p>
          <div className="border rounded-lg overflow-hidden mt-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Total Qty</TableHead>
                  <TableHead className="text-right">Total Sales</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summaryData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-6 text-muted-foreground">No items found</TableCell>
                  </TableRow>
                ) : (
                  summaryData.map((row) => (
                    <TableRow key={row.name}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.qty}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">{formatCurrency(row.amount)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {summaryData.length > 0 && (
            <div className="flex justify-between text-sm font-semibold pt-2 border-t">
              <span>Total</span>
              <span>{summaryData.reduce((s, r) => s + r.qty, 0)} qty · {formatCurrency(summaryData.reduce((s, r) => s + r.amount, 0))}</span>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
