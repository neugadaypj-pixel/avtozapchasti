// База данных MongoDB (Atlas). Числовые id генерируются через коллекцию counters
// для совместимости с фронтендом, который использует числовые id.
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const MONGODB_DB = process.env.MONGODB_DB || 'zapchast';

let client = null;
let db = null;

async function connect() {
  if (db) return db;
  client = new MongoClient(MONGODB_URI);
  await client.connect();
  db = client.db(MONGODB_DB);
  await ensureIndexes(db);
  console.log('MongoDB подключена');
  return db;
}

async function ensureIndexes(d) {
  // Уникальность username.
  await d.collection('users').createIndex({ username: 1 }, { unique: true });
  // Уникальность SKU (частично: только существующие).
  await d.collection('parts').createIndex({ sku: 1 }, { unique: true, sparse: true });
  // Уникальность названия категории.
  await d.collection('categories').createIndex({ name: 1 }, { unique: true });
  // Уникальность позиции остатка (part + владелец + рабочий).
  await d.collection('inventory').createIndex(
    { part_id: 1, owner_type: 1, worker_id: 1 },
    { unique: true }
  );
  // Поиск остатков по владельцу.
  await d.collection('inventory').createIndex({ owner_type: 1, worker_id: 1 });
  // Продажи по рабочему и дате.
  await d.collection('sales').createIndex({ worker_id: 1, created_at: -1 });
  await d.collection('sales').createIndex({ created_at: -1 });
  // Передачи.
  await d.collection('transfers').createIndex({ created_at: -1 });
  // Аудит-лог.
  await d.collection('audit_logs').createIndex({ created_at: -1 });
  // Расходы.
  await d.collection('expenses').createIndex({ worker_id: 1, created_at: -1 });
  await d.collection('expenses').createIndex({ created_at: -1 });
  // Уведомления.
  await d.collection('notifications').createIndex({ worker_id: 1, read: 1, created_at: -1 });
  // Заказы на поставку.
  await d.collection('orders').createIndex({ created_at: -1 });
  await d.collection('orders').createIndex({ status: 1 });
}

// Получить следующий числовой id для коллекции.
async function nextId(name) {
  const d = await getDb();
  const r = await d.collection('counters').findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' }
  );
  return r.seq;
}

async function getDb() {
  if (!db) await connect();
  return db;
}

function col(name) {
  return {
    find: (q) => getDb().then((d) => d.collection(name).find(q).toArray()),
    findOne: (q) => getDb().then((d) => d.collection(name).findOne(q)),
    insert: async (doc) => {
      const d = await getDb();
      const id = doc.id || (await nextId(name));
      await d.collection(name).insertOne({ ...doc, id });
      return { ...doc, id };
    },
    update: async (q, update, options = {}) => {
      const d = await getDb();
      const r = await d.collection(name).updateMany(q, update, options);
      return r.modifiedCount;
    },
    delete: async (q) => {
      const d = await getDb();
      const r = await d.collection(name).deleteMany(q);
      return r.deletedCount;
    },
    aggregate: (pipeline) => getDb().then((d) => d.collection(name).aggregate(pipeline).toArray()),
    count: (q) => getDb().then((d) => d.collection(name).countDocuments(q)),
  };
}

module.exports = { connect, getDb, col, nextId };
