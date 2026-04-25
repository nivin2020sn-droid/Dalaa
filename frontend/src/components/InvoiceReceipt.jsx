import { forwardRef } from "react";
import { fmtEUR, fmtDate } from "../api";
import { QRCodeCanvas } from "qrcode.react";

/**
 * Thermal-receipt template — an entirely separate layout from the A4
 * invoice. Designed for narrow rolls (58mm / 80mm).
 *
 * The DOM is rendered at a FIXED pixel width that maps directly to the
 * printable area:
 *   80mm roll → 72mm printable → 576px @ 8px/mm (safely fits, no clipping).
 *   58mm roll → 50mm printable → 400px @ 8px/mm.
 *
 * IMPORTANT — design rules to keep content inside the roll width:
 *   - Single column. No flex `space-between` on rows that contain
 *     long unbreakable strings (RTL+long-strings can blow the box).
 *   - Two-column rows use a fixed-width <table> so columns can never push
 *     each other out of the page.
 *   - Every container has `box-sizing: border-box` and `overflow: hidden`.
 *   - Long tokens (TSE serial, QR payload meta) use `wordBreak: break-all`.
 */
const payLabels = {
  cash: { ar: "نقداً", de: "Bar" },
  card: { ar: "بطاقة", de: "Karte" },
  transfer: { ar: "تحويل", de: "Überweisung" },
};

