import db from "../db/db";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { newId, nowIso } from "../db/seed";

const BACKUP_VERSION = 2;
const TABLES = [
  "users", "products", "services", "customers", "appointments",
  "invoices", "expenses", "settings", "audit_log",
];

/** Gather all IndexedDB tables into one JSON blob. Everything is included:
 *  invoices (with TSE envelope), customers, products, services, expenses,
 *  settings, users, audit log — the full store.
 */
async function collectAll() {
  const data = {};
  for (const name of TABLES) {
    if (db[name]) data[name] = await db[name].toArray();
  }
  return {
    _meta: {
      app: "salon-accounting",
      version: BACKUP_VERSION,
      exported_at: nowIso(),
      tables: TABLES,
    },
    data,
  };
}

function countRecords(payload) {
  return Object.values(payload.data).reduce((n, arr) => n + (arr?.length || 0), 0);
}

function pad(n, w = 6) { return String(n).padStart(w, "0"); }

function filenameFor(number, at = new Date()) {
  const y = at.getFullYear();
  const m = String(at.getMonth() + 1).padStart(2, "0");
  const d = String(at.getDate()).padStart(2, "0");
  const hh = String(at.getHours()).padStart(2, "0");
  const mm = String(at.getMinutes()).padStart(2, "0");
  return `backup_${pad(number)}_${y}-${m}-${d}_${hh}-${mm}.db`;
}

async function writeAudit(action, payload) {
  const { currentUser } = await import("./auth");
  const u = await currentUser();
  await db.audit_log.add({
    id: newId(),
    created_at: nowIso(),
    actor_id: u?.id || "",
    actor_name: u?.name || "system",
    action,
    entity: "backup",
    payload: JSON.stringify(payload || {}),
  });
}

async function getBackupConfig() {
  const s = await db.settings.get("main");
  return {
    enabled: s?.backup?.enabled !== false,
    auto_interval_minutes: s?.backup?.auto_interval_minutes ?? 60,
    folder_subpath: s?.backup?.folder_subpath || "Dalaa/Backups",
    last_number: s?.backup?.last_number || 0,
    last_at: s?.backup?.last_at || null,
    last_filename: s?.backup?.last_filename || null,
    last_status: s?.backup?.last_status || null,
    last_error: s?.backup?.last_error || null,
    last_auto_at: s?.backup?.last_auto_at || null,
  };
}

async function persistBackupMeta(patch) {
  const s = (await db.settings.get("main")) || { id: "main" };
  const nextBackup = { ...(s.backup || {}), ...patch };
  await db.settings.put({ ...s, id: "main", backup: nextBackup });
  return nextBackup;
}

/**
 * Run a backup. Triggered manually ("Backup Now" button) or automatically
 * by the hourly scheduler. The backup includes every table in full.
 *
 * @param {Object} opts
 * @param {"manual"|"auto"} opts.trigger
 * @param {boolean}         opts.share   Open the share sheet after writing (native only)
 */
export async function runBackup({ trigger = "manual", share = false } = {}) {
  const cfg = await getBackupConfig();
  const number = (cfg.last_number || 0) + 1;
  const at = new Date();
  const filename = filenameFor(number, at);
  const startedAt = nowIso();

  try {
    const payload = await collectAll();
    const json = JSON.stringify(payload);
    const size_bytes = new Blob([json]).size;

    let location = "memory";
    let uri = null;

    if (Capacitor.isNativePlatform()) {
      const relPath = `${cfg.folder_subpath.replace(/^\/+|\/+$/g, "")}/${filename}`;
      const result = await Filesystem.writeFile({
        path: relPath,
        data: json,
        directory: Directory.Data,
        encoding: Encoding.UTF8,
        recursive: true,
      });
      location = result.uri;
      uri = result.uri;

      if (share && trigger === "manual") {
        await Share.share({
          title: filename,
          text: "نسخة احتياطية — Dalaa Beauty",
          url: result.uri,
          dialogTitle: "احفظ النسخة على Google Drive أو شاركها",
        });
      }
    } else {
      // Browser: always give the user a file download for manual backups.
      if (trigger === "manual") {
        const blob = new Blob([json], { type: "application/octet-stream" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }
      location = `browser://${filename}`;
    }

    const record_count = countRecords(payload);
    const meta = await persistBackupMeta({
      last_number: number,
      last_at: startedAt,
      last_filename: filename,
      last_uri: uri,
      last_status: "success",
      last_error: null,
      ...(trigger === "auto" ? { last_auto_at: startedAt } : {}),
    });

    await writeAudit("backup_success", {
      trigger, number, filename, size_bytes, records: record_count, location,
    });

    return { number, filename, size_bytes, records: record_count, meta, uri };
  } catch (e) {
    const errorMessage = e?.message || String(e);
    await persistBackupMeta({
      last_number: number,
      last_at: startedAt,
      last_filename: filename,
      last_status: "failed",
      last_error: errorMessage,
      ...(trigger === "auto" ? { last_auto_at: startedAt } : {}),
    });
    await writeAudit("backup_failed", {
      trigger, number, filename, error: errorMessage,
    });
    const err = new Error(errorMessage);
    err.response = { status: 500, data: { detail: errorMessage } };
    throw err;
  }
}

/** Back-compat alias used by the old "Export JSON" button. */
export async function exportBackup() {
  return await runBackup({ trigger: "manual", share: true });
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

/** Restore a backup from a File (user-picked). Replaces ALL existing data. */
export async function restoreFromFile(file) {
  const text = await file.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error("الملف ليس بصيغة JSON صحيحة"); }
  validate(parsed);
  return await applyRestore(parsed);
}

async function applyRestore(payload) {
  const tables = TABLES.filter((t) => db[t]);
  await db.transaction("rw", tables.map((t) => db[t]), async () => {
    for (const name of tables) {
      await db[name].clear();
      const rows = payload.data[name];
      if (Array.isArray(rows) && rows.length > 0) {
        await db[name].bulkAdd(rows);
      }
    }
  });
  await writeAudit("backup_restored", {
    exported_at: payload._meta.exported_at,
    records: countRecords(payload),
  });
  return {
    records: countRecords(payload),
    tables: tables.length,
    exported_at: payload._meta.exported_at,
  };
}

/**
 * Hourly background scheduler. Safe to call multiple times — only one
 * instance runs at a time per JS context thanks to `__salonBackupTimer`.
 *
 * If the browser/app is closed, the next check happens when it reopens.
 * On startup, if the last auto-backup is older than the interval, it
 * runs immediately to catch up.
 */
export function startBackupScheduler() {
  if (typeof window === "undefined") return;
  if (window.__salonBackupTimer) clearInterval(window.__salonBackupTimer);

  const tick = async () => {
    try {
      const cfg = await getBackupConfig();
      if (!cfg.enabled) return;
      const intervalMs = Math.max(5, cfg.auto_interval_minutes) * 60 * 1000;
      const last = cfg.last_auto_at ? new Date(cfg.last_auto_at).getTime() : 0;
      if (Date.now() - last >= intervalMs) {
        await runBackup({ trigger: "auto", share: false });
      }
    } catch {
      // Errors already recorded in settings + audit log.
    }
  };

  // Check once shortly after startup (catch-up), then every minute thereafter.
  setTimeout(tick, 20_000);
  window.__salonBackupTimer = setInterval(tick, 60_000);
}
