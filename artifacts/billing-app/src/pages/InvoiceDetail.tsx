import { customFetch, useGetInvoice, getGetInvoiceQueryKey, useDeleteInvoice, getListInvoicesQueryKey } from "@workspace/api-client-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate } from "@/lib/format";
import { ArrowLeft, Download, Printer, Trash2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useBusinessProfile } from "@/hooks/use-business-profile";
import { useRef } from "react";
import { jsPDF } from "jspdf";
import { useToast } from "@/hooks/use-toast";

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
    const pagePadding = isA5 ? "10px" : "18px";
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
            body { font-family: Arial, sans-serif; font-size: ${isA5 ? "8px" : "10px"}; color: #111; background: #f5f5f5; }
            .invoice-print-body { width: ${pageWidth}; min-height: ${pageHeight}; margin: 0 auto; padding: ${pagePadding} !important; background: #fff; }
            .invoice-wrap { max-width: 860px; margin: 0 auto; padding: ${pagePadding}; }

            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1a1a1a; padding-bottom: ${isA5 ? "8px" : "10px"} !important; margin-bottom: ${isA5 ? "8px" : "10px"} !important; }
            .business-name { font-size: ${isA5 ? "14px" : "17px"}; font-weight: 800; color: #1a1a1a; letter-spacing: -0.5px; }
            .business-sub { font-size: ${isA5 ? "7px" : "9px"}; color: #555; margin-top: 2px; line-height: 1.35; }
            .invoice-label { text-align: right; }
            .invoice-label h2 { font-size: ${isA5 ? "16px" : "21px"}; font-weight: 800; color: #1a1a1a; letter-spacing: 1px; }
            .invoice-label .inv-num { font-size: ${isA5 ? "8px" : "10px"}; font-weight: 600; color: #444; margin-top: 2px; }
            .invoice-label .inv-date { font-size: ${isA5 ? "7px" : "9px"}; color: #666; margin-top: 1px; }

            .meta { display: grid; grid-template-columns: 1fr 1fr; gap: ${isA5 ? "8px" : "12px"} !important; margin-bottom: ${isA5 ? "8px" : "10px"} !important; }
            .meta-box { background: #f8f8f8; border: 1px solid #e0e0e0; border-radius: 4px; padding: ${isA5 ? "6px 8px" : "8px 10px"} !important; }
            .meta-box h4 { font-size: ${isA5 ? "6px" : "8px"}; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: #888; margin-bottom: ${isA5 ? "3px" : "4px"}; }
            .meta-box p { font-size: ${isA5 ? "7px" : "9px"}; color: #222; line-height: 1.35; }
            .meta-box .strong { font-weight: 700; font-size: ${isA5 ? "8px" : "10px"}; }

            table { width: 100%; border-collapse: collapse; margin-bottom: ${isA5 ? "6px" : "8px"} !important; }
            thead tr { background: #1a1a1a; color: #fff; }
            thead th { padding: ${isA5 ? "3px 4px" : "4px 5px"} !important; text-align: left; font-size: ${isA5 ? "6px" : "8px"} !important; font-weight: 600; text-transform: uppercase; letter-spacing: 0.2px; }
            thead th.right { text-align: right; }
            tbody tr { border-bottom: 1px solid #eee; }
            tbody tr:nth-child(even) { background: #fafafa; }
            tbody td { padding: ${isA5 ? "3px 4px" : "4px 5px"} !important; font-size: ${isA5 ? "7px" : "9px"} !important; line-height: 1.2; }
            tbody td.right { text-align: right; }
            tbody td.bold { font-weight: 600; }
            tfoot tr { border-top: 2px solid #ddd; }
            tfoot td { padding: ${isA5 ? "3px 4px" : "4px 5px"} !important; font-size: ${isA5 ? "7px" : "9px"} !important; }
            tfoot td.right { text-align: right; }

            .totals { display: flex; justify-content: flex-end; margin: ${isA5 ? "6px 0" : "8px 0"} !important; }
            .totals-box { width: ${isA5 ? "190px" : "240px"} !important; border: 1px solid #e0e0e0; border-radius: 4px; overflow: hidden; }
            .totals-row { display: flex; justify-content: space-between; padding: ${isA5 ? "3px 6px" : "4px 8px"} !important; border-bottom: 1px solid #f0f0f0; font-size: ${isA5 ? "7px" : "9px"} !important; }
            .totals-row:last-child { border-bottom: none; background: #1a1a1a; color: #fff; font-weight: 700; font-size: ${isA5 ? "8px" : "10px"} !important; padding: ${isA5 ? "4px 6px" : "5px 8px"} !important; }
            .totals-label { color: #666; }
            .totals-row:last-child .totals-label { color: #ccc; }

            .bottom { display: grid; grid-template-columns: 1fr 1fr; gap: ${isA5 ? "8px" : "12px"} !important; margin-top: ${isA5 ? "4px" : "6px"} !important; }
            .bank-box { background: #f8f8f8; border: 1px solid #e0e0e0; border-radius: 4px; padding: ${isA5 ? "6px 8px" : "8px 10px"} !important; }
            .bank-box h4 { font-size: ${isA5 ? "6px" : "8px"}; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: #888; margin-bottom: ${isA5 ? "3px" : "4px"}; }
            .bank-row { font-size: ${isA5 ? "7px" : "9px"}; color: #444; margin-bottom: 2px; }
            .bank-row span { font-weight: 600; color: #111; }

            .notes-box { background: #fffdf0; border: 1px solid #f0e0a0; border-radius: 4px; padding: ${isA5 ? "6px 8px" : "8px 10px"} !important; }
            .notes-box h4 { font-size: ${isA5 ? "6px" : "8px"}; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: #888; margin-bottom: ${isA5 ? "3px" : "4px"}; }
            .notes-box p { font-size: ${isA5 ? "7px" : "9px"}; color: #555; line-height: 1.3; }

            .footer { margin-top: ${isA5 ? "10px" : "14px"} !important; border-top: 1px solid #ddd; padding-top: ${isA5 ? "6px" : "8px"} !important; display: flex; justify-content: space-between; align-items: flex-end; }
            .footer-terms { font-size: ${isA5 ? "6px" : "8px"}; color: #888; max-width: 400px; line-height: 1.3; }
            .footer-sign { text-align: right; font-size: ${isA5 ? "7px" : "9px"}; color: #444; }
            .footer-sign .sign-line { border-top: 1px solid #999; margin-top: ${isA5 ? "18px" : "24px"} !important; padding-top: ${isA5 ? "3px" : "4px"} !important; font-size: ${isA5 ? "6px" : "8px"}; color: #888; }
            @page { size: ${profile.printPageSize}; margin: 0; }
            @media print {
              html, body { background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; padding: 0; }
              body { padding: ${isA5 ? "6mm" : "9mm"} !important; }
              .invoice-print-body { width: auto; min-height: auto; margin: 0; padding: 0 !important; }
              .invoice-print-body * { max-height: none; }
              .invoice-print-body > div:first-child { padding-bottom: ${isA5 ? "8px" : "10px"} !important; margin-bottom: ${isA5 ? "8px" : "10px"} !important; border-bottom-width: 2px !important; }
              .invoice-print-body table th { padding: ${isA5 ? "3px 4px" : "4px 5px"} !important; font-size: ${isA5 ? "6px" : "8px"} !important; line-height: 1.15 !important; }
              .invoice-print-body table td { padding: ${isA5 ? "3px 4px" : "4px 5px"} !important; font-size: ${isA5 ? "7px" : "9px"} !important; line-height: 1.15 !important; }
              .invoice-print-body table + div { margin: ${isA5 ? "6px 0" : "8px 0"} !important; }
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
    const margin = isA5 ? 6 : 8;
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
    doc.setFontSize(isA5 ? 13 : 17);
    doc.text(safe(profile.name), margin, y + 4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(isA5 ? 6 : 8);
    let businessY = y + (isA5 ? 9 : 11);
    [profile.address, profile.city, profile.phone ? `Ph: ${profile.phone}` : "", profile.email, profile.gstin ? `GSTIN: ${profile.gstin}` : ""]
      .filter(Boolean)
      .forEach((text) => {
        doc.text(safe(text), margin, businessY);
        businessY += isA5 ? 3 : 4;
      });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(isA5 ? 15 : 21);
    doc.text("INVOICE", pageWidth - margin, y + 4, { align: "right" });
    doc.setFontSize(isA5 ? 7 : 10);
    doc.text(safe(invoice.invoiceNumber), pageWidth - margin, y + (isA5 ? 10 : 13), { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.text(`Date: ${formatDate(invoice.date)}`, pageWidth - margin, y + (isA5 ? 14 : 18), { align: "right" });
    doc.setFont("helvetica", "bold");
    doc.setTextColor(invoice.paymentStatus === "paid" ? 22 : 154, invoice.paymentStatus === "paid" ? 101 : 52, invoice.paymentStatus === "paid" ? 52 : 18);
    doc.text(invoice.paymentStatus === "paid" ? "PAID" : "DUE / UNPAID", pageWidth - margin, y + (isA5 ? 18 : 23), { align: "right" });
    doc.setTextColor(17, 17, 17);

    y = Math.max(businessY, y + (isA5 ? 22 : 28));
    line(y);
    y += isA5 ? 5 : 7;

    const customerLines = [
      invoice.customerPhone ? `Ph: ${invoice.customerPhone}` : "",
      invoice.customerAddress || "",
      invoice.customerGstin ? `GSTIN: ${invoice.customerGstin}` : "",
      invoice.customerEmail || "",
    ].filter(Boolean);
    const extraCustomerLines = customerLines.length;
    const lineH = isA5 ? 3.5 : 4;
    const boxHeight = isA5 ? Math.max(17, 13 + extraCustomerLines * lineH) : Math.max(22, 15 + extraCustomerLines * lineH);
    doc.setDrawColor(224, 224, 224);
    doc.roundedRect(margin, y, contentWidth / 2 - 3, boxHeight, 1.5, 1.5);
    doc.roundedRect(margin + contentWidth / 2 + 3, y, contentWidth / 2 - 3, boxHeight, 1.5, 1.5);
    doc.setFontSize(isA5 ? 5.5 : 7);
    doc.setTextColor(120, 120, 120);
    doc.setFont("helvetica", "bold");
    doc.text("BILL TO", margin + 3, y + 5);
    doc.text("INVOICE DETAILS", margin + contentWidth / 2 + 6, y + 5);
    doc.setFontSize(isA5 ? 7 : 9);
    doc.setTextColor(17, 17, 17);
    doc.setFont("helvetica", "bold");
    doc.text(safe(invoice.customerName || "Walk-in Customer"), margin + 3, y + (isA5 ? 11 : 13));
    doc.setFont("helvetica", "normal");
    doc.setFontSize(isA5 ? 6 : 8);
    let custY = y + (isA5 ? 14.5 : 17);
    customerLines.forEach((line) => {
      doc.text(safe(line), margin + 3, custY);
      custY += lineH;
    });
    const detailsX = margin + contentWidth / 2 + 6;
    doc.text(`Invoice #: ${safe(invoice.invoiceNumber)}`, detailsX, y + (isA5 ? 10 : 12));
    doc.text(`Date: ${formatDate(invoice.date)}`, detailsX, y + (isA5 ? 13.5 : 16));
    doc.text(`Status: ${invoice.paymentStatus === "paid" ? "Paid" : "Due / Unpaid"}`, detailsX, y + (isA5 ? 17 : 20));
    if (invoice.paymentMode) doc.text(`Mode: ${invoice.paymentMode.charAt(0).toUpperCase() + invoice.paymentMode.slice(1)}`, detailsX, y + (isA5 ? 20.5 : 24));
    y += boxHeight + (isA5 ? 5 : 7);

    const tableFont = isA5 ? 5.5 : 7;
    const rowHeight = isA5 ? 4.8 : 5.8;
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
      ensureSpace(rowHeight + 1);
      doc.setFillColor(26, 26, 26);
      doc.rect(margin, y, contentWidth, rowHeight, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(tableFont);
      let x = margin + 2;
      columns.forEach((column) => {
        doc.text(column.label, column.align === "right" ? x + column.width - 1 : x, y + rowHeight - 1.7, { align: column.align });
        x += column.width;
      });
      doc.setTextColor(17, 17, 17);
      y += rowHeight;
    };

    drawHeader();
    doc.setFont("helvetica", "normal");
    invoice.items.forEach((item, index) => {
      ensureSpace(rowHeight + 1);
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
        doc.text(text, column.align === "right" ? x + column.width - 1 : x, y + rowHeight - 1.7, { align: column.align });
        x += column.width;
      });
      y += rowHeight;
    });

    y += isA5 ? 3 : 5;
    ensureSpace(isA5 ? 32 : 40);
    const totalsWidth = isA5 ? 54 : 68;
    const totalsX = pageWidth - margin - totalsWidth;
    const totalRows = [
      ["Subtotal", money(invoice.subtotal)],
      ["CGST", money(cgst)],
      ["SGST", money(sgst)],
      ...(invoice.totalDiscount > 0 ? [["Discount", `-${money(invoice.totalDiscount)}`]] : []),
      ["Grand Total", money(invoice.grandTotal)],
      ["Outstanding Due", money(invoice.outstandingAmount)],
    ];
    doc.setFontSize(isA5 ? 6 : 8);
    totalRows.forEach(([label, value], index) => {
      const isGrand = label === "Grand Total";
      const isDue = label === "Outstanding Due";
      if (isGrand) doc.setFillColor(26, 26, 26);
      else if (isDue) doc.setFillColor(invoice.paymentStatus === "paid" ? 220 : 255, invoice.paymentStatus === "paid" ? 252 : 237, invoice.paymentStatus === "paid" ? 231 : 213);
      else doc.setFillColor(255, 255, 255);
      doc.rect(totalsX, y, totalsWidth, rowHeight, isGrand || isDue ? "F" : "S");
      doc.setFont("helvetica", isGrand || isDue ? "bold" : "normal");
      doc.setTextColor(isGrand ? 255 : 17, isGrand ? 255 : 17, isGrand ? 255 : 17);
      doc.text(label, totalsX + 2, y + rowHeight - 1.7);
      doc.text(value, totalsX + totalsWidth - 2, y + rowHeight - 1.7, { align: "right" });
      doc.setTextColor(17, 17, 17);
      y += rowHeight;
      if (index === totalRows.length - 1) y += isA5 ? 3 : 4;
    });

    if (hasBank || invoice.notes || profile.termsAndConditions) {
      ensureSpace(isA5 ? 25 : 32);
      const bottomWidth = contentWidth / 2 - 3;
      if (hasBank) {
        doc.roundedRect(margin, y, bottomWidth, isA5 ? 21 : 27, 1.5, 1.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(120, 120, 120);
        doc.setFontSize(isA5 ? 5.5 : 7);
        doc.text("BANK DETAILS", margin + 3, y + 5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(17, 17, 17);
        doc.setFontSize(isA5 ? 5.8 : 7);
        let bankY = y + 10;
        if (profile.bankName) {
          doc.text(`Bank: ${safe(profile.bankName)}`, margin + 3, bankY);
          bankY += isA5 ? 3.2 : 4;
        }
        if (profile.bankAccount) {
          doc.text(`Account: ${safe(profile.bankAccount)}`, margin + 3, bankY);
          bankY += isA5 ? 3.2 : 4;
        }
        if (profile.bankIfsc) doc.text(`IFSC: ${safe(profile.bankIfsc)}`, margin + 3, bankY);
      }
      if (invoice.notes || profile.termsAndConditions) {
        const notesX = margin + contentWidth / 2 + 3;
        doc.roundedRect(notesX, y, bottomWidth, isA5 ? 21 : 27, 1.5, 1.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(120, 120, 120);
        doc.setFontSize(isA5 ? 5.5 : 7);
        doc.text(invoice.notes ? "NOTES" : "TERMS & CONDITIONS", notesX + 3, y + 5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(17, 17, 17);
        doc.setFontSize(isA5 ? 5.8 : 7);
        addWrappedText(invoice.notes || profile.termsAndConditions, notesX + 3, y + 10, bottomWidth - 6, isA5 ? 3 : 3.8);
      }
      y += isA5 ? 25 : 32;
    }

    ensureSpace(isA5 ? 15 : 20);
    line(y);
    y += isA5 ? 5 : 7;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(140, 140, 140);
    doc.setFontSize(isA5 ? 5.5 : 7);
    doc.text("Generated by Billing App", margin, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(68, 68, 68);
    doc.text(safe(profile.name), pageWidth - margin, y, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setTextColor(140, 140, 140);
    doc.text("Authorised Signatory", pageWidth - margin, y + (isA5 ? 6 : 9), { align: "right" });

    doc.save(`${invoice.invoiceNumber}.pdf`);
  }

  const cgst = invoice.totalGst / 2;
  const sgst = invoice.totalGst / 2;
  const hasBank = profile.bankName || profile.bankAccount || profile.bankIfsc;
  const isA5 = profile.printPageSize === "A5";
  const compact = {
    pagePadding: isA5 ? "p-3" : "p-5",
    headerPadding: isA5 ? "10px" : "12px",
    headerMargin: isA5 ? "10px" : "12px",
    businessName: isA5 ? "15px" : "18px",
    businessText: isA5 ? "8px" : "10px",
    invoiceTitle: isA5 ? "18px" : "22px",
    invoiceText: isA5 ? "8px" : "10px",
    badge: isA5 ? "7px" : "9px",
    gridGap: isA5 ? "10px" : "14px",
    boxPadding: isA5 ? "7px 9px" : "9px 11px",
    label: isA5 ? "6px" : "8px",
    bodyText: isA5 ? "8px" : "10px",
    strongText: isA5 ? "9px" : "11px",
    thPadding: isA5 ? "3px 4px" : "4px 5px",
    tdPadding: isA5 ? "3px 4px" : "4px 5px",
    thFont: isA5 ? "6px" : "8px",
    tdFont: isA5 ? "7px" : "9px",
    totalsWidth: isA5 ? "210px" : "250px",
    totalsPadding: isA5 ? "3px 7px" : "4px 8px",
    totalsFont: isA5 ? "7px" : "9px",
    footerMargin: isA5 ? "12px" : "16px",
    signatureGap: isA5 ? "20px" : "26px",
  };

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

      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <div ref={printRef} className={`invoice-print-body ${compact.pagePadding}`}>
          <div className="header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #1a1a1a", paddingBottom: compact.headerPadding, marginBottom: compact.headerMargin }}>
            <div>
              <div style={{ fontSize: compact.businessName, fontWeight: 800, color: "#1a1a1a", letterSpacing: "-0.5px" }}>{profile.name}</div>
              <div style={{ fontSize: compact.businessText, color: "#555", marginTop: "2px", lineHeight: "1.35" }}>
                {profile.address && <div>{profile.address}</div>}
                {profile.city && <div>{profile.city}</div>}
                {profile.phone && <div>Ph: {profile.phone}</div>}
                {profile.email && <div>{profile.email}</div>}
                {profile.gstin && <div style={{ fontWeight: 600, color: "#333", marginTop: "2px" }}>GSTIN: {profile.gstin}</div>}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: compact.invoiceTitle, fontWeight: 800, letterSpacing: "1px", color: "#1a1a1a" }}>INVOICE</div>
              <div style={{ fontSize: compact.invoiceText, fontWeight: 600, color: "#444", marginTop: "2px" }}>{invoice.invoiceNumber}</div>
              <div style={{ fontSize: compact.invoiceText, color: "#666", marginTop: "1px" }}>Date: {formatDate(invoice.date)}</div>
              <div style={{ display: "inline-block", marginTop: "4px", padding: isA5 ? "2px 6px" : "3px 8px", borderRadius: "999px", fontSize: compact.badge, fontWeight: 700, color: invoice.paymentStatus === "paid" ? "#166534" : "#9a3412", background: invoice.paymentStatus === "paid" ? "#dcfce7" : "#ffedd5" }}>
                {invoice.paymentStatus === "paid" ? "PAID" : "DUE / UNPAID"}
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: compact.gridGap, marginBottom: isA5 ? "8px" : "10px" }}>
            <div style={{ background: "#f8f8f8", border: "1px solid #e0e0e0", borderRadius: "5px", padding: compact.boxPadding }}>
              <div style={{ fontSize: compact.label, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.6px", color: "#888", marginBottom: "4px" }}>Bill To</div>
              <div style={{ fontWeight: 700, fontSize: compact.strongText, color: "#111" }}>{invoice.customerName || "Walk-in Customer"}</div>
              {invoice.customerPhone && <div style={{ fontSize: compact.bodyText, color: "#444", marginTop: "2px" }}>Ph: {invoice.customerPhone}</div>}
              {invoice.customerAddress && <div style={{ fontSize: compact.bodyText, color: "#444", marginTop: "2px" }}>{invoice.customerAddress}</div>}
              {invoice.customerGstin && <div style={{ fontSize: compact.bodyText, color: "#444", marginTop: "2px" }}>GSTIN: {invoice.customerGstin}</div>}
              {invoice.customerEmail && <div style={{ fontSize: compact.bodyText, color: "#444", marginTop: "2px" }}>{invoice.customerEmail}</div>}
            </div>
            <div style={{ background: "#f8f8f8", border: "1px solid #e0e0e0", borderRadius: "5px", padding: compact.boxPadding }}>
              <div style={{ fontSize: compact.label, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.6px", color: "#888", marginBottom: "4px" }}>Invoice Details</div>
              <div style={{ fontSize: compact.bodyText, color: "#333", lineHeight: "1.35" }}>
                <div>Invoice #: <strong>{invoice.invoiceNumber}</strong></div>
                <div>Date: <strong>{formatDate(invoice.date)}</strong></div>
                <div>Status: <strong>{invoice.paymentStatus === "paid" ? "Paid" : "Due / Unpaid"}</strong></div>
                {invoice.paymentMode && <div>Mode: <strong style={{ textTransform: "capitalize" }}>{invoice.paymentMode}</strong></div>}
              </div>
            </div>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse" as const, marginBottom: "0" }}>
            <thead>
              <tr style={{ background: "#1a1a1a", color: "#fff" }}>
                <th style={{ padding: compact.thPadding, textAlign: "left", fontSize: compact.thFont, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.2px", width: "24px" }}>#</th>
                <th style={{ padding: compact.thPadding, textAlign: "left", fontSize: compact.thFont, fontWeight: 600, textTransform: "uppercase" as const }}>Product / Description</th>
                <th style={{ padding: compact.thPadding, textAlign: "right", fontSize: compact.thFont, fontWeight: 600, textTransform: "uppercase" as const }}>Qty</th>
                <th style={{ padding: compact.thPadding, textAlign: "right", fontSize: compact.thFont, fontWeight: 600, textTransform: "uppercase" as const }}>Unit Price</th>
                <th style={{ padding: compact.thPadding, textAlign: "right", fontSize: compact.thFont, fontWeight: 600, textTransform: "uppercase" as const }}>GST%</th>
                <th style={{ padding: compact.thPadding, textAlign: "right", fontSize: compact.thFont, fontWeight: 600, textTransform: "uppercase" as const }}>GST Amt</th>
                <th style={{ padding: compact.thPadding, textAlign: "right", fontSize: compact.thFont, fontWeight: 600, textTransform: "uppercase" as const }}>Discount</th>
                <th style={{ padding: compact.thPadding, textAlign: "right", fontSize: compact.thFont, fontWeight: 600, textTransform: "uppercase" as const }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item, index) => (
                <tr key={item.id || index} style={{ borderBottom: "1px solid #eee", background: index % 2 === 0 ? "#fff" : "#fafafa" }}>
                  <td style={{ padding: compact.tdPadding, fontSize: compact.tdFont, lineHeight: 1.2, color: "#888" }}>{index + 1}</td>
                  <td style={{ padding: compact.tdPadding, fontSize: compact.tdFont, lineHeight: 1.2, fontWeight: 600 }}>{item.productName}</td>
                  <td style={{ padding: compact.tdPadding, fontSize: compact.tdFont, lineHeight: 1.2, textAlign: "right" }}>{item.quantity}</td>
                  <td style={{ padding: compact.tdPadding, fontSize: compact.tdFont, lineHeight: 1.2, textAlign: "right" }}>{formatCurrency(item.unitPrice)}</td>
                  <td style={{ padding: compact.tdPadding, fontSize: compact.tdFont, lineHeight: 1.2, textAlign: "right" }}>{item.gstPercent}%</td>
                  <td style={{ padding: compact.tdPadding, fontSize: compact.tdFont, lineHeight: 1.2, textAlign: "right" }}>{formatCurrency(item.gstAmount)}</td>
                  <td style={{ padding: compact.tdPadding, fontSize: compact.tdFont, lineHeight: 1.2, textAlign: "right", color: item.discountAmount ? "#e53e3e" : "#999" }}>
                    {item.discountAmount ? `-${formatCurrency(item.discountAmount)}` : "—"}
                  </td>
                  <td style={{ padding: compact.tdPadding, fontSize: compact.tdFont, lineHeight: 1.2, textAlign: "right", fontWeight: 700 }}>{formatCurrency(item.totalAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: "flex", justifyContent: "flex-end", margin: isA5 ? "6px 0" : "8px 0" }}>
            <div style={{ width: compact.totalsWidth, border: "1px solid #e0e0e0", borderRadius: "5px", overflow: "hidden" }}>
              {[
                { label: "Subtotal", value: formatCurrency(invoice.subtotal) },
                { label: "CGST", value: formatCurrency(cgst) },
                { label: "SGST", value: formatCurrency(sgst) },
                ...(invoice.totalDiscount > 0 ? [{ label: "Discount", value: `-${formatCurrency(invoice.totalDiscount)}`, red: true }] : []),
              ].map((row, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: compact.totalsPadding, borderBottom: "1px solid #f0f0f0", fontSize: compact.totalsFont }}>
                  <span style={{ color: "#666" }}>{row.label}</span>
                  <span style={{ color: (row as any).red ? "#e53e3e" : "#111" }}>{row.value}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", padding: isA5 ? "4px 7px" : "5px 8px", background: "#1a1a1a", color: "#fff", fontWeight: 700, fontSize: isA5 ? "8px" : "10px" }}>
                <span style={{ color: "#ccc" }}>Grand Total</span>
                <span>{formatCurrency(invoice.grandTotal)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: isA5 ? "4px 7px" : "5px 8px", background: invoice.paymentStatus === "paid" ? "#dcfce7" : "#ffedd5", color: invoice.paymentStatus === "paid" ? "#166534" : "#9a3412", fontWeight: 700, fontSize: isA5 ? "8px" : "10px" }}>
                <span>Outstanding Due</span>
                <span>{formatCurrency(invoice.outstandingAmount)}</span>
              </div>
            </div>
          </div>

          {(hasBank || invoice.notes || profile.termsAndConditions) && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: compact.gridGap, marginTop: "6px" }}>
              {hasBank && (
                <div style={{ background: "#f8f8f8", border: "1px solid #e0e0e0", borderRadius: "5px", padding: compact.boxPadding }}>
                  <div style={{ fontSize: compact.label, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.6px", color: "#888", marginBottom: "4px" }}>Bank Details</div>
                  {profile.bankName && <div style={{ fontSize: compact.bodyText, marginBottom: "2px" }}>Bank: <strong>{profile.bankName}</strong></div>}
                  {profile.bankAccount && <div style={{ fontSize: compact.bodyText, marginBottom: "2px" }}>Account: <strong>{profile.bankAccount}</strong></div>}
                  {profile.bankIfsc && <div style={{ fontSize: compact.bodyText }}>IFSC: <strong>{profile.bankIfsc}</strong></div>}
                </div>
              )}
              {(invoice.notes || profile.termsAndConditions) && (
                <div style={{ background: "#fffdf0", border: "1px solid #f0e0a0", borderRadius: "5px", padding: compact.boxPadding }}>
                  {invoice.notes && (
                    <>
                      <div style={{ fontSize: compact.label, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.6px", color: "#888", marginBottom: "4px" }}>Notes</div>
                      <p style={{ fontSize: compact.bodyText, color: "#555", lineHeight: "1.3", marginBottom: profile.termsAndConditions ? "6px" : 0 }}>{invoice.notes}</p>
                    </>
                  )}
                  {profile.termsAndConditions && (
                    <>
                      <div style={{ fontSize: compact.label, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.6px", color: "#888", marginBottom: "4px" }}>Terms & Conditions</div>
                      <p style={{ fontSize: compact.bodyText, color: "#555", lineHeight: "1.3" }}>{profile.termsAndConditions}</p>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: compact.footerMargin, borderTop: "1px solid #ddd", paddingTop: isA5 ? "6px" : "8px", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div style={{ fontSize: compact.label, color: "#aaa" }}>Generated by Billing App</div>
            <div style={{ textAlign: "right", fontSize: compact.bodyText, color: "#444" }}>
              <div style={{ fontWeight: 600 }}>{profile.name}</div>
              <div style={{ borderTop: "1px solid #999", marginTop: compact.signatureGap, paddingTop: isA5 ? "3px" : "4px", fontSize: compact.label, color: "#888" }}>Authorised Signatory</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
