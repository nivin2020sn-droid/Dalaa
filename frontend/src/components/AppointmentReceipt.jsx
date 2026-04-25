import { forwardRef } from "react";

/**
 * Appointment confirmation slip — renders both as A4-ish printable card and as
 * a thermal-receipt slip (when widthMm <= 100). Captured by html2canvas in
 * services/pdf.js and embedded in a jsPDF document.
 */
const AppointmentReceipt = forwardRef(function AppointmentReceipt(
  { appt, settings, lang, dir, widthMm = 80 },
  ref,
) {
  if (!appt) return null;

  const renderWidthPx = Math.round(widthMm * 3.78 * 2.4);
  const locale = lang === "de" ? "de-DE" : "ar-EG";
  const dateLabel = appt.date
    ? new Date(appt.date + "T00:00:00").toLocaleDateString(locale, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  return (
    <div
      ref={ref}
      data-testid="appointment-receipt-render"
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
        lineHeight: "1.4",
        boxSizing: "border-box",
      }}
    >
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
      </div>

      <div style={{ borderTop: "1px dashed #000", margin: "8px 0" }} />

      <div style={{ textAlign: "center", fontSize: "26px", fontWeight: 800, marginBottom: "10px" }}>
        {lang === "de" ? "Terminbestätigung" : "تأكيد موعد"}
      </div>

      <div style={{ fontSize: "22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
          <span>{lang === "de" ? "Kunde" : "العميل"}</span>
          <span style={{ fontWeight: 700 }}>{appt.customer_name}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
          <span>{lang === "de" ? "Leistung" : "الخدمة"}</span>
          <span style={{ fontWeight: 700 }}>{appt.service_name}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
          <span>{lang === "de" ? "Datum" : "التاريخ"}</span>
          <span style={{ fontWeight: 700 }}>{dateLabel}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
          <span>{lang === "de" ? "Uhrzeit" : "الوقت"}</span>
          <span style={{ fontWeight: 700, fontFamily: "monospace" }}>{appt.time}</span>
        </div>
        {appt.notes && (
          <div style={{ marginTop: "8px", padding: "8px", background: "#f5f5f5", borderRadius: "6px" }}>
            <div style={{ fontSize: "16px", color: "#666" }}>
              {lang === "de" ? "Notizen" : "ملاحظات"}
            </div>
            <div>{appt.notes}</div>
          </div>
        )}
      </div>

      <div style={{ borderTop: "1px dashed #000", margin: "10px 0" }} />

      {settings.address && (
        <div style={{ textAlign: "center", fontSize: "18px", color: "#444" }}>
          {settings.address}
        </div>
      )}
      {settings.phone && (
        <div style={{ textAlign: "center", fontSize: "18px", color: "#444" }}>
          {lang === "de" ? "Tel" : "هاتف"}: {settings.phone}
        </div>
      )}

      <div style={{ textAlign: "center", fontSize: "18px", color: "#444", marginTop: "10px" }}>
        {lang === "de"
          ? "Wir freuen uns auf Ihren Besuch!"
          : "في انتظاركم!"}
      </div>
    </div>
  );
});

export default AppointmentReceipt;
