import db from "../db/db";

export async function getSettings() {
  const s = await db.settings.get("main");
  return s || {
    shop_name: "Dalaa Beauty",
    tagline: "Salon & Beauty",
    logo_url: "",
    background_url: "",
    address: "",
    phone: "",
    email: "",
    tax_id: "",
    receipt_footer: "Vielen Dank für Ihren Besuch — شكراً لزيارتكم",
  };
}

export async function updateSettings(body) {
  const { requireAdmin } = await import("./auth");
  await requireAdmin();
  const merged = { ...(await getSettings()), ...body, id: "main" };
  await db.settings.put(merged);
  const { id: _i, ...out } = merged;
  return out;
}
