import db from "../db/db";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

const BACKUP_VERSION = 1;
const TABLES = ["users", "products", "services", "customers", "appointments", "invoices", "expenses", "settings"];

/** Gather all IndexedDB tables into one JSON blob. */
async function collectAll() {
  const data = {};
  for (const name of TABLES) {
    data[name] = await db[name].toArray();
  }
  return {
    _meta: {
      app: "salon-accounting",
      version: BACKUP_VERSION,
      exported_at: new Date().toISOString(),
      tables: TABLES,
    },
    data,
  };
}

function backupFilename() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `salon-backup-${stamp}.json`;
}

/**
 * Export all data. On Android: write the JSON to the app cache and open
 * the system share sheet (so user can pick "Save to Drive", Dropbox, etc.).
 * On Web: trigger a browser download.
 */
export async function exportBackup() {
  const payload = await collectAll();
  const json = JSON.stringify(payload, null, 2);
  const filename = backupFilename();

  if (Capacitor.isNativePlatform()) {
    const result = await Filesystem.writeFile({
      path: filename,
      data: json,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    await Share.share({
      title: "نسخة احتياطية — صالون",
      text: "نسخة احتياطية من بيانات التطبيق",
      url: result.uri,
      dialogTitle: "احفظ النسخة على Google Drive أو شاركها",
    });
    return { filename, records: countRecords(payload) };
  }

  // Browser fallback: download as file
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  return { filename, records: countRecords(payload) };
}

function countRecords(payload) {
  return Object.values(payload.data).reduce((n, arr) => n + (arr?.length || 0), 0);
}

/** Validate a parsed backup object and throw a friendly error if invalid. */
function validate(obj) {
  if (!obj || typeof obj !== "object" || !obj._meta || !obj.data) {
    throw new Error("ملف غير صالح — لا يحتوي على بيانات نسخة احتياطية");
  }
  if (obj._meta.app !== "salon-accounting") {
    throw new Error("الملف ليس نسخة من تطبيق الصالون");
  }
  if (obj._meta.version > BACKUP_VERSION) {
    throw new Error("نسخة أحدث من إصدار التطبيق — حدّث التطبيق أولاً");
  }
}

/**
 * Restore a backup from a File (user-picked). Replaces ALL existing data.
 */
export async function restoreFromFile(file) {
  const text = await file.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("الملف ليس بصيغة JSON صحيحة");
  }
  validate(parsed);
  return await applyRestore(parsed);
}

async function applyRestore(payload) {
  await db.transaction("rw", TABLES.map((t) => db[t]), async () => {
    for (const name of TABLES) {
      await db[name].clear();
      const rows = payload.data[name];
      if (Array.isArray(rows) && rows.length > 0) {
        await db[name].bulkAdd(rows);
      }
    }
  });
  return {
    records: countRecords(payload),
    tables: TABLES.length,
    exported_at: payload._meta.exported_at,
  };
}
