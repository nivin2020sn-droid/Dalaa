import { useEffect, useState } from "react";
import { api, fmtEUR } from "../api";
import { Card } from "../components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

const COLORS = ["hsl(22 31% 48%)", "hsl(29 37% 66%)", "hsl(140 25% 45%)", "hsl(43 74% 56%)", "hsl(340 40% 55%)"];

export default function Reports() {
  const [data, setData] = useState(null);

  useEffect(() => { api.get("/reports/dashboard").then((r) => setData(r.data)); }, []);

  if (!data) return <div className="text-muted-foreground">جاري التحميل...</div>;

  const summary = [
    { label: "إجمالي الإيرادات", value: fmtEUR(data.total_revenue), accent: "text-primary" },
    { label: "إجمالي المصاريف", value: fmtEUR(data.total_expenses), accent: "text-destructive" },
    { label: "صافي الربح", value: fmtEUR(data.profit), accent: "text-emerald-700" },
    { label: "عدد الفواتير", value: data.invoices_count, accent: "" },
  ];

  return (
    <div data-testid="reports-page">
      <div className="mb-6">
        <h1 className="font-heading text-3xl md:text-4xl font-bold">التقارير</h1>
        <p className="text-muted-foreground mt-1">تحليل الأداء المالي</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {summary.map((s, i) => (
          <Card key={i} className="p-5 rounded-2xl card-ambient">
            <div className="text-sm text-muted-foreground">{s.label}</div>
            <div className={`text-2xl font-heading font-bold mt-2 ${s.accent}`}>{s.value}</div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5 rounded-2xl card-ambient">
          <h3 className="font-heading font-bold text-lg mb-4">المبيعات اليومية</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.sales_by_day}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(34 23% 88%)" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => fmtEUR(v)} contentStyle={{ borderRadius: 12, border: "1px solid hsl(34 23% 88%)" }} />
                <Bar dataKey="revenue" fill="hsl(22 31% 48%)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5 rounded-2xl card-ambient">
          <h3 className="font-heading font-bold text-lg mb-4">أفضل الخدمات</h3>
          {data.top_services?.length ? (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.top_services} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                    {data.top_services.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-muted-foreground text-sm text-center py-20">لا توجد خدمات مباعة بعد</div>
          )}
        </Card>

        <Card className="p-5 rounded-2xl card-ambient lg:col-span-2">
          <h3 className="font-heading font-bold text-lg mb-4">أعلى المنتجات مبيعاً</h3>
          {data.top_products?.length ? (
            <div className="space-y-2">
              {data.top_products.map((p, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">{i + 1}</div>
                  <div className="flex-1 font-semibold">{p.name}</div>
                  <div className="text-primary font-bold">{p.count} مبيع</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-muted-foreground text-sm text-center py-8">لا توجد بيانات</div>
          )}
        </Card>
      </div>
    </div>
  );
}
