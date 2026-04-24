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
  Settings as SettingsIcon,
  Languages,
  UserCog,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import { useI18n } from "../i18n/I18nContext";
import { Button } from "../components/ui/button";

// Items that every logged-in user sees.
const BASE_NAV = [
  { to: "/dashboard", tk: "nav.dashboard", icon: LayoutDashboard, testid: "nav-dashboard" },
  { to: "/pos", tk: "nav.pos", icon: ShoppingCart, testid: "nav-pos" },
  { to: "/appointments", tk: "nav.appointments", icon: CalendarDays, testid: "nav-appointments" },
  { to: "/invoices", tk: "nav.invoices", icon: Receipt, testid: "nav-invoices" },
  { to: "/products", tk: "nav.products", icon: Package, testid: "nav-products" },
  { to: "/services", tk: "nav.services", icon: Scissors, testid: "nav-services" },
  { to: "/customers", tk: "nav.customers", icon: Users, testid: "nav-customers" },
  { to: "/expenses", tk: "nav.expenses", icon: Wallet, testid: "nav-expenses" },
  { to: "/reports", tk: "nav.reports", icon: TrendingUp, testid: "nav-reports" },
];

// Item shown only to the Master Developer account — holds all the
// technical/sensitive settings (TSE, backup, login background…).
const MASTER_NAV = { to: "/settings", tk: "nav.settings", icon: SettingsIcon, testid: "nav-settings" };

// Item shown to every user — lightweight "My Account" (password change only).
const ACCOUNT_NAV = { to: "/account", tkAr: "حسابي", tkDe: "Mein Konto", icon: UserCog, testid: "nav-account" };

export default function Layout() {
  const { user, logout } = useAuth();
  const { settings } = useSettings();
  const { t, lang, setLang, dir } = useI18n();
  const navigate = useNavigate();

  // Compose the nav: base items + either Account (admin) or Settings (master).
  const isMaster = user?.role === "master";
  const NAV = [
    ...BASE_NAV,
    { ...ACCOUNT_NAV, tk: null, label: lang === "de" ? ACCOUNT_NAV.tkDe : ACCOUNT_NAV.tkAr },
    ...(isMaster ? [MASTER_NAV] : []),
  ];

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const toggleLang = () => setLang(lang === "ar" ? "de" : "ar");

  const LogoMark = () => (
    <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center overflow-hidden">
      {settings.logo_url ? (
        <img src={settings.logo_url} alt={settings.shop_name} className="w-full h-full object-cover" />
      ) : (
        <Sparkles size={20} strokeWidth={2} />
      )}
    </div>
  );

  return (
    <div className="min-h-screen flex bg-background" data-testid="app-layout">
      {/* Sidebar (right for RTL, left for LTR) */}
      <aside
        className={`w-64 bg-white hidden md:flex flex-col sticky top-0 h-screen ${dir === "rtl" ? "border-l" : "border-r"} border-border`}
        data-testid="sidebar"
      >
        <div className="px-6 py-6 border-b border-border flex items-center gap-3">
          <LogoMark />
          <div>
            <div className="font-heading font-bold text-lg leading-none">{settings.shop_name}</div>
            <div className="text-xs text-muted-foreground mt-1">{settings.tagline}</div>
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
                  `flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all min-h-[44px] ${
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`
                }
              >
                <Icon size={18} strokeWidth={1.5} />
                <span>{item.tk ? t(item.tk) : item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border space-y-2">
          <div className="flex items-center gap-3 mb-2 px-2">
            <div className="w-9 h-9 rounded-full bg-accent text-accent-foreground flex items-center justify-center font-bold">
              {user?.name?.[0] || "م"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{user?.name}</div>
              <div className="text-xs text-muted-foreground">
                {user?.role === "admin" ? t("auth.admin") : t("auth.cashier")}
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            className="w-full h-11"
            onClick={toggleLang}
            data-testid="lang-toggle-button"
          >
            <Languages size={16} className="mx-2" />
            {lang === "ar" ? "Deutsch" : "العربية"}
          </Button>
          <Button
            variant="outline"
            className="w-full h-11"
            onClick={handleLogout}
            data-testid="logout-button"
          >
            <LogOut size={16} className="mx-2" /> {t("nav.logout")}
          </Button>
        </div>
      </aside>

      {/* Mobile top nav */}
      <div className="md:hidden fixed top-0 inset-x-0 bg-white border-b border-border z-40 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center overflow-hidden">
            {settings.logo_url ? (
              <img src={settings.logo_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <Sparkles size={16} />
            )}
          </div>
          <span className="font-heading font-bold">{settings.shop_name}</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" className="h-10 w-10" onClick={toggleLang} data-testid="lang-toggle-mobile">
            <Languages size={16} />
          </Button>
          <Button variant="outline" size="icon" className="h-10 w-10" onClick={handleLogout} data-testid="logout-button-mobile">
            <LogOut size={16} />
          </Button>
        </div>
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
                    `flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-medium whitespace-nowrap min-h-[40px] ${
                      isActive ? "bg-primary text-white" : "bg-secondary text-muted-foreground"
                    }`
                  }
                >
                  <Icon size={14} /> {item.tk ? t(item.tk) : item.label}
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
