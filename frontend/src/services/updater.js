/**
 * In-app APK updater.
 *
 * Fetches a public `update.json` (typically a GitHub `raw` URL) and compares
 * the version found there with the embedded app version. When a newer
 * version is available, the caller can prompt the user to download and
 * install the new APK manually. IndexedDB is preserved on update because
 * Android upgrades the app in-place when the package name and signing key
 * match between APK builds.
 *
 * Expected `update.json` shape:
 *   {
 *     "version": "1.2.0",
 *     "apk_url": "https://github.com/.../releases/download/v1.2.0/app.apk",
 *     "mandatory": false,
 *     "notes_de": "Neue Funktionen…",
 *     "notes_ar": "…",
 *     "min_supported_version": "1.0.0"   // optional
 *   }
 */

import packageJson from "../../package.json";

export const APP_VERSION = packageJson.version || "0.0.0";

const FETCH_TIMEOUT_MS = 10_000;

/** Compare two semver-ish version strings: returns -1 / 0 / 1. */
export function compareVersions(a, b) {
  const pa = String(a || "0").split(/[.\-+]/).map((x) => parseInt(x, 10) || 0);
  const pb = String(b || "0").split(/[.\-+]/).map((x) => parseInt(x, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

/**
 * Fetch the manifest. Throws a readable error on network / parse failure.
 * Returns the parsed JSON.
 */
export async function fetchManifest(updateUrl) {
  if (!updateUrl) {
    const err = new Error("Update URL is not configured");
    err.code = "NO_UPDATE_URL";
    throw err;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    // Cache-buster prevents stale GitHub raw caches.
    const url = updateUrl + (updateUrl.includes("?") ? "&" : "?") + "_=" + Date.now();
    const res = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      throw new Error("HTTP " + res.status + " — " + (res.statusText || "fetch failed"));
    }
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("Invalid update.json (not valid JSON)");
    }
    if (!data || typeof data !== "object") throw new Error("Empty manifest");
    if (!data.version) throw new Error("Manifest missing 'version'");
    if (!data.apk_url) throw new Error("Manifest missing 'apk_url'");
    return data;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * One-shot check. Returns:
 *   { available: boolean, current, latest, manifest }
 */
export async function checkForUpdate(updateUrl) {
  const manifest = await fetchManifest(updateUrl);
  const current = APP_VERSION;
  const latest = manifest.version;
  const available = compareVersions(current, latest) < 0;
  return { available, current, latest, manifest };
}

/**
 * Persist the version string the user has chosen to skip, so we don't keep
 * nagging them on every launch for the same release.
 */
const SKIP_KEY = "salon_skip_update_version";

export function getSkippedVersion() {
  try {
    return localStorage.getItem(SKIP_KEY) || "";
  } catch {
    return "";
  }
}

export function skipVersion(version) {
  try {
    localStorage.setItem(SKIP_KEY, version || "");
  } catch {
    /* ignore */
  }
}

/**
 * Open the APK download URL in an external browser/Chrome-Custom-Tab. On
 * Android Capacitor, `window.open(url, "_blank")` triggers the system
 * browser, which delegates the .apk to Android's Download Manager. On the
 * web preview, it just opens a new tab.
 */
export function openDownload(apkUrl) {
  if (!apkUrl) return;
  try {
    window.open(apkUrl, "_blank", "noopener,noreferrer");
  } catch {
    window.location.href = apkUrl;
  }
}
