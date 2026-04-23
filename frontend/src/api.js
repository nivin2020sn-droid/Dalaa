import { router } from "./services/router";
import { seedOnce } from "./db/seed";

// Ensure the local database is seeded before any API call runs.
const readyPromise = seedOnce().catch((e) =>
  console.error("DB seed error:", e),
);

/**
 * Axios-compatible facade that routes all `/api/*` calls to the in-app
 * local router instead of a remote server. Kept as `api` so the rest of
 * the frontend code (pages/contexts) works without modification.
 */
async function wrap(fn) {
  await readyPromise;
  try {
    const data = await fn();
    return { data, status: 200 };
  } catch (err) {
    if (err.response) throw err; // already shaped
    const shaped = new Error(err.message || "Unknown error");
    shaped.response = { status: 500, data: { detail: err.message } };
    throw shaped;
  }
}

export const api = {
  get: (path) => wrap(() => router.get(path)),
  post: (path, body) => wrap(() => router.post(path, body)),
  put: (path, body) => wrap(() => router.put(path, body)),
  delete: (path) => wrap(() => router.delete(path)),
};

// Legacy export kept for any components that might import API directly.
export const API = "/local-api";

// ---------- i18n-safe formatters (unchanged from before) ----------
export const fmtEUR = (n) => {
  const v = Number(n || 0);
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(v);
};

export const fmtDate = (iso) => {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("ar-EG", {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
};
