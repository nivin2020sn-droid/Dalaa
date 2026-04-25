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
 * Generate a thermal-receipt PDF from a hidden DOM node styled as a receipt.
 *
 * `printerMm` is the ROLL width (80 or 58). The PDF page is sized to the
 * actual PRINTABLE area on those rolls (72mm for 80mm rolls, 50mm for 58mm
 * rolls), with NO outer margin so nothing gets clipped by the printer's
 * non-printable border.
 *
 * The receipt template renders ON-SCREEN (top:0, left:0) with `opacity:0`
 * so html2canvas always sees real layout dimensions. The cloned node has
 * its opacity restored to 1 inside `onclone` so the bitmap is opaque.
 */
export async function exportReceiptToPdf(domNode, filename, printerMm = 80) {
  if (!domNode) throw new Error("Receipt DOM node not found");

  // Roll → printable area mapping. These widths avoid right-edge clipping
  // on typical POS-58 / POS-80 thermal printers.
  const PAGE_MM = printerMm === 58 ? 50 : 72;

  // Capture exactly the receipt's intrinsic box. Don't trust the document
  // viewport — the receipt sets its own width via inline CSS.
  const renderWidth = domNode.offsetWidth;
  const renderHeight = domNode.offsetHeight;
  if (!renderWidth || !renderHeight) {
    throw new Error("Receipt template not laid out yet");
  }

  const canvas = await html2canvas(domNode, {
    scale: 3, // crisp output for the small width
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
    width: renderWidth,
    height: renderHeight,
    windowWidth: renderWidth,
    windowHeight: renderHeight,
    foreignObjectRendering: false,
    removeContainer: true,
    // Restore opacity on the clone so the PNG is opaque, not transparent.
    onclone: (doc, clonedNode) => {
      try {
        clonedNode.style.opacity = "1";
        clonedNode.style.position = "static";
        clonedNode.style.top = "auto";
        clonedNode.style.left = "auto";
        clonedNode.style.zIndex = "auto";
      } catch {
        /* ignore */
      }
    },
  });
  const imgData = canvas.toDataURL("image/png");

  // PDF page = exactly the printable area; height auto-derived from aspect.
  const aspect = canvas.height / canvas.width;
  const pageHeight = Math.max(40, PAGE_MM * aspect);

  const pdf = new jsPDF({
    unit: "mm",
    format: [PAGE_MM, pageHeight],
    orientation: "portrait",
  });

  // No margin — the receipt template already has internal padding.
  pdf.addImage(imgData, "PNG", 0, 0, PAGE_MM, pageHeight);

  const safeFilename = (filename || "receipt") + `_${printerMm}mm.pdf`;

  if (Capacitor.isNativePlatform()) {
    const base64 = pdf.output("datauristring").split(",")[1];
    const result = await Filesystem.writeFile({
      path: safeFilename,
      data: base64,
      directory: Directory.Cache,
    });
    await Share.share({
      title: safeFilename,
      text: "Beleg / إيصال",
      url: result.uri,
      dialogTitle: "Drucken / Speichern",
    });
  } else {
    pdf.save(safeFilename);
  }
}

/**
 * Generate a tall PDF (A5-ish portrait) for an appointment confirmation slip
 * captured from a hidden DOM node, then open the share sheet on native or
 * trigger a download on web. Used both for "print" and for "send" flows.
 */
export async function exportAppointmentToPdf(domNode, filename) {
  if (!domNode) throw new Error("Appointment DOM node not found");

  const canvas = await html2canvas(domNode, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
    windowWidth: domNode.scrollWidth,
    windowHeight: domNode.scrollHeight,
  });
  const imgData = canvas.toDataURL("image/png");

  // Use A5 portrait so the slip is easy to print on a regular printer; thermal
  // printers can still consume it via the OS print dialog (auto-fit).
  const pdf = new jsPDF({ unit: "mm", format: "a5", orientation: "portrait" });
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

  const safeFilename = (filename || "appointment") + ".pdf";

  if (Capacitor.isNativePlatform()) {
    const base64 = pdf.output("datauristring").split(",")[1];
    const result = await Filesystem.writeFile({
      path: safeFilename,
      data: base64,
      directory: Directory.Cache,
    });
    await Share.share({
      title: safeFilename,
      text: "Terminbestätigung",
      url: result.uri,
      dialogTitle: "Drucken / Senden",
    });
  } else {
    pdf.save(safeFilename);
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
