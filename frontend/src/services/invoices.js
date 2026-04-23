import db from "../db/db";
import { newId, nowIso } from "../db/seed";
import { currentUser } from "./auth";

async function nextInvoiceNumber() {
  const count = await db.invoices.count();
  return `INV-${String(count + 1).padStart(6, "0")}`;
}

async function writeAudit(action, entity, payload = {}) {
  const user = await currentUser();
  await db.audit_log.add({
    id: newId(),
    created_at: nowIso(),
    actor_id: user?.id || "",
    actor_name: user?.name || "",
    action,
    entity,
    payload: JSON.stringify(payload),
  });
}

/**
 * Compute VAT breakdown on invoice items. Each item carries vat_rate.
 * Items store GROSS unit price (Brutto — tax-inclusive). The net and VAT
 * amounts are derived by reverse-calculation from the gross.
 */
function computeVat(items) {
  const byRate = {};
  for (const it of items) {
    const rate = Number(it.vat_rate ?? 19);
    const gross = Number(it.total || 0);
    const net = Math.round((gross / (1 + rate / 100)) * 100) / 100;
    const vat = Math.round((gross - net) * 100) / 100;
    byRate[rate] = byRate[rate] || { rate, net: 0, vat: 0, gross: 0 };
    byRate[rate].net += net;
    byRate[rate].vat += vat;
    byRate[rate].gross += gross;
  }
  const breakdown = Object.values(byRate).map((b) => ({
    rate: b.rate,
    net: Math.round(b.net * 100) / 100,
    vat: Math.round(b.vat * 100) / 100,
    gross: Math.round(b.gross * 100) / 100,
  }));
  const net_total = breakdown.reduce((s, b) => s + b.net, 0);
  const vat_total = breakdown.reduce((s, b) => s + b.vat, 0);
  const gross_total = breakdown.reduce((s, b) => s + b.gross, 0);
  return {
    breakdown,
    net_total: Math.round(net_total * 100) / 100,
    vat_total: Math.round(vat_total * 100) / 100,
    gross_total: Math.round(gross_total * 100) / 100,
  };
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

  // Enrich items with their VAT rate at time of sale (snapshot, legally important).
  // Prices are GROSS (Brutto — tax-inclusive). Net and VAT are derived.
  const items = [];
  for (const it of body.items || []) {
    let vat_rate = it.vat_rate;
    if (vat_rate === undefined) {
      if (it.item_type === "product") {
        const p = await db.products.get(it.item_id);
        vat_rate = p?.vat_rate ?? 19;
      } else {
        const s = await db.services.get(it.item_id);
        vat_rate = s?.vat_rate ?? 19;
      }
    }
    const qty = Number(it.quantity || 0);
    const unit_price = Number(it.unit_price || 0); // GROSS unit price (incl. VAT)
    const rate = Number(vat_rate);
    const gross_line = Math.round(qty * unit_price * 100) / 100;
    const net_line = Math.round((gross_line / (1 + rate / 100)) * 100) / 100;
    const vat_line = Math.round((gross_line - net_line) * 100) / 100;
    items.push({
      item_id: it.item_id,
      item_type: it.item_type,
      name: it.name,
      quantity: qty,
      unit_price,            // GROSS per unit (what customer pays per unit)
      net_total: net_line,   // line net (derived)
      vat_total: vat_line,   // line vat (derived)
      total: gross_line,     // line gross
      vat_rate: rate,
    });
  }

  const vat = computeVat(items);
  const discount = Number(body.discount || 0);
  const extra_tax = Number(body.tax || 0); // optional extra manual fee
  const gross = vat.gross_total;
  const total = Math.max(0, Math.round((gross - discount + extra_tax) * 100) / 100);

  const inv = {
    id: newId(),
    invoice_number: await nextInvoiceNumber(),
    customer_id: body.customer_id || "",
    customer_name: body.customer_name || "عميل عابر",
    items,
    subtotal: gross,          // gross subtotal (line items)
    discount,
    tax: extra_tax,
    total,                     // final total after discount
    net_total: vat.net_total,
    vat_total: vat.vat_total,
    vat_breakdown: vat.breakdown,
    payment_method: body.payment_method || "cash",
    status: "active",
    storno_of: null,
    cashier_id: user?.id || "",
    cashier_name: user?.name || "",
    created_at: nowIso(),
  };

  await db.invoices.add(inv);
  await writeAudit("invoice_create", inv.id, { number: inv.invoice_number, total });

  // Decrement product stock
  for (const it of items) {
    if (it.item_type === "product") {
      const p = await db.products.get(it.item_id);
      if (p) await db.products.put({ ...p, stock: (p.stock || 0) - it.quantity });
    }
  }

  // Update customer stats (uses gross total)
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

/**
 * GoBD-compliant cancellation: create a NEW invoice with negative values
 * referencing the original. Neither invoice is ever deleted or modified.
 * The original keeps its full data; the storno invoice has status="reversal"
 * and storno_of = original.id.
 */
export async function stornoInvoice(originalId) {
  const original = await db.invoices.get(originalId);
  if (!original) {
    const err = new Error("Invoice not found");
    err.response = { status: 404, data: { detail: err.message } };
    throw err;
  }

  // Prevent cascading storno / double cancellation
  const hasReversal = await db.invoices.where("storno_of").equals(originalId).first();
  if (hasReversal || original.status === "reversal") {
    const err = new Error("هذه الفاتورة ملغاة بالفعل");
    err.response = { status: 400, data: { detail: err.message } };
    throw err;
  }

  const user = await currentUser();
  const negated = (original.items || []).map((it) => ({
    ...it,
    quantity: -Math.abs(it.quantity),
    total: -Math.abs(it.total),
  }));

  const storno = {
    id: newId(),
    invoice_number: await nextInvoiceNumber(),
    customer_id: original.customer_id,
    customer_name: original.customer_name,
    items: negated,
    subtotal: -Math.abs(original.subtotal || 0),
    discount: -Math.abs(original.discount || 0),
    tax: -Math.abs(original.tax || 0),
    total: -Math.abs(original.total || 0),
    net_total: -Math.abs(original.net_total || 0),
    vat_total: -Math.abs(original.vat_total || 0),
    vat_breakdown: (original.vat_breakdown || []).map((b) => ({
      rate: b.rate,
      net: -Math.abs(b.net),
      vat: -Math.abs(b.vat),
      gross: -Math.abs(b.gross),
    })),
    payment_method: original.payment_method,
    status: "reversal",
    storno_of: original.id,
    storno_of_number: original.invoice_number,
    cashier_id: user?.id || "",
    cashier_name: user?.name || "",
    created_at: nowIso(),
  };
  await db.invoices.add(storno);
  await writeAudit("invoice_storno", storno.id, {
    storno_of: original.invoice_number,
    storno_number: storno.invoice_number,
  });

  // Restock products that were sold on the original invoice
  for (const it of original.items || []) {
    if (it.item_type === "product") {
      const p = await db.products.get(it.item_id);
      if (p) await db.products.put({ ...p, stock: (p.stock || 0) + Math.abs(it.quantity) });
    }
  }

  // Reverse customer stats
  if (original.customer_id) {
    const c = await db.customers.get(original.customer_id);
    if (c) {
      await db.customers.put({
        ...c,
        total_spent: Math.max(0, (c.total_spent || 0) - Math.abs(original.total || 0)),
        visits: Math.max(0, (c.visits || 0) - 1),
      });
    }
  }

  return storno;
}

/**
 * GoBD: Invoices MUST NOT be deleted. This function is kept as a no-op
 * that throws, to prevent any UI code accidentally deleting.
 */
export async function deleteInvoice() {
  const err = new Error("لا يمكن حذف الفواتير — استخدم Storno");
  err.response = { status: 403, data: { detail: err.message } };
  throw err;
}
