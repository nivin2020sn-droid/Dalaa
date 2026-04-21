import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const { user, login } = useAuth();
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
      toast.success("أهلاً بك!");
      navigate("/dashboard");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "خطأ في تسجيل الدخول");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative"
      style={{
        backgroundImage:
          "linear-gradient(rgba(40,28,20,0.55), rgba(40,28,20,0.75)), url('https://images.pexels.com/photos/13068357/pexels-photo-13068357.jpeg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
      data-testid="login-page"
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 md:p-10 card-ambient animate-fadein">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
            <Sparkles size={22} />
          </div>
          <div>
            <div className="font-heading font-bold text-2xl leading-none">صالون</div>
            <div className="text-sm text-muted-foreground mt-1">نظام محاسبة التجميل</div>
          </div>
        </div>

        <h1 className="font-heading text-3xl font-bold mb-2">مرحباً بعودتك</h1>
        <p className="text-muted-foreground mb-8">سجّل دخولك للمتابعة إلى لوحة التحكم</p>

        <form onSubmit={handleSubmit} className="space-y-4" data-testid="login-form">
          <div>
            <Label htmlFor="email" className="text-sm mb-2 block">البريد الإلكتروني</Label>
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
            <Label htmlFor="password" className="text-sm mb-2 block">كلمة المرور</Label>
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
            {loading ? "جاري..." : "تسجيل الدخول"}
          </Button>
        </form>

        <div className="mt-6 pt-6 border-t border-border text-center text-xs text-muted-foreground">
          الحساب الافتراضي: <span className="font-mono">admin@salon.com</span> / <span className="font-mono">admin123</span>
        </div>
      </div>
    </div>
  );
}
