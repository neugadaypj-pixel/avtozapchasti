const express = require('express');
const { col } = require('../db');
const { adjustStock, getQuantity } = require('../inventory');
const { logAction } = require('../audit');

const router = express.Router();

// Список продаж. Админ видит все, рабочий — только свои.
router.get('/', async (req, res) => {
  let rows = await col('sales').find({});
  rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)) || b.id - a.id);

  if (req.user.role !== 'admin') {
    rows = rows.filter((s) => s.worker_id === req.user.id);
  }
  rows = rows.slice(0, 300);

  const parts = await col('parts').find({});
  const partMap = Object.fromEntries(parts.map((p) => [p.id, p]));
  const users = await col('users').find({});
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

  const data = rows.map((s) => ({
    ...s,
    part_name: partMap[s.part_id]?.name || '—',
    sku: partMap[s.part_id]?.sku || null,
    worker_name: s.worker_id ? userMap[s.worker_id]?.full_name || '—' : null,
  }));
  res.json({ success: true, data });
});

// Продажа — только рабочие. Администратор продавать не может.
router.post('/', async (req, res) => {
  if (req.user.role === 'admin') {
    return res.status(403).json({ success: false, error: 'Продажи оформляют только рабочие' });
  }

  const { part_id, quantity, unit_price, client_name, client_phone, note } = req.body || {};
  const qty = Number(quantity);
  if (!part_id || !qty || qty <= 0 || !Number.isInteger(qty)) {
    return res.status(400).json({ success: false, error: 'Укажите целое положительное количество' });
  }

  const part = await col('parts').findOne({ id: Number(part_id) });
  if (!part) return res.status(404).json({ success: false, error: 'Запчасть не найдена' });

  const workerId = req.user.id;
  const available = await getQuantity(part.id, 'worker', workerId);
  if (available < qty) {
    return res.status(400).json({ success: false, error: `Недостаточно товара у рабочего. Доступно: ${available}` });
  }

  const price = unit_price !== undefined ? Number(unit_price) : part.sell_price;
  const total = price * qty;

  await adjustStock(part.id, 'worker', workerId, -qty);

  const s = await col('sales').insert({
    part_id: part.id,
    worker_id: workerId,
    quantity: qty,
    unit_price: price,
    total,
    client_name: client_name || null,
    client_phone: client_phone || null,
    note: note || null,
    created_at: new Date().toISOString(),
  });

  await logAction(req.user, 'sell', 'sale', s.id, { part: part.name, quantity: qty, total });
  res.status(201).json({ success: true, data: { id: s.id, total } });
});

module.exports = router;
