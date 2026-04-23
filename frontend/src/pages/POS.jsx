import { useEffect, useMemo, useState } from "react";
import { api, fmtEUR } from "../api";
import { useI18n } from "../i18n/I18nContext";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Plus, Minus, Trash2, Package, Scissors, Search } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export default function POS() {
  const { t, lang } = useI18n();
  const [products, setProducts] = useState([]);
  const [services, setServices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [q, setQ] = useState("");
  const [cart, setCart] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState(t("pos.walk_in"));
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const load = async () => {
    const [p, s, c] = await Promise.all([
      api.get("/products"),
      api.get("/services"),
      api.get("/customers"),
    ]);
    setProducts(p.data);
    setServices(s.data);
    setCustomers(c.data);
  };

  useEffect(() => {
    load();
  }, []);

  const addToCart = (item, type) => {
    const existing = cart.find((c) => c.item_id === item.id && c.item_type === type);
    const price = type === "product" ? item.sale_price : item.price; // NET price
    const vat_rate = item.vat_rate ?? 19;
    if (existing) {
      setCart(cart.map((c) =>
        c.item_id === item.id && c.item_type === type
          ? { ...c, quantity: c.quantity + 1, total: (c.quantity + 1) * c.unit_price }
          : c
      ));
    } else {
      setCart([...cart, {
        item_id: item.id,
        item_type: type,
        name: item.name,
        quantity: 1,
        unit_price: price,
        total: price,     // line net (qty × net)
        vat_rate,
      }]);
    }
  };

  const changeQty = (idx, delta) => {
    const next = [...cart];
    const q = Math.max(1, next[idx].quantity + delta);
    next[idx].quantity = q;
    next[idx].total = q * next[idx].unit_price;
    setCart(next);
  };

  const removeItem = (idx) => setCart(cart.filter((_, i) => i !== idx));

  // Cart totals with automatic VAT (prices are NET)
  const { net_total, vat_by_rate, gross_total } = useMemo(() => {
    const byRate = {};
    let net_sum = 0;
    for (const c of cart) {
      const net = Number(c.total || 0);
      const rate = Number(c.vat_rate ?? 19);
      net_sum += net;
      const vat = net * (rate / 100);
      byRate[rate] = (byRate[rate] || 0) + vat;
    }
    const vat_sum = Object.values(byRate).reduce((s, v) => s + v, 0);
    return {
      net_total: Math.round(net_sum * 100) / 100,
      vat_by_rate: Object.entries(byRate).map(([rate, vat]) => ({
        rate: Number(rate),
        vat: Math.round(vat * 100) / 100,
      })),
      gross_total: Math.round((net_sum + vat_sum) * 100) / 100,
    };
  }, [cart]);

  const total = Math.max(0, gross_total - Number(discount || 0) + Number(tax || 0));

  const filteredProducts = products.filter((p) => p.name?.toLowerCase().includes(q.toLowerCase()));
  const filteredServices = services.filter((s) => s.name?.toLowerCase().includes(q.toLowerCase()));

  const onCustomerChange = (val) => {
    setCustomerId(val);
    const c = customers.find((x) => x.id === val);
    setCustomerName(c ? c.name : t("pos.walk_in"));
  };

  const checkout = async () => {
    if (cart.length === 0) {
      toast.error(t("pos.empty_cart"));
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        customer_id: customerId || "",
        customer_name: customerName,
        items: cart,
        discount: Number(discount || 0),
        tax: Number(tax || 0),
        payment_method: paymentMethod,
      };
      const r = await api.post("/invoices", payload);
      toast.success(lang === "de" ? "Rechnung erstellt" : "تم إصدار الفاتورة");
      setCart([]);
      setDiscount(0);
      setTax(0);
      setCustomerId("");
      setCustomerName(t("pos.walk_in"));
      navigate(`/invoices/${r.data.id}`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div data-testid="pos-page">
      <h1 className="font-heading text-3xl md:text-4xl font-bold mb-6">{t("pos.title")}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Products/Services grid on the right side (in RTL, first column) */}
        <div className="lg:col-span-2">
          <Card className="p-4 rounded-2xl card-ambient">
            <div className="relative mb-4">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <Input
                placeholder={t("common.search")}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pr-10 h-11"
                data-testid="pos-search-input"
              />
            </div>

            <Tabs defaultValue="products">
              <TabsList className="bg-secondary">
                <TabsTrigger value="products" data-testid="tab-products"><Package size={14} className="mx-1" /> {t("pos.products_tab")}</TabsTrigger>
                <TabsTrigger value="services" data-testid="tab-services"><Scissors size={14} className="mx-1" /> {t("pos.services_tab")}</TabsTrigger>
              </TabsList>
              <TabsContent value="products" className="mt-4">
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                  {filteredProducts.length === 0 && <div className="col-span-full text-center py-8 text-muted-foreground text-sm">{t("prod.none")}</div>}
                  {filteredProducts.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => addToCart(p, "product")}
                      className="text-right bg-white border border-border rounded-xl p-3 hover-lift transition-all disabled:opacity-40"
                      disabled={p.stock <= 0}
                      data-testid={`pos-product-${p.id}`}
                    >
                      <div className="aspect-square bg-secondary rounded-lg mb-2 flex items-center justify-center overflow-hidden">
                        {p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" /> : <Package className="text-muted-foreground" size={28} />}
                      </div>
                      <div className="font-semibold text-sm truncate">{p.name}</div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-primary font-bold text-sm">{fmtEUR(p.sale_price)}</span>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{p.stock} {lang === "de" ? "St." : "قطعة"}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </TabsContent>
              <TabsContent value="services" className="mt-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {filteredServices.length === 0 && <div className="col-span-full text-center py-8 text-muted-foreground text-sm">{t("svc.none")}</div>}
                  {filteredServices.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => addToCart(s, "service")}
                      className="text-right bg-white border border-border rounded-xl p-4 hover-lift transition-all"
                      data-testid={`pos-service-${s.id}`}
                    >
                      <div className="w-10 h-10 rounded-lg bg-accent/20 text-accent-foreground flex items-center justify-center mb-2">
                        <Scissors size={18} />
                      </div>
                      <div className="font-semibold text-sm">{s.name}</div>
                      <div className="text-xs text-muted-foreground mt-1">{s.duration_minutes} {lang === "de" ? "Min." : "دقيقة"}</div>
                      <div className="text-primary font-bold text-sm mt-2">{fmtEUR(s.price)}</div>
                    </button>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </Card>
        </div>

        {/* Cart */}
        <Card className="p-5 rounded-2xl card-ambient h-fit sticky top-4" data-testid="pos-cart">
          <h3 className="font-heading font-bold text-lg mb-4">{t("pos.invoice")}</h3>

          <div className="mb-3">
            <Label className="text-xs mb-1 block">{t("pos.customer")}</Label>
            <Select value={customerId || "none"} onValueChange={(v) => onCustomerChange(v === "none" ? "" : v)}>
              <SelectTrigger data-testid="pos-customer-select"><SelectValue placeholder={t("pos.walk_in")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("pos.walk_in")}</SelectItem>
                {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 max-h-80 overflow-y-auto mb-4">
            {cart.length === 0 && <div className="text-center text-sm text-muted-foreground py-6">{t("pos.empty_cart")}</div>}
            {cart.map((c, i) => (
              <div key={i} className="flex items-center gap-2 p-2 bg-secondary rounded-xl">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{fmtEUR(c.unit_price)} × {c.quantity} · MwSt {c.vat_rate ?? 19}%</div>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => changeQty(i, -1)}><Minus size={12} /></Button>
                  <span className="w-6 text-center text-sm font-bold">{c.quantity}</span>
                  <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => changeQty(i, 1)}><Plus size={12} /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => removeItem(i)}><Trash2 size={12} /></Button>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2 mb-4">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">{t("common.discount")} (€)</Label>
                <Input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} data-testid="pos-discount-input" />
              </div>
              <div>
                <Label className="text-xs">{lang === "de" ? "Zuschlag" : "رسوم إضافية"} (€)</Label>
                <Input type="number" value={tax} onChange={(e) => setTax(e.target.value)} data-testid="pos-tax-input" />
              </div>
            </div>
            <div>
              <Label className="text-xs">{t("pos.payment_method")}</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger data-testid="pos-payment-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">{t("pos.cash")}</SelectItem>
                  <SelectItem value="card">{t("pos.card")}</SelectItem>
                  <SelectItem value="transfer">{t("pos.transfer")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1 border-t border-border pt-3 mb-4">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">{t("inv.net")}</span><span>{fmtEUR(net_total)}</span></div>
            {vat_by_rate.map((b) => (
              <div key={b.rate} className="flex justify-between text-sm">
                <span className="text-muted-foreground">MwSt {b.rate}%</span>
                <span>+{fmtEUR(b.vat)}</span>
              </div>
            ))}
            {discount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("common.discount")}</span>
                <span>-{fmtEUR(discount)}</span>
              </div>
            )}
            {tax > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{lang === "de" ? "Zuschlag" : "رسوم"}</span>
                <span>+{fmtEUR(tax)}</span>
              </div>
            )}
            <div className="flex justify-between text-xl font-heading font-bold pt-2 border-t border-border">
              <span>{t("common.total")}</span><span className="text-primary" data-testid="pos-total">{fmtEUR(total)}</span>
            </div>
          </div>

          <Button className="w-full h-12 text-base font-bold" onClick={checkout} disabled={submitting || cart.length === 0} data-testid="pos-checkout-button">
            {submitting ? t("common.loading") : t("pos.checkout")}
          </Button>
        </Card>
      </div>
    </div>
  );
}
