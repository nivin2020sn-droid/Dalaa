import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { SettingsProvider } from "./context/SettingsContext";
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
import SettingsPage from "./pages/Settings";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="flex items-center justify-center min-h-screen text-muted-foreground">
        جاري التحميل...
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <BrowserRouter>
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
              <Route path="settings" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-center" richColors />
      </SettingsProvider>
    </AuthProvider>
  );
}

export default App;
