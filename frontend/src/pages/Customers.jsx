import { useEffect, useState } from "react";
import { api, fmtEUR } from "../api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "../components/ui/table";

const empty = { name: "", phone: "", email: "", notes: "" };

export default function Customers() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);

  const load = async () => { const r = await api.get("/customers"); setItems(r.data); };
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      if (editId) await api.put(`/customers/${editId}`, form);
      else await api.post("/customers", form);
      toast.success("تم الحفظ");
      setOpen(false); setForm(empty); setEditId(null); load();
    } catch (e) { toast.error(e?.response?.data?.detail || "خطأ"); }
  };
  const edit = (c) => { setForm({ name: c.name, phone: c.phone, email: c.email, notes: c.notes }); setEditId(c.id); setOpen(true); };
  const del = async (id) => {
    if (!window.confirm("حذف العميل؟")) return;
    try { await api.delete(`/customers/${id}`); toast.success("تم"); load(); }
    catch (e) { toast.error(e?.response?.data?.detail || "خطأ"); }
  };

  return (
    <div data-testid="customers-page">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-3xl md:text-4xl font-bold">العملاء</h1>
          <p className="text-muted-foreground mt-1">قاعدة بيانات عملاء الصالون</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setForm(empty); setEditId(null); } }}>
          <DialogTrigger asChild><Button data-testid="add-customer-button"><Plus size={16} className="ml-1" /> عميل جديد</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editId ? "تعديل العميل" : "عميل جديد"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>الاسم</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="customer-name-input" /></div>
              <div><Label>الهاتف</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} data-testid="customer-phone-input" /></div>
              <div><Label>البريد</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>ملاحظات</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <Button onClick={save} className="mt-4" data-testid="save-customer-button">حفظ</Button>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="rounded-2xl card-ambient overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">الاسم</TableHead>
              <TableHead className="text-right">الهاتف</TableHead>
              <TableHead className="text-right">الزيارات</TableHead>
              <TableHead className="text-right">إجمالي الإنفاق</TableHead>
              <TableHead className="text-right">إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">لا يوجد عملاء</TableCell></TableRow>}
            {items.map((c) => (
              <TableRow key={c.id} data-testid={`customer-row-${c.id}`}>
                <TableCell className="font-semibold">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-accent/20 text-accent-foreground flex items-center justify-center text-xs font-bold">
                      {c.name?.[0]}
                    </div>
                    <div>
                      <div>{c.name}</div>
                      {c.email && <div className="text-xs text-muted-foreground">{c.email}</div>}
                    </div>
                  </div>
                </TableCell>
                <TableCell>{c.phone}</TableCell>
                <TableCell>{c.visits || 0}</TableCell>
                <TableCell className="text-primary font-bold">{fmtEUR(c.total_spent || 0)}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => edit(c)}><Pencil size={14} /></Button>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => del(c.id)}><Trash2 size={14} /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
