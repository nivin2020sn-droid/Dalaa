import db from "../db/db";
import { newId, nowIso } from "../db/seed";

/**
 * Generic CRUD helper factory — eliminates repetition across resources.
 */
export function makeCrud(tableName, { defaults = () => ({}), adminDelete = true } = {}) {
  return {
    async list() {
      return await db[tableName].toArray();
    },
    async get(id) {
      const item = await db[tableName].get(id);
      if (!item) {
        const err = new Error("Not found");
        err.response = { status: 404, data: { detail: err.message } };
        throw err;
      }
      return item;
    },
    async create(body) {
      const record = {
        id: newId(),
        ...defaults(),
        ...body,
        created_at: nowIso(),
      };
      await db[tableName].add(record);
      return record;
    },
    async update(id, body) {
      const existing = await db[tableName].get(id);
      if (!existing) {
        const err = new Error("Not found");
        err.response = { status: 404, data: { detail: err.message } };
        throw err;
      }
      const updated = { ...existing, ...body, id };
      await db[tableName].put(updated);
      return updated;
    },
    async remove(id) {
      if (adminDelete) {
        const { requireAdmin } = await import("./auth");
        await requireAdmin();
      }
      await db[tableName].delete(id);
      return { ok: true };
    },
  };
}

export const products = makeCrud("products", {
  defaults: () => ({
    sku: "", category: "", cost_price: 0, sale_price: 0,
    stock: 0, min_stock: 5, image_url: "",
  }),
});

export const services = makeCrud("services", {
  defaults: () => ({ category: "", duration_minutes: 30, price: 0, description: "" }),
});

export const customers = makeCrud("customers", {
  defaults: () => ({ phone: "", email: "", notes: "", total_spent: 0, visits: 0 }),
});

export const appointments = makeCrud("appointments", {
  adminDelete: false,
  defaults: () => ({ customer_id: "", service_id: "", status: "pending", notes: "" }),
});

export const expenses = makeCrud("expenses", {
  defaults: () => ({ notes: "" }),
});
