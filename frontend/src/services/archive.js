/**
 * External invoice archive client.
 *
 * Called AFTER a successful TSE signature to persist a full copy of the
 * invoice on the backend. Failure to archive does NOT invalidate the
 * TSE-signed invoice — it just marks it as `archive_status = pending`
 * so it can be retried later.
 */

const DEFAULT_TIMEOUT_MS = 15_000;

function buildUrl(base, path) {
  if (!base) throw new Error("Backend URL is not configured");
  return `${base.replace(/\/+$/, "")}${path}`;
}

async function postJson(url, body, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
      signal: controller.signal,
    });
    const text = await res.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; } catch { data = { detail: text }; }
    if (!res.ok) {
      const err = new Error(data?.detail || data?.message || `HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

/** Shape the invoice row into the exact body the backend expects. */
function toArchivePayload(inv) {
  return {
    invoice_number: inv.invoice_number,
    created_at: inv.created_at,
    customer_id: inv.customer_id || "",
    customer_name: inv.customer_name || "",
    cashier_id: inv.cashier_id || "",
    cashier_name: inv.cashier_name || "",
    payment_method: inv.payment_method || "cash",
    status: inv.status || "active",
    storno_of: inv.storno_of || null,
    storno_of_number: inv.storno_of_number || null,
    subtotal: Number(inv.subtotal || 0),
    discount: Number(inv.discount || 0),
    tax: Number(inv.tax || 0),
    total: Number(inv.total || 0),
    net_total: Number(inv.net_total || 0),
    vat_total: Number(inv.vat_total || 0),
    vat_breakdown: inv.vat_breakdown || [],
    items: (inv.items || []).map((it) => ({
      name: it.name,
      quantity: Number(it.quantity || 0),
      unit_price: Number(it.unit_price || 0),
      vat_rate: Number(it.vat_rate || 0),
      total: Number(it.total || 0),
    })),
    tse_status: inv.tse_status || "signed",
    tse_signature: inv.tse_signature || null,
    tse_serial: inv.tse_serial || null,
    tse_counter: inv.tse_counter ?? null,
    tse_timestamp: inv.tse_timestamp || null,
    tse_qr_code: inv.tse_qr_code || null,
  };
}

/**
 * Ship the invoice to the backend archive.
 * Returns { archive_status: "success", archived_at } on success.
 * Throws on any network / protocol failure — caller should catch and
 * mark the invoice as pending archive.
 */
export async function archiveInvoice(tseSettings, inv) {
  if (!tseSettings?.backend_url) {
    const err = new Error("Backend URL not set");
    err.code = "NO_BACKEND_URL";
    throw err;
  }
  return await postJson(
    buildUrl(tseSettings.backend_url, "/api/invoices/archive"),
    toArchivePayload(inv),
  );
}

export const ARCHIVE_STATUS = Object.freeze({
  NOT_REQUIRED: "not_required",  // TSE skipped / legacy invoice
  PENDING:      "pending",        // needs archiving (TSE signed but upload failed or not yet tried)
  ARCHIVED:     "archived",       // successfully persisted on backend
  FAILED:       "failed",         // terminal failure — manual intervention
});
