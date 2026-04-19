import { useState } from "react";
import {
  useListFinancialYears,
  useGetSalesReport,
  useGetGstReport,
  useGetProfitReport,
  useGetProductWiseReport,
  useGetCustomerWiseReport,
  customFetch,
} from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/format";
import { useBusinessProfile } from "@/hooks/use-business-profile";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Printer, Download } from "lucide-react";
import jsPDF from "jspdf";

interface SalesRegisterEntry {
  invoiceNumber: string;
  date: string;
  partyName: string;
  cashAmount: number;
  creditAmount: number;
}

interface SalesRegisterResponse {
  entries: SalesRegisterEntry[];
  totalCash: number;
  totalCredit: number;
  grandTotal: number;
  cashCount: number;
  creditCount: number;
}

function useSalesRegister(startDate: string, endDate: string, enabled: boolean) {
  return useQuery<SalesRegisterResponse>({
    queryKey: ["sales-register", startDate, endDate],
    queryFn: () =>
      customFetch<SalesRegisterResponse>(
        `/api/reports/sales-register?startDate=${startDate}&endDate=${endDate}`
      ),
    enabled,
  });
}

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function SalesRegisterReport({
  startDate,
  endDate,
  onStartChange,
  onEndChange,
}: {
  startDate: string;
  endDate: string;
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
}) {
  const { profile } = useBusinessProfile();
  const enabled = Boolean(startDate && endDate);
  const { data, isLoading } = useSalesRegister(startDate, endDate, enabled);

  function handlePrint() {
    window.print();
  }

  return (
    <div>
      <div className="flex flex-wrap gap-4 items-end mb-6 no-print">
        <div>
          <label className="text-sm font-medium text-muted-foreground">From Date</label>
          <Input type="date" value={startDate} onChange={(e) => onStartChange(e.target.value)} className="w-40" />
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground">To Date</label>
          <Input type="date" value={endDate} onChange={(e) => onEndChange(e.target.value)} className="w-40" />
        </div>
        <Button onClick={handlePrint} variant="outline" className="gap-2">
          <Printer className="w-4 h-4" />
          Print
        </Button>
      </div>

      <div id="sales-register-print" className="print-area">
        <div className="text-center mb-4">
          <h2 className="text-xl font-bold">{profile.name}</h2>
          {profile.address && <p className="text-sm">{profile.address}</p>}
          {profile.city && <p className="text-sm">{profile.city}</p>}
          {profile.phone && <p className="text-sm">Ph: {profile.phone}</p>}
        </div>

        <div className="border-t border-b border-black py-2 mb-4">
          <h3 className="text-center font-bold text-base">Sales Register (Cash / Credit)</h3>
          <div className="flex justify-between text-sm mt-1">
            <span>
              From: <strong>{startDate ? formatDate(startDate) : "—"}</strong>
              {"  "}To: <strong>{endDate ? formatDate(endDate) : "—"}</strong>
            </span>
            <span>Page 1 of 1</span>
          </div>
        </div>

        {isLoading ? (
          <p className="text-center text-muted-foreground py-8">Loading...</p>
        ) : !data ? (
          <p className="text-center text-muted-foreground py-8">Select a date range to view the report.</p>
        ) : (
          <>
            <table className="w-full border-collapse text-sm sales-register-table">
              <thead>
                <tr className="border border-black">
                  <th className="border border-black px-2 py-1.5 text-left">Invoice No</th>
                  <th className="border border-black px-2 py-1.5 text-left">Date</th>
                  <th className="border border-black px-2 py-1.5 text-left">Party Name</th>
                  <th className="border border-black px-2 py-1.5 text-right">Cash Amount</th>
                  <th className="border border-black px-2 py-1.5 text-right">Credit Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.entries.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="border border-black px-2 py-4 text-center text-muted-foreground">
                      No invoices found for this period.
                    </td>
                  </tr>
                ) : (
                  data.entries.map((entry, idx) => (
                    <tr key={idx} className="border border-black">
                      <td className="border border-black px-2 py-1">{entry.invoiceNumber}</td>
                      <td className="border border-black px-2 py-1">{formatDate(entry.date)}</td>
                      <td className="border border-black px-2 py-1">{entry.partyName}</td>
                      <td className="border border-black px-2 py-1 text-right">
                        {entry.cashAmount > 0 ? formatCurrency(entry.cashAmount) : "—"}
                      </td>
                      <td className="border border-black px-2 py-1 text-right">
                        {entry.creditAmount > 0 ? formatCurrency(entry.creditAmount) : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="border border-black font-bold bg-gray-50">
                  <td colSpan={3} className="border border-black px-2 py-1.5 text-right">Total</td>
                  <td className="border border-black px-2 py-1.5 text-right">{formatCurrency(data.totalCash)}</td>
                  <td className="border border-black px-2 py-1.5 text-right">{formatCurrency(data.totalCredit)}</td>
                </tr>
              </tfoot>
            </table>

            <div className="mt-4 border border-black p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span>Total Cash Amount:</span>
                <span className="font-semibold">{formatCurrency(data.totalCash)}</span>
              </div>
              <div className="flex justify-between">
                <span>Total Credit Amount:</span>
                <span className="font-semibold">{formatCurrency(data.totalCredit)}</span>
              </div>
              <div className="flex justify-between border-t border-black pt-1 font-bold">
                <span>Grand Total:</span>
                <span>{formatCurrency(data.grandTotal)}</span>
              </div>
              <div className="flex justify-between border-t border-dashed border-gray-400 pt-1 text-muted-foreground">
                <span>Total No. of Cash Bills:</span>
                <span>{data.cashCount}</span>
              </div>
              <div className="flex justify-between">
                <span>Total No. of Credit Bills:</span>
                <span>{data.creditCount}</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function Reports() {
  const now = new Date();
  const currentFYStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const defaultFY = `${currentFYStart}-${currentFYStart + 1}`;
  const { profile } = useBusinessProfile();

  const [startDate, setStartDate] = useState(`${currentFYStart}-04-01`);
  const [endDate, setEndDate] = useState(`${currentFYStart + 1}-03-31`);
  const [groupBy, setGroupBy] = useState<"daily" | "monthly" | "yearly">("monthly");
  const [selectedFY, setSelectedFY] = useState(defaultFY);
  const [showProfit, setShowProfit] = useState(false);

  const [srStartDate, setSrStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [srEndDate, setSrEndDate] = useState(new Date().toISOString().split("T")[0]);

  const todayStr = new Date().toISOString().split("T")[0];
  const [psPeriod, setPsPeriod] = useState<"today" | "week" | "month" | "year" | "custom">("month");
  const [psCustomStart, setPsCustomStart] = useState(todayStr);
  const [psCustomEnd, setPsCustomEnd] = useState(todayStr);
  const [psMonth, setPsMonth] = useState(new Date().getMonth() + 1);
  const [psYear, setPsYear] = useState(new Date().getFullYear());

  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const YEARS = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 2 + i);

  function getPsDateRange(): { start: string; end: string } {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    if (psPeriod === "today") return { start: fmt(now), end: fmt(now) };
    if (psPeriod === "week") {
      const day = now.getDay();
      const mon = new Date(now); mon.setDate(now.getDate() - ((day + 6) % 7));
      return { start: fmt(mon), end: fmt(now) };
    }
    if (psPeriod === "month") {
      const y = now.getFullYear();
      const lastDay = new Date(y, psMonth, 0).getDate();
      const isCurrentMonth = psMonth === now.getMonth() + 1;
      const end = isCurrentMonth ? fmt(now) : `${y}-${pad(psMonth)}-${pad(lastDay)}`;
      return { start: `${y}-${pad(psMonth)}-01`, end };
    }
    if (psPeriod === "year") {
      const isCurrentYear = psYear === now.getFullYear();
      const end = isCurrentYear ? fmt(now) : `${psYear}-12-31`;
      return { start: `${psYear}-01-01`, end };
    }
    return { start: psCustomStart, end: psCustomEnd };
  }
  const { start: psStart, end: psEnd } = getPsDateRange();

  const { data: financialYears } = useListFinancialYears();
  const { data: salesReport } = useGetSalesReport({ startDate, endDate, groupBy });
  const { data: gstReport } = useGetGstReport({ financialYear: selectedFY });
  const { data: profitReport } = useGetProfitReport({ startDate, endDate, groupBy });
  const { data: productWise } = useGetProductWiseReport({ startDate, endDate });
  const { data: customerWise } = useGetCustomerWiseReport({ startDate, endDate });
  const { data: psSummary } = useGetProductWiseReport({ startDate: psStart, endDate: psEnd });

  function handleFYChange(fy: string) {
    setSelectedFY(fy);
    const [start] = fy.split("-").map(Number);
    setStartDate(`${start}-04-01`);
    setEndDate(`${start + 1}-03-31`);
  }

  function getPsPeriodLabel() {
    if (psPeriod === "today") return "Today";
    if (psPeriod === "week") return "This Week";
    if (psPeriod === "month") return "This Month";
    if (psPeriod === "year") return "This Year";
    return "Custom Range";
  }

  function handlePsPrint() {
    if (!psSummary || psSummary.length === 0) return;
    const safe = (v: unknown) => String(v ?? "");
    const rows = [...psSummary]
      .sort((a, b) => b.totalQuantity - a.totalQuantity)
      .map((p, idx) => `
        <tr style="background:${idx % 2 === 0 ? "#fff" : "#f9f9f9"}">
          <td style="border:1px solid #ccc;padding:5px 8px;text-align:center">${idx + 1}</td>
          <td style="border:1px solid #ccc;padding:5px 8px;font-weight:600">${safe(p.productName)}</td>
          <td style="border:1px solid #ccc;padding:5px 8px;text-align:right">${p.totalQuantity}</td>
          <td style="border:1px solid #ccc;padding:5px 8px;text-align:right">${formatCurrency(p.totalRevenue)}</td>
          <td style="border:1px solid #ccc;padding:5px 8px;text-align:right">${formatCurrency(p.totalGst || 0)}</td>
          ${showProfit ? `<td style="border:1px solid #ccc;padding:5px 8px;text-align:right;color:#16a34a">${formatCurrency(p.totalProfit)}</td>` : ""}
        </tr>`).join("");
    const totalQty = psSummary.reduce((s, p) => s + p.totalQuantity, 0);
    const totalRev = psSummary.reduce((s, p) => s + p.totalRevenue, 0);
    const totalGst = psSummary.reduce((s, p) => s + (p.totalGst || 0), 0);
    const totalProfit = psSummary.reduce((s, p) => s + p.totalProfit, 0);
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Product Summary</title>
      <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:11px;color:#111;padding:12mm}
      @page{size:A4;margin:0}@media print{body{padding:12mm}}</style></head><body>
      <div style="text-align:center;margin-bottom:12px">
        <div style="font-size:18px;font-weight:900">${safe(profile.name)}</div>
        ${profile.address ? `<div style="font-size:11px">${safe(profile.address)}</div>` : ""}
        ${profile.city ? `<div style="font-size:11px">${safe(profile.city)}</div>` : ""}
        ${profile.gstin ? `<div style="font-size:11px;font-weight:600">GSTIN: ${safe(profile.gstin)}</div>` : ""}
      </div>
      <div style="border-top:2px solid #111;border-bottom:2px solid #111;padding:4px 0;text-align:center;margin-bottom:10px">
        <div style="font-size:13px;font-weight:800">Product Sales Summary — ${getPsPeriodLabel()}</div>
        <div style="font-size:10px;margin-top:2px">Period: ${formatDate(psStart)} to ${formatDate(psEnd)}</div>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:10px">
        <thead><tr style="background:#f0f0f0">
          <th style="border:1px solid #888;padding:5px 8px">#</th>
          <th style="border:1px solid #888;padding:5px 8px;text-align:left">Product</th>
          <th style="border:1px solid #888;padding:5px 8px;text-align:right">Qty Sold</th>
          <th style="border:1px solid #888;padding:5px 8px;text-align:right">Revenue</th>
          <th style="border:1px solid #888;padding:5px 8px;text-align:right">GST</th>
          ${showProfit ? `<th style="border:1px solid #888;padding:5px 8px;text-align:right">Profit</th>` : ""}
        </tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr style="background:#e8e8e8;font-weight:700">
          <td colspan="2" style="border:1px solid #888;padding:5px 8px;text-align:right">Total</td>
          <td style="border:1px solid #888;padding:5px 8px;text-align:right">${totalQty}</td>
          <td style="border:1px solid #888;padding:5px 8px;text-align:right">${formatCurrency(totalRev)}</td>
          <td style="border:1px solid #888;padding:5px 8px;text-align:right">${formatCurrency(totalGst)}</td>
          ${showProfit ? `<td style="border:1px solid #888;padding:5px 8px;text-align:right;color:#16a34a">${formatCurrency(totalProfit)}</td>` : ""}
        </tr></tfoot>
      </table>
      <div style="font-size:10px;color:#555;text-align:right;margin-top:8px">Printed on ${formatDate(new Date().toISOString().split("T")[0])}</div>
    </body></html>`;
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 400);
  }

  function handlePsDownloadPdf() {
    if (!psSummary || psSummary.length === 0) return;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 12;
    const cw = pageW - margin * 2;
    const safe = (v: unknown) => String(v ?? "").replace(/₹/g, "Rs.");
    let y = margin + 2;
    const fs = 7;
    const lineH = 4;

    doc.setDrawColor(34, 34, 34);
    doc.setLineWidth(0.5);
    doc.rect(margin - 2, margin - 2, cw + 4, doc.internal.pageSize.getHeight() - margin * 2 + 4);

    const innerL = margin + 2;
    const innerW = cw - 4;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text(safe(profile.name), innerL + innerW / 2, y + 5, { align: "center" });
    y += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fs);
    if (profile.address) { doc.text(safe(profile.address), innerL + innerW / 2, y + lineH, { align: "center" }); y += lineH; }
    if (profile.city) { doc.text(safe(profile.city), innerL + innerW / 2, y + lineH, { align: "center" }); y += lineH; }
    if (profile.gstin) { doc.setFont("helvetica", "bold"); doc.text("GSTIN: " + safe(profile.gstin), innerL + innerW / 2, y + lineH, { align: "center" }); doc.setFont("helvetica", "normal"); y += lineH; }

    y += 3;
    doc.setDrawColor(34, 34, 34);
    doc.setLineWidth(0.4);
    doc.line(innerL, y, innerL + innerW, y); y += 1;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Product Sales Summary — " + getPsPeriodLabel(), innerL + innerW / 2, y + 4, { align: "center" });
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fs);
    doc.text("Period: " + formatDate(psStart) + " to " + formatDate(psEnd), innerL + innerW / 2, y + lineH, { align: "center" });
    y += lineH + 2;
    doc.line(innerL, y, innerL + innerW, y); y += 3;

    const colW = showProfit
      ? [7, innerW - 89, 12, 26, 22, 22]
      : [7, innerW - 67, 12, 26, 22];
    const headers = showProfit
      ? ["#", "Product", "Qty", "Revenue", "GST", "Profit"]
      : ["#", "Product", "Qty", "Revenue", "GST"];
    const aligns: ("center" | "left" | "right")[] = showProfit
      ? ["center", "left", "right", "right", "right", "right"]
      : ["center", "left", "right", "right", "right"];

    const rowH = 5.5;
    function drawPdfRow(vals: string[], fill?: [number, number, number], bold = false) {
      if (fill) { doc.setFillColor(...fill); doc.rect(innerL, y, innerW, rowH, "F"); }
      doc.setDrawColor(136, 136, 136);
      doc.rect(innerL, y, innerW, rowH);
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(fs);
      let cx = innerL;
      vals.forEach((v, i) => {
        const tx = aligns[i] === "right" ? cx + colW[i] - 1 : aligns[i] === "center" ? cx + colW[i] / 2 : cx + 1.5;
        const display = i === 1 ? (doc.splitTextToSize(safe(v), colW[i] - 3)[0] || safe(v)) : safe(v);
        doc.text(display, tx, y + rowH - 1.5, { align: aligns[i] });
        cx += colW[i];
        if (i < vals.length - 1) { doc.setDrawColor(136, 136, 136); doc.line(cx, y, cx, y + rowH); }
      });
      y += rowH;
    }

    drawPdfRow(headers, [240, 240, 240], true);

    const sorted = [...psSummary].sort((a, b) => b.totalQuantity - a.totalQuantity);
    sorted.forEach((p, idx) => {
      const row = [
        String(idx + 1), p.productName, String(p.totalQuantity),
        safe(formatCurrency(p.totalRevenue)), safe(formatCurrency(p.totalGst || 0)),
        ...(showProfit ? [safe(formatCurrency(p.totalProfit))] : []),
      ];
      drawPdfRow(row, idx % 2 === 1 ? [250, 250, 250] : undefined);
    });

    const totals = [
      "Total", "",
      String(psSummary.reduce((s, p) => s + p.totalQuantity, 0)),
      safe(formatCurrency(psSummary.reduce((s, p) => s + p.totalRevenue, 0))),
      safe(formatCurrency(psSummary.reduce((s, p) => s + (p.totalGst || 0), 0))),
      ...(showProfit ? [safe(formatCurrency(psSummary.reduce((s, p) => s + p.totalProfit, 0)))] : []),
    ];
    drawPdfRow(totals, [230, 230, 230], true);

    y += 3;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fs - 1);
    doc.setTextColor(120, 120, 120);
    doc.text("Printed on " + formatDate(new Date().toISOString().split("T")[0]), innerL + innerW, y + lineH, { align: "right" });

    doc.save(`product-summary-${psStart}-${psEnd}.pdf`);
  }

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
          .sales-register-table { font-size: 11px; }
        }
      `}</style>

      <div className="space-y-6">
        <div className="flex items-center justify-between no-print">
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch id="show-profit" checked={showProfit} onCheckedChange={setShowProfit} />
              <Label htmlFor="show-profit" className="text-sm">Show Profit</Label>
            </div>
          </div>
        </div>

        <Tabs defaultValue="sales">
          <TabsList className="no-print">
            <TabsTrigger value="sales">Sales</TabsTrigger>
            <TabsTrigger value="gst">GST</TabsTrigger>
            {showProfit && <TabsTrigger value="profit">Profit</TabsTrigger>}
            <TabsTrigger value="products">Product-wise</TabsTrigger>
            <TabsTrigger value="customers">Customer-wise</TabsTrigger>
            <TabsTrigger value="sales-register">Sales Register</TabsTrigger>
            <TabsTrigger value="product-summary">Product Summary</TabsTrigger>
          </TabsList>

          <TabsContent value="sales" className="space-y-4">
            <div className="flex flex-wrap gap-4 items-end no-print">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Financial Year</label>
                <Select value={selectedFY} onValueChange={handleFYChange}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {financialYears?.map((fy) => (
                      <SelectItem key={fy.label} value={fy.label}>{fy.label}</SelectItem>
                    ))}
                    {(!financialYears || financialYears.length === 0) && (
                      <SelectItem value={defaultFY}>{defaultFY}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
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
                <label className="text-sm font-medium text-muted-foreground">Group By</label>
                <Select value={groupBy} onValueChange={(v) => setGroupBy(v as "daily" | "monthly" | "yearly")}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {salesReport && (
              <>
                <div className="grid grid-cols-3 gap-4">
                  <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Sales</p><p className="text-2xl font-bold">{formatCurrency(salesReport.totalSales)}</p></CardContent></Card>
                  <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total GST</p><p className="text-2xl font-bold">{formatCurrency(salesReport.totalGst)}</p></CardContent></Card>
                  {showProfit && <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Profit</p><p className="text-2xl font-bold text-emerald-600">{formatCurrency(salesReport.totalProfit || 0)}</p></CardContent></Card>}
                </div>
                {salesReport.entries.length > 0 && (
                  <Card>
                    <CardContent className="p-4">
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={salesReport.entries}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="period" fontSize={12} />
                          <YAxis fontSize={12} />
                          <Tooltip formatter={(value: number) => formatCurrency(value)} />
                          <Legend />
                          <Bar dataKey="sales" name="Sales" fill="#6366f1" radius={[4, 4, 0, 0]} />
                          {showProfit && <Bar dataKey="profit" name="Profit" fill="#10b981" radius={[4, 4, 0, 0]} />}
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Period</TableHead>
                          <TableHead className="text-right">Sales</TableHead>
                          <TableHead className="text-right">GST</TableHead>
                          {showProfit && <TableHead className="text-right">Profit</TableHead>}
                          <TableHead className="text-right">Invoices</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {salesReport.entries.map((entry) => (
                          <TableRow key={entry.period}>
                            <TableCell>{entry.period}</TableCell>
                            <TableCell className="text-right">{formatCurrency(entry.sales)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(entry.gst)}</TableCell>
                            {showProfit && <TableCell className="text-right text-emerald-600">{formatCurrency(entry.profit || 0)}</TableCell>}
                            <TableCell className="text-right">{entry.invoiceCount}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="gst" className="space-y-4">
            {gstReport && (
              <>
                <div className="grid grid-cols-4 gap-4">
                  <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">CGST</p><p className="text-xl font-bold">{formatCurrency(gstReport.totalCgst)}</p></CardContent></Card>
                  <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">SGST</p><p className="text-xl font-bold">{formatCurrency(gstReport.totalSgst)}</p></CardContent></Card>
                  <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">IGST</p><p className="text-xl font-bold">{formatCurrency(gstReport.totalIgst)}</p></CardContent></Card>
                  <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total GST</p><p className="text-xl font-bold">{formatCurrency(gstReport.totalGst)}</p></CardContent></Card>
                </div>
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Month</TableHead>
                          <TableHead className="text-right">Taxable Amount</TableHead>
                          <TableHead className="text-right">CGST</TableHead>
                          <TableHead className="text-right">SGST</TableHead>
                          <TableHead className="text-right">IGST</TableHead>
                          <TableHead className="text-right">Total GST</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {gstReport.entries.map((entry) => (
                          <TableRow key={entry.month}>
                            <TableCell>{entry.monthName}</TableCell>
                            <TableCell className="text-right">{formatCurrency(entry.taxableAmount || 0)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(entry.cgst)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(entry.sgst)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(entry.igst)}</TableCell>
                            <TableCell className="text-right font-semibold">{formatCurrency(entry.totalGst)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {showProfit && (
            <TabsContent value="profit" className="space-y-4">
              {profitReport && (
                <>
                  <div className="grid grid-cols-4 gap-4">
                    <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Revenue</p><p className="text-xl font-bold">{formatCurrency(profitReport.totalRevenue)}</p></CardContent></Card>
                    <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Cost</p><p className="text-xl font-bold">{formatCurrency(profitReport.totalCost)}</p></CardContent></Card>
                    <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Profit</p><p className="text-xl font-bold text-emerald-600">{formatCurrency(profitReport.totalProfit)}</p></CardContent></Card>
                    <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Profit Margin</p><p className="text-xl font-bold">{profitReport.profitMargin || 0}%</p></CardContent></Card>
                  </div>
                  <Card>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Period</TableHead>
                            <TableHead className="text-right">Revenue</TableHead>
                            <TableHead className="text-right">Cost</TableHead>
                            <TableHead className="text-right">Profit</TableHead>
                            <TableHead className="text-right">Margin</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {profitReport.entries.map((entry) => (
                            <TableRow key={entry.period}>
                              <TableCell>{entry.period}</TableCell>
                              <TableCell className="text-right">{formatCurrency(entry.revenue)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(entry.cost)}</TableCell>
                              <TableCell className="text-right text-emerald-600">{formatCurrency(entry.profit)}</TableCell>
                              <TableCell className="text-right">{entry.margin || 0}%</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>
          )}

          <TabsContent value="products" className="space-y-4">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Qty Sold</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">GST</TableHead>
                      {showProfit && <TableHead className="text-right">Profit</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productWise && productWise.length > 0 ? productWise.map((p) => (
                      <TableRow key={p.productId}>
                        <TableCell className="font-medium">{p.productName}</TableCell>
                        <TableCell className="text-right">{p.totalQuantity}</TableCell>
                        <TableCell className="text-right">{formatCurrency(p.totalRevenue)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(p.totalGst || 0)}</TableCell>
                        {showProfit && <TableCell className="text-right text-emerald-600">{formatCurrency(p.totalProfit)}</TableCell>}
                      </TableRow>
                    )) : (
                      <TableRow><TableCell colSpan={showProfit ? 5 : 4} className="text-center py-8 text-muted-foreground">No data for selected period.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="customers" className="space-y-4">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead className="text-right">Invoices</TableHead>
                      <TableHead className="text-right">Total Purchases</TableHead>
                      <TableHead>Last Purchase</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customerWise && customerWise.length > 0 ? customerWise.map((c) => (
                      <TableRow key={c.customerId}>
                        <TableCell className="font-medium">{c.customerName}</TableCell>
                        <TableCell className="text-right">{c.invoiceCount}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(c.totalPurchases)}</TableCell>
                        <TableCell>{c.lastPurchaseDate ? formatDate(c.lastPurchaseDate) : "-"}</TableCell>
                      </TableRow>
                    )) : (
                      <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No data for selected period.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sales-register">
            <Card>
              <CardHeader>
                <CardTitle>Sales Register (Cash / Credit)</CardTitle>
              </CardHeader>
              <CardContent>
                <SalesRegisterReport
                  startDate={srStartDate}
                  endDate={srEndDate}
                  onStartChange={setSrStartDate}
                  onEndChange={setSrEndDate}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="product-summary" className="space-y-4">
            {/* Period selector + action buttons */}
            <Card>
              <CardContent className="pt-4">
                <div className="flex flex-wrap gap-2 items-center justify-between">
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-sm font-medium text-muted-foreground mr-1">Period:</span>
                  {(["today", "week", "month", "year", "custom"] as const).map(p => (
                    <Button
                      key={p}
                      variant={psPeriod === p ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPsPeriod(p)}
                    >
                      {p === "today" ? "Today" : p === "week" ? "This Week" : p === "month" ? "This Month" : p === "year" ? "This Year" : "Custom"}
                    </Button>
                  ))}
                  {psPeriod === "month" && (
                    <Select value={String(psMonth)} onValueChange={v => setPsMonth(Number(v))}>
                      <SelectTrigger className="h-8 text-sm w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MONTHS.map((m, i) => (
                          <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {psPeriod === "year" && (
                    <Select value={String(psYear)} onValueChange={v => setPsYear(Number(v))}>
                      <SelectTrigger className="h-8 text-sm w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {YEARS.map(y => (
                          <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {psPeriod === "custom" && (
                    <div className="flex items-center gap-2 ml-2">
                      <Input type="date" value={psCustomStart} onChange={e => setPsCustomStart(e.target.value)} className="w-38 h-8 text-sm" />
                      <span className="text-muted-foreground text-sm">to</span>
                      <Input type="date" value={psCustomEnd} onChange={e => setPsCustomEnd(e.target.value)} className="w-38 h-8 text-sm" />
                    </div>
                  )}
                  {psPeriod !== "custom" && (
                    <span className="text-xs text-muted-foreground ml-2 border rounded px-2 py-1 bg-muted">
                      {formatDate(psStart)} – {formatDate(psEnd)}
                    </span>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePsPrint}
                    disabled={!psSummary || psSummary.length === 0}
                  >
                    <Printer className="w-4 h-4 mr-1" />
                    Print
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePsDownloadPdf}
                    disabled={!psSummary || psSummary.length === 0}
                  >
                    <Download className="w-4 h-4 mr-1" />
                    PDF
                  </Button>
                </div>
                </div>
              </CardContent>
            </Card>

            {/* Summary cards */}
            {psSummary && psSummary.length > 0 && (
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Total Products Sold</p>
                    <p className="text-2xl font-bold">{psSummary.length}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Total Qty Sold</p>
                    <p className="text-2xl font-bold">{psSummary.reduce((s, p) => s + p.totalQuantity, 0)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Total Revenue</p>
                    <p className="text-2xl font-bold">{formatCurrency(psSummary.reduce((s, p) => s + p.totalRevenue, 0))}</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Product table */}
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8 text-center">#</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Qty Sold</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">GST</TableHead>
                      {showProfit && <TableHead className="text-right">Profit</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!psSummary || psSummary.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={showProfit ? 6 : 5} className="text-center py-12 text-muted-foreground">
                          No sales data for the selected period.
                        </TableCell>
                      </TableRow>
                    ) : (
                      [...psSummary]
                        .sort((a, b) => b.totalQuantity - a.totalQuantity)
                        .map((p, idx) => (
                          <TableRow key={p.productId}>
                            <TableCell className="text-center text-muted-foreground text-sm">{idx + 1}</TableCell>
                            <TableCell className="font-medium">{p.productName}</TableCell>
                            <TableCell className="text-right font-semibold">{p.totalQuantity}</TableCell>
                            <TableCell className="text-right">{formatCurrency(p.totalRevenue)}</TableCell>
                            <TableCell className="text-right text-muted-foreground">{formatCurrency(p.totalGst || 0)}</TableCell>
                            {showProfit && <TableCell className="text-right text-emerald-600">{formatCurrency(p.totalProfit)}</TableCell>}
                          </TableRow>
                        ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
