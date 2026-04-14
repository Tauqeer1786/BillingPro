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

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/products" component={Products} />
      <Route path="/customers" component={Customers} />
      <Route path="/invoices" component={Invoices} />
      <Route path="/invoices/new" component={NewInvoice} />
      <Route path="/invoices/:id">
        {(params) => <InvoiceDetail id={parseInt(params.id)} />}
      </Route>
      <Route path="/reports" component={Reports} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Layout>
            <Router />
          </Layout>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
