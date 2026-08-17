const express = require('express');
const bcrypt = require('bcryptjs');
const { col } = require('../db');
const { signToken, publicUser } = require('../auth');

const router = express.Router();

// Вход.
router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Введите логин и пароль' });
  }
  const user = await col('users').findOne({ username: String(username).trim() });
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ success: false, error: 'Неверный логин или пароль' });
  }
  if (!user.is_active) {
    return res.status(403).json({ success: false, error: 'Аккаунт заблокирован' });
  }
  res.json({ success: true, token: signToken(user), user: publicUser(user) });
});

module.exports = router;
