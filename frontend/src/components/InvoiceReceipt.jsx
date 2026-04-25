import { forwardRef } from "react";
import { fmtEUR, fmtDate } from "../api";
import { QRCodeCanvas } from "qrcode.react";

/**
 * 80mm / 58mm thermal-receipt template.
 *
 * 100% INDEPENDENT from the A4 invoice card. NO shadcn <Card>, NO Tailwind
 * classes that could leak shared styles. Pure inline styles.
 *
 * Layout strategy (anti-overflow):
 *   - Root width is fixed in CSS pixels at 4× the printable mm
 *     (72mm → 288px;  50mm → 200px). PDF page = 72mm/50mm exactly with
 *     margin 0, so the bitmap never gets clipped by the printer.
 *   - Container `direction: ltr` ALWAYS — the layout grid is LTR.
 *     Arabic strings inside are wrapped in `<Bidi dir="rtl">` so glyph
 *     shaping works without flipping the column order.
 *   - Two-column rows use FLOATS (label: float left, value: float right)
 *     wrapped in an `overflow: hidden` clearfix div — this CANNOT push
 *     content out of the box the way flex/table-cell can on long strings.
 *   - Both label and value have `max-width: 50%` and `overflow: hidden`
 *     so a runaway long token (TSE serial) is truncated, never overflows.
 */
const payLabels = {
  cash: { ar: "نقداً", de: "Bar" },
  card: { ar: "بطاقة", de: "Karte" },
  transfer: { ar: "تحويل", de: "Überweisung" },
};

// Bidi-isolated text wrapper. Use for any string that can be Arabic so
// glyphs shape correctly inside the LTR-rooted receipt container.
const Bidi = ({ children, lang }) => (
  <span
    dir={lang === "ar" ? "rtl" : "ltr"}
    style={{ unicodeBidi: "isolate" }}
  >
    {children}
  </span>
);

// Two-column row using floats + clearfix. label left, value right.
function Row({ left, right, fontSize = 11, bold = false, total = false }) {
  const fs = total ? 14 : fontSize;
  const fw = total ? 800 : bold ? 700 : 400;
  return (
    <div style={{ overflow: "hidden", margin: "1px 0", lineHeight: 1.3 }}>
      <span
        style={{
          float: "left",
          maxWidth: "55%",
          overflow: "hidden",
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
          fontSize: `${fs}px`,
          fontWeight: fw,
        }}
      >
        {left}
      </span>
      <span
        style={{
          float: "right",
          maxWidth: "55%",
          overflow: "hidden",
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
          fontSize: `${fs}px`,
          fontWeight: fw,
          fontFamily: "monospace",
          unicodeBidi: "plaintext",
        }}
      >
        {right}
      </span>
    </div>
  );
}

// Stacked item: name on its own line, then "qty × price (vat%)" left and
// total right via a Row.
function ItemRow({ it, lang }) {
  return (
    <div style={{ marginBottom: "3px" }}>
      <div
        style={{
          fontWeight: 700,
          fontSize: "11px",
          lineHeight: 1.25,
          wordBreak: "break-word",
          textAlign: lang === "ar" ? "right" : "left",
        }}
      >
        <Bidi lang={lang}>{it.name}</Bidi>
      </div>
      <Row
        fontSize={10}
        left={
          <span style={{ color: "#444" }}>
            {it.quantity} × {fmtEUR(it.unit_price)} ({it.vat_rate}%)
          </span>
        }
        right={fmtEUR(it.total)}
        bold
      />
    </div>
  );
}

