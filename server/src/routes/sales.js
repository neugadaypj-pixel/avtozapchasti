const express = require('express');
const { col } = require('../db');
const { adjustStock, getQuantity } = require('../inventory');
const { logAction } = require('../audit');

const router = express.Router();

const PAYMENT_TYPES = ['cash', 'card', 'bank']; // naqd, kartaga, hisob raqamga
const PAYMENT_STATUS = ['paid', 'pending']; // to'langan, kutilmoqda

// Список продаж. Админ видит все, рабочий — только свои.
router.get('/', async (req, res) => {
  let rows = await col('sales').find({});
  rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)) || b.id - a.id);

  if (req.user.role !== 'admin') {
    rows = rows.filter((s) => s.worker_id === req.user.id);
  }
  rows = rows.slice(0, 500);

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

// Продажа. Рабочие продают со своего остатка, админ — со склада.
router.post('/', async (req, res) => {
  const {
    part_id, quantity, unit_price, client_name, client_phone, note,
    payment_type, payment_status,
  } = req.body || {};

  const qty = Number(quantity);
  if (!part_id || !qty || qty <= 0 || !Number.isInteger(qty)) {
    return res.status(400).json({ success: false, error: "Musbat butun son kiriting" });
  }
  if (!PAYMENT_TYPES.includes(payment_type)) {
    return res.status(400).json({ success: false, error: "To'lov turini tanlang" });
  }

  const part = await col('parts').findOne({ id: Number(part_id) });
  if (!part) return res.status(404).json({ success: false, error: "Ehtiyot qism topilmadi" });

  // Админ продаёт со склада, рабочий — со своего остатка.
  const isAdmin = req.user.role === 'admin';
  const ownerType = isAdmin ? 'warehouse' : 'worker';
  const ownerId = isAdmin ? null : req.user.id;

  const available = await getQuantity(part.id, ownerType, ownerId);
  if (available < qty) {
    const where = isAdmin ? "Skladda" : "Ishchida";
    return res.status(400).json({ success: false, error: `${where} yetarli mahsulot yo'q. Mavjud: ${available}` });
  }

  const price = unit_price !== undefined ? Number(unit_price) : part.sell_price;
  const total = price * qty;

  // Если "оплата сразу" — статус paid, иначе pending.
  const status = payment_status === 'pending' ? 'pending' : 'paid';

  await adjustStock(part.id, ownerType, ownerId, -qty);

  const s = await col('sales').insert({
    part_id: part.id,
    worker_id: req.user.id,
    quantity: qty,
    unit_price: price,
    total,
    client_name: client_name || null,
    client_phone: client_phone || null,
    note: note || null,
    payment_type,
    payment_status: status,
    confirmed_by: null,
    confirmed_at: null,
    created_at: new Date().toISOString(),
  });

  await logAction(req.user, 'sell', 'sale', s.id, {
    part: part.name, quantity: qty, total, payment_type, payment_status: status,
  });
  res.status(201).json({ success: true, data: { id: s.id, total, payment_status: status } });
});

// Подтверждение оплаты (рабочий подтверждает свою pending-продажу).
router.post('/:id/confirm', async (req, res) => {
  const id = Number(req.params.id);
  const s = await col('sales').findOne({ id });
  if (!s) return res.status(404).json({ success: false, error: "Sotuv topilmadi" });

  if (req.user.role !== 'admin' && s.worker_id !== req.user.id) {
    return res.status(403).json({ success: false, error: "Birovning savdosini tasdiqlab bo'lmaydi" });
  }

  if (s.payment_status === 'paid') {
    return res.status(400).json({ success: false, error: "Bu sotuv allaqachon to'langan" });
  }

  await col('sales').update({ id }, {
    $set: {
      payment_status: 'paid',
      confirmed_by: req.user.id,
      confirmed_at: new Date().toISOString(),
    },
  });
  await logAction(req.user, 'confirm_payment', 'sale', id, { total: s.total });
  res.json({ success: true });
});

// Редактирование продажи (в течение 24 часов, кроме времени).
router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const s = await col('sales').findOne({ id });
  if (!s) return res.status(404).json({ success: false, error: "Sotuv topilmadi" });

  if (req.user.role !== 'admin' && s.worker_id !== req.user.id) {
    return res.status(403).json({ success: false, error: "Birovning savdosini o'zgartirib bo'lmaydi" });
  }

  const created = new Date(s.created_at);
  const now = new Date();
  const hours = (now - created) / (1000 * 60 * 60);
  if (hours > 24) {
    return res.status(400).json({ success: false, error: "Sotuvni faqat 24 soat ichida o'zgartirish mumkin" });
  }

  const { quantity, unit_price, client_name, client_phone, note, payment_type, payment_status } = req.body || {};

  const set = {};
  if (quantity !== undefined) {
    const qty = Number(quantity);
    if (!qty || qty <= 0 || !Number.isInteger(qty)) {
      return res.status(400).json({ success: false, error: "Musbat butun son kiriting" });
    }
    set.quantity = qty;
  }
  if (unit_price !== undefined) set.unit_price = Number(unit_price);
  if (client_name !== undefined) set.client_name = client_name;
  if (client_phone !== undefined) set.client_phone = client_phone;
  if (note !== undefined) set.note = note;
  if (payment_type !== undefined) {
    if (!PAYMENT_TYPES.includes(payment_type)) {
      return res.status(400).json({ success: false, error: "To'lov turini tanlang" });
    }
    set.payment_type = payment_type;
  }
  if (payment_status !== undefined) {
    if (!PAYMENT_STATUS.includes(payment_status)) {
      return res.status(400).json({ success: false, error: "To'lov holatini tanlang" });
    }
    set.payment_status = payment_status;
    if (payment_status === 'paid') {
      set.confirmed_by = req.user.id;
      set.confirmed_at = new Date().toISOString();
    } else {
      set.confirmed_by = null;
      set.confirmed_at = null;
    }
  }

  // Пересчитать total.
  const newQty = set.quantity !== undefined ? set.quantity : s.quantity;
  const newPrice = set.unit_price !== undefined ? set.unit_price : s.unit_price;
  set.total = newQty * newPrice;

  await col('sales').update({ id }, { $set: set });
  await logAction(req.user, 'update', 'sale', id, { fields: Object.keys(set) });

  const updated = await col('sales').findOne({ id });
  res.json({ success: true, data: updated });
});

module.exports = router;
