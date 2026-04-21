import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Scissors,
  Users,
  CalendarDays,
  Receipt,
  Wallet,
  TrendingUp,
  LogOut,
  Sparkles,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";

const NAV = [
  { to: "/dashboard", label: "لوحة التحكم", icon: LayoutDashboard, testid: "nav-dashboard" },
  { to: "/pos", label: "نقطة البيع", icon: ShoppingCart, testid: "nav-pos" },
  { to: "/appointments", label: "المواعيد", icon: CalendarDays, testid: "nav-appointments" },
  { to: "/invoices", label: "الفواتير", icon: Receipt, testid: "nav-invoices" },
  { to: "/products", label: "المنتجات", icon: Package, testid: "nav-products" },
  { to: "/services", label: "الخدمات", icon: Scissors, testid: "nav-services" },
  { to: "/customers", label: "العملاء", icon: Users, testid: "nav-customers" },
  { to: "/expenses", label: "المصاريف", icon: Wallet, testid: "nav-expenses" },
  { to: "/reports", label: "التقارير", icon: TrendingUp, testid: "nav-reports" },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex bg-background" data-testid="app-layout">
      {/* Sidebar (right for RTL) */}
      <aside
        className="w-64 bg-white border-l border-border hidden md:flex flex-col sticky top-0 h-screen"
        data-testid="sidebar"
      >
        <div className="px-6 py-6 border-b border-border flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
            <Sparkles size={20} strokeWidth={2} />
          </div>
          <div>
            <div className="font-heading font-bold text-lg leading-none">صالون</div>
            <div className="text-xs text-muted-foreground mt-1">نظام المحاسبة</div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                data-testid={item.testid}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`
                }
              >
                <Icon size={18} strokeWidth={1.5} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="w-9 h-9 rounded-full bg-accent text-accent-foreground flex items-center justify-center font-bold">
              {user?.name?.[0] || "م"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{user?.name}</div>
              <div className="text-xs text-muted-foreground">
                {user?.role === "admin" ? "مدير" : "كاشير"}
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            className="w-full"
            onClick={handleLogout}
            data-testid="logout-button"
          >
            <LogOut size={16} className="ml-2" /> خروج
          </Button>
        </div>
      </aside>

      {/* Mobile top nav */}
      <div className="md:hidden fixed top-0 inset-x-0 bg-white border-b border-border z-40 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
            <Sparkles size={16} />
          </div>
          <span className="font-heading font-bold">صالون</span>
        </div>
        <Button variant="outline" size="sm" onClick={handleLogout} data-testid="logout-button-mobile">
          <LogOut size={14} />
        </Button>
      </div>

      <main className="flex-1 md:mr-0 pt-16 md:pt-0 min-w-0">
        {/* Mobile sub-nav */}
        <div className="md:hidden overflow-x-auto border-b border-border bg-white">
          <div className="flex gap-1 px-2 py-2 min-w-max">
            {NAV.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
                      isActive ? "bg-primary text-white" : "bg-secondary text-muted-foreground"
                    }`
                  }
                >
                  <Icon size={14} /> {item.label}
                </NavLink>
              );
            })}
          </div>
        </div>

        <div className="p-4 md:p-8 max-w-[1500px] mx-auto animate-fadein">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
