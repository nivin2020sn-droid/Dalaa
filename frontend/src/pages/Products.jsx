import { useEffect, useState } from "react";
import { api, fmtEUR } from "../api";
import { useI18n } from "../i18n/I18nContext";
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
  const { t, lang } = useI18n();
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
      toast.success(lang === "de" ? "Gespeichert" : "تم الحفظ");
      setOpen(false);
      setForm(empty);
      setEditId(null);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Error");
    }
  };

  const edit = (p) => {
    setForm(p);
    setEditId(p.id);
    setOpen(true);
  };

  const del = async (id) => {
    if (!window.confirm(lang === "de" ? "Produkt löschen?" : "حذف هذا المنتج؟")) return;
    try {
      await api.delete(`/products/${id}`);
      toast.success(lang === "de" ? "Gelöscht" : "تم الحذف");
      load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Error"); }
  };

  return (
    <div data-testid="products-page">
      <div className="flex items-center justify-between mb-6 gap-2 flex-wrap">
        <div>
          <h1 className="font-heading text-3xl md:text-4xl font-bold">{t("prod.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("prod.subtitle")}</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setForm(empty); setEditId(null); } }}>
          <DialogTrigger asChild>
            <Button className="h-11" data-testid="add-product-button"><Plus size={16} className="mx-1" /> {t("prod.add")}</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editId ? t("prod.edit_title") : t("prod.new_title")}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>{t("common.name")}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="product-name-input" /></div>
              <div><Label>{t("prod.sku")}</Label><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
              <div><Label>{t("prod.category")}</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
              <div><Label>{t("prod.cost_price")}</Label><Input type="number" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} /></div>
              <div>
                <Label>{t("prod.sale_price")} <span className="text-xs text-muted-foreground">({lang === "de" ? "netto" : "صافي"})</span></Label>
                <Input type="number" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} data-testid="product-price-input" />
              </div>
              <div><Label>{t("prod.stock")}</Label><Input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} data-testid="product-stock-input" /></div>
              <div><Label>{t("prod.min_stock")}</Label><Input type="number" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })} /></div>
              <div>
                <Label>MwSt %</Label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={form.vat_rate ?? 19}
                  onChange={(e) => setForm({ ...form, vat_rate: Number(e.target.value) })}
                  data-testid="product-vat-select"
                >
                  <option value={19}>19% ({lang === "de" ? "Standard" : "معياري"})</option>
                  <option value={7}>7% ({lang === "de" ? "ermäßigt" : "مخفض"})</option>
                  <option value={0}>0% ({lang === "de" ? "befreit" : "معفى"})</option>
                </select>
              </div>
              <div className="col-span-2"><Label>{t("prod.image_url")}</Label><Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} /></div>
            </div>
            <div className="text-xs text-muted-foreground mt-2 p-2 bg-secondary/50 rounded-lg">
              💡 {lang === "de"
                ? "Der Verkaufspreis ist der NETTO-Preis. Die MwSt wird beim Kassieren automatisch hinzugerechnet."
                : "السعر المدخل هو الصافي. الضريبة تُضاف تلقائياً عند البيع."}
            </div>
            <Button onClick={save} className="mt-4 h-11" data-testid="save-product-button">{t("common.save")}</Button>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="rounded-2xl card-ambient overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-start">{lang === "de" ? "Produkt" : "المنتج"}</TableHead>
              <TableHead className="text-start">{t("prod.category")}</TableHead>
              <TableHead className="text-start">{t("prod.sale_price")}</TableHead>
              <TableHead className="text-start">{t("prod.stock")}</TableHead>
              <TableHead className="text-start">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">{t("prod.none")}</TableCell></TableRow>}
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
                    <Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => edit(p)}><Pencil size={14} /></Button>
                    <Button variant="ghost" size="icon" className="h-11 w-11 text-destructive" onClick={() => del(p.id)}><Trash2 size={14} /></Button>
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
