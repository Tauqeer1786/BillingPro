import { useState } from "react";
import { useExportDatabase, useImportDatabase } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Download, Upload, Database } from "lucide-react";

export function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [importing, setImporting] = useState(false);

  const { data: exportData, refetch: fetchExport, isFetching: isExporting } = useExportDatabase({
    query: { enabled: false },
  });

  const importMutation = useImportDatabase();

  async function handleExport() {
    try {
      const result = await fetchExport();
      if (result.data) {
        const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `billingpro-backup-${new Date().toISOString().split("T")[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast({ title: "Export successful", description: "Database backup downloaded." });
      }
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    }
  }

  async function handleImport() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      if (!confirm("This will replace ALL existing data with the imported data. Are you sure?")) return;

      setImporting(true);
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        await importMutation.mutateAsync({ data });
        queryClient.invalidateQueries();
        toast({ title: "Import successful", description: "Database restored from backup." });
      } catch {
        toast({ title: "Import failed", description: "Invalid backup file.", variant: "destructive" });
      } finally {
        setImporting(false);
      }
    };
    input.click();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Settings</h1>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Download className="w-5 h-5" />Export Database</CardTitle>
            <CardDescription>Download a complete backup of all your data as a JSON file. Use this to keep a copy of your products, customers, and invoices.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleExport} disabled={isExporting} className="w-full">
              {isExporting ? "Exporting..." : "Download Backup"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Upload className="w-5 h-5" />Import Database</CardTitle>
            <CardDescription>Restore your data from a previously exported JSON backup file. Warning: This will replace all existing data.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleImport} disabled={importing} variant="outline" className="w-full">
              {importing ? "Importing..." : "Upload Backup File"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Database className="w-5 h-5" />About BillingPro</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>BillingPro is an offline billing application designed for small businesses and shops.</p>
          <p>Features: Product management, invoicing with GST, customer tracking, profit analytics, financial year reports, and data backup/restore.</p>
          <p>Version 1.0.0</p>
        </CardContent>
      </Card>
    </div>
  );
}
