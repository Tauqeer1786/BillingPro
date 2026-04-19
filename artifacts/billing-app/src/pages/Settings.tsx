import { useState } from "react";
import { useExportDatabase, useImportDatabase, customFetch } from "@workspace/api-client-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useBusinessProfile } from "@/hooks/use-business-profile";
import {
  Download,
  Upload,
  Database,
  RefreshCw,
  Trash2,
  Clock,
  HardDrive,
  FolderOpen,
  RotateCcw,
  Zap,
  Building2,
  Save,
} from "lucide-react";

interface AutoBackupFile {
  filename: string;
  createdAt: string;
  sizeBytes: number;
}

interface AutoBackupsResponse {
  backups: AutoBackupFile[];
  backupDir: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function useAutoBackups() {
  return useQuery<AutoBackupsResponse>({
    queryKey: ["auto-backups"],
    queryFn: () => customFetch<AutoBackupsResponse>("/api/backup/auto-backups"),
    refetchInterval: 30_000,
  });
}

function useTriggerBackup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      customFetch<{ success: boolean; filename: string }>("/api/backup/auto-backups/trigger", {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auto-backups"] });
    },
  });
}

function useDeleteBackup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (filename: string) =>
      customFetch(`/api/backup/auto-backups/${encodeURIComponent(filename)}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auto-backups"] });
    },
  });
}

export function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [importing, setImporting] = useState(false);
  const [restoringFile, setRestoringFile] = useState<string | null>(null);
  const { profile, updateProfile } = useBusinessProfile();
  const [localProfile, setLocalProfile] = useState(profile);

  function handleProfileSave() {
    updateProfile(localProfile);
    toast({ title: "Business profile saved", description: "Your details will appear on all invoices." });
  }

  const { refetch: fetchExport, isFetching: isExporting } = useExportDatabase({
    query: { enabled: false },
  });

  const importMutation = useImportDatabase();
  const { data: autoBackupsData, isLoading: isLoadingBackups, refetch: refetchBackups, isFetching: isRefetchingBackups } = useAutoBackups();
  const triggerBackup = useTriggerBackup();
  const deleteBackup = useDeleteBackup();

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

  async function handleTriggerBackup() {
    try {
      const result = await triggerBackup.mutateAsync();
      toast({ title: "Backup created", description: `Saved as ${result.filename}` });
    } catch {
      toast({ title: "Backup failed", variant: "destructive" });
    }
  }

  async function handleDownloadAutoBackup(filename: string) {
    try {
      const response = await fetch(`/api/backup/auto-backups/${encodeURIComponent(filename)}`);
      if (!response.ok) throw new Error("Failed to download");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Download started", description: filename });
    } catch {
      toast({ title: "Download failed", variant: "destructive" });
    }
  }

  async function handleRestoreAutoBackup(filename: string) {
    if (!confirm(`Restore from "${filename}"? This will replace ALL existing data.`)) return;

    setRestoringFile(filename);
    try {
      const response = await fetch(`/api/backup/auto-backups/${encodeURIComponent(filename)}`);
      if (!response.ok) throw new Error("Failed to fetch backup");
      const data = await response.json();
      await importMutation.mutateAsync({ data });
      queryClient.invalidateQueries();
      toast({ title: "Restore successful", description: `Data restored from ${filename}` });
    } catch {
      toast({ title: "Restore failed", description: "Could not restore from backup.", variant: "destructive" });
    } finally {
      setRestoringFile(null);
    }
  }

  async function handleDeleteAutoBackup(filename: string) {
    if (!confirm(`Delete backup "${filename}"? This cannot be undone.`)) return;
    try {
      await deleteBackup.mutateAsync(filename);
      toast({ title: "Backup deleted", description: filename });
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Business Profile
          </CardTitle>
          <CardDescription>
            This information appears on every invoice you print or download as PDF.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Business Name</Label>
              <Input value={localProfile.name} onChange={e => setLocalProfile(p => ({ ...p, name: e.target.value }))} placeholder="Your Business Name" />
            </div>
            <div className="space-y-1.5">
              <Label>GSTIN</Label>
              <Input value={localProfile.gstin} onChange={e => setLocalProfile(p => ({ ...p, gstin: e.target.value }))} placeholder="22AAAAA0000A1Z5" />
            </div>
            <div className="space-y-1.5">
              <Label>FSSAI Number <span className="text-muted-foreground font-normal text-xs">(optional, for food businesses)</span></Label>
              <Input value={localProfile.fssaiNumber} onChange={e => setLocalProfile(p => ({ ...p, fssaiNumber: e.target.value }))} placeholder="12345678901234" />
            </div>
            <div className="space-y-1.5">
              <Label>Address</Label>
              <Input value={localProfile.address} onChange={e => setLocalProfile(p => ({ ...p, address: e.target.value }))} placeholder="Street / Area" />
            </div>
            <div className="space-y-1.5">
              <Label>City, State - PIN</Label>
              <Input value={localProfile.city} onChange={e => setLocalProfile(p => ({ ...p, city: e.target.value }))} placeholder="Mumbai, Maharashtra - 400001" />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={localProfile.phone} onChange={e => setLocalProfile(p => ({ ...p, phone: e.target.value }))} placeholder="+91 98765 43210" />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={localProfile.email} onChange={e => setLocalProfile(p => ({ ...p, email: e.target.value }))} placeholder="you@business.com" />
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="text-sm font-medium text-muted-foreground mb-3">Bank Details (shown on invoice)</p>
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Bank Name</Label>
                <Input value={localProfile.bankName} onChange={e => setLocalProfile(p => ({ ...p, bankName: e.target.value }))} placeholder="State Bank of India" />
              </div>
              <div className="space-y-1.5">
                <Label>Account Number</Label>
                <Input value={localProfile.bankAccount} onChange={e => setLocalProfile(p => ({ ...p, bankAccount: e.target.value }))} placeholder="1234567890" />
              </div>
              <div className="space-y-1.5">
                <Label>IFSC Code</Label>
                <Input value={localProfile.bankIfsc} onChange={e => setLocalProfile(p => ({ ...p, bankIfsc: e.target.value }))} placeholder="SBIN0001234" />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Terms & Conditions</Label>
            <Input value={localProfile.termsAndConditions} onChange={e => setLocalProfile(p => ({ ...p, termsAndConditions: e.target.value }))} placeholder="Goods once sold will not be taken back. E & O.E." />
          </div>

          <div className="border-t pt-4">
            <div className="grid sm:grid-cols-2 gap-4 items-end">
              <div className="space-y-1.5">
                <Label>Invoice Print Page Size</Label>
                <Select value={localProfile.printPageSize} onValueChange={value => setLocalProfile(p => ({ ...p, printPageSize: value as "A4" | "A5" }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A4">A4 - Standard full-page invoice</SelectItem>
                    <SelectItem value="A5">A5 - Compact half-page invoice</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-sm text-muted-foreground">
                This controls the page size used by invoice Print and Download PDF.
              </p>
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="grid sm:grid-cols-2 gap-4 items-end">
              <div className="space-y-1.5">
                <Label>Financial Year Start Month</Label>
                <Select
                  value={String(localProfile.fyStartMonth ?? 4)}
                  onValueChange={value => setLocalProfile(p => ({ ...p, fyStartMonth: Number(value) }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      { v: 1, label: "January (Calendar Year)" },
                      { v: 4, label: "April (India Standard)" },
                      { v: 7, label: "July" },
                      { v: 10, label: "October" },
                      { v: 2, label: "February" },
                      { v: 3, label: "March" },
                      { v: 5, label: "May" },
                      { v: 6, label: "June" },
                      { v: 8, label: "August" },
                      { v: 9, label: "September" },
                      { v: 11, label: "November" },
                      { v: 12, label: "December" },
                    ].map(m => (
                      <SelectItem key={m.v} value={String(m.v)}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-sm text-muted-foreground">
                Sets which month the financial year begins. Default is April for Indian businesses.
              </p>
            </div>
          </div>

          <Button onClick={handleProfileSave} className="w-full sm:w-auto">
            <Save className="w-4 h-4 mr-2" />
            Save Business Profile
          </Button>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="w-5 h-5" />
              Export Database
            </CardTitle>
            <CardDescription>
              Download a complete backup of all your data as a JSON file.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleExport} disabled={isExporting} className="w-full">
              {isExporting ? "Exporting..." : "Download Backup"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Import Database
            </CardTitle>
            <CardDescription>
              Restore your data from a previously exported JSON backup file. Warning: This will replace all existing data.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleImport} disabled={importing} variant="outline" className="w-full">
              {importing ? "Importing..." : "Upload Backup File"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Auto Backups
            </CardTitle>
            <CardDescription>
              The server automatically saves a backup every 24 hours. Up to 10 backups are kept. You can also trigger a backup manually at any time.
            </CardDescription>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchBackups()}
              disabled={isRefetchingBackups}
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${isRefetchingBackups ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={handleTriggerBackup}
              disabled={triggerBackup.isPending}
            >
              <Zap className="w-4 h-4 mr-1" />
              {triggerBackup.isPending ? "Saving..." : "Backup Now"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {autoBackupsData?.backupDir && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
              <FolderOpen className="w-3.5 h-3.5 shrink-0" />
              <span className="font-mono break-all">{autoBackupsData.backupDir}</span>
            </div>
          )}

          {isLoadingBackups ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-14 bg-muted animate-pulse rounded-md" />
              ))}
            </div>
          ) : !autoBackupsData?.backups?.length ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
              <HardDrive className="w-8 h-8 opacity-40" />
              <p className="text-sm">No auto-backups yet.</p>
              <Button variant="outline" size="sm" onClick={handleTriggerBackup} disabled={triggerBackup.isPending}>
                <Zap className="w-4 h-4 mr-1" />
                Create First Backup
              </Button>
            </div>
          ) : (
            <div className="divide-y rounded-md border overflow-hidden">
              {autoBackupsData.backups.map((backup, index) => (
                <div
                  key={backup.filename}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 bg-background hover:bg-muted/30 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium font-mono truncate">{backup.filename}</span>
                      {index === 0 && (
                        <Badge variant="secondary" className="text-xs shrink-0">Latest</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(backup.createdAt)}
                      </span>
                      <span className="flex items-center gap-1">
                        <HardDrive className="w-3 h-3" />
                        {formatBytes(backup.sizeBytes)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadAutoBackup(backup.filename)}
                    >
                      <Download className="w-3.5 h-3.5 mr-1" />
                      Download
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRestoreAutoBackup(backup.filename)}
                      disabled={restoringFile === backup.filename}
                    >
                      <RotateCcw className="w-3.5 h-3.5 mr-1" />
                      {restoringFile === backup.filename ? "Restoring..." : "Restore"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDeleteAutoBackup(backup.filename)}
                      disabled={deleteBackup.isPending}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            About BillingPro
          </CardTitle>
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
