import { useGetInvoice, getGetInvoiceQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate } from "@/lib/format";
import { ArrowLeft, Download } from "lucide-react";
import { Link } from "wouter";
import { useBusinessProfile } from "@/hooks/use-business-profile";
import { useRef } from "react";

export function InvoiceDetail({ id }: { id: number }) {
  const { data: invoice, isLoading } = useGetInvoice(id, { query: { enabled: !!id, queryKey: getGetInvoiceQueryKey(id) } });
  const { profile } = useBusinessProfile();
  const printRef = useRef<HTMLDivElement>(null);

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
            body { font-family: Arial, sans-serif; font-size: 13px; color: #111; background: #fff; }
            .invoice-wrap { max-width: 860px; margin: 0 auto; padding: 32px; }

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
            @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
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
        <Button onClick={handlePrint}>
          <Download className="w-4 h-4 mr-2" />Print / Download PDF
        </Button>
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
