import { useGetInvoice, getGetInvoiceQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import { ArrowLeft, Printer } from "lucide-react";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";

export function InvoiceDetail({ id }: { id: number }) {
  const { data: invoice, isLoading } = useGetInvoice(id, { query: { enabled: !!id, queryKey: getGetInvoiceQueryKey(id) } });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!invoice) {
    return <div className="text-center py-20 text-muted-foreground">Invoice not found.</div>;
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-4">
          <Link href="/invoices">
            <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4" /></Button>
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Invoice {invoice.invoiceNumber}</h1>
        </div>
        <Button onClick={handlePrint}><Printer className="w-4 h-4 mr-2" />Print / PDF</Button>
      </div>

      <div className="print:block" id="invoice-print">
        <div className="print:mb-8 print:border-b print:pb-4">
          <h2 className="text-2xl font-bold print:text-3xl">INVOICE</h2>
          <p className="text-muted-foreground print:text-black">{invoice.invoiceNumber}</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <Card className="print:border-0 print:shadow-none">
            <CardContent className="p-4 print:p-0">
              <h3 className="font-semibold mb-2">Invoice Details</h3>
              <div className="text-sm space-y-1">
                <div><span className="text-muted-foreground print:text-gray-600">Date:</span> {formatDate(invoice.date)}</div>
                <div><span className="text-muted-foreground print:text-gray-600">Invoice #:</span> {invoice.invoiceNumber}</div>
              </div>
            </CardContent>
          </Card>
          <Card className="print:border-0 print:shadow-none">
            <CardContent className="p-4 print:p-0">
              <h3 className="font-semibold mb-2">Bill To</h3>
              <div className="text-sm">
                <p className="font-medium">{invoice.customerName || "Walk-in Customer"}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="print:border-0 print:shadow-none">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">GST %</TableHead>
                  <TableHead className="text-right">GST Amt</TableHead>
                  <TableHead className="text-right">Discount</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.items.map((item, index) => (
                  <TableRow key={item.id || index}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell className="font-medium">{item.productName}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                    <TableCell className="text-right">{item.gstPercent}%</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.gstAmount)}</TableCell>
                    <TableCell className="text-right">{item.discountAmount ? formatCurrency(item.discountAmount) : "-"}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(item.totalAmount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="flex justify-end mt-6">
          <Card className="w-80 print:border-0 print:shadow-none">
            <CardContent className="p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(invoice.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">CGST</span>
                <span>{formatCurrency(invoice.totalGst / 2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">SGST</span>
                <span>{formatCurrency(invoice.totalGst / 2)}</span>
              </div>
              {invoice.totalDiscount > 0 && (
                <div className="flex justify-between text-sm text-destructive">
                  <span>Discount</span>
                  <span>-{formatCurrency(invoice.totalDiscount)}</span>
                </div>
              )}
              <div className="border-t pt-2 flex justify-between font-bold text-lg">
                <span>Grand Total</span>
                <span>{formatCurrency(invoice.grandTotal)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {invoice.notes && (
          <div className="mt-4 p-4 bg-muted rounded-md print:bg-gray-50">
            <p className="text-sm font-medium mb-1">Notes</p>
            <p className="text-sm text-muted-foreground">{invoice.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
