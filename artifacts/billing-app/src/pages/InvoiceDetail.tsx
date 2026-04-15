import { customFetch, useGetInvoice, getGetInvoiceQueryKey } from "@workspace/api-client-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate } from "@/lib/format";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { Link } from "wouter";
import { useBusinessProfile } from "@/hooks/use-business-profile";
import { useRef } from "react";
import { jsPDF } from "jspdf";

export function InvoiceDetail({ id }: { id: number }) {
  const { data: invoice, isLoading } = useGetInvoice(id, { query: { enabled: !!id, queryKey: getGetInvoiceQueryKey(id) } });
  const { profile } = useBusinessProfile();
  const printRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

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
    const pagePadding = isA5 ? "18px" : "32px";
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
            body { font-family: Arial, sans-serif; font-size: ${isA5 ? "11px" : "13px"}; color: #111; background: #f5f5f5; }
            .invoice-print-body { width: ${pageWidth}; min-height: ${pageHeight}; margin: 0 auto; padding: ${pagePadding} !important; background: #fff; }
            .invoice-wrap { max-width: 860px; margin: 0 auto; padding: ${pagePadding}; }

            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1a1a1a; padding-bottom: 20px; margin-bottom: 20px; }
            .business-name { font-size: 24px; font-weight: 800; color: #1a1a1a; letter-spacing: -0.5px; }
            .business-sub { font-size: 12px; color: #555; margin-top: 4px; line-height: 1.6; }
            .invoice-label { text-align: right; }
            .invoice-label h2 { font-size: 28px; font-weight: 800; color: #1a1a1a; letter-spacing: 2px; }
            .invoice-label .inv-num { font-size: 14px; font-weight: 600; color: #444; margin-top: 4px; }
            .invoice-label .inv-date { font-size: 12px; color: #666; margin-top: 2px; }

            .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
            .meta-box { background: #f8f8f8; border: 1px solid #e0e0e0; border-radius: 6px; padding: 14px 16px; }
            .meta-box h4 { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 8px; }
            .meta-box p { font-size: 13px; color: #222; line-height: 1.6; }
            .meta-box .strong { font-weight: 700; font-size: 14px; }

            table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
            thead tr { background: #1a1a1a; color: #fff; }
            thead th { padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
            thead th.right { text-align: right; }
            tbody tr { border-bottom: 1px solid #eee; }
            tbody tr:nth-child(even) { background: #fafafa; }
            tbody td { padding: 10px 12px; font-size: 13px; }
            tbody td.right { text-align: right; }
            tbody td.bold { font-weight: 600; }
            tfoot tr { border-top: 2px solid #ddd; }
            tfoot td { padding: 8px 12px; font-size: 13px; }
            tfoot td.right { text-align: right; }

            .totals { display: flex; justify-content: flex-end; margin-bottom: 24px; }
            .totals-box { width: 300px; border: 1px solid #e0e0e0; border-radius: 6px; overflow: hidden; }
            .totals-row { display: flex; justify-content: space-between; padding: 8px 14px; border-bottom: 1px solid #f0f0f0; font-size: 13px; }
            .totals-row:last-child { border-bottom: none; background: #1a1a1a; color: #fff; font-weight: 700; font-size: 15px; padding: 12px 14px; }
            .totals-label { color: #666; }
            .totals-row:last-child .totals-label { color: #ccc; }

            .bottom { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 8px; }
            .bank-box { background: #f8f8f8; border: 1px solid #e0e0e0; border-radius: 6px; padding: 14px 16px; }
            .bank-box h4 { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 8px; }
            .bank-row { font-size: 12px; color: #444; margin-bottom: 4px; }
            .bank-row span { font-weight: 600; color: #111; }

            .notes-box { background: #fffdf0; border: 1px solid #f0e0a0; border-radius: 6px; padding: 14px 16px; }
            .notes-box h4 { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 6px; }
            .notes-box p { font-size: 12px; color: #555; line-height: 1.6; }

            .footer { margin-top: 32px; border-top: 1px solid #ddd; padding-top: 16px; display: flex; justify-content: space-between; align-items: flex-end; }
            .footer-terms { font-size: 11px; color: #888; max-width: 400px; line-height: 1.5; }
            .footer-sign { text-align: right; font-size: 12px; color: #444; }
            .footer-sign .sign-line { border-top: 1px solid #999; margin-top: 40px; padding-top: 6px; font-size: 11px; color: #888; }
            @page { size: ${profile.printPageSize}; margin: 10mm; }
            @media print {
              body { background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .invoice-print-body { width: auto; min-height: auto; margin: 0; padding: 0 !important; }
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
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: isA5 ? "a5" : "a4",
    });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = isA5 ? 8 : 12;
    const contentWidth = pageWidth - margin * 2;
    let y = margin;

    const safe = (value: unknown) => String(value ?? "").replace(/₹/g, "Rs. ");
    const money = (value: number) => safe(formatCurrency(value));
    const line = (fromY: number) => doc.line(margin, fromY, pageWidth - margin, fromY);
    const addWrappedText = (text: string, x: number, textY: number, maxWidth: number, lineHeight: number) => {
      const lines = doc.splitTextToSize(safe(text), maxWidth);
      doc.text(lines, x, textY);
      return lines.length * lineHeight;
    };
    const ensureSpace = (needed: number) => {
      if (y + needed <= pageHeight - margin) return;
      doc.addPage();
      y = margin;
    };

    doc.setTextColor(17, 17, 17);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(isA5 ? 15 : 20);
    doc.text(safe(profile.name), margin, y + 5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(isA5 ? 7 : 9);
    let businessY = y + (isA5 ? 11 : 13);
    [profile.address, profile.city, profile.phone ? `Ph: ${profile.phone}` : "", profile.email, profile.gstin ? `GSTIN: ${profile.gstin}` : ""]
      .filter(Boolean)
      .forEach((text) => {
        doc.text(safe(text), margin, businessY);
        businessY += isA5 ? 4 : 5;
      });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(isA5 ? 17 : 24);
    doc.text("INVOICE", pageWidth - margin, y + 5, { align: "right" });
    doc.setFontSize(isA5 ? 8 : 11);
    doc.text(safe(invoice.invoiceNumber), pageWidth - margin, y + (isA5 ? 12 : 15), { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.text(`Date: ${formatDate(invoice.date)}`, pageWidth - margin, y + (isA5 ? 17 : 21), { align: "right" });
    doc.setFont("helvetica", "bold");
    doc.setTextColor(invoice.paymentStatus === "paid" ? 22 : 154, invoice.paymentStatus === "paid" ? 101 : 52, invoice.paymentStatus === "paid" ? 52 : 18);
    doc.text(invoice.paymentStatus === "paid" ? "PAID" : "DUE / UNPAID", pageWidth - margin, y + (isA5 ? 22 : 27), { align: "right" });
    doc.setTextColor(17, 17, 17);

    y = Math.max(businessY, y + (isA5 ? 27 : 34));
    line(y);
    y += isA5 ? 7 : 10;

    const boxHeight = isA5 ? 22 : 28;
    doc.setDrawColor(224, 224, 224);
    doc.roundedRect(margin, y, contentWidth / 2 - 3, boxHeight, 1.5, 1.5);
    doc.roundedRect(margin + contentWidth / 2 + 3, y, contentWidth / 2 - 3, boxHeight, 1.5, 1.5);
    doc.setFontSize(isA5 ? 6 : 8);
    doc.setTextColor(120, 120, 120);
    doc.setFont("helvetica", "bold");
    doc.text("BILL TO", margin + 4, y + 6);
    doc.text("INVOICE DETAILS", margin + contentWidth / 2 + 7, y + 6);
    doc.setFontSize(isA5 ? 8 : 10);
    doc.setTextColor(17, 17, 17);
    doc.text(safe(invoice.customerName || "Walk-in Customer"), margin + 4, y + 13);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(isA5 ? 7 : 9);
    const detailsX = margin + contentWidth / 2 + 7;
    doc.text(`Invoice #: ${safe(invoice.invoiceNumber)}`, detailsX, y + 13);
    doc.text(`Date: ${formatDate(invoice.date)}`, detailsX, y + 18);
    doc.text(`Status: ${invoice.paymentStatus === "paid" ? "Paid" : "Due / Unpaid"}`, detailsX, y + 23);
    y += boxHeight + (isA5 ? 7 : 10);

    const tableFont = isA5 ? 6.5 : 8;
    const rowHeight = isA5 ? 7 : 9;
    const columns = isA5
      ? [
          { label: "#", width: 7, align: "left" as const },
          { label: "Product", width: contentWidth - 62, align: "left" as const },
          { label: "Qty", width: 10, align: "right" as const },
          { label: "Rate", width: 18, align: "right" as const },
          { label: "GST", width: 10, align: "right" as const },
          { label: "Total", width: 17, align: "right" as const },
        ]
      : [
          { label: "#", width: 8, align: "left" as const },
          { label: "Product / Description", width: contentWidth - 100, align: "left" as const },
          { label: "Qty", width: 12, align: "right" as const },
          { label: "Unit Price", width: 23, align: "right" as const },
          { label: "GST%", width: 14, align: "right" as const },
          { label: "GST Amt", width: 22, align: "right" as const },
          { label: "Amount", width: 21, align: "right" as const },
        ];

    const drawHeader = () => {
      ensureSpace(rowHeight + 2);
      doc.setFillColor(26, 26, 26);
      doc.rect(margin, y, contentWidth, rowHeight, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(tableFont);
      let x = margin + 2;
      columns.forEach((column) => {
        doc.text(column.label, column.align === "right" ? x + column.width - 2 : x, y + rowHeight - 3, { align: column.align });
        x += column.width;
      });
      doc.setTextColor(17, 17, 17);
      y += rowHeight;
    };

    drawHeader();
    doc.setFont("helvetica", "normal");
    invoice.items.forEach((item, index) => {
      ensureSpace(rowHeight + 2);
      if (index % 2 === 1) {
        doc.setFillColor(250, 250, 250);
        doc.rect(margin, y, contentWidth, rowHeight, "F");
      }
      doc.setDrawColor(238, 238, 238);
      doc.line(margin, y + rowHeight, pageWidth - margin, y + rowHeight);
      doc.setFontSize(tableFont);
      let x = margin + 2;
      const values = isA5
        ? [
            String(index + 1),
            item.productName,
            String(item.quantity),
            money(item.unitPrice),
            `${item.gstPercent}%`,
            money(item.totalAmount),
          ]
        : [
            String(index + 1),
            item.productName,
            String(item.quantity),
            money(item.unitPrice),
            `${item.gstPercent}%`,
            money(item.gstAmount),
            money(item.totalAmount),
          ];
      columns.forEach((column, columnIndex) => {
        const value = safe(values[columnIndex]);
        const text = columnIndex === 1 ? doc.splitTextToSize(value, column.width - 4)[0] || value : value;
        doc.text(text, column.align === "right" ? x + column.width - 2 : x, y + rowHeight - 3, { align: column.align });
        x += column.width;
      });
      y += rowHeight;
    });

    y += isA5 ? 5 : 8;
    ensureSpace(isA5 ? 44 : 55);
    const totalsWidth = isA5 ? 58 : 75;
    const totalsX = pageWidth - margin - totalsWidth;
    const totalRows = [
      ["Subtotal", money(invoice.subtotal)],
      ["CGST", money(cgst)],
      ["SGST", money(sgst)],
      ...(invoice.totalDiscount > 0 ? [["Discount", `-${money(invoice.totalDiscount)}`]] : []),
      ["Grand Total", money(invoice.grandTotal)],
      ["Outstanding Due", money(invoice.outstandingAmount)],
    ];
    doc.setFontSize(isA5 ? 7 : 9);
    totalRows.forEach(([label, value], index) => {
      const isGrand = label === "Grand Total";
      const isDue = label === "Outstanding Due";
      if (isGrand) doc.setFillColor(26, 26, 26);
      else if (isDue) doc.setFillColor(invoice.paymentStatus === "paid" ? 220 : 255, invoice.paymentStatus === "paid" ? 252 : 237, invoice.paymentStatus === "paid" ? 231 : 213);
      else doc.setFillColor(255, 255, 255);
      doc.rect(totalsX, y, totalsWidth, rowHeight, isGrand || isDue ? "F" : "S");
      doc.setFont("helvetica", isGrand || isDue ? "bold" : "normal");
      doc.setTextColor(isGrand ? 255 : 17, isGrand ? 255 : 17, isGrand ? 255 : 17);
      doc.text(label, totalsX + 3, y + rowHeight - 3);
      doc.text(value, totalsX + totalsWidth - 3, y + rowHeight - 3, { align: "right" });
      doc.setTextColor(17, 17, 17);
      y += rowHeight;
      if (index === totalRows.length - 1) y += isA5 ? 4 : 6;
    });

    if (hasBank || invoice.notes || profile.termsAndConditions) {
      ensureSpace(isA5 ? 32 : 40);
      const bottomWidth = contentWidth / 2 - 3;
      if (hasBank) {
        doc.roundedRect(margin, y, bottomWidth, isA5 ? 28 : 34, 1.5, 1.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(120, 120, 120);
        doc.setFontSize(isA5 ? 6 : 8);
        doc.text("BANK DETAILS", margin + 4, y + 6);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(17, 17, 17);
        doc.setFontSize(isA5 ? 6.5 : 8);
        let bankY = y + 12;
        if (profile.bankName) {
          doc.text(`Bank: ${safe(profile.bankName)}`, margin + 4, bankY);
          bankY += isA5 ? 4 : 5;
        }
        if (profile.bankAccount) {
          doc.text(`Account: ${safe(profile.bankAccount)}`, margin + 4, bankY);
          bankY += isA5 ? 4 : 5;
        }
        if (profile.bankIfsc) doc.text(`IFSC: ${safe(profile.bankIfsc)}`, margin + 4, bankY);
      }
      if (invoice.notes || profile.termsAndConditions) {
        const notesX = margin + contentWidth / 2 + 3;
        doc.roundedRect(notesX, y, bottomWidth, isA5 ? 28 : 34, 1.5, 1.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(120, 120, 120);
        doc.setFontSize(isA5 ? 6 : 8);
        doc.text(invoice.notes ? "NOTES" : "TERMS & CONDITIONS", notesX + 4, y + 6);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(17, 17, 17);
        doc.setFontSize(isA5 ? 6.5 : 8);
        addWrappedText(invoice.notes || profile.termsAndConditions, notesX + 4, y + 12, bottomWidth - 8, isA5 ? 3.5 : 4.5);
      }
      y += isA5 ? 34 : 42;
    }

    ensureSpace(isA5 ? 22 : 28);
    line(y);
    y += isA5 ? 7 : 9;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(140, 140, 140);
    doc.setFontSize(isA5 ? 6 : 8);
    doc.text("Generated by Billing App", margin, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(68, 68, 68);
    doc.text(safe(profile.name), pageWidth - margin, y, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setTextColor(140, 140, 140);
    doc.text("Authorised Signatory", pageWidth - margin, y + (isA5 ? 8 : 12), { align: "right" });

    doc.save(`${invoice.invoiceNumber}.pdf`);
  }

  const cgst = invoice.totalGst / 2;
  const sgst = invoice.totalGst / 2;
  const hasBank = profile.bankName || profile.bankAccount || profile.bankIfsc;

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
        </div>
      </div>

      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <div ref={printRef} className="invoice-print-body p-8">
          <div className="header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "3px solid #1a1a1a", paddingBottom: "20px", marginBottom: "20px" }}>
            <div>
              <div style={{ fontSize: "22px", fontWeight: 800, color: "#1a1a1a", letterSpacing: "-0.5px" }}>{profile.name}</div>
              <div style={{ fontSize: "12px", color: "#555", marginTop: "4px", lineHeight: "1.6" }}>
                {profile.address && <div>{profile.address}</div>}
                {profile.city && <div>{profile.city}</div>}
                {profile.phone && <div>Ph: {profile.phone}</div>}
                {profile.email && <div>{profile.email}</div>}
                {profile.gstin && <div style={{ fontWeight: 600, color: "#333", marginTop: "4px" }}>GSTIN: {profile.gstin}</div>}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "26px", fontWeight: 800, letterSpacing: "2px", color: "#1a1a1a" }}>INVOICE</div>
              <div style={{ fontWeight: 600, color: "#444", marginTop: "4px" }}>{invoice.invoiceNumber}</div>
              <div style={{ fontSize: "12px", color: "#666", marginTop: "2px" }}>Date: {formatDate(invoice.date)}</div>
              <div style={{ display: "inline-block", marginTop: "8px", padding: "4px 10px", borderRadius: "999px", fontSize: "11px", fontWeight: 700, color: invoice.paymentStatus === "paid" ? "#166534" : "#9a3412", background: invoice.paymentStatus === "paid" ? "#dcfce7" : "#ffedd5" }}>
                {invoice.paymentStatus === "paid" ? "PAID" : "DUE / UNPAID"}
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "24px" }}>
            <div style={{ background: "#f8f8f8", border: "1px solid #e0e0e0", borderRadius: "6px", padding: "14px 16px" }}>
              <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "1px", color: "#888", marginBottom: "8px" }}>Bill To</div>
              <div style={{ fontWeight: 700, fontSize: "15px", color: "#111" }}>{invoice.customerName || "Walk-in Customer"}</div>
            </div>
            <div style={{ background: "#f8f8f8", border: "1px solid #e0e0e0", borderRadius: "6px", padding: "14px 16px" }}>
              <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "1px", color: "#888", marginBottom: "8px" }}>Invoice Details</div>
              <div style={{ fontSize: "13px", color: "#333", lineHeight: "1.7" }}>
                <div>Invoice #: <strong>{invoice.invoiceNumber}</strong></div>
                <div>Date: <strong>{formatDate(invoice.date)}</strong></div>
                <div>Status: <strong>{invoice.paymentStatus === "paid" ? "Paid" : "Due / Unpaid"}</strong></div>
              </div>
            </div>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse" as const, marginBottom: "0" }}>
            <thead>
              <tr style={{ background: "#1a1a1a", color: "#fff" }}>
                <th style={{ padding: "10px 12px", textAlign: "left", fontSize: "11px", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.5px", width: "32px" }}>#</th>
                <th style={{ padding: "10px 12px", textAlign: "left", fontSize: "11px", fontWeight: 600, textTransform: "uppercase" as const }}>Product / Description</th>
                <th style={{ padding: "10px 12px", textAlign: "right", fontSize: "11px", fontWeight: 600, textTransform: "uppercase" as const }}>Qty</th>
                <th style={{ padding: "10px 12px", textAlign: "right", fontSize: "11px", fontWeight: 600, textTransform: "uppercase" as const }}>Unit Price</th>
                <th style={{ padding: "10px 12px", textAlign: "right", fontSize: "11px", fontWeight: 600, textTransform: "uppercase" as const }}>GST%</th>
                <th style={{ padding: "10px 12px", textAlign: "right", fontSize: "11px", fontWeight: 600, textTransform: "uppercase" as const }}>GST Amt</th>
                <th style={{ padding: "10px 12px", textAlign: "right", fontSize: "11px", fontWeight: 600, textTransform: "uppercase" as const }}>Discount</th>
                <th style={{ padding: "10px 12px", textAlign: "right", fontSize: "11px", fontWeight: 600, textTransform: "uppercase" as const }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item, index) => (
                <tr key={item.id || index} style={{ borderBottom: "1px solid #eee", background: index % 2 === 0 ? "#fff" : "#fafafa" }}>
                  <td style={{ padding: "10px 12px", fontSize: "13px", color: "#888" }}>{index + 1}</td>
                  <td style={{ padding: "10px 12px", fontSize: "13px", fontWeight: 600 }}>{item.productName}</td>
                  <td style={{ padding: "10px 12px", fontSize: "13px", textAlign: "right" }}>{item.quantity}</td>
                  <td style={{ padding: "10px 12px", fontSize: "13px", textAlign: "right" }}>{formatCurrency(item.unitPrice)}</td>
                  <td style={{ padding: "10px 12px", fontSize: "13px", textAlign: "right" }}>{item.gstPercent}%</td>
                  <td style={{ padding: "10px 12px", fontSize: "13px", textAlign: "right" }}>{formatCurrency(item.gstAmount)}</td>
                  <td style={{ padding: "10px 12px", fontSize: "13px", textAlign: "right", color: item.discountAmount ? "#e53e3e" : "#999" }}>
                    {item.discountAmount ? `-${formatCurrency(item.discountAmount)}` : "—"}
                  </td>
                  <td style={{ padding: "10px 12px", fontSize: "13px", textAlign: "right", fontWeight: 700 }}>{formatCurrency(item.totalAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: "flex", justifyContent: "flex-end", margin: "20px 0" }}>
            <div style={{ width: "300px", border: "1px solid #e0e0e0", borderRadius: "6px", overflow: "hidden" }}>
              {[
                { label: "Subtotal", value: formatCurrency(invoice.subtotal) },
                { label: "CGST", value: formatCurrency(cgst) },
                { label: "SGST", value: formatCurrency(sgst) },
                ...(invoice.totalDiscount > 0 ? [{ label: "Discount", value: `-${formatCurrency(invoice.totalDiscount)}`, red: true }] : []),
              ].map((row, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 14px", borderBottom: "1px solid #f0f0f0", fontSize: "13px" }}>
                  <span style={{ color: "#666" }}>{row.label}</span>
                  <span style={{ color: (row as any).red ? "#e53e3e" : "#111" }}>{row.value}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 14px", background: "#1a1a1a", color: "#fff", fontWeight: 700, fontSize: "15px" }}>
                <span style={{ color: "#ccc" }}>Grand Total</span>
                <span>{formatCurrency(invoice.grandTotal)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: invoice.paymentStatus === "paid" ? "#dcfce7" : "#ffedd5", color: invoice.paymentStatus === "paid" ? "#166534" : "#9a3412", fontWeight: 700, fontSize: "14px" }}>
                <span>Outstanding Due</span>
                <span>{formatCurrency(invoice.outstandingAmount)}</span>
              </div>
            </div>
          </div>

          {(hasBank || invoice.notes || profile.termsAndConditions) && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginTop: "8px" }}>
              {hasBank && (
                <div style={{ background: "#f8f8f8", border: "1px solid #e0e0e0", borderRadius: "6px", padding: "14px 16px" }}>
                  <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "1px", color: "#888", marginBottom: "8px" }}>Bank Details</div>
                  {profile.bankName && <div style={{ fontSize: "12px", marginBottom: "3px" }}>Bank: <strong>{profile.bankName}</strong></div>}
                  {profile.bankAccount && <div style={{ fontSize: "12px", marginBottom: "3px" }}>Account: <strong>{profile.bankAccount}</strong></div>}
                  {profile.bankIfsc && <div style={{ fontSize: "12px" }}>IFSC: <strong>{profile.bankIfsc}</strong></div>}
                </div>
              )}
              {(invoice.notes || profile.termsAndConditions) && (
                <div style={{ background: "#fffdf0", border: "1px solid #f0e0a0", borderRadius: "6px", padding: "14px 16px" }}>
                  {invoice.notes && (
                    <>
                      <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "1px", color: "#888", marginBottom: "6px" }}>Notes</div>
                      <p style={{ fontSize: "12px", color: "#555", lineHeight: "1.6", marginBottom: profile.termsAndConditions ? "10px" : 0 }}>{invoice.notes}</p>
                    </>
                  )}
                  {profile.termsAndConditions && (
                    <>
                      <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "1px", color: "#888", marginBottom: "6px" }}>Terms & Conditions</div>
                      <p style={{ fontSize: "12px", color: "#555", lineHeight: "1.6" }}>{profile.termsAndConditions}</p>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: "32px", borderTop: "1px solid #ddd", paddingTop: "16px", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div style={{ fontSize: "11px", color: "#aaa" }}>Generated by Billing App</div>
            <div style={{ textAlign: "right", fontSize: "12px", color: "#444" }}>
              <div style={{ fontWeight: 600 }}>{profile.name}</div>
              <div style={{ borderTop: "1px solid #999", marginTop: "40px", paddingTop: "6px", fontSize: "11px", color: "#888" }}>Authorised Signatory</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
