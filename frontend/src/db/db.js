import Dexie from "dexie";

// Single local database running inside the WebView / APK.
// Data persists in IndexedDB on the device.
export const db = new Dexie("salon_db");

// v1: initial schema
db.version(1).stores({
  users: "id, email",
  products: "id, name, sku",
  services: "id, name",
  customers: "id, name, phone",
  appointments: "id, date",
  invoices: "id, invoice_number, created_at",
  expenses: "id, date",
  settings: "id",
});

// v2: add VAT rate defaults to products & services, and status/storno to invoices
db.version(2).stores({
  users: "id, email",
  products: "id, name, sku, vat_rate",
  services: "id, name, vat_rate",
  customers: "id, name, phone",
  appointments: "id, date",
  invoices: "id, invoice_number, created_at, status, storno_of",
  expenses: "id, date",
  settings: "id",
  audit_log: "id, created_at, actor_id, action, entity",
}).upgrade(async (tx) => {
  // Backfill existing records
  await tx.table("products").toCollection().modify((p) => {
    if (p.vat_rate === undefined) p.vat_rate = 19;
  });
  await tx.table("services").toCollection().modify((s) => {
    if (s.vat_rate === undefined) s.vat_rate = 19;
  });
  await tx.table("invoices").toCollection().modify((i) => {
    if (!i.status) i.status = "active";
    if (i.storno_of === undefined) i.storno_of = null;
  });
});

// v3: add TSE / KassenSichV fields to invoices (German fiscal compliance)
db.version(3).stores({
  users: "id, email",
  products: "id, name, sku, vat_rate",
  services: "id, name, vat_rate",
  customers: "id, name, phone",
  appointments: "id, date",
  invoices: "id, invoice_number, created_at, status, storno_of, tse_status",
  expenses: "id, date",
  settings: "id",
  audit_log: "id, created_at, actor_id, action, entity",
}).upgrade(async (tx) => {
  // Backfill TSE fields on existing invoices — historical records are marked
  // "not_required" (they predate TSE integration and are kept as-is for GoBD).
  await tx.table("invoices").toCollection().modify((i) => {
    if (!i.tse_status) i.tse_status = "not_required";
    if (i.tse_signature === undefined) i.tse_signature = null;
    if (i.tse_serial === undefined) i.tse_serial = null;
    if (i.tse_counter === undefined) i.tse_counter = null;
    if (i.tse_timestamp === undefined) i.tse_timestamp = null;
    if (i.tse_qr_code === undefined) i.tse_qr_code = null;
    if (i.tse_error_message === undefined) i.tse_error_message = null;
  });
});

// v4: add external-archive fields to invoices.
db.version(4).stores({
  users: "id, email",
  products: "id, name, sku, vat_rate",
  services: "id, name, vat_rate",
  customers: "id, name, phone",
  appointments: "id, date",
  invoices: "id, invoice_number, created_at, status, storno_of, tse_status, archive_status",
  expenses: "id, date",
  settings: "id",
  audit_log: "id, created_at, actor_id, action, entity",
}).upgrade(async (tx) => {
  await tx.table("invoices").toCollection().modify((i) => {
    if (i.archive_status === undefined) {
      // TSE-signed invoices predating v4 are flagged as pending so the
      // user can retry archiving them from the new "Pending Archive" UI.
      i.archive_status = (i.tse_status === "signed") ? "pending" : "not_required";
    }
    if (i.archived_at === undefined) i.archived_at = null;
    if (i.archive_error === undefined) i.archive_error = null;
  });
});

export default db;
