const jwt = require('jsonwebtoken');
const { col } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'zapchast-secret-change-me-in-production';

function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    full_name: user.full_name,
    role: user.role,
    city: user.city,
    phone: user.phone,
    is_active: user.is_active,
    created_at: user.created_at,
  };
}

// Middleware: проверяет токен и подгружает пользователя.
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Требуется авторизация' });
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    col('users').findOne({ id: payload.id }).then((user) => {
      if (!user) {
        return res.status(401).json({ success: false, error: 'Пользователь не найден' });
      }
      if (!user.is_active) {
        return res.status(403).json({ success: false, error: 'Аккаунт заблокирован' });
      }
      req.user = user;
      next();
    }).catch((err) => {
      console.error(err);
      res.status(401).json({ success: false, error: 'Недействительный или истёкший токен' });
    });
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Недействительный или истёкший токен' });
  }
}

// Middleware: только администратор.
function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Доступ только для администратора' });
  }
  next();
}

module.exports = { signToken, publicUser, auth, adminOnly, JWT_SECRET };
