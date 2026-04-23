import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import { useI18n } from "../i18n/I18nContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Sparkles, Languages } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const { user, login } = useAuth();
  const { settings } = useSettings();
  const { t, lang, setLang } = useI18n();
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@salon.com");
  const [password, setPassword] = useState("admin123");
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success(lang === "de" ? "Willkommen!" : "أهلاً بك!");
      navigate("/dashboard");
    } catch (err) {
      toast.error(err?.response?.data?.detail || t("auth.invalid"));
    } finally {
      setLoading(false);
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
            <Label htmlFor="email" className="text-sm mb-2 block">{t("common.email")}</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11"
              required
              data-testid="login-email-input"
            />
          </div>
          <div>
            <Label htmlFor="password" className="text-sm mb-2 block">{lang === "de" ? "Passwort" : "كلمة المرور"}</Label>
            <Input
              id="password"
              type="password"
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
          <span className="text-muted-foreground">
            {t("auth.default_hint")}: <span className="font-mono">admin@salon.com</span> / <span className="font-mono">admin123</span>
          </span>
          <Button type="button" variant="ghost" size="sm" className="shrink-0 h-9" onClick={() => setLang(lang === "ar" ? "de" : "ar")} data-testid="login-lang-toggle">
            <Languages size={14} className="mx-1" /> {lang === "ar" ? "DE" : "AR"}
          </Button>
        </div>
      </div>
    </div>
  );
}
