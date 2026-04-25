import { forwardRef, useEffect, useState } from "react";
import { fmtEUR, fmtDate } from "../api";
import QRCode from "qrcode";

/**
 * Thermal-receipt layout for an invoice (58mm or 80mm rolls).
 *
 * Designed to be rendered hidden off-screen, captured by html2canvas, and
 * embedded into a narrow jsPDF page. The DOM is drawn at a fixed pixel
 * width so the PDF target width (in mm) is just a scaling factor.
 *
 * Width reference (96dpi):
 *   58mm ≈ 219px      (printable area ≈ 48mm)
 *   80mm ≈ 302px      (printable area ≈ 72mm)
 */
const payLabels = {
  cash: { ar: "نقداً", de: "Bar" },
  card: { ar: "بطاقة", de: "Karte" },
  transfer: { ar: "تحويل", de: "Überweisung" },
};

const InvoiceReceipt = forwardRef(function InvoiceReceipt(
  { inv, settings, lang, dir, widthMm = 80 },
  ref,
) {
  const [qrDataUrl, setQrDataUrl] = useState("");

  // Pre-render the TSE QR as a PNG data URL. Using an <img> with a data URL
  // is the most reliable way to ensure html2canvas captures the QR correctly
  // — far more reliable than <canvas> or <svg>, which may fail in Capacitor
  // Android WebView during the html2canvas snapshot.
  useEffect(() => {
    let cancelled = false;
    const code = inv?.tse_qr_code;
    if (!code) { setQrDataUrl(""); return; }
    QRCode.toDataURL(code, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 360, // generated bitmap; we display at 140 CSS px → crisp on print
      color: { dark: "#000000", light: "#ffffff" },
    })
      .then((url) => { if (!cancelled) setQrDataUrl(url); })
      .catch(() => { if (!cancelled) setQrDataUrl(""); });
    return () => { cancelled = true; };
  }, [inv?.tse_qr_code]);

  if (!inv) return null;

  // Render at ~3x the physical width in pixels for a crisp 200dpi-ish capture.
  // jsPDF will scale the resulting bitmap down to widthMm.
  const renderWidthPx = Math.round(widthMm * 3.78 * 2.4); // ≈ 725px @ 80mm
  const isReversal = inv.status === "reversal";
  const pay = payLabels[inv.payment_method]?.[lang] || inv.payment_method;

  return (
    <div
      ref={ref}
      data-testid="invoice-receipt-render"
      style={{
        position: "fixed",
        top: "-10000px",
        left: "-10000px",
        width: `${renderWidthPx}px`,
        background: "#ffffff",
        color: "#000000",
        fontFamily:
          "'Inter', 'Cairo', 'Tajawal', system-ui, -apple-system, Segoe UI, sans-serif",
        padding: "16px",
        direction: dir,
        fontSize: "22px",
        lineHeight: "1.35",
        boxSizing: "border-box",
      }}
    >
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "10px" }}>
        {settings.logo_url && (
          <img
            src={settings.logo_url}
            alt=""
            style={{
              width: "72px",
              height: "72px",
              objectFit: "cover",
              borderRadius: "8px",
              margin: "0 auto 6px",
            }}
          />
        )}
        <div style={{ fontSize: "30px", fontWeight: 800 }}>{settings.shop_name}</div>
        {settings.tagline && (
          <div style={{ fontSize: "20px", color: "#444" }}>{settings.tagline}</div>
        )}
        {settings.address && (
          <div style={{ fontSize: "18px", color: "#444" }}>{settings.address}</div>
        )}
        {settings.phone && (
          <div style={{ fontSize: "18px", color: "#444" }}>
            {lang === "de" ? "Tel" : "هاتف"}: {settings.phone}
          </div>
        )}
        {settings.tax_id && (
          <div style={{ fontSize: "18px", color: "#444" }}>
            {lang === "de" ? "USt-IdNr." : "الرقم الضريبي"}: {settings.tax_id}
          </div>
        )}
      </div>

      <div style={{ borderTop: "1px dashed #000", margin: "8px 0" }} />

      {isReversal && (
        <div
          style={{
            textAlign: "center",
            background: "#fff5e6",
            border: "1px solid #f5b54a",
            padding: "6px",
            marginBottom: "8px",
            fontWeight: 800,
          }}
        >
          {lang === "de" ? "STORNORECHNUNG" : "فاتورة إلغاء"}
          <div style={{ fontSize: "18px", fontWeight: 600 }}>
            ⟵ {inv.storno_of_number}
          </div>
        </div>
      )}

      {/* Meta */}
      <div style={{ fontSize: "20px", marginBottom: "8px", lineHeight: 1.5 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
          <span>{lang === "de" ? "Beleg-Nr." : "رقم الفاتورة"}</span>
          <span style={{ fontFamily: "monospace", fontWeight: 700 }}>
            {inv.invoice_number}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
          <span>{lang === "de" ? "Datum" : "التاريخ"}</span>
          <span>{fmtDate(inv.created_at, lang)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
          <span>{lang === "de" ? "Kunde" : "العميل"}</span>
          <span>{inv.customer_name}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
          <span>{lang === "de" ? "Kassierer" : "الكاشير"}</span>
          <span>{inv.cashier_name}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
          <span>{lang === "de" ? "Zahlung" : "الدفع"}</span>
          <span>{pay}</span>
        </div>
      </div>

      <div style={{ borderTop: "1px dashed #000", margin: "8px 0" }} />

      {/* Items */}
      <div style={{ fontSize: "20px", lineHeight: 1.5 }}>
        {(inv.items || []).map((it, i) => (
          <div key={i} style={{ marginBottom: "8px" }}>
            <div style={{ fontWeight: 700 }}>{it.name}</div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
              <span>
                {it.quantity} × {fmtEUR(it.unit_price)}{" "}
                <span style={{ color: "#666", fontSize: "16px" }}>
                  ({it.vat_rate}%)
                </span>
              </span>
              <span style={{ fontWeight: 700 }}>{fmtEUR(it.total)}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ borderTop: "1px dashed #000", margin: "8px 0" }} />

      {/* Totals */}
      <div style={{ fontSize: "20px", lineHeight: 1.5 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
          <span>{lang === "de" ? "Netto" : "الصافي"}</span>
          <span>{fmtEUR(inv.net_total ?? inv.subtotal)}</span>
        </div>
        {(inv.vat_breakdown || []).map((b) => (
          <div
            key={b.rate}
            style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}
          >
            <span>MwSt {b.rate}%</span>
            <span>{fmtEUR(b.vat)}</span>
          </div>
        ))}
        {inv.discount > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
            <span>{lang === "de" ? "Rabatt" : "خصم"}</span>
            <span>-{fmtEUR(inv.discount)}</span>
          </div>
        )}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "12px",
            marginTop: "6px",
            paddingTop: "6px",
            borderTop: "2px solid #000",
            fontSize: "26px",
            fontWeight: 800,
            lineHeight: 1.4,
          }}
        >
          <span>{lang === "de" ? "GESAMT" : "الإجمالي"}</span>
          <span>{fmtEUR(inv.total)}</span>
        </div>
      </div>

      <div style={{ borderTop: "1px dashed #000", margin: "10px 0" }} />

      {/* TSE block */}
      {inv.tse_status === "signed" && (
        <div style={{ textAlign: "center", marginBottom: "8px" }}>
          {qrDataUrl && (
            <div
              style={{
                background: "#fff",
                padding: "4px",
                display: "inline-block",
                marginBottom: "6px",
              }}
            >
              <img
                src={qrDataUrl}
                alt="TSE QR"
                width={140}
                height={140}
                style={{ display: "block", width: "140px", height: "140px" }}
              />
            </div>
          )}
          <div style={{ fontSize: "18px", fontWeight: 700, color: "#0a7d33" }}>
            ✓ TSE-signiert (KassenSichV)
          </div>
          {inv.tse_serial && (
            <div style={{ fontSize: "14px", fontFamily: "monospace", wordBreak: "break-all" }}>
              Serial: {inv.tse_serial}
            </div>
          )}
          {inv.tse_counter != null && (
            <div style={{ fontSize: "14px", fontFamily: "monospace" }}>
              Sig-Zähler: {inv.tse_counter}
            </div>
          )}
          {inv.tse_timestamp && (
            <div style={{ fontSize: "14px", fontFamily: "monospace" }}>
              {new Date(inv.tse_timestamp).toLocaleString(
                lang === "de" ? "de-DE" : "ar-EG",
              )}
            </div>
          )}
        </div>
      )}

      <div style={{ textAlign: "center", fontSize: "18px", color: "#444", marginTop: "8px" }}>
        {settings.receipt_footer ||
          (lang === "de" ? "Vielen Dank für Ihren Besuch" : "شكراً لزيارتكم")}
      </div>
    </div>
  );
});

export default InvoiceReceipt;
