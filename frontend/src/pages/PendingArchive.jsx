import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, fmtEUR, fmtDate } from "../api";
import { useI18n } from "../i18n/I18nContext";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { RefreshCw, CheckCircle2, AlertTriangle, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export default function PendingArchive() {
  const { t, lang } = useI18n();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [busyAll, setBusyAll] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get("/invoices/pending-archive");
      setItems(r.data || []);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const retryOne = async (id) => {
    setBusy(id);
    try {
      await api.post(`/invoices/${id}/retry-archive`, {});
      toast.success(lang === "de" ? "Archiviert ✓" : "تمت الأرشفة ✓");
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || e?.message || "Retry failed");
      await load();
    } finally {
      setBusy(null);
    }
  };

  const retryAll = async () => {
    setBusyAll(true);
    try {
      const r = await api.post("/invoices/retry-archive-all", {});
      toast.success(
        (lang === "de" ? "Archiviert: " : "تمت الأرشفة: ") +
        `${r.data.archived}/${r.data.total}` +
        (r.data.failed
          ? ` — ${lang === "de" ? "Fehlgeschlagen: " : "فشل: "}${r.data.failed}`
          : ""),
      );
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Error");
    } finally {
      setBusyAll(false);
    }
  };

  return (
    <div data-testid="pending-archive-page">
      <div className="flex items-start justify-between gap-3 mb-6 flex-wrap">
        <div>
          <h1 className="font-heading text-3xl md:text-4xl font-bold">
            {lang === "de" ? "Ausstehende Archivierung" : "الأرشفة المعلّقة"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {lang === "de"
              ? "TSE-signierte Rechnungen, die noch nicht extern archiviert wurden."
              : "فواتير موقعة بـ TSE لم تُرفع بعد إلى الأرشيف الخارجي."}
          </p>
        </div>
        {items.length > 0 && (
          <Button onClick={retryAll} disabled={busyAll} className="h-11" data-testid="retry-all-archive-button">
            <RefreshCw size={16} className={"mx-1 " + (busyAll ? "animate-spin" : "")} />
            {lang === "de" ? "Alle erneut versuchen" : "إعادة محاولة الكل"}
          </Button>
        )}
      </div>

      {loading && <div className="text-muted-foreground">{t("common.loading")}</div>}

      {!loading && items.length === 0 && (
        <Card className="p-12 text-center rounded-2xl card-ambient" data-testid="archive-empty-state">
          <CheckCircle2 size={48} className="mx-auto text-emerald-500 mb-3" />
          <h3 className="font-heading font-bold text-xl mb-1">
            {lang === "de" ? "Alles archiviert" : "كل الفواتير مؤرشفة"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {lang === "de"
              ? "Es gibt keine offenen Archivierungen."
              : "لا توجد أي فواتير في انتظار الأرشفة."}
          </p>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {items.map((inv) => (
          <Card key={inv.id} className="p-4 rounded-2xl card-ambient" data-testid={`pending-row-${inv.id}`}>
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <div className="font-mono font-bold">{inv.invoice_number}</div>
                <div className="text-xs text-muted-foreground">{fmtDate(inv.created_at, lang)}</div>
                <div className="text-xs text-muted-foreground">{inv.customer_name}</div>
              </div>
              <div className="text-end">
                <div className={"font-heading font-bold " + (inv.total < 0 ? "text-rose-600" : "text-primary")}>
                  {fmtEUR(inv.total)}
                </div>
                <span className="inline-block mt-1 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5">
                  {lang === "de" ? "Pending" : "معلّقة"}
                </span>
              </div>
            </div>

            {inv.archive_error && (
              <div className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded p-2 mt-2 break-words flex items-start gap-1">
                <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                <span className="font-mono">{inv.archive_error}</span>
              </div>
            )}

            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                onClick={() => retryOne(inv.id)}
                disabled={busy === inv.id}
                className="h-9"
                data-testid={`retry-${inv.id}`}
              >
                <RefreshCw size={12} className={"mx-1 " + (busy === inv.id ? "animate-spin" : "")} />
                {lang === "de" ? "Retry Archive" : "إعادة محاولة"}
              </Button>
              <Link to={`/invoices/${inv.id}`}>
                <Button size="sm" variant="outline" className="h-9">
                  <ExternalLink size={12} className="mx-1" />
                  {lang === "de" ? "Öffnen" : "فتح"}
                </Button>
              </Link>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
