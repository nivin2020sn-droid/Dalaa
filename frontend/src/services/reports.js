import db from "../db/db";

export async function dashboardReport() {
  const [invoices, expenses, products, customersCount, apptsCount] = await Promise.all([
    db.invoices.toArray(),
    db.expenses.toArray(),
    db.products.toArray(),
    db.customers.count(),
    db.appointments.count(),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const monthPrefix = today.slice(0, 7);

  const total_revenue = invoices.reduce((s, i) => s + (i.total || 0), 0);
  const total_expenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const today_revenue = invoices
    .filter((i) => (i.created_at || "").startsWith(today))
    .reduce((s, i) => s + (i.total || 0), 0);
  const month_revenue = invoices
    .filter((i) => (i.created_at || "").startsWith(monthPrefix))
    .reduce((s, i) => s + (i.total || 0), 0);

  const productMap = Object.fromEntries(products.map((p) => [p.id, p]));
  let total_cost = 0;
  const productSales = {};
  const serviceSales = {};
  for (const inv of invoices) {
    for (const it of inv.items || []) {
      if (it.item_type === "product") {
        const p = productMap[it.item_id];
        if (p) total_cost += (p.cost_price || 0) * (it.quantity || 0);
        productSales[it.name] = (productSales[it.name] || 0) + (it.quantity || 0);
      } else {
        serviceSales[it.name] = (serviceSales[it.name] || 0) + (it.quantity || 0);
      }
    }
  }

  const profit = total_revenue - total_cost - total_expenses;
  const low_stock = products.filter((p) => (p.stock || 0) <= (p.min_stock || 0));

  // Sales by day (last 14 days)
  const daysMap = {};
  const today_dt = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today_dt);
    d.setDate(today_dt.getDate() - i);
    daysMap[d.toISOString().slice(0, 10)] = 0;
  }
  for (const inv of invoices) {
    const dt = (inv.created_at || "").slice(0, 10);
    if (dt in daysMap) daysMap[dt] += inv.total || 0;
  }
  const sales_by_day = Object.entries(daysMap).map(([date, revenue]) => ({ date, revenue }));

  const top_products = Object.entries(productSales)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));
  const top_services = Object.entries(serviceSales)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  return {
    total_revenue: Math.round(total_revenue * 100) / 100,
    total_expenses: Math.round(total_expenses * 100) / 100,
    today_revenue: Math.round(today_revenue * 100) / 100,
    month_revenue: Math.round(month_revenue * 100) / 100,
    profit: Math.round(profit * 100) / 100,
    invoices_count: invoices.length,
    customers_count: customersCount,
    appointments_count: apptsCount,
    low_stock,
    sales_by_day,
    top_products,
    top_services,
  };
}

/**
 * German annual tax report (Jahres-Umsatzsteuer-Zusammenstellung).
 * Aggregates all active invoices (including reversals — they subtract automatically
 * because their totals are negative) for the given calendar year.
 *
 * Returns: year, gross/net/VAT totals, per-rate breakdown, per-month breakdown,
 * total expenses, profit, invoice counts.
 */
export async function yearlyTaxReport({ year } = {}) {
  const y = Number(year) || new Date().getFullYear();
  const [invoices, expenses] = await Promise.all([
    db.invoices.toArray(),
    db.expenses.toArray(),
  ]);

  const yearPrefix = String(y);
  const yearInv = invoices.filter((i) => (i.created_at || "").startsWith(yearPrefix));
  const yearExp = expenses.filter((e) => (e.date || "").startsWith(yearPrefix));

  // Aggregate per VAT rate and per month
  const byRate = {};
  const byMonth = {};
  let active_count = 0;
  let reversal_count = 0;
  let gross_sum = 0;
  let net_sum = 0;
  let vat_sum = 0;

  for (let m = 1; m <= 12; m++) {
    const key = String(m).padStart(2, "0");
    byMonth[key] = { month: key, gross: 0, net: 0, vat: 0, count: 0 };
  }

  for (const inv of yearInv) {
    if (inv.status === "reversal") reversal_count += 1;
    else active_count += 1;

    const monthKey = (inv.created_at || "").slice(5, 7);
    if (byMonth[monthKey]) {
      byMonth[monthKey].gross += inv.total || 0;
      byMonth[monthKey].net += inv.net_total || 0;
      byMonth[monthKey].vat += inv.vat_total || 0;
      byMonth[monthKey].count += 1;
    }

    gross_sum += inv.total || 0;
    net_sum += inv.net_total || 0;
    vat_sum += inv.vat_total || 0;

    for (const b of inv.vat_breakdown || []) {
      const rate = Number(b.rate);
      byRate[rate] = byRate[rate] || { rate, net: 0, vat: 0, gross: 0 };
      byRate[rate].net += Number(b.net || 0);
      byRate[rate].vat += Number(b.vat || 0);
      byRate[rate].gross += Number(b.gross || 0);
    }
  }

  const rates = Object.values(byRate)
    .map((r) => ({
      rate: r.rate,
      net: Math.round(r.net * 100) / 100,
      vat: Math.round(r.vat * 100) / 100,
      gross: Math.round(r.gross * 100) / 100,
    }))
    .sort((a, b) => b.rate - a.rate);

  const months = Object.values(byMonth).map((m) => ({
    month: m.month,
    gross: Math.round(m.gross * 100) / 100,
    net: Math.round(m.net * 100) / 100,
    vat: Math.round(m.vat * 100) / 100,
    count: m.count,
  }));

  const expenses_total = yearExp.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const profit = net_sum - expenses_total; // Gewinn (net revenue − expenses)

  return {
    year: y,
    generated_at: new Date().toISOString(),
    invoices_count: yearInv.length,
    active_invoices: active_count,
    reversal_invoices: reversal_count,
    gross_total: Math.round(gross_sum * 100) / 100,
    net_total: Math.round(net_sum * 100) / 100,
    vat_total: Math.round(vat_sum * 100) / 100,
    expenses_total: Math.round(expenses_total * 100) / 100,
    profit: Math.round(profit * 100) / 100,
    by_rate: rates,
    by_month: months,
  };
}
