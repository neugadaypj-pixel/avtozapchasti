// Одноразовый скрипт очистки данных сайта.
// Удаляет все запчасти, остатки, продажи, расходы, передачи, заказы,
// категории, уведомления, журнал действий и подтверждения долгов.
// Сохраняет только аккаунты администраторов.
// Запуск: node server/src/clear-data.js
const path = require('path');
try {
  const dotenv = require('dotenv');
  dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });
  dotenv.config({ path: path.join(__dirname, '..', '.env') });
} catch (e) {}

const { getDb } = require('./db');

async function clear() {
  const d = await getDb();
  const collections = [
    'parts', 'inventory', 'categories', 'sales', 'expenses',
    'transfers', 'orders', 'notifications', 'audit_logs', 'debt_payments',
  ];

  for (const name of collections) {
    await d.collection(name).deleteMany({});
  }

  await d.collection('users').deleteMany({ role: { $ne: 'admin' } });

  for (const name of collections) {
    await d.collection('counters').deleteOne({ _id: name });
  }

  console.log('Данные очищены (сохранены только администраторы).');
  process.exit(0);
}

clear().catch((e) => {
  console.error('Ошибка очистки:', e.message);
  process.exit(1);
});
