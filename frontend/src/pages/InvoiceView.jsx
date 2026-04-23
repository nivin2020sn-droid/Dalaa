import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, fmtEUR, fmtDate } from "../api";
import { useSettings } from "../context/SettingsContext";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Printer, ArrowRight, Sparkles } from "lucide-react";

const payLabels = { cash: "نقداً", card: "بطاقة", transfer: "تحويل" };

export default function InvoiceView() {
  const { id } = useParams();
  const [inv, setInv] = useState(null);
  const navigate = useNavigate();
  const { settings } = useSettings();

  useEffect(() => {
    api.get(`/invoices/${id}`).then((r) => setInv(r.data));
  }, [id]);

  if (!inv) return <div className="text-muted-foreground">جاري...</div>;

  return (
    <div data-testid="invoice-view-page">
      <div className="flex items-center justify-between mb-6 no-print">
        <Button variant="outline" onClick={() => navigate("/invoices")}>
          <ArrowRight size={16} className="ml-1" /> عودة
        </Button>
        <Button onClick={() => window.print()} data-testid="print-invoice-button"><Printer size={16} className="ml-1" /> طباعة</Button>
      </div>

      <Card className="print-area p-8 md:p-10 rounded-2xl card-ambient max-w-3xl mx-auto">
        <div className="flex items-start justify-between border-b border-border pb-6 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-12 h-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center overflow-hidden">
                {settings.logo_url ? (
                  <img src={settings.logo_url} alt={settings.shop_name} className="w-full h-full object-cover" />
                ) : (
                  <Sparkles size={20} />
                )}
              </div>
              <div>
                <div className="font-heading font-bold text-xl">{settings.shop_name}</div>
                <div className="text-xs text-muted-foreground">{settings.tagline}</div>
              </div>
            </div>
            {settings.address && <div className="text-xs text-muted-foreground">{settings.address}</div>}
            {settings.phone && <div className="text-xs text-muted-foreground">هاتف: {settings.phone}</div>}
            {settings.tax_id && <div className="text-xs text-muted-foreground">رقم ضريبي: {settings.tax_id}</div>}
          </div>
          <div className="text-left">
            <div className="text-xs text-muted-foreground">رقم الفاتورة</div>
            <div className="font-mono font-bold text-lg">{inv.invoice_number}</div>
            <div className="text-xs text-muted-foreground mt-2">{fmtDate(inv.created_at)}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <div className="text-xs text-muted-foreground mb-1">العميل</div>
            <div className="font-semibold">{inv.customer_name}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">الكاشير</div>
            <div className="font-semibold">{inv.cashier_name}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">طريقة الدفع</div>
            <div className="font-semibold">{payLabels[inv.payment_method] || inv.payment_method}</div>
          </div>
        </div>

        <table className="w-full mb-6">
          <thead>
            <tr className="border-b border-border text-right text-sm text-muted-foreground">
              <th className="py-2">البند</th>
              <th className="py-2">السعر</th>
              <th className="py-2">الكمية</th>
              <th className="py-2 text-left">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {inv.items?.map((it, i) => (
              <tr key={i} className="border-b border-border">
                <td className="py-3">
                  <div className="font-semibold">{it.name}</div>
                  <div className="text-xs text-muted-foreground">{it.item_type === "product" ? "منتج" : "خدمة"}</div>
                </td>
                <td className="py-3">{fmtEUR(it.unit_price)}</td>
                <td className="py-3">{it.quantity}</td>
                <td className="py-3 text-left font-semibold">{fmtEUR(it.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="max-w-xs ms-auto space-y-2 mb-6">
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">المجموع الفرعي</span><span>{fmtEUR(inv.subtotal)}</span></div>
          {inv.discount > 0 && <div className="flex justify-between text-sm"><span className="text-muted-foreground">خصم</span><span>-{fmtEUR(inv.discount)}</span></div>}
          {inv.tax > 0 && <div className="flex justify-between text-sm"><span className="text-muted-foreground">ضريبة</span><span>+{fmtEUR(inv.tax)}</span></div>}
          <div className="flex justify-between text-xl font-heading font-bold pt-3 border-t border-border">
            <span>الإجمالي</span><span className="text-primary">{fmtEUR(inv.total)}</span>
          </div>
        </div>

        <div className="text-center text-xs text-muted-foreground border-t border-border pt-4">
          شكراً لزيارتكم • نتطلع لرؤيتكم مجدداً
        </div>
      </Card>
    </div>
  );
}
