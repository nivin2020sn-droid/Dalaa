import db from "../db/db";
import { newId, nowIso } from "../db/seed";
import { currentUser } from "./auth";
import { getSettings } from "./settings";
import { isTseConfigured, signInvoice as tseSignInvoice, signStorno as tseSignStorno, TSE_STATUS } from "./tse";
import { archiveInvoice as archiveInvoiceRemote, ARCHIVE_STATUS } from "./archive";

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
    // --- TSE / KassenSichV envelope (filled below) ---
    tse_status: TSE_STATUS.NOT_REQUIRED,
    tse_signature: null,
    tse_serial: null,
    tse_counter: null,
    tse_timestamp: null,
    tse_qr_code: null,
    tse_error_message: null,
    // --- External archive status (filled below after TSE success) ---
    archive_status: ARCHIVE_STATUS.NOT_REQUIRED,
    archived_at: null,
    archive_error: null,
  };

  // ──────────────────────────────────────────────────────────────────
  // TSE / KassenSichV signing (German fiscal compliance).
  // If the merchant has configured a Backend + TSS/Client IDs, we MUST
  // obtain a TSE signature from the backend BEFORE we commit the invoice
  // as final. On any failure we still persist the record but mark it as
  // "pending" so it cannot be treated as a legal receipt yet.
  // ──────────────────────────────────────────────────────────────────
  const appSettings = await getSettings();
  const tseCfg = appSettings?.tse;
  if (isTseConfigured(tseCfg)) {
    const payload = {
      invoice_number: inv.invoice_number,
      timestamp_client: inv.created_at,
      payment_method: inv.payment_method,
      totals: {
        gross: inv.total,
        net:   inv.net_total,
        vat:   inv.vat_total,
        by_rate: inv.vat_breakdown,
      },
      items: inv.items.map((it) => ({
        name:       it.name,
        quantity:   it.quantity,
        unit_price: it.unit_price,
        vat_rate:   it.vat_rate,
        total:      it.total,
      })),
    };
    try {
      const tse = await tseSignInvoice(tseCfg, payload);
      inv.tse_status    = TSE_STATUS.SIGNED;
      inv.tse_signature = tse.signature ?? null;
      inv.tse_serial    = tse.serial    ?? null;
      inv.tse_counter   = tse.counter   ?? null;
      inv.tse_timestamp = tse.timestamp ?? null;
      inv.tse_qr_code   = tse.qr_code   ?? null;
      // Invoice now qualifies for external archiving — mark as pending
      // and attempt the upload below. Failure is non-fatal.
      inv.archive_status = ARCHIVE_STATUS.PENDING;
    } catch (e) {
      inv.tse_status        = TSE_STATUS.PENDING;
      inv.tse_error_message = e?.message || "TSE signing failed";
      // Remember the last error at the settings level so the UI surface
      // (TSE settings card) can show it without hunting through invoices.
      await db.settings.put({
        ...(appSettings || { id: "main" }),
        id: "main",
        tse: {
          ...(tseCfg || {}),
          last_error: inv.tse_error_message,
          last_error_at: nowIso(),
        },
      });
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // External archive (TSE-signed invoices only). Best-effort: if the
  // backend is unreachable the invoice stays TSE-signed and valid but
  // is marked as `archive_status = pending` so the user can retry
  // from the Pending Archive page.
  // ──────────────────────────────────────────────────────────────────
  if (inv.tse_status === TSE_STATUS.SIGNED && isTseConfigured(tseCfg)) {
    try {
      const r = await archiveInvoiceRemote(tseCfg, inv);
      inv.archive_status = ARCHIVE_STATUS.ARCHIVED;
      inv.archived_at    = r?.archived_at || nowIso();
      inv.archive_error  = null;
    } catch (e) {
      inv.archive_status = ARCHIVE_STATUS.PENDING;
      inv.archive_error  = e?.message || "Archive upload failed";
    }
  }

  await db.invoices.add(inv);
  await writeAudit(
    inv.tse_status === TSE_STATUS.SIGNED ? "invoice_create" : "invoice_create_pending_tse",
    inv.id,
    { number: inv.invoice_number, total, tse_status: inv.tse_status },
  );

  // If TSE is required but signing failed, surface the problem to the
  // caller so the UI can block / warn — invoice stays in DB as "pending".
  if (inv.tse_status === TSE_STATUS.PENDING) {
    const err = new Error(
      "فشل توقيع TSE — تم حفظ الفاتورة كـ Pending ولم تُصدَر رسمياً. " +
      (inv.tse_error_message || ""),
    );
    err.code = "TSE_PENDING";
    err.invoice = inv;
    err.response = { status: 502, data: { detail: err.message, invoice: inv } };
    throw err;
  }

  // Persist a successful signature summary onto the settings row so the
  // TSE settings card can show it at a glance.
  if (inv.tse_status === TSE_STATUS.SIGNED) {
    await db.settings.put({
      ...(appSettings || { id: "main" }),
      id: "main",
      tse: {
        ...(tseCfg || {}),
        last_signature_at:      inv.tse_timestamp || nowIso(),
        last_signature_counter: inv.tse_counter,
        last_signature_serial:  inv.tse_serial,
        last_error:             null,
        last_error_at:          null,
      },
    });
  }

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
    tse_status: TSE_STATUS.NOT_REQUIRED,
    tse_signature: null,
    tse_serial: null,
    tse_counter: null,
    tse_timestamp: null,
    tse_qr_code: null,
    tse_error_message: null,
  };

  // TSE signing for storno (reverse transaction).
  const appSettings = await getSettings();
  const tseCfg = appSettings?.tse;
  if (isTseConfigured(tseCfg) && original.tse_status === TSE_STATUS.SIGNED) {
    const payload = {
      invoice_number:    storno.invoice_number,
      timestamp_client:  storno.created_at,
      payment_method:    storno.payment_method,
      storno_of:         original.invoice_number,
      storno_reference:  original.tse_signature,
      totals: {
        gross: storno.total,
        net:   storno.net_total,
        vat:   storno.vat_total,
        by_rate: storno.vat_breakdown,
      },
      items: storno.items.map((it) => ({
        name: it.name, quantity: it.quantity, unit_price: it.unit_price,
        vat_rate: it.vat_rate, total: it.total,
      })),
    };
    try {
      const tse = await tseSignStorno(tseCfg, payload);
      storno.tse_status    = TSE_STATUS.SIGNED;
      storno.tse_signature = tse.signature ?? null;
      storno.tse_serial    = tse.serial    ?? null;
      storno.tse_counter   = tse.counter   ?? null;
      storno.tse_timestamp = tse.timestamp ?? null;
      storno.tse_qr_code   = tse.qr_code   ?? null;
      storno.archive_status = ARCHIVE_STATUS.PENDING;
    } catch (e) {
      storno.tse_status        = TSE_STATUS.PENDING;
      storno.tse_error_message = e?.message || "TSE storno signing failed";
    }
  }

  // External archive for the storno (best-effort, non-blocking).
  if (storno.tse_status === TSE_STATUS.SIGNED && isTseConfigured(await getSettings().then(s => s?.tse))) {
    try {
      const cfg = (await getSettings())?.tse;
      const r = await archiveInvoiceRemote(cfg, storno);
      storno.archive_status = ARCHIVE_STATUS.ARCHIVED;
      storno.archived_at    = r?.archived_at || nowIso();
      storno.archive_error  = null;
    } catch (e) {
      storno.archive_status = ARCHIVE_STATUS.PENDING;
      storno.archive_error  = e?.message || "Archive upload failed";
    }
  }

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
 * List all invoices whose archive_status is "pending" (TSE-signed but
 * not yet persisted to the backend archive).
 */
export async function listPendingArchive() {
  const rows = await db.invoices.where("archive_status").equals(ARCHIVE_STATUS.PENDING).toArray();
  // Sort oldest → newest so retrying is predictable.
  rows.sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
  return rows;
}

/**
 * Retry archiving a specific pending invoice. On success updates the
 * local record to "archived".
 */
export async function retryArchive(invoiceId) {
  const inv = await db.invoices.get(invoiceId);
  if (!inv) throw new Error("Invoice not found");
  if (inv.tse_status !== TSE_STATUS.SIGNED) {
    throw new Error("Cannot archive — invoice is not TSE-signed");
  }
  const s = await getSettings();
  const tseCfg = s?.tse;
  if (!isTseConfigured(tseCfg)) throw new Error("TSE backend not configured");

  try {
    const r = await archiveInvoiceRemote(tseCfg, inv);
    await db.invoices.update(invoiceId, {
      archive_status: ARCHIVE_STATUS.ARCHIVED,
      archived_at:    r?.archived_at || nowIso(),
      archive_error:  null,
    });
    await writeAudit("invoice_archived", invoiceId, {
      number: inv.invoice_number, archived_at: r?.archived_at,
    });
    return { ok: true };
  } catch (e) {
    const msg = e?.message || "Archive retry failed";
    await db.invoices.update(invoiceId, { archive_error: msg });
    throw e;
  }
}

/** Retry every pending invoice sequentially. Returns { total, archived, failed }. */
export async function retryAllPendingArchive() {
  const list = await listPendingArchive();
  let ok = 0, failed = 0;
  for (const inv of list) {
    try { await retryArchive(inv.id); ok += 1; }
    catch { failed += 1; }
  }
  return { total: list.length, archived: ok, failed };
}

/**
 * GoBD: Invoices MUST NOT be deleted.
 */
export async function deleteInvoice() {
  const err = new Error("لا يمكن حذف الفواتير — استخدم Storno");
  err.response = { status: 403, data: { detail: err.message } };
  throw err;
}
