const express = require('express');
const { col } = require('../db');

const router = express.Router();

router.get('/', async (req, res) => {
  const isAdmin = req.user.role === 'admin';

  const [parts, inventory, users, sales] = await Promise.all([
    col('parts').find({}),
    col('inventory').find({}),
    col('users').find({}),
    col('sales').find({}),
  ]);

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const totalQuantity = inventory.reduce((s, r) => s + r.quantity, 0);
  const warehouseQuantity = inventory.filter((r) => r.owner_type === 'warehouse').reduce((s, r) => s + r.quantity, 0);
  const workersQuantity = inventory.filter((r) => r.owner_type === 'worker').reduce((s, r) => s + r.quantity, 0);
  const workersCount = users.filter((u) => u.role === 'worker' && u.is_active).length;

  // Мало остатков: по каждой запчасти сумма <= 3.
  const invByPart = {};
  for (const r of inventory) invByPart[r.part_id] = (invByPart[r.part_id] || 0) + r.quantity;
  const lowStockCount = parts.filter((p) => (invByPart[p.id] || 0) <= 3).length;

  const salesToday = sales.filter((s) => new Date(s.created_at) >= startOfDay);
  const salesMonth = sales.filter((s) => new Date(s.created_at) >= startOfMonth);

  const stats = {
    total_parts: parts.length,
    total_quantity: totalQuantity,
    warehouse_quantity: warehouseQuantity,
    workers_quantity: workersQuantity,
    workers_count: workersCount,
    low_stock_count: lowStockCount,
    sales_today: {
      c: salesToday.length,
      s: salesToday.reduce((sum, x) => sum + (x.total || 0), 0),
    },
    sales_month: {
      c: salesMonth.length,
      s: salesMonth.reduce((sum, x) => sum + (x.total || 0), 0),
    },
  };

  // Продажи за последние 7 дней.
  const dayKeys = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    dayKeys.push(d.toISOString().slice(0, 10));
  }
  const relevantSales = sales.filter((s) => (isAdmin ? true : s.worker_id === req.user.id));
  const byDay = {};
  for (const s of relevantSales) {
    const key = new Date(s.created_at).toISOString().slice(0, 10);
    if (dayKeys.includes(key)) {
      byDay[key] = (byDay[key] || 0) + (s.total || 0);
    }
  }
  const salesByDay = dayKeys.map((day) => ({ day, total: byDay[day] || 0 }));

  // Топ рабочих за месяц (только админ).
  let topWorkers = [];
  if (isAdmin) {
    const workerMap = Object.fromEntries(users.map((u) => [u.id, u]));
    const agg = {};
    for (const s of salesMonth) {
      if (!agg[s.worker_id]) agg[s.worker_id] = { total: 0, count: 0 };
      agg[s.worker_id].total += s.total || 0;
      agg[s.worker_id].count += 1;
    }
    topWorkers = Object.entries(agg)
      .filter(([wid]) => workerMap[wid] && workerMap[wid].role === 'worker')
      .map(([wid, v]) => ({
        id: Number(wid),
        full_name: workerMap[wid].full_name,
        city: workerMap[wid].city,
        total: v.total,
        count: v.count,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }

  let myStock = null;
  let recentSales = [];
  if (isAdmin) {
    recentSales = sales
      .slice()
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)) || b.id - a.id)
      .slice(0, 8);
  } else {
    myStock = inventory
      .filter((r) => r.worker_id === req.user.id && r.quantity > 0)
      .map((r) => {
        const p = parts.find((x) => x.id === r.part_id);
        return {
          quantity: r.quantity,
          name: p?.name || '—',
          sku: p?.sku || null,
          sell_price: p?.sell_price || 0,
        };
      });
    recentSales = sales
      .filter((s) => s.worker_id === req.user.id)
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)) || b.id - a.id)
      .slice(0, 8);
  }

  const partMap = Object.fromEntries(parts.map((p) => [p.id, p]));
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
  recentSales = recentSales.map((s) => ({
    ...s,
    part_name: partMap[s.part_id]?.name || '—',
    worker_name: s.worker_id ? userMap[s.worker_id]?.full_name || '—' : null,
  }));

  res.json({
    success: true,
    data: { stats, my_stock: myStock, recent_sales: recentSales, sales_by_day: salesByDay, top_workers: topWorkers },
  });
});

module.exports = router;
