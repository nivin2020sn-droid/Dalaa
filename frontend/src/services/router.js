import * as auth from "./auth";
import * as invoices from "./invoices";
import * as settings from "./settings";
import * as reports from "./reports";
import { products, services, customers, appointments, expenses } from "./crud";

const resourceMap = {
  products, services, customers, appointments, expenses,
};

/**
 * Mini in-app router that mirrors the old FastAPI routes so the existing
 * frontend code (which calls `/auth/login`, `/products`, etc.) keeps working
 * without changes.
 */
async function handleGet(path) {
  if (path === "/auth/me") return await auth.me();
  if (path === "/auth/users") return await auth.listUsers();
  if (path === "/settings") return await settings.getSettings();
  if (path === "/reports/dashboard") return await reports.dashboardReport();
  if (path.startsWith("/reports/yearly-tax")) {
    const q = path.split("?")[1] || "";
    const year = new URLSearchParams(q).get("year");
    return await reports.yearlyTaxReport({ year });
  }
  if (path === "/invoices") return await invoices.listInvoices();

  const invMatch = path.match(/^\/invoices\/(.+)$/);
  if (invMatch) return await invoices.getInvoice(invMatch[1]);

  for (const key of Object.keys(resourceMap)) {
    if (path === `/${key}`) return await resourceMap[key].list();
  }
  throw notFound(path);
}

async function handlePost(path, body) {
  if (path === "/auth/login") return await auth.login(body);
  if (path === "/auth/register") return await auth.registerUser(body);
  if (path === "/auth/change-password") return await auth.changePassword(body);
  if (path === "/auth/reset-with-master") return await auth.resetWithMaster(body);
  if (path === "/invoices") return await invoices.createInvoice(body);

  const stornoMatch = path.match(/^\/invoices\/(.+)\/storno$/);
  if (stornoMatch) return await invoices.stornoInvoice(stornoMatch[1]);

  for (const key of Object.keys(resourceMap)) {
    if (path === `/${key}`) return await resourceMap[key].create(body);
  }
  throw notFound(path);
}

async function handlePut(path, body) {
  if (path === "/settings") return await settings.updateSettings(body);
  if (path === "/auth/profile") return await auth.updateProfile(body);
  for (const key of Object.keys(resourceMap)) {
    const m = path.match(new RegExp(`^\\/${key}\\/(.+)$`));
    if (m) return await resourceMap[key].update(m[1], body);
  }
  throw notFound(path);
}

async function handleDelete(path) {
  const invMatch = path.match(/^\/invoices\/(.+)$/);
  if (invMatch) return await invoices.deleteInvoice(invMatch[1]);
  for (const key of Object.keys(resourceMap)) {
    const m = path.match(new RegExp(`^\\/${key}\\/(.+)$`));
    if (m) return await resourceMap[key].remove(m[1]);
  }
  throw notFound(path);
}

function notFound(path) {
  const err = new Error(`No local route for ${path}`);
  err.response = { status: 404, data: { detail: err.message } };
  return err;
}

export const router = { get: handleGet, post: handlePost, put: handlePut, delete: handleDelete };
