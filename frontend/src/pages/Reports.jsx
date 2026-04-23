import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, fmtEUR } from "../api";
import { useI18n } from "../i18n/I18nContext";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { FileText } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

const COLORS = ["hsl(282 44% 47%)", "hsl(335 72% 68%)", "hsl(260 55% 58%)", "hsl(310 60% 60%)", "hsl(350 65% 70%)"];

export default function Reports() {
  const { t, lang } = useI18n();
  const [data, setData] = useState(null);

  useEffect(() => { api.get("/reports/dashboard").then((r) => setData(r.data)); }, []);

  if (!data) return <div className="text-muted-foreground">{t("common.loading")}</div>;

  const summary = [
    { label: t("rep.total_revenue"), value: fmtEUR(data.total_revenue), accent: "text-primary" },
    { label: t("dash.total_expenses"), value: fmtEUR(data.total_expenses), accent: "text-destructive" },
    { label: t("rep.net_profit"), value: fmtEUR(data.profit), accent: "text-emerald-700" },
    { label: t("dash.invoices_count"), value: data.invoices_count, accent: "" },
  ];

  return (
    <div data-testid="reports-page">
      <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-heading text-3xl md:text-4xl font-bold">{t("rep.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("rep.subtitle")}</p>
        </div>
        <Link to="/reports/yearly-tax">
          <Button className="h-11" data-testid="open-yearly-tax-button">
            <FileText size={16} className="mx-1" />
            {lang === "de" ? "Jahresbericht (Finanzamt)" : "التقرير السنوي للضرائب"}
          </Button>
        </Link>
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
          <h3 className="font-heading font-bold text-lg mb-4">{t("rep.daily_sales")}</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.sales_by_day}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(325 30% 90%)" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => fmtEUR(v)} contentStyle={{ borderRadius: 12, border: "1px solid hsl(325 30% 90%)" }} />
                <Bar dataKey="revenue" fill="hsl(282 44% 47%)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5 rounded-2xl card-ambient">
          <h3 className="font-heading font-bold text-lg mb-4">{t("rep.top_services")}</h3>
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
            <div className="text-muted-foreground text-sm text-center py-20">{t("rep.no_data")}</div>
          )}
        </Card>

        <Card className="p-5 rounded-2xl card-ambient lg:col-span-2">
          <h3 className="font-heading font-bold text-lg mb-4">{t("rep.top_products_sold")}</h3>
          {data.top_products?.length ? (
            <div className="space-y-2">
              {data.top_products.map((p, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">{i + 1}</div>
                  <div className="flex-1 font-semibold">{p.name}</div>
                  <div className="text-primary font-bold">{p.count}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-muted-foreground text-sm text-center py-8">{t("rep.no_data")}</div>
          )}
        </Card>
      </div>
    </div>
  );
}
