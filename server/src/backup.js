// Резервное копирование MongoDB в JSON-файл (и опционально в Cloudflare R2).
// Запуск: node src/backup.js
// Выгружает все коллекции в server/data/backups/backup-<дата>.json
// Если настроен R2 — дополнительно загружает файл в bucket в папку backups/.
const path = require('path');
const fs = require('fs');
try {
  const dotenv = require('dotenv');
  dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });
  dotenv.config({ path: path.join(__dirname, '..', '.env') });
} catch (e) {}

const { connect, getDb } = require('./db');
const { uploadImage, isConfigured } = require('./r2');

const COLLECTIONS = ['users', 'categories', 'parts', 'inventory', 'transfers', 'sales', 'expenses', 'orders', 'notifications', 'audit_logs', 'debt_payments', 'counters'];

async function backup() {
  await connect();
  const d = await getDb();

  const dump = { exported_at: new Date().toISOString(), collections: {} };
  for (const name of COLLECTIONS) {
    try {
      const rows = await d.collection(name).find({}).toArray();
      dump.collections[name] = rows;
    } catch (e) {
      console.warn(`Пропущена коллекция ${name}:`, e.message);
    }
  }

  const backupDir = path.join(__dirname, '..', 'data', 'backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  const filename = `backup-${new Date().toISOString().slice(0, 10)}.json`;
  const filepath = path.join(backupDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(dump));

  const sizeKb = (fs.statSync(filepath).size / 1024).toFixed(1);
  console.log(`Локальный бэкап создан: ${filepath} (${sizeKb} КБ)`);

  if (isConfigured) {
    try {
      const buffer = fs.readFileSync(filepath);
      const url = await uploadImage(buffer, 'application/json', '.json');
      console.log(`Бэкап загружен в R2: ${url}`);
    } catch (e) {
      console.error('Не удалось загрузить бэкап в R2:', e.message);
    }
  } else {
    console.log('R2 не настроен — бэкап только локальный.');
  }

  process.exit(0);
}

backup().catch((e) => {
  console.error('Ошибка бэкапа:', e);
  process.exit(1);
});
