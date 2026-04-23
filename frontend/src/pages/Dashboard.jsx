import { useEffect, useState } from "react";
import { api, fmtEUR } from "../api";
import { Card } from "../components/ui/card";
import {
  TrendingUp,
  Wallet,
  ShoppingCart,
  Users,
  CalendarDays,
  Package,
  AlertTriangle,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

const StatCard = ({ icon: Icon, label, value, accent, testid }) => (
  <Card
    className="p-5 rounded-2xl border-border card-ambient hover-lift"
    data-testid={testid}
  >
    <div className="flex items-start justify-between">
      <div>
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="text-2xl font-heading font-bold mt-2">{value}</div>
      </div>
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center ${accent}`}
      >
        <Icon size={18} strokeWidth={1.5} />
      </div>
    </div>
  </Card>
);

export default function Dashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/reports/dashboard").then((r) => setData(r.data));
  }, []);

  if (!data)
    return <div className="text-muted-foreground">جاري التحميل...</div>;

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      <div>
        <h1 className="font-heading text-3xl md:text-4xl font-bold">لوحة التحكم</h1>
        <p className="text-muted-foreground mt-1">نظرة عامة على أداء محلك</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={TrendingUp}
          label="إيرادات اليوم"
          value={fmtEUR(data.today_revenue)}
          accent="bg-primary/10 text-primary"
          testid="stat-today-revenue"
        />
        <StatCard
          icon={Wallet}
          label="إيرادات الشهر"
          value={fmtEUR(data.month_revenue)}
          accent="bg-accent/20 text-accent-foreground"
          testid="stat-month-revenue"
        />
        <StatCard
          icon={TrendingUp}
          label="إجمالي الأرباح"
          value={fmtEUR(data.profit)}
          accent="bg-emerald-100 text-emerald-700"
          testid="stat-profit"
        />
        <StatCard
          icon={Wallet}
          label="إجمالي المصاريف"
          value={fmtEUR(data.total_expenses)}
          accent="bg-rose-100 text-rose-700"
          testid="stat-expenses"
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={ShoppingCart} label="عدد الفواتير" value={data.invoices_count} accent="bg-secondary text-secondary-foreground" testid="stat-invoices-count" />
        <StatCard icon={Users} label="العملاء" value={data.customers_count} accent="bg-secondary text-secondary-foreground" testid="stat-customers-count" />
        <StatCard icon={CalendarDays} label="المواعيد" value={data.appointments_count} accent="bg-secondary text-secondary-foreground" testid="stat-appointments-count" />
        <StatCard icon={Package} label="تنبيه المخزون" value={data.low_stock?.length || 0} accent="bg-amber-100 text-amber-700" testid="stat-low-stock" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-5 rounded-2xl border-border card-ambient lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-bold text-lg">المبيعات خلال آخر 14 يوم</h3>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.sales_by_day}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(34 23% 88%)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid hsl(34 23% 88%)",
                    fontFamily: "Cairo",
                  }}
                  formatter={(v) => fmtEUR(v)}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="hsl(282 44% 47%)"
                  strokeWidth={2.5}
                  dot={{ fill: "hsl(282 44% 47%)", r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5 rounded-2xl border-border card-ambient">
          <h3 className="font-heading font-bold text-lg mb-4">الأعلى مبيعاً (منتجات)</h3>
          {data.top_products?.length ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.top_products} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(34 23% 88%)" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(34 23% 88%)" }} />
                  <Bar dataKey="count" fill="hsl(335 72% 68%)" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-muted-foreground text-sm text-center py-12">
              لا توجد مبيعات بعد
            </div>
          )}
        </Card>
      </div>

      {data.low_stock?.length > 0 && (
        <Card className="p-5 rounded-2xl border-amber-200 bg-amber-50/50" data-testid="low-stock-alert">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="text-amber-600" size={18} />
            <h3 className="font-heading font-bold">تنبيه: مخزون منخفض</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {data.low_stock.map((p) => (
              <div key={p.id} className="bg-white rounded-xl p-3 border border-amber-200">
                <div className="font-semibold text-sm">{p.name}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  الكمية: <span className="text-amber-700 font-bold">{p.stock}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
