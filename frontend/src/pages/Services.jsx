import { useEffect, useState } from "react";
import { api, fmtEUR } from "../api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Plus, Pencil, Trash2, Scissors } from "lucide-react";
import { toast } from "sonner";

const empty = { name: "", category: "", duration_minutes: 30, price: 0, description: "" };

export default function Services() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);

  const load = async () => { const r = await api.get("/services"); setItems(r.data); };
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      const payload = { ...form, duration_minutes: Number(form.duration_minutes || 0), price: Number(form.price || 0) };
      if (editId) await api.put(`/services/${editId}`, payload);
      else await api.post("/services", payload);
      toast.success("تم الحفظ");
      setOpen(false); setForm(empty); setEditId(null); load();
    } catch (e) { toast.error(e?.response?.data?.detail || "خطأ"); }
  };
  const edit = (s) => { setForm(s); setEditId(s.id); setOpen(true); };
  const del = async (id) => {
    if (!window.confirm("حذف الخدمة؟")) return;
    try { await api.delete(`/services/${id}`); toast.success("تم الحذف"); load(); }
    catch (e) { toast.error(e?.response?.data?.detail || "خطأ"); }
  };

  return (
    <div data-testid="services-page">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-3xl md:text-4xl font-bold">الخدمات</h1>
          <p className="text-muted-foreground mt-1">إدارة خدمات الصالون والأسعار</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setForm(empty); setEditId(null); } }}>
          <DialogTrigger asChild><Button data-testid="add-service-button"><Plus size={16} className="ml-1" /> خدمة جديدة</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editId ? "تعديل خدمة" : "خدمة جديدة"}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>الاسم</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="service-name-input" /></div>
              <div><Label>الفئة</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
              <div><Label>المدة (دقائق)</Label><Input type="number" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} /></div>
              <div className="col-span-2"><Label>السعر</Label><Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} data-testid="service-price-input" /></div>
              <div className="col-span-2"><Label>الوصف</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            </div>
            <Button onClick={save} className="mt-4" data-testid="save-service-button">حفظ</Button>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.length === 0 && <div className="col-span-full text-center py-16 text-muted-foreground">لا توجد خدمات</div>}
        {items.map((s) => (
          <Card key={s.id} className="p-5 rounded-2xl card-ambient hover-lift" data-testid={`service-card-${s.id}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="w-12 h-12 rounded-xl bg-accent/20 text-accent-foreground flex items-center justify-center">
                <Scissors size={20} />
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => edit(s)}><Pencil size={14} /></Button>
                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => del(s.id)}><Trash2 size={14} /></Button>
              </div>
            </div>
            <h3 className="font-heading font-bold text-lg">{s.name}</h3>
            {s.category && <div className="text-xs text-muted-foreground mt-1">{s.category}</div>}
            {s.description && <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{s.description}</p>}
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
              <span className="text-xs text-muted-foreground">{s.duration_minutes} دقيقة</span>
              <span className="text-primary font-bold">{fmtEUR(s.price)}</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
