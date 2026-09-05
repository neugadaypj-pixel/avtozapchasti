const express = require('express');
const { getDb } = require('../db');
const { adminOnly } = require('../auth');
const { logAction } = require('../audit');

const router = express.Router();
router.use(adminOnly);

// Полная очистка данных сайта.
// Удаляются все запчасти, остатки, продажи, расходы, передачи, заказы,
// категории, уведомления, журнал действий и подтверждения долгов.
// Аккаунты администраторов сохраняются, чтобы не потерять доступ.
router.post('/clear-data', async (req, res) => {
  const d = await getDb();
  const collections = [
    'parts', 'inventory', 'categories', 'sales', 'expenses',
    'transfers', 'orders', 'notifications', 'audit_logs', 'debt_payments',
  ];

  for (const name of collections) {
    await d.collection(name).deleteMany({});
  }

  // Удаляем всех пользователей, кроме администраторов.
  await d.collection('users').deleteMany({ role: { $ne: 'admin' } });

  // Сбрасываем счётчики id для очищенных коллекций.
  for (const name of collections) {
    await d.collection('counters').deleteOne({ _id: name });
  }

  await logAction(req.user, 'clear_data', 'system', null, { collections });
  res.json({ success: true });
});

module.exports = router;
