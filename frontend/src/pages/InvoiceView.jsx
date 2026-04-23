import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { api, fmtEUR, fmtDate } from "../api";
import { useSettings } from "../context/SettingsContext";
import { useI18n } from "../i18n/I18nContext";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Printer, ArrowRight, ArrowLeft, Sparkles, FileDown, Ban, MessageCircle } from "lucide-react";
import { exportInvoiceToPdf, shareInvoiceToWhatsApp } from "../services/pdf";
import { toast } from "sonner";

const payLabels = {
  cash: { ar: "نقداً", de: "Bar" },
  card: { ar: "بطاقة", de: "Karte" },
  transfer: { ar: "تحويل", de: "Überweisung" },
};

export default function InvoiceView() {
  const { id } = useParams();
  const [inv, setInv] = useState(null);
  const navigate = useNavigate();
  const { settings } = useSettings();
  const { t, lang, dir } = useI18n();
  const printRef = useRef(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.get(`/invoices/${id}`).then((r) => setInv(r.data)); }, [id]);

  if (!inv) return <div className="text-muted-foreground">{t("common.loading")}</div>;

  const pay = payLabels[inv.payment_method]?.[lang] || inv.payment_method;
  const isReversal = inv.status === "reversal";
  const BackIcon = dir === "rtl" ? ArrowRight : ArrowLeft;

  const handlePdf = async () => {
    setBusy(true);
    try {
      await exportInvoiceToPdf(printRef.current, inv.invoice_number);
      toast.success("PDF " + (lang === "de" ? "bereit" : "جاهز"));
    } catch (e) {
      toast.error(e?.message || "PDF error");
    } finally {
      setBusy(false);
    }
  };

  const handleWhatsApp = async () => {
    // Look up the customer's phone (if any) and let user confirm/edit.
    let phone = "";
    if (inv.customer_id) {
      try {
        const r = await api.get(`/customers`);
        const c = (r.data || []).find((x) => x.id === inv.customer_id);
        if (c?.phone) phone = c.phone;
      } catch { /* ignore */ }
    }
    const entered = window.prompt(
      lang === "de"
        ? "WhatsApp-Nummer des Kunden (mit Ländervorwahl, z. B. 4917612345678):"
        : "رقم واتساب العميل (برمز الدولة، مثلاً 4917612345678):",
      phone || "",
    );
    if (!entered) return;
    const cleaned = String(entered).replace(/[^\d]/g, "");
    if (!cleaned) {
      toast.error(lang === "de" ? "Ungültige Nummer" : "رقم غير صالح");
      return;
    }
    setBusy(true);
    try {
      const messageText = lang === "de"
        ? `${settings.shop_name}\nRechnung ${inv.invoice_number}\nGesamt: ${fmtEUR(inv.total)}\nVielen Dank!`
        : `${settings.shop_name}\nفاتورة رقم ${inv.invoice_number}\nالإجمالي: ${fmtEUR(inv.total)}\nشكراً لزيارتكم!`;
      await shareInvoiceToWhatsApp(printRef.current, inv.invoice_number, cleaned, messageText);
    } catch (e) {
      toast.error(e?.message || "WhatsApp error");
    } finally {
      setBusy(false);
    }
  };

  // On Android/Capacitor WebView, window.print() is not supported.
  // Fall back to generating & sharing the PDF (user can choose "Print" from
  // the Android share sheet — most OEM launchers include a Print target).
  const handlePrint = async () => {
    if (Capacitor.isNativePlatform()) {
      await handlePdf();
      return;
    }
    window.print();
  };

  const handleStorno = async () => {
    if (!window.confirm(t("inv.storno_confirm_desc"))) return;
    setBusy(true);
    try {
      const r = await api.post(`/invoices/${inv.id}/storno`);
      toast.success("Storno OK");
      navigate(`/invoices/${r.data.id}`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-testid="invoice-view-page">
      <div className="flex items-center justify-between gap-2 mb-4 no-print flex-wrap">
        <Button variant="outline" className="h-11" onClick={() => navigate("/invoices")}>
          <BackIcon size={16} className="mx-1" /> {t("common.back")}
        </Button>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" className="h-11" onClick={handlePrint} disabled={busy} data-testid="print-invoice-button">
            <Printer size={16} className="mx-1" /> {t("common.print")}
          </Button>
          <Button className="h-11" onClick={handlePdf} disabled={busy} data-testid="pdf-invoice-button">
            <FileDown size={16} className="mx-1" /> {t("inv.pdf_button")}
          </Button>
          <Button
            className="h-11 bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={handleWhatsApp}
            disabled={busy}
            data-testid="whatsapp-invoice-button"
          >
            <MessageCircle size={16} className="mx-1" /> {lang === "de" ? "WhatsApp" : "واتساب"}
          </Button>
          {!isReversal && (
            <Button variant="destructive" className="h-11" onClick={handleStorno} disabled={busy} data-testid="storno-from-view-button">
              <Ban size={16} className="mx-1" /> {t("inv.storno_button")}
            </Button>
          )}
        </div>
      </div>

      <Card
        ref={printRef}
        className="print-area invoice-compact p-5 md:p-6 rounded-2xl card-ambient max-w-2xl mx-auto"
        style={{ direction: dir }}
      >
        {isReversal && (
          <div className="mb-3 rounded-md bg-amber-50 border border-amber-200 p-2 text-xs font-semibold text-amber-800">
            ⚠️ {t("inv.reversal_of")} <span className="font-mono">{inv.storno_of_number}</span>
          </div>
        )}

        <div className="flex items-start justify-between border-b border-border pb-3 mb-3 gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-10 h-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center overflow-hidden shrink-0">
                {settings.logo_url ? (
                  <img src={settings.logo_url} alt={settings.shop_name} className="w-full h-full object-cover" />
                ) : (<Sparkles size={18} />)}
              </div>
              <div>
                <div className="font-heading font-bold text-base leading-tight">{settings.shop_name}</div>
                <div className="text-[11px] text-muted-foreground leading-tight">{settings.tagline}</div>
              </div>
            </div>
            {settings.address && <div className="text-[11px] text-muted-foreground">{settings.address}</div>}
            {settings.phone && <div className="text-[11px] text-muted-foreground">{lang === "de" ? "Tel" : "هاتف"}: {settings.phone}</div>}
            {settings.tax_id && <div className="text-[11px] text-muted-foreground">{t("set.tax_id")}: {settings.tax_id}</div>}
          </div>
          <div style={{ textAlign: dir === "rtl" ? "left" : "right" }}>
            <div className="text-[11px] text-muted-foreground">{isReversal ? t("inv.status.reversal") : t("inv.number")}</div>
            <div className="font-mono font-bold text-base">{inv.invoice_number}</div>
            <div className="text-[11px] text-muted-foreground mt-1">{fmtDate(inv.created_at, lang)}</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-3 text-xs">
          <div>
            <div className="text-[11px] text-muted-foreground">{t("pos.customer")}</div>
            <div className="font-semibold">{inv.customer_name}</div>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground">{t("inv.cashier")}</div>
            <div className="font-semibold">{inv.cashier_name}</div>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground">{t("pos.payment_method")}</div>
            <div className="font-semibold">{pay}</div>
          </div>
        </div>

        <table className="w-full mb-3 text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground" style={{ textAlign: "start" }}>
              <th className="py-1.5">{lang === "de" ? "Position" : "البند"}</th>
              <th className="py-1.5">{t("common.price")}</th>
              <th className="py-1.5">{t("common.quantity")}</th>
              <th className="py-1.5">MwSt</th>
              <th className="py-1.5" style={{ textAlign: dir === "rtl" ? "left" : "right" }}>{t("common.total")}</th>
            </tr>
          </thead>
          <tbody>
            {inv.items?.map((it, i) => (
              <tr key={i} className="border-b border-border">
                <td className="py-1.5">
                  <div className="font-semibold">{it.name}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {it.item_type === "product"
                      ? (lang === "de" ? "Produkt" : "منتج")
                      : (lang === "de" ? "Leistung" : "خدمة")}
                  </div>
                </td>
                <td className="py-1.5">{fmtEUR(it.unit_price)}</td>
                <td className="py-1.5">{it.quantity}</td>
                <td className="py-1.5 text-[10px]">{it.vat_rate}%</td>
                <td className="py-1.5 font-semibold" style={{ textAlign: dir === "rtl" ? "left" : "right" }}>{fmtEUR(it.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="max-w-xs ms-auto space-y-1 mb-3 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("inv.net")}</span>
            <span>{fmtEUR(inv.net_total ?? inv.subtotal)}</span>
          </div>
          {(inv.vat_breakdown || []).map((b) => (
            <div key={b.rate} className="flex justify-between">
              <span className="text-muted-foreground">MwSt {b.rate}%</span>
              <span>{fmtEUR(b.vat)}</span>
            </div>
          ))}
          {inv.discount > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("common.discount")}</span>
              <span>-{fmtEUR(inv.discount)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-heading font-bold pt-2 border-t border-border">
            <span>{t("common.total")}</span>
            <span className={inv.total < 0 ? "text-rose-600" : "text-primary"}>{fmtEUR(inv.total)}</span>
          </div>
        </div>

        <div className="text-center text-[10px] text-muted-foreground border-t border-border pt-2">
          {settings.receipt_footer || t("inv.footer_note")}
        </div>
      </Card>
    </div>
  );
}
