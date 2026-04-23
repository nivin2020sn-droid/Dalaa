import { useEffect, useState } from "react";
import { api, fmtEUR, fmtDate } from "../api";
import { useI18n } from "../i18n/I18nContext";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "../components/ui/table";

const empty = { title: "", category: "", amount: 0, date: new Date().toISOString().split("T")[0], notes: "" };

export default function Expenses() {
  const { t, lang } = useI18n();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);

  const load = async () => { const r = await api.get("/expenses"); setItems(r.data); };
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      const payload = { ...form, amount: Number(form.amount || 0) };
      if (editId) await api.put(`/expenses/${editId}`, payload);
      else await api.post("/expenses", payload);
      toast.success(lang === "de" ? "Gespeichert" : "تم");
      setOpen(false); setForm(empty); setEditId(null); load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Error"); }
  };
  const edit = (x) => { setForm({ title: x.title, category: x.category, amount: x.amount, date: x.date, notes: x.notes }); setEditId(x.id); setOpen(true); };
  const del = async (id) => {
    if (!window.confirm(lang === "de" ? "Löschen?" : "حذف؟")) return;
    await api.delete(`/expenses/${id}`); load();
  };

  const total = items.reduce((s, x) => s + (x.amount || 0), 0);

  return (
    <div data-testid="expenses-page">
      <div className="flex items-center justify-between mb-6 gap-2 flex-wrap">
        <div>
          <h1 className="font-heading text-3xl md:text-4xl font-bold">{t("exp.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("exp.subtitle")}</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setForm(empty); setEditId(null); } }}>
          <DialogTrigger asChild><Button className="h-11" data-testid="add-expense-button"><Plus size={16} className="mx-1" /> {t("exp.add")}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editId ? (lang === "de" ? "Ausgabe bearbeiten" : "تعديل مصروف") : t("exp.add")}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>{lang === "de" ? "Titel" : "العنوان"}</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} data-testid="expense-title-input" /></div>
              <div><Label>{t("prod.category")}</Label><Input placeholder={lang === "de" ? "Miete, Gehalt, Material…" : "إيجار، رواتب، مستلزمات..."} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>{t("exp.amount")}</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} data-testid="expense-amount-input" /></div>
                <div><Label>{t("common.date")}</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
              </div>
              <div><Label>{t("common.notes")}</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <Button onClick={save} className="mt-4 h-11" data-testid="save-expense-button">{t("common.save")}</Button>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="p-5 rounded-2xl mb-4 card-ambient">
        <div className="text-sm text-muted-foreground">{t("exp.total")}</div>
        <div className="text-3xl font-heading font-bold text-destructive mt-1">{fmtEUR(total)}</div>
      </Card>

      <Card className="rounded-2xl card-ambient overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-start">{lang === "de" ? "Titel" : "العنوان"}</TableHead>
              <TableHead className="text-start">{t("prod.category")}</TableHead>
              <TableHead className="text-start">{t("common.date")}</TableHead>
              <TableHead className="text-start">{t("exp.amount")}</TableHead>
              <TableHead className="text-start"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">{t("exp.none")}</TableCell></TableRow>}
            {items.map((x) => (
              <TableRow key={x.id} data-testid={`expense-row-${x.id}`}>
                <TableCell className="font-semibold">{x.title}</TableCell>
                <TableCell>{x.category}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{x.date}</TableCell>
                <TableCell className="text-destructive font-bold">{fmtEUR(x.amount)}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => edit(x)}><Pencil size={14} /></Button>
                  <Button variant="ghost" size="icon" className="h-11 w-11 text-destructive" onClick={() => del(x.id)}><Trash2 size={14} /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
