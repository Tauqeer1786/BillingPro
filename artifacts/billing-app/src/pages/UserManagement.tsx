import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Users, Plus, Trash2, Key, Settings2, ShieldCheck, UserCog } from "lucide-react";

interface SalesmanPermissions {
  id: number;
  userId: number;
  canAccessDashboard: boolean;
  canBill: boolean;
  canViewReports: boolean;
  canEditInvoices: boolean;
  canAccessInventory: boolean;
}

interface UserRecord {
  id: number;
  username: string;
  role: "master" | "admin" | "salesman";
  isActive: boolean;
  createdAt: string;
  permissions: SalesmanPermissions | null;
}

function roleBadge(role: string) {
  const variants: Record<string, string> = {
    master: "bg-purple-100 text-purple-800 border-purple-200",
    admin: "bg-blue-100 text-blue-800 border-blue-200",
    salesman: "bg-green-100 text-green-800 border-green-200",
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${variants[role] || ""}`}>
      {role.charAt(0).toUpperCase() + role.slice(1)}
    </span>
  );
}

export function UserManagement() {
  const { user: currentUser, isMaster, isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState<UserRecord | null>(null);
  const [showPermDialog, setShowPermDialog] = useState<UserRecord | null>(null);

  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "salesman">("salesman");

  const [newPass, setNewPass] = useState("");
  const [editPerms, setEditPerms] = useState<Partial<SalesmanPermissions>>({});

  const { data: users = [], isLoading, error: usersError } = useQuery<UserRecord[]>({
    queryKey: ["users"],
    queryFn: () => customFetch<UserRecord[]>("/api/users"),
  });

  const createUser = useMutation({
    mutationFn: (data: { username: string; password: string; role: string }) =>
      customFetch("/api/users", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setShowCreateDialog(false);
      setNewUsername("");
      setNewPassword("");
      setNewRole("salesman");
      toast({ title: "User created successfully" });
    },
    onError: (err: Error) => toast({ title: "Failed to create user", description: err.message, variant: "destructive" }),
  });

  const deleteUser = useMutation({
    mutationFn: (id: number) => customFetch(`/api/users/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({ title: "User deleted" });
    },
    onError: (err: Error) => toast({ title: "Delete failed", description: err.message, variant: "destructive" }),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      customFetch(`/api/users/${id}`, { method: "PUT", body: JSON.stringify({ isActive }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
    onError: (err: Error) => toast({ title: "Update failed", description: err.message, variant: "destructive" }),
  });

  const resetPassword = useMutation({
    mutationFn: ({ targetUserId, newPassword }: { targetUserId: number; newPassword: string }) =>
      customFetch("/api/auth/change-password", { method: "POST", body: JSON.stringify({ targetUserId, newPassword }) }),
    onSuccess: () => {
      setShowPasswordDialog(null);
      setNewPass("");
      toast({ title: "Password reset successfully" });
    },
    onError: (err: Error) => toast({ title: "Password reset failed", description: err.message, variant: "destructive" }),
  });

  const updatePermissions = useMutation({
    mutationFn: ({ id, permissions }: { id: number; permissions: Partial<SalesmanPermissions> }) =>
      customFetch(`/api/users/${id}`, { method: "PUT", body: JSON.stringify({ permissions }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setShowPermDialog(null);
      toast({ title: "Permissions updated" });
    },
    onError: (err: Error) => toast({ title: "Update failed", description: err.message, variant: "destructive" }),
  });

  function handleCreateUser() {
    if (!newUsername.trim() || !newPassword.trim()) return;
    createUser.mutate({ username: newUsername.trim(), password: newPassword, role: newRole });
  }

  function handleDelete(u: UserRecord) {
    if (!confirm(`Delete user "${u.username}"? This cannot be undone.`)) return;
    deleteUser.mutate(u.id);
  }

  function openPermDialog(u: UserRecord) {
    setEditPerms(u.permissions || {});
    setShowPermDialog(u);
  }

  const visibleUsers = users.filter(u => {
    if (isMaster) return u.id !== currentUser?.id;
    if (isAdmin) return u.role === "salesman";
    return false;
  });

  if (!isMaster && !isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
        <ShieldCheck className="w-10 h-10 opacity-30" />
        <p>You do not have access to user management.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isMaster ? "Manage all admin and salesman accounts" : "Manage salesman accounts and permissions"}
          </p>
        </div>
        {isMaster && (
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create User
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}
        </div>
      ) : usersError ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-destructive gap-2">
            <Users className="w-8 h-8 opacity-40" />
            <p className="text-sm font-medium">Could not load users.</p>
            <p className="text-xs text-muted-foreground">{usersError instanceof Error ? usersError.message : "Please sign in again."}</p>
          </CardContent>
        </Card>
      ) : visibleUsers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
            <Users className="w-8 h-8 opacity-30" />
            <p className="text-sm">No users found. Create your first user to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {visibleUsers.map(u => (
            <Card key={u.id}>
              <CardContent className="flex flex-col sm:flex-row sm:items-center gap-4 p-4">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{u.username}</span>
                    {roleBadge(u.role)}
                    {!u.isActive && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                        Inactive
                      </span>
                    )}
                  </div>
                  {u.role === "salesman" && u.permissions && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {u.permissions.canAccessDashboard && <Badge variant="secondary" className="text-xs">Dashboard</Badge>}
                      {u.permissions.canBill && <Badge variant="secondary" className="text-xs">Billing</Badge>}
                      {u.permissions.canViewReports && <Badge variant="secondary" className="text-xs">Reports</Badge>}
                      {u.permissions.canEditInvoices && <Badge variant="secondary" className="text-xs">Edit Invoices</Badge>}
                      {u.permissions.canAccessInventory && <Badge variant="secondary" className="text-xs">Inventory</Badge>}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {isMaster && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Active</span>
                      <Switch
                        checked={u.isActive}
                        onCheckedChange={checked => toggleActive.mutate({ id: u.id, isActive: checked })}
                      />
                    </div>
                  )}
                  {u.role === "salesman" && (isAdmin || isMaster) && (
                    <Button variant="outline" size="sm" onClick={() => openPermDialog(u)}>
                      <Settings2 className="w-3.5 h-3.5 mr-1" />
                      Permissions
                    </Button>
                  )}
                  {(isMaster || (isAdmin && u.role === "salesman")) && (
                    <Button variant="outline" size="sm" onClick={() => { setNewPass(""); setShowPasswordDialog(u); }}>
                      <Key className="w-3.5 h-3.5 mr-1" />
                      Reset Password
                    </Button>
                  )}
                  {isMaster && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(u)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="w-5 h-5" />
              Create New User
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Username</Label>
              <Input value={newUsername} onChange={e => setNewUsername(e.target.value)} placeholder="Enter username" />
            </div>
            <div className="space-y-1.5">
              <Label>Password</Label>
              <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min 4 characters" />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={newRole} onValueChange={v => setNewRole(v as "admin" | "salesman")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="salesman">Salesman</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateUser} disabled={createUser.isPending}>
              {createUser.isPending ? "Creating..." : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showPasswordDialog} onOpenChange={open => !open && setShowPasswordDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              Reset Password — {showPasswordDialog?.username}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>New Password</Label>
              <Input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="Min 4 characters" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordDialog(null)}>Cancel</Button>
            <Button
              onClick={() => showPasswordDialog && resetPassword.mutate({ targetUserId: showPasswordDialog.id, newPassword: newPass })}
              disabled={resetPassword.isPending || newPass.length < 4}
            >
              {resetPassword.isPending ? "Resetting..." : "Reset Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showPermDialog} onOpenChange={open => !open && setShowPermDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5" />
              Permissions — {showPermDialog?.username}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {[
              { key: "canAccessDashboard", label: "Dashboard Access", desc: "Can view the dashboard overview" },
              { key: "canBill", label: "Billing Access", desc: "Can create and manage invoices" },
              { key: "canViewReports", label: "View Reports", desc: "Can access sales and profit reports" },
              { key: "canEditInvoices", label: "Edit Invoices", desc: "Can edit existing invoices" },
              { key: "canAccessInventory", label: "Inventory Access", desc: "Can manage products and purchases" },
            ].map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between gap-4 p-3 rounded-lg border bg-muted/20">
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
                <Switch
                  checked={!!(editPerms as Record<string, boolean>)[key]}
                  onCheckedChange={checked => setEditPerms(prev => ({ ...prev, [key]: checked }))}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPermDialog(null)}>Cancel</Button>
            <Button
              onClick={() => showPermDialog && updatePermissions.mutate({ id: showPermDialog.id, permissions: editPerms })}
              disabled={updatePermissions.isPending}
            >
              {updatePermissions.isPending ? "Saving..." : "Save Permissions"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
