const express = require('express');
const { col } = require('../db');
const { adminOnly } = require('../auth');
const { adjustStock } = require('../inventory');
const { logAction } = require('../audit');

const router = express.Router();

// Список заказов на поставку (только админ).
router.get('/', adminOnly, async (req, res) => {
  const orders = await col('orders').find({});
  orders.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)) || b.id - a.id);

  const parts = await col('parts').find({});
  const partMap = Object.fromEntries(parts.map((p) => [p.id, p]));

  const data = orders.map((o) => ({
    ...o,
    items: (o.items || []).map((it) => ({
      ...it,
      part_name: partMap[it.part_id]?.name || '—',
      sku: partMap[it.part_id]?.sku || null,
      cost_price: partMap[it.part_id]?.cost_price || 0,
    })),
  }));
  res.json({ success: true, data: data.slice(0, 200) });
});

// Создание заявки на поставку (только админ).
// body: { supplier, items: [{part_id, expected_quantity}] }
router.post('/', adminOnly, async (req, res) => {
  const { supplier, items } = req.body || {};
  if (!supplier || !String(supplier).trim()) {
    return res.status(400).json({ success: false, error: "Ta'minotchi nomini kiriting" });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, error: "Kamida bitta ehtiyot qism qo'shing" });
  }

  const parts = await col('parts').find({});
  const partMap = Object.fromEntries(parts.map((p) => [p.id, p]));

  const orderItems = items.map((it) => {
    const expected = Math.max(0, Number(it.expected_quantity) || 0);
    const part = partMap[Number(it.part_id)];
    return {
      part_id: Number(it.part_id),
      expected_quantity: expected,
      actual_quantity: null,
      cost_price: part ? part.cost_price : 0,
    };
  }).filter((it) => it.expected_quantity > 0);

  if (orderItems.length === 0) {
    return res.status(400).json({ success: false, error: "Miqdor musbat bo'lishi kerak" });
  }

  const order = await col('orders').insert({
    supplier: String(supplier).trim(),
    items: orderItems,
    status: 'pending',
    shortage_cost: 0,
    created_by: req.user.id,
    created_at: new Date().toISOString(),
    received_at: null,
  });

  await logAction(req.user, 'order_create', 'order', order.id, { supplier, items: orderItems.length });
  res.status(201).json({ success: true, data: order });
});

// Подтверждение прихода заказа (только админ).
// body: { items: [{part_id, actual_quantity}] }
router.post('/:id/confirm', adminOnly, async (req, res) => {
  const id = Number(req.params.id);
  const order = await col('orders').findOne({ id });
  if (!order) return res.status(404).json({ success: false, error: "Buyurtma topilmadi" });
  if (order.status === 'received') {
    return res.status(400).json({ success: false, error: "Buyurtma allaqachon qabul qilingan" });
  }

  const { items } = req.body || {};
  if (!Array.isArray(items)) {
    return res.status(400).json({ success: false, error: "Miqdorlarni kiriting" });
  }

  const actualMap = {};
  for (const it of items) {
    actualMap[Number(it.part_id)] = Math.max(0, Number(it.actual_quantity) || 0);
  }

  let totalShortageCost = 0;
  const updatedItems = order.items.map((it) => {
    const actual = actualMap[it.part_id] !== undefined ? actualMap[it.part_id] : 0;
    const shortage = Math.max(0, it.expected_quantity - actual);
    const shortageCost = shortage * (it.cost_price || 0);
    totalShortageCost += shortageCost;

    // Зачисляем на склад фактическое количество.
    if (actual > 0) {
      adjustStock(it.part_id, 'warehouse', null, actual);
    }

    return {
      ...it,
      actual_quantity: actual,
      shortage,
      shortage_cost: shortageCost,
    };
  });

  await col('orders').update({ id }, {
    $set: {
      items: updatedItems,
      status: 'received',
      shortage_cost: totalShortageCost,
      received_at: new Date().toISOString(),
    },
  });

  await logAction(req.user, 'order_confirm', 'order', id, {
    supplier: order.supplier, shortage_cost: totalShortageCost,
  });

  res.json({ success: true, data: { id, shortage_cost: totalShortageCost } });
});

// Долги поставщиков (сумма недопоставок по каждому поставщику).
router.get('/debts', adminOnly, async (req, res) => {
  const orders = await col('orders').find({ status: 'received' });
  const debts = {};
  for (const o of orders) {
    if (o.shortage_cost > 0) {
      debts[o.supplier] = (debts[o.supplier] || 0) + o.shortage_cost;
    }
  }
  const data = Object.entries(debts).map(([supplier, amount]) => ({ supplier, amount }));
  data.sort((a, b) => b.amount - a.amount);
  res.json({ success: true, data });
});

module.exports = router;
