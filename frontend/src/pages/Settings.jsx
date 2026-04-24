import { useEffect, useState, useRef } from "react";
import { api } from "../api";
import { useSettings } from "../context/SettingsContext";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n/I18nContext";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../components/ui/alert-dialog";
import { Sparkles, Upload, Trash2, Download, CloudUpload, Database, Languages, Image as ImageIcon, UserCog, KeyRound, ShieldCheck, AlertTriangle, CheckCircle2, RefreshCw, Timer, PlayCircle } from "lucide-react";
import { testConnection as tseTestConnection, isTseConfigured } from "../services/tse";
import { toast } from "sonner";
import { exportBackup, restoreFromFile, runBackup } from "../services/backup";

export default function Settings() {
  const { settings, reload } = useSettings();
  const { user } = useAuth();
  const { t, lang, setLang } = useI18n();
  const [form, setForm] = useState(settings);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);
  const bgFileRef = useRef(null);
  const loginBgFileRef = useRef(null);
  const backupFileRef = useRef(null);
  const [pendingFile, setPendingFile] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Password change form state
  const [pwd, setPwd] = useState({ current_password: "", new_password: "", confirm: "" });
  const [savingPwd, setSavingPwd] = useState(false);

  // TSE / KassenSichV settings state
  const [tse, setTse] = useState({
    backend_url: "",
    provider: "fiskaly",
    environment: "sandbox",
    client_id: "",
    tss_id: "",
    cash_register_name: "Kasse-01",
    store_name: "Dalaa Beauty",
  });
  const [savingTse, setSavingTse] = useState(false);
  const [testingTse, setTestingTse] = useState(false);
  const [tseStatus, setTseStatus] = useState({ connected: null, latency_ms: null, error: null, checked_at: null });

  useEffect(() => {
    setForm(settings);
    if (settings?.tse) {
      setTse((prev) => ({ ...prev, ...settings.tse }));
    }
    if (settings?.backup) {
      setBackupCfg((prev) => ({ ...prev, ...settings.backup }));
    }
  }, [settings]);

  // Auto-backup state
  const [backupCfg, setBackupCfg] = useState({
    enabled: true,
    auto_interval_minutes: 60,
    folder_subpath: "Dalaa/Backups",
  });
  const [savingBackup, setSavingBackup] = useState(false);
  const [runningBackup, setRunningBackup] = useState(false);

  const isAdmin = user?.role === "admin";

  const onLogoPick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("حجم الصورة كبير، الحد الأقصى 2 ميجابايت");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm((f) => ({ ...f, logo_url: reader.result }));
      toast.success("تم اختيار الصورة — اضغط حفظ لتثبيتها");
    };
    reader.readAsDataURL(file);
  };

  const save = async () => {
    if (!isAdmin) return;
    setSaving(true);
    try {
      await api.put("/settings", form);
      await reload();
      toast.success("تم حفظ الإعدادات");
    } catch (e) {
      toast.error(e?.response?.data?.detail || (lang === "de" ? "Fehler beim Speichern" : "خطأ في الحفظ"));
    } finally {
      setSaving(false);
    }
  };

  const removeLogo = () => setForm({ ...form, logo_url: "" });

  const onBgPick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      toast.error(lang === "de" ? "Bild zu groß (max 4MB)" : "الصورة كبيرة، حد أقصى 4 ميجابايت");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm((f) => ({ ...f, background_url: reader.result }));
      toast.success(lang === "de" ? "Hintergrund ausgewählt — jetzt speichern" : "تم اختيار الخلفية — اضغط حفظ لتثبيتها");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const removeBg = () => setForm({ ...form, background_url: "" });

  const onLoginBgPick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      toast.error(lang === "de" ? "Bild zu groß (max 4MB)" : "الصورة كبيرة، حد أقصى 4 ميجابايت");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm((f) => ({ ...f, login_background_url: reader.result }));
      toast.success(lang === "de" ? "Login-Hintergrund ausgewählt — jetzt speichern" : "تم اختيار خلفية الدخول — اضغط حفظ لتثبيتها");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const removeLoginBg = () => setForm({ ...form, login_background_url: "" });

  return (
    <div data-testid="settings-page" className="max-w-3xl">
      <div className="mb-6">
        <h1 className="font-heading text-3xl md:text-4xl font-bold">الإعدادات</h1>
        <p className="text-muted-foreground mt-1">
          هذه المعلومات ستظهر في الشريط الجانبي وصفحة الدخول والفواتير المطبوعة
        </p>
      </div>

      {!isAdmin && (
        <Card className="p-4 rounded-xl bg-amber-50 border-amber-200 mb-4 text-sm">
          لا تملك صلاحية تعديل الإعدادات (يلزم حساب مدير)
        </Card>
      )}

      {/* Language selector */}
      <Card className="p-6 rounded-2xl card-ambient mb-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-accent/20 text-accent-foreground flex items-center justify-center">
            <Languages size={20} strokeWidth={1.75} />
          </div>
          <h3 className="font-heading font-bold text-lg">{t("set.language")}</h3>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={lang === "ar" ? "default" : "outline"}
            className="flex-1 h-12"
            onClick={() => setLang("ar")}
            data-testid="lang-select-ar"
          >
            🇸🇦 العربية
          </Button>
          <Button
            type="button"
            variant={lang === "de" ? "default" : "outline"}
            className="flex-1 h-12"
            onClick={() => setLang("de")}
            data-testid="lang-select-de"
          >
            🇩🇪 Deutsch
          </Button>
        </div>
      </Card>

      {/* Account & password */}
      <Card className="p-6 rounded-2xl card-ambient mb-5 space-y-4" data-testid="account-card">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <UserCog size={20} strokeWidth={1.75} />
          </div>
          <div>
            <h3 className="font-heading font-bold text-lg leading-tight">
              {lang === "de" ? "Mein Konto" : "حسابي"}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {lang === "de" ? "Benutzername und Passwort" : "اسم المستخدم وكلمة المرور"}
            </p>
          </div>
        </div>

        <div>
          <Label>{lang === "de" ? "Benutzername" : "اسم المستخدم"}</Label>
          <Input
            value={user?.email || ""}
            disabled
            readOnly
            className="font-mono"
            data-testid="account-username-display"
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            {lang === "de"
              ? "Der Benutzername ist fest und kann nicht geändert werden."
              : "اسم المستخدم ثابت ولا يمكن تعديله."}
          </p>
        </div>

        <div className="border-t border-border pt-4 mt-2">
          <div className="flex items-center gap-2 mb-3">
            <KeyRound size={16} className="text-accent" />
            <h4 className="font-heading font-bold text-base">
              {lang === "de" ? "Passwort ändern" : "تغيير كلمة المرور"}
            </h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>{lang === "de" ? "Aktuelles Passwort" : "كلمة المرور الحالية"}</Label>
              <Input
                type="password"
                value={pwd.current_password}
                onChange={(e) => setPwd({ ...pwd, current_password: e.target.value })}
                data-testid="current-password-input"
              />
            </div>
            <div>
              <Label>{lang === "de" ? "Neues Passwort" : "كلمة المرور الجديدة"}</Label>
              <Input
                type="password"
                value={pwd.new_password}
                onChange={(e) => setPwd({ ...pwd, new_password: e.target.value })}
                data-testid="new-password-input"
              />
            </div>
            <div>
              <Label>{lang === "de" ? "Bestätigen" : "تأكيد الجديدة"}</Label>
              <Input
                type="password"
                value={pwd.confirm}
                onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })}
                data-testid="confirm-password-input"
              />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4">
            <p className="text-[11px] text-muted-foreground">
              {lang === "de"
                ? "Passwort vergessen? Auf der Login-Seite zurücksetzen."
                : "نسيت كلمة المرور؟ استخدم \"نسيت كلمة المرور؟\" في صفحة الدخول لإعادة التعيين عبر حساب المستر."}
            </p>
            <Button
              type="button"
              variant="secondary"
              disabled={savingPwd}
              onClick={async () => {
                if (!pwd.current_password || !pwd.new_password) {
                  toast.error(lang === "de" ? "Alle Felder ausfüllen" : "أكمل الحقول");
                  return;
                }
                if (pwd.new_password !== pwd.confirm) {
                  toast.error(lang === "de" ? "Passwörter stimmen nicht überein" : "كلمتا المرور غير متطابقتين");
                  return;
                }
                if (pwd.new_password.length < 4) {
                  toast.error(lang === "de" ? "Neues Passwort zu kurz (min. 4 Zeichen)" : "كلمة المرور قصيرة (4 أحرف على الأقل)");
                  return;
                }
                setSavingPwd(true);
                try {
                  await api.post("/auth/change-password", {
                    current_password: pwd.current_password,
                    new_password: pwd.new_password,
                  });
                  setPwd({ current_password: "", new_password: "", confirm: "" });
                  toast.success(lang === "de" ? "Passwort geändert" : "تم تغيير كلمة المرور");
                } catch (e) {
                  toast.error(e?.response?.data?.detail || "Error");
                } finally {
                  setSavingPwd(false);
                }
              }}
              className="h-11"
              data-testid="save-password-button"
            >
              {savingPwd ? t("common.loading") : (lang === "de" ? "Passwort ändern" : "تغيير كلمة المرور")}
            </Button>
          </div>
        </div>
      </Card>

      {/* TSE / KassenSichV — German fiscal compliance */}
      <Card className="p-6 rounded-2xl card-ambient mb-5 space-y-4" data-testid="tse-card">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <ShieldCheck size={20} strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="font-heading font-bold text-lg leading-tight">
                TSE / KassenSichV
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                {lang === "de"
                  ? "Deutsche Kassensicherungsverordnung — TSE-Anbindung"
                  : "إعدادات الامتثال الضريبي الألماني (KassenSichV)"}
              </p>
            </div>
          </div>
          {/* Live connection status badge */}
          <div className="flex items-center gap-2">
            {isTseConfigured(tse) ? (
              tseStatus.connected === true ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 px-2.5 py-1 text-xs font-bold">
                  <CheckCircle2 size={12} /> {lang === "de" ? "Verbunden" : "متصل"}
                </span>
              ) : tseStatus.connected === false ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 text-rose-700 px-2.5 py-1 text-xs font-bold">
                  <AlertTriangle size={12} /> {lang === "de" ? "Nicht verbunden" : "غير متصل"}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-secondary text-muted-foreground px-2.5 py-1 text-xs font-bold">
                  {lang === "de" ? "Nicht geprüft" : "لم يُختبر بعد"}
                </span>
              )
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 px-2.5 py-1 text-xs font-bold">
                {lang === "de" ? "Nicht konfiguriert" : "غير مهيّأ"}
              </span>
            )}
          </div>
        </div>

        {/* Security disclosure */}
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-[11px] text-blue-900 leading-relaxed">
          🔒 {lang === "de"
            ? "Aus Sicherheitsgründen werden keine API-Secrets oder privaten Schlüssel lokal auf dem Gerät gespeichert. Die App spricht ausschließlich mit Ihrem Backend über HTTPS; Fiskaly-Zugangsdaten bleiben auf dem Backend."
            : "لأسباب أمنية، لا تُخزَّن مفاتيح API السرية أو الكلمات السرية داخل التطبيق. يتصل التطبيق فقط مع Backend الخاص بك عبر HTTPS، وتبقى بيانات Fiskaly السرية على الخادم."}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2">
            <Label>Backend API URL <span className="text-xs text-muted-foreground">(HTTPS)</span></Label>
            <Input
              type="url"
              placeholder="https://your-backend.example.com"
              value={tse.backend_url}
              onChange={(e) => setTse({ ...tse, backend_url: e.target.value })}
              autoCapitalize="none"
              spellCheck={false}
              data-testid="tse-backend-url-input"
            />
          </div>

          <div>
            <Label>{lang === "de" ? "TSE-Anbieter" : "مزوّد TSE"}</Label>
            <select
              value={tse.provider}
              onChange={(e) => setTse({ ...tse, provider: e.target.value })}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              data-testid="tse-provider-select"
            >
              <option value="fiskaly">Fiskaly</option>
            </select>
          </div>

          <div>
            <Label>Environment</Label>
            <select
              value={tse.environment}
              onChange={(e) => setTse({ ...tse, environment: e.target.value })}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              data-testid="tse-environment-select"
            >
              <option value="sandbox">Sandbox (Test)</option>
              <option value="production">Production</option>
            </select>
          </div>

          <div>
            <Label>Client ID</Label>
            <Input
              value={tse.client_id}
              onChange={(e) => setTse({ ...tse, client_id: e.target.value })}
              autoCapitalize="none"
              spellCheck={false}
              placeholder="e.g. 8a1c…"
              data-testid="tse-client-id-input"
            />
          </div>

          <div>
            <Label>TSS ID</Label>
            <Input
              value={tse.tss_id}
              onChange={(e) => setTse({ ...tse, tss_id: e.target.value })}
              autoCapitalize="none"
              spellCheck={false}
              placeholder="e.g. 4e9d…"
              data-testid="tse-tss-id-input"
            />
          </div>

          <div>
            <Label>{lang === "de" ? "Kassen-Name" : "اسم الكاشير"}</Label>
            <Input
              value={tse.cash_register_name}
              onChange={(e) => setTse({ ...tse, cash_register_name: e.target.value })}
              data-testid="tse-cash-register-input"
            />
          </div>

          <div>
            <Label>{lang === "de" ? "Filiale / Standort" : "اسم الفرع / المحل"}</Label>
            <Input
              value={tse.store_name}
              onChange={(e) => setTse({ ...tse, store_name: e.target.value })}
              data-testid="tse-store-name-input"
            />
          </div>
        </div>

        {/* Status read-outs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
          <div className="rounded-lg border border-border bg-secondary/30 p-2.5">
            <div className="text-muted-foreground">{lang === "de" ? "Letzte TSE-Signatur" : "آخر توقيع TSE"}</div>
            {settings?.tse?.last_signature_at ? (
              <div className="mt-0.5">
                <div className="font-mono font-bold">#{settings.tse.last_signature_counter ?? "—"}</div>
                <div className="text-muted-foreground">{new Date(settings.tse.last_signature_at).toLocaleString(lang === "de" ? "de-DE" : "ar-EG")}</div>
                {settings.tse.last_signature_serial && (
                  <div className="text-muted-foreground font-mono text-[10px] truncate">Serial: {settings.tse.last_signature_serial}</div>
                )}
              </div>
            ) : (
              <div className="text-muted-foreground mt-0.5">—</div>
            )}
          </div>
          <div className="rounded-lg border border-border bg-secondary/30 p-2.5">
            <div className="text-muted-foreground">{lang === "de" ? "Letzter TSE-Fehler" : "آخر خطأ TSE"}</div>
            {settings?.tse?.last_error ? (
              <div className="mt-0.5">
                <div className="text-rose-600 font-semibold text-[11px] break-words">{settings.tse.last_error}</div>
                {settings.tse.last_error_at && (
                  <div className="text-muted-foreground">{new Date(settings.tse.last_error_at).toLocaleString(lang === "de" ? "de-DE" : "ar-EG")}</div>
                )}
              </div>
            ) : (
              <div className="text-emerald-700 mt-0.5">✓ {lang === "de" ? "Keine Fehler" : "لا أخطاء"}</div>
            )}
          </div>
        </div>

        {tseStatus.error && (
          <div className="rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-700">
            <strong>{lang === "de" ? "Verbindungsfehler" : "فشل الاتصال"}:</strong> {tseStatus.error}
          </div>
        )}

        {tseStatus.connected === true && tseStatus.latency_ms != null && (
          <div className="text-[11px] text-emerald-700">
            ✓ {lang === "de" ? "Latenz" : "زمن الاستجابة"}: {tseStatus.latency_ms}ms
            {tseStatus.checked_at && <> — {new Date(tseStatus.checked_at).toLocaleTimeString(lang === "de" ? "de-DE" : "ar-EG")}</>}
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            className="h-11"
            disabled={testingTse || !tse.backend_url}
            onClick={async () => {
              setTestingTse(true);
              setTseStatus({ connected: null, latency_ms: null, error: null, checked_at: null });
              try {
                const r = await tseTestConnection(tse);
                setTseStatus({ connected: true, latency_ms: r.latency_ms ?? null, error: null, checked_at: new Date().toISOString() });
                toast.success(lang === "de" ? "TSE-Verbindung OK" : "الاتصال بـ TSE ناجح");
              } catch (err) {
                setTseStatus({ connected: false, latency_ms: null, error: err?.message || "Error", checked_at: new Date().toISOString() });
                toast.error(err?.message || "TSE test failed");
              } finally {
                setTestingTse(false);
              }
            }}
            data-testid="test-tse-connection-button"
          >
            <RefreshCw size={14} className={"mx-1 " + (testingTse ? "animate-spin" : "")} />
            {testingTse
              ? (lang === "de" ? "Prüft…" : "يختبر…")
              : (lang === "de" ? "Test TSE Connection" : "اختبار اتصال TSE")}
          </Button>

          <Button
            type="button"
            className="h-11"
            disabled={savingTse || !isAdmin}
            onClick={async () => {
              setSavingTse(true);
              try {
                await api.put("/settings", { tse: { ...(settings?.tse || {}), ...tse } });
                await reload();
                toast.success(lang === "de" ? "TSE-Einstellungen gespeichert" : "تم حفظ إعدادات TSE");
              } catch (err) {
                toast.error(err?.response?.data?.detail || "Error");
              } finally {
                setSavingTse(false);
              }
            }}
            data-testid="save-tse-button"
          >
            {savingTse ? t("common.loading") : (lang === "de" ? "TSE-Einstellungen speichern" : "حفظ إعدادات TSE")}
          </Button>
        </div>

        <div className="text-[10px] text-muted-foreground leading-relaxed border-t border-border pt-3 mt-1">
          {lang === "de"
            ? "Hinweis: Jede Rechnung wird bei aktiver TSE-Konfiguration zuerst vom Backend signiert. Schlägt die Signatur fehl, wird die Rechnung als \"Pending\" gespeichert und NICHT als rechtsgültiger Beleg ausgegeben."
            : "ملاحظة: عند تفعيل TSE، كل فاتورة تُرسَل أولاً إلى Backend للتوقيع. إذا فشل التوقيع، تُحفَظ كـ \"Pending\" فقط ولا تُعتبر فاتورة رسمية."}
        </div>
      </Card>

      {/* Logo upload */}
      <Card className="p-6 rounded-2xl card-ambient mb-5">
        <h3 className="font-heading font-bold text-lg mb-4">شعار المحل (اللوجو)</h3>
        <div className="flex items-center gap-5">
          <div className="w-24 h-24 rounded-2xl bg-secondary border border-border flex items-center justify-center overflow-hidden shrink-0">
            {form.logo_url ? (
              <img src={form.logo_url} alt="logo" className="w-full h-full object-cover" data-testid="current-logo-preview" />
            ) : (
              <Sparkles className="text-primary" size={32} />
            )}
          </div>
          <div className="flex-1">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={onLogoPick}
              className="hidden"
              data-testid="logo-file-input"
            />
            <div className="flex gap-2 flex-wrap">
              <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={!isAdmin} data-testid="upload-logo-button">
                <Upload size={14} className="ml-1" /> اختر صورة
              </Button>
              {form.logo_url && (
                <Button type="button" variant="ghost" className="text-destructive" onClick={removeLogo} disabled={!isAdmin}>
                  <Trash2 size={14} className="ml-1" /> إزالة
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              صيغ مدعومة: PNG / JPG / SVG — الحد الأقصى 2MB. يفضل صورة مربعة.
            </p>
          </div>
        </div>
      </Card>

      {/* Background upload */}
      <Card className="p-6 rounded-2xl card-ambient mb-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-accent/20 text-accent-foreground flex items-center justify-center">
            <ImageIcon size={20} strokeWidth={1.75} />
          </div>
          <h3 className="font-heading font-bold text-lg">
            {lang === "de" ? "App-Hintergrund" : "خلفية التطبيق"}
          </h3>
        </div>
        <div className="flex items-center gap-5">
          <div
            className="w-32 h-20 rounded-xl bg-secondary border border-border overflow-hidden shrink-0 bg-cover bg-center"
            style={form.background_url ? { backgroundImage: `url(${form.background_url})` } : {}}
            data-testid="current-bg-preview"
          >
            {!form.background_url && (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                <ImageIcon size={24} />
              </div>
            )}
          </div>
          <div className="flex-1">
            <input
              ref={bgFileRef}
              type="file"
              accept="image/*"
              onChange={onBgPick}
              className="hidden"
              data-testid="bg-file-input"
            />
            <div className="flex gap-2 flex-wrap">
              <Button type="button" variant="outline" className="h-10" onClick={() => bgFileRef.current?.click()} disabled={!isAdmin} data-testid="upload-bg-button">
                <Upload size={14} className="mx-1" /> {lang === "de" ? "Hintergrund wählen" : "اختر خلفية"}
              </Button>
              {form.background_url && (
                <Button type="button" variant="ghost" className="h-10 text-destructive" onClick={removeBg} disabled={!isAdmin}>
                  <Trash2 size={14} className="mx-1" /> {lang === "de" ? "Entfernen" : "إزالة"}
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              {lang === "de"
                ? "PNG / JPG — max 4 MB. Der Hintergrund wird mit geringer Opazität angezeigt, damit der Text lesbar bleibt."
                : "PNG / JPG — حد أقصى 4 ميجابايت. الخلفية تظهر بشفافية خفيفة للحفاظ على وضوح النصوص."}
            </p>
          </div>
        </div>
      </Card>

      {/* Login page background upload */}
      <Card className="p-6 rounded-2xl card-ambient mb-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-accent/20 text-accent-foreground flex items-center justify-center">
            <ImageIcon size={20} strokeWidth={1.75} />
          </div>
          <h3 className="font-heading font-bold text-lg">
            {lang === "de" ? "Login-Hintergrund" : "خلفية صفحة الدخول"}
          </h3>
        </div>
        <div className="flex items-center gap-5">
          <div
            className="w-32 h-20 rounded-xl bg-secondary border border-border overflow-hidden shrink-0 bg-cover bg-center"
            style={form.login_background_url ? { backgroundImage: `url(${form.login_background_url})` } : {}}
            data-testid="current-login-bg-preview"
          >
            {!form.login_background_url && (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                <ImageIcon size={24} />
              </div>
            )}
          </div>
          <div className="flex-1">
            <input
              ref={loginBgFileRef}
              type="file"
              accept="image/*"
              onChange={onLoginBgPick}
              className="hidden"
              data-testid="login-bg-file-input"
            />
            <div className="flex gap-2 flex-wrap">
              <Button type="button" variant="outline" className="h-10" onClick={() => loginBgFileRef.current?.click()} disabled={!isAdmin} data-testid="upload-login-bg-button">
                <Upload size={14} className="mx-1" /> {lang === "de" ? "Login-Hintergrund wählen" : "اختر خلفية الدخول"}
              </Button>
              {form.login_background_url && (
                <Button type="button" variant="ghost" className="h-10 text-destructive" onClick={removeLoginBg} disabled={!isAdmin}>
                  <Trash2 size={14} className="mx-1" /> {lang === "de" ? "Entfernen" : "إزالة"}
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              {lang === "de"
                ? "PNG / JPG — max 4 MB. Wird nur auf dem Login-Bildschirm als Hintergrund angezeigt."
                : "PNG / JPG — حد أقصى 4 ميجابايت. تُستخدم كخلفية لصفحة تسجيل الدخول فقط."}
            </p>
          </div>
        </div>
      </Card>

      {/* Basic info */}
      <Card className="p-6 rounded-2xl card-ambient mb-5 space-y-4">
        <h3 className="font-heading font-bold text-lg">معلومات المحل</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>اسم المحل</Label>
            <Input
              value={form.shop_name || ""}
              onChange={(e) => setForm({ ...form, shop_name: e.target.value })}
              disabled={!isAdmin}
              data-testid="shop-name-input"
            />
          </div>
          <div>
            <Label>الشعار الفرعي / العبارة</Label>
            <Input
              value={form.tagline || ""}
              onChange={(e) => setForm({ ...form, tagline: e.target.value })}
              disabled={!isAdmin}
              data-testid="tagline-input"
            />
          </div>
          <div>
            <Label>الهاتف</Label>
            <Input
              value={form.phone || ""}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              disabled={!isAdmin}
              data-testid="phone-input"
            />
          </div>
          <div>
            <Label>البريد الإلكتروني</Label>
            <Input
              value={form.email || ""}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              disabled={!isAdmin}
            />
          </div>
          <div className="md:col-span-2">
            <Label>العنوان</Label>
            <Input
              value={form.address || ""}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              disabled={!isAdmin}
              data-testid="address-input"
            />
          </div>
          <div>
            <Label>الرقم الضريبي (اختياري)</Label>
            <Input
              value={form.tax_id || ""}
              onChange={(e) => setForm({ ...form, tax_id: e.target.value })}
              disabled={!isAdmin}
            />
          </div>
        </div>

        <div>
          <Label>نص ذيل الفاتورة</Label>
          <Textarea
            rows={2}
            value={form.receipt_footer || ""}
            onChange={(e) => setForm({ ...form, receipt_footer: e.target.value })}
            disabled={!isAdmin}
          />
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving || !isAdmin} className="px-8 h-11" data-testid="save-settings-button">
          {saving ? t("set.saving") : t("set.save_changes")}
        </Button>
      </div>

      {/* Auto-Backup configuration (Master only — hidden from admin via route guard) */}
      <Card className="p-6 rounded-2xl card-ambient mt-8 space-y-4" data-testid="auto-backup-card">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-700 flex items-center justify-center">
            <Timer size={20} strokeWidth={1.75} />
          </div>
          <div>
            <h3 className="font-heading font-bold text-lg leading-tight">
              {lang === "de" ? "Automatische Sicherung" : "النسخ الاحتياطي التلقائي"}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {lang === "de" ? "Stündlich, nummeriert, lokal gespeichert" : "كل ساعة، رقم تسلسلي، حفظ محلي"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label>{lang === "de" ? "Aktiviert" : "تفعيل"}</Label>
            <select
              value={backupCfg.enabled ? "yes" : "no"}
              onChange={(e) => setBackupCfg({ ...backupCfg, enabled: e.target.value === "yes" })}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              data-testid="backup-enabled-select"
            >
              <option value="yes">{lang === "de" ? "Ein" : "مفعّل"}</option>
              <option value="no">{lang === "de" ? "Aus" : "متوقف"}</option>
            </select>
          </div>
          <div>
            <Label>{lang === "de" ? "Intervall (Minuten)" : "الفاصل الزمني (دقائق)"}</Label>
            <Input
              type="number" min="5"
              value={backupCfg.auto_interval_minutes}
              onChange={(e) => setBackupCfg({ ...backupCfg, auto_interval_minutes: Number(e.target.value) || 60 })}
              data-testid="backup-interval-input"
            />
          </div>
          <div>
            <Label>{lang === "de" ? "Ordner-Pfad" : "مسار مجلد النسخ"}</Label>
            <Input
              value={backupCfg.folder_subpath}
              onChange={(e) => setBackupCfg({ ...backupCfg, folder_subpath: e.target.value })}
              placeholder="Dalaa/Backups"
              autoCapitalize="none"
              spellCheck={false}
              data-testid="backup-folder-input"
            />
          </div>
        </div>

        <div className="text-[11px] text-muted-foreground leading-relaxed">
          {lang === "de"
            ? "Speicherort auf Android: interner App-Dokumentenordner. Der Pfad oben ist relativ dazu. Dateien werden automatisch mit fortlaufender Nummer benannt: backup_000001_YYYY-MM-DD_HH-MM.db."
            : "يُحفظ على Android داخل مجلد الوثائق الخاص بالتطبيق. المسار أعلاه نسبي داخله. الملفات تُسمى تلقائياً بصيغة: backup_000001_YYYY-MM-DD_HH-MM.db."}
        </div>

        {/* Last backup status read-out */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px]">
          <div className="rounded-lg border border-border bg-secondary/30 p-2.5">
            <div className="text-muted-foreground">{lang === "de" ? "Letzte Sicherung" : "آخر نسخة احتياطية"}</div>
            {settings?.backup?.last_at ? (
              <div className="mt-0.5">
                <div className="font-mono font-bold">#{String(settings.backup.last_number || 0).padStart(6, "0")}</div>
                <div className="text-muted-foreground">{new Date(settings.backup.last_at).toLocaleString(lang === "de" ? "de-DE" : "ar-EG")}</div>
                {settings.backup.last_filename && (
                  <div className="text-muted-foreground font-mono text-[10px] truncate">{settings.backup.last_filename}</div>
                )}
              </div>
            ) : <div className="text-muted-foreground mt-0.5">—</div>}
          </div>
          <div className="rounded-lg border border-border bg-secondary/30 p-2.5">
            <div className="text-muted-foreground">{lang === "de" ? "Status" : "الحالة"}</div>
            {settings?.backup?.last_status === "success" ? (
              <div className="mt-0.5 text-emerald-700 font-bold">✓ {lang === "de" ? "Erfolgreich" : "ناجحة"}</div>
            ) : settings?.backup?.last_status === "failed" ? (
              <div className="mt-0.5 text-rose-600 font-bold">✗ {lang === "de" ? "Fehlgeschlagen" : "فشلت"}</div>
            ) : (
              <div className="text-muted-foreground mt-0.5">—</div>
            )}
            {settings?.backup?.last_error && (
              <div className="text-rose-600 text-[10px] mt-0.5 break-words">{settings.backup.last_error}</div>
            )}
          </div>
          <div className="rounded-lg border border-border bg-secondary/30 p-2.5">
            <div className="text-muted-foreground">{lang === "de" ? "Letzte Auto-Sicherung" : "آخر نسخة تلقائية"}</div>
            <div className="mt-0.5 font-semibold">
              {settings?.backup?.last_auto_at
                ? new Date(settings.backup.last_auto_at).toLocaleString(lang === "de" ? "de-DE" : "ar-EG")
                : "—"}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            type="button"
            className="h-11"
            disabled={runningBackup}
            onClick={async () => {
              setRunningBackup(true);
              try {
                const r = await runBackup({ trigger: "manual", share: false });
                toast.success(
                  (lang === "de" ? "Sicherung #" : "نسخة احتياطية #") +
                  String(r.number).padStart(6, "0") +
                  " — " + r.records + (lang === "de" ? " Datensätze" : " سجل"),
                );
                await reload();
              } catch (e) {
                toast.error(e?.message || "Backup failed");
              } finally {
                setRunningBackup(false);
              }
            }}
            data-testid="backup-now-button"
          >
            <PlayCircle size={16} className="mx-1" />
            {runningBackup
              ? (lang === "de" ? "Sichert…" : "يُنشئ نسخة…")
              : (lang === "de" ? "Backup Now" : "نسخة احتياطية الآن")}
          </Button>

          <Button
            type="button"
            variant="outline"
            className="h-11"
            disabled={savingBackup}
            onClick={async () => {
              setSavingBackup(true);
              try {
                await api.put("/settings", { backup: { ...(settings?.backup || {}), ...backupCfg } });
                await reload();
                toast.success(lang === "de" ? "Backup-Einstellungen gespeichert" : "تم حفظ إعدادات النسخ الاحتياطي");
              } catch (e) {
                toast.error(e?.response?.data?.detail || "Error");
              } finally {
                setSavingBackup(false);
              }
            }}
            data-testid="save-backup-cfg-button"
          >
            {savingBackup ? t("common.loading") : (lang === "de" ? "Einstellungen speichern" : "حفظ الإعدادات")}
          </Button>
        </div>
      </Card>

      {/* Backup & Restore */}
      <Card className="p-6 rounded-2xl card-ambient mt-8 space-y-5" data-testid="backup-card">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Database size={20} strokeWidth={1.75} />
          </div>
          <div>
            <h3 className="font-heading font-bold text-lg leading-tight">النسخ الاحتياطي والاستعادة</h3>
            <p className="text-xs text-muted-foreground mt-1">احفظ بياناتك على Google Drive أو أي مكان آمن</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Button
            type="button"
            variant="outline"
            className="h-auto py-4 justify-start gap-3"
            disabled={exporting}
            onClick={async () => {
              setExporting(true);
              try {
                const res = await exportBackup();
                toast.success(`تم تصدير ${res.records} سجل — اختر "حفظ على Drive" من القائمة`);
              } catch (e) {
                toast.error(e?.message || "فشل التصدير");
              } finally {
                setExporting(false);
              }
            }}
            data-testid="export-backup-button"
          >
            <CloudUpload size={20} className="shrink-0 text-primary" />
            <div className="text-right">
              <div className="font-bold text-sm">{exporting ? t("common.loading") : t("backup.export")}</div>
              <div className="text-xs text-muted-foreground">JSON → Drive / Dropbox / Email</div>
            </div>
          </Button>

          <Button
            type="button"
            variant="outline"
            className="h-auto py-4 justify-start gap-3"
            onClick={() => backupFileRef.current?.click()}
            data-testid="import-backup-button"
          >
            <Download size={20} className="shrink-0 text-accent" />
            <div className="text-right">
              <div className="font-bold text-sm">استعادة نسخة احتياطية</div>
              <div className="text-xs text-muted-foreground">اختر ملف JSON من جهازك</div>
            </div>
          </Button>
          <input
            ref={backupFileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setPendingFile(f);
              e.target.value = "";
            }}
            data-testid="backup-file-input"
          />
        </div>

        <div className="text-xs text-muted-foreground bg-secondary/50 rounded-lg p-3 leading-relaxed">
          💡 {lang === "de"
            ? "Die Sicherung enthält: Produkte, Leistungen, Kunden, Termine, Rechnungen, Ausgaben, Benutzer & Einstellungen. Daten werden lokal gespeichert — regelmäßige Sicherung empfohlen."
            : "النسخة تحتوي على: كل المنتجات، الخدمات، العملاء، المواعيد، الفواتير، المصاريف، المستخدمين، وإعدادات المحل. البيانات محفوظة محلياً على الجهاز فقط — ننصح بأخذ نسخة احتياطية دورية."}
        </div>
      </Card>

      {/* Restore confirmation dialog */}
      <AlertDialog open={!!pendingFile} onOpenChange={(o) => { if (!o) setPendingFile(null); }}>        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading">⚠️ تأكيد الاستعادة</AlertDialogTitle>
            <AlertDialogDescription className="leading-relaxed">
              سيتم <b>مسح كل البيانات الحالية</b> واستبدالها ببيانات الملف:
              <br />
              <span className="font-mono text-xs text-foreground/80">{pendingFile?.name}</span>
              <br /><br />
              هل أنت متأكد من المتابعة؟ هذا الإجراء لا يمكن التراجع عنه.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="restore-cancel-button">إلغاء</AlertDialogCancel>
            <AlertDialogAction
              disabled={restoring}
              onClick={async (e) => {
                e.preventDefault();
                if (!pendingFile) return;
                setRestoring(true);
                try {
                  const res = await restoreFromFile(pendingFile);
                  toast.success(`تم استعادة ${res.records} سجل بنجاح`);
                  setPendingFile(null);
                  // Reload the app so every page re-fetches fresh data
                  setTimeout(() => window.location.reload(), 800);
                } catch (err) {
                  toast.error(err?.message || "فشل الاستعادة");
                } finally {
                  setRestoring(false);
                }
              }}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="restore-confirm-button"
            >
              {restoring ? t("common.loading") : (lang === "de" ? "Ja, Daten ersetzen" : "نعم، استبدل البيانات")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Designer credit footer */}
      <div className="mt-10 pt-6 border-t border-border text-center" data-testid="designer-credit">
        <div className="text-xs text-muted-foreground">
          {lang === "de" ? "Entwickelt von" : "تصميم وتطوير"}
        </div>
        <div className="font-heading font-bold text-base mt-1 text-primary">
          Bahaa Nasser
        </div>
      </div>
    </div>
  );
}
