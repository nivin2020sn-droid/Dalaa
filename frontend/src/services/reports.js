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