const InvoiceReceipt = forwardRef(function InvoiceReceipt(
  { inv, settings, lang, printerMm = 80 },
  ref,
) {
  if (!inv) return null;

  // 1px = 0.25mm  →  72mm = 288px ;  50mm = 200px.
  const W = printerMm === 58 ? 200 : 288;
  const isReversal = inv.status === "reversal";
  const pay = payLabels[inv.payment_method]?.[lang] || inv.payment_method;
  const QR_PX = printerMm === 58 ? 100 : 130;

  return (
    <div
      ref={ref}
      data-testid="invoice-receipt-render"
      style={{
        // On-screen but invisible — html2canvas captures fine, user never
        // sees it. NOT moved off-page — some webviews skip rendering far
        // off-screen elements which breaks the capture.
        position: "fixed",
        top: "0px",
        left: "0px",
        zIndex: -9999,
        opacity: 0,
        pointerEvents: "none",
        // Fixed pixel width matching the PDF printable area.
        width: `${W}px`,
        boxSizing: "border-box",
        padding: "8px",
        // FORCED LTR — Arabic text uses <Bidi> spans inside.
        direction: "ltr",
        textAlign: "left",
        background: "#ffffff",
        color: "#000000",
        fontFamily:
          "'Cairo', 'Tajawal', 'Inter', Arial, system-ui, sans-serif",
        fontSize: "11px",
        lineHeight: 1.3,
        // Hard guard: anything that tries to leave the box is clipped
        // (we still try to make sure nothing overflows in the first place).
        overflow: "hidden",
        wordBreak: "break-word",
      }}
    >
      {/* ============ Header (centered) ============ */}
      <div style={{ textAlign: "center", marginBottom: "4px" }}>
        {settings.logo_url && (
          <img
            src={settings.logo_url}
            alt=""
            style={{
              width: "44px",
              height: "44px",
              objectFit: "cover",
              borderRadius: "4px",
              display: "block",
              margin: "0 auto 2px",
            }}
          />
        )}
        <div style={{ fontSize: "14px", fontWeight: 800, lineHeight: 1.15 }}>
          <Bidi lang={lang}>{settings.shop_name}</Bidi>
        </div>
        {settings.tagline && (
          <div style={{ fontSize: "10px", color: "#444" }}>
            <Bidi lang={lang}>{settings.tagline}</Bidi>
          </div>
        )}
        {settings.address && (
          <div style={{ fontSize: "10px", color: "#444" }}>
            <Bidi lang={lang}>{settings.address}</Bidi>
          </div>
        )}
        {settings.phone && (
          <div style={{ fontSize: "10px", color: "#444" }}>
            {lang === "de" ? "Tel" : "هاتف"}: {settings.phone}
          </div>
        )}
        {settings.tax_id && (
          <div style={{ fontSize: "10px", color: "#444" }}>
            {lang === "de" ? "USt-IdNr." : "الرقم الضريبي"}: {settings.tax_id}
          </div>
        )}
      </div>

      <div style={{ borderTop: "1px dashed #000", margin: "4px 0" }} />

      {isReversal && (
        <div
          style={{
            textAlign: "center",
            background: "#fff5e6",
            border: "1px solid #f5b54a",
            padding: "3px",
            marginBottom: "4px",
            fontWeight: 800,
            fontSize: "11px",
          }}
        >
          {lang === "de" ? "STORNORECHNUNG" : "فاتورة إلغاء"}
          <div style={{ fontSize: "10px", fontWeight: 600 }}>
            ⟵ {inv.storno_of_number}
          </div>
        </div>
      )}

      {/* ============ Meta block ============ */}
      <Row
        left={<Bidi lang={lang}>{lang === "de" ? "Beleg-Nr." : "رقم الفاتورة"}</Bidi>}
        right={inv.invoice_number}
        bold
      />
      <Row
        left={<Bidi lang={lang}>{lang === "de" ? "Datum" : "التاريخ"}</Bidi>}
        right={fmtDate(inv.created_at, lang)}
      />
      <Row
        left={<Bidi lang={lang}>{lang === "de" ? "Kunde" : "العميل"}</Bidi>}
        right={<Bidi lang={lang}>{inv.customer_name}</Bidi>}
      />
      <Row
        left={<Bidi lang={lang}>{lang === "de" ? "Kassierer" : "الكاشير"}</Bidi>}
        right={<Bidi lang={lang}>{inv.cashier_name}</Bidi>}
      />
      <Row
        left={<Bidi lang={lang}>{lang === "de" ? "Zahlung" : "الدفع"}</Bidi>}
        right={<Bidi lang={lang}>{pay}</Bidi>}
      />

      <div style={{ borderTop: "1px dashed #000", margin: "4px 0" }} />

      {/* ============ Items ============ */}
      <div>
        {(inv.items || []).map((it, i) => (
          <ItemRow key={i} it={it} lang={lang} />
        ))}
      </div>

      <div style={{ borderTop: "1px dashed #000", margin: "4px 0" }} />

      {/* ============ Totals ============ */}
      <Row
        left={<Bidi lang={lang}>{lang === "de" ? "Netto" : "الصافي"}</Bidi>}
        right={fmtEUR(inv.net_total ?? inv.subtotal)}
      />
      {(inv.vat_breakdown || []).map((b) => (
        <Row key={b.rate} left={`MwSt ${b.rate}%`} right={fmtEUR(b.vat)} />
      ))}
      {inv.discount > 0 && (
        <Row
          left={<Bidi lang={lang}>{lang === "de" ? "Rabatt" : "خصم"}</Bidi>}
          right={`-${fmtEUR(inv.discount)}`}
        />
      )}
      <div style={{ borderTop: "2px solid #000", margin: "3px 0" }} />
      <Row
        left={<Bidi lang={lang}>{lang === "de" ? "GESAMT" : "الإجمالي"}</Bidi>}
        right={fmtEUR(inv.total)}
        total
      />

      <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />

      {/* ============ TSE / KassenSichV ============ */}
      {inv.tse_status === "signed" && (
        <div style={{ textAlign: "center", marginBottom: "4px" }}>
          {inv.tse_qr_code && (
            <div
              style={{
                background: "#fff",
                padding: "2px",
                display: "inline-block",
                marginBottom: "3px",
              }}
            >
              <QRCodeCanvas
                value={inv.tse_qr_code}
                size={QR_PX}
                includeMargin={false}
              />
            </div>
          )}
          <div
            style={{
              fontSize: "10px",
              fontWeight: 700,
              color: "#0a7d33",
            }}
          >
            ✓ TSE-signiert (KassenSichV)
          </div>
          {inv.tse_serial && (
            <div
              style={{
                fontSize: "8px",
                fontFamily: "monospace",
                wordBreak: "break-all",
                lineHeight: 1.15,
                padding: "0 2px",
              }}
            >
              Serial: {inv.tse_serial}
            </div>
          )}
          {inv.tse_counter != null && (
            <div style={{ fontSize: "8px", fontFamily: "monospace" }}>
              Sig-Zähler: {inv.tse_counter}
            </div>
          )}
          {inv.tse_timestamp && (
            <div style={{ fontSize: "8px", fontFamily: "monospace" }}>
              {new Date(inv.tse_timestamp).toLocaleString(
                lang === "de" ? "de-DE" : "ar-EG",
              )}
            </div>
          )}
        </div>
      )}

      <div
        style={{
          textAlign: "center",
          fontSize: "10px",
          color: "#444",
          marginTop: "4px",
        }}
      >
        <Bidi lang={lang}>
          {settings.receipt_footer ||
            (lang === "de" ? "Vielen Dank für Ihren Besuch" : "شكراً لزيارتكم")}
        </Bidi>
      </div>
      <div
        style={{
          textAlign: "center",
          fontSize: "8px",
          color: "#888",
          marginTop: "6px",
        }}
      >
        Bahaa Nasser
      </div>
    </div>
  );
});

export default InvoiceReceipt;
