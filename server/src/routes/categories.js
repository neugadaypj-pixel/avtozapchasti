const express = require('express');
const { col } = require('../db');
const { adminOnly } = require('../auth');
const { logAction } = require('../audit');

const router = express.Router();

// Список категорий (доступно всем авторизованным).
router.get('/', async (req, res) => {
  const cats = await col('categories').find({});
  cats.sort((a, b) => a.name.localeCompare(b.name));
  const parts = await col('parts').find({});
  const countMap = {};
  for (const p of parts) {
    if (p.category_id != null) countMap[p.category_id] = (countMap[p.category_id] || 0) + 1;
  }
  const data = cats.map((c) => ({ ...c, parts_count: countMap[c.id] || 0 }));
  res.json({ success: true, data });
});

// Создание категории (только админ).
router.post('/', adminOnly, async (req, res) => {
  const { name } = req.body || {};
  if (!name || !String(name).trim()) {
    return res.status(400).json({ success: false, error: 'Введите название категории' });
  }
  const trimmed = String(name).trim();
  const exists = await col('categories').findOne({ name: trimmed });
  if (exists) return res.status(409).json({ success: false, error: 'Категория уже существует' });
  const cat = await col('categories').insert({ name: trimmed, created_at: new Date().toISOString() });
  await logAction(req.user, 'create', 'category', cat.id, { name: trimmed });
  res.status(201).json({ success: true, data: cat });
});

// Удаление категории (только админ).
router.delete('/:id', adminOnly, async (req, res) => {
  const id = Number(req.params.id);
  const cat = await col('categories').findOne({ id });
  if (!cat) return res.status(404).json({ success: false, error: 'Категория не найдена' });
  await col('categories').delete({ id });
  // Убираем ссылку у запчастей.
  await col('parts').update({ category_id: id }, { $set: { category_id: null } });
  await logAction(req.user, 'delete', 'category', id, { name: cat.name });
  res.json({ success: true });
});

module.exports = router;
