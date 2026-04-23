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
import { Sparkles, Upload, Trash2, Download, CloudUpload, Database, Languages, Image as ImageIcon, UserCog, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { exportBackup, restoreFromFile } from "../services/backup";

export default function Settings() {
  const { settings, reload } = useSettings();
  const { user, setUser } = useAuth();
  const { t, lang, setLang } = useI18n();
  const [form, setForm] = useState(settings);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);
  const bgFileRef = useRef(null);
  const backupFileRef = useRef(null);
  const [pendingFile, setPendingFile] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Account (profile + password) state
  const [account, setAccount] = useState({ name: "", email: "" });
  const [pwd, setPwd] = useState({ current_password: "", new_password: "", confirm: "" });
  const [savingAccount, setSavingAccount] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  useEffect(() => {
    if (user) setAccount({ name: user.name || "", email: user.email || "" });
  }, [user]);

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
              {lang === "de" ? "Name, E-Mail und Passwort aktualisieren" : "تعديل الاسم والبريد وكلمة المرور"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>{lang === "de" ? "Name" : "الاسم"}</Label>
            <Input
              value={account.name}
              onChange={(e) => setAccount({ ...account, name: e.target.value })}
              data-testid="account-name-input"
            />
          </div>
          <div>
            <Label>{lang === "de" ? "E-Mail (Login)" : "البريد الإلكتروني (للدخول)"}</Label>
            <Input
              type="email"
              value={account.email}
              onChange={(e) => setAccount({ ...account, email: e.target.value })}
              data-testid="account-email-input"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            type="button"
            disabled={savingAccount}
            onClick={async () => {
              if (!account.email || !account.name) {
                toast.error(lang === "de" ? "Name und E-Mail erforderlich" : "الاسم والبريد مطلوبان");
                return;
              }
              setSavingAccount(true);
              try {
                const r = await api.put("/auth/profile", account);
                setUser(r.data);
                toast.success(lang === "de" ? "Konto aktualisiert" : "تم تحديث الحساب");
              } catch (e) {
                toast.error(e?.response?.data?.detail || "Error");
              } finally {
                setSavingAccount(false);
              }
            }}
            className="h-11"
            data-testid="save-account-button"
          >
            {savingAccount ? t("common.loading") : (lang === "de" ? "Konto speichern" : "حفظ الحساب")}
          </Button>
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
          <div className="flex justify-end mt-4">
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
