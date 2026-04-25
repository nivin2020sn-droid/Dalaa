import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import QRCode from "qrcode";
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
  // Tight margin so the invoice uses the full A4 width better.
  const margin = 4;
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
 * Wait for every <img> inside `node` to finish loading (or to error out).
 * Critical for thermal-receipt capture: the TSE QR is embedded as a data-URL
 * <img>, which is normally instant — but when the receipt was just mounted
 * the image element may not have decoded yet, causing html2canvas to capture
 * an empty placeholder. This helper makes the capture deterministic.
 */
async function waitForImages(node, timeoutMs = 3000) {
  if (!node) return;
  const imgs = Array.from(node.querySelectorAll("img"));
  if (imgs.length === 0) return;
  await Promise.race([
    Promise.all(
      imgs.map((img) =>
        img.complete && img.naturalWidth > 0
          ? Promise.resolve()
          : new Promise((resolve) => {
              const done = () => {
                img.removeEventListener("load", done);
                img.removeEventListener("error", done);
                resolve();
              };
              img.addEventListener("load", done);
              img.addEventListener("error", done);
            }),
      ),
    ),
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

/**
 * Generate a thermal-receipt PDF (58mm or 80mm wide rolls) from a hidden DOM
 * node styled as a receipt. Uses the DOM node's natural pixel width so
 * Arabic / German text renders via the browser font stack.
 *
 * `tseQrCode` is the TSE QR payload string — when provided, this function
 * generates a PNG data-URL and INJECTS it into a `<div data-qr-placeholder>`
 * element inside the live DOM right before html2canvas takes the snapshot.
 * This avoids any React-state timing issues (the QR is guaranteed to be a
 * fully-decoded `<img>` element at capture time, even on Android WebView).
 *
 * On Android (Capacitor): saves to Cache and opens the share sheet.
 * On Web: triggers a browser download.
 */
export async function exportReceiptToPdf(domNode, filename, widthMm = 80, tseQrCode = "") {
  if (!domNode) throw new Error("Receipt DOM node not found");

  // ---- 1. Inject TSE QR as a fresh <img> just before snapshot ----------
  if (tseQrCode) {
    try {
      const qrPng = await QRCode.toDataURL(tseQrCode, {
        errorCorrectionLevel: "M",
        margin: 1,
        width: 360,
        color: { dark: "#000000", light: "#ffffff" },
      });
      const placeholder = domNode.querySelector("[data-qr-placeholder]");
      if (placeholder) {
        // Build the <img> directly in the DOM (no JSX / state) — guaranteed
        // to be present and decoded before we call html2canvas.
        const img = new Image();
        img.src = qrPng;
        img.width = 140;
        img.height = 140;
        img.alt = "TSE QR";
        img.style.cssText = "display:block;width:140px;height:140px";
        placeholder.innerHTML = "";
        placeholder.appendChild(img);
        // Force decode so the bitmap is in the renderer cache.
        if (img.decode) {
          try { await img.decode(); } catch { /* ignore */ }
        }
      }
    } catch (e) {
      console.warn("QR generation failed:", e);
    }
  }

  // Wait for ALL <img> elements (logo + QR) to be fully decoded.
  await waitForImages(domNode);

  const canvas = await html2canvas(domNode, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: "#ffffff",
    logging: false,
    windowWidth: domNode.scrollWidth,
    windowHeight: domNode.scrollHeight,
  });
  const imgData = canvas.toDataURL("image/png");

  // Page width = roll width; page height = scaled image height + small padding.
  const pageWidth = widthMm;
  const aspect = canvas.height / canvas.width;
  const pageHeight = Math.max(60, pageWidth * aspect + 6);

  const pdf = new jsPDF({
    unit: "mm",
    format: [pageWidth, pageHeight],
    orientation: "portrait",
  });

  const margin = 2;
  const usableWidth = pageWidth - margin * 2;
  const imgHeight = usableWidth * aspect;
  pdf.addImage(imgData, "PNG", margin, margin, usableWidth, imgHeight);

  const safeFilename = (filename || "receipt") + `_${widthMm}mm.pdf`;

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
