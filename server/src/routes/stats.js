const express = require('express');
const { col } = require('../db');
const { adminOnly } = require('../auth');

const router = express.Router();
router.use(adminOnly);

// Сводная статистика: продажи по дням/месяцам, по городам, топ запчастей,
// прибыль по запчастям, мало остатков.
router.get('/', async (req, res) => {
  const [sales, parts, inventory, users, transfers] = await Promise.all([
    col('sales').find({}),
    col('parts').find({}),
    col('inventory').find({}),
    col('users').find({}),
    col('transfers').find({}),
  ]);

  const partMap = Object.fromEntries(parts.map((p) => [p.id, p]));
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

  // --- Продажи по дням (последние 30 дней) ---
  const dayMap = {};
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    dayMap[d.toISOString().slice(0, 10)] = 0;
  }
  const salesByDay = {};
  for (const s of sales) {
    const key = new Date(s.created_at).toISOString().slice(0, 10);
    if (dayMap[key] !== undefined) {
      salesByDay[key] = (salesByDay[key] || 0) + s.total;
    }
  }
  const daily = Object.keys(dayMap).map((day) => ({ day, total: salesByDay[day] || 0 }));

  // --- Продажи по месяцам ---
  const monthMap = {};
  for (const s of sales) {
    const key = new Date(s.created_at).toISOString().slice(0, 7);
    monthMap[key] = (monthMap[key] || 0) + s.total;
  }
  const monthly = Object.entries(monthMap)
    .map(([month, total]) => ({ month, total }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // --- Продажи по городам (по рабочим) ---
  const cityMap = {};
  for (const s of sales) {
    const worker = userMap[s.worker_id];
    const city = worker?.city || "Noma'lum";
    cityMap[city] = cityMap[city] || { total: 0, count: 0 };
    cityMap[city].total += s.total;
    cityMap[city].count += 1;
  }
  const byCity = Object.entries(cityMap)
    .map(([city, v]) => ({ city, total: v.total, count: v.count }))
    .sort((a, b) => b.total - a.total);

  // --- Топ запчастей по продажам и прибыли ---
  const partSales = {};
  for (const s of sales) {
    partSales[s.part_id] = partSales[s.part_id] || { qty: 0, revenue: 0 };
    partSales[s.part_id].qty += s.quantity;
    partSales[s.part_id].revenue += s.total;
  }
  const topParts = Object.entries(partSales)
    .map(([pid, v]) => {
      const p = partMap[pid];
      const cost = p ? p.cost_price * v.qty : 0;
      return {
        part_id: Number(pid),
        name: p?.name || `#${pid}`,
        sku: p?.sku || null,
        quantity: v.qty,
        revenue: v.revenue,
        cost,
        profit: v.revenue - cost,
      };
    })
    .sort((a, b) => b.profit - a.profit);

  // --- Мало остатков ---
  const invByPart = {};
  for (const r of inventory) invByPart[r.part_id] = (invByPart[r.part_id] || 0) + r.quantity;
  const lowStock = parts
    .filter((p) => (invByPart[p.id] || 0) <= 3)
    .map((p) => ({
      part_id: p.id,
      name: p.name,
      sku: p.sku,
      quantity: invByPart[p.id] || 0,
      recommended: Math.max(5, 10 - (invByPart[p.id] || 0)),
    }));

  // --- Закупки (приход) ---
  const restocks = transfers.filter((t) => t.type === 'restock');
  const totalPurchase = restocks.reduce((s, t) => s + (t.purchase_cost || 0), 0);

  // --- Итоговая выручка и прибыль ---
  const paidSales = sales.filter((s) => s.payment_status === 'paid');
  const totalRevenue = paidSales.reduce((s, x) => s + x.total, 0);
  const totalCost = paidSales.reduce((s, x) => {
    const p = partMap[x.part_id];
    return s + (p ? p.cost_price * x.quantity : 0);
  }, 0);

  res.json({
    success: true,
    data: {
      daily,
      monthly,
      by_city: byCity,
      top_parts: topParts.slice(0, 20),
      low_stock: lowStock,
      summary: {
        total_sales: sales.length,
        total_revenue: totalRevenue,
        total_cost: totalCost,
        total_profit: totalRevenue - totalCost,
        total_purchase: totalPurchase,
        low_stock_count: lowStock.length,
      },
    },
  });
});

module.exports = router;
