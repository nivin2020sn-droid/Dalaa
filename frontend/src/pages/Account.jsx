import { useState } from "react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n/I18nContext";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { UserCog, KeyRound } from "lucide-react";
import { toast } from "sonner";

export default function Account() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const [pwd, setPwd] = useState({ current_password: "", new_password: "", confirm: "" });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!pwd.current_password || !pwd.new_password) {
      toast.error(lang === "de" ? "Alle Felder ausfüllen" : "أكمل الحقول");
      return;
    }
    if (pwd.new_password !== pwd.confirm) {
      toast.error(lang === "de" ? "Passwörter stimmen nicht überein" : "كلمتا المرور غير متطابقتين");
      return;
    }
    if (pwd.new_password.length < 4) {
      toast.error(lang === "de" ? "Passwort zu kurz" : "كلمة المرور قصيرة (4 أحرف على الأقل)");
      return;
    }
    setSaving(true);
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
      setSaving(false);
    }
  };

  return (
    <div data-testid="account-page" className="max-w-2xl">
      <h1 className="font-heading text-3xl md:text-4xl font-bold mb-6">
        {lang === "de" ? "Mein Konto" : "حسابي"}
      </h1>

      <Card className="p-6 rounded-2xl card-ambient space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <UserCog size={20} strokeWidth={1.75} />
          </div>
          <div>
            <div className="font-heading font-bold text-lg leading-tight">{user?.name}</div>
            <p className="text-xs text-muted-foreground mt-1">{user?.role === "master" ? "Master Developer" : (lang === "de" ? "Administrator" : "مدير")}</p>
          </div>
        </div>

        <div>
          <Label>{lang === "de" ? "Benutzername" : "اسم المستخدم"}</Label>
          <Input value={user?.email || ""} disabled readOnly className="font-mono" data-testid="account-username-display" />
          <p className="text-[11px] text-muted-foreground mt-1">
            {lang === "de" ? "Der Benutzername ist fest und kann nicht geändert werden." : "اسم المستخدم ثابت ولا يمكن تعديله."}
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
              <Input type="password" value={pwd.current_password} onChange={(e) => setPwd({ ...pwd, current_password: e.target.value })} data-testid="current-password-input" />
            </div>
            <div>
              <Label>{lang === "de" ? "Neues Passwort" : "كلمة المرور الجديدة"}</Label>
              <Input type="password" value={pwd.new_password} onChange={(e) => setPwd({ ...pwd, new_password: e.target.value })} data-testid="new-password-input" />
            </div>
            <div>
              <Label>{lang === "de" ? "Bestätigen" : "تأكيد"}</Label>
              <Input type="password" value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} data-testid="confirm-password-input" />
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <Button type="button" variant="secondary" disabled={saving} onClick={handleSave} className="h-11" data-testid="save-password-button">
              {saving ? t("common.loading") : (lang === "de" ? "Passwort ändern" : "تغيير كلمة المرور")}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
