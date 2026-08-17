const express = require('express');
const { col } = require('../db');
const { adminOnly } = require('../auth');
const { adjustStock, getQuantity } = require('../inventory');
const { logAction } = require('../audit');

const router = express.Router();

// История передач. Админ видит все, рабочий — только свои.
router.get('/', async (req, res) => {
  let rows;
  const all = await col('transfers').find({});
  all.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)) || b.id - a.id);

  if (req.user.role === 'admin') {
    rows = all.slice(0, 200);
  } else {
    rows = all
      .filter((t) => t.from_worker_id === req.user.id || t.to_worker_id === req.user.id)
      .slice(0, 200);
  }

  const parts = await col('parts').find({});
  const partMap = Object.fromEntries(parts.map((p) => [p.id, p]));
  const users = await col('users').find({});
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

  const data = rows.map((t) => ({
    ...t,
    part_name: partMap[t.part_id]?.name || '—',
    sku: partMap[t.part_id]?.sku || null,
    from_name: t.from_worker_id ? userMap[t.from_worker_id]?.full_name || '—' : null,
    to_name: t.to_worker_id ? userMap[t.to_worker_id]?.full_name || '—' : null,
    created_by_name: t.created_by ? userMap[t.created_by]?.full_name || '—' : null,
  }));
  res.json({ success: true, data });
});

// Распределение со склада рабочему (админ).
router.post('/assign', adminOnly, async (req, res) => {
  const { part_id, to_worker_id, quantity, reason } = req.body || {};
  const qty = Number(quantity);
  if (!part_id || !to_worker_id || !qty || qty <= 0 || !Number.isInteger(qty)) {
    return res.status(400).json({ success: false, error: 'Укажите запчасть, рабочего и целое положительное количество' });
  }

  const part = await col('parts').findOne({ id: Number(part_id) });
  if (!part) return res.status(404).json({ success: false, error: 'Запчасть не найдена' });

  const worker = await col('users').findOne({ id: Number(to_worker_id), role: 'worker' });
  if (!worker) return res.status(404).json({ success: false, error: 'Рабочий не найден' });

  const warehouseQty = await getQuantity(part.id, 'warehouse', null);
  if (warehouseQty < qty) {
    return res.status(400).json({ success: false, error: `На складе недостаточно. Доступно: ${warehouseQty}` });
  }

  await adjustStock(part.id, 'warehouse', null, -qty);
  await adjustStock(part.id, 'worker', worker.id, qty);

  const t = await col('transfers').insert({
    part_id: part.id,
    quantity: qty,
    from_type: 'warehouse',
    to_type: 'worker',
    to_worker_id: worker.id,
    type: 'assign',
    reason: reason || null,
    created_by: req.user.id,
    created_at: new Date().toISOString(),
  });

  await logAction(req.user, 'assign', 'transfer', t.id, { part: part.name, quantity: qty, to: worker.full_name });
  res.status(201).json({ success: true, data: { id: t.id } });
});

// Возврат товара на склад.
router.post('/return', async (req, res) => {
  const { part_id, quantity, from_worker_id, reason } = req.body || {};
  const qty = Number(quantity);
  if (!part_id || !qty || qty <= 0 || !Number.isInteger(qty)) {
    return res.status(400).json({ success: false, error: 'Укажите целое положительное количество' });
  }

  const part = await col('parts').findOne({ id: Number(part_id) });
  if (!part) return res.status(404).json({ success: false, error: 'Запчасть не найдена' });

  let workerId;
  if (req.user.role === 'admin') {
    workerId = from_worker_id ? Number(from_worker_id) : null;
  } else {
    workerId = req.user.id;
  }
  if (!workerId) {
    return res.status(400).json({ success: false, error: 'Укажите рабочего, у которого забрать товар' });
  }

  const workerQty = await getQuantity(part.id, 'worker', workerId);
  if (workerQty < qty) {
    return res.status(400).json({ success: false, error: `У рабочего недостаточно. Доступно: ${workerQty}` });
  }

  await adjustStock(part.id, 'worker', workerId, -qty);
  await adjustStock(part.id, 'warehouse', null, qty);

  const t = await col('transfers').insert({
    part_id: part.id,
    quantity: qty,
    from_type: 'worker',
    from_worker_id: workerId,
    to_type: 'warehouse',
    type: 'return',
    reason: reason || null,
    created_by: req.user.id,
    created_at: new Date().toISOString(),
  });

  await logAction(req.user, 'return', 'transfer', t.id, { part: part.name, quantity: qty, reason });
  res.status(201).json({ success: true, data: { id: t.id } });
});

// Пополнение склада (приход из Китая) — только админ.
router.post('/restock', adminOnly, async (req, res) => {
  const { part_id, quantity, reason } = req.body || {};
  const qty = Number(quantity);
  if (!part_id || !qty || qty <= 0 || !Number.isInteger(qty)) {
    return res.status(400).json({ success: false, error: 'Укажите целое положительное количество' });
  }

  const part = await col('parts').findOne({ id: Number(part_id) });
  if (!part) return res.status(404).json({ success: false, error: 'Запчасть не найдена' });

  await adjustStock(part.id, 'warehouse', null, qty);

  const t = await col('transfers').insert({
    part_id: part.id,
    quantity: qty,
    from_type: 'supplier',
    to_type: 'warehouse',
    type: 'restock',
    reason: reason || null,
    created_by: req.user.id,
    created_at: new Date().toISOString(),
  });

  await logAction(req.user, 'restock', 'transfer', t.id, { part: part.name, quantity: qty });
  res.status(201).json({ success: true, data: { id: t.id } });
});

// Передача между рабочими (админ).
router.post('/worker-transfer', adminOnly, async (req, res) => {
  const { part_id, from_worker_id, to_worker_id, quantity, reason } = req.body || {};
  const qty = Number(quantity);
  if (!part_id || !from_worker_id || !to_worker_id || !qty || qty <= 0 || !Number.isInteger(qty)) {
    return res.status(400).json({ success: false, error: 'Заполните все поля корректно' });
  }
  if (Number(from_worker_id) === Number(to_worker_id)) {
    return res.status(400).json({ success: false, error: 'Нельзя передать тому же рабочему' });
  }

  const part = await col('parts').findOne({ id: Number(part_id) });
  if (!part) return res.status(404).json({ success: false, error: 'Запчасть не найдена' });

  const fromQty = await getQuantity(part.id, 'worker', Number(from_worker_id));
  if (fromQty < qty) {
    return res.status(400).json({ success: false, error: `У отправителя недостаточно. Доступно: ${fromQty}` });
  }

  await adjustStock(part.id, 'worker', Number(from_worker_id), -qty);
  await adjustStock(part.id, 'worker', Number(to_worker_id), qty);

  const t = await col('transfers').insert({
    part_id: part.id,
    quantity: qty,
    from_type: 'worker',
    from_worker_id: Number(from_worker_id),
    to_type: 'worker',
    to_worker_id: Number(to_worker_id),
    type: 'assign',
    reason: reason || null,
    created_by: req.user.id,
    created_at: new Date().toISOString(),
  });

  await logAction(req.user, 'worker-transfer', 'transfer', t.id, { part: part.name, quantity: qty, from: Number(from_worker_id), to: Number(to_worker_id) });
  res.status(201).json({ success: true, data: { id: t.id } });
});

module.exports = router;
