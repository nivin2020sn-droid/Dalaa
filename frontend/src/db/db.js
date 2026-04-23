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

export default db;
