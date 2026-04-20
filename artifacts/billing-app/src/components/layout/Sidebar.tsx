import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Package,
  Users,
  FileText,
  BarChart3,
  Settings,
  ShoppingCart,
  UserCog,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

export function Sidebar() {
  const [location] = useLocation();
  const { user, isMaster, isAdmin, isSalesman, logout } = useAuth();

  const canViewReports = isMaster || isAdmin || (isSalesman && !!user?.permissions?.canViewReports);
  const canAccessInventory = isMaster || isAdmin || (isSalesman && !!user?.permissions?.canAccessInventory);
  const canBill = isMaster || isAdmin || (isSalesman && !!user?.permissions?.canBill);

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard, show: true },
    { href: "/products", label: "Products", icon: Package, show: canAccessInventory },
    { href: "/purchases", label: "Purchases", icon: ShoppingCart, show: canAccessInventory },
    { href: "/customers", label: "Customers", icon: Users, show: canBill || isAdmin || isMaster },
    { href: "/invoices", label: "Invoices", icon: FileText, show: canBill || isAdmin || isMaster },
    { href: "/reports", label: "Reports", icon: BarChart3, show: canViewReports },
    { href: "/users", label: "Users", icon: UserCog, show: isMaster || isAdmin },
    { href: "/settings", label: "Settings", icon: Settings, show: true },
  ].filter(item => item.show);

  return (
    <aside className="w-64 bg-sidebar text-sidebar-foreground min-h-screen flex flex-col border-r border-sidebar-border hidden md:flex print:hidden">
      <div className="p-6 border-b border-sidebar-border">
        <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <div className="w-6 h-6 bg-primary rounded flex items-center justify-center">
            <span className="text-xs font-bold">B</span>
          </div>
          BillingPro
        </h1>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors cursor-pointer text-sm font-medium",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </div>
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-sidebar-border space-y-2">
        {user && (
          <div className="px-3 py-2 rounded-md bg-sidebar-accent/30">
            <p className="text-xs font-medium text-sidebar-foreground">{user.username}</p>
            <p className="text-xs text-sidebar-foreground/50 capitalize">{user.role}</p>
          </div>
        )}
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors cursor-pointer text-sm font-medium w-full text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
        <div className="text-xs text-sidebar-foreground/50 px-3">
          &copy; 2025 BillingPro
        </div>
      </div>
    </aside>
  );
}
