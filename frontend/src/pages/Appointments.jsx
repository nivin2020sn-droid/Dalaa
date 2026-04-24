import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import { useI18n } from "../i18n/I18nContext";
import { useSettings } from "../context/SettingsContext";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Plus, Pencil, Trash2, Clock, ChevronLeft, ChevronRight, CalendarDays, List, Mail, Printer } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "../components/ui/badge";
import AppointmentReceipt from "../components/AppointmentReceipt";
import { exportAppointmentToPdf } from "../services/pdf";

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

const statusDot = {
  pending: "bg-amber-500",
  confirmed: "bg-blue-500",
  completed: "bg-emerald-500",
  cancelled: "bg-rose-500",
};

const toIsoDate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export default function Appointments() {
  const { t, lang, dir } = useI18n();
  const { settings } = useSettings();
  const [items, setItems] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [services, setServices] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [view, setView] = useState("calendar"); // calendar | list
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState(null); // ISO date of selected cell for day-list dialog
  const [shareAppt, setShareAppt] = useState(null); // appointment being shared/printed
  const shareReceiptRef = useRef(null);

  const locale = lang === "de" ? "de-DE" : "ar-EG";

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
      let saved;
      if (editId) {
        const r = await api.put(`/appointments/${editId}`, form);
        saved = r.data;
      } else {
        const r = await api.post("/appointments", form);
        saved = r.data;
      }
      toast.success(lang === "de" ? "Gespeichert" : "تم الحفظ");
      setOpen(false); setForm(empty); setEditId(null); load();
      // Offer to send a mailto: confirmation if it's a NEW appointment and the
      // linked customer has an email on file.
      if (!editId && saved && form.customer_id) {
        const c = customers.find((x) => x.id === form.customer_id);
        if (c?.email) {
          setTimeout(() => {
            const ok = window.confirm(
              lang === "de"
                ? `Bestätigungs-E-Mail an ${c.email} senden?`
                : `إرسال بريد تأكيد إلى ${c.email}؟`,
            );
            if (ok) sendApptEmail({ ...saved, customer_email: c.email });
          }, 250);
        }
      }
    } catch (e) { toast.error(e?.response?.data?.detail || "Error"); }
  };
  const edit = (a) => { setForm(a); setEditId(a.id); setSelectedDay(null); setOpen(true); };
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

  // ---------- Email / print helpers ----------
  const apptDateLabel = (a) => {
    if (!a?.date) return "";
    return new Date(a.date + "T00:00:00").toLocaleDateString(locale, {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
  };

  const sendApptEmail = (a) => {
    let email = a?.customer_email || "";
    if (!email && a?.customer_id) {
      const c = customers.find((x) => x.id === a.customer_id);
      email = c?.email || "";
    }
    if (!email) {
      const entered = window.prompt(
        lang === "de" ? "E-Mail-Adresse des Kunden:" : "البريد الإلكتروني للعميل:",
        "",
      );
      if (entered === null) return;
      email = (entered || "").trim();
    }
    if (!email) {
      toast.error(lang === "de" ? "Keine E-Mail vorhanden" : "لا يوجد بريد إلكتروني");
      return;
    }
    const subject = lang === "de"
      ? `Terminbestätigung — ${settings.shop_name}`
      : `تأكيد موعد — ${settings.shop_name}`;
    const dateStr = apptDateLabel(a);
    const body = lang === "de"
      ? `Hallo ${a.customer_name || ""},\n\nIhr Termin bei ${settings.shop_name} ist gebucht:\n\nLeistung: ${a.service_name || "—"}\nDatum: ${dateStr}\nUhrzeit: ${a.time || "—"}\n${a.notes ? "Notizen: " + a.notes + "\n" : ""}\nWir freuen uns auf Ihren Besuch!\n${settings.shop_name}`
      : `مرحباً ${a.customer_name || ""}،\n\nتم تأكيد موعدك في ${settings.shop_name}:\n\nالخدمة: ${a.service_name || "—"}\nالتاريخ: ${dateStr}\nالوقت: ${a.time || "—"}\n${a.notes ? "ملاحظات: " + a.notes + "\n" : ""}\nفي انتظاركم!\n${settings.shop_name}`;
    const mailto = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    try {
      window.location.href = mailto;
    } catch {
      window.open(mailto, "_blank", "noopener");
    }
  };

  const printAppt = async (a) => {
    setShareAppt(a);
    // Wait one tick so the hidden receipt has rendered before capturing it.
    await new Promise((r) => setTimeout(r, 80));
    try {
      if (!shareReceiptRef.current) throw new Error("Receipt not rendered");
      await exportAppointmentToPdf(
        shareReceiptRef.current,
        `appointment_${a.customer_name || ""}_${a.date || ""}`,
      );
      toast.success(lang === "de" ? "PDF bereit" : "PDF جاهز");
    } catch (e) {
      toast.error(e?.message || "Print error");
    } finally {
      setShareAppt(null);
    }
  };

  // ---------- Calendar helpers ----------
  const byDate = useMemo(() => {
    const m = {};
    items.forEach((a) => { (m[a.date] ||= []).push(a); });
    return m;
  }, [items]);

  const monthCells = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    // Week starts on Monday (DE/AR both commonly use Mon start for business)
    const jsDow = first.getDay(); // 0=Sun..6=Sat
    const offset = (jsDow + 6) % 7; // Monday=0
    const start = new Date(year, month, 1 - offset);
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      cells.push(d);
    }
    return cells;
  }, [cursor]);

  const weekdayLabels = useMemo(() => {
    // Start from a known Monday (2024-01-01 was Monday)
    const base = new Date(2024, 0, 1);
    return [0, 1, 2, 3, 4, 5, 6].map((i) => {
      const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
      return d.toLocaleDateString(locale, { weekday: "short" });
    });
  }, [locale]);

  const monthLabel = cursor.toLocaleDateString(locale, { month: "long", year: "numeric" });
  const todayIso = toIsoDate(new Date());
  const inMonth = (d) => d.getMonth() === cursor.getMonth();

  const gotoPrev = () => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1));
  const gotoNext = () => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1));
  const gotoToday = () => {
    const d = new Date();
    setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
  };

  const openNewOn = (isoDate) => {
    setForm({ ...empty, date: isoDate });
    setEditId(null);
    setSelectedDay(null);
    setOpen(true);
  };

  const dayAppointments = selectedDay ? (byDate[selectedDay] || []).slice().sort((a, b) => a.time.localeCompare(b.time)) : [];
  const selectedDayLabel = selectedDay
    ? new Date(selectedDay + "T00:00:00").toLocaleDateString(locale, { weekday: "long", year: "numeric", month: "long", day: "numeric" })
    : "";

  // ---------- List view grouping (original) ----------
  const groups = items.reduce((acc, a) => {
    (acc[a.date] ||= []).push(a);
    return acc;
  }, {});

  return (
    <div data-testid="appointments-page">
      <div className="flex items-center justify-between mb-6 gap-2 flex-wrap">
        <div>
          <h1 className="font-heading text-3xl md:text-4xl font-bold">{t("appt.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("appt.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded-xl border border-border overflow-hidden" data-testid="appt-view-toggle">
            <Button
              type="button"
              variant={view === "calendar" ? "default" : "ghost"}
              className="h-11 rounded-none px-4"
              onClick={() => setView("calendar")}
              data-testid="view-calendar-button"
            >
              <CalendarDays size={16} className="mx-1" />
              {lang === "de" ? "Monat" : "شهري"}
            </Button>
            <Button
              type="button"
              variant={view === "list" ? "default" : "ghost"}
              className="h-11 rounded-none px-4"
              onClick={() => setView("list")}
              data-testid="view-list-button"
            >
              <List size={16} className="mx-1" />
              {lang === "de" ? "Liste" : "قائمة"}
            </Button>
          </div>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setForm(empty); setEditId(null); } }}>
            <DialogTrigger asChild>
              <Button className="h-11" data-testid="add-appointment-button">
                <Plus size={16} className="mx-1" /> {t("appt.add")}
              </Button>
            </DialogTrigger>
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
      </div>

      {view === "calendar" && (
        <Card className="p-4 md:p-6 rounded-2xl card-ambient" data-testid="appt-calendar">
          <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
            <div className="flex items-center gap-1">
              <Button type="button" variant="outline" size="icon" className="h-10 w-10" onClick={gotoPrev} data-testid="cal-prev-button">
                <ChevronRight size={16} className="rtl:hidden" />
                <ChevronLeft size={16} className="ltr:hidden" />
              </Button>
              <Button type="button" variant="outline" size="icon" className="h-10 w-10" onClick={gotoNext} data-testid="cal-next-button">
                <ChevronLeft size={16} className="rtl:hidden" />
                <ChevronRight size={16} className="ltr:hidden" />
              </Button>
              <Button type="button" variant="ghost" className="h-10" onClick={gotoToday} data-testid="cal-today-button">
                {lang === "de" ? "Heute" : "اليوم"}
              </Button>
            </div>
            <div className="font-heading font-bold text-xl md:text-2xl capitalize" data-testid="cal-month-label">
              {monthLabel}
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-muted-foreground mb-2">
            {weekdayLabels.map((w, i) => (
              <div key={i} className="py-2">{w}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {monthCells.map((d) => {
              const iso = toIsoDate(d);
              const list = byDate[iso] || [];
              const isCurMonth = inMonth(d);
              const isToday = iso === todayIso;
              return (
                <button
                  type="button"
                  key={iso}
                  onClick={() => (list.length > 0 ? setSelectedDay(iso) : openNewOn(iso))}
                  className={[
                    "min-h-[82px] md:min-h-[110px] rounded-xl border p-1.5 text-start flex flex-col gap-1 transition-colors",
                    isCurMonth ? "bg-card border-border hover:bg-secondary" : "bg-secondary/40 border-transparent text-muted-foreground",
                    isToday ? "ring-2 ring-primary border-primary" : "",
                  ].join(" ")}
                  data-testid={`cal-day-${iso}`}
                >
                  <div className="flex items-center justify-between">
                    <span className={[
                      "text-xs md:text-sm font-bold",
                      isToday ? "text-primary" : "",
                    ].join(" ")}>
                      {d.getDate()}
                    </span>
                    {list.length > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-bold" data-testid={`cal-count-${iso}`}>
                        {list.length}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 space-y-0.5 overflow-hidden">
                    {list.slice(0, 3).map((a) => (
                      <div
                        key={a.id}
                        className="flex items-center gap-1 text-[10px] md:text-xs truncate rounded bg-secondary/60 px-1 py-0.5"
                        title={`${a.time} — ${a.customer_name}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDot[a.status] || statusDot.pending}`} />
                        <span className="font-mono shrink-0">{a.time}</span>
                        <span className="truncate">{a.customer_name}</span>
                      </div>
                    ))}
                    {list.length > 3 && (
                      <div className="text-[10px] text-muted-foreground font-bold">
                        +{list.length - 3} {lang === "de" ? "mehr" : "المزيد"}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Status legend */}
          <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground flex-wrap">
            {["pending", "confirmed", "completed", "cancelled"].map((s) => (
              <div key={s} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${statusDot[s]}`} />
                {t(`appt.status.${s}`)}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Day detail dialog */}
      <Dialog open={!!selectedDay} onOpenChange={(o) => { if (!o) setSelectedDay(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">{selectedDayLabel}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {dayAppointments.map((a) => {
              const cls = statusClass[a.status] || statusClass.pending;
              return (
                <Card key={a.id} className="p-3 rounded-xl" data-testid={`day-appt-${a.id}`}>
                  <div className="flex items-center justify-between mb-2">
                    <Badge className={cls + " border-0"}>{t(`appt.status.${a.status}`)}</Badge>
                    <div className="flex items-center gap-1 text-sm text-primary font-mono">
                      <Clock size={12} /> {a.time}
                    </div>
                  </div>
                  <div className="font-bold">{a.customer_name}</div>
                  <div className="text-sm text-muted-foreground">{a.service_name}</div>
                  {a.notes && <div className="text-xs text-muted-foreground mt-1">{a.notes}</div>}
                  <div className="flex justify-end gap-1 mt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => sendApptEmail(a)}
                      title={lang === "de" ? "Bestätigung per E-Mail" : "تأكيد بالبريد"}
                      data-testid={`day-email-${a.id}`}
                    >
                      <Mail size={12} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => printAppt(a)}
                      title={lang === "de" ? "Termin drucken" : "طباعة الموعد"}
                      data-testid={`day-print-${a.id}`}
                    >
                      <Printer size={12} />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => edit(a)}><Pencil size={12} /></Button>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => del(a.id)}><Trash2 size={12} /></Button>
                  </div>
                </Card>
              );
            })}
          </div>
          <Button
            type="button"
            className="mt-2 h-11"
            onClick={() => openNewOn(selectedDay)}
            data-testid="day-add-appointment-button"
          >
            <Plus size={14} className="mx-1" /> {t("appt.add")}
          </Button>
        </DialogContent>
      </Dialog>

      {view === "list" && (
        <>
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
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-10 w-10"
                              onClick={() => sendApptEmail(a)}
                              title={lang === "de" ? "Bestätigung per E-Mail" : "تأكيد بالبريد"}
                              data-testid={`appt-email-${a.id}`}
                            >
                              <Mail size={12} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-10 w-10"
                              onClick={() => printAppt(a)}
                              title={lang === "de" ? "Termin drucken" : "طباعة الموعد"}
                              data-testid={`appt-print-${a.id}`}
                            >
                              <Printer size={12} />
                            </Button>
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
        </>
      )}

      {/* Off-screen appointment receipt — captured for PDF print */}
      {shareAppt && (
        <AppointmentReceipt
          ref={shareReceiptRef}
          appt={shareAppt}
          settings={settings}
          lang={lang}
          dir={dir}
          widthMm={80}
        />
      )}
    </div>
  );
}
