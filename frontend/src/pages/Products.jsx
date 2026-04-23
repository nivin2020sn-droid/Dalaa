import { useEffect, useState } from "react";
import { api, fmtEUR } from "../api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Plus, Pencil, Trash2, Package } from "lucide-react";
import { toast } from "sonner";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "../components/ui/table";

const empty = { name: "", sku: "", category: "", cost_price: 0, sale_price: 0, stock: 0, min_stock: 5, vat_rate: 19, image_url: "" };

export default function Products() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);

  const load = async () => {
    const r = await api.get("/products");
    setItems(r.data);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      const payload = {
        ...form,
        cost_price: Number(form.cost_price || 0),
        sale_price: Number(form.sale_price || 0),
        stock: Number(form.stock || 0),
        min_stock: Number(form.min_stock || 0),
        vat_rate: Number(form.vat_rate ?? 19),
      };
      if (editId) await api.put(`/products/${editId}`, payload);
      else await api.post("/products", payload);
      toast.success("تم الحفظ");
      setOpen(false);
      setForm(empty);
      setEditId(null);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "خطأ");
    }
  };

  const edit = (p) => {
    setForm(p);
    setEditId(p.id);
    setOpen(true);
  };

  const del = async (id) => {
    if (!window.confirm("حذف هذا المنتج؟")) return;
    try {
      await api.delete(`/products/${id}`);
      toast.success("تم الحذف");
      load();
    } catch (e) { toast.error(e?.response?.data?.detail || "خطأ"); }
  };

  return (
    <div data-testid="products-page">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-3xl md:text-4xl font-bold">المنتجات</h1>
          <p className="text-muted-foreground mt-1">إدارة منتجات المحل والمخزون</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setForm(empty); setEditId(null); } }}>
          <DialogTrigger asChild>
            <Button data-testid="add-product-button"><Plus size={16} className="ml-1" /> إضافة منتج</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editId ? "تعديل منتج" : "منتج جديد"}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>الاسم</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="product-name-input" /></div>
              <div><Label>الكود</Label><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
              <div><Label>الفئة</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
              <div><Label>سعر التكلفة</Label><Input type="number" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} /></div>
              <div><Label>سعر البيع</Label><Input type="number" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} data-testid="product-price-input" /></div>
              <div><Label>المخزون</Label><Input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} data-testid="product-stock-input" /></div>
              <div><Label>حد التنبيه</Label><Input type="number" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })} /></div>
              <div>
                <Label>MwSt %</Label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={form.vat_rate ?? 19}
                  onChange={(e) => setForm({ ...form, vat_rate: Number(e.target.value) })}
                  data-testid="product-vat-select"
                >
                  <option value={19}>19% (معياري)</option>
                  <option value={7}>7% (مخفض)</option>
                  <option value={0}>0% (معفى)</option>
                </select>
              </div>
              <div className="col-span-2"><Label>رابط الصورة (اختياري)</Label><Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} /></div>
            </div>
            <Button onClick={save} className="mt-4" data-testid="save-product-button">حفظ</Button>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="rounded-2xl card-ambient overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">المنتج</TableHead>
              <TableHead className="text-right">الفئة</TableHead>
              <TableHead className="text-right">سعر البيع</TableHead>
              <TableHead className="text-right">المخزون</TableHead>
              <TableHead className="text-right">إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">لا توجد منتجات</TableCell></TableRow>}
            {items.map((p) => (
              <TableRow key={p.id} data-testid={`product-row-${p.id}`}>
                <TableCell className="font-semibold flex items-center gap-2">
                  <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center overflow-hidden">
                    {p.image_url ? <img src={p.image_url} alt="" className="w-full h-full object-cover" /> : <Package size={16} className="text-muted-foreground" />}
                  </div>
                  <div>
                    <div>{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.sku}</div>
                  </div>
                </TableCell>
                <TableCell>{p.category}</TableCell>
                <TableCell className="text-primary font-bold">{fmtEUR(p.sale_price)}</TableCell>
                <TableCell>
                  <span className={p.stock <= p.min_stock ? "text-destructive font-bold" : ""}>{p.stock}</span>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => edit(p)}><Pencil size={14} /></Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => del(p.id)}><Trash2 size={14} /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
