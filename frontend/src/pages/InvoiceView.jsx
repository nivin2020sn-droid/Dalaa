import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { api, fmtEUR, fmtDate } from "../api";
import { useSettings } from "../context/SettingsContext";
import { useI18n } from "../i18n/I18nContext";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Printer, ArrowRight, ArrowLeft, Sparkles, FileDown, Ban, MessageCircle, Mail, Receipt as ReceiptIcon, Send } from "lucide-react";
import { exportInvoiceToPdf, exportReceiptToPdf, shareInvoiceByEmail } from "../services/pdf";
import { QRCodeCanvas } from "qrcode.react";
import { toast } from "sonner";
import InvoiceReceipt from "../components/InvoiceReceipt";

const payLabels = {
  cash: { ar: "نقداً", de: "Bar" },
  card: { ar: "بطاقة", de: "Karte" },
  transfer: { ar: "تحويل", de: "Überweisung" },
};

export default function InvoiceView() {
  const { id } = useParams();
  const [inv, setInv] = useState(null);
  const [customer, setCustomer] = useState(null);
  const navigate = useNavigate();
  const { settings } = useSettings();
  const { t, lang, dir } = useI18n();
  const printRef = useRef(null);
  const receipt80Ref = useRef(null);
  const receipt58Ref = useRef(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.get(`/invoices/${id}`).then((r) => setInv(r.data)); }, [id]);

  // Pre-fetch the linked customer (if any) so WhatsApp/Email buttons can
  // surface contact info instantly without an extra round-trip on click.
  useEffect(() => {
    if (!inv?.customer_id) { setCustomer(null); return; }
    let cancelled = false;
    api.get("/customers").then((r) => {
      if (cancelled) return;
      setCustomer((r.data || []).find((x) => x.id === inv.customer_id) || null);
    }).catch(() => setCustomer(null));
    return () => { cancelled = true; };
  }, [inv?.customer_id]);

  if (!inv) return <div className="text-muted-foreground">{t("common.loading")}</div>;

  const pay = payLabels[inv.payment_method]?.[lang] || inv.payment_method;
  const isReversal = inv.status === "reversal";
  // A receipt is "official" (legally distributable) only if TSE signed it
  // OR if it was created before TSE was ever enabled (legacy records, kept
  // as-is per GoBD immutability rules).
  const isOfficial = inv.tse_status !== "pending" && inv.tse_status !== "failed";
  const BackIcon = dir === "rtl" ? ArrowRight : ArrowLeft;

  // Guard handler used by the export/share buttons. Blocks any attempt to
  // print/share an invoice whose TSE signature failed or is still pending.
  const assertOfficial = () => {
    if (!isOfficial) {
      toast.error(
        lang === "de"
          ? "Diese Rechnung ist nicht offiziell und darf nicht gedruckt oder versendet werden, bis die TSE-Signatur erfolgreich ist."
          : "هذه ليست فاتورة رسمية ولا يجوز طباعتها أو إرسالها حتى يتم توقيع TSE بنجاح.",
        { duration: 7000 },
      );
      return false;
    }
    return true;
  };

  // Render the invoice template into an A4 PDF and share/save it.
  const handlePdf = async () => {
    if (!assertOfficial()) return;
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

  // Render the receipt template into a thermal-roll PDF (80mm by default).
  const handleReceiptPdf = async (widthMm = 80) => {
    if (!assertOfficial()) return;
    const node = widthMm === 58 ? receipt58Ref.current : receipt80Ref.current;
    if (!node) return;
    setBusy(true);
    try {
      // Pass the TSE QR payload so pdf.js can inject it as an <img> right
      // before the html2canvas snapshot — guarantees the QR is captured.
      await exportReceiptToPdf(node, inv.invoice_number, widthMm, inv.tse_qr_code || "");
      toast.success(
        (lang === "de" ? "Beleg " : "إيصال ") + widthMm + "mm " + (lang === "de" ? "bereit" : "جاهز"),
      );
    } catch (e) {
      toast.error(e?.message || "Receipt error");
    } finally {
      setBusy(false);
    }
  };

  // Fill {{placeholders}} with values from the current invoice / settings.
  const fillTemplate = (template) => {
    const map = {
      "{{invoice_number}}": inv.invoice_number,
      "{{total_amount}}": fmtEUR(inv.total).replace(/\s?€$/, "").trim(),
      "{{customer_name}}": inv.customer_name || "",
      "{{shop_name}}": settings.shop_name || "",
    };
    return Object.keys(map).reduce(
      (acc, k) => acc.split(k).join(map[k]),
      String(template || ""),
    );
  };

  // === EMAIL — text-only via mailto: (no API, no internet) ===
  const handleEmail = async () => {
    if (!assertOfficial()) return;
    let email = customer?.email || "";
    if (!email) {
      const entered = window.prompt(
        lang === "de" ? "E-Mail-Adresse des Kunden:" : "البريد الإلكتروني للعميل:",
        "",
      );
      if (entered === null) return;
      email = entered.trim();
    }
    if (!email) {
      toast.error(lang === "de" ? "Keine E-Mail vorhanden" : "لا يوجد بريد إلكتروني");
      return;
    }
    const subject = lang === "de"
      ? `Rechnung ${inv.invoice_number} — ${settings.shop_name}`
      : `فاتورة رقم ${inv.invoice_number} — ${settings.shop_name}`;
    const body = lang === "de"
      ? `Hallo,\n\nIhre Rechnung ${inv.invoice_number} über ${fmtEUR(inv.total)} ist fertig.\n\nVielen Dank für Ihren Besuch!\n${settings.shop_name}`
      : `مرحباً،\n\nفاتورتكم رقم ${inv.invoice_number} بقيمة ${fmtEUR(inv.total)} جاهزة.\n\nشكراً لزيارتكم!\n${settings.shop_name}`;
    const mailto = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    try {
      window.location.href = mailto;
    } catch {
      window.open(mailto, "_blank", "noopener");
    }
  };

  // === WHATSAPP — text-only chat (no PDF attached) ===
  const handleWhatsApp = async () => {
    if (!assertOfficial()) return;
    let phone = customer?.phone || "";
    if (!phone) {
      const entered = window.prompt(
        lang === "de"
          ? "WhatsApp-Nummer des Kunden (mit Ländervorwahl, z. B. 4917612345678):"
          : "رقم واتساب العميل (برمز الدولة، مثلاً 4917612345678):",
        "",
      );
      if (entered === null) return;
      phone = entered;
    }
    const cleaned = String(phone).replace(/[^\d]/g, "");
    if (!cleaned) {
      toast.error(lang === "de" ? "Ungültige Nummer" : "رقم غير صالح");
      return;
    }
    const tpl = settings.whatsapp_template || "";
    const messageText = fillTemplate(tpl);
    const waUrl = `https://wa.me/${encodeURIComponent(cleaned)}?text=${encodeURIComponent(messageText)}`;
    try {
      window.open(waUrl, "_blank", "noopener");
    } catch {
      window.location.href = waUrl;
    }
  };

  // === SEND PDF — generate PDF and open share sheet so user picks WhatsApp / Mail / Drive ===
  const handleSendPdf = async () => {
    if (!assertOfficial()) return;
    setBusy(true);
    try {
      // Reuse the email-share path (it embeds the PDF); pre-fill subject/body.
      const subject = lang === "de"
        ? `Rechnung ${inv.invoice_number} — ${settings.shop_name}`
        : `فاتورة رقم ${inv.invoice_number} — ${settings.shop_name}`;
      const body = fillTemplate(settings.whatsapp_template || "");
      await shareInvoiceByEmail(printRef.current, inv.invoice_number, customer?.email || "", subject, body);
    } catch (e) {
      toast.error(e?.message || "Share error");
    } finally {
      setBusy(false);
    }
  };

  // On Android/Capacitor WebView, window.print() is not supported.
  // Fall back to generating & sharing the PDF (user can choose "Print" from
  // the Android share sheet — most OEM launchers include a Print target).
  const handlePrint = async () => {
    if (!assertOfficial()) return;
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
          <Button variant="outline" className="h-11" onClick={handlePrint} disabled={busy || !isOfficial} data-testid="print-invoice-button">
            <Printer size={16} className="mx-1" /> {t("common.print")}
          </Button>
          <Button className="h-11" onClick={handlePdf} disabled={busy || !isOfficial} data-testid="pdf-invoice-button">
            <FileDown size={16} className="mx-1" /> A4 PDF
          </Button>
          <Button
            variant="outline"
            className="h-11"
            onClick={() => handleReceiptPdf(80)}
            disabled={busy || !isOfficial}
            data-testid="receipt-80-button"
            title={lang === "de" ? "Bon-Druck 80mm" : "إيصال 80mm"}
          >
            <ReceiptIcon size={16} className="mx-1" /> 80mm
          </Button>
          <Button
            variant="outline"
            className="h-11"
            onClick={() => handleReceiptPdf(58)}
            disabled={busy || !isOfficial}
            data-testid="receipt-58-button"
            title={lang === "de" ? "Bon-Druck 58mm" : "إيصال 58mm"}
          >
            <ReceiptIcon size={16} className="mx-1" /> 58mm
          </Button>
          <Button
            className="h-11 bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={handleWhatsApp}
            disabled={busy || !isOfficial}
            data-testid="whatsapp-invoice-button"
            title={lang === "de" ? "WhatsApp-Text senden" : "إرسال نص واتساب"}
          >
            <MessageCircle size={16} className="mx-1" /> {lang === "de" ? "WhatsApp" : "واتساب"}
          </Button>
          <Button
            variant="outline"
            className="h-11"
            onClick={handleEmail}
            disabled={busy || !isOfficial}
            data-testid="email-invoice-button"
            title={lang === "de" ? "E-Mail (Text)" : "بريد (نص)"}
          >
            <Mail size={16} className="mx-1" /> {lang === "de" ? "E-Mail" : "بريد"}
          </Button>
          <Button
            variant="outline"
            className="h-11"
            onClick={handleSendPdf}
            disabled={busy || !isOfficial}
            data-testid="send-pdf-invoice-button"
            title={lang === "de" ? "PDF teilen" : "إرسال PDF"}
          >
            <Send size={16} className="mx-1" /> {lang === "de" ? "PDF senden" : "إرسال PDF"}
          </Button>
          {!isReversal && (
            <Button variant="destructive" className="h-11" onClick={handleStorno} disabled={busy} data-testid="storno-from-view-button">
              <Ban size={16} className="mx-1" /> {t("inv.storno_button")}
            </Button>
          )}
        </div>
      </div>

      {/* Non-official invoice warning — blocks print/export/share affordances. */}
      {!isOfficial && (
        <div
          className="no-print mb-4 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900 max-w-2xl mx-auto"
          data-testid="invoice-unofficial-banner"
        >
          <div className="font-bold mb-1">
            ⚠️ {lang === "de" ? "Nicht offiziell" : "غير رسمية"}
          </div>
          <div className="leading-relaxed">
            {lang === "de"
              ? "Diese Rechnung ist nicht offiziell und darf nicht gedruckt oder versendet werden, bis die TSE-Signatur erfolgreich ist."
              : "هذه ليست فاتورة رسمية ولا يجوز طباعتها أو إرسالها حتى يتم توقيع TSE بنجاح."}
          </div>
          {inv.tse_error_message && (
            <div className="text-[11px] text-rose-700 mt-1 font-mono break-words">
              {inv.tse_error_message}
            </div>
          )}
        </div>
      )}

      {/* TSE signed but not yet archived to backend — non-blocking warning. */}
      {isOfficial && inv.archive_status === "pending" && (
        <div
          className="no-print mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 max-w-2xl mx-auto"
          data-testid="invoice-archive-pending-banner"
        >
          <div className="font-bold mb-1">
            📦 {lang === "de" ? "Externe Archivierung ausstehend" : "الأرشفة الخارجية معلّقة"}
          </div>
          <div className="leading-relaxed">
            {lang === "de"
              ? "Die Rechnung ist TSE-signiert und gültig, wurde aber noch nicht extern archiviert. Sie können sie über die Seite \"Pending Archive\" erneut hochladen."
              : "الفاتورة موقعة بـ TSE ولكن لم يتم أرشفتها خارجياً. يمكنك إعادة رفعها من صفحة \"الأرشفة المعلقة\"."}
          </div>
          {inv.archive_error && (
            <div className="text-[11px] text-amber-800 mt-1 font-mono break-words">
              {inv.archive_error}
            </div>
          )}
        </div>
      )}

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

        {/* TSE / KassenSichV block — printed on the receipt as required */}
        {(inv.tse_status === "signed" || inv.tse_status === "pending") && (
          <div className="mt-3 pt-2 border-t border-border">
            {inv.tse_status === "pending" && (
              <div className="mb-2 rounded-md bg-amber-50 border border-amber-200 p-2 text-[10px] text-amber-900 font-semibold">
                ⚠️ {lang === "de"
                  ? "TSE-Signatur ausstehend — diese Rechnung ist NICHT rechtsgültig, bis die Signatur empfangen wird."
                  : "توقيع TSE معلّق — هذه الفاتورة ليست رسمية حتى يتم استلام التوقيع."}
                {inv.tse_error_message && <div className="mt-0.5 font-normal">{inv.tse_error_message}</div>}
              </div>
            )}
            {inv.tse_status === "signed" && (
              <div className="flex items-start gap-3 text-[10px]">
                {inv.tse_qr_code ? (
                  <div className="shrink-0 bg-white p-1 rounded border border-border">
                    <QRCodeCanvas value={inv.tse_qr_code} size={84} includeMargin={false} />
                  </div>
                ) : null}
                <div className="flex-1 space-y-0.5 text-muted-foreground leading-tight">
                  <div className="text-emerald-700 font-bold">✓ TSE-signiert (KassenSichV)</div>
                  {inv.tse_serial && <div className="font-mono break-all">Serial: {inv.tse_serial}</div>}
                  {inv.tse_counter != null && <div className="font-mono">Signatur-Zähler: {inv.tse_counter}</div>}
                  {inv.tse_timestamp && (
                    <div className="font-mono">
                      {lang === "de" ? "TSE-Zeitstempel" : "طابع الوقت"}: {new Date(inv.tse_timestamp).toLocaleString(lang === "de" ? "de-DE" : "ar-EG")}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Off-screen receipt templates — captured by html2canvas for thermal PDFs */}
      <InvoiceReceipt
        ref={receipt80Ref}
        inv={inv}
        settings={settings}
        lang={lang}
        dir={dir}
        widthMm={80}
      />
      <InvoiceReceipt
        ref={receipt58Ref}
        inv={inv}
        settings={settings}
        lang={lang}
        dir={dir}
        widthMm={58}
      />
    </div>
  );
}
