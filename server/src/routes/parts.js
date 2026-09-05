const express = require('express');
const { col } = require('../db');
const { adminOnly } = require('../auth');
const { adjustStock, availability, setStock } = require('../inventory');
const { logAction } = require('../audit');

const router = express.Router();

// Список запчастей с наличием по складу и рабочим.
router.get('/', async (req, res) => {
  const { search, category_id, brand, low_stock, mine } = req.query;

  let parts = (await col('parts').find({})).filter((p) => !p.deleted);
  const cats = await col('categories').find({});
  const catMap = Object.fromEntries(cats.map((c) => [c.id, c.name]));

  // Фильтрация.
  if (search) {
    const s = search.toLowerCase();
    parts = parts.filter(
      (p) =>
        (p.name || '').toLowerCase().includes(s) ||
        (p.sku || '').toLowerCase().includes(s) ||
        (p.brand || '').toLowerCase().includes(s)
    );
  }
  if (category_id) {
    parts = parts.filter((p) => p.category_id === Number(category_id));
  }
  if (brand) {
    const b = brand.toLowerCase();
    parts = parts.filter((p) => (p.brand || '').toLowerCase().includes(b));
  }
  if (mine === '1' && req.user.role === 'worker') {
    const myInv = await col('inventory').find({ worker_id: req.user.id, quantity: { $gt: 0 } });
    const myPartIds = new Set(myInv.map((r) => r.part_id));
    parts = parts.filter((p) => myPartIds.has(p.id));
  }

  // Остатки.
  const partIds = parts.map((p) => p.id);
  let invRows = [];
  if (partIds.length) {
    invRows = await col('inventory').find({ part_id: { $in: partIds } });
  }
  const users = await col('users').find({});
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

  const invMap = {};
  for (const r of invRows) {
    if (!invMap[r.part_id]) invMap[r.part_id] = [];
    invMap[r.part_id].push(r);
  }

  let data = parts.map((p) => {
    const inv = invMap[p.id] || [];
    const warehouse = inv.find((r) => r.owner_type === 'warehouse');
    const workers = inv.filter((r) => r.owner_type === 'worker' && r.quantity > 0);
    const total = inv.reduce((s, r) => s + r.quantity, 0);
    return {
      ...p,
      category_name: catMap[p.category_id] || null,
      total,
      warehouse_qty: warehouse ? warehouse.quantity : 0,
      workers: workers.map((w) => ({
        worker_id: w.worker_id,
        full_name: userMap[w.worker_id]?.full_name || '—',
        city: userMap[w.worker_id]?.city || null,
        quantity: w.quantity,
      })),
      low_stock: total <= 3,
    };
  });

  if (low_stock === '1') {
    data = data.filter((d) => d.low_stock);
  }

  data.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)) || b.id - a.id);
  res.json({ success: true, data });
});

// Детали запчасти.
router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const p = await col('parts').findOne({ id });
  if (!p) return res.status(404).json({ success: false, error: 'Запчасть не найдена' });

  const cats = await col('categories').find({});
  const category_name = (cats.find((c) => c.id === p.category_id) || {}).name || null;
  const avail = await availability(id);
  res.json({ success: true, data: { ...p, category_name, ...avail } });
});

