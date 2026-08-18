const express = require('express');
const { getNotifications, markRead } = require('../notifications');

const router = express.Router();

// Список уведомлений рабочего + информация о малом остатке.
router.get('/', async (req, res) => {
  const notifs = await getNotifications(req.user.id);
  res.json({ success: true, data: notifs });
});

// Пометить как прочитанные.
router.post('/read', async (req, res) => {
  const { ids } = req.body || {};
  if (Array.isArray(ids) && ids.length) {
    await markRead(req.user.id, ids.map(Number));
  }
  res.json({ success: true });
});

module.exports = router;