const InvoiceReceipt = forwardRef(function InvoiceReceipt(
  { inv, settings, lang, dir, printerMm = 80 },
  ref,
) {
  if (!inv) return null;

  // Render width in CSS pixels. ~8px per mm of printable width keeps the
  // bitmap crisp without inflating the PDF unnecessarily. html2canvas will
  // also apply scale=2 for sharper output.
  const renderWidthPx = printerMm === 58 ? 400 : 576;
  const isReversal = inv.status === "reversal";
  const pay = payLabels[inv.payment_method]?.[lang] || inv.payment_method;

  // Compact font scale — 80mm fits ~32 chars per line at 13px / 14px.
  const FONT_BODY = printerMm === 58 ? 13 : 14;
  const FONT_SMALL = printerMm === 58 ? 11 : 12;
  const FONT_LARGE = printerMm === 58 ? 17 : 18;
  const FONT_TOTAL = printerMm === 58 ? 19 : 22;
  const PAD_X = printerMm === 58 ? 10 : 14;

  // Helper for two-column rows that absolutely must not overflow.
  const Row = ({ left, right, bold = false, total = false }) => (
    <table
      style={{
        width: "100%",
        borderCollapse: "collapse",
        fontSize: total ? FONT_TOTAL : FONT_BODY,
        fontWeight: total ? 800 : bold ? 700 : 400,
        margin: "1px 0",
        tableLayout: "fixed",
      }}
    >
      <tbody>
        <tr>
          <td
            style={{
              padding: 0,
              textAlign: dir === "rtl" ? "right" : "left",
              wordBreak: "break-word",
              overflow: "hidden",
              verticalAlign: "top",
            }}
          >
            {left}
          </td>
          <td
            style={{
              padding: 0,
              textAlign: dir === "rtl" ? "left" : "right",
              wordBreak: "break-word",
              overflow: "hidden",
              verticalAlign: "top",
              whiteSpace: "nowrap",
            }}
          >
            {right}
          </td>
        </tr>
      </tbody>
    </table>
  );

  return (
    <div
      ref={ref}
      data-testid="invoice-receipt-render"
      style={{
        position: "fixed",
        top: "-10000px",
        left: "-10000px",
        width: `${renderWidthPx}px`,
        boxSizing: "border-box",
        background: "#ffffff",
        color: "#000000",
        fontFamily:
          "'Cairo', 'Tajawal', 'Inter', system-ui, -apple-system, Segoe UI, sans-serif",
        padding: `12px ${PAD_X}px`,
        direction: dir,
        fontSize: `${FONT_BODY}px`,
        lineHeight: 1.35,
        overflow: "hidden",
        wordBreak: "break-word",
      }}
    >
      {/* === Header (centered) === */}
      <div style={{ textAlign: "center", marginBottom: "6px" }}>
        {settings.logo_url && (
          <img
            src={settings.logo_url}
            alt=""
            style={{
              width: "60px",
              height: "60px",
              objectFit: "cover",
              borderRadius: "6px",
              display: "block",
              margin: "0 auto 4px",
            }}
          />
        )}
        <div style={{ fontSize: `${FONT_LARGE + 4}px`, fontWeight: 800, lineHeight: 1.2 }}>
          {settings.shop_name}
        </div>
        {settings.tagline && (
          <div style={{ fontSize: `${FONT_SMALL}px`, color: "#444" }}>
            {settings.tagline}
          </div>
        )}
        {settings.address && (
          <div style={{ fontSize: `${FONT_SMALL}px`, color: "#444" }}>
            {settings.address}
          </div>
        )}
        {settings.phone && (
          <div style={{ fontSize: `${FONT_SMALL}px`, color: "#444" }}>
            {lang === "de" ? "Tel" : "هاتف"}: {settings.phone}
          </div>
        )}
        {settings.tax_id && (
          <div style={{ fontSize: `${FONT_SMALL}px`, color: "#444" }}>
            {lang === "de" ? "USt-IdNr." : "الرقم الضريبي"}: {settings.tax_id}
          </div>
        )}
      </div>

      <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />

      {isReversal && (
        <div
          style={{
            textAlign: "center",
            background: "#fff5e6",
            border: "1px solid #f5b54a",
            padding: "4px",
            marginBottom: "6px",
            fontWeight: 800,
            fontSize: `${FONT_BODY}px`,
          }}
        >
          {lang === "de" ? "STORNORECHNUNG" : "فاتورة إلغاء"}
          <div style={{ fontSize: `${FONT_SMALL}px`, fontWeight: 600 }}>
            ⟵ {inv.storno_of_number}
          </div>
        </div>
      )}

      {/* === Meta === */}
      <Row
        left={lang === "de" ? "Beleg-Nr." : "رقم الفاتورة"}
        right={<span style={{ fontFamily: "monospace", fontWeight: 700 }}>{inv.invoice_number}</span>}
      />
      <Row left={lang === "de" ? "Datum" : "التاريخ"} right={fmtDate(inv.created_at, lang)} />
      <Row left={lang === "de" ? "Kunde" : "العميل"} right={inv.customer_name} />
      <Row left={lang === "de" ? "Kassierer" : "الكاشير"} right={inv.cashier_name} />
      <Row left={lang === "de" ? "Zahlung" : "الدفع"} right={pay} />

      <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />

      {/* === Items === */}
      <div>
        {(inv.items || []).map((it, i) => (
          <div
            key={i}
            style={{
              marginBottom: "5px",
              fontSize: `${FONT_BODY}px`,
            }}
          >
            <div style={{ fontWeight: 700, wordBreak: "break-word" }}>
              {it.name}
            </div>
            <Row
              left={
                <span style={{ fontSize: `${FONT_SMALL}px` }}>
                  {it.quantity} × {fmtEUR(it.unit_price)}{" "}
                  <span style={{ color: "#666" }}>({it.vat_rate}%)</span>
                </span>
              }
              right={<span style={{ fontWeight: 700 }}>{fmtEUR(it.total)}</span>}
            />
          </div>
        ))}
      </div>

      <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />

      {/* === Totals === */}
      <Row left={lang === "de" ? "Netto" : "الصافي"} right={fmtEUR(inv.net_total ?? inv.subtotal)} />
      {(inv.vat_breakdown || []).map((b) => (
        <Row key={b.rate} left={`MwSt ${b.rate}%`} right={fmtEUR(b.vat)} />
      ))}
      {inv.discount > 0 && (
        <Row left={lang === "de" ? "Rabatt" : "خصم"} right={`-${fmtEUR(inv.discount)}`} />
      )}
      <div style={{ borderTop: "2px solid #000", margin: "4px 0" }} />
      <Row left={lang === "de" ? "GESAMT" : "الإجمالي"} right={fmtEUR(inv.total)} total />

      <div style={{ borderTop: "1px dashed #000", margin: "8px 0" }} />

      {/* === TSE block === */}
      {inv.tse_status === "signed" && (
        <div style={{ textAlign: "center", marginBottom: "6px" }}>
          {inv.tse_qr_code && (
            <div
              style={{
                background: "#fff",
                padding: "2px",
                display: "inline-block",
                marginBottom: "4px",
              }}
            >
              <QRCodeCanvas
                value={inv.tse_qr_code}
                size={printerMm === 58 ? 100 : 130}
                includeMargin={false}
              />
            </div>
          )}
          <div style={{ fontSize: `${FONT_SMALL}px`, fontWeight: 700, color: "#0a7d33" }}>
            ✓ TSE-signiert (KassenSichV)
          </div>
          {inv.tse_serial && (
            <div
              style={{
                fontSize: "10px",
                fontFamily: "monospace",
                wordBreak: "break-all",
                lineHeight: 1.2,
              }}
            >
              Serial: {inv.tse_serial}
            </div>
          )}
          {inv.tse_counter != null && (
            <div style={{ fontSize: "10px", fontFamily: "monospace" }}>
              Sig-Zähler: {inv.tse_counter}
            </div>
          )}
          {inv.tse_timestamp && (
            <div style={{ fontSize: "10px", fontFamily: "monospace" }}>
              {new Date(inv.tse_timestamp).toLocaleString(
                lang === "de" ? "de-DE" : "ar-EG",
              )}
            </div>
          )}
        </div>
      )}

      <div style={{ textAlign: "center", fontSize: `${FONT_SMALL}px`, color: "#444", marginTop: "6px" }}>
        {settings.receipt_footer ||
          (lang === "de" ? "Vielen Dank für Ihren Besuch" : "شكراً لزيارتكم")}
      </div>
      <div style={{ textAlign: "center", fontSize: "10px", color: "#888", marginTop: "8px" }}>
        Bahaa Nasser
      </div>
    </div>
  );
});

export default InvoiceReceipt;
