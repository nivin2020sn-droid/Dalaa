import db from "../db/db";
import { newId, nowIso } from "../db/seed";

export async function getSettings() {
  const s = await db.settings.get("main");
  return s || {
    shop_name: "Dalaa Beauty",
    tagline: "Beauty center & Academy",
    logo_url: "",
    background_url: "",
    login_background_url: "",
    address: "",
    phone: "",
    email: "",
    tax_id: "",
    receipt_footer: "Vielen Dank für Ihren Besuch — شكراً لزيارتكم",
  };
}

/**
 * Fields whose edits are considered TECHNICALLY SENSITIVE.
 * Only the hidden master developer account is allowed to touch these —
 * regular admin users may still update ordinary shop info (name, address,
 * logo, footer…) for day-to-day operation.
 */
const MASTER_ONLY_FIELDS = new Set([
  "tse",
  "backup",
  "login_background_url",
  "tax_id", // fiscal identifier — locked down
]);

function containsMasterOnlyEdit(oldSettings, body) {
  for (const k of Object.keys(body || {})) {
    if (!MASTER_ONLY_FIELDS.has(k)) continue;
    // If the new value differs from the current, it counts as an edit.
    if (JSON.stringify(oldSettings?.[k] ?? null) !== JSON.stringify(body[k])) return true;
  }
  return false;
}

function diffFields(oldSettings, body) {
  const diffs = {};
  for (const k of Object.keys(body || {})) {
    const before = oldSettings?.[k];
    const after = body[k];
    if (JSON.stringify(before ?? null) !== JSON.stringify(after ?? null)) {
      // Redact huge base64 payloads so the audit log stays small & readable.
      const compact = (v) => {
        if (typeof v === "string" && v.length > 80) return `${v.slice(0, 40)}…(${v.length} chars)`;
        return v;
      };
      diffs[k] = { before: compact(before), after: compact(after) };
    }
  }
  return diffs;
}

export async function updateSettings(body) {
  const { requireAdmin, requireMaster, currentUser } = await import("./auth");

  const existing = await getSettings();
  // Master-only fields require the master account.
  if (containsMasterOnlyEdit(existing, body)) {
    await requireMaster();
  } else {
    await requireAdmin();
  }

  const merged = { ...existing, ...body, id: "main" };
  const changes = diffFields(existing, body);
  await db.settings.put(merged);

  // Audit log entry for every settings change.
  if (Object.keys(changes).length > 0) {
    const u = await currentUser();
    await db.audit_log.add({
      id: newId(),
      created_at: nowIso(),
      actor_id: u?.id || "",
      actor_name: u?.name || "",
      action: "settings_update",
      entity: "settings/main",
      payload: JSON.stringify({ changes }),
    });
  }

  const { id: _i, ...out } = merged;
  return out;
}
