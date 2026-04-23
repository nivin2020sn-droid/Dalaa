import { useEffect, useState } from "react";
import { api, fmtEUR, fmtDate } from "../api";
import { useI18n } from "../i18n/I18nContext";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../components/ui/alert-dialog";
import { Eye, Ban } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "../components/ui/table";
import { toast } from "sonner";

const payLabels = {
  cash: { ar: "نقداً", de: "Bar" },
  card: { ar: "بطاقة", de: "Karte" },
  transfer: { ar: "تحويل", de: "Überweisung" },
};

export default function Invoices() {
  const [items, setItems] = useState([]);
  const [stornoTarget, setStornoTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const { t, lang } = useI18n();

  const load = async () => {
    const r = await api.get("/invoices");
    setItems(r.data);
  };
  useEffect(() => { load(); }, []);

  const renderStatus = (inv) => {
    if (inv.status === "reversal") {
      return <Badge className="bg-amber-100 text-amber-800 border-0">{t("inv.status.reversal")}</Badge>;
    }
    const hasReversal = items.some((i) => i.storno_of === inv.id);
    if (hasReversal) {
      return <Badge className="bg-rose-100 text-rose-800 border-0">{t("inv.status.storno")}</Badge>;
    }
    return <Badge variant="outline" className="border-emerald-200 text-emerald-700">{t("inv.status.active")}</Badge>;
  };

  const doStorno = async () => {
    if (!stornoTarget) return;
    setBusy(true);
    try {
      await api.post(`/invoices/${stornoTarget.id}/storno`);
      toast.success("تم إنشاء فاتورة إلغاء / Storno erstellt");
      setStornoTarget(null);
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-testid="invoices-page">
      <div className="mb-6">
        <h1 className="font-heading text-3xl md:text-4xl font-bold">{t("nav.invoices")}</h1>
        <p className="text-muted-foreground mt-1">{lang === "de" ? "Alle Verkäufe (GoBD-konform)" : "سجل جميع عمليات البيع (متوافق مع GoBD)"}</p>
      </div>

      <Card className="rounded-2xl card-ambient overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-start">{t("inv.number")}</TableHead>
              <TableHead className="text-start">{t("pos.customer")}</TableHead>
              <TableHead className="text-start">{t("common.date")}</TableHead>
              <TableHead className="text-start">{t("common.status")}</TableHead>
              <TableHead className="text-start">{t("common.total")}</TableHead>
              <TableHead className="text-start">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  {t("inv.no_invoices")}
                </TableCell>
              </TableRow>
            )}
            {items.map((inv) => {
              const isReversed = items.some((i) => i.storno_of === inv.id);
              return (
                <TableRow key={inv.id} data-testid={`invoice-row-${inv.id}`}>
                  <TableCell className="font-mono font-bold cursor-pointer" onClick={() => navigate(`/invoices/${inv.id}`)}>
                    {inv.invoice_number}
                  </TableCell>
                  <TableCell>{inv.customer_name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{fmtDate(inv.created_at, lang)}</TableCell>
                  <TableCell>{renderStatus(inv)}</TableCell>
                  <TableCell className={`font-bold ${inv.total < 0 ? "text-rose-600" : "text-primary"}`}>
                    {fmtEUR(inv.total)}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => navigate(`/invoices/${inv.id}`)}>
                        <Eye size={16} />
                      </Button>
                      {inv.status !== "reversal" && !isReversed && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-11 w-11 text-destructive"
                          onClick={() => setStornoTarget(inv)}
                          data-testid={`storno-button-${inv.id}`}
                          title={t("inv.storno_button")}
                        >
                          <Ban size={16} />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <AlertDialog open={!!stornoTarget} onOpenChange={(o) => { if (!o) setStornoTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading">{t("inv.storno_confirm_title")}</AlertDialogTitle>
            <AlertDialogDescription className="leading-relaxed">
              {t("inv.storno_confirm_desc")}
              <br /><br />
              <span className="font-mono text-xs text-foreground/80">{stornoTarget?.invoice_number}</span> — {fmtEUR(stornoTarget?.total || 0)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="storno-cancel">{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => { e.preventDefault(); doStorno(); }}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="storno-confirm"
            >
              {busy ? t("common.loading") : t("inv.storno_button")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
