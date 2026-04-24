import "./App.css";
import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { SettingsProvider } from "./context/SettingsContext";
import { I18nProvider } from "./i18n/I18nContext";
import { Toaster } from "./components/ui/sonner";
import Login from "./pages/Login";
import Layout from "./layout/Layout";
import Dashboard from "./pages/Dashboard";
import POS from "./pages/POS";
import Products from "./pages/Products";
import Services from "./pages/Services";
import Customers from "./pages/Customers";
import Appointments from "./pages/Appointments";
import Invoices from "./pages/Invoices";
import InvoiceView from "./pages/InvoiceView";
import Expenses from "./pages/Expenses";
import Reports from "./pages/Reports";
import YearlyTaxReport from "./pages/YearlyTaxReport";
import SettingsPage from "./pages/Settings";
import Account from "./pages/Account";
import { startBackupScheduler } from "./services/backup";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-muted-foreground">
        جاري التحميل...
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

/** Master-developer-only route guard. Anyone else is bounced to /account. */
function MasterOnly({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "master") return <Navigate to="/account" replace />;
  return children;
}

/** Boot-time effects that require a logged-in user (e.g. backup scheduler). */
function BootEffects() {
  const { user } = useAuth();
  useEffect(() => {
    if (user) startBackupScheduler();
  }, [user]);
  return null;
}

function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <SettingsProvider>
          <BrowserRouter>
            <BootEffects />
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route
                path="/"
                element={
                  <Protected>
                    <Layout />
                  </Protected>
                }
              >
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="pos" element={<POS />} />
                <Route path="products" element={<Products />} />
                <Route path="services" element={<Services />} />
                <Route path="customers" element={<Customers />} />
                <Route path="appointments" element={<Appointments />} />
                <Route path="invoices" element={<Invoices />} />
                <Route path="invoices/:id" element={<InvoiceView />} />
                <Route path="expenses" element={<Expenses />} />
                <Route path="reports" element={<Reports />} />
                <Route path="reports/yearly-tax" element={<YearlyTaxReport />} />
                <Route path="account" element={<Account />} />
                {/* Technical settings — Master developer account only */}
                <Route
                  path="settings"
                  element={
                    <MasterOnly>
                      <SettingsPage />
                    </MasterOnly>
                  }
                />
              </Route>
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </BrowserRouter>
          <Toaster position="top-center" richColors />
        </SettingsProvider>
      </AuthProvider>
    </I18nProvider>
  );
}

export default App;
