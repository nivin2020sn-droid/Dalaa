import db from "../db/db";
import { newId, nowIso } from "../db/seed";
import { currentUser } from "./auth";

async function nextInvoiceNumber() {
  const count = await db.invoices.count();
  return `INV-${String(count + 1).padStart(6, "0")}`;
}

export async function listInvoices() {
  const rows = await db.invoices.toArray();
  return rows.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
}

export async function getInvoice(id) {
  const inv = await db.invoices.get(id);
  if (!inv) {
    const err = new Error("Not found");
    err.response = { status: 404, data: { detail: err.message } };
    throw err;
  }
  return inv;
}

export async function createInvoice(body) {
  const user = await currentUser();
  const items = (body.items || []).map((it) => ({
    item_id: it.item_id,
    item_type: it.item_type,
    name: it.name,
    quantity: Number(it.quantity || 0),
    unit_price: Number(it.unit_price || 0),
    total: Number(it.total || 0),
  }));
  const subtotal = items.reduce((s, it) => s + it.total, 0);
  const discount = Number(body.discount || 0);
  const tax = Number(body.tax || 0);
  const total = Math.max(0, subtotal - discount + tax);

  const inv = {
    id: newId(),
    invoice_number: await nextInvoiceNumber(),
    customer_id: body.customer_id || "",
    customer_name: body.customer_name || "عميل عابر",
    items,
    subtotal,
    discount,
    tax,
    total,
    payment_method: body.payment_method || "cash",
    cashier_id: user?.id || "",
    cashier_name: user?.name || "",
    created_at: nowIso(),
  };

  await db.invoices.add(inv);

  // Decrement stock for product items
  for (const it of items) {
    if (it.item_type === "product") {
      const p = await db.products.get(it.item_id);
      if (p) {
        await db.products.put({ ...p, stock: (p.stock || 0) - it.quantity });
      }
    }
  }

  // Update customer stats
  if (inv.customer_id) {
    const c = await db.customers.get(inv.customer_id);
    if (c) {
      await db.customers.put({
        ...c,
        total_spent: (c.total_spent || 0) + total,
        visits: (c.visits || 0) + 1,
      });
    }
  }

  return inv;
}

export async function deleteInvoice(id) {
  const { requireAdmin } = await import("./auth");
  await requireAdmin();
  await db.invoices.delete(id);
  return { ok: true };
}
