// Наполнение MongoDB: создаёт только администратора (без демо-данных).
// Сброс: node src/seed.js --reset
const path = require('path');
try {
  const dotenv = require('dotenv');
  dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });
  dotenv.config({ path: path.join(__dirname, '..', '.env') });
} catch (e) {}

const bcrypt = require('bcryptjs');
const { connect, col, getDb } = require('./db');

async function seed() {
  await connect();

  // Флаг --reset очищает все коллекции перед наполнением.
  if (process.argv.includes('--reset')) {
    const d = await getDb();
    for (const name of ['users', 'categories', 'parts', 'inventory', 'transfers', 'sales', 'expenses', 'audit_logs', 'counters']) {
      await d.collection(name).deleteMany({});
    }
    console.log('Коллекции очищены.');
  }

  const adminExists = await col('users').findOne({ username: 'admin' });
  if (!adminExists) {
    const hash = bcrypt.hashSync('admin123', 10);
    await col('users').insert({
      username: 'admin',
      password_hash: hash,
      full_name: 'Администратор',
      role: 'admin',
      city: null,
      phone: null,
      is_active: 1,
      created_at: new Date().toISOString(),
    });
    console.log('Создан администратор: admin / admin123');
  } else {
    console.log('Администратор уже существует (admin).');
  }

  console.log('База MongoDB готова.');
  process.exit(0);
}

seed().catch((e) => {
  console.error('Ошибка при наполнении MongoDB:', e);
  process.exit(1);
});
