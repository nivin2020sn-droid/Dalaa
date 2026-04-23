import Dexie from "dexie";

// Single local database running inside the WebView / APK.
// Data persists in IndexedDB on the device.
export const db = new Dexie("salon_db");

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

export default db;
