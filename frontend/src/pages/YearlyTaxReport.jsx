import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, fmtEUR } from "../api";
import { useSettings } from "../context/SettingsContext";
import { useI18n } from "../i18n/I18nContext";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { ArrowRight, ArrowLeft, FileDown, Printer, Archive } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { exportInvoiceToPdf } from "../services/pdf";
import { toast } from "sonner";

const MONTH_LABELS = {
  ar: ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"],
  de: ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"],
};

export default function YearlyTaxReport() {
  const navigate = useNavigate();
  const { t, lang, dir } = useI18n();
  const { settings } = useSettings();
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const printRef = useRef(null);
  const BackIcon = dir === "rtl" ? ArrowRight : ArrowLeft;

  const load = async (y) => {
    setLoading(true);
    try {
      const r = await api.get(`/reports/yearly-tax?year=${y}`);
      setData(r.data);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(year); }, [year]);

  const years = [];
  const currentYear = new Date().getFullYear();
  for (let y = currentYear; y >= currentYear - 5; y--) years.push(y);

  const handlePdf = async () => {
    setBusy(true);
    try {
      await exportInvoiceToPdf(printRef.current, `Jahresbericht-${year}`);
      toast.success("PDF " + (lang === "de" ? "bereit" : "جاهز"));
    } catch (e) {
      toast.error(e?.message || "PDF error");
    } finally {
      setBusy(false);
    }
  };

  const handlePrint = async () => {
    if (Capacitor.isNativePlatform()) return handlePdf();
    window.print();
  };

  /**
   * Download DSFinV-K archive from the TSE backend. DSFinV-K is the
   * official interchange format the German tax office expects for a
   * cash-register export. The backend streams a ZIP; we hand it to
   * the user via the share sheet on Android or a normal download on web.
   */
  const handleDsfinvkExport = async () => {
    const tseCfg = settings?.tse;
    if (!tseCfg?.backend_url) {
      toast.error(lang === "de"
        ? "TSE Backend URL nicht konfiguriert (Einstellungen → TSE)"
        : "لم يُضبط رابط Backend الخاص بـ TSE (الإعدادات → TSE)");
      return;
    }
    setBusy(true);
    try {
      const from = `${year}-01-01`;
      const to   = `${year}-12-31`;
      const url = `${tseCfg.backend_url.replace(/\/+$/, "")}/api/tse/export-dsfinvk?from=${from}&to=${to}`;
      const res = await fetch(url);
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const filename = `DSFinV-K_${year}.zip`;
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
      toast.success(lang === "de" ? "DSFinV-K heruntergeladen" : "تم تنزيل DSFinV-K");
    } catch (e) {
      toast.error((lang === "de" ? "DSFinV-K fehlgeschlagen: " : "فشل تصدير DSFinV-K: ") + (e?.message || ""));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="text-muted-foreground">{t("common.loading")}</div>;
  if (!data) return null;

  const months = MONTH_LABELS[lang] || MONTH_LABELS.de;

  return (
    <div data-testid="yearly-tax-page">
      <div className="flex items-center justify-between gap-2 mb-4 no-print flex-wrap">
        <Button variant="outline" className="h-11" onClick={() => navigate("/reports")}>
          <BackIcon size={16} className="mx-1" /> {t("common.back")}
        </Button>
        <div className="flex gap-2 items-center flex-wrap">
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="h-11 rounded-md border border-input bg-background px-3 text-sm font-semibold"
            data-testid="year-select"
          >
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <Button variant="outline" className="h-11" onClick={handlePrint} disabled={busy} data-testid="print-yearly-button">
            <Printer size={16} className="mx-1" /> {t("common.print")}
          </Button>
          <Button className="h-11" onClick={handlePdf} disabled={busy} data-testid="pdf-yearly-button">
            <FileDown size={16} className="mx-1" /> PDF
          </Button>
          <Button
            variant="outline"
            className="h-11"
            onClick={handleDsfinvkExport}
            disabled={busy}
            data-testid="dsfinvk-export-button"
          >
            <Archive size={16} className="mx-1" />
            {lang === "de" ? "DSFinV-K Export" : "تصدير DSFinV-K"}
          </Button>
        </div>
      </div>

      <Card
        ref={printRef}
        className="print-area invoice-compact p-6 rounded-2xl card-ambient max-w-4xl mx-auto"
        style={{ direction: dir }}
      >
        <div className="border-b border-border pb-3 mb-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="font-heading font-bold text-xl leading-tight">{settings.shop_name}</h1>
              <div className="text-xs text-muted-foreground">{settings.tagline}</div>
              {settings.address && <div className="text-[11px] text-muted-foreground mt-1">{settings.address}</div>}
              {settings.phone && <div className="text-[11px] text-muted-foreground">{lang === "de" ? "Tel" : "هاتف"}: {settings.phone}</div>}
              {settings.tax_id && <div className="text-[11px] text-muted-foreground">{lang === "de" ? "Steuer-Nr." : "الرقم الضريبي"}: {settings.tax_id}</div>}
            </div>
            <div style={{ textAlign: dir === "rtl" ? "left" : "right" }}>
              <div className="text-[11px] text-muted-foreground">
                {lang === "de" ? "Jahresbericht — Umsatzsteuer" : "التقرير السنوي — ضريبة المبيعات"}
              </div>
              <div className="font-heading font-bold text-2xl text-primary">{data.year}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {lang === "de" ? "Erstellt am" : "تاريخ الإنشاء"}: {new Date(data.generated_at).toLocaleDateString(lang === "de" ? "de-DE" : "ar-EG")}
              </div>
            </div>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <SummaryCell label={lang === "de" ? "Brutto-Umsatz" : "إجمالي المبيعات (شامل الضريبة)"} value={fmtEUR(data.gross_total)} accent="text-primary" />
          <SummaryCell label={lang === "de" ? "Netto-Umsatz" : "صافي المبيعات"} value={fmtEUR(data.net_total)} />
          <SummaryCell label={lang === "de" ? "MwSt insgesamt" : "إجمالي ضريبة المبيعات"} value={fmtEUR(data.vat_total)} accent="text-amber-700" />
          <SummaryCell label={lang === "de" ? "Ausgaben" : "المصاريف"} value={fmtEUR(data.expenses_total)} accent="text-destructive" />
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5">
          <SummaryCell label={lang === "de" ? "Rechnungen" : "عدد الفواتير"} value={String(data.active_invoices)} />
          <SummaryCell label={lang === "de" ? "Stornierungen" : "فواتير الإلغاء (Storno)"} value={String(data.reversal_invoices)} accent="text-rose-600" />
        </div>

        {/* VAT breakdown by rate */}
        <h3 className="font-heading font-bold text-base mb-2 mt-4">
          {lang === "de" ? "Aufschlüsselung nach MwSt-Satz" : "التفصيل حسب معدل الضريبة"}
        </h3>
        <table className="w-full text-xs mb-5 border border-border rounded-lg overflow-hidden">
          <thead>
            <tr className="bg-secondary/60">
              <th className="py-2 px-2 text-start">{lang === "de" ? "Satz" : "المعدل"}</th>
              <th className="py-2 px-2 text-start">{lang === "de" ? "Netto" : "الصافي"}</th>
              <th className="py-2 px-2 text-start">MwSt</th>
              <th className="py-2 px-2 text-start">{lang === "de" ? "Brutto" : "الإجمالي"}</th>
            </tr>
          </thead>
          <tbody>
            {data.by_rate.length === 0 && (
              <tr><td colSpan={4} className="py-3 text-center text-muted-foreground">—</td></tr>
            )}
            {data.by_rate.map((r) => (
              <tr key={r.rate} className="border-t border-border">
                <td className="py-2 px-2 font-bold">{r.rate}%</td>
                <td className="py-2 px-2">{fmtEUR(r.net)}</td>
                <td className="py-2 px-2 text-amber-700 font-semibold">{fmtEUR(r.vat)}</td>
                <td className="py-2 px-2 font-semibold">{fmtEUR(r.gross)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-primary bg-primary/5">
              <td className="py-2 px-2 font-bold">{lang === "de" ? "Gesamt" : "المجموع"}</td>
              <td className="py-2 px-2 font-bold">{fmtEUR(data.net_total)}</td>
              <td className="py-2 px-2 font-bold text-amber-700">{fmtEUR(data.vat_total)}</td>
              <td className="py-2 px-2 font-bold text-primary">{fmtEUR(data.gross_total)}</td>
            </tr>
          </tbody>
        </table>

        {/* Monthly breakdown */}
        <h3 className="font-heading font-bold text-base mb-2">
          {lang === "de" ? "Monatliche Aufschlüsselung" : "التفصيل الشهري"}
        </h3>
        <table className="w-full text-xs mb-5 border border-border rounded-lg overflow-hidden">
          <thead>
            <tr className="bg-secondary/60">
              <th className="py-2 px-2 text-start">{lang === "de" ? "Monat" : "الشهر"}</th>
              <th className="py-2 px-2 text-start">{lang === "de" ? "Rechn." : "الفواتير"}</th>
              <th className="py-2 px-2 text-start">{lang === "de" ? "Netto" : "الصافي"}</th>
              <th className="py-2 px-2 text-start">MwSt</th>
              <th className="py-2 px-2 text-start">{lang === "de" ? "Brutto" : "الإجمالي"}</th>
            </tr>
          </thead>
          <tbody>
            {data.by_month.map((m, i) => (
              <tr key={m.month} className="border-t border-border">
                <td className="py-1.5 px-2 font-semibold">{months[i]}</td>
                <td className="py-1.5 px-2">{m.count}</td>
                <td className="py-1.5 px-2">{fmtEUR(m.net)}</td>
                <td className="py-1.5 px-2 text-amber-700">{fmtEUR(m.vat)}</td>
                <td className="py-1.5 px-2 font-semibold">{fmtEUR(m.gross)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Profit calculation */}
        <div className="max-w-sm ms-auto space-y-1 text-xs border-t border-border pt-3">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{lang === "de" ? "Netto-Umsatz" : "صافي المبيعات"}</span>
            <span>{fmtEUR(data.net_total)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{lang === "de" ? "− Ausgaben" : "− المصاريف"}</span>
            <span>-{fmtEUR(data.expenses_total)}</span>
          </div>
          <div className="flex justify-between text-base font-heading font-bold pt-2 border-t border-border">
            <span>{lang === "de" ? "Gewinn (vor Steuern)" : "صافي الربح (قبل ضريبة الدخل)"}</span>
            <span className={data.profit >= 0 ? "text-emerald-700" : "text-rose-600"}>{fmtEUR(data.profit)}</span>
          </div>
        </div>

        <div className="mt-5 text-[10px] text-muted-foreground border-t border-border pt-2 leading-relaxed">
          {lang === "de"
            ? `Dieser Jahresbericht wurde automatisch erstellt auf Basis aller im Jahr ${data.year} aktiven Rechnungen (inkl. GoBD-konformer Stornierungen). Die Zahlen dienen als Hilfsgröße für die Umsatzsteuerjahreserklärung — bitte mit dem Steuerberater abgleichen.`
            : `هذا التقرير السنوي يُنشَأ تلقائياً من جميع الفواتير الصادرة خلال عام ${data.year} (متضمنة فواتير الإلغاء المتوافقة مع GoBD). الأرقام للاستخدام الإرشادي عند إعداد الإقرار السنوي لضريبة المبيعات — يُنصح بمراجعتها مع المحاسب الضريبي.`}
        </div>
      </Card>
    </div>
  );
}

function SummaryCell({ label, value, accent }) {
  return (
    <div className="rounded-lg border border-border p-2.5 bg-secondary/30">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={`text-base font-heading font-bold mt-1 ${accent || ""}`}>{value}</div>
    </div>
  );
}
