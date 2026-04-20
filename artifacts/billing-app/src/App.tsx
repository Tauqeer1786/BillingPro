import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/layout/Layout";
import { Dashboard } from "@/pages/Dashboard";
import { Products } from "@/pages/Products";
import { Customers } from "@/pages/Customers";
import { Invoices } from "@/pages/Invoices";
import { NewInvoice } from "@/pages/NewInvoice";
import { InvoiceDetail } from "@/pages/InvoiceDetail";
import { Reports } from "@/pages/Reports";
import { Settings } from "@/pages/Settings";
import { Purchases } from "@/pages/Purchases";
import { NewPurchase } from "@/pages/NewPurchase";
import { BulkAddProducts } from "@/pages/BulkAddProducts";
import { UserManagement } from "@/pages/UserManagement";
import { Login } from "@/pages/Login";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

const queryClient = new QueryClient();

function Router() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/products" component={Products} />
        <Route path="/products/bulk-add" component={BulkAddProducts} />
        <Route path="/customers" component={Customers} />
        <Route path="/invoices" component={Invoices} />
        <Route path="/invoices/new" component={NewInvoice} />
        <Route path="/invoices/:id">
          {(params) => <InvoiceDetail id={parseInt(params.id)} />}
        </Route>
        <Route path="/purchases" component={Purchases} />
        <Route path="/purchases/new" component={NewPurchase} />
        <Route path="/reports" component={Reports} />
        <Route path="/settings" component={Settings} />
        <Route path="/users" component={UserManagement} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
