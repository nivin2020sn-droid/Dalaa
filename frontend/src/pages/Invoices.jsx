import { useEffect, useState } from "react";
import { api, fmtEUR, fmtDate } from "../api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Eye, Receipt } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "../components/ui/table";

const payLabels = { cash: "نقداً", card: "بطاقة", transfer: "تحويل" };

export default function Invoices() {
  const [items, setItems] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/invoices").then((r) => setItems(r.data));
  }, []);

  return (
    <div data-testid="invoices-page">
      <div className="mb-6">
        <h1 className="font-heading text-3xl md:text-4xl font-bold">الفواتير</h1>
        <p className="text-muted-foreground mt-1">سجل جميع عمليات البيع</p>
      </div>

      <Card className="rounded-2xl card-ambient overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">رقم الفاتورة</TableHead>
              <TableHead className="text-right">العميل</TableHead>
              <TableHead className="text-right">التاريخ</TableHead>
              <TableHead className="text-right">الدفع</TableHead>
              <TableHead className="text-right">الإجمالي</TableHead>
              <TableHead className="text-right">عرض</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">لا توجد فواتير بعد</TableCell></TableRow>}
            {items.map((inv) => (
              <TableRow key={inv.id} data-testid={`invoice-row-${inv.id}`} className="cursor-pointer" onClick={() => navigate(`/invoices/${inv.id}`)}>
                <TableCell className="font-mono font-bold">{inv.invoice_number}</TableCell>
                <TableCell>{inv.customer_name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{fmtDate(inv.created_at)}</TableCell>
                <TableCell><Badge variant="outline">{payLabels[inv.payment_method] || inv.payment_method}</Badge></TableCell>
                <TableCell className="text-primary font-bold">{fmtEUR(inv.total)}</TableCell>
                <TableCell><Button variant="ghost" size="icon"><Eye size={14} /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
