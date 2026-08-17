// Загрузка переменных окружения из .env (ищем и в корне проекта, и в server/).
const path = require('path');
try {
  const dotenv = require('dotenv');
  dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });
  dotenv.config({ path: path.join(__dirname, '..', '.env') });
} catch (e) { /* dotenv опционален */ }

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { connect } = require('./db');
const { auth } = require('./auth');

const app = express();

// Базовые заголовки безопасности.
app.use(helmet());

// CORS: разрешаем все origin (приложение отдаётся тем же сервером).
app.use(cors());

// Лимит размера JSON-тела (защита от больших запросов).
app.use(express.json({ limit: '1mb' }));

// Rate limiting: защита от перебора пароля и злоупотреблений.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 30, // максимум 30 попыток
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Слишком много попыток. Попробуйте позже.' },
});
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 минута
  max: 200, // максимум 200 запросов
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Слишком много запросов. Попробуйте позже.' },
});
app.use('/api/auth/login', loginLimiter);
app.use('/api', apiLimiter);

// Статика для локально загруженных фото (fallback, когда R2 не настроен).
app.use('/uploads', express.static(path.join(__dirname, '..', 'data', 'uploads')));

// Простой лог запросов.
app.use((req, res, next) => {
  if (req.method !== 'GET') {
    console.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl}`);
  }
  next();
});

app.get('/api/health', (req, res) => {
  const { isConfigured } = require('./r2');
  res.json({ ok: true, db: 'mongodb', r2: isConfigured ? 'connected' : 'local' });
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', auth, require('./routes/users'));
app.use('/api/categories', auth, require('./routes/categories'));
app.use('/api/parts', auth, require('./routes/parts'));
app.use('/api/transfers', auth, require('./routes/transfers'));
app.use('/api/sales', auth, require('./routes/sales'));
app.use('/api/dashboard', auth, require('./routes/dashboard'));
app.use('/api/uploads', auth, require('./routes/uploads'));
app.use('/api/audit', auth, require('./routes/audit'));

// Раздача собранного фронтенда (client/dist), если он собран.
// Для продакшена Render собирает фронт и отдаёт его этим же сервером.
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
const fs = require('fs');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  // SPA fallback: все не-API маршруты отдают index.html.
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Обработка ошибок.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
});

const PORT = process.env.PORT || 4000;

// В продакшене (когда NODE_ENV=production) требуем заданный JWT_SECRET.
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.error('ОШИБКА: в продакшене обязательно задайте переменную окружения JWT_SECRET.');
  process.exit(1);
}

async function start() {
  try {
    await connect();
    app.listen(PORT, () => {
      console.log(`Сервер запущен: http://localhost:${PORT}`);
    });
  } catch (e) {
    console.error('Не удалось подключиться к MongoDB:', e.message);
    process.exit(1);
  }
}

start();