// Создание запчасти (только админ), с начальным остатком на складе.
router.post('/', adminOnly, async (req, res) => {
  const { name, sku, brand, category_id, cost_price, sell_price, description, initial_quantity, image_url, shelf, cost_currency, sell_currency } = req.body || {};
  if (!name || !String(name).trim()) {
    return res.status(400).json({ success: false, error: 'Введите название запчасти' });
  }
  if (sku) {
    const exists = await col('parts').findOne({ sku: String(sku).trim() });
    if (exists) return res.status(409).json({ success: false, error: 'Артикул (SKU) уже существует' });
  }

  const partDoc = {
    name: String(name).trim(),
    brand: brand || null,
    category_id: category_id ? Number(category_id) : null,
    cost_price: Number(cost_price) || 0,
    sell_price: Number(sell_price) || 0,
    cost_currency: cost_currency || 'UZS',
    sell_currency: sell_currency || 'UZS',
    description: description || null,
    image_url: image_url || null,
    shelf: shelf ? String(shelf).trim() : null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  // Не пишем sku: null — разреженный уникальный индекс падает с duplicate key.
  if (sku) partDoc.sku = String(sku).trim();

  const part = await col('parts').insert(partDoc);

  const qty = Math.max(0, Number(initial_quantity) || 0);
  if (qty > 0) {
    await adjustStock(part.id, 'warehouse', null, qty);
  }

  const avail = await availability(part.id);
  res.status(201).json({ success: true, data: { ...part, ...avail } });
});

// Обновление запчасти (только админ).
router.put('/:id', adminOnly, async (req, res) => {
  const id = Number(req.params.id);
  const p = await col('parts').findOne({ id });
  if (!p) return res.status(404).json({ success: false, error: 'Запчасть не найдена' });

  const { name, sku, brand, category_id, cost_price, sell_price, description, image_url, shelf, cost_currency, sell_currency } = req.body || {};

  if (sku !== undefined && sku) {
    const exists = await col('parts').findOne({ sku: String(sku).trim() });
    if (exists && exists.id !== id) {
      return res.status(409).json({ success: false, error: 'Артикул (SKU) уже существует' });
    }
  }

  const set = { updated_at: new Date().toISOString() };
  if (name !== undefined) set.name = String(name).trim();
  if (sku !== undefined) set.sku = sku ? String(sku).trim() : null;
  if (brand !== undefined) set.brand = brand;
  if (category_id !== undefined) set.category_id = category_id ? Number(category_id) : null;
  if (cost_price !== undefined) set.cost_price = Number(cost_price);
  if (sell_price !== undefined) set.sell_price = Number(sell_price);
  if (cost_currency !== undefined) set.cost_currency = cost_currency;
  if (sell_currency !== undefined) set.sell_currency = sell_currency;
  if (description !== undefined) set.description = description;
  if (image_url !== undefined) set.image_url = image_url;
  if (shelf !== undefined) set.shelf = shelf ? String(shelf).trim() : null;

  await col('parts').update({ id }, { $set: set });

  const updated = await col('parts').findOne({ id });
  const avail = await availability(id);
  res.json({ success: true, data: { ...updated, ...avail } });
});

// Установка точного количества на складе (только админ).
router.post('/:id/stock', adminOnly, async (req, res) => {
  const id = Number(req.params.id);
  const p = await col('parts').findOne({ id });
  if (!p) return res.status(404).json({ success: false, error: 'Запчасть не найдена' });

  const { warehouse_quantity } = req.body || {};
  const qty = Math.max(0, Number(warehouse_quantity) || 0);
  if (!Number.isInteger(qty)) {
    return res.status(400).json({ success: false, error: 'Введите целое неотрицательное количество' });
  }

  await setStock(id, 'warehouse', null, qty);
  await logAction(req.user, 'set_stock', 'part', id, { name: p.name, warehouse_quantity: qty });

  const avail = await availability(id);
  res.json({ success: true, data: { id, ...avail } });
});

// Удаление запчасти (только если нет остатков). Мягкое удаление — данные сохраняются.
router.delete('/:id', adminOnly, async (req, res) => {
  const id = Number(req.params.id);
  const p = await col('parts').findOne({ id });
  if (!p) return res.status(404).json({ success: false, error: 'Запчасть не найдена' });

  const inv = await col('inventory').find({ part_id: id });
  const total = inv.reduce((s, r) => s + r.quantity, 0);
  if (total > 0) {
    return res.status(400).json({ success: false, error: 'У запчасти есть остатки. Сначала продайте или верните их.' });
  }

  await col('parts').update({ id }, { $set: { deleted: 1 } });
  await logAction(req.user, 'delete', 'part', id, { name: p.name, sku: p.sku });
  res.json({ success: true });
});

module.exports = router;
