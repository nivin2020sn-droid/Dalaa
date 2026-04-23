import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import { useI18n } from "../i18n/I18nContext";
import { api } from "../api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Sparkles, Languages, KeyRound } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const { user, login } = useAuth();
  const { settings } = useSettings();
  const { t, lang, setLang } = useI18n();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Forgot-password (master-reset) dialog state
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetForm, setResetForm] = useState({
    target_username: "",
    master_username: "",
    master_password: "",
    new_password: "",
    confirm: "",
  });

  if (user) return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(username, password);
      toast.success(lang === "de" ? "Willkommen!" : "أهلاً بك!");
      navigate("/dashboard");
    } catch (err) {
      toast.error(err?.response?.data?.detail || t("auth.invalid"));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!resetForm.target_username) {
      toast.error(lang === "de" ? "Benutzername erforderlich" : "اسم الحساب مطلوب");
      return;
    }
    if (resetForm.new_password !== resetForm.confirm) {
      toast.error(lang === "de" ? "Passwörter stimmen nicht überein" : "كلمتا المرور غير متطابقتين");
      return;
    }
    if (!resetForm.new_password || resetForm.new_password.length < 4) {
      toast.error(lang === "de" ? "Passwort zu kurz" : "كلمة المرور قصيرة (4 أحرف على الأقل)");
      return;
    }
    setResetting(true);
    try {
      await api.post("/auth/reset-with-master", {
        master_username: resetForm.master_username,
        master_password: resetForm.master_password,
        target_username: resetForm.target_username,
        new_password: resetForm.new_password,
      });
      toast.success(lang === "de" ? "Passwort zurückgesetzt — jetzt einloggen" : "تم تعيين كلمة المرور — سجّل الدخول الآن");
      setUsername(resetForm.target_username);
      setPassword("");
      setResetOpen(false);
      setResetForm({
        target_username: "",
        master_username: "",
        master_password: "",
        new_password: "",
        confirm: "",
      });
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Error");
    } finally {
      setResetting(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative"
      style={{
        backgroundImage:
          "linear-gradient(rgba(55,20,65,0.6), rgba(90,30,75,0.75)), url('https://images.pexels.com/photos/13068357/pexels-photo-13068357.jpeg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
      data-testid="login-page"
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 md:p-10 card-ambient animate-fadein">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center overflow-hidden">
            {settings.logo_url ? (
              <img src={settings.logo_url} alt={settings.shop_name} className="w-full h-full object-cover" />
            ) : (
              <Sparkles size={22} />
            )}
          </div>
          <div>
            <div className="font-heading font-bold text-2xl leading-none">{settings.shop_name}</div>
            <div className="text-sm text-muted-foreground mt-1">{settings.tagline}</div>
          </div>
        </div>

        <h1 className="font-heading text-3xl font-bold mb-2">{t("auth.welcome")}</h1>
        <p className="text-muted-foreground mb-8">{t("auth.subtitle")}</p>

        <form onSubmit={handleSubmit} className="space-y-4" data-testid="login-form">
          <div>
            <Label htmlFor="username" className="text-sm mb-2 block">
              {lang === "de" ? "Benutzername" : "اسم المستخدم"}
            </Label>
            <Input
              id="username"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="h-11"
              required
              data-testid="login-username-input"
            />
          </div>
          <div>
            <Label htmlFor="password" className="text-sm mb-2 block">{lang === "de" ? "Passwort" : "كلمة المرور"}</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11"
              required
              data-testid="login-password-input"
            />
          </div>
          <Button
            type="submit"
            className="w-full h-11 font-bold"
            disabled={loading}
            data-testid="login-submit-button"
          >
            {loading ? t("auth.logging_in") : t("auth.login")}
          </Button>
        </form>

        <div className="mt-6 pt-6 border-t border-border flex items-center justify-between gap-3 text-xs">
          <button
            type="button"
            onClick={() => setResetOpen(true)}
            className="text-primary hover:underline font-bold"
            data-testid="forgot-password-button"
          >
            {lang === "de" ? "Passwort vergessen?" : "نسيت كلمة المرور؟"}
          </button>
          <Button type="button" variant="ghost" size="sm" className="shrink-0 h-9" onClick={() => setLang(lang === "ar" ? "de" : "ar")} data-testid="login-lang-toggle">
            <Languages size={14} className="mx-1" /> {lang === "ar" ? "DE" : "AR"}
          </Button>
        </div>
      </div>

      {/* Forgot password / master reset dialog */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent data-testid="master-reset-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              <KeyRound size={18} className="text-primary" />
              {lang === "de" ? "Passwort mit Master-Konto zurücksetzen" : "إعادة تعيين كلمة المرور عبر حساب المستر"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground leading-relaxed bg-secondary/60 rounded-lg p-3">
              {lang === "de"
                ? "Geben Sie Ihre Master-Anmeldedaten ein, um das Passwort des angegebenen Kontos zurückzusetzen."
                : "أدخل بيانات حساب المستر لإعادة تعيين كلمة المرور للحساب المطلوب."}
            </div>
            <div>
              <Label>{lang === "de" ? "Konto, dessen Passwort zurückgesetzt wird" : "اسم الحساب المطلوب إعادة تعيين كلمة مروره"}</Label>
              <Input
                value={resetForm.target_username}
                onChange={(e) => setResetForm({ ...resetForm, target_username: e.target.value })}
                placeholder="dalaa-beauty"
                autoCapitalize="none"
                spellCheck={false}
                data-testid="reset-target-input"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>{lang === "de" ? "Master-Benutzername" : "اسم المستخدم للماستر"}</Label>
                <Input
                  type="text"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={resetForm.master_username}
                  onChange={(e) => setResetForm({ ...resetForm, master_username: e.target.value })}
                  data-testid="reset-master-username-input"
                />
              </div>
              <div>
                <Label>{lang === "de" ? "Master-Passwort" : "كلمة مرور الماستر"}</Label>
                <Input
                  type="password"
                  value={resetForm.master_password}
                  onChange={(e) => setResetForm({ ...resetForm, master_password: e.target.value })}
                  data-testid="reset-master-password-input"
                />
              </div>
              <div>
                <Label>{lang === "de" ? "Neues Passwort" : "كلمة المرور الجديدة"}</Label>
                <Input
                  type="password"
                  value={resetForm.new_password}
                  onChange={(e) => setResetForm({ ...resetForm, new_password: e.target.value })}
                  data-testid="reset-new-password-input"
                />
              </div>
              <div>
                <Label>{lang === "de" ? "Bestätigen" : "تأكيد كلمة المرور"}</Label>
                <Input
                  type="password"
                  value={resetForm.confirm}
                  onChange={(e) => setResetForm({ ...resetForm, confirm: e.target.value })}
                  data-testid="reset-confirm-password-input"
                />
              </div>
            </div>
            <Button
              type="button"
              onClick={handleReset}
              disabled={resetting}
              className="w-full h-11 font-bold"
              data-testid="reset-submit-button"
            >
              {resetting
                ? t("common.loading")
                : (lang === "de" ? "Passwort zurücksetzen" : "إعادة تعيين كلمة المرور")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
