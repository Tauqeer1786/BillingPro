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
    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${invoice!.invoiceNumber}</title>
          <meta charset="utf-8" />
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            body { font-family: Arial, sans-serif; font-size: ${isA5 ? "8px" : "9px"}; color: #111; background: #fff; padding: ${isA5 ? "8mm" : "10mm"}; }
            @page { margin: 0; }
            @media print {
              body { padding: ${isA5 ? "8mm" : "10mm"} !important; }
            }
          </style>
        </head>
        <body>${content.outerHTML}</body>
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
    const doc = new jsPDF({ orientation: profile.printOrientation === "landscape" ? "landscape" : "portrait", unit: "mm", format: isA5 ? "a5" : "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = isA5 ? 8 : 10;
    const contentWidth = pageWidth - margin * 2;
    let y = margin + 2;
    const safe = (v: unknown) => String(v ?? "").replace(/₹/g, "Rs.");
    const money = (v: number) => safe(formatCurrency(v));
    const fs = isA5 ? 6 : 7;
    const lineH = isA5 ? 3.2 : 3.8;

    doc.setDrawColor(34, 34, 34);
    doc.setLineWidth(0.6);
    doc.rect(margin - 2, margin - 2, contentWidth + 4, pageHeight - margin * 2 + 4);

    const innerL = margin + 2;
    const innerW = contentWidth - 4;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(isA5 ? 13 : 17);
    const bizLabel = safe(profile.name) + " (TAX INVOICE)";
    doc.text(bizLabel, innerL, y + 4);

    if (profile.phone) {
      doc.setFontSize(isA5 ? 9 : 11);
      doc.text(safe(profile.phone), innerL, y + (isA5 ? 9 : 11));
    }
    let headerTextY = y + (isA5 ? 13 : 16);
    if (profile.gstin) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(fs);
      doc.text("GST NO: " + safe(profile.gstin), innerL, headerTextY);
      headerTextY += lineH;
    }
    if (profile.fssaiNumber) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(fs);
      doc.text("FSSAI: " + safe(profile.fssaiNumber), innerL, headerTextY);
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(fs);
    let addrY = y + 4;
    const addrX = innerL + innerW;
    if (profile.address) { doc.text(safe(profile.address), addrX, addrY, { align: "right" }); addrY += lineH; }
    if (profile.city) { doc.text(safe(profile.city), addrX, addrY, { align: "right" }); addrY += lineH; }
    if (profile.email) { doc.text("Ph:" + safe(profile.email), addrX, addrY, { align: "right" }); }

    y += isA5 ? 18 : 22;
    doc.setDrawColor(85, 85, 85);
    doc.setLineWidth(0.3);
    doc.line(innerL, y, innerL + innerW, y);
    y += 3;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(isA5 ? 9 : 11);
    doc.text(safe(invoice.customerName || "Walk-in Customer"), innerL, y + 3);
    if (invoice.customerAddress) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(fs);
      doc.text(safe(invoice.customerAddress), innerL, y + 3 + lineH + 0.5);
    }

    const billX = innerL + innerW;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(isA5 ? 9 : 11);
    const modeLabel = invoice.paymentMode === "cash" ? "CASH" : "CREDIT";
    doc.text("BILL NO: " + safe(invoice.invoiceNumber) + "  (" + modeLabel + ")", billX, y + 3, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fs);
    doc.text("DATE: " + formatDate(invoice.date), billX, y + 3 + lineH + 0.5, { align: "right" });

    y += isA5 ? 12 : 15;
    doc.setDrawColor(187, 187, 187);
    doc.line(innerL, y, innerL + innerW, y);
    y += 2.5;

    if (invoice.customerGstin || invoice.customerPhone) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(fs);
      let pX = innerL;
      if (invoice.customerGstin) {
        doc.text("PARTY GST NO: " + safe(invoice.customerGstin), pX, y + 2.5);
        pX += 55;
      }
      if (invoice.customerPhone) {
        doc.text("PH.NO: " + safe(invoice.customerPhone), pX, y + 2.5);
      }
      y += lineH + 2;
      doc.setDrawColor(187, 187, 187);
      doc.line(innerL, y, innerL + innerW, y);
      y += 2.5;
    }

    const colWidths = isA5
      ? [5, innerW - 92, 13, 9, 16, 9, 9, 9, 22]
      : [6, innerW - 110, 15, 11, 20, 11, 11, 11, 25];
    const colHeaders = ["Sr.", "Item", "HSN COD", "Qty", "Rate", "Disc%", "CGST%", "SGST%", "Amount"];
    const colAligns: ("left" | "right" | "center")[] = ["center", "left", "center", "center", "right", "center", "center", "center", "right"];

    const rowH = isA5 ? 4.5 : 5.5;
    const tblFont = isA5 ? 5.5 : 6.5;

    const drawRow = (vals: string[], fillColor?: [number, number, number], bold = false) => {
      if (fillColor) { doc.setFillColor(...fillColor); doc.rect(innerL, y, innerW, rowH, "F"); }
      doc.setDrawColor(136, 136, 136);
      doc.rect(innerL, y, innerW, rowH);
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(tblFont);
      let cx = innerL;
      vals.forEach((v, i) => {
        const tx = colAligns[i] === "right" ? cx + colWidths[i] - 1 : colAligns[i] === "center" ? cx + colWidths[i] / 2 : cx + 1.5;
        const displayVal = i === 1 ? (doc.splitTextToSize(safe(v), colWidths[i] - 3)[0] || safe(v)) : safe(v);
        doc.text(displayVal, tx, y + rowH - 1.5, { align: colAligns[i] });
        cx += colWidths[i];
        if (i < vals.length - 1) { doc.setDrawColor(136, 136, 136); doc.line(cx, y, cx, y + rowH); }
      });
      y += rowH;
    };

    drawRow(colHeaders, [240, 240, 240], true);

    doc.setDrawColor(170, 170, 170);
    let totalQty = 0;
    invoice.items.forEach((item, idx) => {
      totalQty += item.quantity;
      const cgstPct = item.gstPercent / 2;
      const sgstPct = item.gstPercent / 2;
      drawRow([
        String(idx + 1),
        item.productName,
        "",
        String(item.quantity),
        money(item.unitPrice),
        item.discountPercent ? String(item.discountPercent) + "%" : "",
        cgstPct ? cgstPct + "%" : "",
        sgstPct ? sgstPct + "%" : "",
        money(item.totalAmount),
      ], idx % 2 === 1 ? [250, 250, 250] : undefined);
    });

    drawRow(["", "", "", String(totalQty), "", "", "", "", ""], [240, 240, 240], true);

    y += 2;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fs);
    doc.text("Rs.In Word: " + numberToWords(invoice.grandTotal), innerL, y + 2);
    doc.setFont("helvetica", "bold");
    doc.text("Total Qty: " + String(totalQty), innerL + innerW, y + 2, { align: "right" });
    doc.setFont("helvetica", "normal");
    y += lineH + 2;
    doc.setDrawColor(187, 187, 187);
    doc.setLineWidth(0.2);
    doc.line(innerL, y, innerL + innerW, y);
    y += 3;

    const bankColWidth = innerW * 0.52;
    const gstColX = innerL + bankColWidth + 3;
    const gstColWidth = innerW - bankColWidth - 3;
    let bankY = y;

    doc.setFontSize(fs);
    if (invoice.notes) {
      doc.setFont("helvetica", "bold");
      const narLines = doc.splitTextToSize("NARRATION: " + safe(invoice.notes), bankColWidth - 2);
      doc.text(narLines, innerL, bankY + lineH);
      bankY += narLines.length * lineH + 1;
      doc.setFont("helvetica", "normal");
    }
    if (profile.bankAccount) {
      const bankLine = "SBI A/C NO: " + safe(profile.bankAccount) + (profile.bankIfsc ? "   IFSC CODE: " + safe(profile.bankIfsc) : "");
      const bLines = doc.splitTextToSize(bankLine, bankColWidth - 2);
      doc.text(bLines, innerL, bankY + lineH);
      bankY += bLines.length * lineH + 1;
    } else if (profile.bankIfsc) {
      doc.text("IFSC CODE: " + safe(profile.bankIfsc), innerL, bankY + lineH);
      bankY += lineH + 1;
    }
    if (profile.bankName && !profile.bankAccount) {
      doc.text("Bank: " + safe(profile.bankName), innerL, bankY + lineH);
      bankY += lineH + 1;
    }
    if (profile.gstin) {
      doc.setFont("helvetica", "bold");
      doc.text("GST NO: " + safe(profile.gstin), innerL, bankY + lineH);
      bankY += lineH + 1;
      doc.setFont("helvetica", "normal");
    }
    if (profile.fssaiNumber) {
      doc.setFont("helvetica", "bold");
      doc.text("FSSAI: " + safe(profile.fssaiNumber), innerL, bankY + lineH);
      bankY += lineH + 1;
      doc.setFont("helvetica", "normal");
    }

    const cgst = invoice.totalGst / 2;
    const sgst = invoice.totalGst / 2;
    const gstRows: [string, string, boolean][] = [
      ["Total Amount Before GST", money(invoice.subtotal), false],
      ["Add: CGST", money(cgst), false],
      ["Add: SGST", money(sgst), false],
      ["Tax Amount GST", money(invoice.totalGst), false],
      ...(invoice.totalDiscount > 0 ? [["Less: Discount", "-" + money(invoice.totalDiscount), false] as [string, string, boolean]] : []),
      ["Net Amount", money(invoice.grandTotal), true],
      ...(invoice.amountPaid > 0 ? [["Amount Paid", money(invoice.amountPaid), false] as [string, string, boolean]] : []),
      ...(invoice.outstandingAmount > 0 ? [["Outstanding Due", money(invoice.outstandingAmount), false] as [string, string, boolean]] : []),
    ];
    const gstRH = isA5 ? 4 : 4.8;
    let gstY = y;
    doc.setFontSize(isA5 ? 5.5 : 6.5);
    gstRows.forEach(([label, value, bold]) => {
      if (bold) { doc.setFillColor(230, 230, 230); doc.rect(gstColX, gstY, gstColWidth, gstRH, "F"); }
      doc.setDrawColor(136, 136, 136);
      doc.rect(gstColX, gstY, gstColWidth, gstRH);
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.text(label, gstColX + 1.5, gstY + gstRH - 1.5);
      doc.text(value, gstColX + gstColWidth - 1.5, gstY + gstRH - 1.5, { align: "right" });
      gstY += gstRH;
    });

    y = Math.max(bankY + lineH + 3, gstY + 3);
    doc.setDrawColor(136, 136, 136);
    doc.setLineWidth(0.3);
    doc.line(innerL, y, innerL + innerW, y);
    y += 4;

    const sigW = innerW / 3;
    const sigLabelY = y + (isA5 ? 17 : 22);
    const sigLineY = y + (isA5 ? 19 : 24);
    const sigs = ["Receiver's Signature", "Seller's Authorized Signature", safe(profile.name) + "\nAuthorized Signatory"];
    sigs.forEach((label, i) => {
      const cx2 = innerL + sigW * i + sigW / 2;
      if (i === 2 && profile.name) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(fs);
        doc.text(safe(profile.name), cx2, y + (isA5 ? 9 : 11), { align: "center" });
        doc.setFont("helvetica", "normal");
        doc.text("Authorized Signatory", cx2, sigLabelY, { align: "center" });
      } else {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(fs);
        doc.text(label, cx2, sigLabelY, { align: "center" });
      }
      doc.setDrawColor(68, 68, 68);
      doc.line(innerL + sigW * i + 3, sigLineY, innerL + sigW * (i + 1) - 3, sigLineY);
    });

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
              {profile.fssaiNumber && (
                <div style={{ fontSize: fs, marginTop: "2px", fontWeight: 600 }}>FSSAI: {profile.fssaiNumber}</div>
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
              <div style={{ fontWeight: 700 }}>Total Qty: {totalQty}</div>
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
                {profile.fssaiNumber && <div style={{ marginTop: "2px" }}><strong>FSSAI:</strong> {profile.fssaiNumber}</div>}
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
