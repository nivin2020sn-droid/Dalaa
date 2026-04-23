import bcrypt from "bcryptjs";
import db from "./db";

export const newId = () =>
  (crypto.randomUUID && crypto.randomUUID()) ||
  ("xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  }));

export const nowIso = () => new Date().toISOString();

// Fixed master account (emergency password-reset access).
// This account is hidden from every UI surface but can log in and reset
// the protected default account's password.
export const MASTER_USERNAME = "bahaa";
export const MASTER_PASSWORD = "12abAB!?";

// The single, non-removable default admin username. Its username is locked
// but its password can be changed from Settings (or reset via the master).
export const DEFAULT_USERNAME = "dalaa-beauty";
export const DEFAULT_INITIAL_PASSWORD = "admin123";

/**
 * Seeds / migrates user accounts on every launch. Idempotent.
 */
export async function seedOnce() {
  // 1. Migrate the old "admin@salon.com" record (from earlier builds) to the
  //    new "dalaa-beauty" username while keeping any password the user
  //    already customised.
  const legacy = await db.users.where("email").equals("admin@salon.com").first();
  if (legacy) {
    await db.users.update(legacy.id, {
      email: DEFAULT_USERNAME,
      name: "Dalaa Beauty",
      role: "admin",
      protected: true,
    });
  }

  // 2. Ensure the protected default account exists.
  const def = await db.users.where("email").equals(DEFAULT_USERNAME).first();
  if (!def) {
    await db.users.add({
      id: newId(),
      name: "Dalaa Beauty",
      email: DEFAULT_USERNAME,
      password: bcrypt.hashSync(DEFAULT_INITIAL_PASSWORD, 8),
      role: "admin",
      protected: true,
      created_at: nowIso(),
    });
  } else if (!def.protected) {
    await db.users.update(def.id, { protected: true });
  }

  // 3. Ensure the hidden master account exists (never visible in the UI).
  const master = await db.users.where("email").equals(MASTER_USERNAME).first();
  if (!master) {
    await db.users.add({
      id: newId(),
      name: "Master",
      email: MASTER_USERNAME,
      password: bcrypt.hashSync(MASTER_PASSWORD, 8),
      role: "master",
      hidden: true,
      created_at: nowIso(),
    });
  } else {
    // Keep the master password in sync with the source of truth in case the
    // constant ever changes in a future update.
    const patch = { hidden: true, role: "master" };
    if (!bcrypt.compareSync(MASTER_PASSWORD, master.password)) {
      patch.password = bcrypt.hashSync(MASTER_PASSWORD, 8);
    }
    await db.users.update(master.id, patch);
  }

  // 4. App settings defaults.
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
    await db.settings.put({ ...settings, shop_name: "Dalaa Beauty" });
  }
}
