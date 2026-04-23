import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

/**
 * Generate a PDF by capturing the printable invoice DOM node as a canvas
 * (so Arabic ligatures render correctly via the browser font stack),
 * then embedding it in a jsPDF document.
 *
 * On Android (Capacitor): saves to Cache and opens the share sheet,
 *                         so user can send to Drive / Gmail / WhatsApp.
 * On Web:                 triggers a browser download.
 */
export async function exportInvoiceToPdf(domNode, filename) {
  if (!domNode) throw new Error("Invoice DOM node not found");

  const canvas = await html2canvas(domNode, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
  });
  const imgData = canvas.toDataURL("image/png");

  const pdf = new jsPDF({
    unit: "mm",
    format: "a4",
    orientation: "portrait",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;

  const imgProps = pdf.getImageProperties(imgData);
  const imgWidth = pageWidth - margin * 2;
  const imgHeight = (imgProps.height * imgWidth) / imgProps.width;

  if (imgHeight <= pageHeight - margin * 2) {
    pdf.addImage(imgData, "PNG", margin, margin, imgWidth, imgHeight);
  } else {
    // Multi-page support for very long invoices
    let heightLeft = imgHeight;
    let position = margin;
    pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
    heightLeft -= pageHeight - margin * 2;
    while (heightLeft > 0) {
      position = heightLeft - imgHeight + margin;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
      heightLeft -= pageHeight - margin * 2;
    }
  }

  const safeFilename = (filename || "invoice") + ".pdf";

  if (Capacitor.isNativePlatform()) {
    const base64 = pdf.output("datauristring").split(",")[1];
    const result = await Filesystem.writeFile({
      path: safeFilename,
      data: base64,
      directory: Directory.Cache,
    });
    await Share.share({
      title: safeFilename,
      text: "فاتورة PDF",
      url: result.uri,
      dialogTitle: "حفظ الفاتورة / Rechnung speichern",
    });
  } else {
    pdf.save(safeFilename);
  }
}

/**
 * Email an invoice PDF: same as export but hints the system to use mail.
 * On Web: just downloads — user can attach manually.
 */
export async function emailInvoicePdf(domNode, filename, recipientHint) {
  if (Capacitor.isNativePlatform()) {
    // Same flow — user picks Gmail from the share sheet
    return await exportInvoiceToPdf(domNode, filename);
  }
  const fullname = (filename || "invoice") + ".pdf";
  await exportInvoiceToPdf(domNode, fullname);
  const mailto = `mailto:${recipientHint || ""}?subject=${encodeURIComponent("فاتورة / Rechnung " + (filename || ""))}&body=${encodeURIComponent("مرفق ملف الفاتورة — Siehe Anhang.")}`;
  window.location.href = mailto;
}

/**
 * Export the whole DB backup JSON as a mail attachment (helper for settings).
 */
export async function shareBackupEmail(jsonString, filename) {
  if (Capacitor.isNativePlatform()) {
    const base64 = btoa(unescape(encodeURIComponent(jsonString)));
    const result = await Filesystem.writeFile({
      path: filename,
      data: base64,
      directory: Directory.Cache,
    });
    await Share.share({
      title: "نسخة احتياطية — Backup",
      text: "نسخة احتياطية من بيانات التطبيق",
      url: result.uri,
      dialogTitle: "إرسال للبريد / Per E-Mail senden",
    });
  } else {
    const mailto = `mailto:?subject=${encodeURIComponent("نسخة احتياطية — Salon Backup")}&body=${encodeURIComponent("النسخة مرفقة في التحميل\nBackup ist im Download.")}`;
    window.location.href = mailto;
  }
}
