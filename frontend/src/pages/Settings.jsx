import { useEffect, useState, useRef } from "react";
import { api } from "../api";
import { useSettings } from "../context/SettingsContext";
import { useAuth } from "../context/AuthContext";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Sparkles, Upload, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function Settings() {
  const { settings, reload } = useSettings();
  const { user } = useAuth();
  const [form, setForm] = useState(settings);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    setForm(settings);
  }, [settings]);

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
      toast.error(e?.response?.data?.detail || "خطأ في الحفظ");
    } finally {
      setSaving(false);
    }
  };

  const removeLogo = () => setForm({ ...form, logo_url: "" });

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
          {saving ? "جاري الحفظ..." : "حفظ التغييرات"}
        </Button>
      </div>
    </div>
  );
}
