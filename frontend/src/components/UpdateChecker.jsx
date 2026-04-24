import { useEffect, useState } from "react";
import { useSettings } from "../context/SettingsContext";
import { useI18n } from "../i18n/I18nContext";
import { Button } from "./ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import {
  APP_VERSION,
  checkForUpdate,
  getSkippedVersion,
  openDownload,
  skipVersion,
} from "../services/updater";
import { Download, RefreshCw } from "lucide-react";

/**
 * App-wide update prompter. Mounted once (in App.js) — runs a single
 * background check on boot when the user has configured an update URL,
 * and shows a non-blocking dialog if a newer APK is available.
 */
export default function UpdateChecker() {
  const { settings } = useSettings();
  const { lang } = useI18n();
  const [info, setInfo] = useState(null); // { manifest, latest } when prompted

  useEffect(() => {
    if (!settings?.update_url) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await checkForUpdate(settings.update_url);
        if (cancelled) return;
        if (!r.available) return;
        const skipped = getSkippedVersion();
        if (skipped && skipped === r.latest && !r.manifest.mandatory) return;
        setInfo(r);
      } catch (e) {
        // Soft-fail: never block the app on a missing/invalid update URL.
        console.warn("Update check failed:", e?.message);
      }
    })();
    return () => { cancelled = true; };
  }, [settings?.update_url]);

  if (!info) return null;
  const m = info.manifest;
  const notes = (lang === "de" ? m.notes_de : m.notes_ar) || m.notes_de || m.notes_ar || "";
  const mandatory = !!m.mandatory;

  return (
    <AlertDialog open onOpenChange={(o) => { if (!o && !mandatory) setInfo(null); }}>
      <AlertDialogContent data-testid="update-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-heading flex items-center gap-2">
            <Download size={18} className="text-primary" />
            {lang === "de" ? "Update verfügbar" : "تحديث متاح"}
          </AlertDialogTitle>
          <AlertDialogDescription className="leading-relaxed space-y-2">
            <div>
              {lang === "de" ? "Aktuelle Version" : "النسخة الحالية"}:{" "}
              <b className="font-mono">{APP_VERSION}</b>
              {" → "}
              {lang === "de" ? "Neue Version" : "النسخة الجديدة"}:{" "}
              <b className="font-mono text-primary">{info.latest}</b>
            </div>
            {notes && (
              <div className="text-sm whitespace-pre-line bg-secondary/40 border border-border rounded-md p-2">
                {notes}
              </div>
            )}
            <div className="text-xs text-muted-foreground">
              {lang === "de"
                ? "Beim Update wird die APK über den Download-Manager heruntergeladen. Ihre Daten bleiben erhalten."
                : "سيتم تنزيل ملف APK عبر مدير التنزيل. لن تُفقَد بياناتك."}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {!mandatory && (
            <AlertDialogCancel
              data-testid="update-skip-button"
              onClick={() => { skipVersion(info.latest); setInfo(null); }}
            >
              {lang === "de" ? "Diese Version überspringen" : "تخطّي هذه النسخة"}
            </AlertDialogCancel>
          )}
          <AlertDialogAction
            onClick={() => {
              openDownload(m.apk_url);
              if (!mandatory) setInfo(null);
            }}
            data-testid="update-download-button"
          >
            <Download size={14} className="mx-1" />
            {lang === "de" ? "Jetzt herunterladen" : "تنزيل الآن"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Tiny "Check for updates" button that admins can place on Settings/Account.
 * It performs a one-shot manual check and surfaces success/failure via
 * `setInfo` (caller-managed) — kept here for code reuse.
 */
export function ManualUpdateCheckButton({ onResult }) {
  const { settings } = useSettings();
  const { lang } = useI18n();
  const [busy, setBusy] = useState(false);

  return (
    <Button
      type="button"
      variant="outline"
      className="h-11"
      disabled={busy || !settings?.update_url}
      onClick={async () => {
        setBusy(true);
        try {
          const r = await checkForUpdate(settings.update_url);
          onResult?.(r);
        } catch (e) {
          onResult?.({ error: e?.message || "Error" });
        } finally {
          setBusy(false);
        }
      }}
      data-testid="check-update-button"
    >
      <RefreshCw size={14} className={"mx-1 " + (busy ? "animate-spin" : "")} />
      {busy
        ? (lang === "de" ? "Prüft…" : "جاري التحقق…")
        : (lang === "de" ? "Auf Updates prüfen" : "البحث عن تحديثات")}
    </Button>
  );
}
