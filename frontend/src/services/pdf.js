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
  const margin = 8;
  const usableWidth = pageWidth - margin * 2;
  const usableHeight = pageHeight - margin * 2;

  const imgProps = pdf.getImageProperties(imgData);
  let imgWidth = usableWidth;
  let imgHeight = (imgProps.height * imgWidth) / imgProps.width;

  if (imgHeight <= usableHeight) {
    // Fits on a single page as-is
    pdf.addImage(imgData, "PNG", margin, margin, imgWidth, imgHeight);
  } else if (imgHeight <= usableHeight * 1.6) {
    // Slight overflow: shrink proportionally so the whole invoice fits on one page.
    imgHeight = usableHeight;
    imgWidth = (imgProps.width * imgHeight) / imgProps.height;
    const xOff = (pageWidth - imgWidth) / 2;
    pdf.addImage(imgData, "PNG", xOff, margin, imgWidth, imgHeight);
  } else {
    // Long invoice: split across multiple pages
    let heightLeft = imgHeight;
    let position = margin;
    pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
    heightLeft -= usableHeight;
    while (heightLeft > 0) {
      position = heightLeft - imgHeight + margin;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
      heightLeft -= usableHeight;
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
 * Share an invoice PDF specifically to WhatsApp.
 *
 * - On native (Android/iOS): generates PDF, saves to Cache, opens the system
 *   share sheet with the PDF attached and a prefilled caption. User taps
 *   WhatsApp in the sheet; the PDF is attached and the caption is prefilled.
 * - On web: downloads the PDF and opens `https://wa.me/<number>?text=...`
 *   in a new tab so the user can attach the downloaded file manually.
 */
export async function shareInvoiceToWhatsApp(domNode, filename, phone, messageText) {
  if (!domNode) throw new Error("Invoice DOM node not found");

  const canvas = await html2canvas(domNode, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
  });
  const imgData = canvas.toDataURL("image/png");

  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 8;
  const usableWidth = pageWidth - margin * 2;
  const usableHeight = pageHeight - margin * 2;

  const imgProps = pdf.getImageProperties(imgData);
  let imgWidth = usableWidth;
  let imgHeight = (imgProps.height * imgWidth) / imgProps.width;
  if (imgHeight > usableHeight) {
    imgHeight = usableHeight;
    imgWidth = (imgProps.width * imgHeight) / imgProps.height;
  }
  const xOff = (pageWidth - imgWidth) / 2;
  pdf.addImage(imgData, "PNG", xOff, margin, imgWidth, imgHeight);

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
      text: messageText,
      url: result.uri,
      dialogTitle: "WhatsApp",
    });
  } else {
    // Web: trigger the download, then open WhatsApp in a new tab.
    pdf.save(safeFilename);
    const waUrl = `https://wa.me/${encodeURIComponent(phone)}?text=${encodeURIComponent(messageText)}`;
    window.open(waUrl, "_blank", "noopener");
  }
}
/**
 * Share an invoice PDF via email.
 *
 * - On native (Android/iOS): generates PDF, opens the system share sheet with
 *   the PDF attached + subject/body prefilled. User picks Gmail / any mail app.
 * - On web: downloads the PDF and opens `mailto:` with prefilled subject/body,
 *   so user attaches the downloaded file manually.
 */
export async function shareInvoiceByEmail(domNode, filename, recipientEmail, subject, body) {
  if (!domNode) throw new Error("Invoice DOM node not found");

  const canvas = await html2canvas(domNode, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
  });
  const imgData = canvas.toDataURL("image/png");

  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 8;
  const usableWidth = pageWidth - margin * 2;
  const usableHeight = pageHeight - margin * 2;

  const imgProps = pdf.getImageProperties(imgData);
  let imgWidth = usableWidth;
  let imgHeight = (imgProps.height * imgWidth) / imgProps.width;
  if (imgHeight > usableHeight) {
    imgHeight = usableHeight;
    imgWidth = (imgProps.width * imgHeight) / imgProps.height;
  }
  const xOff = (pageWidth - imgWidth) / 2;
  pdf.addImage(imgData, "PNG", xOff, margin, imgWidth, imgHeight);

  const safeFilename = (filename || "invoice") + ".pdf";

  if (Capacitor.isNativePlatform()) {
    const base64 = pdf.output("datauristring").split(",")[1];
    const result = await Filesystem.writeFile({
      path: safeFilename,
      data: base64,
      directory: Directory.Cache,
    });
    await Share.share({
      title: subject || safeFilename,
      text: body || "",
      url: result.uri,
      dialogTitle: "E-Mail / البريد",
    });
  } else {
    // Web: trigger the download, then open mailto: in a new tab.
    pdf.save(safeFilename);
    const mailto = `mailto:${encodeURIComponent(recipientEmail || "")}?subject=${encodeURIComponent(subject || safeFilename)}&body=${encodeURIComponent(body || "")}`;
    window.location.href = mailto;
  }
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
