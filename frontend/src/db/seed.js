import bcrypt from "bcryptjs";
import db from "./db";

export const newId = () =>
  (crypto.randomUUID && crypto.randomUUID()) ||
  ("xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  }));

export const nowIso = () => new Date().toISOString();

/**
 * Seeds a default admin user on first launch. Safe to call repeatedly.
 */
export async function seedOnce() {
  const adminEmail = "admin@salon.com";
  const existing = await db.users.where("email").equals(adminEmail).first();
  if (!existing) {
    await db.users.add({
      id: newId(),
      name: "المدير",
      email: adminEmail,
      password: bcrypt.hashSync("admin123", 8),
      role: "admin",
      created_at: nowIso(),
    });
  }

  const settings = await db.settings.get("main");
  if (!settings) {
    await db.settings.put({
      id: "main",
      shop_name: "Dalaa Beauty",
      tagline: "Salon & Beauty",
      logo_url: "",
      background_url: "",
      address: "",
      phone: "",
      email: "",
      tax_id: "",
      receipt_footer: "Vielen Dank für Ihren Besuch — شكراً لزيارتكم",
    });
  } else if (settings.shop_name === "صالون" || !settings.shop_name) {
    // Migrate older installs that still carry the default Arabic name
    await db.settings.put({ ...settings, shop_name: "Dalaa Beauty" });
  }
}
