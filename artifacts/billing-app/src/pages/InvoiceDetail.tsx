import { customFetch, useGetInvoice, getGetInvoiceQueryKey, useDeleteInvoice, getListInvoicesQueryKey } from "@workspace/api-client-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate } from "@/lib/format";
import { ArrowLeft, Download, Printer, Trash2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useBusinessProfile } from "@/hooks/use-business-profile";
import { useRef, useState, useEffect } from "react";
import { jsPDF } from "jspdf";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";

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

export function InvoiceDetail({ id }: { id: number }) {
  const { data: invoice, isLoading } = useGetInvoice(id, { query: { enabled: !!id, queryKey: getGetInvoiceQueryKey(id) } });
  const { profile } = useBusinessProfile();
  const printRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const updateStatus = useMutation({
    mutationFn: (paymentStatus: "paid" | "unpaid") =>
      customFetch(`/api/invoices/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentStatus }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });

  const [editAmountPaid, setEditAmountPaid] = useState<string>("");
  useEffect(() => {
    if (invoice) setEditAmountPaid(String(invoice.amountPaid ?? 0));
  }, [invoice?.amountPaid]);

  const updateAmountPaid = useMutation({
    mutationFn: (amountPaid: number) =>
      customFetch(`/api/invoices/${id}/amount-paid`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountPaid }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast({ title: "Payment updated" });
    },
  });

  const deleteInvoice = useDeleteInvoice({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListInvoicesQueryKey() });
        toast({ title: "Invoice deleted" });
        setLocation("/invoices");
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to delete invoice", variant: "destructive" });
      },
    },
  });

  function handleDelete() {
    if (!confirm(`Delete invoice ${invoice?.invoiceNumber}? This cannot be undone.`)) return;
    deleteInvoice.mutate({ id });
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!invoice) {
    return <div className="text-center py-20 text-muted-foreground">Invoice not found.</div>;
  }

  function handlePrint() {
    const content = printRef.current;
    if (!content) return;

    const isA5 = profile.printPageSize === "A5";
    const pageWidth = isA5 ? "148mm" : "210mm";
    const pageHeight = isA5 ? "210mm" : "297mm";
    const pagePadding = isA5 ? "8px" : "14px";
    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${invoice!.invoiceNumber}</title>
          <meta charset="utf-8" />
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif; font-size: ${isA5 ? "8px" : "9px"}; color: #111; background: #f5f5f5; }
            .invoice-print-body { width: ${pageWidth}; min-height: ${pageHeight}; margin: 0 auto; padding: ${pagePadding} !important; background: #fff; }

            .inv-outer { border: 2px solid #222; padding: 6px; }
            .inv-header { border-bottom: 1px solid #555; padding-bottom: 4px; margin-bottom: 4px; display: flex; justify-content: space-between; align-items: flex-start; }
            .inv-biz-name { font-size: ${isA5 ? "15px" : "18px"}; font-weight: 900; letter-spacing: 0.5px; }
            .inv-biz-tag { font-size: ${isA5 ? "8px" : "9px"}; font-weight: 600; }
            .inv-biz-phone { font-size: ${isA5 ? "10px" : "12px"}; font-weight: 700; margin-top: 2px; }
            .inv-addr { text-align: right; font-size: ${isA5 ? "7px" : "8px"}; line-height: 1.5; }

            .inv-customer-row { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #999; padding-bottom: 3px; margin-bottom: 3px; font-size: ${isA5 ? "7px" : "8px"}; }
            .inv-customer-name { font-size: ${isA5 ? "9px" : "10px"}; font-weight: 700; }
            .inv-bill-info { text-align: right; font-size: ${isA5 ? "8px" : "9px"}; }
            .inv-bill-no { font-weight: 700; font-size: ${isA5 ? "10px" : "11px"}; }

            .inv-party-row { display: flex; gap: 12px; font-size: ${isA5 ? "7px" : "8px"}; border-bottom: 1px solid #bbb; padding-bottom: 2px; margin-bottom: 3px; }

            table { width: 100%; border-collapse: collapse; }
            table th { border: 1px solid #888; padding: ${isA5 ? "2px 3px" : "3px 4px"}; text-align: center; font-size: ${isA5 ? "7px" : "8px"}; font-weight: 700; background: #f0f0f0; }
            table td { border: 1px solid #aaa; padding: ${isA5 ? "2px 3px" : "3px 4px"}; font-size: ${isA5 ? "7px" : "8px"}; vertical-align: top; }
            table tfoot td { border: 1px solid #888; font-size: ${isA5 ? "7px" : "8px"}; font-weight: 600; background: #f9f9f9; padding: ${isA5 ? "2px 3px" : "3px 4px"}; }

            .inv-words-row { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #bbb; padding: 3px 0; font-size: ${isA5 ? "7px" : "8px"}; margin-top: 3px; }

            .inv-bottom { display: flex; gap: 8px; margin-top: 4px; }
            .inv-bank-col { flex: 1; font-size: ${isA5 ? "7px" : "8px"}; }
            .inv-gst-table { min-width: ${isA5 ? "160px" : "195px"}; border-collapse: collapse; }
            .inv-gst-table td { border: 1px solid #999; padding: ${isA5 ? "2px 4px" : "2px 5px"}; font-size: ${isA5 ? "7px" : "8px"}; }
            .inv-gst-table .net-row td { font-weight: 700; background: #f0f0f0; }

            .inv-sign-row { display: flex; justify-content: space-between; border-top: 1px solid #888; margin-top: 6px; padding-top: 4px; font-size: ${isA5 ? "7px" : "8px"}; }
            .inv-sign-col { text-align: center; width: 30%; }
            .inv-sign-line { border-top: 1px solid #444; margin-top: ${isA5 ? "20px" : "26px"}; padding-top: 2px; font-weight: 600; }

            @page { size: ${profile.printPageSize ?? "A4"}; margin: 0; }
            @media print {
              html, body { background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; padding: 0; }
              .invoice-print-body { width: auto; min-height: auto; margin: 0; padding: ${isA5 ? "5mm" : "8mm"} !important; }
            }
          </style>
        </head>
        <body>${content.innerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 400);
  }

  function handleDownloadPdf() {
    const isA5 = profile.printPageSize === "A5";
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: isA5 ? "a5" : "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = isA5 ? 6 : 8;
    const contentWidth = pageWidth - margin * 2;
    let y = margin + 2;
    const safe = (v: unknown) => String(v ?? "").replace(/₹/g, "Rs.");
    const money = (v: number) => safe(formatCurrency(v));
    const fs = isA5 ? 6 : 7.5;

    doc.setDrawColor(50, 50, 50);
    doc.setLineWidth(0.5);
    doc.rect(margin - 1, margin - 1, contentWidth + 2, doc.internal.pageSize.getHeight() - margin * 2 + 2);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(isA5 ? 13 : 16);
    doc.text(safe(profile.name) + " (TAX INVOICE)", pageWidth / 2, y + 4, { align: "center" });

    const addr = [profile.address, profile.city].filter(Boolean).join(", ");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fs);
    if (addr) doc.text(safe(addr), pageWidth / 2, y + (isA5 ? 9 : 11), { align: "center" });
    if (profile.phone) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(isA5 ? 9 : 11);
      doc.text(safe(profile.phone), pageWidth / 2, y + (isA5 ? 14 : 17), { align: "center" });
    }
    if (profile.gstin) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(fs);
      doc.text("GST NO: " + safe(profile.gstin), margin, y + (isA5 ? 18 : 22));
    }

    y += isA5 ? 22 : 26;
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 3;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(isA5 ? 8 : 9.5);
    doc.text(safe(invoice.customerName || "Walk-in Customer"), margin, y + 3);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fs);
    let custY = y + (isA5 ? 6.5 : 7.5);
    if (invoice.customerAddress) { doc.text(safe(invoice.customerAddress), margin, custY); custY += isA5 ? 3 : 3.5; }
    if (invoice.customerGstin) { doc.text("PARTY GST NO: " + safe(invoice.customerGstin), margin, custY); custY += isA5 ? 3 : 3.5; }
    if (invoice.customerPhone) { doc.text("PH.NO: " + safe(invoice.customerPhone), margin, custY); }

    const billX = pageWidth - margin;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(isA5 ? 9 : 11);
    doc.text("BILL NO: " + safe(invoice.invoiceNumber) + "  (" + (invoice.paymentMode === "cash" ? "CASH" : "CREDIT") + ")", billX, y + 3, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fs);
    doc.text("DATE: " + formatDate(invoice.date), billX, y + (isA5 ? 7 : 8.5), { align: "right" });

    y = Math.max(custY, y + (isA5 ? 16 : 18)) + 3;
    doc.line(margin, y, pageWidth - margin, y);
    y += 3;

    const colWidths = isA5
      ? [6, contentWidth - 84, 14, 10, 18, 10, 10, 16]
      : [7, contentWidth - 102, 16, 12, 22, 12, 12, 21];
    const colHeaders = ["Sr.", "Item", "HSN", "Qty", "Rate", "Disc%", "GST%", "Amount"];
    const colAligns: ("left" | "right" | "center")[] = ["center", "left", "center", "center", "right", "center", "center", "right"];

    const rowH = isA5 ? 4.5 : 5.5;
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, y, contentWidth, rowH, "F");
    doc.setDrawColor(130, 130, 130);
    doc.rect(margin, y, contentWidth, rowH);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(isA5 ? 5.5 : 6.5);
    let cx = margin;
    colHeaders.forEach((h, i) => {
      const tx = colAligns[i] === "right" ? cx + colWidths[i] - 1 : colAligns[i] === "center" ? cx + colWidths[i] / 2 : cx + 1;
      doc.text(h, tx, y + rowH - 1.5, { align: colAligns[i] });
      cx += colWidths[i];
      if (i < colHeaders.length - 1) doc.line(cx, y, cx, y + rowH);
    });
    y += rowH;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(isA5 ? 5.5 : 6.5);
    doc.setDrawColor(170, 170, 170);
    let totalQty = 0;
    invoice.items.forEach((item, idx) => {
      totalQty += item.quantity;
      const rh = rowH;
      if (idx % 2 === 1) { doc.setFillColor(250, 250, 250); doc.rect(margin, y, contentWidth, rh, "F"); }
      doc.rect(margin, y, contentWidth, rh);
      const vals = [
        String(idx + 1),
        item.productName,
        "",
        String(item.quantity),
        money(item.unitPrice),
        item.discountPercent ? String(item.discountPercent) + "%" : "",
        item.gstPercent ? String(item.gstPercent) + "%" : "",
        money(item.totalAmount),
      ];
      cx = margin;
      vals.forEach((v, i) => {
        const tx = colAligns[i] === "right" ? cx + colWidths[i] - 1 : colAligns[i] === "center" ? cx + colWidths[i] / 2 : cx + 1;
        const displayVal = i === 1 ? (doc.splitTextToSize(v, colWidths[i] - 2)[0] || v) : v;
        doc.text(safe(displayVal), tx, y + rh - 1.5, { align: colAligns[i] });
        cx += colWidths[i];
        if (i < vals.length - 1) doc.line(cx, y, cx, y + rh);
      });
      y += rh;
    });

    doc.setFillColor(240, 240, 240);
    doc.rect(margin, y, contentWidth, rowH, "F");
    doc.setDrawColor(130, 130, 130);
    doc.rect(margin, y, contentWidth, rowH);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(isA5 ? 5.5 : 6.5);
    cx = margin;
    ["", "", "", String(totalQty), "", "", "", ""].forEach((v, i) => {
      const tx = colAligns[i] === "right" ? cx + colWidths[i] - 1 : colAligns[i] === "center" ? cx + colWidths[i] / 2 : cx + 1;
      if (v) doc.text(v, tx, y + rowH - 1.5, { align: colAligns[i] });
      cx += colWidths[i];
      if (i < 7) doc.line(cx, y, cx, y + rowH);
    });
    y += rowH + 3;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(fs);
    doc.text("Rs.In Word: " + numberToWords(invoice.grandTotal), margin, y);
    y += 4;
    doc.setLineWidth(0.2);
    doc.line(margin, y, pageWidth - margin, y);
    y += 4;

    const bankColWidth = contentWidth * 0.55;
    const gstColX = margin + bankColWidth + 4;
    const gstColWidth = contentWidth - bankColWidth - 4;
    let bankY = y;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(fs);
    if (invoice.notes) { doc.text("NARRATION: " + safe(invoice.notes), margin, bankY); bankY += isA5 ? 3.5 : 4; }
    doc.setFont("helvetica", "normal");
    if (profile.bankAccount) { doc.text("SBI A/C NO: " + safe(profile.bankAccount), margin, bankY); bankY += isA5 ? 3.5 : 4; }
    if (profile.bankIfsc) { doc.text("IFSC CODE: " + safe(profile.bankIfsc), margin, bankY); bankY += isA5 ? 3.5 : 4; }
    if (profile.gstin) { doc.text("GST NO: " + safe(profile.gstin), margin, bankY); bankY += isA5 ? 3.5 : 4; }

    const cgst = invoice.totalGst / 2;
    const sgst = invoice.totalGst / 2;
    const gstRows = [
      ["Total Amount Before GST", money(invoice.subtotal)],
      ["Add: CGST", money(cgst)],
      ["Add: SGST", money(sgst)],
      ["Tax Amount GST", money(invoice.totalGst)],
      ["Net Amount", money(invoice.grandTotal)],
    ];
    const gstRH = isA5 ? 4 : 5;
    let gstY = y;
    doc.setFontSize(isA5 ? 5.5 : 6.5);
    gstRows.forEach((row, idx) => {
      const isNet = idx === gstRows.length - 1;
      if (isNet) { doc.setFillColor(230, 230, 230); doc.rect(gstColX, gstY, gstColWidth, gstRH, "F"); }
      doc.setDrawColor(130, 130, 130);
      doc.rect(gstColX, gstY, gstColWidth, gstRH);
      doc.setFont("helvetica", isNet ? "bold" : "normal");
      doc.text(row[0], gstColX + 1.5, gstY + gstRH - 1.5);
      doc.text(row[1], gstColX + gstColWidth - 1.5, gstY + gstRH - 1.5, { align: "right" });
      gstY += gstRH;
    });

    y = Math.max(bankY, gstY) + 5;
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;

    const sigW = contentWidth / 3;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fs);
    doc.text("Receiver's Signature", margin + sigW / 2, y + (isA5 ? 16 : 20), { align: "center" });
    doc.text("Seller's Authorized Signature", margin + sigW + sigW / 2, y + (isA5 ? 16 : 20), { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.text(safe(profile.name), margin + sigW * 2 + sigW / 2, y + (isA5 ? 10 : 13), { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.text("Authorized Signatory", margin + sigW * 2 + sigW / 2, y + (isA5 ? 16 : 20), { align: "center" });
    [0, 1, 2].forEach(i => doc.line(margin + sigW * i + 2, y + (isA5 ? 18 : 22), margin + sigW * (i + 1) - 2, y + (isA5 ? 18 : 22)));

    doc.save(`${invoice.invoiceNumber}.pdf`);
  }

  const cgst = invoice.totalGst / 2;
  const sgst = invoice.totalGst / 2;
  const hasBank = profile.bankName || profile.bankAccount || profile.bankIfsc;
  const isA5 = profile.printPageSize === "A5";
  const fs = isA5 ? "7px" : "8.5px";
  const totalQty = invoice.items.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-4">
          <Link href="/invoices">
            <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4" /></Button>
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Invoice {invoice.invoiceNumber}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => updateStatus.mutate(invoice.paymentStatus === "paid" ? "unpaid" : "paid")}
            disabled={updateStatus.isPending}
          >
            Mark {invoice.paymentStatus === "paid" ? "Unpaid" : "Paid"}
          </Button>
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" />Print
          </Button>
          <Button onClick={handleDownloadPdf}>
            <Download className="w-4 h-4 mr-2" />Download PDF
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteInvoice.isPending}
          >
            <Trash2 className="w-4 h-4 mr-2" />Delete
          </Button>
        </div>
      </div>

      <div className="print:hidden flex items-center gap-3 p-3 bg-muted/40 border rounded-lg">
        <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Amount Paid (₹)</span>
        <Input
          type="number"
          min="0"
          step="0.01"
          max={invoice.grandTotal}
          value={editAmountPaid}
          onChange={(e) => setEditAmountPaid(e.target.value)}
          className="w-36 h-8 text-right text-sm"
        />
        <Button
          size="sm"
          variant="outline"
          disabled={updateAmountPaid.isPending}
          onClick={() => updateAmountPaid.mutate(parseFloat(editAmountPaid) || 0)}
        >
          Save
        </Button>
        <div className="flex-1" />
        <span className="text-sm text-muted-foreground">Grand Total: <strong>{formatCurrency(invoice.grandTotal)}</strong></span>
        <span className={`text-sm font-semibold ${invoice.outstandingAmount <= 0 ? "text-green-600" : "text-orange-600"}`}>
          Outstanding: {formatCurrency(invoice.outstandingAmount)}
        </span>
      </div>

      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <div ref={printRef} className={`invoice-print-body ${isA5 ? "p-3" : "p-5"}`}>
          <div style={{ border: "2px solid #222", padding: isA5 ? "8px" : "12px" }}>

            {/* ── HEADER ── */}
            <div style={{ borderBottom: "1px solid #555", paddingBottom: "6px", marginBottom: "6px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: isA5 ? "17px" : "22px", fontWeight: 900, letterSpacing: "0.5px" }}>
                    {profile.name} <span style={{ fontSize: isA5 ? "10px" : "13px", fontWeight: 600 }}>(TAX INVOICE)</span>
                  </div>
                  {profile.phone && (
                    <div style={{ fontSize: isA5 ? "11px" : "14px", fontWeight: 700, marginTop: "3px" }}>{profile.phone}</div>
                  )}
                </div>
                <div style={{ textAlign: "right", fontSize: fs, lineHeight: "1.6" }}>
                  {profile.address && <div>{profile.address}</div>}
                  {profile.city && <div>{profile.city}</div>}
                  {profile.email && <div>Ph:{profile.email}</div>}
                </div>
              </div>
              {profile.gstin && (
                <div style={{ fontSize: fs, marginTop: "4px", fontWeight: 600 }}>GST NO: {profile.gstin}</div>
              )}
            </div>

            {/* ── CUSTOMER & BILL INFO ── */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid #bbb", paddingBottom: "5px", marginBottom: "5px" }}>
              <div>
                <div style={{ fontSize: isA5 ? "11px" : "13px", fontWeight: 800 }}>{invoice.customerName || "Walk-in Customer"}</div>
                {invoice.customerAddress && <div style={{ fontSize: fs, marginTop: "2px" }}>{invoice.customerAddress}</div>}
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: isA5 ? "11px" : "13px", fontWeight: 800 }}>
                  BILL NO: {invoice.invoiceNumber}
                  <span style={{ fontSize: fs, fontWeight: 600, marginLeft: "6px", color: invoice.paymentMode === "cash" ? "#166534" : "#9a3412" }}>
                    ({invoice.paymentMode === "cash" ? "CASH" : "CREDIT"})
                  </span>
                </div>
                <div style={{ fontSize: fs, marginTop: "3px" }}>DATE: {formatDate(invoice.date)}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: "16px", fontSize: fs, borderBottom: "1px solid #ccc", paddingBottom: "4px", marginBottom: "6px" }}>
              {invoice.customerGstin && <div><strong>PARTY GST NO:</strong> {invoice.customerGstin}</div>}
              {invoice.customerPhone && <div><strong>PH.NO:</strong> {invoice.customerPhone}</div>}
            </div>

            {/* ── ITEMS TABLE ── */}
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "0" }}>
              <thead>
                <tr>
                  {["Sr.", "Item", "HSN COD", "Qty", "Rate", "Disc%", "CGST%", "SGST%", "Amount"].map((h) => (
                    <th key={h} style={{ border: "1px solid #888", padding: isA5 ? "2px 3px" : "3px 5px", textAlign: "center", fontSize: fs, fontWeight: 700, background: "#f0f0f0", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item, idx) => {
                  const cgstPct = item.gstPercent / 2;
                  const sgstPct = item.gstPercent / 2;
                  return (
                    <tr key={item.id || idx} style={{ background: idx % 2 === 0 ? "#fff" : "#fafafa" }}>
                      <td style={{ border: "1px solid #bbb", padding: isA5 ? "2px 3px" : "3px 5px", fontSize: fs, textAlign: "center" }}>{idx + 1}</td>
                      <td style={{ border: "1px solid #bbb", padding: isA5 ? "2px 3px" : "3px 5px", fontSize: fs, fontWeight: 600 }}>{item.productName}</td>
                      <td style={{ border: "1px solid #bbb", padding: isA5 ? "2px 3px" : "3px 5px", fontSize: fs, textAlign: "center" }}></td>
                      <td style={{ border: "1px solid #bbb", padding: isA5 ? "2px 3px" : "3px 5px", fontSize: fs, textAlign: "center" }}>{item.quantity}</td>
                      <td style={{ border: "1px solid #bbb", padding: isA5 ? "2px 3px" : "3px 5px", fontSize: fs, textAlign: "right" }}>{formatCurrency(item.unitPrice)}</td>
                      <td style={{ border: "1px solid #bbb", padding: isA5 ? "2px 3px" : "3px 5px", fontSize: fs, textAlign: "center" }}>{item.discountPercent ? `${item.discountPercent}%` : ""}</td>
                      <td style={{ border: "1px solid #bbb", padding: isA5 ? "2px 3px" : "3px 5px", fontSize: fs, textAlign: "center" }}>{cgstPct}%</td>
                      <td style={{ border: "1px solid #bbb", padding: isA5 ? "2px 3px" : "3px 5px", fontSize: fs, textAlign: "center" }}>{sgstPct}%</td>
                      <td style={{ border: "1px solid #bbb", padding: isA5 ? "2px 3px" : "3px 5px", fontSize: fs, textAlign: "right", fontWeight: 700 }}>{formatCurrency(item.totalAmount)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} style={{ border: "1px solid #888", padding: isA5 ? "2px 3px" : "3px 5px", fontSize: fs, background: "#f5f5f5" }}></td>
                  <td style={{ border: "1px solid #888", padding: isA5 ? "2px 3px" : "3px 5px", fontSize: fs, textAlign: "center", fontWeight: 700, background: "#f5f5f5" }}>{totalQty}</td>
                  <td colSpan={5} style={{ border: "1px solid #888", padding: isA5 ? "2px 3px" : "3px 5px", fontSize: fs, background: "#f5f5f5" }}></td>
                </tr>
              </tfoot>
            </table>

            {/* ── AMOUNT IN WORDS ── */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #ccc", padding: "4px 0", marginTop: "4px", fontSize: fs }}>
              <div><strong>Rs.In Word:</strong> {numberToWords(invoice.grandTotal)}</div>
              <div style={{ fontWeight: 700 }}>{totalQty}.00</div>
            </div>

            {/* ── BOTTOM: BANK + GST SUMMARY ── */}
            <div style={{ display: "flex", gap: "10px", marginTop: "6px", alignItems: "flex-start" }}>
              <div style={{ flex: 1, fontSize: fs, lineHeight: "1.7" }}>
                {invoice.notes && <div><strong>NARRATION:</strong> {invoice.notes}</div>}
                {profile.bankAccount && (
                  <div>
                    <strong>SBI A/C NO:</strong> {profile.bankAccount}
                    {profile.bankIfsc && <span>  &nbsp;<strong>IFSC CODE:</strong> {profile.bankIfsc}</span>}
                  </div>
                )}
                {profile.bankName && !profile.bankAccount && <div><strong>Bank:</strong> {profile.bankName}</div>}
                {profile.gstin && <div style={{ marginTop: "3px" }}><strong>GST NO:</strong> {profile.gstin}</div>}
                {profile.termsAndConditions && (
                  <div style={{ marginTop: "4px", color: "#555" }}>{profile.termsAndConditions}</div>
                )}
              </div>
              <div style={{ minWidth: isA5 ? "180px" : "210px" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <tbody>
                    {[
                      ["Total Amount Before GST", formatCurrency(invoice.subtotal)],
                      ["Add: CGST", formatCurrency(cgst)],
                      ["Add: SGST", formatCurrency(sgst)],
                      ["Tax Amount GST", formatCurrency(invoice.totalGst)],
                    ].map(([label, value]) => (
                      <tr key={label}>
                        <td style={{ border: "1px solid #aaa", padding: isA5 ? "2px 4px" : "2px 6px", fontSize: fs }}>{label}</td>
                        <td style={{ border: "1px solid #aaa", padding: isA5 ? "2px 4px" : "2px 6px", fontSize: fs, textAlign: "right" }}>{value}</td>
                      </tr>
                    ))}
                    {invoice.totalDiscount > 0 && (
                      <tr>
                        <td style={{ border: "1px solid #aaa", padding: isA5 ? "2px 4px" : "2px 6px", fontSize: fs }}>Less: Discount</td>
                        <td style={{ border: "1px solid #aaa", padding: isA5 ? "2px 4px" : "2px 6px", fontSize: fs, textAlign: "right", color: "#e53e3e" }}>-{formatCurrency(invoice.totalDiscount)}</td>
                      </tr>
                    )}
                    <tr style={{ background: "#f0f0f0" }}>
                      <td style={{ border: "1px solid #888", padding: isA5 ? "2px 4px" : "3px 6px", fontSize: fs, fontWeight: 700 }}>Net Amount</td>
                      <td style={{ border: "1px solid #888", padding: isA5 ? "2px 4px" : "3px 6px", fontSize: fs, textAlign: "right", fontWeight: 700 }}>{formatCurrency(invoice.grandTotal)}</td>
                    </tr>
                    {invoice.amountPaid > 0 && (
                      <tr>
                        <td style={{ border: "1px solid #aaa", padding: isA5 ? "2px 4px" : "2px 6px", fontSize: fs }}>Amount Paid</td>
                        <td style={{ border: "1px solid #aaa", padding: isA5 ? "2px 4px" : "2px 6px", fontSize: fs, textAlign: "right" }}>{formatCurrency(invoice.amountPaid)}</td>
                      </tr>
                    )}
                    {invoice.outstandingAmount > 0 && (
                      <tr>
                        <td style={{ border: "1px solid #aaa", padding: isA5 ? "2px 4px" : "2px 6px", fontSize: fs, color: "#9a3412" }}>Outstanding Due</td>
                        <td style={{ border: "1px solid #aaa", padding: isA5 ? "2px 4px" : "2px 6px", fontSize: fs, textAlign: "right", color: "#9a3412" }}>{formatCurrency(invoice.outstandingAmount)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── SIGNATURES ── */}
            <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #888", marginTop: "16px", paddingTop: "4px" }}>
              {[
                { label: "Receiver's Signature", sub: "" },
                { label: "Seller's Authorized Signature", sub: "" },
                { label: "Authorized Signatory", sub: profile.name },
              ].map(({ label, sub }) => (
                <div key={label} style={{ textAlign: "center", width: "32%", fontSize: fs }}>
                  {sub && <div style={{ fontWeight: 700, marginBottom: "2px" }}>{sub}</div>}
                  <div style={{ borderTop: "1px solid #555", marginTop: isA5 ? "22px" : "28px", paddingTop: "3px", fontWeight: 600 }}>{label}</div>
                </div>
              ))}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
