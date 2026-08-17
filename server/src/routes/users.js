const express = require('express');
const bcrypt = require('bcryptjs');
const { col } = require('../db');
const { adminOnly, publicUser } = require('../auth');

const router = express.Router();
router.use(adminOnly);

// Список пользователей с суммой остатков по каждому.
router.get('/', async (req, res) => {
  const users = await col('users').find({});
  users.sort((a, b) => (b.role === 'admin') - (a.role === 'admin') || (a.full_name || '').localeCompare(b.full_name || ''));
  const inv = await col('inventory').find({ owner_type: 'worker', quantity: { $gt: 0 } });
  const stockCount = {};
  for (const r of inv) stockCount[r.worker_id] = (stockCount[r.worker_id] || 0) + 1;

  const result = users.map((u) => ({ ...publicUser(u), stock_count: stockCount[u.id] || 0 }));
  res.json({ success: true, data: result });
});

// Создание рабочего (и любого пользователя).
router.post('/', async (req, res) => {
  const { username, password, full_name, role = 'worker', city, phone } = req.body || {};
  if (!username || !password || !full_name) {
    return res.status(400).json({ success: false, error: 'Логин, пароль и ФИО обязательны' });
  }
  if (!['admin', 'worker'].includes(role)) {
    return res.status(400).json({ success: false, error: 'Некорректная роль' });
  }
  const uname = String(username).trim();
  const exists = await col('users').findOne({ username: uname });
  if (exists) {
    return res.status(409).json({ success: false, error: 'Такой логин уже занят' });
  }
  const hash = bcrypt.hashSync(String(password), 10);
  const user = await col('users').insert({
    username: uname,
    password_hash: hash,
    full_name,
    role,
    city: city || null,
    phone: phone || null,
    is_active: 1,
    created_at: new Date().toISOString(),
  });
  res.status(201).json({ success: true, data: publicUser(user) });
});

// Обновление пользователя (без обязательной смены пароля).
router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const user = await col('users').findOne({ id });
  if (!user) return res.status(404).json({ success: false, error: 'Пользователь не найден' });

  const { full_name, role, city, phone, is_active, password } = req.body || {};

  if (role !== undefined && !['admin', 'worker'].includes(role)) {
    return res.status(400).json({ success: false, error: 'Некорректная роль' });
  }
  // Нельзя заблокировать/понизить самого себя.
  if (id === req.user.id) {
    if (role !== undefined && role !== 'admin') {
      return res.status(400).json({ success: false, error: 'Нельзя понизить самого себя' });
    }
    if (is_active === 0) {
      return res.status(400).json({ success: false, error: 'Нельзя заблокировать самого себя' });
    }
  }

  const set = {};
  if (full_name !== undefined) set.full_name = full_name;
  if (role !== undefined) set.role = role;
  if (city !== undefined) set.city = city;
  if (phone !== undefined) set.phone = phone;
  if (is_active !== undefined) set.is_active = is_active ? 1 : 0;
  if (password) set.password_hash = bcrypt.hashSync(String(password), 10);
  await col('users').update({ id }, { $set: set });

  const updated = await col('users').findOne({ id });
  res.json({ success: true, data: publicUser(updated) });
});

// Удаление пользователя (только если у него нет остатков).
router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const user = await col('users').findOne({ id });
  if (!user) return res.status(404).json({ success: false, error: 'Пользователь не найден' });
  if (id === req.user.id) {
    return res.status(400).json({ success: false, error: 'Нельзя удалить самого себя' });
  }

  const stock = await col('inventory').find({ worker_id: id });
  const totalQty = stock.reduce((s, r) => s + r.quantity, 0);
  if (totalQty > 0) {
    return res.status(400).json({ success: false, error: 'У рабочего есть остатки. Сначала верните их на склад.' });
  }

  await col('users').delete({ id });
  res.json({ success: true });
});

module.exports = router;
