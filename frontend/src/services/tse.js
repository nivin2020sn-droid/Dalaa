/**
 * TSE / KassenSichV client.
 *
 * ⚠️ IMPORTANT — Security boundary
 * --------------------------------
 * This module NEVER stores, reads, or transmits the Fiskaly `api_secret`
 * or any other TSE provider credential. Those MUST live only on the
 * backend (Railway / Vercel / any trusted server).
 *
 * The Android APK only holds:
 *   - The public Backend URL (HTTPS).
 *   - Non-secret identifiers: Client ID, TSS ID, cash-register name.
 *
 * The Backend is responsible for:
 *   - Holding FISKALY_API_KEY / FISKALY_API_SECRET in its env vars.
 *   - Exchanging those with Fiskaly to obtain a short-lived access token.
 *   - Calling Fiskaly's /tss/{id}/tx endpoints.
 *   - Returning the signature, counter, timestamp, serial and QR payload
 *     that this app embeds into the invoice.
 *
 * Expected Backend contract (implement it later on your server):
 *
 *   GET  {backend_url}/api/tse/health                       → 200 {ok:true, tss_id, client_id, environment}
 *   POST {backend_url}/api/tse/sign        (body: invoice)  → 200 {signature, serial, counter, timestamp, qr_code}
 *   POST {backend_url}/api/tse/storno      (body: invoice)  → 200 {signature, serial, counter, timestamp, qr_code}
 *   GET  {backend_url}/api/tse/export-dsfinvk?from=...&to=... → 200 application/zip (DSFinV-K archive)
 *
 * The body that the app sends to /sign:
 *   {
 *     tss_id:            string,   // from the app settings
 *     client_id:         string,
 *     cash_register:     string,
 *     invoice_number:    string,
 *     timestamp_client:  ISO-string,
 *     payment_method:    "cash" | "card" | "transfer",
 *     totals: {
 *       gross:   number,
 *       net:     number,
 *       vat:     number,
 *       by_rate: [{rate, net, vat, gross}]
 *     },
 *     items: [...]  // full line items
 *   }
 */

const DEFAULT_TIMEOUT_MS = 15_000;

function buildUrl(base, path) {
  if (!base) throw new Error("Backend URL is not configured");
  const b = base.replace(/\/+$/, "");
  return `${b}${path}`;
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
      err.data = data;
      throw err;
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

async function getJson(url, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: "GET", signal: controller.signal });
    const text = await res.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; } catch { data = { detail: text }; }
    if (!res.ok) {
      const err = new Error(data?.detail || data?.message || `HTTP ${res.status}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Hit the backend's health endpoint and return a summary.
 * Returns: { ok, tss_id, client_id, environment, latency_ms }
 * Throws a readable Error on any network / protocol failure.
 */
export async function testConnection(tseSettings) {
  if (!tseSettings?.backend_url) {
    const err = new Error("Backend URL not set");
    err.code = "NO_BACKEND_URL";
    throw err;
  }
  if (!/^https:\/\//i.test(tseSettings.backend_url)) {
    const err = new Error("Backend URL must use HTTPS");
    err.code = "INSECURE_URL";
    throw err;
  }
  const started = Date.now();
  const data = await getJson(buildUrl(tseSettings.backend_url, "/api/tse/health"));
  return { ...data, latency_ms: Date.now() - started };
}

/**
 * Sign a new invoice via the backend → Fiskaly TSE.
 * Called synchronously inside createInvoice() BEFORE the invoice is persisted.
 * On success returns the TSE envelope to be stored with the invoice.
 * On failure throws — invoice will be saved as tse_status="pending".
 */
export async function signInvoice(tseSettings, invoicePayload) {
  if (!tseSettings?.backend_url) {
    const err = new Error("TSE backend URL not configured");
    err.code = "NO_BACKEND_URL";
    throw err;
  }
  return await postJson(
    buildUrl(tseSettings.backend_url, "/api/tse/sign"),
    {
      tss_id: tseSettings.tss_id || "",
      client_id: tseSettings.client_id || "",
      cash_register: tseSettings.cash_register_name || "",
      store: tseSettings.store_name || "",
      environment: tseSettings.environment || "sandbox",
      ...invoicePayload,
    },
  );
}

/**
 * Sign a storno (reverse) invoice. Same contract as /sign but backend
 * should mark the TSE transaction as a reversal referencing the original.
 */
export async function signStorno(tseSettings, invoicePayload) {
  if (!tseSettings?.backend_url) {
    const err = new Error("TSE backend URL not configured");
    err.code = "NO_BACKEND_URL";
    throw err;
  }
  return await postJson(
    buildUrl(tseSettings.backend_url, "/api/tse/storno"),
    {
      tss_id: tseSettings.tss_id || "",
      client_id: tseSettings.client_id || "",
      cash_register: tseSettings.cash_register_name || "",
      environment: tseSettings.environment || "sandbox",
      ...invoicePayload,
    },
  );
}

/**
 * Returns true if TSE integration has been configured on this device
 * (backend URL + TSS ID + Client ID). Used to decide whether invoices
 * must be signed at point of sale or can skip TSE entirely.
 */
export function isTseConfigured(tseSettings) {
  if (!tseSettings) return false;
  return Boolean(
    tseSettings.backend_url &&
    tseSettings.tss_id &&
    tseSettings.client_id,
  );
}

export const TSE_STATUS = Object.freeze({
  NOT_REQUIRED: "not_required", // pre-TSE invoices / TSE disabled
  SIGNED:       "signed",        // TSE signed successfully
  PENDING:      "pending",       // save attempt failed — awaiting retry
  FAILED:       "failed",        // permanent failure — do not treat as final
});
