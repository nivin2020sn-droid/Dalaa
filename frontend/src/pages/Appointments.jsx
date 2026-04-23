import { useEffect, useState } from "react";
import { api } from "../api";
import { useI18n } from "../i18n/I18nContext";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Plus, Pencil, Trash2, Clock } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "../components/ui/badge";

const empty = {
  customer_id: "", customer_name: "", service_id: "", service_name: "",
  date: new Date().toISOString().split("T")[0], time: "10:00", status: "pending", notes: "",
};

const statusClass = {
  pending: "bg-amber-100 text-amber-700",
  confirmed: "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-rose-100 text-rose-700",
};

export default function Appointments() {
  const { t, lang } = useI18n();
  const [items, setItems] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [services, setServices] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);

  const load = async () => {
    const [a, c, s] = await Promise.all([api.get("/appointments"), api.get("/customers"), api.get("/services")]);
    setItems(a.data.sort((x, y) => (x.date + x.time).localeCompare(y.date + y.time)));
    setCustomers(c.data); setServices(s.data);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      if (!form.customer_name || !form.service_name) {
        toast.error(lang === "de" ? "Felder fehlen" : "أكمل الحقول");
        return;
      }
      if (editId) await api.put(`/appointments/${editId}`, form);
      else await api.post("/appointments", form);
      toast.success(lang === "de" ? "Gespeichert" : "تم الحفظ");
      setOpen(false); setForm(empty); setEditId(null); load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Error"); }
  };
  const edit = (a) => { setForm(a); setEditId(a.id); setOpen(true); };
  const del = async (id) => {
    if (!window.confirm(lang === "de" ? "Termin löschen?" : "حذف الموعد؟")) return;
    await api.delete(`/appointments/${id}`); toast.success("OK"); load();
  };

  const onCustomer = (v) => {
    const c = customers.find((x) => x.id === v);
    setForm({ ...form, customer_id: v === "none" ? "" : v, customer_name: c?.name || form.customer_name });
  };
  const onService = (v) => {
    const s = services.find((x) => x.id === v);
    setForm({ ...form, service_id: v, service_name: s?.name || "" });
  };

  const groups = items.reduce((acc, a) => {
    (acc[a.date] ||= []).push(a);
    return acc;
  }, {});

  const locale = lang === "de" ? "de-DE" : "ar-EG";

  return (
    <div data-testid="appointments-page">
      <div className="flex items-center justify-between mb-6 gap-2 flex-wrap">
        <div>
          <h1 className="font-heading text-3xl md:text-4xl font-bold">{t("appt.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("appt.subtitle")}</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setForm(empty); setEditId(null); } }}>
          <DialogTrigger asChild><Button className="h-11" data-testid="add-appointment-button"><Plus size={16} className="mx-1" /> {t("appt.add")}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editId ? (lang === "de" ? "Termin bearbeiten" : "تعديل موعد") : t("appt.add")}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>{t("pos.customer")}</Label>
                <Select value={form.customer_id || "none"} onValueChange={onCustomer}>
                  <SelectTrigger data-testid="appt-customer-select"><SelectValue placeholder={lang === "de" ? "Kunde wählen" : "اختر عميلاً"} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{lang === "de" ? "Neuer Kunde (Name eingeben)" : "عميل جديد (اكتب الاسم)"}</SelectItem>
                    {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {!form.customer_id && <Input className="mt-2" placeholder={lang === "de" ? "Kundenname" : "اسم العميل"} value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />}
              </div>
              <div className="col-span-2">
                <Label>{lang === "de" ? "Leistung" : "الخدمة"}</Label>
                <Select value={form.service_id} onValueChange={onService}>
                  <SelectTrigger data-testid="appt-service-select"><SelectValue placeholder={lang === "de" ? "Leistung wählen" : "اختر خدمة"} /></SelectTrigger>
                  <SelectContent>
                    {services.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>{t("common.date")}</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} data-testid="appt-date-input" /></div>
              <div><Label>{lang === "de" ? "Uhrzeit" : "الوقت"}</Label><Input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} data-testid="appt-time-input" /></div>
              <div className="col-span-2">
                <Label>{t("common.status")}</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">{t("appt.status.pending")}</SelectItem>
                    <SelectItem value="confirmed">{t("appt.status.confirmed")}</SelectItem>
                    <SelectItem value="completed">{t("appt.status.completed")}</SelectItem>
                    <SelectItem value="cancelled">{t("appt.status.cancelled")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2"><Label>{t("common.notes")}</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <Button onClick={save} className="mt-4 h-11" data-testid="save-appointment-button">{t("common.save")}</Button>
          </DialogContent>
        </Dialog>
      </div>

      {Object.keys(groups).length === 0 && <Card className="p-12 text-center text-muted-foreground rounded-2xl">{t("appt.none")}</Card>}

      <div className="space-y-6">
        {Object.entries(groups).map(([date, list]) => (
          <div key={date}>
            <h3 className="font-heading font-bold text-lg mb-3">{new Date(date).toLocaleDateString(locale, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {list.map((a) => {
                const cls = statusClass[a.status] || statusClass.pending;
                const lbl = t(`appt.status.${a.status}`);
                return (
                  <Card key={a.id} className="p-4 rounded-2xl card-ambient hover-lift" data-testid={`appt-card-${a.id}`}>
                    <div className="flex items-center justify-between mb-3">
                      <Badge className={cls + " border-0"}>{lbl}</Badge>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => edit(a)}><Pencil size={12} /></Button>
                        <Button variant="ghost" size="icon" className="h-10 w-10 text-destructive" onClick={() => del(a.id)}><Trash2 size={12} /></Button>
                      </div>
                    </div>
                    <div className="font-bold">{a.customer_name}</div>
                    <div className="text-sm text-muted-foreground">{a.service_name}</div>
                    <div className="flex items-center gap-1 mt-3 text-sm text-primary">
                      <Clock size={14} /> {a.time}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
