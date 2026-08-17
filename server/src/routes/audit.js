const express = require('express');
const { adminOnly } = require('../auth');
const { getLogs } = require('../audit');

const router = express.Router();

// Список аудит-логов (только админ).
router.get('/', adminOnly, async (req, res) => {
  try {
    const logs = await getLogs(200);
    res.json({ success: true, data: logs });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Не удалось получить логи' });
  }
});

module.exports = router;
