import { useState, useEffect } from "react";
import { useExportDatabase, useImportDatabase, customFetch } from "@workspace/api-client-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
  Lock,
  Unlock,
  Key,
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

const PROFILE_DEFAULTS = {
  businessName: "",
  gstin: "",
  fssaiNumber: "",
  address: "",
  city: "",
  phone: "",
  email: "",
  bankName: "",
  bankAccount: "",
  bankIfsc: "",
  termsAndConditions: "",
  printPageSize: "A4",
  fyStartMonth: "4",
};

function useBusinessSettings() {
  return useQuery<Record<string, string>>({
    queryKey: ["business-settings"],
    queryFn: () => customFetch<Record<string, string>>("/api/business-settings"),
  });
}

function useBusinessSettingsLock() {
  return useQuery<{ locked: boolean }>({
    queryKey: ["business-settings-lock"],
    queryFn: () => customFetch<{ locked: boolean }>("/api/business-settings/lock-status"),
  });
}

export function Settings() {
  const { toast } = useToast();
  const { isMaster, isAdmin, isSalesman } = useAuth();
  const queryClient = useQueryClient();
  const [importing, setImporting] = useState(false);
  const [restoringFile, setRestoringFile] = useState<string | null>(null);

  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");

  const { data: remoteSettings, isLoading: isLoadingSettings } = useBusinessSettings();
  const { data: lockStatus, refetch: refetchLock } = useBusinessSettingsLock();
  const isLocked = lockStatus?.locked ?? false;

  const [localSettings, setLocalSettings] = useState<Record<string, string>>(PROFILE_DEFAULTS);

  useEffect(() => {
    if (remoteSettings) {
      setLocalSettings(s => ({ ...PROFILE_DEFAULTS, ...remoteSettings, ...s }));
      setLocalSettings({ ...PROFILE_DEFAULTS, ...remoteSettings });
    }
  }, [remoteSettings]);

  const saveSettings = useMutation({
    mutationFn: (data: Record<string, string>) =>
      customFetch("/api/business-settings", { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business-settings"] });
      toast({ title: "Business profile saved" });
    },
    onError: (err: Error) => toast({ title: "Save failed", description: err.message, variant: "destructive" }),
  });

  const toggleLock = useMutation({
    mutationFn: () => customFetch("/api/business-settings/toggle-lock", { method: "POST" }),
    onSuccess: () => {
      refetchLock();
      queryClient.invalidateQueries({ queryKey: ["business-settings-lock"] });
      toast({ title: isLocked ? "Settings unlocked" : "Settings locked" });
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const changePassword = useMutation({
    mutationFn: ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) =>
      customFetch("/api/auth/change-password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) }),
    onSuccess: () => {
      setShowChangePassword(false);
      setCurrentPass("");
      setNewPass("");
      setConfirmPass("");
      toast({ title: "Password changed successfully" });
    },
    onError: (err: Error) => toast({ title: "Password change failed", description: err.message, variant: "destructive" }),
  });

  function handleSaveProfile() {
    const updates: Record<string, string> = {};
    if (isMaster) {
      updates.businessName = localSettings.businessName;
      updates.gstin = localSettings.gstin;
      updates.fssaiNumber = localSettings.fssaiNumber;
    }
    if (isMaster || isAdmin) {
      updates.address = localSettings.address;
      updates.city = localSettings.city;
      updates.phone = localSettings.phone;
      updates.email = localSettings.email;
      updates.bankName = localSettings.bankName;
      updates.bankAccount = localSettings.bankAccount;
      updates.bankIfsc = localSettings.bankIfsc;
      updates.termsAndConditions = localSettings.termsAndConditions;
      updates.printPageSize = localSettings.printPageSize;
      updates.fyStartMonth = localSettings.fyStartMonth;
    }
    saveSettings.mutate(updates);
  }

  function handlePasswordChange() {
    if (newPass !== confirmPass) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    changePassword.mutate({ currentPassword: currentPass, newPassword: newPass });
  }

  function set(key: string, value: string) {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  }

  function isMasterOnlyEditable(): boolean {
    return isMaster && !isLocked;
  }

  function isAdminEditable(): boolean {
    if (isSalesman) return false;
    if (isAdmin) return true;
    if (isMaster) return !isLocked;
    return false;
  }

  const { refetch: fetchExport, isFetching: isExporting } = useExportDatabase({ query: { enabled: false } });
  const importMutation = useImportDatabase();

  const { data: autoBackupsData, isLoading: isLoadingBackups, refetch: refetchBackups, isFetching: isRefetchingBackups } = useQuery<AutoBackupsResponse>({
    queryKey: ["auto-backups"],
    queryFn: () => customFetch<AutoBackupsResponse>("/api/backup/auto-backups"),
    refetchInterval: 30_000,
  });

  const triggerBackup = useMutation({
    mutationFn: () => customFetch<{ success: boolean; filename: string }>("/api/backup/auto-backups/trigger", { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["auto-backups"] }),
  });

  const deleteBackup = useMutation({
    mutationFn: (filename: string) => customFetch(`/api/backup/auto-backups/${encodeURIComponent(filename)}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["auto-backups"] }),
  });

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
        toast({ title: "Export successful" });
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
      if (!confirm("This will replace ALL existing data. Are you sure?")) return;
      setImporting(true);
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        await importMutation.mutateAsync({ data });
        queryClient.invalidateQueries();
        toast({ title: "Import successful" });
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
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Download started" });
    } catch {
      toast({ title: "Download failed", variant: "destructive" });
    }
  }

  async function handleRestoreAutoBackup(filename: string) {
    if (!confirm(`Restore from "${filename}"? This will replace ALL existing data.`)) return;
    setRestoringFile(filename);
    try {
      const response = await fetch(`/api/backup/auto-backups/${encodeURIComponent(filename)}`);
      if (!response.ok) throw new Error();
      const data = await response.json();
      await importMutation.mutateAsync({ data });
      queryClient.invalidateQueries();
      toast({ title: "Restore successful" });
    } catch {
      toast({ title: "Restore failed", variant: "destructive" });
    } finally {
      setRestoringFile(null);
    }
  }

  async function handleDeleteAutoBackup(filename: string) {
    if (!confirm(`Delete backup "${filename}"?`)) return;
    try {
      await deleteBackup.mutateAsync(filename);
      toast({ title: "Backup deleted" });
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    }
  }

  const canEditProfile = isMaster || isAdmin;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Settings</h1>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Business Profile
              </CardTitle>
              <CardDescription>
                This information appears on every invoice you print or download as PDF.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {isLocked && (
                <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
                  <Lock className="w-3 h-3 mr-1" />
                  Locked
                </Badge>
              )}
              {isMaster && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleLock.mutate()}
                  disabled={toggleLock.isPending}
                >
                  {isLocked ? <Unlock className="w-4 h-4 mr-1" /> : <Lock className="w-4 h-4 mr-1" />}
                  {isLocked ? "Unlock" : "Lock"} Settings
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoadingSettings ? (
            <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-10 bg-muted animate-pulse rounded" />)}</div>
          ) : (
            <>
              {isAdmin && !isMaster && (
                <div className="rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-sm text-blue-700">
                  As Admin, you can update all business details except Business Name, GST Number, and FSSAI Number — those are restricted to the Master.
                </div>
              )}
              {isSalesman && (
                <div className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                  Business settings can only be modified by Admin or Master.
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Business Name {!isMasterOnlyEditable() && <span className="text-xs text-muted-foreground">(Master only)</span>}</Label>
                  <Input
                    value={localSettings.businessName}
                    onChange={e => set("businessName", e.target.value)}
                    placeholder="Your Business Name"
                    disabled={!isMasterOnlyEditable()}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>GSTIN {!isMasterOnlyEditable() && <span className="text-xs text-muted-foreground">(Master only)</span>}</Label>
                  <Input
                    value={localSettings.gstin}
                    onChange={e => set("gstin", e.target.value)}
                    placeholder="22AAAAA0000A1Z5"
                    disabled={!isMasterOnlyEditable()}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>FSSAI Number <span className="text-muted-foreground font-normal text-xs">(optional)</span> {!isMasterOnlyEditable() && <span className="text-xs text-muted-foreground">(Master only)</span>}</Label>
                  <Input
                    value={localSettings.fssaiNumber}
                    onChange={e => set("fssaiNumber", e.target.value)}
                    placeholder="12345678901234"
                    disabled={!isMasterOnlyEditable()}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Address</Label>
                  <Input
                    value={localSettings.address}
                    onChange={e => set("address", e.target.value)}
                    placeholder="Street / Area"
                    disabled={!isAdminEditable()}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>City, State - PIN</Label>
                  <Input
                    value={localSettings.city}
                    onChange={e => set("city", e.target.value)}
                    placeholder="Mumbai, Maharashtra - 400001"
                    disabled={!isAdminEditable()}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input
                    value={localSettings.phone}
                    onChange={e => set("phone", e.target.value)}
                    placeholder="+91 98765 43210"
                    disabled={!isAdminEditable()}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input
                    value={localSettings.email}
                    onChange={e => set("email", e.target.value)}
                    placeholder="you@business.com"
                    disabled={!isAdminEditable()}
                  />
                </div>
              </div>

              {(isMaster || isAdmin) && (
                <>
                  <div className="border-t pt-4">
                    <p className="text-sm font-medium text-muted-foreground mb-3">Bank Details (shown on invoice)</p>
                    <div className="grid sm:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <Label>Bank Name</Label>
                        <Input value={localSettings.bankName} onChange={e => set("bankName", e.target.value)} placeholder="State Bank of India" disabled={!isAdminEditable()} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Account Number</Label>
                        <Input value={localSettings.bankAccount} onChange={e => set("bankAccount", e.target.value)} placeholder="1234567890" disabled={!isAdminEditable()} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>IFSC Code</Label>
                        <Input value={localSettings.bankIfsc} onChange={e => set("bankIfsc", e.target.value)} placeholder="SBIN0001234" disabled={!isAdminEditable()} />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Terms & Conditions</Label>
                    <Input value={localSettings.termsAndConditions} onChange={e => set("termsAndConditions", e.target.value)} placeholder="Goods once sold will not be taken back." disabled={!isAdminEditable()} />
                  </div>

                  <div className="border-t pt-4">
                    <div className="grid sm:grid-cols-2 gap-4 items-end">
                      <div className="space-y-1.5">
                        <Label>Invoice Print Page Size</Label>
                        <Select value={localSettings.printPageSize} onValueChange={v => set("printPageSize", v)} disabled={!isAdminEditable()}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="A4">A4 - Standard full-page invoice</SelectItem>
                            <SelectItem value="A5">A5 - Compact half-page invoice</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <p className="text-sm text-muted-foreground">Controls the page size for invoice print and PDF.</p>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <div className="grid sm:grid-cols-2 gap-4 items-end">
                      <div className="space-y-1.5">
                        <Label>Financial Year Start Month</Label>
                        <Select value={String(localSettings.fyStartMonth ?? 4)} onValueChange={v => set("fyStartMonth", v)} disabled={!isAdminEditable()}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
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
                            ].map(m => <SelectItem key={m.v} value={String(m.v)}>{m.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <p className="text-sm text-muted-foreground">Sets which month the financial year begins.</p>
                    </div>
                  </div>
                </>
              )}

              {canEditProfile && (
                <Button onClick={handleSaveProfile} className="w-full sm:w-auto" disabled={saveSettings.isPending}>
                  <Save className="w-4 h-4 mr-2" />
                  {saveSettings.isPending ? "Saving..." : "Save Business Profile"}
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="w-5 h-5" />
            Change My Password
          </CardTitle>
          <CardDescription>Update your own login password.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => setShowChangePassword(true)}>
            Change Password
          </Button>
        </CardContent>
      </Card>

      {(isMaster || isAdmin) && (
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Download className="w-5 h-5" />Export Database</CardTitle>
              <CardDescription>Download a complete backup of all your data as a JSON file.</CardDescription>
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
      )}

      {(isMaster || isAdmin) && (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2"><Clock className="w-5 h-5" />Auto Backups</CardTitle>
              <CardDescription>The server automatically saves a backup every 24 hours. Up to 10 backups are kept.</CardDescription>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={() => refetchBackups()} disabled={isRefetchingBackups}>
                <RefreshCw className={`w-4 h-4 mr-1 ${isRefetchingBackups ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button size="sm" onClick={handleTriggerBackup} disabled={triggerBackup.isPending}>
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
              <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-14 bg-muted animate-pulse rounded-md" />)}</div>
            ) : !autoBackupsData?.backups?.length ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
                <HardDrive className="w-8 h-8 opacity-40" />
                <p className="text-sm">No auto-backups yet.</p>
                <Button variant="outline" size="sm" onClick={handleTriggerBackup} disabled={triggerBackup.isPending}>
                  <Zap className="w-4 h-4 mr-1" />Create First Backup
                </Button>
              </div>
            ) : (
              <div className="divide-y rounded-md border overflow-hidden">
                {autoBackupsData.backups.map((backup, index) => (
                  <div key={backup.filename} className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 bg-background hover:bg-muted/30 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium font-mono truncate">{backup.filename}</span>
                        {index === 0 && <Badge variant="secondary" className="text-xs shrink-0">Latest</Badge>}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDate(backup.createdAt)}</span>
                        <span className="flex items-center gap-1"><HardDrive className="w-3 h-3" />{formatBytes(backup.sizeBytes)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button variant="outline" size="sm" onClick={() => handleDownloadAutoBackup(backup.filename)}>
                        <Download className="w-3.5 h-3.5 mr-1" />Download
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleRestoreAutoBackup(backup.filename)} disabled={restoringFile === backup.filename}>
                        <RotateCcw className="w-3.5 h-3.5 mr-1" />{restoringFile === backup.filename ? "Restoring..." : "Restore"}
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDeleteAutoBackup(backup.filename)} disabled={deleteBackup.isPending}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Database className="w-5 h-5" />About BillingPro</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>BillingPro is an offline billing application designed for small businesses and shops.</p>
          <p>Features: Product management, invoicing with GST, customer tracking, profit analytics, financial year reports, and data backup/restore.</p>
          <p>Version 1.0.0 — RBAC enabled</p>
        </CardContent>
      </Card>

      <Dialog open={showChangePassword} onOpenChange={setShowChangePassword}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              Change Password
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Current Password</Label>
              <Input type="password" value={currentPass} onChange={e => setCurrentPass(e.target.value)} placeholder="Enter current password" />
            </div>
            <div className="space-y-1.5">
              <Label>New Password</Label>
              <Input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="Min 4 characters" />
            </div>
            <div className="space-y-1.5">
              <Label>Confirm New Password</Label>
              <Input type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} placeholder="Re-enter new password" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowChangePassword(false)}>Cancel</Button>
            <Button onClick={handlePasswordChange} disabled={changePassword.isPending || newPass.length < 4}>
              {changePassword.isPending ? "Changing..." : "Change Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
